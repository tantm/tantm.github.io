---
title: 'Data warehouse & kiến trúc medallion'
description: 'Hợp đồng giữa các lớp trong thực hành: một dataset orders đi trọn bronze → silver → gold, naming convention scale được, partitioning, và incremental model nói thật.'
date: 2026-07-31
category: Data
tags: [de-roadmap, warehouse, lakehouse, dbt]
lang: vi
translationKey: de-roadmap-05
series: de-roadmap
part: 5
---

S07-P03 giải thích medallion như một trường phái kiến trúc; S02-P04 trao cho bạn star schema. Phần này là nơi một DE thực thụ sinh sống: **thật sự xây các lớp** — mỗi lớp hứa gì, code gì chạy giữa chúng, và các convention giữ cho một warehouse 40 model còn điều hướng được thay vì thành di chỉ khảo cổ. Ta sẽ dắt một dataset (orders, dĩ nhiên) đi trọn con đường.

## Lớp là hợp đồng, không phải folder

Tên gọi medallion không quan trọng bằng thứ mỗi lớp *đảm bảo* với người đọc nó:

| Lớp | Hợp đồng | Rebuild? | Ai đọc |
|---|---|---|---|
| **Bronze** | Chính xác thứ đã đến, lúc nó đến — kèm metadata của lượt load | **Không bao giờ** — nó là bằng chứng | Chỉ pipeline & người debug |
| **Silver** | Đã ép kiểu, đã dedup, một dòng mang một nghĩa; entity đã conform | Bất cứ lúc nào, từ bronze | DE + analyst cứng |
| **Gold** | Định nghĩa business đã áp; star schema & metric (tay nghề S02-P04 sống ở đây) | Bất cứ lúc nào, từ silver | BI, ML, tất cả |

Hai hệ quả của việc nghĩ "hợp đồng" thay vì "folder". Một, bảng thuộc lớp nào được quyết bởi *lời đảm bảo của nó*, không phải bởi phép biến đổi nào sinh ra nó. Hai, **cột rebuild chính là toàn bộ kế hoạch disaster-recovery**: bronze bất biến + mọi thứ khác dẫn xuất nghĩa là con bug pipeline tệ nhất chỉ tốn của bạn một lần chạy lại, không tốn dữ liệu (idempotency của S02-P03, giờ ở quy mô platform).

## Bronze: đáp thô, đóng dấu kỹ

Toàn bộ kỹ năng của bronze là sự kiềm chế — cộng metadata:

```sql
-- bronze.orders_raw : các cột Y NHƯ LÚC ĐẾN (toàn string cũng được), cộng thêm:
_loaded_at        timestamp,   -- ingest lúc nào
_source_file      text,        -- đến từ đâu
_batch_id         text         -- lượt chạy nào sở hữu (key ghi đè idempotent)
```

Không đổi tên, không sửa kiểu, không "dọn nhẹ" — mỗi cú sửa bạn áp vào bronze là một mẩu bằng chứng bị tiêu huỷ (khi một con số ở silver trông sai, bronze là cách bạn biết source nói dối hay transform của mình nói dối). Quyết định cấu trúc duy nhất quan trọng ở đây là **partitioning**: tổ chức vật lý theo ngày load (`_loaded_at`), để một lượt chạy sở hữu "một ngày" ghi đè đúng lát cắt của nó, và query quét "tuần trước" chạm 7 partition thay vì 7 năm — món lãng phí quét-không-partition trong catalog S07-P12 chết ngay tại quyết định này.

## Silver: nơi niềm tin được sản xuất

Silver là lớp nhiều code thật nhất. Các nước đi lặp lại, theo thứ tự kinh điển:

1. **Cast & rename** — string thành kiểu (`amount_cents int`, không phải float — luật tiền bạc), `cryptic_col_7` của source thành `order_status`.
2. **Dedup** — pattern window của S02-P02 (`ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY _loaded_at DESC)`), giữ phiên bản mới nhất của mỗi business key. Có CDC feed (S07-P06) thì bước này hết là tuỳ chọn: cùng một đơn *chắc chắn sẽ* đến năm lần.
3. **Conform entity** — customer và product nhận surrogate key và chế độ SCD tại đây (S02-P04), để mọi fact hạ nguồn đồng thuận ai là ai.
4. **Cổng chất lượng** — các check nhàm chán page bạn *trước khi* CEO page: key not-null, status nằm trong tập cho phép, số dòng trong khoảng kỳ vọng (chính thức hoá ở S02-P12; ngày nay khai thành dbt test).

