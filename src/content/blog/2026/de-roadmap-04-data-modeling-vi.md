---
title: 'Data modeling: OLTP vs OLAP, star schema'
description: 'Grain, fact, dimension, surrogate key, và SCD Type 2 với SQL thật — tay nghề modeling quyết định warehouse của bạn trả lời câu hỏi hay trả lời cãi vã.'
date: 2026-07-30
category: Data
tags: [de-roadmap, data-modeling, warehouse, sql]
lang: vi
translationKey: de-roadmap-04
series: de-roadmap
part: 4
---

S07-P02 kể câu chuyện *vì sao* star schema thắng. Phần này là chính tay nghề — những quyết định bạn thực sự đưa ra khi biến "chúng tôi muốn phân tích bán hàng" thành các bảng: chọn grain, thiết kế fact và dimension, và xử lý việc thực tại cứ đổi thay bên dưới model. Modeling là kỹ năng đòn bẩy cao nhất của roadmap này: pipeline chuyển dữ liệu, nhưng **model quyết định có ai tin được thứ được chuyển đến hay không**.

## Hai hình dạng cho hai công việc

Database của app được **chuẩn hoá**: mỗi sự thật sống ở đúng một chỗ, nên cập nhật địa chỉ khách chạm đúng một dòng. Hoàn hảo cho hàng nghìn cú ghi nhỏ (OLTP). Nhưng hỏi nó một câu phân tích là bạn join sáu bảng trước giờ ăn sáng.

Warehouse **phi chuẩn hoá có chủ đích**: chấp nhận dư thừa để câu hỏi trở nên rẻ. Một bảng sự kiện, ngữ cảnh mô tả vây quanh:

```mermaid
erDiagram
    FACT_SALES }o--|| DIM_CUSTOMER : "customer_key"
    FACT_SALES }o--|| DIM_PRODUCT : "product_key"
    FACT_SALES }o--|| DIM_STORE : "store_key"
    FACT_SALES }o--|| DIM_DATE : "date_key"
    FACT_SALES {
        int customer_key FK
        int product_key FK
        int store_key FK
        int date_key FK
        int quantity
        int amount_cents
    }
    DIM_CUSTOMER {
        int customer_key PK
        string customer_id "business key"
        string name
        string segment
        string city
    }
```

Cùng một lượng thông tin, khác mục tiêu tối ưu. Sai lầm cần tránh là model *lai* — chuẩn hoá nửa vời "vì thấy dư thừa phí quá" — thứ thừa kế điểm yếu của cả hai.

## Grain: một quyết định cai trị tất cả

Trước mọi danh sách cột, hãy hoàn thành câu này: **"Một dòng trong fact table này đại diện cho đúng một ___."** Một *dòng hàng* của đơn? Một đơn? Một khách mỗi ngày? Đó là **grain**, và mọi quyết định sau treo lên nó:

- Quá thô (một dòng mỗi đơn) thì "doanh thu theo sản phẩm" thành câu hỏi không trả lời nổi — chi tiết đã mất vĩnh viễn.
- Trộn lẫn (dòng này là line, dòng kia là tổng đơn) thì mọi `SUM` sai trong im lặng — con bug modeling đắt nhất trần đời, vì nó *trông* rất ổn.

Quy tắc bỏ túi: **khai grain mịn nhất mà nguồn chống đỡ được** — bạn luôn aggregate lên được, không bao giờ tách ngược xuống được. Viết câu grain thành comment đầu file model; phiên bản tương lai của bạn sẽ cảm ơn trong một buổi code review.

## Fact: ba vị bạn sẽ gặp thật

- **Transaction fact** — một dòng mỗi sự kiện (một lượt bán, một cú click). Append-only, lớn mãi; là mặc định.
- **Periodic snapshot** — một dòng mỗi thực thể mỗi kỳ (số dư tài khoản theo ngày). Cho các câu hỏi "trạng thái theo thời gian" mà transaction không trả lời rẻ được.
- **Accumulating snapshot** — một dòng mỗi *quy trình*, cập nhật khi nó tiến (một đơn với ngày đặt/gửi/giao). Cho phân tích funnel và lead-time.

Và một kỷ luật trả lãi hằng ngày: giữ cột fact **cộng được** (amount, count — `SUM` an toàn theo mọi chiều). Tỷ lệ và phần trăm không cộng được — lưu tử số và mẫu số, tính tỷ lệ lúc query. Ai pre-compute `avg_margin_pct` vào fact table là kết án tử mọi cú roll-up tương lai của nó.

