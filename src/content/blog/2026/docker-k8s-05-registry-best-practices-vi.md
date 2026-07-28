---
title: 'Registry, tag & best practices'
description: 'Push image đầu tiên, hiểu vì sao "latest" là một lời nói dối, và 5 thói quen — non-root, signal, healthcheck, config runtime, log stdout — khiến container sẵn sàng production.'
date: 2026-08-05
category: DevOps
tags: [docker-k8s, docker, security]
lang: vi
translationKey: docker-k8s-05
series: docker-k8s
part: 5
cover: images/s11-p05-hero.png
---

Image của bạn chỉ sống trên laptop cho tới khi nó vào một **registry** — nhà kho để các máy khác pull về. Bài này phủ bước vận chuyển, kỷ luật tag chống câu hỏi "đang chạy phiên bản nào vậy?", và 5 thói quen production. Nó khép chặng A: sau bài này, container của bạn sẵn sàng cho orchestration.

## Bạn sẽ học được gì

- Push/pull image với registry, và đọc đúng tên image.
- Giải thích vì sao tag là miếng dán di động, không phải version — và làm gì với điều đó.
- Áp 5 thói quen production: non-root, xử lý signal, healthcheck, config runtime, log stdout.
- Chạy một cú scan lỗ hổng và đọc kết quả một cách bình tĩnh.

**Cần biết trước:** Bài 1–4. Một tài khoản Docker Hub miễn phí (hoặc registry bất kỳ) cho phần thực hành.

## 1. Registry và giải phẫu tên image

Registry là object storage cho các layer image cộng một API. Docker Hub là bản public mặc định; các cloud có bản riêng (họ ECR); công ty chạy bản private. Mọi tên image có cùng giải phẫu:

```text
registry.example.com / team-hoac-user / ten-app : tag
└── ở đâu (mặc định: Docker Hub) ──┘ └─ cái gì ─┘ └bản nào┘
```

Workflow là ba lệnh:

```bash
docker build -t tenban/hello-api:0.1.0 .
docker push  tenban/hello-api:0.1.0
docker pull  tenban/hello-api:0.1.0     # máy nào cũng vậy, cùng một image
```

## 2. Tag: miếng dán di động, không phải version

Đây là sai lầm gây sự cố thật: coi tag như version. **Tag là một con trỏ** — miếng dán bóc từ image này dán sang image khác được. `myapp:latest` hôm nay và `myapp:latest` ngày mai có thể là *hai image hoàn toàn khác nhau*.

Hậu quả, theo độ nặng tăng dần:

- "Trên máy em chạy mà" quay lại: hai máy `pull latest` ở hai thời điểm và chạy hai bản code khác nhau.
- Một cú deploy "không có thay đổi" lại đổi hành vi, vì ai đó push `latest` mới trong đêm.
- Rollback thành bất khả: cái tag bạn định quay về *cũng đã dời đi*.

Kỷ luật sửa cả ba:

- **Ship tag version bất biến** (`:1.4.2`, hoặc commit git `:a1b2c3d`). Không bao giờ tái sử dụng.
- **`latest` dành cho người thử nghiệm local**, không bao giờ cho deploy. Đa số team đơn giản là cấm nó trong manifest production.
- Bậc hoang tưởng (an ninh chuỗi cung ứng): pull theo **digest** (`@sha256:...`) — mã băm nội dung *không thể* dời. Các hệ CI ngày càng ghim digest chính vì lý do này.

## 3. Năm thói quen production

Mỗi thói quen là một dòng Dockerfile hay config, và mỗi cái chặn một lớp sự cố thật:

**1. Chạy non-root.** Mặc định app chạy quyền root *bên trong* container. Cách ly container tốt nhưng chung kernel (bài 2) — một cú thoát khỏi container root tệ hơn nhiều. Hai dòng sửa xong:

```dockerfile
RUN adduser --system --no-create-home appuser
USER appuser
```

**2. Xử lý signal — bạn là PID 1.** Bài 2 đã cảnh báo: `docker stop` gửi SIGTERM cho app. App lờ nó sẽ bị force-kill sau 10 giây, rơi các request đang dở. Dùng dạng exec của `CMD` (`CMD ["python", "app.py"]`, không phải `CMD python app.py` — dạng shell đặt một cái shell ở PID 1 và nó nuốt signal), và cho framework của bạn shutdown êm khi nhận SIGTERM.

