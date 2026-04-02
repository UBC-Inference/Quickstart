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

2. Ergonomics/developer experience is (perhaps surprisingly) the second goal of this project. Working around containerization and setting up your own infrastructure is a process with a lot of friction. Ideally SIP could streamline the process for hosting a serverless inference platform, but also ergonomics and developer experience is important for making a project like this practical. The actual main point of differentiation that SIP is intended to bring is a reasonable cold-start performance and a better way to manage resource sharing between multiple tenants.

3. Performance is the last goal, but also ties into everything that has already been stated. Generally ergonomics are prioritized to performance wheer appropriate (i.e. the losses are marginal). Regarding implementation, functionality like serving orchestration, image swapping, and checkpointing must be implemented correctly to satisfy acceptable bounds for model switching and coldstarts. If performance gains are possible for a reasonably proportional amount of effort, scope may also be added.

## Requirements

### Functional Requirements

### Non Functional Requirements

## Design

