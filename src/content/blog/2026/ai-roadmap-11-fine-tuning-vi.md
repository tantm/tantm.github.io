---
title: 'Fine-tuning & LoRA: khi prompt không còn đủ'
description: 'Cây quyết định giữ bạn trung thực (fine-tune hành vi, không phải kiến thức), vì sao LoRA khiến tuning rẻ đi, và sự thật rằng dataset chính là sản phẩm.'
date: 2026-08-04
category: AI
tags: [ai-roadmap, fine-tuning, llm]
lang: vi
translationKey: ai-roadmap-11
series: ai-roadmap
cover: images/s03-p11-hero.png
part: 11
---

Chiếc thang tới giờ: prompt nó (P08), tiếp đất nó (P09), đưa nó tool (P10). **Fine-tuning** — thật sự cập nhật weight của model trên ví dụ của bạn — là nấc cuối, và là nấc hay bị trèo vì lý do sai nhất. Lý do sai gần như luôn giống nhau: *dạy model các sự kiện*. Đó là việc của RAG. Lý do đúng gói trong một câu: **fine-tune để đổi cách model hành xử; retrieve để đổi thứ model biết.** Phần này là cây quyết định, cơ chế khiến tuning rẻ đi (LoRA), và sự thật kém hào nhoáng rằng dataset chính là sản phẩm.

## Bạn sẽ học được gì

- Đi qua cây quyết định: prompt, retrieve, hay fine-tune — và vì sao thứ tự đó quan trọng.
- Giải thích LoRA đủ để biết nó thay đổi gì và tốn gì.
- Coi dataset là sản phẩm, vì chất lượng thật sự nằm ở đó.
- Version một model đã tune theo cách bạn version một bản deploy.

**Cần biết trước:** Phần 5 (transfer learning — đây là cùng một nước đi ở quy mô LLM), Phần 9 (retrieval) và Phần 4 (đánh giá).

## 1. Cây quyết định

```mermaid
flowchart TB
  A[Xác định khoảng trống chất lượng<br/>KÈM một eval — golden set của P09] --> B{Model thiếu sự kiện /<br/>thông tin bị cũ?}
  B -->|có| RAG[RAG — P09.<br/>Sự kiện sống ngoài weight]
  B -->|không| C{Chỉ dẫn tốt hơn hoặc<br/>few-shot sửa được?}
  C -->|có| P[Prompting — P08.<br/>Lặp, eval, ship]
  C -->|không| D{Hành vi style/format/domain<br/>nhất quán, chứng minh được<br/>bằng vài trăm ví dụ?}
  D -->|có| FT[Fine-tune<br/>nhiều khả năng LoRA]
  D -->|không| E[Model to hơn, hoặc<br/>chẻ nhỏ task — P08]
```

Đọc kỹ node đầu vào: *kèm một eval*. Không có golden set (P09), "prompting không đủ" là một cảm giác, không phải một phát hiện — và kỷ luật của P04 áp nguyên văn: bạn không thể tuyên bố model đã tune tốt hơn nếu chẳng có gì để đo. Các ca thật thà nơi fine-tuning thắng: **hình dạng output nhất quán** (luôn đúng phương ngữ JSON này, đúng format báo cáo cộc lốc này — vượt quá thứ một schema ép được), **giọng điệu/persona ở quy mô lớn** (trả lời support đúng giọng của bạn, không cần style guide 2.000 token mỗi request — tuning như *nén prompt*, thường tự trả tiền cho mình bằng chi phí token, P07), **hành vi domain hẹp** (convention của codebase bạn, bộ nhãn phân loại tài liệu của bạn), và **kinh tế học model nhỏ** — tune một model mở nhỏ làm đúng một việc mà hiện đang cần model API lớn; ở volume cao, đây là business case mạnh nhất của cả danh sách.

## 2. LoRA: vì sao tuning trở nên rẻ

Full fine-tuning cập nhật hàng tỷ weight — kinh tế học GPU của P05 nói bạn sẽ cần phần cứng nghiêm túc và chỗ chứa cho mỗi biến thể. **LoRA** (Low-Rank Adaptation) là cú mẹo đổi cả bài toán: đóng băng hoàn toàn weight pretrained, và tiêm các ma trận nhỏ trainable chạy kèm. Bản năng transfer learning từ P05 — "thích nghi gã khổng lồ, đừng xây lại nó" — đẩy tới cực điểm logic: bạn train **dưới hẳn 1% số tham số** và nhận phần lớn chất lượng của full tuning cho các task nắn hành vi.

