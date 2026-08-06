---
title: 'Concurrency Without Tears'
description: 'The check-then-act race, four defenses in order of preference, deadlock as a dining problem, and async/await honestly explained — concurrency for people who ship.'
date: 2026-08-02
category: Developer
tags: [cs-foundations, concurrency, performance]
lang: en
translationKey: cs-foundations-08
series: cs-foundations
cover: images/s01-p08-hero.png
part: 8
---

Part 5 introduced threads as roommates sharing memory; Part 7 showed a race condition wearing a database costume. This part faces concurrency directly — not the academic zoo of primitives, but the **one bug shape that causes almost all the tears**, the four defenses against it in order of preference, and what async/await actually is under the syntax.

## What you'll learn

- Recognize the single bug shape behind nearly every concurrency incident.
- Apply the four defenses in order, so you reach for a lock last rather than first.
- Explain deadlock and the two standard cures.
- Say what async/await actually buys — and the case where it buys nothing.

**Prerequisites:** Part 5 (processes and threads). Part 7 helps for the database-level defenses.

## 1. The one bug shape: check-then-act

Nearly every concurrency bug you will meet is this pattern:

```python
if counter < limit:      # CHECK — true for both threads
    counter += 1         # ACT — both act; limit exceeded
```

Between the check and the act, another thread changed the world. Sold the same seat twice, sent the email twice, exceeded the rate limit — all this one shape. Even `counter += 1` alone is secretly three steps (read, add, write — Part 2's machine showing through), and two threads can interleave them into a lost update.

The cruelty is in the probabilities: the interleaving happens maybe once per million runs — invisible in tests, weekly in production (where Part 5's scheduler preempts at the worst moment, guaranteed by volume). **You cannot test concurrency bugs away; you design them away.**

## 2. The four defenses, in order of preference

**Defense 1 — Don't share (best).** No shared mutable state, no race. Each worker owns its data (S02-P03's runs owning partitions is exactly this at pipeline scale); workers communicate by **passing messages through queues** (Part 3's queue, now load-bearing) instead of touching common variables. This is why the "share nothing, pass messages" style dominates modern design — from Go's channels to microservices (S06 someday) to every worker-pool you'll write.

**Defense 2 — Make it immutable.** Data nobody can change is safe to share infinitely. Build a new list instead of mutating; snapshot config at startup; treat messages as frozen once sent. (Bronze's immutability, S02-P05, is this defense at warehouse scale.)

**Defense 3 — Push it down to something that already solved it.** The database's atomic `UPDATE ... WHERE` (Part 7), Redis's atomic increment, the queue's exactly-once-ish delivery — infrastructure teams spent decades on their locks so you don't have to write yours. For cross-*process* coordination this is the only game anyway: your in-process mutex means nothing to the other twenty pods (S04-P03's cattle), which is why "distributed lock" almost always means "let the database/Redis arbitrate."

**Defense 4 — Lock, narrowly (last resort).** When shared mutable state is unavoidable, a mutex makes check-then-act atomic:

```python
with lock:               # one thread at a time from here...
    if counter < limit:
        counter += 1     # ...to here. The check and act are now one unit.
```

The craft is scope: hold the lock for the *shortest possible* critical section (never around I/O — a lock held across a network call turns one slow request into a company-wide traffic jam), and prefer one coarse lock that's obviously correct over five fine ones that are theoretically faster (measure first — Part 4's rule applies to lock tuning too).

## 3. Deadlock: the dining philosophers, at work

Locks introduce their own classic failure: thread A holds lock 1 and wants lock 2; thread B holds 2 and wants 1. Both wait forever — no crash, no error, just a system that stops (Part 5's `D`-state processes piling up while CPU sits idle). The two working cures: **acquire locks in a fixed global order** (if everyone takes account-with-lower-id first, the cycle can't form — this shows up in real code as "always lock accounts in id order" in transfer logic), and **timeouts on acquisition** so a stuck worker fails loudly instead of silently forever (databases do this for you: lock timeouts and deadlock detection are why Part 7 said push it down).

## 4. Async/await: concurrency without threads (for waiting only)

The `async`/`await` you meet in Python, JS, and friends is *not* parallelism. It's Part 2's insight ("most server work is waiting") turned into syntax: **one thread, many paused tasks** — at each `await`, the task parks and the event loop runs someone else.

```python
results = await asyncio.gather(*[fetch(u) for u in urls])   # 100 requests "at once"
# One thread. Concurrency = overlapping the WAITING, not the computing.
```

Consequences that bite in practice: async shines for I/O-bound fan-out (100 API calls in the time of the slowest — the N+1 penalty of Part 4, partially forgiven) and does *nothing* for CPU-bound work — one heavy computation inside an async handler **blocks every task on the loop** (the classic "our async server froze" incident; the cure is handing CPU work to a process pool). And note the pleasant surprise: within a single-threaded event loop, check-then-act between `await`s is still a race (tasks interleave at awaits!), but plain sequential code between awaits is atomic — fewer locks needed, not zero thinking needed.

The decision rule, extending Part 2's question: **I/O-bound → async (or threads); CPU-bound → processes (or push to the database/queue); unsure → measure.**

## Practice (20 minutes — lose money to a race, then make it impossible)

One Python file. You'll watch a balance go wrong, fix it three different ways, and see why the database fix is the one that survives multiple servers:

```python
import threading, sqlite3

# 1. THE RACE: check-then-act on shared state
balance = 1000
def withdraw_racy(amount):
    global balance
    if balance >= amount:          # CHECK
        for _ in range(1000): pass # a tiny delay — production has network calls here
        balance -= amount          # ACT: by now the check may be stale
threads = [threading.Thread(target=withdraw_racy, args=(100,)) for _ in range(20)]
[t.start() for t in threads]; [t.join() for t in threads]
print(f"racy balance: {balance}   (should never go below 0)")

# 2. DEFENSE 1 — don't share: give each worker its own state, combine at the end
results = []
lock_free = threading.local()
def work_isolated(i): results.append(i * 2)      # no shared mutable decision
ts = [threading.Thread(target=work_isolated, args=(i,)) for i in range(20)]
[t.start() for t in ts]; [t.join() for t in ts]
print(f"isolated: {len(results)} results, no shared decision to corrupt")

# 3. DEFENSE 3 — make check-and-act ONE atomic operation (a lock, narrowly scoped)
balance = 1000
lock = threading.Lock()
def withdraw_locked(amount):
    global balance
    with lock:                     # the check and the act are now inseparable
        if balance >= amount:
            balance -= amount
ts = [threading.Thread(target=withdraw_locked, args=(100,)) for _ in range(20)]
[t.start() for t in ts]; [t.join() for t in ts]
print(f"locked balance: {balance}   (never negative)")

# 4. THE REAL FIX at scale — push the check into the database write itself
db = sqlite3.connect(":memory:", check_same_thread=False)
db.execute("CREATE TABLE acct(id INT PRIMARY KEY, balance INT)")
db.execute("INSERT INTO acct VALUES (1, 1000)"); db.commit()
def withdraw_db(amount):
    cur = db.execute("UPDATE acct SET balance = balance - ? WHERE id = 1 AND balance >= ?",
                     (amount, amount))            # one statement: no window to race in
    db.commit()
    return cur.rowcount                            # 0 rows = insufficient funds, cleanly
ts = [threading.Thread(target=withdraw_db, args=(100,)) for _ in range(20)]
[t.start() for t in ts]; [t.join() for t in ts]
print("db balance:", db.execute("SELECT balance FROM acct").fetchone()[0])
```

Expected results: the racy version usually ends negative — twenty threads each saw a balance that was true when they checked it and false by the time they acted. The lock fixes it *within one process*, which is exactly its limit: run two copies of your service and the in-process lock protects nothing, because each process has its own. The database version is the one that survives horizontal scaling, because the check lives inside the write and the engine enforces it. Note the shape of the fix in both working cases — you didn't add more checking, you removed the *window* between check and act.

## Check yourself

1. A colleague fixes a race by adding a retry loop around the failing operation. Why is this usually not a fix?
2. Your service passes all concurrency tests locally, then corrupts data in production. What's the most likely difference?
3. You add `async` to a function that spends its time doing CPU-heavy image resizing. What happens to throughput, and why?

<details><summary>See answers</summary>

1. Because a retry re-runs the same check-then-act sequence and can hit the same window again — it makes the bug rarer, not absent, which is worse: it now fails unpredictably in production instead of reproducibly in testing. Fixes remove the window (atomic operations, narrow locks, database constraints); retries only change the odds.
2. Production runs multiple processes or multiple machines, and your local test ran one process. In-process locks and in-memory state protect nothing across processes. The defense that survives is the one enforced somewhere shared — the database, or a distributed lock if you truly need one.
3. Throughput doesn't improve and may get worse. Async interleaves *waiting*, not computing: while one coroutine resizes an image, it holds the event loop and nothing else progresses. CPU-bound work needs multiple processes (or a language without a global interpreter lock, or a native library that releases it) — async is the wrong tool for it.

</details>

## Key takeaways

- Almost every concurrency bug is check-then-act; you design it away, not test it away.
- Defenses in order: don't share (queues between owners), make it immutable, push atomicity down to DB/Redis/queue, and only then lock — narrowly, never across I/O.
- Deadlocks need a cycle: fixed lock ordering and acquisition timeouts break it; databases detect it for you.
- Async/await overlaps *waiting* on one thread — a gift for I/O fan-out, a trap for CPU work, and still racy between awaits.

*Next up — Part 9: Git, Testing, Code Review — the Real Job Skills.*
