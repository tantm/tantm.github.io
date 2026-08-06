---
title: 'Transformer & attention, giải ảo'
description: 'Attention như một cú tra thư viện, vì sao một kiến trúc nuốt trọn cả ngành, và pretraining thực sự mua được gì — tầng trực giác dưới mọi LLM bạn sẽ ship.'
date: 2026-08-01
category: AI
tags: [ai-roadmap, nlp, transformers, llm]
lang: vi
translationKey: ai-roadmap-06
series: ai-roadmap
part: 6
---

Mọi model bạn chạm vào từ đây tới cuối roadmap — mọi model chat, model embedding, trợ lý code — đều là transformer. Bạn sẽ không bao giờ tự cài một cái ở chỗ làm; bạn sẽ *suy luận về* chúng hằng ngày: vì sao context window tốn tiền, vì sao model xử lý tài liệu dài một cách kỳ lạ, fine-tuning thật sự thay đổi cái gì. Lối suy luận đó cần một ý tưởng được hiểu cho tử tế: **attention**.

## Bạn sẽ học được gì

- Giải thích attention như một cú tra cứu: query, key, value mỗi thứ làm gì.
- Nói được vì sao xếp chồng nhiều head và nhiều layer tạo ra sự hiểu, chứ không phải một cú trộn to.
- Tự suy ra các hệ quả thực tế: chi phí context bậc hai, KV cache, attention không đều trên context dài.
- Đọc dòng kiến trúc trên model card và biết nó hàm ý gì cho hoá đơn của bạn.

**Cần biết trước:** Phần 2 (vector, matrix) và bảng growth của Phần 4 cho lập luận chi-phí-bậc-hai.

## 1. Bài toán: nghĩa phụ thuộc vào những từ ở xa

Xét câu: *"Chiếc cúp không vừa cái vali vì **nó** quá to."* "Nó" là gì? Não bạn lập tức nối "nó" với "chiếc cúp" — hai từ nằm cách xa nhau. Các model tiền-transformer xử lý văn bản như những cỗ máy tuần tự của Phần 5: từng từ một, ép lịch sử vào một bộ nhớ cỡ cố định cứ xa dần là nhoè dần. Các kết nối tầm xa — đúng thứ ngôn ngữ vận hành trên đó — thoái hoá thành nhiễu.

Câu trả lời của attention gần như xấc xược: **thôi nén lịch sử; cho mỗi từ nhìn thẳng vào mọi từ khác và tự quyết cái gì quan trọng.**

## Attention: phép ví von tra thư viện

Với mỗi từ (token), model tính ba vector — các máy-matrix của Phần 2 sản xuất chúng:

- **Query** — "tôi đang tìm gì?" (từ "nó" hỏi: *chủ thể đang được bàn là ai?*)
- **Key** — "tôi có thể được tìm thấy bằng gì?" (nhãn thẻ mục lục của mỗi từ)
- **Value** — "nếu được chọn, tôi đóng góp gì?" (nội dung thật của từ)

Cơ chế: so Query của một token với Key của mọi token (một phép dot product — anh em họ của cosine similarity Phần 2), softmax các điểm số thành bộ trọng số có tổng bằng 1 (một distribution xác suất — lại Phần 2), rồi lấy **trung bình có trọng số của các Value**. Với "nó", trọng số rơi vào "chiếc cúp" cao vót, vào "cái vali" thấp tịt — và vector đại diện cho "nó" giờ *chứa phần lớn chất-cúp*. Nghĩa của mỗi token trở thành một hỗn hợp có trọng số theo ngữ cảnh của cả câu, tính song song.

Attention là thế. Mọi thứ còn lại là engineering vây quanh vòng lặp này.

## Multi-head, xếp tầng: nhiều quan hệ, tinh luyện nhiều lần

Một lượt attention bắt được một *loại* quan hệ. Ngôn ngữ thật có nhiều loại — ngữ pháp, tham chiếu, giọng điệu, chủ đề. Nên transformer chạy nhiều **head** song song (mỗi head có bộ máy Q/K/V học riêng, tự do chuyên môn hoá) và xếp hàng chục **layer**, mỗi layer tinh luyện các hỗn hợp của layer trước:

```mermaid
flowchart LR
    T["Token + vị trí"] --> B1["Block 1<br/><i>multi-head attention + FFN</i>"]
    B1 --> B2["Block 2"] --> D["…hàng chục nữa…"] --> BN["Block N"]
    BN --> P["Đoán token kế tiếp<br/><i>(một distribution — Phần 2)</i>"]
```

