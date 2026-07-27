---
title: 'SQS, SNS & EventBridge: tách rời hệ thống'
description: 'Queue vs pub/sub vs event bus trong một quyết định, vì sao mọi consumer phải idempotent, và DLQ — cái queue quan trọng nhất mà bạn mong nó luôn rỗng.'
date: 2026-08-04
category: Cloud
tags: [aws, sqs, event-driven, architecture]
lang: vi
translationKey: aws-09
series: aws-zero-to-advanced
part: 9
---

Cơn đau khai sinh: checkout của bạn gọi service hoá đơn, service hoá đơn gọi service email — một cách đồng bộ. Nhà cung cấp email có một phút tồi tệ, và đột nhiên *checkout* sập (bài học thread-bị-chặn của CS-P8, giờ trải dài qua nhiều service). Cách chữa là Observer pattern ở khoảng cách hệ thống (CS-P10): đặt một bộ đệm giữa "chuyện này đã xảy ra" và "các thứ phản ứng với nó." AWS đưa bạn ba hương vị của bộ đệm đó, và chọn giữa chúng là một quyết định, không phải ba sản phẩm để học thuộc.

## Ba hình dạng

```mermaid
flowchart TB
  subgraph Q["SQS — queue: 1 producer → 1 nhóm consumer"]
    P1[Producer] --> S1[(Queue)] --> C1[Đội worker]
  end
  subgraph N["SNS — pub/sub: 1 event → N subscriber, fan-out ngay"]
    P2[Producer] --> T[Topic] --> C2[Email svc]
    T --> C3[Analytics]
    T --> Q2[(SQS mỗi subscriber)]
  end
  subgraph E["EventBridge — bus: M producer → rules → N target"]
    P3[Nhiều producer] --> B[Bus] -->|rule: order.created| C4[Target]
    B -->|rule: payment.failed| C5[Target]
  end
```

- **SQS** là một **queue**: công việc nằm chờ tới khi *một* consumer xử lý nó. Đức tính của nó là đệm và điều tiết nhịp — một cơn spike traffic trở thành cái queue dài hơn, không phải một worker chết (chính cú san tải giữ cho đội máy right-size của S04-P03 trung thực; độ sâu queue cũng là tín hiệu autoscaling tự nhiên).
- **SNS** là **pub/sub**: một message, giao cho *tất cả* subscriber ngay. Combo production kinh điển là **SNS→SQS fan-out**: topic phát sóng, mỗi subscriber có queue *riêng*, nên một consumer chậm chỉ làm trễ chính nó.
- **EventBridge** là một **event bus**: nhiều producer, nhiều consumer, với *routing rule match theo nội dung event* — cộng bản năng schema registry (S07-P06) và event native từ chính các service AWS. Đây là lựa chọn "hệ thần kinh" khi số event vượt xa số luồng point-to-point.

Quyết định trong một hơi thở: **một consumer → SQS; phát sóng event của một producer → SNS(+SQS); nhiều-nhiều với routing theo nội dung → EventBridge.** Khi phân vân, bắt đầu với SQS — đó là thứ bạn không bao giờ hối hận vì đã sở hữu.

## At-least-once: bản hợp đồng không ai đọc

Cả ba service này đều **at-least-once**: message trùng lặp không phải bug, đó là thiết kế. Cơ chế sinh ra chúng đáng hiểu một lần — SQS không xoá message khi consumer *đọc* nó; message trở nên vô hình trong một khoảng **visibility timeout** trong lúc consumer làm việc, và chỉ bị xoá khi consumer xác nhận. Crash trước khi xác nhận (hoặc làm lâu quá timeout) và message *hiện ra lại* — đó chính xác là thứ bạn muốn (không mất việc) và chính xác là thứ nhân đôi bạn (việc có thể đã xảy ra một phần).

