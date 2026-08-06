---
title: 'From School Project to Production System'
description: "The gap between 'it runs' and 'it's in production' is a checklist, not a mystery — the deploy pipeline, operability, on-call demystified, and the map of everything this series built."
date: 2026-08-04
category: Developer
tags: [cs-foundations, devops, career]
lang: en
translationKey: cs-foundations-12
series: cs-foundations
cover: images/s01-p12-hero.png
part: 12
---

A school project is done when it runs once, on your machine, for the demo. A production system is never done — it runs *unattended*, for *strangers*, under *load you didn't pick*, and it fails at 3 a.m. (P5 taught you what the incident looks like from the inside). The gap between those two states scares every new grad, and it shouldn't: it's not a mystery, it's a **checklist** — and this series has quietly handed you every item on it. This finale assembles the pieces and tells you what on-call actually is.

## What you'll learn

- Trace the path from a push to a stranger using your code, naming each gate.
- Build the five operability features nobody demos but everybody needs at 3 a.m.
- Approach on-call as a mechanical practice rather than a personality trait.
- See the whole twelve-part map as one system.

**Prerequisites:** Parts 9–11 (CI, testing, security) are the pieces this part assembles.

## 1. The pipeline: how code reaches strangers

```mermaid
flowchart LR
  C[git push] --> R[Code review — P9]
  R --> CI[CI: tests + checks — P9]
  CI --> B[Build artifact:<br/>container image — P5]
  B --> S[Deploy to staging]
  S --> P2[Deploy to prod<br/>gradually]
  P2 --> M[Monitor — watch it land]
  M -.->|something's wrong| RB[Rollback]
```