Hai chú thích trả lời các câu hỏi thật về sau: token mang **thông tin vị trí** (bản thân attention mù thứ tự — "chó cắn người" cần vị trí để khác "người cắn chó"), và các LLM chat là **decoder-only**: mỗi token chỉ được attend các token *đứng trước* nó, vì trò chơi huấn luyện là "đoán token kế tiếp" và nhìn trộm là ăn gian. Model kiểu encoder (embedding, retrieval của Phần 9) attend cả hai chiều — cùng linh kiện, khác cách đi dây.

## Vì sao kiến trúc này nuốt trọn cả ngành

Không phải vì attention "thông minh hơn" — mà vì nó **song song**. Model tuần tự phải xử lý token 2 sau token 1; transformer tính attention của mọi token cùng lúc — đúng cái hình dạng nhân-matrix-khổng-lồ mà GPU nghiến ngấu (Phần 5). Đột nhiên việc training scale theo phần cứng, và một quy luật thực nghiệm lộ ra: **thêm tham số + thêm dữ liệu + thêm compute = model tốt lên một cách dự đoán được** (scaling laws). Transformer thắng vì nó là kiến trúc đầu tiên cho phép bạn *mua* năng lực bằng compute — và thập kỷ AI vừa qua là tờ đơn đặt hàng đó, lặp đi lặp lại.

## 5. Pretraining: gã khổng lồ đến từ đâu

Phần 5 nói "thích nghi gã khổng lồ pretrained, đừng bao giờ bắt đầu từ số không." Đây là thứ gã khổng lồ đã học và học thế nào: **đoán token kế tiếp trên một lát cắt khổng lồ của văn bản**. Không nhãn, không người gán — chính văn bản là sự giám sát (cú mánh "tự-giám-sát" đã mở khoá quy mô). Để đoán token kế tiếp *cho giỏi*, model bị ép nội tâm hoá ngữ pháp, sự kiện, văn phong, các hoa văn suy luận — không phải như mục tiêu, mà như *tác dụng phụ* của trò chơi dự đoán.

Kết quả là một **base model**: một cỗ autocomplete tráng lệ, không phải một trợ lý (hỏi nó một câu và nó có thể tiếp tục bằng *thêm các câu hỏi khác* — tài liệu trên đời vốn thế). Hành vi trợ lý đến từ pha thứ hai nhỏ hơn nhiều — instruction tuning và huấn luyện theo sở thích — lại đúng nước đi thích-nghi-gã-khổng-lồ, thứ mà Phần 8 và 11 sẽ biến thành hộp đồ nghề *của bạn*.

## 6. Món này mua được gì trong thực tế

Những suy luận giờ bạn tự làm được từ nguyên lý:

- **Context window tốn theo bậc hai.** Mỗi token attend mọi token, nên context gấp 10 là khối lượng attention gấp khoảng 100. Đây là *lý do* long context được định giá như hiện tại, và "cứ dán hết vào" luôn kèm một tờ hoá đơn.
- **Serving có cache.** Sinh từng token mà tính lại attention trên cả prefix mỗi lần thì chết. **KV cache** lưu key và value của mọi token cũ để token mới chỉ tính cú tra của riêng nó — đây chính là lý do token đầu chậm còn phần sau stream nhanh.
- **"Nó đã đọc cả tài liệu của tôi" có chữ nhỏ.** Trọng số attention là một *ngân sách* chú ý hữu hạn, và model attend không đều trên context dài một cách rất thật. Retrieval tồn tại một phần vì *chọn lọc* văn bản liên quan thắng *hy vọng* attention tự tìm ra.

## Thực hành (20 phút — tự tay tính attention, rồi xem nó tốn theo bậc hai)

Numpy thuần, khoảng ba mươi dòng. Bạn sẽ thấy cú tra cứu hoạt động trên các vector đồ chơi, rồi đo đường cong chi phí đang định giá mọi lệnh gọi API long-context:

```python
import numpy as np
np.random.seed(0)

# Bốn "token", mỗi cái là một vector 6 chiều (embedding của Phần 2, bản thu nhỏ)
tokens = ["the", "bank", "of", "river"]
X = np.random.randn(4, 6)
X[1] = X[3] * 0.8 + np.random.randn(6) * 0.2      # làm "bank" và "river" liên quan thật

# Một attention head: ba matrix học được biến mỗi token thành Q, K, V
Wq, Wk, Wv = (np.random.randn(6, 6) for _ in range(3))
Q, K, V = X @ Wq, X @ Wk, X @ Wv

scores  = Q @ K.T / np.sqrt(6)                     # mỗi token chấm điểm mọi token
weights = np.exp(scores) / np.exp(scores).sum(1, keepdims=True)   # softmax: công thức trộn
out     = weights @ V                              # mỗi token thành hỗn hợp có trọng số

print("trọng số attention (dòng = token đang nhìn):")
for t, row in zip(tokens, weights):
    print(f"  {t:>6} → " + "  ".join(f"{w:.2f}" for w in row))
print("shape vào:", X.shape, " shape ra:", out.shape)   # cùng shape — nên layer xếp chồng được

# Giờ tới đường cong chi phí: khối lượng attention tăng theo BÌNH PHƯƠNG độ dài context
import time
for n in (256, 512, 1024, 2048):
    q = k = np.random.randn(n, 64)
    t0 = time.perf_counter(); s = q @ k.T; np.exp(s - s.max(1, keepdims=True))
    print(f"context {n:>5} token → {time.perf_counter()-t0:7.4f}s   ({n*n:,} cặp điểm số)")
```

Kết quả mong đợi: mỗi dòng của ma trận trọng số cộng lại bằng 1 — đó là công thức trộn cho một token — và dòng của "bank" đặt trọng số lên "river" cao hơn hẳn các cặp ngẫu nhiên, vì bạn đã cài quan hệ đó vào vector. Đầu ra cùng shape với đầu vào, và đó chính là lý do các khối này xếp chồng được hàng chục tầng. Rồi tới vòng đo thời gian: nhân đôi context thì khối lượng tăng khoảng bốn lần, và số cặp điểm số in bên cạnh giải thích vì sao. Đường cong đó là toàn bộ kinh tế học của long context — bạn vừa đo đúng thứ mình bị tính tiền.

## Tự kiểm tra

1. Trong phép ẩn dụ tra cứu, query, key và value mỗi thứ đại diện cho cái gì — và vì sao chúng là ba thứ tách biệt chứ không phải một?
2. Hoá đơn API của bạn tăng gấp đôi khi chuyển từ context 4k lên 8k, mà số token cũng chỉ gấp đôi. Vì sao chi phí attention không đơn thuần gấp đôi, và phần chênh lệch trốn ở đâu?
3. Đồng nghiệp nói "không cần retrieval, model có context 200k — cứ dán trọn cuốn sổ tay vào". Hãy đưa hai phản biện kỹ thuật.

<details><summary>Xem đáp án</summary>

1. Query là thứ token này đang tìm; key là thứ mỗi token khác quảng cáo về chính nó; value là nội dung thật sự được lấy về khi khớp mạnh. Chúng tách biệt vì "tôi đang tìm gì" và "tôi có gì để chào" là hai câu hỏi khác nhau — một matrix không diễn đạt nổi cả hai, và value còn mang được thông tin mà phần khớp không hề dùng tới.
2. Khối lượng attention tăng theo bình phương độ dài chuỗi, nên nhân đôi context là khoảng 4 lần khối lượng tính attention. Nhà cung cấp tính tiền theo token, nên phần chênh được hấp thụ vào bậc giá và độ trễ chứ không hiện thành một dòng gấp 4 — bạn cảm nhận nó qua phản hồi chậm hơn, và qua việc context rất dài đắt hơn không tương xứng trên mỗi request.
3. Thứ nhất, chi phí và độ trễ tăng theo bậc hai ở attention, nên một prompt 200k token là đắt và chậm ở *mọi* lệnh gọi, mãi mãi. Thứ hai, attention là ngân sách hữu hạn trải không đều — model attend kém tin cậy hơn với phần nằm giữa context rất dài, nên dán hết vào lại làm giảm khả năng đúng đoạn văn liên quan dẫn dắt câu trả lời. Retrieval chọn lọc thay vì hy vọng.

</details>

## Điều cần nhớ

- Attention = mỗi token query mọi token khác (Q/K/V) và trở thành hỗn hợp có trọng số của thứ quan trọng — nghĩa tầm xa mà không cần bộ nhớ nén.
- Multi-head + xếp tầng bắt nhiều loại quan hệ, tinh luyện nhiều lần; model decoder-only chỉ attend về trước, vì trò chơi là đoán token kế tiếp.
- Transformer thắng nhờ song song: năng lực trở thành thứ mua được bằng compute (scaling laws), và tác dụng phụ của pretraining — sự hiểu — chính là gã khổng lồ bạn thích nghi.
- Chi phí attention bậc hai và KV cache giải thích giá context, hành vi streaming, và vì sao retrieval thắng hy vọng.

*Tiếp theo — Phần 7: LLM hoạt động thế nào: token, context, sampling.*
