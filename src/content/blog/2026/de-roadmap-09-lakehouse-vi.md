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

## Bên trong Parquet: vì sao columnar thắng

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

## Table format: ACID phù phép từ object bất biến

Ràng buộc từ S04-P04: object không sửa được, chỉ thay thế được. Vậy lakehouse `UPDATE` một hàng kiểu gì? **Nó không update — nó ghi file mới và thay đổi *ý nghĩa* của bảng:**

- Sự thật của bảng nằm ở **tầng metadata**: một log các snapshot, mỗi snapshot = "bảng chính xác là danh sách các data file này."
- Một lần ghi (append, update, delete) tạo ra các file Parquet *mới* cộng một snapshot *mới* trỏ tới danh sách file mới. Cú **commit** là một lần hoán đổi nguyên tử duy nhất của con trỏ current-snapshot.
- Reader ghim một snapshot khi bắt đầu — họ thấy một bảng nhất quán ngay cả giữa lúc đang ghi (ACID trong bảng của S07-P03, giải thích bằng cơ khí). **Time travel** giờ trở nên hiển nhiên: snapshot cũ vẫn liệt kê file cũ; query nó thôi.
- Delete có hai vị đáng biết: **copy-on-write** (ghi lại các file bị ảnh hưởng — ghi chậm hơn, đọc nhanh nhất) vs **merge-on-read** (ghi các "delete file" nhỏ; reader trừ chúng ra — ghi nhanh, đọc chịu thuế cho tới khi compaction). Bảng nặng streaming nghiêng về MoR; bảng batch-analytics nghiêng về CoW.

Iceberg và Delta khác nhau ở hệ sinh thái và chi tiết, không phải ở thiết kế lõi này. Lựa chọn thực dụng năm 2026: **format nào mà engine/platform chính của bạn coi là native** — khái niệm chuyển giao trọn vẹn, và các engine ngày càng đọc được cả hai.

## Căn bệnh small files

Căn bệnh production phổ biến nhất của lakehouse. Writer streaming (CDC của S07-P06) và các job song song quá đà (nghìn partition tí hon của S02-P07) mỗi lần commit vài file bé xíu; một năm sau, một "bảng" là hai triệu object 200 KB — và mỗi query trả hai triệu request S3 (luật ít-request-to-hơn của S04-P04, bị vi phạm ở quy mô lớn) cộng chi phí đọc footer còn nặng hơn cả dữ liệu.

Các phương thuốc, tất cả đều nhàm chán và tất cả đều bắt buộc:

- **Compaction** — định kỳ ghi lại các file nhỏ thành file cỡ ~128 MB–1 GB. Mọi table format đều ship sẵn thủ tục bảo trì này; *hãy lập lịch cho nó* (một DAG Airflow, S02-P08) — nó không tự chạy.
- **Snapshot expiration** — mỗi commit giữ mọi file cũ để time travel với tới được; hãy expire snapshot cũ và xoá file mồ côi, không thì storage tăng đơn điệu mãi (bài học hoá đơn versioning của S07-P12, phiên bản table format). Retention ở đây cũng chính là đòn bẩy compliance S07-P10 của bạn — expire một snapshot mới là lúc dữ liệu thật sự *bị xoá*.
- **Ghi to hơn** — sửa từ phía producer: gom commit streaming theo lô (mỗi N phút, không phải mỗi message), chỉnh đúng cỡ output partition của Spark trước khi ghi.

Một lakehouse không có bảo trì định kỳ không phải lakehouse; nó là một cái swamp với marketing tốt hơn. Hãy đưa DAG bảo trì vào ngân sách ngay ngày bạn tạo bảng đầu tiên.

## Schema evolution không nước mắt

Table format theo dõi cột bằng **ID, không phải tên** — đó là lý do `ALTER TABLE ADD COLUMN`, rename, và nới rộng kiểu là các thao tác chỉ-metadata (không ghi lại dữ liệu) và lý do file cũ vẫn đọc được: cột thiếu đọc ra null. Các kỷ luật giữ evolution an toàn: **thêm, đừng tái sử dụng** (ý nghĩa của một cột là bản hợp đồng với mọi snapshot cũ); chỉ nới kiểu theo các hướng được hỗ trợ (int→bigint được; string→int là một cuộc migration, không phải evolution); và phối hợp với bản năng schema-registry của S07-P06 khi bảng được nuôi bằng CDC — evolution phải xảy ra ở *cả hai* đầu.

## Vị trí trong platform của bạn

Bronze/silver/gold (S02-P05) sống *dưới dạng* chính các bảng này: bronze partition theo ngày load, silver merge theo key (hợp MoR), gold compact mạnh tay cho BI. Các engine — Spark (P07), DuckDB/Trino (S07-P08), các warehouse — cùng đọc chung một bộ file; format là bản hợp đồng biến "lối thoát trung lập engine" của S07-P03 từ khẩu hiệu thành sự thật cơ khí.

## Điều cần nhớ

- Layout của Parquet chính là tốc độ của nó: column pruning, pushdown nhờ thống kê footer (sort theo cột filter!), và encoding đánh bại compression đơn thuần.
- Table format không bao giờ sửa file — chúng hoán đổi con trỏ snapshot một cách nguyên tử: đó là ACID, time travel, và delete kiểu CoW-vs-MoR trong cùng một cơ chế.
- Small files là căn bệnh của lakehouse: compaction định kỳ + snapshot expiration + ghi to hơn là vệ sinh bắt buộc, không phải tối ưu.
- Schema tiến hoá theo column ID (thêm, đừng tái sử dụng), và cùng bộ file phục vụ mọi engine — lối thoát là thật vì format là bản hợp đồng.

*Tiếp theo — Phần 10: Nền tảng streaming với Kafka.*
