---
title: 'Remote State & Working as a Team'
description: 'Move state off your laptop: the S3 backend with locking, one state per environment, why workspaces disappoint, and the state security checklist teams actually need.'
date: 2026-08-05
category: DevOps
tags: [terraform-iac, terraform, aws]
lang: en
translationKey: terraform-iac-05
series: terraform-iac
part: 5
cover: images/s12-p05-hero.png
---

Everything so far kept state in a local file — fine for one person, broken for a team. The day teammate two runs `terraform apply`, you have two ledgers describing one reality, and the wrong one wins. This part moves the ledger to shared, locked, versioned storage — the setup every real team runs.

## What you'll learn

- Configure a remote backend (S3-class) with locking, step by step.
- Explain what state locking prevents — and read the lock error correctly.
- Split state per environment, and say why workspaces are usually not the answer.
- Apply the four-point state security checklist.

**Prerequisites:** Parts 1–4. An AWS account for the backend (S3 + DynamoDB stay in free tier at this scale).

## 1. The problem: two ledgers, one reality

Local state fails a team three ways, in escalating order:

- **Divergence.** You apply from your laptop; your teammate applies from theirs. Each has a ledger the other never saw. The next plan on either side proposes "fixing" the other's work.
- **Loss.** State lives on one laptop. Laptop dies → the team no longer knows what Terraform manages (Part 3 showed why that's crippling).
- **Races.** Two applies at the same moment interleave their writes — a corrupted ledger, the worst outcome of all.

The fix has two parts: **shared storage** (everyone reads/writes one ledger) and **locking** (only one apply at a time).

## 2. The S3 backend, line by line

```hcl
terraform {
  backend "s3" {
    bucket         = "myco-terraform-state"     # the shared home
    key            = "network/prod/terraform.tfstate"  # THIS config's ledger
    region         = "ap-southeast-1"
    encrypt        = true                        # state holds secrets (Part 3)
    dynamodb_table = "terraform-locks"           # the lock
  }
}
```

Three notes that save confusion:

- The **`key` is the path to *this* configuration's state** inside the shared bucket. Different configs (network vs app; dev vs prod) get different keys — that's the per-environment split in section 4.
- The backend block **cannot use variables** — it's read before variables exist. Values are literal (or passed via `-backend-config` in CI, Part 9).
- After adding the block, run `terraform init` — it detects the change and offers to **migrate** your existing local state into the bucket. Answer yes once; done.

The bucket itself should be the most protected bucket you own: versioning ON (state history = your undo button), encryption ON, public access blocked, access restricted to the CI role and few humans. (Newer Terraform versions can also lock via S3 alone — `use_lockfile` — but the DynamoDB pattern remains the widespread standard you'll meet in real repos.)

## 3. Locking: the "someone else is applying" error

With the lock table in place, every `plan`/`apply` first acquires a lock; a second runner gets:

```text
Error: Error acquiring the state lock
Lock Info:
  Who:       anh@build-agent
  Created:   2026-08-05 09:14:22
```

Read this as *coordination, not failure*: someone (or CI) is mid-apply. The right response is **wait** — never `-lock=false`. One exception: a crashed run can leave a **stale lock** (the `Who`/`Created` tells you — a colleague's run from 3 hours ago that died). Confirm the run is truly dead, then `terraform force-unlock <LOCK_ID>`. Confirm first; force-unlocking a *live* apply recreates the exact corruption locking exists to prevent.

## 4. One state per environment (and the workspace question)

Part 11 of the AWS series gave the rule — same modules, different variables per environment. State follows the same shape: **separate state per environment, via separate keys**:

```text
s3://myco-terraform-state/
  network/dev/terraform.tfstate
  network/prod/terraform.tfstate
  app/dev/terraform.tfstate
  app/prod/terraform.tfstate
```

Two reasons this split is non-negotiable: **blast radius** (a corrupted dev state, a bad `state rm`, a wrong-window apply — none of it can touch prod's ledger) and **permissions** (CI's dev role can be denied read on `*/prod/*` entirely).

**What about `terraform workspace`?** Workspaces give you multiple states *inside one backend and one directory* — tempting for dev/prod. The honest guidance, widely shared in the community: workspaces are fine for *ephemeral copies of the same thing* (a per-branch preview environment), but poor for dev-vs-prod, because both workspaces share one backend config and one set of permissions, and `terraform workspace show` is the only thing standing between you and applying to the wrong environment. Directories-per-env (each with its own backend key) make the environment *visible in your prompt and your PR diff*. Boring wins.

## Practice (20 minutes — small AWS cost: $0 at this scale)

```bash
# 1. Create the backend pair (console or CLI): a versioned, encrypted S3 bucket
#    'YOURNAME-tf-state-lab' and a DynamoDB table 'tf-locks-lab' (partition key: LockID, type String)

# 2. Start local, then migrate
mkdir tf-remote-lab && cd tf-remote-lab
cat > main.tf <<'EOF'
resource "local_file" "hello" { filename = "hello.txt"; content = "remote state lab" }
EOF
terraform init && terraform apply -auto-approve
ls terraform.tfstate                    # local ledger exists

# 3. Add the backend block (edit bucket/table to yours), then:
cat > backend.tf <<'EOF'
terraform {
  backend "s3" {
    bucket         = "YOURNAME-tf-state-lab"
    key            = "lab/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "tf-locks-lab"
  }
}
EOF
terraform init                          # answer "yes" to migrate
ls terraform.tfstate*                   # local file now empty/backup — ledger moved

# 4. See the lock in action (two terminals)
#    T1: terraform apply   (don't confirm yet — it holds the lock)
#    T2: terraform plan    -> "Error acquiring the state lock" with Who/Created
#    T1: answer no; T2 retry -> works

# 5. Clean up
terraform destroy -auto-approve         # then delete the lab bucket/table
```

Expected results: after step 3, the state lives in S3 (check the bucket). Step 4 shows the lock error with `Who` info — coordination made visible.

## Check yourself

1. What three team failures does remote state + locking prevent?
2. A plan fails with "Error acquiring the state lock" from a CI run 5 minutes ago. What do you do? Same error, but the run crashed 3 hours ago?
3. Why are per-environment *directories with separate keys* preferred over workspaces for dev/prod?

<details><summary>See answers</summary>

1. Divergent ledgers (each laptop its own state), state loss (one laptop = single point of failure), and concurrent-write corruption (two applies interleaving).
2. Five minutes ago: wait — a live apply holds the lock legitimately. Three hours + confirmed dead: `terraform force-unlock <LOCK_ID>`, after confirming with the Who/Created info that nothing is running.
3. Directories make the environment explicit (path in prompt, PR diff, backend key) and allow separate permissions per env; workspaces hide the environment in invisible CLI state and share one backend and one set of credentials — one `workspace show` away from applying to prod.

</details>

## Key takeaways

- Local state breaks teams three ways: divergence, loss, races. Remote backend + locking fixes all three.
- The backend block is literal (no variables), `init` migrates state once, and the state bucket is your most-protected bucket: versioned, encrypted, private.
- Lock errors are coordination: wait for live runs, `force-unlock` only confirmed-dead ones.
- One state per environment via separate keys/directories — visible, permission-scoped, small blast radius. Workspaces are for ephemeral copies, not dev-vs-prod.

*Next — Part 6: Variables, Outputs & Multi-Environment.*
