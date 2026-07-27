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

## Khi nào deep learning thật sự thắng

Bảng quyết định thật thà, trước mọi dòng code:

| Dữ liệu của bạn | Với tới | Vì sao |
|---|---|---|
| Tabular (cái CSV churn của Phần 3–4) | Gradient boosting (lớp XGBoost) | Vẫn thắng NN trên đa số bảng, train trong vài giây, tự giải thích tốt hơn |
| Ảnh, âm thanh, text, video | **Deep learning** | Feature không thể chế tác tay; các layer tự học chúng |
| Riêng text năm 2026 | Transformer pretrained (Phần 6–7) | Không ai bắt đầu từ con số không nữa |

Siêu năng lực của deep learning là **representation learning** — nó tự phát minh feature từ tín hiệu thô. Khi feature của bạn vốn đã là các cột tử tế, siêu năng lực đó bị lãng phí còn chi phí (đói dữ liệu, giờ GPU, độ mờ đục) thì ở lại. Màn bẽ mặt nghề nghiệp cần tránh: ba tuần tune NN cho một bài toán tabular mà gradient boosting bắt kịp trong một buổi chiều (kỷ luật baseline của Phần 4 lại ra tay).

## Network tính cái gì

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

Mỗi `Linear` là máy-matrix của Phần 2; mỗi `ReLU` là cú bẻ cong khiến việc xếp chồng có nghĩa (một chồng phép biến đổi thuần tuyến tính chỉ là một phép tuyến tính — phi tuyến chính là *toàn bộ vấn đề*). Đầu ra là 10 điểm thô ("logits"); softmax biến chúng thành distribution xác suất của Phần 2 khi bạn cần.

## Training loop — cả tôn giáo trong chín dòng

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

Dòng 4 là phép màu đáng giải ảo một lần: **autograd** đã ghi lại mọi phép toán trong lượt forward và tua ngược chúng (chain rule, tự động hoá) để tính mỗi tham số trong hàng nghìn tham số góp bao nhiêu vào sai số. Đây là lý do Phần 2 nói bạn sẽ không bao giờ tính đạo hàm bằng tay — lẽ sống của cả framework nằm ở dòng 4. Hai vết sẹo người mới cần đỡ trước: quên `zero_grad()` là gradient *cộng dồn* qua các batch (loss loạn xạ, không gì crash); và **batch** tồn tại vì dataset không vừa memory, cộng thêm gradient nhiễu của batch nhỏ thực ra giúp thoát các thung lũng xấu.

## GPU: hai dòng, một cú lừa

```python
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
xb, yb = xb.to(device), yb.to(device)    # dữ liệu cũng phải dọn nhà — lỗi lệch device kinh điển
```

Vì sao đáng quan tâm: máy-matrix của Phần 2 chính xác là thứ GPU sinh ra để làm, và mức tăng tốc là 10–100×. Ghi chú thực dụng: bạn không cần sở hữu GPU (các bậc notebook miễn phí và spot instance — thực đơn giá của S04-P03 — phủ đủ series này), và công việc thường nhật của GPU là *giữ cho nó no* — utilization thấp nghĩa là nút nghẽn nằm ở data loader, không phải model ("đang chờ hay đang tính" của CS-P2, phiên bản silicon).

## Transfer learning: mặc định thực dụng

Train từ đầu cần lượng dữ liệu bạn không có. Mặc định của 2026 là **xuất phát từ model pretrained và thích nghi nó**:

```python
from torchvision import models
model = models.resnet18(weights="IMAGENET1K_V1")   # feature học từ 1.2 triệu ảnh
for p in model.parameters():
    p.requires_grad = False                        # đóng băng phần trích feature
model.fc = nn.Linear(model.fc.in_features, 2)      # đầu mới: 2 lớp của bạn
# train CHỈ cái đầu — vài phút, vài trăm ảnh, accuracy thật
```

Các lớp đầu đã học những feature phổ quát (cạnh, vân); bạn thuê chúng và train một cái đầu tí hon trên vài trăm ví dụ của riêng mình. Hãy ngấm nước đi này thật sâu — nó *chính là* nước đi của prompting và fine-tuning LLM (Phần 8 và 11): **thích nghi một gã khổng lồ pretrained; không bao giờ bắt đầu từ số không.** Cả nền kinh tế AI hiện đại là pattern này ở quy mô tăng dần.

## Debug training: đọc nhật ký độ cao

Phần 2 gọi đường loss là nhật ký độ cao của người leo núi. Các hoa văn cần nhận mặt:

- **Loss phẳng từ đầu** → learning rate quá nhỏ, dữ liệu chưa shuffle, hoặc một con bug (label lệch hàng là ca kinh điển).
- **Loss nổ / NaN** → learning rate quá lớn; người leo núi đang nhảy vọt qua các thung lũng.
- **Loss train giảm, loss validation tăng** → overfitting của Phần 4, diễn trực tiếp trên sân khấu; dừng sớm hoặc regularize (dropout là khoản phạt vị-NN).
- **Bài test đầu tiên tốt nhất cho mọi pipeline mới**: cố tình overfit *một batch tí hon* — model không kéo nổi loss về ~0 trên 32 ví dụ thì đường ống hỏng, không phải hyperparameter. Cú kiểm tra tỉnh táo rẻ nhất của deep learning.

## Điều cần nhớ

- Deep learning thắng trên tín hiệu thô (ảnh, âm thanh, text) nhờ representation learning; trên bảng, gradient boosting vẫn là baseline trung thực.
- Vòng lặp chín dòng là cả tôn giáo: zero_grad → forward → loss → backward (autograd) → step; batch là tính năng, không phải thoả hiệp.
- Transfer learning là mặc định: đóng băng thân pretrained, train cái đầu nhỏ — đúng nước đi thích-nghi-gã-khổng-lồ mà prompting và fine-tuning lặp lại ở quy mô LLM.
- Debug bằng cách đọc đường loss, và kiểm chứng mọi pipeline mới bằng cú overfit một batch tí hon trước tiên.

*Tiếp theo — Phần 6: Transformer & attention, giải ảo.*
