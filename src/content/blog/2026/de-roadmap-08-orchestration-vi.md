---
title: 'Orchestration với Airflow: viết DAG tử tế'
description: 'Orchestrator thực sự sở hữu gì, data interval như một bản hợp đồng, và ba sai lầm Airflow kinh điển — gồm cái bẫy top-level code ai cũng ngã một lần.'
date: 2026-08-03
category: Data
tags: [de-roadmap, airflow, orchestration]
lang: vi
translationKey: de-roadmap-08
series: de-roadmap
part: 8
---

Mọi thứ tới giờ chạy *khi bạn chạy nó*. Data engineering production chạy lúc 3 giờ sáng, không người trông, đúng thứ tự, có retry — và đó là việc của một **orchestrator**. Airflow là đương kim (các khái niệm chuyển giao sang Dagster/Prefect và bè bạn), và dùng nó cho khéo quy về một câu: **orchestrator sở hữu chiếc đồng hồ, trật tự, và khả năng nhìn thấy — các job của bạn sở hữu logic.** Xoá nhoè ranh giới đó là được các mớ hỗn độn kinh điển; giữ được nó là kỷ luật P03–P06 khớp vào đúng chỗ.

## Bạn sẽ học được gì

- Nói được bốn thứ một orchestrator sở hữu — và những thứ nó không sở hữu.
- Viết một DAG mà mỗi lượt chạy được tham số hoá, idempotent, và chạy lại được theo ngày.
- Tránh ba sai lầm kinh điển khiến Airflow trông chậm chạp hoặc chập chờn.
- Biến một cú backfill thành một câu lệnh thay vì một cuối tuần.

**Cần biết trước:** Phần 3 (job idempotent, exit code) và Phần 6 (watermark, backfill như nghiệp vụ được thiết kế).

## 1. Orchestrator sở hữu gì

Bốn thứ, không hơn: **lập lịch** (giống cron, nhưng hiểu-dữ-liệu — bên dưới), **phụ thuộc** (cái DAG: extract → transform → test, biểu diễn thành graph, topological sort của CS-P3 đóng gói thành sản phẩm), **retry và cảnh báo** (rọ transient của P06, tự động hoá), và **khả năng nhìn thấy** (một UI trả lời "cái gì đã chạy, cái gì fail, cái gì trễ" — tức phần lớn thứ on-call cần).

Để ý thứ vắng mặt: business logic. Orchestrator là *nhạc trưởng*, không phải nhạc công.

## 2. Giải phẫu một DAG trung thực

```python
from airflow.decorators import dag, task
import pendulum

@dag(
    schedule="@daily",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    default_args={"retries": 2, "retry_delay": pendulum.duration(minutes=5)},
)
def orders_pipeline():
    @task
    def extract(data_interval_start=None, data_interval_end=None):
        # Cái interval CHÍNH LÀ bản hợp đồng: run này sở hữu đúng lát cắt này.
        run_extract(start=data_interval_start, end=data_interval_end)

    @task
    def load_silver():   ...
    @task
    def run_quality():   ...

    extract() >> load_silver() >> run_quality()

orders_pipeline()
```

Khái niệm gánh trọng lượng là **data interval**: mỗi run là *của* một cửa sổ dữ liệu, truyền vào như tham số. Đó là `--run-date` của P03 và watermark của P06, được thể chế hoá — cú chạy 3 giờ sáng thứ Hai xử lý lát cắt của Chủ nhật, và chạy lại nó về sau vẫn xử lý *đúng lát cắt đó* (bạn thân nhất của idempotency). Hiểu sai chỗ này là dính ngay cơn bối rối Airflow muôn thuở "sao run daily của em xử lý dữ liệu hôm qua?" — nó không xử lý hôm qua; nó xử lý *interval của nó*, chính xác như thiết kế.

## 3. Ba sai lầm kinh điển

**1. Logic trong file DAG.** Scheduler *import* mọi file DAG mỗi ~30 giây để nhìn hình dạng graph. Bất kỳ code top-level nào — một query database để "build task động", một cú gọi API, đọc một config to — chạy ở **mỗi lần parse**, nện vào các hệ thống và kéo scheduler bò. Luật: file DAG *khai báo* cấu trúc; công việc diễn ra bên trong task (hay tốt hơn, bên trong các script kiểu P03 và dbt model mà task *gọi tới*). File DAG của bạn cần nhiều hơn import và đi dây? Có thứ gì đó đang nằm sai tầng.

