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
draft: true
---

P02 đưa bạn bức tường đầu tiên: danh tính, least privilege, không key trong repo. Nhưng một bức tường chưa phải một tư thế an ninh — kỷ luật là **defense in depth**: giả định bất kỳ lớp đơn lẻ nào cũng thất bại (trọn thế giới quan của CS-P11) và xếp lớp kế tiếp để khoanh vùng nó. Trên AWS nghĩa là thêm ba bức tường — encryption mọi nơi, secrets tự quản lý, và guardrails khiến nguyên cả lớp sai lầm trở nên bất khả — cộng cấu trúc account biến "một credential bị chiếm" thành "một sandbox bị chiếm."

## Encryption: thực chất là bài toán quyền dùng key

Sự thật ngược đời trước: trên AWS, *bật encryption* là chuyện vặt — một flag trên bucket, volume, database. Thứ bạn thật sự thiết kế là **ai được dùng key**, và đó là KMS:

- **Mô hình envelope trong một câu**: service mã hoá dữ liệu bằng data key, KMS mã hoá data key bằng master key của bạn, và mỗi lần *decrypt* trở thành một **cú gọi API KMS** audit được, từ chối được — encryption-at-rest biến thành bài toán *access control*, và đó là lý do nó ghép nối với P02 thay vì lặp lại P02.
- **Lựa chọn mặc định đáng giá**: key do AWS quản cho bạn encryption hạng checkbox-compliance; **customer-managed key (CMK)** cho bạn một *key policy* — cánh cổng thứ hai, độc lập. S3 nói có nhưng key policy nói không → không có dữ liệu. Tính chất hai-cổng đó là defense in depth trong một resource, và là lý do các bucket nhạy cảm (P04) dùng CMK.
- **Tách key mua được gì**: key theo từng domain (một cho data lake, một cho payments) nghĩa là một role bị lộ scope vào một key không thể decrypt domain kia — tư duy bán-kính-vụ-nổ của CS-P11 áp vào mật mã học. Nó cũng mua cho bạn đòn bẩy S07-P10: từ chối key, và dữ liệu coi như biến mất về mặt mật mã ở cả những nơi replication đã lan tới.
- **In transit** vẫn nhàm chán và bắt buộc: TLS trên mọi chặng (S01-P06), kể cả *bên trong* VPC — "traffic nội bộ" chính xác là thứ kẻ tấn công đã-vào-trong được đọc.

## Secrets: từ "đừng commit" tới "chúng tự rotate"

CS-P11 đặt sàn (tiêm qua env, không bao giờ git); trần trên cloud cao hơn. Bậc thang đáng khắc cốt: **hardcode → env var → secrets manager → không còn secret nào cả.**

- Một **secrets manager** (tầng Secrets Manager/Parameter Store) cho bạn ba thứ file env không thể: *truy cập có audit* (ai đọc password DB, lúc nào — vệt của P10), *rotation không cần redeploy* (app fetch lúc runtime; rotation là một sự kiện config, không phải một release), và *một nguồn sự thật* thay vì các file `.env` nhân bản khắp các máy.
- **Rotation tự động** là feature đinh: với các database được hỗ trợ, manager tự xoay credential theo lịch và app không hề hay biết. CS-P11 nói "rotation rẻ là một mục tiêu thiết kế" — đây là mục tiêu đó, mua dưới dạng dịch vụ.
- **Secret tốt nhất là không có secret** (role của P02, dạng cuối): auth service-với-service qua IAM role không cần password lưu trữ nào. Trạng thái cuối thực tế: role ở mọi nơi có thể, secret managed-rotation ở nơi buộc phải có password, và một danh sách *ngắn* các secret thật (API key bên thứ ba) có chủ và có ngày rotation — vì luật S04-P10 áp vào: secret không nằm trong inventory là secret không thể rotate.

## Guardrails: từ review sai lầm tới khiến sai lầm bất khả

Review (đọc plan của P11) bắt sai lầm; **guardrails** xoá cả lớp sai lầm. Pattern có ba tầng, mạnh dần: **detect** — một lớp config-rules liên tục đối chiếu thực tế với chính sách ("không bucket public, không volume chưa mã hoá, không 0.0.0.0/0 trên port 22" — bài kinh điển của P03) và gắn cờ hoặc tự vá drift, tức phát hiện drift của S04-P11 tổng quát lên drift *chính sách*; **prevent** — chính sách cấp tổ chức (tầng SCP) mà không ai, kể cả admin của account, vượt được: "account này không được rời các region này, không được tắt audit logging, không được xoá KMS key" — phiên bản an ninh của constraint database ở P07, những cú kiểm không thể bỏ qua; và **contain** — **kiến trúc đa account** khiến sự cô lập AWS-native thành thật: tách account theo môi trường và domain (workloads-prod, workloads-dev, security-tooling, log-archive), vì ranh giới account là bức tường mạnh nhất AWS bán — một credential dev bị chiếm ở account riêng *không thể* chạm prod ngay từ cấu tạo ("cùng module, khác variable" của S04-P11 có thêm một lý do an ninh để tồn tại).

Khép vòng bằng cái sàn audit, nói một lần: bật audit log API (họ CloudTrail) ở mọi account, đẩy về account log-archive nơi *không ai* có quyền xoá — observability của S04-P10, nhưng threat model giờ là một kẻ tấn công (hoặc một admin) đang cố xoá dấu vết. Alarm trên các meta-event: audit logging bị tắt, root login, key bị đặt lịch xoá. Ba alarm đó rẻ, và mỗi cái là nước mở màn của một sự cố thật.

## Điều cần nhớ

- Encryption trên AWS là bài toán quyền-dùng-key: CMK thêm cánh cổng độc lập thứ hai, key theo domain thu nhỏ bán kính vụ nổ, và từ chối key là từ chối dữ liệu — TLS mọi chặng kể cả nội bộ.
- Leo thang secrets — env var → secret managed tự rotate → IAM role không còn secret — và giữ danh sách secret thật ngắn, có chủ, có ngày.
- Guardrails thắng review: detect drift chính sách liên tục, prevent bằng luật cấp tổ chức không ai vượt được, contain bằng ranh giới account — bức tường mạnh nhất AWS bán.
- Audit log về nơi không ai xoá được, và ba alarm rẻ (tắt logging, root login, xoá key) phủ các nước mở màn của đa số sự cố thật.

*Tiếp theo — Phần 13: AWS cho Data: Glue, Athena, Kinesis, Redshift.*
