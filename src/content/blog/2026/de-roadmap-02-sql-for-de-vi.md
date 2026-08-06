---
title: 'SQL cho Data Engineer: vượt khỏi SELECT'
description: 'Bốn kỹ năng SQL gánh cả sự nghiệp data engineering: JOIN đáng tin, window functions, CTE, và pattern aggregation — kèm các bẫy kinh điển.'
date: 2026-07-28
category: Data
tags: [de-roadmap, sql, database]
lang: vi
translationKey: de-roadmap-02
series: de-roadmap
cover: images/s02-p02-hero.png
part: 2
---

Một sự thật mất lòng: senior không "vượt qua" SQL — họ viết SQL *nhiều hơn*, trên dữ liệu lớn hơn, với rủi ro cao hơn. SQL là ngôn ngữ duy nhất mà mọi warehouse, lakehouse và công cụ BI đều đồng thuận. Phần này nói về bốn kỹ năng biến "em biết SQL" thành "SQL của em tin được": join, window functions, CTE, và pattern aggregation.

## Bạn sẽ học được gì

- Viết JOIN không bao giờ lặng lẽ nhân đôi hay làm rơi hàng.
- Dùng 3 pattern window function phủ đa số công việc DE hằng ngày.
- Cấu trúc query phức tạp bằng CTE để đồng đội đọc được.
- Chọn đúng giữa WHERE, HAVING, FILTER mà không đoán mò.

**Cần biết trước:** SELECT/WHERE/GROUP BY cơ bản. Bài 1 để biết SQL nằm đâu trong lộ trình.

Mọi ví dụ dùng schema shop generic: `orders(id, customer_id, status, amount, created_at)` và `customers(id, name, country)`.

## 1. JOIN đáng tin

Ai cũng biết `INNER JOIN` vs `LEFT JOIN`. Data engineer thường bị đốt bởi hai thứ tinh vi hơn:

**Fan-out.** Join sang bảng quan hệ một-nhiều là số dòng nhân lên:

```sql
-- Trông vô hại; nhân đôi doanh thu với khách có 2+ đơn
SELECT c.id, SUM(o.amount)
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id;
-- Vẫn ổn. Nhưng thêm join một-nhiều THỨ HAI (vd payments) vào cùng query
-- là SUM(o.amount) lặng lẽ bị nhân lên. Aggregate từng phía TRƯỚC, rồi mới join.
```

Quy tắc bỏ túi: **aggregate trước khi join** khi ghép hai quan hệ một-nhiều. Con số tổng nào trông "to bất thường" — nghi fan-out trước tiên.

**Logic NULL trong anti-join.** "Khách chưa có đơn nào":

```sql
-- Bẫy: trả về KHÔNG dòng nào nếu orders.customer_id có bất kỳ NULL
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);

-- An toàn và thân thiện với optimizer
SELECT c.* FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

`NOT IN` + một `NULL` duy nhất = kết quả rỗng, không lỗi, không cảnh báo. `NOT EXISTS` là anti-join của người chuyên nghiệp.

## 2. Window functions: siêu năng lực

Window function tính toán trên các dòng liên quan **mà không gộp chúng lại**. Ba pattern phủ 90% nhu cầu thật:

**Dòng mới nhất mỗi nhóm** — query được viết nhiều nhất của nghề DE:

```sql
SELECT * FROM (
  SELECT o.*,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
  FROM orders o
) t
WHERE rn = 1;   -- đơn hàng gần nhất của từng khách
```

Đây cũng là cách **dedup**: partition theo business key, order theo "bản nào thắng", giữ `rn = 1`.

**Luỹ kế (running total):**

```sql
SELECT created_at::date AS day,
       SUM(amount) OVER (ORDER BY created_at::date) AS revenue_to_date
FROM orders;
```

**So với dòng liền trước** (`LAG`) — tốc độ tăng trưởng, khoảng cách giữa sự kiện, tách session:

```sql
SELECT customer_id, created_at,
       created_at - LAG(created_at) OVER (PARTITION BY customer_id ORDER BY created_at) AS gap
