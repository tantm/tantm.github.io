---
title: 'CloudWatch & X-Ray: See Your System'
description: 'Metrics, logs, and traces as three answers to different questions, structured logging as the keystone habit, and alarms designed from user symptoms — not from every red square.'
date: 2026-08-04
category: Cloud
tags: [aws, cloudwatch, observability]
lang: en
translationKey: aws-10
series: aws-zero-to-advanced
part: 10
---

Everything you've built in this series so far can fail silently. The EC2 fleet (P03) can grind at 100% CPU, the Lambda (P07) can throttle, the queue (P09) can quietly grow for six hours — and without observability, your monitoring system is *your users*, and your dashboard is Twitter. This part is the seeing layer: what the three signal types actually answer, the one logging habit that makes everything else work, and how to design alarms you won't learn to ignore.

## Three signals, three questions

```mermaid
flowchart LR
  M["METRICS<br/>numbers over time<br/>'Is something wrong?'"] --> L["LOGS<br/>events with detail<br/>'What exactly happened?'"]
  L --> T["TRACES<br/>one request's journey<br/>'Where did it happen?'"]
  T -.->|new hypothesis| M
```

- **Metrics** are cheap numbers over time (CPU, request count, error rate, queue depth). They're the *detection* layer: aggregated, always-on, alarm-able. They tell you *that* something is wrong and roughly where — never why.
- **Logs** are the *explanation* layer: individual events with full detail. Expensive to store (this is where the observability bill lives), rich enough to debug from.
- **Traces** (X-Ray-style) answer the microservice question: one request touched the load balancer, two services, a queue, and a database — *which hop* burned the 3 seconds? A trace is CS-P6's `curl -w` timing breakdown, propagated across your whole distributed system via a correlation ID.

The debugging loop runs left to right: an alarm on a metric → filtered logs for the window → a trace for the slow/failed request. Teams that only have logs do archaeology; teams that only have metrics know they're down but not why.

## Structured logging: the keystone habit

Everything downstream depends on one decision made in your application code: **log JSON, one event per line, with a correlation ID.**

```json
{"level": "ERROR", "ts": "2026-08-04T03:12:09Z", "request_id": "r-8f3a",
 "route": "/checkout", "duration_ms": 4210, "error": "payment_timeout"}
```

Prose logs (`"something went wrong :("`) are for humans reading one line; structured logs are for *machines answering questions*: CloudWatch Logs Insights can then compute "p95 duration by route for the last hour" or "all events for request r-8f3a" — which is your S02's SQL instinct pointed at operational data. The two companion rules: **propagate the request ID** through every hop (each service logs it; the queue message carries it — it's the poor engineer's trace, and traces are built on the same idea), and **never log secrets or raw PII** (CS-P11: logs are a data store with the *weakest* access controls in your company; a token in a log line is a leaked token).

Know the platform defaults: Lambda logs stdout automatically; containers (P08) ship stdout via their log driver — "print JSON to stdout" is the whole integration. And set **retention on every log group** the day it's created: logs default to keep-forever, and unbounded log storage is S07-P12's versioning bill wearing an observability costume.

## Metrics and dashboards worth having

CloudWatch gives you infrastructure metrics free (CPU, network, queue depth); the ones that matter most you **emit yourself** — orders placed, payments failed, report freshness — because *business* metrics detect what infrastructure metrics can't: the deploy where CPU is perfect and zero orders complete. Emit them via metric filters on your structured logs (no extra code path) or the embedded metrics format.

For dashboards, resist the 40-widget shrine. The working pattern is one screen per service answering four questions — the RED/USE compression: **rate, errors, duration** for request-driven things; **utilization, saturation, errors** for resources (P05's load lesson: saturation — the run queue — hurts before utilization does). Percentiles, not averages: p50 tells you the typical experience, **p99 tells you the truth about your worst users** — a 200ms average hides the 8-second checkout that's costing you customers.

## Alarms you won't learn to ignore

The failure mode of monitoring isn't too few alarms — it's *too many*: a channel with 50 daily red squares trains everyone to mute it, and the real incident scrolls past unread (S02-P08's basket discipline, cloud edition). Design rules:

- **Alarm on symptoms, not causes.** Page on "p99 latency > 2s" and "error rate > 1%" and "oldest message age > 15 min" (P09) — the things users feel. High CPU with normal latency is a *fact*, not an *incident*; it goes on the dashboard, not the pager.
- **Every page must be actionable.** If the response to an alarm is "acknowledge and move on," delete it or demote it to a ticket. An alarm is a contract: *this fired, so a human must do something now.*
- **Alarm on absence too**: the cron that didn't run, the daily file that didn't arrive, the "heartbeat missing" alarm — silent-death detection is where queue-based systems (P09) and batch pipelines (S02-P08's SLA miss) fail quietly.
- **Composite alarms cut noise**: page when *both* error rate and latency degrade; either alone is a dashboard fact.

Close the loop with cost awareness: observability is a real line item (per-GB ingestion, per-metric, per-dashboard), and the S07-P12 lens applies — sample debug logs, keep INFO terse, retain ERROR longer than DEBUG. Seeing everything forever is a bill, not a virtue.

## Key takeaways

- Metrics detect, logs explain, traces locate — the debug loop runs alarm → filtered logs → trace, and you need all three layers cheap-to-expensive.
- Structured JSON logs with a propagated request ID are the keystone habit: they turn logs into a queryable database and make tracing possible — and they never contain secrets.
- Emit business metrics yourself, chart percentiles not averages, and keep dashboards to one RED/USE screen per service.
- Alarm on user symptoms, make every page actionable, alarm on absence, and set log retention day one — a monitoring system you've learned to ignore is more dangerous than none.

*Next up — Part 11: Infrastructure as Code with Terraform.*
