---
title: 'Thiết kế theo chi phí: pattern FinOps'
description: 'Trên data platform, hoá đơn chính là một bài review kiến trúc: unit economics, tách storage/compute, quyết định pricing model, và catalog lãng phí kinh điển.'
date: 2026-07-28
category: Architecture
tags: [dp-architectures, finops, cost, data-platform]
lang: vi
translationKey: dp-arch-12
series: dp-architectures
part: 12
cover: images/dp-arch-finops.png
---

Suốt series, budget cứ xuất hiện như trục thứ tư. Phần này thăng nó lên vai chính — vì trên một data platform cloud, **chi phí không phải metric vận hành, mà là phản hồi thiết kế**. Mọi quyết định kiến trúc từ Phần 2–11 đều có một chiếc đồng hồ tiền gắn kèm, và đọc giỏi chiếc đồng hồ đó là một kỹ năng senior.

![Thiết kế theo chi phí: pattern FinOps](images/dp-arch-finops.png)

## Bạn sẽ học được gì

- Đo chi phí bằng đơn vị kinh tế, để một hoá đơn tăng thôi mập mờ.
- Áp bốn pattern cấu trúc làm đổi hình dạng của khoản chi, không chỉ đổi độ lớn.
- Nhận ra catalog lãng phí kinh điển, toàn thứ nhàm chán và không thứ nào là tuỳ chọn.
- Áp phép thử tách một platform khoẻ mạnh khỏi một platform sẽ làm bạn bất ngờ.

**Cần biết trước:** Phần 2-3 (lựa chọn lưu trữ và tính toán là nơi tiền đi). Phần đo đếm của Phần 9 nối thẳng vào đây.

## 1. Nỗi đau khai sinh

Thời on-premises, chi phí được quyết mỗi năm một lần ở phòng mua sắm. Cloud biến nó thành liên tục: mỗi query, mỗi cluster ngồi không, mỗi gigabyte lưu giữ đều tính tiền theo giây — chi tiêu bị phi tập trung xuống từng engineer, trong khi trách nhiệm giải trình vẫn tập trung ở một cuộc họp tháng không vui vẻ. FinOps là kỷ luật khép khoảng cách đó; *thiết kế* theo chi phí là nửa thuộc về platform.

## 2. Nguyên tắc: đo bằng đơn vị, không đo bằng tổng

Tổng hoá đơn tăng không nói lên gì — có khi business đang lớn. Nước đi FinOps là **unit economics**: chi phí mỗi query, mỗi lượt pipeline, mỗi dashboard, mỗi tenant (Phần 9), mỗi use case. Hai luật khiến nó chạy được:

1. **Tag mọi thứ lúc tạo ra** — pipeline, team, use case. Chi tiêu không tag là chi tiêu không quản được; biến tag thành yêu cầu lúc deploy, không phải việc nghĩ sau (governance-as-code, lại Phần 10).
2. **Công bố showback** — một bảng hằng tuần "use case của team bạn tốn X" thay đổi hành vi *mà không cần* một mệnh lệnh nào. Chargeback (thu tiền thật theo team) là tuỳ chọn; sự nhìn thấy thì không.

Các con số đơn vị sau đó lái kiến trúc: một dashboard tốn $30/tháng mỗi người xem là khoản chi hớ kiểu Phần 5; một pipeline mà chi phí chạy-lại chiếm phần lớn là bài toán idempotency (S02), không phải bài đàm phán chiết khấu.

## 3. Bốn pattern cấu trúc

**1. Tách storage khỏi compute — rồi đối xử khác nhau.** Storage rẻ và *giữ trạng thái*; compute đắt và *nên vứt được*. Đây là lý do lakehouse (Phần 3) thắng về kinh tế: dữ liệu ở open format trên object storage, engine bật lên theo workload rồi tắt. Anti-pattern là cluster luôn-bật "vì dữ liệu nằm đó" — dữ liệu không cần cluster; query mới cần.

**2. Phân bậc theo tần suất truy cập, tự động.** Các hạng storage hot / infrequent / archive với lifecycle rule (bronze quá N tháng → hạng lạnh). Đặt một lần lúc thiết kế, tiết kiệm mãi mãi. Cùng ý đó cho compute: pipeline production trên capacity ổn định, backfill và thí nghiệm trên spot/preemptible — việc batch retry được (idempotency lại trả lãi) đúng là thứ sinh ra cho compute rẻ có-thể-bị-ngắt.

