---
title: 'Database: 20% kiến thức gánh 80% công việc'
description: 'Vì sao relational model mãi không chịu chết, index thật sự tìm dòng của bạn thế nào, transaction hứa gì kèm chữ nhỏ, và đọc query plan đầu tiên.'
date: 2026-08-01
category: Developer
tags: [cs-foundations, database, sql]
lang: vi
translationKey: cs-foundations-07
series: cs-foundations
cover: images/s01-p07-hero.png
part: 7
---

Mọi ứng dụng bạn từng chạm vào, tận lõi, là một bộ trang phục cầu kỳ khoác lên một database. Trạng thái của business — ai đã trả tiền, ai đã đăng ký, kho còn gì — sống ở đó; mọi thứ khác đều dựng lại được. Phần này là 20% kiến thức database bền vững: bản hợp đồng thật của relational model, index như một sự thật vật lý, transaction như lời hứa kèm chữ nhỏ, và query plan — database tự giải thích chính nó cho bạn.

## Bạn sẽ học được gì

- Giải thích được vì sao relational model sống dai hơn mọi chu kỳ "SQL chết rồi".
- Suy luận về index bằng con mắt vật lý: vì sao thứ tự cột quan trọng và cái gì giết index trong im lặng.
- Đọc execution plan đủ để biết index có đang được dùng hay không.
- Tính cỡ connection pool bằng số học thay vì bằng hy vọng.

**Cần biết trước:** Phần 3 (hash map, B-tree) có ích nhưng không bắt buộc. Giả định bạn biết SQL cơ bản.

## 1. Vì sao relational model mãi không chịu chết

Năm mươi tuổi và vẫn là mặc định, vì hai lý do không phải hoài niệm:

- **Query khai báo.** SQL nói *cái gì* bạn muốn; optimizer của database quyết *bằng cách nào* — đường truy cập nào, thứ tự join nào, index nào. Bạn đang uỷ quyền cho một planner có năm mươi năm engineering đứng sau (đây cũng là lý do phân tích Big-O trên code của chính bạn, Phần 4, hầu như không áp vào SQL — cái plan, không phải câu chữ query, quyết định khối lượng việc).
- **Constraint là lời đảm bảo.** Primary key, foreign key, `NOT NULL`, `UNIQUE` — schema *từ chối* dữ liệu xấu ngay cửa. Constraint là bài test rẻ nhất bạn từng viết: chạy trên mọi cú ghi, mãi mãi, và không thể bị bỏ qua lúc vội (ý type-ở-biên-giới của S02-P03, được chính engine enforce).

NoSQL không giết được điều này; nó khoét các ngách nơi trade-off khác đi (S04-P06 tuần tới). Mặc định vẫn thế: **phân vân thì chọn relational.**

## 2. Index, nhìn bằng con mắt vật lý

Phần 3 giới thiệu B-tree; đây là trực giác làm việc cần giữ. Không index, `WHERE email = 'x'` đọc *mọi dòng* — full scan, tuyến tính theo cỡ bảng (thói quen Phần 4: chuyện gì xảy ra ở 100×?). Có index trên `email`, database đi bộ trên một cái cây bè và nông: ba bốn lần đọc page thay vì một triệu.

Phần chữ nhỏ biến điều này từ trivia thành kỹ năng:

- **Index không miễn phí.** Mỗi cú ghi phải cập nhật mọi index — bảng thừa index khiến insert bò. Index theo thứ bạn *query*, đừng index tất cả.
- **Thứ tự cột là bản hợp đồng**: index trên `(customer_id, created_at)` phục vụ "đơn gần đây của khách này" tuyệt đẹp, và *vô dụng* cho query chỉ lọc `created_at` (cây được sắp theo customer trước — dải băng của Phần 3, đi từ đầu sai).
- **Hàm phá index**: `WHERE lower(email) = 'x'` không dùng được index thường trên `email` — giá trị lưu trong cây đâu có lowercase. Hoặc index theo biểu thức, hoặc lưu đã chuẩn hoá (ý "sargability" mà SQL Mastery sẽ luyện kỹ).
- Trang phục của database cho vụ này: primary key tự động có index; foreign key thường *không* — cú join chậm bất ngờ kinh điển.