Ba hệ quả thực dụng, không cần toán: **rẻ đủ để thử nghiệm** (một GPU tử tế tune được model nhỏ — các biến thể QLoRA đẩy xa hơn bằng cách quantize phần base đóng băng); **adapter là file nhỏ** (megabyte, không phải gigabyte của cả model — version chúng như code, ship biến thể theo từng khách/từng task trên một base chung); và **các API fine-tuning hosted bên dưới thường có hình LoRA** — cùng một mental model dù bạn tự chạy hay đi thuê.

## 3. Dataset chính là sản phẩm

Đây là nơi các dự án fine-tuning thật sự thành hay bại. Model sẽ học *chính xác* thứ ví dụ của bạn dạy — gồm cả mọi thói hư trong đó:

- **Format**: các cặp prompt→completion, mỗi cặp trông y hệt traffic production. Vài trăm ví dụ tốt thắng vài chục nghìn ví dụ cào về cho task hành vi; chất lượng đè bẹp số lượng ở quy mô này.
- **Ví dụ CHÍNH LÀ spec.** Gắn nhãn không nhất quán (hai người chấm cãi nhau về tone) trở thành một model tự tin một cách không nhất quán. Curate như pipeline hoang-tưởng-leakage của P03: dedupe, review tay một mẫu ngẫu nhiên, và giữ một test set mà training không bao giờ thấy — luật "tiêu một lần" của P04, giờ canh bằng ví tiền, vì eval set bị rò khiến tuning trông tuyệt vời cho tới đúng lúc production.
- **Đào log của bạn**: dữ liệu train tốt nhất là traffic thật nơi model lớn (hoặc con người) đã cho câu trả lời đúng — pattern distillation: model lớn làm mẫu, model nhỏ đã tune bắt chước, unit economics cải thiện (hoá đơn của P07, đánh thẳng vào weight).
- **Overfitting quay lại** (P04, luôn luôn): model đã tune có thể đạt điểm tuyệt đối ở format của bạn và *tệ đi* ở mọi thứ khác — catastrophic forgetting. Eval của bạn phải gồm cả prompt tổng quát, không chỉ prompt của task, và bản năng đọc loss curve của P05 áp dụng nguyên vẹn.

Và màn đóng sổ vận hành, đúng tinh thần mọi mục "chạy thật" của series này: một model đã tune là một *deployment* — version base + adapter + dataset cùng nhau (bản năng lineage của S02), chạy lại golden set ở mỗi lần nâng cấp base model (adapter của bạn không tự động chuyển giao), và chuẩn bị tinh thần re-tune khi traffic trôi dạt. Fine-tuning không phải kỳ thi một lần; nó là một pipeline bạn sở hữu (S02-P08 muốn nói chuyện về việc lập lịch cho nó).

## Thực hành (25 phút — dựng dataset và bộ eval, trước khi tiêu tiền cho GPU)

Sai lầm tốn kém là fine-tune trước rồi đo sau. Bài tập này làm đúng thứ tự, và phần lớn không tốn đồng nào.

**Bước 1 — viết bộ eval trước (10 phút).** Chọn một hành vi bạn thật sự muốn (một hình dạng output cố định, một giọng văn của công ty, một phép phân loại hẹp). Tạo 20 ví dụ trong một file, mỗi ví dụ gồm input và output *lý tưởng*. Chia 15 cho train và giữ lại 5, và tuyệt đối không nhìn vào 5 cái giữ lại trong lúc lặp.

```python
import json, random
examples = [
  {"input": "khách báo app crash lúc đăng nhập",
   "output": {"category": "bug", "severity": "high", "team": "platform"}},
  # …19 cái nữa, phủ các ca biên bạn THẬT SỰ gặp, không phải các ca dễ viết
]
random.seed(0); random.shuffle(examples)
train, holdout = examples[:15], examples[15:]
json.dump(train, open("train.json","w")); json.dump(holdout, open("holdout.json","w"))

def score(predict):                       # cùng một bộ chấm cho mọi cách tiếp cận
    ok = sum(predict(e["input"]) == e["output"] for e in holdout)
    return f"{ok}/{len(holdout)}"
```

