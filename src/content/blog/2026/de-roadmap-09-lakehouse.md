---
title: 'Data Lake & Lakehouse: Parquet, Iceberg, Delta'
description: 'Inside Parquet (why columnar is fast), how table formats fake ACID on immutable storage, the small-files disease, and the maintenance jobs nobody tells you about.'
date: 2026-08-04
category: Data
tags: [de-roadmap, lakehouse, storage, parquet]
lang: en
translationKey: de-roadmap-09
series: de-roadmap
part: 9
---

S07-P03 told the lake→swamp→lakehouse story from the architect's chair. This part opens the hood: what's *inside* a Parquet file that makes it fast, how Iceberg/Delta-class formats conjure ACID out of immutable objects (S04-P04 said objects can't be edited — so how does `UPDATE` work?), and the two operational diseases — small files and unmaintained tables — that every real lakehouse catches.

## What you'll learn

- Explain the three mechanisms that make columnar storage fast, and how to write files that use them.
- Describe how table formats conjure ACID out of immutable object storage.
- Diagnose and cure the small-files disease before it doubles your query times.
- Evolve a schema without breaking readers.

**Prerequisites:** Part 5 (partitions and layers) and Part 3 (the escalation path that leads here).

## 1. Inside Parquet: why columnar wins

A Parquet file is not "a CSV but binary." Its structure *is* its performance:

```text
file
 ├── row group 0  (~128MB–1GB of rows)
 │    ├── column chunk: order_id   (encoded, compressed)
 │    ├── column chunk: amount     (encoded, compressed)
 │    └── column chunk: country    (encoded, compressed)
 ├── row group 1 ...
 └── footer: schema + per-chunk statistics (min/max, null count)
```

Three mechanisms fall out of this layout, and they're the whole magic:

1. **Column pruning** — `SELECT amount, country` reads two column chunks and skips the other thirty. A wide table queried narrowly costs a fraction of its size (CS-P2's "fastest data is data you don't read").
2. **Predicate pushdown via footer stats** — `WHERE day = '2026-08-01'` checks each row group's min/max *in the footer* and skips whole groups without reading them. This is why **sorting/clustering within files by your common filter column** is a real optimization: tight min/max ranges = more skipping.
3. **Encoding before compression** — columns of similar values encode brutally well (dictionary encoding turns a million `"VN"` strings into one dictionary entry + tiny indices; run-length encoding crushes sorted columns). This is why Parquet is 5–10× smaller than CSV *and* faster to read — and why S02-P03's pandas memory rule improves the moment you switch formats.

## 2. Table formats: ACID conjured from immutable objects

S04-P04's constraint: objects can't be edited, only replaced. So how does a lakehouse `UPDATE` a row? **It doesn't — it writes new files and changes what the table *means*:**

- The table's truth lives in a **metadata layer**: a log of snapshots, each snapshot = "the table is exactly this list of data files."
- A write (append, update, delete) creates *new* Parquet files plus a *new* snapshot referencing the new file list. The **commit** is a single atomic swap of the current-snapshot pointer.
- Readers pin a snapshot when they start — they see a consistent table even mid-write (the ACID of S07-P03's table, mechanically explained). **Time travel** is now obvious: old snapshots still list old files; query one.
- Deletes come in two flavors worth knowing: **copy-on-write** (rewrite affected files — slower writes, fastest reads) vs **merge-on-read** (write small "delete files"; readers subtract them — fast writes, read-time tax until compaction). Streaming-heavy tables lean MoR; batch-analytics tables lean CoW.

Iceberg and Delta differ in ecosystem and details, not in this core design. The pragmatic choice in 2026: **whichever your primary engine/platform treats as native** — the concepts transfer completely, and engines increasingly read both.

## 3. The small-files disease

The lakehouse's most common production illness. Streaming writers (S07-P06's CDC) and over-parallel jobs (S02-P07's thousand tiny partitions) each commit tiny files; a year later a "table" is two million 200 KB objects — and every query pays two million S3 requests (S04-P04's fewer-larger-requests rule, violated at scale) plus footer-reading overhead that dwarfs the data.

The treatments, all boring and all mandatory:

- **Compaction** — periodically rewrite small files into ~128 MB–1 GB targets. Every table format ships this as a maintenance procedure; *schedule it* (an Airflow DAG, S02-P08) — it does not run itself.
- **Snapshot expiration** — every commit kept every old file reachable for time travel; expire old snapshots and delete orphaned files, or storage grows monotonically (S07-P12's versioning-bill lesson, table-format edition). Retention here is also your S07-P10 compliance lever — expiring a snapshot is what finally *deletes* data.
- **Write bigger** — fix producers: batch streaming commits (every N minutes, not every message), right-size Spark output partitions before writing.

A lakehouse without scheduled maintenance isn't a lakehouse; it's a swamp with better marketing. Budget the maintenance DAG the day you create the first table.

## 4. Schema evolution without tears

The table format tracks columns by **ID, not name** — which is why `ALTER TABLE ADD COLUMN`, renames, and type-widening are metadata-only operations (no data rewrite) and why old files remain readable: missing columns read as null. The disciplines that keep evolution safe: **add, don't repurpose** (a column's meaning is a contract with every old snapshot); widen types only in supported directions (int→bigint yes; string→int is a migration, not evolution); and coordinate with S07-P06's schema-registry instinct when the table is CDC-fed — the evolution has to happen at *both* ends.

## 5. Where this sits in your platform

Bronze/silver/gold (S02-P05) live *as* these tables: bronze partitioned by load date, silver merged by key (MoR-friendly), gold compacted aggressively for BI. The engines — Spark (P07), DuckDB/Trino (S07-P08), the warehouses — all read the same files; the format is the contract that makes S07-P03's "engine-neutral exit ramp" a mechanical fact rather than a slogan.

## Practice (25 minutes — measure the three mechanisms, then catch small files red-handed)

DuckDB writes and reads Parquet natively, so every claim in this part is measurable in one session:

```sql
-- duckdb lake.db
CREATE TABLE events AS
SELECT (i % 1000)                                   AS customer_id,
       (i % 7)                                      AS channel,
       DATE '2026-01-01' + (i % 365)                AS event_date,
       repeat('x', 40)                              AS payload,
       ((i * 31) % 10000) / 100.0                   AS amount
FROM range(3000000) t(i);

-- 1. Same data, two formats — compare size on disk
COPY events TO 'events.csv'     (FORMAT CSV);
COPY events TO 'events.parquet' (FORMAT PARQUET);
-- (in a shell) ls -lh events.csv events.parquet   ← encoding + compression, before you tune anything

.timer on
-- 2. Column pruning: read one column instead of five
SELECT sum(amount) FROM 'events.parquet';
SELECT count(*)    FROM 'events.parquet' WHERE payload LIKE 'x%';   -- touches the wide column

-- 3. Predicate pushdown works on SORTED data — row-group stats can skip whole blocks
COPY (SELECT * FROM events ORDER BY event_date) TO 'sorted.parquet' (FORMAT PARQUET);
SELECT count(*) FROM 'events.parquet' WHERE event_date = DATE '2026-06-15';
SELECT count(*) FROM 'sorted.parquet' WHERE event_date = DATE '2026-06-15';  -- fewer row groups read

-- 4. THE SMALL-FILES DISEASE, reproduced on purpose
COPY (SELECT * FROM events) TO 'many' (FORMAT PARQUET, PARTITION_BY (customer_id));  -- 1000 tiny files
COPY (SELECT * FROM events) TO 'few'  (FORMAT PARQUET, PARTITION_BY (channel));      -- 7 healthy files
SELECT sum(amount) FROM 'many/*/*.parquet';
SELECT sum(amount) FROM 'few/*/*.parquet';       -- same answer, far less per-file overhead

-- 5. The cure: compaction is just "read them all, write fewer"
COPY (SELECT * FROM 'many/*/*.parquet') TO 'compacted.parquet' (FORMAT PARQUET);
SELECT sum(amount) FROM 'compacted.parquet';
```

Expected results: the Parquet file is dramatically smaller than the CSV without you configuring anything — that's encoding plus compression on columnar data. In step 2, summing one narrow column is much faster than any query that touches the wide `payload` column, because unread columns are never read at all. Step 3 shows why "sort by the column you filter on" is real advice rather than folklore: statistics per row group let the reader skip blocks entirely, and only sorted data has skippable blocks. Step 4 is the one to remember — a thousand tiny files answer the same question far more slowly than seven good ones, and that gap grows with every partition you add. Step 5 shows the cure is unglamorous: read them all, write fewer.

## Check yourself

1. Your team partitions a table by `customer_id` because most queries filter on it. Six months later queries are slow and the storage bill has odd metadata costs. What happened?
2. Why can a table format offer atomic commits when the underlying object storage only offers "put this object"?
3. A colleague renames a column in a Parquet-backed table and downstream jobs start returning nulls. What rule did they break?

<details><summary>See answers</summary>

1. High-cardinality partitioning: thousands of customers means thousands of directories each holding tiny files. Every query pays per-file open cost and metadata listing, which swamps the benefit of pruning. Partition on low-cardinality columns you filter by (date, region, channel) and *sort* within them by the high-cardinality one — the sort gives you skipping without the file explosion.
2. Because the commit is a pointer swap, not a data write. Writers create new immutable data files, then atomically update one small metadata file to point at the new snapshot. Readers see either the old snapshot or the new one, never a half-written state — the atomicity lives in that one pointer, which is also what makes time travel free.
3. They reused or repositioned a column identity. Table formats track columns by an internal ID, not by name or position, so *adding* is safe while renaming-in-place or reusing an old name silently breaks readers that resolve differently. Add the new column, backfill, migrate readers, then remove the old one.

</details>

## Key takeaways

- Parquet's layout is its speed: column pruning, footer-stats pushdown (sort by your filter column!), and encoding that beats compression alone.
- Table formats never edit files — they swap snapshot pointers atomically: that's ACID, time travel, and CoW-vs-MoR deletes in one mechanism.
- Small files are the lakehouse disease: scheduled compaction + snapshot expiration + bigger writes are mandatory hygiene, not optimizations.
- Schema evolves by column ID (add, don't repurpose), and the same files serve every engine — the exit ramp is real because the format is the contract.

*Next up — Part 10: Streaming Foundations with Kafka.*
