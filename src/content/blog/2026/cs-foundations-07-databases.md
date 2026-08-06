---
title: 'Databases: The 20% That Powers 80% of Your Work'
description: 'Why the relational model refuses to die, how an index actually finds your row, what a transaction really promises, and reading your first query plan.'
date: 2026-08-01
category: Developer
tags: [cs-foundations, database, sql]
lang: en
translationKey: cs-foundations-07
series: cs-foundations
part: 7
---

Every application you will ever touch is, at its core, a fancy costume on a database. The state of the business — who paid, who signed up, what's in stock — lives there; everything else can be rebuilt. This part is the durable 20% of database knowledge: the relational model's actual contract, indexes as a physical fact, transactions as a promise with fine print, and the query plan — the database explaining itself to you.

## What you'll learn

- Explain why the relational model outlived every "SQL is dead" cycle.
- Reason about indexes physically: why column order matters and what silently kills them.
- Read an execution plan well enough to know whether an index is being used.
- Size a connection pool with arithmetic instead of hope.

**Prerequisites:** Part 3 (hash maps, B-trees) helps but isn't required. Basic SQL assumed.

## 1. Why the relational model refuses to die

Fifty years old and still the default, for two reasons that aren't nostalgia:

- **Declarative queries.** SQL states *what* you want; the database's optimizer decides *how* — which access path, which join order, which index. You are delegating to a planner with fifty years of engineering behind it (this is also why Big-O analysis of your own code, Part 4, mostly doesn't apply to SQL — the plan, not your query text, determines the work).
- **Constraints as guarantees.** Primary keys, foreign keys, `NOT NULL`, `UNIQUE` — the schema *refuses* bad data at the door. A constraint is the cheapest test you will ever write: it runs on every write, forever, and can't be skipped in a hurry (S02-P03's border-typing idea, enforced by the engine itself).

NoSQL didn't kill this; it carved out niches where the trade-offs differ (S04-P06 next week). The default remains: **when in doubt, relational.**

## 2. The index, physically

Part 3 introduced the B-tree; here's the working intuition to keep. Without an index, `WHERE email = 'x'` reads *every row* — a full scan, linear in table size (Part 4's habit: what happens at 100×?). With an index on `email`, the database walks a wide, shallow tree: three or four page reads instead of a million.

The fine print that turns this from trivia into skill:

