---
title: 'Evals & observability cho LLM apps'
description: 'Vì sao demo nói dối, kim tự tháp eval ba tầng, LLM-as-judge mà không tự lừa mình, và tracing biến "nó nói gì đó kỳ kỳ" thành một sự kiện debug được.'
date: 2026-08-04
category: AI
tags: [ai-roadmap, evals, llmops]
lang: vi
translationKey: ai-roadmap-12
series: ai-roadmap
part: 12
draft: true
---

Mỗi phần của series này đều kết bằng cùng một nhịp trống — golden set (P09), tiêu chí xong (P10), test set canh ví tiền (P11) — và phần này là nơi nhịp trống trở thành kỷ luật. Lý do nó quan trọng nằm ở một sự bất đối xứng: **demo cho thấy hệ thống chạy trên các input bạn chọn; production là các input bạn không chọn, mãi mãi.** Phần mềm truyền thống đóng khoảng cách đó bằng test tất định (S01-P09): cùng input, cùng output, assert equals. LLM trả về *các phân phối hợp lý*, nên `assertEqual` chết — và đa số team phản ứng bằng cách ship theo cảm giác. Câu trả lời kỹ thuật là một kim tự tháp test khác.

## Kim tự tháp eval

```mermaid
flowchart TB
  subgraph L3["Tầng 3 — Phán xét (lấy mẫu)"]
    J["LLM-as-judge + người spot-check:<br/>hữu ích, faithful, đúng giọng"]
  end
  subgraph L2["Tầng 2 — Metric theo task (mỗi thay đổi)"]
    T["Golden set: đúng đáp án / đúng chunk /<br/>hoàn thành task — theo P09/P10/P11"]
  end
  subgraph L1["Tầng 1 — Assertion (mỗi request)"]
    A["JSON hợp lệ? Đúng schema? Có citation?<br/>Không PII? Độ dài trong khung?"]
  end
  L1 --> L2 --> L3
```

**Tầng 1 — assertion, rẻ và tất định.** Mặc kệ phần văn xuôi của model, khối thứ vẫn là nhị phân: output parse được theo schema (bản hợp đồng structured-output của P08), citation bắt buộc có mặt (P09), nội dung cấm vắng mặt, độ dài trong khung. Chúng chạy trên *mọi* request production như guardrail, không chỉ trong CI — nước đi validate-tại-biên-giới của S02-P12, áp vào output của model. Một tỷ lệ bất ngờ các sự cố "chất lượng LLM" là lỗi Tầng-1 mặc áo Tầng-3.

**Tầng 2 — metric theo task trên golden set.** Các bộ 30–50 ca bạn đã xây suốt series, chạy ở *mọi thay đổi*: recall@k của retrieval (P09), completion rate của task (P10), độ trung thành format (P11). Chấm điểm tất định ở mọi nơi có thể — exact match, chứa-đúng-ý-chính, qua-được-checker — vì metric tất định không bao giờ cãi lại.

**Tầng 3 — phán xét, nơi rubric sống.** "Câu trả lời có hữu ích không? Có bám nguồn không? Có đúng brand không?" — không regex nào chấm được. Ở đây bạn lấy mẫu (không ai đủ tiền phán xét mọi thứ), và mời quan toà vào.

## LLM-as-judge, mà không tự lừa mình

Dùng một model chấm một model là cách cả ngành scale được evaluation — nhưng chỉ dưới các luật giữ nó trung thực. **Chấm bằng rubric, không bằng cảm giác**: "chấm 1–5 cho faithfulness, 5 = mọi mệnh đề truy được về chunk cung cấp, 1 = mâu thuẫn với chúng" ăn đứt "hãy đánh giá câu trả lời" — bạn đang áp kỷ luật prompt của P08 *lên chính quan toà*. **Ưu tiên pairwise hơn tuyệt đối** khi có thể ("A hay B faithful hơn?") — model kém tin cậy ở thang tuyệt đối và giỏi hơn hẳn ở so sánh; pairwise cũng trả lời thẳng câu hỏi thật của bạn, "prompt mới có thắng prompt cũ không?". **Hiệu chuẩn với con người một lần mỗi rubric**: tự chấm tay 50 ca, đo độ đồng thuận; một quan toà đồng ý với bạn 90% là công cụ scale — một quan toà chưa từng được kiểm là máy sinh số ngẫu nhiên có phong thái tự tin. Và **đừng bao giờ để một họ model tự chấm mình vào production** — self-preference bias là thật; dùng họ model khác hoặc cổng người thật cho quyết định ship.

## Tracing: observability với các trường mới

S04-P10 đưa bạn ba tín hiệu; app LLM thêm các trường đặc thù vào cùng kỷ luật đó. Một **trace** ở đây là cây request đầy đủ: query retrieval → chunk trả về (kèm điểm) → prompt cuối → model/version/params → response → tool call (audit trail của P10) → token và latency từng bước. Khi ai đó báo "nó nói gì đó kỳ kỳ," trace trả lời câu hỏi debug của P09 — *retrieval, prompt, hay model?* — bằng một cái nhìn thay vì một lần tái hiện. Các thói quen kèm theo: **log prompt và completion** (với sự nâng niu PII của CS-P11 — dữ liệu này nhạy cảm từ trong cấu tạo), **gắn tag mọi trace bằng version prompt và version model** (bên dưới), và **canh các metric đặc thù LLM**: chi phí token mỗi request (hoá đơn P07, theo từng feature), p99 latency gồm cả retrieval, tỷ lệ guardrail nổ, và tỷ lệ "tôi không biết" — tỷ lệ từ chối *tăng dần* thường nghĩa là retrieval hỏng ở thượng nguồn, không phải model bỗng khiêm tốn.

## Regression: prompt là code, nên thay đổi được đối xử như deploy

Vòng lặp đầy đủ, lắp từ các mảnh bạn đã sở hữu: prompt và rubric sống trong git có version (P08); mọi thay đổi — chỉnh prompt, đổi cỡ chunk, nâng model — chạy Tầng 1–2 trong CI cộng một mẫu Tầng 3, so *với đương kim* (pairwise, lần nữa); ship theo **staged rollout** (S01-P12: vài phần trăm traffic trước, mắt dán vào metric trace) vì eval offline là cần nhưng chưa đủ; và đổ các thất bại production ngược về golden set — vòng lặp viện-bảo-tàng-sự-cố của S02-P12, nguyên văn: mỗi ca kỳ quặc người dùng báo là một test case tương lai đã có người trả tiền. Nâng cấp model xứng đáng độ hoang tưởng riêng: một model "tốt hơn" mà đảo thứ tự field JSON hay độn dài câu trả lời là một regression *đối với bạn*, mặc kệ leaderboard nói gì. Không eval, không upgrade.

## Điều cần nhớ

- Demo là input được chọn; production thì không — thay assertEqual bằng kim tự tháp: assertion mỗi request, metric task trên golden set, phán xét lấy mẫu.
- LLM-as-judge chỉ scale được evaluation khi có rubric, so sánh pairwise, hiệu chuẩn với người, và không bao giờ để cùng họ model tự chấm cho quyết định ship.
- Trace mang các trường mới — chunk, version prompt/model, token, tool call — để "nó nói gì đó kỳ kỳ" thành một cú tra cứu; canh cost, tỷ lệ từ chối, guardrail như metric hạng nhất.
- Mọi thay đổi eval với đương kim và rollout theo tầng; thất bại production thành ca golden set. Không eval, không upgrade.

*Tiếp theo — Phần 13: LLMOps: serving, cost & latency.*