**3. Chọn pricing model theo hình dạng workload.** Serverless/on-demand tính theo lần dùng — hoàn hảo cho việc bùng nổ theo đợt, tỷ lệ hoạt động thấp; đắt khi tải bền vững. Provisioned/committed thì ngược lại. Pattern cấp platform: **serverless ở rìa, committed ở lõi** — ELT hằng ngày đều đặn chạy trên capacity đặt trước, việc khám phá và bột phát chạy pay-per-use. Mỗi năm xem lại; workload trôi dạt.

**4. Đặt guardrail đúng chỗ tiền rò.** Query timeout và giới hạn scan (một cú `SELECT *` trên mười năm dữ liệu không partition là một tờ hoá đơn thật), budget alert theo team *kèm một owner*, auto-suspend cho compute ngồi không, và chính sách retention quyết từ lúc thiết kế — "giữ tất cả mãi mãi" cũng là một quyết định, chỉ là quyết định chưa ai soi.

## 4. Catalog lãng phí kinh điển

Đáng gọi tên, vì mọi cuộc audit platform đều tìm ra đúng năm món:

- **Tài nguyên zombie** — cluster dev và dashboard bị quên, refresh mỗi giờ cho khán giả bằng không.
- **Cú scan không partition** — đọc cả bảng nơi một filter ngày chỉ chạm 1%.
- **Real-time trang bị thừa** (cảnh báo Phần 4, quy ra tiền) — hạ tầng streaming cho báo cáo đọc mỗi tuần.
- **Retention theo mặc định** — storage giá cao ôm dữ liệu có thể không ai query, không một lifecycle rule.
- **Bài toán N-bản-sao** — cùng một dataset được bốn team materialize vì discovery thất bại (catalog cũng là một công cụ chi phí).

## 5. Chấm theo năm trục

- **Budget:** giờ chính là lăng kính — câu hỏi trở thành "chi tiêu có scale *dưới tuyến tính* so với mức dùng không?" Một platform có chi phí tăng nhanh hơn giá trị là sai về kiến trúc, bất kể sơ đồ đẹp cỡ nào.
- **Latency:** độ tươi có một đường cong giá dốc đứng dưới ngưỡng một giờ (Phần 4–5); hãy ghi giá bên cạnh mọi yêu cầu freshness.
- **Team:** FinOps cần một owner và một nhịp (review đơn vị hằng tuần), không phải một người hùng và một cuộc khủng hoảng.
- **Scale/Compliance:** tăng trưởng mà không có metric đơn vị *chính là* rủi ro; luật lưu trữ (Phần 10) đặt sàn cho các khoản tiết kiệm dựa trên xoá.

## 6. Ba khách hàng

- **Startup:** chương trình FinOps của bạn là ba cài đặt — auto-suspend, một budget alert, lifecycle rule — cộng bản năng Phần 8: không thuê hệ phân tán mình không cần.
- **Tầm trung:** tag enforce trong CI, showback theo use case hằng tháng, spot cho backfill, một lần review committed capacity mỗi năm.
- **Enterprise / multi-tenant:** metering per-tenant (Phần 9) hoà vào FinOps thành định giá sản phẩm; phân bổ chi phí thành điều khoản hợp đồng, và team platform vận hành nó như một P&L.

## Thực hành (25 phút — tính chi phí đơn vị của bạn, rồi đi tìm lãng phí)

Hai nửa: một phép tính dạng bảng tính làm đổi cách bạn đọc hoá đơn, và một cuộc săn qua catalog lãng phí trên một hệ thống bạn sở hữu.

**Nửa 1 — đơn vị kinh tế (10 phút).** Lấy hoá đơn platform tháng trước và một con số business lẽ ra phải dẫn dắt nó (số đơn xử lý, số khách hoạt động, số GB ingest). Điền bảng này cho ba tháng liên tiếp:

| Tháng | Tổng chi | Số đơn vị business | Chi phí mỗi đơn vị | Thay đổi so tháng trước |
|---|---|---|---|---|
| … | … | … | … | … |

Cột đáng giá là cột thứ tư. Một hoá đơn tăng 20% trong khi chi phí đơn vị giảm là một platform đang thành công; đúng hoá đơn đó với chi phí đơn vị đi ngang là một platform chỉ đơn giản bận hơn; chi phí đơn vị *tăng* mới là trường hợp duy nhất trong ba thật sự là vấn đề — và không điều nào trong đó nhìn thấy được từ con số tổng.

