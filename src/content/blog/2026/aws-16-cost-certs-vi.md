---
title: 'Tối ưu chi phí AWS & lộ trình cert'
description: 'Playbook chi phí lắp từ mười sáu phần, nghi thức 30 phút hằng tháng, lộ trình certification thật thà, và tấm bản đồ hồi kết của cả series.'
date: 2026-08-04
category: Cloud
tags: [aws, cost, certification, career]
lang: vi
translationKey: aws-16
series: aws-zero-to-advanced
part: 16
---

Series mở màn (P01) bằng mental model rằng mọi thứ trên AWS là một cú gọi API có đồng hồ đo, và nỗi sợ đi kèm — cái hoá đơn bất ngờ. Mười sáu phần sau, bạn sở hữu mọi đòn bẩy điều khiển chiếc đồng hồ đó, nên hồi kết làm hai việc: lắp ráp **playbook chi phí** bạn đã gom nhặt từng mảnh, và trải ra **lộ trình certification** một cách thật thà — cert đáng giá gì, không đáng giá gì, và series này map vào chúng ra sao.

## Bạn sẽ học được gì

- Chạy playbook chi phí bốn nước đi theo đúng thứ tự sinh lời, và biết vì sao thứ tự quan trọng.
- Giữ một nghi thức chi phí hằng tháng tốn ba mươi phút chứ không phải một dự án.
- Quyết định thật thà xem một chứng chỉ có đáng thời gian của bạn không, và chứng chỉ nào.
- Mang theo năm câu hỏi sống lâu hơn mọi tên dịch vụ trong series này.

**Cần biết trước:** Cả series — đây là chỗ nó khép lại.

## 1. Playbook bạn đã sở hữu sẵn

Mọi bài học chi phí trong series này thật ra là một trong bốn nước đi, xếp theo thứ tự đòn bẩy:

1. **Khiến chi tiêu nhìn thấy được** — không ai tối ưu nổi một bí ẩn. Tag mọi thứ (P10/P13: team, feature, môi trường — cưỡng chế bằng IaC của P11 để resource không tag fail ngay ở review), Cost Explorer nhóm theo các tag đó, budget kèm alert (chiếc billing alarm ngày-đầu của P02, nay đã trưởng thành), và anomaly detection cho các cú spike không ai hoạch định. Scan limit theo workgroup của P13 và người anh em — quota LLM theo feature (S03-P13) — là cùng một ý: *trần quyết trước hoá đơn*.
2. **Xoá và tắt** — nước đi ROI cao nhất và kém hào nhoáng nhất (bản năng của S02-P14): cái endpoint dev bị quên (chuyện hoá đơn của P14), volume không gắn và snapshot già (lifecycle rule của P04 sinh ra cho việc này), load balancer idle, cái môi trường không ai đụng từ tháng Ba. Lập lịch cho dev ngủ đêm (phân biệt stop-vs-terminate của P03 kiếm tiền ở đây) — một đội máy dev chạy 24/7 là trả tiền 128 giờ mỗi tuần cho không-ai-cả.
3. **Right-size và tái kiến trúc** — khớp dung lượng với tải đã đo (P03 + percentile của P10), lifecycle storage theo access pattern (P04, bài học layout của P13), và ưu tiên các hình dạng scale-về-không cho việc spiky (serverless P07, queue P09) — kiến trúc *chính là* kế hoạch chi phí (các pillar của P15 gật đầu với nhau).
4. **Rồi mới mua discount** — Savings Plans/Reserved cho phần sàn ổn định đã *đo được* (không bao giờ cho hy vọng), Spot cho việc ngắt được (P03, training job của P14). Đứng cuối là có chủ đích: discount trên sự lãng phí vẫn là lãng phí — commit trước bước 2–3 là khoá sự lãng phí lại.

Nghi thức giữ cho nó chạy là **buổi review 30 phút hằng tháng**: top biến động theo tag, một danh sách xoá, một ứng viên right-size, xong. Việc chi phí là làm vườn, không phải một dự án (bài học văn hoá của S02-P12: chủ sở hữu và nhịp đều thắng chủ nghĩa anh hùng).

## 2. Certification: cẩm nang thật thà

