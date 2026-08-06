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

## What you'll learn

- State the four things an orchestrator owns — and the ones it doesn't.
- Write a DAG whose runs are parameterized, idempotent, and re-runnable by date.
- Avoid the three classic mistakes that make Airflow look slow or flaky.
- Turn a backfill into one command instead of a weekend.

**Prerequisites:** Part 3 (idempotent jobs, exit codes) and Part 6 (watermarks, backfill as a designed operation).

## 1. What the orchestrator owns

Four things, no more: **scheduling** (cron-like, but data-aware — below), **dependencies** (the DAG: extract → transform → test, expressed as a graph, CS-P3's topological sort as a product), **retries and alerting** (P06's transient bin, automated), and **visibility** (one UI answering "what ran, what failed, what's late" — which is most of what on-call needs).

Note what's absent: business logic. The orchestrator is a *conductor*, not a musician.

## 2. Anatomy of an honest DAG

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

## 3. The three classic mistakes

**1. Logic in the DAG file.** The scheduler *imports* every DAG file every ~30 seconds to see the graph's shape. Any top-level code — a database query to "dynamically build tasks", an API call, reading a big config — runs on **every parse**, hammering systems and slowing the scheduler to a crawl. The rule: the DAG file *declares* structure; work happens inside tasks (or better, inside the P03-style scripts and dbt models that tasks *invoke*). If your DAG file needs more than imports and wiring, something's in the wrong layer.

**2. Non-idempotent tasks.** Retries are the orchestrator's superpower — and a retry of a task that appends (P06's doubled-numbers) turns the safety net into the incident. Every task must pass the run-twice test *because the orchestrator will run it twice* — on retries, on backfills, on the nervous human clicking "clear".

**3. The monolithic task.** One task that extracts, transforms, and loads means one failure retries *everything* (hammering the source again to redo a transform bug) and the UI shows one opaque box. Split at the natural seams — the places where a retry should resume, which are exactly P05's layer boundaries. Granularity heuristic: **a task is a unit of retry**, not a unit of code organization.

## 4. Waiting: sensors, done carefully

