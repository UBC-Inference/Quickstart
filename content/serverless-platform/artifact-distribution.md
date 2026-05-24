---
title: System-Level Primitives (Stub)
author:
    name: Kevin Xiao
    url: https://kxiao.dev
    image: https://media.licdn.com/dms/image/v2/D5603AQEE683SF9HjqA/profile-displayphoto-scale_200_200/B56ZyC0Iz5KsAY-/0/1771721233394?e=2147483647&v=beta&t=AzmvOh-LaEPlzrzv8BOajL1zMrNGwydWLexQULVWQ_M
---

This page is a stub for the system-level pieces: static artifact distribution and process-level snapshot/restore for fast cold starts.

## Why This Exists

Serverless inference lives or dies on time-to-ready. For GPU inference, the dominant costs are often not just weights, but the entire runtime coming online:

- Framework imports / initialization
- CUDA context creation
- JIT kernels (Triton / torch.compile) and warmup
- Loading weights and building the serving engine

Process-level snapshot/restore aims to turn that into a restore problem: start from a known-good, already-warm process image.

## Two Artifact Classes

Keep these as separate logical concepts even if they share the same underlying blob store:

- **Immutable “golden” images**: content-addressed snapshots (and any engine files) used to bring up a ready worker quickly.
- **Mutable checkpoints** (optional): per-session or per-workflow state written during execution to tolerate preemption for long-running work.

For interactive chat/completions, mutable checkpoints may not be worth it at first; the main win is making golden restores fast and predictable.

## Distribution / Cache Hierarchy (Conceptual)

Blob storage is the source of truth, but should not be on the critical path after the first pull:

- Blob storage (cheap, remote)
- Node-local cache (NVMe)
- Host OS page cache (RAM)
- GPU VRAM (live worker)

The control plane should bias placement toward nodes that already have the needed artifacts cached, but the worker should not need to know about topology.

## Open Questions

- What is the minimal “golden” snapshot recipe (what must be warm to get consistent TTFT)?
- What artifact format is easiest to make content-addressed and verifiable (hashing, manifests, chunking)?
- What cache eviction policy is acceptable given limited NVMe/RAM?
- When do mutable checkpoints pay for themselves (job length vs checkpoint cost)?

## Pointers

- Modal’s GPU memory snapshots: https://modal.com/blog/gpu-mem-snapshots
- NVIDIA CUDA checkpointing APIs: https://docs.nvidia.com/cuda/cuda-driver-api/group__CUDA__CHECKPOINT.html
