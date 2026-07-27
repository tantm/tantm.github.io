---
title: 'Nền tảng streaming với Kafka'
description: 'Kafka là một cái log, không phải queue: partition là đơn vị của thứ tự lẫn song song, consumer group và lag, và "exactly-once" thật sự đến từ đâu.'
date: 2026-08-04
category: Data
tags: [de-roadmap, kafka, streaming]
lang: vi
translationKey: de-roadmap-10
series: de-roadmap
part: 10
---

S04-P09 đưa bạn queue: message tới, một consumer xử lý, nó biến mất. Kafka nhìn từ xa thì giống, lại gần là một con thú khác hẳn về căn bản: **Kafka là một cái log, không phải queue.** Message không bị xoá khi được tiêu thụ — chúng được append vào một log bền vững, có thứ tự, và nằm đó hết cửa sổ retention; consumer chỉ việc nhớ *mình đã đọc tới đâu*. Một lựa chọn thiết kế đó là lý do Kafka nuôi được năm consumer độc lập từ cùng một stream, replay lịch sử sau một cú bug, và làm xương sống cho các pipeline CDC của S07-P06 — và là lý do failure mode của nó khác hẳn SQS. Phần này là cơ khí; xử lý kiểu Flink bên trên sẽ tới ở P11.

## Cái log, và vì sao "không phải queue" quan trọng

```mermaid
flowchart LR
  subgraph T["Topic: orders (3 partition)"]
    P0["partition 0: ▪▪▪▪▪▪ → offset 6"]
    P1["partition 1: ▪▪▪▪ → offset 4"]
    P2["partition 2: ▪▪▪▪▪ → offset 5"]
  end
  Pr[Producers<br/>key=customer_id] --> T
  T --> G1["Consumer group: billing<br/>(đọc theo offset riêng)"]
  T --> G2["Consumer group: analytics<br/>(offset độc lập)"]
  T --> G3["Consumer group: fraud — vào sau,<br/>replay từ offset 0"]
```

Vì tiêu thụ không phá huỷ, ba thứ queue không làm nổi trở thành chuyện vặt: **fan-out không cần hạ tầng fan-out** (mỗi consumer group nhận trọn stream theo nhịp riêng — pattern SNS+SQS, nhưng cài sẵn trong mô hình lưu trữ); **replay** (bug ship hôm thứ Ba? Reset offset về thứ Hai và xử lý lại — bản năng backfill của S02-P06, phiên bản streaming); và **consumer mới đọc dữ liệu cũ** (team fraud tới sau một năm và đọc được lịch sử). Cái giá: *bạn* quản lý vị trí (offset), và retention là một quyết định thiết kế thật — theo thời gian cho event stream, hoặc **log compaction** (giữ bản ghi mới nhất theo từng key) cho topic dạng changelog, đúng hình dạng mà CDC muốn.

## Partition: đơn vị của mọi thứ

Một topic được cắt thành các **partition**, và partition là đơn vị của *thứ tự*, *song song*, và *scale* cùng một lúc:

- **Thứ tự chỉ tồn tại bên trong một partition.** Producer định tuyến theo **key** của message (cùng key → cùng partition → thứ tự nghiêm ngặt). Chọn key bằng câu hỏi "cái gì buộc phải giữ thứ tự?" — thường là một entity: `customer_id`, `order_id`. Đây là "state machine theo entity thắng thứ tự toàn cục" của S04-P09, hiện hình vật lý.
- **Song song bị chặn trần bởi số partition**: một consumer group dùng tối đa một consumer mỗi partition. Sáu partition = tối đa sáu worker. Hãy hoạch định số partition có dư địa (về sau đổi cho tử tế rất đau, vì rekey chuyển entity giữa các partition và phá lịch sử thứ tự).
- **Key nóng tạo partition nóng** — một khách hàng khổng lồ có thể ghim một partition ở 100% trong khi số còn lại ngồi chơi (bài học skew của S02-P07 mặc áo streaming). Nhìn throughput theo từng partition, đừng chỉ nhìn tổng.

