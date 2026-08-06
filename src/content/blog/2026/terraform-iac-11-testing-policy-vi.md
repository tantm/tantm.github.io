---
title: 'Testing, policy & guardrails cho IaC'
description: 'Chiếc thang testing cho Terraform xếp theo chi phí — fmt/validate, linter, policy as code chặn public bucket trước khi nó tồn tại, và terraform test cho module dùng chung.'
date: 2026-09-09
category: DevOps
tags: [terraform-iac, terraform, security]
lang: vi
translationKey: terraform-iac-11
series: terraform-iac
part: 11
cover: images/s12-p11-hero.png
---


Review plan bắt được thứ con người nhìn thấy. Nó không bắt được cái S3 bucket public ở dòng 400, cái tag thiếu mà team finance cần, hay security group mở toang ra thế giới. Bài này dựng các lớp tự động bắt thứ reviewer bỏ sót — trước khi bất cứ thứ gì tồn tại.

## Bạn sẽ học được gì

- Xếp chiếc thang testing IaC theo chi phí, và biết mỗi bậc bắt được loại lỗi nào.
- Thêm linter tìm ra lỗi đặc thù provider mà `validate` không thấy được.
- Viết cổng policy-as-code tự động chặn plan nguy hiểm (public bucket, `0.0.0.0/0`).
- Quyết định khi nào `terraform test` đáng cái giá của apply thật — và khi nào không.

**Cần biết trước:** Bài 9 (pipeline CI nơi các phép kiểm này sống). Bài 4 giúp ích khi đọc plan.

Hãy hình dung một con đường đèo với nhiều hàng rào chắn ở các độ cao khác nhau. Không hàng rào nào một mình chặn được mọi cú trượt — hệ thống hoạt động vì mỗi hàng rào bắt thứ hàng rào phía trên để lọt, và đâm vào rào cao hơn luôn rẻ hơn đâm vào rào thấp hơn. Đó là toàn bộ thiết kế của bài này.

## 1. Chiếc thang: bốn bậc, xếp theo chi phí

Bài 9 xếp pipeline để lỗi rẻ chết sớm. Testing kéo dài đúng nguyên tắc đó thành một chiếc thang:

| Bậc | Loại công cụ | Bắt được | Chi phí | Cần cloud? |
|---|---|---|---|---|
| 1. Format & syntax | `terraform fmt -check`, `terraform validate` | HCL sai cú pháp, argument lạ, sai kiểu | Vài giây | Không |
| 2. Lint | tflint-class | Instance type không tồn tại, cú pháp deprecated, lỗi đặc thù provider | Vài giây | Không |
| 3. Policy | checkov/OPA-class | *Cấu hình* nguy hiểm: public bucket, security group mở toang, thiếu encryption | Giây–phút | Không (chạy trên plan) |
| 4. Test | `terraform test` | *Hành vi* module hỏng: apply cái này có thật sự ra thứ contract hứa không? | Nhiều phút + resource thật | Có (thường là vậy) |

Hai điều đáng chú ý. Thứ nhất, ba trong bốn bậc **không cần cloud account** — chúng chạy trên code và plan, nên không có lý do gì để bỏ qua. Thứ hai, mỗi bậc bắt một lớp lỗi mà bậc trước *về nguyên lý* không thể bắt: `validate` không thể biết `t2.nano.5` không phải instance type thật (đó là kiến thức provider — việc của lint), và linter không thể biết công ty *bạn* cấm public bucket (đó là policy — của bạn).

## 2. Bậc 1–2: syntax và lint, những chiến thắng miễn phí

`terraform validate` chứng minh code là Terraform *đúng ngữ pháp*. Linter chứng minh nó là Terraform *hợp lý*. Khoảng trống giữa hai thứ đó là nơi cả một họ lỗi đắt tiền sinh sống:

```hcl
resource "aws_instance" "web" {
  instance_type = "t3.mega"        # validate: ổn. lint: làm gì có type này.
  ami           = var.ami_id
}
```

`validate` cho qua — `instance_type` là một string argument hợp lệ. Lỗi chỉ lộ ra lúc **apply**, ở chỗ thất bại chậm nhất và ngượng nhất. Công cụ tflint-class biết catalog thật của provider và fail trong hai giây ở đầu pipeline.

Linter còn cưỡng chế nề nếp team một cách máy móc: quy ước đặt tên, tag bắt buộc trên resource gắn tag được, "không hardcode region". Mỗi luật linter cưỡng chế là một comment review không ai phải gõ — và khác con người, nó không bao giờ mệt, không bao giờ nương tay chiều thứ Sáu.

