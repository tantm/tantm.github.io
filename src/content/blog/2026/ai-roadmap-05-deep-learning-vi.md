---
title: 'Deep learning với PyTorch, thực dụng'
description: 'Khi nào deep learning thật sự thắng ML cổ điển, một training loop trung thực, autograd làm gì giùm bạn, và transfer learning — cái mặc định không ai chịu nhận là mặc định.'
date: 2026-07-31
category: AI
tags: [ai-roadmap, deep-learning, pytorch]
lang: vi
translationKey: ai-roadmap-05
series: ai-roadmap
part: 5
---

Phần 2 hứa rằng neural network là chồng máy-matrix có những cú bẻ cong xen giữa, được train bằng cách đi bộ xuống dốc. Phần này biến câu đó thành thứ chạy được — một training loop thật, chạy một lần, hiểu mãi mãi. Và nó mở đầu bằng câu hỏi mà các tutorial bỏ qua: bạn *có nên* deep learning không đã?

## Bạn sẽ học được gì

- Quyết định thật thà xem bài toán muốn deep learning hay gradient boosting.
- Đọc và viết được vòng lặp training chín dòng mà mọi hệ deep learning đều chạy.
- Giải thích được autograd làm gì hộ bạn, và tránh hai vết sẹo người mới hay dính quanh nó.
- Dùng transfer learning — nước đi mặc định — và debug training bằng cách đọc loss curve.

**Cần biết trước:** Phần 2 (matrix, gradient descent) và Phần 4 (baseline, overfitting, khoảng cách train/validation).

## 1. Khi nào deep learning thật sự thắng

Bảng quyết định thật thà, trước mọi dòng code:

| Dữ liệu của bạn | Với tới | Vì sao |
|---|---|---|
| Tabular (cái CSV churn của Phần 3–4) | Gradient boosting (lớp XGBoost) | Vẫn thắng NN trên đa số bảng, train trong vài giây, tự giải thích tốt hơn |
| Ảnh, âm thanh, text, video | **Deep learning** | Feature không thể chế tác tay; các layer tự học chúng |
| Riêng text năm 2026 | Transformer pretrained (Phần 6–7) | Không ai bắt đầu từ con số không nữa |

Siêu năng lực của deep learning là **representation learning** (model tự phát minh feature từ tín hiệu thô). Khi feature của bạn vốn đã là các cột tử tế, siêu năng lực đó bị lãng phí trong khi chi phí — đói dữ liệu, giờ GPU, độ mờ đục — vẫn ở lại.

Màn bẽ mặt nghề nghiệp cần tránh: ba tuần tune neural network cho một bài toán tabular mà gradient boosting bắt kịp trong một buổi chiều. Kỷ luật baseline của Phần 4, áp cho việc chọn họ model.

## 2. Network tính cái gì

Một mạng nhiều lớp là ít code đến phát ngượng:

```python
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(784, 128),   # máy matrix: 784 → 128 (Phần 2)
    nn.ReLU(),             # cú "bẻ cong" — thiếu nó, 3 lớp sập thành 1
    nn.Linear(128, 64),
    nn.ReLU(),
    nn.Linear(64, 10),     # 10 điểm số, mỗi lớp một điểm
)
```

Mỗi `Linear` là máy-matrix của Phần 2. Mỗi `ReLU` là cú bẻ cong khiến việc xếp chồng có nghĩa — một chồng phép biến đổi thuần tuyến tính sập lại thành một phép tuyến tính, nên phi tuyến chính là *toàn bộ vấn đề*. Đầu ra là 10 điểm thô (**logits**, điểm số lớp chưa chuẩn hoá); softmax biến chúng thành distribution xác suất khi bạn cần.

## 3. Training loop — cả tôn giáo trong chín dòng

Mọi hệ deep learning, từ đồ chơi này tới các LLM tiền tuyến, chạy đúng vòng lặp này:

```python
opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
loss_fn = nn.CrossEntropyLoss()

for xb, yb in train_loader:          # theo batch, không phải cả dataset
    opt.zero_grad()                  # 1. quên gradient của batch trước
    pred = model(xb)                 # 2. forward: đoán
    loss = loss_fn(pred, yb)         # 3. chấm độ sai
    loss.backward()                  # 4. autograd: gradient của loss theo MỌI tham số
    opt.step()                       # 5. bước xuống dốc (người leo núi Phần 2)
```

