---
title: 'Module: abstraction đúng cách'
description: 'Giải phẫu module, luật lần-hai để biết khi nào tách, module registry hay tự viết, pin version, và anti-pattern "bọc 1 resource" phá nát codebase.'
date: 2026-08-12
category: DevOps
tags: [terraform-iac, terraform]
lang: vi
translationKey: terraform-iac-07
series: terraform-iac
part: 7
cover: images/s12-p07-hero.png
---

Bài 6 kết thúc bằng một lời hứa: các môi trường dùng chung module và chỉ khác nhau ở tfvars. Bài này xây nốt vế module của lời hứa đó. Module là *function* của Terraform — và như function trong code, tay nghề không nằm ở chỗ viết ra nó, mà ở chỗ biết **khi nào** nên viết và **to cỡ nào**. Làm sai là bạn đổi sự trùng lặp lấy thứ tệ hơn: sự vòng vèo không ai lần theo nổi.

## Bạn sẽ học được gì

- Đọc và viết một module: giải phẫu ba file và cách lời gọi nối dây.
- Áp luật lần-hai để quyết định khi nào code thành module.
- Chọn giữa module registry và tự viết — và pin version ở cả hai đường.
- Nhận diện hai anti-pattern: bọc-một-resource và God module.

**Cần biết trước:** Bài 1–6, đặc biệt variables và outputs (bài 6) — module chính là hai ý tưởng đó được cấp một thư mục.

## 1. Giải phẫu: module là một thư mục

Module là bất kỳ thư mục file `.tf` nào có giao diện rõ ràng:

```text
modules/s3-static-site/
├── main.tf        # resources: bucket, policy, website config
├── variables.tf   # inputs — chữ ký hàm của module
└── outputs.tf     # giá trị trả về — thứ caller được phép phụ thuộc
```

```hcl
# modules/s3-static-site/variables.tf
variable "site_name" { type = string }
variable "env"       { type = string }

# modules/s3-static-site/outputs.tf
output "bucket_name"   { value = aws_s3_bucket.site.id }
output "website_url"   { value = aws_s3_bucket_website_configuration.site.website_endpoint }
```

Gọi nó giống hệt gọi một function — truyền input, đọc giá trị trả về:

```hcl
# envs/dev/main.tf
module "docs_site" {
  source    = "../../modules/s3-static-site"
  site_name = "docs"
  env       = var.env          # dev truyền "dev"; prod truyền "prod" — lời hứa bài 6
}

output "docs_url" { value = module.docs_site.website_url }
```

Mental model chuyển thẳng từ code sang: **variables là chữ ký, resources là thân hàm, outputs là giá trị trả về.** Mọi thứ bên trong mà module không output đều là private — caller không thò tay vào được, và đó chính là mục đích.

## 2. Khi nào tách: luật lần-hai

Series CS (S01-P10) đã cho luật với function, và nó chuyển sang nguyên văn: **đừng abstract ở lần viết đầu; tách khi sắp viết lần thứ hai.** Lần dùng đầu, viết resource thẳng và học lấy hình dạng. Lần dùng thứ hai — staging cần đúng cụm bucket-kèm-policy mà dev đang có — *đó* là khoảnh khắc: giờ bạn biết phần nào biến thiên (thành variables) và phần nào bất biến (nằm cứng trong thân module).

Tách ở lần viết *đầu* nghĩa là đoán giao diện — và giao diện đoán mò mọc mụn: variable không ai từng set khác đi, output không ai đọc. Tách ở lần thứ hai nghĩa là giao diện được *khám phá*, không phải bịa ra. Variables chính xác là những thứ đã khác nhau giữa hai chỗ gọi. Không phải đoán gì.

## 3. Module registry vs tự viết

Terraform Registry công khai có module chín muồi cho các hình khối lớn (VPC, cluster, database). Cán cân thật thà:

| | Module registry | Module tự viết |
|---|---|---|
| Hợp với | Hạ tầng phức tạp, chuẩn hoá (một VPC tử tế cỡ ~30 resource) | Tổ hợp mang quan điểm riêng của team bạn |
| Bạn nhận | Edge case đã qua trận mạc, docs, nâng cấp | Giao diện khớp *chính xác* convention của bạn |
| Bạn chấp nhận | Quan điểm của họ, bề mặt variable đồ sộ, nhấp nhô khi upgrade | Bảo trì thuộc về bạn mãi mãi |

