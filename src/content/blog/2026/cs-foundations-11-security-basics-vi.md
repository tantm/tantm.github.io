---
title: 'Security cơ bản mọi developer phải có'
description: 'Một attacker model duy nhất (input là code cho tới khi chứng minh là data), ba họ bug đứng sau đa số vụ breach, secrets không bao giờ chạm git, và least privilege như tư thế mặc định.'
date: 2026-08-04
category: Developer
tags: [cs-foundations, security, web]
lang: vi
translationKey: cs-foundations-11
series: cs-foundations
cover: images/s01-p11-hero.png
part: 11
---

Security được dạy như môn tự chọn chuyên sâu, rồi hoá ra lại là một dòng trong code review của *bạn*, mãi mãi. Tin tốt: phần lớn các vụ breach ngoài đời đến từ một nhúm họ bug, và tất cả đều gục trước một mental model. **Mọi input là code cho tới khi được chứng minh là data.** Một URL parameter, một ô form, một tên file, một JSON body, một HTTP header — kẻ tấn công là người viết chúng, và đâu đó trong hệ thống của bạn có một interpreter (SQL engine, browser, shell, template engine) sẵn lòng *thực thi* thứ bạn chuyển tiếp. Security cơ bản = biết các interpreter của mình và không bao giờ để văn bản không đáng tin chạm vào chúng ở dạng thô.

## Bạn sẽ học được gì

- Nhận ra họ injection từ một nguyên nhân chung, xuyên bốn bộ áo khác nhau.
- Lưu mật khẩu và kiểm quyền theo cách sống sót qua một vụ rò rỉ.
- Xử lý secret sao cho một repository bị lộ không đồng nghĩa với một hệ thống production bị lộ.
- Coi least privilege là tư thế mặc định chứ không phải một việc dọn dẹp.

**Cần biết trước:** Phần 6 (HTTP và TLS) và Phần 7 (database). Toàn bộ nội dung ở đây là phòng thủ.

## 1. Họ injection: một bug, nhiều bộ áo

```mermaid
flowchart LR
  A[Input do attacker kiểm soát] --> B{Chạm tới interpreter?}
  B -->|SQL engine| C["SQL injection<br/>' OR 1=1 --"]
  B -->|Browser DOM| D["XSS<br/>&lt;script&gt; trong comment"]
  B -->|Shell| E["Command injection<br/>; rm trong tên file"]
  B -->|LLM prompt| F["Prompt injection<br/>(teaser của S03-P08)"]
  B -->|Không — được coi là data| G[An toàn]
```

**SQL injection** là bài kinh điển: dựng query bằng nối chuỗi và input `' OR 1=1 --` viết lại mệnh đề `WHERE` của bạn. Cách chữa hai mươi năm nay vẫn vậy và bạn đã gặp ở P7: **parameterized query, luôn luôn** — driver gửi hình dạng query và các giá trị tách rời nhau, nên giá trị không bao giờ biến thành cú pháp được. Bất kỳ SQL nối chuỗi nào trong review là một blocking comment (phân loại của P9), bất kể tool "nội bộ" tới đâu.

**XSS (cross-site scripting)** là cùng bug đó với interpreter là *browser*: nội dung người dùng render vào HTML không escape nghĩa là "comment" của ai đó chạy như script trong session của mọi khách khác — kèm cookie của họ. Framework hiện đại escape mặc định; XSS sống sót ở các cửa thoát hiểm (prop raw-HTML với cái tên nghe đã nguy hiểm — cái tên chính là lời cảnh báo) và trong template dựng chuỗi thủ công. Luật: giữ nguyên escape của framework, raw HTML chỉ cho nội dung *bạn* tự viết, không bao giờ cho bất kỳ thứ gì hình-dạng-người-dùng.

**Command injection** là cùng bug đó với interpreter là shell: `os.system("convert " + filename)` cộng một tên file chứa `;` sẽ chạy lệnh của kẻ tấn công. Cách chữa: mảng đối số (`subprocess.run([...])`, không bao giờ `shell=True` với input người dùng) — nước đi parameterized-query của P7, phiên bản shell. Và **prompt injection** (S03-P08) là bộ áo mới nhất: văn bản mà LLM của bạn đọc là input hành xử như chỉ thị. Cùng model, chưa có cách chữa triệt để — đó là lý do ở đấy bạn thấy "least privilege trên tool."

## 2. Auth: phần ai cũng tự chế và tự chế sai

Hai từ không đồng nghĩa: **authentication** (bạn là ai) và **authorization** (bạn được làm gì). Luật thực chiến cho từng cái:

- **Không bao giờ lưu password** — lưu hash chậm có salt (họ bcrypt/argon2). Một bảng hash nhanh bị lộ (hay tệ hơn, plaintext) biến một vụ breach thành credential-stuffing nhắm vào mọi site mà người dùng xài chung mật khẩu. Đây cũng là lý do đừng tự phát minh scheme riêng: dùng auth của framework hoặc managed identity provider; bản tự chế là một học kỳ toàn câu hỏi thi bạn chưa từng thấy.
- **Authorization kiểm tra ở server, mỗi request, đối chiếu với tài nguyên.** Lỗ hổng kinh điển không phải login hỏng — mà là `GET /invoices/4823` trả về hoá đơn của người khác, vì code kiểm tra *rằng* bạn đã đăng nhập chứ không kiểm tra hoá đơn đó *của ai* (IDOR — insecure direct object reference). Giấu cái nút trong UI không phải là một cú kiểm tra; kẻ tấn công dùng `curl` (P6), không dùng frontend của bạn.
- **Session cưỡi trên cookie, nên hãy bảo vệ cookie**: `HttpOnly` (script không đọc được — chặn bớt thiệt hại XSS), `Secure` (chỉ HTTPS, mindset của P6), `SameSite` (bẻ cùn cross-site request forgery). Bốn lá cờ biến vài lớp tấn công thành chuyện không xảy ra.

## 3. Secrets: vụ breach do chính bạn commit

Một password nằm trong code chỉ cách công khai đúng một cú `git push` — và **git nhớ** (cái graph của P9: xoá file ở commit mới chẳng xoá gì cả; secret sống trong lịch sử và phải được *rotate*, không phải remove). Kỷ luật:

- Secret sống trong **env/config tiêm lúc runtime** — biến môi trường, secrets manager — không bao giờ trong code, không bao giờ trong repo, soi gương thói quen config-ngoài-code của S02-P03 và sự cố key-trong-repo của S04-P02.
- **`.gitignore` file env từ ngày số không** và commit một `.env.example` có tên biến nhưng không có giá trị.
- Mặc định coi mọi secret từng chạm repo, dòng log, hay tin nhắn chat là đã cháy: **rotate nó**. Bản thân việc rotation rẻ là một mục tiêu thiết kế — đó là lý do auth theo danh tính, không key (role của S04-P02) thắng key sống dai ở mọi nơi có thể.

## 4. Least privilege như tư thế mặc định

Ý tưởng bán kính vụ nổ từ S04-P02, tổng quát hoá: mỗi thành phần nhận đúng mức tối thiểu nó cần, để một thành phần bị chiếm là một sự cố, không phải một thảm hoạ. DB user của app không thể `DROP TABLE` (constraint của P7 là tuyến cuối); service upload chỉ ghi được vào bucket *của nó* (Block Public Access mặc định của S04-P04); job báo cáo dùng replica read-only; script của thực tập sinh không chạy quyền admin. Không thứ nào ở đây ngăn cái bug ban đầu — chúng ngăn cái bug trở thành tít báo.

Hai thói quen hoàn thiện tư thế: **HTTPS mọi nơi, bật verification** (P6 nói rồi: `verify=false` trong code production là blocking comment — bạn đang tắt bằng chứng duy nhất rằng mình nói chuyện đúng server), và **vá dependency đều tay** — đa số vụ chiếm quyền thật khai thác lỗ hổng *đã biết* trong thư viện *chưa vá*; con bot cập nhật dependency (CI của P9 khiến điều đúng thành tự động) là một security control, không phải việc vặt.

## Thực hành (25 phút — tự phá app đồ chơi của mình, rồi bịt từng lỗ)

Mọi thứ dưới đây chạy ở local trên chính code bạn viết, và đó là nơi duy nhất kiểu bài tập này thuộc về. Không phần nào nhắm vào hệ thống bạn không sở hữu.

