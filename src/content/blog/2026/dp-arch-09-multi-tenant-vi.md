---
title: 'Analytics multi-tenant: một platform, nhiều khách hàng'
description: 'Silo, pool hay bridge: ba mô hình tenancy, cách ly từ mức dòng tới mức database, bài toán noisy neighbor, và vì sao chi phí per-tenant là một yêu cầu thiết kế.'
date: 2026-07-28
category: Architecture
tags: [dp-architectures, saas, multi-tenant, data-platform]
lang: vi
translationKey: dp-arch-09
series: dp-architectures
part: 9
cover: images/dp-arch-multi-tenant.png
---

Các trường phái trước đều phục vụ câu hỏi của chính công ty mình. Phần này lật ngược hướng: **platform của bạn phục vụ dữ liệu của *các công ty khác*** — một sản phẩm SaaS có analytics bên trong, một agency chạy một stack cho nhiều khách, một data product bán theo subscription. Một platform, nhiều khách hàng, và một mệnh lệnh tối cao mới: **khách A không bao giờ được thấy dữ liệu của khách B — và không bao giờ phải cảm nhận workload của B.**

![Analytics multi-tenant: một platform, nhiều khách hàng](images/dp-arch-multi-tenant.png)

## Nỗi đau khai sinh

Multi-tenancy ra đời vào ngày khách hàng thứ hai ký hợp đồng. Clone nguyên stack cho mỗi khách thì cách ly hoàn hảo — và team platform có chức danh mới là "người upgrade N bản sao của mọi thứ". Nhét tất cả vào một database với cột `tenant_id` thì một lần deploy — và một mệnh đề `WHERE` đứng giữa bạn và một tít báo rò rỉ dữ liệu. Cả trường phái này là khoảng không giữa hai vách đá đó.

## Ba mô hình tenancy

```mermaid
flowchart LR
    subgraph Silo["① SILO — mỗi tenant một stack"]
        A1["Stack tenant A"]
        B1["Stack tenant B"]
    end
    subgraph Bridge["② BRIDGE — chung compute, riêng storage"]
        C["Pipeline & engine chung"]
        A2["Schema / DB theo tenant"]
        C --- A2
    end
    subgraph Pool["③ POOL — chung tất cả"]
        P["Một bộ bảng<br/><i>tenant_id khắp nơi</i>"]
    end
```

- **Silo** — mỗi tenant một stack riêng (database riêng, đôi khi account riêng). Cách ly tối đa, câu chuyện compliance tối đa, chi phí tăng tuyến tính theo tenant, vận hành tăng tệ hơn tuyến tính. Mô hình mà khách bị kiểm soát hoặc khách rất lớn *đòi hỏi*.
- **Pool** — mọi tenant chung bảng; mỗi dòng mang `tenant_id`; mỗi query lọc theo nó. Rẻ nhất trên đầu tenant, onboard tenant thứ 1000 dễ như thứ 10, và dồn toàn bộ rủi ro vào việc access control phải đúng, ở mọi nơi, mãi mãi.
- **Bridge** — chung pipeline và compute, nhưng storage tách theo tenant (schema-per-tenant hoặc database-per-tenant). Điểm giữa thực dụng mà đa số platform B2B hội tụ về.

Đáp án thật của một platform trưởng thành thường là **phân bậc**: pool cho cái đuôi dài khách nhỏ, bridge cho tầm trung, silo cho hai khách enterprise có security team chuyên gửi questionnaire.

## Cách ly, theo từng lớp

Tenancy không phải một quyết định — nó là cùng một câu hỏi ở bốn lớp:

| Lớp | Đáp án pool | Cái bẫy |
|---|---|---|
| **Storage** | Cột `tenant_id` + partition theo tenant | Thiếu một filter là trả về dòng của *tất cả* |
| **Query** | Row-level security (RLS) trong engine, không phải `WHERE` trong code app | Policy áp cho *vài* đường truy cập — BI tool đi vòng qua |
| **Compute** | Workload management: queue, resource group, quota per-tenant | Dashboard Black-Friday của một tenant bỏ đói tất cả (noisy neighbor) |
| **Pipelines** | Job tham số hoá theo tenant, lập lịch công bằng | File hỏng của một tenant chặn cả lượt chạy chung |

