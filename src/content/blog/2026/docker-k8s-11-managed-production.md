---
title: 'Managed Kubernetes & the ECS Question'
description: 'What EKS-class services actually manage (and what stays yours), the honest EKS-vs-ECS-vs-serverless decision, the real cost of running Kubernetes, and when the answer is "not K8s."'
date: 2026-09-02
category: DevOps
tags: [docker-k8s, kubernetes, aws]
lang: en
translationKey: docker-k8s-11
series: docker-k8s
part: 11
cover: images/s11-p11-hero.png
---


Parts 7–10 taught you Kubernetes concepts. This part asks the grown-up question: **should your team actually run it — and in what form?** The honest answer for most teams involves the word "managed", often involves ECS-class simplicity, and sometimes involves no orchestrator at all. Knowing the concepts *and* declining to operate them is a senior position, not a cop-out.

## What you'll learn

- Say what a managed Kubernetes service takes off your plate — and the long list that stays on it.
- Choose between EKS-class, ECS-class, and serverless containers using workload and team shape.
- Estimate the *real* cost of running K8s: the platform tax measured in engineer-time.
- Recognize the three situations where the right answer is not Kubernetes at all.

**Prerequisites:** Parts 6–10 (the concepts being bought/managed). S04-P08's compute options map is the AWS-side view of today's decision.

## 1. What "managed" actually manages

An EKS-class service (EKS, GKE, AKS) runs the **control plane** for you: the API server, etcd, the scheduler — highly available, patched, backed up. That's the part that's genuinely miserable to self-host, and $70-ish a month buys your way out of it. Full stop, that's the product.

Now the honest list of what's **still yours**: node pools (sizing, upgrading, patching the OS), cluster version upgrades (quarterly-ish, with deprecation homework — the treadmill never stops), networking add-ons, the ingress controller (Part 8's "rules need an engine"), monitoring, secrets integration, RBAC design, cost management, and every workload decision from Parts 7–10. "Managed Kubernetes" manages the engine; **you still drive, fuel, insure, and service the car.** Teams hear "managed" and expect Heroku; they get a well-maintained engine block.

## 2. The three-way decision, honestly

Part 6 previewed the table; now you have the vocabulary to use it. The differentiator isn't features — all three run containers behind load balancers with autoscaling. It's **how much platform you want to own**:

- **Serverless containers** (Fargate/Cloud Run-class): you own an image and a CPU/RAM number. No nodes exist for you. Scales to zero. Limits: cold starts, no daemonsets/privileged pods, per-vCPU pricing that crosses over at sustained load.
- **ECS-class**: task definitions instead of Pod YAML, deep native integration with its cloud's LB/IAM/logging, a fraction of K8s's conceptual surface. Limit: single-cloud, smaller ecosystem, fewer escape hatches when you want something exotic.
- **Kubernetes (managed)**: the full concept set you just learned, the entire CNCF ecosystem (operators, Helm charts, service meshes), portability across clouds, and the hiring-market standard. Cost: everything in section 1's "still yours" list.

The shape of the right answer by team: **product team with a handful of services on one cloud → ECS-class or serverless. Platform team serving many product teams, or genuinely needing the ecosystem (operators, GPU scheduling, multi-cloud) → managed K8s.** The concepts you learned transfer regardless — an ECS task definition is a Pod template with different field names; a service is a Deployment plus a Service. You'll read both fluently now.

## 3. The platform tax, measured in humans

The line item that doesn't appear on the cloud bill: **who upgrades the cluster?** A real K8s installation needs someone (realistically a rotation) tracking version deprecations, testing upgrades in staging, maintaining the ingress/monitoring/secrets stack, and answering "why is my pod Pending?" questions from other teams. Industry shorthand: that's meaningful fractions of one to several engineers, continuously — a **platform tax** paid in your scarcest currency, engineer attention (the same budget argument as S11-P09's database question, one level up).

The tax is worth paying when it's *amortized*: a platform team serving ten product teams pays it once, and each team gets Part 10's deploy patterns as a paved road. A three-person startup paying the same tax for two services is spending a third of its engineering on plumbing. Same tool, opposite verdicts — the divisor is the number of teams served.

## 4. When the answer is "not Kubernetes"

Three honest exits, all respectable:

1. **Part 6's checklist never flipped.** One or two machines, tolerant deploy windows, one person understands the system → Compose on a VM plus a deploy script remains a *professional* choice, not a temporary embarrassment.
2. **Spiky or low traffic** → serverless containers: scale-to-zero beats cluster-idle economics, and the ops surface rounds to nil.
3. **AWS-native product team** → ECS-class: 80% of the benefit, 20% of the concept count. This is the "ECS question" answered without tribalism: choosing the smaller tool *because you understand the bigger one* is engineering; choosing it because you're afraid of the bigger one is luck.

The trap to avoid in 2026 is résumé-driven infrastructure: adopting K8s because it's the standard, without a platform team, then discovering the treadmill in month three. The reverse trap exists too — outgrowing ECS (multi-cloud mandate, operator-shaped needs) and delaying the migration out of sunk cost. The concepts are portable; re-deciding yearly is cheap compared to operating the wrong answer.

## Practice (20 minutes — decision exercise, no cluster)

Take a system you know well (or the compose stack from Part 4) and write a one-page decision memo:

1. **Workload shape:** services count, traffic pattern (steady/spiky/zero-at-night), anything exotic (GPUs, daemons, privileged)?
2. **Team shape:** who would own the platform? Is there a platform team, or would product engineers pay the tax?
3. **Score the three options** with the section 2 lens; eliminate any that fail a hard constraint.
4. **Write the verdict as one sentence with a revisit trigger:** "We choose X; we revisit when Y" (e.g., "ECS; revisit at 3+ teams or a multi-cloud requirement").

Expected results: a memo whose verdict follows from stated constraints, not preference — and a revisit trigger, which is what separates a decision from a religion. Compare with a colleague's memo for a different system; the verdicts *should* differ.

## Check yourself

1. A CTO says "we bought EKS, so Kubernetes is handled." What's the accurate correction?
2. A 4-engineer startup runs three steady-traffic services on AWS. Which option and why — and what would change the answer?
3. Why do the Kubernetes concepts from Parts 7–10 still pay off if your team picks ECS or serverless?

<details><summary>See answers</summary>

1. EKS manages the control plane (API server, etcd, scheduler). Node lifecycle, version upgrades, ingress, monitoring, RBAC, and all workload decisions remain the team's job — "managed" buys the engine, not the driving.
2. ECS-class (or serverless if traffic is spiky): single cloud, few services, no platform team — K8s's tax has no divisor here. The answer changes when a platform team exists, service/team count grows, or ecosystem needs (operators, GPU scheduling, portability) appear.
3. Because the concepts are the industry's shared vocabulary for orchestration: desired state, replicas, probes, rolling deploys, requests/limits all exist in every option under different names. Learning them once makes every platform readable — and makes the choice between platforms an informed one.

</details>

## Key takeaways

- Managed K8s manages the control plane; nodes, upgrades, ingress, monitoring, and all workload decisions stay yours — an engine, not a chauffeur.
- Choose by platform ownership: serverless (own an image), ECS-class (own services on one cloud), K8s (own a platform — best amortized across many teams).
- The real cost is the platform tax in engineer attention; it's justified by the number of teams it serves, not by the workload's size.
- "Not Kubernetes" is a professional answer three ways: Compose-on-VM, serverless, ECS-class — strongest when chosen by someone who understands what they're declining.

*Next — Part 12: CI/CD, Security & Thinking in Containers.*
