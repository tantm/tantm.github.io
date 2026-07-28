---
title: 'Import đồ cũ & chống drift'
description: 'Block import nhận nuôi hạ tầng click tay, chiến lược tiếp quản account cũ mà không làm vỡ nó, drift detection theo lịch, và văn hoá console read-only giữ IaC trung thực.'
date: 2026-09-02
category: DevOps
tags: [terraform-iac, terraform]
lang: vi
translationKey: terraform-iac-10
series: terraform-iac
part: 10
cover: images/s12-p10-hero.png
---


Mọi khoá học dạy Terraform trên account trắng tinh. Gần như không ai được làm việc trên account như thế. Bài tập thật là: một account với ba năm resource dựng tay, không dòng code nào, và cả business đang chạy bên trên. Bài này là cẩm nang nhận nuôi — block `import`, chiến lược ăn con voi, và cú chuyển văn hoá (console read-only) giữ drift không bò lại.

## Bạn sẽ học được gì

- Đưa resource có sẵn vào diện quản lý bằng block `import` — có plan review, không phẫu thuật state.
- Chạy chiến lược nhận nuôi bốn bước cho account cũ mà không bao giờ liều với resource production.
- Dựng drift detection theo lịch và phân loại thứ nó tìm thấy.
- Cài đặt văn hoá chống tái phát: console về read-only, thay đổi đi qua code.

**Cần biết trước:** Bài 3–4 (state, plan) là nền móng; workflow bài 8 là nơi các cú import được review.

## 1. Block import: nhận nuôi bằng code

Từ Terraform 1.5, import là khai báo — bạn viết *nhận nuôi cái gì* ngay cạnh *nó phải trông thế nào*:

```hcl
import {
  to = aws_s3_bucket.reports          # địa chỉ nó sẽ nhận trong state
  id = "legacy-reports-bucket-2019"   # định danh ngoài đời thật
}

resource "aws_s3_bucket" "reports" {  # config nó phải khớp
  bucket = "legacy-reports-bucket-2019"
  tags   = { managed_by = "terraform" }
}
```

`terraform plan` sau đó hiện `1 to import` — và, quan trọng nhất, config của bạn có *khớp thực tế* không. Attribute bạn viết sai hiện thành thay đổi; bạn chỉnh config tới khi plan đọc là "import, không đổi gì." Vì chỉ là một cái plan, **trọn cú nhận nuôi đi qua PR review của bài 8** như mọi thay đổi khác — lệnh CLI `terraform import` cũ sửa state kiểu mệnh lệnh từ laptop; block biến nhận nuôi thành thứ review được. (Mẹo: `terraform plan -generate-config-out=generated.tf` phác block resource từ thực tế — coi output là bản nháp cần tỉa, không phải thánh chỉ: nó chép mọi attribute kể cả default bạn chẳng bao giờ viết.)

Công cụ soi gương: **block `removed`** (chính là `state rm` của bài 3, hoá khai báo) — "ngừng quản cái này, đừng destroy nó." Nhận nuôi và ly hôn, cả hai đều là code review được.

## 2. Ăn con voi: chiến lược nhận nuôi

Đừng cố import cả account cũ trong một PR anh hùng. Chiến lược chạy được:

1. **Kiểm kê và xếp hạng.** Liệt kê thứ đang tồn tại (console, `aws resourcegroupstaggingapi`, hoặc tool họ former-terraformer). Xếp theo *tần suất thay đổi* — resource bạn đụng hằng tháng hưởng lợi từ IaC ngay; đám tĩnh có thể chờ vô hạn.
2. **Nhận nuôi theo thứ tự bán kính sát thương, nhỏ trước.** Tag, bucket, bản ghi DNS → security group, IAM → cuối cùng mới tới ngọc quý (database, network). Mỗi cú import là một PR nhỏ với plan sạch. Thắng sớm luyện cơ bắp trước khi chạm thứ đáng sợ.
3. **Đồ mới sinh ra trong code từ ngày đầu.** Đóng băng tăng trưởng của bề mặt không-quản-lý: mọi resource *mới* đều Terraform-born, kể cả khi đồ cũ còn xếp hàng chờ. Tập không-quản-lý chỉ được phép co lại.
4. **Chấp nhận một biên giới vĩnh viễn.** Có những resource có lẽ không bao giờ đáng import (cái thí nghiệm 2019 không ai hiểu). Ghi chúng vào repo ("known unmanaged: X, Y — lý do"), để không-quản-vì-chọn phân biệt được với không-quản-vì-bỏ-bê.

Chỉ số quan trọng không phải "phần trăm đã import" mà là **"người lạ có biết cái gì đang được quản không?"** — một README với danh sách biên giới đạt điều đó ngay ngày đầu.

## 3. Drift detection: cú kiểm sự thật theo lịch

Bài 3 giới thiệu drift (thực tế đổi sau lưng sổ cái); ở quy mô team bạn săn nó theo lịch thay vì vấp phải nó. Cơ chế đơn giản đến ngượng — một job CI chạy đêm:

```bash
terraform plan -detailed-exitcode -input=false
# exit 0 = không drift · exit 2 = có drift → báo channel
```

Phân loại thứ nó tìm thấy vào đúng ba rổ:

