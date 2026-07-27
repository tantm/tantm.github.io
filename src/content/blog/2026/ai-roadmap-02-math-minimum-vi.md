---
title: 'Lượng toán tối thiểu thực sự cần'
description: 'Vector là mũi tên, matrix là cỗ máy, probability là phép đếm, gradient là đi bộ xuống dốc — bốn ý tưởng đứng sau toàn bộ ML, không một dòng chứng minh.'
date: 2026-07-28
category: AI
tags: [ai-roadmap, math, ml]
lang: vi
translationKey: ai-roadmap-02
series: ai-roadmap
part: 2
---

Toán là nơi phần lớn hành trình tự học AI bỏ mạng — thường là ở tuần thứ ba của một khoá linear algebra thiết kế cho dân chuyên toán. Sự thật giải phóng là đây: để *engineer* hệ thống AI, bạn cần **bốn ý tưởng**, hiểu bằng trực giác, và sự sẵn lòng giao phần số học cho thư viện. Bài này chính là bốn ý tưởng đó. Không chứng minh. Chỉ hình ảnh và hệ quả.

## Ý tưởng 1 — Vector là một điểm; giống nhau là khoảng cách

Vector chỉ là một dãy số — và một dãy số là một **vị trí trong không gian**. `[2, 3]` là một điểm trên mặt phẳng; một embedding 768 số là một điểm trong không gian 768 chiều. Bạn không hình dung nổi 768 chiều; chẳng ai hình dung nổi. Cứ hình dung 2 chiều và tin đại số tự tổng quát hoá.

Phần thưởng là một insight đang vận hành nửa ngành AI hiện đại:

> **Những thứ nghĩa giống nhau nằm gần nhau.**

"Chó" và "cún" → hai điểm cạnh nhau. "Chó" và "hoá đơn" → xa lắc. Embedding chỉ có vậy: một hàm học được cách đặt ngữ nghĩa vào hình học. Và thước đo chủ lực là **cosine similarity** — hai mũi tên có chỉ cùng hướng không? (1 = cùng hướng, 0 = không liên quan, −1 = ngược hướng.)

```python
import numpy as np
def cos_sim(a, b):
    return a @ b / (np.linalg.norm(a) * np.linalg.norm(b))
```

Khi bạn xây RAG ở Phần 9, "retrieval" theo nghĩa đen là "tìm các vector lưu sẵn có cosine similarity cao nhất với vector của câu hỏi". Toàn bộ bí kíp chỉ có thế.

## Ý tưởng 2 — Matrix là cỗ máy biến đổi vector

Matrix trông như một lưới số; hãy nghĩ về nó như một **hàm**: vector vào, vector đã biến đổi ra — xoay, kéo giãn, chiếu, trộn. Nhân với matrix là "cho qua máy". Nhân chuỗi matrix là ghép các máy nối tiếp.

Và đây là cú chốt bạn nên mang theo suốt đời:

> Neural network là một chồng máy-matrix với một cú "bẻ cong" đơn giản (activation) xen giữa — và **training nghĩa là chỉnh các con số bên trong các matrix đó**.

Đó là lý do GPU quan trọng (chúng nhân matrix nhanh khủng khiếp), lý do model đo bằng "parameters" (số lượng con số trong các matrix), và con số "175B" trong tên model đang đếm cái gì. Khi ai đó nói model "đã học được", sự thật đen của nó là: hàng tỷ phần tử matrix vừa được xê dịch.

## Ý tưởng 3 — Probability là phép đếm trung thực

Bạn cần ba khái niệm probability, học hết trong một buổi chiều:

- **Distribution** — kết quả thường rơi vào đâu. Model không trả về đáp án; nó trả về distribution trên các token kế tiếp khả dĩ, và *sampling* chọn từ đó (temperature chính là chỉnh distribution — làm phẳng hay làm nhọn).
- **Conditional probability** — P(mưa | mây đen): niềm tin dịch chuyển khi có bằng chứng. Mọi LLM là một cỗ máy tính P(token kế tiếp | toàn bộ token trước đó). Đọc lại câu này lần nữa: đó là mô tả một dòng chính xác nhất về LLM đang tồn tại.
- **Expectation** — trung bình đường dài. Evals, A/B test, "model đúng 87%" — đều là expectation trên nhiều lần thử, và vì thế một cái demo ấn tượng không chứng minh gì (Phần 12 biến bài học này thành kỷ luật).

Khuyến mãi một sự thật thà: đây cũng là lý do **hallucination không phải bug**. Một cỗ máy sinh "token hợp lý nhất tiếp theo" thì theo cấu tạo sẽ sinh ra những điều sai nghe rất hợp lý. Engineering (RAG, grounding, evals) quản trị nó; toán học nói nó không bao giờ biến mất hẳn.

## Ý tưởng 4 — Gradient descent là đi bộ xuống dốc trong sương mù

Training cần làm model bớt sai. Định nghĩa một **loss** (con số đo độ sai), rồi cải thiện nó:

1. Bạn đứng trên sườn núi mù sương (parameters hiện tại, loss hiện tại).
2. Cảm nhận độ dốc dưới chân — đó là **gradient**: hướng "sai thêm" nhanh nhất.
3. Bước về hướng *ngược lại*. Độ dài bước = **learning rate**.
4. Lặp lại vài triệu lần.

Đó là toàn bộ thuật toán đứng sau mọi thứ, từ linear regression đến các LLM tiền tuyến. Và hai kiểu hỏng kinh điển giờ trở nên hiển nhiên:

- Learning rate quá lớn → bạn nhảy vọt qua các thung lũng, không bao giờ hạ trại (loss zigzag hoặc nổ tung).
- Learning rate quá nhỏ → bạn nhích từng phân mãi mãi (loss gần như đứng im).

Khi bạn nhìn đường loss lúc training ở Phần 5, bạn đang xem nhật ký độ cao của một người leo núi.

## Những thứ bạn dứt khoát KHÔNG cần

- Chứng minh, eigen-các-thứ, measure theory, hay đạo hàm tính tay — autograd đạo hàm giùm bạn.
- Trình thống kê cấp bằng cử nhân — ba ý probability ở trên phủ đủ việc engineering.
- Cảm giác tội lỗi. Bạn có thể (và nên) học sâu hơn về sau — *bị kéo bởi nhu cầu*, không phải bị đẩy bởi tội lỗi. Thiếu đúng thứ toán mình đang cần là một vấn đề đáng mơ ước: nghĩa là bạn đang thực sự build.

## Bài tập 30 phút ăn đứt một học kỳ

Mở notebook: tạo mười điểm 2 chiều cho các từ về động vật và phương tiện (tự bịa toạ độ — coi như trục "kích thước" và "tốc độ"). Tính cosine similarity mọi cặp. Nhìn các cụm hiện ra. Chúc mừng — bạn vừa hiểu embeddings, similarity search và hình học của ngữ nghĩa sâu hơn đa số người hay nói về chúng.

## Điều cần nhớ

- Vector đặt ngữ nghĩa vào hình học; cosine similarity đo "cùng hướng" — động cơ của embeddings và RAG.
- Neural network là chồng máy-matrix; training xê dịch các con số bên trong.
- LLM là P(token kế tiếp | ngữ cảnh); temperature nắn distribution; hallucination là thuộc tính, không phải bug.
- Gradient descent = xuống dốc trong sương mù; đường loss là nhật ký độ cao của người leo núi.

*Tiếp theo — Phần 3: Python ML stack: numpy → scikit-learn.*
