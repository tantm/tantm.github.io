---
title: 'The 4-Year IT Degree, Distilled into One Map'
description: 'Six pillars of computer science knowledge that outlive every framework — and a reading path to master them, one part at a time.'
date: 2026-07-27
category: Developer
tags: [cs-foundations, career, learning]
lang: en
translationKey: cs-foundations-01
series: cs-foundations
part: 1
cover: images/cs-foundations-map.png
---

Four years of a computer science degree produce hundreds of lecture slides, dozens of assignments, and — if we are honest — a lot of material you will never touch again. But buried in there is a small core that you will use **every single working day** for the rest of your career.

This series is that core. Not a summary of a curriculum — a distillation of what still matters after the exams are long forgotten, connected to the situations where you will actually need it: debugging a slow endpoint, reading a production incident, designing a schema, reviewing a colleague's code.

![The 4-Year IT Degree, Distilled into One Map](images/cs-foundations-map.png)

## Why fundamentals, in the age of AI?

It is a fair question. AI assistants can write the code. Frameworks change every two years. Why invest in 12 posts of fundamentals?

Because fundamentals are exactly the part that **doesn't** change:

- The framework you learn this year will be legacy in five. TCP, B-trees, and Big-O will not.
- AI writes code fast — but *judging* that code (is it correct? safe? efficient?) requires the mental models this series builds.
- Every hard bug you will ever face lives **below** the framework: memory, concurrency, the network, the database. Engineers who understand the layer below get unstuck; engineers who don't stay stuck.

Fundamentals compound. Frameworks depreciate.

## The map: six pillars

Everything worth keeping from a CS degree fits into six pillars:

```mermaid
mindmap
  root((CS Foundations))
    How Computers Work
      CPU & memory
      Process vs thread
      Compile vs interpret
    Data Structures & Algorithms
      Hash map
      Tree & graph
      Big-O thinking
    Operating Systems
      Scheduling
      Virtual memory
      File system
    Networking
      TCP/IP
      HTTP & DNS
      TLS
    Databases
      SQL & joins
      Indexes
      Transactions
    Engineering Practices
      Git
      Testing
      Code review
```

Here is what each pillar gives you, and where the series covers it.

### 1. How computers work — *Part 2*

CPU, memory, and what actually happens between `python app.py` and pixels on a screen. This pillar explains every performance mystery you will ever debug: why the loop is slow, why the process was killed, why "it works on my machine".

### 2. Data structures & algorithms — *Parts 3–4*

Not competitive programming — the five structures you will use for the rest of your career (array, hash map, tree, graph, queue) and **Big-O as a way of thinking**. You will learn to spot the accidental O(n²) hiding in everyday code, like a loop that calls a query on every iteration.

### 3. Operating systems — *Part 5*

Processes, scheduling, virtual memory, file descriptors. Sounds academic until the first time production throws `OOMKilled` or `too many open files` at you. Containers did not make the OS go away — a container **is** an OS concept.

### 4. Networking — *Part 6*

What really happens when you hit Enter on a URL: DNS, TCP, TLS, HTTP. Every system you will ever build is distributed now; the network is the part that fails creatively. Being able to reason about it — and debug it with `curl` — is a superpower.

### 5. Databases — *Part 7*

The relational model, how indexes actually work, what a transaction guarantees. Databases carry the state of the business; this is the 20% of database knowledge that powers 80% of your daily work.

### 6. Engineering practices — *Parts 8–12*

Concurrency without tears, Git and code review as professional skills, design patterns used with judgment, security basics, and finally the bridge from school project to production system. This pillar is what separates "can code" from "can be trusted with production".

## How to use this series

- **Read in order.** The parts build on each other — the map above is also a dependency graph.
- **One part, one sitting.** Each post is designed to be read in 10–15 minutes, then applied.
- **Apply within a week.** After each part, find one place in your current work where the concept shows up. Knowledge you don't attach to experience evaporates.
- **Don't memorize — connect.** The goal is a mental model that tells you *where to look* when something breaks.

## Key takeaways

- A CS degree's lasting value fits into six pillars: machine, data structures, OS, network, database, and engineering practices.
- Fundamentals compound while frameworks depreciate — they are the best career investment you can make, especially in the AI era.
- This series walks the six pillars in dependency order, one focused part at a time.

**Where to next after this series:** the [Data Engineer Roadmap](/series/de-roadmap), the [AI Engineer Roadmap](/series/ai-roadmap), or [AWS from Zero to Advanced](/series/aws-zero-to-advanced) — all three assume the foundations built here.

*Next up — Part 2: How Computers Actually Run Your Code.*