- **Thay đổi khẩn cấp ai đó làm tay** (cú hotfix 2 giờ sáng): backport vào code *ngay hôm nay* — bản sửa là chính đáng; để nó tồn tại dưới dạng drift thì không.
- **Thay đổi lạ/không phép**: điều tra — có thể là "sửa nhanh" của đồng nghiệp, có thể tệ hơn. Drift detection kiêm luôn dây bẫy (bản năng audit của S04-P12, cài bằng một cron job).
- **Nhiễu provider** (thứ tự attribute, default): sửa config cho khớp, hoặc `ignore_changes` (bài 4) nếu là trường mà một hệ bên ngoài sở hữu chính đáng.

Luật giữ job đêm còn ý nghĩa: **cảnh báo drift phải đều đặn về không.** Một channel với 40 cảnh báo drift treo lơ lửng là channel không ai đọc — bài học alarm-fatigue mà mọi hệ monitoring sớm muộn đều dạy.

## 4. Văn hoá: console về read-only

Mọi biện pháp kỹ thuật ở trên đều thua một thói quen: con người click. Ván cuối của IaC adoption mang tính tổ chức, không phải kỹ thuật — **con người nhận quyền console read-only; quyền ghi thuộc về role của pipeline** (các role OIDC bài 9 khiến điều này tự nhiên: role apply tồn tại, chỉ là con người không cầm nó).

Làm cho nó sống được, đừng giáo điều: giữ một **role break-glass** cho khẩn cấp thật — dùng nó là page cả team, kích một lượt drift chạy ngay, và tự tạo ticket backport. Thông điệp không phải "console là ác quỷ"; mà là "console là *máy xem*". Ghép với tốc độ: nếu đường code mất hai ngày cho một thay đổi một dòng, người ta sẽ đi vòng — pipeline bài 8–9 có làn-nhanh cho thay đổi nhỏ *chính là* chống drift.

Điều này khép một vòng cung bắt đầu từ bài 1: hạ tầng là *cattle* định nghĩa bằng code, console là dashboard, thay đổi là diff được review. Nút edit trên console là thứ cuối cùng còn giữ hạ tầng làm *pet*.

## Thực hành (25 phút — local, trọn chu trình nhận nuôi)

Giả lập một resource "dựng tay" rồi nhận nuôi nó:

```bash
mkdir tf-adopt-lab && cd tf-adopt-lab
echo "built by hand in 2019" > legacy.txt        # hiện vật click-ops

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

terraform init && terraform plan                  # "1 to import" — và 0 to change?
terraform apply -auto-approve
terraform state list                              # local_file.legacy — đã nhận nuôi

# Chu trình drift: đổi thực tế sau lưng sổ cái
echo "changed by hand!" > legacy.txt
terraform plan -detailed-exitcode; echo "exit=$?" # exit 2 — tín hiệu của job đêm
terraform apply -auto-approve                     # hoà giải: code thắng
terraform destroy -auto-approve
```

Kết quả mong đợi: plan đầu nói import không kèm thay đổi (config khớp thực tế — thử gõ sai `content` và xem plan đòi một thay đổi). Cú kiểm drift exit 2 với diff đúng thứ job đêm sẽ cảnh báo; apply khôi phục trạng thái khai báo — "mong muốn thắng" của bài 3, giờ chạy theo lịch.

## Tự kiểm tra

1. Vì sao block `import` được ưu tiên hơn lệnh CLI `terraform import` cũ?
2. Nhận nuôi account cũ theo thứ tự nào, và điều gì phải đúng với resource *mới* trong lúc chuyển tiếp?
3. Job drift đêm phát hiện một rule security-group ai đó thêm tay trong một sự cố. Phản ứng đúng là gì — và phản ứng sai là gì?

<details><summary>Xem đáp án</summary>

1. Nó khai báo và được plan review: cú nhận nuôi hiện trong plan (kèm mọi lệch config hiện thành thay đổi) và đi qua PR review như mọi thay đổi. Lệnh CLI sửa state kiểu mệnh lệnh từ laptop — vô hình với team, không review, không dấu vết.
2. Bán kính sát thương nhỏ trước (tag/bucket/DNS → security group/IAM → database/network), xếp theo tần suất thay đổi; đồng thời mọi resource mới sinh ra trong code để tập không-quản-lý chỉ co lại. Một số resource ở lại diện documented-unmanaged mãi mãi, do lựa chọn.
3. Đúng: backport rule vào code ngay hôm nay — thay đổi là chính đáng, sự vô-sổ-sách của nó thì không. Sai: revert mù (nó có thể đang gánh tải) hoặc để nó treo thành drift thường trực (alarm fatigue giết cả hệ detection).

</details>

## Điều cần nhớ

- Block `import` biến nhận nuôi thành plan được review, không phải phẫu thuật state trên laptop; `removed` là tấm gương soi. Config generate ra là bản nháp, không phải thánh chỉ.
- Ăn con voi theo bán kính sát thương: thắng nhỏ trước, đồ mới sinh trong code, và một biên giới "unmanaged by choice" có ghi chép.
- `plan -detailed-exitcode` chạy đêm là drift detection; phân loại backport / điều tra / ignore_changes — và đưa cảnh báo về không, không thì channel chết.
- Ván cuối là văn hoá: console read-only, role break-glass có page, và đường code nhanh — vì chống drift là thói quen, không phải chức danh.

*Bài tiếp theo — Phần 11: Testing, policy & guardrails cho IaC.*
