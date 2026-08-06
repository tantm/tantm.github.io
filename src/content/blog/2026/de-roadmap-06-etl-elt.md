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

Parts 3 and 5 gave you the ingredients — idempotent scripts, layered tables. This part assembles them into the thing you'll actually operate: **a batch pipeline that runs unattended for months**. The ETL-vs-ELT debate takes ten minutes. The craft of extract patterns, load patterns, backfills, and retry semantics takes the rest — and it's what separates pipelines that page you from pipelines that don't.

## What you'll learn

- Settle ETL vs ELT for your case, and name the exceptions where transform-first still wins.
- Write an incremental extract whose watermark survives crashes, edits, and clock skew.
- Pick among the three load patterns, and make every write atomic.
- Sort any pipeline failure into retry / quarantine / fix — so the right ones wake a human.

**Prerequisites:** Part 3 (idempotent jobs, exit codes) and Part 5 (layers, partitions, full-rebuild thinking).

## 1. ETL vs ELT, settled quickly

**ETL** transforms data *before* loading, inside the pipeline tool. **ELT** loads raw first and transforms *inside* the warehouse with SQL — Part 5's bronze-then-silver is exactly this.

ELT won the default for three reasons: warehouse compute got cheap and elastic, raw-first preserves the debugging evidence, and SQL transforms are testable and versionable as models.

The honest exceptions where the T still comes first: PII masking that must happen before data lands (sometimes the law says transform first), heavy unstructured parsing, and shrinking absurdly wide payloads at the edge. Rule: *ELT by default; ETL where compliance or physics demands it.*

## 2. Extract: the watermark is the whole game

Full extracts (copy the entire table nightly) are underrated — self-healing and simple. Keep them as long as size allows. When the table outgrows them you extract **incrementally**, and the entire correctness burden lands on one concept: the **watermark** (a saved marker of how far you got last time).

```python
# The watermark contract:
last = read_watermark("orders")                    # e.g. 2026-07-30T02:00:00
rows = extract(f"updated_at > '{last}' AND updated_at <= '{now}'")  # closed window
load(rows)
write_watermark("orders", now)                     # advance ONLY after load succeeds
```

Three ways this goes wrong, and they are the three classic incidents:

- **Advancing the watermark before the load succeeds.** A crash then loses that window silently — nobody gets an error, the rows are simply never seen again.
- **Using `created_at` when rows get updated.** Edits are never re-extracted. Use `updated_at`, and confirm the source actually maintains it.
- **Clock skew or late commits at the window edge.** Standard fix: overlap the window by a few minutes and let idempotent loads absorb the duplicates.

Notice the theme: a watermark plus an idempotent load gives you an exactly-once *effect* on top of at-least-once machinery.

## 3. Load: three patterns, one decision table

