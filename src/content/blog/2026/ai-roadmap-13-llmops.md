---
title: 'LLMOps: Serving, Cost & Latency'
description: 'API vs self-host as a load question, the three-lever cost model (shorten, cache, downsize), why streaming fixes perceived latency, and queues plus quotas for everything else.'
date: 2026-08-04
category: AI
tags: [ai-roadmap, llmops, mlops]
lang: en
translationKey: ai-roadmap-13
series: ai-roadmap
cover: images/s03-p13-hero.png
part: 13
---

Everything before this part made the system *good*; this part keeps it good **at a price and a speed the business survives**. LLM serving has exactly three currencies — quality, cost, latency — and every trick below is an exchange between them. The engineering posture comes straight from P12: you can only trade what you measure, so cost-per-request and p99-per-step must already be on your dashboard before any lever gets pulled.

## What you'll learn

- Decide API versus self-hosting from your load shape, not from principle.
- Pull the three cost levers in the order that actually pays.
- Optimize the latency users perceive rather than the number on a dashboard.
- Treat the model provider as a dependency, with the resilience that implies.

**Prerequisites:** Part 7 (tokens and context) and Part 12 (evals, which gate every change you make here).

## 1. API vs self-host: a load question, not a religion

The decision that frames everything else, and it's P11's small-model economics generalized:

- **API-first is the right default**: zero infra (S02-P08's managed argument), frontier quality, per-token pricing that *scales to zero* — the S04-P07 serverless property, for intelligence. At low-to-medium volume, the API is almost always cheaper than the GPUs you'd idle.
- **Self-hosting earns its keep** under sustained high volume on a *narrow* task (the P11 tuned-small-model, now with a serving bill), hard data-residency constraints (S07-P10), or latency floors an external hop can't meet. The honest math: GPUs bill by the *hour*, APIs by the *token* — self-hosting is buying a factory versus paying per unit, and a factory at 30% utilization loses to the API every time (S04-P03's right-sizing lesson, GPU edition).
- The hybrid end-state most teams reach: **API for the hard 20%, a tuned small model for the routine 80%** — a router (even a rule-based one) in front. That's P08's decomposition instinct, deployed as architecture.

## 2. Cost: three levers, in order

Pull them in this order — each is cheaper than the next:

1. **Shorten the prompts.** The P07 bill is per token *every request*: a 3,000-token system prompt at a million requests a month is real money for text mostly re-read, not needed. Trim boilerplate, cap history windows (P10's context budget), truncate tool outputs. **Prompt-prefix caching** — supported by the major APIs — makes the *stable* prefix dramatically cheaper: structure prompts so the fixed part comes first and the variable part last (P08's position rules, now with a financial argument).
2. **Cache the answers.** Exact-match caching for repeated requests (S01-P07's connection-pool instinct: don't pay twice for the same work); **semantic caching** — embed the query, serve a cached answer if a near-identical one exists (P09's machinery, pointed at your own traffic) — for the FAQ-shaped share of load. Mind the two footguns: personalized answers must key on user context, and cache invalidation must follow prompt/model versions (P12's tags, again load-bearing).
3. **Downsize the model.** The largest lever and the one requiring evals: route by difficulty, distill the routine cohort onto a small tuned model (P11), and let the P12 golden set arbitrate what "no quality loss" actually means. Teams that skip lever 3 pay frontier prices for autocomplete; teams that start with it break quality they can't measure.

Then make spend *visible*: tag every request with feature/team (S04-P10's business metrics), alarm on cost-per-day by feature, and set **quotas** so one runaway agent loop (P10's capped budgets, platform-enforced) or one enthusiastic customer can't torch the monthly budget in an afternoon.

## 3. Latency: perceived beats actual