- **Indexes are not free.** Every write must also update every index — an over-indexed table makes inserts crawl. Index what you *query by*, not everything.
- **Column order is a contract**: an index on `(customer_id, created_at)` serves "this customer's recent orders" beautifully, and does *nothing* for a query filtering only `created_at` (the tree is sorted by customer first — Part 3's ribbon, walked from the wrong end).
- **Functions break it**: `WHERE lower(email) = 'x'` can't use a plain index on `email` — the stored values aren't lowercased. Either index the expression or store it normalized (the "sargability" idea SQL Mastery will drill).
- The database's costumes for this: primary keys get an index automatically; foreign keys usually *don't* — the classic slow-join surprise.

## 3. Transactions: the promise and its fine print

A transaction bundles writes into all-or-nothing (Part 2's example: money leaves one account *and* arrives in the other). ACID, decoded honestly:

- **A**tomicity — all or nothing, even across a crash.
- **C**onsistency — constraints hold before and after.
- **D**urability — committed means *on disk*, surviving power loss (Part 5's fsync world).
- **I**solation — the fine print. Full isolation ("as if transactions ran one at a time") is expensive, so databases default to weaker levels, and concurrent transactions can see each other's world in surprising ways.

The one working rule that prevents most concurrency bugs without studying isolation levels: **make check-then-write atomic**. `SELECT balance` then `UPDATE` in app code is a race (two requests both read 100, both approve a 100 withdrawal — Part 8's race condition, wearing a database costume). The atomic form pushes the check into the write:

```sql
UPDATE accounts SET balance = balance - 100
WHERE id = 42 AND balance >= 100;   -- 0 rows updated = insufficient funds
```

One statement, engine-enforced, race-free. Learn `SELECT ... FOR UPDATE` for the multi-step cases; reach for isolation-level tuning only after those two run out.

## 4. The query plan: the database explains itself

`EXPLAIN` (and `EXPLAIN ANALYZE` to actually run it) prints the optimizer's chosen strategy. You don't need to parse every node on day one — three glances give 80% of the value:

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 10;
-- Look for:
--   "Index Scan using idx_orders_customer"  ← good: the tree walk
--   "Seq Scan on orders"                    ← the whole-table read; fine on tiny tables, an incident on big ones
--   rows=1063 (actual rows=2)               ← estimate vs reality wildly off → stale statistics, bad plans
```

The debugging loop for "this query is slow" is thus mechanical: EXPLAIN → spot the Seq Scan on a big table → check whether an index exists and *can* be used (column order? function on the column?) → fix → re-EXPLAIN. This tiny loop, run a few dozen times, is how database intuition is actually built.

## 5. Connections are file descriptors with feelings

One systems note that saves real incidents: a database connection is expensive on *both* ends (Part 5's fd on yours, memory and process state on theirs — and Postgres has a hard `max_connections`). Hence the universal pattern: **connection pools** — a small set of long-lived connections, borrowed and returned. The classic outage this explains: autoscaling spins up 40 app instances × 20 connections each = the database refuses connection number 801, and the "database is down" alert is actually an arithmetic problem.

## Practice (25 minutes — make the index appear in the plan, then kill it)

SQLite is enough (`sqlite3 lab.db`) — the plan output is terser than Postgres but the lessons are identical. Every step ends in an observable difference:

```sql
CREATE TABLE orders(id INTEGER PRIMARY KEY, customer_id INT, status TEXT, created_at TEXT, amount REAL);
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 200000)
INSERT INTO orders SELECT n, n % 5000, CASE n % 3 WHEN 0 THEN 'shipped' ELSE 'pending' END,
       date('2026-01-01', '+' || (n % 365) || ' days'), (n % 100) * 1.5 FROM seq;

-- 1. No index yet: the database says SCAN
.timer on
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 42;
SELECT count(*) FROM orders WHERE customer_id = 42;

-- 2. Build the index, ask again: SEARCH ... USING INDEX
CREATE INDEX idx_cust ON orders(customer_id);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 42;
SELECT count(*) FROM orders WHERE customer_id = 42;      -- same answer, different physics

-- 3. Kill the index with a function on the column — the classic production mistake
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id + 0 = 42;       -- SCAN again
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE substr(created_at,1,7) = '2026-03';  -- SCAN

-- 4. Column ORDER in a composite index is not cosmetic
CREATE INDEX idx_status_date ON orders(status, created_at);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE status = 'shipped' AND created_at > '2026-06-01';  -- uses it
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE created_at > '2026-06-01';   -- can't: wrong prefix

-- 5. A foreign key does NOT give you an index (many databases, same trap)
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE amount > 140;                -- SCAN: nobody indexed it
```

Expected results: step 1 says SCAN and takes measurable time on 200,000 rows; step 2 says SEARCH and returns in roughly no time — the *plan text changing* is the signal you're learning to read, not the timing. Steps 3 and 4 are the important ones: wrapping the column in a function drops you straight back to a full scan even though the index still exists, and a composite index only serves queries that use its leading column. That last point is why "we have an index on that table" is never an answer to a slow query.

## Check yourself

1. A query on an indexed column suddenly runs slowly after someone "cleaned up" the WHERE clause. What would you look for first?
2. You have `INDEX(status, created_at)`. Which of these can use it: filtering by status alone, by created_at alone, by both?
3. Your service runs 20 instances, each with a pool of 50 connections, against a database that allows 500. What happens, and what's the arithmetic you should have done?

<details><summary>See answers</summary>

1. A function or expression wrapped around the indexed column — `LOWER(email) = …`, `substr(created_at,1,7) = …`, `col + 0 = …`. The index is on the column's values, not on the result of a function applied to them, so the database falls back to scanning. Fix by rewriting the predicate (range comparison instead of `substr`) or by adding an expression index.
2. Status alone: yes, it's the leading column. Both: yes, that's exactly what the index is for. `created_at` alone: no — a composite index is ordered by its first column, so a query that doesn't constrain `status` can't use the ordering, just as you can't find a name in a phone book knowing only the first name.
3. 20 × 50 = 1,000 connections demanded against a 500 limit, so instances start failing to connect under load — and it looks like "the database is down" when the database is fine. The arithmetic is instances × pool size ≤ max connections, with headroom for migrations, admin sessions and background jobs; the fix is a smaller pool per instance or a connection proxy.

</details>

## Key takeaways

- Relational endures because SQL is declarative (the optimizer does the Big-O) and constraints are tests that can't be skipped.
- Indexes are physical: column order matters, functions break them, every write pays for them, and foreign keys don't get one for free.
- ACID's fine print is isolation — sidestep most of it by making check-then-write a single atomic statement.
- `EXPLAIN` in a loop builds intuition: hunt Seq Scans on big tables and estimate-vs-actual gaps; pool your connections before autoscaling does the math for you.

*Next up — Part 8: Concurrency Without Tears.*
