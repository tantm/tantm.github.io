---
title: 'ML fundamentals: học, đánh giá, đừng overfit'
description: '"Học" thực chất là gì, vì sao accuracy nói dối, precision vs recall là một quyết định business, và overfitting — căn bệnh mọi model đều mắc.'
date: 2026-07-30
category: AI
tags: [ai-roadmap, ml, evals]
lang: vi
translationKey: ai-roadmap-04
series: ai-roadmap
cover: images/s03-p04-hero.png
part: 4
---

Bạn đã có trực giác toán (Phần 2) và bàn thợ (Phần 3). Phần này là vòng lặp lõi của chính machine learning — và cố tình không phải một catalog thuật toán. Model đến rồi đi; **kỷ luật đánh giá chúng một cách trung thực là vĩnh viễn**.

## Bạn sẽ học được gì

- Giải thích được "học" nghĩa là gì về mặt cơ học, và vì sao chỉ tổng quát hoá mới đáng kể.
- Dựng baseline trước, để không model nào được tung hô vì làm đúng con số không.
- Chọn precision hay recall bằng câu hỏi sai lầm nào đắt hơn — và đặt ngưỡng mã hoá lựa chọn đó.
- Chẩn đoán overfitting từ khoảng cách train/test, và tiêu test set đúng một lần.

**Cần biết trước:** Phần 3 (bàn thợ scikit-learn và cách cắt dữ liệu không leak). Phần 2 có ích nhưng không bắt buộc.

## 1. "Học" thực chất là gì

Bóc lớp huyền bí: supervised learning là **fit một hàm vào các ví dụ**. Bạn cho máy xem các dòng (features → đáp án đã biết), nó chỉnh tham số (các matrix của Phần 2) để đoán bớt sai đi (gradient descent của Phần 2), và bạn hy vọng cái hàm đã fit chạy được trên những dòng nó *chưa từng thấy*.

Mệnh đề cuối là toàn bộ cuộc chơi. Fit dữ liệu đang có thì dễ — một bảng tra làm được hoàn hảo. **Tổng quát hoá** (chạy được trên dữ liệu model chưa từng thấy) sang dữ liệu của ngày mai mới là thứ duy nhất có người trả tiền. Mọi kỷ luật trong bài trả lời một câu: *model của mình đang thật sự tổng quát hoá, hay chỉ học vẹt?*

## 2. Baseline trước, thông minh sau

Trước mọi model, tính cái predictor ngu nhất có thể: đoán lớp đa số, đoán giá trị hôm qua, đoán trung bình.

```python
from sklearn.dummy import DummyClassifier
base = DummyClassifier(strategy="most_frequent").fit(X_tr, y_tr)
print(base.score(X_te, y_te))   # churn 5%? đoán "không churn" là được 95%
```

Hai món quà: model thật của bạn giờ có một con số để vượt (model gian lận 97% accuracy trông oách cho tới khi baseline là 98%), và cuộc nói chuyện với stakeholder có sàn ("model của ta hơn đoán-bừa-là-không 12 điểm"). Bỏ qua baseline là cách các team ăn mừng những model không làm gì theo đúng nghĩa đen.

## 3. Accuracy nói dối; đọc confusion matrix

Với lớp mất cân bằng (gian lận, churn, hàng lỗi — tức đa số bài toán đáng tiền), accuracy là metric phù phiếm. Bức tranh trung thực là **confusion matrix** (bảng 2×2 đếm số dự đoán đúng và sai theo từng lớp) — và từ nó, hai con số mang *nghĩa business*:

- **Precision** — trong mọi thứ tôi gắn cờ, bao nhiêu là thật? (Precision thấp = kêu sói: analyst chết đuối trong báo động giả.)
- **Recall** — trong mọi thứ có thật, tôi bắt được bao nhiêu? (Recall thấp = lính gác ngủ: gian lận đi ngang qua.)

Chúng đánh đổi với nhau qua **ngưỡng quyết định** (mức xác suất mà trên đó bạn gọi là "có"). Model xuất ra xác suất, và *bạn* chọn chỗ cắt. Hạ ngưỡng thì bắt được nhiều hơn (recall tăng) nhưng gắn cờ rác cũng nhiều hơn (precision giảm).

