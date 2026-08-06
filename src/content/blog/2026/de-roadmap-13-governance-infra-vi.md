---
title: 'Governance, catalog & hạ tầng cho data team'
description: 'Catalog là câu trả lời cho "bảng nào là thật", lineage là phép toán bán kính vụ nổ, PII xử lý tại biên giới, và lát cắt DevOps mà một data engineer thật sự cần.'
date: 2026-08-04
category: Data
tags: [de-roadmap, governance, devops]
lang: vi
translationKey: de-roadmap-13
series: de-roadmap
part: 13
---

Quanh mốc bảng thứ năm mươi, mọi data platform đâm vào cùng một bức tường, và nó không phải kỹ thuật: một analyst hỏi *"có ba bảng `orders` — cái nào là thật?"*, một regulator hỏi *"dữ liệu khách hàng nằm ở đâu?"*, và một kỹ sư sắp drop một cột hỏi *"tôi làm ai vỡ?"*. **Governance** là cái tên kém hào nhoáng cho việc trả lời được ba câu đó theo yêu cầu. Bỏ qua nó và bài toán niềm tin của P12 quay lại ở quy mô platform: không phải một con số sai, mà một platform không ai dám tin hay dám sửa.

## Bạn sẽ học được gì

- Sinh catalog tự động thay vì bảo trì bằng tay, để nó luôn đúng.
- Đọc lineage như phép toán bán kính vụ nổ trước khi bạn đổi một cái bảng.
- Xử lý PII tại biên giới, nơi biện pháp kiểm soát vừa rẻ vừa trọn vẹn.
- Lấy đúng lát cắt DevOps mà một data engineer thật sự cần, và bỏ qua phần còn lại.

**Cần biết trước:** Phần 5 (các lớp) và Phần 12 (chất lượng). Orchestration ở Phần 8 là thứ chạy phần lớn những điều này.

## 1. Catalog: danh bạ điện thoại của platform

Một **data catalog** trả lời câu hỏi một. Entry tối thiểu khả dụng cho mỗi bảng: nó là gì (một câu thật thà), chủ sở hữu (một *team*, không phải một người sẽ nghỉ việc), nguồn và lịch cập nhật, trạng thái quality/SLA (panel của P12), và mức nhạy cảm (bên dưới). Hai luật quyết định catalog của bạn thành hạ tầng thật hay một wiki bị bỏ hoang: **generate, đừng chép tay** — schema, độ tươi, lineage phải được *gặt* từ metadata warehouse, manifest dbt, run của orchestrator (tài liệu tay là drift của S04-P11, phiên bản documentation); con người chỉ thêm tầng phán đoán (mô tả, ownership, độ nhạy). Và **catalog cái được chứng nhận, không phải mọi thứ** — một catalog liệt kê 3.000 bảng trong đó 2.800 là nháp chỉ là tiếng ồn đeo hộp tìm kiếm; đánh dấu lớp gold (P05) là certified và để phần còn lại tìm-được-nhưng-chưa-được-ban-phước. Chính cái dấu đó *là* câu trả lời cho "orders nào là thật."

## 2. Lineage: phép toán bán kính vụ nổ cho dữ liệu

**Lineage** — thượng nguồn nào nuôi bảng này, hạ nguồn nào tiêu thụ nó — trả lời câu hỏi ba, và bạn đã sở hữu sẵn nguyên liệu thô: graph `ref()` của dbt (P06), DAG của orchestrator (P08), query log của warehouse. Đấu nối lại, ba việc nặng thành rẻ: **impact analysis** ("tôi drop cột này thì ai vỡ?" — được trả lời trước sự cố thay vì bởi sự cố), **triage căn nguyên** (bốn lớp của P12 nói *lớp nào* hỏng; lineage nói *những gì khác* nằm hạ nguồn cú hỏng — một cái nhìn thay cho một channel sự cố đầy "X có bị ảnh hưởng không?"), và **câu trả lời compliance** ("dữ liệu khách nằm đâu?" của S07-P10 thành một câu query graph, không phải một dự án khảo cổ). Lời khuyên thật thà: bắt đầu với thứ dbt và orchestrator cho không; mua hay xây lineage mức cột chỉ khi impact analysis thật sự đau — luật lần-xuất-hiện-thứ-hai của S01-P10 cho tooling metadata.

## 3. PII: xử lý tại biên giới, không phải khắp nơi

Luật khiến privacy giải được đã ló ở P05 và giờ nhận phát biểu đầy đủ: **phân loại và tối thiểu hoá lúc ingest, để phần ruột platform nhàm chán.**

