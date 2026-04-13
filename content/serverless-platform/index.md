---
title: Serverless Inference Platform
author:
    name: Kevin Xiao
    url: https://kxiao.dev
    image: https://media.licdn.com/dms/image/v2/D5603AQEE683SF9HjqA/profile-displayphoto-scale_200_200/B56ZyC0Iz5KsAY-/0/1771721233394?e=2147483647&v=beta&t=AzmvOh-LaEPlzrzv8BOajL1zMrNGwydWLexQULVWQ_M
---

## Problem Statement

Running inference is expensive. Modern LLMs require specialized accelerator hardware, consume substantial memory, and saturate compute resources under load. For most non-hyperscaled companies or specialized inference tasks, demand is typically bursty and unpredictable. Overnight batch jobs, a random work session, or image pre-processing which is a batched task rather than a continuous one. For these workloads, always-on GPU servers are wasteful, and users pay for the entire duration that a server is rented, rather than when there is actually useful work being done.

Cold starts can be incredily lengthy, especially as loading a LLM from disk or ingress over a network into GPU memory is a task that requires minutes. This means scaling down to zero is basically impossible, otherwise a latency that makes a system effectively unusable is introduced for interactive workloads. 

Additionally, one could consider that multiple users or teams may each need access to different models, but with constrained resources it wouldn't be acceptable for one task to monopolize all compute. Existing approaches either require scaling (or overprovisioning) to meet SLOs or attempting to autoscale typically is too slow - and as such the core problem is an efficient allocation/deallocation. 

SIP is a serverless inference platform designed around this constraint. It aims to contribute towards a better inference ecosystem using a GPU process checkpoint/restore, along with other container level optimizations to keep model snapshots resident in CPU RAM, to enable model switching on a shared GPU in under 5 seconds rather than 30–150 seconds.

SIP focuses on LLM inference but is designed to generalize to other GPU-accelerated workloads.

## Goals

1. Learning is the foremost goal. The intended takeaway is understanding how inference systems work: inference engines, GPU checkpoint/restore, and the distributed systems needed to scale. Compared to other domains in software engineering, the available resources feel less centralized and less well documented. Many serverless platforms are closed source (e.g. Modal) or do not publish design docs/RFCs. I hope this doc (and eventually code) helps fill in some of those gaps.

2. Streamlining inference is the second goal. Containerization and infra setup add a lot of friction. SIP aims to reduce that friction and make hosting a serverless inference platform feel practical from a developer experience standpoint. The main point of differentiation is reasonable cold-start performance and a better story for sharing constrained GPU resources across multiple tenants. As a student, I'm also curious why inference is comparatively uncommon to run locally or self-configure, while self-hosting web servers or general workloads is not.

3. Performance is the last goal, but it ties into everything above. Generally, ergonomics are prioritized over performance where the losses are marginal. That said, orchestration, model swapping, and checkpoint/restore must be implemented correctly to keep model switching and cold starts within acceptable bounds. If there are clear performance wins for a reasonable amount of effort, scope may expand.

## Requirements

### Functional Requirements

Application interface:
- SIP exposes an OpenAI-compatible HTTP API for interactive inference (e.g. chat completions).
- Responses support token streaming (Server-Sent Events). WebSockets may be added later, but are not required for v1.
- Requests include a `model` selector. Each GPU worker runs exactly one model at a time.
- If the requested model is not active on the target worker, SIP fails fast with `503 Service Unavailable` and a `Retry-After` hint.
- `429 Too Many Requests` is reserved for overload/rate-limit scenarios (e.g. the active model is saturated).
- Clients should stop retrying after 15s total.
- An optional `conversation_id` may be accepted as an opaque identifier for client-side correlation. Strong session affinity is out of scope for v1.

Performance and throughput:
- For an interactive experience, once a model snapshot is cached in CPU RAM, restore and time-to-first-token should be fast.
- Target: p95 restore-to-first-token <= 5s (restore start -> first token can be produced), excluding network latency.
- Initial validation target: ~35B parameter models (or similarly sized aggressively-quantized variants). Larger models (e.g. ~100B) are a stretch goal.
- SIP supports concurrent streaming requests via dynamic batching (with a small batching window on the order of tens of milliseconds).

### Non Functional Requirements

Scalability:

- Single-cluster scaling: increasing the number of GPUs should increase total throughput roughly linearly, up to expected bottlenecks (CPU, RAM bandwidth, network, scheduler overhead).
- Per-GPU performance should not materially degrade as additional GPUs are added (i.e. control-plane overhead should stay small relative to inference time).
- Multi-cluster or multi-region federation is out of scope; it requires a different architecture and consistency model.

Security:

- SIP does not execute user-supplied code; it serves inference for explicitly deployed model images/configurations.
- Transport security: TLS termination at the API gateway.
- Auth may be minimal (e.g. static API keys), but requests should be attributable (request id) and access should be restrictable per deployment.
- Isolation: GPU workers run with least privilege and are isolated from control-plane credentials; snapshot storage and caches must not be world-readable.

Reliability and observability:

- Restore failures (e.g. incompatible snapshot, OOM) should surface as explicit errors and should not wedge the worker.
- Basic metrics should be available: restore-to-first-token p50/p95, cache hit rate, reject rate (503/429), tokens/sec, and GPU utilization.

## Assumptions and Out of Scope

Assumptions:

- Worker environment: Linux hosts with NVIDIA GPUs (initially a single H100).
- Artifact locality: weights/engine artifacts live on local storage (e.g. NVMe). v1 does not fetch layers from remote storage on the critical path.
- "Cached in CPU RAM": artifacts are hot in the OS page cache (reads are served from memory), not duplicated into an application-managed heap cache.
- Cluster model: single cluster / single control plane.

Out of scope (v1):

- Keeping a paid "warm pool" of idle GPU workers to eliminate cold starts. SIP instead uses fail-fast + retry when the requested model is not active.
- Custom container image formats and lazy file loading via a virtual filesystem (e.g. FUSE-backed layer fetching). v1 assumes conventional container images and local artifacts.
- Sandbox runtimes such as gVisor, and restoring an entire Linux VM/container as part of model switching.
- Multi-cluster or multi-region scheduling and federation.
- Production-grade multi-tenant isolation, billing, or enterprise authentication (beyond minimal request attribution / API keys).

Stretch / research topics:

- GPU process checkpoint/restore (e.g. CUDA checkpoint utilities) to further reduce model switch times. This is not a hard requirement for v1 due to complexity and portability constraints.

## Design

The design is split into a few core components. The API gateway validates requests, routes them to the scheduler, and streams tokens back to the client. The scheduler decides whether to serve or reject a request and triggers model switches when needed. GPU workers host at most one active model, execute inference, and batch across concurrent streams. Each worker also owns a cache manager that keeps artifacts hot in memory (OS page cache) under an LRU policy with a configurable RAM budget.

The main issue with serverless inference is that provisioning and loading is slow enough that naive scale-to-zero breaks interactive workloads.

#### API Gateway

- Validates and authenticates requests.
- Routes requests to the scheduler.
- Streams tokens back to the client.

#### Scheduler

- Admits or rejects requests (fail-fast + `Retry-After` when the requested model is not active).
- Triggers model switches / restores on workers.

#### GPU Worker

- Hosts at most one active model at a time.
- Serves inference and supports dynamic batching across concurrent streams.

#### Cache Manager

- Maintains a bounded cache budget.
- Keeps artifacts hot via OS page cache; evicts using LRU.
