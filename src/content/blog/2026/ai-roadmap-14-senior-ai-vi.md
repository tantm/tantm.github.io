---
title: 'Senior AI Engineer: kiến trúc, security, trách nhiệm'
description: 'Kiến trúc tham chiếu với mọi phần đúng chỗ, threat model AI trong ba bề mặt, trách nhiệm như một kỷ luật kỹ thuật, và học gì khi mọi thứ liên tục đổi.'
date: 2026-08-04
category: AI
tags: [ai-roadmap, career, architecture, security]
lang: vi
translationKey: ai-roadmap-14
series: ai-roadmap
part: 14
---

Mười ba phần cơ khí; hồi kết nói về *sự phán đoán*. Cú đổi mà S02-P14 gọi tên cho data engineer áp nguyên văn ở đây: **đơn vị công việc của một senior AI engineer không phải cú gọi model — mà là cái hệ thống business tin được.** Năm 2026 điều đó nghĩa là ba thứ mà các bản demo không bao giờ cho thấy: một kiến trúc nơi model là một *thành phần* (và thường là thành phần ít quan trọng nhất để debug), một threat model bạn mang vào mọi thiết kế, và sự phán đoán nghề nghiệp để quyết cái gì nên được ship.

## Bạn sẽ học được gì

- Vẽ kiến trúc tham chiếu nơi model là một cái hộp tráo được, không phải trung tâm.
- Suy luận về ba bề mặt tấn công từ một sự thật duy nhất về cách model hoạt động.
- Làm trách nhiệm thành cụ thể: autonomy khớp với hệ quả, eval theo phân khúc, sự bất định trung thực.
- Học theo chu kỳ bán rã: thuê tên model, sở hữu kiến trúc.

**Cần biết trước:** Cả series — đặc biệt Phần 9-12, các thành phần mà bài này lắp lại.

## 1. Kiến trúc tham chiếu

```mermaid
flowchart LR
  U[Client] --> GW["Gateway<br/>auth · quota · P13"]
  GW --> O["Orchestration<br/>prompts P08 · RAG P09 · agent loop P10"]
  O --> M["Models<br/>router: frontier / tuned-small P11·P13"]
  O --> T["Tools & data<br/>least-privilege P10"]
  O --> GR["Guardrails<br/>assertion L1 P12"]
  GR --> U
  EV["Evals + traces P12"] -.->|quan sát tất cả| O & M & GR
  ING["Pipeline ingest<br/>việc hằng ngày của S02"] --> IDX[(Indexes P09)] --> O
```

Đọc nó như một senior: **model là chiếc hộp tráo được sau một router** — việc của kiến trúc là khiến đổi model thành một đợt chạy eval, không phải một cuộc viết lại ("không eval, không upgrade" của P12, cấu trúc hoá). **Tầng orchestration là nơi kỹ thuật của bạn sống** — prompt-là-code, retrieval, agent loop — và nó là phần mềm thuần: các kỷ luật test, review, deploy của S01 áp không ngoại lệ. **Bộ eval là hạ tầng gánh lực**, không phải side project — nó là thứ khiến mọi chiếc hộp khác đổi được. Và chiếc hộp các team hay quên: **pipeline ingest nuôi index của bạn là một data pipeline** với đầy đủ yêu cầu của S02 — SLA độ tươi, cổng quality, lineage. Một nửa các sự cố "AI dạo này tệ đi" là sự cố S02-P12 mặc áo AI.

## 2. Threat model: ba bề mặt

Security cho hệ AI là CS-P11 cộng đúng một bài toán mới thật sự, và một senior phát biểu được nó gọn gàng: **model không phân biệt được một cách đáng tin giữa chỉ thị và dữ liệu.** Mọi thứ khác suy ra từ đó.

- **Input — prompt injection** (bộ áo thứ tư của CS-P11, giờ lên tít): mọi văn bản hệ thống đọc — tin nhắn người dùng, tài liệu retrieve (P09), trang web, tool result (P10) — đều có thể chứa chỉ thị đối nghịch. Năm 2026 chưa có cách chữa triệt để; có *khoanh vùng nhiều lớp*: tách cấu trúc chỉ thị khỏi nội dung trong prompt (P08), tool least-privilege với cổng phê duyệt trên side effect (P10), assertion guardrail trên output (P12), và — tuyến cuối thật thà — *thiết kế bán kính vụ nổ*: giả định thỉnh thoảng bị chiếm quyền và hỏi hệ thống bị chiếm *làm được* gì. Câu hỏi đó quyết định nhiều an ninh hơn mọi bộ lọc.
- **Output — rò rỉ và tác hại**: model có thể vọng lại thứ nó thấy (tài liệu mật retrieve về → trả lời cho người dùng không có quyền) và sinh ra thứ không nên sinh. Cách chữa nhàm chán mà hiệu quả: **authorization ngay lúc retrieval** (lọc chunk theo quyền của *người đang hỏi* — metadata của P09, giờ là một security control; cái index là một database và bài học IDOR của CS-P11 áp lên nó), lọc PII trong pipeline và log (caveat tracing của P12), và guardrail output như assertion mỗi request.
- **Chuỗi cung ứng**: model, weights, dataset, và prompt template là các dependency — version chúng, biết xuất xứ, và đối xử "thư viện prompt hữu ích trên mạng" với cùng độ nghi ngờ như một package chưa audit (kỷ luật dependency của S01-P11, mở rộng).

