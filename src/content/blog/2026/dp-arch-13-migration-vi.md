---
title: 'Kiến trúc migration: từ legacy sang modern không ngã'
description: 'Mọi platform sống lâu rồi cũng phải đi bộ giữa các trường phái. Strangler fig, parallel run với reconciliation, và cutover thiết kế như cánh cửa hai chiều.'
date: 2026-07-28
category: Architecture
tags: [dp-architectures, migration, strangler, data-platform]
lang: vi
translationKey: dp-arch-13
series: dp-architectures
part: 13
cover: images/dp-arch-migration.png
---

Phần 1 đã cảnh báo: kiến trúc là đồ thuê, không phải đồ mua đứt. Phần này nói về ngày chuyển nhà — kỷ luật để đi từ platform đang có sang trường phái đã chọn, **trong khi business vẫn đọc số hằng ngày**. Migration dữ liệu fail khác migration ứng dụng: app rollback được, nhưng một báo cáo hiện số sai suốt một tháng thì thiệt hại đã xong. Vì thế toàn bộ nghệ thuật nằm ở một câu: *không bao giờ sai trước công chúng.*

![Kiến trúc migration: từ legacy sang modern không ngã](images/dp-arch-migration.png)

## Nỗi đau khai sinh

Cú hích là một trong các tín hiệu tốt nghiệp của Phần 8, một vendor hấp hối, một license không trả nổi, hay một thương vụ M&A. Kế hoạch ngây thơ luôn giống nhau: "xây lại trên stack mới, cuối tuần chuyển, tắt đồ cũ." Nó fail vì đúng ba lý do, lần nào cũng vậy: hệ legacy mã hoá **logic business không tài liệu** (cái câu `CASE` kỳ quặc kia *chính là* định nghĩa doanh thu), consumer **đông hơn bất kỳ ai biết** (spreadsheet, cron job, API của một đối tác), và các vấn đề chất lượng dữ liệu được **phát hiện, chứ không được biết trước** — pipeline mới trung thành tái tạo những con số chưa ai nhận ra là sai, hoặc sửa chúng và làm gãy mọi đường trend.

Vậy nên luật tối thượng: **không big bang.** Mọi thứ bên dưới là cách mua lấy quyền được đi từ từ.

## Pattern 1 — Strangler fig: migrate theo use case, không theo layer

Đặt tên theo cây si bóp nghẹt: mọc quanh cây chủ cho tới khi cây chủ biến mất. Áp vào data platform: đừng migrate "cái warehouse" — migrate **từng báo cáo, từng pipeline, từng domain một**, mỗi cái chạy trọn đầu-cuối trên stack mới trong khi mọi thứ khác đứng yên.

```mermaid
flowchart LR
    S[Sources] --> L["Platform legacy<br/><i>co lại</i>"]
    S --> N["Platform mới<br/><i>lớn lên</i>"]
    L --> C1["Consumer (còn lại)"]
    N --> C2["Consumer (đã chuyển)"]
    L -. "từng use case một" .-> N
```

Hai luật khiến nó chạy. **Chọn use case đầu tiên để học, không phải để gây tiếng vang** — nhỏ, ít chính trị, nhưng chạm trọn con đường (ingest → transform → serve), để xả sớm các ẩn số của platform mới. Và **đóng băng legacy** theo từng mảnh đã chuyển: tính năng mới chỉ đáp lên stack mới, không thì cây si không bao giờ bóp xong. Anti-pattern là migrate theo layer ("toàn bộ ingestion trước") — bạn cõng cả hai platform nguyên trọng lượng suốt dự án mà không có gì được giao trọn vẹn.

## Pattern 2 — Parallel run + reconciliation: để con số tự kiếm niềm tin

Với use case nào mà con số quan trọng, chạy **cũ và mới song song** trên cùng đầu vào, và **đối soát tự động**:

```mermaid
flowchart LR
    I[Cùng đầu vào] --> OL["Pipeline legacy"]
    I --> NW["Pipeline mới"]
    OL --> R{"Reconciliation<br/><i>hằng ngày, tự động</i>"}
    NW --> R
    R -->|"đủ chuỗi ngày khớp"| CO["Cutover"]
    R -->|"lệch"| X["Giải thích: bug mới, hay legacy vốn sai?"]
```

Tay nghề nằm ở chi tiết: so ở nhiều độ hạt (tổng trước, rồi từng lát dimension — tổng có thể khớp trong khi từng phân khúc lệch tung toé); định nghĩa **tolerance từ đầu** (bit-identical thường bất khả giữa hai engine — thống nhất "bằng nhau" nghĩa là gì trước lượt chạy đầu tiên); và coi mỗi lần lệch là một ngã ba: *bug mới* (sửa) hay *legacy vốn sai* (ghi nhận, xin business ký duyệt con số mới — chuyện này xảy ra thường xuyên hơn mọi người tưởng rất nhiều). Chỉ cutover sau một **chuỗi ngày xanh đã thoả thuận trước**, không phải "khi thấy có vẻ ổn".

