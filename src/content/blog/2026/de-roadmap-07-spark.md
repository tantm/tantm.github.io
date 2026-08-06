---
title: "Apache Spark: When Pandas Isn't Enough"
description: 'Driver and executors, lazy DAGs, and the shuffle — the one concept that explains every slow Spark job — plus the honest gate: most teams reaching for Spark don''t need it.'
date: 2026-08-02
category: Data
tags: [de-roadmap, spark, big-data]
lang: en
translationKey: de-roadmap-07
series: de-roadmap
part: 7
---

Part 3's escalation path ended with "Spark only when data genuinely exceeds one machine." You're here because it does — or because your company already runs it and you must be fluent. Either way, Spark rewards one thing above all: understanding **where the network is in your query**. That's the shuffle, and it's 80% of Spark performance work.

## What you'll learn

- Apply the honest gate: when Spark earns its complexity and when it doesn't.
- Name the cast (driver, executors, partitions) and what each one can ruin.
- Explain lazy evaluation, and why your stack trace points at the wrong line.
- Spot a shuffle in a query, and apply the four rules that fix most slow jobs.

**Prerequisites:** Part 3 (the pandas-to-Spark escalation ladder) and Part 5 (partitions).

## 1. The gate, restated honestly

One machine with DuckDB now handles hundreds of GB (S07-P08). The Spark-shaped problems are: **working sets in the terabytes**, pipelines that must scale elastically with data growth, or an organization already standardized on it (a legitimate reason — fluency beats contrarianism at work). If your CSV is 20 GB, close this tab and re-read P03. Still here? Good — the mental model.

## 2. The cast: one driver, many executors

Your PySpark script runs on the **driver** — the coordinator that builds the plan. The data never visits the driver (a detail with teeth — see `collect()` below); it lives partitioned across **executors**, each a JVM process (CS-P5!) on a cluster node, each holding a slice of every DataFrame:

```text
driver (your script, the plan)
  ├── executor 1: partitions 0..49    ← each partition = one unit of parallel work
  ├── executor 2: partitions 50..99
  └── executor 3: partitions 100..149
```

A **DataFrame** in Spark looks like pandas but *is* a recipe over distributed partitions. Which brings us to the twist newcomers hit in hour one.

## 3. Lazy evaluation: nothing happens until an action

```python
df = spark.read.parquet("s3://my-lake/orders/")        # nothing read yet
big = df.filter(df.amount > 100)                        # nothing filtered yet
agg = big.groupBy("country").sum("amount")              # still nothing
agg.write.parquet("s3://my-lake/gold/by_country/")      # NOW everything runs
```

