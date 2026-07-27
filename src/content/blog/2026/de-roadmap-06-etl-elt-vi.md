---
title: 'ETL vs ELT: xây batch pipeline đáng tin'
description: 'Watermark khi extract, ba pattern load, backfill như một nghiệp vụ hạng nhất, và bảng phân loại lỗi cho biết cái gì nên retry — độ tin cậy pipeline như một tay nghề.'
date: 2026-08-01
category: Data
tags: [de-roadmap, etl, pipeline, data-engineer]
lang: vi
translationKey: de-roadmap-06
series: de-roadmap
part: 6
---

Phần 3 và 5 trao cho bạn nguyên liệu — script idempotent, bảng phân lớp. Phần này lắp chúng thành thứ bạn sẽ thật sự vận hành: **một batch pipeline chạy không người trông trong nhiều tháng**. Cuộc tranh luận ETL-vs-ELT tốn mười phút; tay nghề về extract pattern, load pattern, backfill và ngữ nghĩa retry tốn phần còn lại — và chính là thứ tách pipeline hay page bạn khỏi pipeline không page.

## ETL vs ELT, giải quyết nhanh

**ETL** transform dữ liệu *trước khi* load (trong tool pipeline); **ELT** load thô trước, transform *bên trong* warehouse bằng SQL (bronze-rồi-silver của S02-P05 chính là nó). ELT thắng vị trí mặc định vì ba lẽ: compute warehouse thành rẻ và đàn hồi, thô-trước giữ được bằng chứng debug (bronze!), và transform bằng SQL thì test được, version được dưới dạng dbt model. Các ngoại lệ thật thà nơi chữ T vẫn đi trước: **masking/tokenize PII bắt buộc xảy ra trước khi dữ liệu đáp** (zoning của S07-P10 — đôi khi luật bảo transform trước), parse phi cấu trúc nặng, và bóp các payload rộng phi lý ngay tại rìa. Luật: *ELT mặc định; ETL nơi compliance hoặc vật lý đòi hỏi.* Xong — giờ vào tay nghề.

## Extract: watermark là cả cuộc chơi

Full extract (chép nguyên bảng mỗi đêm) bị đánh giá thấp — tự lành và đơn giản; giữ nó chừng nào kích thước còn cho phép (bản năng full-rebuild của P05). Khi bảng vượt cỡ, bạn extract **incremental**, và toàn bộ gánh nặng đúng-đắn rơi vào một khái niệm — **watermark**:

```python
# Bản hợp đồng watermark:
last = read_watermark("orders")                    # vd 2026-07-30T02:00:00
rows = extract(f"updated_at > '{last}' AND updated_at <= '{now}'")  # cửa sổ đóng
load(rows)
write_watermark("orders", now)                     # CHỈ tiến watermark sau khi load thành công
```

Ba cách nó hỏng là ba sự cố kinh điển: tiến watermark *trước khi* load thành công (crash = mất cả cửa sổ trong im lặng), dùng `created_at` khi dòng bị *update* (các cú sửa không bao giờ được extract lại — dùng `updated_at`, và chắc chắn source thật sự duy trì nó), và lệch đồng hồ / commit muộn ở mép cửa sổ (fix chuẩn: chồng lấn cửa sổ vài phút và nhờ load idempotent hấp thụ trùng lặp). Để ý chủ đề: watermark cộng load idempotent bằng đúng *hiệu ứng* exactly-once trên bộ máy at-least-once — cùng mánh mà S07-P06 làm với CDC, ở nhịp batch.

## Load: ba pattern, một bảng quyết định

| Pattern | Cách | Khi nào |
|---|---|---|
| **Overwrite partition** | Xoá-và-ghi-lại lát cắt lượt chạy này sở hữu | Mặc định cho fact (luật P03: mỗi run sở hữu ngày của nó) |
| **Merge / upsert** | Khớp business key, update-hoặc-insert | Dimension, CDC feed, dòng mutable đến muộn |
| **Append-only** | Cứ thêm dòng | Event bất biến *kèm* dedup hạ nguồn (window silver của P05) |

Anti-pattern là append mù dữ liệu *mutable* — sự cố số-nhân-đôi mà mọi data team trải qua đúng một lần, rất to tiếng. Và dù dùng pattern nào, hãy làm cú ghi **nguyên tử**: stage vào bảng/prefix tạm, rồi swap — để crash giữa chừng còn nguyên dữ liệu cũ thay vì nửa nọ nửa kia (bất biến bronze của Phần 5 cộng bài học SIGKILL của CS-P5, gộp lại).

