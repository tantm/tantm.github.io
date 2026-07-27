---
title: 'How Computers Actually Run Your Code'
description: 'CPU, memory, processes and threads — the mental model that explains every "why is this slow?" you will ever debug.'
date: 2026-07-28
category: Developer
tags: [cs-foundations, computer-architecture, performance]
lang: en
translationKey: cs-foundations-02
series: cs-foundations
part: 2
---

You type `python app.py` and press Enter. Half a second later, text appears on screen. What happened in between is the single most useful mental model in software engineering — because when things get slow, crash, or "work on my machine" only, the answer almost always lives in this gap.

This part builds that model in four layers: the machine, the memory, the program, and the process.

## Layer 1 — The machine: one chef, a counter, and a warehouse

Strip a computer to three parts:

- **CPU** — the chef. Executes billions of tiny instructions per second, but only one thing at a time per core.
- **RAM (memory)** — the kitchen counter. Fast to reach, limited in size, wiped clean when the power goes.
- **Disk** — the warehouse. Huge and permanent, but a trip there takes ages compared to the counter.

The numbers matter more than the metaphor. Rough orders of magnitude:

| Access | Time | If 1 CPU cycle = 1 second |
|---|---|---|
| CPU register | ~1 ns | seconds |
| RAM | ~100 ns | ~2 minutes |
| SSD read | ~100 µs | ~1 day |
| Network call (same region) | ~1 ms | ~2 weeks |

This table explains most performance work you will ever do: **the fastest code is the code that stays high on this table.** A loop that reads from RAM beats a loop that reads from disk; a batch of one network call beats a thousand small ones. When a senior says "that's an N+1 query problem", they are reading this table out loud.

## Layer 2 — Memory: the stack and the heap

Your program's memory has two working areas:

- **The stack** — small, fast, automatically managed. Function calls, local variables. Enter a function → a frame is pushed; return → it's popped. Recurse too deep → *stack overflow* (now you know where the website got its name).
- **The heap** — big, flexible, manually or garbage-collector managed. Objects, lists, anything whose size or lifetime isn't known upfront.

Why care? Because two of the most common production incidents are memory stories:

- **The leak:** objects keep getting referenced (a global cache, a listener never removed) → the heap grows forever → the process slows, then dies. On Linux, the kernel's OOM killer picks your process and kills it — the infamous `OOMKilled` in container logs.
- **The garbage-collection pause:** in GC languages (Python, Java, Go, JS), someone has to clean the heap. When it runs at the wrong moment, your p99 latency spikes for "no reason". The reason is the janitor.

## Layer 3 — From source code to instructions

The CPU doesn't understand Python or Java. Something has to translate:

```mermaid
flowchart LR
    A[Source code] -->|Compiled: C, Go, Rust| B[Machine code binary]
    A -->|Interpreted: Python| C[Interpreter executes line by line]
    A -->|Hybrid: Java, JS, C#| D[Bytecode + VM + JIT]
    B --> E[CPU]
    C --> E
    D --> E
```

- **Compiled** languages translate everything upfront → fast execution, slower build, binary per platform.
- **Interpreted** languages translate as they go → instant start, slower loops (every line pays translation tax on every pass).
- **Hybrid**: compile to bytecode, run on a virtual machine, and a **JIT** (just-in-time compiler) turns hot paths into machine code while running — which is why a Java service is slow for the first minute and fast after.

Practical consequence: a tight numeric loop in pure Python can be 100× slower than the same loop in C — and why numpy (whose insides are compiled C) exists at all. You will meet this again in the AI series: the Python you write is a thin remote control over compiled kernels.

## Layer 4 — Processes and threads

Run your program and the OS wraps it in a **process**: its own memory space, its own file handles, isolated from everyone else. Inside a process you can have multiple **threads**: workers sharing the same memory.

- **Processes are isolated** — one crashes, others live. Communication between them costs (pipes, sockets, serialization).
- **Threads are roommates** — cheap to talk (shared memory), dangerous to share (two threads writing the same variable = race condition — Part 8 is entirely about this pain).

The scheduling insight that explains "why is my server slow": your 8-core machine can *run* only 8 threads at once. Everything else **waits in line**. But here is the twist that powers all of modern backend engineering:

> Most server work is **waiting** — for the database, for the network, for the disk. A thread that waits doesn't need a core.

That's why a single-threaded Node.js server or Python's async can juggle thousands of connections: they never let a core sit idle while waiting on I/O. And it's why **CPU-bound** work (parsing, compression, ML inference) needs a completely different strategy — more cores, not more async.

Ask this one question about any slow system: **is it waiting (I/O-bound) or computing (CPU-bound)?** The fix for one makes the other worse.

## Debugging with this model

Next time something is slow, walk the layers:

1. `top` / `htop`: CPU at 100%? → CPU-bound: profile the hot loop. CPU idle but slow? → I/O-bound: find what it's waiting for.
2. Memory climbing steadily? → leak. Sawtooth pattern? → normal GC.
3. Thousands of threads? → context-switching tax. One thread at 100% on a 16-core box? → single-threaded bottleneck.

Four checks, one mental model, most incidents.

## Key takeaways

- Performance is mostly about **where your data lives**: register → RAM → disk → network, each step ~100–1000× slower.
- Memory incidents come in two flavors: leaks (heap grows forever → OOM) and GC pauses (latency spikes).
- Compiled vs interpreted vs JIT explains cross-language speed differences — and why numpy/Spark exist.
- Ask "waiting or computing?" before optimizing anything: I/O-bound and CPU-bound problems have opposite cures.

*Next up — Part 3: Data Structures You'll Use for the Rest of Your Career.*
