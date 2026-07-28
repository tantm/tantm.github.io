---
title: "Data Structures You'll Use for the Rest of Your Career"
description: 'Five structures cover almost everything: array, hash map, tree, graph, queue — when to reach for each, and where they hide inside the tools you already use.'
date: 2026-07-28
category: Developer
tags: [cs-foundations, dsa, algorithms]
lang: en
translationKey: cs-foundations-03
series: cs-foundations
part: 3
---

![The working five, on one whiteboard — and the red circle is where half of all optimization lives](images/s01-p03-concept1.png)

University courses cover a zoo of data structures — red-black trees, Fibonacci heaps, skip lists. Then you start working and discover the working set is five: **array, hash map, tree, graph, queue**. The skill that matters is not implementing them from scratch; it is **recognizing which one your problem secretly is** — and spotting them hiding inside every tool you use.

## What you'll learn

- Match each of the five structures to its one-line identity — and to the tools where it already lives.
- Apply the single highest-value optimization move: build a hash index, then probe it.
- Explain why database indexes answer in milliseconds (B-trees) and why a cyclic pipeline can't run (topological sort).
- Use the recognition table to name the structure hiding in a messy problem.

**Prerequisites:** Part 2 (why memory layout and the call stack matter). Python examples, but everything transfers to any language.

## 1. Array / list — "things in a row"

Contiguous memory, instant access by position (`arr[i]` is O(1)), cheap to walk front-to-back — which, after Part 2, you know also means CPU-cache-friendly.

The one behavior worth internalizing: **insert at the end = cheap; insert in the middle = expensive** (everything after must shift). A million-element list that needs constant middle-insertion is the wrong structure — that pain is telling you to reach elsewhere.

Where you already use it: every Python `list`, every pandas column, every Parquet file (columnar = arrays per column, which is *why* analytics on Parquet is fast).

## 2. Hash map — "things by name"

The single most useful structure in programming. Key → hash function → slot. Lookup, insert, delete: O(1) on average.

```python
seen = set()          # a hash map wearing a costume
for row in rows:
    if row.id in seen:   # O(1) — a million rows, a million cheap checks
        continue
    seen.add(row.id)
```

The classic upgrade it enables — turning O(n²) into O(n):

```python
# Slow: for each order, scan all customers  → O(n·m)
# Fast: index customers by id once, then look up  → O(n + m)
by_id = {c.id: c for c in customers}
for o in orders:
    o.customer = by_id.get(o.customer_id)
```

That pattern — **build an index, then probe it** — is half of all practical optimization. It is also exactly what a database does when it hash-joins two tables, what a Python `dict`/`set` is, what Redis is (a hash map with a network cable), and what a Spark broadcast join does across a cluster.

Two costs to remember: no meaningful order, and everything lives in RAM.

## 3. Tree — "things in a hierarchy, or kept sorted"

Trees appear in two costumes:

- **Hierarchy:** file systems, JSON documents, HTML DOM, org charts. Walking them is recursion's home turf (and where Part 2's stack overflow lives if you forget a base case).
- **Sorted order at scale — the B-tree:** the reason `WHERE id = 42` on a billion rows returns in milliseconds. A wide, shallow tree where each node holds many sorted keys: a few hops from root to leaf instead of a scan. **Every database index you have ever created is one of these.**

The B-tree also explains index behavior you've met in practice: range queries are fast (leaves are linked in order — walk the ribbon), and a composite index on `(a, b)` can't serve a query filtering only `b` — the tree is sorted by `a` first. That's not database trivia; that's the data structure showing through.

## 4. Graph — "things that point at each other"

Nodes + edges: social networks, service dependencies, Airflow DAGs, foreign keys between tables, lineage in a data catalog.

You need exactly two algorithms as a working engineer:

- **Traversal (BFS/DFS):** "what's reachable from here?" — impact analysis ("if this table breaks, which dashboards die?"), crawling, finding connected clusters.
- **Topological sort:** "in what order must these run?" — how every orchestrator (Airflow, dbt, Make) schedules a DAG, and why a **cycle** (A needs B needs A) is instant death for a pipeline definition: no valid order exists.

