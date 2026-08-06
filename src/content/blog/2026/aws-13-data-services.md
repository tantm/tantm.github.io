---
title: 'AWS for Data: Glue, Athena, Kinesis, Redshift'
description: 'The data-service map in one diagram, every S02 concept matched to its AWS name, the serverless lake pattern, and the per-TB-scanned bill that redesigns your tables.'
date: 2026-08-04
category: Cloud
tags: [aws, data-engineer, glue, athena]
lang: en
translationKey: aws-13
series: aws-zero-to-advanced
part: 13
---

If you've read the Data Engineer Roadmap (S02), this part is a *translation table*: every concept you already own has an AWS product name, a pricing model, and a couple of traps. If you came from the AWS side, it's the reverse map — and S02 is where each idea gets its full treatment. Either way, the architecture is one picture, and it's the S02-P09 lakehouse wearing AWS name tags.

## What you'll learn

- Map the AWS data services onto the concepts you already know from a data engineering perspective.
- Use the translation table so a new service name stops being a new concept.
- Predict how pay-per-scan pricing reshapes your table layout.
- Assemble the serverless lake pattern, and know what upgrading it means.

**Prerequisites:** Part 4 (S3) and Part 2 (IAM). A working knowledge of pipelines helps but the translation table stands alone.

## 1. The map

```mermaid
flowchart LR
  SRC[Sources] -->|"batch: Glue jobs / DMS"| S3[(S3 data lake<br/>Parquet + table format — P04, S02-P09)]
  SRC -->|"streaming: Kinesis /<br/>MSK (Kafka)"| S3
  S3 --> CAT["Glue Data Catalog<br/>(the metastore — S02-P13's phone book)"]
  CAT --> A["Athena<br/>(serverless SQL — pay per TB scanned)"]
  CAT --> EMR["EMR / Glue Spark<br/>(heavy transforms — S02-P07)"]
  CAT --> RS["Redshift<br/>(the warehouse — S02-P05's gold)"]
  MWAA["MWAA (managed Airflow — S02-P08)"] -.->|orchestrates| S3
```

The load-bearing box is the least glamorous one: the **Glue Data Catalog** is the shared metastore — table definitions over S3 files — that lets Athena, Spark, and Redshift all read *the same tables*. That's S02-P09's "format is the contract" made concrete: the engines are interchangeable because the catalog isn't.

## 2. The translation table

- **Kinesis ↔ Kafka (S02-P10)**: same log model — shards are partitions, iterator age is consumer lag, resharding is the partition-count pain. Kinesis is the low-ops native choice; **MSK** is managed Kafka when you want the ecosystem. The decision is S02-P10's "managed-first" applied twice.
- **Glue jobs ↔ Spark (S02-P07)**: serverless Spark — no cluster to keep alive, priced per DPU-hour. Everything from P07 transfers (shuffles, skew, partition sizing); the trap that's new is *cold starts and minimum billing* making tiny frequent jobs disproportionately expensive — batch them (the S04-P09 instinct).
- **Athena ↔ DuckDB/Trino (S07-P08)**: serverless interactive SQL over the lake. Its pricing *is* its design pressure — see below.
- **Redshift ↔ the warehouse (S02-P05)**: columnar MPP for the gold layer and BI concurrency. The honest 2026 guidance: start with Athena over open table formats; adopt Redshift when BI concurrency and modeled-workload performance demand it — not as step one. The lakehouse *is* the default now; the warehouse is an optimization.
- **MWAA ↔ Airflow (S02-P08)**: managed scheduling, the S02-P08 "scheduler is production infrastructure" argument resolved with a checkbook.

## 3. The bill that redesigns your tables

Athena's pricing — **dollars per TB scanned** — is the single best teacher of S02's storage lessons, because every mistake becomes a line item: store CSV instead of Parquet and you scan 10× more (S02-P09's columnar math, invoiced); skip partitioning and every query full-scans history (S02-P07's pruning, invoiced); let small files accumulate and you pay S3 request overhead on top (S02-P09's disease, invoiced). The fixes are exactly the S02 curriculum — Parquet, partition by the common filter, compact regularly — and the feedback loop is beautifully short: fix the layout, watch the per-query cost drop 10–100×. Set a **per-workgroup scan limit** the day you create the workgroup: one `SELECT *` over five years of history is the classic first-week-of-Athena bill story, and the limit turns it into an error message instead (S04-P02's billing-alarm instinct, query edition).

## 4. The serverless lake pattern

The reference architecture for a small team — each piece from this series, no servers anywhere:

S3 landing (P04 lifecycle rules on raw) → S3-event or schedule kicks a **Glue job** (P07 serverless, or plain Lambda for small files — S04-P07) writing Parquet into a table format → **catalog** updated → **Athena** serves analysts and dashboards; **MWAA** (or Step Functions for simple chains) orchestrates; quality checks (S02-P12) run as tasks in the same DAG. This stack's virtue is S04-P07's economics: at low volume it costs almost nothing and *scales to zero*; its ceiling is when Spark jobs need tuning beyond what Glue exposes (→ EMR) or BI concurrency outgrows Athena (→ Redshift). Both migrations are cheap *because the data never moves* — same S3 files, same catalog, different engine. That's the S07-P03 exit-ramp property, and it's the whole reason to insist on open formats from day one.

