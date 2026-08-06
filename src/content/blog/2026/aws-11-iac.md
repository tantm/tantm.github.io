---
title: 'Infrastructure as Code: Terraform on AWS'
description: 'Why clicking is technical debt, state as the concept that explains every Terraform behavior, plan as the review artifact, and drift as the disease IaC exists to cure.'
date: 2026-08-04
category: Cloud
tags: [aws, terraform, iac, devops]
lang: en
translationKey: aws-11
series: aws-zero-to-advanced
part: 11
---

Everything in this series so far, you could have built by clicking the console. Now count what clicking cost you: nobody can *review* the change (P — S01-P09's whole thesis), nobody can *reproduce* the environment (works in dev, mystery in prod), and six months later nobody knows *why* that security group has port 8080 open. **Infrastructure as Code** applies the software discipline you already have to infrastructure: declare the desired state in files, version them in git, review them in PRs, and let a tool make reality match. Terraform is the lingua franca; the concepts transfer to CDK/Pulumi and friends.

## What you'll learn

- Say why clicking in a console is technical debt, in terms a manager understands.
- Read declarative code and predict what a plan will show.
- Explain state — the concept that makes every confusing Terraform behavior make sense.
- Run the plan-review-apply workflow the way teams actually do it safely.

**Prerequisites:** Parts 2–5 (the AWS resources you'll be declaring). No prior Terraform assumed.

## 1. Declarative: you say what, the tool figures out how

```hcl
resource "aws_s3_bucket" "reports" {
  bucket = "myco-reports-prod"
  tags   = { team = "data", env = "prod" }
}

resource "aws_s3_bucket_lifecycle_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id
  rule {
    id     = "tier-then-expire"
    status = "Enabled"
    transition { days = 90  storage_class = "GLACIER" }   # S04-P04's lifecycle, as code
    expiration { days = 365 }
  }
}
```

You don't write "create a bucket" — you write "a bucket *exists* with these properties." Run it twice, nothing happens the second time: **idempotency** (the curriculum's iron rule — S02-P06, S02-P08, S04-P09 — now for infrastructure) is the core property, and it's what makes IaC safe to re-run, reviewable, and automatable. SQL's declarative lesson from S01-P07, applied to servers.

## 2. State: the concept that explains everything

Terraform keeps a **state file**: its record of what it created and the real-world IDs behind each resource. Every confusing Terraform behavior becomes obvious once you know the tool is doing a *three-way comparison* — your code (desired), the state file (what Terraform believes), and reality (what AWS actually has):

- **State is shared truth** → on a team it lives remotely (the S3-backend pattern) with **locking**, because two engineers applying concurrently is S01-P08's race condition with a blast radius. One state per environment.
- **State knows your secrets** → generated passwords and the like pass through it; treat the state bucket with CS-P11 discipline (encrypted, least-privilege access, no public anything).
- **Resources created by clicking don't exist to Terraform** → that's not a bug, it's the definition: Terraform manages what's in state. Imports exist for adopting strays; the real fix is cultural (below).

## 3. Plan, apply, and the PR workflow

`terraform plan` computes the diff between desired and actual — **the plan is the review artifact**. The workflow that makes IaC pay off is exactly S01-P09's loop with one addition: PR opens → CI posts the plan → a human reads it → merge applies it. Two reading disciplines:

- The plan's verbs are a severity scale: `+` create is cheap, `~` update in place is usually fine, **`-/+` destroy-and-recreate is the line that pages you** — on a stateful resource (a database!) that word means *data loss*, and catching it in review is the entire return on investment. Some attribute changes force replacement; the plan tells you which — read it like you read `EXPLAIN` (S01-P07).
- **Nobody applies from a laptop.** CI applies what was reviewed, with its own least-privilege role (S04-P02's identity-not-keys, again). A laptop apply with admin credentials is the `verify=false` of infrastructure.

**Drift** is the disease this cures: someone "quickly fixes" prod in the console at 2 a.m., and now reality matches neither code nor anyone's mental model. `plan` detects drift (the three-way comparison earns its keep); the *culture* prevents it — console access becomes read-only-except-break-glass, and the 2 a.m. fix becomes a PR the next morning, or it will be silently reverted by the next apply. That last sentence is worth repeating to every new team member: **an unrecorded console change is not a fix; it's a time bomb scheduled for the next deploy.**

## 4. Modules, environments, and how much to abstract

A **module** is a function for infrastructure: inputs (variables) → resources → outputs. The honest guidance is S01-P10 verbatim: **abstract on the second or third occurrence, not the first.** The one pattern worth adopting from day one: *same modules, different variables* per environment — dev and prod differ in instance sizes and counts (`t3.small` vs `m6i.large`, 1 AZ vs 3), never in shape. If prod has a subnet layout dev doesn't, your staging tests test nothing (S04-P05's layout should be a module for exactly this reason).

Two closing calibrations. **CDK/Pulumi** express the same model in a general-purpose language — loops and types instead of HCL; the state/plan/drift concepts are identical, so pick by team background and don't relitigate it quarterly. And **not everything belongs in Terraform**: it excels at the *slow-changing substrate* — networks, clusters, buckets, IAM. App deploys that change hourly usually ride their own pipeline (P08's task definitions via CI); forcing every deploy through the infra repo turns your platform team into a ticket queue. Draw the line where change cadence changes.

