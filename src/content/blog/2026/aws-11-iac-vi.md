---
title: 'Infrastructure as Code: Terraform trên AWS'
description: 'Vì sao click chuột là nợ kỹ thuật, state là khái niệm giải thích mọi hành vi của Terraform, plan là artifact để review, và drift là căn bệnh IaC sinh ra để chữa.'
date: 2026-08-04
category: Cloud
tags: [aws, terraform, iac, devops]
lang: vi
translationKey: aws-11
series: aws-zero-to-advanced
part: 11
---

Mọi thứ trong series này tới giờ, bạn đều có thể dựng bằng cách click console. Giờ đếm cái giá của click: không ai *review* được thay đổi (trọn luận đề của S01-P09), không ai *tái tạo* được môi trường (dev chạy, prod bí ẩn), và sáu tháng sau không ai biết *vì sao* security group kia mở port 8080. **Infrastructure as Code** áp kỷ luật phần mềm bạn đã có vào hạ tầng: khai báo trạng thái mong muốn trong file, version bằng git, review qua PR, và để một công cụ khiến thực tế khớp theo. Terraform là ngôn ngữ chung; khái niệm chuyển giao sang CDK/Pulumi và bè bạn.

## Bạn sẽ học được gì

- Nói được vì sao click trên console là nợ kỹ thuật, bằng ngôn ngữ một quản lý hiểu được.
- Đọc code khai báo và đoán trước plan sẽ hiện gì.
- Giải thích state — khái niệm khiến mọi hành vi khó hiểu của Terraform trở nên có lý.
- Chạy vòng plan-review-apply theo cách các team thật sự làm cho an toàn.

**Cần biết trước:** Phần 2–5 (các resource AWS bạn sẽ khai báo). Không cần biết Terraform từ trước.

