---
title: 'Importing Legacy & Fighting Drift'
description: 'The import block that adopts click-built infrastructure, a strategy for taking over a legacy account without breaking it, scheduled drift detection, and the read-only-console culture that keeps IaC true.'
date: 2026-09-02
category: DevOps
tags: [terraform-iac, terraform]
lang: en
translationKey: terraform-iac-10
series: terraform-iac
part: 10
cover: images/s12-p10-hero.png
---


Every course teaches Terraform on a blank account. Almost nobody works on one. The real assignment is: an account with three years of hand-built resources, no code, and a business running on top. This part is the adoption playbook — the `import` block, the strategy for eating the elephant, and the cultural change (read-only consoles) that keeps drift from creeping back.

## What you'll learn

- Bring existing resources under management with the `import` block — plan-reviewed, no state surgery.
- Run the four-step adoption strategy for a legacy account without ever risking a production resource.
- Set up scheduled drift detection and triage what it finds.
- Install the culture that prevents relapse: consoles go read-only, changes go through code.

**Prerequisites:** Parts 3–4 (state, plans) are the foundation; Part 8's workflow is where imports get reviewed.

## 1. The import block: adoption as code

Since Terraform 1.5, importing is declarative — you write *what to adopt* next to *how it should look*:

```hcl
import {
  to = aws_s3_bucket.reports          # the address it will get in state
  id = "legacy-reports-bucket-2019"   # the real-world identifier
}

resource "aws_s3_bucket" "reports" {  # the config it must match
  bucket = "legacy-reports-bucket-2019"
  tags   = { managed_by = "terraform" }
}
```

