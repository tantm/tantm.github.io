---
title: 'Design patterns & abstraction: khi nào dùng, khi nào bỏ'
description: 'Bốn pattern bạn thật sự gặp, SOLID nén còn hai luật thực chiến, và lòng can đảm viết code nhàm chán — abstraction là một khoản vay phải trả.'
date: 2026-08-04
category: Developer
tags: [cs-foundations, design-patterns, architecture]
lang: vi
translationKey: cs-foundations-10
series: cs-foundations
cover: images/s01-p10-hero.png
part: 10
---

Design pattern có cùng vấn đề PR với Big-O (P4): được dạy như từ vựng phỏng vấn, được triển khai như đồ trang trí CV, rồi bị đổ lỗi cho mớ hỗn độn thu được. Phiên bản phục hồi danh dự: **pattern là tên gọi cho các lời giải cứ lặp đi lặp lại** — cái tên giúp bạn *nói chuyện* về code; lời giải chỉ giúp khi bạn thật sự có bài toán đó. Phần này phủ bốn pattern bạn sẽ gặp thật, SOLID nén còn phần sống sót khi va thực tế, và kỹ năng senior không ai quảng cáo: *không* abstract.

## Bạn sẽ học được gì

- Quyết định khi nào một abstraction xứng với phần lãi nó bắt trả — và khi nào trùng lặp lại rẻ hơn.
- Nhận ra bốn pattern bạn thật sự gặp, kể cả cái đã nằm sẵn trong framework của bạn.
- Nén SOLID còn hai nguyên tắc sống sót khi va vào code thật.
- Bảo vệ code nhàm chán trong review, bằng lý lẽ chứ không bằng khẩu vị.

**Cần biết trước:** Không cần gì. Từng làm việc trên một codebase không do mình viết thì các lập luận sẽ thấm hơn.

## 1. Abstraction là một khoản vay

Mỗi abstraction vay mượn từ tương lai: bạn trả độ phức tạp *ngay bây giờ* (một interface, một tầng gián tiếp, một khái niệm phải học) để đổi lấy sự linh hoạt *về sau*. Khoản vay tốt được hoàn trả — sự linh hoạt được dùng đến. Khoản vay xấu lãi kép: các tầng không ai cần, những interface "phòng khi" với đúng một implementation, một codebase mà việc tìm *nơi mọi thứ thật sự xảy ra* tốn ba cú nhảy (phương pháp đọc-code của CS-P9, bị phá hoại).

Luật cho vay chặn được đa số khoản vay xấu: **abstract ở lần xuất hiện thứ hai hoặc thứ ba, đừng ở lần đầu** (bạn không thể thiết kế interface tốt từ một ví dụ — bạn chưa biết phần nào sẽ biến thiên), và **inline là một cú refactor hợp lệ** — xoá một abstraction không kiếm nổi tiền thuê là việc của senior, không phải sự thụt lùi.

## 2. Bốn pattern bạn sẽ gặp thật

**Strategy — hành vi tráo được sau một interface.** Pattern bạn đã dùng mà chưa gọi tên:

```python
class S3Storage:      def save(self, key, data): ...
class LocalStorage:   def save(self, key, data): ...   # test, dev

def process(order, storage):        # bên gọi không quan tâm là cái nào
    storage.save(order.id, render(order))
```

Bạn từng thấy nó ở đâu: mọi option config "backend", pattern biên giới của S02-P03 (parse một lần, tráo nguồn), auth cắm-rút. Dấu hiệu cần nó: một chuỗi `if provider == "x" ... elif provider == "y"` lan qua nhiều function.

**Factory — một nơi duy nhất biết cách dựng ra thứ đó.** Không phải nghi lễ `AbstractFactoryFactory`; chỉ là: logic khởi tạo (class nào? config nào? credential nào?) sống trong *một* function thay vì copy-paste ở mọi call site. `create_storage(env)` trả về đúng Strategy — trọn vẹn pattern, và để ý hai đứa ghép nhau: factory dựng strategy.

**Observer — các phản ứng tách rời với sự kiện.** "Khi X xảy ra, vài thứ nên phản ứng, và X không nên biết về chúng." Bạn đã ở *bên trong* pattern này suốt cả series: S3 event kích Lambda (S04-P07), lập lịch data-aware của Airflow (S02-P08), outbox nuôi subscriber (S07-P06). Trong-process là callback/listener; giữa các hệ thống là một cái queue — cùng ý tưởng, khác khoảng cách.

