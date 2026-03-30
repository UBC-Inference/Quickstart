---
title: Inference Overview
---

## Overview

This is heavily inspired by Baseten's inference book (which is frankly is also a brief introduction to inference). If you need more detail go read that or go through the linked [Reading List](#/inference-reading-list).

Inference is the second phase of a model's life cycle, where the models are served or used in production. The main layers involved in inference are the runtime (which optimizes the single model on a GPU-backed instance), infrastructure (the ability to scale across cloud, hardware, and regions without creating silos), and tooling (which is used to build software that scales, hopefully in an ergonomic manner).

This organization intends to begin mainly building around infrastructure and tooling, although with more experience (and time) perhaps certain projects will branch into other layers. Let's first discuss some metrics that we care about when it comes to inference.

**What are TTFT and tok/s?**
TTFT is time to first token, and it means that with a streaming output, how long does it take for a user to see the first output. Its bounded by compute-bounded prefill (kv cache). The metric means better latency
Tok/s is the tokens per second, and it refers to the throughput, which is bounded by bandwidth bound decode.

Prefill is computation heavy because it takes the input in parallel and must generate the key/value pair for each token at each layer, requiring massive parallelization (due to the matmul that is involved on the GPU). 
Decode is bandwidth heavy as it is autoregressive, which means referring back to every single decoded token as a dependency for the next token. Each requires all model weights from HBM (high bandwidth memory) to go to the processing cores. Small batch sizes also means that the GPU cannot amortize the cost of moving weights across multiple tokens. There's some additional terms here like perceived TPS (which discounts the TTFT) and total TPS which is the total number of tokens generated. ITL is also the inverse measuring frequency instead of rate.

**Benchmarking** is also important, and similarly to other parts of engineering, values lke median and mean are typically used. Right-skewed distribution is common for inference because of outliers.


| Percentile | definition      | impact                   |
| ---------- | --------------- | ------------------------ |
| P50        | Median          | 1 in 2 is slower         |
| p90        | 90th percentile | 1 in every 10 is slower  |
| p95        | 95th percentile | 1 in every 20 is slower  |
| p99        | 99th percentile | 1 in every 100 is slower |


## Models

Before going into building out an inference system, one must decide what model to run! While there isn't a requirement to deeply understand model architecture. Most of the time evals are used to decide what is worthwhile and what is not.

Intelligence benchmarks are useful for shortlisting models.
- ensure that you check the data and the eval results for a specific problem space
- be precise about the hardest problem that the model will need to solve
- tools lol.

We'll also briefly cover some useful concepts when it comes to models:

**Distillation** is the process of using a large teacher model to train a smaller student model to emulate the larger model's behaviour. Unlike fine tuning, the distillation just shows the student model the teacher model's actual distributions (rather than the answers, all credit to Phillip Kiely for the following figure from Baseten's textbook)

![](../assets/distillation.png)

DeepSeek R1 is a reasoning model with 671 B parameters, but the distilled models are the most popular on hugging face because they yield far more reasonable metrics (ttft, tok/s) with reasonably close performance to the original baseline. 

This section heavily cuts on details on transformer architecture and different models, so if you care, please go through the reading list. We'll focus on autoregressive token generation (because this is usually more useful for codegen because we're focusing on LLMs!)

### Neural Networks

Neural networks are our foundation for models, so this section goes over them at a very high level. Checkout the reading list - which also doubles as my reading list.

The fundamental unit of a neural network is a node. Where it is a hsort program taking an input, multiplying it by weights, adding some bias, and returning the results
- groups of nodes form layers
- nodes within layers are independent
- connections are the network - where nodes receive the output of the previous layer

There are also three fundamental layers!
- input layer: where we accept and process the input
- hidden layers: every layer that is within the first and the last, which iteratively transforms input to arrive at an output (aka the blackbox)
- output layer: the final layer, which returns the prediction from the network

each layer produces an output for the next to read, and these outputs are hidden states



## Hardware

<!-- TODO: Add hardware notes -->

## Software

<!-- TODO: Add software notes -->

## KV Cache

<!-- TODO: Add KV cache notes -->

## Decoding

<!-- TODO: Add decoding notes -->

## Memory Mechanics

<!-- TODO: Add memory mechanics notes -->

---

## Serverless Mechanics

<!-- TODO: Add serverless mechanics notes -->

---

## List of Guiding Questions

<!-- TODO: Add guiding questions -->
