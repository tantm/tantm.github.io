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

## What you'll learn

- Read `top` as a diagnosis: whether the machine is computing, waiting, or being stolen from.
- Explain exit code 137 and find the OOM killer's paper trail in one command.
- Recognize a file-descriptor leak and know why raising the limit is the wrong fix.
- Run a two-minute triage playbook that covers the five most common production symptoms.

**Prerequisites:** Part 2 (processes, memory, the CPU-bound vs I/O-bound question). No Linux expertise assumed.

## 1. `OOMKilled` — memory is a promise, not a fact

Part 2 introduced the heap; here's the OS's side of the deal. Linux **overcommits** (promises more memory than it has, betting nobody uses all of it at once). When your process asks for memory, the kernel says yes optimistically — pages become real only when *touched*. So "allocated 8 GB fine" and "died touching the 6th GB" can both be true.

When physical memory truly runs out, the **OOM killer** wakes up, scores every process (roughly: biggest consumer wins), and kills one — usually yours, usually mid-request, exit code 137. The triage facts that matter:

- **RSS** (resident, real RAM) is the number to watch, not virtual size — `ps aux` shows both, and the gap between them is the overcommit promise.
- A slow-climbing RSS over days is a leak; a sawtooth is normal garbage collection; a step-jump is that one giant DataFrame someone loaded whole.
- `dmesg | grep -i oom` tells you exactly who was killed and why — the incident's death certificate, and the first command worth memorizing.

## 2. Load average 40 on 8 cores — the run queue

`top` line one: `load average: 40.1, 35.2, 20.0`. Load average is **the average number of processes that want CPU** (running + waiting to run + — on Linux — stuck in uninterruptible disk I/O). Two readings of the same number:

- Load 40, CPU at 100% → forty tasks fighting for eight cores; each gets about a fifth of a core. Classic **CPU-bound** saturation. The machine is computing.
- Load 40, CPU nearly *idle* → forty tasks stuck waiting on disk or a network filesystem. Classic **I/O-bound** pile-up. The machine is waiting — and adding CPU will fix nothing.

That one distinction — same symptom, opposite cures — is most of the value of understanding the scheduler. Treat the scheduler itself as a fair queue that preempts tasks every few milliseconds; the deeper mechanics rarely change what you do next.

One cloud-specific extra: on shared instances, `%st` (steal) is the hypervisor giving your CPU time to someone else. A burstable instance that ran out of credits shows up exactly here.

## 3. `Too many open files` — everything is a file descriptor

Sockets, log files, pipes, database connections — to the kernel they are all **file descriptors**, and every process has a limit (`ulimit -n`, often a few thousand). The classic incident: a service under load starts refusing *new* connections while existing ones work fine, logs full of `EMFILE`.

Ninety percent of the time the cause is a **descriptor leak**: connections opened and never closed on an error path, response bodies abandoned mid-read. The fix is structural, not a bigger limit — the language's `with` / `defer` / try-with-resources constructs exist precisely for this. Raising `ulimit` is legitimate for genuinely busy servers (default limits are conservative), but raising it to *outrun a leak* just reschedules the incident. Diagnosis: `ls /proc/<pid>/fd | wc -l` — watch it climb.

## 4. The deploy that hangs — signals and graceful shutdown

Your orchestrator "stops" a process in two acts: **SIGTERM** ("please finish up") … grace period … **SIGKILL** ("not asking anymore"). SIGKILL cannot be caught — the process gets no chance to flush buffers, commit offsets, or close transactions.

This explains a whole family of incidents: half-written files after deploys, message consumers reprocessing thousands of records because their offsets died with the process, requests dropped mid-flight.

The fix is a *habit*: handle SIGTERM — stop taking new work, finish in-flight work, exit — and make sure that fits inside the grace period.

Two sub-traps worth knowing. In containers, if your app runs behind a shell as PID 1, the signal may never reach it (use `exec` in the entrypoint). And a *zombie* in `top` (state `Z`) is already dead, just waiting for its parent to collect the exit code — a parent bug, not something you can kill again.

## 5. Container throttled — a container *is* a process

The mental model that unlocks modern ops: a container is **not a small virtual machine**. It is a regular Linux process wearing two kernel features: **namespaces** (its own view of filesystem, network, PIDs) and **cgroups** (hard limits on CPU and memory). Three incidents this instantly explains:

- Container `OOMKilled` at 512 MB while the host has 60 GB free — the *cgroup* limit is the wall, not the machine. Section 1, in miniature.
- Service mysteriously slow while host CPU is idle — **CPU throttling**: the cgroup quota ran out for this period; the container waits, invisible to host-level `top`.
- JVM/runtime sized for the host's memory inside a small container — the runtime read the machine, not the cgroup (modern runtimes are container-aware; misconfigured ones repeat this classic).