## 3. Transaction: lời hứa và phần chữ nhỏ

Transaction gói các cú ghi thành được-ăn-cả-ngã-về-không (ví dụ Phần 2: tiền rời tài khoản này *và* đến tài khoản kia). ACID, giải mã thật thà:

- **A**tomicity — tất cả hoặc không gì, kể cả xuyên qua một cú crash.
- **C**onsistency — constraint đúng trước và sau.
- **D**urability — đã commit nghĩa là *nằm trên disk*, sống sót mất điện (thế giới fsync của Phần 5).
- **I**solation — phần chữ nhỏ. Cách ly tuyệt đối ("như thể các transaction chạy lần lượt") rất đắt, nên database mặc định ở mức yếu hơn, và các transaction đồng thời có thể nhìn thấy thế giới của nhau theo những cách gây bất ngờ.

Một luật làm việc chặn được đa số bug đồng thời mà không cần học thuộc các isolation level: **biến kiểm-tra-rồi-ghi thành nguyên tử**. `SELECT balance` rồi `UPDATE` trong code app là một cuộc đua (hai request cùng đọc 100, cùng duyệt lệnh rút 100 — race condition của Phần 8, mặc áo database). Dạng nguyên tử đẩy phép kiểm vào chính cú ghi:

```sql
UPDATE accounts SET balance = balance - 100
WHERE id = 42 AND balance >= 100;   -- 0 dòng được update = không đủ số dư
```

Một câu lệnh, engine enforce, không đua. Học thêm `SELECT ... FOR UPDATE` cho các ca nhiều bước; chỉ đụng tới chỉnh isolation level khi hai món kia đã cạn.

## 4. Query plan: database tự giải thích

`EXPLAIN` (và `EXPLAIN ANALYZE` để chạy thật) in ra chiến lược optimizer đã chọn. Ngày đầu không cần đọc hiểu từng node — ba cú liếc đã lấy 80% giá trị:

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 10;
-- Tìm:
--   "Index Scan using idx_orders_customer"  ← tốt: cú đi bộ trên cây
--   "Seq Scan on orders"                    ← đọc cả bảng; bảng bé thì kệ, bảng to là sự cố
--   rows=1063 (actual rows=2)               ← ước lượng lệch xa thực tế → statistics cũ, plan tồi
```

Vòng lặp debug cho "query này chậm" vì thế thuần cơ học: EXPLAIN → phát hiện Seq Scan trên bảng to → kiểm xem index có tồn tại và *dùng được* không (thứ tự cột? hàm bọc cột?) → sửa → EXPLAIN lại. Cái vòng nhỏ này, chạy vài chục lần, chính là cách trực giác database được xây nên.

## 5. Connection là file descriptor có cảm xúc

Một ghi chú hệ thống cứu được sự cố thật: connection database đắt ở *cả hai* đầu (fd của Phần 5 ở phía bạn, memory và process state ở phía nó — và Postgres có trần cứng `max_connections`). Từ đó sinh pattern phổ quát: **connection pool** — một nhóm nhỏ connection sống lâu, mượn rồi trả. Cú outage kinh điển mà điều này giải thích: autoscale bung 40 app instance × 20 connection mỗi con = database từ chối connection thứ 801, và cái alert "database sập" thực ra là một bài toán số học.

## Thực hành (25 phút — làm index hiện ra trong plan, rồi giết nó)

SQLite là đủ (`sqlite3 lab.db`) — output plan gọn hơn Postgres nhưng bài học y hệt. Mỗi bước kết thúc bằng một khác biệt quan sát được:

```sql
CREATE TABLE orders(id INTEGER PRIMARY KEY, customer_id INT, status TEXT, created_at TEXT, amount REAL);
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 200000)
INSERT INTO orders SELECT n, n % 5000, CASE n % 3 WHEN 0 THEN 'shipped' ELSE 'pending' END,
       date('2026-01-01', '+' || (n % 365) || ' days'), (n % 100) * 1.5 FROM seq;

-- 1. Chưa có index: database nói SCAN
.timer on
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 42;
SELECT count(*) FROM orders WHERE customer_id = 42;

