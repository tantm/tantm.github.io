---
title: 'Stream processing: Flink và bạn bè'
description: 'Tính toán có state trên dữ liệu vô hạn: window là câu trả lời cho "aggregate thứ không bao giờ kết thúc", watermark là chính sách trung thực với dữ liệu tới muộn, và khi nào batch vẫn là lựa chọn đúng.'
date: 2026-08-04
category: Data
tags: [de-roadmap, flink, streaming]
lang: vi
translationKey: de-roadmap-11
series: de-roadmap
part: 11
---

P10 đưa bạn cái log; phần này nói về *tính toán* trên nó. Đọc Kafka rồi upsert vài hàng là việc ống nước — **stream processing** bắt đầu khi phép tính cần *trí nhớ xuyên qua các event*: "số đơn mỗi phút," "thẻ này có quẹt năm lần trong mười giây không," "join click với impression." Flink là engine tham chiếu cho lớp bài toán này (Spark Structured Streaming và Kafka Streams là cùng bộ ý tưởng với trade-off khác), và thứ chuyển giao được chính là các ý tưởng. Ba trong số đó gánh toàn bộ: **state, window, và watermark.**

## State: thứ khiến nó khó

Một batch job (P03–P07) đọc trọn input, tính, ghi, chết — "state" của nó sống một lần chạy. Một streaming job chạy *mãi mãi*, và bất cứ thứ gì nó phải nhớ giữa các event — bộ đếm, phía bên kia của một cú join, năm event gần nhất của một pattern gian lận — là **state** mà engine phải giữ. Một từ đó giải thích trọn bề mặt vận hành:

- State sống cục bộ theo từng task song song, **partition theo key** — đó là lý do stream được `keyBy` đúng cách Kafka topic được key (P10): mọi event của `customer_42` gặp cùng một task và state của nó. Key nóng ở đây đau gấp đôi (bài học P10, giờ gắn thêm bộ nhớ).
- State phải sống sót qua crash: engine chụp **checkpoint** định kỳ (snapshot nhất quán của toàn bộ state + offset input) xuống storage bền. Phục hồi = restore checkpoint cuối + replay log từ offset của nó — đây chính là *lý do* P10 khăng khăng log phải giữ dữ liệu. Món "exactly-once" được quảng cáo rầm rộ chính xác là cơ chế này: state và offset commit *cùng nhau*, nên crash không bao giờ đếm đôi — với caveat thật thà của P10 còn nguyên: bảo đảm phủ state bên trong engine; hiệu ứng lên hệ bên ngoài vẫn cần sink idempotent hoặc ghi transactional.
- **State không giới hạn là cú OOM của streaming**: "count distinct user theo key, mãi mãi" phình vô hạn. Kỷ luật production = mọi mẩu state có hạn dùng (TTL) hoặc sống trong một window. Engine không ép điều này; bạn phải tự ép.

## Window: aggregate thứ không bao giờ kết thúc

"Tổng doanh thu" vô nghĩa trên một stream vô hạn — bạn sẽ emit nó *khi nào*? Window khiến aggregation hữu hạn trở lại:

- **Tumbling** — các xô cố định, không chồng lấn ("mỗi phút"): dashboard, billing.
- **Sliding** — chồng lấn ("10 phút gần nhất, mỗi phút"): trend mượt, alert theo ngưỡng.
- **Session** — theo khoảng lặng ("các event cho tới khi im 30 phút"): phiên người dùng, đợt hoạt động của thiết bị. Cái window batch không có, và là lý do session analytics trên stream thắng job chạy đêm.

Quyết định tinh tế nấp bên dưới: **thời gian nào?** *Event time* (lúc nó xảy ra, lấy từ payload) vs *processing time* (lúc nó tới nơi). Một đơn mobile đặt lúc 23:59 có thể tới lúc 00:15 — processing time ghi nó vào nhầm ngày, và con số streaming của bạn sẽ không bao giờ khớp với warehouse batch (các sự cố watermark của S02-P06, chiếu lại ở độ phân giải giây). Pipeline nghiêm túc dùng event time — và điều đó sinh ra bài toán kế tiếp.

## Watermark: chính sách trung thực với dữ liệu muộn

Nếu window theo event time, bạn phải trả lời: *đợi kẻ lạc đàn bao lâu trước khi tuyên bố 12:00–12:01 đã xong?* **Watermark** là câu trả lời đó, chảy xuyên qua stream: "tôi tin mọi event tới 12:01 đã về đủ." Window đóng khi watermark vượt qua mép cuối của nó; event tới *muộn hơn* watermark là **late data**, và bạn chọn số phận của chúng một cách tường minh — drop (và *đếm* — một metric lặng lẽ tăng vọt khi một producer hỏng), hoặc rẽ sang side output để đối soát (bản năng vá-bằng-batch của S02-P06).

Trade-off là không thể né và đáng nói thành tiếng: **watermark chặt = kết quả nhanh + nhiều dữ liệu bị tuyên muộn; watermark lỏng = kết quả đủ + mọi thứ trễ.** Không có setting nào cho bạn cả hai; chỉ có lựa chọn tỉnh táo theo từng use case — chống gian lận chấp nhận hụt 1% để hành động trong vài giây; tài chính thì đợi.

## Batch vs streaming: quyết định thật thà

Streaming là một *cái giá* bạn trả cho độ tươi — state, checkpoint, suy luận watermark, on-call 24/7 cho một job không bao giờ kết thúc (máy nhắn của S01-P05, vĩnh viễn). Nên câu hỏi senior là câu hỏi lập lịch của P08 lộn ngược: **ai cần kết quả này, tươi cỡ nào?**

- Dashboard xem mỗi sáng → batch (P08). "Real-time" mà không ai đọc real-time là abstraction suy đoán của S01-P10, lần nữa.
- Fraud/alert/phản ứng vận hành trong giây-tới-phút → streaming, không có món thay thế.
- Dải giữa ("tươi 15 phút") thường thuộc về **micro-batch** (sân nhà của Spark Structured Streaming) hoặc batch incremental chạy dày — đơn giản hơn hẳn để vận hành cho cùng kết quả business.

Kiến trúc hoà giải hai bên là cú bắt tay P09: stream đổ vào bảng lakehouse (commit theo lô!), để consumer batch đọc cùng bảng — một sự thật lưu trữ, hai nhịp tính toán. Về vận hành, các luật P10 mang sang nguyên vẹn: alarm lag trước tiên, rồi tới thời lượng/thất bại checkpoint (mùi đặc trưng streaming: checkpoint phình = state phình = một cái TTL bạn quên), và ưu tiên managed runtime cho tới khi scale ép khác đi.

## Điều cần nhớ

- Stream processing = tính toán có state trên input vô hạn: state được key, được checkpoint, và luôn phải có TTL hoặc window — state không giới hạn là cú OOM của streaming.
- Exactly-once là checkpoint commit state + offset cùng nhau; nó dừng ở biên giới engine — sink vẫn cần idempotency (luật sắt của giáo trình, dạng cuối cùng).
- Window theo event time, và coi watermark là chính sách trung thực tường minh: nhanh-mà-thiếu vs đủ-mà-trễ là lựa chọn theo từng use case, với late data được đếm và định tuyến, không bao giờ lặng lẽ vứt.
- Streaming là cái giá trả cho độ tươi: batch cho thứ đọc hằng ngày, stream cho thứ hành động trong giây, micro-batch cho dải giữa — và đổ cả hai vào cùng bảng lakehouse.

*Tiếp theo — Phần 12: Data quality & testing: niềm tin là một feature.*
