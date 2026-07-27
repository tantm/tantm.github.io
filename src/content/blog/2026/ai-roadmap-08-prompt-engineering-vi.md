---
title: 'Prompt engineering như một kỷ luật kỹ thuật'
description: 'Prompt là code: giải phẫu một prompt production, bốn kỹ thuật sống sót khi va thực tế, structured output như bản hợp đồng, và versioning một cách nghiêm túc.'
date: 2026-08-03
category: AI
tags: [ai-roadmap, llm, prompt-engineering]
lang: vi
translationKey: ai-roadmap-08
series: ai-roadmap
part: 8
---

"Prompt engineering" mang tiếng xấu vì các listicle câu thần chú. Bóc lớp truyền thuyết đi, thứ còn lại là engineering thật: **prompt là code** — nó mã hoá hành vi, nó vỡ ở edge case, nó regress khi bị sửa mù, và nó xứng đáng cùng thứ kỷ luật với bất kỳ function nào trong production. Phần này là thứ kỷ luật đó, cộng bốn kỹ thuật thật sự sống sót khi va chạm input thật.

## Giải phẫu một prompt production

Phần 7 dạy rằng mọi thứ là context và attention là một ngân sách. Prompt production tiêu ngân sách đó có chủ đích, theo một trật tự ổn định:

```text
SYSTEM:
  Vai trò     — "Bạn là bộ phân loại ticket hỗ trợ cho một nền tảng e-commerce."
  Luật        — làm gì, không bao giờ làm gì, giọng điệu, ngôn ngữ
  Đặc tả output — hình dạng chính xác của câu trả lời (schema bên dưới)
  Lối thoát   — "Ticket không khớp category nào thì dùng 'other'
                 và giải thích ngắn trong 'note'. Không bao giờ bịa category."

USER:
  Context     — tài liệu retrieve / bản ghi cần xử lý
  Input nhiệm vụ — text của chính cái ticket
```

Ba luật vị trí với lý do cơ học: **system prompt cho hành vi ổn định, lượt user cho dữ liệu theo-request** (system mang trọng lượng tuân-thủ-chỉ-dẫn cao hơn, và provider cache nó — rẻ hơn *và* mạnh hơn); **chỉ dẫn đứng trước context dài, yêu cầu then chốt nhắc lại phía sau** (ngân sách attention Phần 7: khúc giữa của context dài là ghế hạng bét); và luôn có một **lối thoát** — hành vi định nghĩa sẵn cho "không biết / không khớp" — vì Phần 7 đã cho thấy model làm gì khi bị dồn góc mà không có lối thoát: nó sản xuất câu trả lời sai nghe-hợp-lý-nhất đang có sẵn.

## Bốn kỹ thuật sống sót khi va thực tế

1. **Cho xem, đừng mô tả (few-shot).** Hai ba ví dụ input→output thắng cả đoạn văn tính từ — bạn đang lái phép đoán-token-kế-tiếp bằng bằng chứng, không phải bằng cảm giác. Đòn bẩy cao nhất: kèm một ví dụ về ca *khó hoặc mơ hồ* được xử lý đúng; các ca dễ chưa bao giờ là vấn đề.
2. **Cho nó nghĩ trước khi trả lời** — với nhiệm vụ nặng suy luận, yêu cầu phân tích ngắn trước kết luận giúp ích đo được (model tính toán bằng token; hãy cấp token để nó tính). Với extraction tầm thường thì bỏ qua: bạn đang trả giá token-output (P7) cho nghi lễ. Các model tuned-suy-luận hiện đại tự làm việc này bên trong — biết model của mình trước khi chồng kỹ thuật lên nó.
3. **Chia nhỏ thay vì nhồi nhét.** Một prompt làm năm việc (phân loại + trích xuất + tóm tắt + dịch + format) fail một phần và không debug nổi. Năm prompt nhỏ trong một pipeline — bản năng đơn-trách-nhiệm của S02 — fail *cục bộ*, retry *riêng lẻ*, eval *tách bạch*. Đây cũng là hạt mầm của tư duy agent Phần 10.
4. **Viết cả phần không gian âm.** Prompt thật kiếm cơm trên input rác: text rỗng, sai ngôn ngữ, ai đó thử "bỏ qua các chỉ dẫn trước" (injection — Phần 14 xử trọn; luật của hôm nay: *không bao giờ* để nội dung retrieve hay của user định nghĩa lại luật — dữ liệu là dữ liệu, không phải chỉ dẫn).

