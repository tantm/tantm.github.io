---
title: 'Well-Architected: thiết kế hệ thống thật'
description: 'Sáu pillar như các câu hỏi review bạn đã biết cách trả lời, ba pattern tham chiếu phủ đa số hệ thống, DR là quyết định business, và cách đọc bất kỳ sơ đồ kiến trúc nào.'
date: 2026-08-04
category: Cloud
tags: [aws, architecture, system-design]
lang: vi
translationKey: aws-15
series: aws-zero-to-advanced
part: 15
---

Mười bốn phần về service; phần này là *sách hướng dẫn lắp ráp*. *Well-Architected Framework* của AWS nghe như bài tập về nhà của vendor, và dùng tệ thì đúng là vậy — một sân khấu checklist. Dùng khéo, nó là thứ hay hơn: **sáu câu hỏi thường trực để tra khảo bất kỳ thiết kế nào** — và cú chốt của series này là bạn đã biết các câu trả lời; bạn học chúng từng service một. Phần này lắp chúng lại thành kỹ năng mà phỏng vấn gọi là system design còn công việc gọi là architecture review.

## Sáu pillar, dưới dạng câu hỏi bạn trả lời được rồi

- **Operational excellence** — *bạn vận hành nổi nó không?* IaC và thay đổi review được (P11), runbook và postmortem không đổ lỗi (S01-P12), observability alarm theo triệu chứng (P10).
- **Security** — *chuyện gì xảy ra khi một lớp thất bại?* Danh tính trước hết (P02), defense in depth, guardrails, ranh giới account (P12), input-là-code (CS-P11).
- **Reliability** — *cái gì vỡ, và cái gì hấp thụ nó?* Multi-AZ mặc định (P05), queue làm giảm xóc kèm DLQ (P09), timeout/retry/idempotency (luật sắt), và tư thế cattle của P03: instance chết, đội máy thì không.
- **Performance efficiency** — *đúng công cụ, có đo?* Right-size (P03), các bài học storage class và layout (P04, P13), percentile thay vì trung bình (P10), và serverless nơi traffic spiky (P07).
- **Cost optimization** — *chi tiêu có nhìn thấy và có chủ đích?* Tag, budget, kỷ luật đòn-bẩy-theo-thứ-tự (P16 dành hồi kết riêng cho pillar này; S02-P14 đã trao bạn bản năng: chi phí là một chiều đúng đắn).
- **Sustainability** — pillar thứ sáu trầm lặng: đa phần là cái bóng của hiệu quả — right-size, scale về không, xoá đồ idle. Pillar chi phí khoẻ thì pillar này thường khoẻ theo.

Công dụng thật của framework là *nhịp*: một giờ review mỗi hệ thống mỗi quý, đi từng pillar, viết ra các rủi ro bạn đang chấp nhận một cách có ý thức. Mệnh đề cuối là phần senior — Well-Architected không nói "đừng bao giờ chấp nhận rủi ro"; nó nói *biết mình đã chấp nhận cái nào, có chủ đích, trên giấy* (decision record của S02-P14, áp vào kiến trúc).

## Ba pattern phủ đa số hệ thống

**Con ngựa thồ 3-tier** (đa số sản phẩm CRUD): DNS/CDN → load balancer ở public subnet → đội app stateless ở private subnet (P03/P08) → database managed multi-AZ + cache. Thuộc tính gánh lực là **app tier stateless** (tư duy artifact của S01-P12: instance nào cũng phục vụ được request nào, nên autoscaling và deploy đều nhàm chán). Các sai lầm kinh điển là của P05: state trên instance, database ở public subnet, SG tham chiếu IP thay vì SG.

**Event-driven** (spiky, bursty, nặng tích hợp): API → queue/bus (P09) → worker (P07/P08) → notification đi ra. Hấp thụ spike, cô lập lỗi (DLQ), scale về không — đổi lấy eventual consistency và các kỷ luật P09 (idempotency, thứ tự theo entity, alarm tuổi-message-cũ-nhất). Chọn nó khi công việc *tự nhiên bất đồng bộ*; ép UX đồng bộ lên queue là mua độ phức tạp mà không nhận phần thưởng.

