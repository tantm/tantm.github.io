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

## Catalog: danh bạ điện thoại của platform

Một **data catalog** trả lời câu hỏi một. Entry tối thiểu khả dụng cho mỗi bảng: nó là gì (một câu thật thà), chủ sở hữu (một *team*, không phải một người sẽ nghỉ việc), nguồn và lịch cập nhật, trạng thái quality/SLA (panel của P12), và mức nhạy cảm (bên dưới). Hai luật quyết định catalog của bạn thành hạ tầng thật hay một wiki bị bỏ hoang: **generate, đừng chép tay** — schema, độ tươi, lineage phải được *gặt* từ metadata warehouse, manifest dbt, run của orchestrator (tài liệu tay là drift của S04-P11, phiên bản documentation); con người chỉ thêm tầng phán đoán (mô tả, ownership, độ nhạy). Và **catalog cái được chứng nhận, không phải mọi thứ** — một catalog liệt kê 3.000 bảng trong đó 2.800 là nháp chỉ là tiếng ồn đeo hộp tìm kiếm; đánh dấu lớp gold (P05) là certified và để phần còn lại tìm-được-nhưng-chưa-được-ban-phước. Chính cái dấu đó *là* câu trả lời cho "orders nào là thật."

## Lineage: phép toán bán kính vụ nổ cho dữ liệu

**Lineage** — thượng nguồn nào nuôi bảng này, hạ nguồn nào tiêu thụ nó — trả lời câu hỏi ba, và bạn đã sở hữu sẵn nguyên liệu thô: graph `ref()` của dbt (P06), DAG của orchestrator (P08), query log của warehouse. Đấu nối lại, ba việc nặng thành rẻ: **impact analysis** ("tôi drop cột này thì ai vỡ?" — được trả lời trước sự cố thay vì bởi sự cố), **triage căn nguyên** (bốn lớp của P12 nói *lớp nào* hỏng; lineage nói *những gì khác* nằm hạ nguồn cú hỏng — một cái nhìn thay cho một channel sự cố đầy "X có bị ảnh hưởng không?"), và **câu trả lời compliance** ("dữ liệu khách nằm đâu?" của S07-P10 thành một câu query graph, không phải một dự án khảo cổ). Lời khuyên thật thà: bắt đầu với thứ dbt và orchestrator cho không; mua hay xây lineage mức cột chỉ khi impact analysis thật sự đau — luật lần-xuất-hiện-thứ-hai của S01-P10 cho tooling metadata.

## PII: xử lý tại biên giới, không phải khắp nơi

Luật khiến privacy giải được đã ló ở P05 và giờ nhận phát biểu đầy đủ: **phân loại và tối thiểu hoá lúc ingest, để phần ruột platform nhàm chán.**

- **Phân loại lúc vào cửa**: mỗi cột nguồn nhận một tag nhạy cảm (public / internal / PII / restricted) như một phần cuộc nói chuyện contract của P12 — tag đi theo lineage, nên "PII ở đâu?" luôn trả lời được khi dữ liệu chảy.
- **Tối thiểu hoá tại bronze**: bỏ thứ không bao giờ cần, hash các identifier chỉ dùng để join, tokenize thứ cần đảo ngược được. Chiến lược PII tốt nhất là luật storage của S04-P04 lộn ngược — dữ liệu rẻ nhất để bảo vệ là dữ liệu bạn đã không giữ.
- **Mask theo role tại warehouse**: dynamic masking / column policy cho analyst thấy `***-**-1234` trong khi team fraud thấy giá trị thật — một bảng, view theo role, engine cưỡng chế (bản năng constraint của P07: cú kiểm không thể bỏ qua), không phải N bản copy đã-làm-sạch trôi dạt khỏi nhau ("một định nghĩa một nhà" của S02-P05).
- **Xoá là một feature bạn thiết kế** (S07-P10): một yêu cầu xoá của khách hàng phải map tới các row *tìm được* — lại là lineage + tag, cộng đòn bẩy snapshot-expiration của P09 trong lakehouse.

## Lát cắt DevOps mà một DE thật sự cần

Bạn không cần cả giáo trình S04 từ ngày một, nhưng bốn mảnh là không mặc cả được, và bạn đã gặp cả bốn: **container** cho code pipeline (process+cgroup của S01-P05; cùng một image ở dev và prod chấm dứt "trên máy em chạy mà" cho transform — luật artifact của S01-P12); **CI cho code dữ liệu** — dbt compile + test trên PR nhắm vào schema nháp, cộng bộ suite P12 làm cổng merge: đối xử một data test vỡ như một unit test vỡ, blocking (CI-khiến-điều-đúng-tự-động của S01-P09, chĩa vào SQL); **IaC cho lớp nền platform** (S04-P11 nguyên văn: warehouse, bucket, cluster orchestrator, IAM — hạ tầng click là hạ tầng không tái tạo được, và data platform sống đủ lâu để điều đó lãi kép); và **môi trường cho dữ liệu** — cú xoắn mà thế giới app không có: staging *code* thì dễ, staging *data* mới khó; pattern thực dụng là prod-read-only cho transform dev cộng schema nháp ghi được, hoặc zero-copy clone nơi warehouse hỗ trợ. Thứ tuyệt đối đừng làm là lối tắt kinh điển: test trên một file CSV mẫu không mang bệnh lý nào của prod — đó là cách anomaly check của P12 xanh ở dev và nổ ngay ngày một ở prod.

Chiếc thang trưởng thành, thật thà: team một mình — catalog là một README, governance là kỷ luật; vài team — catalog generate, lineage mức dbt, tag PII, cổng CI (mức này phủ đa số công ty); tầm platform — lineage mức cột, workflow xin quyền truy cập, hội đồng governance. Leo thang khi các *câu hỏi* bắt đầu đau, không phải khi slide của vendor bảo thế — governance đi trước nhu cầu là abstraction suy đoán của S01-P10 kèm ngân sách compliance.

## Điều cần nhớ

- Governance = trả lời ba câu hỏi theo yêu cầu: bảng nào là thật (catalog), tôi đổi cái này thì ai vỡ (lineage), dữ liệu nhạy cảm nằm đâu (tag + lineage).
- Generate catalog từ metadata và chứng nhận lớp gold — tài liệu tay sẽ drift, và catalog của mọi thứ là catalog của không gì cả.
- PII tại biên giới: phân loại lúc vào, tối thiểu hoá ở bronze, mask theo role bằng engine, và thiết kế việc xoá như một feature — phần ruột giữ nhàm chán.
- Lát DevOps của DE: pipeline container hoá, CI với data test blocking, IaC cho lớp nền, và môi trường dữ liệu dev/prod trung thực — leo thang governance khi câu hỏi đau, đừng sớm hơn.

*Tiếp theo — Phần 14: Tư duy như một Senior Data Engineer — hồi kết của series.*
