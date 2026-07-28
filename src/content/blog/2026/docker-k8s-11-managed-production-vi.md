---
title: 'Managed Kubernetes & câu hỏi ECS'
description: 'Dịch vụ họ EKS thật sự quản gì (và gì vẫn là của bạn), quyết định EKS-vs-ECS-vs-serverless thật thà, chi phí thật của việc chạy Kubernetes, và khi nào đáp án là "không phải K8s."'
date: 2026-09-02
category: DevOps
tags: [docker-k8s, kubernetes, aws]
lang: vi
translationKey: docker-k8s-11
series: docker-k8s
part: 11
cover: images/s11-p11-hero.png
---


Bài 7–10 dạy bạn khái niệm Kubernetes. Bài này hỏi câu hỏi trưởng thành: **team bạn có nên thật sự vận hành nó không — và ở dạng nào?** Câu trả lời thật thà cho đa số team có chữ "managed", thường có sự giản dị của họ ECS, và đôi khi là không orchestrator nào cả. Hiểu khái niệm *và* từ chối vận hành chúng là một lập trường senior, không phải trốn việc.

## Bạn sẽ học được gì

- Nói được dịch vụ managed Kubernetes cất hộ bạn thứ gì — và danh sách dài những thứ vẫn nằm trên vai bạn.
- Chọn giữa họ EKS, họ ECS, và serverless container theo hình dạng workload và hình dạng team.
- Ước lượng chi phí *thật* của việc chạy K8s: thuế nền tảng đo bằng thời-gian-engineer.
- Nhận diện ba tình huống mà đáp án đúng hoàn toàn không phải Kubernetes.

**Cần biết trước:** Bài 6–10 (những khái niệm đang được mua/quản hộ). Bản đồ lựa chọn compute của S04-P08 là góc nhìn phía AWS của quyết định hôm nay.

## 1. "Managed" thật sự quản cái gì

Dịch vụ họ EKS (EKS, GKE, AKS) chạy hộ bạn **control plane**: API server, etcd, scheduler — sẵn sàng cao, được vá, được backup. Đó là phần tự host khổ sở thật sự, và khoảng $70 mỗi tháng mua được lối thoát. Chấm hết, sản phẩm là thế.

Giờ tới danh sách thật thà của những gì **vẫn là của bạn**: node pool (chọn size, nâng cấp, vá OS), nâng version cluster (cỡ mỗi quý, kèm bài tập deprecation — cái máy chạy bộ không bao giờ dừng), add-on networking, ingress controller ("luật cần động cơ" của bài 8), monitoring, tích hợp secrets, thiết kế RBAC, quản chi phí, và mọi quyết định workload từ bài 7–10. "Managed Kubernetes" quản cái động cơ; **bạn vẫn phải lái, đổ xăng, mua bảo hiểm và bảo dưỡng chiếc xe.** Team nghe "managed" và mong đợi Heroku; thứ họ nhận là một khối động cơ được bảo trì tốt.

## 2. Quyết định ba ngả, thật thà

Bài 6 xem trước cái bảng; giờ bạn đã đủ từ vựng để dùng nó. Điểm phân biệt không phải tính năng — cả ba đều chạy container sau load balancer có autoscaling. Mà là **bạn muốn sở hữu bao nhiêu phần nền tảng**:

- **Serverless container** (họ Fargate/Cloud Run): bạn sở hữu một image và một con số CPU/RAM. Không tồn tại node nào cho bạn. Scale về không. Giới hạn: cold start, không daemonset/privileged pod, giá theo vCPU vượt điểm hoà vốn khi tải đều.
- **Họ ECS**: task definition thay cho YAML Pod, tích hợp sâu với LB/IAM/logging của cloud nhà, bề mặt khái niệm chỉ bằng một phần nhỏ của K8s. Giới hạn: một cloud, hệ sinh thái nhỏ hơn, ít cửa thoát khi bạn muốn thứ gì kỳ lạ.
- **Kubernetes (managed)**: trọn bộ khái niệm bạn vừa học, cả hệ sinh thái CNCF (operator, Helm chart, service mesh), tính di động giữa các cloud, và chuẩn thị trường tuyển dụng. Giá: toàn bộ danh sách "vẫn là của bạn" ở mục 1.

Hình dạng đáp án đúng theo team: **team sản phẩm với dăm ba service trên một cloud → họ ECS hoặc serverless. Platform team phục vụ nhiều team sản phẩm, hoặc thật sự cần hệ sinh thái (operator, xếp lịch GPU, đa cloud) → managed K8s.** Khái niệm bạn học chuyển giao bất kể chọn gì — task definition của ECS là Pod template với tên trường khác; service của nó là Deployment cộng Service. Giờ bạn đọc trôi cả hai.

## 3. Thuế nền tảng, đo bằng con người

Dòng chi phí không hiện trên hoá đơn cloud: **ai nâng cấp cluster?** Một hệ K8s thật cần ai đó (thực tế là một ca trực xoay) theo dõi deprecation từng version, test nâng cấp ở staging, bảo trì bộ ingress/monitoring/secrets, và trả lời câu "sao pod của em Pending?" từ các team khác. Cách nói gọn của ngành: đó là những phần đáng kể của một tới vài engineer, liên tục — một khoản **thuế nền tảng** trả bằng đồng tiền khan hiếm nhất của bạn, sự chú ý của engineer (đúng lập luận ngân sách của câu hỏi database bài 9, cao hơn một tầng).

