---
title: 'Python cho Data Engineer: bộ đồ nghề thực chiến'
description: 'Không phải "học Python" — mà là 6 thói quen khiến code pipeline đáng tin: environment có khoá version, script chạy lại an toàn, type ở biên giới, và nấc thang pandas → Arrow.'
date: 2026-07-29
category: Data
tags: [de-roadmap, python, data-engineer]
lang: vi
translationKey: de-roadmap-03
series: de-roadmap
part: 3
---

Bạn đã biết Python — ít nhất là cú pháp. Phần này nói về khoảng cách giữa "em viết được script" và "script của em chạy đêm suốt một năm mà không ai phải nghĩ về nó." Python của data engineering là một *phương ngữ*: ít abstraction khôn khéo hơn, nhiều sự đa nghi hơn về chuyện chạy lại, environment, và các biên giới nơi dữ liệu đi vào.

## Thói quen 1 — Environment có khoá version, không thì coi như chưa xảy ra

Sự cố pipeline cổ xưa nhất trong sách: chạy trên laptop, chết trên scheduler, vì hai cái máy resolve "pandas" ra hai version khác nhau. Thuốc chữa thuần cơ học:

```bash
uv init my-pipeline && cd my-pipeline
uv add pandas pyarrow
# → pyproject.toml (thứ bạn muốn) + uv.lock (chính xác thứ mọi người nhận)
uv run python pipeline.py
```

Tool không quan trọng bằng bản hợp đồng (uv là mặc định nhanh của thời nay; nghi thức venv+pip vẫn ổn): **dependency khai báo trong file, version bị khoá, environment dựng lại từ lockfile — không bao giờ "pip install vào bất kỳ thứ gì đang có sẵn."** Scheduler và laptop của bạn phải dựng ra cùng một thế giới từ cùng một file, không thì bí ẩn "trên máy em chạy bình thường" của Phần 2 (CS Foundations) thành ngày thứ Ba của bạn.

## Thói quen 2 — Idempotency: bài test chạy-hai-lần

Ta đã tụng từ này từ S02-P01; đây là nghĩa của nó trong Python. Hỏi mọi job: **nếu nó chạy hai lần, chuyện gì xảy ra?** Pipeline *chắc chắn sẽ* chạy lại — retry, backfill, một con người bồn chồn lúc 2 giờ sáng.

```python
# Append: hai lần chạy = số dòng nhân đôi. TRƯỢT bài test.
df.to_sql("daily_sales", conn, if_exists="append")

# Ghi đè đúng partition mà lượt chạy này sở hữu: hai lần = cùng kết quả. ĐẬU.
(pq.write_to_dataset(table, "sales", partition_cols=["day"],
                     existing_data_behavior="delete_matching"))
```

Pattern tổng quát: **mỗi lượt chạy sở hữu một lát cắt rõ ràng** (thường là partition theo ngày), ghi nguyên tử (ghi temp → swap), và mọi thứ suy ra từ tham số — không có `datetime.now()` chôn trong logic transform (lượt chạy "của hôm nay" mà rerun vào ngày mai phải cho ra *đúng* output cũ; ngày chạy là tham số, không phải thứ tự khám phá).

## Thói quen 3 — CLI có tham số, không phải hằng số sửa tay

Scheduler cần gọi script của bạn; một con người cần backfill hôm thứ Ba. Cả hai dùng chung một giao diện:

```python
import argparse, sys, logging

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--run-date", required=True)   # lát cắt lượt chạy này sở hữu
    p.add_argument("--source", default="orders")
    args = p.parse_args()
    logging.basicConfig(level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s")
    ...
    return 0                                      # khác 0 = scheduler retry

if __name__ == "__main__":
    sys.exit(main())
```

Nhỏ, nhàm chán, và mã hoá cùng lúc ba bản hợp đồng: tham số thay cho hằng số sửa tay, log thay cho print (phiên bản 2-giờ-sáng của bạn cần timestamp), và **exit code thay cho thất bại im lặng** — pipeline nuốt exception rồi exit 0 là đang nói dối orchestrator của nó, và Phần 8 (Airflow) sẽ tin lời nói dối đó.

