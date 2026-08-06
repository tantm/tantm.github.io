---
title: 'Big-O là tư duy, không phải mẹo phỏng vấn'
description: 'Quên flashcard đi: Big-O là thói quen hỏi "code này ra sao khi input tăng 100 lần?" — và những O(n²) vô tình ẩn trong code production thường ngày.'
date: 2026-07-29
category: Developer
tags: [cs-foundations, algorithms, performance]
lang: vi
translationKey: cs-foundations-04
series: cs-foundations
part: 4
---

Big-O bị mang tiếng oan: đa số engineer gặp nó như một màn tra tấn phỏng vấn, học thuộc sáu đường cong, đậu phỏng vấn, rồi không bao giờ nghĩ về nó nữa. Hai năm sau, service của họ sập đúng ở mốc 50.000 user — vì một vòng loop viết trong một phút mà không ai từng hỏi nó câu hỏi Big-O.

Phần này phục hồi danh dự cho Big-O đúng bản chất của nó: **một thói quen một-câu-hỏi — "code này sẽ ra sao khi input tăng 100 lần?"**

## Bạn sẽ học được gì

- Đọc bảng tốc độ tăng đủ tốt để trả lời "100× thì sao?" cho bất kỳ vòng loop nào bạn viết.
- Nhận ra ba bộ áo mà `O(n²)` production hay mặc, không cái nào trông giống loop lồng.
- Chạy thói quen ba-câu-hỏi lúc review để bắt code bậc hai trước khi nó lên production.
- Quyết định khi nào complexity "tệ hơn" mới là lựa chọn kỹ thuật đúng.

**Cần biết trước:** Phần 3 (hash map và pattern dựng-index-rồi-tra). Bảng latency Phần 2 giúp ích cho phần bàn về hằng số.

## 1. Bảng duy nhất bạn cần

| Lớp | Tên | Nếu n tăng 100× thì khối lượng tăng… | Ví dụ thường ngày |
|---|---|---|---|
| O(1) | hằng số | không tăng | tra hash map (Phần 3) |
| O(log n) | logarit | thêm ~7 bước | seek trên DB index (B-tree) |
| O(n) | tuyến tính | 100× | một lượt duyệt list |
| O(n log n) | tuyến tính-log | ~700× | một thuật toán sort tử tế |
| O(n²) | bậc hai | **10.000×** | loop lồng trong loop |
| O(2ⁿ) | mũ | tàn cuộc | thử mọi tập con |

Hai ghi chú thật thà mà flashcard bỏ qua.

Một, **hằng số vô hình nhưng có thật.** Một O(n) đọc từ disk thua một O(n log n) trong RAM ở mọi kích thước bạn sẽ gặp. Big-O xếp hạng *tốc độ tăng*, không phải *tốc độ chạy*.

Hai, **n phải là thứ thật sự tăng.** Vòng loop ba tầng trên 7 ngày trong tuần là O(1) vĩnh viễn. Câu hỏi không bao giờ là "có loop lồng không?" mà là "*input nào đang tăng, và cái gì nhân theo nó?*"

## 2. O(n²) trốn ở đâu trong code production

Chẳng ai đi làm mà viết `bubble_sort()`. Hành vi bậc hai lẻn vào trong bộ quần áo bình thường:

**Bộ áo 1 — `in` trên một list:**

```python
# Trông tuyến tính. Thực ra bậc hai: `in` quét processed_ids cho MỖI order.
for order in orders:                 # n lần
    if order.id in processed_ids:    # O(n) nếu processed_ids là LIST
        continue
# Fix: processed_ids = set(...)  →  O(1) mỗi lần kiểm. Một từ. Nhanh 1000× ở n=10⁵.
```

**Bộ áo 2 — N+1 query.** Phiên bản database, và là bug performance phổ biến nhất của backend web:

```python
orders = db.query("SELECT * FROM orders WHERE day = today")   # 1 query
for o in orders:
    o.customer = db.query("SELECT * FROM customers WHERE id = %s", o.customer_id)  # n query
```

Đó là n+1 vòng khứ hồi network, và trên thang thời gian của CPU thì mỗi vòng là cả một kỷ địa chất. Cách sửa là câu thần chú Phần 3 — dựng index rồi tra. Lấy toàn bộ customers trong **một** query (`WHERE id IN (...)` hoặc JOIN), dict theo id, tra trong RAM. Tính năng "eager loading" của mọi ORM tồn tại vì đúng con bug này.

**Bộ áo 3 — nối chuỗi trong loop** (`report += line` chép lại nguyên chuỗi mỗi vòng — dùng `"".join(lines)`), **`list.insert(0, x)` lặp đi lặp lại** (xê dịch tất cả, mỗi lần — dùng deque), và họ hàng đông đúc của chúng. Chữ ký chung: **một thao tác tuyến tính ẩn bên trong một vòng loop tuyến tính lộ thiên.**

Kỹ năng không phải là né loop lồng — mà là *nhìn thấy* cái O(n) bên trong khi nó không mang hình dạng một vòng loop.

## 3. Thói quen, gói trong ba câu hỏi

Chạy chúng lúc code review — mất mười giây:

1. **n ở đây là gì, và production nó lớn cỡ nào?** (n = 20 setting → kệ nó. n = số đơn hàng ngày Black Friday → quan tâm.)
2. **Có cú quét ẩn nào trong vòng loop này không?** (`in` trên list, một query, một `.filter()` trên tất cả, chuỗi `+=`.)
3. **Tốc độ tăng của CẢ CON ĐƯỜNG là gì, không chỉ hàm này?** Một hàm O(n) được gọi n lần *chính là* O(n²) — hành vi bậc hai sống sót qua review theo đúng cách này, từng lớp trông-vô-tội một.

