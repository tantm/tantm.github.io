---
title: 'LLMOps: serving, cost & latency'
description: 'API vs self-host là câu hỏi về tải, mô hình chi phí ba đòn bẩy (rút ngắn, cache, hạ cỡ), vì sao streaming chữa latency cảm nhận, và queue cộng quota cho phần còn lại.'
date: 2026-08-04
category: AI
tags: [ai-roadmap, llmops, mlops]
lang: vi
translationKey: ai-roadmap-13
series: ai-roadmap
part: 13
---

Mọi thứ trước phần này khiến hệ thống *tốt*; phần này giữ nó tốt **ở một mức giá và tốc độ mà business sống nổi**. LLM serving có đúng ba đồng tiền — chất lượng, chi phí, latency — và mọi mẹo bên dưới là một cú hoán đổi giữa chúng. Tư thế kỹ thuật đến thẳng từ P12: bạn chỉ trade được thứ bạn đo được, nên cost-per-request và p99-từng-bước phải nằm sẵn trên dashboard trước khi kéo bất kỳ đòn bẩy nào.

## Bạn sẽ học được gì

- Quyết định API hay tự host từ hình dạng tải của bạn, không từ nguyên tắc.
- Kéo ba đòn bẩy chi phí theo đúng thứ tự thật sự sinh lời.
- Tối ưu độ trễ mà người dùng CẢM NHẬN chứ không phải con số trên dashboard.
- Đối xử với nhà cung cấp model như một dependency, với mọi hàm ý về khả năng chống chịu.

**Cần biết trước:** Phần 7 (token và context) và Phần 12 (eval, thứ đặt cổng cho mọi thay đổi bạn làm ở đây).

## 1. API vs self-host: câu hỏi về tải, không phải tôn giáo

Quyết định đóng khung mọi thứ khác, và nó là kinh tế học model nhỏ của P11 tổng quát hoá:

- **API-first là mặc định đúng**: không hạ tầng (lập luận managed của S02-P08), chất lượng frontier, giá theo token *scale về không* — thuộc tính serverless của S04-P07, cho trí tuệ. Ở volume thấp-tới-vừa, API gần như luôn rẻ hơn đám GPU bạn sẽ để không.
- **Self-host xứng đáng** khi volume cao bền vững trên một task *hẹp* (model nhỏ đã tune của P11, giờ kèm hoá đơn serving), ràng buộc data-residency cứng (S07-P10), hoặc sàn latency mà một cú hop ra ngoài không đạt nổi. Phép toán thật thà: GPU tính tiền theo *giờ*, API theo *token* — self-host là mua một nhà máy so với trả theo đơn vị, và một nhà máy chạy 30% công suất thua API mọi lần (bài học right-size của S04-P03, phiên bản GPU).
- Trạng thái lai mà đa số team đạt tới: **API cho 20% khó, model nhỏ đã tune cho 80% thường nhật** — một router (kể cả rule-based) đứng trước. Đó là bản năng chẻ nhỏ của P08, triển khai thành kiến trúc.

## 2. Chi phí: ba đòn bẩy, theo thứ tự

Kéo theo thứ tự này — mỗi cái rẻ hơn cái sau:

1. **Rút ngắn prompt.** Hoá đơn P07 tính theo token *mỗi request*: system prompt 3.000 token nhân một triệu request mỗi tháng là tiền thật cho phần chữ chủ yếu bị đọc lại, không cần thiết. Cắt boilerplate, chặn trần cửa sổ history (ngân sách context của P10), cắt gọn tool output. **Prompt-prefix caching** — các API lớn đều hỗ trợ — khiến phần prefix *ổn định* rẻ đi đáng kể: cấu trúc prompt sao cho phần cố định đứng trước, phần biến thiên đứng sau (luật vị trí của P08, giờ có lập luận tài chính).
2. **Cache câu trả lời.** Cache exact-match cho request lặp lại (bản năng connection-pool của S01-P07: đừng trả tiền hai lần cho cùng một việc); **semantic caching** — embed câu hỏi, trả câu trả lời cache nếu tồn tại câu gần-y-hệt (bộ máy P09, chĩa vào chính traffic của bạn) — cho phần tải hình-dạng-FAQ. Canh hai khẩu súng bắn chân: câu trả lời cá nhân hoá phải key theo context người dùng, và cache invalidation phải bám version prompt/model (tag của P12, lại gánh trọng lượng).
3. **Hạ cỡ model.** Đòn bẩy lớn nhất và là cái đòi eval: route theo độ khó, distill nhóm thường nhật xuống model nhỏ đã tune (P11), và để golden set P12 phân xử "không mất chất lượng" thật ra nghĩa là gì. Team bỏ qua đòn bẩy 3 trả giá frontier cho autocomplete; team bắt đầu bằng nó thì phá chất lượng mà không đo nổi.

