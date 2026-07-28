---
title: 'Pattern deploy: rolling, blue-green, canary'
description: 'Ba cách thay thế phần mềm đang chạy, rollback thật sự nghĩa là gì ở từng cách, vì sao readiness probe làm "zero-downtime" thành sự thật, và HPA autoscaling — kèm chi phí thật thà.'
date: 2026-08-26
category: DevOps
tags: [docker-k8s, kubernetes, devops]
lang: vi
translationKey: docker-k8s-10
series: docker-k8s
part: 10
cover: images/s11-p10-hero.png
---


Bài 7 dạy bạn *khai báo* image mới và để vòng lặp hội tụ. Bài này nói về **cách** cuộc hội tụ đó diễn ra — vì "thay v1 bằng v2 trên một hệ đang sống" có ba đáp án kinh điển với chi phí khác nhau, câu chuyện rollback khác nhau, và kiểu hỏng khác nhau. Cộng pattern thứ tư đổi *bao nhiêu* thay vì *cái nào*: autoscaling.

## Bạn sẽ học được gì

- Chọn giữa rolling, blue-green, canary bằng bảng chi phí/rủi ro thay vì theo mốt.
- Cấu hình hai núm vặn của rolling update và giải thích `kubectl rollout undo` thật sự làm gì.
- Nói chính xác vì sao readiness probe (bài 8) là thứ làm "zero-downtime" thành sự thật.
- Dựng HPA (Horizontal Pod Autoscaler) và né cú cấu hình sai kinh điển của nó.

**Cần biết trước:** Bài 7–8 — Deployment, Service, và cả hai probe. Thực hành cần cluster local.

## 1. Rolling update: mặc định có sẵn

Deployment vốn đã rolling update — thay Pod từng đợt, có readiness gác cổng:

```yaml
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1     # tối đa hụt 1 so với số mong muốn trong lúc lăn
      maxSurge: 2           # tối đa dư 2 Pod trong lúc lăn
```

Đổi image, apply, và vòng lặp thay Pod theo đợt: khởi động Pod mới → chờ `/ready` → dồn traffic → cho Pod cũ nghỉ. Hai núm vặn đánh đổi **tốc độ lấy dung lượng**: `maxSurge` cao lăn nhanh nhưng cần chỗ trống; `maxUnavailable` cao lăn nhanh nhưng trong lúc đó phục vụ bằng ít Pod hơn.

Đây là chỗ readiness probe của bài 8 hết là lý thuyết: **Pod mới nhận đúng không traffic cho tới khi `/ready` gật.** Không probe (hoặc probe nói dối, trả 200 khi app còn đang khởi động) = user đập vào Pod nửa-tỉnh = màn "deploy zero-downtime" mà vẫn rơi request. Cái probe *chính là* số không trong zero-downtime.

Rollback có sẵn: `kubectl rollout undo deployment/web` — thực chất là một rolling update nữa, chạy ngược, về Pod template trước đó. (Chú ý thứ nó *không* undo: migration database của bạn. Đổi schema cần kế hoạch tương thích riêng — pattern deploy chỉ di chuyển thứ *stateless* một cách an toàn.)

## 2. Blue-green: hai môi trường, một công tắc

Chạy hai bản đầy đủ: **blue** (hiện tại, đang phục vụ) và **green** (mới, đứng chờ). Deploy v2 lên green, test trên hạ tầng thật, rồi gạt router — theo ngôn ngữ Kubernetes là patch selector của Service từ `version: blue` sang `version: green`. Toàn bộ traffic chuyển một phát.

- **Điểm hay:** cutover tức thì và trọn vẹn; rollback tức thì và trọn vẹn (gạt ngược); green test được trong điều kiện production *trước khi* user nào thấy nó.
- **Chi phí thật thà:** gấp đôi dung lượng khi cả hai cùng chạy; cú gạt là được-ăn-cả — nếu v2 có bug chỉ lộ ở full traffic thì 100% user gặp nó cùng lúc; và các mối stateful (session, request đang bay, schema DB dùng chung hai màu) cần suy nghĩ thật.

Blue-green toả sáng khi release thưa và tốc độ rollback là ưu tiên số một — và khi có người khác trả tiền cho phần dung lượng nhân đôi (các nền tảng managed của bài 11 hay biến nó thành một checkbox).

## 3. Canary: để 5% phát hiện trước

Ship v2 cho một lát nhỏ, canh error rate và latency, rồi nới dần: 5% → 25% → 100%. Cái tên là con chim trong mỏ than: một hy sinh nhỏ phát hiện khí độc trước khi tất cả cùng hít.

Mẹo Kubernetes thuần: Service định tuyến theo nhãn tới *các Pod ready xuyên nhiều Deployment*. Chạy `web-stable` 9 replica và `web-canary` 1 replica — cùng nhãn, khác image — Service chia traffic ~10% theo số Pod. Chạy được, nhưng thô (tỉ lệ nhảy theo bậc replica) và thủ công (bạn tự nhìn dashboard và tự scale). Điều khiển phần trăm thật và promote/rollback tự động đến từ tầng ingress/service-mesh hoặc các tool progressive-delivery (họ Argo Rollouts/Flagger) — đáng biết là có, và đáng *không* rước về trước khi có người thật sự cần canary.

Sự thật khó chịu về canary: **nó chỉ tốt bằng monitoring của bạn.** Một con canary không ai canh chỉ là một cú rolling update chậm. Chi phí thật của pattern này không phải compute — mà là dashboard, alert, và kỷ luật "metric nào quyết promote hay rollback?"

## 4. HPA: đổi số lượng, tự động