FROM orders;
```

Mental model: `PARTITION BY` = so với ai; `ORDER BY` = dòng thời gian; frame = nhìn xa tới đâu. Nếu chỉ học sâu một thứ từ bài này, hãy chọn window functions — chúng thay thế hàng trang self-join xiếc.

## 3. CTE: SQL đọc như đoạn văn

Mệnh đề `WITH` (CTE) đặt tên cho từng bước logic:

```sql
WITH monthly AS (
  SELECT date_trunc('month', created_at) AS month, SUM(amount) AS revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY 1
),
with_growth AS (
  SELECT month, revenue,
         revenue - LAG(revenue) OVER (ORDER BY month) AS growth
  FROM monthly
)
SELECT * FROM with_growth WHERE growth < 0;   -- những tháng đi lùi
```

So với cùng logic viết bằng subquery lồng nhau — bản CTE đọc từ trên xuống như văn xuôi. Điều này quan trọng hơn vẻ ngoài: **trong data team, SQL được đọc nhiều gấp 10 lần được viết** — lúc code review, lúc debug 2 giờ sáng, lúc trả lời "con số này từ đâu ra?". Các model dbt về bản chất là CTE được thăng cấp thành file.

Một lưu ý: ở vài engine, CTE dùng hai lần có thể bị tính hai lần. CTE nào đắt và tái dùng — kiểm tra hành vi engine bằng `EXPLAIN` (Phần 8 của series SQL Mastery sẽ đào sâu).

## 4. Pattern aggregation

Hai chiêu xuất hiện trong gần như mọi report thật:

**Conditional aggregation** — pivot mà không cần pivot:

```sql
SELECT customer_id,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
       SUM(amount) FILTER (WHERE status = 'completed') AS revenue
FROM orders
GROUP BY customer_id;
-- Engine không có FILTER: SUM(CASE WHEN status = 'completed' THEN amount END)
```

**WHERE vs HAVING** — lọc dòng trước khi gộp, lọc nhóm sau khi gộp:

```sql
SELECT customer_id, SUM(amount) AS total
FROM orders
WHERE status = 'completed'      -- dòng trước
GROUP BY customer_id
HAVING SUM(amount) > 1000;      -- nhóm sau
```

Đặt điều kiện dòng vào `HAVING` cho đáp án đúng với chi phí gấp 10; đặt điều kiện nhóm vào `WHERE` thì lỗi — hoặc tệ hơn, một query sai mà bạn sửa mò tới khi nó "chạy".

## Thực hành (30 phút)

- Dựng lại mọi ví dụ trên PostgreSQL nháp (một lệnh `docker run postgres` là có).
- Lấy một con số trên dashboard ở công ty và tái tạo nó từ bảng raw — bạn sẽ gặp fan-out, NULL và nỗi đau timezone trong cùng một bài tập.
- Đọc query plan thường xuyên (`EXPLAIN`) kể cả khi chưa hiểu hết từng node; độ quen thuộc sinh lãi kép.

## Tự kiểm tra

1. Bạn join `orders` với bảng `payments` và tổng doanh thu tăng gấp đôi. Chuyện gì xảy ra, và phép chẩn đoán 10 giây là gì?
2. `WHERE`, `HAVING`, `FILTER` — cái nào chạy trước grouping, cái nào sau, cái nào aggregate có điều kiện?
3. Khi nào `ROW_NUMBER()` thắng `GROUP BY` cho bài "bản ghi mới nhất mỗi khách hàng"?

<details><summary>Xem đáp án</summary>

1. Fan-out: một số order có nhiều dòng payment, nên mỗi dòng order bị nhân bản theo số payment. Chẩn đoán: so `COUNT(*)` trước và sau join — tăng nghĩa là fan-out; sửa bằng cách pre-aggregate payments về một dòng mỗi order.
2. `WHERE` lọc hàng trước grouping; `HAVING` lọc group sau aggregation; `FILTER (WHERE ...)` aggregate có điều kiện trong một lượt quét.
3. Khi cần trọn bộ dòng mới nhất (mọi cột), không chỉ một con số: `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC)` rồi `WHERE rn = 1` — GROUP BY chỉ cho max timestamp, không cho cái dòng sở hữu nó.

</details>

## Điều cần nhớ

- Aggregate trước khi join khi hai quan hệ một-nhiều gặp nhau — fan-out lặng lẽ thổi phồng số tổng.
- Dùng `NOT EXISTS`, đừng bao giờ `NOT IN`, cho anti-join — một NULL là rỗng cả kết quả.
- Window functions (mới-nhất-mỗi-nhóm, luỹ kế, `LAG`) thay thế hàng trang giải pháp vòng vo — đáng học sâu nhất.
- CTE làm SQL đọc như văn xuôi, mà SQL thì được đọc nhiều hơn được viết rất nhiều.

*Tiếp theo — Phần 3: Python cho Data Engineer: bộ đồ nghề thực chiến.*