**Adapter — interface của bạn bọc quanh mớ lộn xộn của họ.** SDK bên thứ ba đổi API, hoặc bạn dùng hai provider hai hình dạng: định nghĩa interface *của bạn* (đúng thứ app cần, không hơn) và viết một adapter mỏng cho mỗi provider. Đây là pattern khiến migration strangler của S07-P13 khả thi và giữ vendor lock-in (tư duy lối-thoát của S07-P03) ở rìa codebase thay vì dệt xuyên qua nó.

Đó là bộ làm việc. Hai mươi pattern còn lại vẫn tồn tại; bạn sẽ nhận ra chúng từ DNA của bốn đứa này khi chúng xuất hiện.

## 3. SOLID, nén còn phần sống sót

Năm nguyên tắc, thật thà rút còn hai cái bạn dùng hằng tuần:

- **Single responsibility** — phát biểu chuẩn hơn là *một lý do để thay đổi*. Bài test không phải "class này có làm một việc không?" (mơ hồ vô vọng) mà là "khi yêu cầu đổi, mình chạm bao nhiêu file, và file này có bị đổi vì những lý do chẳng liên quan nhau không?" Độ hạt task của S02-P08 ("task là đơn vị retry") chính là nguyên tắc này mặc áo orchestrator.
- **Phụ thuộc vào interface tại các biên giới** (chữ D) — thứ bạn đã làm từ biên-giới-có-type của S02-P03: code dựa trên "một storage", "một notifier", "một model client" tại các đường may nơi implementation có khả năng biến thiên thật — và *chỉ* tại đó. Khúc giữa của business logic không cần nghi lễ dependency injection.

Ba chữ còn lại (O/L/I) chủ yếu có giá trị như mùi code-review: mở rộng hành vi mà phải sửa mười cái switch (O), subclass vỡ ở chỗ cha nó chạy (L), hay implement một interface bị ép viết bảy method rỗng (I) — bản thiết kế đang nói chuyện với bạn đấy.

## 4. Lòng can đảm viết code nhàm chán

Kỹ năng thiết kế đáng giá nhất ở năm thứ năm là thứ trông như không có kỹ năng gì: **một function trơn, một dict trơn, code đọc từ trên xuống dưới**. Pattern dành cho bài toán *lặp lại*; đa số code giải một bài toán đúng một lần. Các heuristic giữ bạn trung thực:

- **YAGNI có răng**: "sau này mình có thể cần hỗ trợ nhiều provider" — khi cái sau-này đó đến, cú refactor Adapter là một ngày công *trên yêu cầu đã biết*; phiên bản suy đoán xây hôm nay là một cú đoán bạn phải bảo trì nhiều năm.
- **Trùng lặp rẻ hơn abstraction sai** (bài học cả ngành đã trả giá đắt): hai bản copy giống-mà-đang-tẽ-nhánh thì khó chịu; một abstraction chung phục vụ hai nhu cầu đang tẽ nhánh sẽ mọc tham số điều kiện cho tới khi không ai dám chạm. Chờ bản copy thứ ba chứng minh phần nào mới thật sự chung.
- **Tối ưu cho người đọc không có mặt hôm đó** (trọn luận đề CS-P9): mỗi tầng gián tiếp là một trang người đọc phải giữ trong đầu. Cái pattern tiết kiệm cho bạn 10 dòng nhưng bắt mọi người đọc tương lai trả một cú nhảy là một thương vụ lỗ.

## Thực hành (20 phút — cố tình viết một abstraction sai, rồi cảm nhận nó đau ở đâu)

Bài này cố ý dùng giấy-và-editor thay vì lab chạy được: abstraction tồi không fail, nó *tính tiền*, và cái giá đó mới là thứ bạn phải học cách nhìn thấy.

**Bước 1 (5 phút).** Lấy đoạn trùng lặp này và kìm lại đừng sửa vội:

```python
def send_welcome_email(user):
    subject = f"Welcome, {user.name}!"
    body = render("welcome.html", name=user.name)
    smtp.send(user.email, subject, body)

def send_receipt_email(user, order):
    subject = f"Receipt for order {order.id}"
    body = render("receipt.html", name=user.name, total=order.total)
    smtp.send(user.email, subject, body)
```

