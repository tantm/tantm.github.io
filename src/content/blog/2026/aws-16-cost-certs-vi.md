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

## Playbook bạn đã sở hữu sẵn

Mọi bài học chi phí trong series này thật ra là một trong bốn nước đi, xếp theo thứ tự đòn bẩy:

1. **Khiến chi tiêu nhìn thấy được** — không ai tối ưu nổi một bí ẩn. Tag mọi thứ (P10/P13: team, feature, môi trường — cưỡng chế bằng IaC của P11 để resource không tag fail ngay ở review), Cost Explorer nhóm theo các tag đó, budget kèm alert (chiếc billing alarm ngày-đầu của P02, nay đã trưởng thành), và anomaly detection cho các cú spike không ai hoạch định. Scan limit theo workgroup của P13 và người anh em — quota LLM theo feature (S03-P13) — là cùng một ý: *trần quyết trước hoá đơn*.
2. **Xoá và tắt** — nước đi ROI cao nhất và kém hào nhoáng nhất (bản năng của S02-P14): cái endpoint dev bị quên (chuyện hoá đơn của P14), volume không gắn và snapshot già (lifecycle rule của P04 sinh ra cho việc này), load balancer idle, cái môi trường không ai đụng từ tháng Ba. Lập lịch cho dev ngủ đêm (phân biệt stop-vs-terminate của P03 kiếm tiền ở đây) — một đội máy dev chạy 24/7 là trả tiền 128 giờ mỗi tuần cho không-ai-cả.
3. **Right-size và tái kiến trúc** — khớp dung lượng với tải đã đo (P03 + percentile của P10), lifecycle storage theo access pattern (P04, bài học layout của P13), và ưu tiên các hình dạng scale-về-không cho việc spiky (serverless P07, queue P09) — kiến trúc *chính là* kế hoạch chi phí (các pillar của P15 gật đầu với nhau).
4. **Rồi mới mua discount** — Savings Plans/Reserved cho phần sàn ổn định đã *đo được* (không bao giờ cho hy vọng), Spot cho việc ngắt được (P03, training job của P14). Đứng cuối là có chủ đích: discount trên sự lãng phí vẫn là lãng phí — commit trước bước 2–3 là khoá sự lãng phí lại.

Nghi thức giữ cho nó chạy là **buổi review 30 phút hằng tháng**: top biến động theo tag, một danh sách xoá, một ứng viên right-size, xong. Việc chi phí là làm vườn, không phải một dự án (bài học văn hoá của S02-P12: chủ sở hữu và nhịp đều thắng chủ nghĩa anh hùng).

## Certification: cẩm nang thật thà

Cert là một *tín hiệu và một giáo trình*, không phải một kỹ năng. Chúng đáng tiền thật trong consulting và hệ sinh thái partner, là lực ép tốt cho độ rộng kiến thức, và chứng minh chính xác con số không về việc bạn có debug nổi một route table VPC lúc 2 giờ sáng hay không (P05 mới chứng minh điều đó). Với sự hiệu chuẩn đó, con đường:

- **Cloud Practitioner (CLF)** — bậc từ vựng. Chỉ đáng nếu bạn hoàn toàn mới hoặc công ty đếm huy hiệu; độc giả của series này nhảy thẳng qua được.
- **Solutions Architect Associate (SAA)** — *cái* cert đáng thi: rộng, theo tình huống, và gần như là superset của series này (P01–P15 là phần lớn giáo trình — phần này đóng nốt mảng chi phí). Lời khuyên ôn thi thật sự hiệu quả: đề practice dạy *kiểu câu hỏi*; tài khoản free-tier từ P01 và các mục hands-on của P02–P08 dạy nội dung. Xây trước, học sau — kỳ thi thưởng cho người đã từng thấy các error message trên console.
- **Sau SAA, đi theo công việc, đừng đi theo bộ sưu tập**: nhánh SysOps/DevOps nếu bạn vận hành (địa bàn P10–P12), specialty Data nếu S02 là làn của bạn (P13), specialty ML nếu là S03 (P14), Solutions Architect Professional khi bạn làm kiến trúc đa account thật (pattern org của P12, các bậc DR của P15). Sưu tập cert không dùng là abstraction suy đoán của S01-P10, in ra giấy.
- Một cảnh báo nói thẳng: **đáp án "đúng" của kỳ thi là đáp án AWS-native** — kiến trúc thật đôi khi bất đồng (kỷ luật lối-thoát của S02-P14, lăng kính lock-in của S07-P03). Giữ cả hai sự thật: trả lời bài thi như AWS, thiết kế hệ thống như một kỹ sư.

## Tấm bản đồ, lắp xong — và series khép lại

Nhìn lại vòng cung: nền móng và danh tính (P01–P02), compute/storage/network (P03–P05), database và serverless (P06–P08), xương sống messaging và observability (P09–P10), kỷ luật hạ tầng (P11–P12), platform data và AI (P13–P14), và phán đoán kiến trúc (P15–P16). Đó là bộ từ vựng làm việc của một cloud engineer — và, một cách có chủ đích, là một phần tư của giáo trình lớn hơn: **CS Foundations (S01)** trao bạn chiếc máy tính bên dưới đám mây, **Lộ trình DE (S02)** các hệ dữ liệu bên trên, **Lộ trình AI (S03)** tầng trí tuệ, và **Các kiến trúc Data Platform (S07)** sự phán đoán để ghép chúng theo từng khách hàng và use case. Bốn series, một mệnh đề: tool già đi, *câu hỏi* thì không. Nó tốn bao nhiêu, cái gì vỡ trước, ai truy cập được, làm sao biết nó đang chạy, và chuyện gì xảy ra ở 10× — mang năm câu hỏi đó vào bất kỳ đám mây nào, stack nào, thập kỷ nào.

Series hoàn tất — và cùng với nó, trọn bộ giáo trình.

## Điều cần nhớ

- Bốn nước đi theo thứ tự đòn bẩy: hiện hình chi tiêu (tag + budget + trần), xoá và tắt, right-size và tái kiến trúc, rồi mới mua discount — discount trên lãng phí vẫn là lãng phí.
- Việc chi phí là nghi thức 30 phút hằng tháng có chủ, không phải dự án anh hùng — và trần quyết trước hoá đơn thắng alarm sau hoá đơn.
- Cert là tín hiệu + giáo trình: nhảy thẳng tới SAA, xây trước học sau, rồi đi theo công việc — trả lời bài thi như AWS, thiết kế như một kỹ sư.
- Series hoàn tất: mười sáu phần từ vựng, năm câu hỏi cho cả đời — chi phí, bán kính vụ nổ, quyền truy cập, khả năng nhìn thấy, và chuyện gì ở 10×. Xem S01/S02/S03/S07 cho phần còn lại của giáo trình.
