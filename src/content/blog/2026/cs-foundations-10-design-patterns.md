---
title: 'Design Patterns & Abstractions: When to Use, When to Skip'
description: 'The four patterns you actually meet, SOLID compressed to two working rules, and the courage to write boring code — abstraction as a loan you must repay.'
date: 2026-08-04
category: Developer
tags: [cs-foundations, design-patterns, architecture]
lang: en
translationKey: cs-foundations-10
series: cs-foundations
part: 10
---

Design patterns have the same PR problem as Big-O (P4): taught as interview vocabulary, deployed as résumé decoration, and then blamed for the resulting mess. The rehabilitated version: **patterns are names for solutions that keep recurring** — the names help you *talk* about code; the solutions help only when you actually have the problem. This part covers the four you'll genuinely meet, SOLID compressed to what survives contact, and the senior skill nobody advertises: *not* abstracting.

## Abstraction is a loan

Every abstraction borrows against the future: you pay complexity *now* (an interface, an indirection, a concept to learn) for flexibility *later*. Good loans get repaid — the flexibility gets used. Bad loans compound: layers nobody needed, "just in case" interfaces with one implementation, a codebase where finding *where things actually happen* takes three jumps (CS-P9's reading-code method, sabotaged).

The lending rule that prevents most bad loans: **abstract on the second or third occurrence, not the first** (you can't design a good interface from one example — you don't yet know which parts vary), and **inline is a valid refactor** — deleting an abstraction that didn't earn its keep is senior work, not regression.

## The four patterns you'll actually meet

**Strategy — swappable behavior behind one interface.** The pattern you already use without the name:

```python
class S3Storage:      def save(self, key, data): ...
class LocalStorage:   def save(self, key, data): ...   # tests, dev

def process(order, storage):        # caller doesn't care which
    storage.save(order.id, render(order))
```

Where you've seen it: every "backend" config option, S02-P03's border pattern (parse once, swap sources), pluggable auth. The tell that you need it: an `if provider == "x" ... elif provider == "y"` chain spreading through multiple functions.

**Factory — one place that knows how to build the thing.** Not the ceremony of `AbstractFactoryFactory`; just: construction logic (which class? which config? which credentials?) lives in *one* function instead of copy-pasted at every call site. `create_storage(env)` returning the right Strategy is the whole pattern — and note how the two compose: factories build strategies.

**Observer — decoupled reactions to events.** "When X happens, several things should react, and X shouldn't know about them." You've been *inside* this pattern all series: S3 events triggering Lambdas (S04-P07), Airflow's data-aware scheduling (S02-P08), the outbox feeding subscribers (S07-P06). In-process it's callbacks/listeners; between systems it's a queue — same idea, different distance.

**Adapter — your interface wrapped around their mess.** The third-party SDK changes, or you use two providers with different shapes: define *your* interface (what your app needs, no more) and write a thin adapter per provider. This is the pattern that makes S07-P13's strangler migrations tractable and keeps vendor lock-in (S07-P03's exit-ramp thinking) at the edges of your codebase instead of woven through it.

That's the working set. The other twenty patterns exist; you'll recognize them from these four's DNA when they show up.

## SOLID, compressed to what survives

Five principles, honestly reduced to the two you'll use weekly:

- **Single responsibility** — better phrased as *one reason to change*. The test isn't "does this class do one thing?" (hopelessly vague) but "when requirements change, how many files do I touch, and does this file change for unrelated reasons?" S02-P08's task granularity ("a task is a unit of retry") is this principle wearing orchestrator clothes.
- **Depend on interfaces at boundaries** (the D) — which you've been doing since S02-P03's typed borders: code against "a storage", "a notifier", "a model client" at the seams where implementations plausibly vary — and *only* there. The middle of your business logic does not need dependency injection ceremonies.

The other three (O/L/I) matter mostly as code-review smells: if extending behavior requires editing ten switch statements (O), if a subclass breaks where its parent worked (L), or if implementing an interface forces seven empty methods (I) — the design is talking to you.

## The courage to write boring code

The most valuable design skill at year five is the one that looks like no skill at all: **a plain function, a plain dict, code that reads top to bottom**. Patterns are for *recurring* problems; most code solves a problem exactly once. The heuristics that keep you honest:

- **YAGNI with teeth**: "we might need multi-provider support later" — when later comes, the Adapter refactor is a day's work *on known requirements*; the speculative version built today is a guess you'll maintain for years.
- **Duplication is cheaper than the wrong abstraction** (the industry learned this one expensively): two similar-but-diverging copies are annoying; one shared abstraction serving two diverging needs grows conditional parameters until nobody can touch it. Wait until the third copy proves what's truly common.
- **Optimize for the reader who wasn't there** (CS-P9's whole thesis): every layer of indirection is a page the reader must hold in their head. The pattern that saves you 10 lines and costs every future reader a jump is a bad trade.

## Key takeaways

- Abstraction is a loan: take it on the second or third occurrence, repay it with used flexibility, and inline what didn't earn its keep.
- Four patterns cover the field: Strategy (swappable behavior), Factory (construction in one place), Observer (decoupled reactions — you've met it as queues and triggers), Adapter (your interface at the vendor boundary).
- SOLID in practice: one reason to change per unit, interfaces at genuinely-varying boundaries — the rest are review smells.
- Boring code is a skill: YAGNI, duplication over wrong abstraction, and always optimizing for the reader who wasn't in the room.

*Next up — Part 11: Security Basics Every Developer Ships With.*
