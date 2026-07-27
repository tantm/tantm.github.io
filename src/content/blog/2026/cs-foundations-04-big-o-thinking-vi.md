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

## Bảng duy nhất bạn cần

| Lớp | Tên | Nếu n tăng 100× thì khối lượng tăng… | Ví dụ thường ngày |
|---|---|---|---|
| O(1) | hằng số | không tăng | tra hash map (Phần 3) |
| O(log n) | logarit | thêm ~7 bước | seek trên DB index (B-tree) |
| O(n) | tuyến tính | 100× | một lượt duyệt list |
| O(n log n) | tuyến tính-log | ~700× | một thuật toán sort tử tế |
| O(n²) | bậc hai | **10.000×** | loop lồng trong loop |
| O(2ⁿ) | mũ | tàn cuộc | thử mọi tập con |

Hai ghi chú thật thà mà flashcard bỏ qua. Một, **hằng số vô hình nhưng có thật**: O(n) đọc từ disk thua O(n log n) trong RAM ở mọi kích thước bạn sẽ gặp — Big-O xếp hạng *tốc độ tăng*, không phải *tốc độ chạy* (đấy là việc của bảng latency Phần 2). Hai, **n phải là thứ thật sự tăng**: vòng loop ba tầng trên 7 ngày trong tuần là O(1) vĩnh viễn. Câu hỏi không bao giờ là "có loop lồng không?" mà là "*input nào đang tăng, và cái gì nhân theo nó?*"

## O(n²) trốn ở đâu trong code production

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

n+1 vòng khứ hồi network (Phần 2: mỗi vòng ~2 tuần, tính theo CPU-năm). Cách sửa là câu thần chú Phần 3 — dựng index rồi tra: lấy toàn bộ customers trong **một** query (`WHERE id IN (...)` hoặc JOIN), dict theo id, tra trong RAM. Tính năng "eager loading" của mọi ORM tồn tại vì đúng con bug này.

**Bộ áo 3 — nối chuỗi trong loop** (`report += line` chép lại nguyên chuỗi mỗi vòng — dùng `"".join(lines)`), **`list.insert(0, x)` lặp đi lặp lại** (xê dịch tất cả, mỗi lần — dùng deque), và họ hàng đông đúc của chúng. Chữ ký chung: **một thao tác tuyến tính ẩn bên trong một vòng loop tuyến tính lộ thiên.**

Kỹ năng không phải là né loop lồng — mà là *nhìn thấy* cái O(n) bên trong khi nó không mang hình dạng một vòng loop.

## Thói quen, gói trong ba câu hỏi

Chạy chúng lúc code review — mất mười giây:

1. **n ở đây là gì, và production nó lớn cỡ nào?** (n = 20 setting → kệ nó. n = số đơn hàng ngày Black Friday → quan tâm.)
2. **Có cú quét ẩn nào trong vòng loop này không?** (`in` trên list, một query, một `.filter()` trên tất cả, chuỗi `+=`.)
3. **Tốc độ tăng của CẢ CON ĐƯỜNG là gì, không chỉ hàm này?** Một hàm O(n) được gọi n lần *chính là* O(n²) — hành vi bậc hai sống sót qua review theo đúng cách này, từng lớp trông-vô-tội một.

Và thói quen đối trọng: **đo trước khi tối ưu.** Big-O chỉ chỗ sự sụp đổ *có thể* trốn; profiler chỉ chỗ thời gian *thật sự* đi. Tối ưu một O(n²) chạy trên n=50 trong khi chi phí thật nằm ở một cú network call chậm là cách kinh điển để mất một buổi chiều. Câu hỏi Phần 2 ("đang chờ hay đang tính?") đi trước; Big-O thứ hai; profiler làm trọng tài.

## Khi Big-O "tệ hơn" lại là lựa chọn đúng

Phán đoán senior gồm cả chiều ngược lại: cái O(n²) ship hôm nay chạy trên n≤1.000 thắng cái O(n log n) khôn khéo ship thứ Sáu kèm một con bug; lượt quét tuyến tính dễ đọc thắng cấu trúc kỳ lạ không ai trong team bảo trì nổi. Big-O là một *lăng kính*, không phải đạo luật — mục tiêu là biết mình đang đứng gần vách đá nào, không phải khoe độ khéo. (Trong khi đó database chơi giùm bạn trò này ở mọi query — chuyện index và query plan của Phần 7.)

## Điều cần nhớ

- Big-O là một thói quen: "input tăng 100× thì sao?" — đo tốc độ tăng, không phải tốc độ chạy; hằng số và ngữ cảnh vẫn quan trọng.
- O(n²) production mặc đồ hoá trang: `in` trên list, N+1 query, chuỗi `+=` trong loop — cú quét ẩn trong vòng loop lộ thiên.
- Ba câu hỏi review bắt được đa số: n là gì, có cú quét ẩn không, cả con đường tăng ra sao.
- Đo trước khi tối ưu, và đôi khi cố ý chọn complexity "tệ hơn" — lăng kính phục vụ phán đoán, không phải ngược lại.

*Tiếp theo — Phần 5: Kiến thức OS đứng sau mọi sự cố production.*
