---
title: 'Apache Spark: khi pandas không còn đủ'
description: 'Driver và executor, DAG lười, và shuffle — một khái niệm giải thích mọi Spark job chậm — cộng cánh cổng thật thà: đa số team với tới Spark không cần nó.'
date: 2026-08-02
category: Data
tags: [de-roadmap, spark, big-data]
lang: vi
translationKey: de-roadmap-07
series: de-roadmap
part: 7
---

Nấc thang của Phần 3 kết thúc bằng "Spark chỉ khi dữ liệu thật sự vượt một máy." Bạn ở đây vì nó vượt thật — hoặc vì công ty bạn đã chạy sẵn và bạn phải thông thạo. Đằng nào thì Spark cũng thưởng cho một thứ trên hết: hiểu **network nằm ở đâu trong câu query của bạn**. Đó là shuffle, và nó là 80% công việc hiệu năng Spark.

## Bạn sẽ học được gì

- Áp cánh cổng thật thà: khi nào Spark xứng với độ phức tạp của nó và khi nào không.
- Gọi tên dàn diễn viên (driver, executor, partition) và mỗi vai có thể phá hỏng cái gì.
- Giải thích lazy evaluation, và vì sao stack trace trỏ vào đúng dòng sai.
- Nhận ra shuffle trong một câu query, và áp bốn luật sửa được đa số job chậm.

**Cần biết trước:** Phần 3 (nấc thang pandas lên Spark) và Phần 5 (partition).

## 1. Cánh cổng, nhắc lại thật thà

Một máy chạy DuckDB giờ cân được hàng trăm GB (S07-P08). Các bài toán hình-Spark là: **working set cỡ terabyte**, pipeline phải scale đàn hồi theo dữ liệu lớn dần, hoặc một tổ chức đã chuẩn hoá trên nó (lý do chính đáng — thông thạo thắng chủ nghĩa phản biện khi đi làm). CSV của bạn 20 GB? Đóng tab này và đọc lại P03. Vẫn ở đây? Tốt — vào mental model.

## 2. Dàn diễn viên: một driver, nhiều executor

Script PySpark của bạn chạy trên **driver** — nhạc trưởng dựng kế hoạch. Dữ liệu không bao giờ ghé driver (chi tiết có răng — xem `collect()` bên dưới); nó nằm partition rải trên các **executor**, mỗi con một process JVM (CS-P5!) trên một node của cluster, mỗi con giữ một lát của mọi DataFrame:

```text
driver (script của bạn, bản kế hoạch)
  ├── executor 1: partition 0..49    ← mỗi partition = một đơn vị việc song song
  ├── executor 2: partition 50..99
  └── executor 3: partition 100..149
```

**DataFrame** trong Spark trông giống pandas nhưng *là* một công thức nấu trên các partition phân tán. Và từ đây tới cú twist mà người mới đụng ngay giờ đầu tiên.

## 3. Lazy evaluation: chưa có gì xảy ra cho tới một action

```python
df = spark.read.parquet("s3://my-lake/orders/")        # chưa đọc gì
big = df.filter(df.amount > 100)                        # chưa lọc gì
agg = big.groupBy("country").sum("amount")              # vẫn chưa gì
agg.write.parquet("s3://my-lake/gold/by_country/")      # GIỜ mọi thứ mới chạy
```

**Transformation** (filter, select, join, groupBy) chỉ dựng kế hoạch — một DAG, cùng hình dạng mà Airflow lập lịch (P08) và dbt ref (P06), ở đây ở độ hạt query. **Action** (write, count, collect, show) kích hoạt thực thi. Vì sao lười là món quà: Spark nhìn thấy *toàn bộ* kế hoạch trước khi chạy, nên nó đẩy filter xuống tận cú quét Parquet, cắt cột không đọc, xếp lại thứ tự việc — script ngây thơ của bạn được một lượt optimizer miễn phí (bài học "khai báo thắng" của CS-P7, ở quy mô cluster).

Hai vết sẹo dính tới lười: debug kỳ cục vì lỗi trồi lên ở action chứ không phải dòng gây ra nó (thêm một cú `.count()` lúc phát triển để ép thực thi sớm), và `collect()` kéo *nguyên* DataFrame về driver — cú OOM kinh điển (CS-P5) giết job ngay vạch đích. Dùng `show()`, `limit()`, hoặc ghi ra storage thay thế.

## 4. Shuffle: nơi network bước vào câu query

Vài transformation là **hẹp** (narrow): mỗi partition đầu ra chỉ cần partition đầu vào của chính nó — filter, select, toán từng dòng. Chúng gần như miễn phí; các executor làm việc độc lập.