## Thói quen 4 — Type ở biên giới

Không cần type-theory thâm sâu; cần **biên giới có chú thích**. Dữ liệu đi vào code của bạn từ CSV, API, và bảng của người khác — biên giới là nơi những lời nói dối chui vào:

```python
from dataclasses import dataclass

@dataclass
class OrderRow:
    order_id: str
    amount_cents: int      # không phải float — tính tiền, SQL Mastery P7 gật đầu
    country: str

def parse_row(raw: dict) -> OrderRow:
    return OrderRow(order_id=str(raw["order_id"]),
                    amount_cents=int(raw["amount_cents"]),
                    country=raw.get("country", "unknown"))
```

Parse một lần ở rìa thành hình dạng có type; mọi thứ hạ nguồn tin tưởng nó. Đây là bản song sinh mức-code của schema-on-write (S07-P03), và `mypy` trong CI biến chú thích từ tài liệu thành dây bẫy. Cần validate nặng đô hơn thì họ pydantic/pandera công nghiệp hoá đúng ý tưởng này — bắt đầu bằng dataclass, leo thang khi biên giới trở nên thù địch.

## Thói quen 5 — Nấc thang pandas → Arrow → engine

pandas là xe chạy hằng ngày; phải biết sàn nhà nó cót két ở đâu:

- **Memory:** một DataFrame muốn ~5–10× kích thước file CSV của nó trong RAM. File 5 GB trên node scheduler 16 GB đã là một sự cố.
- **Type:** upcast im lặng `int` → `float` khi NaN xuất hiện, cột `object` giấu type trộn lẫn — type ở biên giới (Thói quen 4) là tấm khiên của bạn.

Nấc thang leo hạng hiện đại, theo thứ tự: **pandas** (vừa RAM, khám phá) → **pyarrow / Parquet** (trao đổi columnar — đây là lý do mọi file trong S07 đều là Parquet) → **engine đơn-node** (DuckDB query thẳng Parquet, thường thay được nguyên một cuộc họp "chúng ta cần Spark" — luận đề S07-P08) → **Spark** chỉ khi dữ liệu thật sự vượt một máy (S02-P07 phía trước). Mỗi nấc là một cú tốt nghiệp có chủ đích, không phải mặc định.

```python
import duckdb
# SQL trên Parquet, không cluster, chịu được lớn-hơn-RAM:
duckdb.sql("SELECT country, SUM(amount_cents) FROM 'sales/*.parquet' GROUP BY 1")
```

## Thói quen 6 — Test trả được tiền thuê nhà

Bỏ qua kịch coverage. Hai loại test nuôi sống pipeline: **logic transform trên fixture tí hon** (5 dòng, đáp án tính tay được) và **các ca input xấu xí** bạn từng bị đốt (file rỗng, key trùng, cái timezone từng dịch):

```python
def test_daily_totals_dedupes():
    rows = [order(id="a", amount=100), order(id="a", amount=100)]  # trùng
    assert daily_totals(rows)["total_cents"] == 100
```

Mỗi sự cố production nên để lại một fixture — đó là cách bộ test của pipeline mọc răng thay vì mọc mỡ. (Kiểm tra chất lượng trên dữ liệu *thật* là một tầng khác — dbt test, lãnh thổ của S02-P12.)

## Điều cần nhớ

- Khoá environment; scheduler và laptop phải dựng cùng một thế giới từ cùng một file.
- Idempotency là bài test chạy được: hai lần = cùng kết quả; mỗi lượt chạy sở hữu lát cắt của nó và nhận ngày qua tham số.
- Script là CLI có log và exit code — giả vờ thành công im lặng là cách orchestrator bị lừa.
- Type ở biên giới rồi tin phần ruột; leo thang pandas → Arrow → DuckDB → Spark có chủ đích, không theo mốt.

*Tiếp theo — Phần 4: Data modeling: OLTP vs OLAP, star schema.*
