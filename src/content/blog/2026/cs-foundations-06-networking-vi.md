---
title: 'Chuyện gì xảy ra khi bạn gõ một URL'
description: 'DNS, TCP, TLS, HTTP — vở kịch bốn màn sau mỗi request, các status code kể chuyện, và những cờ curl biến networking từ truyền miệng thành đo đạc.'
date: 2026-07-31
category: Developer
tags: [cs-foundations, networking, http]
lang: vi
translationKey: cs-foundations-06
series: cs-foundations
cover: images/s01-p06-hero.png
part: 6
---

Mọi hệ thống bạn xây từ giờ đều là hệ phân tán — nghĩa là mọi con bug không tái hiện được ở local nhiều khả năng sống trong network. Phần này đi bộ qua câu hỏi phỏng vấn kinh điển một cách thật thà: bạn gõ `https://example.com/orders` và nhấn Enter. Bốn màn kịch nối nhau, mỗi màn có kiểu hỏng riêng.

## Bạn sẽ học được gì

- Kể lại được bốn màn kịch giữa lúc nhấn Enter và lúc thấy phản hồi.
- Phân biệt vấn đề DNS với vấn đề TCP với server chậm, bằng một câu lệnh.
- Đọc HTTP status code như chỉ dẫn về việc ai phải sửa cái gì.
- Dùng `curl -w` làm ống nghe gán độ trễ về đúng màn kịch gây ra nó.

**Cần biết trước:** Không cần gì — bài này tự đứng được. Phần 5 có ích cho ca "server đang suy nghĩ".

## 1. DNS: tên thành số

Máy tính định tuyến bằng IP; con người nhớ tên. **DNS** bắc cầu: máy bạn hỏi resolver "`example.com` ở đâu?" và nhận về một IP — sau khi resolver đi bộ qua hệ phân cấp (root → `.com` → name server của chính domain) ở lần hỏi nguội, hoặc trả lời tức thì từ **cache** ở lần hỏi ấm.

Caching là toàn bộ tính cách của DNS. Mỗi record mang một **TTL** (time to live — "tin đáp án này trong N giây"). Vì thế các thay đổi DNS "lan truyền" chậm: chẳng có gì lan truyền cả, các cache chỉ hết hạn theo nhịp riêng của chúng.

Ba hệ quả bạn sẽ gặp thật. TTL thấp là thứ khiến các cú cutover traffic khả thi. Cache cũ là lý do "máy em chạy mà máy khách không chạy". Và `dig example.com` là bài test hai giây tách "vấn đề DNS" khỏi "mọi thứ còn lại" — ngã ba đầu tiên của mọi cuộc debug kết nối.

## 2. TCP: cuộc trò chuyện đáng tin trên một thế giới không đáng tin

Internet làm rơi, đảo thứ tự và nhân bản gói tin như cơm bữa. **TCP** dựng một dòng byte đáng tin bên trên: cú bắt tay ba bước trứ danh (SYN → SYN-ACK → ACK) mở cuộc trò chuyện, số thứ tự khôi phục trật tự, acknowledgement kích hoạt gửi lại thứ đã mất.

Hai sự thật đáng giá lúc đi làm:

- **Cú bắt tay tốn một vòng khứ hồi trước khi bất kỳ dữ liệu nào chảy** — và vòng khứ hồi là đơn vị tiền tệ của network (bảng latency Phần 2: ~ms cùng region, ~150 ms+ xuyên đại dương). Đây là lý do *tái sử dụng* connection (keep-alive, connection pool) là cú thắng hiệu năng rẻ nhất trong code có network, và lý do N+1 query của Phần 4 đau đến thế: n+1 cuộc trò chuyện, không chỉ n+1 câu hỏi.
- **Port gọi tên người đối thoại**: IP tìm ra cái máy, port tìm ra process (thế giới file-descriptor của Phần 5 — một socket *chính là* một fd). `443` cho HTTPS, `5432` cho PostgreSQL; "connection refused" = máy tới được, không ai nghe ở port đó; còn *timeout* = nhiều khả năng một firewall đang lặng lẽ nuốt gói tin (security group của S04-P03, nhìn từ phía client).

## 3. TLS: phong bì bọc thép

HTTPS là HTTP nằm trong **TLS**. Hai việc xảy ra trong cú bắt tay TLS, trả lời hai câu hỏi khác nhau:

- **Mã hoá** — không ai trên đường đi đọc hay sửa được bytes. Toán khoá công khai thoả thuận session key; mã hoá đối xứng gánh phần việc nặng.
- **Xác thực** — bạn đang nói chuyện với `example.com` *thật*: server trình một **certificate**, được ký bởi một certificate authority mà máy bạn đã tin sẵn, chuỗi lên tận root tin cậy.

Thông thạo thực dụng nghĩa là đọc đúng các *lỗi* TLS, vì mỗi lỗi tự khai thủ phạm: *certificate hết hạn* (ai đó quên gia hạn — lý do cả ngành chuyển sang auto-renew), *hostname mismatch* (cert cấp cho `www`, bạn gọi domain trần), *unknown authority* (self-signed, hoặc một proxy công ty đang giải-mã-mã-lại traffic của bạn — đó là TLS đang chạy đúng thiết kế: từ chối kẻ đứng giữa không đáng tin). Điều tuyệt đối không làm: tắt verify (`verify=false`) để "sửa" — làm thế là giữ phần mã hoá nhưng vứt phần xác thực, đúng cái nửa chặn giả mạo.

## 4. HTTP: rốt cuộc cũng tới câu hỏi

Sau DNS, TCP và TLS, câu hỏi thật sự là văn bản trơn (về mặt khái niệm): một **method** và path, headers, body tuỳ chọn — được trả lời bằng **status code**, headers, và body. Hai kỹ năng đọc-viết:

**Status code như lời dẫn chuyện** — chữ số đầu nói *lỗi của ai*:

| Lớp | Nghĩa | Những mã dạy khôn |
|---|---|---|
| 2xx | thành công | `201` đã tạo, `204` xong-không-có-gì-để-kể |
| 3xx | đi chỗ khác | `301` dọn nhà vĩnh viễn (cache được!) vs `302` tạm thời |
| 4xx | lỗi của **bạn** | `401` anh là ai, `403` biết anh rồi và không, `404`, `429` chậm thôi |
| 5xx | lỗi của **họ** | `500` sập, `502`/`504` proxy không với tới hoặc chờ hết kiên nhẫn với backend |

Cú tách 4xx/5xx là câu triage đầu tiên của mọi sự cố API — và riêng `502/504` chỉ tay vào *khoảng giữa* các service: gateway ổn, thứ đằng sau nó thì không (các sự cố Phần 5 hay trú ở đó).

**Method như hợp đồng**: `GET` để đọc (retry an toàn, cache được), `PUT`/`DELETE` idempotent theo hợp đồng (lại từ khoá của S02-P03 — retry an toàn), `POST` thì *không* — vì thế form thanh toán sợ cú double-click, và logic retry phải thuộc mặt động từ.

## 5. Ống nghe: curl

Truyền miệng bảo "network chậm." Đo đạc bảo *màn nào* chậm:

```bash
curl -s -o /dev/null -w \
  "dns %{time_namelookup}s  tcp %{time_connect}s  tls %{time_appconnect}s \
   first-byte %{time_starttransfer}s  total %{time_total}s\n" \
  https://example.com/orders
```

Một dòng, và mỗi màn kịch nhận một con số:

- **DNS chậm** → chuyện resolver hoặc TTL.
- **TCP chậm** → khoảng cách hoặc mất gói.
- **TLS chậm** → phí bắt tay; hãy tái sử dụng connection.
- **Khoảng trống dài tới first byte** → *server đang suy nghĩ*. Vấn đề chẳng nằm ở network.

Thêm `-v` để xem trọn vở kịch có phụ đề. Đừng bao giờ thêm `-k` — xem mục 3. Tab Network trên browser cho cùng cái waterfall theo từng resource: cùng kỹ năng đọc, khác bộ trang phục.

## Thực hành (20 phút — đo cả bốn màn, rồi phá từng màn)

Mọi thứ ở đây chạy từ terminal với `curl` và `dig`. Mỗi lệnh chứng minh một tuyên bố ở trên:

```bash
# 1. Bốn màn kịch, mỗi màn một con số
curl -s -o /dev/null -w \
 "dns %{time_namelookup}s  tcp %{time_connect}s  tls %{time_appconnect}s  ttfb %{time_starttransfer}s  total %{time_total}s\n" \
 https://example.com/

# 2. DNS là cái cache có đồng hồ — nhìn TTL, rồi xem nó đếm ngược
dig +noall +answer example.com          # để ý con số TTL
sleep 5; dig +noall +answer example.com # cùng đáp án, TTL nhỏ hơn: chẳng có gì "lan truyền"

# 3. Tái dùng connection: trả phí bắt tay TLS một lần thay vì ba lần
curl -s -o /dev/null -w "một request tổng %{time_total}s\n" https://example.com/
curl -s -o /dev/null -o /dev/null -o /dev/null -w "ba request, tái dùng: %{time_total}s\n" \
     https://example.com/ https://example.com/ https://example.com/

# 4. Cố tình phá từng màn và ĐỌC lỗi, đừng đoán cảm tính
curl -sS https://no-such-host-xyz.example/ 2>&1 | head -2      # DNS: could not resolve host
curl -sS --max-time 5 https://example.com:81/ 2>&1 | head -2   # TCP: timeout, không ai trả lời
curl -sS https://expired.badssl.com/ 2>&1 | head -3            # TLS: lỗi certificate — đọc nó, ĐỪNG thêm -k

# 5. Status code là chỉ dẫn về việc ai phải sửa cái gì
for u in https://example.com/ https://example.com/nope; do
  echo -n "$u → "; curl -s -o /dev/null -w "%{http_code}\n" "$u"
done
```

Kết quả mong đợi: bước 1 gán độ trễ của bạn về một màn cụ thể thay vì về "network". Bước 2 cho thấy TTL đếm ngược giữa hai đáp án giống hệt — đó chính là cơ chế mà người ta gọi là lan truyền. Ở bước 3, lượt ba request tốn ít hơn hẳn ba lần một request, vì phí bắt tay TLS chỉ trả một lần; riêng sự thật đó là lý do connection pooling tồn tại. Bước 4 cho bạn ba dòng lỗi *khác nhau rõ rệt* — không resolve được, timeout, và lỗi certificate — và học đọc chúng là thứ biến "trang web sập rồi" thành một chẩn đoán. Lỗi certificate là cái đáng ngồi lại lâu nhất: `-k` làm nó biến mất mà không làm nó an toàn.

## Tự kiểm tra

1. `curl -w` cho thấy DNS 0.004s, TCP 0.03s, TLS 0.05s, first byte 2.8s. Vấn đề nằm ở đâu, và bạn đi đọc lại phần nào của series?
2. Bạn hạ TTL của một DNS record xuống 60 giây, một tiếng trước khi cutover. Vì sao, và chuyện gì đã xảy ra nếu TTL là 86400?
3. Đồng nghiệp sửa lỗi TLS certificate bằng cách thêm `-k` (hoặc `verify=False`) và request chạy được. Thực chất họ vừa tắt cái gì?

<details><summary>Xem đáp án</summary>

1. Không phải network — là server. DNS, TCP và TLS đều xong dưới một phần mười giây; 2,8 giây kia là time-to-first-byte, nghĩa là server đang suy nghĩ. Hãy đọc lại Phần 5 (và profile ứng dụng hoặc database của nó), đừng đọc chương networking.
2. Vì resolver cache đáp án đúng bằng độ dài TTL, và chẳng có gì "lan truyền" — cache chỉ hết hạn. Với TTL 60 giây, client nhận địa chỉ mới trong vòng một phút. Với 86400 (một ngày), một số client sẽ tiếp tục gửi traffic tới địa chỉ cũ tới 24 tiếng sau cutover.
3. Việc xác minh certificate — phép kiểm rằng server đúng là kẻ nó tự nhận. Kết nối vẫn được mã hoá, nhưng mã hoá với *bất kỳ ai đã trả lời*, và đó chính xác là thứ kẻ chặn đường cần. Cái lỗi đang làm đúng việc của nó; cách sửa là certificate hoặc trust store cho đúng, không bao giờ là `-k`.

</details>

## Điều cần nhớ

- Bốn màn mỗi request — DNS (tên có cache), TCP (vòng khứ hồi là tiền tệ), TLS (mã hoá *và* xác thực), HTTP (câu hỏi thật).
- Tái sử dụng connection; tôn trọng động từ idempotent-hay-không; đọc 4xx là "lỗi mình", 5xx là "lỗi họ", 502/504 là "ở giữa".
- Lỗi TLS tự khai thủ phạm — sửa nguyên nhân, không bao giờ `verify=false`.
- `curl -w` với các biến thời gian biến "network chậm" thành "màn 3 chậm" — đo đạc thắng truyền miệng, mọi lần.

*Tiếp theo — Phần 7: Database: 20% kiến thức gánh 80% công việc.*