Dòng 4 là phép màu đáng giải ảo một lần. **Autograd** đã ghi lại mọi phép toán trong lượt forward và tua ngược chúng — chain rule, tự động hoá — để tính mỗi tham số trong hàng nghìn tham số góp bao nhiêu vào sai số. Đây là lý do bạn không bao giờ phải tính đạo hàm bằng tay; lẽ sống của cả framework nằm ở dòng 4.

Hai vết sẹo người mới cần đỡ trước. Quên `zero_grad()` là gradient *cộng dồn* qua các batch: loss loạn xạ mà không gì crash. Và **batch** tồn tại vì hai lý do — dataset không vừa memory, và gradient nhiễu của batch nhỏ thực ra giúp thoát các thung lũng xấu.

## 4. GPU: hai dòng, một cú lừa

```python
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
xb, yb = xb.to(device), yb.to(device)    # dữ liệu cũng phải dọn nhà — lỗi lệch device kinh điển
```

Vì sao đáng quan tâm: máy-matrix chính xác là thứ GPU sinh ra để làm, và mức tăng tốc là 10–100×. Bạn không cần sở hữu GPU — các bậc notebook miễn phí và spot instance phủ đủ mọi thứ trong series này.

Công việc thường nhật của GPU là *giữ cho nó no*. Utilization thấp nghĩa là nút nghẽn nằm ở data loader, không phải model: câu hỏi "đang chờ hay đang tính?", hỏi về silicon.

## 5. Transfer learning: mặc định thực dụng

Train từ đầu cần lượng dữ liệu bạn không có. Mặc định của 2026 là **xuất phát từ model pretrained và thích nghi nó**:

```python
from torchvision import models
model = models.resnet18(weights="IMAGENET1K_V1")   # feature học từ 1.2 triệu ảnh
for p in model.parameters():
    p.requires_grad = False                        # đóng băng phần trích feature
model.fc = nn.Linear(model.fc.in_features, 2)      # đầu mới: 2 lớp của bạn
# train CHỈ cái đầu — vài phút, vài trăm ảnh, accuracy thật
```

Các lớp đầu đã học những feature phổ quát — cạnh, vân — và bạn thuê chúng, chỉ train một cái đầu tí hon trên vài trăm ví dụ của riêng mình.

Hãy ngấm nước đi này thật sâu: nó *chính là* nước đi của prompting và fine-tuning LLM ở phần sau series. **Thích nghi một gã khổng lồ pretrained; không bao giờ bắt đầu từ số không.** Cả nền kinh tế AI hiện đại là pattern này ở quy mô tăng dần.

## 6. Debug training: đọc nhật ký độ cao

Phần 2 gọi đường loss là nhật ký độ cao của người leo núi. Các hoa văn cần nhận mặt:

- **Loss phẳng từ đầu** → learning rate quá nhỏ, dữ liệu chưa shuffle, hoặc một con bug (label lệch hàng là ca kinh điển).
- **Loss nổ / NaN** → learning rate quá lớn; người leo núi đang nhảy vọt qua các thung lũng.
- **Loss train giảm, loss validation tăng** → overfitting của Phần 4, diễn trực tiếp trên sân khấu; dừng sớm hoặc regularize (dropout là phiên bản neural-network của khoản phạt đó).
- **Bài test đầu tiên tốt nhất cho mọi pipeline mới**: cố tình overfit *một batch tí hon* — model không kéo nổi loss về ~0 trên 32 ví dụ thì đường ống hỏng, không phải hyperparameter. Cú kiểm tra tỉnh táo rẻ nhất của deep learning.

## Thực hành (25 phút — chạy vòng lặp, rồi cố tình phá nó)

CPU là đủ, không cần GPU. Bạn sẽ train một mạng thật, rồi tái hiện hai màn thất bại kinh điển của người mới để sau này nhận mặt được:

```python
import torch, torch.nn as nn
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

X, y = load_digits(return_X_y=True)                    # ảnh 8x8, 10 lớp
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=.25, stratify=y, random_state=0)
Xtr = torch.tensor(Xtr, dtype=torch.float32) / 16      # đưa về 0..1
Xte = torch.tensor(Xte, dtype=torch.float32) / 16
ytr, yte = torch.tensor(ytr), torch.tensor(yte)

def make(): return nn.Sequential(nn.Linear(64,32), nn.ReLU(), nn.Linear(32,10))

def train(model, lr, epochs=30, zero=True):
    opt, loss_fn = torch.optim.AdamW(model.parameters(), lr=lr), nn.CrossEntropyLoss()
    for e in range(epochs):
        if zero: opt.zero_grad()                        # bước 1 của chín dòng
        loss = loss_fn(model(Xtr), ytr)                 # forward + chấm điểm
        loss.backward(); opt.step()                     # autograd + xuống dốc
        if e % 10 == 0: print(f"  epoch {e:>2} loss {loss.item():.3f}")
    acc = (model(Xte).argmax(1) == yte).float().mean().item()
    print(f"  test accuracy {acc:.3f}")

print("A. chạy khoẻ mạnh (lr=1e-2):");      train(make(), 1e-2)
print("B. learning rate quá lớn (lr=5):");  train(make(), 5.0)
print("C. quên zero_grad():");              train(make(), 1e-2, zero=False)

# D. cú kiểm tra tỉnh táo rẻ nhất của deep learning: overfit một batch tí hon
m, tiny_x, tiny_y = make(), Xtr[:32], ytr[:32]
opt, loss_fn = torch.optim.AdamW(m.parameters(), lr=1e-2), nn.CrossEntropyLoss()
for _ in range(300):
    opt.zero_grad(); l = loss_fn(m(tiny_x), tiny_y); l.backward(); opt.step()
print(f"D. loss overfit-32: {l.item():.4f}   (gần 0 = đường ống chạy tốt)")
```

Kết quả mong đợi: lượt A hạ loss đều đặn và đáp xuống khoảng 90% accuracy trên test. Lượt B loss nổ tung hoặc thành NaN — người leo núi nhảy vọt qua các thung lũng, và đó là dáng vẻ của "learning rate quá lớn" nhìn từ bên ngoài. Lượt C mới là kẻ nham hiểm: không crash, không báo lỗi, loss chỉ hành xử kỳ quặc vì gradient cộng dồn qua các bước. Lượt D phải chạm loss gần 0; nếu một pipeline mới của bạn *không* làm được, bug nằm ở đường ống (label, shape, scale) và không lượng hyperparameter nào cứu nổi.

## Tự kiểm tra

1. Team muốn dùng neural network cho một bảng churn 40 cột. Bạn đề xuất gì trước, và điều gì sẽ khiến bạn đổi ý?
2. Training chạy, không lỗi gì, nhưng loss cứ lang thang thay vì giảm. Hai con bug nào trong bài này bạn kiểm trước khi đụng tới learning rate?
3. Bạn có 400 ảnh sản phẩm đã gán nhãn và cần một classifier trước thứ Sáu. Kế hoạch là gì, và thực tế bạn train bao nhiêu phần của model?

<details><summary>Xem đáp án</summary>

1. Đề xuất gradient boosting làm baseline — trên dữ liệu tabular nó thường thắng, train trong vài giây, và tự giải thích tốt hơn. Thứ khiến bạn đổi ý: một cột tín hiệu thô mà bảng không mã hoá được (review dạng text tự do, ảnh), hoặc baseline boosting chạm trần thấp hơn nhu cầu business kèm bằng chứng rằng representation learning sẽ giúp.
2. Thiếu `zero_grad()` (gradient cộng dồn lặng lẽ qua các bước — không gì crash), và label lệch hàng hoặc input chưa scale. Bài test overfit-một-batch phân xử: 32 ví dụ mà không kéo nổi loss về gần 0 thì đó là đường ống, không phải hyperparameter.
3. Transfer learning: lấy một model ảnh pretrained, đóng băng phần trích feature, thay lớp cuối bằng các lớp của bạn, và chỉ train cái đầu đó. Bạn train một phần rất nhỏ số tham số — vài phút trên CPU, accuracy thật từ vài trăm ảnh.

</details>

## Điều cần nhớ

- Deep learning thắng trên tín hiệu thô (ảnh, âm thanh, text) nhờ representation learning; trên bảng, gradient boosting vẫn là baseline trung thực.
- Vòng lặp chín dòng là cả tôn giáo: zero_grad → forward → loss → backward (autograd) → step; batch là tính năng, không phải thoả hiệp.
- Transfer learning là mặc định: đóng băng thân pretrained, train cái đầu nhỏ — đúng nước đi thích-nghi-gã-khổng-lồ mà prompting và fine-tuning lặp lại ở quy mô LLM.
- Debug bằng cách đọc đường loss, và kiểm chứng mọi pipeline mới bằng cú overfit một batch tí hon trước tiên.

*Tiếp theo — Phần 6: Transformer & attention, giải ảo.*