Nothing in this pipeline is new to you — it's P9's review and CI with two production-grade additions. First, **the artifact**: you don't deploy "the code," you deploy a *built, versioned, immutable thing* (usually a container image — P5's "process + cgroups"), the same artifact in staging and prod, so "works in staging" actually means something. Second, **rollback is a first-class button**: because the previous artifact still exists, going back is redeploying it — minutes, not a frantic 2 a.m. code fix. The senior habits that follow: **deploy small and often** (a 10-line deploy that breaks is a 10-line search space; three weeks of changes is an excavation — P9's small-diff rule at system scale), **roll out gradually** (a few instances first; the deploy that breaks 5% of traffic for two minutes is an anecdote, not an incident), and **never deploy what you can't roll back** — which is why database migrations get the expand-then-contract treatment: add the new column, ship code that works with both, remove the old one a release later (P7's schema care, deploy edition).

## 2. Operability: the features nobody demos

The difference between code that runs and a system that *operates* is a short list of unglamorous features, all of which you've met:

- **Config outside code** (P11's secrets discipline generalized): the same artifact must run in dev/staging/prod — behavior differences come from environment, not from `if env == "prod"` edits.
- **Logs someone can use at 3 a.m.**: structured, with request IDs, honest levels (a false ERROR trains people to ignore ERROR — the boy who cried wolf is an operability bug).
- **Health checks and graceful shutdown** (P5's SIGTERM): the platform restarts what fails and drains what's replaced; your app's job is to report honestly and die cleanly.
- **Timeouts, retries with backoff, idempotency** (P6, P8): every network call your system makes will eventually hang, and every retry will eventually double-fire. You've known the fixes since the concurrency part.
- **A dashboard answering "is it working?"** in four numbers — rate, errors, duration, saturation (P5's resources) — and *alarms on symptoms, not causes*.

None of these earn a demo slide. All of them decide whether the person on call — soon: you — sleeps.

## 3. On-call, demystified

On-call terrifies juniors mostly through mystique, so here is the job description in one paragraph: *carry the pager for a week; when an alarm fires, follow the runbook; if the runbook doesn't cover it, mitigate first, understand later; write down what happened.* The keywords: **runbook** — the checklist written in calm daylight ("if the queue backs up: check consumer logs, check the DLQ, scale consumers, here's how") that converts 3 a.m. panic into 3 a.m. procedure; **mitigate first** — rollback (above), restart, failover; root cause is a daylight activity (your P5 triage playbook is exactly this); and **blameless postmortem** — the write-up asks "what made this failure possible?", never "who?", because a culture that punishes the person guarantees the *system* stays broken (P9's review culture, applied to failure). On-call is also, quietly, the fastest teacher in this industry: one rotation teaches you more about how systems actually behave than a semester — every incident is a pop quiz on parts 2 through 11.

## 4. The map, assembled

Look back at what this series actually built — not twelve topics, but one system of instincts: the machine and its costs (P2–P4), the OS under fire (P5), the network's four acts (P6), data that survives (P7), concurrency's one bug shape (P8), the craft loop of git/tests/review (P9), abstraction as a loan (P10), input-is-code security (P11), and now the pipeline that ships it all. That's the 20% of the degree that runs the other 80% of your career.

Where next, by appetite: building data systems → the **Data Engineer Roadmap** (S02) starts where P7 ended; AI systems → the **AI Engineer Roadmap** (S03) picks up from P8's async instincts and P11's threat model; the cloud itself → **AWS from Zero to Advanced** (S04), where P5/P6 become services with bills; and when you're ready to think in whole systems → **Data Platform Architectures** (S07). Every one of them assumes exactly what you now have.

## Practice (30 minutes — build the whole pipeline for a one-file app)

Everything in this part fits in a single GitHub repository, and building it once makes the concepts permanent. Use any tiny app you like:

```yaml
# .github/workflows/ship.yml — the four gates, in cost order
name: ship
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: python -m pytest -q                    # gate 1: does it work?
      - run: python -m pip check                    # gate 2: are deps sane?

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t app:${{ github.sha }} .   # gate 3: an IMMUTABLE artifact,
      - run: docker run --rm app:${{ github.sha }} --version   #        named by commit

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production                          # gate 4: a human approval, recorded
    steps:
      - run: echo "deploying app:${{ github.sha }}"   # your real deploy step goes here
```

Then add the operability features to the app itself — each is a few lines and each earns its place:

```python
import os, sys, json, signal, logging, time

VERSION = os.environ.get("GIT_SHA", "dev")           # 1. it can say which build it is
health = {"ready": False}

def handle_sigterm(*_):                              # 2. it shuts down on purpose
    logging.info(json.dumps({"event": "shutdown", "version": VERSION}))
    health["ready"] = False; time.sleep(0.5); sys.exit(0)
signal.signal(signal.SIGTERM, handle_sigterm)

def healthz(): return {"status": "ok", "version": VERSION}          # 3. liveness
def readyz():  return {"ready": health["ready"], "version": VERSION} # 4. readiness ≠ liveness

logging.basicConfig(format="%(message)s", level=logging.INFO)        # 5. structured logs
logging.info(json.dumps({"event": "startup", "version": VERSION,
                         "config_source": "env"}))                   #    config from env, not code
health["ready"] = True
```

Expected results: the pipeline gives you the property that makes rollback a button rather than a project — the artifact is named by commit SHA, so "roll back" means deploying a tag that already exists and was already tested. Do one deliberate rollback to feel it. The five app features look trivial individually, but together they're what separates a service you can operate from one you can only restart: version in every log line means you know *which* build broke, readiness separate from liveness means a deploy doesn't send traffic to a process that isn't ready, and SIGTERM handling means deploys stop cutting requests in half.

## Check yourself

1. Your deploy pipeline rebuilds the image at each stage — once for staging, once for production. What's wrong with that?
2. A health check returns 200 whenever the process is alive. What incident does this design cause during a deploy?
3. Production is broken and the cause isn't obvious. What's the first thing you do?

<details><summary>See answers</summary>

1. You're testing one artifact and shipping a different one. Even with identical source, the two builds can differ — a dependency published a new patch version, a base image moved. Build once, then promote the *same* immutable artifact through each environment; that's what makes staging evidence rather than theater.
2. It causes traffic to be sent to instances that are running but not ready — still loading config, warming a cache, or waiting on a database connection. Users get errors from a deploy that the dashboard calls successful. Liveness answers "should I be restarted?"; readiness answers "should I receive traffic?" — they need to be different endpoints.
3. Mitigate first, diagnose after: roll back to the last known-good artifact, or disable the feature flag. Restoring service is the priority, and the evidence you need for diagnosis (logs, metrics, the artifact itself) is preserved either way. Debugging in production while users are affected is the instinct to unlearn.

</details>

## Key takeaways

- Production = the checklist, not a mystery: versioned immutable artifacts, staged gradual deploys, rollback as a button, expand-then-contract migrations.
- Operability features — config outside code, honest structured logs, health checks, timeouts/retries/idempotency, a four-number dashboard — decide whether on-call sleeps; build them in from day one.
- On-call is runbooks + mitigate-first + blameless postmortems, and it's the fastest teacher you'll ever have.
- The series is one system of instincts, and the roadmaps (S02 data, S03 AI, S04 cloud, S07 architecture) each start exactly where it ends. Series complete — go build something that runs for strangers.