**Transformations** (filter, select, join, groupBy) only build a plan — a DAG, the same shape Airflow schedules (P08) and dbt refs (P06), here at query granularity. **Actions** (write, count, collect, show) trigger execution. Why lazy is a gift: Spark sees the *whole* plan before running it, so it can push filters down into the Parquet scan, prune unread columns, and reorder work — your naive script gets an optimizer pass for free (CS-P7's "declarative wins" lesson, at cluster scale).

The two lazy-related scars: debugging is weird because errors surface at the action, not the line that caused them (add a `.count()` while developing to force evaluation early), and `collect()` pulls the *entire* DataFrame onto the driver — the classic OOM (CS-P5) that kills the job at the finish line. Use `show()`, `limit()`, or write to storage instead.

## 4. The shuffle: where the network enters your query

Some transformations are **narrow**: each output partition needs only its own input partition — filter, select, per-row math. They're nearly free; executors work independently.

Some are **wide**: to group all rows by `country`, every row with `country = VN` must reach the *same* partition — which means executors must **exchange data across the network**. That exchange is the **shuffle**: serialize, send, spill to disk, receive, merge. Recall CS-P2's latency table — you just moved your working set from RAM-speed to network-speed, possibly several times.

`groupBy`, `join`, `distinct`, `repartition`, window-over-partition — all shuffles. **Every mysteriously slow Spark job is a shuffle story**: too much data shuffled, too many shuffle rounds, or one partition receiving far more than its share. That last one has a name.

## 5. The four performance rules that matter

1. **Filter and project early.** Cut rows and columns *before* wide operations — less data shuffled beats any tuning. Lazy evaluation often does this for you (predicate pushdown), but only if filters are expressible — the sargability instinct from SQL applies.
2. **Broadcast the small side of a join.** Joining a 2 TB fact to a 50 MB dimension? Ship the dimension *whole* to every executor and skip shuffling the fact entirely — `broadcast(dim)`. This is CS-P3's build-an-index-then-probe, at cluster scale, and the single highest-value Spark trick.
3. **Watch for skew.** One giant key (the "celebrity customer" — DynamoDB's hot partition, S04-P06, same disease) makes one task run for hours while 199 finish in minutes. The Spark UI shows it as one straggler task; modern Spark's adaptive execution (AQE) auto-splits many cases — know it exists before hand-rolling salting.
4. **Right-size partitions.** Aim for partitions in the low hundreds of MB: thousands of tiny partitions drown in scheduling overhead; a few giant ones can't parallelize or fit in memory. `repartition`/`coalesce` are the knobs; the small-files problem in your lake (P05's partitioning) starts here too.

And the meta-rule: **open the Spark UI before touching any knob** — the stages/tasks view shows exactly which shuffle is eating your evening. Measure first (Part 4's law, cluster edition).

## 6. Where it runs, in practice

You'll almost never operate raw clusters: managed Spark (EMR/Glue/Databricks-class platforms) provisions executors for you, and S07-P12's pricing wisdom applies directly — spot instances for retry-safe batch (idempotent jobs again), auto-termination on idle, cluster size scaled to the *shuffle*, not the storage. Everything you wrote in P03–P06 (idempotent runs, watermarks, layers) transfers unchanged; Spark is a bigger engine under the same pipeline discipline.

## Practice (25 minutes — see lazy evaluation and the shuffle, locally)

Install PySpark (`pip install pyspark`) and run this on your laptop — local mode uses threads as executors, and every lesson below is visible without a cluster:

```python
from pyspark.sql import SparkSession, functions as F
spark = SparkSession.builder.master("local[4]").appName("lab").getOrCreate()
spark.sparkContext.setLogLevel("ERROR")

df = spark.range(0, 5_000_000).withColumn("customer", F.col("id") % 1000) \
                              .withColumn("amount", (F.col("id") % 97) * 1.5)

# 1. LAZY: none of this computes anything. Notice how fast "slow work" is.
import time
t = time.perf_counter()
q = df.filter(F.col("amount") > 50).groupBy("customer").agg(F.sum("amount").alias("total"))
print(f"defining the query took {time.perf_counter()-t:.4f}s   ← nothing ran yet")

t = time.perf_counter(); q.count()      # an ACTION — now the whole plan executes
print(f"the action took {time.perf_counter()-t:.2f}s   ← this is where your job actually ran")

# 2. Find the shuffle in the plan — look for "Exchange"
q.explain()          # groupBy forces an Exchange: rows must MOVE across partitions

# 3. Filter early vs filter late: same result, different work
a = df.groupBy("customer").agg(F.sum("amount")).filter(F.col("sum(amount)") > 1000)
b = df.filter(F.col("amount") > 50).groupBy("customer").agg(F.sum("amount"))
for name, plan in (("filter AFTER group", a), ("filter BEFORE group", b)):
    t = time.perf_counter(); plan.count(); print(f"{name}: {time.perf_counter()-t:.2f}s")

# 4. Skew: one key holding a huge share of rows poisons one task
skewed = df.withColumn("k", F.when(F.col("id") % 100 < 95, F.lit("hot")).otherwise(F.col("customer")))
print("rows per key (top 3):")
skewed.groupBy("k").count().orderBy(F.desc("count")).show(3)   # 'hot' has ~95% of everything

# 5. Broadcast join: small table goes to the data, instead of data moving
small = spark.range(0, 1000).withColumnRenamed("id", "customer").withColumn("tier", F.lit("gold"))
df.join(F.broadcast(small), "customer").explain()   # BroadcastHashJoin — no Exchange for the small side
spark.stop()
```

Expected results: defining the query takes microseconds while the action takes seconds — that gap *is* lazy evaluation, and it's why a stack trace blames the `count()` line rather than the transformation that actually broke. In step 2, `Exchange` in the plan is the shuffle: the moment rows cross the network. Step 3 usually shows filtering early winning, because less data reaches the shuffle. Step 4 makes skew concrete — one key holding 95% of rows means one task does 95% of the work while the rest of the cluster idles. Step 5 shows `BroadcastHashJoin` replacing an exchange on the small side: the small table travelled instead of the big one.

## Check yourself

1. Your Spark job fails with a NullPointerException on line 82, which is `df.write.parquet(...)`. Why is line 82 probably not the bug, and how do you find the real one?
2. A job that ran in 6 minutes now takes 50, and the Spark UI shows 199 tasks finished in seconds while 1 task ran for 45 minutes. What's the diagnosis and what do you try?
3. When would you deliberately *not* use Spark for a 200 GB dataset?

<details><summary>See answers</summary>

1. Because transformations are lazy: nothing executes until an action, so the write is simply where the accumulated plan finally ran. The bug lives in an earlier transformation. Find it by narrowing — run an action on progressively earlier stages (`.count()` after each transformation), or inspect the plan, until the failure appears.
2. Data skew: one partition holds far more rows than the others, so one task does nearly all the work while the cluster idles. Try enabling adaptive query execution for skew handling, salting the hot key to spread it across partitions, or broadcasting the smaller side to avoid the skewed shuffle entirely.
3. When it fits comfortably in one large machine's memory and disk — 200 GB is well within reach of a single big instance running DuckDB or Polars, which will often be faster and dramatically simpler than a cluster. Choose Spark when the data genuinely exceeds one machine, or when your organization's platform and skills are already built around it.

</details>

## Key takeaways

- The gate is real: terabyte working sets or organizational standardization — otherwise P03's single-node path wins.
- Model: driver plans, executors hold partitions, transformations are lazy recipes, actions execute — and `collect()` is the driver-OOM classic.
- The shuffle is the whole performance story: filter early, broadcast small join sides, hunt skew stragglers, right-size partitions — in the Spark UI, not by folklore.
- Spark changes the engine, not the discipline: idempotent runs, watermarks, and medallion layers apply exactly as before.

*Next up — Part 8: Orchestration with Airflow: DAGs Done Right.*