Rồi khiến chi tiêu *nhìn thấy được*: tag mỗi request theo feature/team (metric business của S04-P10), alarm cost-per-day theo feature, và đặt **quota** để một vòng agent chạy hoang (ngân sách chặn trần của P10, giờ platform cưỡng chế) hay một khách hàng quá nhiệt tình không đốt nổi ngân sách tháng trong một buổi chiều.

## 3. Latency: cảm nhận thắng thực tế

LLM sinh chữ từng token (vòng lặp của P07), nghĩa là **time-to-first-token và time-to-last-token là hai metric khác nhau với hai cách chữa khác nhau**:

- **Streaming là cú chữa latency ROI cao nhất và nó miễn phí**: gửi token ngay khi sinh ra. Một câu trả lời 12 giây bắt đầu hiện ở 800ms *cảm giác* nhanh; cùng câu đó giao nguyên khối cảm giác hỏng. Người đọc ~10 token/giây — generation vượt xa họ; sự chờ duy nhất quan trọng về tâm lý là token đầu tiên. (Structured output làm streaming rắc rối — một JSON không parse được cho tới khi đóng ngoặc là lập luận cho việc stream phần cho-người và batch phần cho-máy.)
- **Cắt chuỗi tuần tự.** p99 sống trong *pipeline*, không chỉ trong model: retrieval → rerank → generate → validate là một bài CS-P8 — song song hoá fan-out retrieval, chồng lấn thứ chồng lấn được, và chất vấn mọi cú hop tuần tự (mỗi vòng agent là một round-trip đầy đủ; ngân sách vòng lặp của P10 cũng là ngân sách latency).
- **Batch phần không-tương-tác.** Cú backfill phân loại, đợt tóm tắt chạy đêm — không thứ nào cần tính bằng giây. Các bậc batch của API lớn chạy tầm nửa giá với deadline nới lỏng. Phân loại mọi workload thành *tương tác* (stream) hay *batch* (queue) — "ai cần kết quả này, tươi cỡ nào?" của S02-P11 áp vào inference.

## 4. Resilience: provider là một dependency như mọi dependency

API model thượng nguồn là một dịch vụ bên thứ ba, và mọi luật S01/S04 áp nguyên vẹn: **timeout và retry có backoff** với 429/5xx (S01-P06 — và tôn trọng header retry-after; nện vào rate limit chỉ kéo dài nó), **idempotency** trên mọi thứ có ghi (màn cameo của luật sắt trong serving), **một cái queue trước workload spiky** (S04-P09 — rate limit của provider chỉ là một consumer chậm; để độ sâu queue hấp thụ cơn spike), và **degradation duyên dáng** quyết *trước* outage (tinh thần DLQ của S04-P09): fallback về model nhỏ hơn, một câu trả lời cache, hoặc một câu "thử lại sau" thật thà — chatbot trả lời hơi kém hơn thắng chatbot không trả lời gì. Và vì bạn đã tag request theo version model (P12), một cú deprecate model phía provider là một đợt eval có lịch, không phải một cơn khẩn cấp.

## Thực hành (25 phút — đo ba đòn bẩy chi phí thay vì đoán chúng)

Mọi đòn bẩy trong bài này đều đo được trong một phiên, và các phép đo thường sắp xếp lại thứ tự ưu tiên của người ta:

```python
import time, tiktoken
enc = tiktoken.get_encoding("cl100k_base")

SYSTEM = open("your_system_prompt.txt").read()   # prompt thật của bạn
DOCS   = open("your_retrieved_context.txt").read()
QUERY  = "một câu hỏi tiêu biểu của người dùng"

# 1. Token của bạn thật sự đi đâu? Đa số team đoán sai.
for name, text in (("system", SYSTEM), ("context lấy về", DOCS), ("câu hỏi user", QUERY)):
    n = len(enc.encode(text))
    print(f"{name:>18}: {n:>6} token")
total = sum(len(enc.encode(t)) for t in (SYSTEM, DOCS, QUERY))
print(f"{'TỔNG INPUT':>18}: {total:>6} token  -> nhân với số request/tháng ra hoá đơn thật")

# 2. ĐÒN BẨY 1 — rút ngắn. Hãy ĐO cú cắt, đừng ước lượng.
trimmed = DOCS[:len(DOCS)//2]      # vd top-3 chunk thay vì top-6
saved = len(enc.encode(DOCS)) - len(enc.encode(trimmed))
print(f"giảm nửa context tiết kiệm {saved} token/request "
      f"({100*saved/total:.0f}% input) — giờ kiểm xem eval còn pass không")

# 3. ĐÒN BẨY 2 — cache. Cache khớp-chính-xác thử nghiệm không tốn gì.
CACHE = {}
def cached_call(prompt, fn):
    if prompt in CACHE:
        return CACHE[prompt], True
    out = fn(prompt); CACHE[prompt] = out
    return out, False

# Phát lại một ngày query thật qua nó và đo tỷ lệ trúng:
# hits = sum(cached_call(q, call_model)[1] for q in yesterdays_queries)
# print(f"tỷ lệ cache trúng: {100*hits/len(yesterdays_queries):.0f}%")

# 4. LATENCY — cú chờ duy nhất đáng kể là thời gian tới token ĐẦU TIÊN
t0 = time.perf_counter(); first = None
# for chunk in client.messages.stream(...):
#     if first is None: first = time.perf_counter() - t0
# print(f"thời gian tới token đầu: {first:.2f}s | tổng: {time.perf_counter()-t0:.2f}s")
```