**3. Khai báo healthcheck.** "Process đang chạy" không đồng nghĩa "app đang hoạt động" (app đơ vẫn có process sống). Một dòng cho platform phân biệt được:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8000/health || exit 1
```

Compose đã dùng nó ở bài 4 (`service_healthy`); Kubernetes biến nó thành probe ở bài 8. Cùng một ý ở mọi nơi: *app tự báo cáo sức khoẻ của mình*.

**4. Config lúc runtime, không bao giờ lúc build.** Một image, mọi môi trường (luật secret bài 3, tổng quát hoá): đọc config từ biến môi trường, tiêm theo từng môi trường. Nếu phải rebuild image để đổi một setting, setting đó đang nằm sai chỗ.

**5. Log ra stdout, không ghi file.** Container ghi `/var/log/app.log` là chôn log trong một layer dùng-một-lần (bài 2). Ghi ra stdout/stderr; platform thu gom, vận chuyển, xoay vòng. Đây là lý do `docker logs` hoạt động — và lý do mọi pipeline log đều mong đợi như vậy.

## 4. Scan: biết trong hộp có gì

Image của bạn chứa lượng package cỡ một hệ điều hành, mỗi cái có các lỗ hổng đã biết (CVE). Scan so các layer của bạn với cơ sở dữ liệu lỗ hổng:

```bash
docker scout cves tenban/hello-api:0.1.0   # hoặc trivy image ...
```

Cách đọc kết quả *bình tĩnh*: image thật nào cũng có finding. Triage như dân chuyên — **critical/high trên package bạn thật sự chạy** quan trọng trước; cách sửa thường là *rebuild trên base image mới hơn* (`python:3.12-slim` được vá liên tục — image của bạn thì không, cho tới khi bạn rebuild). Đây là lý do các team rebuild image định kỳ kể cả không đổi code, và lý do image slim (bài 3) quan trọng: ít package, ít finding, bề mặt tấn công nhỏ.

## Thực hành (15 phút)

```bash
# 1. Kỷ luật tag: build một lần, dán hai nhãn
docker build -t hello:0.1.0 .            # Dockerfile nhỏ bất kỳ từ bài 3
docker tag hello:0.1.0 hello:latest      # hai miếng dán, một image
docker images hello                       # cùng IMAGE ID trên cả hai dòng — bằng chứng

# 2. Dời miếng dán (cái bẫy "latest", trực tiếp)
echo "# thay doi" >> Dockerfile
docker build -t hello:latest .            # latest giờ trỏ chỗ khác
docker images hello                       # 0.1.0 giữ nguyên; latest = ID mới

# 3. Push cả hai (tạo tài khoản Docker Hub miễn phí trước)
docker login
docker tag hello:0.1.0 TENBAN/hello:0.1.0
docker push TENBAN/hello:0.1.0

# 4. Scan
docker scout cves hello:0.1.0 | head -30  # đọc: severity, package, fixed-in
```

Kết quả mong đợi: bước 1 hiện một IMAGE ID với hai tag. Bước 2 hiện `latest` đã dời còn `0.1.0` đứng yên — trọn vẹn lập luận cho tag bất biến, trong hai lệnh.

## Tự kiểm tra

1. Production chạy `myapp:latest`. Một bug xuất hiện mà hôm qua không có, dù "không ai deploy". Chuyện gì đã xảy ra, và chính sách tag nào ngăn được?
2. Vì sao dạng shell `CMD python app.py` phá graceful shutdown?
3. Scanner báo 200 lỗ hổng. Bạn nhìn gì trước, và cách sửa thường là gì?

<details><summary>Xem đáp án</summary>

1. Ai đó push image mới lên tag `latest`, và một cú restart/reschedule đã pull nó về — một cú deploy thầm lặng. Tag version bất biến (và cấm `latest` ở production) ngăn được, đồng thời khiến rollback khả thi.
2. Nó đặt một cái shell ở PID 1; shell nhận SIGTERM và không chuyển tiếp cho app, nên app không kịp shutdown êm và bị force-kill. Dạng exec `CMD ["python", "app.py"]` khiến app của bạn là PID 1.
3. Finding critical/high trong các package app thật sự dùng. Cách sửa thường là rebuild trên base image đã cập nhật — vì thế mới có rebuild định kỳ kể cả không đổi code.

</details>

## Điều cần nhớ

- Registry là nhà kho; tên image là ở-đâu/cái-gì/bản-nào — và "bản nào" (tag) là miếng dán di động, nên ship version bất biến và cấm `latest` khỏi deploy.
- Năm thói quen khiến container sẵn sàng production: user non-root, CMD dạng exec + SIGTERM êm, healthcheck, config runtime, log stdout.
- Scan image và triage bình tĩnh: finding critical trong package đang dùng, sửa bằng rebuild trên base mới — theo lịch, không chỉ khi đổi code.
- Chặng A hoàn tất: bạn build, compose và ship container tử tế được rồi. Chặng B hỏi câu kế tiếp — ai chạy tất cả những thứ này trong production?

*Bài tiếp theo — Phần 6: Vì sao cần một orchestrator.*