Vì thế, luật sắt, lần xuất hiện thứ ba trong giáo trình này (pipeline của S02-P06, task của S02-P08, giờ là messaging): **mọi consumer phải idempotent.** Xử lý cùng message hai lần → cùng trạng thái cuối. Công cụ chuẩn: làm thao tác idempotent tự nhiên (set status = paid, upsert theo key), hoặc lưu vết message/business ID đã xử lý và bỏ qua bản lặp. Nếu consumer của bạn không idempotent, bạn không có một bug *có thể* xảy ra — bạn có một bug đã được lên lịch cho lần deploy xấu đầu tiên.

Chữ nhỏ liên quan hay cắn: **visibility timeout phải lớn hơn thời gian xử lý tệ nhất** (không thì bạn vừa xây một cỗ máy sinh bản trùng), và **thứ tự không được bảo đảm** ở queue standard — biến thể FIFO tồn tại và đánh đổi throughput lấy thứ tự, nhưng nước đi senior là thiết kế consumer *không cần* thứ tự toàn cục (state machine theo từng entity thắng mọi giả định về sequence).

## Retry, backoff, và DLQ

Queue retry hộ bạn — đó là mục đích của nó — nhưng retry *không giới hạn* biến một poison message (payload hỏng, bug trong consumer) thành vòng lặp vô tận bỏ đói mọi thứ xếp sau. Cầu dao bắt buộc là **dead-letter queue**: sau N lần nhận thất bại (bắt đầu quanh 3–5), message chuyển sang DLQ thay vì quay vòng mãi mãi.

DLQ là thứ rỗng gánh nhiều trọng lượng nhất trong kiến trúc của bạn, và nó cần ba quyết định được chốt *trước* sự cố: một **alarm trên độ sâu** (DLQ khác rỗng là một cú page — nó là rọ "lỗi chung cuộc" của S02-P06, hiện hình), một **đường replay** (sửa consumer, rồi *re-drive* message quay lại — một thao tác có sẵn; cả failure mode trở thành: không mất gì, sửa, replay), và **retention** đủ dài để sống qua một kỳ nghỉ lễ. Consumer Lambda (S04-P07) cắm thẳng vào đây: event source mapping lo batching và retry, và điểm đến khi thất bại là — chính pattern DLQ này.

## Giữ cho bộ đệm trung thực

- **Queue che giấu cái chết của consumer.** Gọi đồng bộ fail ầm ĩ; queue chỉ lặng lẽ dài ra. **Alarm trên tuổi của message cũ nhất** (độ ôi thiu — sự thật mà người dùng cảm nhận) hơn là trên độ sâu (thứ spike một cách chính đáng).
- **Event là bản hợp đồng** — kỷ luật schema của S02 áp dụng: version payload, thêm field thay vì tái sử dụng field cũ ("thêm, đừng tái sử dụng" của CS-P10, phiên bản messaging), và đặt schema event ở nơi cả team producer lẫn consumer đều thấy.
- **Chi phí tính theo request** (đồng hồ đo của S04-P01): polling và message tí hon cộng dồn chủ yếu thành *request*, nên hãy gộp send và receive theo lô khi độ trễ cho phép — phiên bản messaging của luật ít-request-to-hơn ở S04-P04.

## Điều cần nhớ

- Một quyết định, ba hình dạng: SQS cho một consumer, SNS(+SQS fan-out) cho phát sóng, EventBridge cho nhiều-nhiều với routing theo nội dung — phân vân thì mặc định SQS.
- At-least-once là bản hợp đồng: cơ chế visibility timeout bảo đảm thỉnh thoảng có bản trùng, nên mọi consumer phải đậu bài test xử-lý-hai-lần.
- Retry có giới hạn + DLQ + alarm + đường replay — chốt trước sự cố — biến poison message từ một cú outage thành quy trình sửa-và-redrive thường lệ.
- Alarm theo tuổi message cũ nhất, coi payload event là hợp đồng có version, và gộp request theo lô: cái queue lặng lẽ dài ra là failure mode cần thiết kế chống lại.

*Tiếp theo — Phần 10: CloudWatch & X-Ray: nhìn thấy hệ thống của bạn.*
