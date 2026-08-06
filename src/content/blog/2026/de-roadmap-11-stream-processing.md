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

## What you'll learn

- Explain why state, not throughput, is what makes stream processing hard.
- Choose a window type from the question being asked, not from the tutorial you read.
- Set a watermark policy honestly, and decide what happens to data that arrives after it.
- Make the batch-versus-streaming call on evidence rather than on appetite.

**Prerequisites:** Part 10 (Kafka, partitions, offsets) and Part 6 (late data, backfills).

## 1. State: the thing that makes it hard

A batch job (P03–P07) reads its whole input, computes, writes, dies — its "state" lives for one run. A streaming job runs *forever*, and anything it must remember between events — counters, the other side of a join, a fraud pattern's last five events — is **state** the engine must keep. That one word explains the entire operational surface:

- State lives locally per parallel task, **partitioned by key** — which is why streams are `keyBy`-ed the same way Kafka topics are keyed (P10): all events for `customer_42` meet the same task and its state. Hot keys hurt here twice (P10's lesson, now with memory attached).
- State must survive crashes: engines take periodic **checkpoints** (consistent snapshots of all state + input offsets) to durable storage. Recovery = restore last checkpoint + replay the log from its offsets — this is *why* P10 insisted the log retains data. The much-advertised "exactly-once" is exactly this mechanism: state and offsets commit *together*, so a crash never double-counts — with P10's honest caveat intact: the guarantee covers state inside the engine; effects on external systems still need idempotent sinks or transactional writes.
- **Unbounded state is the streaming OOM**: "count distinct users per key, forever" grows without limit. Production discipline = every piece of state has an expiry (TTL) or lives inside a window. The engine won't impose this; you must.

## 2. Windows: aggregating what never ends

"Total revenue" is meaningless on an infinite stream — *when* would you emit it? Windows make aggregation finite again:

- **Tumbling** — fixed, non-overlapping buckets ("per minute"): dashboards, billing.
- **Sliding** — overlapping ("last 10 minutes, every minute"): smooth trends, threshold alerts.
- **Session** — gap-based ("events until 30 quiet minutes"): user visits, device activity bursts. The window nobody has in batch, and the reason session analytics on streams beat nightly jobs.

The subtle decision hiding underneath: **which time?** *Event time* (when it happened, from the payload) vs *processing time* (when it arrived). A mobile order placed at 23:59 may arrive at 00:15 — processing time books it into the wrong day, and your streaming numbers will never reconcile with the batch warehouse (S02-P06's watermark incidents, replayed at second granularity). Serious pipelines use event time — which creates the next problem.

## 3. Watermarks: the honesty policy for late data

If you window by event time, you must answer: *how long do I wait for stragglers before declaring 12:00–12:01 finished?* A **watermark** is that answer, flowing through the stream: "I believe all events up to 12:01 have arrived." Windows close when the watermark passes their end; events arriving *later* than the watermark are **late data**, and you choose their fate explicitly — drop them (and count them — a metric that silently spikes when a producer breaks), or route them to a side output for reconciliation (the S02-P06 batch-repair instinct).

The trade-off is unavoidable and worth saying out loud: **tight watermarks = fast results + more data declared late; loose watermarks = complete results + everything delayed.** There is no setting that gives you both; there is only choosing consciously per use case — fraud detection tolerates missing 1% to act in seconds; finance waits.

## 4. Batch vs streaming: the honest decision

Streaming is a *cost* you pay for freshness — state, checkpoints, watermark reasoning, 24/7 on-call for a job that never finishes (S01-P05's pager, permanently). So the senior question is P08's scheduling question inverted: **who needs this result, how fresh?**

- Dashboards viewed each morning → batch (P08). "Real-time" that nobody reads in real time is the S01-P10 speculative abstraction, again.
- Fraud/alerting/operational reactions in seconds-to-minutes → streaming, no substitute.
- The middle band ("15-minute freshness") often belongs to **micro-batch** (Spark Structured Streaming's home turf) or frequent incremental batch — dramatically simpler to operate for the same business outcome.

The architecture that reconciles them is the P09 handshake: stream into lakehouse tables (batched commits!), let batch consumers read the same tables — one storage truth, two computation tempos. And operationally, the P10 rules carry over unchanged: alarm on lag first, then on checkpoint duration/failures (the streaming-specific smell: growing checkpoints = growing state = a TTL you forgot), and prefer managed runtimes until scale forces otherwise.

## Practice (25 minutes — implement windowing and a watermark by hand)

No Flink cluster. Forty lines of Python make event time, windows and watermarks concrete — and the last block shows the failure everyone hits in production:

```python
from collections import defaultdict

# (event_time, processing_time, user, amount) — note event 5: it HAPPENED early, ARRIVED late
EVENTS = [
    (10, 10, "u1", 5), (11, 11, "u2", 3), (19, 19, "u1", 7),
    (21, 21, "u1", 2), (25, 25, "u2", 9),
    (14, 31, "u1", 100),                    # late by 17 seconds of processing time
]
WINDOW = 10                                  # tumbling windows: [0,10) [10,20) [20,30)…

def window_of(t): return (t // WINDOW) * WINDOW

# 1. PROCESSING TIME — the naive version: bucket by when we happened to see it
proc = defaultdict(float)
for et, pt, user, amt in EVENTS:
    proc[window_of(pt)] += amt
print("by processing time:", dict(proc))     # the late 100 lands in the wrong window

# 2. EVENT TIME — bucket by when it actually happened
ev = defaultdict(float)
for et, pt, user, amt in EVENTS:
    ev[window_of(et)] += amt
print("by event time    :", dict(ev))        # the 100 goes to window 10, where it belongs

# 3. WATERMARK — you cannot wait forever; you must declare a cutoff
LATENESS = 5                                 # "I'll wait 5 units past the window end"
emitted, results, side_output = set(), {}, []
state = defaultdict(float)
watermark = 0
for et, pt, user, amt in sorted(EVENTS, key=lambda e: e[1]):
    watermark = max(watermark, et - LATENESS)          # a simple bounded-lateness watermark
    w = window_of(et)
    if w + WINDOW <= watermark and w in emitted:
        side_output.append((w, et, amt))                # TOO LATE: window already closed
        continue
    state[w] += amt
    for win in list(state):                             # close any window the watermark passed
        if win + WINDOW <= watermark and win not in emitted:
            results[win] = state[win]; emitted.add(win)
for win in state:                                       # flush at end of stream
    results.setdefault(win, state[win])
print("windows emitted  :", dict(sorted(results.items())))
print("dropped as late  :", side_output, " ← count these, never silently discard")

# 4. STATE GROWTH — the OOM nobody predicts
per_user = defaultdict(float)
for et, pt, user, amt in EVENTS: per_user[user] += amt
print(f"keys held in state: {len(per_user)}  (now imagine one key per session id, forever)")
```

Expected results: block 1 puts the late 100 into the window where it *arrived*, which is simply the wrong answer — and it's the answer you get by default if you never think about event time. Block 2 puts it where it belongs. Block 3 is the honest middle: with a five-unit lateness allowance the window may already be closed when that event shows up, so it lands in a side output that you *count* rather than discard silently. Block 4 is the quiet killer: state is held per key, so a key space that grows without bound (session IDs, request IDs) is an out-of-memory error with a delay fuse. That's why every production streaming job sets a TTL on state.

## Check yourself

1. Your streaming aggregation disagrees with the warehouse's daily numbers by a small amount, every day. What's the most likely cause?
2. Why is "exactly-once" a property of a pipeline segment rather than of a system?
3. Your job runs fine for three weeks, then dies with an out-of-memory error. Throughput never changed. What do you suspect?

<details><summary>See answers</summary>

1. Late data and watermark policy. The stream closed its windows after a bounded lateness allowance, while the batch job re-read everything hours later and included events that arrived after the stream had moved on. Neither is wrong — they're answering with different cutoffs. Reconcile by counting what the stream dropped as late, and by making the batch job's window definition explicit.
2. Because it's achieved by committing state and input offsets together, and that guarantee only holds inside the boundary where the engine controls both. The moment output leaves for an external system that doesn't participate in that commit, you're back to at-least-once and you need idempotent writes on the other side.
3. Unbounded state growth. Something is keyed by a value with unlimited cardinality — session IDs, request IDs, user-provided strings — and each new key adds state that is never released. Fix with a TTL on keyed state, or by re-keying on something bounded.

</details>

## Key takeaways

- Stream processing = stateful computation on infinite input: state is keyed, checkpointed, and must always have a TTL or a window — unbounded state is the streaming OOM.
- Exactly-once is checkpoints committing state + offsets together; it ends at the engine's border — sinks still need idempotency (the curriculum's iron rule, final form).
- Window by event time, and treat watermarks as an explicit honesty policy: fast-but-incomplete vs complete-but-delayed is a choice you make per use case, with late data counted and routed, never silently dropped.
- Streaming is a cost paid for freshness: batch what's read daily, stream what's acted on in seconds, micro-batch the middle — and land both in the same lakehouse tables.

*Next up — Part 12: Data Quality & Testing: Trust as a Feature.*
