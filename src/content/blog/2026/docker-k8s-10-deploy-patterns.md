---
title: 'Deploy Patterns: Rolling, Blue-Green, Canary'
description: 'The three ways to replace running software, what rollback really means in each, how readiness probes make zero-downtime true, and HPA autoscaling — with the honest costs.'
date: 2026-08-26
category: DevOps
tags: [docker-k8s, kubernetes, devops]
lang: en
translationKey: docker-k8s-10
series: docker-k8s
part: 10
cover: images/s11-p10-hero.png
draft: true
---


Part 7 taught you to *declare* a new image and let the loop converge. This part is about **how** that convergence happens — because "replace v1 with v2 on a live system" has three classic answers with different costs, different rollback stories, and different failure modes. Plus the fourth pattern that changes *how many* instead of *which*: autoscaling.

## What you'll learn

- Choose between rolling, blue-green, and canary with a cost/risk table instead of fashion.
- Configure a rolling update's two knobs and explain what `kubectl rollout undo` actually does.
- Say precisely why readiness probes (Part 8) are what makes "zero-downtime" true.
- Set up HPA (Horizontal Pod Autoscaler) and avoid its classic misconfiguration.

**Prerequisites:** Parts 7–8 — Deployments, Services, and both probes. The practice needs a local cluster.

## 1. Rolling update: the built-in default

A Deployment already does rolling updates — replace Pods a few at a time, gated by readiness:

```yaml
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1     # at most 1 below desired count during the roll
      maxSurge: 2           # at most 2 extra Pods during the roll
```

Change the image, apply, and the loop replaces Pods in waves: start new → wait for `/ready` → shift traffic → retire old. The two knobs trade **speed against capacity**: high `maxSurge` rolls fast but needs headroom; high `maxUnavailable` rolls fast but serves with fewer Pods meanwhile.

This is where Part 8's readiness probe stops being theory: **a new Pod receives zero traffic until `/ready` says yes.** No probe (or a probe that lies and returns 200 while the app still warms up) = users hitting half-initialized Pods = the "zero-downtime deploy" that drops requests anyway. The probe *is* the zero in zero-downtime.

Rollback is built in: `kubectl rollout undo deployment/web` — which is just another rolling update, backwards, to the previous Pod template. (Note what it does *not* undo: your database migration. Schema changes need their own compatibility plan — deploy patterns move *stateless* things safely.)

## 2. Blue-green: two environments, one switch

Run two full copies: **blue** (current, serving) and **green** (new, idle). Deploy v2 to green, test it against real infrastructure, then flip the router — in Kubernetes terms, patch the Service's selector from `version: blue` to `version: green`. All traffic moves at once.

- **The good:** instant, total cutover; instant, total rollback (flip back); green is testable in production conditions *before* any user sees it.
- **The honest costs:** double capacity while both run; the flip is all-or-nothing — if v2 has a bug that only shows at full traffic, 100% of users meet it at once; and stateful concerns (sessions, in-flight requests, DB schema shared by both colors) need real thought.

