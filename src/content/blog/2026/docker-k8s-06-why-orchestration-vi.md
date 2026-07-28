---
title: 'Vì sao cần một orchestrator'
description: 'Theo chân một app đang lớn từ một Docker host tới bốn bài toán — đặt chỗ, tự chữa, tìm nhau, deploy — mà mọi orchestrator giải, và chọn giữa K8s, ECS, serverless một cách thật thà.'
date: 2026-08-05
category: DevOps
tags: [docker-k8s, kubernetes, devops]
lang: vi
translationKey: docker-k8s-06
series: docker-k8s
part: 6
cover: images/s11-p06-hero.png
---

Chặng A kết thúc với một lời thú nhận nằm ngay trước mắt: mọi thứ chạy trên *một máy*. Sản phẩm thật sẽ vượt cỡ một máy — và khoảnh khắc bạn có hai máy, một lớp bài toán hoàn toàn mới xuất hiện mà Docker một mình không giải nổi. Bài này gọi tên chính xác các bài toán đó, để Kubernetes (bài sau) xuất hiện như một câu trả lời hiển nhiên thay vì một mớ từ vựng ngoài hành tinh.

## Bạn sẽ học được gì

- Gọi tên 4 bài toán xuất hiện khi chạy container trên nhiều hơn một máy.
- Giải thích "desired state reconciliation" — một ý tưởng nằm dưới mọi orchestrator.
- So sánh 3 lựa chọn thực tế: Kubernetes, họ ECS, serverless container.
- Tự quyết một cách thật thà: mình đã cần orchestrator *chưa*?

**Cần biết trước:** Chặng A (bài 1–5), nhất là Compose (bài 4) — orchestration là các ý tưởng của Compose, phóng to ra.

## 1. Ngày một máy không còn đủ

Stack Compose bài 4 của bạn thành công. Traffic tăng. Bạn mua server thứ hai. Ngay lập tức, bốn câu hỏi không có câu trả lời thủ công tử tế:

1. **Đặt chỗ** — một container mới cần chạy. *Máy nào?* Máy còn memory trống? Bạn vừa thành một scheduler bằng cơm, check `htop` trên N host trước mỗi lần deploy.
2. **Tự chữa** — máy 2 chết lúc 3 giờ sáng. Các container của nó đơn giản là... thôi tồn tại. Ai phát hiện? Ai khởi động lại chúng ở nơi khác? (Trên một máy, `restart: always` xử lý được crash — nhưng không gì xử lý được *chính cái máy* chết.)
3. **Tìm nhau** — API trên máy 1 cần cái cache *từng ở* máy 2 nhưng đã được dựng lại sang máy 3. DNS theo tên của Compose (bài 4) chỉ chạy *trong mạng của một host*. Xuyên máy, ai giữ cuốn danh bạ?
4. **Deploy** — tung v2 cho 20 container trên 5 máy, mỗi lần vài cái, healthcheck từng cái, rollback khi fail — làm tay là một buổi chiều kinh hoàng mỗi release.

Từng bài toán giải được bằng script. Cả bốn cùng lúc, thay đổi mỗi giờ, là một công việc full-time. Công việc đó chính là **orchestrator**.

## 2. Một ý tưởng duy nhất: desired state reconciliation

Mọi orchestrator — Kubernetes, ECS, Nomad — trong tim là cùng một cỗ máy, và bạn đã biết nó từ Terraform (series IaC, bài 1):

```mermaid
flowchart LR
  D["TRẠNG THÁI MONG MUỐN<br/><i>'6 bản api:v2,<br/>mỗi bản 512MB'</i>"] --> C{"vòng lặp điều khiển<br/>(chạy mãi mãi)"}
  A["TRẠNG THÁI THỰC<br/><i>thứ đang thật sự chạy</i>"] --> C
  C -->|"phát hiện chênh lệch"| F["hành động: start, stop,<br/>di chuyển, dựng lại"]
  F --> A
```

Bạn khai báo *điều gì nên đúng*; một vòng lặp điều khiển so nó với *điều đang đúng* và sửa phần chênh — mãi mãi. Mọi tính năng đình đám đều là vòng lặp này mặc trang phục:

- Máy chết → thực tế rơi còn 4 bản → vòng lặp dựng 2 bản ở nơi khác. Đó là **self-healing** — không phải phép màu, chỉ là reconciliation.
- Bạn đổi mong muốn thành `api:v3` → vòng lặp thay container từng đợt. Đó là **rolling deploy**.
- Bạn đổi mong muốn thành 12 bản (hoặc autoscaler đổi) → vòng lặp tìm chỗ trên đội máy. Đó là **scaling**.

Cú chuyển tư duy, y hệt Terraform: **ngừng ra lệnh, bắt đầu khai báo kết quả.** Bạn không bao giờ bảo orchestrator "restart container kia" — bạn nói thứ gì nên tồn tại, và các cú restart tự rơi ra.

## 3. Ba lựa chọn thực tế của bạn

