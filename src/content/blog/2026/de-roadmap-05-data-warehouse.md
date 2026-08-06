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

Part 4 gave you the star schema. This part is where a working data engineer actually lives: **building the layers** — what each one promises, what code runs between them, and the conventions that keep a 40-model warehouse navigable instead of archaeological. We'll walk one dataset (orders, of course) all the way through.

## What you'll learn

- State what each medallion layer guarantees, and decide which layer a new table belongs to.
- Land bronze data with the metadata and partitioning that make re-runs safe.
- Run silver's four canonical moves in order: cast, dedupe, conform, gate.
- Write an incremental model without the two bugs it invites (late data and drift).

**Prerequisites:** Part 4 (grain, star schema, SCD Type 2). Part 2's window functions appear in the dedupe step.

## 1. Layers are contracts, not folders

The medallion names matter less than what each layer *guarantees* to its readers:

| Layer | Contract | Rebuild? | Who reads it |
|---|---|---|---|
| **Bronze** | Exactly what arrived, when it arrived — plus load metadata | **Never** — it's the evidence | Pipelines & debuggers only |
| **Silver** | Typed, deduplicated, one row means one thing; conformed entities | Anytime, from bronze | DE + advanced analysts |
| **Gold** | Business definitions applied; star schemas & metrics (S02-P04's craft lives here) | Anytime, from silver | BI, ML, everyone |

Two consequences follow from thinking "contract" instead of "folder".

First, the layer a table belongs to is decided by *its guarantee*, not by which transformation produced it.

Second, **the rebuild column is the whole disaster-recovery plan.** Bronze immutable plus everything else derived means the worst pipeline bug costs you a re-run, not your data.

## 2. Bronze: land it raw, stamp it well

The whole skill of bronze is restraint — plus metadata:

```sql
-- bronze.orders_raw : columns AS THEY ARRIVED (all strings if needed), plus:
_loaded_at        timestamp,   -- when we ingested it
_source_file      text,        -- where it came from
_batch_id         text         -- which run owns it (idempotent overwrite key)
```

No renaming, no type fixes, no "small cleanups". Every fix you apply in bronze is evidence destroyed — when a silver number looks wrong, bronze is how you learn whether the source lied or your transform did.

The one structural decision that matters here is **partitioning** (physically splitting a table by a column's value). Organize by load date, so a run owning "one day" can overwrite exactly its slice, and queries scanning "last week" touch 7 partitions instead of 7 years. One decision buys idempotency, speed, and cost control at once.

## 3. Silver: where trust is manufactured

Silver is the layer with the most actual code. The recurring moves, in their canonical order:

1. **Cast & rename** — strings become types (`amount_cents int`, not float — the money rule), source's `cryptic_col_7` becomes `order_status`.
2. **Deduplicate** — the Part 2 window pattern (`ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY _loaded_at DESC)`), keeping the latest version of each business key. Change-data-capture feeds make this non-optional: the same order *will* arrive five times.
3. **Conform entities** — customer and product get their surrogate keys and SCD treatment here, so every downstream fact agrees on who's who.
4. **Quality gates** — the boring checks that page you *before* the CEO does: not-null keys, accepted status values, row counts within expected range.

Naming convention that scales: `stg_<source>__<entity>` for source-shaped staging, `int_<verb>_<entity>` for reusable intermediates. Every model file opens with its grain sentence — Part 4's habit, enforced socially in review.

## 4. Gold: business logic gets exactly one home

Gold is star schemas plus **metric definitions** — and one rule with teeth: **a business rule is defined once, in gold, never in a dashboard**. The day "revenue" is computed slightly differently in three BI tools is the day the platform loses the trust war, no matter how good the pipelines are. Modern stacks push this into a semantic layer, but the discipline is the same: one definition, one owner, referenced everywhere.

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

## 5. Incremental processing, honestly

Full-rebuild-every-night is underrated — it's self-healing and simple; run it as long as the numbers allow. When tables grow past it, **incremental models** process only new slices:

```sql
-- dbt-style incremental: process only new arrivals
{{ config(materialized='incremental', unique_key='order_line_id') }}
SELECT ... FROM {{ ref('stg_shop__orders') }}
{% if is_incremental() %}
WHERE _loaded_at > (SELECT max(_loaded_at) FROM {{ this }})
{% endif %}
```

Two honest costs come with it.

**Late-arriving data:** an order landing three days late misses a naive `WHERE` window. The standard fix is a *lookback* — reprocess the trailing N days every run, idempotently.

**Drift:** incremental state can quietly diverge from what a full rebuild would produce. Schedule a periodic full refresh as the tripwire.

Incremental is a performance optimization *on top of* an idempotent full-rebuild design — never a replacement for one.

## 6. The orders dataset, end to end

`bronze.orders_raw` (as-arrived, partitioned by load date) → `stg_shop__orders` (typed, deduped, quality-gated) → joined with `dim_customer` and `dim_product` (SCD2) → `fct_orders` (one row per line, additive measures, margin defined once) → BI reads gold only.

Every arrow is a re-runnable job owning a dated slice. Every table states its grain. The DAG that orders these arrows is exactly what Part 8 schedules.

![Layers are contracts: bronze is evidence and never rebuilt; silver and gold are derived, so a re-run restores them.](images/s02-p05-concept1.png)

## Practice (25 minutes — build all three layers in DuckDB, locally)

No warehouse account needed. You'll create the layers, break one on purpose, and watch the rebuild contract save you:

```sql
-- duckdb medallion.db
-- 1. BRONZE: exactly as it arrived, plus load metadata. Note the duplicate order 1002.
CREATE TABLE bronze_orders_raw AS
SELECT * FROM (VALUES
  ('1001','C1','120.00','2026-03-01','shipped', DATE '2026-03-01'),
  ('1002','C2','80.00', '2026-03-01','pending', DATE '2026-03-01'),
  ('1002','C2','80.00', '2026-03-01','shipped', DATE '2026-03-02'),  -- same order, later truth
  ('1003','C1','45.50', '2026-03-02','shipped', DATE '2026-03-02')
) AS t(order_id, customer_id, amount, order_date, status, _loaded_at);

SELECT count(*) FROM bronze_orders_raw;          -- 4 rows: evidence, duplicates and all

-- 2. SILVER: cast → dedupe → gate
CREATE TABLE silver_orders AS
SELECT order_id, customer_id,
       CAST(amount AS DECIMAL(10,2)) AS amount,   -- typed, not string
       CAST(order_date AS DATE)      AS order_date,
       status, _loaded_at
FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY _loaded_at DESC) AS rn
      FROM bronze_orders_raw) WHERE rn = 1;       -- keep the latest version per key

SELECT count(*) FROM silver_orders;               -- 3 rows: one row means one order
SELECT status FROM silver_orders WHERE order_id = '1002';   -- shipped, not pending

-- quality gate: this must return 0 rows, or the pipeline should fail
SELECT * FROM silver_orders WHERE order_id IS NULL OR amount < 0;

-- 3. GOLD: the business definition, defined once
CREATE TABLE gold_daily_revenue AS
SELECT order_date, sum(amount) AS revenue, count(*) AS orders
FROM silver_orders WHERE status = 'shipped'       -- "revenue" means shipped. Here. Only here.
GROUP BY order_date ORDER BY order_date;
SELECT * FROM gold_daily_revenue;

-- 4. The rebuild contract: destroy the derived layers, restore from evidence
DROP TABLE gold_daily_revenue; DROP TABLE silver_orders;
-- …then re-run steps 2 and 3 verbatim. Same numbers, no data lost.
```

Expected results: bronze holds 4 rows and silver holds 3 — the dedupe window is what turns "everything that arrived" into "one row means one thing", and order 1002 shows `shipped` because the later load won. Gold's revenue counts shipped orders only, and that `WHERE` clause is the entire business definition living in exactly one place. Then dropping silver and gold costs you nothing but a re-run: that is the rebuild column of the contract table, demonstrated rather than asserted.

## Check yourself

1. A teammate fixes a misspelled country code while loading into bronze. Why is this a problem, and where does the fix belong?
2. Your incremental model uses `WHERE _loaded_at > (SELECT max(_loaded_at) FROM this)`. Which two failure modes does it invite, and what's the standard mitigation for each?
3. Marketing's dashboard shows different revenue than finance's. Both query the warehouse. What went wrong architecturally?

<details><summary>See answers</summary>

1. It destroys evidence. When a gold number later looks wrong, bronze is the only way to tell whether the source sent bad data or a transform broke it — and a "helpful" fix in bronze makes that question unanswerable. The fix belongs in silver, where cleaning is the layer's declared job.
2. Late-arriving data (rows that land after the watermark moved past their timestamp are never picked up — mitigate with a lookback window reprocessing the trailing N days idempotently), and drift (incremental state slowly diverging from what a full rebuild produces — mitigate with a scheduled full refresh as a tripwire).
3. A business rule got defined outside gold. Each BI tool implemented "revenue" its own way, so the platform has two answers and no owner. The fix is one definition in gold (or a semantic layer), referenced by both dashboards.

</details>

## Key takeaways

- Layers are contracts: bronze = evidence (never rebuilt), silver = manufactured trust, gold = business definitions with exactly one home.
- Partition bronze by load date — it's simultaneously the idempotency key, the query accelerator, and the cost control.
- Silver's canon: cast → dedupe (window pattern) → conform (SCD) → quality gates; name models so the layer is visible in the name.
- Incremental models are an optimization over an idempotent full-rebuild design — with lookbacks for late data and periodic full refreshes as the drift tripwire.

*Next up — Part 6: ETL vs ELT: Building Reliable Batch Pipelines.*