Pipelines wait for things: the partner's file, the upstream DAG, the table's partition. **Sensors** are tasks that wait — and naïvely, each occupies a worker slot while doing nothing (CS-P2's "waiting" as a resource leak; a dozen sensors can starve your actual work). Modern Airflow's answer is **deferrable operators** — the sensor parks off-worker until the condition fires (async/await's exact trick, CS-P8, in orchestrator clothes). The design alternatives worth preferring when possible: data-aware scheduling (Datasets/assets — downstream DAG triggers *when the table updates*, not on a guessed clock) and event-driven kicks from S3/queues. Poll less, react more.

## 5. Backfill: where the design pays off

P06 made backfill a designed operation; Airflow makes it a command:

```bash
airflow dags backfill orders_pipeline -s 2026-05-01 -e 2026-05-31
```

Thirty-one runs, each with its own interval, bounded parallelism (`max_active_runs`), same code path as production. This only works because of everything above — interval-parameterized, idempotent, granular tasks. Teams that skipped those disciplines discover backfill as an archaeology expedition instead. (Set `catchup=False` on new DAGs unless you *want* history auto-backfilled on deploy — the accidental thousand-run catchup is a rite of passage best skipped.)

## 6. Operating it like an adult

- **Alert on the right bin** (P06's taxonomy): transient failures retry silently; final failures page with the task and interval; *SLA misses* ("daily gold not ready by 7 a.m.") page the on-call because the business notices lateness before wrongness.
- **The scheduler is production infrastructure** — managed offerings (MWAA/Composer/Astronomer-class) trade S07-P12 dollars for not carrying CS-P5 pager duty on a scheduler; usually worth it below platform-team scale.
- **dbt inside Airflow**: the pragmatic pattern is Airflow running EL tasks then triggering dbt (P06's division of labor); tooling that renders each dbt model as its own Airflow task (Cosmos-class) gives model-level retries and visibility — nice, not mandatory.

## Practice (25 minutes — run a real scheduler locally and re-run one day)

Airflow runs on your laptop in standalone mode. The goal isn't to learn the UI; it's to *feel* what "a run owns its date" means.

```bash
pip install "apache-airflow==2.*"
export AIRFLOW_HOME=~/airflow-lab
airflow standalone &          # prints an admin password on first start; UI at localhost:8080
mkdir -p $AIRFLOW_HOME/dags

cat > $AIRFLOW_HOME/dags/orders_lab.py <<'EOF'
from airflow.decorators import dag, task
from datetime import datetime
import pendulum, pathlib

@dag(schedule="@daily", start_date=pendulum.datetime(2026, 3, 1, tz="UTC"),
     catchup=False, max_active_runs=3, tags=["lab"])
def orders_lab():

    @task
    def extract(ds=None):                       # ds = the run's DATA INTERVAL date
        out = pathlib.Path(f"/tmp/lab/raw_{ds}.txt")
        out.parent.mkdir(exist_ok=True)
        out.write_text(f"rows for {ds}\n")      # idempotent: same date → same file, overwritten
        return str(out)

    @task
    def transform(path: str, ds=None):
        rows = pathlib.Path(path).read_text()
        pathlib.Path(f"/tmp/lab/clean_{ds}.txt").write_text(rows.upper())
        return f"processed {ds}"

    transform(extract())

orders_lab()
EOF
```

Then, in the UI or the CLI: unpause the DAG, trigger it once, and look at `/tmp/lab/` — files named by date. Now the part that matters:

```bash
# Re-run a single past day. One command, no special code path.
airflow dags backfill orders_lab -s 2026-03-02 -e 2026-03-04
ls -la /tmp/lab/                # one raw + one clean file per date, nothing doubled

# Run it again — idempotency means the second run changes nothing
airflow dags backfill orders_lab -s 2026-03-02 -e 2026-03-04
ls -la /tmp/lab/                # same file count, same contents
```

Expected results: each run produces files stamped with *its own* date rather than today's, which is what makes the backfill command work at all. Running the same backfill twice leaves the directory identical — that's idempotency, and it's the property that lets you re-run without thinking. Note what you did *not* write: no loop over dates, no "backfill mode" flag, no separate script. The design from Part 3 (parameterize by run date) is what turned a weekend into one command; the orchestrator just supplies the dates and the retries.

## Check yourself

1. Your DAG file queries a database at the top level to build its task list. Everything works, but the scheduler is slow and the database shows constant load. What's wrong?
2. A task processes "the last 24 hours" using `datetime.now()`. Why can this DAG never be backfilled correctly?
3. One DAG has a single task that extracts, transforms and loads. It fails during load. What did the design cost you, and how would you restructure it?

<details><summary>See answers</summary>

1. Top-level code in a DAG file runs every time the scheduler parses the file — every few seconds, forever, for every DAG. That query is being executed constantly, not once per run. Move it inside a task, where it runs only when the run actually executes.
2. Because `now()` means "when the code happens to run", not "the period this run represents". A backfill of March 2nd executed in June would process June's data and write it into March's partition. Use the run's data-interval date the orchestrator provides, so a run's output depends only on its parameters.
3. The task is the unit of retry, so a failure during load re-runs the extract and transform too — wasted work at best, and duplicated side effects if any step isn't idempotent. Restructure into separate extract, transform and load tasks so a retry resumes at the failed step, and each step can be re-run independently.

</details>

## Key takeaways

- The orchestrator owns clock, order, retries, visibility; your jobs own logic — the DAG file only declares structure (top-level code runs every 30 s, forever).
- The data interval is the contract: each run owns its slice, making retries, reruns, and backfills the same safe operation.
- A task is a unit of retry: split at layer seams, keep every task idempotent, and prefer data-aware/event-driven triggers over polling sensors.
- Backfill-by-command is the reward for P03–P06 discipline; alert on taxonomy bins and SLA misses, not on every red square.

*Next up — Part 9: Data Lake & Lakehouse: Parquet, Iceberg, Delta.*
