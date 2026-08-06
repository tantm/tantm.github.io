---
title: 'Python ML stack: numpy → scikit-learn'
description: 'Bốn lớp, học thật thà: numpy là tư duy vector hoá, pandas là lao công dữ liệu, notebook có kỷ luật, và pipeline scikit-learn khiến leakage khó xảy ra.'
date: 2026-07-29
category: AI
tags: [ai-roadmap, python, ml]
lang: vi
translationKey: ai-roadmap-03
series: ai-roadmap
cover: images/s03-p03-hero.png
part: 3
---

![Bàn thợ bốn tầng — và pipeline nằm trên kệ trên cùng](images/s03-p03-concept1.png)

Phần 2 cho bạn bốn trực giác toán. Phần này lắp cái bàn thợ nơi chúng trở thành thứ chạy được: numpy, pandas, notebook, và scikit-learn. Mục tiêu không phải du lịch công cụ — mà là *kỷ luật của stack* mà Phần 4 (ML fundamentals) sẽ mặc định bạn có, thứ tách "từng chạy một tutorial" khỏi "tôi tin kết quả của chính mình."

## Bạn sẽ học được gì

- Tư duy theo mảng với numpy: shape, broadcasting, mask — vector hoá thay cho loop.
- Chạy nghi thức soi pandas cố định để bắt dữ liệu bẩn trước khi nó chạm vào model.
- Giữ notebook trung thực bằng ba luật, để kết quả tái lập được.
- Dựng pipeline scikit-learn khiến leakage — con bug thầm lặng phổ biến nhất của ML — khó xảy ra về mặt cấu trúc.

**Cần biết trước:** Phần 2 (bốn trực giác toán — nhất là "điểm trong không gian"). Python cơ bản; thói quen type-ở-biên-giới của S02-P03 là lợi thế nhưng không bắt buộc.

## 1. numpy: ngừng viết loop trên các con số

Phần 2 nói neural network là chồng máy-matrix. numpy là nơi bạn *cảm* điều đó:

```python
import numpy as np

emb = np.random.rand(10_000, 768)     # 10k embedding (các điểm-trong-không-gian của Phần 2)
q   = np.random.rand(768)

# cosine similarity với CẢ 10k cùng lúc — không một vòng loop Python:
sims = emb @ q / (np.linalg.norm(emb, axis=1) * np.linalg.norm(q))
top5 = np.argsort(sims)[-5:][::-1]    # retrieval, trong bốn dòng (chào RAG)
```

Cú chuyển não là **vector hoá**: mô tả phép toán trên *cả mảng* và để C đã compile lo vòng loop (CS Foundations P2 giải thích vì sao nhanh ~100×). Ba ý phủ hết việc hằng ngày: **shape** (`(10000, 768) @ (768,) → (10000,)` — đọc shape như đọc câu văn là đa số bug tan biến), **broadcasting** (`emb - emb.mean(axis=0)` kéo giãn mảng nhỏ phủ lên mảng lớn), và **boolean mask** (`sims[sims > 0.8]`). Khi gặp PyTorch ở Phần 5, nó sẽ là numpy có gradient và GPU — lớp này chuyển giao nguyên khối.

## 2. pandas: lao công đi trước khoa học

Mọi dataset ML đều đến trong tình trạng bẩn, và pandas là nơi bạn nhìn thẳng vào mắt nó. Workflow quan trọng là một nghi thức khai cuộc cố định, không phải tour API:

```python
df = pd.read_csv("churn.csv")
df.shape, df.dtypes                 # mình đang cầm cái gì?
df.isna().sum()                     # lỗ thủng ở đâu?
df["plan"].value_counts(dropna=False)   # cột này THẬT SỰ chứa gì?
df.describe()                       # range có tỉnh táo không? (age = -1? amount = 9e9?)
```

Mười phút nghi thức này mỗi dataset chặn được các màn bẽ mặt ML kinh điển: cột `object` bí mật là số-có-dấu-phẩy, cột "boolean" có ba giá trị, các khách hàng trùng lặp sẽ leak xuyên qua đường cắt train/test (thói quen type-ở-biên-giới của S02-P03 áp nguyên xi vào đây). Một heuristic thật thà từ giới DE: **sửa vấn đề dữ liệu ở lớp này, đừng sửa bên trong model** — model được train quanh dữ liệu bẩn là thể chế hoá cái bẩn.

## 3. Notebook, có kỷ luật

Notebook là siêu năng lực của ML và cũng là hiện trường vụ án. Siêu năng lực: thấy một distribution *ngay bây giờ*, lặp trong vài giây. Vụ án: trạng thái ẩn — các cell chạy sai thứ tự cho tới khi notebook nói dối về thứ nó tính. Ba luật giữ được sức mạnh mà không dính lời nói dối:

1. **"Restart & Run All" phải pass trước khi tin bất cứ điều gì** — phiên bản notebook của bài test chạy-lại từ S02-P03.
2. **Config và seed ở cell đầu tiên** (`SEED = 42`, path, param) — tái lập được là chuyện expectation-trên-nhiều-lần-thử của Phần 2, không phải xa xỉ phẩm.
3. **Cho code ổn định tốt nghiệp ra ngoài**: hàm cleaning nào sống sót ba phiên làm việc thì chuyển vào module `.py` để notebook import. Notebook để *khám phá*; module để *giữ lại*.

