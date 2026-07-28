---
title: 'Modules: Abstraction Done Right'
description: 'Module anatomy, the second-time rule for when to extract, registry modules versus writing your own, version pinning, and the wrapper anti-pattern that ruins codebases.'
date: 2026-08-12
category: DevOps
tags: [terraform-iac, terraform]
lang: en
translationKey: terraform-iac-07
series: terraform-iac
part: 7
cover: images/s12-p07-hero.png
---

Part 6 ended with a promise: environments share modules and differ only in tfvars. This part builds the module side of that promise. Modules are Terraform's *functions* — and like functions in code, the craft is not in writing them but in knowing **when** to write them and **how big** to make them. Get that wrong and you trade duplication for something worse: indirection nobody can follow.

## What you'll learn

- Read and write a module: the three-file anatomy and how calls wire it up.
- Apply the second-time rule to decide when code becomes a module.
- Choose between registry modules and writing your own — and pin versions either way.
- Spot the two module anti-patterns: the one-resource wrapper and the God module.

**Prerequisites:** Parts 1–6, especially variables and outputs (Part 6) — a module is those two ideas given a directory.

## 1. Anatomy: a module is a directory

A module is any directory of `.tf` files with a defined interface:

```text
modules/s3-static-site/
├── main.tf        # the resources: bucket, policy, website config
├── variables.tf   # inputs — the module's function signature
└── outputs.tf     # return values — what callers may depend on
```

```hcl
# modules/s3-static-site/variables.tf
variable "site_name" { type = string }
variable "env"       { type = string }

# modules/s3-static-site/outputs.tf
output "bucket_name"   { value = aws_s3_bucket.site.id }
output "website_url"   { value = aws_s3_bucket_website_configuration.site.website_endpoint }
```

Calling it looks exactly like calling a function — pass the inputs, read the returns:

```hcl
# envs/dev/main.tf
module "docs_site" {
  source    = "../../modules/s3-static-site"
  site_name = "docs"
  env       = var.env          # dev passes "dev"; prod passes "prod" — Part 6's promise
}

output "docs_url" { value = module.docs_site.website_url }
```

The mental model carries over from code exactly: **variables are the signature, resources are the body, outputs are the return value.** Everything inside that the module doesn't output is private — callers can't reach in, which is the point.

## 2. When to extract: the second-time rule

The CS series (S01-P10) gave the rule for functions, and it transfers verbatim: **don't abstract on first write; extract when you're about to write it the second time.** First use, write resources inline and learn the shape. Second use — staging needs the same bucket-plus-policy cluster dev has — *that's* the moment: you now know which parts vary (they become variables) and which are invariant (they stay hardcoded in the module body).

Extracting on the *first* write means guessing the interface — and guessed interfaces grow warts: variables nobody ever sets differently, outputs nobody reads. Extracting on the second write means the interface is *discovered*, not invented. The variables are exactly the things that differed between the two call sites. No guessing.

## 3. Registry modules vs your own

The public Terraform Registry has mature modules for the big shapes (VPCs, clusters, databases). The honest trade:

| | Registry module | Your own module |
|---|---|---|
| Best for | Complex, standardized infrastructure (a VPC done right is ~30 resources) | Your team's opinionated combinations |
| You get | Battle-tested edge cases, docs, upgrades | An interface that matches *your* conventions exactly |
| You accept | Their opinions, large variable surface, upgrade churn | Maintenance is yours forever |

A sane default: registry for the plumbing everyone shares, your own thin modules for the combinations your team repeats. Either way, **pin the version**:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"        # never unpinned — a module update is an infra change
}
```

An unpinned module means someone else's release schedule decides when your infrastructure changes shape — the exact non-determinism the lockfile (Part 2) exists to prevent for providers. Same rule, one level up. (For your own local modules, git tags or a private registry give you the same pinning once multiple repos consume them.)

## 4. The two anti-patterns

**The one-resource wrapper.** A module containing a single `aws_s3_bucket` with fifteen variables forwarding to its fifteen arguments. It adds a layer of names to learn, hides the provider docs, and abstracts *nothing* — the caller still decides every detail. If a module doesn't encode a decision (a combination, a convention, an enforced default), it's overhead pretending to be architecture. Delete it and use the resource directly.

**The God module.** The opposite failure: `modules/entire-app` that creates network, cluster, database, DNS, and monitoring from forty variables. Now every change — however small — plans through everything; blast radius is maximal; and no environment can adopt *part* of it. Split along lifecycle seams: things that change together stay together (Part 5's per-config state split follows the same seams).

The test for a good module: **can you describe what it decides in one sentence?** "Our standard private bucket: encryption on, public access blocked, lifecycle rules per our retention policy" — that's a module. "It makes a bucket" is not a decision. "It makes everything" is too many.

## Practice (15 minutes — no cloud needed)

```bash
mkdir -p tf-mod-lab/modules/report && cd tf-mod-lab
cat > modules/report/main.tf <<'EOF'
variable "env"   { type = string }
variable "lines" { type = number }
resource "local_file" "report" {
  count    = var.lines
  filename = "report-${var.env}-${count.index}.txt"
  content  = "line for ${var.env}"
}
output "files" { value = local_file.report[*].filename }
EOF

# Call it twice from one root — two instances, different inputs
cat > main.tf <<'EOF'
module "dev_report"  {
  source = "./modules/report"
  env    = "dev"
  lines  = 1
}
module "prod_report" {
  source = "./modules/report"
  env    = "prod"
  lines  = 3
}
output "all" { value = concat(module.dev_report.files, module.prod_report.files) }
EOF

terraform init && terraform apply -auto-approve
terraform output all                      # 4 files, both instances visible
terraform state list                      # note the module.<name> prefix per instance
terraform destroy -auto-approve
```

Expected results: one module, two instances, four files — `state list` shows resources namespaced as `module.dev_report...` and `module.prod_report...`, proving instances are fully independent. That namespacing is also why `terraform state mv` (Part 3) matters when you later move resources *into* a module.

## Check yourself

1. Why is extracting a module on second use better than designing it upfront?
2. What risk does an unpinned module version share with an unpinned provider — and what's the fix for each?
3. A colleague proposes `modules/s3-bucket` wrapping one resource "for consistency." What question decides whether it should exist?

<details><summary>See answers</summary>

1. On second use the interface is discovered from reality: variables are exactly what differed between the two call sites. Upfront design guesses — and guessed interfaces accumulate unused variables and missing outputs.
2. Both let an external release change your infrastructure without any change in your repo — non-deterministic builds. Providers are pinned by the lockfile (committed); modules by an explicit `version` constraint (or git tag for your own).
3. "What decision does it encode?" If it enforces your conventions (encryption, access blocks, retention), it earns its place. If it just forwards arguments to the resource, it's a wrapper — use the resource directly.

</details>

## Key takeaways

- A module = variables (signature) + resources (body) + outputs (return value) in a directory; callers see only the interface.
- Extract on the second use, not the first — discovered interfaces beat guessed ones.
- Registry modules for shared plumbing, your own for team conventions; pin versions in both worlds — an unpinned module is someone else's deploy schedule.
- A good module encodes one describable decision — not a single wrapped resource, not the whole app.

*Next — Part 8: The PR Workflow: Plan as Review Artifact.*
