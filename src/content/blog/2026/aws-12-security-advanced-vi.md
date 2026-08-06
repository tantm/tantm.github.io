---
title: 'AWS security vượt khỏi IAM: KMS, Secrets, guardrails'
description: 'Encryption là bài toán quyền-dùng-key, secrets tự rotate, và guardrails đa tài khoản — defense in depth như một kiến trúc, không phải đống checkbox.'
date: 2026-08-04
category: Cloud
tags: [aws, security, kms]
lang: vi
translationKey: aws-12
series: aws-zero-to-advanced
part: 12
---

P02 đưa bạn bức tường đầu tiên: danh tính, least privilege, không key trong repo. Nhưng một bức tường chưa phải một tư thế an ninh — kỷ luật là **defense in depth**: giả định bất kỳ lớp đơn lẻ nào cũng thất bại (trọn thế giới quan của CS-P11) và xếp lớp kế tiếp để khoanh vùng nó. Trên AWS nghĩa là thêm ba bức tường — encryption mọi nơi, secrets tự quản lý, và guardrails khiến nguyên cả lớp sai lầm trở nên bất khả — cộng cấu trúc account biến "một credential bị chiếm" thành "một sandbox bị chiếm."

## Bạn sẽ học được gì

- Đóng khung lại encryption thành bài toán quyền dùng key, cách đóng khung duy nhất giúp bạn thiết kế được.
- Leo thang secrets từ "đừng commit" tới "không tồn tại secret nào để đánh cắp".
- Đặt guardrail ở ba tầng: phát hiện, ngăn chặn, và khoanh vùng.
- Đặt sàn audit khiến một sự cố dựng lại được.

**Cần biết trước:** Phần 2 (IAM role và policy). Bài học state-là-nhạy-cảm ở Phần 11 nối vào đây.

## 1. Encryption: thực chất là bài toán quyền dùng key

Sự thật ngược đời trước: trên AWS, *bật encryption* là chuyện vặt — một flag trên bucket, volume, database. Thứ bạn thật sự thiết kế là **ai được dùng key**, và đó là KMS:

- **Mô hình envelope trong một câu**: service mã hoá dữ liệu bằng data key, KMS mã hoá data key bằng master key của bạn, và mỗi lần *decrypt* trở thành một **cú gọi API KMS** audit được, từ chối được — encryption-at-rest biến thành bài toán *access control*, và đó là lý do nó ghép nối với P02 thay vì lặp lại P02.
- **Lựa chọn mặc định đáng giá**: key do AWS quản cho bạn encryption hạng checkbox-compliance; **customer-managed key (CMK)** cho bạn một *key policy* — cánh cổng thứ hai, độc lập. S3 nói có nhưng key policy nói không → không có dữ liệu. Tính chất hai-cổng đó là defense in depth trong một resource, và là lý do các bucket nhạy cảm (P04) dùng CMK.
- **Tách key mua được gì**: key theo từng domain (một cho data lake, một cho payments) nghĩa là một role bị lộ scope vào một key không thể decrypt domain kia — tư duy bán-kính-vụ-nổ của CS-P11 áp vào mật mã học. Nó cũng mua cho bạn đòn bẩy S07-P10: từ chối key, và dữ liệu coi như biến mất về mặt mật mã ở cả những nơi replication đã lan tới.
- **In transit** vẫn nhàm chán và bắt buộc: TLS trên mọi chặng (S01-P06), kể cả *bên trong* VPC — "traffic nội bộ" chính xác là thứ kẻ tấn công đã-vào-trong được đọc.

## 2. Secrets: từ "đừng commit" tới "chúng tự rotate"

CS-P11 đặt sàn (tiêm qua env, không bao giờ git); trần trên cloud cao hơn. Bậc thang đáng khắc cốt: **hardcode → env var → secrets manager → không còn secret nào cả.**

