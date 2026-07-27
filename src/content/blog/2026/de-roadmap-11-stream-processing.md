---
title: 'Stream Processing: Flink & Friends'
description: 'Stateful computation over infinite data: windows as the answer to "aggregate what never ends", watermarks as the honesty policy for late data, and when batch is still the right call.'
date: 2026-08-04
category: Data
tags: [de-roadmap, flink, streaming]
lang: en
translationKey: de-roadmap-11
series: de-roadmap
part: 11
---

P10 gave you the log; this part is about *computing* on it. Reading Kafka and upserting rows is plumbing — **stream processing** starts when the computation needs *memory across events*: "orders per minute," "has this card made five purchases in ten seconds," "join clicks to impressions." Flink is the reference engine for this class (Spark Structured Streaming and Kafka Streams are the same ideas with different trade-offs), and the ideas are what transfer. Three of them do all the work: **state, windows, and watermarks.**

## State: the thing that makes it hard

A batch job (P03–P07) reads its whole input, computes, writes, dies — its "state" lives for one run. A streaming job runs *forever*, and anything it must remember between events — counters, the other side of a join, a fraud pattern's last five events — is **state** the engine must keep. That one word explains the entire operational surface:

- State lives locally per parallel task, **partitioned by key** — which is why streams are `keyBy`-ed the same way Kafka topics are keyed (P10): all events for `customer_42` meet the same task and its state. Hot keys hurt here twice (P10's lesson, now with memory attached).
- State must survive crashes: engines take periodic **checkpoints** (consistent snapshots of all state + input offsets) to durable storage. Recovery = restore last checkpoint + replay the log from its offsets — this is *why* P10 insisted the log retains data. The much-advertised "exactly-once" is exactly this mechanism: state and offsets commit *together*, so a crash never double-counts — with P10's honest caveat intact: the guarantee covers state inside the engine; effects on external systems still need idempotent sinks or transactional writes.
- **Unbounded state is the streaming OOM**: "count distinct users per key, forever" grows without limit. Production discipline = every piece of state has an expiry (TTL) or lives inside a window. The engine won't impose this; you must.

## Windows: aggregating what never ends

"Total revenue" is meaningless on an infinite stream — *when* would you emit it? Windows make aggregation finite again:

- **Tumbling** — fixed, non-overlapping buckets ("per minute"): dashboards, billing.
- **Sliding** — overlapping ("last 10 minutes, every minute"): smooth trends, threshold alerts.
- **Session** — gap-based ("events until 30 quiet minutes"): user visits, device activity bursts. The window nobody has in batch, and the reason session analytics on streams beat nightly jobs.

The subtle decision hiding underneath: **which time?** *Event time* (when it happened, from the payload) vs *processing time* (when it arrived). A mobile order placed at 23:59 may arrive at 00:15 — processing time books it into the wrong day, and your streaming numbers will never reconcile with the batch warehouse (S02-P06's watermark incidents, replayed at second granularity). Serious pipelines use event time — which creates the next problem.

## Watermarks: the honesty policy for late data

If you window by event time, you must answer: *how long do I wait for stragglers before declaring 12:00–12:01 finished?* A **watermark** is that answer, flowing through the stream: "I believe all events up to 12:01 have arrived." Windows close when the watermark passes their end; events arriving *later* than the watermark are **late data**, and you choose their fate explicitly — drop them (and count them — a metric that silently spikes when a producer breaks), or route them to a side output for reconciliation (the S02-P06 batch-repair instinct).

The trade-off is unavoidable and worth saying out loud: **tight watermarks = fast results + more data declared late; loose watermarks = complete results + everything delayed.** There is no setting that gives you both; there is only choosing consciously per use case — fraud detection tolerates missing 1% to act in seconds; finance waits.

## Batch vs streaming: the honest decision

Streaming is a *cost* you pay for freshness — state, checkpoints, watermark reasoning, 24/7 on-call for a job that never finishes (S01-P05's pager, permanently). So the senior question is P08's scheduling question inverted: **who needs this result, how fresh?**

- Dashboards viewed each morning → batch (P08). "Real-time" that nobody reads in real time is the S01-P10 speculative abstraction, again.
- Fraud/alerting/operational reactions in seconds-to-minutes → streaming, no substitute.
- The middle band ("15-minute freshness") often belongs to **micro-batch** (Spark Structured Streaming's home turf) or frequent incremental batch — dramatically simpler to operate for the same business outcome.

The architecture that reconciles them is the P09 handshake: stream into lakehouse tables (batched commits!), let batch consumers read the same tables — one storage truth, two computation tempos. And operationally, the P10 rules carry over unchanged: alarm on lag first, then on checkpoint duration/failures (the streaming-specific smell: growing checkpoints = growing state = a TTL you forgot), and prefer managed runtimes until scale forces otherwise.

## Key takeaways

- Stream processing = stateful computation on infinite input: state is keyed, checkpointed, and must always have a TTL or a window — unbounded state is the streaming OOM.
- Exactly-once is checkpoints committing state + offsets together; it ends at the engine's border — sinks still need idempotency (the curriculum's iron rule, final form).
- Window by event time, and treat watermarks as an explicit honesty policy: fast-but-incomplete vs complete-but-delayed is a choice you make per use case, with late data counted and routed, never silently dropped.
- Streaming is a cost paid for freshness: batch what's read daily, stream what's acted on in seconds, micro-batch the middle — and land both in the same lakehouse tables.

*Next up — Part 12: Data Quality & Testing: Trust as a Feature.*
