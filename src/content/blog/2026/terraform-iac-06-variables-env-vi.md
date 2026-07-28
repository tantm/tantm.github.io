---
title: 'Variables, Outputs & Multi-Environment'
description: 'Variable có type và validation, locals cho giá trị tính toán, outputs làm hợp đồng giữa các config — lắp thành layout dev/prod chuẩn giữ các môi trường giống hệt nhau về hình dạng.'
date: 2026-08-05
category: DevOps
tags: [terraform-iac, terraform, devops]
lang: vi
translationKey: terraform-iac-06
series: terraform-iac
part: 6
cover: images/s12-p06-hero.png
---

Giá trị hard-code làm bài 1–5 dễ đọc — và không thể tái dùng. Hạ tầng thật chạy *cùng một hình dạng* ở dev và prod với *kích cỡ khác nhau*, và hệ thống variable của Terraform là cách bạn nói điều đó một cách chính xác. Bài này cho bạn ba loại block giá trị và cấu trúc thư mục biến multi-environment thành thứ nhàm chán (lời khen cao nhất trong hạ tầng).

## Bạn sẽ học được gì

- Khai báo variable có type, default, và validation chặn lỗi từ sớm.
- Dùng locals cho giá trị tính toán — và biết khi nào một giá trị là variable hay local.
- Công bố outputs làm hợp đồng cho config khác và con người dùng.
- Lắp layout multi-environment chuẩn: cùng module, khác tfvars.

**Cần biết trước:** Bài 1–5. Vẫn thực hành local — không cần cloud.

## 1. Variables: input có type và cổng kiểm soát

```hcl
variable "env" {
  type        = string
  description = "Tên môi trường, dùng trong tên resource và tag"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env phải là một trong: dev, staging, prod."
  }
}

variable "instance_count" {
  type    = number
  default = 1                    # tuỳ chọn: có default
}

variable "db_password" {
  type      = string
  sensitive = true               # không bao giờ in ra plan hay log
}
```

Tham chiếu bằng `var.env`, `var.instance_count`. Ba thói quen sinh lời ngay:

- **Type mọi thứ.** `type = string` biến "lỡ truyền vào một list" thành lỗi tức thì, rõ ràng — thay vì một cú hỏng khó hiểu ở hạ nguồn.
- **Validate những giá trị gây đau.** Validation `env` ở trên nghĩa là gõ nhầm `"prd"` fail trong một giây ngay lúc plan — không phải sau khi tạo nửa môi trường với tên sai. Validation là cổng kiểm soát input (đúng bản năng validate-tại-biên bạn dùng khi viết code).
- **Đánh dấu secret bằng `sensitive`.** Plan in `(sensitive value)` thay vì password. Nó vẫn nằm trong state (cảnh báo bài 3 còn nguyên) — cái này bảo vệ log và scrollback terminal, không bảo vệ file state.

Giá trị đến từ đâu? Theo thứ tự ưu tiên: cờ `-var` → file `*.tfvars` → biến môi trường (`TF_VAR_env=dev`) → default. Thứ bạn dùng hằng ngày là **file tfvars** — mục 4.

## 2. Locals: tính một lần, đặt tên tử tế

**Local** là một biểu thức có tên — không phải input, mà là *dẫn xuất*:

