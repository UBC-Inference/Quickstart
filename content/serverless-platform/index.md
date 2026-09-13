---
title: Serverless Inference Platform
published: false
nav_section: [Project] Serverless Platform
nav_order: 5
author:
    name: Kevin Xiao
    url: https://kxiao.dev
    image: assets/kevin-xiao.png
---

## Problem Statement

GPU inference is expensive and demand is often bursty. The main goal here is **efficient allocation**: keep GPUs busy when there is work, and release them when there isn't, without making interactive workloads unusable.

The practical blocker for scale-to-zero is **cold start**:

- Loading large model artifacts can take tens of seconds to minutes depending on locality.
- Even if weights are local, runtime initialization (imports, CUDA context init, JIT kernels, warmup) can dominate.

So the core design problem is: **how do we make “cold” GPU workers become “ready to serve” quickly enough that preemption and aggressive scale-down are viable?**

SIP is a design exploration around that question, with an emphasis on **process-level snapshots** (checkpoint/restore) and an **artifact distribution layer** that makes “warm” starts common.

## Goals

1. Learning is the foremost goal. The intended takeaway is understanding how inference systems work: inference engines, GPU checkpoint/restore, and the distributed systems needed to scale. Compared to other domains in software engineering, the available resources feel less centralized and less well documented. Many serverless platforms are closed source (e.g. Modal) or do not publish design docs/RFCs. I hope this doc (and eventually code) helps fill in some of those gaps.

2. Streamlining inference is the second goal. A small set of primitives (snapshot images + a distribution/cache layer + basic routing) should make it practical to run “serverless-ish” inference on a few GPUs without a huge platform.

3. Performance matters insofar as it enables preemption and scale-down. The main metric is time-to-ready for a worker that was previously evicted.

## High-Level Approach

This project is intentionally scoped to a simpler world:

- **Single primary model** (at least initially). This avoids a full-blown multi-model packing problem.
- **Pods/workers as synchronous state machines.** A higher-level control plane does asynchronous orchestration (placement, preemption, cache fill/eviction, etc.).

The key technique is **process-level snapshot/restore**:

- Build a “golden” GPU worker image that is fully initialized (runtime loaded, CUDA context created, any warmup completed).
- Snapshot that process (including GPU memory) so that restore yields a ready-to-serve worker quickly.

This shifts the hard problem from “initialize from scratch” to “distribute large artifacts efficiently and keep them warm”.

## Components (Conceptual)

- **Artifact distribution**: content-addressed model artifacts and snapshot images, served from blob storage with a cache hierarchy (node NVMe, host page cache, etc.).
- **Control plane**: decides when to scale up/down, when to preempt, and where to restore. Owns the metadata that maps {deployment/session} to {artifact refs, placement hints}.
- **GPU worker**: a serving process that can be restored from a known snapshot and then synchronously handles requests.
- **Routing**: sends requests to a currently-ready worker; if none is available, fail-fast with a retry hint (serverless UX depends on making “wait for capacity” explicit).

## What’s Explicitly Out of Scope (For This Doc)

- Cache-aware routing based on prompt similarity / KV reuse.
- A full multi-model scheduler (Modal-style packing across many model variants).
- Strong session affinity and seamless mid-stream migration.

## Related Docs

- [Distributed control plane (routing, scaling)](./distributed-control-plane)
- [System-level primitives (snapshots, artifacts)](./artifact-distribution)
- [Reading list](./serverless-reading-list)