- Một **secrets manager** (tầng Secrets Manager/Parameter Store) cho bạn ba thứ file env không thể: *truy cập có audit* (ai đọc password DB, lúc nào — vệt của P10), *rotation không cần redeploy* (app fetch lúc runtime; rotation là một sự kiện config, không phải một release), và *một nguồn sự thật* thay vì các file `.env` nhân bản khắp các máy.
- **Rotation tự động** là feature đinh: với các database được hỗ trợ, manager tự xoay credential theo lịch và app không hề hay biết. CS-P11 nói "rotation rẻ là một mục tiêu thiết kế" — đây là mục tiêu đó, mua dưới dạng dịch vụ.
- **Secret tốt nhất là không có secret** (role của P02, dạng cuối): auth service-với-service qua IAM role không cần password lưu trữ nào. Trạng thái cuối thực tế: role ở mọi nơi có thể, secret managed-rotation ở nơi buộc phải có password, và một danh sách *ngắn* các secret thật (API key bên thứ ba) có chủ và có ngày rotation — vì luật S04-P10 áp vào: secret không nằm trong inventory là secret không thể rotate.

## 3. Guardrails: từ review sai lầm tới khiến sai lầm bất khả

Review (đọc plan của P11) bắt sai lầm; **guardrails** xoá cả lớp sai lầm. Pattern có ba tầng, mạnh dần: **detect** — một lớp config-rules liên tục đối chiếu thực tế với chính sách ("không bucket public, không volume chưa mã hoá, không 0.0.0.0/0 trên port 22" — bài kinh điển của P03) và gắn cờ hoặc tự vá drift, tức phát hiện drift của S04-P11 tổng quát lên drift *chính sách*; **prevent** — chính sách cấp tổ chức (tầng SCP) mà không ai, kể cả admin của account, vượt được: "account này không được rời các region này, không được tắt audit logging, không được xoá KMS key" — phiên bản an ninh của constraint database ở P07, những cú kiểm không thể bỏ qua; và **contain** — **kiến trúc đa account** khiến sự cô lập AWS-native thành thật: tách account theo môi trường và domain (workloads-prod, workloads-dev, security-tooling, log-archive), vì ranh giới account là bức tường mạnh nhất AWS bán — một credential dev bị chiếm ở account riêng *không thể* chạm prod ngay từ cấu tạo ("cùng module, khác variable" của S04-P11 có thêm một lý do an ninh để tồn tại).

Khép vòng bằng cái sàn audit, nói một lần: bật audit log API (họ CloudTrail) ở mọi account, đẩy về account log-archive nơi *không ai* có quyền xoá — observability của S04-P10, nhưng threat model giờ là một kẻ tấn công (hoặc một admin) đang cố xoá dấu vết. Alarm trên các meta-event: audit logging bị tắt, root login, key bị đặt lịch xoá. Ba alarm đó rẻ, và mỗi cái là nước mở màn của một sự cố thật.

## Thực hành (25 phút — chứng minh rằng encryption là chuyện ai giữ key)

Tuyên bố ở mục 1 nghe trừu tượng cho tới khi bạn tận mắt thấy một identity được phép đọc được object đã mã hoá, còn một identity không được phép thì fail ở *key* chứ không phải ở bucket:

```bash
ACCT=$(aws sts get-caller-identity --query Account --output text)
B=kms-lab-$RANDOM

# 1. Một customer-managed key: cái cổng thứ hai, độc lập với bucket policy
KEY=$(aws kms create-key --description "lab key" --query KeyMetadata.KeyId --output text)
aws kms create-alias --alias-name alias/lab-key --target-key-id $KEY

# 2. Một bucket mã hoá bằng key CỦA BẠN, không phải key mặc định của dịch vụ
aws s3 mb s3://$B
aws s3api put-bucket-encryption --bucket $B --server-side-encryption-configuration \
  "{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"aws:kms\",\"KMSMasterKeyID\":\"$KEY\"}}]}"

echo "báo cáo mật" > report.txt && aws s3 cp report.txt s3://$B/report.txt
aws s3api head-object --bucket $B --key report.txt --query '[ServerSideEncryption,SSEKMSKeyId]'

# 3. ĐIỂM MẤU CHỐT: chỉ thu hồi quyền dùng key — không đụng bất kỳ quyền nào trên bucket
aws kms put-key-policy --key-id $KEY --policy-name default --policy \
  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"AdminOnly\",\"Effect\":\"Allow\",
    \"Principal\":{\"AWS\":\"arn:aws:iam::$ACCT:root\"},\"Action\":\"kms:*\",\"Resource\":\"*\"}]}"
# Giờ để một role vẫn còn s3:GetObject thử đọc nó — nó fail ở kms:Decrypt.

# 4. Secret tự rotate, thay vì secret bạn dán tay
aws secretsmanager create-secret --name lab/db --secret-string '{"user":"app","pass":"initial"}'
aws secretsmanager get-secret-value --secret-id lab/db --query SecretString --output text
aws secretsmanager put-secret-value --secret-id lab/db --secret-string '{"user":"app","pass":"rotated"}'
aws secretsmanager list-secret-version-ids --secret-id lab/db --query 'Versions[].VersionStages'

# 5. Dọn dẹp
aws s3 rb s3://$B --force
aws secretsmanager delete-secret --secret-id lab/db --force-delete-without-recovery
aws kms schedule-key-deletion --key-id $KEY --pending-window-in-days 7
```

