---
title: 'AI Agents: tool use, planning, orchestration'
description: 'Agent loop là một vòng while bạn phải vẽ được từ trí nhớ, tool là bản hợp đồng, và autonomy là ngân sách để tiêu — cộng khi nào multi-agent đáng giá (muộn hơn bạn nghĩ).'
date: 2026-08-04
category: AI
tags: [ai-roadmap, agents, llm]
lang: vi
translationKey: ai-roadmap-10
series: ai-roadmap
cover: images/s03-p10-hero.png
part: 10
---

P08 đưa model chỉ thị; P09 đưa nó kiến thức. **Agent** là thứ bạn có khi đưa nó *đôi tay*: khả năng gọi tool, quan sát kết quả, và quyết định làm gì tiếp. Bóc lớp buzzword ra thì kiến trúc nhỏ tới mức vẽ được từ trí nhớ — và bạn nên vẽ được, vì mọi thứ hỏng hóc trong production đều truy về một trong các chiếc hộp đó.

## Bạn sẽ học được gì

- Vẽ vòng lặp agent từ trí nhớ, và gọi tên hai sự thật khiến nó an toàn hay không an toàn.
- Thiết kế một tool theo cách bạn thiết kế API, kể cả các thông báo lỗi.
- Đặt ngân sách autonomy: trần vòng lặp, cổng phê duyệt, và audit trail.
- Nói được khi nào multi-agent thật sự chính đáng — và nó muộn hơn các demo gợi ý nhiều.

**Cần biết trước:** Phần 8 (structured output và validation) và Phần 9 (retrieval), vì agent dựng từ cả hai.

## 1. Vòng lặp bạn phải vẽ được

```mermaid
flowchart TB
  U[Task] --> M[LLM quyết định:<br/>trả lời hay gọi tool?]
  M -->|tool call JSON| E[Code của bạn thực thi tool]
  E -->|kết quả nối vào context| M
  M -->|câu trả lời cuối| A[Xong]
  M -.->|hết ngân sách /<br/>điều kiện dừng| A
```

Chỉ vậy: một vòng while nơi model phát ra hoặc một câu trả lời hoặc một **tool call** (JSON có cấu trúc — bản hợp đồng structured-output của P08, lại gánh trọng lượng), code của bạn thực thi nó, và kết quả quay lại context cho quyết định kế tiếp. Hai sự thật rơi ra ngay. Thứ nhất, **model không bao giờ thực thi gì cả — code của bạn thực thi**: model *đề xuất*, runtime của bạn *định đoạt*, và sự tách bạch đó là nơi mọi thuộc tính an toàn cư ngụ. Thứ hai, **vòng lặp dùng chung context window** (P07): một phiên 20 bước với tool output to sẽ lặng lẽ đẩy văng chính phần suy luận đầu của nó — agent đường-dài thất bại như bài toán *quản lý context* trước khi thất bại như bài toán trí tuệ. Tóm tắt các bước cũ, cắt gọn tool output, và coi context là ngân sách bộ nhớ của vòng lặp.

## 2. Tool là bản hợp đồng

Một tool là một chữ ký hàm trưng ra cho model: tên, mô tả, tham số có kiểu. Viết chúng là thiết kế API (interface-tại-biên-giới của CS-P10), và cùng gu thẩm mỹ đó áp dụng:

- **Mô tả chính là prompt.** Model chọn tool bằng cách đọc chúng; mô tả mơ hồ sinh ra cú gọi mơ hồ. Nói nó làm gì, khi nào dùng, và khi nào *đừng* dùng.
- **Ít tool sắc bén thắng nhiều tool chồng lấn** — mười tool đặt tên chuẩn với tham số gọn đánh bại bốn mươi bản gần-trùng làm nhoè quyết định (phiên bản của model cho một bề mặt API bừa bộn).
- **Validate mọi cú gọi như user input** — vì nó đúng là vậy (model của CS-P11: các đối số tới từ một cỗ máy sinh chữ vừa đọc nội dung không đáng tin). Kiểm schema, rồi authorize: danh tính của agent nhận scope least-privilege (CS-P11, S04-P02) — read-only ở mọi chỗ read-only là đủ.
- **Lỗi là thông tin.** Trả về "date phải là YYYY-MM-DD, nhận được 'tomorrow'" và vòng lặp tự sửa ở lượt sau; trả về một stack trace trần trụi và nó quẫy đạp. Message lỗi của tool cũng là prompt.

## 3. Autonomy là ngân sách, không phải triết lý

Cái núm quan trọng không phải "agent hay không" — mà là *bao nhiêu dây*. Tiêu autonomy ở nơi verify rẻ và sai lầm đảo ngược được; giữ lại ở nơi không:

