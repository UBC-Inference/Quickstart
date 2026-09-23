---
title: Distributed Control Plane (Stub)
published: false
nav_section: Projects
nav_order: 6
author:
    name: Kevin Xiao
    url: https://kxiao.dev
---

This page is a stub for the distributed system that provides the “serverless” abstraction: intelligent routing, scale up/down, and preemption-aware placement.

## Scope

- **Routing**: send requests to a ready worker; prefer locality (node already has artifacts) when possible.
- **Scaling up**: decide when to restore/spawn workers based on demand.
- **Scaling down**: decide when to evict workers (drain, checkpoint if applicable) to reclaim GPUs.
- **Metadata**: keep lightweight global state (what deployments exist, what workers are ready, what node has what cached).

## Non-Goals (Initially)

- Prompt-similarity routing / KV reuse.
- Multi-region federation.
- Full multi-model packing (assume a single primary model or a small fixed set).

## Key Interfaces (Conceptual)

- Worker lifecycle: restore/start, health/ready, drain/evict.
- Routing: resolve {deployment/session} -> {worker endpoint}.
- Artifact hints: placement preferences based on cache residency.

## Open Questions

- What global consistency is actually required (strong vs eventual) for routing decisions?
- How do we represent “ready” and “draining” workers to avoid thundering herds?
- What’s the simplest autoscaling signal (queue depth, p95 TTFT, GPU util)?
