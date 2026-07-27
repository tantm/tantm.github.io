---
title: 'LLMOps: Serving, Cost & Latency'
description: 'API vs self-host as a load question, the three-lever cost model (shorten, cache, downsize), why streaming fixes perceived latency, and queues plus quotas for everything else.'
date: 2026-08-04
category: AI
tags: [ai-roadmap, llmops, mlops]
lang: en
translationKey: ai-roadmap-13
series: ai-roadmap
part: 13
---

Everything before this part made the system *good*; this part keeps it good **at a price and a speed the business survives**. LLM serving has exactly three currencies — quality, cost, latency — and every trick below is an exchange between them. The engineering posture comes straight from P12: you can only trade what you measure, so cost-per-request and p99-per-step must already be on your dashboard before any lever gets pulled.

## API vs self-host: a load question, not a religion

The decision that frames everything else, and it's P11's small-model economics generalized:

- **API-first is the right default**: zero infra (S02-P08's managed argument), frontier quality, per-token pricing that *scales to zero* — the S04-P07 serverless property, for intelligence. At low-to-medium volume, the API is almost always cheaper than the GPUs you'd idle.
- **Self-hosting earns its keep** under sustained high volume on a *narrow* task (the P11 tuned-small-model, now with a serving bill), hard data-residency constraints (S07-P10), or latency floors an external hop can't meet. The honest math: GPUs bill by the *hour*, APIs by the *token* — self-hosting is buying a factory versus paying per unit, and a factory at 30% utilization loses to the API every time (S04-P03's right-sizing lesson, GPU edition).
- The hybrid end-state most teams reach: **API for the hard 20%, a tuned small model for the routine 80%** — a router (even a rule-based one) in front. That's P08's decomposition instinct, deployed as architecture.

## Cost: three levers, in order

Pull them in this order — each is cheaper than the next:

1. **Shorten the prompts.** The P07 bill is per token *every request*: a 3,000-token system prompt at a million requests a month is real money for text mostly re-read, not needed. Trim boilerplate, cap history windows (P10's context budget), truncate tool outputs. **Prompt-prefix caching** — supported by the major APIs — makes the *stable* prefix dramatically cheaper: structure prompts so the fixed part comes first and the variable part last (P08's position rules, now with a financial argument).
2. **Cache the answers.** Exact-match caching for repeated requests (S01-P07's connection-pool instinct: don't pay twice for the same work); **semantic caching** — embed the query, serve a cached answer if a near-identical one exists (P09's machinery, pointed at your own traffic) — for the FAQ-shaped share of load. Mind the two footguns: personalized answers must key on user context, and cache invalidation must follow prompt/model versions (P12's tags, again load-bearing).
3. **Downsize the model.** The largest lever and the one requiring evals: route by difficulty, distill the routine cohort onto a small tuned model (P11), and let the P12 golden set arbitrate what "no quality loss" actually means. Teams that skip lever 3 pay frontier prices for autocomplete; teams that start with it break quality they can't measure.

Then make spend *visible*: tag every request with feature/team (S04-P10's business metrics), alarm on cost-per-day by feature, and set **quotas** so one runaway agent loop (P10's capped budgets, platform-enforced) or one enthusiastic customer can't torch the monthly budget in an afternoon.

## Latency: perceived beats actual

An LLM generates token by token (P07's loop), which means **time-to-first-token and time-to-last-token are different metrics with different fixes**:

- **Streaming is the highest-ROI latency fix and it's free**: send tokens as they generate. A 12-second answer that starts appearing at 800ms *feels* fast; the same answer delivered whole feels broken. Users read at ~10 tokens/sec — generation outruns them; the only wait that matters psychologically is the first token. (Structured outputs complicate streaming — a JSON you can't parse until it closes argues for streaming the human-facing part and batching the machine-facing part.)
- **Cut the sequential chain.** p99 lives in the *pipeline*, not just the model: retrieval → rerank → generate → validate is a CS-P8 problem — parallelize retrieval fan-out, overlap what can overlap, and question every serial hop (each agent iteration is a full round-trip; P10's loop budget is also a latency budget).
- **Batch the non-interactive.** The classification backfill, the nightly summarization run — none of it needs seconds. The batch tiers of the major APIs run at roughly half price with relaxed deadlines. Sort every workload into *interactive* (stream it) or *batch* (queue it) — S02-P11's "who needs this result, how fresh?" applied to inference.

## Resilience: the provider is a dependency like any other

The upstream model API is a third-party service, and every S01/S04 rule applies unchanged: **timeouts and retries with backoff** on 429/5xx (S01-P06 — and respect the retry-after header; hammering a rate limit extends it), **idempotency** on anything that writes (the iron rule's cameo in serving), **a queue in front of spiky workloads** (S04-P09 — the provider's rate limit is just another slow consumer; let depth absorb the spike), and **graceful degradation** decided *before* the outage (S04-P09's DLQ spirit): fall back to a smaller model, a cached answer, or an honest "try again later" — a chatbot that answers slightly worse beats one that answers nothing. And because you already tag requests with model versions (P12), a provider-side model deprecation is a scheduled eval run, not an emergency.

## Key takeaways

- API-first by default; self-host only for sustained narrow volume, residency, or latency floors — and route hybrid: frontier for the hard 20%, tuned-small for the routine 80%.
- Cost has three ordered levers — shorten (with prefix caching), cache (exact + semantic), downsize (with evals) — plus per-feature cost tags and quotas so runaways can't torch the budget.
- Latency splits into first-token (stream it — the free fix) and pipeline time (parallelize the chain, batch the non-interactive at half price).
- The provider is a dependency: timeouts, backoff, idempotency, a queue for spikes, and a pre-decided degradation path — measured, tagged, and evaled like everything else in this series.

*Next up — Part 14: Senior AI Engineer: Architecture, Security, Responsibility — the series finale.*