Hai thói quen gánh phần lớn sự an toàn. Một, **đẩy cách ly xuống platform, đừng để ở application**: RLS trong database thắng cái `WHERE tenant_id = ?` mà mọi developer phải nhớ, và credential scope theo tenant thắng cả hai. Hai, **test biên giới một cách thù địch** — một check tự động đăng nhập bằng tenant A và cố đọc dữ liệu B phải chạy trong CI mãi mãi.

## Noisy neighbor & cuốn sổ chi phí

Chung compute nghĩa là chung số phận: một tenant nặng kéo p95 của tất cả xuống. Các biện pháp là cơ học — quota, query timeout, warehouse/pool riêng theo bậc, admission control — nhưng *công cụ tổ chức* lại là kinh tế: **đo đếm theo tenant**. Gắn thẻ mỗi query, mỗi lượt pipeline, mỗi GB lưu trữ với tenant gây ra nó. Bạn nhận cùng lúc ba siêu năng lực:

1. **Vận hành:** noisy neighbor hiện hình trong vài phút, không cần war room.
2. **Định giá:** bạn biết một tenant thật sự tốn bao nhiêu — trước khi kỳ gia hạn hợp đồng biết.
3. **Kiến trúc:** dữ liệu metering *chính là* bằng chứng để chuyển một tenant giữa các bậc (pool → bridge → silo).

Chi phí per-tenant không phải chuyện hậu kỳ của tài chính; trong trường phái này nó là yêu cầu thiết kế hạng nhất (Phần 12 tổng quát hoá ý này).

## Chấm theo năm trục

- **Team:** platform chung = một codebase để vận hành, nhưng bug tenancy là bug bảo mật; thanh review và testing nâng lên vĩnh viễn.
- **Scale:** mô hình pool onboard hàng nghìn tenant; mô hình silo onboard các auditor.
- **Latency:** thừa kế từ trường phái nền (một tầng OLAP Phần 5 dạng pool rất phổ biến cho embedded analytics).
- **Budget:** toàn bộ cuộc chơi — chi phí biên per-tenant quyết định gross margin của sản phẩm.
- **Compliance:** data residency theo tenant ("dữ liệu khách EU ở lại EU") có thể ép silo theo region bất kể bạn muốn gì (lại Phần 10).

## Ba khách hàng (lần này là của bạn)

- **SaaS startup:** bắt đầu pool với RLS từ ngày đầu — trang bị lại kỷ luật `tenant_id` về sau rất cay đắng. Dashboard nhúng chạy trên một engine Phần 5 dạng pool.
- **Agency / consultancy:** bridge — schema-per-client trên hạ tầng chung; offboard khách thành `DROP SCHEMA`, auditor rất thích.
- **Platform B2B có khách enterprise:** phân bậc — pool cho cái đuôi, silo (tới mức account riêng) cho cá voi; sales sẽ bán bậc silo dù bạn đã xây hay chưa, nên hãy thiết kế nó trước.

## Điều cần nhớ

- Ba mô hình — silo, bridge, pool — đánh đổi cách ly lấy chi phí biên; platform trưởng thành thường phân bậc cả ba.
- Cách ly là câu hỏi bốn lớp (storage, query, compute, pipelines); đẩy nó xuống platform và test biên giới thù địch trong CI.
- Noisy neighbor giải bằng cơ học (quota) nhưng *quản* bằng kinh tế (metering per-tenant) — thứ đồng thời định giá sản phẩm của bạn.
- Data residency có thể phủ quyết tất cả; biết rõ tenant nào mang theo địa lý riêng của họ.

*Tiếp theo — Phần 10: Data platform trong ngành có kiểm soát.*