**Serverless lake** (analytics — sơ đồ của P13, dẫn lại không chép lại): S3 + catalog + compute serverless, pattern nơi tách storage-compute (S07-P03) gánh phần nặng.

Hệ thống thật ghép các pattern này — một mặt tiền 3-tier với hậu phương event-driven và một cái lake bên cạnh là kiến trúc cỡ vừa điển hình. Các đường may ghép nối chính là nơi các kỷ luật P09/P10 sống.

## DR: một quyết định business mặc áo kỹ thuật

Disaster recovery bắt đầu bằng hai con số do *business* chọn — **RPO** (mất được bao nhiêu dữ liệu?) và **RTO** (sập được bao lâu?) — và kỹ thuật mua chúng theo giá leo thang: **backup + restore** (RTO tính bằng giờ, rẻ nhất — nhưng một bản backup chưa từng restore là một niềm hy vọng, không phải một kế hoạch: hãy game-day cú restore, S01-P12); **pilot light / warm standby** (dữ liệu replicate cross-region, hạ tầng tối thiểu hoặc thu nhỏ sẵn sàng bơm phồng — RTO phút-tới-giờ; IaC của P11 là thứ biến "bơm phồng" thành một câu lệnh thay vì một cuối tuần); **active-active** (multi-region cùng phục vụ — RTO gần không, và một bậc chi phí/phức tạp mà đa số business không thật sự cần khi nhìn thấy hoá đơn). Đóng góp senior là từ chối để câu "bọn anh cần zero downtime" đi qua mà chưa định giá: trình các bậc kèm chi phí, để business chọn — "nói không kèm bảng giá" của S02-P14, ở tầm kiến trúc. Và nhớ ghi chú phạm vi của P05: multi-AZ đã phủ các thảm hoạ *thường gặp*; multi-region dành cho loại hiếm và loại compliance (S07-P10).

## Đọc một sơ đồ kiến trúc (kỹ năng nằm dưới kỹ năng)

Đưa một senior tấm sơ đồ và họ chạy một bài tra khảo cố định — dùng được trong review, phỏng vấn, lẫn retro sự cố: **đi theo một request từ đầu tới cuối** (bốn màn kịch của S01-P06, kéo dài — mỗi cú hop là một điểm hỏng và một số hạng latency); **tìm state** (thứ stateless scale và phục hồi tầm thường; mỗi chiếc hộp có state — database, queue, cache — nhận các câu hỏi khó: có backup? có replicate? bán kính vụ nổ P05 của nó?); **tìm SPOF** (thứ gì không có bạn đồng hành ở AZ khác; thứ gì mọi traffic buộc phải xuyên qua); **hỏi "X chết thì sao?"** cho ba chiếc hộp đáng sợ nhất (câu hỏi bán-kính-vụ-nổ của P12, áp từng hộp); và **hỏi cái gì đang *thiếu*** — cách đọc senior nhất: không có queue giữa ingress spiky và database? Không DLQ? Không câu chuyện cross-region cho dữ liệu compliance? Sơ đồ cho thấy thứ đang có; buổi review kiếm cơm bằng thứ không có.

## Điều cần nhớ

- Sáu pillar là các câu hỏi thường trực, và series này đã dạy các câu trả lời — giá trị của framework là nhịp review cộng *rủi ro được chấp nhận có ý thức, trên giấy*.
- Ba pattern phủ đa số hệ thống: 3-tier (app tier stateless là thuộc tính gánh lực), event-driven (hấp thụ spike, đòi idempotency), serverless lake — kiến trúc thật ghép chúng lại.
- DR là RPO/RTO do business chọn theo bảng giá kỹ thuật trình: backup→pilot light→warm→active-active, và backup chưa restore là một niềm hy vọng.
- Đọc sơ đồ bằng bài tra khảo cố định: lần theo request, tìm state, tìm SPOF, khai tử các hộp đáng sợ trên giấy, và hỏi cái gì đang thiếu.

*Tiếp theo — Phần 16: Tối ưu chi phí AWS & lộ trình cert — hồi kết của series.*