```python
import sqlite3, hashlib, secrets, time

db = sqlite3.connect(":memory:")
db.executescript('''
CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT, pw TEXT, role TEXT);
CREATE TABLE notes(id INTEGER PRIMARY KEY, owner_id INT, body TEXT);
INSERT INTO users VALUES (1,'alice','x','user'), (2,'bob','x','admin');
INSERT INTO notes VALUES (1,1,'ghi chú riêng của alice'), (2,2,'ghi chú admin của bob');
''')

# 1. INJECTION — bản dễ tổn thương dựng query bằng cách nối chuỗi
def find_user_bad(name):
    return db.execute(f"SELECT id,name,role FROM users WHERE name = '{name}'").fetchall()
print("bình thường:", find_user_bad("alice"))
print("tấn công   :", find_user_bad("alice' OR '1'='1"))  # mọi user, từ một ô input

# SỬA: tham số giữ dữ liệu là dữ liệu, không bao giờ là code
def find_user_good(name):
    return db.execute("SELECT id,name,role FROM users WHERE name = ?", (name,)).fetchall()
print("đã sửa     :", find_user_good("alice' OR '1'='1"))  # 0 dòng: chỉ là một cái tên kỳ quặc

# 2. LƯU MẬT KHẨU — hash nhanh vs hash cố tình chậm
pw = "correct horse battery staple"
t = time.perf_counter(); [hashlib.sha256(pw.encode()).hexdigest() for _ in range(50000)]
print(f"sha256 x50k: {time.perf_counter()-t:.2f}s   ← kẻ tấn công làm thế này cho MỖI lần đoán")
salt = secrets.token_bytes(16)
t = time.perf_counter(); hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
print(f"pbkdf2  x1 : {time.perf_counter()-t:.2f}s   ← sự CHẬM chính là tính năng")

# 3. IDOR — xác thực không phải phân quyền
def get_note_bad(note_id):                                # "giao diện chỉ hiện ghi chú của họ mà"
    return db.execute("SELECT body FROM notes WHERE id = ?", (note_id,)).fetchone()
print("alice đọc ghi chú 2:", get_note_bad(2))            # ghi chú của bob, qua một URL sửa tay

def get_note_good(note_id, current_user_id):              # quyền sở hữu kiểm ngay TRONG query
    return db.execute("SELECT body FROM notes WHERE id = ? AND owner_id = ?",
                      (note_id, current_user_id)).fetchone()
print("alice đọc ghi chú 2 (đã sửa):", get_note_good(2, 1))  # None — với cô ấy là không tồn tại
```

Kết quả mong đợi: query nối chuỗi trả về mọi user từ một cái tên được dàn dựng, còn bản tham số hoá trả về rỗng — vì tham số nghĩa là database không bao giờ coi input là cú pháp. Khối đo thời gian làm lập luận về mật khẩu thành cụ thể: một hash nhanh cho phép kẻ tấn công thử hàng chục nghìn lần đoán mỗi giây trên bảng đã đánh cắp, còn một hash cố tình chậm khiến chính cuộc tấn công đó thành bất khả thi. Khối thứ ba là khối hay lên production nhất: người dùng đã đăng nhập *đúng là Alice*, nên code cảm giác an toàn, nhưng không gì kiểm rằng ghi chú số 2 là của cô ấy. Phân quyền thuộc về câu query, không thuộc về giao diện vẽ ra các đường link.

## Tự kiểm tra

1. ORM bảo vệ bạn khỏi SQL injection. Nó *không* bảo vệ bạn khỏi những thành viên nào trong họ injection?
2. Đồng nghiệp nói lưu mật khẩu bằng SHA-256 kèm salt là ổn vì "SHA-256 chưa bị phá". Lập luận đó sai ở đâu?
3. Một secret đã bị commit rồi được gỡ ở commit sau. Vấn đề đã xong chưa?

<details><summary>Xem đáp án</summary>

1. Tất cả các thành viên còn lại: cross-site scripting khi bạn render input người dùng vào HTML, command injection khi bạn dựng chuỗi shell, và prompt injection khi bạn nối văn bản người dùng vào prompt LLM. Nguyên nhân chung là coi input là code ở một chỗ khác trong stack — ORM chỉ sửa cái biên giới database.
2. SHA-256 chưa bị phá *với tư cách một hash*, mà đó không phải tính chất bạn cần. Nó được thiết kế để nhanh, và nhanh đúng là thứ giúp kẻ đã đánh cắp bảng: họ tính được hàng tỷ lần đoán. Hash mật khẩu cần một hàm cố tình chậm và tốn bộ nhớ (bcrypt, scrypt, Argon2, hoặc PBKDF2 với số vòng lặp cao) để mỗi lần đoán tốn thời gian thật.
3. Chưa. Git giữ lịch sử, nên secret vẫn nằm trong repository, trong mọi bản clone và mọi bản fork. Cách sửa thật duy nhất là rotate cái credential để giá trị bị lộ ngừng hoạt động; viết lại lịch sử là phần dọn dẹp tuỳ chọn sau đó, và nó không bao giờ với tới các bản sao người khác đã có.

</details>

## Điều cần nhớ

- Một model phủ đa số vụ breach: input là code cho tới khi chứng minh là data — biết các interpreter (SQL, browser, shell, LLM) và đi đường parameterized/escape, không bao giờ dựng chuỗi.
- Auth: framework hoặc managed identity, hash chậm có salt, và authorization kiểm ở server theo từng tài nguyên — login có thể hoàn hảo trong khi `/invoices/4823` rò rỉ tất cả.
- Secret không bao giờ chạm git; tiêm qua env/secrets manager, `.env.example` cho hình dạng, và rotate mọi thứ từng rò rỉ — lịch sử git là mãi mãi.
- Least privilege + HTTPS-có-verification + dependency được vá: ba mặc định nhàm chán biến bug thành sự cố thay vì tít báo.

*Tiếp theo — Phần 12: Từ đồ án đến hệ thống production — hồi kết của series.*