Everything from Incidents 1–4 applies *inside* the container, with cgroup limits as the new, smaller walls.

## 6. The two-minute triage playbook

The five incidents compress into a fixed sequence:

1. `top` → load vs CPU%: computing, waiting, or stealing (`%st`)?
2. Memory: RSS trend of the suspect (`ps aux --sort=-rss | head`), then `dmesg | grep -i oom` for kills.
3. Descriptors: `ls /proc/<pid>/fd | wc -l` vs `ulimit -n`.
4. State column: `D` (stuck on I/O) or `Z` (zombie — look at the parent).
5. In a container: check cgroup limits *first* — the walls are closer than the machine.

## Practice (20 minutes — cause three of these on purpose)

Run this on any Linux box or container you can afford to stress. Each block reproduces an incident from above, so the symptom becomes something you've *seen*, not read about.

```bash
# 1. Watch memory get promised, then get real (the overcommit gap)
python3 -c "
import time
big = bytearray(300 * 1024 * 1024)      # allocated
print('allocated; check RSS now'); time.sleep(5)
for i in range(0, len(big), 4096): big[i] = 1   # touched -> now it is real RAM
print('touched; check RSS again'); time.sleep(15)" &
sleep 3;  ps -o pid,rss,vsz,cmd -p $!    # VSZ large, RSS small
sleep 12; ps -o pid,rss,vsz,cmd -p $!    # RSS caught up: the promise came due

# 2. CPU-bound vs I/O-bound: same load average, opposite meaning
nproc                                     # how many cores you have
for i in $(seq 1 8); do (while :; do :; done) & done   # 8 CPU burners
uptime; top -bn1 | head -3                # load climbs, %Cpu(s) us near 100
kill %1 %2 %3 %4 %5 %6 %7 %8 2>/dev/null

# 3. File descriptors are countable — watch them climb
python3 -c "
import socket, time, os
socks = []
for i in range(200):
    s = socket.socket(); socks.append(s)      # opened, never closed: the leak shape
print('pid', os.getpid()); time.sleep(20)" &
sleep 2; ls /proc/$!/fd | wc -l; ulimit -n   # count vs ceiling
wait 2>/dev/null

# 4. The death certificate (on a box that has had an OOM kill)
dmesg 2>/dev/null | grep -i -m3 "killed process" || echo "no OOM kills recorded here"
```

Expected results: in block 1 the virtual size (VSZ) jumps immediately while RSS stays small — that gap *is* the overcommit promise — and RSS only catches up once every page is touched. Block 2 pushes load average well above your core count while `%Cpu(s)` sits near 100% in user time: saturation, where more CPU would genuinely help. (An I/O-bound pile-up looks identical on the load line but leaves CPU idle — that's the distinction the playbook turns on.) Block 3 shows descriptors climbing toward a hard ceiling you can print; a leaking service does exactly this, just slower.

## Check yourself

1. A container dies with exit code 137 while the host shows 40 GB of free memory. What happened, and which limit do you check first?
2. Load average is 30 on a 4-core box, but `top` shows CPU mostly idle. What's your diagnosis, and why won't a bigger instance help?
3. After every deploy, your consumer reprocesses thousands of already-handled messages. Which OS mechanism explains it, and what's the fix?

<details><summary>See answers</summary>

1. The OOM killer killed it against the *cgroup* memory limit, not the host's. A container is a process with cgroup walls, and those walls are much closer than the machine's. Check the container's memory limit and the process's RSS trend first; `dmesg` confirms the kill.
2. An I/O-bound pile-up: those 30 tasks are waiting on disk or network, not competing for CPU (on Linux, uninterruptible I/O waits count toward load average). More CPU adds capacity nobody is asking for — look at disk latency, the storage backend, or the remote service instead.
3. The process is being SIGKILLed before it can commit its offsets — either it doesn't handle SIGTERM, or graceful shutdown takes longer than the grace period, or the signal never reaches it because a shell is PID 1. Fix: handle SIGTERM (stop taking new work, finish in-flight, exit), keep it inside the grace period, and `exec` the process in the entrypoint.

</details>

## Key takeaways

- Memory is promised, not granted: watch RSS, and read `dmesg` for the OOM killer's death certificate — exit 137 has a paper trail.
- Load average counts who *wants* CPU: with CPU busy it's saturation, with CPU idle it's an I/O pile-up — opposite cures.
- Sockets and connections are file descriptors with a ceiling; leaks masquerade as capacity problems.
- SIGTERM is a request, SIGKILL a fact — graceful shutdown is a habit, and in containers, cgroup limits are the walls that actually apply.

*Next up — Part 6: What Happens When You Hit Enter on a URL.*