An LLM generates token by token (P07's loop), which means **time-to-first-token and time-to-last-token are different metrics with different fixes**:

- **Streaming is the highest-ROI latency fix and it's free**: send tokens as they generate. A 12-second answer that starts appearing at 800ms *feels* fast; the same answer delivered whole feels broken. Users read at ~10 tokens/sec — generation outruns them; the only wait that matters psychologically is the first token. (Structured outputs complicate streaming — a JSON you can't parse until it closes argues for streaming the human-facing part and batching the machine-facing part.)
- **Cut the sequential chain.** p99 lives in the *pipeline*, not just the model: retrieval → rerank → generate → validate is a CS-P8 problem — parallelize retrieval fan-out, overlap what can overlap, and question every serial hop (each agent iteration is a full round-trip; P10's loop budget is also a latency budget).
- **Batch the non-interactive.** The classification backfill, the nightly summarization run — none of it needs seconds. The batch tiers of the major APIs run at roughly half price with relaxed deadlines. Sort every workload into *interactive* (stream it) or *batch* (queue it) — S02-P11's "who needs this result, how fresh?" applied to inference.

## 4. Resilience: the provider is a dependency like any other

The upstream model API is a third-party service, and every S01/S04 rule applies unchanged: **timeouts and retries with backoff** on 429/5xx (S01-P06 — and respect the retry-after header; hammering a rate limit extends it), **idempotency** on anything that writes (the iron rule's cameo in serving), **a queue in front of spiky workloads** (S04-P09 — the provider's rate limit is just another slow consumer; let depth absorb the spike), and **graceful degradation** decided *before* the outage (S04-P09's DLQ spirit): fall back to a smaller model, a cached answer, or an honest "try again later" — a chatbot that answers slightly worse beats one that answers nothing. And because you already tag requests with model versions (P12), a provider-side model deprecation is a scheduled eval run, not an emergency.

## Practice (25 minutes — measure the three cost levers instead of guessing at them)

Every lever in this part is measurable in one session, and the measurements usually reorder people's priorities:

```python
import time, tiktoken
enc = tiktoken.get_encoding("cl100k_base")

SYSTEM = open("your_system_prompt.txt").read()   # your real prompt
DOCS   = open("your_retrieved_context.txt").read()
QUERY  = "a representative user question"

# 1. Where do your tokens actually go? Most teams guess wrong.
for name, text in (("system", SYSTEM), ("retrieved context", DOCS), ("user query", QUERY)):
    n = len(enc.encode(text))
    print(f"{name:>18}: {n:>6} tokens")
total = sum(len(enc.encode(t)) for t in (SYSTEM, DOCS, QUERY))
print(f"{'TOTAL INPUT':>18}: {total:>6} tokens  -> multiply by requests/month for the real bill")

# 2. LEVER 1 — shorten. Measure the cut, don't estimate it.
trimmed = DOCS[:len(DOCS)//2]      # e.g. top-3 chunks instead of top-6
saved = len(enc.encode(DOCS)) - len(enc.encode(trimmed))
print(f"halving retrieved context saves {saved} tokens/request "
      f"({100*saved/total:.0f}% of input) — now check evals still pass")

# 3. LEVER 2 — cache. Exact-match caching costs nothing to try.
CACHE = {}
def cached_call(prompt, fn):
    if prompt in CACHE:
        return CACHE[prompt], True
    out = fn(prompt); CACHE[prompt] = out
    return out, False

# Replay a day of real queries through it and measure the hit rate:
# hits = sum(cached_call(q, call_model)[1] for q in yesterdays_queries)
# print(f"cache hit rate: {100*hits/len(yesterdays_queries):.0f}%")

# 4. LATENCY — the only wait that matters is time to FIRST token
t0 = time.perf_counter(); first = None
# for chunk in client.messages.stream(...):
#     if first is None: first = time.perf_counter() - t0
# print(f"time to first token: {first:.2f}s | total: {time.perf_counter()-t0:.2f}s")
```

Expected results: step 1 is where the surprise usually is — teams optimizing the user query discover the system prompt and retrieved context are 90% of the input, so that's where the money is. Step 2 turns "we could trim the context" into a number you can weigh against an eval score, which is the only honest way to make that trade. Step 3's hit rate on a real day of traffic decides whether caching is worth building at all — measure before building. And step 4 reframes latency: a response that streams its first token in 400ms feels fast even if it takes 8 seconds to finish, while one that returns everything at 3 seconds feels slow. Optimize the wait people experience.

## Check yourself

1. Your monthly model bill doubled and traffic is flat. What do you measure first?
2. A stakeholder asks you to switch to a cheaper, smaller model to cut costs. What do you require before agreeing?
3. Your provider has an outage. What should have been designed in advance?

<details><summary>See answers</summary>

1. Token composition per request. Traffic being flat means the tokens per request grew — usually a prompt that accumulated instructions over time, or a retriever whose top-k or chunk size increased. Measure system prompt, retrieved context and user input separately; the answer is almost always in the first two.
2. An eval run on the smaller model against your golden set. Cost per token is meaningless without quality, and a cheaper model that fails 15% more often generates retries, escalations and support load that cost more than the savings. Decide with two numbers side by side: cost per request and eval score.
3. A fallback path and a degradation decision made before the incident: a secondary provider or model behind a router, queueing for work that can be deferred, and an explicit answer to "what does the product do when the model is unavailable?" — degrade gracefully, queue, or fail clearly. Deciding that during an outage produces the worst version of it.

</details>

## Key takeaways

- API-first by default; self-host only for sustained narrow volume, residency, or latency floors — and route hybrid: frontier for the hard 20%, tuned-small for the routine 80%.
- Cost has three ordered levers — shorten (with prefix caching), cache (exact + semantic), downsize (with evals) — plus per-feature cost tags and quotas so runaways can't torch the budget.
- Latency splits into first-token (stream it — the free fix) and pipeline time (parallelize the chain, batch the non-interactive at half price).
- The provider is a dependency: timeouts, backoff, idempotency, a queue for spikes, and a pre-decided degradation path — measured, tagged, and evaled like everything else in this series.

*Next up — Part 14: Senior AI Engineer: Architecture, Security, Responsibility — the series finale.*