**2. Task không idempotent.** Retry là siêu năng lực của orchestrator — và một cú retry của task append (số-nhân-đôi của P06) biến lưới an toàn thành chính sự cố. Mọi task phải đậu bài test chạy-hai-lần *vì orchestrator chắc chắn sẽ chạy nó hai lần* — lúc retry, lúc backfill, lúc con người bồn chồn bấm "clear".

**3. Task nguyên khối.** Một task vừa extract vừa transform vừa load nghĩa là một cú fail retry *tất cả* (nện nguồn lần nữa chỉ để làm lại một bug transform) và UI hiện một chiếc hộp mờ đục. Cắt ở các đường may tự nhiên — những chỗ một cú retry nên tiếp sức, tức chính các ranh giới lớp của P05. Heuristic độ hạt: **task là đơn vị của retry**, không phải đơn vị tổ chức code.

## 4. Sự chờ đợi: sensor, dùng cẩn thận

Pipeline phải chờ: file của đối tác, DAG thượng nguồn, partition của bảng. **Sensor** là task ngồi chờ — và kiểu ngây thơ, mỗi con chiếm một slot worker trong khi không làm gì ("sự chờ" của CS-P2 thành rò rỉ tài nguyên; một tá sensor bỏ đói được việc thật của bạn). Câu trả lời của Airflow hiện đại là **deferrable operator** — sensor đỗ ngoài worker cho tới khi điều kiện nổ (đúng mánh async/await, CS-P8, mặc áo orchestrator). Các lựa chọn thiết kế đáng ưu tiên khi có thể: lập lịch hiểu-dữ-liệu (Datasets/assets — DAG hạ nguồn kích hoạt *khi bảng cập nhật*, không phải theo giờ đoán mò) và cú đá event-driven từ S3/queue. Poll ít đi, phản ứng nhiều lên.

## 5. Backfill: nơi thiết kế trả công

P06 biến backfill thành nghiệp vụ được thiết kế; Airflow biến nó thành một câu lệnh:

```bash
airflow dags backfill orders_pipeline -s 2026-05-01 -e 2026-05-31
```

Ba mươi mốt run, mỗi run một interval riêng, song song có chặn (`max_active_runs`), cùng code path với production. Điều này chạy được chỉ vì mọi thứ ở trên — task tham số hoá theo interval, idempotent, độ hạt đúng. Team bỏ qua các kỷ luật đó sẽ khám phá backfill như một chuyến khảo cổ. (Đặt `catchup=False` cho DAG mới trừ khi bạn *muốn* lịch sử tự backfill lúc deploy — cú catchup nghìn-run bất đắc dĩ là nghi thức trưởng thành tốt nhất nên né.)

## 6. Vận hành như người lớn

- **Cảnh báo theo đúng rọ** (bảng phân loại P06): fail transient retry im lặng; fail chung cuộc page kèm task và interval; *trễ SLA* ("gold hằng ngày chưa xong lúc 7 giờ") page on-call vì business nhận ra sự trễ trước sự sai.
- **Scheduler là hạ tầng production** — các bản managed (lớp MWAA/Composer/Astronomer) đổi đô la S07-P12 lấy việc không phải đeo máy nhắn CS-P5 cho một cái scheduler; thường đáng tiền khi chưa tới cỡ platform-team.
- **dbt bên trong Airflow**: pattern thực dụng là Airflow chạy các task EL rồi kích dbt (phân công của P06); tooling render mỗi dbt model thành một task Airflow riêng (lớp Cosmos) cho retry và visibility mức model — hay, không bắt buộc.

## Thực hành (25 phút — chạy scheduler thật ở local và chạy lại một ngày)

Airflow chạy được trên laptop ở chế độ standalone. Mục tiêu không phải học giao diện; mà là *cảm* được câu "mỗi lượt chạy sở hữu ngày của nó" nghĩa là gì.

```bash
pip install "apache-airflow==2.*"
export AIRFLOW_HOME=~/airflow-lab
airflow standalone &          # lần đầu sẽ in mật khẩu admin; UI ở localhost:8080
mkdir -p $AIRFLOW_HOME/dags

cat > $AIRFLOW_HOME/dags/orders_lab.py <<'EOF'
from airflow.decorators import dag, task
from datetime import datetime
import pendulum, pathlib

@dag(schedule="@daily", start_date=pendulum.datetime(2026, 3, 1, tz="UTC"),
     catchup=False, max_active_runs=3, tags=["lab"])
def orders_lab():

    @task
    def extract(ds=None):                       # ds = ngày DATA INTERVAL của lượt chạy
        out = pathlib.Path(f"/tmp/lab/raw_{ds}.txt")
        out.parent.mkdir(exist_ok=True)
        out.write_text(f"rows for {ds}\n")      # idempotent: cùng ngày → cùng file, ghi đè
        return str(out)

    @task
    def transform(path: str, ds=None):
        rows = pathlib.Path(path).read_text()
        pathlib.Path(f"/tmp/lab/clean_{ds}.txt").write_text(rows.upper())
        return f"processed {ds}"

    transform(extract())

orders_lab()
EOF
```

