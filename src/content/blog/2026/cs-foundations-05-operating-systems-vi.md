---
title: 'Kiến thức OS đứng sau mọi sự cố production'
description: 'OOMKilled, "too many open files", load average 40, zombie process — năm ý tưởng OS, mỗi ý được dạy bởi chính sự cố mà nó giải thích, kèm playbook triage hai phút.'
date: 2026-07-30
category: Developer
tags: [cs-foundations, os, linux]
lang: vi
translationKey: cs-foundations-05
series: cs-foundations
cover: images/s01-p05-hero.png
part: 5
---

Operating systems là môn ai cũng ngủ gật trong lớp, rồi gặp lại nó lúc 2 giờ sáng trong một sự cố production. Nên phần này dạy ngược: **năm thông điệp sự cố có thật trước, khái niệm OS giải thích từng cái sau.** Đọc xong, `top` thôi là một bức tường số và trở thành một câu chuyện bạn đọc được.

## Bạn sẽ học được gì

- Đọc `top` như một chẩn đoán: máy đang tính, đang chờ, hay đang bị móc túi CPU.
- Giải thích được exit code 137 và tìm ra hồ sơ giấy tờ của OOM killer bằng một lệnh.
- Nhận ra leak file descriptor và biết vì sao nâng trần là cách sửa sai.
- Chạy playbook triage hai phút phủ năm triệu chứng production phổ biến nhất.

**Cần biết trước:** Phần 2 (process, memory, câu hỏi CPU-bound vs I/O-bound). Không cần biết Linux chuyên sâu.

## 1. `OOMKilled` — memory là lời hứa, không phải sự thật

Phần 2 giới thiệu heap; đây là nửa hợp đồng phía OS. Linux **overcommit** (hứa nhiều memory hơn nó có, đánh cược không ai dùng hết cùng lúc). Khi process xin memory, kernel gật đầu một cách lạc quan — các page chỉ thành thật khi bị *chạm vào*. Nên "xin 8 GB ngon lành" và "chết khi chạm tới GB thứ 6" có thể cùng đúng.

Khi memory vật lý thật sự cạn, **OOM killer** thức dậy, chấm điểm mọi process (đại khái: đứa ăn nhiều nhất thắng), và giết một đứa — thường là của bạn, thường là giữa request, exit code 137. Các sự thật triage đáng giá:

- **RSS** (resident, RAM thật) mới là con số phải nhìn, không phải virtual size — `ps aux` hiện cả hai, và khoảng cách giữa chúng chính là lời hứa overcommit.
- RSS leo dốc chậm qua nhiều ngày là leak; hình răng cưa là garbage collection bình thường; cú nhảy bậc thang là cái DataFrame khổng lồ ai đó nạp nguyên khối.
- `dmesg | grep -i oom` nói chính xác ai bị giết và vì sao — giấy chứng tử của sự cố, và câu lệnh đầu tiên đáng học thuộc.

## 2. Load average 40 trên 8 core — hàng đợi chạy

Dòng đầu của `top`: `load average: 40.1, 35.2, 20.0`. Load average là **số process trung bình đang muốn CPU** (đang chạy + chờ chạy + — trên Linux — kẹt trong disk I/O không ngắt được). Hai cách đọc cùng một con số:

- Load 40, CPU 100% → bốn mươi task giành nhau tám core; mỗi đứa được khoảng một phần năm core. Bão hoà **CPU-bound** kinh điển. Máy đang tính.
- Load 40, CPU gần như *rảnh* → bốn mươi task kẹt chờ disk hoặc network filesystem. Dồn toa **I/O-bound** kinh điển. Máy đang chờ — và thêm CPU sẽ không sửa được gì.

Riêng phân biệt đó — cùng triệu chứng, thuốc ngược nhau — đã là phần lớn giá trị của việc hiểu scheduler. Cứ coi scheduler như một hàng đợi công bằng, preempt task mỗi vài mili-giây; cơ chế sâu hơn hiếm khi đổi việc bạn làm tiếp theo.

Một khoản riêng của cloud: trên instance chia sẻ, `%st` (steal) là hypervisor đem thời gian CPU của bạn cho người khác. Con instance burstable cạn credit hiện hình đúng ở đây.

## 3. `Too many open files` — mọi thứ là file descriptor