## 4. scikit-learn: bộ API dạy ML

scikit-learn xứng đáng chỗ đứng không phải vì có đủ mọi model, mà vì nó mã hoá workflow của ML vào một ngữ pháp lặp lại — `fit` / `predict` / `transform` — và một object lặng lẽ chặn sai lầm phổ biến nhất của ngành:

```python
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2,
                                          random_state=42, stratify=y)

pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
pipe.fit(X_tr, y_tr)                  # scaler CHỈ HỌC mean/std trên train
print(pipe.score(X_te, y_te))
```

Object pipeline chính là toàn bộ bài học. Scale *trước khi* split là scaler đã nhìn thấy thống kê của test set — con số accuracy của bạn giờ là một lời nói dối nhỏ (**leakage**, sát thủ thầm lặng của Phần 2, trong bộ áo phổ biến nhất). Pipeline biến thứ tự đúng thành cấu trúc: mọi bước tiền xử lý fit trên train, áp mù lên test. Ý tưởng này — *model artifact bao gồm cả tiền xử lý của nó* — quay lại ở quy mô production trong feature platform của S07-P11, nơi cùng luật leakage mang tên "point-in-time correctness."

Hai luật cắt dữ liệu sẽ cứu bạn khỏi đau thật: **stratify** theo label khi lớp mất cân bằng (fraud 2% thì cả hai nửa đều phải chứa fraud), và khi dữ liệu có tính thời gian, **cắt theo thời gian, đừng bao giờ cắt ngẫu nhiên** — đoán tháng trước bằng các dòng của tháng sau là cỗ máy thời gian, không phải model.

## Thực hành (45 phút — lắp trọn bộ stack)

Lấy một dataset tabular công khai bất kỳ (CSV kiểu churn/titanic):

1. **Nghi thức:** chạy bốn dòng soi pandas ở mục 2. Ghi lại hai vấn đề thật bạn tìm thấy (luôn có ít nhất hai).
2. **Lao công:** sửa một vấn đề cho tử tế ở lớp pandas — parse số-có-dấu-phẩy, gộp cột boolean ba giá trị, bỏ dòng trùng.
3. **Pipeline:** dựng pipeline mục 4, lấy điểm test, ghi lại.
4. **Cố tình phá:** dời scaling *lên trước* split (fit scaler trên toàn bộ dữ liệu), chạy lại, so điểm. Rồi bỏ `stratify` và nhìn tỉ lệ lớp trong hai nửa.
5. **Kiểm trung thực:** Restart & Run All từ đầu — số có y hệt không?

Kết quả mong đợi: bản leak ở bước 4 cho điểm *cao hơn* một chút — chính là lời nói dối, thấy bằng mắt mình: model đã mượn thống kê của test set. Bước 5 pass nghĩa là con số của bạn là thật. Cảm nhận leakage làm con số nhúc nhích dạy nhiều hơn mười bài viết — kể cả bài này.

## Tự kiểm tra

1. Vì sao `emb @ q` trên matrix `(10000, 768)` nhanh hơn hàng trăm lần một vòng loop Python làm cùng phép toán?
2. Pipeline của bạn cho 0.94 khi scale trước split, và 0.91 với pipeline đúng. Báo cáo con số nào, và chuyện gì đã xảy ra?
3. Bạn đoán churn tháng tới từ một năm lịch sử user. Cắt dữ liệu thế nào — và vì sao mặc định của `train_test_split` sai ở đây?

<details><summary>Xem đáp án</summary>

1. Vector hoá: numpy đẩy cả phép toán xuống C đã compile (kèm SIMD và bố trí bộ nhớ thân thiện cache) thay vì thông dịch từng phần tử qua bytecode Python — lập luận của CS Foundations P2, đem ra áp dụng.
2. Báo 0.91. Con 0.94 bị leak: scaler fit trên toàn bộ dòng, nên thống kê test set (mean/std) đã lọt vào tiền xử lý lúc train. Con số của pipeline mới là ước lượng trung thực trên dữ liệu chưa thấy.
3. Cắt theo thời gian: train tháng 1–10, validate tháng 11, test tháng 12. Cắt ngẫu nhiên rải các dòng tương lai vào train — model "đoán" quá khứ bằng tương lai, và điểm số sẽ không sống sót khi chạm production.

</details>

## Điều cần nhớ

- numpy là tư duy vector hoá: shape, broadcasting, mask — và chuyển giao nguyên khối sang PyTorch sau này.
- pandas là lớp lao công: nghi thức soi cố định mỗi dataset, và cái bẩn được sửa *tại đó*, không phải trong model.
- Notebook cần ba luật — Restart & Run All, seed lên đầu, code ổn định tốt nghiệp thành module.
- Pipeline của scikit-learn khiến leakage khó về mặt cấu trúc: tiền xử lý chỉ fit trên train; stratify label mất cân bằng; dữ liệu thời gian cắt theo thời gian.

*Tiếp theo — Phần 4: ML fundamentals: học, đánh giá, đừng overfit.*
