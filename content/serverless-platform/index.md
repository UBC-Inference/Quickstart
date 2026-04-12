---
title: Serverless Inference Platform
author:
    name: Kevin Xiao
    url: https://kxiao.dev
    image: https://media.licdn.com/dms/image/v2/D5603AQEE683SF9HjqA/profile-displayphoto-scale_200_200/B56ZyC0Iz5KsAY-/0/1771721233394?e=2147483647&v=beta&t=AzmvOh-LaEPlzrzv8BOajL1zMrNGwydWLexQULVWQ_M
---

## Problem Statement

Running inference is expensive. Modern LLMs require specialized accelerator hardware, consume substantial memory, and saturate compute resources under load. For most non-hyperscaled companies or specialized inference tasks, demand is typically bursty and unpredictable. Overnight batch jobs, a random work session, or image pre-processing which is a batched task rather than a continuous one. For these workloads, always-on GPU servers are wasteful, and users pay for the entire duration that a server is rented, rather than when there is actually useful work being done.

Renting elastic compute is cheaper in principle but introduces friction in the developer experience. Cold starts can be incredily lengthy, especially as loading a LLM from disk or ingress over a network into GPU memory is a task that requires minutes. This means scaling down to zero is basically impossible, otherwise a latency that makes a system effectively unusable is introduced for interactive workloads.

Additionally, one could consider that multiple users or teams may each need access to different models, but with constrained resources it wouldn't be acceptable for one task to monopolize all compute. Existing approaches either require simply scaling and introducing more compute or having to always reload images.

SIP is a serverless inference platform designed around this constraint. It aims to contribute towards a better inference ecosystem using a GPU process checkpoint/restore, along with other container level optimizations to keep model snapshots resident in CPU RAM, to enable model switching on a shared GPU in under 5 seconds rather than 30–150 seconds.

SIP focuses on LLM inference but is designed to generalize to other GPU-accelerated workloads.

## Goals

1. Learning is the foremost goal. Understanding how inference systems work - inference engines, checkpointing/restoring GPUs, and the distributed systems required to scale - is the intended takeaway. There are resources regarding inference, but they are not as well documented or centralized as other domains in software engineering. Most existing serverless platforms are closed source (e.g. modal) or do not have any available design docs or RFCs to read through. I hope that others may gain a better understanding of these systems through this design doc (and eventually code), even if partially.

2. Streamlining inference. Working around containerization and setting up your own infrastructure is a process with a lot of friction. Ideally SIP could streamline the process for hosting a serverless inference platform, but also ergonomics and developer experience is important for making a project like this practical. The actual main point of differentiation that SIP is intended to bring is a reasonable cold-start performance and a better way to manage resource sharing between multiple tenants. Most of all as a student I'm curious why in contrast to other compute patterns why inference is the least common to be run locally or self-configured. With developers, datascientists, and researches alike choosing to use platforms like collab or cloud providers many abstraction layers above bare metal, I want to bridge the gap or understand why it is this way - self hosting web servers, or even general workloads are not uncommon.

3. Performance is the last goal, but also ties into everything that has already been stated. Generally ergonomics are prioritized to performance wheer appropriate (i.e. the losses are marginal). Regarding implementation, functionality like serving orchestration, image swapping, and checkpointing must be implemented correctly to satisfy acceptable bounds for model switching and coldstarts. If performance gains are possible for a reasonably proportional amount of effort, scope may also be added.

## Requirements

### Functional Requirements

Application interface:
- SIP exposes an OpenAI-compatible HTTP API for interactive inference (e.g. chat completions).
- Responses should support token streaming (Server-Sent Events). A WebSocket transport may be added, but is not required for v1.
- Requests include a `model` selector. Each GPU worker runs exactly one model at a time.
- If the requested model is not currently active on the target worker, SIP fails fast with `503 Service Unavailable` and a `Retry-After` hint.
- `429 Too Many Requests` is reserved for overload/rate-limit scenarios (e.g. the active model is saturated).
- Clients should stop retrying after 15s total.
- An optional `conversation_id` may be accepted as an opaque identifier for client-side session correlation. Strong session affinity is out of scope for v1.

Performance and throughput:
- For an interactive experience, once a model snapshot is cached in CPU RAM, restoring the model and producing the first token should be fast.
- Target: p95 restore-to-first-token <= 5s (restore start -> first token can be produced), excluding network latency.
- Initial validation target: ~35B parameter models (or similarly sized aggressively-quantized variants). Larger models (e.g. ~100B) are a stretch goal.
- SIP should support concurrent streaming requests via dynamic batching (with a small batching window on the order of tens of milliseconds).

### Non Functional Requirements

Scalability:

- Single-cluster scaling: increasing the number of GPUs should increase total throughput approximately linearly, up to expected bottlenecks (CPU, RAM bandwidth, network, and scheduler overhead).
- Per-GPU performance should not materially degrade as additional GPUs are added to the same cluster (i.e. scheduler/control-plane overhead should remain small relative to inference time).
- Multi-cluster or multi-region federation is out of scope for this design; it would require a different architecture and consistency model.

Security:

- SIP does not execute user-supplied code; it serves inference for explicitly deployed model images/configurations.
- Transport security: TLS termination at the API gateway.
- Authentication/authorization may be minimal for a learning project (e.g. static API keys), but requests should be attributable (request id) and access should be restrictable per deployment.
- Isolation: GPU workers run with least privilege and are isolated from control-plane credentials; snapshot storage and caches must not be world-readable.

Reliability and observability:

- Failures to restore a model (e.g. incompatible snapshot, OOM) should surface as explicit errors and should not wedge the worker.
- Basic metrics should be available: restore-to-first-token p50/p95, cache hit rate, reject rate (503/429), tokens/sec, and GPU utilization.

## Design
