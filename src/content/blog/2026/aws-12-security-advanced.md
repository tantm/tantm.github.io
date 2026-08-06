---
title: 'AWS Security Beyond IAM: KMS, Secrets, Guardrails'
description: 'Encryption as a key-access problem, secrets that rotate themselves, and multi-account guardrails — defense in depth as the architecture, not a checkbox pile.'
date: 2026-08-04
category: Cloud
tags: [aws, security, kms]
lang: en
translationKey: aws-12
series: aws-zero-to-advanced
part: 12
---

P02 gave you the first wall: identity, least privilege, no keys in repos. But one wall is not a security posture — the discipline is **defense in depth**: assume any single layer fails (CS-P11's whole worldview) and arrange the next layer to contain it. On AWS that means three more walls — encryption everywhere, secrets that manage themselves, and guardrails that make entire mistake classes impossible — plus the account structure that turns "one compromised credential" into "one compromised sandbox."

## What you'll learn

- Reframe encryption as a key-access problem, which is the only framing that helps you design.
- Climb the secrets ladder from "don't commit them" to "no secret exists to steal".
- Put guardrails at three levels: detect, prevent, and contain.
- Set the audit floor that makes an incident reconstructable.

**Prerequisites:** Part 2 (IAM roles and policies). Part 11's state-is-sensitive lesson connects here.

## 1. Encryption: really a key-access problem

The counterintuitive truth first: on AWS, *turning encryption on* is trivial — one flag on the bucket, the volume, the database. What you're actually designing is **who can use the keys**, and that's KMS:

- **Envelope model in one sentence**: services encrypt your data with data keys, KMS encrypts those with your master key, and every *decrypt* becomes an auditable, deniable **KMS API call** — encryption-at-rest turns into an *access-control* problem, which is why it composes with P02 instead of duplicating it.
- **The default choice that matters**: AWS-managed keys give you compliance-checkbox encryption; **customer-managed keys (CMK)** give you a *key policy* — a second, independent gate. S3 says yes but the key policy says no → no data. That two-gate property is defense in depth in one resource, and it's why sensitive buckets (P04) use CMKs.
- **What key separation buys you**: per-domain keys (one for the data lake, one for payments) mean a leaked role scoped to one key can't decrypt the other domain — CS-P11's blast-radius thinking applied to cryptography. It also buys you the S07-P10 lever: deny the key, and the data is cryptographically gone even where replication sprawled.
- **In transit** stays boring and mandatory: TLS on every hop (S01-P06), including *inside* the VPC — "internal traffic" is exactly what an attacker who's already inside gets to read.

## 2. Secrets: from "don't commit them" to "they rotate themselves"

CS-P11 established the floor (env injection, never git); the cloud ceiling is higher. The progression worth internalizing: **hardcoded → env vars → secrets manager → no secret at all.**

- A **secrets manager** (Secrets Manager/Parameter Store tier) gives you the three things env files can't: *audited access* (who read the DB password, when — P10's trail), *rotation without redeploys* (the app fetches at runtime; rotation is a config event, not a release), and *one source of truth* instead of `.env` files multiplying across machines.
- **Automatic rotation** is the headline feature: for supported databases, the manager rotates credentials on schedule and the app never knows. CS-P11 said "rotation being cheap is a design goal" — this is that goal, purchased as a service.
- **The best secret is no secret** (P02's roles, final form): service-to-service auth via IAM roles needs no stored password at all. The realistic end state: roles everywhere possible, managed-rotated secrets where a password must exist, and a *short* list of true secrets (third-party API keys) with owners and rotation dates — because the S04-P10 rule applies: an uninventoried secret is an unrotatable one.

## 3. Guardrails: from reviewing mistakes to making them impossible

Reviews (P11's plan-reading) catch mistakes; **guardrails** remove the mistake class. The pattern has three tiers, in escalating strength: **detect** — a config-rules layer continuously checks reality against policy ("no public buckets, no unencrypted volumes, no 0.0.0.0/0 on port 22" — P03's classic) and flags or auto-remediates drift, S04-P11's drift detection generalized to *policy* drift; **prevent** — organization-level policies (the SCP tier) that no one, not even account admins, can bypass: "this account cannot leave these regions, cannot disable audit logging, cannot delete KMS keys" — the security version of P07's database constraints, checks that cannot be skipped; and **contain** — the **multi-account architecture** that makes AWS-native isolation real: separate accounts per environment and domain (workloads-prod, workloads-dev, security-tooling, log-archive), because an account boundary is the strongest wall AWS sells — a compromised dev credential in a separate account *cannot* touch prod by construction (S04-P11's "same modules, different variables" gets a security reason to exist).

Close the loop with the audit floor, stated once: API audit logging (CloudTrail-class) on in every account, shipped to the log-archive account where *nobody* has delete rights — S04-P10's observability, but the threat model is now an attacker (or an admin) trying to erase their tracks. Alarm on the meta-events: audit logging disabled, root login, key-deletion scheduled. Those three alarms are cheap, and each one is the opening move of a real incident.

## Practice (25 minutes — prove that encryption is about who holds the key)

The claim of section 1 sounds abstract until you watch an authorized identity read an encrypted object and an unauthorized one fail on the *key*, not on the bucket:

```bash
ACCT=$(aws sts get-caller-identity --query Account --output text)
B=kms-lab-$RANDOM

# 1. A customer-managed key: the second gate, independent of the bucket policy
KEY=$(aws kms create-key --description "lab key" --query KeyMetadata.KeyId --output text)
aws kms create-alias --alias-name alias/lab-key --target-key-id $KEY

# 2. A bucket encrypted with YOUR key, not the service default
aws s3 mb s3://$B
aws s3api put-bucket-encryption --bucket $B --server-side-encryption-configuration \
  "{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"aws:kms\",\"KMSMasterKeyID\":\"$KEY\"}}]}"

echo "secret report" > report.txt && aws s3 cp report.txt s3://$B/report.txt
aws s3api head-object --bucket $B --key report.txt --query '[ServerSideEncryption,SSEKMSKeyId]'

# 3. THE POINT: revoke key access only — leave every bucket permission untouched
aws kms put-key-policy --key-id $KEY --policy-name default --policy \
  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"AdminOnly\",\"Effect\":\"Allow\",
    \"Principal\":{\"AWS\":\"arn:aws:iam::$ACCT:root\"},\"Action\":\"kms:*\",\"Resource\":\"*\"}]}"
# Now have a role that still has s3:GetObject try to read it — it fails on kms:Decrypt.

# 4. Secrets that rotate themselves, instead of secrets you paste
aws secretsmanager create-secret --name lab/db --secret-string '{"user":"app","pass":"initial"}'
aws secretsmanager get-secret-value --secret-id lab/db --query SecretString --output text
aws secretsmanager put-secret-value --secret-id lab/db --secret-string '{"user":"app","pass":"rotated"}'
aws secretsmanager list-secret-version-ids --secret-id lab/db --query 'Versions[].VersionStages'

# 5. Clean up
aws s3 rb s3://$B --force
aws secretsmanager delete-secret --secret-id lab/db --force-delete-without-recovery
aws kms schedule-key-deletion --key-id $KEY --pending-window-in-days 7
```

Expected results: step 3 is the whole lesson made concrete. The object is still in the bucket, the caller still has `s3:GetObject`, and the read still fails — because decrypting requires permission on the *key*, which is a second gate under separate control. That's why "encrypted at rest" is a meaningless claim on its own: the real question is always who can use the key. Step 4 shows the rung above "don't commit secrets" — versioned values with staging labels, so rotation is a supported operation rather than a coordinated outage.

## Check yourself

1. A vendor's security questionnaire asks "is your data encrypted at rest?" and you answer yes. What has that actually told them?
2. Your team stores database passwords in environment variables set from a secrets manager at deploy time. What's the next rung up, and what does it eliminate?
3. Why is a separate AWS account often a stronger boundary than any IAM policy?

<details><summary>See answers</summary>

1. Very little. Nearly all managed storage is encrypted at rest by default, so the answer says nothing about who can decrypt. The meaningful questions are which key is used, who has permission to use it, and whether key usage is logged — a customer-managed key with a restrictive policy is a genuine second gate; a service-default key with broad access is a checkbox.
2. Roles with short-lived credentials, so the application obtains temporary access at runtime and no long-lived password exists in the environment at all. It eliminates the credential you'd otherwise need to rotate, protect and audit — you can't leak a secret that was never issued.
3. Because it's a boundary the platform enforces at the outermost level rather than one you configure per resource. A mistaken policy inside an account can grant access it shouldn't; a resource in a different account isn't reachable without an explicit cross-account grant. It also caps blast radius: a compromised identity in one account cannot enumerate what it cannot see.

</details>

## Key takeaways

- Encryption on AWS is a key-access problem: CMKs add a second independent gate, per-domain keys shrink blast radius, and key denial is data denial — TLS on every hop including internal.
- Climb the secrets ladder — env vars → managed secrets with auto-rotation → IAM roles with no secret at all — and keep the true-secret list short, owned, and dated.
- Guardrails beat review: detect policy drift continuously, prevent with org-level rules nobody can bypass, contain with account boundaries — the strongest wall AWS sells.
- Audit logs go where no one can delete them, and three cheap alarms (logging off, root login, key deletion) cover the opening moves of most real incidents.

*Next up — Part 13: AWS for Data: Glue, Athena, Kinesis, Redshift.*