- **Phân loại lúc vào cửa**: mỗi cột nguồn nhận một tag nhạy cảm (public / internal / PII / restricted) như một phần cuộc nói chuyện contract của P12 — tag đi theo lineage, nên "PII ở đâu?" luôn trả lời được khi dữ liệu chảy.
- **Tối thiểu hoá tại bronze**: bỏ thứ không bao giờ cần, hash các identifier chỉ dùng để join, tokenize thứ cần đảo ngược được. Chiến lược PII tốt nhất là luật storage của S04-P04 lộn ngược — dữ liệu rẻ nhất để bảo vệ là dữ liệu bạn đã không giữ.
- **Mask theo role tại warehouse**: dynamic masking / column policy cho analyst thấy `***-**-1234` trong khi team fraud thấy giá trị thật — một bảng, view theo role, engine cưỡng chế (bản năng constraint của P07: cú kiểm không thể bỏ qua), không phải N bản copy đã-làm-sạch trôi dạt khỏi nhau ("một định nghĩa một nhà" của S02-P05).
- **Xoá là một feature bạn thiết kế** (S07-P10): một yêu cầu xoá của khách hàng phải map tới các row *tìm được* — lại là lineage + tag, cộng đòn bẩy snapshot-expiration của P09 trong lakehouse.

## 4. Lát cắt DevOps mà một DE thật sự cần

Bạn không cần cả giáo trình S04 từ ngày một, nhưng bốn mảnh là không mặc cả được, và bạn đã gặp cả bốn: **container** cho code pipeline (process+cgroup của S01-P05; cùng một image ở dev và prod chấm dứt "trên máy em chạy mà" cho transform — luật artifact của S01-P12); **CI cho code dữ liệu** — dbt compile + test trên PR nhắm vào schema nháp, cộng bộ suite P12 làm cổng merge: đối xử một data test vỡ như một unit test vỡ, blocking (CI-khiến-điều-đúng-tự-động của S01-P09, chĩa vào SQL); **IaC cho lớp nền platform** (S04-P11 nguyên văn: warehouse, bucket, cluster orchestrator, IAM — hạ tầng click là hạ tầng không tái tạo được, và data platform sống đủ lâu để điều đó lãi kép); và **môi trường cho dữ liệu** — cú xoắn mà thế giới app không có: staging *code* thì dễ, staging *data* mới khó; pattern thực dụng là prod-read-only cho transform dev cộng schema nháp ghi được, hoặc zero-copy clone nơi warehouse hỗ trợ. Thứ tuyệt đối đừng làm là lối tắt kinh điển: test trên một file CSV mẫu không mang bệnh lý nào của prod — đó là cách anomaly check của P12 xanh ở dev và nổ ngay ngày một ở prod.

Chiếc thang trưởng thành, thật thà: team một mình — catalog là một README, governance là kỷ luật; vài team — catalog generate, lineage mức dbt, tag PII, cổng CI (mức này phủ đa số công ty); tầm platform — lineage mức cột, workflow xin quyền truy cập, hội đồng governance. Leo thang khi các *câu hỏi* bắt đầu đau, không phải khi slide của vendor bảo thế — governance đi trước nhu cầu là abstraction suy đoán của S01-P10 kèm ngân sách compliance.

## Thực hành (25 phút — sinh một catalog và tính một bán kính vụ nổ)

Cả hai artifact trong bài này đều *dẫn xuất được* thay vì phải viết tay, và đó là phiên bản duy nhất luôn đúng. Hãy dựng cả hai từ một schema thật:

```sql
-- duckdb gov.db — một platform nhỏ để tự soi
CREATE TABLE stg_orders(order_id VARCHAR, customer_id VARCHAR, email VARCHAR, amount DECIMAL(10,2));
CREATE TABLE dim_customer(customer_id VARCHAR, email VARCHAR, country VARCHAR);
CREATE VIEW  fct_orders AS SELECT o.order_id, o.customer_id, o.amount, c.country
                           FROM stg_orders o JOIN dim_customer c USING (customer_id);
CREATE VIEW  rpt_revenue_by_country AS SELECT country, sum(amount) AS revenue
                                       FROM fct_orders GROUP BY 1;

-- 1. Catalog, được SINH RA — không bảo trì tay, nên không bao giờ cũ
SELECT table_name, column_name, data_type FROM information_schema.columns ORDER BY 1, ordinal_position;

-- 2. Dò PII theo quy ước: mẫu tên cột là cú quét thô nhưng thật thà
SELECT table_name, column_name,
       CASE WHEN lower(column_name) SIMILAR TO '%(email|phone|ssn|address|name)%'
            THEN 'XEM LẠI: nhiều khả năng là PII' ELSE '' END AS flag
FROM information_schema.columns WHERE flag <> '';

-- 3. Lineage như bán kính vụ nổ: ai vỡ nếu tôi đổi dim_customer?
SELECT view_name, sql FROM duckdb_views() WHERE sql ILIKE '%dim_customer%';
```