Two closing bridges. **Security is unchanged**: bucket policies + least-privilege roles per job (P02), CMKs on sensitive prefixes (P12), Lake Formation-tier fine-grained access when column-level control matters (S02-P13's masking, AWS edition). And **so is ops**: every Glue job and Kinesis consumer follows the S04-P10 rules — structured logs, alarm on iterator age (that's consumer lag), and a data SLA freshness alarm on the gold tables, because a data platform that's green-but-stale fails S02-P12's trust test all the same.

## Practice (25 minutes — watch table layout change the bill)

Pay-per-scan pricing is the one thing in this part that genuinely changes how you design tables, and you can measure it locally before spending a cent. DuckDB reads the same Parquet layouts that a scan-priced engine would:

```sql
-- duckdb scan.db
CREATE TABLE events AS
SELECT DATE '2026-01-01' + (i % 365)          AS event_date,
       (i % 7)                                AS channel,
       (i % 100000)                           AS customer_id,
       repeat('x', 200)                       AS payload,       -- a wide column nobody queries
       ((i * 17) % 10000) / 100.0             AS amount
FROM range(4000000) t(i);

-- LAYOUT A: one flat file, no partitioning
COPY events TO 'flat.parquet' (FORMAT PARQUET);

-- LAYOUT B: partitioned by the column people filter on
COPY events TO 'by_date' (FORMAT PARQUET, PARTITION_BY (event_date));

-- LAYOUT C: partitioned AND without the wide column analysts never read
COPY (SELECT event_date, channel, customer_id, amount FROM events)
  TO 'narrow' (FORMAT PARQUET, PARTITION_BY (event_date));
```

```bash
# The bill, approximated: in a scan-priced engine you pay for BYTES READ
du -sh flat.parquet by_date narrow
# then compare what a single day's query has to touch in each layout:
du -sh by_date/event_date=2026-06-15 narrow/event_date=2026-06-15
```

```sql
-- Same question, three layouts — note how much data each one must read
.timer on
SELECT sum(amount) FROM 'flat.parquet'          WHERE event_date = DATE '2026-06-15';
SELECT sum(amount) FROM 'by_date/*/*.parquet'   WHERE event_date = DATE '2026-06-15';
SELECT sum(amount) FROM 'narrow/*/*.parquet'    WHERE event_date = DATE '2026-06-15';
```

Expected results: the flat file has to open everything to answer a one-day question, while the partitioned layout touches a single directory — that difference *is* the invoice under pay-per-scan pricing, not merely a speed improvement. The narrow layout shows the second lever: dropping a wide column nobody queries shrinks every scan forever, and columnar formats let a query skip it anyway, so the two compound. Run `du -sh` on the single-day directories and you have the number to put in a design discussion: this layout costs N times that one, per query, every day.

## Check yourself

1. Your team's query bill is high and everyone blames "too many analysts". What do you check first?
2. Why does pay-per-scan pricing make table design a cost decision rather than a performance one?
3. A colleague proposes moving from the serverless lake to a dedicated warehouse cluster. What question decides it?

<details><summary>See answers</summary>

1. Table layout — specifically partitioning and file sizes. Scan-priced engines bill by bytes read, so an unpartitioned table means every query reads everything regardless of the `WHERE` clause. The same analysts on a well-partitioned table can cost an order of magnitude less, and that's a platform fix rather than a people problem.
2. Because the pricing model converts a physical layout decision directly into money: bytes read is the billing unit, and partitioning, column pruning and file size determine bytes read. On a provisioned cluster the same bad layout shows up as slow queries; on scan pricing it shows up on the invoice, which usually gets it fixed faster.
3. Utilization. Serverless scales to zero and bills per query, which wins for spiky or intermittent workloads; a provisioned cluster wins when it stays busy enough that per-query pricing exceeds the fixed cost. Measure current spend against what steady-state capacity would cost — and remember that keeping the data in open formats means this stays an engine swap rather than a migration.

</details>

## Key takeaways

- One diagram, all name tags: Kinesis/MSK are the log, Glue is serverless Spark, Athena is SQL-over-the-lake, Redshift is the warehouse, MWAA is Airflow — and the Glue Catalog is the contract that makes engines interchangeable.
- Athena's per-TB-scanned pricing invoices every storage mistake: Parquet + partitioning + compaction cut query costs 10–100×, and workgroup scan limits turn bill stories into error messages.
- Default to the serverless lake (S3 + Glue + Athena, scales to zero); add EMR or Redshift when tuning or concurrency demands — the data never moves, so the upgrade is an engine swap, not a migration.
- S02 concepts and S04 disciplines compose unchanged: least-privilege per job, CMKs on sensitive data, iterator-age and freshness alarms — green-but-stale still fails the trust test.

*Next up — Part 14: AWS for AI: Bedrock & SageMaker.*
