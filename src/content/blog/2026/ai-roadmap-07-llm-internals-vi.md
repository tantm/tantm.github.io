---
title: 'LLM hoạt động thế nào: token, context, sampling'
description: 'Token không phải từ, context là bộ nhớ làm việc có thu tiền thuê, và temperature là núm vặn trên một distribution — các sự thật cơ học đằng sau mọi hành vi LLM khiến engineer bất ngờ.'
date: 2026-08-02
category: AI
tags: [ai-roadmap, llm]
lang: vi
translationKey: ai-roadmap-07
series: ai-roadmap
part: 7
---

Phần 6 trao cho bạn động cơ (attention, pretraining). Phần này là sổ tay người vận hành: một nắm sự thật cơ học — token, context, vòng lặp sinh chữ, sampling — giải thích gần hết mọi câu "sao nó lại làm thế?" bạn sẽ đụng khi build. Không có gì kỳ bí; và tất cả đều tính tiền được.

## Token: bảng chữ cái của model không phải của bạn

Model không đọc từ hay ký tự — nó đọc **token**: các mảnh phổ biến theo thống kê học từ dữ liệu (họ tokenizer BPE). `"understanding"` có thể là một token; `"antidisestablishmentarianism"` là năm; `" the"` (kèm dấu cách đầu!) là một trong những token phổ biến nhất. Xấp xỉ: **1 token ≈ ¾ từ tiếng Anh**.

Các hệ quả cơ học bạn gặp ngay tuần đầu:

- **Bạn bị tính tiền theo token**, input và output riêng — trực giác chi phí bắt đầu từ `len(tokens)` chứ không phải `len(words)`, và mọi provider đều phát kèm tokenizer chạy local để đếm trước khi tiêu.
- **Ngôn ngữ ngoài tiếng Anh chịu thuế**: tokenizer train chủ yếu trên tiếng Anh sẽ băm tiếng Việt, tiếng Thái, hay text trộn code thành nhiều token nhỏ hơn — cùng một câu, nhiều token hơn, đắt hơn, context hiệu dụng ít hơn. (Viết các bài VI của blog này tốn nhiều token hơn bản EN. Đã kiểm chứng.)
- **Việc mức-ký-tự khó một cách chính đáng**: "strawberry có mấy chữ r" fail không phải vì ngu mà vì model nhìn thấy `[straw][berry]`, không thấy chữ cái. Cùng lý do cho sự yếu ở đảo chuỗi chính xác hay số học trên dãy số dài — các chữ số bị băm không đều.

## Context: bộ nhớ làm việc có thu tiền thuê

**Context window** là mọi thứ model "thấy" cho cú gọi này: system prompt + hội thoại + tài liệu retrieve + chính output nó đang sinh. Ba sự thật định hình cách bạn engineer quanh nó:

1. **Nó là trần cứng** — vượt là phải cắt hoặc từ chối; hội thoại dài âm thầm cắt các lượt cũ nhất, và vì thế model "quên" chỉ dẫn từ một tiếng trước. Hoàn toàn không có bộ nhớ *giữa* các cú gọi: model là stateless, và "lịch sử chat" đúng nghĩa đen là app của bạn gửi lại transcript mỗi lần.
2. **Giá tuyến tính, compute bậc hai** (Phần 6) — long context là một quyết định chi phí thật, không phải tiện nghi miễn phí.
3. **Attention là một ngân sách** (chữ nhỏ Phần 6) — chôn sự thật then chốt ở trang 40 của đống context dán vào là thiệt hại đo được; đặt chỉ dẫn ở đầu/cuối thì đỡ. Đây là lập luận cơ học cho retrieval (Phần 9): *chọn* 2% liên quan, đừng chuyển cả đống rơm.

## Sinh chữ: mỗi lần một token, mãi mãi

Vòng lặp sản xuất mọi câu trả lời:

```text
1. Đưa toàn bộ context qua mạng (Phần 6)
2. Nhận một distribution xác suất trên toàn bộ vocabulary (Phần 2!)
3. Chọn MỘT token từ đó   ← "quyết định" duy nhất tồn tại
4. Nối vào context; quay lại 1 (KV cache làm bước này rẻ)
```