## Practice (20 minutes — see state do its job, without touching a cloud account)

The `local_file` provider makes every core behavior observable in minutes, with no credentials and no bill:

```bash
mkdir tf-lab && cd tf-lab
cat > main.tf <<'EOF'
resource "local_file" "config" {
  filename = "app.conf"
  content  = "mode = production"
}
EOF

terraform init
terraform plan            # "1 to add" — desired state vs an empty ledger
terraform apply -auto-approve
cat app.conf

# 1. IDEMPOTENCY: running again changes nothing, because reality already matches
terraform apply -auto-approve      # "No changes."

# 2. DRIFT: change reality behind the ledger's back
echo "mode = debug-hacked" > app.conf
terraform plan                     # Terraform SEES it and proposes to restore
terraform apply -auto-approve
cat app.conf                       # code wins: "mode = production"

# 3. STATE IS THE MEMORY: delete it and Terraform forgets it ever owned the file
cp terraform.tfstate backup.tfstate
rm terraform.tfstate
terraform plan                     # "1 to add" again — it wants to CREATE what already exists
mv backup.tfstate terraform.tfstate
terraform plan                     # "No changes." — memory restored

# 4. THE THREE-WAY COMPARISON, made explicit
terraform state list               # what the ledger thinks it owns
terraform state show local_file.config | head -5

# 5. DESTROY: the ledger is also how it knows what to delete
terraform destroy -auto-approve
ls app.conf 2>/dev/null || echo "gone — because state recorded that Terraform created it"
```

Expected results: step 1 shows idempotency — the second apply is a no-op because desired state and reality already agree. Step 2 is self-healing: an out-of-band edit becomes a diff Terraform offers to undo, which is exactly what a nightly drift check reports at scale. Step 3 is the one that explains most confusing Terraform incidents you'll ever hit: with the state file gone, Terraform doesn't know it owns anything, so it plans to create resources that already exist. And step 5 closes the loop — deletion is possible only because the ledger recorded what was created. Code, state, reality: every strange behavior is one of those three disagreeing.

## Check yourself

1. A colleague creates a security group in the console, then adds it to the Terraform code and runs plan. Terraform proposes to create it. Why, and what's the right move?
2. Two engineers run `terraform apply` at the same time against the same environment. What can go wrong, and what prevents it?
3. Why should the state file be treated as sensitive?

<details><summary>See answers</summary>

1. Because state has no record of it — Terraform only manages what its ledger says it created. Applying would fail (the name already exists) or, worse, create a duplicate. The right move is to adopt it: write the configuration to match reality and use an import so the resource enters state, then confirm the plan shows no changes.
2. Both read state, both compute a plan against it, and both write back — so one apply can clobber the other's record, leaving state that doesn't match reality. Remote state with locking prevents it: the second apply waits rather than racing. This is the same check-then-act shape as any concurrency bug, at infrastructure scale.
3. Because it contains the actual attribute values of your resources, including generated passwords, connection strings and other secrets that were never in your code. Store it in a private, encrypted, access-controlled backend — a state file in a public repository is a credential leak, not a configuration file.

</details>

## Key takeaways

- IaC is code review, reproducibility, and history applied to infrastructure — declarative and idempotent, so re-running is always safe.
- State is Terraform's three-way ledger: remote + locked + encrypted, one per environment — and every "weird" behavior is the code/state/reality triangle disagreeing.
- The plan is the review artifact: read `-/+` on stateful resources like a fire alarm, apply only from CI, and treat unrecorded console changes as time bombs — that's drift.
- Module on the second occurrence, vary environments by variables not shape, and keep fast-changing app deploys out of the slow-changing infra repo.

*Next up — Part 12: AWS Security Beyond IAM: KMS, Secrets, Guardrails.*