Vài cái là **rộng** (wide): để gom mọi dòng theo `country`, mọi dòng có `country = VN` phải về *cùng một* partition — nghĩa là các executor phải **trao đổi dữ liệu qua network**. Cú trao đổi đó là **shuffle**: serialize, gửi, tràn xuống disk, nhận, gộp. Nhớ bảng latency CS-P2 — bạn vừa chuyển working set từ tốc-độ-RAM sang tốc-độ-network, có khi vài lần liền.

`groupBy`, `join`, `distinct`, `repartition`, window-theo-partition — đều là shuffle. **Mọi Spark job chậm một cách bí ẩn đều là một câu chuyện shuffle**: shuffle quá nhiều dữ liệu, quá nhiều vòng shuffle, hoặc một partition nhận phần hơn xa các bạn. Cái cuối có tên riêng.

## 5. Bốn luật hiệu năng đáng giá

1. **Lọc và cắt cột sớm.** Giảm dòng và cột *trước* các phép rộng — bớt dữ liệu shuffle thắng mọi cú tinh chỉnh. Lazy evaluation thường làm giùm (predicate pushdown), nhưng chỉ khi filter diễn đạt được — bản năng sargability từ SQL áp vào đây.
2. **Broadcast bên nhỏ của join.** Join fact 2 TB với dimension 50 MB? Chuyển *nguyên* dimension tới mọi executor và né hẳn việc shuffle cái fact — `broadcast(dim)`. Đây là dựng-index-rồi-tra của CS-P3 ở quy mô cluster, và là mánh Spark giá trị nhất.
3. **Canh chừng skew.** Một key khổng lồ ("khách hàng nổi tiếng" — hot partition của DynamoDB, S04-P06, cùng căn bệnh) khiến một task chạy hàng giờ trong khi 199 task xong trong vài phút. Spark UI hiện nó như một task lết bết đơn độc; adaptive execution (AQE) của Spark hiện đại tự tách nhiều ca — biết nó tồn tại trước khi tự chế salting.
4. **Size partition cho đúng.** Nhắm partition cỡ vài trăm MB: hàng nghìn partition tí hon chết đuối trong chi phí lập lịch; vài cái khổng lồ thì không song song nổi và không vừa memory. `repartition`/`coalesce` là núm vặn; bài toán small-files trong lake của bạn (partitioning P05) cũng bắt đầu từ đây.

Và meta-luật: **mở Spark UI trước khi chạm bất kỳ núm nào** — màn stages/tasks chỉ đích danh cú shuffle nào đang ăn buổi tối của bạn. Đo trước (luật Phần 4, bản cluster).

## 6. Nó chạy ở đâu, trong thực tế

Bạn gần như không bao giờ vận hành cluster thô: Spark managed (lớp EMR/Glue/Databricks) cấp executor giùm, và túi khôn giá cả S07-P12 áp thẳng — spot instance cho batch chịu-retry (lại các job idempotent), tự tắt khi rảnh, size cluster theo *cú shuffle* chứ không theo storage. Mọi thứ bạn viết ở P03–P06 (run idempotent, watermark, các lớp) chuyển giao nguyên vẹn; Spark là động cơ to hơn dưới cùng một kỷ luật pipeline.

## Thực hành (25 phút — thấy lazy evaluation và shuffle, ngay trên máy)

Cài PySpark (`pip install pyspark`) rồi chạy đoạn này trên laptop — chế độ local dùng thread làm executor, và mọi bài học dưới đây đều nhìn thấy được mà không cần cluster:

```python
from pyspark.sql import SparkSession, functions as F
spark = SparkSession.builder.master("local[4]").appName("lab").getOrCreate()
spark.sparkContext.setLogLevel("ERROR")

df = spark.range(0, 5_000_000).withColumn("customer", F.col("id") % 1000) \
                              .withColumn("amount", (F.col("id") % 97) * 1.5)

# 1. LAZY: không dòng nào ở đây tính toán gì. Để ý "việc nặng" nhanh cỡ nào.
import time
t = time.perf_counter()
q = df.filter(F.col("amount") > 50).groupBy("customer").agg(F.sum("amount").alias("total"))
print(f"định nghĩa query tốn {time.perf_counter()-t:.4f}s   ← chưa chạy gì cả")

t = time.perf_counter(); q.count()      # một ACTION — giờ cả plan mới thực thi
print(f"action tốn {time.perf_counter()-t:.2f}s   ← đây mới là lúc job thật sự chạy")

# 2. Tìm shuffle trong plan — tìm chữ "Exchange"
q.explain()          # groupBy ép ra Exchange: các dòng phải DI CHUYỂN qua các partition

# 3. Lọc sớm vs lọc muộn: cùng kết quả, khác khối lượng
a = df.groupBy("customer").agg(F.sum("amount")).filter(F.col("sum(amount)") > 1000)
b = df.filter(F.col("amount") > 50).groupBy("customer").agg(F.sum("amount"))
for name, plan in (("lọc SAU group", a), ("lọc TRƯỚC group", b)):
    t = time.perf_counter(); plan.count(); print(f"{name}: {time.perf_counter()-t:.2f}s")

# 4. Skew: một key ôm phần lớn số dòng sẽ đầu độc đúng một task
skewed = df.withColumn("k", F.when(F.col("id") % 100 < 95, F.lit("hot")).otherwise(F.col("customer")))
print("số dòng theo key (top 3):")
skewed.groupBy("k").count().orderBy(F.desc("count")).show(3)   # 'hot' ôm ~95% tất cả

# 5. Broadcast join: bảng nhỏ đi tới chỗ dữ liệu, thay vì dữ liệu phải di chuyển
small = spark.range(0, 1000).withColumnRenamed("id", "customer").withColumn("tier", F.lit("gold"))
df.join(F.broadcast(small), "customer").explain()   # BroadcastHashJoin — bên nhỏ không cần Exchange
spark.stop()
```

Kết quả mong đợi: định nghĩa query tốn vài micro-giây trong khi action tốn vài giây — khoảng cách đó *chính là* lazy evaluation, và nó là lý do stack trace đổ lỗi cho dòng `count()` chứ không phải phép biến đổi thật sự hỏng. Ở bước 2, chữ `Exchange` trong plan chính là shuffle: khoảnh khắc các dòng băng qua network. Bước 3 thường cho thấy lọc sớm thắng, vì ít dữ liệu chạm tới shuffle hơn. Bước 4 làm skew thành cụ thể — một key ôm 95% số dòng nghĩa là một task làm 95% khối lượng trong khi phần còn lại của cluster ngồi chơi. Bước 5 cho thấy `BroadcastHashJoin` thay cho exchange ở bên nhỏ: bảng nhỏ đã di chuyển thay vì bảng lớn.

## Tự kiểm tra

1. Job Spark của bạn fail với NullPointerException ở dòng 82, mà dòng 82 là `df.write.parquet(...)`. Vì sao dòng 82 nhiều khả năng không phải con bug, và bạn tìm con bug thật thế nào?
2. Một job từng chạy 6 phút giờ tốn 50 phút, và Spark UI cho thấy 199 task xong trong vài giây còn 1 task chạy 45 phút. Chẩn đoán là gì và bạn thử gì?
3. Khi nào bạn cố ý *không* dùng Spark cho một dataset 200 GB?

<details><summary>Xem đáp án</summary>

1. Vì các transformation là lazy: không gì thực thi cho tới một action, nên cú write chỉ là nơi cái plan tích luỹ rốt cuộc được chạy. Con bug sống trong một transformation trước đó. Tìm nó bằng cách thu hẹp — chạy một action ở các chặng sớm dần (`.count()` sau mỗi transformation), hoặc soi plan, cho tới khi lỗi hiện ra.
2. Data skew: một partition ôm nhiều dòng hơn hẳn các partition khác, nên một task làm gần hết khối lượng trong khi cluster ngồi không. Thử bật adaptive query execution để xử lý skew, salt cái key nóng để rải nó ra nhiều partition, hoặc broadcast bên nhỏ để né hẳn cú shuffle bị lệch.
3. Khi nó vừa thoải mái trong memory và disk của một máy lớn — 200 GB nằm hoàn toàn trong tầm với của một instance to chạy DuckDB hay Polars, và thường sẽ nhanh hơn cùng đơn giản hơn hẳn một cluster. Chọn Spark khi dữ liệu thật sự vượt một máy, hoặc khi nền tảng và kỹ năng của tổ chức bạn vốn đã xây quanh nó.

</details>

## Điều cần nhớ

- Cánh cổng là thật: working set terabyte hoặc chuẩn hoá tổ chức — không thì đường đơn-node của P03 thắng.
- Model: driver lập kế hoạch, executor giữ partition, transformation là công thức lười, action mới thực thi — và `collect()` là ca OOM-driver kinh điển.
- Shuffle là trọn câu chuyện hiệu năng: lọc sớm, broadcast bên nhỏ, săn task lết bết vì skew, size partition đúng — trong Spark UI, không bằng truyền miệng.
- Spark đổi động cơ, không đổi kỷ luật: run idempotent, watermark, các lớp medallion áp y như trước.

*Tiếp theo — Phần 8: Orchestration với Airflow: viết DAG tử tế.*
