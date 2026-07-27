---
title: 'Well-Architected: Designing Real Systems'
description: 'The six pillars as review questions you already know how to answer, three reference patterns that cover most systems, DR as a business decision, and how to read any architecture diagram.'
date: 2026-08-04
category: Cloud
tags: [aws, architecture, system-design]
lang: en
translationKey: aws-15
series: aws-zero-to-advanced
part: 15
---

Fourteen parts of services; this part is the *assembly manual*. AWS's *Well-Architected Framework* sounds like vendor homework, and used badly it is — a checklist theater. Used well, it's something better: **six standing questions to interrogate any design with** — and the punchline of this series is that you already know the answers; you learned them one service at a time. This part reassembles them into the skill interviews call system design and the job calls architecture review.

## Six pillars, as questions you can already answer

- **Operational excellence** — *can you run it?* IaC and reviewable change (P11), runbooks and blameless postmortems (S01-P12), observability that alarms on symptoms (P10).
- **Security** — *what happens when a layer fails?* Identity-first (P02), defense in depth, guardrails, account boundaries (P12), input-is-code (CS-P11).
- **Reliability** — *what breaks, and what absorbs it?* Multi-AZ by default (P05), queues as shock absorbers with DLQs (P09), timeouts/retries/idempotency (the iron rule), and the P03 cattle stance: instances die, fleets don't.
- **Performance efficiency** — *right tool, measured?* Right-sizing (P03), the storage-class and layout lessons (P04, P13), percentiles not averages (P10), and serverless where traffic is spiky (P07).
- **Cost optimization** — *is spend visible and intentional?* Tags, budgets, the levers-in-order discipline (P16 gives this pillar its own finale; S02-P14 already gave you the instinct: cost is a correctness dimension).
- **Sustainability** — the quiet sixth: mostly, efficiency's shadow — right-size, scale to zero, delete the idle. If your cost pillar is healthy, this one usually is too.

The framework's actual utility is *cadence*: a one-hour review per system per quarter, pillar by pillar, writing down the risks you're consciously accepting. That last clause is the senior part — Well-Architected doesn't say "never accept risk"; it says *know which ones you accepted, on purpose, in writing* (S02-P14's decision records, applied to architecture).

## Three patterns cover most systems

**The 3-tier workhorse** (most CRUD products): DNS/CDN → load balancer in public subnets → stateless app fleet in private subnets (P03/P08) → managed database multi-AZ + cache. The load-bearing property is **stateless app tier** (S01-P12's artifact thinking: any instance can serve any request, so autoscaling and deploys are boring). The classic mistakes are P05's: state on instances, databases in public subnets, SGs referencing IPs instead of SGs.

**Event-driven** (spiky, bursty, integration-heavy): API → queue/bus (P09) → workers (P07/P08) → notifications out. Absorbs spikes, isolates failures (DLQs), scales to zero — at the price of eventual consistency and the P09 disciplines (idempotency, ordering-per-entity, oldest-message-age alarms). Choose it when the work is *naturally asynchronous*; forcing synchronous UX onto queues buys complexity without the payoff.

**The serverless lake** (analytics — P13's diagram, cited not repeated): S3 + catalog + serverless compute, the pattern where storage-compute separation (S07-P03) does the heavy lifting.

Real systems compose these — a 3-tier front with an event-driven back and a lake alongside is the modal mid-size architecture. The composition seams are exactly where the P09/P10 disciplines live.

## DR: a business decision wearing an engineering costume

Disaster recovery starts with two numbers the *business* chooses — **RPO** (how much data can we lose?) and **RTO** (how long can we be down?) — and engineering buys them at escalating price: **backups + restore** (hours of RTO, cheapest — but a backup you haven't restored is a hope, not a plan: game-day the restore, S01-P12); **pilot light / warm standby** (data replicated cross-region, minimal or scaled-down infra ready to inflate — RTO in minutes-to-an-hour; IaC from P11 is what makes "inflate" a command instead of a weekend); **active-active** (multi-region serving — RTO near zero, and a cost/complexity tier most businesses don't actually need when they see the invoice). The senior contribution is refusing to let "we need zero downtime" pass unpriced: present the tiers with costs, let the business pick — S02-P14's "say no with a price tag," at architecture scale. And remember P05's scope note: multi-AZ already covers the *common* disasters; multi-region is for the rare ones and the compliance ones (S07-P10).

## Reading an architecture diagram (the skill under the skill)

Hand a senior a diagram and they run a fixed interrogation — it works in reviews, interviews, and incident retros alike: **follow one request end-to-end** (S01-P06's four acts, extended — every hop is a failure point and a latency term); **find the state** (stateless things scale and recover trivially; every stateful box — database, queue, cache — gets the hard questions: backed up? replicated? what's its P05 blast radius?); **find the SPOFs** (anything without a partner in another AZ; anything all traffic must traverse); **ask "what happens when X dies?"** for the three scariest boxes (the P12 blast-radius question, applied box by box); and **ask what's *missing*** — the most senior read of all: no queue between spiky ingress and the database? No DLQ? No cross-region story for the compliance data? The diagram shows what's there; the review earns its keep on what isn't.

## Key takeaways

- The six pillars are standing questions, and this series already taught the answers — the framework's value is cadence plus *written, consciously-accepted risks*.
- Three patterns cover most systems: 3-tier (stateless app tier is the load-bearing property), event-driven (absorbs spikes, demands idempotency), and the serverless lake — real architectures compose them.
- DR is RPO/RTO chosen by the business at a price presented by engineering: backup→pilot light→warm→active-active, and an unrestored backup is a hope.
- Read diagrams with the fixed interrogation: trace a request, find the state, find the SPOFs, kill the scariest boxes on paper, and ask what's missing.

*Next up — Part 16: AWS Cost Optimization & the Cert Path — the series finale.*