## Backfill: nghiệp vụ hạng nhất, không phải tình huống khẩn cấp

Mọi pipeline rồi sẽ cần xử lý lại lịch sử — một bug được sửa, một cột được thêm, một source được đính chính. Team coi backfill là tình huống khẩn cấp sẽ ứng biến nó một cách tồi tệ vào thời điểm tệ nhất. Thiết kế nó từ ngày đầu:

- **Cùng một job chạy được mọi ngày**: vì run tham số hoá bằng `--run-date` (P03) và sở hữu partition của nó (P05), backfill chỉ là một vòng lặp qua các ngày — không code path đặc biệt, nghĩa là không có gì chưa-từng-test.
- **Song song có chặn trên**: backfill 3 năm = ~1.100 run độc lập; chạy 10 con một lượt, đừng 1 (mất nhiều tuần) cũng đừng 1.100 (giết source).
- **Bảo vệ source**: extract cho backfill nên đánh vào bronze/replica, không bao giờ nện OLTP production (lý do bronze *giữ* tất cả).
- **Thông báo và kiểm chứng**: consumer hạ nguồn sẽ thấy số nhúc nhích; một cú đối soát row-count/tổng trước-vs-sau (kỷ luật S07-P13, bản thu nhỏ) biến "backfill có ổn không?" từ cảm giác thành bằng chứng.

## Bảng phân loại lỗi: cái gì retry, cái gì đánh thức con người

Bộ xử lý lỗi của pipeline nên phân mọi thất bại vào một trong ba rọ:

1. **Transient** (mạng chớp, S3 503, lock timeout) → **tự retry** với backoff; đây là lý do exit code (P03) và retry của orchestrator (P08) tồn tại. Đa số các cú page 2 giờ sáng đáng lẽ không xảy ra là transient chưa được retry.
2. **Lỗi dữ liệu** (schema drift từ source, file không parse nổi, vỡ cổng chất lượng) → **fail nhanh và to, đừng retry** — retry một file hỏng 5 lần chỉ trì hoãn cái alert. Cách ly input xấu (một prefix `_rejected/`), đi tiếp hay dừng tuỳ mức nặng, page kèm *tên file*.
3. **Bug logic** (transform của bạn sai) → không tự động nào cứu nổi; đây là chỗ hợp đồng lớp của P05 và check chất lượng P12 phục vụ — phát hiện, rồi một cú fix cộng backfill (xem trên; giờ nó là việc thường quy rồi, nhớ chứ?).

Chữ ký của một pipeline trưởng thành không phải là không bao giờ fail — mà là mỗi cú fail tự rơi vào đúng rọ.

## dbt ngồi đâu trong tất cả

dbt sở hữu **chữ T của ELT**: các model SQL với dependency `ref()` (cái DAG), test dạng config, docs tự sinh. Nó *không* extract, không load, không lập lịch — phần EL là các job kiểu P03 hoặc một tool ingestion, và chiếc đồng hồ là orchestrator của Phần 8, chạy EL rồi `dbt run` rồi `dbt test` như một chuỗi phụ thuộc. Giữ thẳng ranh giới này ("dbt là tầng transform, không phải cái pipeline") chặn được cả cú đòi-hỏi-quá (dbt không fetch API giùm bạn) lẫn cú dùng-thiếu (logic transform vương vãi trong Python trong khi đáng lẽ là SQL model test được).

## Điều cần nhớ

- ELT mặc định (compute rẻ + bằng chứng bronze + SQL test được); ETL sống ở nơi compliance hay vật lý đòi transform-trước.
- Extract incremental sống chết theo watermark: cửa sổ đóng, chỉ tiến sau thành công, `updated_at` chứ không `created_at`, chồng lấn + load idempotent cho phần mép.
- Load là overwrite-partition, merge, hoặc append(+dedup) — luôn stage-rồi-swap; append mù dữ liệu mutable là sự cố số-nhân-đôi.
- Backfill là nghiệp vụ được thiết kế (run tham số hoá, song song có chặn, kiểm chứng bằng đối soát); lỗi phân ba rọ: transient (retry), dữ liệu (cách ly, không retry), logic (fix + backfill).

*Tiếp theo — Phần 7: Apache Spark: khi pandas không còn đủ.*