## Consumer group và lag: trái tim vận hành

Một **consumer group** là một đội cùng đọc một topic: partition được chia cho các thành viên, và khi có thành viên vào hoặc chết, một cú **rebalance** chia lại (khựng ngắn — cơ chế đứng sau hiện tượng "consumer đứng hình vài giây"). Metric quan trọng — thứ *duy nhất* cần alarm trước tiên — là **consumer lag**: mỗi group đang tụt sau đầu log bao xa. Lag là "tuổi của message cũ nhất" của S04-P09 với tooling tốt hơn: lag tăng dần nghĩa là consumer của bạn quá chậm, quá ít (tới trần partition), hoặc đang crash-loop. Lag phẳng-nhưng-khác-không thì ổn; lag tăng đơn điệu là một sự cố đang diễn ra.

## Delivery semantics: "exactly-once" sống ở đâu

Vòng lặp consumer là: đọc message → xử lý → **commit offset**. Thứ tự của hai bước cuối *chính là* delivery semantics của bạn:

- Commit **sau** khi xử lý → **at-least-once**: crash giữa hai bước và bạn sẽ xử lý lại. Mặc định, và là mặc định đúng — đi kèm consumer idempotent (lần lặp thứ ba của luật sắt giáo trình: S02-P06, S02-P08, S04-P09).
- Commit **trước** khi xử lý → **at-most-once**: crash và message bị bỏ qua vĩnh viễn. Gần như không bao giờ là thứ một data pipeline muốn.
- **"Exactly-once"** — phiên bản thật thà: Kafka cung cấp idempotent producer (retry không nhân đôi *bản ghi vào log*) và transaction (consume-process-produce nguyên tử, bên trong hệ sinh thái Kafka). Khoảnh khắc consumer của bạn chạm vào hệ thống *bên ngoài* — một warehouse, một API — bạn quay lại at-least-once + idempotency: upsert theo key, hoặc ghi offset *cùng* dữ liệu trong cùng một transaction. Exactly-once là thuộc tính bạn *xây đầu-cuối*, không phải một checkbox để bật.

## Kafka hợp chỗ nào (và không hợp chỗ nào)

Với lấy cái log khi: nhiều consumer cần cùng một dòng event (xương sống outbox/CDC của S07-P06), replay quan trọng, thứ tự theo entity quan trọng, hoặc throughput thật sự cao. Ở lại với queue họ SQS (S04-P09) cho phân phối task đơn giản — queue *ít* thứ phải vận hành hơn, và "biết đâu sau này cần replay" chính là abstraction suy đoán của S01-P10 trong hình hài hạ tầng. Và nhớ cú bắt tay lakehouse từ P09: consumer streaming ghi vào bảng phải gom commit theo lô, không thì bạn đang vận hành một nhà máy small-files. Về vận hành, managed Kafka (tầng MSK/Confluent) lại là lập luận scheduler của S02-P08: cái log là hạ tầng production, và tự chạy broker là công việc nên từ chối cho tới khi scale ép mở cuộc nói chuyện.

## Điều cần nhớ

- Kafka là log bền vững, không phải queue: tiêu thụ không xoá, nên fan-out, replay, và consumer tới muộn là bản năng — đổi lại offset và retention thành trách nhiệm của bạn.
- Partition là đơn vị của thứ tự, song song, và scale: key theo entity buộc phải giữ thứ tự, worker chặn trần ở số partition, và canh chừng key nóng.
- Alarm trên consumer lag trước mọi thứ khác; chấp nhận khựng ngắn lúc rebalance.
- Semantics do thời điểm commit offset quyết định: mặc định at-least-once + consumer idempotent, và coi exactly-once là thuộc tính đầu-cuối dừng lại ở biên giới Kafka.

*Tiếp theo — Phần 11: Stream processing: Flink và bạn bè.*