**Horizontal Pod Autoscaler** canh một metric và chỉnh `replicas` trong khoảng giới hạn:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: web }
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
```

Lại là reconciliation, cao hơn một tầng: số lượng mong muốn giờ được *tính* từ tải. Cú cấu hình sai kinh điển: HPA tính utilization **theo phần trăm của `resources.requests`** trong Pod (bài 7). Không set requests → HPA không có mẫu số → nó đứng im (hoặc làm bậy). Requests không phải sổ sách tuỳ hứng; nó là con số mà autoscaling làm toán trên đó.

Ghi chú thật thà thứ hai: HPA xử lý tải thay đổi *từ từ*. Cú spike 10× trong vài giây chạy nhanh hơn vòng scale-up (Pod mới cần pull + start + ready) — cho ca đó bạn cần headroom (`minReplicas` cao hơn đáy) hoặc một queue hứng cú nổ (bản năng buffering của series DE, áp vào serving).

## 5. Chọn: cái bảng

| | Rolling | Blue-green | Canary |
|---|---|---|---|
| Dung lượng thêm | ~`maxSurge` | ×2 bản đầy đủ | Một lát nhỏ |
| Tốc độ rollback | Phút (lăn ngược) | Giây (gạt lại) | Giây (giết canary) |
| Bán kính sát thương của release hỏng | Lớn dần trong lúc lăn | 100% tại cú gạt | Đúng % canary |
| Cần | Readiness probe | Công tắc router + hạ tầng đôi | Monitoring thật + kiên nhẫn |
| Mặc định khi | Đa số service, đa số ngày | Release hiếm, cược lớn | Service traffic cao, giàu metric |

Mặc định nhàm chán: rolling, với probe trung thực. Tốt nghiệp lên canary khi traffic và monitoring xứng đáng; với tới blue-green khi rollback-trong-giây đáng giá gấp đôi hạ tầng.

## Thực hành (25 phút — cluster local)

```bash
# 1. Deployment với image CŨ và probe trung thực (dùng block strategy ở mục 1)
kubectl create deployment web --image=nginx:1.26 --replicas=4 --dry-run=client -o yaml > web.yaml
#    sửa web.yaml: thêm block strategy + readinessProbe cổng 80, rồi:
kubectl apply -f web.yaml && kubectl expose deployment web --port 80

# 2. Xem rolling update diễn ra từng đợt (hai terminal)
#    T1:
kubectl get pods -w
#    T2:
kubectl set image deployment/web nginx=nginx:1.27
kubectl rollout status deployment/web          # tường thuật từng đợt

# 3. Rollback — và xem lịch sử
kubectl rollout undo deployment/web
kubectl rollout history deployment/web

# 4. Canary nhà nghèo: deployment thứ hai, cùng nhãn
kubectl create deployment web-canary --image=nginx:1.27 --replicas=1
#    (sửa template labels cho khớp selector của Service)
kubectl get endpoints web                      # pod canary xuất hiện giữa đám stable

# 5. Dọn dẹp
kubectl delete deployment web web-canary; kubectl delete service web
```

Kết quả mong đợi: bước 2 hiện Pod surge xuất hiện, đạt Ready, Pod cũ terminate — không bao giờ hụt quá `maxUnavailable` dưới 4. Bước 3 quay về 1.26 bằng đúng cơ chế từng-đợt đó. Bước 4: danh sách endpoints cho thấy ~1/5 endpoint là canary — chia traffic theo số Pod, nhìn thấy được trong tập endpoint của Service.

## Tự kiểm tra

1. Một team tuyên bố rolling deploy zero-downtime nhưng không có readiness probe. Thực tế chuyện gì xảy ra trong lúc lăn?
2. Khi nào blue-green đáng giá gấp đôi hạ tầng — và kiểu hỏng tệ nhất của nó so với canary?
3. HPA của bạn không bao giờ scale up dù tải rõ ràng. Trường nào kiểm đầu tiên, vì sao?

<details><summary>Xem đáp án</summary>

1. Pod mới vào Service ngay khi container khởi động — kể cả lúc đang warm-up, trước khi app phục vụ được. User đập vào Pod nửa-tỉnh và nhận lỗi/timeout; cú deploy "thành công" trong khi vẫn rơi request. Readiness gác cổng là thứ làm lời tuyên bố thành thật.
2. Khi rollback-trong-giây quan trọng hơn chi phí — release hiếm, cược lớn. Tệ nhất: bug chỉ lộ ở full traffic đập vào 100% user tại cú gạt; bug tương đương của canary chỉ đập vào đúng % canary — chính là lý do trả chi phí monitoring của canary.
3. `resources.requests` trên Pod đích. HPA tính utilization theo phần trăm của requests; không có requests thì không có mẫu số, autoscaler không hành động được. Requests là con số để làm toán.

</details>

## Điều cần nhớ

- Rolling là mặc định có sẵn: hai núm vặn (surge/unavailable), từng đợt có readiness gác — và cái probe là thứ làm zero-downtime thành thật.
- Blue-green mua rollback-trong-giây bằng dung lượng đôi; cú gạt là được-ăn-cả. Canary mua bán kính sát thương nhỏ bằng kỷ luật monitoring thật.
- `rollout undo` đảo Pod template, không đảo database — đổi schema cần kế hoạch tương thích riêng.
- HPA là reconciliation trên *số lượng*: nó làm toán trên `resources.requests` (không requests = không autoscale) và xử lý tải từ từ, không phải spike tức thì.

*Bài tiếp theo — Phần 11: Managed Kubernetes & câu hỏi ECS.*
