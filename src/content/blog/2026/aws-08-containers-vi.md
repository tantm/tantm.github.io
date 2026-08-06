---
title: 'ECS, Fargate & ECR: chạy container trên AWS'
description: 'Image → registry → task → service: chuỗi bốn danh từ chạy container trên AWS, quyết định Fargate-vs-EC2, và câu trả lời thật thà khi nào mới thật sự cần EKS.'
date: 2026-08-03
category: Cloud
tags: [aws, ecs, containers, docker, aws-zero-to-advanced]
lang: vi
translationKey: aws-08
series: aws-zero-to-advanced
part: 8
---

CS-P5 kết thúc bằng câu mở khoá phần này: **container là một process khoác cgroup và namespace** — không phải một VM nhỏ. Lambda (P07) chạy *function* của bạn; container chạy *process* của bạn, bất kỳ process nào, với toàn bộ môi trường đông lạnh thành một image. Phần này là chuỗi AWS đưa một Dockerfile thành một service tự lành: bốn danh từ, một quyết định launch, và câu hỏi EKS được trả lời thật thà.

## Bạn sẽ học được gì

- Đọc chuỗi bốn danh từ (image → task definition → task → service) và nói mỗi tầng sở hữu gì.
- Chọn launch type Fargate hay EC2 từ hình dạng workload, không theo sở thích.
- Lắp bản triển khai chuẩn từ các mảnh mà các phần trước đã trao sẵn.
- Trả lời câu hỏi EKS một cách thật thà cho chính team mình.

**Cần biết trước:** Phần 2 (role), Phần 5 (subnet VPC và load balancer), Phần 3 (size instance, cho launch type EC2).

## 1. Chuỗi bốn danh từ

```mermaid
flowchart LR
    D["Dockerfile<br/><i>công thức</i>"] -->|build| I["Image<br/><i>filesystem đông lạnh + entrypoint</i>"]
    I -->|push| ECR["ECR<br/><i>registry (bên dưới là S3)</i>"]
    ECR -->|pull| T["Task<br/><i>container đang chạy + CPU/mem + IAM role</i>"]
    T -->|"được giữ sống bởi"| S["Service<br/><i>desired count · health check · nối LB</i>"]
```

- **Image** — ý tưởng bò-đàn của S04-P03 hoàn thiện: AMI-cộng-user-data nén thành một artifact di động, có version. Build một lần, chạy giống hệt trên laptop, CI, hay production (kỷ luật lockfile của S02-P03, áp cho cả hệ điều hành).
- **ECR** — cái registry. Hai thói quen đáng trộm từ ngày đầu: bật **image scanning** (CVE trồi lên lúc push, không phải lúc audit) và đặt **lifecycle policy** (image không tag chất đống trong im lặng — catalog zombie của S07-P12, phiên bản container).
- **Task definition** — đơn vị của sự chạy: image nào, bao nhiêu CPU/memory (các bức tường cgroup từ CS-P5 — `OOMKilled` ở 512 MB được quyết định tại đây), environment, và quan trọng nhất là **task role**: mỗi task nhận IAM role riêng (pattern P02, ở độ hạt mịn nhất — service orders đọc được bucket *của nó* và không gì khác).
- **Service** — lớp bọc tự lành: "giữ 3 task chạy, đăng ký chúng với load balancer, thay bất kỳ con nào trượt health check." Một task chết lúc 3 giờ sáng được thay trong im lặng; service là lý do không ai bị page (việc bắt SIGTERM từ CS-P5 quyết định cú thay đó êm tới đâu).

## 2. Quyết định launch: Fargate vs EC2

Cùng một task definition, hai cách có compute bên dưới:

| | **Fargate** | **EC2 launch type** |
|---|---|---|
| Bạn quản | Không gì dưới task | Các instance (vá, scale, xếp bin) |
| Giá | Theo task-giây, giá premium | Giá instance — rẻ hơn *nếu xếp khéo* |
| Hợp | Đa số service, tải bột phát, team nhỏ | Hạm đội lớn ổn định, task GPU, networking đặc biệt |