Nên câu hỏi đúng không bao giờ là "0.5 có ổn không?". Nó là **"ở đây sai lầm nào đắt hơn?"** — chặn nhầm khách thật, hay bỏ lọt kẻ gian? Đó là một quyết định business khoác áo toán. Làm nó tường minh là phần lớn của nghề. (**F1** nén cặp số thành một khi bạn phải xếp hạng model; báo cả ba khi con người ra quyết định.)

![Precision và recall đánh đổi với nhau; ngưỡng là nơi bạn mã hoá sai lầm nào đắt hơn.](images/s03-p04-concept1.png)

## 4. Overfitting: căn bệnh mọi model đều mắc

Model overfit đã học thuộc nhiễu của tập train thay vì pattern của nó: xuất sắc trên dữ liệu đã thấy, vô dụng trên dữ liệu chưa thấy. Phép chẩn đoán đẹp vì đơn giản — **so điểm train với điểm test**:

| Train | Test | Chẩn đoán |
|---|---|---|
| 99% | 71% | **Overfitting** — học vẹt; đơn giản hoá hoặc kiếm thêm dữ liệu |
| 74% | 72% | Fit khoẻ mạnh — khoảng cách 2 điểm là trung thực |
| 61% | 60% | **Underfitting** — model quá đơn giản so với pattern |

Các núm vặn, theo thứ tự nên với tới: **dữ liệu nhiều/tốt hơn** (thắng sự khôn khéo thường xuyên đến phát ngượng), **model đơn giản hơn hoặc bớt feature**, và **regularization** (khoản phạt cho tham số lớn) — nó nói với model "tuyên bố phi thường cần bằng chứng phi thường". Chính là `C` trong `LogisticRegression`, `max_depth` của cây.

Một cảnh báo từ Phần 3: **leakage là tổng quát hoá giả**. Điểm test nhiễm thông tin rò rỉ vẫn hiện ra khoảng cách trông khoẻ mạnh, trong khi nói dối về cả hai con số.

## 5. Tiêu test set như đồng bạc cuối cùng

Bạn chỉnh ngưỡng, thử feature, vặn regularization — mỗi lần lại liếc điểm test. Xin chúc mừng: bạn đang *fit test set bằng tay*, mỗi lần một quyết định. Setup chuyên nghiệp:

- **Cross-validation cho lúc phát triển**: chia train thành k phần, xoay vòng validation, lấy trung bình — mọi quyết định tuning đọc điểm CV, không bao giờ đọc test set (`cross_val_score(pipe, X_tr, y_tr, cv=5)`).
- **Test set được chạm đúng một lần**, ở cuối, để báo con số cuối cùng. Chạm hai lần, nó thành validation set; chạm hằng tuần, nó thành training set kiểu vòng vo.

Thói quen này scale lên tận đỉnh: các bộ eval LLM (Phần 12) mục ruỗng vì đúng lý do này khi prompt bị tune ngay trên chúng.

## 6. Checklist fundamentals

Mọi dự án supervised, cùng sáu dòng: cắt dữ liệu trung thực trước (theo thời gian, không leak) → baseline → chọn metric bằng câu hỏi *sai lầm nào đắt* → train đơn giản trước khi cầu kỳ → chẩn đoán bằng khoảng cách train/test → tune trên cross-validation, báo cáo trên test set chưa từng chạm. Chín mươi phần trăm các câu chuyện "model fail ngoài production" vi phạm một trong sáu dòng này.

## Thực hành (20 phút — xem accuracy nói dối, rồi sửa)

Một file, chỉ cần scikit-learn. Bạn sẽ dựng một bài toán mất cân bằng và bắt quả tang model đạt 95% mà vô dụng:

```python
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

X, y = make_classification(n_samples=4000, weights=[0.95], flip_y=0.02, random_state=0)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, stratify=y, random_state=0)

# 1. Baseline — con số mọi model phải vượt
base = DummyClassifier(strategy="most_frequent").fit(X_tr, y_tr)
print("baseline acc:", base.score(X_te, y_te))

# 2. Model thật — và metric nói thật
clf = LogisticRegression(max_iter=1000).fit(X_tr, y_tr)
print("model acc:", clf.score(X_te, y_te))
print(classification_report(y_te, clf.predict(X_te), digits=2))

# 3. Dời ngưỡng: đổi precision lấy recall một cách có chủ đích
proba = clf.predict_proba(X_te)[:, 1]
for t in (0.5, 0.3, 0.15):
    print(t, classification_report(y_te, (proba > t).astype(int), digits=2).splitlines()[3])

# 4. Cố tình overfit, rồi đọc khoảng cách
from sklearn.tree import DecisionTreeClassifier
deep = DecisionTreeClassifier(max_depth=None).fit(X_tr, y_tr)
print("cây sâu    train:", deep.score(X_tr, y_tr), "test:", deep.score(X_te, y_te))
shallow = DecisionTreeClassifier(max_depth=3).fit(X_tr, y_tr)
print("cây nông   train:", shallow.score(X_tr, y_tr), "test:", shallow.score(X_te, y_te))
print("CV (tín hiệu dev):", cross_val_score(shallow, X_tr, y_tr, cv=5).mean())
```

Kết quả mong đợi: baseline đã đạt khoảng 0.95 — nên con số accuracy nổi bật của model gần như vô nghĩa, và classification report cho thấy recall của lớp 1 mới là thứ thật sự thay đổi. Khi bạn hạ ngưỡng, recall leo lên còn precision tụt xuống; bạn đang *chọn* sẽ mắc sai lầm nào. Cây sâu đạt ~1.00 trên train và thấp hơn hẳn trên test (học vẹt, thấy được trong một dòng), còn cây nông có hai con số sát nhau. Trung bình CV chính là con số bạn dùng để tune — test set nằm im tới tận cuối.

## Tự kiểm tra

1. Model gian lận của bạn báo 97% accuracy. Con số đầu tiên bạn hỏi là gì, và vì sao?
2. Model gắn cờ 200 giao dịch; 30 cái là gian lận thật, và nó bỏ lọt 10 cái khác. Metric nào đang yếu, và dời ngưỡng theo hướng nào sẽ giúp — với cái giá gì?
3. Train 0.99 / test 0.72 so với train 0.61 / test 0.60. Gọi tên từng chẩn đoán và núm vặn đầu tiên bạn với tới.

<details><summary>Xem đáp án</summary>

1. Baseline. Nếu gian lận chiếm 3% số dòng, "luôn nói không" cũng được 97% — model có thể chẳng thêm gì. Accuracy trên dữ liệu mất cân bằng vô nghĩa nếu thiếu một cái sàn để so.
2. Recall đang yếu: nó bắt 30 trên 40 ca thật (75%) trong khi precision là 30/200 (15%). Hạ ngưỡng làm recall tăng — bắt thêm được trong 10 ca bỏ lọt — với cái giá là precision còn thấp hơn, tức analyst nhận thêm báo động giả. Đánh đổi đó đúng hay không tuỳ sai lầm nào đắt hơn.
3. Cái đầu là overfitting (học thuộc nhiễu): với tới dữ liệu nhiều/tốt hơn, model đơn giản hơn, hoặc regularization mạnh hơn. Cái sau là underfitting (model quá đơn giản): với tới model biểu đạt tốt hơn hoặc feature tốt hơn. Cả hai đọc từ *khoảng cách*, không phải từ một con số đơn lẻ.

</details>

## Điều cần nhớ

- Học = fit; tổng quát hoá = sản phẩm. Mọi kỷ luật ở đây đều để phát hiện học vẹt giả dạng tài năng.
- Baseline trước — model không có nghĩa nếu thiếu một con số ngu để vượt.
- Precision vs recall là quyết định business về sai lầm nào đắt hơn; ngưỡng là nơi bạn mã hoá nó.
- Chẩn đoán bằng khoảng cách train/test; tune trên cross-validation; tiêu test set đúng một lần.

*Tiếp theo — Phần 5: Deep learning với PyTorch, thực dụng.*
