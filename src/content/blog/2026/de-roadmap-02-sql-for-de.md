---
title: 'SQL for Data Engineers: Beyond SELECT'
description: 'The four SQL skills that carry a data engineering career: joins you can trust, window functions, CTEs, and aggregation patterns — with the classic traps.'
date: 2026-07-28
category: Data
tags: [de-roadmap, sql, database]
lang: en
translationKey: de-roadmap-02
series: de-roadmap
cover: images/s02-p02-hero.png
part: 2
---

Here is an unpopular truth: seniors don't outgrow SQL — they write *more* of it, on bigger data, with higher stakes. SQL is the one language every warehouse, lakehouse, and BI tool agrees on. This part covers the four skills that turn "I know SQL" into "I trust my SQL": joins, window functions, CTEs, and aggregation patterns.

## What you'll learn

- Write joins that never silently duplicate or drop rows.
- Use the three window-function patterns that cover most daily DE work.
- Structure complex queries with CTEs so a teammate can read them.
- Choose between WHERE, HAVING, and FILTER without guessing.

**Prerequisites:** basic SELECT/WHERE/GROUP BY. Part 1 for where SQL fits in the roadmap.

All examples use a generic shop schema: `orders(id, customer_id, status, amount, created_at)` and `customers(id, name, country)`.

## 1. Joins you can trust

Everyone knows `INNER JOIN` vs `LEFT JOIN`. Data engineers get burned by two subtler things:

**Fan-out.** Join a table to a one-to-many neighbor and your row count multiplies:

```sql
-- Looks innocent; doubles revenue for customers with 2+ orders
SELECT c.id, SUM(o.amount)
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id;
-- Fine. But add a second one-to-many join (e.g. payments) in the same query
-- and SUM(o.amount) silently multiplies. Aggregate each side FIRST, then join.
```

Rule of thumb: **aggregate before you join** when combining two one-to-many relationships. If a total ever looks "too big", suspect fan-out first.

**NULL logic in anti-joins.** "Customers with no orders":

```sql
-- Trap: returns ZERO rows if orders.customer_id has any NULL
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);

-- Safe and optimizer-friendly
SELECT c.* FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

`NOT IN` + a single `NULL` = empty result, no error, no warning. `NOT EXISTS` is the professional's anti-join.

## 2. Window functions: the superpower

A window function computes across related rows **without collapsing them**. Three patterns cover 90% of real usage:

**Latest row per group** — the most-written query in data engineering:

```sql
SELECT * FROM (
  SELECT o.*,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
  FROM orders o
) t
WHERE rn = 1;   -- each customer's most recent order
```

This is also how you **deduplicate**: partition by the business key, order by "which copy wins", keep `rn = 1`.

**Running totals:**

```sql
SELECT created_at::date AS day,
       SUM(amount) OVER (ORDER BY created_at::date) AS revenue_to_date
FROM orders;
```

**Compare to the previous row** (`LAG`) — growth rates, gaps between events, session detection:

```sql
SELECT customer_id, created_at,
       created_at - LAG(created_at) OVER (PARTITION BY customer_id ORDER BY created_at) AS gap
FROM orders;
```

Mental model: `PARTITION BY` = who you compare with; `ORDER BY` = the timeline; the frame = how far you look. If you learn one thing deeply from this post, make it window functions — they replace pages of self-join gymnastics.

## 3. CTEs: SQL that reads like paragraphs

A `WITH` clause (CTE) names each step of your logic:

```sql
WITH monthly AS (
  SELECT date_trunc('month', created_at) AS month, SUM(amount) AS revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY 1
),
with_growth AS (
  SELECT month, revenue,
         revenue - LAG(revenue) OVER (ORDER BY month) AS growth
  FROM monthly
)
SELECT * FROM with_growth WHERE growth < 0;   -- months that shrank
```

Compare that to the same logic as nested subqueries — the CTE version reads top-to-bottom like prose. This matters more than it seems: **in a data team, SQL is read 10× more often than it is written**, in code review, in debugging at 2 a.m., in "where does this number come from?". dbt models are essentially CTEs promoted to files.

One caveat: in some engines a CTE used twice may be computed twice. If a CTE is expensive and reused, check your engine's behavior (`EXPLAIN` — Part 8 of the SQL Mastery series goes deep).

## 4. Aggregation patterns

Two tricks that appear in almost every real report:

**Conditional aggregation** — pivot without pivoting:

```sql
SELECT customer_id,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
       SUM(amount) FILTER (WHERE status = 'completed') AS revenue
FROM orders
GROUP BY customer_id;
-- Engines without FILTER: SUM(CASE WHEN status = 'completed' THEN amount END)
```

**WHERE vs HAVING** — filter rows before grouping, filter groups after:

```sql
SELECT customer_id, SUM(amount) AS total
FROM orders
WHERE status = 'completed'      -- rows first
GROUP BY customer_id
HAVING SUM(amount) > 1000;      -- groups after
```

Putting a row condition in `HAVING` gives the right answer at 10× the cost; putting a group condition in `WHERE` gives an error — or worse, a wrong query you rewrite until it "works".

## Practice (30 minutes)

- Rebuild every example on a scratch PostgreSQL (one `docker run postgres` away).
- Take a dashboard number at work and reproduce it from raw tables — you will meet fan-out, NULLs, and timezone pain in one exercise.
- Read query plans casually (`EXPLAIN`) even before you understand every node; familiarity compounds.

## Check yourself

1. You joined `orders` to a `payments` table and total revenue doubled. What happened, and what's the 10-second diagnostic?
2. `WHERE`, `HAVING`, `FILTER` — which one runs before grouping, which after, and which aggregates conditionally?
3. When does `ROW_NUMBER()` beat `GROUP BY` for "latest record per customer"?

<details><summary>See answers</summary>

1. Fan-out: some orders have multiple payment rows, so each order row duplicated per payment. Diagnostic: compare `COUNT(*)` before and after the join — if it grew, you have fan-out; fix by pre-aggregating payments to one row per order.
2. `WHERE` filters rows before grouping; `HAVING` filters groups after aggregation; `FILTER (WHERE ...)` aggregates conditionally inside one pass.
3. When you need the whole latest row (all columns), not just an aggregate: `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC)` then `WHERE rn = 1` — a GROUP BY can only give you the max timestamp, not the row that owns it.

</details>

## Key takeaways

- Aggregate before joining when two one-to-many joins meet — fan-out silently inflates totals.
- Use `NOT EXISTS`, never `NOT IN`, for anti-joins — one NULL empties your result.
- Window functions (latest-per-group, running totals, `LAG`) replace pages of workarounds — learn them deeply.
- CTEs make SQL read like prose, and SQL is read far more than it is written.

*Next up — Part 3: Python for Data Engineers: the Working Toolkit.*
