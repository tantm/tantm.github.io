---
title: 'LLM hoạt động thế nào: token, context, sampling'
description: 'Token không phải từ, context là bộ nhớ làm việc có thu tiền thuê, và temperature là núm vặn trên một distribution — các sự thật cơ học đằng sau mọi hành vi LLM khiến engineer bất ngờ.'
date: 2026-08-02
category: AI
tags: [ai-roadmap, llm]
lang: vi
translationKey: ai-roadmap-07
series: ai-roadmap
cover: images/s03-p07-hero.png
part: 7
---

Phần 6 trao cho bạn động cơ (attention, pretraining). Phần này là sổ tay người vận hành: một nắm sự thật cơ học — token, context, vòng lặp sinh chữ, sampling — giải thích gần hết mọi câu "sao nó lại làm thế?" bạn sẽ đụng khi build. Không có gì kỳ bí; và tất cả đều tính tiền được.

## Bạn sẽ học được gì

- Đếm token theo cách model đếm, và giải thích vì sao văn bản không phải tiếng Anh tốn hơn.
- Suy luận về context như một trần cứng có thu tiền thuê, không phải như bộ nhớ.
- Giải thích sinh chữ và sampling đủ để chọn temperature một cách có chủ đích.
- Mô tả hallucination bằng cơ học — và nói được thứ gì thật sự giảm được nó.

**Cần biết trước:** Phần 6 (attention và chi phí context bậc hai). Phần 2 cho phần phân phối xác suất.

## 1. Token: bảng chữ cái của model không phải của bạn

Model không đọc từ hay ký tự — nó đọc **token**: các mảnh phổ biến theo thống kê học từ dữ liệu (họ tokenizer BPE). `"understanding"` có thể là một token; `"antidisestablishmentarianism"` là năm; `" the"` (kèm dấu cách đầu!) là một trong những token phổ biến nhất. Xấp xỉ: **1 token ≈ ¾ từ tiếng Anh**.

Các hệ quả cơ học bạn gặp ngay tuần đầu:

- **Bạn bị tính tiền theo token**, input và output riêng — trực giác chi phí bắt đầu từ `len(tokens)` chứ không phải `len(words)`, và mọi provider đều phát kèm tokenizer chạy local để đếm trước khi tiêu.
- **Ngôn ngữ ngoài tiếng Anh chịu thuế**: tokenizer train chủ yếu trên tiếng Anh sẽ băm tiếng Việt, tiếng Thái, hay text trộn code thành nhiều token nhỏ hơn — cùng một câu, nhiều token hơn, đắt hơn, context hiệu dụng ít hơn. (Viết các bài VI của blog này tốn nhiều token hơn bản EN. Đã kiểm chứng.)
- **Việc mức-ký-tự khó một cách chính đáng**: "strawberry có mấy chữ r" fail không phải vì ngu mà vì model nhìn thấy `[straw][berry]`, không thấy chữ cái. Cùng lý do cho sự yếu ở đảo chuỗi chính xác hay số học trên dãy số dài — các chữ số bị băm không đều.

## 2. Context: bộ nhớ làm việc có thu tiền thuê

**Context window** là mọi thứ model "thấy" cho cú gọi này: system prompt + hội thoại + tài liệu retrieve + chính output nó đang sinh. Ba sự thật định hình cách bạn engineer quanh nó:

1. **Nó là trần cứng** — vượt là phải cắt hoặc từ chối; hội thoại dài âm thầm cắt các lượt cũ nhất, và vì thế model "quên" chỉ dẫn từ một tiếng trước. Hoàn toàn không có bộ nhớ *giữa* các cú gọi: model là stateless, và "lịch sử chat" đúng nghĩa đen là app của bạn gửi lại transcript mỗi lần.
2. **Giá tuyến tính, compute bậc hai** (Phần 6) — long context là một quyết định chi phí thật, không phải tiện nghi miễn phí.
3. **Attention là một ngân sách** (chữ nhỏ Phần 6) — chôn sự thật then chốt ở trang 40 của đống context dán vào là thiệt hại đo được; đặt chỉ dẫn ở đầu/cuối thì đỡ. Đây là lập luận cơ học cho retrieval (Phần 9): *chọn* 2% liên quan, đừng chuyển cả đống rơm.

## 3. Sinh chữ: mỗi lần một token, mãi mãi

Vòng lặp sản xuất mọi câu trả lời:

```text
1. Đưa toàn bộ context qua mạng (Phần 6)
2. Nhận một distribution xác suất trên toàn bộ vocabulary (Phần 2!)
3. Chọn MỘT token từ đó   ← "quyết định" duy nhất tồn tại
4. Nối vào context; quay lại 1 (KV cache làm bước này rẻ)
```