## 1. Declarative: bạn nói cái gì, công cụ lo cách nào

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
    transition { days = 90  storage_class = "GLACIER" }   # lifecycle của S04-P04, thành code
    expiration { days = 365 }
  }
}
```

Bạn không viết "tạo một bucket" — bạn viết "một bucket *tồn tại* với các thuộc tính này." Chạy hai lần, lần hai không có gì xảy ra: **idempotency** (luật sắt của giáo trình — S02-P06, S02-P08, S04-P09 — giờ cho hạ tầng) là thuộc tính lõi, và là thứ khiến IaC an toàn để chạy lại, review được, tự động hoá được. Bài học declarative của SQL ở S01-P07, áp vào server.

## 2. State: khái niệm giải thích tất cả

Terraform giữ một **state file**: sổ ghi chép của nó về những gì nó đã tạo và ID thực tế đứng sau mỗi resource. Mọi hành vi khó hiểu của Terraform trở nên hiển nhiên khi bạn biết công cụ đang làm phép *so sánh ba bên* — code của bạn (mong muốn), state file (điều Terraform tin), và thực tế (thứ AWS đang có):

- **State là sự thật dùng chung** → làm team thì nó sống remote (pattern S3-backend) kèm **locking**, vì hai kỹ sư apply cùng lúc là race condition của S01-P08 với bán kính vụ nổ. Một state cho mỗi môi trường.
- **State biết secret của bạn** → password sinh tự động và tương tự đi qua nó; đối xử với bucket chứa state bằng kỷ luật CS-P11 (mã hoá, least privilege, không public bất cứ thứ gì).
- **Resource tạo bằng click không tồn tại với Terraform** → không phải bug, là định nghĩa: Terraform quản thứ nằm trong state. Import tồn tại để nhận nuôi đồ lạc; cách chữa thật nằm ở văn hoá (bên dưới).

## 3. Plan, apply, và workflow PR

`terraform plan` tính diff giữa mong muốn và thực tế — **plan chính là artifact để review**. Workflow khiến IaC sinh lời chính xác là vòng lặp S01-P09 cộng một bước: PR mở → CI đăng plan → một con người đọc → merge thì apply. Hai kỷ luật đọc:

- Các động từ của plan là thang độ nghiêm trọng: `+` create rẻ, `~` update tại chỗ thường ổn, **`-/+` destroy-rồi-tạo-lại là dòng phải page bạn** — trên một resource có state (một database!) từ đó nghĩa là *mất dữ liệu*, và bắt được nó trong review là trọn vẹn phần lãi của khoản đầu tư. Một số thay đổi thuộc tính ép replacement; plan nói cho bạn cái nào — đọc nó như đọc `EXPLAIN` (S01-P07).
- **Không ai apply từ laptop.** CI apply thứ đã được review, bằng role least-privilege riêng của nó (danh-tính-không-key của S04-P02, lần nữa). Một cú apply từ laptop với credential admin là `verify=false` của hạ tầng.

**Drift** là căn bệnh mà thứ này chữa: ai đó "sửa nhanh" prod trên console lúc 2 giờ sáng, và giờ thực tế không khớp code lẫn mental model của bất kỳ ai. `plan` phát hiện drift (phép so sánh ba bên kiếm cơm ở đây); còn *văn hoá* ngăn nó — quyền console thành read-only-trừ-phá-kính-khẩn-cấp, và cú sửa 2 giờ sáng thành một PR sáng hôm sau, không thì nó sẽ bị lặng lẽ revert bởi cú apply kế tiếp. Câu cuối đáng nhắc cho mọi thành viên mới: **một thay đổi console không ghi sổ không phải là fix; nó là quả bom hẹn giờ đặt lịch cho lần deploy tới.**

## 4. Module, môi trường, và abstract bao nhiêu là đủ

Một **module** là một function cho hạ tầng: input (variable) → resource → output. Chỉ dẫn thật thà là S01-P10 nguyên văn: **abstract ở lần xuất hiện thứ hai hoặc ba, đừng ở lần đầu.** Pattern duy nhất đáng nhận từ ngày một: *cùng module, khác variable* theo môi trường — dev và prod khác nhau ở cỡ và số lượng instance (`t3.small` vs `m6i.large`, 1 AZ vs 3), không bao giờ khác về hình dạng. Nếu prod có layout subnet mà dev không có, bài test staging của bạn chẳng test gì cả (layout của S04-P05 nên là một module chính vì lý do này).

Hai hiệu chỉnh khép bài. **CDK/Pulumi** diễn đạt cùng mô hình bằng ngôn ngữ lập trình tổng quát — vòng lặp và type thay cho HCL; khái niệm state/plan/drift y hệt, nên chọn theo nền tảng của team và đừng mở lại phiên tranh luận mỗi quý. Và **không phải mọi thứ đều thuộc về Terraform**: nó xuất sắc ở *lớp nền thay đổi chậm* — network, cluster, bucket, IAM. Deploy app đổi hằng giờ thường đi pipeline riêng (task definition của P08 qua CI); ép mọi deploy chui qua repo hạ tầng biến platform team thành một hàng đợi ticket. Kẻ đường ranh ở nơi nhịp thay đổi đổi nhịp.

## Thực hành (20 phút — xem state làm việc của nó, không cần đụng tài khoản cloud)

Provider `local_file` khiến mọi hành vi cốt lõi quan sát được trong vài phút, không cần credential và không tốn đồng nào:

```bash
mkdir tf-lab && cd tf-lab
cat > main.tf <<'EOF'
resource "local_file" "config" {
  filename = "app.conf"
  content  = "mode = production"
}
EOF

terraform init
terraform plan            # "1 to add" — trạng thái mong muốn so với cuốn sổ trống
terraform apply -auto-approve
cat app.conf

# 1. IDEMPOTENCY: chạy lại không đổi gì, vì thực tế đã khớp sẵn
terraform apply -auto-approve      # "No changes."

# 2. DRIFT: đổi thực tế sau lưng cuốn sổ
echo "mode = debug-hacked" > app.conf
terraform plan                     # Terraform NHÌN THẤY và đề xuất khôi phục
terraform apply -auto-approve
cat app.conf                       # code thắng: "mode = production"

