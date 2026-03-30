# Architecture Decision: Pipeline Parallelism for Distributed LLM Inference

## Goal
Run models larger than any single machine can hold by splitting layers across multiple machines via pipeline parallelism.

## Why Pipeline Parallelism
- **70B Q4 = 35GB** — doesn't fit on any M2/M3/M4 Pro laptop
- **3× M2 Pro 32GB = 96GB aggregate** — easily holds 70B
- Pipeline parallelism = split model layers across machines, activations flow through chain
- Latency is higher per request, but **quality of 70B >> quality of 27B**
- Offline/batch inference is a valid use case where latency doesn't matter

## Phased Approach

### Phase 1: 27B Pipeline Parallel (MVP / Learning)
- Split Qwen3.5-27B Q4 (17GB) across 3 machines (~6GB per machine)
- Model fits on one machine, but we split it anyway to build/test the pipeline layer
- Goal: validate signaling, chain construction, activation passing
- Expected: ~5-10 tok/s (slower than single machine, but proves the system works)

### Phase 2: 70B Pipeline Parallel (Real Goal)
- Split Llama 3.1 70B Q4 (35GB) across 3 machines (~12GB per machine)
- Model CANNOT fit on one machine — pipeline parallelism is required
- Goal: serve a model none of the machines could run alone
- Expected: ~5-10 tok/s, acceptable for offline/batch tasks

## System Architecture

```
┌─────────────────────────────────────────────┐
│            Signal Server (Go)                │
│  - Device registry & discovery               │
│  - Health monitoring                         │
│  - Chain construction (assign layer ranges)  │
└──────────┬──────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────┐
│           API Gateway (Go)                   │
│  - OpenAI-compatible /v1/chat/completions    │
│  - Request queuing                           │
│  - Routes request to chain head              │
└──────────┬──────────────────────────────────┘
           │
    ┌──────▼──────┐    ┌──────────┐    ┌──────────┐
    │  Node A     │───▶│  Node B   │───▶│  Node C   │
    │  Agent (Go) │    │  Agent    │    │  Agent    │
    │  vLLM       │    │  vLLM     │    │  vLLM     │
    │  C++ comm   │    │  C++ comm │    │  C++ comm │
    │  Layers 1-N │    │  Layers   │    │  Layers   │
    │             │    │  N+1 - M  │    │  M+1 - 80 │
    └─────────────┘    └──────────┘    └──────────┘
```

## Components

### 1. Signal Server (Go)
- HTTP/WebSocket server
- Devices register: `{id, host, port, gpu_info, memory, layers_loaded}`
- Heartbeat every 5s, deregister after 15s missed
- Chain construction: assign layer ranges based on device capabilities
- Serves chain topology to API gateway

### 2. API Gateway (Go)
- OpenAI-compatible endpoint
- Accepts request → looks up active chain → forwards to chain head
- Queue requests when chain is busy
- Returns streamed response from chain tail

### 3. Node Agent (Go + C++)
- Registers with signal server on startup
- Runs vLLM with assigned layer range
- **C++ inter-node communication**: receives activations from previous node, runs through local layers, sends to next node
- Reports health and current load

### 4. Inter-Node Communication (C++)
- Activation serialization/deserialization
- gRPC or raw TCP for low-latency transfer
- Handles the data flow: prev_node → recv → forward_layers → send → next_node

## Key Design Decisions
- vLLM as per-node inference engine (don't reinvent)
- Go for orchestration/signaling (fast dev, good concurrency)
- C++ for activation passing (latency-sensitive hot path)
- Pipeline parallelism is the ONLY parallelism strategy (for now)
- Accept higher latency for higher model quality
- Offline/batch inference is a first-class use case

## Performance Estimates

### 27B Q4 across 3 M2 Pro (Phase 1)
| Metric | Single Machine | Pipeline (3 machines) |
|--------|---------------|----------------------|
| Memory per machine | 17GB | ~6GB |
| TTFT (1K tokens) | ~4-6s | ~8-15s |
| Decode tok/s | ~12-15 | ~5-10 |
| Network overhead | 0 | ~25ms/token (1GbE) |

### 70B Q4 across 3 M2 Pro (Phase 2)
| Metric | Can it run? | Pipeline (3 machines) |
|--------|-----------|----------------------|
| Memory per machine | ❌ 35GB > 32GB | ~12GB ✅ |
| TTFT (1K tokens) | N/A | ~15-30s |
| Decode tok/s | N/A | ~5-10 |
| Network overhead | N/A | ~25ms/token (1GbE) |

## TODO
- [ ] Signal server: device registration, heartbeat, chain assignment
- [ ] Node agent: vLLM integration with layer range config
- [ ] Inter-node comm (C++): activation passing between nodes
- [ ] API gateway: OpenAI-compatible endpoint, request routing
- [ ] End-to-end test: 3 processes on one machine simulating 3 nodes
- [ ] Benchmark: 27B pipeline across actual 3 laptops
- [ ] Benchmark: 70B pipeline across actual 3 laptops
