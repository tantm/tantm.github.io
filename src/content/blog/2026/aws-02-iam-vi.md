---
title: 'IAM: identity là vành đai bảo mật mới'
description: 'User, role và policy không màu mè — least privilege như một thói quen, vì sao role thắng access key, và những lỗi người mới từng lên báo.'
date: 2026-07-28
category: Cloud
tags: [aws, iam, security, aws-zero-to-advanced]
lang: vi
translationKey: aws-02
series: aws-zero-to-advanced
part: 2
---

Thời data center, bảo mật có hình thù rõ ràng: một bức tường (firewall) với một cái cổng. Trên cloud không có tường — mọi service là một API gọi được từ bất cứ đâu, và câu hỏi duy nhất còn quan trọng là: **ai đang gọi, và họ được phép làm gì?** Câu hỏi đó chính là IAM (Identity and Access Management), và là lý do ta học nó trước EC2, S3, hay bất cứ thứ gì có server bên trong.

Làm đúng IAM thì đa số chuyện kinh dị trên cloud không xảy ra với bạn được. Làm sai thì bao nhiêu encryption cũng không cứu nổi.

## Dàn nhân vật: bốn danh từ

| Danh từ | Là gì | Ví von |
|---|---|---|
| **User** | Danh tính cố định cho một con người, credentials sống lâu | Thẻ nhân viên |
| **Group** | Bó user dùng chung quyền | Một phòng ban |
| **Role** | Danh tính mà **ai được phép đều có thể tạm thời trở thành** — không mật khẩu, không key cố định | Áo khách tham quan phát ở quầy lễ tân |
| **Policy** | Văn bản JSON nói được phép/bị cấm làm gì | Cuốn nội quy gắn vào thẻ hoặc áo |

Nhân vật gây bối rối nhất là **role** — và cũng quan trọng nhất. Role được *assume*, không phải đăng nhập: EC2 instance assume một role để đọc S3; Lambda assume một role để ghi DynamoDB; engineer assume role admin trong một giờ bảo trì. Credentials được cấp tại chỗ và **tự hết hạn**.

> **Thói quen định hình dân cloud chuyên nghiệp: danh tính thì cố định, credentials thì không nên.**

## Đọc một policy (2 phút)

Mọi policy trả lời ba câu — Effect, Action, Resource:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::my-demo-bucket",
      "arn:aws:s3:::my-demo-bucket/*"
    ]
  }]
}
```

"Được đọc object và list bucket, trên đúng một bucket này, không gì khác." Logic đánh giá gói trong một dòng: **mặc định cấm hết; một Allow mở một cánh cửa; một Deny tường minh luôn thắng.**

Tư thế mặc-định-cấm ấy có tên — **least privilege**: cấp đúng cái việc cần, không hơn. Không phải vì đồng đội không đáng tin, mà vì *bất kỳ* credential nào cũng có thể lộ, và bán kính sát thương của một key "đọc một bucket" bị lộ là một ngày tồi tệ, còn của một key `AdministratorAccess` bị lộ là một thông cáo báo chí.

## Ba lỗi người mới từng lên báo

1. **Làm việc bằng root user.** Email bạn đăng ký chính là tài khoản root — làm được mọi thứ theo nghĩa đen, kể cả xoá account. Setup chuyên nghiệp: bật MFA cho root, tạo danh tính admin cho việc hằng ngày, cất credentials root đi.
2. **Access key trong code.** `aws_access_key_id = AKIA...` dán vào script, push lên GitHub — bot quét repo public tìm thấy key trong **vài phút** (hoá đơn đào coin theo sau). Giải pháp là cấu trúc, không phải cẩn thận hơn: code chạy *trên* AWS dùng **role** (không tồn tại key để mà lộ); code trên laptop dùng `aws configure` / SSO profile (key nằm ngoài repo). Key trong repo không bao giờ là OK — repo private cũng bị clone, fork và rò rỉ như thường.
3. **`"Action": "*"` trên `"Resource": "*"` vì "giờ nó chạy được".** Nó luôn chạy được — vấn đề nằm ở đó. Bạn sẽ không bao giờ quay lại sửa, và ba tháng sau một script bạn quên mất đang cầm quyền thượng đế. Bắt đầu hẹp; nới khi `AccessDenied` chỉ đích danh thứ còn thiếu (message lỗi ghi thẳng tên action cần thêm).

## Thực hành: setup an toàn đầu tiên (15 phút, miễn phí)

Trên account **cá nhân** (tuyệt đối không tập IAM trên account công ty):

1. Bật **MFA cho root**, rồi ngừng dùng root.
2. Tạo danh tính admin cho chính bạn (IAM Identity Center / SSO là mặc định thời nay; IAM user + MFA cũng đủ để học).
3. Tạo policy từ JSON ở trên (đổi tên bucket), gắn vào một user thử nghiệm, rồi thử list một bucket *khác* → tận hưởng cú `AccessDenied` xứng đáng đầu tiên.
4. Đặt **billing alarm** đã hứa ở Phần 1: Billing → Budgets → zero-spend budget kèm email cảnh báo.

Cú `AccessDenied` ở bước 3 chính là cảm giác least privilege đang hoạt động. Hãy học cách yêu nó.

## Bài này nối đi đâu

Mọi phần sau của series đứng trên IAM: EC2 instance nhận role (Phần 3), S3 bucket có bucket policy (Phần 4), quyền của Lambda **chính là** một role (Phần 7), và guardrails multi-account ở Phần 12 là IAM ở quy mô tổ chức. Các phần khác đọc lướt cũng tạm được — riêng phần này phải ngấm.

## Điều cần nhớ

- Cloud không có tường; identity là vành đai. Mặc định cấm hết cho tới khi có policy cho phép, và Deny tường minh luôn thắng.
- Role > key: danh tính cố định, credentials thì không nên. Code chạy trên AWS không bao giờ nên cầm key sống lâu.
- Least privilege là thói quen, không phải tính năng: bắt đầu hẹp, nới theo nhu cầu — `AccessDenied` là hệ thống đang làm đúng việc.
- Root user: bật MFA rồi cho về hưu khỏi việc hằng ngày. Billing alarm ngay ngày đầu.

*Tiếp theo — Phần 3: EC2 căn bản: server đầu tiên của bạn.*
