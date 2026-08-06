---
title: 'ETL vs ELT: xây batch pipeline đáng tin'
description: 'Watermark khi extract, ba pattern load, backfill như một nghiệp vụ hạng nhất, và bảng phân loại lỗi cho biết cái gì nên retry — độ tin cậy pipeline như một tay nghề.'
date: 2026-08-01
category: Data
tags: [de-roadmap, etl, pipeline, data-engineer]
lang: vi
translationKey: de-roadmap-06
series: de-roadmap
part: 6
---

Phần 3 và 5 trao cho bạn nguyên liệu — script idempotent, bảng phân lớp. Phần này lắp chúng thành thứ bạn sẽ thật sự vận hành: **một batch pipeline chạy không người trông trong nhiều tháng**. Cuộc tranh luận ETL-vs-ELT tốn mười phút. Tay nghề về extract pattern, load pattern, backfill và ngữ nghĩa retry tốn phần còn lại — và chính là thứ tách pipeline hay page bạn khỏi pipeline không page.

## Bạn sẽ học được gì

- Chốt ETL hay ELT cho tình huống của bạn, và gọi tên các ngoại lệ nơi transform-trước vẫn thắng.
- Viết extract incremental có watermark sống sót qua crash, qua cú sửa dữ liệu, qua lệch đồng hồ.
- Chọn giữa ba load pattern, và làm cho mọi lượt ghi thành nguyên tử.
- Phân loại mọi lỗi pipeline vào retry / cách ly / sửa — để đúng loại mới đánh thức con người.

**Cần biết trước:** Phần 3 (job idempotent, exit code) và Phần 5 (lớp, partition, tư duy full-rebuild).

## 1. ETL vs ELT, giải quyết nhanh

**ETL** transform dữ liệu *trước khi* load, bên trong tool pipeline. **ELT** load thô trước rồi transform *bên trong* warehouse bằng SQL — bronze-rồi-silver của Phần 5 chính là nó.

ELT thắng vị trí mặc định vì ba lẽ: compute warehouse thành rẻ và đàn hồi, thô-trước giữ được bằng chứng để debug, và transform bằng SQL thì test được và version được.

Các ngoại lệ thật thà nơi chữ T vẫn đi trước: masking PII bắt buộc xảy ra trước khi dữ liệu đáp (đôi khi luật bảo transform trước), parse phi cấu trúc nặng, và bóp các payload rộng phi lý ngay tại rìa. Luật: *ELT mặc định; ETL nơi compliance hoặc vật lý đòi hỏi.*

## 2. Extract: watermark là cả cuộc chơi

Full extract (chép nguyên bảng mỗi đêm) bị đánh giá thấp — tự lành và đơn giản; giữ nó chừng nào kích thước còn cho phép (bản năng full-rebuild của P05). Khi bảng vượt cỡ, bạn extract **incremental**, và toàn bộ gánh nặng đúng-đắn rơi vào một khái niệm — **watermark**:

```python
# Bản hợp đồng watermark:
last = read_watermark("orders")                    # vd 2026-07-30T02:00:00
rows = extract(f"updated_at > '{last}' AND updated_at <= '{now}'")  # cửa sổ đóng
load(rows)
write_watermark("orders", now)                     # CHỈ tiến watermark sau khi load thành công
```

Ba cách nó hỏng, và đó là ba sự cố kinh điển:

- **Tiến watermark trước khi load thành công.** Một cú crash sau đó nuốt trọn cửa sổ trong im lặng — không ai nhận lỗi, các dòng đó đơn giản không bao giờ được thấy lại.
- **Dùng `created_at` khi dòng bị update.** Các cú sửa không bao giờ được extract lại. Hãy dùng `updated_at`, và xác nhận source thật sự duy trì nó.
- **Lệch đồng hồ hoặc commit muộn ở mép cửa sổ.** Fix chuẩn: chồng lấn cửa sổ vài phút và để load idempotent hấp thụ phần trùng.

Để ý chủ đề: watermark cộng load idempotent cho bạn *hiệu ứng* exactly-once đặt trên bộ máy at-least-once.

## 3. Load: ba pattern, một bảng quyết định

| Pattern | Cách | Khi nào |
|---|---|---|
| **Overwrite partition** | Xoá-và-ghi-lại lát cắt lượt chạy này sở hữu | Mặc định cho fact (luật P03: mỗi run sở hữu ngày của nó) |
| **Merge / upsert** | Khớp business key, update-hoặc-insert | Dimension, CDC feed, dòng mutable đến muộn |
| **Append-only** | Cứ thêm dòng | Event bất biến *kèm* dedup hạ nguồn (window silver của P05) |

Anti-pattern là append mù dữ liệu *mutable* — sự cố số-nhân-đôi mà mọi data team trải qua đúng một lần, rất to tiếng. Và dù dùng pattern nào, hãy làm cú ghi **nguyên tử**: stage vào bảng/prefix tạm, rồi swap — để crash giữa chừng còn nguyên dữ liệu cũ thay vì nửa nọ nửa kia (bất biến bronze của Phần 5 cộng bài học SIGKILL của CS-P5, gộp lại).