Mọi thứ model "làm" là vòng lặp này. Hệ quả: output tính tiền theo token *và* chậm theo token (streaming tồn tại vì người dùng đang xem vòng lặp chạy — token đầu chậm, phần sau nhanh, theo KV cache Phần 6); model không thể "lên kế hoạch trước" ngoài mức mà việc đoán-token-giỏi ngầm chứa; và `max_tokens` là máy chém, không phải mục tiêu — chạm nó là JSON của bạn đứt giữa dấu ngoặc (luôn kiểm finish reason; structured output bị cắt cụt là con bug im lặng kinh điển).

## 4. Sampling: temperature là núm vặn trên distribution

Bước 3 ở trên có lựa chọn. **Greedy** (temperature 0): luôn lấy token xác suất cao nhất — gần như deterministic, tốt nhất cho extraction, phân loại, structured output. **Sampling** (temperature > 0): rút từ distribution — ý temperature của Phần 2 thành hiện thực: T thấp làm nhọn distribution về phía các lựa chọn đầu; T cao làm phẳng nó, cho các token khó xảy ra lọt qua (sáng tạo và nhảm nhí đi vào qua cùng một cánh cửa). **Top-p** giới hạn sampling vào tập token nhỏ nhất phủ p khối xác suất — một sàn chất lượng dưới các temperature cao.

Mặc định thực chiến: **0 cho bất cứ thứ gì máy tiêu thụ** (JSON, tool call, evals cần tái lập), **~0.7 cho văn xuôi người đọc**, và chỉnh một núm, đừng cả hai. Và một huyền thoại đáng khai tử: temperature 0 *không* làm model trung thực — nó làm model *nhất quán*. Một distribution sai một cách tự tin, lấy greedy, chỉ là sai một cách nhất quán.

## 5. Hallucination, nhìn bằng cơ học

Phần 2 hứa lời giải thích thật thà; giờ bạn đã đủ linh kiện. Phép toán duy nhất của model là "phát ra token kế tiếp hợp lý theo context." Khi context (cộng kiến thức pretrain) không chứa đáp án, *phần tiếp nối hợp lý nhất* của một câu văn giọng-uy-tín là… một phần hoàn thành giọng-uy-tín. Một trích dẫn bịa không phải trục trặc — nó là distribution vận hành đúng thiết kế trên nền grounding thiếu. Từ đó ra hệ quả engineering chạy suốt Phần 9 và 12: **không prompt cho hallucination biến mất; grounding cho nó biến mất** (đưa sự thật vào context — RAG) **và bắt nó** (evals, trích dẫn, kiểm chứng). "Đừng ảo giác" trong system prompt là một điều ước, không phải một control — phân biệt PDF-vs-code của S07-P10, lần nữa.

## 6. Đọc model card như một engineer

Trước khi nhận nuôi model nào, năm dòng trả lời gần hết: **độ dài context** (và trần output — thường nhỏ hơn nhiều), **knowledge cutoff** (sự kiện sau đó phải đến qua context — lại retrieval), **giá mỗi token input/output** (output thường đắt gấp vài lần input — prompt dài thì rẻ, câu trả lời dài thì không), **modality và hỗ trợ tool** (function calling? vision? chế độ structured output?), và **hạng latency** (một model tiền tuyến và một model nhỏ-nhanh thường ghép đôi tốt hơn là chọn một — routing của Phần 13). Benchmark là thứ đọc cuối cùng, không phải đầu tiên; bộ eval của bạn (Phần 12) xếp trên leaderboard của họ.

## Thực hành (20 phút — đếm token, rồi xem temperature đổi câu trả lời)

Cài một thư viện (`pip install tiktoken`) cho nửa token; nửa sampling cần một chat API bất kỳ bạn đang có quyền dùng.

```python
import tiktoken
enc = tiktoken.get_encoding("cl100k_base")     # họ tokenizer mà đa số chat model dùng

# 1. Token không phải từ, và chắc chắn không phải ký tự
for text in ["hello", "Hello", " hello", "unbelievable", "strawberry", "12345678"]:
    ids = enc.encode(text)
    print(f"{text!r:>16} → {len(ids)} token: {[enc.decode([i]) for i in ids]}")

# 2. Thuế "không phải tiếng Anh", đo chứ không phán
en = "The quick brown fox jumps over the lazy dog and keeps running."
vi = "Con cáo nâu nhanh nhẹn nhảy qua con chó lười và tiếp tục chạy."
for name, t in (("Tiếng Anh", en), ("Tiếng Việt", vi)):
    print(f"{name:>11}: {len(t):>3} ký tự → {len(enc.encode(t)):>3} token "
          f"({len(enc.encode(t))/len(t.split()):.1f} token mỗi từ)")

# 3. Vì sao "strawberry có mấy chữ r" là câu khó: model không bao giờ thấy chữ cái
print("strawberry vỡ thành:", [enc.decode([i]) for i in enc.encode("strawberry")])

# 4. Prompt của bạn có bảng giá — hãy đếm trước khi dán
doc = open(__file__).read()      # một file bất kỳ bạn có sẵn
print(f"file này = {len(enc.encode(doc)):,} token context")
```

