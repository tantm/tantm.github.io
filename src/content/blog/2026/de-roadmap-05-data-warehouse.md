---
title: 'Data Warehouse & the Medallion Architecture'
description: 'Layer contracts in practice: one orders dataset walked bronze → silver → gold, naming conventions that scale, partitioning, and incremental models done honestly.'
date: 2026-07-31
category: Data
tags: [de-roadmap, warehouse, lakehouse, dbt]
lang: en
translationKey: de-roadmap-05
series: de-roadmap
part: 5
---

S07-P03 explained medallion as an architecture school; S02-P04 gave you the star schema. This part is where a working DE lives: **actually building the layers** — what each one promises, what code runs between them, and the conventions that keep a 40-model warehouse navigable instead of archaeological. We'll walk one dataset (orders, of course) all the way through.

## Layers are contracts, not folders

The medallion names matter less than what each layer *guarantees* to its readers:

| Layer | Contract | Rebuild? | Who reads it |
|---|---|---|---|
| **Bronze** | Exactly what arrived, when it arrived — plus load metadata | **Never** — it's the evidence | Pipelines & debuggers only |
| **Silver** | Typed, deduplicated, one row means one thing; conformed entities | Anytime, from bronze | DE + advanced analysts |
| **Gold** | Business definitions applied; star schemas & metrics (S02-P04's craft lives here) | Anytime, from silver | BI, ML, everyone |

Two consequences of thinking "contract" instead of "folder". First, the layer a table belongs to is decided by *its guarantee*, not by which transformation produced it. Second, **the rebuild column is the whole disaster-recovery plan**: bronze immutable + everything else derived means the worst pipeline bug costs you a re-run, not your data (S02-P03's idempotency, now at platform scale).

## Bronze: land it raw, stamp it well

The whole skill of bronze is restraint — plus metadata:

```sql
-- bronze.orders_raw : columns AS THEY ARRIVED (all strings if needed), plus:
_loaded_at        timestamp,   -- when we ingested it
_source_file      text,        -- where it came from
_batch_id         text         -- which run owns it (idempotent overwrite key)
```

No renaming, no type fixes, no "small cleanups" — every fix you apply in bronze is evidence destroyed (when a silver number looks wrong, bronze is how you learn whether the source lied or your transform did). The one structural decision that matters here is **partitioning**: physically organize by load date (`_loaded_at`), so that a run owning "one day" can overwrite exactly its slice, and queries scanning "last week" touch 7 partitions instead of 7 years — the unpartitioned-scan waste from S07-P12's catalog dies in this decision.

## Silver: where trust is manufactured

Silver is the layer with the most actual code. The recurring moves, in their canonical order:

1. **Cast & rename** — strings become types (`amount_cents int`, not float — the money rule), source's `cryptic_col_7` becomes `order_status`.
2. **Deduplicate** — the S02-P02 window pattern (`ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY _loaded_at DESC)`), keeping the latest version of each business key. CDC feeds (S07-P06) make this non-optional: the same order *will* arrive five times.
3. **Conform entities** — customer and product get their surrogate keys and SCD treatment here (S02-P04), so every downstream fact agrees on who's who.
4. **Quality gates** — the boring checks that page you *before* the CEO does: not-null keys, accepted status values, row counts within expected range (formalized in S02-P12; declared as dbt tests today).

Naming convention that scales: `stg_<source>__<entity>` for source-shaped staging, `int_<verb>_<entity>` for reusable intermediates, and every model file opens with its grain sentence (S02-P04's habit, enforced socially in review).

## Gold: business logic gets exactly one home

Gold is star schemas (P04) plus **metric definitions** — and one rule with teeth: **a business rule is defined once, in gold, never in a dashboard**. The day "revenue" is computed slightly differently in three BI tools is the day the platform loses the trust war regardless of how good the pipelines are. Modern stacks push this further into a semantic layer, but the discipline is the same: one definition, one owner, referenced everywhere.

```sql
-- gold.fct_orders : grain = one order line
SELECT
    o.order_line_id,
    c.customer_key,           -- surrogate, SCD2-resolved as-of sale time (P04)
    d.date_key,
    o.quantity,
    o.amount_cents,
    o.amount_cents - o.cost_cents AS margin_cents   -- defined HERE, only here
FROM silver.orders o
JOIN gold.dim_customer c ON ...
```

## Incremental processing, honestly

Full-rebuild-every-night is underrated — it's self-healing and simple; run it as long as the numbers allow. When tables grow past it, **incremental models** process only new slices:

```sql
-- dbt-style incremental: process only new arrivals
{{ config(materialized='incremental', unique_key='order_line_id') }}
SELECT ... FROM {{ ref('stg_shop__orders') }}
{% if is_incremental() %}
WHERE _loaded_at > (SELECT max(_loaded_at) FROM {{ this }})
{% endif %}
```

The two honest costs, stated up front: **late-arriving data** (an order landing three days late misses a naive `WHERE` window — the standard fix is a *lookback*: reprocess the trailing N days every run, idempotently), and **drift** (incremental state can quietly diverge from what a full rebuild would produce — schedule a periodic full refresh as the tripwire). Incremental is a performance optimization *on top of* an idempotent full-rebuild design — never a replacement for one.

## The orders dataset, end to end

`bronze.orders_raw` (as-arrived, partitioned by load date) → `stg_shop__orders` (typed, deduped, quality-gated) → joined with `dim_customer` / `dim_product` (SCD2) → `fct_orders` (one row per line, additive measures, margin defined once) → BI reads gold only. Every arrow is a re-runnable job owning a dated slice; every table states its grain; the DAG that orders these arrows is exactly what Part 8 (Airflow) schedules.

## Key takeaways

- Layers are contracts: bronze = evidence (never rebuilt), silver = manufactured trust, gold = business definitions with exactly one home.
- Partition bronze by load date — it's simultaneously the idempotency key, the query accelerator, and the cost control.
- Silver's canon: cast → dedupe (window pattern) → conform (SCD) → quality gates; name models so the layer is visible in the name.
- Incremental models are an optimization over an idempotent full-rebuild design — with lookbacks for late data and periodic full refreshes as the drift tripwire.

*Next up — Part 6: ETL vs ELT: Building Reliable Batch Pipelines.*
