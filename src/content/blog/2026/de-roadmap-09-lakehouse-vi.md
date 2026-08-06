---
title: 'Data Lake & Lakehouse: Parquet, Iceberg, Delta'
description: 'Bên trong Parquet (vì sao columnar nhanh), cách table format "phù phép" ACID trên storage bất biến, căn bệnh small files, và các job bảo trì không ai kể cho bạn.'
date: 2026-08-04
category: Data
tags: [de-roadmap, lakehouse, storage, parquet]
lang: vi
translationKey: de-roadmap-09
series: de-roadmap
part: 9
---

S07-P03 kể câu chuyện lake→swamp→lakehouse từ ghế kiến trúc sư. Phần này mở nắp capo: bên *trong* một file Parquet có gì mà nhanh vậy, cách các format họ Iceberg/Delta phù phép ra ACID từ những object bất biến (S04-P04 nói object không sửa được — vậy `UPDATE` chạy kiểu gì?), và hai căn bệnh vận hành — small files và bảng không được bảo trì — mà mọi lakehouse thật đều mắc phải.

## Bạn sẽ học được gì

- Giải thích ba cơ chế khiến lưu trữ dạng cột nhanh, và cách ghi file để tận dụng chúng.
- Mô tả cách table format phù phép ra ACID từ object storage bất biến.
- Chẩn đoán và chữa căn bệnh small files trước khi nó nhân đôi thời gian query.
- Tiến hoá schema mà không làm vỡ bên đọc.

**Cần biết trước:** Phần 5 (partition và các lớp) và Phần 3 (nấc thang dẫn tới đây).

## 1. Bên trong Parquet: vì sao columnar thắng

Một file Parquet không phải "CSV nhưng binary." Cấu trúc của nó *chính là* hiệu năng của nó:

```text
file
 ├── row group 0  (~128MB–1GB dữ liệu hàng)
 │    ├── column chunk: order_id   (encoded, compressed)
 │    ├── column chunk: amount     (encoded, compressed)
 │    └── column chunk: country    (encoded, compressed)
 ├── row group 1 ...
 └── footer: schema + thống kê mỗi chunk (min/max, null count)
```

Ba cơ chế rơi ra từ layout này, và chúng là toàn bộ phép màu:

1. **Column pruning** — `SELECT amount, country` chỉ đọc hai column chunk và bỏ qua ba mươi cột còn lại. Một bảng rộng được query hẹp chỉ tốn một phần nhỏ kích thước của nó ("dữ liệu nhanh nhất là dữ liệu bạn không đọc" của CS-P2).
2. **Predicate pushdown nhờ thống kê ở footer** — `WHERE day = '2026-08-01'` kiểm tra min/max của từng row group *ngay trong footer* và bỏ qua nguyên cả group mà không cần đọc. Đây là lý do **sort/cluster trong file theo cột filter thường dùng** là một tối ưu thật sự: khoảng min/max càng chặt = bỏ qua càng nhiều.
3. **Encoding trước compression** — cột chứa giá trị giống nhau encode cực hiệu quả (dictionary encoding biến một triệu chuỗi `"VN"` thành một entry trong dictionary + các index tí hon; run-length encoding nghiền nát cột đã sort). Đây là lý do Parquet nhỏ hơn CSV 5–10× *và* đọc nhanh hơn — và là lý do luật memory của pandas ở S02-P03 cải thiện ngay khi bạn đổi format.

## 2. Table format: ACID phù phép từ object bất biến

Ràng buộc từ S04-P04: object không sửa được, chỉ thay thế được. Vậy lakehouse `UPDATE` một hàng kiểu gì? **Nó không update — nó ghi file mới và thay đổi *ý nghĩa* của bảng:**

- Sự thật của bảng nằm ở **tầng metadata**: một log các snapshot, mỗi snapshot = "bảng chính xác là danh sách các data file này."
- Một lần ghi (append, update, delete) tạo ra các file Parquet *mới* cộng một snapshot *mới* trỏ tới danh sách file mới. Cú **commit** là một lần hoán đổi nguyên tử duy nhất của con trỏ current-snapshot.
- Reader ghim một snapshot khi bắt đầu — họ thấy một bảng nhất quán ngay cả giữa lúc đang ghi (ACID trong bảng của S07-P03, giải thích bằng cơ khí). **Time travel** giờ trở nên hiển nhiên: snapshot cũ vẫn liệt kê file cũ; query nó thôi.
- Delete có hai vị đáng biết: **copy-on-write** (ghi lại các file bị ảnh hưởng — ghi chậm hơn, đọc nhanh nhất) vs **merge-on-read** (ghi các "delete file" nhỏ; reader trừ chúng ra — ghi nhanh, đọc chịu thuế cho tới khi compaction). Bảng nặng streaming nghiêng về MoR; bảng batch-analytics nghiêng về CoW.

