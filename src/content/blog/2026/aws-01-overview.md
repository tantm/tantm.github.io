---
title: 'The AWS Map: 200 Services, 20 That Matter'
description: 'How AWS is actually organized, the twenty services worth learning, and a four-tier path from your first IAM user to designing real architectures.'
date: 2026-07-27
category: Cloud
tags: [aws, cloud, aws-zero-to-advanced, career]
lang: en
translationKey: aws-01
series: aws-zero-to-advanced
part: 1
cover: images/aws-learning-path.png
---

Open the AWS console for the first time and you are greeted by more than two hundred services with names like Fargate, Glue, and Snowball. It looks like you need years just to know what exists.

Good news: you don't. Real systems — including very large ones — are built from a surprisingly small core. This series walks that core in four tiers, sixteen parts, from "I have never touched cloud" to "I can design and defend an architecture".

![The AWS Map: 200 Services, 20 That Matter](images/aws-learning-path.png)

## First, the mental model

Three ideas organize everything else:

- **Regions and Availability Zones.** AWS is physical: data centers grouped into AZs, AZs grouped into Regions. High availability means "survives an AZ failure"; disaster recovery means "survives a Region failure". Price and latency differ by Region.
- **Everything is an API.** The console is just a UI over APIs. This is why infrastructure can be code (Tier 3) — and why credentials that call those APIs are the crown jewels (also Tier 3).
- **Shared responsibility.** AWS secures the cloud; you secure what you put *in* it. Most cloud incidents in the news are on the customer side of that line — usually a misconfiguration.

## The four tiers

```mermaid
flowchart LR
    T1["Tier 1<br/>Foundations<br/><i>IAM · EC2 · S3 · VPC</i>"] --> T2["Tier 2<br/>Builder<br/><i>RDS · DynamoDB · Lambda · ECS · SQS/SNS</i>"]
    T2 --> T3["Tier 3<br/>Operator<br/><i>CloudWatch · IaC · KMS & Secrets</i>"]
    T3 --> T4["Tier 4<br/>Architect<br/><i>Data & AI services · Well-Architected · Cost</i>"]
```

### Tier 1 — Foundations (Parts 2–5)

Four building blocks that everything else stands on:

- **IAM** — who can do what. The first service to learn, because a mistake here undermines everything else.
- **EC2** — a server you rent by the second. Even in a serverless world, understanding instances explains what the abstractions are hiding.
- **S3** — object storage that quietly powers half the internet: backups, data lakes, static websites.
- **VPC** — your private network: subnets, routing, security groups. The topic beginners avoid and then regret avoiding.

### Tier 2 — Builder (Parts 6–9)

The application-building kit: **managed databases** (RDS/Aurora for relational, DynamoDB for key-value at scale), **Lambda** and API Gateway for code without servers, **containers** on ECS/Fargate for everything in between, and **SQS/SNS/EventBridge** for the decoupling that keeps systems alive when one part fails.

After Tier 2 you can build and ship a real product on AWS.

### Tier 3 — Operator (Parts 10–12)

The difference between "it runs" and "it runs well": **CloudWatch** metrics, logs, and alarms; **infrastructure as code** with Terraform so environments are reproducible instead of hand-crafted; **KMS and Secrets Manager** so encryption and credentials are boring — which is exactly what they should be.

### Tier 4 — Architect (Parts 13–16)

Zoom out: **data services** (Glue, Athena, Kinesis, Redshift — the bridge to data engineering), **AI services** (Bedrock, SageMaker), the **Well-Architected Framework** for judging designs, and **cost optimization** — because on AWS, the bill *is* an architecture review. This tier ends with the certification path, if you want the paper.

## The 20 services that matter

| Tier | Services |
|---|---|
| Foundations | IAM · EC2 · S3 · VPC |
| Builder | RDS · Aurora · DynamoDB · Lambda · API Gateway · ECS · ECR · SQS · SNS · EventBridge |
| Operator | CloudWatch · KMS · Secrets Manager |
| Architect | Glue · Athena · Bedrock |

Everything else you can learn on demand, once these are solid.

## Learning without a scary bill

- Create a **fresh personal account** with the free tier — never practice in a company account.
- Set a **billing alarm on day one** (we do it together in Part 2).
- **Delete what you create** at the end of each session; a NAT Gateway left running is the classic beginner's $35 lesson.
- All examples in this series use throwaway demo resources with generic names.

## Key takeaways

- AWS is 200+ services, but real systems are built from a core of about twenty — learn those in dependency order.
- The mental model comes first: Regions/AZs, everything-is-an-API, shared responsibility.
- Four tiers: foundations, builder, operator, architect. Certifications are an optional by-product, not the goal.

**Related paths:** [CS Foundations](/series/cs-foundations) if networking and OS concepts here feel new; the [Data Engineer Roadmap](/series/de-roadmap) and [AI Engineer Roadmap](/series/ai-roadmap) both land on AWS services in their later stages.

*Next up — Part 2: IAM: Identity Is the New Perimeter.*
