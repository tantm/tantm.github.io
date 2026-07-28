---
title: 'Docker Compose: môi trường local thành code'
description: 'Một file, một lệnh, cả stack: service, network và volume giải thích qua một bộ app + database + cache thật — kèm phần dữ liệu sống sót qua restart.'
date: 2026-08-05
category: DevOps
tags: [docker-k8s, docker, compose]
lang: vi
translationKey: docker-k8s-04
series: docker-k8s
part: 4
cover: images/s11-p04-hero.png
---

App thật không bao giờ là một container. Nó là API *cộng* database *cộng* cache — và bảo một đồng đội mới tự khởi động cả ba bằng tay, đúng cổng đúng mật khẩu, chính là bài toán "trên máy em chạy mà" tái diễn. **Docker Compose** sửa nó: cả stack mô tả trong một file, khởi động bằng một lệnh.

## Bạn sẽ học được gì

- Mô tả một stack nhiều container trong một `compose.yaml`.
- Giải thích 3 khối xây dựng: services, networks, volumes.
- Hiểu cách các container tìm nhau bằng *tên* (đây là bản xem trước của Kubernetes).
- Giữ dữ liệu database sống qua restart — và biết khi nào nó bị xoá.

**Cần biết trước:** Bài 1–3. Docker Desktop hoặc Docker Engine có compose plugin.

## 1. Cái file: ba khối mô tả tất cả

Đây là một stack đầy đủ — API, Postgres, Redis:

```yaml
# compose.yaml
services:
  api:
    build: .                 # build từ Dockerfile trong thư mục này (bài 3)
    ports:
      - "8000:8000"          # host:container — chỉ API lộ ra ngoài
    environment:
      DATABASE_URL: postgres://app:secret@db:5432/appdb
      REDIS_URL: redis://cache:6379
    depends_on:
      - db
      - cache

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: appdb
    volumes:
      - dbdata:/var/lib/postgresql/data   # dữ liệu sống qua restart

  cache:
    image: redis:7

volumes:
  dbdata:                    # named volume, Docker quản lý
```

```bash
docker compose up -d      # khởi động tất cả, đúng thứ tự
docker compose ps         # xem stack
docker compose logs api   # log của một service
docker compose down       # dừng và xoá container (volume vẫn còn!)
```

Đọc file từ trên xuống: **services** là các container cần chạy. **volumes** là dữ liệu phải sống lâu hơn chúng. Networks là khối thứ ba — và Compose đã tự tạo sẵn một cái cho bạn, đó mới là phần thú vị.

## 2. Networking: container tìm nhau bằng tên

Nhìn lại config của API: `DATABASE_URL: postgres://app:secret@db:5432/appdb`. Hostname chỉ là **`db`** — đúng *tên service*.

Compose đặt mọi service lên một mạng riêng dùng chung, có DNS tích hợp phân giải tên service thành container. Ba hệ quả:

- **Không bao giờ dùng IP.** `db` và `cache` chạy hôm nay, ngày mai, và trên máy đồng đội. IP thay đổi; tên thì không.
- **Chỉ cổng được publish mới tới được từ bên ngoài.** API có `ports:`, nên browser truy cập `localhost:8000`. Postgres không có `ports:` — chỉ các service trong mạng chạm được nó. Đó là mặc định an ninh đáng giữ: database không nên tình cờ nằm trên localhost.
- **Đây là bản xem trước Kubernetes.** Bài 8 bạn sẽ gặp K8s Service làm đúng việc này — tên ổn định đứng trước các container thay đổi. Học ở đây với 3 service; chuyển giao trực tiếp.

![Networking của Compose: bên trong gọi nhau bằng tên, chỉ một cánh cửa publish ra ngoài](images/s11-p04-concept1.png)

## 3. Volumes: phần dữ liệu phải sống sót

Bài 2 chứng minh storage của container là đồ dùng một lần. Với database đó là thảm hoạ — nên service `db` mount một **named volume**: `dbdata:/var/lib/postgresql/data`. Docker cất thư mục đó *bên ngoài* layer ghi được của container.

Các luật vòng đời cần thuộc:

| Lệnh | Container | Named volume |
|---|---|---|
| `docker compose restart` | khởi động lại | không đụng |
| `docker compose down` | **xoá** | không đụng — dữ liệu sống |
| `docker compose down -v` | xoá | **xoá** — nút reset |

`down -v` vừa là khẩu súng bắn chân vừa là tính năng: nó xoá sạch database local. Đáng sợ theo tư duy production, *hữu ích* ở local — đó là cách bạn test app với một database mới tinh.

