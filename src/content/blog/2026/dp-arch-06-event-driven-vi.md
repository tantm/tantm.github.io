---
title: 'Data hướng sự kiện: CDC & Outbox'
description: 'Dữ liệu rời database vận hành mà không ai phải viết job export: change data capture, outbox pattern, và event như nguồn sự thật — kèm các bẫy.'
date: 2026-07-28
category: Architecture
tags: [dp-architectures, cdc, event-driven, kafka]
lang: vi
translationKey: dp-arch-06
series: dp-architectures
part: 6
cover: images/dp-arch-event-driven.png
---

Các trường phái trước đều mặc định dữ liệu *tự dưng tới* — extract chạy đêm (Phần 2), file trong lake (Phần 3), event trong log (Phần 4–5). Phần này nói về chính chuyện "tới" đó: làm sao dữ liệu thoát khỏi hệ thống vận hành **liên tục, đáng tin, mà không phải nhờ từng team app viết job export**. Hai pattern thống trị: change data capture và outbox.

![Data hướng sự kiện: CDC & Outbox](images/dp-arch-event-driven.png)

## Nỗi đau khai sinh

Cú extract `SELECT *` chạy đêm có ba bệnh mãn tính: nó nện vào source lúc 2 giờ sáng, nó bỏ lỡ mọi thứ xảy ra *rồi bị hoàn tác* giữa hai lần chụp, và lịch chạy của nó định trần độ tươi của bạn. Poll dày hơn chỉ là đổi bệnh một lấy bệnh ba. Insight đứng sau CDC: **database vốn đã ghi một cuốn nhật ký hoàn hảo về mọi thay đổi — replication log của nó.** Hãy đọc cuốn đó thay vì query bảng.

## Pattern 1 — CDC: cuốn nhật ký của database

```mermaid
flowchart LR
    DB["DB vận hành<br/><i>OLTP</i>"] -->|"write-ahead log"| C["CDC connector<br/><i>lớp Debezium</i>"]
    C -->|"event insert / update / delete"| K["Log bền"]
    K --> LH["Bảng lakehouse<br/><i>merge vào silver</i>"]
    K --> RT["Real-time OLAP / cache"]
```

CDC connector (pattern Debezium) bám đuôi write-ahead log và publish mỗi thay đổi dòng thành một event: *ảnh trước, ảnh sau, loại thao tác, timestamp*. Hạ nguồn, platform merge chúng vào bảng lakehouse (Phần 3) hoặc nuôi các tầng serving (Phần 5).

Điều khiến CDC được yêu: **không sửa một dòng code app nào** (app không biết mình đang bị quan sát), độ tươi cận real-time, và hết cảnh nện source lúc 2 giờ sáng. Điều tờ rơi quảng cáo bỏ qua:

- **Snapshot & backfill** — log chỉ giữ được một đoạn; lần sync đầu cần một snapshot nhất quán, và re-sync một bảng là một sự kiện vận hành, không phải một cú click.
- **Đổi schema là cắn** — `ALTER TABLE` ở source lan sóng tới mọi consumer. Thiếu schema registry và luật tương thích, CDC thành cỗ máy phá vỡ phân tán.
- **Bạn thừa kế data model của source** — CDC trung thành export các bảng nội bộ của app, kèm cả foreign key. Lớp silver của bạn phải dịch *ruột app* thành *ngữ nghĩa business*; bỏ qua bước dịch đó là ghép cứng cả platform vào ORM của một team khác.

## Pattern 2 — Outbox: event có chủ đích

Event CDC nói *"dòng 4711 đã đổi"*. Thứ business thường cần là *"Đơn hàng 123 đã được đặt"* — một **event mức domain, có chủ đích**. Nhưng nếu app ghi vào database *rồi mới* publish lên log như hai bước rời, sớm muộn một bước sẽ fail một mình, và bạn có đơn-không-event hoặc event-không-đơn (bài toán dual-write).

Outbox pattern sửa nó bằng một mánh thật thà:

