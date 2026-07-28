---
title: 'Remote state & làm việc theo team'
description: 'Đưa state khỏi laptop: S3 backend có lock, mỗi môi trường một state, vì sao workspace gây thất vọng, và checklist bảo mật state mà team thật sự cần.'
date: 2026-08-05
category: DevOps
tags: [terraform-iac, terraform, aws]
lang: vi
translationKey: terraform-iac-05
series: terraform-iac
part: 5
cover: images/s12-p05-hero.png
---

Mọi thứ tới giờ giữ state trong một file local — ổn cho một người, hỏng cho một team. Ngày đồng đội thứ hai chạy `terraform apply`, bạn có hai cuốn sổ cái mô tả một thực tại, và cuốn sai sẽ thắng. Bài này chuyển sổ cái lên kho lưu trữ dùng chung, có khoá, có version — thiết lập mà mọi team thật đều chạy.

## Bạn sẽ học được gì

- Cấu hình remote backend (họ S3) có locking, từng bước.
- Giải thích locking ngăn điều gì — và đọc đúng thông báo lỗi lock.
- Tách state theo môi trường, và nói được vì sao workspace thường không phải câu trả lời.
- Áp checklist bảo mật state 4 điểm.

**Cần biết trước:** Bài 1–4. Một tài khoản AWS cho backend (S3 + DynamoDB ở quy mô này nằm trong free tier).

## 1. Vấn đề: hai sổ cái, một thực tại

State local hại team theo ba cách, nặng dần:

- **Phân kỳ.** Bạn apply từ laptop mình; đồng đội apply từ laptop họ. Mỗi người một cuốn sổ cái mà người kia chưa từng thấy. Plan kế tiếp ở bên nào cũng đề nghị "sửa lại" công trình của bên kia.
- **Mất.** State sống trên một laptop. Laptop chết → team không còn biết Terraform quản những gì (bài 3 đã cho thấy điều đó tê liệt cỡ nào).
- **Đua.** Hai cú apply cùng lúc đan xen các lần ghi — sổ cái hỏng, kết cục tệ nhất.

Cách chữa có hai phần: **kho chung** (mọi người đọc/ghi một sổ cái) và **locking** (mỗi lúc chỉ một apply).

## 2. S3 backend, từng dòng

```hcl
terraform {
  backend "s3" {
    bucket         = "myco-terraform-state"     # ngôi nhà chung
    key            = "network/prod/terraform.tfstate"  # sổ cái của RIÊNG config này
    region         = "ap-southeast-1"
    encrypt        = true                        # state chứa secret (bài 3)
    dynamodb_table = "terraform-locks"           # cái khoá
  }
}
```

Ba ghi chú đỡ bối rối:

- **`key` là đường dẫn tới state của *config này*** trong bucket chung. Config khác nhau (network vs app; dev vs prod) nhận key khác nhau — chính là cú tách theo môi trường ở mục 4.
- Block backend **không dùng được variable** — nó được đọc trước khi variable tồn tại. Giá trị là literal (hoặc truyền qua `-backend-config` trong CI, bài 9).
- Thêm block xong, chạy `terraform init` — nó phát hiện thay đổi và đề nghị **migrate** state local hiện có vào bucket. Trả lời yes một lần; xong.

Bản thân bucket này nên là bucket được bảo vệ nhất bạn có: versioning BẬT (lịch sử state = nút undo của bạn), mã hoá BẬT, chặn public, quyền truy cập giới hạn cho role CI và vài con người. (Terraform bản mới còn lock được bằng chính S3 — `use_lockfile` — nhưng pattern DynamoDB vẫn là chuẩn phổ biến bạn sẽ gặp trong các repo thật.)

## 3. Locking: lỗi "ai đó đang apply"

Có bảng lock rồi, mỗi `plan`/`apply` đều giành khoá trước; người chạy thứ hai nhận:

```text
Error: Error acquiring the state lock
Lock Info:
  Who:       anh@build-agent
  Created:   2026-08-05 09:14:22
```

Đọc nó như *sự phối hợp, không phải sự cố*: ai đó (hoặc CI) đang apply dở. Phản ứng đúng là **chờ** — không bao giờ `-lock=false`. Một ngoại lệ: một run bị crash có thể để lại **khoá mồ côi** (nhìn `Who`/`Created` là biết — run của đồng nghiệp từ 3 tiếng trước đã chết). Xác nhận run đó chết thật, rồi `terraform force-unlock <LOCK_ID>`. Xác nhận trước; force-unlock một cú apply *đang sống* là tái tạo đúng thứ hỏng hóc mà locking sinh ra để ngăn.

## 4. Mỗi môi trường một state (và câu hỏi workspace)

Bài 11 series AWS đã cho luật — cùng module, khác variable theo môi trường. State theo cùng hình dạng: **tách state theo môi trường, bằng key riêng**:

