---
title: 'CloudWatch & X-Ray: nhìn thấy hệ thống của bạn'
description: 'Metrics, logs, traces là ba câu trả lời cho ba câu hỏi khác nhau, structured logging là thói quen đá đỉnh vòm, và alarm thiết kế từ triệu chứng người dùng — không phải từ mọi ô vuông đỏ.'
date: 2026-08-04
category: Cloud
tags: [aws, cloudwatch, observability]
lang: vi
translationKey: aws-10
series: aws-zero-to-advanced
part: 10
---

Mọi thứ bạn xây trong series này tới giờ đều có thể chết trong im lặng. Đội EC2 (P03) có thể nghiến ở 100% CPU, Lambda (P07) có thể bị throttle, cái queue (P09) có thể lặng lẽ dài ra suốt sáu tiếng — và không có observability thì hệ thống monitoring của bạn là *người dùng của bạn*, còn dashboard là mạng xã hội. Phần này là tầng nhìn thấy: ba loại tín hiệu thật sự trả lời gì, một thói quen logging khiến mọi thứ khác chạy được, và cách thiết kế alarm mà bạn sẽ không học cách phớt lờ.

## Bạn sẽ học được gì

- Ánh xạ ba tín hiệu vào ba câu hỏi mà một sự cố thật sự đặt ra.
- Phát log có cấu trúc kèm request ID, để một câu lệnh dựng lại trọn một request.
- Dựng dashboard trả lời "nó có khoẻ không?" trong một màn hình cho mỗi service.
- Viết alarm theo triệu chứng mà người ta sẽ không học cách phớt lờ.

**Cần biết trước:** Phần 7 hoặc Phần 8 (có thứ gì đó đang chạy và phát log). Từ vựng sự cố ở Phần 5 có ích.

## 1. Ba tín hiệu, ba câu hỏi

```mermaid
flowchart LR
  M["METRICS<br/>con số theo thời gian<br/>'Có gì đó sai không?'"] --> L["LOGS<br/>sự kiện chi tiết<br/>'Chính xác chuyện gì đã xảy ra?'"]
  L --> T["TRACES<br/>hành trình một request<br/>'Nó xảy ra ở đâu?'"]
  T -.->|giả thuyết mới| M
```

- **Metrics** là các con số rẻ tiền theo thời gian (CPU, số request, tỷ lệ lỗi, độ sâu queue). Chúng là tầng *phát hiện*: tổng hợp, luôn bật, alarm được. Chúng nói cho bạn *rằng* có gì đó sai và đại khái ở đâu — không bao giờ nói vì sao.
- **Logs** là tầng *giải thích*: từng sự kiện với chi tiết đầy đủ. Đắt để lưu (hoá đơn observability nằm ở đây), đủ giàu để debug.
- **Traces** (họ X-Ray) trả lời câu hỏi microservice: một request đi qua load balancer, hai service, một queue, một database — *chặng nào* đốt mất 3 giây? Một trace là màn đo `curl -w` của CS-P6, lan truyền xuyên cả hệ phân tán của bạn qua một correlation ID.

Vòng lặp debug chạy từ trái sang phải: alarm trên metric → lọc log theo khung thời gian → trace cho request chậm/lỗi. Team chỉ có log thì làm khảo cổ; team chỉ có metric thì biết mình sập nhưng không biết vì sao.

## 2. Structured logging: thói quen đá đỉnh vòm

Mọi thứ hạ nguồn phụ thuộc vào một quyết định trong code ứng dụng của bạn: **log JSON, mỗi sự kiện một dòng, kèm correlation ID.**

```json
{"level": "ERROR", "ts": "2026-08-04T03:12:09Z", "request_id": "r-8f3a",
 "route": "/checkout", "duration_ms": 4210, "error": "payment_timeout"}
```

Log văn xuôi (`"có gì đó sai sai :("`) dành cho con người đọc một dòng; structured log dành cho *máy trả lời câu hỏi*: CloudWatch Logs Insights khi đó tính được "p95 duration theo route trong một giờ qua" hay "mọi sự kiện của request r-8f3a" — chính là bản năng SQL của S02 chĩa vào dữ liệu vận hành. Hai luật đi kèm: **lan truyền request ID** qua mọi chặng (mỗi service log nó; message trong queue mang nó theo — đó là trace của kỹ sư nhà nghèo, và trace xịn xây trên đúng ý tưởng này), và **không bao giờ log secret hay PII thô** (CS-P11: log là một data store với quyền truy cập *lỏng nhất* công ty; một token trong dòng log là một token đã lộ).