## 4. Backfill: nghiệp vụ hạng nhất, không phải tình huống khẩn cấp

Mọi pipeline rồi sẽ cần xử lý lại lịch sử — một bug được sửa, một cột được thêm, một source được đính chính. Team coi backfill là tình huống khẩn cấp sẽ ứng biến nó một cách tồi tệ vào thời điểm tệ nhất. Thiết kế nó từ ngày đầu:

- **Cùng một job chạy được mọi ngày.** Vì run được tham số hoá bằng `--run-date` và sở hữu partition của nó, backfill chỉ là một vòng lặp qua các ngày — không code path đặc biệt, nghĩa là không có gì chưa-từng-test.
- **Song song có chặn trên.** Backfill 3 năm là khoảng 1.100 run độc lập. Chạy 10 con một lượt — đừng 1 (mất nhiều tuần) cũng đừng 1.100 (giết source).
- **Bảo vệ source.** Extract cho backfill nên đọc bronze hoặc replica, không bao giờ nện database production — đây là một phần lý do bronze giữ tất cả.
- **Thông báo và kiểm chứng.** Consumer hạ nguồn sẽ thấy số nhúc nhích; một cú đối soát row-count và tổng trước-versus-sau biến "backfill có ổn không?" từ cảm giác thành bằng chứng.

## 5. Bảng phân loại lỗi: cái gì retry, cái gì đánh thức con người

Bộ xử lý lỗi của pipeline nên phân mọi thất bại vào một trong ba rọ:

1. **Transient** (mạng chớp, S3 503, lock timeout) → **tự retry** với backoff; đây là lý do exit code (P03) và retry của orchestrator (P08) tồn tại. Đa số các cú page 2 giờ sáng đáng lẽ không xảy ra là transient chưa được retry.
2. **Lỗi dữ liệu** (schema drift từ source, file không parse nổi, vỡ cổng chất lượng) → **fail nhanh và to, đừng retry** — retry một file hỏng 5 lần chỉ trì hoãn cái alert. Cách ly input xấu (một prefix `_rejected/`), đi tiếp hay dừng tuỳ mức nặng, page kèm *tên file*.
3. **Bug logic** (transform của bạn sai) → không tự động nào cứu nổi; đây là chỗ hợp đồng lớp của P05 và check chất lượng P12 phục vụ — phát hiện, rồi một cú fix cộng backfill (xem trên; giờ nó là việc thường quy rồi, nhớ chứ?).

Chữ ký của một pipeline trưởng thành không phải là không bao giờ fail — mà là mỗi cú fail tự rơi vào đúng rọ.

## 6. dbt ngồi đâu trong tất cả

dbt sở hữu **chữ T của ELT**: các model SQL với dependency `ref()` tạo thành cái DAG, test dạng config, docs tự sinh. Nó *không* extract, không load, không lập lịch. Phần EL là các job của bạn hoặc một tool ingestion, và chiếc đồng hồ là orchestrator của Phần 8, chạy EL rồi `dbt run` rồi `dbt test` như một chuỗi phụ thuộc.

Giữ thẳng ranh giới này — dbt là tầng transform, không phải cái pipeline — chặn được cả cú đòi-hỏi-quá (dbt không fetch API giùm bạn) lẫn cú dùng-thiếu (logic transform vương vãi trong Python trong khi đáng lẽ là SQL model test được).

## Thực hành (25 phút — cố tình phá một watermark, rồi sửa)

Chỉ Python thuần và SQLite, không cần warehouse. Bạn sẽ tái hiện hai con bug extract đắt nhất và xem cách sửa hoạt động:

```python
import sqlite3
db = sqlite3.connect(":memory:")
db.executescript('''
CREATE TABLE source(id INTEGER PRIMARY KEY, amount REAL, created_at TEXT, updated_at TEXT);
INSERT INTO source VALUES (1,10,'2026-03-01','2026-03-01'), (2,20,'2026-03-01','2026-03-01');
CREATE TABLE target(id INTEGER PRIMARY KEY, amount REAL, updated_at TEXT);
''')
wm = '2026-01-01'      # cái watermark

def extract_load(col, wm, crash_before_load=False):
    now = '2026-03-03'
    rows = db.execute(f"SELECT id,amount,updated_at FROM source "
                      f"WHERE {col} > ? AND {col} <= ?", (wm, now)).fetchall()
    if crash_before_load:
        return now, len(rows)                       # BUG: tiến watermark mà chưa load gì
    db.executemany("INSERT OR REPLACE INTO target VALUES (?,?,?)", rows)   # load idempotent
    return now, len(rows)

# Lượt 1 — bình thường
wm, n = extract_load('updated_at', wm); print("lượt 1 load", n, "dòng, wm →", wm)

# Một dòng bị SỬA (không phải tạo mới) sau lượt 1
db.execute("UPDATE source SET amount=99, updated_at='2026-03-02' WHERE id=1")

# BUG A: extract theo created_at bỏ sót hoàn toàn cú sửa
_, n = extract_load('created_at', wm); print("cửa sổ created_at:", n, "dòng  ← cú sửa vô hình")
print("amount dòng 1 ở target:", db.execute("SELECT amount FROM target WHERE id=1").fetchone()[0])

# FIX A: extract theo updated_at
wm2, n = extract_load('updated_at', wm); print("cửa sổ updated_at:", n, "dòng")
print("amount dòng 1 ở target:", db.execute("SELECT amount FROM target WHERE id=1").fetchone()[0])

# BUG B: tiến watermark trước khi load thành công
db.execute("UPDATE source SET amount=123, updated_at='2026-03-04' WHERE id=2")
wm_bad, n = extract_load('updated_at', wm2, crash_before_load=True)
print("sau 'crash': wm =", wm_bad, "nhưng dòng 2 ở target =",
      db.execute("SELECT amount FROM target WHERE id=2").fetchone()[0], " ← mất cửa sổ trong im lặng")

# Kiểm idempotency: chạy lại cùng cửa sổ không đổi gì
before = db.execute("SELECT count(*) FROM target").fetchone()[0]
extract_load('updated_at', wm); after = db.execute("SELECT count(*) FROM target").fetchone()[0]
print("chạy lại cùng cửa sổ:", before, "→", after, "(load idempotent hấp thụ phần trùng)")
```

Kết quả mong đợi: cửa sổ `created_at` trả về 0 dòng dù thực tế *có* một dòng thay đổi — cú sửa vô hình, và target giữ nguyên giá trị cũ 10. Chuyển sang `updated_at` thì nó được lấy và amount thành 99. Bug B mới là cái đáng sợ: không exception, không dòng log, watermark đơn giản trượt qua một cửa sổ chưa từng được load — dòng 2 giữ giá trị cũ mãi mãi, và chỉ một cú đối soát mới phát hiện ra. Lần chạy lại cuối cùng cho thấy vì sao mánh chồng lấn là an toàn: load idempotent áp hai lần vẫn ra cùng một bảng.

## Tự kiểm tra

1. Extract incremental của bạn chạy hằng đêm, và `updated_at` ở source do code ứng dụng set, thỉnh thoảng quên chạm vào ở vài đường update. Cái gì vỡ, và bạn làm gì?
2. Vì sao watermark phải tiến *sau* khi load chứ không phải trước — và bạn thêm gì để bắt được nếu ai đó làm sai thứ tự?
3. Một nhà cung cấp gửi lại ba tháng file đã đính chính. Hãy đi qua: bạn chạy gì, theo thứ tự nào, và chứng minh nó thành công ra sao?

<details><summary>Xem đáp án</summary>

1. Những dòng bị sửa qua các đường đó không bao giờ được extract lại, nên warehouse lệch dần khỏi source trong im lặng — loại bug tệ nhất, vì chẳng có gì fail cả. Lựa chọn: sửa source để luôn duy trì `updated_at` (tốt nhất), chuyển sang change-data-capture, hoặc thêm một cú đối soát toàn phần định kỳ so source với target và vá phần khác biệt.
2. Vì watermark ghi lại *công việc đã hoàn thành*, không phải công việc đã thử. Tiến trước thì bất kỳ cú crash nào giữa hai bước cũng nuốt mất cửa sổ đó mà không để lại lỗi ở đâu. Để bắt được: một phép đối soát so số dòng source với target theo từng cửa sổ, cộng cảnh báo khi số dòng extract bằng 0 ở cửa sổ lẽ ra phải có dữ liệu.
3. Đáp các file đã đính chính vào bronze, rồi lặp chính cái job tham số hoá đó qua các ngày bị ảnh hưởng với song song có chặn (ví dụ 10 một lượt) — không cần code path đặc biệt, vì mỗi run sở hữu partition của nó và ghi đè. Rồi chứng minh: so số dòng và tổng các cột theo từng ngày trước và sau, và xác nhận con số ở gold hạ nguồn dịch chuyển đúng lượng kỳ vọng. Thông báo cho consumer trước, vì số của họ sẽ đổi.

</details>

## Điều cần nhớ

- ELT mặc định (compute rẻ + bằng chứng bronze + SQL test được); ETL sống ở nơi compliance hay vật lý đòi transform-trước.
- Extract incremental sống chết theo watermark: cửa sổ đóng, chỉ tiến sau thành công, `updated_at` chứ không `created_at`, chồng lấn + load idempotent cho phần mép.
- Load là overwrite-partition, merge, hoặc append(+dedup) — luôn stage-rồi-swap; append mù dữ liệu mutable là sự cố số-nhân-đôi.
- Backfill là nghiệp vụ được thiết kế (run tham số hoá, song song có chặn, kiểm chứng bằng đối soát); lỗi phân ba rọ: transient (retry), dữ liệu (cách ly, không retry), logic (fix + backfill).

*Tiếp theo — Phần 7: Apache Spark: khi pandas không còn đủ.*
