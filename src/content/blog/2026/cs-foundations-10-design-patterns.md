---
title: 'Design Patterns & Abstractions: When to Use, When to Skip'
description: 'The four patterns you actually meet, SOLID compressed to two working rules, and the courage to write boring code — abstraction as a loan you must repay.'
date: 2026-08-04
category: Developer
tags: [cs-foundations, design-patterns, architecture]
lang: en
translationKey: cs-foundations-10
series: cs-foundations
cover: images/s01-p10-hero.png
part: 10
---

Design patterns have the same PR problem as Big-O (P4): taught as interview vocabulary, deployed as résumé decoration, and then blamed for the resulting mess. The rehabilitated version: **patterns are names for solutions that keep recurring** — the names help you *talk* about code; the solutions help only when you actually have the problem. This part covers the four you'll genuinely meet, SOLID compressed to what survives contact, and the senior skill nobody advertises: *not* abstracting.

## What you'll learn

- Decide when an abstraction is worth its interest — and when duplication is cheaper.
- Recognize the four patterns you'll genuinely meet, including the one already inside your framework.
- Compress SOLID into the two principles that survive contact with real code.
- Defend boring code in review, with reasons rather than taste.

**Prerequisites:** None. Some experience of a codebase you didn't write helps the arguments land.

## 1. Abstraction is a loan

Every abstraction borrows against the future: you pay complexity *now* (an interface, an indirection, a concept to learn) for flexibility *later*. Good loans get repaid — the flexibility gets used. Bad loans compound: layers nobody needed, "just in case" interfaces with one implementation, a codebase where finding *where things actually happen* takes three jumps (CS-P9's reading-code method, sabotaged).

The lending rule that prevents most bad loans: **abstract on the second or third occurrence, not the first** (you can't design a good interface from one example — you don't yet know which parts vary), and **inline is a valid refactor** — deleting an abstraction that didn't earn its keep is senior work, not regression.

## 2. The four patterns you'll actually meet

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

## 3. SOLID, compressed to what survives

Five principles, honestly reduced to the two you'll use weekly:

- **Single responsibility** — better phrased as *one reason to change*. The test isn't "does this class do one thing?" (hopelessly vague) but "when requirements change, how many files do I touch, and does this file change for unrelated reasons?" S02-P08's task granularity ("a task is a unit of retry") is this principle wearing orchestrator clothes.
- **Depend on interfaces at boundaries** (the D) — which you've been doing since S02-P03's typed borders: code against "a storage", "a notifier", "a model client" at the seams where implementations plausibly vary — and *only* there. The middle of your business logic does not need dependency injection ceremonies.

The other three (O/L/I) matter mostly as code-review smells: if extending behavior requires editing ten switch statements (O), if a subclass breaks where its parent worked (L), or if implementing an interface forces seven empty methods (I) — the design is talking to you.

## 4. The courage to write boring code

The most valuable design skill at year five is the one that looks like no skill at all: **a plain function, a plain dict, code that reads top to bottom**. Patterns are for *recurring* problems; most code solves a problem exactly once. The heuristics that keep you honest:

- **YAGNI with teeth**: "we might need multi-provider support later" — when later comes, the Adapter refactor is a day's work *on known requirements*; the speculative version built today is a guess you'll maintain for years.
- **Duplication is cheaper than the wrong abstraction** (the industry learned this one expensively): two similar-but-diverging copies are annoying; one shared abstraction serving two diverging needs grows conditional parameters until nobody can touch it. Wait until the third copy proves what's truly common.
- **Optimize for the reader who wasn't there** (CS-P9's whole thesis): every layer of indirection is a page the reader must hold in their head. The pattern that saves you 10 lines and costs every future reader a jump is a bad trade.

## Practice (20 minutes — write the wrong abstraction on purpose, then feel it hurt)

This one is deliberately paper-and-editor rather than a runnable lab: bad abstractions don't fail, they *cost*, and cost is what you have to learn to see.

**Step 1 (5 min).** Take this duplication and resist fixing it:

```python
def send_welcome_email(user):
    subject = f"Welcome, {user.name}!"
    body = render("welcome.html", name=user.name)
    smtp.send(user.email, subject, body)

def send_receipt_email(user, order):
    subject = f"Receipt for order {order.id}"
    body = render("receipt.html", name=user.name, total=order.total)
    smtp.send(user.email, subject, body)
```

Write down the abstraction you're tempted to build (`send_templated_email(user, template, subject_fmt, **ctx)`), then list what it must grow to handle: attachments, a different sender, one email that goes to an admin instead of the user, a locale, a "don't send on weekends" rule.

**Step 2 (5 min).** Now write that generalized function's signature after all five requirements. Count the parameters. Ask honestly whether a new teammate would find calling it easier than writing four lines of SMTP.

**Step 3 (10 min).** Find one real abstraction in code you own — a base class, a helper with many flags, a wrapper around a library. Answer three questions in writing: How many call sites does it have? How many of its parameters exist for exactly one caller? If you deleted it and inlined it everywhere, would the codebase get longer *and* clearer, or just longer?

Expected results: step 2 usually produces a signature nobody would want to call, which is the point — the generalized version absorbed five unrelated requirements and now every caller pays for all of them. Step 3 is the one worth repeating quarterly: an abstraction with two call sites and four single-caller parameters isn't shared code, it's a coupling you'll pay interest on. The rule that falls out is the one from earlier in this part — wait for the second or third real use, and let the *actual* differences define the interface instead of imagined ones.

## Check yourself

1. You spot the same six lines in three services. What do you need to know before extracting them into a shared library?
2. A colleague argues a piece of code violates the open-closed principle and needs a plugin architecture. What do you ask?
3. When is duplication the better engineering choice?

<details><summary>See answers</summary>

1. Whether the three copies are the same *for the same reason*. Code that looks identical but serves three independent requirements will diverge, and a shared library then forces three teams to coordinate every change. Ask what happens when one caller's rule changes: if the answer is "the others must not change", the duplication is real and you should keep it.
2. What concrete extension is coming, and when. Open-closed pays off when you genuinely add variants often; when you don't, a plugin architecture is a fixed complexity cost paid forever against a hypothetical. Ask for two examples of the future variants — if nobody can name them, the code is fine.
3. When the copies change for different reasons, when the shared version would need flags to serve each caller, when it's small enough to read at a glance, or when the abstraction would couple modules that are otherwise independent. Duplication is cheap and local; a wrong abstraction is expensive and global.

</details>

## Key takeaways

- Abstraction is a loan: take it on the second or third occurrence, repay it with used flexibility, and inline what didn't earn its keep.
- Four patterns cover the field: Strategy (swappable behavior), Factory (construction in one place), Observer (decoupled reactions — you've met it as queues and triggers), Adapter (your interface at the vendor boundary).
- SOLID in practice: one reason to change per unit, interfaces at genuinely-varying boundaries — the rest are review smells.
- Boring code is a skill: YAGNI, duplication over wrong abstraction, and always optimizing for the reader who wasn't in the room.

*Next up — Part 11: Security Basics Every Developer Ships With.*