Mặc định lành mạnh: registry cho phần ống nước ai cũng dùng, module mỏng tự viết cho tổ hợp team bạn lặp lại. Đường nào cũng phải **pin version**:

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.8"        # không bao giờ thả nổi — update module là thay đổi hạ tầng
}
```

Module không pin nghĩa là lịch release của người khác quyết định lúc nào hạ tầng của bạn đổi hình — đúng sự bất định mà lockfile (bài 2) sinh ra để chặn cho provider. Cùng một luật, cao hơn một tầng. (Với module local của chính bạn, git tag hoặc private registry cho cùng khả năng pin khi nhiều repo cùng tiêu thụ.)

## 4. Hai anti-pattern

**Bọc-một-resource.** Một module chứa đúng một `aws_s3_bucket` với mười lăm variable chuyển tiếp vào mười lăm argument. Nó thêm một tầng tên phải học, che mất docs của provider, và abstract *con số không* — caller vẫn quyết mọi chi tiết. Nếu module không mã hoá một quyết định (một tổ hợp, một convention, một default cưỡng chế), nó là chi phí đội lốt kiến trúc. Xoá đi và dùng thẳng resource.

**God module.** Cú hỏng ngược lại: `modules/entire-app` tạo network, cluster, database, DNS, monitoring từ bốn mươi variable. Giờ mọi thay đổi — nhỏ mấy cũng vậy — plan qua tất cả; blast radius tối đa; và không môi trường nào nhận *một phần* của nó được. Cắt theo đường nối vòng đời: thứ thay đổi cùng nhau thì ở cùng nhau (cách chia state theo config của bài 5 đi theo đúng những đường nối này).

Phép thử cho module tốt: **mô tả được nó quyết định gì trong một câu không?** "Bucket private chuẩn của team: bật mã hoá, chặn public access, lifecycle theo chính sách retention" — đó là một module. "Nó tạo một bucket" không phải quyết định. "Nó tạo tất cả" là quá nhiều quyết định.

## Thực hành (15 phút — không cần cloud)

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

# Gọi hai lần từ một root — hai instance, input khác nhau
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
terraform output all                      # 4 file, thấy đủ cả hai instance
terraform state list                      # để ý prefix module.<tên> theo từng instance
terraform destroy -auto-approve
```

Kết quả mong đợi: một module, hai instance, bốn file — `state list` hiện resource được đặt tên `module.dev_report...` và `module.prod_report...`, chứng minh các instance độc lập hoàn toàn. Cách đặt tên đó cũng là lý do `terraform state mv` (bài 3) quan trọng khi sau này bạn dời resource *vào* một module.

## Tự kiểm tra

1. Vì sao tách module ở lần dùng thứ hai tốt hơn thiết kế sẵn từ đầu?
2. Module không pin version chia sẻ rủi ro gì với provider không pin — và cách sửa cho mỗi bên?
3. Đồng nghiệp đề xuất `modules/s3-bucket` bọc một resource "cho nhất quán." Câu hỏi nào quyết định nó có nên tồn tại?

<details><summary>Xem đáp án</summary>

1. Ở lần dùng thứ hai, giao diện được khám phá từ thực tế: variables chính xác là những gì đã khác nhau giữa hai chỗ gọi. Thiết kế sẵn là đoán — và giao diện đoán mò tích tụ variable thừa, output thiếu.
2. Cả hai đều để một bản release bên ngoài thay đổi hạ tầng của bạn mà repo không đổi gì — build bất định. Provider được pin bằng lockfile (commit vào repo); module bằng ràng buộc `version` tường minh (hoặc git tag với module tự viết).
3. "Nó mã hoá quyết định gì?" Nếu nó cưỡng chế convention của bạn (mã hoá, chặn public, retention) thì xứng đáng tồn tại. Nếu chỉ chuyển tiếp argument vào resource thì là lớp bọc — dùng thẳng resource.

</details>

## Điều cần nhớ

- Module = variables (chữ ký) + resources (thân) + outputs (giá trị trả về) trong một thư mục; caller chỉ thấy giao diện.
- Tách ở lần dùng thứ hai, không phải lần đầu — giao diện khám phá thắng giao diện đoán mò.
- Registry cho ống nước dùng chung, tự viết cho convention của team; pin version ở cả hai thế giới — module thả nổi là lịch deploy của người khác.
- Module tốt mã hoá một quyết định kể được trong một câu — không phải một resource bọc lại, cũng không phải cả app.

*Bài tiếp theo — Phần 8: Workflow PR: plan là artifact review.*