If you can model a messy problem as a graph, you can usually stop inventing an algorithm — one of these two already solves it.

## 5. Queue — "things in line"

FIFO: producers append, consumers take from the front. The structure of **decoupling**: the two sides no longer need to run at the same speed or the same time.

One idea, three sizes:

| Scale | Incarnation |
|---|---|
| Inside a process | `collections.deque`, BFS frontier |
| Between processes | task queues (Celery, background jobs) |
| Between systems | Kafka, SQS — a queue made durable and distributed |

When Part 10 of the DE Roadmap says "Kafka is a log", your mental model can start here: a queue that many consumers can read at their own pace. (Two cousins worth knowing by name: the **stack** — LIFO, undo history, call stack — and the **priority queue** — "most urgent first", schedulers and top-K.)

## 6. The recognition table

| You catch yourself saying… | Reach for |
|---|---|
| "for each X, find its Y" | Hash map (build index, then probe) |
| "is this a duplicate?" | Hash set |
| "look up by range / keep sorted" | Tree (or a DB index — same thing) |
| "these depend on each other" | Graph + topo sort |
| "produced faster than consumed" | Queue |
| "just walk through them all" | Array — and that's fine |

## Practice (20 minutes — one file, no libraries)

Generate a fake dataset and feel two structures earn their keep:

```python
import random, time
customers = [{"id": i, "name": f"c{i}"} for i in range(20_000)]
orders = [{"id": i, "customer_id": random.randrange(20_000)} for i in range(20_000)]

# 1. The slow way — search inside a loop
t = time.perf_counter()
slow = [next(c for c in customers if c["id"] == o["customer_id"]) for o in orders]
print("nested loop:", round(time.perf_counter() - t, 2), "s")

# 2. The hash-index way
t = time.perf_counter()
by_id = {c["id"]: c for c in customers}
fast = [by_id[o["customer_id"]] for o in orders]
print("hash index:", round(time.perf_counter() - t, 4), "s")

# 3. Topological sort in 10 lines — order these pipeline steps:
deps = {"report": {"clean"}, "clean": {"extract"}, "dashboard": {"report"}, "extract": set()}
order, done = [], set()
while len(order) < len(deps):
    ready = [k for k, v in deps.items() if v <= done and k not in done]
    if not ready: raise SystemExit("cycle!")   # try adding: deps["extract"] = {"dashboard"}
    order += ready; done |= set(ready)
print("run order:", order)
```

Expected results: the nested loop takes seconds; the hash index takes milliseconds — the O(n²) → O(n) move, felt on your own hardware. Step 3 prints a valid run order; add the suggested cycle and it dies with `cycle!` — exactly why Airflow rejects cyclic DAGs.

## Check yourself

1. Your report joins orders to customers with a loop inside a loop and takes minutes. What's the one-move fix, and what tool does the same thing at database scale?
2. A composite index on `(country, city)` doesn't speed up `WHERE city = 'Hanoi'`. Which structure explains why?
3. A teammate's pipeline definition fails with "cycle detected." What does that mean structurally, and why is there no fix except breaking the cycle?

<details><summary>See answers</summary>

1. Build a hash index once (`{id: customer}`), then probe it per order — O(n·m) becomes O(n+m). A database hash join does exactly this move when joining two tables.
2. The B-tree: it's sorted by `country` first, `city` second. Keys with the same city are scattered across all countries, so the tree can't narrow the search — the structure, not the database, dictates the rule.
3. The dependency graph has a loop (A needs B needs A), so no topological order exists — there is literally no sequence in which every step runs after its dependencies. It's not a tuning problem; the definition itself is contradictory.

</details>

## Key takeaways

- Five structures cover the career: array (row), hash map (by name), tree (hierarchy/sorted), graph (dependencies), queue (in line).
- The biggest practical win is one move: replace "search inside a loop" with "build a hash index, then probe" — O(n²) → O(n).
- Database indexes are B-trees; orchestrators are graphs + topological sort; Kafka is a durable queue. The tools are the structures, at scale.
- Skill = recognizing which structure your problem secretly is. The table above is the whole trick.

*Next up — Part 4: Big-O Is a Way of Thinking, Not an Interview Trick.*
