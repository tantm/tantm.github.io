---
title: 'Architecting for Cost: FinOps Patterns'
description: 'On a data platform the bill is an architecture review: unit economics, storage/compute separation, the pricing-model decision, and the classic waste catalog.'
date: 2026-07-28
category: Architecture
tags: [dp-architectures, finops, cost, data-platform]
lang: en
translationKey: dp-arch-12
series: dp-architectures
part: 12
cover: images/dp-arch-finops.png
---

Throughout this series, budget kept appearing as the fourth axis. This part promotes it to the main character — because on a cloud data platform, **cost is not an operations metric, it is design feedback**. Every architectural decision from Parts 2–11 has a meter attached, and reading that meter well is a senior skill.

![Architecting for Cost: FinOps Patterns](images/dp-arch-finops.png)

## The birth pain

On-premises, cost was decided once a year in procurement. Cloud made it continuous: every query, every idle cluster, every retained gigabyte bills by the second — spend is decentralized to every engineer, while accountability stayed centralized in one unhappy monthly meeting. FinOps is the discipline of closing that gap; *architecting* for cost is the platform half of it.

## Principle: measure in units, not totals

A total bill going up tells you nothing — maybe the business grew. The FinOps move is **unit economics**: cost per query, per pipeline run, per dashboard, per tenant (Part 9), per use case. Two rules make it work:

1. **Tag everything at creation** — pipeline, team, use case. Untagged spend is unmanageable spend; make tags a deploy-time requirement, not an afterthought (governance-as-code again, Part 10).
2. **Publish showback** — a weekly view of "your team's use cases cost X" changes behavior *without* a single mandate. Chargeback (actually billing teams) is optional; visibility is not.

The unit numbers then drive architecture: a dashboard costing $30/month per viewer is a Part 5 overspend; a pipeline whose reruns dominate its cost is an idempotency problem (S02), not a discount negotiation.

## The four structural patterns

**1. Separate storage from compute — then treat them differently.** Storage is cheap and *keeps state*; compute is expensive and *should be disposable*. This is why the lakehouse (Part 3) wins economically: data in open formats on object storage, engines spun up per workload and turned off. The anti-pattern is the always-on cluster "because the data is there" — the data doesn't need the cluster; queries do.

**2. Tier by access, automatically.** Hot / infrequent / archive storage classes with lifecycle rules (bronze older than N months → cold tiers). Set once at design time, saves forever. The same idea applies to compute: production pipelines on reliable capacity, backfills and experiments on spot/preemptible — batch work that can retry (idempotency pays again) is exactly what cheap interruptible compute is for.

**3. Choose the pricing model per workload shape.** Serverless/on-demand bills per use — perfect for spiky, low-duty-cycle work; expensive at sustained load. Provisioned/committed capacity is the opposite. The platform-level pattern: **serverless at the edges, committed at the core** — steady daily ELT on reserved capacity, exploratory and bursty work on per-use pricing. Revisit yearly; workloads drift.

**4. Put guardrails where the money leaks.** Query timeouts and scan limits (one `SELECT *` over an unpartitioned decade is a real invoice), budget alerts per team *with an owner*, auto-suspend on idle compute, and retention policies decided at design time — "keep everything forever" is a decision too, just an unexamined one.

## The classic waste catalog

Worth naming, because every platform audit finds the same five:

- **Zombie resources** — dev clusters and forgotten dashboards refreshing hourly for an audience of zero.
- **The unpartitioned scan** — full-table reads where a date filter would touch 1%.
- **Over-provisioned real-time** (Part 4's warning, monetized) — streaming infrastructure for reports read weekly.
- **Retention by default** — high-priced storage holding data no one may ever query, with no lifecycle rule.
- **The N-copies problem** — the same dataset materialized by four teams because discovery failed (a catalog is also a cost tool).

## Scoring on the five axes

- **Budget:** now the lens itself — the question becomes "does spend scale *sublinearly* with usage?" A platform whose cost grows faster than its value is architecturally wrong, whatever the diagram says.
- **Latency:** freshness has a price curve that steepens sharply below the hour (Parts 4–5); state the cost next to every freshness request.
- **Team:** FinOps needs an owner and a rhythm (weekly review of units), not a hero and a crisis.
- **Scale/Compliance:** growth without unit metrics *is* the risk; retention law (Part 10) sets the floor under deletion-based savings.

## Three customers

- **Startup:** your FinOps program is three settings — auto-suspend, one budget alert, lifecycle rules — and the Part 8 instinct of not renting distributed systems you don't need.
- **Mid-size:** tagging enforced in CI, monthly showback per use case, spot for backfills, one committed-capacity review per year.
- **Enterprise / multi-tenant:** per-tenant metering (Part 9) merges with FinOps into product pricing; cost allocation becomes contractual, and the platform team runs it like a P&L.

## Key takeaways

- Cost is design feedback: measure in units ($/query, $/pipeline, $/tenant), tag at creation, publish showback.
- Four structural patterns: separate storage/compute, tier automatically, match pricing model to workload shape, guardrail the leak points.
- The waste catalog is predictable — zombies, unpartitioned scans, over-provisioned real-time, default retention, N-copies; audit for exactly these.
- The architectural test: spend should scale sublinearly with usage. If it doesn't, revisit the school you chose.

*Next up — Part 13: Migration Architectures: Legacy to Modern Without Falling.*