Cả hai bậc đều là một dòng mỗi thứ trong pipeline bài 9, trước `plan`. Không có gì phải tranh luận: bật lên, sửa một lần những gì nó tìm thấy, và từ đó nó im lặng mãi mãi.

## 3. Bậc 3: policy as code — luật của bạn, cưỡng chế trên plan

Lint biết luật của *provider*. Policy mã hoá luật của **tổ chức bạn** — và cưỡng chế trên plan, trước khi bất cứ thứ gì tồn tại.

Cơ chế là insight then chốt của bài: `terraform plan` xuất được plan ra JSON. JSON đó liệt kê mọi resource sắp được tạo và mọi attribute nó sẽ có. Policy engine chỉ là một chương trình đọc JSON đó và trả lời một câu hỏi: **"thay đổi này có được phép không?"**

```bash
terraform plan -out=tfplan
terraform show -json tfplan > plan.json
# policy engine đọc plan.json → pass, hoặc fail kèm tên vi phạm
```

Policy đến từ hai nguồn, và team trưởng thành dùng cả hai:

- **Bộ luật scanner** (checkov/tfsec-class): hàng trăm luật dựng sẵn cho pattern *ai-cũng-biết-là-xấu* — S3 bucket không encryption, security group mở `0.0.0.0/0`, IAM policy `*` trên `*`. Bạn nhận miễn phí toàn bộ vết sẹo tích luỹ của cả ngành. Ban đầu sẽ ồn: tinh chỉnh bằng ngoại lệ tường minh trong code (`# skip: rule-id — lý do`), để mọi ngoại lệ đều review được và có tác giả.
- **Policy tổ chức tự viết** (OPA/Sentinel-class): luật không vendor nào biết được. "Mọi resource mang tag `cost-center`." "Database production phải có `prevent_destroy`." "Chỉ platform team được tạo IAM role." Đây là checklist review của bài 8, thăng cấp từ văn xuôi lên code.

Đây chính là ý tưởng guardrail của S04-P12 dời sớm hơn một lớp. SCP chặn hành động bị cấm *tại API, lúc nó xảy ra*. Policy check chặn nó *trong PR, trước khi xảy ra* — cùng một luật, hàng rào rẻ hơn. Defense in depth nghĩa là có cả hai: policy-as-code cho phản hồi nhanh, guardrail mức account cho thứ lách qua được pipeline.

![Cùng một luật ở hai vị trí: cổng policy chặn plan ngay trong PR; guardrail mức account là hàng rào thứ hai, muộn hơn.](images/s12-p11-concept1.png)

## 4. Bậc 4: terraform test — chủ yếu cho module

Từ Terraform 1.6 có framework test native. Một file test dựng hạ tầng thật (hoặc chỉ plan), assert trên kết quả, rồi dọn sạch:

```hcl
# tests/bucket.tftest.hcl
run "creates_private_bucket" {
  variables { name = "test-bucket-tf" }

  assert {
    condition     = aws_s3_bucket_public_access_block.this.block_public_acls == true
    error_message = "bucket phải chặn public ACL"
  }
}
```

Mỗi block `run` là một cú apply (hoặc plan, với `command = plan` — rẻ hơn, bắt được ít hơn). Apply thật nghĩa là tiền thật và phút thật, nên nhắm bậc này vào chỗ nó sinh lời: **module dùng chung.** Module được mười team dùng là một contract (bài 7); bộ test của nó là thứ cho phép bạn nâng cấp mà không để mười team phát hiện regression hộ bạn. Với config lá dùng một chỗ, review plan cộng bậc 1–3 thường là đủ — bộ test đắt hơn số lỗi nó ngăn được là đồ trang trí, không phải kỹ thuật.

Ghi chú chi phí thật thà: test module cần sandbox account và thói quen dọn dẹp (lần chạy fail có thể bỏ rơi resource mồ côi). Hãy bắt đầu với assertion `command = plan` — miễn phí, chạy trong CI như mọi thứ khác, và đã đủ bắt vỡ contract kiểu "ai đó đổi default và giờ bucket thành public".

## 5. Lắp trọn bộ hàng rào

