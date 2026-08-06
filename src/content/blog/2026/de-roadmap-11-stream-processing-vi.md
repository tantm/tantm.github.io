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

## Bạn sẽ học được gì

- Giải thích vì sao chính state, chứ không phải throughput, mới là thứ khiến stream processing khó.
- Chọn loại window từ câu hỏi đang được đặt ra, không từ tutorial bạn vừa đọc.
- Đặt chính sách watermark một cách thật thà, và quyết định dữ liệu tới sau nó sẽ ra sao.
- Ra quyết định batch-hay-streaming dựa trên bằng chứng chứ không dựa trên khẩu vị.

**Cần biết trước:** Phần 10 (Kafka, partition, offset) và Phần 6 (dữ liệu muộn, backfill).

## 1. State: thứ khiến nó khó

Một batch job (P03–P07) đọc trọn input, tính, ghi, chết — "state" của nó sống một lần chạy. Một streaming job chạy *mãi mãi*, và bất cứ thứ gì nó phải nhớ giữa các event — bộ đếm, phía bên kia của một cú join, năm event gần nhất của một pattern gian lận — là **state** mà engine phải giữ. Một từ đó giải thích trọn bề mặt vận hành:

- State sống cục bộ theo từng task song song, **partition theo key** — đó là lý do stream được `keyBy` đúng cách Kafka topic được key (P10): mọi event của `customer_42` gặp cùng một task và state của nó. Key nóng ở đây đau gấp đôi (bài học P10, giờ gắn thêm bộ nhớ).
- State phải sống sót qua crash: engine chụp **checkpoint** định kỳ (snapshot nhất quán của toàn bộ state + offset input) xuống storage bền. Phục hồi = restore checkpoint cuối + replay log từ offset của nó — đây chính là *lý do* P10 khăng khăng log phải giữ dữ liệu. Món "exactly-once" được quảng cáo rầm rộ chính xác là cơ chế này: state và offset commit *cùng nhau*, nên crash không bao giờ đếm đôi — với caveat thật thà của P10 còn nguyên: bảo đảm phủ state bên trong engine; hiệu ứng lên hệ bên ngoài vẫn cần sink idempotent hoặc ghi transactional.
- **State không giới hạn là cú OOM của streaming**: "count distinct user theo key, mãi mãi" phình vô hạn. Kỷ luật production = mọi mẩu state có hạn dùng (TTL) hoặc sống trong một window. Engine không ép điều này; bạn phải tự ép.

## 2. Window: aggregate thứ không bao giờ kết thúc

"Tổng doanh thu" vô nghĩa trên một stream vô hạn — bạn sẽ emit nó *khi nào*? Window khiến aggregation hữu hạn trở lại:

- **Tumbling** — các xô cố định, không chồng lấn ("mỗi phút"): dashboard, billing.
- **Sliding** — chồng lấn ("10 phút gần nhất, mỗi phút"): trend mượt, alert theo ngưỡng.
- **Session** — theo khoảng lặng ("các event cho tới khi im 30 phút"): phiên người dùng, đợt hoạt động của thiết bị. Cái window batch không có, và là lý do session analytics trên stream thắng job chạy đêm.

Quyết định tinh tế nấp bên dưới: **thời gian nào?** *Event time* (lúc nó xảy ra, lấy từ payload) vs *processing time* (lúc nó tới nơi). Một đơn mobile đặt lúc 23:59 có thể tới lúc 00:15 — processing time ghi nó vào nhầm ngày, và con số streaming của bạn sẽ không bao giờ khớp với warehouse batch (các sự cố watermark của S02-P06, chiếu lại ở độ phân giải giây). Pipeline nghiêm túc dùng event time — và điều đó sinh ra bài toán kế tiếp.

## 3. Watermark: chính sách trung thực với dữ liệu muộn

Nếu window theo event time, bạn phải trả lời: *đợi kẻ lạc đàn bao lâu trước khi tuyên bố 12:00–12:01 đã xong?* **Watermark** là câu trả lời đó, chảy xuyên qua stream: "tôi tin mọi event tới 12:01 đã về đủ." Window đóng khi watermark vượt qua mép cuối của nó; event tới *muộn hơn* watermark là **late data**, và bạn chọn số phận của chúng một cách tường minh — drop (và *đếm* — một metric lặng lẽ tăng vọt khi một producer hỏng), hoặc rẽ sang side output để đối soát (bản năng vá-bằng-batch của S02-P06).

