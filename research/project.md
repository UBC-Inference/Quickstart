# Project Notes

## Current Thinking (Scratch)

### Model Target
- Qwen3.5-27B Q4 = 17GB, runs on single M-series Pro laptop
- BF16 = 54GB, doesn't fit on Pro laptops, needs Max or distribution
- 70B Q4 = 35GB, doesn't fit on any single consumer machine

### Performance (27B Q4 on M-series)
- M2 Pro 32GB: ~12-15 tok/s
- M3 Pro 36GB: ~15-18 tok/s
- M4 Pro 48GB: ~20-25 tok/s
- TTFT < 10s for typical chat prompts (512-1K tokens)

### Economics
- 3× M3 Pro laptops: ~$5-6K one-time, serves years
- Cloud A100: ~$1-2/hr, $700-1500/mo for 24/7
- Break-even: 4-8 months buying vs renting
- Sockeye: free if allocated, V100 32GB × 4 per node

### Key Decision
- 27B: single machine works, platform layer is the value
- 70B: needs distribution or rented GPUs, much harder
- Start with 27B, validate demand, then decide if 70B is worth the complexity

### TODO
- [ ] Audit actual hardware available (what laptops, what specs)
- [ ] Benchmark 27B Q4 on actual hardware
- [ ] Design signal server and node agent
- [ ] Design API gateway (OpenAI-compatible)
- [ ] Research vLLM pipeline parallelism for future 70B path
