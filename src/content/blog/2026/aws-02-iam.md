---
title: 'IAM: Identity Is the New Perimeter'
description: 'Users, roles and policies without the jargon — least privilege as a habit, why roles beat access keys, and the beginner mistakes that make headlines.'
date: 2026-07-28
category: Cloud
tags: [aws, iam, security, aws-zero-to-advanced]
lang: en
translationKey: aws-02
series: aws-zero-to-advanced
part: 2
---

In the data center era, security had a shape: a wall (the firewall) with a gate. In the cloud there is no wall — every service is an API reachable from anywhere. The only question that matters is: **who is calling, and what are they allowed to do?** That question is IAM (Identity and Access Management). It's why we learn it before EC2, S3, or anything with a server in it.

Get IAM right and most cloud horror stories can't happen to you. Get it wrong and no amount of encryption saves you.

![The cloud has no walls — every doorway is an identity check, and temporary vests (roles) beat permanent badges](images/s04-p02-concept1.png)

## What you'll learn

- Tell apart the four IAM nouns — user, group, role, policy — and explain why roles matter most.
- Read any IAM policy in two minutes using the Effect–Action–Resource pattern.
- Avoid the three beginner mistakes that turn into headlines (root habits, keys in code, `*` on `*`).
- Set up a safe personal account: MFA, an admin identity, your first least-privilege policy, and a billing alarm.

**Prerequisites:** Part 1 (what a cloud account is). A personal AWS account for practice — never practice IAM on a company account.

## 1. The cast: four nouns

| Noun | What it is | Analogy |
|---|---|---|
| **User** | A permanent identity for a human, with long-lived credentials | An employee badge |
| **Group** | A bundle of users sharing permissions | A department |
| **Role** | An identity **anyone authorized can temporarily become** — no password, no permanent keys | A visitor vest handed out at reception |
| **Policy** | A JSON document saying what is allowed or denied | The rulebook attached to a badge or vest |

The analogy for this whole part is the **office building**: badges for employees, vests for visitors, a rulebook attached to each. Keep it in mind — every IAM concept maps onto it.

The noun that confuses everyone is the **role** — and it's the most important. A role is assumed, not logged into: an EC2 instance assumes a role to read S3; a Lambda assumes a role to write DynamoDB; an engineer assumes an admin role for one hour of maintenance. Credentials are issued on the spot and **expire automatically** — like a visitor vest that must be returned at the end of the visit.

> **The habit that defines cloud professionals: identities are permanent, credentials should not be.**

## 2. Reading a policy (2 minutes)

Every policy answers three questions — Effect, Action, Resource:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::my-demo-bucket",
      "arn:aws:s3:::my-demo-bucket/*"
    ]
  }]
}
```

Read it aloud: "Allowed to read objects and list the bucket, on this one bucket, nothing else." The evaluation logic fits in one line: **everything is denied by default; an Allow opens a door; an explicit Deny always wins.**

That default-deny stance has a name — **least privilege**: grant what the task needs, nothing more. Not because your teammates are untrustworthy, but because *any* credential can leak. The blast radius of a leaked "read one bucket" key is a bad day. The blast radius of a leaked `AdministratorAccess` key is a company announcement.

## 3. The three beginner mistakes that make headlines

1. **Working as the root user.** The email you signed up with is the root account — it can do literally everything, including delete the account. Professional setup: enable MFA (multi-factor authentication) on root, create an admin identity for daily work, and put root credentials away.
2. **Access keys in code.** `aws_access_key_id = AKIA...` pasted into a script, pushed to GitHub — bots scan public repos and find keys in **minutes** (crypto-mining bills follow). The fix is structural, not carefulness: code running *on* AWS uses **roles** (no keys exist to leak); code on your laptop uses `aws configure` / SSO profiles (keys live outside the repo). A key in a repo is never OK — private repos get cloned, forked, and leaked too.
3. **`"Action": "*"` on `"Resource": "*"` because "it works now".** It always works — that's the problem. You'll never revisit it, and three months later some script you've forgotten has god-mode. Start narrow; widen when an `AccessDenied` tells you exactly what's missing — the error message literally names the action to add.

## 4. How this connects forward

Every later part of this series stands on IAM: EC2 instances get roles (Part 3), S3 buckets get bucket policies (Part 4), Lambda's permissions **are** a role (Part 7), and the multi-account guardrails of Part 12 are IAM at organization scale. Skim everything else if you must — internalize this part.

## Practice (15 minutes — free tier)

On a **personal** account:

1. Enable **MFA on root** (IAM → root user → assign MFA device), then sign out of root.
2. Create an admin identity for yourself. IAM Identity Center (SSO) is today's default; an IAM user with MFA also works for learning.
3. Create a policy from the JSON above (change the bucket name to one you own), attach it to a test user, sign in as that user, and try to list a *different* bucket.
4. Set the **billing alarm** we promised in Part 1: Billing → Budgets → zero-spend budget with an email alert.

Expected results: step 3 fails with `AccessDenied` naming the exact action and resource — that error is least privilege *working*, and reading it is a skill you'll use weekly. Step 4 sends a confirmation email; keep the budget forever.

## Check yourself

1. What's the difference between a user and a role — and why does code running on AWS get a role instead of a user's keys?
2. A policy has `Allow s3:GetObject` on bucket A, and another policy attached to the same identity has an explicit `Deny s3:*` on bucket A. What happens on a read, and why?
3. Your script fails with `AccessDenied: s3:PutObject on arn:aws:s3:::reports-bucket/out.csv`. What's the least-privilege fix?

<details><summary>See answers</summary>

1. A user is a permanent identity with long-lived credentials (badge); a role is assumed temporarily, with credentials issued on the spot that expire automatically (visitor vest). Code on AWS gets a role so there are no long-lived keys that can leak into repos, images, or logs.
2. The read is denied. Evaluation is default-deny, Allow opens doors, but an explicit Deny always wins over any Allow — that's what makes Deny a safe guardrail.
3. Add exactly what the error names: `s3:PutObject` on `arn:aws:s3:::reports-bucket/*` (or the narrower prefix the script writes to). Not `s3:*`, not `Resource: "*"` — the error message already told you the minimal grant.

</details>

## Key takeaways

- The cloud has no wall; identity is the perimeter. Everything is denied until a policy allows it, and explicit Deny always wins.
- Roles > keys: identities are permanent, credentials shouldn't be. Code on AWS should never hold long-lived keys.
- Least privilege is a habit, not a feature: start narrow, widen on demand — `AccessDenied` is the system working.
- Root user: MFA, then retire it from daily life. Billing alarm on day one.

*Next up — Part 3: EC2 Fundamentals: Your First Server.*
