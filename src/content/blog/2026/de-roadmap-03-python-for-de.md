---
title: 'Python for Data Engineers: the Working Toolkit'
description: 'Not "learn Python" — learn the six habits that make pipeline code trustworthy: environments that pin, scripts that re-run safely, types at the borders, and the pandas-to-Arrow escalation path.'
date: 2026-07-29
category: Data
tags: [de-roadmap, python, data-engineer]
lang: en
translationKey: de-roadmap-03
series: de-roadmap
part: 3
---

You already know Python — the syntax, anyway. This part is about the gap between "I can write a script" and "my script has run nightly for a year and nobody thinks about it." Data engineering Python is a *dialect*: fewer clever abstractions, more paranoia about re-runs, environments, and the borders where data enters.

## Habit 1 — Environments that pin, or it didn't happen

The oldest pipeline failure in the book: works on your laptop, dies on the scheduler, because two machines resolved "pandas" to two different versions. The cure is mechanical:

```bash
uv init my-pipeline && cd my-pipeline
uv add pandas pyarrow
# → pyproject.toml (what you want) + uv.lock (exactly what everyone gets)
uv run python pipeline.py
```

The tool matters less than the contract (uv is today's fast default; the venv+pip ritual is fine too): **dependencies declared in a file, versions locked, environment rebuilt from the lock — never "pip install into whatever's there."** Your scheduler and your laptop must build the same world from the same lockfile, or Part 2's "works on my machine" mystery becomes your Tuesday.

## Habit 2 — Idempotency: the re-run test

We've chanted the word since S02-P01; here is what it means in Python. Ask of every job: **if this runs twice, what happens?** Pipelines *will* re-run — retries, backfills, a nervous human at 2 a.m.

```python
# Appends: two runs = doubled rows. FAILS the test.
df.to_sql("daily_sales", conn, if_exists="append")

# Overwrite the partition this run owns: two runs = same result. PASSES.
(pq.write_to_dataset(table, "sales", partition_cols=["day"],
                     existing_data_behavior="delete_matching"))
```

The general pattern: **a run owns a well-defined slice** (usually a date partition), writes it atomically (write temp → swap), and derives everything from its parameters — no `datetime.now()` buried in transform logic ("today's" run rerun tomorrow must produce *the same* output; the run date is a parameter, not a discovery).

## Habit 3 — Parameterized CLI, not editable constants

The scheduler needs to call your script; a human needs to backfill Tuesday. Both are the same interface:

```python
import argparse, sys, logging

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--run-date", required=True)   # the slice this run owns
    p.add_argument("--source", default="orders")
    args = p.parse_args()
    logging.basicConfig(level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s")
    ...
    return 0                                      # non-zero = scheduler retries

if __name__ == "__main__":
    sys.exit(main())
```

Small, boring, and it encodes three contracts at once: parameters over edited constants, logs over prints (your 2 a.m. self reads timestamps), and **exit codes over silent failure** — a pipeline that swallows exceptions and exits 0 is lying to its orchestrator, and Part 8 (Airflow) will believe the lie.

## Habit 4 — Types at the borders

Deep type-theory isn't required; **annotated borders** are. Data enters your code from CSVs, APIs, and other people's tables — the borders are where lies come in:

```python
from dataclasses import dataclass

@dataclass
class OrderRow:
    order_id: str
    amount_cents: int      # not float — money arithmetic, Part 7 of SQL Mastery nods
    country: str

def parse_row(raw: dict) -> OrderRow:
    return OrderRow(order_id=str(raw["order_id"]),
                    amount_cents=int(raw["amount_cents"]),
                    country=raw.get("country", "unknown"))
```

Parse once at the edge into a typed shape; everything downstream trusts it. This is the code-level twin of schema-on-write (S07-P03), and `mypy` in CI turns the annotations from documentation into a tripwire. For heavier validation needs, the pydantic/pandera family industrializes this same idea — start with dataclasses, escalate when the borders get hostile.

## Habit 5 — The pandas → Arrow → engine escalation path

pandas is the daily driver; know where its floor creaks:

- **Memory:** a DataFrame wants ~5–10× its CSV size in RAM. A 5 GB file on a 16 GB scheduler node is already an incident.
- **Types:** silent `int` → `float` upcasts when NaN appears, `object` columns hiding mixed types — border typing (Habit 4) is your defense.

The modern escalation path, in order: **pandas** (fits in RAM, exploratory) → **pyarrow / Parquet** (columnar interchange — this is why every file in S07 was Parquet) → **a single-node engine** (DuckDB querying Parquet directly, often replacing a whole "we need Spark" conversation — S07-P08's thesis) → **Spark** only when data genuinely exceeds one machine (S02-P07 ahead). Each step is a deliberate graduation, not a default.

```python
import duckdb
# SQL over Parquet, no cluster, larger-than-RAM capable:
duckdb.sql("SELECT country, SUM(amount_cents) FROM 'sales/*.parquet' GROUP BY 1")
```

## Habit 6 — Tests that pay rent

Skip the coverage theater. Two kinds of tests earn their keep in pipelines: **transform logic on tiny fixture data** (5 rows, hand-computable answer) and **the ugly-input cases** you've already been burned by (empty file, duplicate keys, the timezone that shifted):

```python
def test_daily_totals_dedupes():
    rows = [order(id="a", amount=100), order(id="a", amount=100)]  # dupe
    assert daily_totals(rows)["total_cents"] == 100
```

Every production incident should leave a fixture behind — that's how pipeline test suites grow teeth instead of weight. (Data-quality checks on *real* data are a different layer — dbt tests and S02-P12's territory.)

## Key takeaways

- Lock your environments; the scheduler and your laptop must build the same world from the same file.
- Idempotency is a test you can run: twice = same result; a run owns its slice and takes the date as a parameter.
- Scripts are CLIs with logs and exit codes — silent success-faking is how orchestrators get lied to.
- Type the borders, then trust the inside; escalate pandas → Arrow → DuckDB → Spark deliberately, not by fashion.

*Next up — Part 4: Data Modeling: OLTP vs OLAP, Star Schema.*