```bash
# 4. Cùng câu hỏi đó trong một project kiểu dbt, không cần công cụ catalog nào:
grep -rl "ref('dim_customer')" models/ | sed 's/^/  consumer trực tiếp: /'
# rồi lặp lại cho từng model tìm được để đi thêm một bước trên graph
```

Kết quả mong đợi: câu query catalog cho ra đúng cái bảng mà một trang wiki sẽ có, chỉ khác là nó không thể trôi lệch — sinh lại là nó đúng, và đó là toàn bộ lập luận cho việc sinh ra thay vì viết ra. Cú quét PII cố ý thô sơ, và đó chính là điểm mấu chốt: một lượt quét theo mẫu tên tìm ra phần lớn trong vài phút và cho bạn một danh sách để xem lại, và như thế thắng một hệ phân loại hoàn hảo mà không ai từng chạy. Query 3 biến câu "tôi đổi cột này được không?" thành một danh sách tên thay vì một cuộc trò chuyện ngoài hành lang — và lần đầu bạn chạy nó trên một warehouse thật rồi thấy mười một chỗ phụ thuộc mà mình không biết chính là lúc lineage thôi là một từ khoá governance.

## Tự kiểm tra

1. Team bạn bảo trì một data dictionary trên wiki. Lúc viết ra thì nó chính xác. Vấn đề ở đâu?
2. Ai đó hỏi có được xoá một cột không. Bạn cần gì để trả lời an toàn, và nếu không có thì phương án dự phòng là gì?
3. Vì sao mask PII trong báo cáo yếu hơn xử lý nó ngay lúc ingest?

<details><summary>Xem đáp án</summary>

1. Nó trôi lệch trong im lặng. Schema đổi theo mỗi lần deploy trong khi wiki chỉ đổi khi có người nhớ, nên tài liệu sai trong vòng vài tuần và — tệ hơn — không ai biết phần nào sai. Hãy sinh catalog từ schema để nó đúng theo cấu tạo, và để dành phần viết tay cho những thứ schema không diễn đạt nổi: grain, quyền sở hữu, và một cột *có nghĩa là gì*.
2. Lineage mức cột, hoặc nếu không có thì một cú tìm chuỗi xuyên toàn bộ code biến đổi và các định nghĩa BI theo tên cột. Phương án dự phòng khi không có cả hai: khai tử thay vì xoá — ngừng ghi vào nó, thông báo, chờ trọn một chu kỳ kinh doanh, và theo dõi xem có ai kêu không trước khi gỡ bỏ. Chậm hơn, nhưng nó hỏng một cách an toàn.
3. Vì mask ở hạ nguồn bảo vệ một consumer, trong khi giá trị thô vẫn nằm ở thượng nguồn nơi mọi consumer khác và mọi bản sao tương lai đều đọc được. Xử lý tại biên — phân loại, tối giản, mask hoặc tokenize ngay trên đường vào — bảo vệ mọi đường cùng lúc, kể cả những đường chưa tồn tại.

</details>

## Điều cần nhớ

- Governance = trả lời ba câu hỏi theo yêu cầu: bảng nào là thật (catalog), tôi đổi cái này thì ai vỡ (lineage), dữ liệu nhạy cảm nằm đâu (tag + lineage).
- Generate catalog từ metadata và chứng nhận lớp gold — tài liệu tay sẽ drift, và catalog của mọi thứ là catalog của không gì cả.
- PII tại biên giới: phân loại lúc vào, tối thiểu hoá ở bronze, mask theo role bằng engine, và thiết kế việc xoá như một feature — phần ruột giữ nhàm chán.
- Lát DevOps của DE: pipeline container hoá, CI với data test blocking, IaC cho lớp nền, và môi trường dữ liệu dev/prod trung thực — leo thang governance khi câu hỏi đau, đừng sớm hơn.

*Tiếp theo — Phần 14: Tư duy như một Senior Data Engineer — hồi kết của series.*