| Pattern | How | When |
|---|---|---|
| **Overwrite partition** | Delete-and-rewrite the slice this run owns | The default for facts (P03's rule: a run owns its date) |
| **Merge / upsert** | Match on business key, update-or-insert | Dimensions, CDC feeds, late-arriving mutable rows |
| **Append-only** | Just add rows | Immutable events *with* dedupe downstream (P05's silver window) |

The anti-pattern is blind append of *mutable* data — the doubled-numbers incident every data team experiences exactly once, loudly.

Whichever pattern you use, make the write **atomic**: stage into a temp table or prefix, then swap. A crash mid-write then leaves the old data intact instead of half of each.

## 4. Backfill: a first-class operation, not an emergency

Every pipeline will need to reprocess history — a bug fixed, a column added, a source corrected. Teams that treat backfill as an emergency improvise it badly at the worst moment. Design it on day one:

- **The same job runs any date.** Because runs are parameterized by `--run-date` and own their partition, a backfill is just a loop over dates — no special code path, so nothing untested.
- **Bounded parallelism.** Backfilling 3 years is about 1,100 independent runs. Run 10 at a time — not 1 (that's weeks) and not 1,100 (that kills the source).
- **Protect the source.** Backfill extracts should read bronze or a replica, never hammer the production database — this is part of why bronze keeps everything.
- **Announce and verify.** Downstream consumers will see numbers move; a row-count and total reconciliation before-versus-after turns "did the backfill work?" from a feeling into evidence.

## 5. Failure taxonomy: what to retry, what to wake a human for

The pipeline's error handling should sort every failure into one of three bins:

1. **Transient** (network blips, storage 503s, lock timeouts) → **retry automatically** with backoff. This is why exit codes and orchestrator retries exist. Most 2 a.m. pages that shouldn't have happened are un-retried transients.
2. **Data failures** (schema drift from the source, a file that doesn't parse, quality gate breach) → **fail fast and loud, don't retry** — retrying a malformed file 5 times just delays the alert. Quarantine the bad input (a `_rejected/` prefix), continue or halt per severity, page with the *filename*.
3. **Logic bugs** (your transform is wrong) → nothing automated saves you. Layer contracts and quality checks exist to *detect* these; the cure is a fix plus a backfill, which section 4 just made routine.

The signature of a mature pipeline isn't that it never fails — it's that each failure lands in the right bin automatically.

## 6. Where dbt sits in all this

dbt owns the **T of ELT**: SQL models with `ref()` dependencies forming the DAG, tests as config, docs generated. It does *not* extract, load, or schedule. The EL is your own jobs or an ingestion tool, and the clock is Part 8's orchestrator, which runs EL, then `dbt run`, then `dbt test` as one dependency chain.

Keeping this division straight — dbt is the transform layer, not the pipeline — prevents both the over-ask (dbt won't fetch your API data) and the under-use (transform logic scattered in Python that should be testable SQL models).

## Practice (25 minutes — break a watermark on purpose, then fix it)

Pure Python and SQLite, no warehouse. You'll reproduce the two most expensive extract bugs and watch the fixes work:

```python
import sqlite3
db = sqlite3.connect(":memory:")
db.executescript('''
CREATE TABLE source(id INTEGER PRIMARY KEY, amount REAL, created_at TEXT, updated_at TEXT);
INSERT INTO source VALUES (1,10,'2026-03-01','2026-03-01'), (2,20,'2026-03-01','2026-03-01');
CREATE TABLE target(id INTEGER PRIMARY KEY, amount REAL, updated_at TEXT);
''')
wm = '2026-01-01'      # the watermark

def extract_load(col, wm, crash_before_load=False):
    now = '2026-03-03'
    rows = db.execute(f"SELECT id,amount,updated_at FROM source "
                      f"WHERE {col} > ? AND {col} <= ?", (wm, now)).fetchall()
    if crash_before_load:
        return now, len(rows)                       # BUG: advanced the watermark, loaded nothing
    db.executemany("INSERT OR REPLACE INTO target VALUES (?,?,?)", rows)   # idempotent load
    return now, len(rows)

# Run 1 — normal
wm, n = extract_load('updated_at', wm); print("run1 loaded", n, "wm →", wm)

# A row is EDITED (not created) after run 1
db.execute("UPDATE source SET amount=99, updated_at='2026-03-02' WHERE id=1")

# BUG A: extracting on created_at misses the edit entirely
_, n = extract_load('created_at', wm); print("created_at window:", n, "rows  ← the edit is invisible")
print("target row 1 amount:", db.execute("SELECT amount FROM target WHERE id=1").fetchone()[0])

# FIX A: extract on updated_at
wm2, n = extract_load('updated_at', wm); print("updated_at window:", n, "row")
print("target row 1 amount:", db.execute("SELECT amount FROM target WHERE id=1").fetchone()[0])

# BUG B: advance the watermark before a successful load
db.execute("UPDATE source SET amount=123, updated_at='2026-03-04' WHERE id=2")
wm_bad, n = extract_load('updated_at', wm2, crash_before_load=True)
print("after 'crash': wm =", wm_bad, "but target row 2 =",
      db.execute("SELECT amount FROM target WHERE id=2").fetchone()[0], " ← window lost silently")

# Idempotency check: re-running a loaded window changes nothing
before = db.execute("SELECT count(*) FROM target").fetchone()[0]
extract_load('updated_at', wm); after = db.execute("SELECT count(*) FROM target").fetchone()[0]
print("rerun same window:", before, "→", after, "(idempotent load absorbs duplicates)")
```

Expected results: the `created_at` window returns zero rows even though a row *did* change — the edit is invisible, and the target keeps the stale amount 10. Switching to `updated_at` picks it up and the amount becomes 99. Bug B is the frightening one: no exception, no log line, the watermark simply moved past a window that was never loaded — row 2 keeps its old value forever, and only a reconciliation would ever notice. The final re-run shows why the overlap trick is safe: an idempotent load applied twice produces the same table.

## Check yourself

1. Your incremental extract runs nightly and the source's `updated_at` is set by application code that occasionally forgets to touch it on some update paths. What breaks, and what do you do?
2. Why must the watermark advance *after* the load rather than before — and what would you add to catch it if someone got the order wrong?
3. A supplier resends three months of corrected files. Walk through what you run, in what order, and how you prove it worked.

<details><summary>See answers</summary>

1. Rows edited through those paths are never re-extracted, so the warehouse silently drifts from the source — the worst kind of bug, because nothing fails. Options: fix the source to always maintain `updated_at` (best), switch to change-data-capture, or add a periodic full reconciliation that compares source and target and repairs differences.
2. Because the watermark records *work completed*, not work attempted. Advance it first and any crash between the two steps loses that window with no error anywhere. To catch it: a reconciliation check comparing source and target row counts per window, plus alerting on windows where the extracted row count is zero when it shouldn't be.
3. Land the corrected files in bronze, then loop the same parameterized job over the affected dates with bounded parallelism (say 10 at a time) — no special code path, because each run owns its partition and overwrites it. Then prove it: compare row counts and column totals per date before and after, and confirm downstream gold numbers moved by the expected amount. Announce the change to consumers first, since their numbers will move.

</details>

## Key takeaways

- ELT by default (cheap warehouse compute + bronze evidence + testable SQL); ETL survives where compliance or physics demands transform-first.
- Incremental extract lives or dies by the watermark: closed windows, advance only after success, `updated_at` not `created_at`, overlap + idempotent loads for the edges.
- Loads are overwrite-partition, merge, or append(+dedupe) — always staged-then-swapped; blind append of mutable data is the doubled-numbers incident.
- Backfill is a designed operation (parameterized runs, bounded parallelism, verify by reconciliation); failures sort into transient (retry), data (quarantine, don't retry), logic (fix + backfill).

*Next up — Part 7: Apache Spark: When Pandas Isn't Enough.*