Và thói quen đối trọng: **đo trước khi tối ưu.** Big-O chỉ chỗ sự sụp đổ *có thể* trốn; profiler chỉ chỗ thời gian *thật sự* đi. Tối ưu một O(n²) chạy trên n=50, trong khi chi phí thật nằm ở một cú network call chậm, là cách kinh điển để mất một buổi chiều.

## 4. Khi Big-O "tệ hơn" lại là lựa chọn đúng

Phán đoán senior gồm cả chiều ngược lại. Cái O(n²) ship hôm nay chạy trên n≤1.000 thắng cái O(n log n) khôn khéo ship thứ Sáu kèm một con bug. Lượt quét tuyến tính dễ đọc thắng cấu trúc kỳ lạ không ai trong team bảo trì nổi.

Big-O là một *lăng kính*, không phải đạo luật — mục tiêu là biết mình đang đứng gần vách đá nào, không phải khoe độ khéo.

## Thực hành (20 phút — làm đường cong hiện ra trên chính máy bạn)

Một file, không thư viện. Bạn sẽ xem cùng một "bản sửa" đi từ vô nghĩa tới khổng lồ khi n lớn dần:

```python
import time, random

def run(n, use_set):
    ids = [random.randint(0, n * 10) for _ in range(n)]
    seen = set(ids) if use_set else list(ids)        # khác biệt MỘT TỪ
    t = time.perf_counter()
    hits = sum(1 for x in ids if x in seen)          # phép kiểm thành viên trong vòng loop
    return time.perf_counter() - t

for n in (1_000, 5_000, 20_000, 50_000):
    a, b = run(n, False), run(n, True)
    print(f"n={n:>6}  list={a:8.4f}s  set={b:8.4f}s  ratio={a/b:8.1f}×")
```

Rồi trả lời trước khi kéo xuống: khi n đi từ 5.000 lên 50.000 (10×), thời gian bản *list* phải tăng bao nhiêu lần? Chạy và kiểm chứng.

```python
# Bonus — hình dạng N+1, không cần database:
def fetch(i): time.sleep(0.001); return i          # giả vờ mỗi lần gọi băng qua network
orders = list(range(300))
t = time.perf_counter(); [fetch(o) for o in orders]        # N+1: mỗi order một lần gọi
print("từng dòng:", round(time.perf_counter() - t, 3), "s")
t = time.perf_counter(); fetch(0)                          # gộp: một lần gọi, tất cả dòng
print("gộp một cú:", round(time.perf_counter() - t, 3), "s")
```

Kết quả mong đợi: ở n=1.000 cả hai bản đều trông tức thì và tỷ số chẳng ấn tượng — chính vì thế con bug này sống sót qua code review. Tới n=50.000, bản list chậm hơn hàng trăm lần, và input tăng 10× tốn khoảng 100× thời gian: chữ ký của bậc hai, đo trên chính máy bạn. Demo N+1 cho thấy cùng hình dạng đó bằng thời gian thật — 300 cú chờ tí hon thắng mọi đoạn code khôn khéo bạn có thể viết xen giữa chúng.

## Tự kiểm tra

1. Reviewer thấy một vòng loop ba tầng và gắn cờ O(n³). Câu hỏi đầu tiên bạn hỏi trước khi đồng ý là gì?
2. Endpoint của bạn mất 40ms với 10 dòng và 4 giây với 1.000 dòng. Bạn tìm hai bộ áo nào trước, và vì sao tỷ số đó chỉ về đó?
3. Khi nào bạn cố ý ship một giải pháp O(n²) thay vì O(n log n)?

<details><summary>Xem đáp án</summary>

1. "n ở đây là gì, và production nó lớn cỡ nào?" Nếu các loop chạy trên 7 ngày trong tuần hay 12 tháng, đó là khối lượng hằng số vĩnh viễn — hình dạng không quan trọng. Big-O chỉ có nghĩa với input thật sự tăng.
2. Input tăng 100× tốn 100× thời gian nghĩa là chi phí tuyến tính theo dòng, nên hãy tìm chi phí ẩn mỗi dòng: N+1 query (một vòng khứ hồi mỗi dòng) hoặc phép kiểm `in` trên list. N+1 khả năng cao hơn vì thời gian network áp đảo; cả hai đều tìm ra bằng câu hỏi "ở đây cái gì chạy một lần cho mỗi dòng?"
3. Khi n nhỏ và có chặn trên (vài trăm), và bản đơn giản ship được hôm nay trong khi bản khôn khéo ship muộn hơn hoặc mang rủi ro. Cũng đúng khi bản "tệ hơn" dễ đọc còn bản tốt hơn cần cấu trúc không ai trong team bảo trì nổi. Biết mình gần vách đá nào — rồi chọn có chủ đích.

</details>

## Điều cần nhớ

- Big-O là một thói quen: "input tăng 100× thì sao?" — đo tốc độ tăng, không phải tốc độ chạy; hằng số và ngữ cảnh vẫn quan trọng.
- O(n²) production mặc đồ hoá trang: `in` trên list, N+1 query, chuỗi `+=` trong loop — cú quét ẩn trong vòng loop lộ thiên.
- Ba câu hỏi review bắt được đa số: n là gì, có cú quét ẩn không, cả con đường tăng ra sao.
- Đo trước khi tối ưu, và đôi khi cố ý chọn complexity "tệ hơn" — lăng kính phục vụ phán đoán, không phải ngược lại.

*Tiếp theo — Phần 5: Kiến thức OS đứng sau mọi sự cố production.*