Trong pipeline bài 9, chiếc thang xếp thành các chặng, rẻ nhất trước: **fmt/validate → lint → plan → policy trên plan JSON → (với module) test.** Fail ở bậc nào pipeline dừng ở đó — đến lúc con người đọc plan trong PR, máy móc đã nói "được" bốn lần. Sự chú ý của reviewer dành trọn cho câu hỏi duy nhất máy không trả lời được: *thay đổi này có phải ý hay không?*

Vậy là bộ hàng rào hoàn chỉnh: con đường vẫn có thể bị lái ẩu, nhưng mọi cú trượt đoán trước được đều đâm vào một hàng rào rẻ, từ rất xa mép vực.

## Thực hành (20 phút — local, tự tay dựng một cổng policy)

Không cloud, không cài thêm tool — chỉ Terraform và `jq`. Bạn sẽ tự dựng cơ chế của bậc 3, để nó không bao giờ là hộp đen:

```bash
mkdir tf-policy-lab && cd tf-policy-lab

cat > main.tf <<'EOF'
resource "local_file" "config" {
  filename = "app.conf"
  content  = "debug = true"     # giả vờ đây là setting bị cấm
}
EOF

terraform init
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# Policy engine — 6 dòng jq:
cat > check.sh <<'EOF'
violations=$(jq -r '.resource_changes[]
  | select(.change.after.content != null)
  | select(.change.after.content | contains("debug = true"))
  | .address' plan.json)
if [ -n "$violations" ]; then
  echo "POLICY FAIL: cấm debug mode tại: $violations"; exit 1
fi
echo "policy pass"
EOF
bash check.sh; echo "exit=$?"                  # POLICY FAIL … exit=1

sed -i 's/debug = true/debug = false/' main.tf # sửa config
terraform plan -out=tfplan && terraform show -json tfplan > plan.json
bash check.sh; echo "exit=$?"                  # policy pass … exit=0
```

Kết quả mong đợi: lần check đầu exit 1 và *gọi tên đúng địa chỉ resource vi phạm* — exit code đó chính là thứ một chặng CI dùng để chặn merge. Sau khi sửa, exit 0. Policy engine thật thêm ngôn ngữ luật và hàng trăm luật dựng sẵn, nhưng cơ chế bạn vừa tự dựng — plan → JSON → câu hỏi → exit code — là toàn bộ mánh khoé.

## Tự kiểm tra

1. `terraform validate` pass nhưng apply fail với "invalid instance type". Thiếu bậc nào, và vì sao `validate` không bắt được?
2. Bộ luật scanner khác policy tổ chức chỗ nào — và vì sao cần cả hai?
3. Team bạn sở hữu một module VPC dùng chung (8 team dùng) và 40 config lá. Bạn nhắm `terraform test` vào đâu, và vì sao không phải mọi nơi?

<details><summary>Xem đáp án</summary>

1. Bậc 2, lint. `validate` chỉ kiểm ngữ pháp HCL và kiểu argument theo schema — string thì vẫn là string. Biết instance type nào thật sự tồn tại là kiến thức provider, đúng thứ công cụ tflint-class mã hoá.
2. Scanner mang luật dựng sẵn cho pattern xấu cả ngành đều biết (public bucket, security group mở toang) — vết sẹo miễn phí. Policy tổ chức mã hoá luật chỉ team bạn biết (tag bắt buộc, ai được đụng IAM). Scanner không thể biết luật của bạn; policy của bạn không thể phủ hết catalog bẫy của cả ngành.
3. Vào module — nó là contract với 8 bên dùng, và bộ test là thứ khiến nâng cấp an toàn. Config lá đã được bậc 1–3 cộng review plan phủ; test suite cho từng config sẽ đắt hơn số lỗi nó ngăn được.

</details>

## Điều cần nhớ

- Test IaC theo chiếc thang xếp theo chi phí: fmt/validate → lint → policy → test. Ba trong bốn bậc không cần cloud account.
- Lint mã hoá kiến thức của provider (instance type thật, deprecation); nó fail trong vài giây ở chỗ apply sẽ fail trong nhiều phút.
- Policy as code chạy luật tổ chức bạn trên plan JSON trước khi bất cứ thứ gì tồn tại — cùng guardrail với SCP, sớm hơn một lớp và rẻ hơn.
- Nhắm `terraform test` vào module dùng chung nơi contract có nhiều bên dùng; bắt đầu bằng assertion `command = plan` trước khi trả tiền cho apply thật.

*Bài tiếp theo — Phần 12: Pattern IaC, CDK/Pulumi & hồi kết.*