# 3. STATE LÀ TRÍ NHỚ: xoá nó là Terraform quên nó từng sở hữu cái file
cp terraform.tfstate backup.tfstate
rm terraform.tfstate
terraform plan                     # "1 to add" trở lại — nó muốn TẠO thứ đã tồn tại
mv backup.tfstate terraform.tfstate
terraform plan                     # "No changes." — trí nhớ đã phục hồi

# 4. PHÉP SO SÁNH BA BÊN, nói thành lời
terraform state list               # cuốn sổ nghĩ nó sở hữu gì
terraform state show local_file.config | head -5

# 5. DESTROY: cuốn sổ cũng là cách nó biết phải xoá cái gì
terraform destroy -auto-approve
ls app.conf 2>/dev/null || echo "biến mất — vì state ghi rằng Terraform đã tạo nó"
```

Kết quả mong đợi: bước 1 cho thấy idempotency — cú apply thứ hai là vô hiệu vì trạng thái mong muốn và thực tế đã đồng thuận. Bước 2 là tự chữa lành: một cú sửa ngoài luồng trở thành một cái diff mà Terraform đề nghị hoàn tác, và đó chính xác là thứ một job kiểm drift hằng đêm báo về ở quy mô lớn. Bước 3 là bước giải thích phần lớn các sự cố Terraform khó hiểu bạn sẽ gặp: mất file state thì Terraform không biết nó sở hữu gì, nên nó lên kế hoạch tạo những resource vốn đã tồn tại. Và bước 5 khép vòng — xoá được là chỉ vì cuốn sổ đã ghi lại thứ nó tạo ra. Code, state, thực tế: mọi hành vi kỳ lạ đều là một trong ba thứ đó đang bất đồng.

## Tự kiểm tra

1. Đồng nghiệp tạo một security group trên console, rồi thêm nó vào code Terraform và chạy plan. Terraform đề xuất tạo nó. Vì sao, và nước đi đúng là gì?
2. Hai kỹ sư chạy `terraform apply` cùng lúc trên cùng một môi trường. Cái gì có thể hỏng, và thứ gì ngăn được?
3. Vì sao file state phải được coi là dữ liệu nhạy cảm?

<details><summary>Xem đáp án</summary>

1. Vì state không có ghi chép nào về nó — Terraform chỉ quản những gì cuốn sổ nói nó đã tạo. Apply sẽ fail (tên đã tồn tại) hoặc tệ hơn là tạo ra một bản trùng. Nước đi đúng là nhận nuôi nó: viết cấu hình khớp với thực tế rồi dùng import để resource vào state, sau đó xác nhận plan hiện "no changes".
2. Cả hai đọc state, cả hai tính plan dựa trên nó, và cả hai ghi lại — nên một cú apply có thể đè mất ghi chép của cú kia, để lại state không khớp thực tế. Remote state có lock ngăn được: cú apply thứ hai chờ thay vì đua. Đây đúng là hình dạng check-then-act của mọi bug concurrency, ở quy mô hạ tầng.
3. Vì nó chứa giá trị thuộc tính thật của các resource, gồm cả mật khẩu được sinh ra, chuỗi kết nối và những secret khác chưa bao giờ nằm trong code của bạn. Hãy lưu nó ở một backend riêng tư, có mã hoá, có kiểm soát truy cập — một file state trong repository công khai là một vụ lộ credential, không phải một file cấu hình.

</details>

## Điều cần nhớ

- IaC là code review, tái tạo được, và lịch sử — áp vào hạ tầng; declarative và idempotent nên chạy lại luôn an toàn.
- State là sổ cái ba bên của Terraform: remote + lock + mã hoá, một state mỗi môi trường — và mọi hành vi "kỳ lạ" là tam giác code/state/thực-tế đang cãi nhau.
- Plan là artifact review: đọc `-/+` trên resource có state như chuông báo cháy, chỉ apply từ CI, và coi thay đổi console không ghi sổ là bom hẹn giờ — đó chính là drift.
- Module ở lần xuất hiện thứ hai, môi trường khác nhau bằng variable chứ không bằng hình dạng, và giữ deploy app đổi-nhanh ngoài repo hạ tầng đổi-chậm.

*Tiếp theo — Phần 12: AWS security vượt khỏi IAM: KMS, Secrets, guardrails.*
