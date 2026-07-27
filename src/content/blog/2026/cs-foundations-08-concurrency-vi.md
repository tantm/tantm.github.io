---
title: 'Concurrency không nước mắt'
description: 'Cuộc đua check-then-act, bốn tuyến phòng thủ theo thứ tự ưu tiên, deadlock như bài toán bàn ăn, và async/await giải thích thật thà — concurrency cho người phải ship.'
date: 2026-08-02
category: Developer
tags: [cs-foundations, concurrency, performance]
lang: vi
translationKey: cs-foundations-08
series: cs-foundations
part: 8
---

Phần 5 giới thiệu thread như bạn cùng phòng chia sẻ memory; Phần 7 cho thấy một race condition mặc áo database. Phần này đối mặt concurrency trực diện — không phải sở thú hàn lâm các primitive, mà là **một hình dạng bug gây ra gần hết nước mắt**, bốn tuyến phòng thủ theo thứ tự ưu tiên, và async/await thực chất là gì bên dưới lớp cú pháp.

## Một hình dạng bug: check-then-act

Gần như mọi bug concurrency bạn sẽ gặp là pattern này:

```python
if counter < limit:      # CHECK — đúng với cả hai thread
    counter += 1         # ACT — cả hai cùng act; vượt limit
```

Giữa cú check và cú act, một thread khác đã thay đổi thế giới. Bán trùng một ghế, gửi email hai lần, vượt rate limit — tất cả cùng một hình dạng. Ngay cả `counter += 1` đứng một mình cũng bí mật là ba bước (đọc, cộng, ghi — cỗ máy Phần 2 lộ hình), và hai thread có thể đan xen chúng thành một cú mất-update.

Sự tàn nhẫn nằm ở xác suất: cú đan xen xảy ra cỡ một phần triệu lần chạy — vô hình trong test, hằng tuần ngoài production (nơi scheduler của Phần 5 preempt vào đúng khoảnh khắc tệ nhất, được khối lượng bảo đảm). **Bạn không test cho hết được bug concurrency; bạn thiết kế cho chúng biến mất.**

## Bốn tuyến phòng thủ, theo thứ tự ưu tiên

**Phòng thủ 1 — Đừng chia sẻ (tốt nhất).** Không có trạng thái mutable dùng chung thì không có cuộc đua. Mỗi worker sở hữu dữ liệu của nó (các run sở hữu partition của S02-P03 chính là điều này ở quy mô pipeline); các worker giao tiếp bằng cách **chuyền message qua queue** (cái queue của Phần 3, giờ gánh trọng lượng thật) thay vì sờ chung biến. Đây là lý do phong cách "share nothing, pass messages" thống trị thiết kế hiện đại — từ channel của Go tới microservices (S06 một ngày nào đó) tới mọi worker-pool bạn sẽ viết.

**Phòng thủ 2 — Làm cho bất biến.** Dữ liệu không ai đổi được thì chia sẻ vô hạn vẫn an toàn. Dựng list mới thay vì mutate; snapshot config lúc khởi động; coi message là đông cứng khi đã gửi. (Sự bất biến của bronze, S02-P05, là tuyến phòng thủ này ở quy mô warehouse.)

**Phòng thủ 3 — Đẩy xuống thứ đã giải sẵn.** Cú `UPDATE ... WHERE` nguyên tử của database (Phần 7), increment nguyên tử của Redis, delivery gần-exactly-once của queue — các team hạ tầng đã dành hàng thập kỷ cho những cái lock của họ để bạn khỏi phải viết cái của mình. Với phối hợp xuyên *process*, đằng nào đây cũng là cửa duy nhất: cái mutex trong-process của bạn vô nghĩa với hai mươi pod còn lại (bò đàn của S04-P03), và vì thế "distributed lock" hầu như luôn nghĩa là "để database/Redis phân xử."

**Phòng thủ 4 — Lock, hẹp thôi (đường cùng).** Khi trạng thái mutable dùng chung là không tránh khỏi, một mutex biến check-then-act thành nguyên tử:

```python
with lock:               # mỗi lúc một thread, từ đây...
    if counter < limit:
        counter += 1     # ...tới đây. Check và act giờ là một khối.
```

Tay nghề nằm ở phạm vi: giữ lock trong critical section *ngắn nhất có thể* (không bao giờ quanh I/O — một cái lock giữ xuyên network call biến một request chậm thành vụ kẹt xe toàn công ty), và ưu tiên một lock thô rõ-ràng-đúng hơn năm lock mịn về-lý-thuyết-nhanh-hơn (đo trước — luật Phần 4 áp cho cả tinh chỉnh lock).

## Deadlock: bài toán triết gia ăn tối, phiên bản đi làm

Lock mang theo cú fail kinh điển của riêng nó: thread A giữ lock 1 muốn lock 2; thread B giữ 2 muốn 1. Cả hai chờ nhau mãi mãi — không crash, không lỗi, chỉ một hệ thống đứng im (các process state `D` của Phần 5 chất đống trong khi CPU ngồi chơi). Hai thuốc chữa dùng được: **giành lock theo một thứ tự toàn cục cố định** (ai cũng lấy account-id-nhỏ-hơn trước thì vòng tròn không thể hình thành — trong code thật nó là dòng "luôn lock account theo thứ tự id" trong logic chuyển tiền), và **timeout khi giành lock** để worker kẹt fail to tiếng thay vì im lặng vĩnh viễn (database làm sẵn giùm: lock timeout và phát hiện deadlock là lý do Phần 7 bảo đẩy xuống).

## Async/await: concurrency không thread (chỉ dành cho sự chờ)

Cái `async`/`await` bạn gặp trong Python, JS và bè bạn *không phải* parallelism. Nó là insight của Phần 2 ("phần lớn việc của server là chờ") được biến thành cú pháp: **một thread, nhiều task tạm dừng** — tại mỗi `await`, task đỗ lại và event loop cho người khác chạy.

```python
results = await asyncio.gather(*[fetch(u) for u in urls])   # 100 request "cùng lúc"
# Một thread. Concurrency = chồng lấn sự CHỜ, không phải sự tính.
```

Các hệ quả cắn thật: async toả sáng với fan-out I/O-bound (100 cú gọi API trong thời gian của cú chậm nhất — hình phạt N+1 của Phần 4 được ân xá một phần) và *không làm gì* cho việc CPU-bound — một phép tính nặng bên trong handler async **chặn mọi task trên loop** (sự cố "server async của bọn em đứng hình" kinh điển; thuốc là giao việc CPU cho một process pool). Và một bất ngờ dễ chịu cần ghi chú: bên trong event loop đơn thread, check-then-act *giữa các* `await` vẫn là cuộc đua (task đan xen tại await!), nhưng code tuần tự giữa hai await là nguyên tử — cần ít lock hơn, không phải cần ít suy nghĩ hơn.

Luật quyết định, nối dài câu hỏi Phần 2: **I/O-bound → async (hoặc thread); CPU-bound → process (hoặc đẩy xuống database/queue); phân vân → đo.**

## Điều cần nhớ

- Gần như mọi bug concurrency là check-then-act; thiết kế cho nó biến mất, đừng test cho nó hết.
- Phòng thủ theo thứ tự: đừng chia sẻ (queue giữa các chủ sở hữu), làm bất biến, đẩy tính nguyên tử xuống DB/Redis/queue, và cuối cùng mới lock — hẹp, không bao giờ xuyên I/O.
- Deadlock cần một vòng tròn: thứ tự lock cố định và timeout phá được nó; database phát hiện giùm bạn.
- Async/await chồng lấn *sự chờ* trên một thread — món quà cho fan-out I/O, cái bẫy cho việc CPU, và vẫn đua giữa các await.

*Tiếp theo — Phần 9: Git, testing, code review — kỹ năng đi làm thật.*
