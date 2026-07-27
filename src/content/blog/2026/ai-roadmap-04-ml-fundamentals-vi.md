---
title: 'ML fundamentals: học, đánh giá, đừng overfit'
description: '"Học" thực chất là gì, vì sao accuracy nói dối, precision vs recall là một quyết định business, và overfitting — căn bệnh mọi model đều mắc.'
date: 2026-07-30
category: AI
tags: [ai-roadmap, ml, evals]
lang: vi
translationKey: ai-roadmap-04
series: ai-roadmap
part: 4
---

Bạn đã có trực giác toán (Phần 2) và bàn thợ (Phần 3). Phần này là vòng lặp lõi của chính machine learning — và cố tình không phải một catalog thuật toán. Model đến rồi đi; **kỷ luật đánh giá chúng một cách trung thực là vĩnh viễn**, và đó chính xác là thứ kỷ luật sẽ quay lại, mặc bộ đồ sang hơn, khi Phần 12 đánh giá LLM app.

## "Học" thực chất là gì

Bóc lớp huyền bí: supervised learning là **fit một hàm vào các ví dụ**. Bạn cho máy xem các dòng (features → đáp án đã biết), nó chỉnh tham số (các matrix của Phần 2) để đoán bớt sai đi (gradient descent của Phần 2), và bạn hy vọng cái hàm đã fit chạy được trên những dòng nó *chưa từng thấy*.

Mệnh đề cuối là toàn bộ cuộc chơi. Fit dữ liệu đang có thì dễ — một bảng tra làm được hoàn hảo. **Tổng quát hoá** sang dữ liệu của ngày mai mới là thứ duy nhất có người trả tiền. Mọi kỷ luật trong bài tồn tại để trả lời một câu: *model của mình đang thật sự tổng quát hoá, hay chỉ học vẹt?*

## Kỷ luật 1 — Baseline trước, thông minh sau

Trước mọi model, tính cái predictor ngu nhất có thể: đoán lớp đa số, đoán giá trị hôm qua, đoán trung bình.

```python
from sklearn.dummy import DummyClassifier
base = DummyClassifier(strategy="most_frequent").fit(X_tr, y_tr)
print(base.score(X_te, y_te))   # churn 5%? đoán "không churn" là được 95%
```

Hai món quà: model thật của bạn giờ có một con số để vượt (model gian lận 97% accuracy trông oách cho tới khi baseline là 98%), và cuộc nói chuyện với stakeholder có sàn ("model của ta hơn đoán-bừa-là-không 12 điểm"). Bỏ qua baseline là cách các team ăn mừng những model không làm gì theo đúng nghĩa đen.

## Kỷ luật 2 — Accuracy nói dối; đọc confusion matrix

Với lớp mất cân bằng (gian lận, churn, hàng lỗi — tức đa số bài toán đáng tiền), accuracy là metric phù phiếm. Bức tranh trung thực là **confusion matrix** — và từ nó, hai con số mang *nghĩa business*:

- **Precision** — trong mọi thứ tôi gắn cờ, bao nhiêu là thật? (Precision thấp = kêu sói: analyst chết đuối trong báo động giả.)
- **Recall** — trong mọi thứ có thật, tôi bắt được bao nhiêu? (Recall thấp = lính gác ngủ: gian lận đi ngang qua.)

Chúng đánh đổi với nhau qua **ngưỡng quyết định**: model xuất ra xác suất (distribution của Phần 2), và *bạn* chọn chỗ cắt. Hạ ngưỡng → bắt nhiều hơn (recall ↑), gắn cờ rác nhiều hơn (precision ↓). Nên câu hỏi đúng không bao giờ là "0.5 có ổn không?" mà là **"ở đây sai lầm nào đắt hơn?"** — chặn nhầm khách thật, hay bỏ lọt kẻ gian? Đó là một quyết định business khoác áo toán, và làm nó tường minh là phần lớn của nghề. (**F1** nén cặp số thành một khi bạn phải xếp hạng model; báo cả ba khi con người ra quyết định.)

## Kỷ luật 3 — Overfitting: căn bệnh mọi model đều mắc

Model overfit đã học thuộc nhiễu của tập train thay vì pattern của nó: xuất sắc trên dữ liệu đã thấy, vô dụng trên dữ liệu chưa thấy. Phép chẩn đoán đẹp vì đơn giản — **so điểm train với điểm test**:

| Train | Test | Chẩn đoán |
|---|---|---|
| 99% | 71% | **Overfitting** — học vẹt; đơn giản hoá hoặc kiếm thêm dữ liệu |
| 74% | 72% | Fit khoẻ mạnh — khoảng cách 2 điểm là trung thực |
| 61% | 60% | **Underfitting** — model quá đơn giản so với pattern |

Các núm vặn, theo thứ tự nên với tới: **dữ liệu nhiều/tốt hơn** (thắng sự khôn khéo thường xuyên đến phát ngượng), **model đơn giản hơn hoặc bớt feature**, và **regularization** — khoản phạt cho tham số lớn, nói với model "tuyên bố phi thường cần bằng chứng phi thường" (chính là `C` trong `LogisticRegression` của Phần 3, `max_depth` của cây). Và nhớ từ Phần 3 rằng **leakage là tổng quát hoá giả**: điểm test nhiễm thông tin rò rỉ sẽ hiện khoảng cách khoẻ mạnh trong khi nói dối về cả hai con số.

## Kỷ luật 4 — Tiêu test set như đồng bạc cuối cùng

Bạn chỉnh ngưỡng, thử feature, vặn regularization — mỗi lần lại liếc điểm test. Xin chúc mừng: bạn đang *fit test set bằng tay*, mỗi lần một quyết định. Setup chuyên nghiệp:

- **Cross-validation cho lúc phát triển**: chia train thành k phần, xoay vòng validation, lấy trung bình — mọi quyết định tuning đọc điểm CV, không bao giờ đọc test set (`cross_val_score(pipe, X_tr, y_tr, cv=5)`).
- **Test set được chạm đúng một lần**, ở cuối, để báo con số cuối cùng. Chạm hai lần, nó thành validation set; chạm hằng tuần, nó thành training set kiểu vòng vo.

Thói quen này scale lên tận đỉnh: các bộ eval LLM của Phần 12 mục ruỗng vì đúng lý do này khi prompt bị tune ngay trên chúng.

## Checklist fundamentals

Mọi dự án supervised, cùng sáu dòng: cắt dữ liệu trung thực trước (theo thời gian, không leak — Phần 3) → baseline → chọn metric bằng câu hỏi *sai lầm nào đắt* → train đơn giản trước khi cầu kỳ → chẩn đoán bằng khoảng cách train/test → tune trên CV, báo cáo trên test set chưa từng chạm. Chín mươi phần trăm các câu chuyện "model fail ngoài production" vi phạm một trong sáu dòng này.

## Điều cần nhớ

- Học = fit; tổng quát hoá = sản phẩm. Mọi kỷ luật ở đây đều để phát hiện học vẹt giả dạng tài năng.
- Baseline trước — model không có nghĩa nếu thiếu một con số ngu để vượt.
- Precision vs recall là quyết định business về sai lầm nào đắt hơn; ngưỡng là nơi bạn mã hoá nó.
- Chẩn đoán bằng khoảng cách train/test; tune trên cross-validation; tiêu test set đúng một lần.

*Tiếp theo — Phần 5: Deep learning với PyTorch, thực dụng.*