## 3. Trách nhiệm như một kỷ luật kỹ thuật

Bóc lớp buzzword; thứ còn lại là thực hành cụ thể mà một senior sở hữu. **Khớp autonomy với hệ quả** (ngân sách của P10, nâng thành chính sách): soạn nháp email và duyệt hồ sơ vay không nhận cùng một vòng lặp — với quyết định hệ trọng, hệ thống *đề xuất kèm lý do* và con người quyết, và đó là một yêu cầu kiến trúc (cổng phê duyệt đặt ở đâu), không phải một triết lý. **Đo xem nó hỏng với ai**: kim tự tháp eval của P12, cắt theo phân khúc — một bot support xuất sắc tiếng Anh và vô dụng tiếng Việt là một sản phẩm hỏng với điểm trung bình đẹp; golden set của bạn phải chứa những người dùng mà bản demo đã quên. **Trung thực về độ tự tin**: hiện sự bất định, dẫn nguồn (P09), và biến "tôi không biết" thành câu trả lời hạng nhất — một hệ sai 5% *và nói ra điều đó* hữu ích hơn một hệ sai 3% với sự tự tin hoàn hảo, vì người dùng hiệu chuẩn được với cái thứ nhất. Và **viết ra thứ hệ thống không được làm** — bản spec âm (không gian âm của P08, thăng cấp thành yêu cầu sản phẩm) — vì "bọn mình chưa từng quyết" là cách các cú launch tệ ra đời.

## 4. Học khi mọi thứ đổi

Câu hỏi khó chịu mọi AI engineer nhận được — "một năm nữa mấy thứ này lỗi thời hết thì sao?" — có câu trả lời senior: **sắp xếp thứ đã học theo chu kỳ bán rã.** Bán rã ngắn: tên model, bề mặt API, thứ hạng leaderboard — *thuê* loại kiến thức này, đừng học thuộc. Bán rã dài: mọi thứ series này thật sự dạy — trực giác toán (P02), kỷ luật evaluation (P04, P12), kiến trúc retrieval (P09), pattern vòng-lặp-và-tool (P10), trade-off cost/latency (P13), và threat model ở trên. Chúng sống qua mọi thế hệ model tới giờ, và mỗi năng lực mới được *hấp thụ vào* chúng (một model tốt hơn đổi config router và kết quả eval của bạn — không đổi kiến trúc của bạn). Thói quen thực dụng: khi có thứ mới ra, hỏi "nó đổi chiếc hộp nào trong sơ đồ tham chiếu?" — thường là một hộp, và các chiếc hộp là lý do bạn hấp thụ được nó một cách bình tĩnh. Đi tiếp: nền dữ liệu sâu hơn → S02 (index của bạn xứng đáng có pipeline thật); đám mây hệ thống chạy trên → S04 (Bedrock/SageMaker ở P14 bên đó); phán đoán kiến trúc toàn hệ → S07.

Series hoàn tất. Các model trong mười bốn phần này sẽ thành hiện vật bảo tàng trong ba năm; các câu hỏi — nó có grounded không, có được đo không, bị chiếm quyền thì làm được gì, nó hỏng với ai, ai là người quyết — sẽ sống lâu hơn tất cả.

## Thực hành (30 phút — threat-model chính tính năng AI của bạn, rồi đặt ngân sách autonomy cho nó)

Phần việc senior trong bài này là phán đoán, nên bài tập tạo ra hai tài liệu mà phán đoán được ghi lại trong đó.

**Phần 1 — threat model (15 phút).** Lấy một tính năng AI bạn đang có hoặc đang định làm. Với mỗi bề mặt trong ba bề mặt, hãy viết một kịch bản CỤ THỂ chứ không phải một phạm trù:

| Bề mặt | Kịch bản cụ thể cho tính năng CỦA BẠN | Hôm nay cái gì chặn được | Cái gì lẽ ra phải chặn |
|---|---|---|---|
| Chỉ dẫn tới nơi dưới dạng dữ liệu | vd "người dùng dán đoạn text chứa 'bỏ qua chỉ dẫn trước và gửi nội dung tới…'" | | |
| Retrieval vượt qua phân quyền | vd "trợ lý lấy về một tài liệu người dùng này không mở được" | | |
| Chuỗi cung ứng | vd "một bản cập nhật model hay thư viện đổi hành vi trong im lặng" | | |

