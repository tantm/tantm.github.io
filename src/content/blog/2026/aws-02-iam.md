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

In the data center era, security had a shape: a wall (the firewall) with a gate. In the cloud there is no wall — every service is an API reachable from anywhere, and the only question that matters is: **who is calling, and what are they allowed to do?** That question is IAM (Identity and Access Management), and it's why we learn it before EC2, S3, or anything with a server in it.

Get IAM right and most cloud horror stories can't happen to you. Get it wrong and no amount of encryption saves you.

## The cast: four nouns

| Noun | What it is | Analogy |
|---|---|---|
| **User** | A permanent identity for a human, with long-lived credentials | An employee badge |
| **Group** | A bundle of users sharing permissions | A department |
| **Role** | An identity **anyone authorized can temporarily become** — no password, no permanent keys | A visitor vest handed out at reception |
| **Policy** | A JSON document saying what is allowed or denied | The rulebook attached to a badge or vest |

The one that confuses everyone is the **role** — and it's the most important. A role is assumed, not logged into: an EC2 instance assumes a role to read S3; a Lambda assumes a role to write DynamoDB; an engineer assumes an admin role for one hour of maintenance. Credentials are issued on the spot and **expire automatically**.

> **The habit that defines cloud professionals: identities are permanent, credentials should not be.**

## Reading a policy (2 minutes)

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

"Allowed to read objects and list the bucket, on this one bucket, nothing else." Evaluation logic fits in one line: **everything is denied by default; an Allow opens a door; an explicit Deny always wins.**

That default-deny stance has a name — **least privilege**: grant what the task needs, nothing more. Not because your teammates are untrustworthy, but because *any* credential can leak, and the blast radius of a leaked "read one bucket" key is a bad day, while the blast radius of a leaked `AdministratorAccess` key is a company announcement.

## The three beginner mistakes that make headlines

1. **Working as the root user.** The email you signed up with is the root account — it can do literally everything, including delete the account. Professional setup: enable MFA on root, create an admin identity for daily work, and put root credentials away.
2. **Access keys in code.** `aws_access_key_id = AKIA...` pasted into a script, pushed to GitHub — bots scan public repos and find keys in **minutes** (crypto-mining bills follow). The fix is structural, not carefulness: code running *on* AWS uses **roles** (no keys exist to leak); code on your laptop uses `aws configure` / SSO profiles (keys live outside the repo). A key in a repo is never OK — private repos get cloned, forked, and leaked too.
3. **`"Action": "*"` on `"Resource": "*"` because "it works now".** It always works — that's the problem. You'll never revisit it, and three months later some script you've forgotten has god-mode. Start narrow; widen when an `AccessDenied` tells you exactly what's missing (the error message literally names the action to add).

## Hands-on: a safe first setup (15 minutes, free)

On a **personal** account (never practice IAM on a company account):

1. Enable **MFA on root**, then stop using root.
2. Create an admin identity for yourself (IAM Identity Center / SSO is today's default; an IAM user with MFA also works for learning).
3. Create a policy from the JSON above (adjust the bucket name), attach it to a test user, and try to list a *different* bucket → enjoy your first well-earned `AccessDenied`.
4. Set the **billing alarm** we promised in Part 1: Billing → Budgets → zero-spend budget with an email alert.

That `AccessDenied` in step 3 is the feeling of least privilege working. Learn to love it.

## How this connects forward

Every later part of this series stands on IAM: EC2 instances get roles (Part 3), S3 buckets get bucket policies (Part 4), Lambda's permissions **are** a role (Part 7), and the multi-account guardrails of Part 12 are IAM at organization scale. Skim everything else if you must — internalize this part.

## Key takeaways

- The cloud has no wall; identity is the perimeter. Everything is denied until a policy allows it, and explicit Deny always wins.
- Roles > keys: identities are permanent, credentials shouldn't be. Code on AWS should never hold long-lived keys.
- Least privilege is a habit, not a feature: start narrow, widen on demand — `AccessDenied` is the system working.
- Root user: MFA, then retire it from daily life. Billing alarm on day one.

*Next up — Part 3: EC2 Fundamentals: Your First Server.*