Kết quả mong đợi: bước 1 thường là chỗ bất ngờ — các team đang tối ưu câu hỏi người dùng phát hiện ra system prompt và context lấy về chiếm 90% input, nên tiền nằm ở đó. Bước 2 biến "chắc cắt bớt context được" thành một con số bạn cân được với điểm eval, và đó là cách trung thực duy nhất để thực hiện đánh đổi ấy. Tỷ lệ trúng ở bước 3 trên một ngày traffic thật quyết định việc dựng cache có đáng hay không — hãy đo trước khi dựng. Còn bước 4 đóng khung lại latency: một phản hồi ra token đầu trong 400ms tạo cảm giác nhanh dù mất 8 giây mới xong, trong khi một phản hồi trả tất cả ở giây thứ 3 lại có cảm giác chậm. Hãy tối ưu cú chờ mà người ta thật sự trải qua.

## Tự kiểm tra

1. Hoá đơn model hằng tháng của bạn tăng gấp đôi trong khi traffic đi ngang. Bạn đo gì trước?
2. Một stakeholder đề nghị chuyển sang model nhỏ hơn, rẻ hơn để cắt chi phí. Bạn đòi hỏi gì trước khi đồng ý?
3. Nhà cung cấp của bạn gặp sự cố. Lẽ ra thứ gì phải được thiết kế từ trước?

<details><summary>Xem đáp án</summary>

1. Thành phần token của mỗi request. Traffic đi ngang nghĩa là số token mỗi request đã tăng — thường là một prompt tích luỹ chỉ dẫn theo thời gian, hoặc một retriever có top-k hay cỡ chunk tăng lên. Hãy đo riêng system prompt, context lấy về, và input người dùng; câu trả lời gần như luôn nằm ở hai cái đầu.
2. Một lượt eval của model nhỏ hơn trên golden set của bạn. Chi phí mỗi token là vô nghĩa nếu thiếu chất lượng, và một model rẻ hơn nhưng sai nhiều hơn 15% sẽ đẻ ra retry, escalation và tải hỗ trợ tốn hơn phần tiết kiệm. Hãy quyết bằng hai con số đặt cạnh nhau: chi phí mỗi request và điểm eval.
3. Một đường dự phòng và một quyết định giảm cấp được đưa ra TRƯỚC sự cố: một nhà cung cấp hoặc model thứ hai sau một router, hàng đợi cho phần việc hoãn được, và một câu trả lời tường minh cho "sản phẩm làm gì khi model không dùng được?" — giảm cấp êm, xếp hàng, hay báo lỗi rõ ràng. Quyết định điều đó trong lúc đang sự cố sẽ cho ra phiên bản tệ nhất của nó.

</details>

## Điều cần nhớ

- API-first mặc định; self-host chỉ khi volume hẹp bền vững, residency, hay sàn latency — và route lai: frontier cho 20% khó, nhỏ-đã-tune cho 80% thường nhật.
- Chi phí có ba đòn bẩy theo thứ tự — rút ngắn (kèm prefix caching), cache (exact + semantic), hạ cỡ (kèm eval) — cộng tag cost theo feature và quota chống chạy hoang.
- Latency tách thành first-token (stream — cú chữa miễn phí) và thời gian pipeline (song song hoá chuỗi, batch phần không-tương-tác ở nửa giá).
- Provider là một dependency: timeout, backoff, idempotency, queue cho spike, và đường degradation quyết sẵn — đo, tag, và eval như mọi thứ khác trong series.

*Tiếp theo — Phần 14: Senior AI Engineer: kiến trúc, security, trách nhiệm — hồi kết của series.*