Rồi trong UI hoặc CLI: bỏ pause cho DAG, trigger một lần, và nhìn `/tmp/lab/` — các file đặt tên theo ngày. Giờ mới tới phần đáng giá:

```bash
# Chạy lại một ngày quá khứ. Một câu lệnh, không code path đặc biệt nào.
airflow dags backfill orders_lab -s 2026-03-02 -e 2026-03-04
ls -la /tmp/lab/                # mỗi ngày một file raw + một file clean, không nhân đôi

# Chạy lại lần nữa — idempotent nghĩa là lượt thứ hai không đổi gì
airflow dags backfill orders_lab -s 2026-03-02 -e 2026-03-04
ls -la /tmp/lab/                # cùng số file, cùng nội dung
```

Kết quả mong đợi: mỗi lượt chạy sinh ra file đóng dấu *ngày của chính nó* chứ không phải hôm nay, và đó là thứ khiến câu lệnh backfill hoạt động được. Chạy cùng cú backfill hai lần để lại thư mục y hệt — đó là idempotency, và là tính chất cho phép bạn chạy lại mà không phải nghĩ. Để ý thứ bạn đã *không* phải viết: không vòng lặp qua các ngày, không cờ "chế độ backfill", không script riêng. Chính thiết kế từ Phần 3 (tham số hoá theo ngày chạy) đã biến một cuối tuần thành một câu lệnh; orchestrator chỉ cung cấp các ngày và phần retry.

## Tự kiểm tra

1. File DAG của bạn query database ở mức top-level để dựng danh sách task. Mọi thứ chạy được, nhưng scheduler chậm và database luôn có tải. Sai ở đâu?
2. Một task xử lý "24 giờ qua" bằng `datetime.now()`. Vì sao DAG này không bao giờ backfill đúng được?
3. Một DAG có đúng một task làm cả extract, transform và load. Nó fail lúc load. Thiết kế đó khiến bạn trả giá gì, và bạn tái cấu trúc thế nào?

<details><summary>Xem đáp án</summary>

1. Code top-level trong file DAG chạy mỗi lần scheduler parse file — vài giây một lần, mãi mãi, cho mọi DAG. Câu query đó đang được thực thi liên tục, không phải một lần mỗi lượt chạy. Hãy đưa nó vào trong một task, nơi nó chỉ chạy khi lượt chạy thật sự diễn ra.
2. Vì `now()` nghĩa là "lúc code tình cờ chạy", không phải "khoảng thời gian mà lượt chạy này đại diện". Một cú backfill ngày 2 tháng 3 thực thi vào tháng 6 sẽ xử lý dữ liệu tháng 6 rồi ghi vào partition tháng 3. Hãy dùng ngày data-interval mà orchestrator cung cấp, để output của một lượt chạy chỉ phụ thuộc vào tham số của nó.
3. Task là đơn vị retry, nên một cú fail lúc load sẽ chạy lại cả extract và transform — nhẹ thì phí công, nặng thì nhân đôi tác dụng phụ nếu có bước nào không idempotent. Tái cấu trúc thành ba task extract, transform, load riêng để retry tiếp tục từ đúng bước hỏng, và mỗi bước chạy lại được độc lập.

</details>

## Điều cần nhớ

- Orchestrator sở hữu đồng hồ, trật tự, retry, khả năng nhìn thấy; job của bạn sở hữu logic — file DAG chỉ khai báo cấu trúc (code top-level chạy mỗi 30 giây, mãi mãi).
- Data interval là bản hợp đồng: mỗi run sở hữu lát cắt của nó, khiến retry, rerun và backfill là cùng một thao tác an toàn.
- Task là đơn vị của retry: cắt ở đường may lớp, giữ mọi task idempotent, và ưu tiên trigger hiểu-dữ-liệu/event-driven hơn sensor ngồi poll.
- Backfill-bằng-một-câu-lệnh là phần thưởng của kỷ luật P03–P06; cảnh báo theo rọ và theo SLA, không phải theo mọi ô vuông đỏ.

*Tiếp theo — Phần 9: Data lake & lakehouse: Parquet, Iceberg, Delta.*