Mặc định thật thà là **Fargate**: phần giá premium mỗi đơn vị thường nhỏ hơn chi phí thời gian engineering (và công suất rảnh chưa xếp kín) mà instance tự-quản lặng lẽ ngốn — lập luận hoá-đơn-độ-phức-tạp của S07-P08, phiên bản container. Chọn EC2 launch type khi hạm đội đủ lớn và đủ ổn định để bài toán xếp bin thắng phép tính, hoặc khi cần tính năng mức instance (GPU, daemon agent). Và ở cả hai: **Fargate Spot / EC2 Spot cho workload chịu được ngắt** — các batch job idempotent của S02-P03 lại là khách hàng hoàn hảo.

Vị trí so với hàng xóm: Lambda cho keo dán hình-sự-kiện và API bột phát (phần rìa của P07), container cho **cái lõi ổn định** — service chạy dài, mọi thứ cần process bền (các server model của S03), những gì vượt tường 15-phút/payload của Lambda. Đúng đường cắt S07-P12 đã vẽ bằng giá.

## 3. Bản triển khai chuẩn, lắp ráp hoàn chỉnh

Mọi thứ của series này ghép thành web service kinh điển:

**ALB** (public subnet, S04-P05) → **ECS service** (task trong private subnet, không public IP) → task role đúng nhu cầu S3/DynamoDB của nó (P02/P04/P06) → security group tham chiếu security group ("ALB-SG được chạm app-SG cổng 8080" — kiến-trúc-thành-luật của P05) → log về CloudWatch (P10 kế tiếp). Deploy mặc định là **rolling**: service khởi động task phiên bản mới, chờ health check, rút cạn con cũ — image hỏng trượt health check và cú rollout dừng lại thay vì hạ gục production. Bạn vừa thấy mọi mảnh của sơ đồ này được xây từ nguyên lý qua bảy phần.

## 4. EKS: đoạn văn thật thà

Kubernetes (EKS) chạy cùng những container đó với một control plane giàu hơn, di động hơn, và nặng hơn rất nhiều. Chọn nó vì lý do thật: team *đã có sẵn* kỹ năng k8s, bạn cần hệ sinh thái (operator, Helm chart, service mesh), hoặc tính di động multi-cloud là yêu cầu thật — không phải yêu cầu trên slide. Ngoài ra, ECS+Fargate giao 90% giá trị với một phần nhỏ bề mặt vận hành (bài học mesh của S07-P07 vần điệu: nhận nuôi cỗ máy nặng vì nhu cầu tổ chức, không phải vì sân khấu hội thảo). Di cư về sau là việc thật nhưng có biên — image, kỷ luật registry, và các pattern IAM chuyển giao nguyên vẹn; thứ bị tráo chỉ là lớp bọc orchestration.

## Thực hành (40 phút — xem service hồi sinh một task bạn vừa giết)

Toàn bộ lý do tồn tại của một *service* (thay vì một task) là nó duy trì trạng thái mong muốn. Bước 3 là chỗ điều đó thôi là khẩu hiệu.

```bash
# 1. Một image tí hon, push lên ECR
mkdir ecs-lab && cd ecs-lab
printf 'FROM public.ecr.aws/nginx/nginx:alpine\n' > Dockerfile
ACCT=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)
aws ecr create-repository --repository-name ecs-lab >/dev/null
aws ecr get-login-password | docker login --username AWS --password-stdin $ACCT.dkr.ecr.$REGION.amazonaws.com
docker build -t ecs-lab . && docker tag ecs-lab:latest $ACCT.dkr.ecr.$REGION.amazonaws.com/ecs-lab:v1
docker push $ACCT.dkr.ecr.$REGION.amazonaws.com/ecs-lab:v1

# 2. Cluster + task definition (BẢN MẪU) + service (TRẠNG THÁI MONG MUỐN)
aws ecs create-cluster --cluster-name lab >/dev/null
#    đăng ký một task definition Fargate: 256 CPU / 512 MB, image của bạn, một execution role,
#    rồi tạo service với --desired-count 1 trong các public subnet của bạn.
#    (Dùng console cũng được — JSON của CLI dài và không phải bài học ở đây.)

# 3. BÀI HỌC: giết cái task và xem trạng thái mong muốn thắng
aws ecs list-tasks --cluster lab --query 'taskArns[0]' --output text     # ghi lại task id
aws ecs stop-task --cluster lab --task <task-arn> >/dev/null
sleep 5;  aws ecs list-tasks --cluster lab --query 'taskArns'            # trống một lát hoặc arn mới
sleep 45; aws ecs list-tasks --cluster lab --query 'taskArns'            # một task KHÁC, đang chạy

# 4. Đọc events log — service tự thuật lại cú reconcile của chính nó
aws ecs describe-services --cluster lab --services <ten-service> \
  --query 'services[0].events[:5].message'

# 5. Dọn dẹp: scale về 0, xoá service, rồi xoá cluster.
#    Nhớ rằng load balancer vẫn tính tiền theo giờ kể cả khi 0 task.
```