`terraform plan` then shows `1 to import` — and, crucially, whether your config *matches reality*. Attributes you got wrong appear as changes; you adjust the config until the plan reads "import, change nothing." Because it's just a plan, **the whole adoption goes through Part 8's PR review** like any other change — the old `terraform import` CLI command mutated state imperatively from a laptop; the block makes adoption reviewable. (Cheat code: `terraform plan -generate-config-out=generated.tf` drafts the resource block from reality — treat the output as a first draft to prune, not gospel: it captures every attribute including defaults you'd never write.)

The mirror-image tool: **`removed` blocks** (the `state rm` of Part 3, made declarative) — "stop managing this, don't destroy it." Adoption and divorce, both as reviewable code.

## 2. Eating the elephant: the adoption strategy

Do not try to import an entire legacy account in one heroic PR. The strategy that works:

1. **Inventory and rank.** List what exists (the console, `aws resourcegroupstaggingapi`, or tools of the former-terraformer kind). Rank by *change frequency* — resources you touch monthly benefit from IaC now; the static ones can wait indefinitely.
2. **Adopt in blast-radius order, smallest first.** Tags, buckets, DNS records → security groups, IAM → finally the crown jewels (databases, networks). Each import is its own small PR with a clean plan. Early wins build the muscle before you touch anything scary.
3. **New things in code from day one.** Freeze the growth of unmanaged surface: every *new* resource is Terraform-born, even while old ones await adoption. The unmanaged set must only shrink.
4. **Accept a permanent frontier.** Some resources may never be worth importing (that 2019 experiment nobody understands). Document them in the repo ("known unmanaged: X, Y — reason"), so unmanaged-by-choice is distinguishable from unmanaged-by-neglect.

The metric that matters is not "percent imported" but **"can a stranger tell what's managed?"** — a README with the frontier list achieves that on day one.

## 3. Drift detection: the scheduled truth check

Part 3 introduced drift (reality changed behind the ledger's back); at team scale you hunt it on a schedule instead of tripping over it. The mechanism is almost embarrassingly simple — a nightly CI job:

```bash
terraform plan -detailed-exitcode -input=false
# exit 0 = no drift · exit 2 = drift found → alert the channel
```

Triage what it finds into exactly three buckets:

- **Emergency change someone made by hand** (the 2 a.m. hotfix): backport it into code *today* — the fix was legitimate; leaving it as drift is not.
- **Unauthorized/unknown change**: investigate — could be a colleague's "quick fix", could be worse. Drift detection doubles as a tripwire (S04-P12's audit instinct, implemented with a cron job).
- **Provider noise** (attribute ordering, defaults): fix the config to match, or `ignore_changes` (Part 4) if it's a field an external system legitimately owns.

The rule that keeps the nightly job meaningful: **drift alerts must reach zero regularly.** A channel with 40 standing drift warnings is a channel nobody reads — the alarm-fatigue lesson every monitoring system teaches eventually.

## 4. The culture: consoles go read-only

Every technical measure above loses to one habit: people clicking. The endgame of IaC adoption is organizational, not technical — **humans get read-only console access; write access belongs to the pipeline role** (Part 9's OIDC roles make this natural: the apply role exists, humans just don't hold it).

Make it liveable, not dogmatic: keep a **break-glass role** for true emergencies — using it pages the team, triggers an immediate drift run, and creates a backport ticket. The message isn't "the console is evil"; it's "the console is a *viewer*". Pair it with speed: if the code path takes two days for a one-line change, people will route around it — the Part 8–9 pipeline earning a fast lane for small changes *is* drift prevention.

This completes an arc that started in Part 1: infrastructure as *cattle* defined by code, consoles as dashboards, changes as reviewed diffs. The console's edit button was the last thing keeping infrastructure a *pet*.

## Practice (25 minutes — local, complete adoption cycle)

Simulate a "hand-built" resource and adopt it:

```bash
mkdir tf-adopt-lab && cd tf-adopt-lab
echo "built by hand in 2019" > legacy.txt        # the click-ops artifact

cat > main.tf <<'EOF'
import {
  to = local_file.legacy
  id = "legacy.txt"
}
resource "local_file" "legacy" {
  filename = "legacy.txt"
  content  = "built by hand in 2019"
}
EOF

terraform init && terraform plan                  # "1 to import" — and 0 to change?
terraform apply -auto-approve
terraform state list                              # local_file.legacy — adopted

# Drift cycle: change reality behind the ledger's back
echo "changed by hand!" > legacy.txt
terraform plan -detailed-exitcode; echo "exit=$?" # exit 2 — the nightly job's signal
terraform apply -auto-approve                     # reconcile: code wins
terraform destroy -auto-approve
```

Expected results: the first plan says import with no changes (config matches reality — adjust `content` if you typo'd it and watch the plan demand a change). The drift check exits 2 with a diff showing exactly what a nightly job would alert on; apply restores declared state — Part 3's "desired wins," now on schedule.

## Check yourself

1. Why is the `import` block preferred over the legacy `terraform import` CLI command?
2. In what order do you adopt a legacy account, and what must be true about *new* resources during the transition?
3. The nightly drift job flags a security-group rule someone added by hand during an incident. What's the right response — and what's the wrong one?

<details><summary>See answers</summary>

1. It's declarative and plan-reviewed: the adoption appears in a plan (with any config mismatches shown as changes) and goes through PR review like all changes. The CLI command mutated state imperatively from a laptop — invisible to the team, no review, no record.
2. Smallest blast radius first (tags/buckets/DNS → security groups/IAM → databases/networks), ranked by change frequency; meanwhile every new resource is born in code so the unmanaged set only shrinks. Some resources stay documented-unmanaged forever, by choice.
3. Right: backport the rule into code today — the change was legitimate, its statelessness isn't. Wrong: revert it blindly (it may be load-bearing) or leave it as standing drift (alarm fatigue kills the whole detection system).

</details>

## Key takeaways

- The `import` block makes adoption a reviewed plan, not laptop state surgery; `removed` is its mirror. Generated config is a draft, not gospel.
- Eat the elephant by blast radius: small wins first, new resources born in code, and a documented "unmanaged by choice" frontier.
- Nightly `plan -detailed-exitcode` is drift detection; triage into backport / investigate / ignore_changes — and drive alerts to zero or the channel dies.
- The endgame is cultural: read-only consoles, a paging break-glass role, and a fast code path — because drift prevention is a habit, not a job.

*Next — Part 11: Testing, Policy & Guardrails for IaC.*