Kết quả mong đợi: bước 3 là trọn bài học được làm thành cụ thể. Object vẫn nằm trong bucket, người gọi vẫn có `s3:GetObject`, và cú đọc vẫn fail — vì giải mã đòi quyền trên *key*, và đó là cái cổng thứ hai nằm dưới quyền kiểm soát riêng. Đó là lý do "đã mã hoá khi lưu" tự nó là một tuyên bố vô nghĩa: câu hỏi thật luôn là ai được dùng key. Bước 4 cho thấy nấc thang trên "đừng commit secret" — giá trị có version kèm nhãn giai đoạn, để rotate là một thao tác được hỗ trợ chứ không phải một cuộc dừng dịch vụ có phối hợp.

## Tự kiểm tra

1. Bảng câu hỏi bảo mật của một đối tác hỏi "dữ liệu của bạn có mã hoá khi lưu không?" và bạn trả lời có. Câu đó thật sự nói cho họ biết điều gì?
2. Team bạn lưu mật khẩu database trong biến môi trường, được set từ secrets manager lúc deploy. Nấc thang kế tiếp là gì, và nó loại bỏ được cái gì?
3. Vì sao một AWS account riêng thường là ranh giới mạnh hơn mọi IAM policy?

<details><summary>Xem đáp án</summary>

1. Rất ít. Gần như mọi kho lưu trữ managed đều mã hoá khi lưu theo mặc định, nên câu trả lời không nói gì về việc ai giải mã được. Các câu hỏi có ý nghĩa là dùng key nào, ai có quyền dùng key đó, và việc dùng key có được ghi log không — một customer-managed key với policy chặt là cổng thứ hai thật sự; một key mặc định của dịch vụ với quyền truy cập rộng chỉ là một ô tick.
2. Role với credential ngắn hạn, để ứng dụng lấy quyền tạm thời lúc chạy và không tồn tại mật khẩu dài hạn nào trong môi trường cả. Nó loại bỏ chính cái credential mà lẽ ra bạn phải rotate, phải bảo vệ và phải audit — bạn không thể làm lộ một secret chưa bao giờ được cấp.
3. Vì đó là ranh giới nền tảng cưỡng chế ở tầng ngoài cùng, chứ không phải thứ bạn cấu hình cho từng resource. Một policy sai bên trong một account có thể cấp quyền không nên cấp; một resource ở account khác thì không với tới được nếu không có cấp quyền liên-account tường minh. Nó cũng chặn bán kính vụ nổ: một identity bị chiếm ở account này không thể liệt kê thứ nó không nhìn thấy.

</details>

## Điều cần nhớ

- Encryption trên AWS là bài toán quyền-dùng-key: CMK thêm cánh cổng độc lập thứ hai, key theo domain thu nhỏ bán kính vụ nổ, và từ chối key là từ chối dữ liệu — TLS mọi chặng kể cả nội bộ.
- Leo thang secrets — env var → secret managed tự rotate → IAM role không còn secret — và giữ danh sách secret thật ngắn, có chủ, có ngày.
- Guardrails thắng review: detect drift chính sách liên tục, prevent bằng luật cấp tổ chức không ai vượt được, contain bằng ranh giới account — bức tường mạnh nhất AWS bán.
- Audit log về nơi không ai xoá được, và ba alarm rẻ (tắt logging, root login, xoá key) phủ các nước mở màn của đa số sự cố thật.

*Tiếp theo — Phần 13: AWS cho Data: Glue, Athena, Kinesis, Redshift.*