Socket, file log, pipe, connection database — với kernel tất cả là **file descriptor**, và mỗi process có một trần (`ulimit -n`, thường vài nghìn). Sự cố kinh điển: service dưới tải bắt đầu từ chối connection *mới* trong khi connection cũ vẫn chạy, log ngập `EMFILE`.

Chín mươi phần trăm nguyên nhân là **leak descriptor**: connection mở mà không đóng trên đường lỗi, response body bị bỏ rơi giữa chừng. Cách sửa là cấu trúc, không phải nâng trần — các cấu trúc `with` / `defer` / try-with-resources của ngôn ngữ tồn tại chính xác cho việc này. Nâng `ulimit` là chính đáng cho server bận thật (trần mặc định vốn dè dặt), nhưng nâng để *chạy đua với leak* chỉ là dời lịch sự cố. Chẩn đoán: `ls /proc/<pid>/fd | wc -l` — nhìn nó leo.

## 4. Cú deploy bị treo — signal và graceful shutdown

Orchestrator "dừng" một process theo hai màn: **SIGTERM** ("làm nốt rồi nghỉ nhé") … thời gian ân hạn … **SIGKILL** ("không hỏi nữa"). SIGKILL không thể bắt được — process không có cơ hội flush buffer, commit offset, hay đóng transaction.

Điều này giải thích cả một họ sự cố: file ghi dở sau deploy, consumer xử lý lại hàng nghìn message vì offset chết cùng process, request rơi giữa đường bay.

Cách sửa là một *thói quen*: bắt SIGTERM — ngừng nhận việc mới, làm nốt việc dở, thoát — và bảo đảm nó gọn trong thời gian ân hạn.

Hai bẫy con đáng biết. Trong container, app chạy sau một cái shell làm PID 1 thì signal có thể không bao giờ tới nơi (dùng `exec` trong entrypoint). Còn một *zombie* trong `top` (state `Z`) đã chết rồi, chỉ đang chờ process cha đến nhận exit code — bug của cha, không phải thứ giết thêm lần nữa được.

## 5. Container bị bóp — container *chính là* một process

Mental model mở khoá ops hiện đại: container **không phải một máy ảo nhỏ**. Nó là một process Linux bình thường khoác hai tính năng kernel: **namespace** (góc nhìn riêng về filesystem, network, PID) và **cgroup** (trần cứng về CPU và memory). Ba sự cố được giải thích tức thì:

- Container `OOMKilled` ở 512 MB trong khi host còn 60 GB trống — bức tường là trần *cgroup*, không phải cái máy. Mục 1, bản thu nhỏ.
- Service chậm bí ẩn trong khi CPU host rảnh — **CPU throttling**: quota cgroup cạn cho chu kỳ này; container đứng chờ, vô hình với `top` mức host.
- JVM/runtime size theo memory của host bên trong một container nhỏ — runtime đọc cái máy chứ không đọc cgroup (runtime hiện đại đã hiểu container; cấu hình sai thì diễn lại vở kinh điển này).

Mọi thứ từ mục 1–4 áp dụng *bên trong* container, với trần cgroup là những bức tường mới, gần hơn.

## 6. Playbook triage hai phút

Năm sự cố nén thành một trình tự cố định:

1. `top` → load vs CPU%: đang tính, đang chờ, hay đang bị móc túi (`%st`)?
2. Memory: xu hướng RSS của kẻ tình nghi (`ps aux --sort=-rss | head`), rồi `dmesg | grep -i oom` xem các vụ giết.
3. Descriptor: `ls /proc/<pid>/fd | wc -l` so với `ulimit -n`.
4. Cột state: `D` (kẹt I/O) hay `Z` (zombie — nhìn sang process cha).
5. Trong container: kiểm trần cgroup *trước tiên* — các bức tường gần hơn cái máy.

## Thực hành (20 phút — tự gây ra ba sự cố trong số này)

Chạy trên bất kỳ máy Linux hay container nào bạn dám ép tải. Mỗi khối tái hiện một sự cố ở trên, để triệu chứng trở thành thứ bạn đã *nhìn thấy*, không phải chỉ đọc.