```mermaid
flowchart LR
    A["Transaction của app"] -->|"1. bảng business<br/>2. bảng outbox<br/><i>cùng một transaction ACID</i>"| DB[(App DB)]
    DB -->|"CDC trên bảng outbox"| K["Log bền"]
    K --> S["Subscribers<br/><i>analytics · services · search</i>"]
```

App ghi thay đổi business **và** event vào bảng `outbox` *trong cùng một transaction* — nên chúng commit hoặc fail cùng nhau. CDC sau đó chuyển các dòng outbox lên log. Tính nguyên tử từ database, việc giao hàng từ CDC, và schema của event được **thiết kế**, không phải rò rỉ từ bảng nội bộ.

Quy tắc bỏ túi: **CDC cho dữ liệu bạn quan sát** (hệ thống có sẵn không sửa được), **outbox cho event bạn sở hữu** (service do team mình xây). Platform chín chắn chạy cả hai.

## Event làm nguồn sự thật — nên đi xa tới đâu

Event sourcing toàn phần (bản ghi *duy nhất* là event log; mọi state đều dẫn xuất) mạnh mẽ và đắt đỏ — đa số platform analytics không cần. Điểm giữa thực dụng: giữ database vận hành làm system-of-record, coi **event log là xương sống tích hợp**, và để lakehouse lưu lịch sử. Bạn có replayability (Kappa của Phần 4) mà không phải xây lại mọi ứng dụng.

Một bài học production đáng nguyên một đoạn: **consumer hạ nguồn phải idempotent.** CDC và log giao hàng kiểu at-least-once; cùng một thay đổi *chắc chắn sẽ* tới hai lần. Merge theo key + version vào bảng lakehouse khiến bản trùng vô hại. Riêng thói quen này chặn cả một thể loại sự cố "số liệu nhân đôi sau một đêm".

## Chấm theo năm trục

- **Latency:** độ tươi giây-tới-phút cho *mọi* mục đích hạ nguồn cùng lúc — thường là cách rẻ nhất để làm nhiều thứ tươi hơn mà không cần pipeline riêng từng use case.
- **Team:** connector, schema registry, governance topic là bề mặt vận hành thật; "ai duyệt một thay đổi schema event" trở thành câu hỏi tổ chức (Phần 7 gửi lời chào).
- **Scale:** log scale tốt; điểm đau thường là bán kính nổ của một bảng nóng.
- **Budget:** hạ tầng connector + retention log; rẻ hơn vẻ ngoài nếu so với nuôi N job extract thủ công.
- **Compliance:** event sao chép PII vào một log giữ lâu — tính trước chuyện xoá theo key hoặc crypto-shredding (cùng cảnh báo Phần 4, nhân đôi vì CDC chép *tất cả*).

## Ba khách hàng

- **Startup:** thường bỏ qua CDC lúc đầu — extract chạy đêm trên stack Phần 8 là đủ. Chỉ nên xài outbox sớm *nếu* giữa các service đã event-driven sẵn.
- **Tầm trung:** CDC trên 3–5 bảng lõi nuôi analytics; outbox cho service mới; mọi thứ đáp vào silver của lakehouse. Nước cờ hiện đại hoá tiêu chuẩn.
- **Enterprise:** cái log thành xương sống tích hợp của hàng chục team — lúc đó governance schema, ownership, và chính sách PII theo topic quan trọng hơn bất kỳ connector nào (và lớp phủ Phần 10 áp lên chính cái log).

## Điều cần nhớ

- CDC đọc replication log của database: export liên tục, vô hình với app — nhưng bạn nhận kèm snapshot, sóng đổi schema, và data model nội bộ của source.
- Outbox pattern diệt bài toán dual-write: thay đổi business + event commit trong một transaction, CDC lo giao hàng.
- Quan sát bằng CDC, sở hữu bằng outbox; consumer phải idempotent vì mọi thứ tới kiểu at-least-once.
- Event log làm xương sống tích hợp cho bạn replayability mà không cần event sourcing toàn phần — và nó sao chép PII của bạn, nên hãy tính chuyện xoá trước tiên.

*Tiếp theo — Phần 7: Data Mesh: lời hứa, cái giá, thực tế.*