| | Kubernetes (EKS/GKE/AKS) | Họ ECS (managed, đơn giản hơn) | Serverless container (họ Fargate/Cloud Run) |
|---|---|---|---|
| Bạn quản | Khái niệm cluster, YAML, upgrade | Service definition, ít bề mặt hơn | Gần như không gì — image + CPU/RAM |
| Sức mạnh & hệ sinh thái | Tối đa — chuẩn công nghiệp | Đủ cho đa số workload web/API | Giới hạn có chủ đích |
| Gánh nặng ops | Có thật, kể cả managed | Thấp | Gần bằng không |
| Hình dạng chi phí | Cluster chạy 24/7 | Cluster hoặc capacity serverless | Scale về không |
| Hợp nhất khi | Platform team, nhu cầu phức tạp, tính khả chuyển | Team AWS-native ship service | Traffic spiky, team nhỏ, service đơn giản |

Chỉ dẫn thật thà cho 2026: **kỹ năng chuyển giao từ trên xuống, không phải từ dưới lên.** Học khái niệm Kubernetes (bài 7–10) là chuẩn bị cho cả ba — ECS là cùng vòng lặp reconciliation với ít núm hơn; serverless là vòng lặp đó với gần hết núm bị giấu đi. Vì thế khoá này dạy khái niệm K8s, rồi ở bài 11 hỏi câu thực dụng "vậy *team bạn* nên chạy gì?" (spoiler: thường không phải K8s trần).

## 4. Bạn đã cần chưa?

Checklist thật thà — nhiều khả năng bạn **chưa** cần orchestrator nếu: một-hai máy là đủ; cửa sổ deploy 5 phút lúc 2 giờ sáng chấp nhận được; và một người vẫn giữ được cả hệ thống trong đầu. Compose cộng policy `restart: always` gánh xa đến bất ngờ — và bỏ qua orchestrator là bỏ qua một khoản thuế ops có thật.

Bạn **cần** khi bất kỳ điều nào sau thành sự thật: một máy chết không được phép đánh thức ai; deploy phải zero-downtime và diễn ra thường xuyên; traffic dao động buộc thêm/bớt máy hằng tuần; hoặc nhiều team cùng ship lên hạ tầng chung. Lúc đó khoản thuế tự trả lãi — và bốn bài kế dạy bạn cách trả nó theo chuẩn.

## Thực hành (10 phút — thí nghiệm tư duy, không cần cluster)

Lấy stack Compose bài 4 và stress-test nó trên giấy:

1. Vẽ 3 service của bạn lên **hai** cái máy tưởng tượng. Tự quyết đặt chỗ — service nào ở đâu, vì sao? (Bạn vừa làm việc của scheduler.)
2. Giờ "giết" một máy bằng một nét bút. Liệt kê mọi bước phục hồi thủ công: phát hiện, quyết chỗ mới cho kẻ sống sót, khởi động, sửa connection string. Ước lượng thời gian từng bước một cách trung thực.
3. Viết câu trạng-thái-mong-muốn cho stack của bạn theo ngôn ngữ orchestrator: "N bản của X với Y memory, gọi được ở tên Z." Giữ câu này — bài 7 bạn sẽ viết nó thành YAML Kubernetes thật và xem vòng lặp làm hộ bước 1–2.

## Tự kiểm tra

1. `restart: always` khởi động lại container bị crash. Vì sao nó không giải được bài toán tự-chữa trong thế giới nhiều máy?
2. Ý tưởng duy nhất nằm dưới self-healing, rolling deploy và autoscaling là gì?
3. Startup 3 người chạy một API traffic vừa phải, ổn định trên hai server. Orchestrator bây giờ hay để sau — vì sao?

<details><summary>Xem đáp án</summary>

1. Restart policy của Docker sống *trên* một máy — khi chính máy đó chết, không còn gì đang chạy để restart bất cứ thứ gì. Tự chữa xuyên máy cần một giám sát viên bên ngoài có tầm nhìn toàn đội: orchestrator.
2. Desired-state reconciliation: một vòng lặp điều khiển mãi mãi so trạng thái khai báo với trạng thái thực và sửa phần chênh. Mỗi tính năng là một loại chênh lệch được sửa.
3. Nhiều khả năng để sau. Hai máy, traffic ổn định, team tí hon — Compose + restart policy + một script deploy đơn giản là ít thứ phải vận hành và học hơn. Checklist lật khi máy-chết phải im lặng, deploy phải zero-downtime, hoặc team/traffic tăng ép buộc.

</details>

## Điều cần nhớ

- Một máy giấu bốn bài toán; N máy phơi chúng ra: đặt chỗ, tự chữa, tìm nhau, deploy — bản mô tả công việc của orchestrator.
- Tất cả là một ý tưởng: desired state reconciliation — mental model của Terraform, chạy thành vòng lặp vĩnh viễn cho container.
- Ba lựa chọn thực tế (K8s, họ ECS, serverless container) chung ý tưởng đó; học khái niệm K8s là chuyển giao được cho cả ba.
- Đừng trả thuế ops trước khi buộc phải — Compose gánh hệ nhỏ rất xa; checklist nói cho bạn thời điểm lật.

*Bài tiếp theo — Phần 7: Kubernetes core: Pod, Deployment, Service.*