## Dimension, surrogate key, và vì sao không xài luôn `customer_id`

Dimension chở ngữ cảnh mô tả — và mỗi cái nhận một **surrogate key** (một số nguyên vô nghĩa do warehouse cấp) thay vì join bằng business key. Ba lý do khiến thói quen mấy chục năm tuổi này sống dai:

1. **Business key nói dối**: nguồn tái sử dụng ID, hệ thống sáp nhập va chạm nhau, "cùng một khách" đến với ba cách viết tên.
2. **Tích hợp**: một dimension khách hàng *conformed* với một surrogate key cho phép fact bán hàng và fact ticket hỗ trợ đồng thuận khách đó là ai (data-as-product của S07-P07, ở quy mô bảng).
3. **Lịch sử** — lý do thật, mục kế tiếp.

## SCD Type 2: giữ lịch sử mà không mất trí

Một khách chuyển từ Hà Nội vào Đà Nẵng. Ghi đè city (**Type 1**) là "doanh thu theo thành phố" của năm ngoái tự viết lại chính nó trong im lặng — báo cáo hôm qua hết tái tạo được (S07-P10 xin có ý kiến). **Type 2** thay vào đó đánh phiên bản cho dòng:

| customer_key | customer_id | city | valid_from | valid_to | is_current |
|---|---|---|---|---|---|
| 1017 | C-042 | Hà Nội | 2024-01-01 | 2026-03-15 | false |
| 2214 | C-042 | Đà Nẵng | 2026-03-15 | 9999-12-31 | true |

Fact ghi trước cú chuyển trỏ vào key `1017`; fact sau trỏ `2214`. Báo cáo lịch sử giữ nguyên sự thật *tại thời điểm nó xảy ra*, và cả hai câu hỏi đều trả lời được: "doanh thu theo thành phố *lúc bán*" (join surrogate key, không cần gì đặc biệt) và "thành phố hiện tại của mọi khách trong lịch sử" (join qua business key, lọc `is_current`).

```sql
-- Pattern "as-of" kinh điển khi phải resolve theo ngày:
SELECT f.amount_cents, d.city
FROM fact_sales f
JOIN dim_customer d
  ON d.customer_id = f.customer_id
 AND f.sold_at >= d.valid_from AND f.sold_at < d.valid_to
```

Lời khuyên thật thà: Type 2 tốn độ phức tạp pipeline (tính năng snapshot của dbt tồn tại chính xác cho việc này) — áp nó cho các dimension mà lịch sử *quan trọng với business* (segment khách, địa bàn sales), và dùng Type 1 ghi đè vui vẻ cho các cú sửa typo. Khai báo cột nào Type 1, cột nào Type 2 *chính là* một phần của model.

## Workflow modeling sống sót khi va chạm stakeholder

1. **Gom câu hỏi thật**, không phải điều ước về bảng: "doanh thu theo sản phẩm theo vùng, hằng tháng" — mười câu như thế thắng mọi tài liệu yêu cầu.
2. **Gạch chân danh từ** → ứng viên dimension; **gạch chân động từ/con số** → ứng viên fact.
3. **Khai grain** cho từng fact, thành tiếng, thành văn bản.
4. **Phác cái star**, và kiểm tra mọi câu hỏi đã gom đều trả lời được bằng `metric theo dimension, lọc theo dimension` trên nó.
5. **Quyết chính sách SCD theo từng cột dimension** — đây là cuộc trò chuyện *business* ("segment cũ có quan trọng không?"), không phải kỹ thuật.

Hai mươi phút việc này trước khi viết SQL đều đặn tiết kiệm nhiều tuần remodel về sau.

## Điều cần nhớ

- OLTP chuẩn hoá để cú ghi chạm một chỗ; OLAP phi chuẩn hoá để câu hỏi chạm ít join — trộn hai thứ là thừa kế điểm yếu của cả hai.
- Grain là quyết định chúa tể: mịn nhất mà nguồn chống đỡ được, khai thành một câu, một grain mỗi fact table.
- Lưu số cộng được; giữ surrogate key vì business key nói dối và lịch sử cần chúng.
- SCD Type 2 khiến báo cáo hôm qua tái tạo được — áp nơi lịch sử quan trọng, Type 1 nơi không, và viết chính sách ra giấy.

*Tiếp theo — Phần 5: Data warehouse & kiến trúc medallion.*