## Structured output: bản hợp đồng với code của bạn

Khoảnh khắc một chương trình tiêu thụ output của model, văn xuôi là một con bug. Định nghĩa hình dạng và dùng chế độ structured-output/tool-schema của API khi có — và vẫn validate:

```python
class Ticket(BaseModel):
    category: Literal["billing", "shipping", "technical", "other"]
    urgency: int = Field(ge=1, le=3)
    note: str = ""

resp = call_model(SYSTEM, user_text, schema=Ticket)   # temperature 0 — luật P7
ticket = Ticket.model_validate_json(resp)              # tin, nhưng kiểm
```

Các điểm engineering: **schema mode + temperature 0 + validation + một cú retry-kèm-thông-báo-lỗi** phủ tuyệt đại đa số cú fail (thói quen type-ở-biên-giới của S02-P03, phiên bản LLM); enum thắng free text cho bất cứ thứ gì code hạ nguồn rẽ nhánh; và kiểm finish reason — cái máy chém `max_tokens` của P7 rất thích chặt đầu JSON.

## Prompt là code — version nó như code

Chế độ fail mọi team đều diễn lại: ai đó "cải thiện" prompt chiều thứ Sáu, ca demo tốt lên, ba ca thầm lặng vỡ, không ai biết cho tới khi một khách hàng biết. Kỷ luật ngăn nó gần như miễn phí:

- **Prompt sống trong repo**, không phải trong ô textbox trên dashboard: review qua PR (CS-P9), có ID và version (`ticket_classifier_v7`), log kèm mọi request để bất kỳ output nào cũng truy ngược được về đúng prompt sinh ra nó.
- **Thay đổi phải qua một bộ eval** — vài chục input đại diện (gồm các ca khó và mọi sự cố production — lại thói quen fixture) kèm output kỳ vọng. Version mới chạy trên bộ đó *trước* cú tráo; điểm số quyết định, không phải cảm giác. Đây là kỷ luật test-set của Phần 4 mặc áo LLM, và Phần 12 công nghiệp hoá nó.
- **Một cú đổi prompt là một cú deploy** — dòng changelog, đường rollback. Vì nó đúng là thế: nó thay đổi hành vi production y hệt một cú đổi code.

## Khi prompting là sai công cụ

Cái thang leo từ Phần 1, giờ cụ thể: prompting sửa *chỉ dẫn*; nó không thể thêm **kiến thức model thiếu** (việc của retrieval — Phần 9), không cưỡng chế đáng tin **hành vi trên hàng nghìn input muôn hình** nơi ví dụ cạn kiệt (lãnh thổ fine-tuning — Phần 11), và không làm model **có năng lực nó không có** (không câu chữ nào mở khoá số học trên dãy 40 chữ số — tokenizer của P7 gửi lời chào). Đang ở prompt version 15 cho cùng một cú fail? Bạn đang đứng sai bậc thang.

## Điều cần nhớ

- Prompt là code: giải phẫu ổn định (vai trò, luật, đặc tả output, lối thoát), chỉ dẫn đặt theo ngân sách attention, dữ liệu không bao giờ được phép biến thành chỉ dẫn.
- Few-shot kèm ca khó, chỗ-để-nghĩ cho nhiệm vụ suy luận, chia nhỏ thay vì nhồi, và xử lý tường minh không gian âm — bốn kỹ thuật bền.
- Structured output = schema mode + temperature 0 + validation + retry; enum cho mọi thứ code rẽ nhánh.
- Version prompt trong repo, gác thay đổi bằng bộ eval, coi mỗi thay đổi là một cú deploy — và biết khi nào bậc thang kế tiếp (RAG, fine-tuning) mới là thuốc thật.

*Tiếp theo — Phần 9: RAG: làm Retrieval-Augmented Generation tử tế.*