-- 2. Dựng index rồi hỏi lại: SEARCH ... USING INDEX
CREATE INDEX idx_cust ON orders(customer_id);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 42;
SELECT count(*) FROM orders WHERE customer_id = 42;      -- cùng đáp án, khác vật lý

-- 3. Giết index bằng một hàm bọc quanh cột — sai lầm production kinh điển
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id + 0 = 42;       -- SCAN trở lại
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE substr(created_at,1,7) = '2026-03';  -- SCAN

-- 4. THỨ TỰ cột trong composite index không phải chuyện trang trí
CREATE INDEX idx_status_date ON orders(status, created_at);
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE status = 'shipped' AND created_at > '2026-06-01';  -- dùng được
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE created_at > '2026-06-01';   -- không: sai tiền tố

-- 5. Foreign key KHÔNG tặng bạn index (nhiều database, cùng cái bẫy)
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE amount > 140;                -- SCAN: không ai index nó
```

Kết quả mong đợi: bước 1 nói SCAN và tốn thời gian đo được trên 200.000 dòng; bước 2 nói SEARCH và trả về gần như tức thì — *chữ trong plan đổi* mới là tín hiệu bạn đang học đọc, không phải con số thời gian. Bước 3 và 4 mới là phần quan trọng: bọc cột trong một hàm là rơi thẳng về quét toàn bảng dù index vẫn còn đó, và composite index chỉ phục vụ những query dùng tới cột dẫn đầu của nó. Chính điểm cuối là lý do câu "bảng đó có index rồi mà" không bao giờ là câu trả lời cho một query chậm.

## Tự kiểm tra

1. Một query trên cột đã index bỗng chạy chậm sau khi ai đó "dọn dẹp" mệnh đề WHERE. Bạn tìm gì trước tiên?
2. Bạn có `INDEX(status, created_at)`. Trong ba trường hợp sau, cái nào dùng được nó: lọc theo mình status, mình created_at, hay cả hai?
3. Service của bạn chạy 20 instance, mỗi cái pool 50 connection, đánh vào một database cho phép 500. Chuyện gì xảy ra, và phép tính lẽ ra bạn phải làm là gì?

<details><summary>Xem đáp án</summary>

1. Một hàm hay biểu thức bọc quanh cột đã index — `LOWER(email) = …`, `substr(created_at,1,7) = …`, `col + 0 = …`. Index nằm trên giá trị của cột, không nằm trên kết quả của hàm áp lên nó, nên database rơi về quét. Sửa bằng cách viết lại điều kiện (so sánh khoảng thay cho `substr`) hoặc thêm expression index.
2. Mình status: được, đó là cột dẫn đầu. Cả hai: được, đúng thứ index này sinh ra để phục vụ. Mình created_at: không — composite index sắp xếp theo cột đầu tiên, nên query không ràng buộc `status` thì không tận dụng được thứ tự đó, hệt như bạn không tra nổi một cái tên trong danh bạ khi chỉ biết tên lót.
3. 20 × 50 = 1.000 connection đòi hỏi trên giới hạn 500, nên các instance bắt đầu fail khi kết nối lúc tải cao — và nó trông như "database sập" trong khi database vẫn khoẻ. Phép tính là số instance × cỡ pool ≤ max connection, chừa dư cho migration, phiên admin và job nền; cách sửa là giảm pool mỗi instance hoặc đặt một connection proxy.

</details>

## Điều cần nhớ

- Relational trường tồn vì SQL khai báo (optimizer lo phần Big-O) và constraint là bài test không thể bỏ qua.
- Index là vật lý: thứ tự cột quan trọng, hàm phá nó, mỗi cú ghi trả giá cho nó, và foreign key không được tặng kèm index.
- Chữ nhỏ của ACID là isolation — né đa số bằng cách gói kiểm-tra-rồi-ghi vào một câu lệnh nguyên tử.
- `EXPLAIN` chạy thành vòng lặp xây trực giác: săn Seq Scan trên bảng to và khoảng lệch ước-lượng-vs-thực-tế; pool connection trước khi autoscale làm hộ bạn phép nhân.

*Tiếp theo — Phần 8: Concurrency không nước mắt.*
