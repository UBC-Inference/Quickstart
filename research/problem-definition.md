# Problem Definition: Distributed LLM Inference for University Students

## Goal
Build a platform enabling free, ultra-low latency, high-throughput LLM inference for university students by pooling distributed GPU compute from student PCs/laptops. Replace paid subscriptions (Anthropic, OpenAI) with a compute cooperative model.

## Context
- **Author background**: Software engineering, distributed systems interest
- **Target hardware**: User PCs/laptops (not mobile, not edge servers initially)
- **Model scope**: Cutting-edge open-source LLMs (Llama, Mistral, Qwen, etc.)
- **Join policy**: Administrative, potentially requiring compute contribution to join

## Core Technical Challenges

### 1. Model Parallelism Across Heterogeneous Hardware
- Large models (70B+) require 40-140GB VRAM
- Student hardware varies: 4GB, 8GB, 16GB, 24GB VRAM (if discrete GPU at all)
- Need to split model layers across machines with different VRAM capacities
- Techniques: tensor parallelism, pipeline parallelism, expert parallelism (for MoE)

### 2. Network Latency
- Each layer requires shipping activations between nodes
- 10ms per hop × 80 layers = 800ms+ added latency
- University LAN could help (sub-ms on campus network vs public internet)
- Bottleneck: sequential dependency in autoregressive decoding

### 3. Volunteer Churn & Fault Tolerance
- Students close laptops, lose connectivity, reboot
- Mid-request node failures need graceful handling
- Need redundancy, checkpointing, or fast re-routing

### 4. Scheduling & Quality of Service
- Competing workloads (gaming, compiling, other inference requests)
- Need to detect load and route away from busy nodes
- Fair scheduling across requesting users

### 5. Security & Trust
- Running code on volunteer machines — what if someone tampers with layer outputs?
- Model integrity across the chain
- Privacy of user prompts flowing through untrusted nodes

### Hardware Path: UBC ARC Sockeye (Research Cluster)
- **200 GPUs**: 24× V100 16GB + 176× V100 32GB (4 per node, 50 nodes)
- **InfiniBand EDR** (100Gbps) interconnect — real datacenter networking
- **15,872 CPU cores** across 412 nodes
- V100 32GB × 4 per node = 128GB VRAM → can run 70B via tensor parallelism within a node
- InfiniBand makes multi-node pipeline parallelism viable (unlike consumer Ethernet)
- **Challenge**: Allocation policies, shared resource, queue times, access restrictions
- **If accessible**: This changes the economics entirely — real hardware, not volunteer laptops

### 6. Economic Validation
- **Critical question**: Does aggregate student GPU capacity support meaningful concurrent users?
- Need to survey: how many students have discrete GPUs, what VRAM, what utilization pattern
- Rough math: 100 students with 8GB VRAM = 800GB aggregate. A 70B quantized model needs ~35GB. Could serve ~20 concurrent users if perfectly pooled.

## Existing Projects / Prior Art

| Project | Approach | Relevance |
|---------|----------|-----------|
| Petals | Volunteer network, layer-by-layer chain inference | Closest to our idea. Proves it works but latency is high |
| Exo | Personal multi-device inference | Focused on single-user multi-device, not cooperative |
| vLLM | Single-machine inference engine | Would be the per-node serving engine |
| llama.cpp | CPU/mixed inference | Fallback for machines without GPUs |

## Economic Model

### Demand (Strong)
- ChatGPT 300M+ weekly users; students are a core demographic
- Free tier limits are a constant friction point (rate limits, model quality)
- $20/month is meaningful for students; many won't pay
- Unserved demand: students want access to better models but can't afford them
- **Conclusion: Demand is clearly validated. Not the bottleneck.**

### Supply (Unknown)
- Rough math for a 10,000-student university:
  - ~2,000 students with discrete GPUs (CS/engineering heavy)
  - ~18 idle GPU-hours per day per machine (gaming a few hrs, idle rest)
  - 36,000 GPU-hours/day of currently wasted compute
- Typical student GPU: 8-12GB VRAM (3060/4060 range)
- High-end GPUs (3090/4090): 5-10% of GPU owners
- **Key risk: Aggregate VRAM may not support large model serving at scale**

### Efficiency Losses
- Network overhead for distributed inference
- Volunteer churn (laptops close, nodes disappear)
- Scheduling inefficiency (can't perfectly pack workloads)
- Realistic efficiency: maybe 30-50% of theoretical aggregate compute

### Minimum Viable Service
- 7B-13B model on a single machine = trivial, no distribution needed
- Already useful, doesn't replace GPT-4 but replaces free-tier ChatGPT
- Distribution only needed for 70B+ models
- **Start with single-machine serving, validate demand, then scale to distributed**

## MVP Scope (Narrowed)
- **Target**: 3 PCs max, Apple M-series laptops
- **Model**: 7B quantized (~4GB), runs easily on 16GB unified memory
- **Architecture**: Same model on each machine, load balanced (not model-splitting)
- **Performance**: 20-40 tok/sec per machine on M1/M2, faster on M3/M4
- **Engine**: llama.cpp or ollama on each machine
- **Distribution problem**: Load balancing + health checks, not tensor parallelism

### MVP Architecture
```
User → API Gateway / Load Balancer → Machine A (7B)
                                   → Machine B (7B)
                                   → Machine C (7B)
```

### What This Validates
- Actual student demand and usage patterns
- Acceptable latency thresholds
- Whether people contribute or just consume
- Admin overhead and operational feasibility
- Whether to scale to distributed inference for larger models

### Value Proposition Challenge (Critical)
**Q: Why wouldn't people just run the model locally?**
For 7B on M-series Mac, local is almost always better:
- Zero latency, full privacy, no dependency, trivially easy (ollama)
- Shared service adds network hop, complexity, failure modes for same capability

**Cases where shared service wins (narrow):**
1. Users without capable hardware (minority on tech campuses)
2. Larger models (70B+) that won't fit on a laptop — THE real unlock
3. Always-on access from any device (phone, tablet, lab computer)
4. Shared fine-tuned models (university-specific)

**Implication**: MVP of 3 Macs serving 7B may not have a product. Value comes from solving distributed inference for larger models.
- [ ] What is the aggregate GPU capacity at the target university?
- [ ] What latency is acceptable for a chat-style LLM? (<1s TTFT? <50ms per token?)
- [ ] Can university LAN infrastructure be leveraged for low-latency interconnect?
- [ ] What's the incentive model? Pure altruism, reciprocal contribution, or something else?
- [ ] Does pipeline parallelism or expert parallelism work better for this topology?
- [ ] What model sizes are realistic to serve? (7B on one machine, 70B distributed, 405B?)
- [ ] What are the admin/join policy mechanics? Approval-based? Contribution-based?

## Next Steps
1. Audit hardware availability at target university
2. Benchmark single-machine inference latency (llama.cpp, vLLM) as baseline
3. Research Petals architecture in depth — what works, what doesn't
4. Define acceptable latency/throughput targets
5. Design first prototype (likely small: 2-3 machines, small model)