```bash
# 1. Xem memory được hứa, rồi thành thật (khoảng cách overcommit)
python3 -c "
import time
big = bytearray(300 * 1024 * 1024)      # đã xin
print('đã xin; xem RSS ngay'); time.sleep(5)
for i in range(0, len(big), 4096): big[i] = 1   # đã chạm -> giờ mới là RAM thật
print('đã chạm; xem lại RSS'); time.sleep(15)" &
sleep 3;  ps -o pid,rss,vsz,cmd -p $!    # VSZ to, RSS nhỏ
sleep 12; ps -o pid,rss,vsz,cmd -p $!    # RSS đuổi kịp: lời hứa đến hạn

# 2. CPU-bound vs I/O-bound: cùng load average, nghĩa ngược nhau
nproc                                     # máy bạn mấy core
for i in $(seq 1 8); do (while :; do :; done) & done   # 8 kẻ đốt CPU
uptime; top -bn1 | head -3                # load leo, %Cpu(s) us gần 100
kill %1 %2 %3 %4 %5 %6 %7 %8 2>/dev/null

# 3. File descriptor đếm được — nhìn nó leo
python3 -c "
import socket, time, os
socks = []
for i in range(200):
    s = socket.socket(); socks.append(s)      # mở mà không đóng: hình dạng của leak
print('pid', os.getpid()); time.sleep(20)" &
sleep 2; ls /proc/$!/fd | wc -l; ulimit -n   # số đếm so với trần
wait 2>/dev/null

# 4. Giấy chứng tử (trên máy từng có vụ OOM kill)
dmesg 2>/dev/null | grep -i -m3 "killed process" || echo "máy này chưa ghi nhận OOM kill"
```

Kết quả mong đợi: ở khối 1, virtual size (VSZ) nhảy lên ngay trong khi RSS vẫn nhỏ — khoảng cách đó *chính là* lời hứa overcommit — và RSS chỉ đuổi kịp khi mọi page đã bị chạm. Khối 2 đẩy load average vượt xa số core trong khi `%Cpu(s)` nằm gần 100% ở phần user: bão hoà, nơi thêm CPU thật sự giúp được. (Dồn toa I/O-bound trông y hệt trên dòng load nhưng để CPU rảnh — đó chính là phân biệt mà playbook xoay quanh.) Khối 3 cho thấy descriptor leo dần về phía một cái trần bạn in ra được; một service bị leak làm đúng như vậy, chỉ chậm hơn.

## Tự kiểm tra

1. Một container chết với exit code 137 trong khi host còn 40 GB memory trống. Chuyện gì đã xảy ra, và bạn kiểm trần nào trước?
2. Load average là 30 trên máy 4 core, nhưng `top` cho thấy CPU gần như rảnh. Chẩn đoán của bạn là gì, và vì sao instance to hơn không giúp được?
3. Sau mỗi lần deploy, consumer của bạn xử lý lại hàng nghìn message đã xử lý rồi. Cơ chế OS nào giải thích, và sửa thế nào?

<details><summary>Xem đáp án</summary>

1. OOM killer đã giết nó theo trần memory của *cgroup*, không phải của host. Container là một process với các bức tường cgroup, và những bức tường đó gần hơn cái máy rất nhiều. Kiểm trần memory của container và xu hướng RSS của process trước; `dmesg` xác nhận vụ giết.
2. Dồn toa I/O-bound: 30 task đó đang chờ disk hoặc network chứ không giành CPU (trên Linux, thời gian chờ I/O không ngắt được vẫn tính vào load average). Thêm CPU là thêm công suất không ai xin — hãy nhìn độ trễ disk, storage backend, hoặc service từ xa.
3. Process bị SIGKILL trước khi kịp commit offset — hoặc nó không bắt SIGTERM, hoặc graceful shutdown lâu hơn thời gian ân hạn, hoặc signal không tới nơi vì một cái shell đang làm PID 1. Sửa: bắt SIGTERM (ngừng nhận việc mới, làm nốt việc dở, thoát), giữ gọn trong ân hạn, và `exec` process trong entrypoint.

</details>

## Điều cần nhớ

- Memory là lời hứa: nhìn RSS, và đọc `dmesg` để lấy giấy chứng tử của OOM killer — exit 137 có hồ sơ giấy tờ.
- Load average đếm số kẻ *muốn* CPU: CPU bận là bão hoà, CPU rảnh là dồn toa I/O — thuốc ngược nhau.
- Socket và connection là file descriptor có trần; leak hoá trang thành vấn đề công suất.
- SIGTERM là lời đề nghị, SIGKILL là sự đã rồi — graceful shutdown là thói quen, và trong container, trần cgroup mới là bức tường thật.

*Tiếp theo — Phần 6: Chuyện gì xảy ra khi bạn gõ một URL.*