Blue-green shines when releases are infrequent and rollback speed is the top priority — and when someone else pays for the duplicate capacity (Part 11's managed platforms often make this a checkbox).

## 3. Canary: let 5% find out first

Ship v2 to a small slice, watch error rates and latency, then widen: 5% → 25% → 100%. The name is the coal-mine bird: a small sacrifice detects the poison before everyone breathes it.

The plain-Kubernetes trick: Services route by label to *ready Pods across multiple Deployments*. Run `web-stable` with 9 replicas and `web-canary` with 1 — same labels, different image — and the Service splits traffic ~10% by Pod count. It works, but it's coarse (percentages move in replica-sized steps) and manual (you watch dashboards and scale by hand). Real traffic-percentage control and automated promote/rollback come from the ingress/service-mesh layer or progressive-delivery tools (Argo Rollouts/Flagger-class) — worth knowing they exist, worth *not* adopting before someone actually asks for canary.

The uncomfortable truth about canary: **it's only as good as your monitoring.** A canary nobody watches is just a slow rolling update. The pattern's real cost isn't compute — it's the dashboards, alerts, and "what metric decides promote vs rollback?" discipline.

## 4. HPA: changing how many, automatically

The **Horizontal Pod Autoscaler** watches a metric and adjusts `replicas` between bounds:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: web }
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
```

Reconciliation again, one level up: desired count is now *computed* from load. The classic misconfiguration: HPA computes utilization **as a percentage of the Pod's `resources.requests`** (Part 7). No requests set → HPA has no denominator → it does nothing (or nonsense). Requests aren't optional bookkeeping; they're the number autoscaling does math on.

Second honest note: HPA handles *gradual* load changes. A traffic spike that 10×s in seconds outruns the scale-up loop (new Pods need pull + start + ready time) — for that you need headroom (`minReplicas` above the trough) or a queue absorbing the burst (the DE series' buffering instinct, applied to serving).

## 5. Choosing: the table

| | Rolling | Blue-green | Canary |
|---|---|---|---|
| Extra capacity | ~`maxSurge` | ×2 full copies | One slice |
| Rollback speed | Minutes (reverse roll) | Seconds (flip back) | Seconds (kill canary) |
| Blast radius of a bad release | Grows during the roll | 100% at flip | The canary % |
| Needs | Readiness probes | Router switch + double infra | Real monitoring + patience |
| Default when | Most services, most days | Rare, high-stakes releases | High-traffic, metric-rich services |

Boring default: rolling, with honest probes. Graduate to canary when traffic and monitoring justify it; reach for blue-green when rollback-in-seconds is worth double infrastructure.

## Practice (25 minutes — local cluster)

```bash
# 1. A deployment with an OLD image and honest probes (use section 1's strategy block)
kubectl create deployment web --image=nginx:1.26 --replicas=4 --dry-run=client -o yaml > web.yaml
#    edit web.yaml: add the strategy block + a readinessProbe on port 80, then:
kubectl apply -f web.yaml && kubectl expose deployment web --port 80

# 2. Watch a rolling update happen wave by wave (two terminals)
#    T1:
kubectl get pods -w
#    T2:
kubectl set image deployment/web nginx=nginx:1.27
kubectl rollout status deployment/web          # narrates the waves

# 3. Roll back — and check the history
kubectl rollout undo deployment/web
kubectl rollout history deployment/web

# 4. A poor man's canary: second deployment, same labels
kubectl create deployment web-canary --image=nginx:1.27 --replicas=1
kubectl label deployment web-canary app=web --overwrite   # ensure selector match on pods (edit template labels)
kubectl get endpoints web                      # canary pod appears among the stable ones

# 5. Clean up
kubectl delete deployment web web-canary; kubectl delete service web
```

Expected results: step 2's watch shows surge Pods appearing, turning Ready, and old Pods terminating — never more than `maxUnavailable` below 4. Step 3 returns to 1.26 via the same wave mechanics. Step 4's endpoints list shows ~1 in 5 endpoints is the canary — traffic splitting by Pod count, visible in the Service's endpoint set.

## Check yourself

1. A team claims zero-downtime rolling deploys but has no readiness probes. What actually happens during a roll?
2. When is blue-green worth double the infrastructure — and what's its worst-case failure mode versus canary's?
3. Your HPA never scales up despite obvious load. What's the first field to check, and why?

<details><summary>See answers</summary>

1. New Pods join the Service the moment their container starts — including during warm-up, before the app can serve. Users hit half-initialized Pods and get errors/timeouts; the deploy "succeeds" while dropping requests. Readiness gating is what makes the claim true.
2. When rollback-in-seconds matters more than cost — rare, high-stakes releases. Worst case: a bug that only appears at full traffic hits 100% of users at the flip; canary's equivalent bug hits only the canary percentage, which is the whole point of paying canary's monitoring cost.
3. `resources.requests` on the target Pods. HPA computes utilization as a percentage of requests; with no requests there's no denominator, so the autoscaler can't act. Requests are the number the math runs on.

</details>

## Key takeaways

- Rolling is the built-in default: two knobs (surge/unavailable), waves gated by readiness — and the probe is what makes zero-downtime true.
- Blue-green buys seconds-fast rollback for double capacity; its flip is all-or-nothing. Canary buys small blast radius for real monitoring discipline.
- `rollout undo` reverses the Pod template, not your database — schema changes need their own compatibility plan.
- HPA is reconciliation over *count*: it does math on `resources.requests` (no requests, no autoscaling) and handles gradual load, not instant spikes.

*Next — Part 11: Managed Kubernetes & the ECS Question.*
