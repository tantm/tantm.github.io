---
title: 'Orchestration with Airflow: DAGs Done Right'
description: 'What an orchestrator actually owns, the data interval as a contract, and the three classic Airflow mistakes — including the top-level code trap everyone falls into once.'
date: 2026-08-03
category: Data
tags: [de-roadmap, airflow, orchestration]
lang: en
translationKey: de-roadmap-08
series: de-roadmap
part: 8
---

Everything so far runs *when you run it*. Production data engineering runs at 3 a.m., unattended, in the right order, with retries — and that's an **orchestrator's** job. Airflow is the incumbent (its concepts transfer to Dagster/Prefect and friends), and using it well comes down to one sentence: **the orchestrator owns the clock, the order, and the visibility — your jobs own the logic.** Blur that line and you get the classic messes; keep it and P03–P06's discipline clicks into place.

## What the orchestrator owns

Four things, no more: **scheduling** (cron-like, but data-aware — below), **dependencies** (the DAG: extract → transform → test, expressed as a graph, CS-P3's topological sort as a product), **retries and alerting** (P06's transient bin, automated), and **visibility** (one UI answering "what ran, what failed, what's late" — which is most of what on-call needs).

Note what's absent: business logic. The orchestrator is a *conductor*, not a musician.

## Anatomy of an honest DAG

```python
from airflow.decorators import dag, task
import pendulum

@dag(
    schedule="@daily",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    default_args={"retries": 2, "retry_delay": pendulum.duration(minutes=5)},
)
def orders_pipeline():
    @task
    def extract(data_interval_start=None, data_interval_end=None):
        # The interval IS the contract: this run owns exactly this slice.
        run_extract(start=data_interval_start, end=data_interval_end)

    @task
    def load_silver():   ...
    @task
    def run_quality():   ...

    extract() >> load_silver() >> run_quality()

orders_pipeline()
```

The load-bearing concept is the **data interval**: each run is *for* a window of data, passed in as parameters. That's P03's `--run-date` and P06's watermark, institutionalized — the Monday 3 a.m. run processes Sunday's slice, and re-running it later processes *the same slice* (idempotency's best friend). Misunderstand this and you get the eternal Airflow confusion of "why did my daily run process yesterday?" — it didn't; it processed *its interval*, exactly as designed.

## The three classic mistakes

**1. Logic in the DAG file.** The scheduler *imports* every DAG file every ~30 seconds to see the graph's shape. Any top-level code — a database query to "dynamically build tasks", an API call, reading a big config — runs on **every parse**, hammering systems and slowing the scheduler to a crawl. The rule: the DAG file *declares* structure; work happens inside tasks (or better, inside the P03-style scripts and dbt models that tasks *invoke*). If your DAG file needs more than imports and wiring, something's in the wrong layer.

**2. Non-idempotent tasks.** Retries are the orchestrator's superpower — and a retry of a task that appends (P06's doubled-numbers) turns the safety net into the incident. Every task must pass the run-twice test *because the orchestrator will run it twice* — on retries, on backfills, on the nervous human clicking "clear".

**3. The monolithic task.** One task that extracts, transforms, and loads means one failure retries *everything* (hammering the source again to redo a transform bug) and the UI shows one opaque box. Split at the natural seams — the places where a retry should resume, which are exactly P05's layer boundaries. Granularity heuristic: **a task is a unit of retry**, not a unit of code organization.

## Waiting: sensors, done carefully

Pipelines wait for things: the partner's file, the upstream DAG, the table's partition. **Sensors** are tasks that wait — and naïvely, each occupies a worker slot while doing nothing (CS-P2's "waiting" as a resource leak; a dozen sensors can starve your actual work). Modern Airflow's answer is **deferrable operators** — the sensor parks off-worker until the condition fires (async/await's exact trick, CS-P8, in orchestrator clothes). The design alternatives worth preferring when possible: data-aware scheduling (Datasets/assets — downstream DAG triggers *when the table updates*, not on a guessed clock) and event-driven kicks from S3/queues. Poll less, react more.

## Backfill: where the design pays off

P06 made backfill a designed operation; Airflow makes it a command:

```bash
airflow dags backfill orders_pipeline -s 2026-05-01 -e 2026-05-31
```

Thirty-one runs, each with its own interval, bounded parallelism (`max_active_runs`), same code path as production. This only works because of everything above — interval-parameterized, idempotent, granular tasks. Teams that skipped those disciplines discover backfill as an archaeology expedition instead. (Set `catchup=False` on new DAGs unless you *want* history auto-backfilled on deploy — the accidental thousand-run catchup is a rite of passage best skipped.)

## Operating it like an adult

- **Alert on the right bin** (P06's taxonomy): transient failures retry silently; final failures page with the task and interval; *SLA misses* ("daily gold not ready by 7 a.m.") page the on-call because the business notices lateness before wrongness.
- **The scheduler is production infrastructure** — managed offerings (MWAA/Composer/Astronomer-class) trade S07-P12 dollars for not carrying CS-P5 pager duty on a scheduler; usually worth it below platform-team scale.
- **dbt inside Airflow**: the pragmatic pattern is Airflow running EL tasks then triggering dbt (P06's division of labor); tooling that renders each dbt model as its own Airflow task (Cosmos-class) gives model-level retries and visibility — nice, not mandatory.

## Key takeaways

- The orchestrator owns clock, order, retries, visibility; your jobs own logic — the DAG file only declares structure (top-level code runs every 30 s, forever).
- The data interval is the contract: each run owns its slice, making retries, reruns, and backfills the same safe operation.
- A task is a unit of retry: split at layer seams, keep every task idempotent, and prefer data-aware/event-driven triggers over polling sensors.
- Backfill-by-command is the reward for P03–P06 discipline; alert on taxonomy bins and SLA misses, not on every red square.

*Next up — Part 9: Data Lake & Lakehouse: Parquet, Iceberg, Delta.*
