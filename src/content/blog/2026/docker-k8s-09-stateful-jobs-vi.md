---
title: 'State, storage & batch job trên K8s'
description: 'PersistentVolume và claim gỡ rối, khi nào thật sự cần StatefulSet, Job và CronJob cho việc pipeline — và câu trả lời thật thà cho "database có nên sống trong Kubernetes?"'
date: 2026-08-19
category: DevOps
tags: [docker-k8s, kubernetes, data]
lang: vi
translationKey: docker-k8s-09
series: docker-k8s
part: 9
cover: images/s11-p09-hero.png
---


Đến giờ ta vẫn coi Pod là đồ dùng-một-lần — giết một cái, bản thay thế y hệt xuất hiện. Được vậy vì chúng stateless. Nhưng hệ thống thật có database, queue, và pipeline chạy đêm — và "dùng-một-lần" chính xác là thứ database không thể là. Bài này nói về cách Kubernetes xử lý những thứ phải sống sót: volume, StatefulSet, và workload dạng batch — cộng câu hỏi mà team nào rồi cũng cãi nhau.

## Bạn sẽ học được gì

- Nối storage bền vững bằng tam giác PV → PVC → StorageClass, và nói được ai sở hữu mảnh nào.
- Quyết định khi nào một workload thật sự cần StatefulSet thay vì Deployment.
- Chạy việc pipeline bằng Job và CronJob — ý tưởng scheduling của series DE, trong cluster.
- Tranh luận câu "database trong K8s?" bằng lý lẽ thay vì cảm tính.

**Cần biết trước:** Bài 7–8. Bài học volume của bài 4 (Compose) là phiên bản một-máy của chủ đề hôm nay.

## 1. Tam giác storage: claim, đừng sở hữu

Compose (bài 4) có một máy, nên volume chỉ là một thư mục có tên. Cluster có N máy, và Pod của bạn có thể restart trên bất kỳ máy nào — nên storage phải là object *của cluster*, không phải của một node. Kubernetes chẻ nó làm ba:

| Object | Là gì | Ai tạo |
|---|---|---|
| **PersistentVolume (PV)** | Một khối storage thật (disk cloud, share NFS) | Cluster / provisioner |
| **PersistentVolumeClaim (PVC)** | Một *yêu cầu*: "tôi cần 10Gi, read-write" | Bạn, ngay cạnh YAML app |
| **StorageClass** | Mục catalog cấp PV theo nhu cầu ("fast-ssd", "cheap-hdd") | Platform team / mặc định cloud |

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pg-data
spec:
  accessModes: [ReadWriteOnce]        # mỗi lúc một node mount — như một cái disk
  storageClassName: fast-ssd          # mục catalog nào sẽ cấp
  resources: { requests: { storage: 10Gi } }
```

Pattern là sự gián tiếp có chủ đích: **app claim, platform cung cấp.** YAML của bạn nói "10Gi loại nhanh" và không bao giờ nêu tên disk — StorageClass cấp volume thật trên bất kỳ cloud nào bạn đang đứng. Đúng kiểu tách rời mà Service đã cho networking (bài 7): consumer nêu tên thứ mình cần, không phải nơi nó sống. Và cú chốt khiến nhiều người bất ngờ: dữ liệu của PVC **sống sót qua việc xoá Pod** — giết Pod, claim và volume còn nguyên, bản thay thế mount lại đúng dữ liệu cũ.

## 2. StatefulSet: khi danh tính quan trọng

Pod của Deployment hoán đổi được cho nhau — tên ngẫu nhiên, claim dùng chung, thứ tự tuỳ ý. Có những hệ không sống kiểu đó được: Postgres primary *không* hoán đổi được với replica của nó; thành viên cluster cần tên ổn định để tìm nhau. **StatefulSet** cho mỗi Pod ba thứ Deployment không cho:

- **Tên ổn định** — `pg-0`, `pg-1`, `pg-2` — sống sót qua reschedule (không phải đuôi ngẫu nhiên `web-7f9b...`).
- **PVC riêng** — `pg-0` luôn mount lại *đúng disk của nó*; replica không bao giờ tráo dữ liệu nhầm.
- **Thao tác có thứ tự** — `pg-0` khởi động trước `pg-1`; update lăn theo chiều ngược.

Phép thử là một câu hỏi: **các replica của thứ này có danh tính riêng biệt không?** Database, broker họ Kafka, thứ gì bầu leader → có, StatefulSet. API, worker pool, frontend — nơi replica nào phục vụ request nào cũng được → không, Deployment. Phân vân thì gần như chắc chắn là Deployment; với lấy StatefulSet "cho chắc" là tự mua ràng buộc thứ tự và volume theo-từng-Pod mà bạn không hề muốn.

## 3. Job và CronJob: pipeline bước vào cluster

Deployment giữ mọi thứ chạy *mãi mãi*; một pipeline nên chạy *tới khi xong*. Đó là **Job** — và **CronJob** là Job theo lịch:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
spec:
  schedule: "0 2 * * *"                 # cú pháp cron, 02:00 hằng ngày
  concurrencyPolicy: Forbid             # không bao giờ chạy chồng
  jobTemplate:
    spec:
      backoffLimit: 3                   # số lần retry trước khi bỏ cuộc
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: report
              image: myreports:2.1.0
              args: ["--run-date", "$(RUN_DATE)"]
```