- **Chặn trần vòng lặp**: max số bước, max chi phí mỗi task, timeout. Một agent kẹt mà không có ngân sách là "retry vô tận" của P08 gắn kèm thẻ tín dụng.
- **Đặt cổng cho hành động không đảo ngược được.** Đọc-tìm-tóm tắt chạy tự do; chuyển-tiền-xoá-bản-ghi đi qua phê duyệt của con người (soạn nháp, đừng gửi). Điều này soi gương bản năng DLQ của messaging (S04-P09): quyết định đường thất bại *trước* sự cố.
- **Thiết kế cho audit trail**: log mọi tool call và kết quả. Khi agent làm điều kỳ quặc — nó sẽ làm — bản transcript là EXPLAIN plan của bạn.
- **Prompt injection là mối đe doạ thường trực** (bộ áo thứ tư của CS-P11): bất kỳ văn bản nào agent đọc — một trang web, một tài liệu retrieve về (P09), một tool result — đều có thể chứa chỉ thị. Phòng thủ là nhiều lớp, không tuyệt đối: tool least-privilege, đối xử nội dung retrieve như data trong cấu trúc prompt, và cổng phê duyệt trên mọi thứ có side effect.

## 4. Multi-agent: muộn hơn bạn nghĩ

Vòng lặp một-agent với tool tốt phủ nhiều đất hơn tiếng ồn của hệ sinh thái gợi ý. Multi-agent xứng với độ phức tạp của nó trong hai ca thật thà: **fan-out song song** (nghiên cứu N chủ đề cùng lúc — một worker pool, pattern của S02-P07 với prompt) và **tách bạch mối quan tâm với đặc quyền khác nhau** (một planner không được thực thi; một executor scope hẹp; một reviewer chỉ đọc — least privilege của CS-P11 trở thành *kiến trúc*). Thứ không sống sót khi va thực tế: các "xã hội" nhập vai cầu kỳ nơi năm agent đốt token nói chuyện với nhau về việc mà một agent làm được. Áp luật của S01-P10 — thêm agent thứ hai ở nhu cầu *được chứng minh* thứ hai, không phải ở nhu cầu tưởng tượng đầu tiên.

Món kế thừa đánh giá từ P09 vẫn đứng: định nghĩa tiêu chí xong theo từng loại task, xây golden set các task, đo completion rate và chi phí — agent mà chất lượng được chấm bằng cảm giác demo thì chính là demo.

## Thực hành (25 phút — tự dựng vòng lặp, kèm ngân sách gắn sẵn)

Framework che mất vòng lặp, và đó là lý do nhiều hệ agent khó đoán. Viết tay nó một lần là nó thôi huyền bí — kể cả các phần khiến nó không chạy mãi mãi:

```python
import json
# from your_sdk import client

# --- Tool: hàm thật, kèm schema CHÍNH LÀ tài liệu của nó ---
def get_order(order_id: str):
    db = {"A-1": {"status": "shipped", "total": 120.0}}
    if order_id not in db:
        return {"error": f"không có đơn {order_id}; hãy hỏi người dùng xác nhận lại mã"}   # lỗi dạy được
    return db[order_id]

def issue_refund(order_id: str, amount: float):
    return {"ok": True, "refunded": amount, "order": order_id}

TOOLS = {"get_order": get_order, "issue_refund": issue_refund}
IRREVERSIBLE = {"issue_refund"}                       # danh sách cần cổng phê duyệt
SCHEMAS = [
 {"name": "get_order", "description": "Tra trạng thái và tổng tiền của một đơn theo mã.",
  "input_schema": {"type": "object", "properties": {"order_id": {"type": "string"}},
                   "required": ["order_id"]}},
 {"name": "issue_refund", "description": "Hoàn tiền cho một đơn. Không thể đảo ngược.",
  "input_schema": {"type": "object",
                   "properties": {"order_id": {"type": "string"}, "amount": {"type": "number"}},
                   "required": ["order_id", "amount"]}},
]

def run_agent(user_msg, max_steps=5, auto_approve=False):
    messages = [{"role": "user", "content": user_msg}]
    audit = []                                        # audit trail, không phải tuỳ chọn
    for step in range(max_steps):                     # CÁI TRẦN: vòng lặp không chạy mãi được
        resp = client.messages.create(model="<model-cua-ban>", max_tokens=800,
                                      tools=SCHEMAS, messages=messages)
        calls = [b for b in resp.content if getattr(b, "type", "") == "tool_use"]
        if not calls:
            return "".join(b.text for b in resp.content if b.type == "text"), audit

        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for c in calls:
            if c.name in IRREVERSIBLE and not auto_approve:
                decision = input(f"  DUYỆT {c.name}({c.input})? [y/N] ")   # cái cổng
                if decision.lower() != "y":
                    results.append({"type": "tool_result", "tool_use_id": c.id,
                                    "content": "bị người review từ chối"})
                    audit.append(("từ chối", c.name, c.input)); continue
            out = TOOLS[c.name](**c.input)            # code định đoạt; model chỉ đề xuất
            audit.append((step, c.name, c.input, out))
            results.append({"type": "tool_result", "tool_use_id": c.id,
                            "content": json.dumps(out, ensure_ascii=False)})
        messages.append({"role": "user", "content": results})
    return "DỪNG: hết ngân sách bước", audit          # một cái trần biết báo cáo, không phải trần giấu diếm

answer, trail = run_agent("Đơn A-1 trạng thái gì, và hoàn tiền nếu nó đã ship?")
print(answer); [print("  ", t) for t in trail]

# Giờ tới các ca tách một demo khỏi một hệ thống:
run_agent("Hoàn tiền đơn A-999")                       # tool báo lỗi → nó hồi phục hay lặp vô ích?
run_agent("Hoàn tiền mọi đơn trong database")          # cái trần có chặn không? cổng có giữ không?
```