Trade-off là không thể né và đáng nói thành tiếng: **watermark chặt = kết quả nhanh + nhiều dữ liệu bị tuyên muộn; watermark lỏng = kết quả đủ + mọi thứ trễ.** Không có setting nào cho bạn cả hai; chỉ có lựa chọn tỉnh táo theo từng use case — chống gian lận chấp nhận hụt 1% để hành động trong vài giây; tài chính thì đợi.

## 4. Batch vs streaming: quyết định thật thà

Streaming là một *cái giá* bạn trả cho độ tươi — state, checkpoint, suy luận watermark, on-call 24/7 cho một job không bao giờ kết thúc (máy nhắn của S01-P05, vĩnh viễn). Nên câu hỏi senior là câu hỏi lập lịch của P08 lộn ngược: **ai cần kết quả này, tươi cỡ nào?**

- Dashboard xem mỗi sáng → batch (P08). "Real-time" mà không ai đọc real-time là abstraction suy đoán của S01-P10, lần nữa.
- Fraud/alert/phản ứng vận hành trong giây-tới-phút → streaming, không có món thay thế.
- Dải giữa ("tươi 15 phút") thường thuộc về **micro-batch** (sân nhà của Spark Structured Streaming) hoặc batch incremental chạy dày — đơn giản hơn hẳn để vận hành cho cùng kết quả business.

Kiến trúc hoà giải hai bên là cú bắt tay P09: stream đổ vào bảng lakehouse (commit theo lô!), để consumer batch đọc cùng bảng — một sự thật lưu trữ, hai nhịp tính toán. Về vận hành, các luật P10 mang sang nguyên vẹn: alarm lag trước tiên, rồi tới thời lượng/thất bại checkpoint (mùi đặc trưng streaming: checkpoint phình = state phình = một cái TTL bạn quên), và ưu tiên managed runtime cho tới khi scale ép khác đi.

## Thực hành (25 phút — tự tay cài window và watermark)

Không cần cluster Flink. Bốn mươi dòng Python làm event time, window và watermark thành cụ thể — và khối cuối cho thấy kiểu hỏng ai cũng gặp trên production:

```python
from collections import defaultdict

# (event_time, processing_time, user, amount) — chú ý event 5: nó XẢY RA sớm, TỚI NƠI muộn
EVENTS = [
    (10, 10, "u1", 5), (11, 11, "u2", 3), (19, 19, "u1", 7),
    (21, 21, "u1", 2), (25, 25, "u2", 9),
    (14, 31, "u1", 100),                    # muộn 17 đơn vị theo processing time
]
WINDOW = 10                                  # tumbling window: [0,10) [10,20) [20,30)…

def window_of(t): return (t // WINDOW) * WINDOW

# 1. PROCESSING TIME — bản ngây thơ: gom theo lúc ta tình cờ nhìn thấy nó
proc = defaultdict(float)
for et, pt, user, amt in EVENTS:
    proc[window_of(pt)] += amt
print("theo processing time:", dict(proc))   # cái 100 tới muộn rơi vào window SAI

# 2. EVENT TIME — gom theo lúc nó thật sự xảy ra
ev = defaultdict(float)
for et, pt, user, amt in EVENTS:
    ev[window_of(et)] += amt
print("theo event time     :", dict(ev))     # cái 100 về window 10, đúng chỗ của nó

# 3. WATERMARK — bạn không chờ mãi được; phải tuyên bố một mốc cắt
LATENESS = 5                                 # "tôi chờ thêm 5 đơn vị sau khi window kết thúc"
emitted, results, side_output = set(), {}, []
state = defaultdict(float)
watermark = 0
for et, pt, user, amt in sorted(EVENTS, key=lambda e: e[1]):
    watermark = max(watermark, et - LATENESS)          # watermark bounded-lateness đơn giản
    w = window_of(et)
    if w + WINDOW <= watermark and w in emitted:
        side_output.append((w, et, amt))                # QUÁ MUỘN: window đã đóng
        continue
    state[w] += amt
    for win in list(state):                             # đóng mọi window mà watermark đã vượt qua
        if win + WINDOW <= watermark and win not in emitted:
            results[win] = state[win]; emitted.add(win)
for win in state:                                       # xả nốt khi hết stream
    results.setdefault(win, state[win])
print("window đã phát ra   :", dict(sorted(results.items())))
print("bị bỏ vì muộn       :", side_output, " ← hãy ĐẾM chúng, đừng vứt trong im lặng")

# 4. STATE PHÌNH TO — cú OOM không ai lường trước
per_user = defaultdict(float)
for et, pt, user, amt in EVENTS: per_user[user] += amt
print(f"số key giữ trong state: {len(per_user)}  (giờ tưởng tượng mỗi session id một key, mãi mãi)")
```