Biết các mặc định của platform: Lambda tự log stdout; container (P08) đẩy stdout qua log driver — "in JSON ra stdout" là trọn vẹn phần tích hợp. Và đặt **retention cho mọi log group** ngay ngày tạo: log mặc định giữ-mãi-mãi, và kho log không giới hạn là hoá đơn versioning của S07-P12 mặc áo observability.

## 3. Metrics và dashboard đáng có

CloudWatch tặng không metrics hạ tầng (CPU, network, độ sâu queue); những cái quan trọng nhất bạn phải **tự phát ra** — đơn hàng đặt thành công, thanh toán thất bại, độ tươi báo cáo — vì metric *business* phát hiện thứ metric hạ tầng không thể: cú deploy mà CPU đẹp hoàn hảo và số đơn hoàn tất bằng không. Phát chúng qua metric filter trên structured log (không thêm code path) hoặc embedded metrics format.

Với dashboard, cưỡng lại ngôi đền 40 widget. Pattern thực chiến là một màn hình mỗi service trả lời bốn câu hỏi — bản nén RED/USE: **rate, errors, duration** cho các thứ chạy theo request; **utilization, saturation, errors** cho tài nguyên (bài học load của P05: saturation — cái run queue — đau trước khi utilization đau). Percentile, không phải trung bình: p50 kể trải nghiệm điển hình, **p99 kể sự thật về những người dùng khổ nhất** — trung bình 200ms giấu cú checkout 8 giây đang đuổi khách của bạn.

## 4. Alarm mà bạn sẽ không học cách phớt lờ

Failure mode của monitoring không phải quá ít alarm — mà là *quá nhiều*: một channel với 50 ô vuông đỏ mỗi ngày huấn luyện mọi người mute nó, và sự cố thật trôi qua không ai đọc (kỷ luật phân rọ của S02-P08, phiên bản cloud). Luật thiết kế:

- **Alarm theo triệu chứng, không theo nguyên nhân.** Page khi "p99 latency > 2s", "tỷ lệ lỗi > 1%", "tuổi message cũ nhất > 15 phút" (P09) — những thứ người dùng cảm nhận. CPU cao mà latency bình thường là một *sự thật*, không phải một *sự cố*; nó lên dashboard, không lên pager.
- **Mọi cú page phải hành động được.** Nếu phản ứng với một alarm là "ack rồi đi tiếp," xoá nó hoặc hạ cấp thành ticket. Alarm là bản hợp đồng: *nó nổ, nghĩa là một con người phải làm gì đó ngay.*
- **Alarm cả sự vắng mặt**: cron không chạy, file hằng ngày không tới, alarm "mất heartbeat" — phát hiện chết-trong-im-lặng là chỗ hệ dựa queue (P09) và pipeline batch (cú trễ SLA của S02-P08) hỏng không tiếng động.
- **Composite alarm cắt noise**: page khi *cả* tỷ lệ lỗi *và* latency cùng xấu; mỗi cái đơn lẻ là sự thật cho dashboard.

Khép vòng bằng ý thức chi phí: observability là một dòng hoá đơn thật (theo GB ingest, theo metric, theo dashboard), và lăng kính S07-P12 áp vào — sample log debug, giữ INFO gọn, giữ ERROR lâu hơn DEBUG. Nhìn thấy mọi thứ mãi mãi là một hoá đơn, không phải một đức hạnh.

## Thực hành (25 phút — làm một request truy vết được, rồi query nó như database)

Thói quen đổi đời trực on-call của bạn là log có cấu trúc cộng một request ID. Hãy tự chứng minh trên một file local trước, rồi áp đúng câu query đó vào CloudWatch Logs Insights.

```python
# app.py — phát JSON, mỗi event một dòng, mọi dòng đều có request id
import json, logging, sys, time, uuid, random

log = logging.getLogger("app"); log.setLevel(logging.INFO)
h = logging.StreamHandler(sys.stdout); h.setFormatter(logging.Formatter("%(message)s")); log.addHandler(h)

def emit(**fields): log.info(json.dumps({"ts": round(time.time(), 3), **fields}))

def handle_request(path):
    rid = str(uuid.uuid4())[:8]                        # sợi chỉ nối mọi thứ lại
    t0 = time.time()
    emit(rid=rid, event="request_start", path=path)
    time.sleep(random.uniform(0.01, 0.2))
    emit(rid=rid, event="db_query", table="orders", ms=round(random.uniform(3, 90), 1))
    status = 500 if random.random() < 0.2 else 200
    if status == 500:
        emit(rid=rid, event="error", kind="UpstreamTimeout", detail="payments api không phản hồi")
    emit(rid=rid, event="request_end", path=path, status=status,
         ms=round((time.time() - t0) * 1000, 1))

for _ in range(50):
    handle_request(random.choice(["/orders", "/orders/42", "/health"]))
```

