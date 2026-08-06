---
title: 'AWS cho Data: Glue, Athena, Kinesis, Redshift'
description: 'Bản đồ data service trong một sơ đồ, mỗi khái niệm S02 khớp với tên AWS của nó, pattern serverless lake, và cái hoá đơn tính-theo-TB-scan sẽ thiết kế lại bảng của bạn.'
date: 2026-08-04
category: Cloud
tags: [aws, data-engineer, glue, athena]
lang: vi
translationKey: aws-13
series: aws-zero-to-advanced
part: 13
---

Nếu anh em đã đọc Lộ trình Data Engineer (S02), phần này là một *bảng dịch*: mỗi khái niệm bạn đã sở hữu có một tên sản phẩm AWS, một mô hình giá, và vài cái bẫy. Nếu bạn đến từ phía AWS, nó là tấm bản đồ ngược — và S02 là nơi mỗi ý tưởng được trình bày đầy đủ. Dù đi đường nào, kiến trúc là một bức hình, và nó chính là lakehouse của S02-P09 đeo bảng tên AWS.

## Bạn sẽ học được gì

- Ánh xạ các dịch vụ data của AWS vào những khái niệm bạn đã biết từ góc nhìn data engineering.
- Dùng bảng dịch để một cái tên dịch vụ mới thôi là một khái niệm mới.
- Đoán trước cách định giá theo-lượng-quét định hình lại cách bố trí bảng của bạn.
- Lắp pattern serverless lake, và biết nâng cấp nó nghĩa là gì.

**Cần biết trước:** Phần 4 (S3) và Phần 2 (IAM). Biết về pipeline thì tốt nhưng bảng dịch tự nó đứng được.

## 1. Tấm bản đồ

```mermaid
flowchart LR
  SRC[Sources] -->|"batch: Glue jobs / DMS"| S3[(S3 data lake<br/>Parquet + table format — P04, S02-P09)]
  SRC -->|"streaming: Kinesis /<br/>MSK (Kafka)"| S3
  S3 --> CAT["Glue Data Catalog<br/>(metastore — danh bạ của S02-P13)"]
  CAT --> A["Athena<br/>(SQL serverless — trả theo TB scan)"]
  CAT --> EMR["EMR / Glue Spark<br/>(transform nặng — S02-P07)"]
  CAT --> RS["Redshift<br/>(warehouse — gold của S02-P05)"]
  MWAA["MWAA (managed Airflow — S02-P08)"] -.->|orchestrate| S3
```

Chiếc hộp gánh trọng lượng là chiếc kém hào nhoáng nhất: **Glue Data Catalog** là metastore dùng chung — định nghĩa bảng trên các file S3 — cho phép Athena, Spark, và Redshift cùng đọc *chung một bộ bảng*. Đó là "format là bản hợp đồng" của S02-P09 hiện hình cụ thể: các engine hoán đổi được vì cái catalog thì không đổi.

## 2. Bảng dịch

- **Kinesis ↔ Kafka (S02-P10)**: cùng mô hình log — shard là partition, iterator age là consumer lag, reshard là nỗi đau đổi-số-partition. Kinesis là lựa chọn native ít-ops; **MSK** là managed Kafka khi bạn muốn hệ sinh thái. Quyết định là "managed-first" của S02-P10, áp hai lần.
- **Glue jobs ↔ Spark (S02-P07)**: Spark serverless — không cluster phải nuôi, giá theo DPU-giờ. Mọi thứ từ P07 chuyển giao (shuffle, skew, cỡ partition); cái bẫy mới là *cold start và billing tối thiểu* khiến các job tí hon chạy dày đắt một cách bất xứng — gom chúng theo lô (bản năng S04-P09).
- **Athena ↔ DuckDB/Trino (S07-P08)**: SQL tương tác serverless trên lake. Giá của nó *chính là* áp lực thiết kế của nó — bên dưới.
- **Redshift ↔ warehouse (S02-P05)**: columnar MPP cho lớp gold và concurrency BI. Chỉ dẫn thật thà 2026: bắt đầu với Athena trên các table format mở; đón Redshift khi concurrency BI và hiệu năng workload-đã-model đòi hỏi — không phải bước một. Lakehouse *là* mặc định bây giờ; warehouse là một tối ưu.
- **MWAA ↔ Airflow (S02-P08)**: lập lịch managed, lập luận "scheduler là hạ tầng production" của S02-P08 được giải bằng cuốn séc.