Thuế đáng trả khi nó được *chia đều*: platform team phục vụ mười team sản phẩm trả thuế một lần, và mỗi team nhận pattern deploy của bài 10 như một con đường trải sẵn. Một startup ba người trả cùng khoản thuế cho hai service là đang tiêu một phần ba lực lượng kỹ thuật vào đường ống. Cùng một tool, hai phán quyết ngược nhau — mẫu số là số team được phục vụ.

## 4. Khi đáp án là "không phải Kubernetes"

Ba lối ra thật thà, đều đáng trọng:

1. **Checklist bài 6 chưa bao giờ lật.** Một hai máy, cửa sổ deploy dễ tính, một người hiểu cả hệ → Compose trên VM cộng một script deploy vẫn là lựa chọn *chuyên nghiệp*, không phải nỗi xấu hổ tạm bợ.
2. **Traffic thấp hoặc nhọn** → serverless container: scale-về-không thắng kinh tế cluster-ngồi-chơi, và bề mặt vận hành làm tròn về số không.
3. **Team sản phẩm thuần AWS** → họ ECS: 80% lợi ích, 20% số khái niệm. Đây là "câu hỏi ECS" được trả lời không bộ lạc: chọn tool nhỏ hơn *vì bạn hiểu tool lớn hơn* là kỹ thuật; chọn nó vì sợ tool lớn hơn là ăn may.

Cái bẫy cần né năm 2026 là hạ tầng chạy-theo-CV: nhận K8s vì nó là chuẩn, không có platform team, rồi tháng thứ ba phát hiện cái máy chạy bộ. Bẫy ngược cũng tồn tại — đã lớn vượt ECS (chỉ thị đa cloud, nhu cầu hình-operator) mà trì hoãn di cư vì tiếc chi phí chìm. Khái niệm thì di động; tái quyết định mỗi năm rẻ hơn nhiều so với vận hành đáp án sai.

## Thực hành (20 phút — bài tập quyết định, không cần cluster)

Lấy một hệ bạn hiểu rõ (hoặc compose stack bài 4) và viết một memo quyết định một trang:

1. **Hình dạng workload:** bao nhiêu service, kiểu traffic (đều/nhọn/đêm-về-không), có gì kỳ lạ không (GPU, daemon, privileged)?
2. **Hình dạng team:** ai sẽ sở hữu nền tảng? Có platform team không, hay engineer sản phẩm phải trả thuế?
3. **Chấm ba lựa chọn** bằng lăng kính mục 2; loại cái nào phạm ràng buộc cứng.
4. **Viết phán quyết thành một câu kèm điều kiện xem lại:** "Chọn X; xem lại khi Y" (vd "ECS; xem lại khi có 3+ team hoặc yêu cầu đa cloud").

Kết quả mong đợi: một memo mà phán quyết suy ra từ ràng buộc đã nêu, không phải từ sở thích — và một điều kiện xem lại, thứ tách một quyết định khỏi một tôn giáo. So memo với đồng nghiệp cho một hệ khác; phán quyết *nên* khác nhau.

## Tự kiểm tra

1. CTO nói "mình mua EKS rồi, Kubernetes coi như xong." Sửa lại cho chính xác thế nào?
2. Startup 4 engineer chạy ba service traffic đều trên AWS. Chọn gì, vì sao — và điều gì làm đáp án đổi?
3. Vì sao khái niệm Kubernetes ở bài 7–10 vẫn sinh lời nếu team bạn chọn ECS hay serverless?

<details><summary>Xem đáp án</summary>

1. EKS quản control plane (API server, etcd, scheduler). Vòng đời node, nâng version, ingress, monitoring, RBAC, và mọi quyết định workload vẫn là việc của team — "managed" mua cái động cơ, không mua người lái.
2. Họ ECS (hoặc serverless nếu traffic nhọn): một cloud, ít service, không platform team — thuế của K8s không có mẫu số ở đây. Đáp án đổi khi xuất hiện platform team, số service/team tăng, hoặc nhu cầu hệ sinh thái (operator, GPU, di động đa cloud).
3. Vì các khái niệm là từ vựng chung của ngành cho orchestration: desired state, replica, probe, rolling deploy, requests/limits tồn tại ở mọi lựa chọn dưới tên khác nhau. Học một lần là đọc được mọi nền tảng — và biến việc chọn nền tảng thành lựa chọn có hiểu biết.

</details>

## Điều cần nhớ

- Managed K8s quản control plane; node, nâng cấp, ingress, monitoring và mọi quyết định workload vẫn của bạn — một động cơ, không phải tài xế riêng.
- Chọn theo mức sở hữu nền tảng: serverless (sở hữu image), họ ECS (sở hữu service trên một cloud), K8s (sở hữu nền tảng — hời nhất khi chia cho nhiều team).
- Chi phí thật là thuế nền tảng bằng sự chú ý engineer; nó được biện minh bằng số team phục vụ, không phải độ to của workload.
- "Không phải Kubernetes" là đáp án chuyên nghiệp theo ba lối: Compose-trên-VM, serverless, họ ECS — mạnh nhất khi được chọn bởi người hiểu rõ thứ mình đang từ chối.

*Bài tiếp theo — Phần 12: CI/CD, security & tư duy container.*