Cert là một *tín hiệu và một giáo trình*, không phải một kỹ năng. Chúng đáng tiền thật trong consulting và hệ sinh thái partner, là lực ép tốt cho độ rộng kiến thức, và chứng minh chính xác con số không về việc bạn có debug nổi một route table VPC lúc 2 giờ sáng hay không (P05 mới chứng minh điều đó). Với sự hiệu chuẩn đó, con đường:

- **Cloud Practitioner (CLF)** — bậc từ vựng. Chỉ đáng nếu bạn hoàn toàn mới hoặc công ty đếm huy hiệu; độc giả của series này nhảy thẳng qua được.
- **Solutions Architect Associate (SAA)** — *cái* cert đáng thi: rộng, theo tình huống, và gần như là superset của series này (P01–P15 là phần lớn giáo trình — phần này đóng nốt mảng chi phí). Lời khuyên ôn thi thật sự hiệu quả: đề practice dạy *kiểu câu hỏi*; tài khoản free-tier từ P01 và các mục hands-on của P02–P08 dạy nội dung. Xây trước, học sau — kỳ thi thưởng cho người đã từng thấy các error message trên console.
- **Sau SAA, đi theo công việc, đừng đi theo bộ sưu tập**: nhánh SysOps/DevOps nếu bạn vận hành (địa bàn P10–P12), specialty Data nếu S02 là làn của bạn (P13), specialty ML nếu là S03 (P14), Solutions Architect Professional khi bạn làm kiến trúc đa account thật (pattern org của P12, các bậc DR của P15). Sưu tập cert không dùng là abstraction suy đoán của S01-P10, in ra giấy.
- Một cảnh báo nói thẳng: **đáp án "đúng" của kỳ thi là đáp án AWS-native** — kiến trúc thật đôi khi bất đồng (kỷ luật lối-thoát của S02-P14, lăng kính lock-in của S07-P03). Giữ cả hai sự thật: trả lời bài thi như AWS, thiết kế hệ thống như một kỹ sư.

## 3. Tấm bản đồ, lắp xong — và series khép lại

Nhìn lại vòng cung: nền móng và danh tính (P01–P02), compute/storage/network (P03–P05), database và serverless (P06–P08), xương sống messaging và observability (P09–P10), kỷ luật hạ tầng (P11–P12), platform data và AI (P13–P14), và phán đoán kiến trúc (P15–P16). Đó là bộ từ vựng làm việc của một cloud engineer — và, một cách có chủ đích, là một phần tư của giáo trình lớn hơn: **CS Foundations (S01)** trao bạn chiếc máy tính bên dưới đám mây, **Lộ trình DE (S02)** các hệ dữ liệu bên trên, **Lộ trình AI (S03)** tầng trí tuệ, và **Các kiến trúc Data Platform (S07)** sự phán đoán để ghép chúng theo từng khách hàng và use case. Bốn series, một mệnh đề: tool già đi, *câu hỏi* thì không. Nó tốn bao nhiêu, cái gì vỡ trước, ai truy cập được, làm sao biết nó đang chạy, và chuyện gì xảy ra ở 10× — mang năm câu hỏi đó vào bất kỳ đám mây nào, stack nào, thập kỷ nào.

Series hoàn tất — và cùng với nó, trọn bộ giáo trình.

## Thực hành (30 phút — chạy nghi thức hằng tháng một lần, cho tử tế)

Tuyên bố của bài này là kiểm soát chi phí giống làm vườn chứ không phải một dự án. Hãy chứng minh bằng cách làm trọn một lượt ngay bây giờ và bấm giờ chính mình.

```bash
# NƯỚC ĐI 1 — làm nó hiện hình (10 phút). Không quản được thứ không nhìn thấy.
aws ce get-cost-and-usage --time-period Start=$(date -d '2 months ago' +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[].{month:TimePeriod.Start,items:Groups[?Metrics.UnblendedCost.Amount>`50`].[Keys[0],Metrics.UnblendedCost.Amount]}'

# NƯỚC ĐI 2 — xoá và tắt (10 phút). Resource rẻ nhất là resource không chạy.
aws ec2 describe-volumes --filters Name=status,Values=available \
  --query 'Volumes[].[VolumeId,Size,CreateTime]' --output table          # không gắn vào đâu cả
aws ec2 describe-addresses --query 'Addresses[?AssociationId==null].[PublicIp]' --output table
aws rds describe-db-instances --query 'DBInstances[?DBInstanceStatus==`available`].[DBInstanceIdentifier,DBInstanceClass]' --output table
aws ec2 describe-snapshots --owner-ids self --query 'length(Snapshots)'   # bao nhiêu cái, và cũ cỡ nào?

# NƯỚC ĐI 3 — right-size (7 phút). So công suất đã cấp với mức dùng thật.
#   Với top-3 dịch vụ tốn tiền nhất, xem metric mức sử dụng trong 30 ngày qua.
#   Thứ gì liên tục dưới ~20% là ứng viên giảm cỡ, không phải cơ hội mua giảm giá.

# NƯỚC ĐI 4 — giờ mới mua giảm giá.
#   Cam kết chỉ áp cho phần dùng nền ổn định SAU nước đi 1-3. Mua trước là khoá chặt sự lãng phí.
```