```hcl
locals {
  name_prefix = "myapp-${var.env}"          # tính từ input

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

Quy tắc quyết định: **variable là câu hỏi bạn hỏi người gọi; local là câu trả lời bạn tự tính.** Nếu mọi môi trường đều truyền vào cùng một biểu thức, đó không phải câu hỏi — biến nó thành local. Pattern `common_tags` ở trên là local được copy nhiều nhất trong codebase thật: định nghĩa tag một lần, gắn khắp nơi, và dashboard chi phí của bạn (series AWS bài 16) chạy tốt mãi mãi.

## 3. Outputs: hợp đồng mà config khác đọc

```hcl
output "bucket_name" {
  value       = aws_s3_bucket.reports.id
  description = "Tên bucket reports — app config tiêu thụ"
}
```

Outputs làm ba việc, theo tầm quan trọng tăng dần: chúng **in ra** sau apply (tiện cho người); chúng **trả kết quả module** (bài 7 — outputs của module chính là giá trị trả về của nó); và chúng tạo **hợp đồng giữa các config tách biệt** — config network output `vpc_id` và `subnet_ids`, config app đọc chúng (qua `terraform_remote_state` hoặc — tốt hơn ở quy mô team — data source tra theo tag/tên). Đối xử với outputs như một public API: đặt tên tử tế, mô tả rõ, và đừng xoá tuỳ tiện — có người ở hạ nguồn đang đọc chúng. Đúng kỷ luật "outputs là hợp đồng" như bất kỳ API nào bạn ship.

## 4. Layout multi-environment, lắp hoàn chỉnh

Mọi thứ hội tụ ở đây. Layout chuẩn — cùng hình dạng, khác kích cỡ:

```text
infra/
├── modules/                  # hình dạng dùng chung (bài 7 sẽ tạo)
│   └── app/
├── envs/
│   ├── dev/
│   │   ├── main.tf           # gọi CÙNG module với prod
│   │   ├── backend.tf        # state key riêng (bài 5)
│   │   └── terraform.tfvars  # env="dev", instance_count=1, size nhỏ
│   └── prod/
│       ├── main.tf           # cùng module, cùng hình dạng
│       ├── backend.tf        # state key tách biệt
│       └── terraform.tfvars  # env="prod", instance_count=4, size thật
```

Làm việc trong một môi trường = `cd envs/dev && terraform apply`. Môi trường hiện rõ trong prompt, diff PR cho thấy env *nào* thay đổi, và state key tách biệt của bài 5 cho mỗi env sổ cái và quyền riêng.

Bất biến cần bảo vệ trong code review: **các môi trường chỉ khác nhau ở tfvars.** Khoảnh khắc `envs/prod/main.tf` có thêm một resource mà dev không có, staging của bạn test một hệ thống khác với hệ thống production đang chạy — chính cú hỏng mà series AWS đã chỉ ra. Nếu prod cần thứ mới, thêm vào module dùng chung kèm một variable để dev thu nhỏ (hoặc về không).

## Thực hành (15 phút — không cần cloud)

```bash
mkdir -p tf-env-lab/envs/{dev,prod} && cd tf-env-lab
cat > envs/dev/main.tf <<'EOF'
variable "env" {
  type = string
  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env phải là dev hoặc prod."
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

# 1. Cùng hình dạng, khác kích cỡ
(cd envs/dev  && terraform init -input=false && terraform apply -auto-approve)   # 1 file
(cd envs/prod && terraform init -input=false && terraform apply -auto-approve)   # 3 file

# 2. Cổng validation: thử gõ nhầm
(cd envs/dev && terraform plan -var 'env=prd')      # fail trong 1 giây, message rõ ràng

# 3. Đọc hợp đồng
(cd envs/prod && terraform output files)

# 4. Dọn dẹp
(cd envs/dev && terraform destroy -auto-approve); (cd envs/prod && terraform destroy -auto-approve)
```

Kết quả mong đợi: dev tạo 1 file, prod tạo 3 — cùng code, khác tfvars. Bước 2 fail tức thì với error message *của bạn*. Bước 3 in danh sách output — hợp đồng, đọc được bất cứ lúc nào.

## Tự kiểm tra

1. Khi nào một giá trị nên là variable, khi nào nên là local?
2. `sensitive = true` bảo vệ cái gì — và *không* bảo vệ cái gì?
3. Reviewer thấy một resource mới thêm thẳng vào `envs/prod/main.tf`. Vì sao đó là cờ đỏ, và cách làm đúng là gì?

<details><summary>Xem đáp án</summary>

1. Variable = câu hỏi người gọi phải trả lời (khác nhau theo môi trường/người gọi). Local = giá trị bạn dẫn xuất từ giá trị khác (cùng công thức mọi nơi). Nếu mọi người gọi đều truyền cùng một thứ, đó là local.
2. Nó bảo vệ phần hiển thị: plan và log in `(sensitive value)`. Nó không bảo vệ file state — giá trị thật vẫn nằm đó, đó là lý do backend mã hoá, siết quyền của bài 5 quan trọng.
3. Nó phá bất biến "môi trường chỉ khác nhau ở tfvars" — dev/staging không còn test đúng hình dạng của prod. Cách đúng: thêm resource vào module dùng chung, kích cỡ điều khiển bằng variable để dev chạy nhỏ hoặc không chạy.

</details>

## Điều cần nhớ

- Variables là câu hỏi có type, có validation; chặn input xấu ngay lúc plan bằng error message của chính bạn, và đánh dấu secret sensitive (chỉ bảo vệ hiển thị).
- Locals là câu trả lời tự tính — `name_prefix` và `common_tags` là hai local mọi codebase rồi sẽ có.
- Outputs là hợp đồng: giá trị trả về của module và giao diện giữa các config — đặt tên và giữ gìn như public API.
- Layout: module dùng chung + thư mục theo env, nơi các môi trường *chỉ* khác nhau ở tfvars — bất biến giữ staging trung thực.

*Bài tiếp theo — Phần 7: Modules: Abstraction đúng cách.*