Kết quả mong đợi: khối 1 đẩy cái 100 tới muộn vào window nơi nó *tới nơi*, và đó đơn giản là đáp án sai — cũng là đáp án bạn nhận mặc định nếu không bao giờ nghĩ tới event time. Khối 2 đặt nó về đúng chỗ. Khối 3 là phần giữa thật thà: với mức cho phép muộn 5 đơn vị, window có thể đã đóng khi event đó xuất hiện, nên nó rơi vào một side output mà bạn *đếm* thay vì vứt lặng lẽ. Khối 4 mới là kẻ giết người thầm lặng: state giữ theo từng key, nên một không gian key phình vô hạn (session ID, request ID) là một lỗi hết bộ nhớ có ngòi nổ chậm. Đó là lý do mọi job streaming production đều đặt TTL cho state.

## Tự kiểm tra

1. Kết quả tổng hợp streaming của bạn lệch một chút so với con số hằng ngày của warehouse, ngày nào cũng lệch. Nguyên nhân khả dĩ nhất là gì?
2. Vì sao "exactly-once" là tính chất của một đoạn pipeline chứ không phải của cả hệ thống?
3. Job chạy tốt ba tuần rồi chết vì hết bộ nhớ. Throughput không hề đổi. Bạn nghi gì?

<details><summary>Xem đáp án</summary>

1. Dữ liệu muộn và chính sách watermark. Stream đã đóng window sau một mức cho phép muộn có giới hạn, trong khi job batch đọc lại toàn bộ vài tiếng sau và bao gồm cả những event tới sau khi stream đã đi tiếp. Không bên nào sai — chúng đang trả lời với hai mốc cắt khác nhau. Hãy đối soát bằng cách đếm phần stream bỏ vì muộn, và làm rõ định nghĩa window của job batch.
2. Vì nó đạt được bằng cách commit state và offset đầu vào cùng nhau, và lời đảm bảo đó chỉ giữ được bên trong biên giới nơi engine kiểm soát cả hai. Ngay khi output rời sang một hệ thống bên ngoài không tham gia vào cú commit đó, bạn quay lại at-least-once và cần các cú ghi idempotent ở phía bên kia.
3. State phình vô giới hạn. Có thứ gì đó đang được khoá theo một giá trị lực lượng vô hạn — session ID, request ID, chuỗi do người dùng nhập — và mỗi key mới thêm state không bao giờ được giải phóng. Sửa bằng TTL cho keyed state, hoặc khoá lại theo thứ gì đó có giới hạn.

</details>

## Điều cần nhớ

- Stream processing = tính toán có state trên input vô hạn: state được key, được checkpoint, và luôn phải có TTL hoặc window — state không giới hạn là cú OOM của streaming.
- Exactly-once là checkpoint commit state + offset cùng nhau; nó dừng ở biên giới engine — sink vẫn cần idempotency (luật sắt của giáo trình, dạng cuối cùng).
- Window theo event time, và coi watermark là chính sách trung thực tường minh: nhanh-mà-thiếu vs đủ-mà-trễ là lựa chọn theo từng use case, với late data được đếm và định tuyến, không bao giờ lặng lẽ vứt.
- Streaming là cái giá trả cho độ tươi: batch cho thứ đọc hằng ngày, stream cho thứ hành động trong giây, micro-batch cho dải giữa — và đổ cả hai vào cùng bảng lakehouse.

*Tiếp theo — Phần 12: Data quality & testing: niềm tin là một feature.*
