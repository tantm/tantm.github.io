---
title: 'ETL vs ELT: Building Reliable Batch Pipelines'
description: 'Extract watermarks, three load patterns, backfill as a first-class operation, and a failure taxonomy that tells you what to retry — pipeline reliability as a craft.'
date: 2026-08-01
category: Data
tags: [de-roadmap, etl, pipeline, data-engineer]
lang: en
translationKey: de-roadmap-06
series: de-roadmap
part: 6
---

Parts 3 and 5 gave you the ingredients — idempotent scripts, layered tables. This part assembles them into the thing you'll actually operate: **a batch pipeline that runs unattended for months**. The ETL-vs-ELT debate takes ten minutes; the craft of extract patterns, load patterns, backfills, and retry semantics takes the rest — and is what separates pipelines that page you from pipelines that don't.

## ETL vs ELT, settled quickly

**ETL** transforms data *before* loading (in the pipeline tool); **ELT** loads raw first, transforms *inside* the warehouse with SQL (S02-P05's bronze-then-silver is exactly this). ELT won the default for three reasons: warehouse compute got cheap and elastic, raw-first preserves the debugging evidence (bronze!), and SQL transforms are testable and versionable as dbt models. The honest exceptions where the T still comes first: **PII masking/tokenization that must happen before data lands** (S07-P10's zoning — sometimes the law says transform first), heavy unstructured parsing, and shrinking absurdly wide payloads at the edge. Rule: *ELT by default; ETL where compliance or physics demands it.* Done — now the craft.

## Extract: the watermark is the whole game

Full extracts (copy the entire table nightly) are underrated — self-healing and simple; keep them as long as size allows (the P05 full-rebuild instinct). When the table outgrows them, you extract **incrementally**, and the entire correctness burden lands on one concept — the **watermark**:

```python
# The watermark contract:
last = read_watermark("orders")                    # e.g. 2026-07-30T02:00:00
rows = extract(f"updated_at > '{last}' AND updated_at <= '{now}'")  # closed window
load(rows)
write_watermark("orders", now)                     # advance ONLY after load succeeds
```

The three ways this goes wrong are the three classic incidents: advancing the watermark *before* the load succeeds (crash = silently lost window), using `created_at` when rows get *updated* (edits never re-extracted — use `updated_at`, and make sure the source actually maintains it), and clock skew / late commits at the window edge (standard fix: overlap the window a few minutes and rely on idempotent loads to absorb duplicates). Notice the theme: the watermark plus an idempotent load equals exactly-once *effect* over at-least-once machinery — the same trick S07-P06 pulled with CDC, at batch cadence.

## Load: three patterns, one decision table

| Pattern | How | When |
|---|---|---|
| **Overwrite partition** | Delete-and-rewrite the slice this run owns | The default for facts (P03's rule: a run owns its date) |
| **Merge / upsert** | Match on business key, update-or-insert | Dimensions, CDC feeds, late-arriving mutable rows |
| **Append-only** | Just add rows | Immutable events *with* dedupe downstream (P05's silver window) |

The anti-pattern is blind append of *mutable* data — the doubled-numbers incident every data team experiences exactly once, loudly. And whichever pattern you use, make the write **atomic**: stage into a temp table/prefix, then swap — so a mid-write crash leaves the old data intact rather than half of each (Part 5's bronze immutability plus CS-P5's SIGKILL lesson, combined).

## Backfill: a first-class operation, not an emergency

Every pipeline will need to reprocess history — a bug fixed, a column added, a source corrected. Teams that treat backfill as an emergency improvise it badly at the worst moment. Design it on day one:

- **The same job runs any date**: because runs are parameterized by `--run-date` (P03) and own their partition (P05), a backfill is just a loop over dates — no special code path, hence nothing untested.
- **Bounded parallelism**: backfilling 3 years = ~1,100 independent runs; run 10 at a time, not 1 (weeks) and not 1,100 (source-killing).
- **Protect the source**: extracts for backfill should hit bronze/replicas, never hammer the production OLTP (the reason bronze *keeps* everything).
- **Announce and verify**: downstream consumers see numbers move; a row-count/total reconciliation before-vs-after (S07-P13's discipline, in miniature) turns "did the backfill work?" from vibes into evidence.

## Failure taxonomy: what to retry, what to wake a human for

The pipeline's error handling should sort every failure into one of three bins:

1. **Transient** (network blips, S3 503s, lock timeouts) → **retry automatically** with backoff; this is why exit codes (P03) and orchestrator retries (P08) exist. Most 2 a.m. pages that shouldn't have happened are un-retried transients.
2. **Data failures** (schema drift from the source, a file that doesn't parse, quality gate breach) → **fail fast and loud, don't retry** — retrying a malformed file 5 times just delays the alert. Quarantine the bad input (a `_rejected/` prefix), continue or halt per severity, page with the *filename*.
3. **Logic bugs** (your transform is wrong) → nothing automated saves you; this is what the P05 layer contracts and P12's quality checks are for — detection, then a fix plus backfill (see above; it's routine now, remember?).

The signature of a mature pipeline isn't that it never fails — it's that each failure lands in the right bin automatically.

## Where dbt sits in all this

dbt owns the **T of ELT**: SQL models with `ref()` dependencies (the DAG), tests as config, docs generated. It does *not* extract, load, or schedule — the EL is your P03-style jobs or an ingestion tool, and the clock is Part 8's orchestrator, which runs EL then `dbt run` then `dbt test` as one dependency chain. Keeping this division straight ("dbt is the transform layer, not the pipeline") prevents both the over-ask (dbt won't fetch your API data) and the under-use (transform logic scattered in Python that should be testable SQL models).

## Key takeaways

- ELT by default (cheap warehouse compute + bronze evidence + testable SQL); ETL survives where compliance or physics demands transform-first.
- Incremental extract lives or dies by the watermark: closed windows, advance only after success, `updated_at` not `created_at`, overlap + idempotent loads for the edges.
- Loads are overwrite-partition, merge, or append(+dedupe) — always staged-then-swapped; blind append of mutable data is the doubled-numbers incident.
- Backfill is a designed operation (parameterized runs, bounded parallelism, verify by reconciliation); failures sort into transient (retry), data (quarantine, don't retry), logic (fix + backfill).

*Next up — Part 7: Apache Spark: When Pandas Isn't Enough.*