## 3. Cái hoá đơn thiết kế lại bảng của bạn

Giá của Athena — **đô la theo TB scan** — là người thầy giỏi nhất cho các bài học storage của S02, vì mọi sai lầm trở thành một dòng hoá đơn: lưu CSV thay vì Parquet và bạn scan gấp 10× (phép toán columnar của S02-P09, xuất hoá đơn); bỏ partitioning và mọi query full-scan cả lịch sử (pruning của S02-P07, xuất hoá đơn); để small files chất đống và bạn trả thêm chi phí request S3 (căn bệnh của S02-P09, xuất hoá đơn). Cách chữa chính xác là giáo trình S02 — Parquet, partition theo cột filter phổ biến, compact định kỳ — và vòng phản hồi ngắn tuyệt đẹp: sửa layout, nhìn chi phí mỗi query rơi 10–100×. Đặt **scan limit theo workgroup** ngay ngày tạo workgroup: một cú `SELECT *` trên năm năm lịch sử là câu chuyện hoá đơn tuần-đầu-dùng-Athena kinh điển, và cái limit biến nó thành một error message thay vì một hoá đơn (bản năng billing-alarm của S04-P02, phiên bản query).

## 4. Pattern serverless lake

Kiến trúc tham chiếu cho team nhỏ — từng mảnh từ chính series này, không server nào ở đâu cả:

S3 landing (lifecycle rule của P04 trên raw) → S3-event hoặc lịch kích một **Glue job** (P07 serverless, hoặc Lambda thường cho file nhỏ — S04-P07) ghi Parquet vào một table format → **catalog** cập nhật → **Athena** phục vụ analyst và dashboard; **MWAA** (hoặc Step Functions cho chuỗi đơn giản) orchestrate; check quality (S02-P12) chạy như các task trong cùng DAG. Đức tính của stack này là kinh tế học S04-P07: volume thấp thì gần như không tốn gì và *scale về không*; trần của nó là khi job Spark cần tune sâu hơn mức Glue lộ ra (→ EMR) hoặc concurrency BI vượt Athena (→ Redshift). Cả hai cuộc di cư đều rẻ *vì dữ liệu không hề di chuyển* — cùng file S3, cùng catalog, khác engine. Đó là thuộc tính lối-thoát của S07-P03, và là trọn lý do để khăng khăng dùng format mở từ ngày một.

Hai cây cầu khép bài. **Security không đổi**: bucket policy + role least-privilege theo từng job (P02), CMK trên các prefix nhạy cảm (P12), tầng Lake Formation cho quyền mịn khi cần kiểm soát mức cột (masking của S02-P13, phiên bản AWS). Và **ops cũng vậy**: mọi Glue job và Kinesis consumer theo luật S04-P10 — structured log, alarm trên iterator age (chính là consumer lag), và alarm freshness data SLA trên các bảng gold, vì một data platform xanh-nhưng-ôi vẫn trượt bài test niềm tin của S02-P12 như thường.

## Thực hành (25 phút — xem cách bố trí bảng làm đổi hoá đơn)

Định giá theo-lượng-quét là thứ duy nhất trong bài này thật sự làm đổi cách bạn thiết kế bảng, và bạn đo được nó ở local trước khi tiêu một xu. DuckDB đọc đúng những layout Parquet mà một engine tính-theo-quét sẽ đọc:

```sql
-- duckdb scan.db
CREATE TABLE events AS
SELECT DATE '2026-01-01' + (i % 365)          AS event_date,
       (i % 7)                                AS channel,
       (i % 100000)                           AS customer_id,
       repeat('x', 200)                       AS payload,       -- cột rộng không ai query
       ((i * 17) % 10000) / 100.0             AS amount
FROM range(4000000) t(i);

-- LAYOUT A: một file phẳng, không partition
COPY events TO 'flat.parquet' (FORMAT PARQUET);

-- LAYOUT B: partition theo cột người ta hay lọc
COPY events TO 'by_date' (FORMAT PARQUET, PARTITION_BY (event_date));

-- LAYOUT C: partition VÀ bỏ cột rộng mà analyst không bao giờ đọc
COPY (SELECT event_date, channel, customer_id, amount FROM events)
  TO 'narrow' (FORMAT PARQUET, PARTITION_BY (event_date));
```

