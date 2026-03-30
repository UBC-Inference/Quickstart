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

Prefill is computation heavy because it takes the input in parallel and must generate the key/value pair for each token at each layer, requiring massive parallelization (due to the matmul that is involved on the GPU). The model's weights are only loaded a single time, and then a large matmul between inputs and attention occurs, which only needs one read from memory

Decode is bandwidth heavy as it is autoregressive, which means referring back to every single decoded token as a dependency for the next token. Each requires all model weights from HBM (high bandwidth memory) to go to the processing cores. Small batch sizes also means that the GPU cannot amortize the cost of moving weights across multiple tokens. There's some additional terms here like perceived TPS (which discounts the TTFT) and total TPS which is the total number of tokens generated. ITL is also the inverse measuring frequency instead of rate. Model weights need to be loaded for every token to do so.

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

![](../assets/neural-net.png)

These are for creating internal representations, and there are also neural nets for using them:
- encoders take inputs like text to create these internal representations (and additional semantic meanings)
- decoders use the internal representation to generate our useful output

They are composable! Modern LLMs are decoder only, and encoder models are somewhat rare

every matmul is sorta just y = mx + b (not really) - but this is a linear layer which is its simplest form.

**Activation functions** are used because matmul is composable, and so mul tiplying vectors by two matrices is the equivalent to the product of those matrices. In multi-layer networks, each would collapse, so deep layer networks are more useful for having more parameters and encoding more meaning in hidden states. Neural nets break linearity by having activation functions that are non-linear to prevent composability (and are differentiable to support back propagation usually... - IDK backprop or the math involved but sure)


![](../assets/ReLU.png)

### LLM Inference
- LLms are autorgressive which means each token is based on the previous one. Texts and tokens are just a mapping, and dont require nets. Language model vocab is the complete mapping of tokens and strings
- most have over 100k tokens in vocabulary, and as such our sequences are as follows

- input sequence: prompt, chat, context, functions and inputs passed into the llm
- reasoning sequence: optional, to have an intermediate output
- output sequence: response generated

the mechanics here have sort of been hinted at, but are essentially prefill and decode.

**Prefill** - processing the input sequence to calculate attention, i.e. a weight/score, for each input token (storing each value in the KV)
**Decode** - perform forward passes through the model to generate tokens autoregressively. 

Decoding takes a few extra steps since outputs are not tokens, and so the layer will generate a vector of logics, and the length is the same as our original vocabulary. With normalization, these logics represent probability of each potential token, and with a weighted random number generator they are selected. We see some familiar terms appear here again

Temperature: randomness (adjust before normalization)
Top-k: select top-k most likely after normalization (then re-normalize among them, i.e. reducing output probabilities)
Top-p: greedily choose the smallest set of tokens after normalization that have probabilities that add up to p (lower is more deterministic)

### Nomenclature

Very quickly model nomenclature typically consists of

Family-Version-\[MoE\]-\[Other specifics\]-(parameter size)b-a(active parameters)b.

### Transformers
Transformers are the main blocks that compose LLMs, but this section will be completed at a later date after some additional reading.

### Inference Bottlenecks

As mentioned previously, we are typically either memory or bandwidth bound, but ideally we are balancing our work s.t. both are fully utilized at all times.

We can model this with our Ops:Byte ratio and arithmetic intensity. Each GPU has a specific compute speed (measured in operations per second) and memory bandwidth (measured as GiB or TiB per seconds). We can compare these to determine an ops:byte ratio of a given gpu.

Because the ratio is measured on a per-second scale, this can be measured against the bandwidth ceiling.


![](../assets/roofline-chart.png)

If under the ceiling of bandwidth, we are memory bound, and if above we are compute bound.

## Hardware

There are three types of GPUs on the market. 
- Datacenter GPUs, which are racked
- workstation GPUs, which are for professional workflows (RTX Pro 6000)
- personal computing gpus, which are used for everyday use

for most intents and purposes, if you need inference to scale, you have to have access to datacenter gpus. This means doing one of three things
- Cloud: renting someone elses datacenter
- On-prem: having your GPUs installed in a datacenter that you control
- Air-gapped: having your own on-prem gpus that must be physically accessed 

What metrics do we care about?
- CUDA Cores - which operates on individual numbres (or scalars)
- tensor cores - which operate on vectors and matrices


## Software

[TODO] Some things to write about SGLang, TensorRT and vLLM... will be filled out upon more research.

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
