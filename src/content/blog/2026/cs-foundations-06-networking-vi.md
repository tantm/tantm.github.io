---
title: 'Chuyện gì xảy ra khi bạn gõ một URL'
description: 'DNS, TCP, TLS, HTTP — vở kịch bốn màn sau mỗi request, các status code kể chuyện, và những cờ curl biến networking từ truyền miệng thành đo đạc.'
date: 2026-07-31
category: Developer
tags: [cs-foundations, networking, http]
lang: vi
translationKey: cs-foundations-06
series: cs-foundations
part: 6
---

Mọi hệ thống bạn xây từ giờ đều là hệ phân tán — nghĩa là mọi con bug không tái hiện được ở local nhiều khả năng sống trong network. Phần này đi bộ qua câu hỏi phỏng vấn kinh điển một cách thật thà: bạn gõ `https://example.com/orders` và nhấn Enter. Bốn màn kịch nối nhau, mỗi màn có kiểu hỏng riêng — và đến cuối bài, `curl` trở thành ống nghe của bạn.

## Màn 1 — DNS: tên thành số

Máy tính định tuyến bằng IP; con người nhớ tên. **DNS** bắc cầu: máy bạn hỏi resolver "`example.com` ở đâu?" và nhận về một IP — sau khi resolver đi bộ qua hệ phân cấp (root → `.com` → name server của chính domain) ở lần hỏi nguội, hoặc trả lời tức thì từ **cache** ở lần hỏi ấm.

Caching là toàn bộ tính cách của DNS. Mỗi record mang một **TTL** — "tin đáp án này trong N giây" — và vì thế các thay đổi DNS "lan truyền" chậm: chẳng có gì lan truyền cả, các cache chỉ hết hạn theo nhịp riêng của chúng. Hệ quả kỹ thuật bạn sẽ gặp thật: TTL thấp là thứ khiến chuyển hướng traffic khả thi (các cú cutover của S07-P13 cưỡi trên nó); cache cũ là lý do "máy em chạy mà máy khách không chạy"; và `dig example.com` là bài test hai giây tách "vấn đề DNS" khỏi "mọi thứ còn lại" — ngã ba đầu tiên của mọi cuộc debug kết nối.

## Màn 2 — TCP: cuộc trò chuyện đáng tin trên một thế giới không đáng tin

Internet làm rơi, đảo thứ tự và nhân bản gói tin như cơm bữa. **TCP** dựng một dòng byte đáng tin bên trên: cú bắt tay ba bước trứ danh (SYN → SYN-ACK → ACK) mở cuộc trò chuyện, số thứ tự khôi phục trật tự, acknowledgement kích hoạt gửi lại thứ đã mất.

Hai sự thật đáng giá lúc đi làm:

- **Cú bắt tay tốn một vòng khứ hồi trước khi bất kỳ dữ liệu nào chảy** — và vòng khứ hồi là đơn vị tiền tệ của network (bảng latency Phần 2: ~ms cùng region, ~150 ms+ xuyên đại dương). Đây là lý do *tái sử dụng* connection (keep-alive, connection pool) là cú thắng hiệu năng rẻ nhất trong code có network, và lý do N+1 query của Phần 4 đau đến thế: n+1 cuộc trò chuyện, không chỉ n+1 câu hỏi.
- **Port gọi tên người đối thoại**: IP tìm ra cái máy, port tìm ra process (thế giới file-descriptor của Phần 5 — một socket *chính là* một fd). `443` cho HTTPS, `5432` cho PostgreSQL; "connection refused" = máy tới được, không ai nghe ở port đó; còn *timeout* = nhiều khả năng một firewall đang lặng lẽ nuốt gói tin (security group của S04-P03, nhìn từ phía client).

## Màn 3 — TLS: phong bì bọc thép

HTTPS là HTTP nằm trong **TLS**. Hai việc xảy ra trong cú bắt tay TLS, trả lời hai câu hỏi khác nhau:

- **Mã hoá** — không ai trên đường đi đọc hay sửa được bytes. Toán khoá công khai thoả thuận session key; mã hoá đối xứng gánh phần việc nặng.
- **Xác thực** — bạn đang nói chuyện với `example.com` *thật*: server trình một **certificate**, được ký bởi một certificate authority mà máy bạn đã tin sẵn, chuỗi lên tận root tin cậy.

Thông thạo thực dụng nghĩa là đọc đúng các *lỗi* TLS, vì mỗi lỗi tự khai thủ phạm: *certificate hết hạn* (ai đó quên gia hạn — lý do cả ngành chuyển sang auto-renew), *hostname mismatch* (cert cấp cho `www`, bạn gọi domain trần), *unknown authority* (self-signed, hoặc một proxy công ty đang giải-mã-mã-lại traffic của bạn — đó là TLS đang chạy đúng thiết kế: từ chối kẻ đứng giữa không đáng tin). Điều tuyệt đối không làm: tắt verify (`verify=false`) để "sửa" — làm thế là giữ phần mã hoá nhưng vứt phần xác thực, đúng cái nửa chặn giả mạo.

## Màn 4 — HTTP: rốt cuộc cũng tới câu hỏi

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

## Ống nghe: curl

Truyền miệng bảo "network chậm." Đo đạc bảo *màn nào* chậm:

```bash
curl -s -o /dev/null -w \
  "dns %{time_namelookup}s  tcp %{time_connect}s  tls %{time_appconnect}s \
   first-byte %{time_starttransfer}s  total %{time_total}s\n" \
  https://example.com/orders
```

Một dòng, và bốn màn kịch mỗi màn một con số: DNS chậm → chuyện resolver/TTL; TCP chậm → khoảng cách hoặc mất gói; TLS chậm → phí bắt tay (tái sử dụng connection!); khoảng trống dài tới first byte → *server đang suy nghĩ* — vấn đề chẳng nằm ở network, mời đọc lại Phần 5. Thêm `-v` để xem trọn vở kịch có phụ đề, `-k` thì không bao giờ (xem Màn 3). Tab Network của DevTools trên browser cho cùng cái waterfall theo từng resource — cùng kỹ năng đọc, khác bộ trang phục.

## Điều cần nhớ

- Bốn màn mỗi request — DNS (tên có cache), TCP (vòng khứ hồi là tiền tệ), TLS (mã hoá *và* xác thực), HTTP (câu hỏi thật).
- Tái sử dụng connection; tôn trọng động từ idempotent-hay-không; đọc 4xx là "lỗi mình", 5xx là "lỗi họ", 502/504 là "ở giữa".
- Lỗi TLS tự khai thủ phạm — sửa nguyên nhân, không bao giờ `verify=false`.
- `curl -w` với các biến thời gian biến "network chậm" thành "màn 3 chậm" — đo đạc thắng truyền miệng, mọi lần.

*Tiếp theo — Phần 7: Database: 20% kiến thức gánh 80% công việc.*