Naming convention scale được: `stg_<source>__<entity>` cho staging hình-source, `int_<động từ>_<entity>` cho intermediate tái dùng, và mỗi file model mở đầu bằng câu grain của nó (thói quen S02-P04, enforce bằng áp lực xã hội trong review).

## Gold: business logic có đúng một mái nhà

Gold là star schema (P04) cộng **định nghĩa metric** — và một luật có răng: **một quy tắc business được định nghĩa một lần, ở gold, không bao giờ ở dashboard**. Cái ngày "doanh thu" bị tính hơi khác nhau ở ba BI tool là cái ngày platform thua cuộc chiến niềm tin, bất kể pipeline tốt cỡ nào. Stack hiện đại đẩy ý này xa hơn vào semantic layer, nhưng kỷ luật vẫn vậy: một định nghĩa, một owner, mọi nơi tham chiếu.

```sql
-- gold.fct_orders : grain = một dòng hàng của đơn
SELECT
    o.order_line_id,
    c.customer_key,           -- surrogate, resolve SCD2 theo thời điểm bán (P04)
    d.date_key,
    o.quantity,
    o.amount_cents,
    o.amount_cents - o.cost_cents AS margin_cents   -- định nghĩa TẠI ĐÂY, chỉ tại đây
FROM silver.orders o
JOIN gold.dim_customer c ON ...
```

## Incremental, nói thật

Rebuild-toàn-bộ-mỗi-đêm bị đánh giá thấp — nó tự lành và đơn giản; cứ chạy chừng nào con số còn cho phép. Khi bảng lớn vượt ngưỡng, **incremental model** chỉ xử lý lát cắt mới:

```sql
-- incremental kiểu dbt: chỉ xử lý phần mới đến
{{ config(materialized='incremental', unique_key='order_line_id') }}
SELECT ... FROM {{ ref('stg_shop__orders') }}
{% if is_incremental() %}
WHERE _loaded_at > (SELECT max(_loaded_at) FROM {{ this }})
{% endif %}
```

Hai chi phí thật, khai trước: **dữ liệu đến muộn** (một đơn đáp trễ ba ngày sẽ lọt lưới cái `WHERE` ngây thơ — cách sửa chuẩn là *lookback*: mỗi lượt chạy xử lý lại N ngày đuôi, một cách idempotent), và **drift** (trạng thái incremental có thể lặng lẽ lệch khỏi thứ một cú full rebuild sẽ tạo ra — xếp lịch full refresh định kỳ làm dây bẫy). Incremental là tối ưu hiệu năng *đặt trên* một thiết kế full-rebuild idempotent — không bao giờ là thứ thay thế nó.

## Dataset orders, đầu-cuối

`bronze.orders_raw` (y-như-đến, partition theo ngày load) → `stg_shop__orders` (ép kiểu, dedup, qua cổng chất lượng) → join `dim_customer` / `dim_product` (SCD2) → `fct_orders` (một dòng mỗi line, measure cộng được, margin định nghĩa một lần) → BI chỉ đọc gold. Mỗi mũi tên là một job chạy-lại-được sở hữu một lát cắt có ngày; mỗi bảng khai grain của nó; và cái DAG xếp thứ tự các mũi tên này chính xác là thứ Phần 8 (Airflow) sẽ lập lịch.

## Điều cần nhớ

- Lớp là hợp đồng: bronze = bằng chứng (không bao giờ rebuild), silver = nhà máy sản xuất niềm tin, gold = định nghĩa business với đúng một mái nhà.
- Partition bronze theo ngày load — nó đồng thời là key idempotency, máy tăng tốc query, và van khống chế chi phí.
- Kinh điển của silver: cast → dedup (pattern window) → conform (SCD) → cổng chất lượng; đặt tên model sao cho nhìn tên thấy lớp.
- Incremental là tối ưu trên nền thiết kế full-rebuild idempotent — kèm lookback cho dữ liệu muộn và full refresh định kỳ làm dây bẫy drift.

*Tiếp theo — Phần 6: ETL vs ELT: xây batch pipeline đáng tin.*