**Bước 2 — vắt kiệt các lựa chọn rẻ (10 phút).** Chấm ba cách bằng đúng hàm đó: một prompt zero-shot, một prompt kèm ba ví dụ (few-shot), và một prompt có đủ chỉ dẫn cộng schema. Ghi các con số ra.

**Bước 3 — giờ mới quyết (5 phút).** Trả lời bằng cách viết ra: prompt tốt nhất đã đạt ngưỡng chưa? Nếu chưa, nó hỏng ở *hình dạng* (fine-tuning giúp được) hay ở *kiến thức* (retrieval giúp được)? Bản đã tune phải vượt qua con số nào, và trên những ví dụ giữ lại nào?

Kết quả mong đợi: prompt few-shot thường tự nó khép phần lớn khoảng cách, và đó chính là lý do cây quyết định đặt fine-tuning ở cuối — các team bỏ qua bước 1 và 2 hay tốn cả tuần train một model mà một prompt ba ví dụ đã sánh ngang. Khi fine-tuning *thật sự* chính đáng, giờ bạn có hai artifact khiến nó an toàn: một tập giữ lại chưa bao giờ bị tune lên, và một con số có ghi chép mà model đã tune phải vượt. Thiếu hai thứ đó, "cảm giác nó tốt hơn" là bộ đánh giá duy nhất bạn có, và đó không phải một bộ đánh giá.

## Tự kiểm tra

1. Trợ lý của bạn không biết tên các sản phẩm nội bộ của công ty. Fine-tune hay retrieve?
2. Bạn fine-tune một model trên 8.000 ticket hỗ trợ cào về và chất lượng tệ đi. Nguyên nhân khả dĩ là gì?
3. Nhà cung cấp khai tử base model mà adapter của bạn được train trên đó. Bạn ở thế nào, và lẽ ra bạn phải ghi lại những gì?

<details><summary>Xem đáp án</summary>

1. Retrieve. Thiếu sự kiện là vấn đề kiến thức, và kiến thức thì thay đổi — quý sau có sản phẩm mới nghĩa là phải train lại nếu bạn fine-tune, so với thêm một tài liệu nếu bạn retrieve. Fine-tuning dạy *hành vi* (hình dạng, giọng, định dạng); retrieval cung cấp *kiến thức*.
2. Chất lượng dữ liệu. Ticket cào về chứa cả lỗi sai, sự thiếu nhất quán và những câu trả lời lệch chuẩn của mọi người từng viết chúng, và model đã học tất cả một cách trung thành — các ví dụ *chính là* bản đặc tả. Vài trăm ví dụ được tuyển chọn kỹ thường thắng hàng nghìn ví dụ cào.
3. Adapter được train dựa trên một base model cụ thể, nên trọng số không chuyển sang base mới được: bạn train lại và chạy lại bộ eval. Thứ lẽ ra phải ghi lại, version cùng nhau, là định danh base model, adapter, và chính xác dataset — cộng các điểm eval — để việc chạy lại là một bước máy móc chứ không phải một cuộc khai quật.

</details>

## Điều cần nhớ

- Một câu gánh cả quyết định: fine-tune hành vi, retrieve kiến thức — và chỉ bước vào cây khi có eval, không thì "prompting không đủ" chỉ là một cảm giác.
- Các ca thắng là hình dạng output, giọng điệu ở quy mô (nén prompt), hành vi domain hẹp, và kinh tế học model nhỏ — không phải dạy sự kiện.
- LoRA đóng băng base và train adapter tí hon: thử nghiệm rẻ, artifact cỡ megabyte version như code, cùng model dù tự host hay đi thuê.
- Dataset là sản phẩm: vài trăm ví dụ được curate, test set canh bằng ví tiền, distillation đào từ log — và model đã tune là một deployment có re-tune trong tương lai, không phải một lễ tốt nghiệp.

*Tiếp theo — Phần 12: Evals: test hệ thống AI như một kỹ sư.*