Parallel run tốn compute gấp đôi trong nhiều tuần. Đó không phải lãng phí; đó là giá của việc *không bao giờ sai trước công chúng* — và nó tạm thời, nên lăng kính Phần 12 phải tính nó là chi phí dự án, không phải run-rate.

## Pattern 3 — Backfill và cánh cửa hai chiều

Chuyển lịch sử có vật lý riêng: backfill theo **chunk có partition, idempotent, resume được** (câu thần chú S02 ở quy mô terabyte), validate số đếm từng chunk ngay khi đi, và chuẩn bị tinh thần quá khứ bẩn hơn hiện tại — các phiên bản schema không ai nhớ, timezone từng đổi, ID từng bị tái sử dụng.

Và thiết kế cutover như **cánh cửa hai chiều**: giữ đường legacy ấm (nhưng đóng băng) trong một khoảng thoả thuận sau khi chuyển, với đường quay lại đã tổng duyệt. Chỉ riêng việc tồn tại một kế hoạch rollback đã biến cutover từ một canh bạc thành một quyết định. Decommission — vạch đích thật — chỉ diễn ra sau khi một chu kỳ business trọn vẹn (thường là chốt sổ cuối tháng hoặc cuối quý) chạy ngon trên stack mới. Migration bỏ qua bước này chưa xong; nó đang *tạm dừng ở tư thế rủi ro nhất có thể*, và trả tiền cho hai platform vô thời hạn.

## Playbook trình tự

1. **Kiểm kê consumer trước tiên** — không thể bóp nghẹt thứ mình không nhìn thấy; query log và lineage của catalog (tooling Phần 10, tái sử dụng) tìm ra cái đuôi dài spreadsheet-và-cron.
2. **Use case đầu: học trên tiếng vang** (như trên).
3. **Đóng băng tính năng legacy** từ ngày đầu của mỗi mảnh đã chuyển.
4. **Parallel run nơi con số quan trọng; swap thẳng nơi không** (một dashboard khám phá nội bộ không cần chế độ đối soát).
5. **Cutover bằng bằng chứng** (chuỗi xanh), giữ cửa mở, decommission sau một chu kỳ trọn vẹn.

## Chấm theo năm trục

- **Team:** migration là một *chương trình*, không phải nhiệm vụ phụ — phải có người sở hữu bản kiểm kê, các chuỗi xanh, và kỷ luật đóng băng, không thì entropy thắng.
- **Budget:** chạy đôi là tạm thời nhưng có thật; thứ tự bóp nghẹt (mảnh legacy đắt nhất trước) có thể khiến migration tự nuôi mình.
- **Latency/Scale:** thường là *lý do* của cuộc chuyển — nhưng cưỡng lại việc nâng cấp latency giữa chừng; mỗi lần đổi một biến thôi.
- **Compliance:** hồ sơ reconciliation và audit trail của legacy-đóng-băng chính xác là loại bằng chứng mà chế độ Phần 10 đòi — migration làm kiểu này *cải thiện* tư thế audit của bạn.

## Ba khách hàng

- **Startup tốt nghiệp từ Phần 8:** open format biến nó thành dốc thoải — engine mới đọc cùng đống Parquet; "migration" có khi là một tuần đấu lại ống. Đây là phần thưởng của thiết kế có lối ra.
- **Tầm trung thay warehouse legacy:** trọn playbook ở trên, từng domain một, 6–18 tháng nếu nói thật; cái bẫy là dừng ở 80% rồi chạy cả hai mãi mãi.
- **Enterprise / có kiểm soát:** thêm cổng change-management cho từng cutover và bằng chứng đối soát nhìn được bởi cơ quan quản lý; chuỗi xanh parallel-run thành tiêu chí nghiệm thu chính thức, và cánh cửa hai chiều không phải tuỳ chọn.

## Điều cần nhớ

- Không big bang: migrate từng use case (strangler fig), đóng băng legacy theo từng bước — đừng bao giờ theo layer.
- Parallel run + đối soát tự động là cách con số kiếm niềm tin; thống nhất tolerance và ngưỡng chuỗi-xanh *trước* lần so đầu tiên.
- Backfill idempotent theo chunk; cutover là cánh cửa hai chiều; decommission chỉ sau một chu kỳ business trọn vẹn — đó mới là vạch đích.
- Chuẩn bị tinh thần phát hiện legacy đôi khi vốn sai; xin business ký duyệt *con số mới đúng* là một phần của migration, không phải việc gây xao nhãng.

*Tiếp theo — Phần 14: Chọn kiến trúc: một decision framework.*