Thêm một kiểu mount bạn dùng hằng ngày khi dev: **bind mount** ánh xạ một thư mục host vào container, để sửa code hiện ngay không cần rebuild:

```yaml
  api:
    build: .
    volumes:
      - ./src:/app/src     # sửa code trực tiếp, không rebuild
```

Luật ngón tay cái: **named volume cho dữ liệu, bind mount cho code đang sửa.**

## 4. Các thói quen khiến Compose dễ chịu

- **`depends_on` sắp thứ tự khởi động, không phải độ sẵn sàng.** *Container* Postgres chạy trước API, nhưng bản thân Postgres có thể chưa nhận kết nối. Cách sửa thật: `healthcheck` cho `db` cộng `depends_on: { db: { condition: service_healthy } }` — hoặc app tự retry kết nối DB (câu trả lời bền mà production đằng nào cũng cần).
- **Đừng commit secret thật.** Mật khẩu vứt đi như `secret` để trong `compose.yaml` thì ổn cho local; thứ gì thật thì vào file `.env` đã git-ignore, Compose tự đọc (`${DB_PASSWORD}` trong yaml).
- **Một `docker compose up` = onboarding.** Thước đo compose file tốt: đồng đội mới clone repo, chạy một lệnh, có nguyên stack. README của bạn còn 12 bước setup nghĩa là compose file chưa xong.

## Thực hành (15 phút)

Dựng stack ở trên và kiểm chứng ba tuyên bố lớn:

```bash
mkdir compose-lab && cd compose-lab
# app thế chỗ tối giản: alpine ping postgres + redis qua TÊN service
cat > compose.yaml <<'EOF'
services:
  app:
    image: alpine
    command: sh -c "apk add --no-cache postgresql-client redis >/dev/null &&
      until pg_isready -h db -U app; do sleep 1; done &&
      redis-cli -h cache ping && echo STACK-OK && sleep 600"
    depends_on: [db, cache]
  db:
    image: postgres:16
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: secret, POSTGRES_DB: appdb }
    volumes: [ "dbdata:/var/lib/postgresql/data" ]
  cache:
    image: redis:7
volumes:
  dbdata:
EOF

docker compose up -d
docker compose logs app | tail -3     # mong đợi: PONG + STACK-OK  (tên hoạt động!)

# Test volume sống sót
docker compose exec db psql -U app -d appdb -c "CREATE TABLE t(x int); INSERT INTO t VALUES (42);"
docker compose down                    # container biến mất...
docker compose up -d
docker compose exec db psql -U app -d appdb -c "SELECT * FROM t;"   # 42 vẫn còn!

# Nút reset
docker compose down -v                 # giờ volume cũng biến mất
```

Kết quả mong đợi: app chạm được `db` và `cache` *bằng tên* (PONG + STACK-OK). Hàng `42` sống qua trọn một cú `down`/`up`. Sau `down -v`, cú `up` mới sẽ không còn bảng nào.

## Tự kiểm tra

1. API kết nối `postgres://...@db:5432/...`. Trên laptop bạn không có gì tên `db` — sao vẫn chạy?
2. Đồng đội chạy `docker compose down` và lo mất database local. Có mất không?
3. Vì sao service database thường không nên có mục `ports:`?

<details><summary>Xem đáp án</summary>

1. Mạng riêng của Compose có DNS phân giải *tên service* `db` thành container tương ứng. Tên ổn định; IP thì không.
2. Không — `down` xoá container nhưng giữ named volume. Chỉ `down -v` mới xoá dữ liệu.
3. Không publish cổng thì DB chỉ các service trong mạng compose chạm được — host và bên ngoài thì không. Mặc định càng ít cửa mở càng tốt.

</details>

## Điều cần nhớ

- Một `compose.yaml`, một cú `up`: services (container), networks (tự động, theo tên), volumes (dữ liệu sống sót).
- Container nói chuyện bằng tên service qua mạng riêng; chỉ cổng publish mới hướng ra ngoài — vừa là mặc định an ninh vừa là bản xem trước K8s Service.
- Named volume cho dữ liệu, bind mount cho code đang sửa; `down` giữ dữ liệu, `down -v` là nút reset.
- `depends_on` chỉ sắp thứ tự khởi động — độ sẵn sàng cần healthcheck hoặc app tự retry.

*Bài tiếp theo — Phần 5: Registry, tag & best practices.*