Với nửa sampling, gửi *cùng một* prompt ba lần ở `temperature=0` và ba lần ở `temperature=1.2` — chọn thứ có chỗ để biến thiên, ví dụ "Đặt tên sản phẩm cho một app quản lý chi tiêu." Rồi hỏi cùng một câu hỏi sự kiện ở cả hai mức, chẳng hạn "Tháp Eiffel hoàn thành năm nào?"

Kết quả mong đợi: viết hoa và một dấu cách đứng trước làm đổi số token, `unbelievable` vỡ thành nhiều mảnh, và chuỗi chữ số dài bị cắt vụn — không cái nào khớp với cách *bạn* đếm từ. Câu tiếng Việt tốn nhiều token mỗi từ hơn hẳn câu tiếng Anh có độ dài tương đương: khoảng cách đó là một dòng có thật trên mọi hoá đơn. Bước 3 cho thấy `strawberry` tới nơi dưới dạng hai ba cụm, và đó là lý do các câu hỏi đếm chữ cái thất bại — model chưa từng được cho xem các chữ cái. Còn ở nửa sampling, temperature 0 trả về cùng một cái tên mỗi lần trong khi 1.2 biến thiên loạn xạ — nhưng câu trả lời *sự kiện* vẫn được đưa ra đầy tự tin ở cả hai mức. Temperature mua tính nhất quán, không mua tính đúng.

## Tự kiểm tra

1. Template prompt của app chạy ổn với tiếng Anh, nhưng người dùng bản tiếng Việt lại chạm trần context và tốn tiền hơn với cùng nội dung. Chuyện gì đang xảy ra?
2. Stakeholder bảo bạn "để temperature bằng 0 cho nó hết bịa". Bạn nói gì với họ?
3. Trợ lý của bạn tự tin trích dẫn một mục trong tài liệu chính sách mà mục đó không tồn tại. Giải thích cơ chế, và gọi tên hai thay đổi thiết kế thật sự có tác dụng.

<details><summary>Xem đáp án</summary>

1. Tokenizer được huấn luyện chủ yếu trên tiếng Anh, nên các ngôn ngữ khác vỡ thành nhiều token hơn cho cùng một lượng nghĩa — thường nhiều hơn rõ rệt trên mỗi từ. Cùng nội dung, nhiều token hơn: bạn chạm trần context sớm hơn và trả tiền nhiều hơn mỗi request. Hãy tính ngân sách context bằng *token đo trên văn bản thật*, không bằng ký tự hay từ.
2. Temperature 0 làm output *tất định*, không làm nó *đúng*. Nó bỏ phần ngẫu nhiên khi chọn giữa các token kế tiếp có khả năng cao, nên bạn nhận cùng một câu trả lời mỗi lần — kể cả cùng một câu bịa đầy tự tin. Đó là thiết lập đúng cho tính nhất quán và structured output, nhưng nó không phải cách chữa hallucination.
3. Model sinh token kế tiếp có xác suất cao nhất theo context; một số hiệu mục nghe hợp lý đúng là thứ một tài liệu trôi chảy sẽ chứa, và không có gì trong cơ chế kiểm tra xem nó có tồn tại không. Thứ có tác dụng: grounding — retrieve văn bản tài liệu thật vào context để phần tiếp nối có xác suất cao *chính là* phần đúng — và verification, tức validate hoặc kiểm chứng trích dẫn thay vì tin vào sự trôi chảy.

</details>

## Điều cần nhớ

- Token ≈ ¾ từ, tính tiền hai chiều, kèm thuế ngoài-tiếng-Anh — và các cú fail mức-ký-tự là chuyện tokenization, không phải trí tuệ.
- Context là bộ nhớ làm việc stateless có thu tiền thuê: trần cứng, compute bậc hai, attention không đều — retrieval tồn tại vì cả ba.
- Sinh chữ là từng-token-một từ một distribution; temperature 0 = nhất quán (không phải trung thực), ~0.7 cho văn xuôi, và `max_tokens` là máy chém.
- Hallucination là cơ chế vận hành đúng trên grounding thiếu: grounding nó (RAG) và bắt nó (evals) — đừng ước nó biến mất trong prompt.

*Tiếp theo — Phần 8: Prompt engineering như một kỷ luật kỹ thuật.*