Kết quả mong đợi: sau `stop-task`, danh sách task hoặc trống hoặc hiện một task ARN hoàn toàn mới trong vòng một phút — bạn không restart gì cả, và bản thay thế là một task *khác*, không phải cái bạn vừa giết. Đó là vòng lặp reconciliation: service so desired count với thực tế rồi khép khoảng cách, chính là ý tưởng khai báo mà cả Terraform lẫn Kubernetes cùng chạy trên đó. Events log ở bước 4 đáng đọc một lần; nó nói bằng câu đơn giản rằng scheduler đã quyết gì và vì sao, và đó là chỗ nhìn đầu tiên khi một cú deploy đứng hình.

## Tự kiểm tra

1. Task definition, task và service khác nhau chỗ nào — và bạn đổi cái nào để deploy code mới?
2. Team bạn chạy 40 microservice traffic bột phát và không ai muốn đi vá hệ điều hành. Chọn launch type Fargate hay EC2, và vì sao?
3. ECS service của bạn kẹt: desired count 2, running count 0, và không lỗi nào rõ ràng. Bạn nhìn đâu trước?

<details><summary>Xem đáp án</summary>

1. Task definition là bản mẫu bất biến (image, CPU, memory, role, biến môi trường); một task là một bản đang chạy của bản mẫu đó; service giữ cho N task luôn chạy và thay thế khi có cái chết. Để deploy code mới, bạn đăng ký một revision task definition mới rồi cập nhật service trỏ sang nó — không bao giờ sửa một task đang chạy.
2. Fargate. Traffic bột phát nghĩa là bạn sẽ trả tiền cho công suất EC2 nằm không hoặc phải tự viết logic scale cho chính cái cluster, còn "không ai muốn vá hệ điều hành" đúng là gánh nặng vận hành mà Fargate gỡ đi. Launch type EC2 xứng với độ phức tạp của nó khi tải cao đều đặn, hoặc khi bạn cần GPU, loại instance cụ thể, hay tinh chỉnh theo từng host.
3. Events log của service — nó nêu lý do bằng ngôn ngữ đơn giản, và các nguyên nhân thường gặp đều hiện ở đó: task không pull được image (quyền registry trên execution role), hết capacity hoặc subnet không có route, container thoát ngay lập tức (lỗi ứng dụng, xem log), hoặc health check của load balancer fail nên task bị giết và thử lại thành vòng lặp.

</details>

## Điều cần nhớ

- Chuỗi là image → ECR → task → service: bò-đàn hoàn thiện, với task role là pattern P02 ở độ hạt mịn nhất.
- Fargate mặc định (phần premium rẻ hơn phần ops), EC2 launch type khi xếp bin hạm đội lớn ổn định thắng phép tính, Spot cho batch idempotent.
- Service tự lành và deploy rolling qua health check — graceful shutdown (CS-P5) quyết định độ êm.
- EKS dành cho team có kỹ năng k8s hoặc nhu cầu hệ sinh thái, không phải huy hiệu trưởng thành — ECS+Fargate là cái lõi mặc định thật thà, với Lambda ở rìa.

*Tiếp theo — Phần 9: SQS, SNS & EventBridge: tách rời hệ thống.*
