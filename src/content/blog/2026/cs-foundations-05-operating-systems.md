---
title: 'The OS Concepts Behind Every Production Incident'
description: 'OOMKilled, "too many open files", load average 40, zombie processes — five OS ideas, each taught by the incident it explains, plus a two-minute triage playbook.'
date: 2026-07-30
category: Developer
tags: [cs-foundations, os, linux]
lang: en
translationKey: cs-foundations-05
series: cs-foundations
part: 5
---

Operating systems is the course everyone sleeps through and then meets again, at 2 a.m., in a production incident. So this part teaches it backwards: **five real incident messages first, the OS concept that explains each one second.** By the end, `top` stops being a wall of numbers and becomes a story you can read.

## Incident 1: `OOMKilled` — memory is a promise, not a fact

Part 2 introduced the heap; here's the OS's side of the deal. Linux **overcommits**: when your process asks for memory, the kernel says yes optimistically — pages become real only when *touched*. So "allocated 8 GB fine" and "died touching the 6th GB" can both be true.

When physical memory truly runs out, the **OOM killer** wakes up, scores every process (roughly: biggest consumer wins), and kills one — usually yours, usually mid-request, exit code 137. The triage facts that matter:

- **RSS** (resident, real RAM) is the number to watch, not virtual size — `ps aux` shows both, and the gap between them is the overcommit promise.
- A slow-climbing RSS over days is Part 2's leak; a sawtooth is normal GC; a step-jump is that one giant DataFrame (S02-P03's 5–10× rule striking again).
- `dmesg | grep -i oom` tells you exactly who was killed and why — the incident's death certificate, and the first command worth memorizing.

## Incident 2: load average 40 on 8 cores — the run queue

`top` line one: `load average: 40.1, 35.2, 20.0`. Load average is **the average number of processes that want CPU** (running + waiting to run + — on Linux — stuck in uninterruptible disk I/O). Two readings of the same number:

- Load 40, CPU at 100% → forty tasks fighting for eight cores; each gets ~1/5 of a core. Classic **CPU-bound** saturation (Part 2's question answered: computing).
- Load 40, CPU nearly *idle* → forty tasks stuck waiting on disk or NFS. Classic **I/O-bound** pile-up (answer: waiting) — and adding CPU will fix nothing.

That one distinction — same symptom, opposite cures — is most of the value of understanding the scheduler. The scheduler itself you can treat as a fair queue that preempts tasks every few milliseconds; the deeper mechanics rarely change what you do next. (One cloud-specific extra: on shared instances, `%st` — steal — is the hypervisor giving your CPU time to someone else. A `t`-family instance out of credits, S04-P03's trap, shows up exactly here.)

## Incident 3: `Too many open files` — everything is a file descriptor

Sockets, log files, pipes, database connections — to the kernel they are all **file descriptors**, and every process has a limit (`ulimit -n`, often a few thousand). The classic incident: a service under load starts refusing *new* connections while existing ones work fine, logs full of `EMFILE`.

Ninety percent of the time the cause is a **descriptor leak**: connections opened and never closed on an error path, response bodies abandoned mid-read. The fix is structural, not a bigger limit — the language's `with` / `defer` / try-with-resources constructs exist precisely for this. Raising `ulimit` is legitimate for genuinely busy servers (default limits are conservative), but raising it to *outrun a leak* just reschedules the incident. Diagnosis: `ls /proc/<pid>/fd | wc -l` — watch it climb.

## Incident 4: the deploy that hangs — signals and graceful shutdown

Your orchestrator "stops" a process in two acts: **SIGTERM** ("please finish up") … grace period … **SIGKILL** ("not asking anymore"). SIGKILL cannot be caught — the process gets no chance to flush buffers, commit offsets, or close transactions.

The incident family this explains: half-written files after deploys, Kafka consumers reprocessing thousands of messages (their offsets died with the process — S07-P06's at-least-once delivery meets its cause), requests dropped mid-flight. The fix is a *habit*: *handle SIGTERM* — stop taking new work, finish in-flight work, exit — and make sure it fits the grace period. In containers there's a classic sub-trap: if your app runs behind a shell as PID 1, the signal may never reach it (`exec` your process in the entrypoint). And when a *zombie* appears in `top` (state `Z`): it's already dead, just waiting for its parent to collect the exit code — a parent bug, not a thing you can kill again.

## Incident 5: container throttled — a container *is* a process

The mental model that unlocks modern ops: a container is **not a small virtual machine**. It is a regular Linux process wearing two kernel features: **namespaces** (its own view of filesystem, network, PIDs) and **cgroups** (hard limits on CPU and memory). Three incidents this instantly explains:

- Container `OOMKilled` at 512 MB while the host has 60 GB free — the *cgroup* limit is the wall, not the machine (Incident 1, in miniature).
- Service mysteriously slow while host CPU is idle — **CPU throttling**: the cgroup quota ran out for this period; the container waits, invisible to host-level `top`.
- JVM/runtime sized for the host's memory inside a small container — the runtime read the machine, not the cgroup (modern runtimes are container-aware; misconfigured ones repeat this classic).

Everything from Incidents 1–4 applies *inside* the container, with cgroup limits as the new, smaller walls.

## The two-minute triage playbook

The five incidents compress into a fixed sequence — an extension of Part 2's debugging walk:

1. `top` → load vs CPU%: computing, waiting, or stealing (`%st`)?
2. Memory: RSS trend of the suspect (`ps aux --sort=-rss | head`), then `dmesg | grep -i oom` for kills.
3. Descriptors: `ls /proc/<pid>/fd | wc -l` vs `ulimit -n`.
4. State column: `D` (stuck on I/O) or `Z` (zombie — look at the parent).
5. In a container: check cgroup limits *first* — the walls are closer than the machine.

## Key takeaways

- Memory is promised, not granted: watch RSS, and read `dmesg` for the OOM killer's death certificate — exit 137 has a paper trail.
- Load average counts who *wants* CPU: with CPU busy it's saturation, with CPU idle it's an I/O pile-up — opposite cures.
- Sockets and connections are file descriptors with a ceiling; leaks masquerade as capacity problems.
- SIGTERM is a request, SIGKILL a fact — graceful shutdown is a habit, and in containers, cgroup limits are the walls that actually apply.

*Next up — Part 6: What Happens When You Hit Enter on a URL.*