```bash
# Hoá đơn, tính xấp xỉ: ở engine tính-theo-quét bạn trả tiền cho SỐ BYTE ĐỌC
du -sh flat.parquet by_date narrow
# rồi so xem một câu query một ngày phải chạm bao nhiêu ở mỗi layout:
du -sh by_date/event_date=2026-06-15 narrow/event_date=2026-06-15
```

```sql
-- Cùng câu hỏi, ba layout — để ý mỗi cái phải đọc bao nhiêu dữ liệu
.timer on
SELECT sum(amount) FROM 'flat.parquet'          WHERE event_date = DATE '2026-06-15';
SELECT sum(amount) FROM 'by_date/*/*.parquet'   WHERE event_date = DATE '2026-06-15';
SELECT sum(amount) FROM 'narrow/*/*.parquet'    WHERE event_date = DATE '2026-06-15';
```

Kết quả mong đợi: file phẳng phải mở toàn bộ để trả lời một câu hỏi một ngày, trong khi layout có partition chỉ chạm một thư mục — và khác biệt đó *chính là* hoá đơn dưới cách định giá theo-lượng-quét, không chỉ là cải thiện tốc độ. Layout hẹp cho thấy đòn bẩy thứ hai: bỏ một cột rộng không ai query làm mọi cú quét nhỏ đi mãi mãi, và định dạng dạng cột đằng nào cũng cho phép bỏ qua nó, nên hai thứ cộng hưởng. Chạy `du -sh` trên các thư mục một ngày là bạn có con số để mang vào một cuộc bàn thiết kế: layout này tốn gấp N lần layout kia, cho mỗi query, mỗi ngày.

## Tự kiểm tra

1. Hoá đơn query của team bạn cao và ai cũng đổ tại "quá nhiều analyst". Bạn kiểm gì trước?
2. Vì sao định giá theo-lượng-quét biến thiết kế bảng thành quyết định về CHI PHÍ chứ không phải về hiệu năng?
3. Một đồng nghiệp đề xuất chuyển từ serverless lake sang một cluster warehouse chuyên dụng. Câu hỏi nào quyết định?

<details><summary>Xem đáp án</summary>

1. Cách bố trí bảng — cụ thể là partition và kích thước file. Engine tính-theo-quét tính tiền theo số byte đọc, nên một bảng không partition nghĩa là mọi query đọc tất cả bất kể mệnh đề `WHERE`. Cũng chừng đó analyst trên một bảng partition tốt có thể tốn ít hơn cả một bậc độ lớn, và đó là việc sửa ở platform chứ không phải vấn đề con người.
2. Vì mô hình định giá chuyển thẳng một quyết định bố trí vật lý thành tiền: đơn vị tính tiền là số byte đọc, và partition, cắt cột cùng kích thước file quyết định số byte đọc. Trên một cluster provisioned, đúng cái layout tệ đó hiện ra dưới dạng query chậm; với định giá theo quét, nó hiện ra trên hoá đơn — và thường nhờ vậy mà được sửa nhanh hơn.
3. Mức sử dụng. Serverless co về không và tính tiền theo query, nên nó thắng với workload bột phát hoặc ngắt quãng; một cluster provisioned thắng khi nó bận đủ để tiền-theo-query vượt chi phí cố định. Hãy đo chi tiêu hiện tại so với chi phí của công suất ổn định — và nhớ rằng giữ dữ liệu ở định dạng mở khiến đây vẫn là một cú đổi engine chứ không phải một cuộc migrate.

</details>

## Điều cần nhớ

- Một sơ đồ, đủ bảng tên: Kinesis/MSK là cái log, Glue là Spark serverless, Athena là SQL-trên-lake, Redshift là warehouse, MWAA là Airflow — và Glue Catalog là bản hợp đồng khiến engine hoán đổi được.
- Giá theo-TB-scan của Athena xuất hoá đơn cho mọi sai lầm storage: Parquet + partitioning + compaction cắt chi phí query 10–100×, và scan limit theo workgroup biến chuyện-hoá-đơn thành error message.
- Mặc định serverless lake (S3 + Glue + Athena, scale về không); thêm EMR hay Redshift khi tuning hay concurrency đòi — dữ liệu không di chuyển, nên nâng cấp là đổi engine, không phải migration.
- Khái niệm S02 và kỷ luật S04 ghép nguyên vẹn: least-privilege theo job, CMK cho dữ liệu nhạy cảm, alarm iterator-age và freshness — xanh-nhưng-ôi vẫn trượt bài test niềm tin.

*Tiếp theo — Phần 14: AWS cho AI: Bedrock & SageMaker.*