Kết quả mong đợi: lượt đầu chạy hai bước — tra cứu, rồi đề xuất hoàn tiền — và dừng ở lời nhắc phê duyệt của bạn, đó chính là toàn bộ lý do cái cổng tồn tại: model *đề xuất* một hành động không đảo ngược được và code của bạn định đoạt. Ca mã sai cho thấy vì sao thông báo lỗi cũng là prompt: một câu "hãy hỏi người dùng xác nhận lại mã" sinh ra sự hồi phục, còn một `KeyError` trần trụi sinh ra vòng lặp thử lại bối rối. Ca cuối đáng nhìn kỹ nhất — có cái trần thì nó dừng và nói ra; xoá `max_steps` đi thì đúng yêu cầu đó có thể quay vô tận, tiêu tiền suốt dọc đường.

## Tự kiểm tra

1. Agent của bạn chạy tốt lúc test và thỉnh thoảng làm chuyện hoang dại trên production. Thiết kế đã bỏ qua sự thật nào trong hai sự thật về vòng lặp?
2. Một tool trả về `{"error": "invalid input"}`. Vì sao đó là tool tệ hơn so với tool trả về một câu dài hơn?
3. Team bạn đề xuất năm agent chuyên biệt nói chuyện với nhau. Bạn hỏi gì trước khi đồng ý?

<details><summary>Xem đáp án</summary>

1. Rằng model *đề xuất* còn code của bạn *định đoạt*. Nếu code thực thi mọi thứ model yêu cầu mà không có cổng cho hành động không đảo ngược được và không có trần vòng lặp, thì độ an toàn của hệ thống hoàn toàn nằm ở phán đoán của model — thứ thay đổi theo input, kể cả input do người dùng viết ra. Autonomy phải là một ngân sách được cưỡng chế trong code.
2. Vì thông báo lỗi của tool chính là một prompt: đó là thông tin duy nhất model có cho lần thử kế tiếp. "Invalid input" không cho nó gì để sửa, nên nó thử lại y hệt hoặc bỏ cuộc. "Không có đơn A-999; hãy hỏi người dùng xác nhận lại mã" nói chính xác sự hồi phục trông thế nào, và biến một ngõ cụt thành một lượt chạy được.
3. Mỗi agent làm được gì mà một agent với cùng bộ tool không làm được, và các ranh giới đó thật sự giảm rủi ro ở đâu. Có những lý do chính đáng — song song thật sự trên các tác vụ con độc lập, hoặc tách đặc quyền để agent đọc internet không đồng thời tiêu được tiền. "Nó module hơn" không phải một lý do: mỗi bước nhảy giữa các agent thêm mất mát context, thêm độ trễ và chi phí, và debug multi-agent khó hơn debug một vòng lặp đơn rất nhiều.

</details>

## Điều cần nhớ

- Agent là một vòng while: model đề xuất tool call, code của bạn thực thi, kết quả quay vào — và context là ngân sách bộ nhớ của vòng lặp; quản nó hoặc task dài tự ăn chính mình.
- Tool là thiết kế API: mô tả sắc (chúng là prompt), validate schema, scope least-privilege, và message lỗi viết cho model tự sửa được.
- Tiêu autonomy nơi sai lầm rẻ; ngân sách số bước và chi phí, cổng phê duyệt cho hành động không đảo ngược, log tất cả, và coi prompt injection là đe doạ thường trực.
- Multi-agent cho fan-out song song hoặc tách đặc quyền — không cho sân khấu; agent thứ hai tới ở nhu cầu được chứng minh thứ hai.

*Tiếp theo — Phần 11: Fine-tuning & LoRA: khi prompt không còn đủ.*
