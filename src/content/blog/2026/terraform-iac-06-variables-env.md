---
title: 'Variables, Outputs & Multi-Environment'
description: 'Variables with types and validation, locals for computed values, outputs as contracts between configs — assembled into the standard dev/prod layout that keeps environments identical in shape.'
date: 2026-08-05
category: DevOps
tags: [terraform-iac, terraform, devops]
lang: en
translationKey: terraform-iac-06
series: terraform-iac
part: 6
cover: images/s12-p06-hero.png
---

Hard-coded values made Parts 1–5 easy to read — and impossible to reuse. Real infrastructure runs the *same shape* in dev and prod with *different sizes*, and Terraform's variable system is how you say that precisely. This part gives you the three value blocks and the directory layout that makes multi-environment boring (the highest compliment in infrastructure).

## What you'll learn

- Declare variables with types, defaults, and validation that fails early.
- Use locals for computed values — and know when a value is a variable vs a local.
- Publish outputs as the contract other configs and humans consume.
- Assemble the standard multi-environment layout: same modules, different tfvars.

**Prerequisites:** Parts 1–5. Local practice again — no cloud needed.

## 1. Variables: typed inputs with a gate

```hcl
variable "env" {
  type        = string
  description = "Environment name, used in resource names and tags"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be one of: dev, staging, prod."
  }
}

variable "instance_count" {
  type    = number
  default = 1                    # optional: has a default
}

variable "db_password" {
  type      = string
  sensitive = true               # never printed in plans or logs
}
```

Reference them as `var.env`, `var.instance_count`. Three habits that pay off immediately:

- **Type everything.** `type = string` turns "passed a list by accident" into an instant, clear error instead of a weird downstream failure.
- **Validate the values that hurt.** The `env` validation above means a typo like `"prd"` fails in one second at plan time — not after creating half an environment with wrong names. Validation is your input gate (the same validate-at-the-border instinct you use in code).
- **Mark secrets `sensitive`.** Plans print `(sensitive value)` instead of the password. It still lives in state (Part 3's warning stands) — this protects logs and terminal scrollback, not the state file.

Where do values come from? In precedence order: `-var` flags → `*.tfvars` files → environment variables (`TF_VAR_env=dev`) → defaults. The one you'll use daily is the **tfvars file** — section 4.

## 2. Locals: computed once, named well

A **local** is a named expression — not an input, a *derivation*:

```hcl
locals {
  name_prefix = "myapp-${var.env}"          # computed from inputs

  common_tags = {
    env        = var.env
    managed_by = "terraform"
    project    = "myapp"
  }
}

resource "aws_s3_bucket" "reports" {
  bucket = "${local.name_prefix}-reports"   # myapp-dev-reports
  tags   = local.common_tags
}
```

The decision rule: **a variable is a question you ask the caller; a local is an answer you compute yourself.** If every environment would pass the same expression in, it's not a question — make it a local. The `common_tags` pattern above is the single most copied local in real codebases: define tags once, attach everywhere, and your cost dashboard (AWS series Part 16) works forever after.

## 3. Outputs: the contract other configs read

```hcl
output "bucket_name" {
  value       = aws_s3_bucket.reports.id
  description = "Name of the reports bucket — consumed by the app config"
}
```

Outputs do three jobs, in ascending importance: they **print** after apply (human convenience); they **surface module results** (Part 7 — a module's outputs are its return values); and they form the **contract between separate configs** — your network config outputs `vpc_id` and `subnet_ids`, and the app config reads them (via `terraform_remote_state` or — better at team scale — a data source lookup by tags/name). Treat outputs like a public API: name them well, describe them, and don't remove them casually — someone downstream is reading them. That's the same "outputs are a contract" discipline as any API you ship.

## 4. The multi-environment layout, assembled

Everything converges here. The standard layout — same shape, different sizes:

```text
infra/
├── modules/                  # shared shapes (Part 7 makes these)
│   └── app/
├── envs/
│   ├── dev/
│   │   ├── main.tf           # calls the SAME modules as prod
│   │   ├── backend.tf        # its own state key (Part 5)
│   │   └── terraform.tfvars  # env="dev", instance_count=1, small sizes
│   └── prod/
│       ├── main.tf           # same modules, same shape
│       ├── backend.tf        # separate state key
│       └── terraform.tfvars  # env="prod", instance_count=4, real sizes
```

Work in an environment = `cd envs/dev && terraform apply`. The environment is visible in your prompt, your PR diff shows *which* env changed, and Part 5's separate state keys give each env its own ledger and permissions.

The invariant to defend in code review: **environments differ only in tfvars.** The moment `envs/prod/main.tf` gains a resource that dev doesn't have, your staging tests test a different system than production runs — the exact failure the AWS series called out. If prod needs something new, add it to the shared module with a variable to size it down (or to zero) in dev.

## Practice (15 minutes — no cloud needed)

```bash
mkdir -p tf-env-lab/envs/{dev,prod} && cd tf-env-lab
cat > envs/dev/main.tf <<'EOF'
variable "env" {
  type = string
  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env must be dev or prod."
  }
}
variable "file_count" {
  type    = number
  default = 1
}
locals { name_prefix = "app-${var.env}" }

resource "local_file" "f" {
  count    = var.file_count
  filename = "${local.name_prefix}-${count.index}.txt"
  content  = "env=${var.env}"
}
output "files" { value = local_file.f[*].filename }
EOF
cp envs/dev/main.tf envs/prod/main.tf
echo 'env = "dev"'  > envs/dev/terraform.tfvars
printf 'env = "prod"\nfile_count = 3\n' > envs/prod/terraform.tfvars

# 1. Same shape, different size
(cd envs/dev  && terraform init -input=false && terraform apply -auto-approve)   # 1 file
(cd envs/prod && terraform init -input=false && terraform apply -auto-approve)   # 3 files

# 2. Validation gate: try a typo
(cd envs/dev && terraform plan -var 'env=prd')      # fails in 1 second, clear message

# 3. Read the contract
(cd envs/prod && terraform output files)

# 4. Clean up
(cd envs/dev && terraform destroy -auto-approve); (cd envs/prod && terraform destroy -auto-approve)
```

Expected results: dev creates 1 file, prod creates 3 — same code, different tfvars. Step 2 fails instantly with *your* error message. Step 3 prints the output list — the contract, readable on demand.

## Check yourself

1. When should a value be a variable, and when a local?
2. What does `sensitive = true` protect — and what does it *not* protect?
3. A reviewer sees a new resource added directly in `envs/prod/main.tf`. Why is that a red flag, and what's the right move?

<details><summary>See answers</summary>

1. Variable = a question the caller must answer (differs per environment/caller). Local = a value you derive from other values (same formula everywhere). If all callers would pass the same thing, it's a local.
2. It protects display: plans and logs print `(sensitive value)`. It does not protect the state file — the real value still lives there, which is why Part 5's encrypted, locked-down backend matters.
3. It breaks the "environments differ only in tfvars" invariant — dev/staging no longer test prod's shape. Right move: add the resource to the shared module, sized by a variable so dev can run it small or not at all.

</details>

## Key takeaways

- Variables are typed, validated questions; fail bad inputs at plan time with your own error message, and mark secrets sensitive (display-only protection).
- Locals are computed answers — `name_prefix` and `common_tags` are the two every codebase ends up with.
- Outputs are contracts: module return values and the interface between configs — name and keep them like a public API.
- The layout: shared modules + per-env directories, where environments differ *only* in tfvars — the invariant that keeps staging honest.

*Next — Part 7: Modules: Abstraction Done Right.*
