---
title: 'Reading Plans & Resource Lifecycle'
description: 'The four plan symbols and the one that destroys data, why some changes force replacement, and the lifecycle guards — prevent_destroy, create_before_destroy — that keep you safe.'
date: 2026-08-05
category: DevOps
tags: [terraform-iac, terraform, devops]
lang: en
translationKey: terraform-iac-04
series: terraform-iac
part: 4
cover: images/s12-p04-hero.png
---

A Terraform plan is a contract: it lists exactly what will happen to your infrastructure. Professionals read every plan the same disciplined way — because one symbol in that output, easy to skim past, means "destroy and recreate". On a database, that's the difference between a normal Tuesday and a very bad one.

## What you'll learn

- Read the four plan symbols fluently: `+`, `~`, `-`, `-/+`.
- Explain why some attribute changes force **replacement** — and spot them in the plan.
- Use the three `lifecycle` guards: `prevent_destroy`, `create_before_destroy`, `ignore_changes`.
- Force a replacement on purpose when a resource is broken.

**Prerequisites:** Parts 1–3. Practice is local-only again — no cloud account needed.

## 1. The four symbols

Every plan line starts with a symbol. Two are calm, one deserves attention, one is an alarm:

| Symbol | Meaning | Risk |
|---|---|---|
| `+` create | New resource appears | Low — nothing existing is touched |
| `~` update in-place | Attribute changes on the live resource | Low — resource keeps its identity and data |
| `-` destroy | Resource is deleted | **High** — is anything stateful inside? |
| `-/+` replace | Destroy, then create anew | **Highest** — deletion hiding inside a "change" |

The summary line at the bottom is your checksum: `Plan: 1 to add, 2 to change, 1 to destroy.` If those numbers surprise you, stop. A plan should never contain news.

## 2. Why replacement happens

Some attributes can be changed on a live resource (tags, sizes, timeouts). Others are **baked in at creation** — an S3 bucket's *name*, an EC2 instance's *AMI*, a database's *engine*. The cloud simply has no API to change them in place.

So when you edit one of those, Terraform tells the truth: the only way to get there is destroy + create. The plan marks the guilty attribute explicitly:

```text
-/+ resource "aws_s3_bucket" "reports" {
      ~ bucket = "reports-dev" -> "reports-prod"  # forces replacement
      ...
```

That comment — **`# forces replacement`** — is the most important line in any plan. Hunt for it every time you see `-/+`. It answers "why is Terraform destroying this?" precisely.

Two habits follow:

- **Know your immutable attributes** before renaming things. Names, AZs, engine types are usually immutable; tags and sizes usually aren't. When unsure, run the plan — that's what it's for.
- **A replace on a stateful resource is a migration, not an edit.** Buckets, databases, disks: their *contents* don't move just because Terraform recreates the shell. Plan the data move separately, or don't make the change.

## 3. Lifecycle guards: seatbelts in code

The `lifecycle` block inside a resource changes how Terraform treats it. Three arguments cover practically every need:

```hcl
resource "aws_db_instance" "main" {
  # ...

  lifecycle {
    prevent_destroy = true          # guard 1: refuse ANY plan that destroys this

    create_before_destroy = true    # guard 2: on replacement, build the new one
                                    # FIRST, then remove the old (no gap)

    ignore_changes = [tags["updated_by"]]   # guard 3: someone else manages
                                            # this attribute; don't fight them
  }
}
```

- **`prevent_destroy`** — the seatbelt for databases and stateful anything. If a plan would destroy the resource, Terraform *errors instead of planning*. Removing the guard requires a code change — which means a PR, which means a human review. That's the point.
- **`create_before_destroy`** — flips replacement order to avoid downtime. Essential for resources something else points at (certificates, launch templates, security groups): the new one exists before the old one disappears. Caveat: both exist briefly, so uniquely-named resources need name flexibility (a `name_prefix` instead of `name`).
- **`ignore_changes`** — the peace treaty. An autoscaler changes `desired_count`; an external system stamps a tag. Without this guard, every plan tries to "fix" their changes back (you saw this drift behavior in Part 3). List the attribute, and Terraform leaves it alone.

![Replacement order: default has a downtime gap; create_before_destroy overlaps old and new](images/s12-p04-concept1.png)

## 4. Forcing replacement on purpose

Sometimes the resource is *broken* — a corrupted VM, a wedged instance — and you *want* destroy + create even though the config didn't change. Don't edit config to trick Terraform. Say what you mean:

```bash
terraform apply -replace=aws_instance.web
```

The plan shows a clean `-/+` for exactly that resource, reviewable like any other change. (Older tutorials use `terraform taint` — same effect, now deprecated in favor of `-replace`, which is visible in the plan instead of hiding state-side.)

## Practice (15 minutes — no cloud needed)

See all four symbols and one guard, locally:

```bash
mkdir tf-plan-lab && cd tf-plan-lab
cat > main.tf <<'EOF'
resource "local_file" "a" {
  filename = "a.txt"
  content  = "v1"
}
EOF
terraform init && terraform apply -auto-approve      # symbol: +

# ~ update in place: content is changeable
sed -i 's/v1/v2/' main.tf
terraform plan                                        # symbol: ~ ... wait, look closely!
# local_file actually REPLACES on content change — read the plan:
# it shows -/+ with "content" marked "# forces replacement".
# Perfect lesson: never assume — the plan tells you which attributes force it.

terraform apply -auto-approve

# Force a replacement with no config change
terraform apply -replace=local_file.a -auto-approve   # -/+ on purpose

# Seatbelt test
cat >> main.tf <<'EOF'

resource "local_file" "protected" {
  filename = "keep.txt"
  content  = "precious"
  lifecycle { prevent_destroy = true }
}
EOF
terraform apply -auto-approve
terraform destroy                                     # ERRORS: prevent_destroy blocks it
# to actually clean up: remove the lifecycle line, then destroy
```

Expected results: the "content change" plan shows `-/+` with `# forces replacement` (surprise — that's the habit this lab builds). The final `destroy` fails with an instance-cannot-be-destroyed error until you remove the guard.

## Check yourself

1. A plan shows `-/+` on your production database because someone edited an immutable attribute. What do you look for in the plan, and what do you do?
2. When is `create_before_destroy` essential, and what naming problem can it cause?
3. An autoscaler keeps changing `desired_count`, and every Terraform plan wants to change it back. What's the fix?

<details><summary>See answers</summary>

1. Find the attribute marked `# forces replacement` to see exactly why. Then stop: a replace on a database means data loss — revert the change, or plan a real migration. Ideally the resource also carries `prevent_destroy` so the plan errors immediately.
2. When other resources reference the one being replaced (certs, launch templates, SGs) and a gap means downtime. Both copies briefly coexist, so fixed unique names collide — use `name_prefix`-style naming.
3. `lifecycle { ignore_changes = [desired_count] }` — declare that this attribute is managed elsewhere, and Terraform stops fighting the autoscaler.

</details>

## Key takeaways

- Four symbols, one alarm: `-/+` is a destroy hiding inside a change — and `# forces replacement` names the guilty attribute every time.
- Immutable attributes force replacement; on stateful resources a replace is a data migration, not an edit.
- Three seatbelts: `prevent_destroy` for stateful things, `create_before_destroy` for referenced things, `ignore_changes` for attributes someone else manages.
- Broken resource, unchanged config? `apply -replace=...` says exactly what you mean, visibly in the plan.

*Next — Part 5: Remote State & Working as a Team.*