Iceberg và Delta khác nhau ở hệ sinh thái và chi tiết, không phải ở thiết kế lõi này. Lựa chọn thực dụng năm 2026: **format nào mà engine/platform chính của bạn coi là native** — khái niệm chuyển giao trọn vẹn, và các engine ngày càng đọc được cả hai.

## 3. Căn bệnh small files

Căn bệnh production phổ biến nhất của lakehouse. Writer streaming (CDC của S07-P06) và các job song song quá đà (nghìn partition tí hon của S02-P07) mỗi lần commit vài file bé xíu; một năm sau, một "bảng" là hai triệu object 200 KB — và mỗi query trả hai triệu request S3 (luật ít-request-to-hơn của S04-P04, bị vi phạm ở quy mô lớn) cộng chi phí đọc footer còn nặng hơn cả dữ liệu.

Các phương thuốc, tất cả đều nhàm chán và tất cả đều bắt buộc:

- **Compaction** — định kỳ ghi lại các file nhỏ thành file cỡ ~128 MB–1 GB. Mọi table format đều ship sẵn thủ tục bảo trì này; *hãy lập lịch cho nó* (một DAG Airflow, S02-P08) — nó không tự chạy.
- **Snapshot expiration** — mỗi commit giữ mọi file cũ để time travel với tới được; hãy expire snapshot cũ và xoá file mồ côi, không thì storage tăng đơn điệu mãi (bài học hoá đơn versioning của S07-P12, phiên bản table format). Retention ở đây cũng chính là đòn bẩy compliance S07-P10 của bạn — expire một snapshot mới là lúc dữ liệu thật sự *bị xoá*.
- **Ghi to hơn** — sửa từ phía producer: gom commit streaming theo lô (mỗi N phút, không phải mỗi message), chỉnh đúng cỡ output partition của Spark trước khi ghi.

Một lakehouse không có bảo trì định kỳ không phải lakehouse; nó là một cái swamp với marketing tốt hơn. Hãy đưa DAG bảo trì vào ngân sách ngay ngày bạn tạo bảng đầu tiên.

## 4. Schema evolution không nước mắt

Table format theo dõi cột bằng **ID, không phải tên** — đó là lý do `ALTER TABLE ADD COLUMN`, rename, và nới rộng kiểu là các thao tác chỉ-metadata (không ghi lại dữ liệu) và lý do file cũ vẫn đọc được: cột thiếu đọc ra null. Các kỷ luật giữ evolution an toàn: **thêm, đừng tái sử dụng** (ý nghĩa của một cột là bản hợp đồng với mọi snapshot cũ); chỉ nới kiểu theo các hướng được hỗ trợ (int→bigint được; string→int là một cuộc migration, không phải evolution); và phối hợp với bản năng schema-registry của S07-P06 khi bảng được nuôi bằng CDC — evolution phải xảy ra ở *cả hai* đầu.

## 5. Vị trí trong platform của bạn

Bronze/silver/gold (S02-P05) sống *dưới dạng* chính các bảng này: bronze partition theo ngày load, silver merge theo key (hợp MoR), gold compact mạnh tay cho BI. Các engine — Spark (P07), DuckDB/Trino (S07-P08), các warehouse — cùng đọc chung một bộ file; format là bản hợp đồng biến "lối thoát trung lập engine" của S07-P03 từ khẩu hiệu thành sự thật cơ khí.

## Thực hành (25 phút — đo ba cơ chế, rồi bắt quả tang small files)

DuckDB ghi và đọc Parquet natively, nên mọi tuyên bố trong bài này đều đo được trong một phiên:

```sql
-- duckdb lake.db
CREATE TABLE events AS
SELECT (i % 1000)                                   AS customer_id,
       (i % 7)                                      AS channel,
       DATE '2026-01-01' + (i % 365)                AS event_date,
       repeat('x', 40)                              AS payload,
       ((i * 31) % 10000) / 100.0                   AS amount
FROM range(3000000) t(i);

-- 1. Cùng dữ liệu, hai định dạng — so kích thước trên đĩa
COPY events TO 'events.csv'     (FORMAT CSV);
COPY events TO 'events.parquet' (FORMAT PARQUET);
-- (ngoài shell) ls -lh events.csv events.parquet   ← encoding + nén, trước khi tinh chỉnh gì

.timer on
-- 2. Cắt cột: đọc một cột thay vì năm cột
SELECT sum(amount) FROM 'events.parquet';
SELECT count(*)    FROM 'events.parquet' WHERE payload LIKE 'x%';   -- chạm cột rộng

-- 3. Predicate pushdown hiệu quả trên dữ liệu ĐÃ SẮP — thống kê row-group bỏ qua cả block
COPY (SELECT * FROM events ORDER BY event_date) TO 'sorted.parquet' (FORMAT PARQUET);
SELECT count(*) FROM 'events.parquet' WHERE event_date = DATE '2026-06-15';
SELECT count(*) FROM 'sorted.parquet' WHERE event_date = DATE '2026-06-15';  -- đọc ít row group hơn

-- 4. CĂN BỆNH SMALL FILES, tái hiện có chủ đích
COPY (SELECT * FROM events) TO 'many' (FORMAT PARQUET, PARTITION_BY (customer_id));  -- 1000 file tí hon
COPY (SELECT * FROM events) TO 'few'  (FORMAT PARQUET, PARTITION_BY (channel));      -- 7 file khoẻ mạnh
SELECT sum(amount) FROM 'many/*/*.parquet';
SELECT sum(amount) FROM 'few/*/*.parquet';       -- cùng đáp án, phí mỗi-file ít hơn hẳn

-- 5. Bài thuốc: compaction chỉ là "đọc hết, ghi ít file hơn"
COPY (SELECT * FROM 'many/*/*.parquet') TO 'compacted.parquet' (FORMAT PARQUET);
SELECT sum(amount) FROM 'compacted.parquet';
```