Mọi thứ model "làm" là vòng lặp này. Hệ quả: output tính tiền theo token *và* chậm theo token (streaming tồn tại vì người dùng đang xem vòng lặp chạy — token đầu chậm, phần sau nhanh, theo KV cache Phần 6); model không thể "lên kế hoạch trước" ngoài mức mà việc đoán-token-giỏi ngầm chứa; và `max_tokens` là máy chém, không phải mục tiêu — chạm nó là JSON của bạn đứt giữa dấu ngoặc (luôn kiểm finish reason; structured output bị cắt cụt là con bug im lặng kinh điển).

## Sampling: temperature là núm vặn trên distribution

Bước 3 ở trên có lựa chọn. **Greedy** (temperature 0): luôn lấy token xác suất cao nhất — gần như deterministic, tốt nhất cho extraction, phân loại, structured output. **Sampling** (temperature > 0): rút từ distribution — ý temperature của Phần 2 thành hiện thực: T thấp làm nhọn distribution về phía các lựa chọn đầu; T cao làm phẳng nó, cho các token khó xảy ra lọt qua (sáng tạo và nhảm nhí đi vào qua cùng một cánh cửa). **Top-p** giới hạn sampling vào tập token nhỏ nhất phủ p khối xác suất — một sàn chất lượng dưới các temperature cao.

Mặc định thực chiến: **0 cho bất cứ thứ gì máy tiêu thụ** (JSON, tool call, evals cần tái lập), **~0.7 cho văn xuôi người đọc**, và chỉnh một núm, đừng cả hai. Và một huyền thoại đáng khai tử: temperature 0 *không* làm model trung thực — nó làm model *nhất quán*. Một distribution sai một cách tự tin, lấy greedy, chỉ là sai một cách nhất quán.

## Hallucination, nhìn bằng cơ học (giữ lời hứa)

Phần 2 hứa lời giải thích thật thà; giờ bạn đã đủ linh kiện. Phép toán duy nhất của model là "phát ra token kế tiếp hợp lý theo context." Khi context (cộng kiến thức pretrain) không chứa đáp án, *phần tiếp nối hợp lý nhất* của một câu văn giọng-uy-tín là… một phần hoàn thành giọng-uy-tín. Một trích dẫn bịa không phải trục trặc — nó là distribution vận hành đúng thiết kế trên nền grounding thiếu. Từ đó ra hệ quả engineering chạy suốt Phần 9 và 12: **không prompt cho hallucination biến mất; grounding cho nó biến mất** (đưa sự thật vào context — RAG) **và bắt nó** (evals, trích dẫn, kiểm chứng). "Đừng ảo giác" trong system prompt là một điều ước, không phải một control — phân biệt PDF-vs-code của S07-P10, lần nữa.

## Đọc model card như một engineer

Trước khi nhận nuôi model nào, năm dòng trả lời gần hết: **độ dài context** (và trần output — thường nhỏ hơn nhiều), **knowledge cutoff** (sự kiện sau đó phải đến qua context — lại retrieval), **giá mỗi token input/output** (output thường đắt gấp vài lần input — prompt dài thì rẻ, câu trả lời dài thì không), **modality và hỗ trợ tool** (function calling? vision? chế độ structured output?), và **hạng latency** (một model tiền tuyến và một model nhỏ-nhanh thường ghép đôi tốt hơn là chọn một — routing của Phần 13). Benchmark là thứ đọc cuối cùng, không phải đầu tiên; bộ eval của bạn (Phần 12) xếp trên leaderboard của họ.

## Điều cần nhớ

- Token ≈ ¾ từ, tính tiền hai chiều, kèm thuế ngoài-tiếng-Anh — và các cú fail mức-ký-tự là chuyện tokenization, không phải trí tuệ.
- Context là bộ nhớ làm việc stateless có thu tiền thuê: trần cứng, compute bậc hai, attention không đều — retrieval tồn tại vì cả ba.
- Sinh chữ là từng-token-một từ một distribution; temperature 0 = nhất quán (không phải trung thực), ~0.7 cho văn xuôi, và `max_tokens` là máy chém.
- Hallucination là cơ chế vận hành đúng trên grounding thiếu: grounding nó (RAG) và bắt nó (evals) — đừng ước nó biến mất trong prompt.

*Tiếp theo — Phần 8: Prompt engineering như một kỷ luật kỹ thuật.*