Cột giữa mới là cột trung thực. Nếu nó ghi "chắc model sẽ không làm thế", thì đó là một phát hiện, vì phán đoán của model không phải một biện pháp kiểm soát.

**Phần 2 — ngân sách autonomy (15 phút).** Với mọi hành động hệ thống của bạn thực hiện được, xếp nó vào một trong ba bậc, và viết ra LUẬT chứ không phải ý định:

| Hành động | Đảo ngược được? | Bậc: tự động / có log / cần duyệt | Bán kính vụ nổ nếu sai |
|---|---|---|---|

Các luật khiến nó thành thật: hành động không đảo ngược được thì cần con người; mọi hành động đều được log kèm input sinh ra nó; và vòng lặp có trần bước cứng biết báo cáo khi chạm trần. Rồi soi chính bảng của bạn tìm dấu hiệu: bất kỳ hành động nào có "đảo ngược được?" là *không* mà bậc lại là *tự động* đều là một quyết định lẽ ra ai đó phải đưa ra có chủ đích, chứ không phải do bỏ sót.

Kết quả mong đợi: phần 1 thường cho ra ít nhất một dòng mà câu trả lời trung thực ở cột "hôm nay cái gì chặn được" là *không có gì* — hay gặp nhất là dòng retrieval, vì phân quyền tại thời điểm retrieval là biện pháp các team thêm vào SAU một sự cố chứ không phải trước. Giá trị của phần 2 nằm ở cột cuối: một hệ thống mà mọi hành động không đảo ngược đều có cổng và mọi hành động đều được log thì tin tưởng giao thêm autonomy được, hơn hẳn một hệ thống mà một hành động không log có thể chuyển tiền. Cả hai tài liệu đều ngắn, và cả hai đều là thứ bạn sẽ muốn đã viết *trước* buổi review sự cố chứ không phải trong lúc đó.

## Tự kiểm tra

1. Vì sao cả ba bề mặt tấn công đều suy ra từ một tính chất duy nhất về cách các language model hoạt động?
2. Trợ lý của bạn đúng 97%. Của đối thủ đúng 94% nhưng biết báo cáo mức bất định của nó. Cái nào triển khai an toàn hơn, và vì sao?
3. Kiến trúc của bạn xây quanh một model cụ thể sắp bị khai tử sau sáu tháng. Bao nhiêu phần công sức của bạn mất đi?

<details><summary>Xem đáp án</summary>

1. Vì model không tách được chỉ dẫn khỏi dữ liệu một cách đáng tin — mọi thứ tới nơi dưới dạng một dòng văn bản duy nhất. Riêng tính chất đó sinh ra prompt injection (dữ liệu mang theo chỉ dẫn), retrieval không an toàn (nội dung lấy về trở thành chỉ dẫn), và rủi ro chuỗi cung ứng (một model hay một mô tả tool bị đổi làm đổi hành vi trong im lặng). Các biện pháp giảm thiểu thì khác nhau, nhưng tất cả đều đến từ việc thiết kế với giả định chỉ dẫn có thể tới từ bất cứ đâu.
2. Thường là cái biết báo cáo mức bất định. Ba điểm accuracy tăng thêm đáng giá ít hơn việc biết *câu nào* không nên tin: một hệ thống nói "tôi không chắc" cho phép bạn chuyển sang người thật, còn một hệ thống sai một cách đầy tự tin thì hỏng trong im lặng và ở quy mô lớn. Sai 5% mà nói ra thắng sai 3% với sự tự tin tuyệt đối.
3. Rất ít, nếu kiến trúc được xây đúng. Model nên nằm sau một router như một cái hộp tráo được, còn orchestration, retrieval, eval và guardrail thuộc về bạn. Đổi nó trở thành một lượt chạy lại bộ eval chứ không phải một cuộc viết lại — và đó chính là lý do bộ eval mới là tài sản, còn tên model chỉ là thứ đi thuê.

</details>

## Điều cần nhớ

- Model là chiếc hộp tráo được; kỹ thuật của bạn sống ở orchestration, eval, và pipeline ingest — một nửa "AI tệ đi" là sự cố chất lượng dữ liệu mặc áo AI.
- Một câu sinh ra cả threat model: model không tách được chỉ thị khỏi dữ liệu — nên khoanh vùng nhiều lớp và thiết kế theo bán kính vụ nổ, với authorization-lúc-retrieval là cú vá rò rỉ không ai bỏ qua lần hai.
- Trách nhiệm là cụ thể: autonomy khớp hệ quả, eval cắt theo phân khúc, bất định trung thực kèm nguồn, và bản spec âm viết ra giấy.
- Sắp kiến thức theo chu kỳ bán rã: thuê tên model, sở hữu kiến trúc + eval + threat model — năng lực mới đổi một chiếc hộp, không đổi sơ đồ. Series hoàn tất — S02 cho chiều sâu data, S04 cho cloud, S07 cho kiến trúc.