Kết quả mong đợi: file Parquet nhỏ hơn CSV rất nhiều mà bạn không cấu hình gì — đó là encoding cộng nén trên dữ liệu dạng cột. Ở bước 2, tổng một cột hẹp nhanh hơn hẳn mọi query chạm cột `payload` rộng, vì các cột không đọc thì không hề được đọc. Bước 3 cho thấy vì sao "sắp xếp theo cột bạn hay lọc" là lời khuyên thật chứ không phải truyền miệng: thống kê theo row group cho phép bên đọc bỏ qua nguyên block, và chỉ dữ liệu đã sắp mới có block bỏ qua được. Bước 4 là thứ đáng nhớ — một nghìn file tí hon trả lời cùng câu hỏi chậm hơn hẳn bảy file tốt, và khoảng cách đó lớn dần theo mỗi partition bạn thêm vào. Bước 5 cho thấy bài thuốc chẳng hào nhoáng: đọc hết, ghi ít file hơn.

## Tự kiểm tra

1. Team bạn partition một bảng theo `customer_id` vì đa số query lọc theo cột đó. Sáu tháng sau query chậm và hoá đơn lưu trữ có những khoản metadata kỳ lạ. Chuyện gì đã xảy ra?
2. Vì sao một table format có thể cho commit nguyên tử trong khi object storage bên dưới chỉ cho "đặt object này"?
3. Đồng nghiệp đổi tên một cột trong bảng nền Parquet và các job hạ nguồn bắt đầu trả về null. Họ đã phạm luật nào?

<details><summary>Xem đáp án</summary>

1. Partition theo cột có lực lượng lớn: hàng nghìn khách nghĩa là hàng nghìn thư mục mỗi cái chứa file tí hon. Mỗi query trả phí mở từng file và liệt kê metadata, và phần đó nhấn chìm lợi ích của việc cắt bớt. Hãy partition theo cột lực-lượng-thấp mà bạn hay lọc (ngày, vùng, kênh) rồi *sắp xếp* bên trong theo cột lực-lượng-cao — cú sắp cho bạn khả năng bỏ qua mà không nổ tung số file.
2. Vì cú commit là một cú tráo con trỏ, không phải một cú ghi dữ liệu. Bên ghi tạo các file dữ liệu bất biến mới, rồi cập nhật nguyên tử một file metadata nhỏ trỏ sang snapshot mới. Bên đọc nhìn thấy hoặc snapshot cũ hoặc snapshot mới, không bao giờ thấy trạng thái ghi dở — tính nguyên tử nằm ở đúng cái con trỏ đó, và đó cũng là thứ khiến time travel gần như miễn phí.
3. Họ dùng lại hoặc xê dịch danh tính của một cột. Table format theo dõi cột bằng ID nội bộ, không theo tên hay vị trí, nên *thêm* cột thì an toàn còn đổi-tên-tại-chỗ hay tái dùng tên cũ sẽ âm thầm làm vỡ những bên đọc phân giải khác đi. Hãy thêm cột mới, backfill, chuyển bên đọc sang, rồi mới bỏ cột cũ.

</details>

## Điều cần nhớ

- Layout của Parquet chính là tốc độ của nó: column pruning, pushdown nhờ thống kê footer (sort theo cột filter!), và encoding đánh bại compression đơn thuần.
- Table format không bao giờ sửa file — chúng hoán đổi con trỏ snapshot một cách nguyên tử: đó là ACID, time travel, và delete kiểu CoW-vs-MoR trong cùng một cơ chế.
- Small files là căn bệnh của lakehouse: compaction định kỳ + snapshot expiration + ghi to hơn là vệ sinh bắt buộc, không phải tối ưu.
- Schema tiến hoá theo column ID (thêm, đừng tái sử dụng), và cùng bộ file phục vụ mọi engine — lối thoát là thật vì format là bản hợp đồng.

*Tiếp theo — Phần 10: Nền tảng streaming với Kafka.*