**Nửa 2 — săn lãng phí (15 phút).** Đi tìm từng thứ dưới đây trong một account thật, và ghi lại thứ bạn *tìm thấy* chứ không phải thứ bạn *đoán*:

```bash
# 1. Resource không tag — không quy được cái bạn không gán được cho ai
aws resourcegroupstaggingapi get-resources --query 'ResourceTagMappingList[?length(Tags)==`0`].ResourceARN' | head

# 2. Storage không có lifecycle rule — dữ liệu sẽ được trả tiền mãi mãi
aws s3api list-buckets --query 'Buckets[].Name' --output text | tr '\t' '\n' | while read b; do
  aws s3api get-bucket-lifecycle-configuration --bucket "$b" >/dev/null 2>&1 || echo "không lifecycle: $b"
done

# 3. Compute nằm không — con instance dev không ai tắt
aws ec2 describe-instances --filters Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].{id:InstanceId,type:InstanceType,since:LaunchTime}' --output table

# 4. Volume mồ côi và snapshot cũ — storage gắn vào hư không
aws ec2 describe-volumes --filters Name=status,Values=available --query 'Volumes[].[VolumeId,Size]' --output table
```

Kết quả mong đợi: nửa 1 thường lật ngược kết luận của ai đó — một hoá đơn trông đáng báo động hoá ra là tăng trưởng, hoặc một hoá đơn đi ngang hoá ra đang giấu hiệu quả đang xấu đi. Nửa 2 gần như luôn tìm ra thứ gì đó ở nhóm 1 hoặc 3, và resource không tag là phát hiện tệ nhất trong bốn nhóm vì nó khiến mọi câu hỏi chi phí sau này không trả lời được: bạn không quy được, không chargeback được, thậm chí không hỏi nổi "cái này của ai?" nếu không có tag. Hãy sửa tagging trước, rồi lifecycle rule, rồi các resource nằm không — đúng thứ tự đó, vì cái đầu tiên là thứ cho phép bạn đo những cái còn lại.

## Tự kiểm tra

1. Hoá đơn platform của bạn tăng 40% trong quý này. Bạn cần gì trước khi nói được đó có phải vấn đề không?
2. Một stakeholder tài chính hỏi team nào chịu trách nhiệm cho 60% chi phí lưu trữ, và bạn không trả lời được. Khoảng trống nền tảng là gì?
3. Vì sao "để sau rồi dọn storage" đắt hơn nghe tưởng?

<details><summary>Xem đáp án</summary>

1. Chi phí đơn vị, và con số business đứng sau nó. Tăng 40% kèm số đơn xử lý tăng 60% là một platform đang rẻ đi trên mỗi đơn vị; đúng mức tăng đó với khối lượng đi ngang là lãng phí thật. Con số tổng vốn dĩ mập mờ — chỉ số hữu ích là chi phí chia cho thứ mà business thật sự đếm.
2. Tagging và phân bổ. Thiếu một chính sách tag được cưỡng chế ngay lúc tạo, chi phí không quy được về team hay sản phẩm, nghĩa là không showback, không trách nhiệm, và không cách nào để những người đang tạo ra chi phí nhìn thấy nó. Đó là lý do tagging là biện pháp FinOps đầu tiên, không phải một việc dọn dẹp.
3. Vì chi phí lưu trữ cộng dồn: mỗi tháng không có lifecycle rule là thêm một lượng dữ liệu mà bạn phải trả tiền cho nó ở mọi tháng sau đó, và việc dọn dẹp khó dần khi khối lượng lớn lên và xuất xứ nhạt đi. Retention quyết lúc thiết kế tốn một cuộc trò chuyện; retention quyết ở năm thứ ba là một cuộc khai quật có kèm các câu hỏi pháp lý.

</details>

## Điều cần nhớ

- Chi phí là phản hồi thiết kế: đo bằng đơn vị ($/query, $/pipeline, $/tenant), tag lúc tạo, công bố showback.
- Bốn pattern cấu trúc: tách storage/compute, phân bậc tự động, khớp pricing model với hình dạng workload, guardrail các điểm rò.
- Catalog lãng phí dễ đoán — zombie, scan không partition, real-time thừa, retention mặc định, N-bản-sao; audit đúng năm món này.
- Bài test kiến trúc: chi tiêu phải scale dưới tuyến tính so với mức dùng. Không đạt → xem lại trường phái đã chọn.

*Tiếp theo — Phần 13: Kiến trúc migration: từ legacy sang modern không ngã.*