Viết ra cái abstraction bạn đang muốn dựng (`send_templated_email(user, template, subject_fmt, **ctx)`), rồi liệt kê những thứ nó sẽ phải lớn lên để gánh: file đính kèm, một người gửi khác, một email gửi cho admin thay vì user, một locale, và luật "đừng gửi vào cuối tuần".

**Bước 2 (5 phút).** Giờ viết chữ ký của hàm tổng quát đó sau khi có đủ năm yêu cầu. Đếm số tham số. Hỏi thật lòng: một đồng nghiệp mới sẽ thấy gọi nó dễ hơn hay viết bốn dòng SMTP dễ hơn?

**Bước 3 (10 phút).** Tìm một abstraction thật trong code bạn sở hữu — một base class, một helper nhiều cờ, một lớp bọc quanh thư viện. Trả lời ba câu bằng cách viết ra: Nó có bao nhiêu chỗ gọi? Bao nhiêu tham số của nó tồn tại cho đúng một người gọi? Nếu xoá nó đi và inline khắp nơi, codebase sẽ dài hơn *và* rõ hơn, hay chỉ dài hơn?

Kết quả mong đợi: bước 2 thường đẻ ra một chữ ký hàm chẳng ai muốn gọi, và đó chính là điểm mấu chốt — bản tổng quát đã hút vào năm yêu cầu không liên quan gì nhau, và giờ mọi người gọi đều trả tiền cho cả năm. Bước 3 đáng lặp lại mỗi quý: một abstraction có hai chỗ gọi và bốn tham số phục vụ một người gọi thì không phải code dùng chung, nó là một mối ràng buộc bạn sẽ trả lãi dài dài. Luật rút ra chính là luật ở đầu bài — hãy đợi tới lần dùng thật thứ hai hoặc thứ ba, và để những khác biệt *có thật* định hình giao diện thay vì những khác biệt tưởng tượng.

## Tự kiểm tra

1. Bạn thấy đúng sáu dòng đó ở ba service. Bạn cần biết gì trước khi rút chúng thành một thư viện dùng chung?
2. Đồng nghiệp lập luận rằng một đoạn code vi phạm nguyên tắc open-closed và cần một kiến trúc plugin. Bạn hỏi gì?
3. Khi nào trùng lặp mới là lựa chọn kỹ thuật tốt hơn?

<details><summary>Xem đáp án</summary>

1. Ba bản đó có giống nhau *vì cùng một lý do* hay không. Code trông y hệt nhưng phục vụ ba yêu cầu độc lập rồi sẽ tách nhau ra, và khi đó một thư viện dùng chung buộc ba team phải phối hợp cho mọi thay đổi. Hãy hỏi: khi luật của một bên gọi đổi thì sao? Nếu câu trả lời là "hai bên kia không được đổi theo", thì phần trùng lặp là có thật và bạn nên giữ.
2. Phần mở rộng cụ thể nào sắp tới, và khi nào. Open-closed sinh lời khi bạn thật sự thêm biến thể thường xuyên; khi không, một kiến trúc plugin là khoản phức tạp cố định trả mãi mãi để đổi lấy một giả thuyết. Hãy xin hai ví dụ về các biến thể tương lai — không ai gọi tên được thì code hiện tại vẫn ổn.
3. Khi các bản sao thay đổi vì những lý do khác nhau, khi bản dùng chung sẽ cần cờ để phục vụ từng người gọi, khi nó đủ nhỏ để đọc trong một cái liếc, hoặc khi abstraction sẽ ràng buộc những module vốn độc lập. Trùng lặp thì rẻ và cục bộ; một abstraction sai thì đắt và lan toàn cục.

</details>

## Điều cần nhớ

- Abstraction là khoản vay: vay ở lần xuất hiện thứ hai-ba, hoàn trả bằng sự linh hoạt được dùng, và inline thứ không kiếm nổi tiền thuê.
- Bốn pattern phủ cả sân: Strategy (hành vi tráo được), Factory (khởi tạo một chỗ), Observer (phản ứng tách rời — bạn đã gặp nó dưới dạng queue và trigger), Adapter (interface của bạn tại biên giới vendor).
- SOLID thực chiến: một lý do thay đổi mỗi đơn vị, interface tại các biên giới thật sự biến thiên — phần còn lại là mùi review.
- Code nhàm chán là một kỹ năng: YAGNI, trùng lặp thắng abstraction sai, và luôn tối ưu cho người đọc không có mặt trong phòng.

*Tiếp theo — Phần 11: Security cơ bản mọi developer phải có.*