```bash
python app.py > app.log

# 1. Dựng lại MỘT request từ đầu đến cuối — bất khả với log không cấu trúc
FAILED=$(jq -r 'select(.event=="request_end" and .status==500) | .rid' app.log | head -1)
jq -c "select(.rid==\"$FAILED\")" app.log          # trọn câu chuyện của một request, đúng thứ tự

# 2. Log thành dữ liệu query được: tỷ lệ lỗi, theo loại
jq -r 'select(.event=="error") | .kind' app.log | sort | uniq -c

# 3. p50 vs p99 — con số đáng giá không phải trung bình
jq -s '[.[] | select(.event=="request_end") | .ms] | sort
       | {p50: .[(length*0.50|floor)], p95: .[(length*0.95|floor)], p99: .[(length*0.99|floor)],
          avg: (add/length | .*10|round|./10)}' app.log

# 4. Endpoint chậm nhất, theo cách một dashboard sẽ gom nhóm
jq -s 'group_by(.path)[] | select(.[0].path != null)
       | {path: .[0].path, n: length}' app.log | head
```

Kết quả mong đợi: bước 1 là khoảnh khắc thói quen này tự trả công — một bộ lọc `jq` dựng lại mọi thứ đã xảy ra trong một request fail, đúng thứ tự, kể cả lỗi thượng nguồn gây ra nó. Với log văn bản thuần, cũng việc dựng lại đó nghĩa là grep theo mốc thời gian rồi đoán xem dòng nào thuộc về nhau. Bước 3 cho thấy vì sao nên alarm theo p99 chứ không theo trung bình: trung bình giấu mất cái đuôi chậm mà chính những người dùng bực nhất đang trải qua. Đúng bốn câu query đó chạy được trong CloudWatch Logs Insights với `filter` và `stats` — kỹ năng chuyển giao được vì thứ làm nên điều đó là *hình dạng log*, không phải công cụ.

## Tự kiểm tra

1. Một người dùng báo "site chậm quãng 2 giờ chiều" và log của bạn là các dòng văn bản thuần. Vì sao việc này khó, và thứ gì lẽ ra đã làm nó dễ?
2. Dashboard hiện thời gian phản hồi trung bình 120 ms và cả team thư thái, nhưng bộ phận hỗ trợ vẫn liên tục nhận than phiền. Bạn đang không nhìn vào cái gì?
3. Team bạn có 40 alarm và đã tắt tiếng phần lớn. Luật nào quyết định cái nào được sống?

<details><summary>Xem đáp án</summary>

1. Khó vì không có sợi chỉ nào nối các dòng của cùng một request — bạn đang grep một khoảng thời gian rồi đoán dòng nào thuộc cùng một request, giữa dòng traffic đồng thời. Một request ID trên mọi dòng log có cấu trúc biến việc đó thành một bộ lọc, và các trường (path, status, thời lượng) khiến log tổng hợp được chứ không chỉ đọc được.
2. Phân phối. Trung bình bị chi phối bởi các request nhanh; những người đang than phiền nằm ở phần đuôi. Hãy nhìn p95 và p99, và tách theo endpoint — một đường chậm duy nhất có thể sinh ra toàn bộ số than phiền mà gần như không làm nhúc nhích giá trị trung bình.
3. Alarm phải hành động được và phải về một triệu chứng người dùng cảm thấy: một cú page chỉ nổ khi có ai đó phải làm gì đó ngay, cho một thứ đang thật sự ảnh hưởng dịch vụ. Alarm theo nguyên nhân ("CPU trên 80%") nổ cả khi chẳng có gì sai; alarm không ai hành động thì huấn luyện cả team phớt lờ tất cả, và như thế còn tệ hơn không có cái nào.

</details>

## Điều cần nhớ

- Metrics phát hiện, logs giải thích, traces định vị — vòng debug chạy alarm → lọc log → trace, và bạn cần đủ ba tầng từ rẻ tới đắt.
- Structured JSON log với request ID lan truyền là thói quen đá đỉnh vòm: biến log thành database query được, mở đường cho tracing — và không bao giờ chứa secret.
- Tự phát metric business, vẽ percentile thay vì trung bình, và giữ dashboard ở một màn RED/USE mỗi service.
- Alarm theo triệu chứng người dùng, mọi cú page phải hành động được, alarm cả sự vắng mặt, và đặt log retention từ ngày đầu — một hệ monitoring bạn đã học cách phớt lờ nguy hiểm hơn là không có.

*Tiếp theo — Phần 11: Infrastructure as Code với Terraform.*