```text
s3://myco-terraform-state/
  network/dev/terraform.tfstate
  network/prod/terraform.tfstate
  app/dev/terraform.tfstate
  app/prod/terraform.tfstate
```

Hai lý do khiến cú tách này không mặc cả được: **bán kính vụ nổ** (state dev hỏng, một cú `state rm` sai, một cú apply nhầm cửa sổ — không thứ nào chạm được sổ cái prod) và **phân quyền** (role dev của CI bị cấm hẳn đọc `*/prod/*`).

**Còn `terraform workspace`?** Workspace cho nhiều state *trong một backend và một thư mục* — nghe hấp dẫn cho dev/prod. Chỉ dẫn thật thà, được cộng đồng chia sẻ rộng rãi: workspace hợp với *các bản sao phù du của cùng một thứ* (môi trường preview theo branch), nhưng tệ cho dev-vs-prod, vì hai workspace dùng chung một cấu hình backend và một bộ quyền, và `terraform workspace show` là thứ duy nhất đứng giữa bạn và cú apply nhầm môi trường. Thư mục-theo-môi-trường (mỗi cái một backend key riêng) khiến môi trường *hiện rõ trong prompt và trong diff của PR*. Nhàm chán thắng.

## Thực hành (20 phút — chi phí AWS: $0 ở quy mô này)

```bash
# 1. Tạo cặp backend (console hoặc CLI): S3 bucket có versioning + mã hoá
#    'TENBAN-tf-state-lab' và bảng DynamoDB 'tf-locks-lab' (partition key: LockID, kiểu String)

# 2. Bắt đầu local, rồi migrate
mkdir tf-remote-lab && cd tf-remote-lab
cat > main.tf <<'EOF'
resource "local_file" "hello" { filename = "hello.txt"; content = "remote state lab" }
EOF
terraform init && terraform apply -auto-approve
ls terraform.tfstate                    # sổ cái local đang tồn tại

# 3. Thêm block backend (sửa bucket/table thành của bạn), rồi:
cat > backend.tf <<'EOF'
terraform {
  backend "s3" {
    bucket         = "TENBAN-tf-state-lab"
    key            = "lab/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "tf-locks-lab"
  }
}
EOF
terraform init                          # trả lời "yes" để migrate
ls terraform.tfstate*                   # file local giờ rỗng/backup — sổ cái đã dời

# 4. Xem cái khoá hoạt động (hai terminal)
#    T1: terraform apply   (đừng confirm vội — nó đang giữ khoá)
#    T2: terraform plan    -> "Error acquiring the state lock" kèm Who/Created
#    T1: trả lời no; T2 chạy lại -> được

# 5. Dọn dẹp
terraform destroy -auto-approve         # rồi xoá bucket/table của lab
```

Kết quả mong đợi: sau bước 3, state sống trong S3 (kiểm tra bucket). Bước 4 hiện lỗi lock kèm thông tin `Who` — sự phối hợp trở nên nhìn thấy được.

## Tự kiểm tra

1. Remote state + locking ngăn được ba sự cố team nào?
2. Plan fail với "Error acquiring the state lock" từ một run CI 5 phút trước. Bạn làm gì? Cùng lỗi đó, nhưng run đã crash 3 tiếng trước?
3. Vì sao *thư mục theo môi trường với key riêng* được ưa hơn workspace cho dev/prod?

<details><summary>Xem đáp án</summary>

1. Sổ cái phân kỳ (mỗi laptop một state), mất state (một laptop = điểm hỏng duy nhất), và hỏng do ghi đồng thời (hai apply đan xen).
2. 5 phút trước: chờ — một apply đang sống giữ khoá một cách chính đáng. 3 tiếng + xác nhận đã chết: `terraform force-unlock <LOCK_ID>`, sau khi dùng Who/Created xác nhận không gì đang chạy.
3. Thư mục khiến môi trường tường minh (đường dẫn trong prompt, diff PR, backend key) và cho phép phân quyền riêng từng môi trường; workspace giấu môi trường trong trạng thái CLI vô hình và dùng chung một backend, một bộ credential — chỉ cách cú apply nhầm prod đúng một lệnh `workspace show`.

</details>

## Điều cần nhớ

- State local hại team ba đường: phân kỳ, mất, đua. Remote backend + locking chữa cả ba.
- Block backend là literal (không variable), `init` migrate state một lần, và bucket state là bucket được bảo vệ nhất: versioned, mã hoá, private.
- Lỗi lock là sự phối hợp: chờ run đang sống, chỉ `force-unlock` run xác-nhận-đã-chết.
- Mỗi môi trường một state qua key/thư mục riêng — tường minh, phân quyền được, bán kính vụ nổ nhỏ. Workspace dành cho bản sao phù du, không phải dev-vs-prod.

*Bài tiếp theo — Phần 6: Variables, outputs & đa môi trường.*