Nếu bạn đã đọc series DE, YAML này là bạn cũ mặc áo mới: retry (`backoffLimit`) chạy được vì script exit khác 0 khi fail (hợp đồng exit-code của S02-P03), `concurrencyPolicy: Forbid` bảo vệ việc không-chạy-chồng-được, và chạy lại chỉ an toàn khi job **idempotent** — Kubernetes cấp scheduler, code của bạn vẫn phải cấp kỷ luật. Thứ CronJob *không* cho: phụ thuộc giữa các job, backfill, hay UI lịch sử chạy — khoảnh khắc job B cần output của job A là bạn đã lớn vượt CronJob và cần một orchestrator (họ Airflow, S02-P08). CronJob là cron có retry và log, không phải nền tảng pipeline.

## 4. Vậy... database có nên sống trong Kubernetes?

Cuộc tranh luận, nén thật thà:

- **Chạy trong cluster khi:** là dev/staging (nhanh, rẻ, vứt được); hoặc bạn có platform team vận hành thạo một operator chín muồi (các operator PG của cộng đồng tự động hoá backup, failover, upgrade); hoặc bạn on-prem không có lựa chọn managed.
- **Dùng database managed khi:** dữ liệu là production-critical và lợi thế của team bạn là *sản phẩm*, không phải vận hành database. Dịch vụ họ RDS (các phần data của S04) bán chính xác những phần khó: backup được kiểm, failover được tập dượt, upgrade là 2-giờ-sáng của người khác.
- Cái bẫy ở cả hai đường: **volume không phải backup.** PVC sống sót qua cái chết của Pod, không sống sót qua sự cố region, càng không qua `DELETE FROM` gõ nhầm cửa sổ. Chọn đường nào thì backup có kiểm-tra-restore vẫn là một hệ riêng, không thương lượng.

Với đa số team làm sản phẩm, mặc định thật thà năm 2026 vẫn là: thứ stateless trong cluster, state trong dịch vụ managed. Không phải vì K8s không làm được — operator giờ thật sự tốt — mà vì "làm được" và "có nên tiêu ngân sách đổi mới vào đó" là hai câu hỏi khác nhau (bài 11 áp đúng lập luận này cho chính cái cluster).

## Thực hành (20 phút — cluster local)

```bash
# 1. Chứng minh PVC sống lâu hơn Pod
kubectl apply -f pvc.yaml          # claim 10Gi ở mục 1 (StorageClass mặc định là được)
kubectl run scribe --image=alpine --overrides='{"spec":{"containers":[{"name":"scribe","image":"alpine","command":["sh","-c","echo survived > /data/proof.txt && sleep 3600"],"volumeMounts":[{"name":"d","mountPath":"/data"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"pg-data"}}]}}'
kubectl delete pod scribe                       # giết kẻ ghi
# tạo lại đúng pod đó, rồi:
kubectl exec scribe -- cat /data/proof.txt      # "survived" — claim đã giữ dữ liệu

# 2. Job có retry — xem bộ máy backoff bằng một job luôn fail:
kubectl create job doomed --image=alpine -- sh -c "exit 1"
kubectl get pods -l job-name=doomed -w          # xem retry backoff xuất hiện, rồi Ctrl-C

# 3. CronJob mỗi phút (để quan sát, không phải production)
kubectl create cronjob tick --image=alpine --schedule="*/1 * * * *" -- date
kubectl get jobs -w                             # mỗi phút một job mới; Ctrl-C sau hai cái
kubectl logs -l job-name=<tên-job-mới-nhất>     # output timestamp

# 4. Dọn dẹp
kubectl delete cronjob tick; kubectl delete job doomed; kubectl delete pod scribe; kubectl delete pvc pg-data
```

Kết quả mong đợi: Pod thứ hai ở bước 1 đọc được file Pod đầu đã ghi — storage tách khỏi vòng đời Pod, thấy bằng mắt mình. Bước 2 hiện Pod nhân bản với status `Error` khi bộ máy backoff retry. Bước 3 đúc mỗi phút một Job, cái nào cũng để lại log.

## Tự kiểm tra

1. Ai tạo PV, PVC, và StorageClass — và vì sao cách chẻ đó hữu ích?
2. Đồng đội muốn StatefulSet cho API "vì không được mất request." Gọi đúng chưa?
3. CronJob chạy đêm của bạn giờ cần chờ một job thượng nguồn và hỗ trợ backfill. Nước đi là gì?

<details><summary>Xem đáp án</summary>

1. Bạn viết PVC (yêu cầu); StorageClass (catalog của platform/cloud) cấp PV (disk thật) theo nhu cầu. Cách chẻ giúp YAML app giữ tính di động — nó nêu *cái gì* mình cần, còn platform quyết *cách* cung cấp theo từng môi trường.
2. Chưa — độ bền request không liên quan StatefulSet. Replica API hoán đổi được (không danh tính riêng, không disk riêng) nên là Deployment; chuyện không mất request in-flight giải bằng readiness probe, graceful shutdown, và retry ở tầng client/queue.
3. Tốt nghiệp lên orchestrator (họ Airflow): CronJob không có phụ thuộc giữa job, không có khái niệm backfill, không UI lịch sử chạy. Giữ nguyên container; dời phần scheduling.

</details>

## Điều cần nhớ

- Storage theo claim: app yêu cầu qua PVC, StorageClass cấp PV — và dữ liệu của claim sống lâu hơn mọi Pod.
- StatefulSet trả lời đúng một câu — "replica có danh tính riêng không?" Database có; API không. Mặc định là Deployment.
- Job chạy tới khi xong, CronJob theo lịch; retry và an toàn đến từ exit code + idempotency của bạn — còn phụ thuộc giữa job nghĩa là đã lớn vượt cron.
- Database *có thể* sống trong K8s (operator là thật); mặc định production vẫn là dịch vụ managed — và đường nào thì volume cũng không phải backup.

*Bài tiếp theo — Phần 10: Pattern deploy: rolling, blue-green, canary.*