Kết quả mong đợi: cả lượt nên tốn khoảng ba mươi phút, và nước đi 2 gần như luôn tìm ra thứ gì đó — volume không gắn vào đâu, một database nằm không, hàng trăm snapshot bị quên. Thứ tự mới là bài học thật: một khoản giảm giá mua trước khi dọn dẹp sẽ cam kết bạn trả tiền cho sự lãng phí với đơn giá thấp hơn, trong suốt một năm. Hãy bấm giờ, rồi đặt nghi thức đó vào lịch hằng tháng; ba mươi phút lặp lại đều đặn thắng một dự án cắt giảm chi phí thường niên chỉ tới sau khi hoá đơn đã thành vấn đề.

## Tự kiểm tra

1. Sếp yêu cầu bạn cắt 30% chi tiêu cloud và gợi ý mua reserved capacity. Bạn trả lời thế nào?
2. Bạn đang cân giữa dành 40 giờ cho một chứng chỉ hay 40 giờ xây một project. Bạn chọn thế nào?
3. Thói quen chi phí duy nhất nào tự trả công cho nó vô thời hạn?

<details><summary>Xem đáp án</summary>

1. Đồng ý với mục tiêu, sắp lại thứ tự các nước đi. Giảm giá là nước đi thứ tư: mua nó trước là khoá bạn vào một năm trả tiền cho những resource bạn sắp xoá hoặc sắp giảm cỡ. Hãy chạy hiện-hình, xoá bỏ và right-size trước — chúng thường tự đạt được phần lớn con số 30% — rồi mới cam kết cho phần dùng nền ổn định còn lại.
2. Bằng việc bạn cần chứng minh điều gì, với ai. Chứng chỉ là một tín hiệu để lọt qua bộ lọc — hữu ích khi bạn cần qua vòng sàng, khi đổi hướng chuyên môn, hoặc khi nhà tuyển dụng yêu cầu. Project là bằng chứng — tốt hơn khi bạn cần cho thấy mình xây được thật. Nếu đã có project rồi thì chứng chỉ thêm phần tín hiệu; nếu chưa có gì cả, hãy xây trước, vì một tấm chứng chỉ không có gì đứng sau sống sót được khoảng một câu hỏi phỏng vấn.
3. Tagging được cưỡng chế ngay lúc tạo. Nó không tốn gì sau lần thiết lập đầu tiên và khiến mọi câu hỏi chi phí về sau trả lời được — cái này của ai, dùng để làm gì, xoá được không. Mọi thực hành chi phí khác đều phụ thuộc vào việc quy được khoản chi cho ai, nên nó là thói quen làm cho phần còn lại khả thi chứ không đơn thuần là thêm một mục trong danh sách.

</details>

## Điều cần nhớ

- Bốn nước đi theo thứ tự đòn bẩy: hiện hình chi tiêu (tag + budget + trần), xoá và tắt, right-size và tái kiến trúc, rồi mới mua discount — discount trên lãng phí vẫn là lãng phí.
- Việc chi phí là nghi thức 30 phút hằng tháng có chủ, không phải dự án anh hùng — và trần quyết trước hoá đơn thắng alarm sau hoá đơn.
- Cert là tín hiệu + giáo trình: nhảy thẳng tới SAA, xây trước học sau, rồi đi theo công việc — trả lời bài thi như AWS, thiết kế như một kỹ sư.
- Series hoàn tất: mười sáu phần từ vựng, năm câu hỏi cho cả đời — chi phí, bán kính vụ nổ, quyền truy cập, khả năng nhìn thấy, và chuyện gì ở 10×. Xem S01/S02/S03/S07 cho phần còn lại của giáo trình.
