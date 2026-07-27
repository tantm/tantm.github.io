---
title: 'EC2 Fundamentals: Your First Server'
description: 'Instance types decoded, AMIs, SSH the modern way, your first security group, and the pricing menu — the server-shaped foundation every AWS abstraction stands on.'
date: 2026-07-29
category: Cloud
tags: [aws, ec2, compute, aws-zero-to-advanced]
lang: en
translationKey: aws-03
series: aws-zero-to-advanced
part: 3
---

Serverless is the fashion, so why start with servers? Because every higher abstraction on the AWS map — Lambda, Fargate, managed databases — is **EC2 with the sharp edges filed off**, and when abstractions leak (they do), the leak is shaped like an instance. One hour of EC2 fluency buys you intuition for half the AWS catalog. This part is that hour.

## What an instance actually is

An EC2 instance is a rented slice of a physical machine in one of Part 1's Availability Zones: virtual CPUs, memory, a network interface, and a root disk. Three consequences beginners learn the hard way:

- **It lives in one AZ.** The AZ has a bad day → your instance has a bad day. High availability means *more instances in more AZs* (Part 15's patterns), never one careful instance.
- **The root EBS volume is a separate thing** — network-attached storage with its own lifecycle. Terminate carelessly and the disk can vanish with the instance; conversely, a volume can outlive its instance and be re-attached.
- **Stop ≠ terminate.** Stopped instances don't bill for compute (the EBS volume still bills); terminated ones are gone. The pair of verbs behind many a beginner's heart attack.

## Reading an instance type like a sentence

`m7g.xlarge` decodes as: **family** (`m` = general purpose) + **generation** (`7`, newer = better price/performance, just take the newest) + **attribute** (`g` = Graviton/ARM chips — cheaper, and fine for most Linux workloads) + **size** (`xlarge` ≈ 4 vCPU / 16 GB; each size up doubles).

Families you'll actually meet:

| Family | Personality | You'll use it for |
|---|---|---|
| `t` | Burstable — small, banks CPU credits | Dev boxes, low-traffic apps — **and the credit trap**: sustained load drains credits, then it crawls |
| `m` | Balanced CPU:RAM (1:4) | The default when unsure |
| `c` | Compute-heavy (1:2) | Encoding, batch crunching |
| `r` | Memory-heavy (1:8) | Databases, caches, big DataFrames (S02-P03's pandas math) |

The decision is two questions — CPU-hungry or RAM-hungry, and how much? — then pick the newest generation of the matching family. Don't agonize: resizing is a stop-change-start away, which is precisely the elasticity you're paying for.

## AMI, user data, and the pets-vs-cattle idea

An **AMI** is the frozen disk image an instance boots from (OS + whatever was baked in). **User data** is a script that runs on first boot. Together they carry the cloud's most important cultural idea: **cattle, not pets**. A pet server is hand-configured, lovingly named, irreplaceable — and unreproducible. A cattle instance is *AMI + user data + parameters*: delete it, launch an identical one in two minutes.

```bash
#!/bin/bash
# user data: from blank Amazon Linux to running web server, no human hands
dnf install -y nginx
systemctl enable --now nginx
```

Practice the discipline now, and Part 11 (Terraform) will feel like a natural conclusion instead of a new religion.

## Connecting: SSH, the 2026 way

The classic path — download a `.pem` key pair, `ssh -i my-key.pem ec2-user@<public-ip>` — still works and still teaches. But note what it requires: a key file to protect (IAM Part 2's warning about long-lived credentials, in file form) and an open port 22. The modern default on AWS is **SSM Session Manager**: the instance's IAM role (there it is again — Part 2's most important noun) lets you open a shell from the console or CLI with **no key file and no inbound port at all**. Learn SSH once for fluency; reach for SSM in anything real.

## Your first security group

A **security group** is a stateful firewall attached to the instance's network interface: default = nothing in, everything out; you open only what's needed. Two rules for a demo web server:

| Direction | Port | Source | Why |
|---|---|---|---|
| Inbound | 443/80 | `0.0.0.0/0` | It's a public website |
| Inbound | 22 | *your IP only* — or nothing, use SSM | Admin access is not a public service |

The classic beginner mistake is `22` open to `0.0.0.0/0` — within hours the auth log fills with bot login attempts (they scan constantly; this is the visible-from-orbit version of Part 2's leaked-key lesson). Security groups go deeper in Part 5 (VPC), where they meet subnets and NACLs.

## The pricing menu

Same instance, four prices — and the menu *is* the architecture lesson (S07-P12 made it a whole part):

- **On-demand** — pay per second, no commitment. Default for learning and unknowns.
- **Spot** — spare capacity at ~60–90% off, reclaimable by AWS with a 2-minute warning. Perfect for interruptible batch (the idempotent jobs of S02-P03 are *literally built for this*); wrong for anything that can't die mid-request.
- **Savings Plans / Reserved** — commit to 1–3 years of steady usage for ~30–60% off. The "committed at the core" half of S07-P12's pattern.
- **Free tier** — enough hours of a small instance to do everything in this part for $0.

The habit that matters more than any discount: **instances you're not using are stopped.** A forgotten `xlarge` is the classic first bill shock — your Part 2 billing alarm exists exactly for this.

## Hands-on (30 minutes, free tier)

1. Launch the smallest current-gen instance with Amazon Linux, the nginx user-data script above, and a security group allowing 80 from anywhere.
2. Hit the public IP in a browser — your server, from nothing, in minutes.
3. Connect via SSM Session Manager (attach the default SSM role) — no key, no port 22.
4. Stop the instance. Note the EBS volume still exists. Terminate. Note it's all gone. Feel the difference in your bones.

## Key takeaways

- Everything higher-level on AWS is EC2 with edges filed off — instance fluency is leak insurance for every abstraction above it.
- Read types as sentences (family-generation-attribute-size); pick by CPU-vs-RAM appetite and take the newest generation.
- Cattle, not pets: AMI + user data + parameters means any instance is deletable and reproducible — the mindset Terraform will formalize.
- Security groups default-closed (never 22 to the world; prefer SSM over keys); on the pricing menu, spot is for idempotent batch and stopped is the best price of all.

*Next up — Part 4: S3 Deep Dive: More Than File Storage.*
