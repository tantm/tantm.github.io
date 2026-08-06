---
title: 'Deep Learning with PyTorch, Practically'
description: 'When deep learning actually beats classic ML, one honest training loop, what autograd does for you, and transfer learning — the default nobody admits is the default.'
date: 2026-07-31
category: AI
tags: [ai-roadmap, deep-learning, pytorch]
lang: en
translationKey: ai-roadmap-05
series: ai-roadmap
cover: images/s03-p05-hero.png
part: 5
---

Part 2 promised that a neural network is stacked matrix-machines with bends between them, trained by walking downhill. This part makes that sentence executable — one real training loop, run once, understood forever. And it starts with the question tutorials skip: *should* you be deep learning at all?

## What you'll learn

- Decide honestly whether a problem wants deep learning or gradient boosting.
- Read and write the nine-line training loop that every deep learning system runs.
- Explain what autograd does for you, and avoid the two beginner scars around it.
- Use transfer learning — the default move — and debug training by reading the loss curve.

**Prerequisites:** Part 2 (matrices, gradient descent) and Part 4 (baselines, overfitting, the train/validation gap).

## 1. When deep learning actually wins

The honest decision table, before any code:

| Your data | Reach for | Why |
|---|---|---|
| Tabular (the churn CSV of Parts 3–4) | Gradient boosting (XGBoost-class) | Still beats NNs on most tables, trains in seconds, explains itself better |
| Images, audio, text, video | **Deep learning** | Features can't be hand-engineered; layers learn them |
| Text in 2026 specifically | A pretrained transformer (Parts 6–7) | Nobody starts from scratch anymore |

Deep learning's superpower is **representation learning** (the model invents its own features from raw signal). When your features are already sensible columns, that superpower is wasted while its costs — data hunger, GPU time, opacity — remain.

The professional embarrassment to avoid: three weeks of neural-network tuning on a tabular problem that gradient boosting matches in an afternoon. Part 4's baseline discipline, applied to model families.

## 2. What a network computes

A multi-layer network is embarrassingly little code:

```python
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(784, 128),   # matrix machine: 784 → 128 (Part 2)
    nn.ReLU(),             # the "bend" — without it, 3 layers collapse into 1
    nn.Linear(128, 64),
    nn.ReLU(),
    nn.Linear(64, 10),     # 10 scores, one per class
)
```

Each `Linear` is Part 2's matrix machine. Each `ReLU` is the bend that makes stacking meaningful — a stack of purely linear maps collapses into one linear map, so the nonlinearity is *the whole point*. The output is 10 raw scores (**logits**, unnormalized class scores); softmax turns them into a probability distribution when you need one.

## 3. The training loop — the whole religion in nine lines

Every deep learning system, from this toy to frontier LLMs, runs this loop:

```python
opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
loss_fn = nn.CrossEntropyLoss()

for xb, yb in train_loader:          # batches, not the whole dataset
    opt.zero_grad()                  # 1. forget last batch's gradients
    pred = model(xb)                 # 2. forward: make guesses
    loss = loss_fn(pred, yb)         # 3. score the wrongness
    loss.backward()                  # 4. autograd: gradient of loss w.r.t. EVERY parameter
    opt.step()                       # 5. walk downhill (Part 2's hiker)
```

Line 4 is the magic worth demystifying once. **Autograd** recorded every operation in the forward pass and replays it backwards — the chain rule, automated — to compute how much each of the thousands of parameters contributed to the error. This is why you never compute a derivative by hand; line 4 is the framework's entire reason to exist.

Two beginner scars to pre-empt. Forget `zero_grad()` and gradients *accumulate* across batches: the loss goes weird and nothing crashes. And **batches** exist for two reasons — the dataset doesn't fit in memory, and noisy small-batch gradients actually help escape bad valleys.

## 4. GPU: two lines, one gotcha

```python
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
xb, yb = xb.to(device), yb.to(device)    # data must move too — the classic mismatch error
```

Why it matters: matrix machines are exactly what GPUs are built for, and the speedup is 10–100×. You don't need to own one — free notebook tiers and spot instances cover everything in this series.

The day job of GPU work is *keeping it fed*. If utilization is low, your bottleneck is the data loader, not the model: "waiting or computing?", asked about silicon.

## 5. Transfer learning: the practical default

Training from scratch needs data you don't have. The 2026 default is **start from a pretrained model and adapt it**:

```python
from torchvision import models
model = models.resnet18(weights="IMAGENET1K_V1")   # learned features from 1.2M images
for p in model.parameters():
    p.requires_grad = False                        # freeze the feature extractor
model.fc = nn.Linear(model.fc.in_features, 2)      # new head: your 2 classes
# train ONLY the head — minutes, hundreds of images, real accuracy
```

The early layers learned universal features — edges, textures — and you rent them, training a tiny head on your own few hundred examples.

Internalize this move deeply: it is the *same* move as prompting and fine-tuning LLMs later in this series. **Adapt a pretrained giant; never start from zero.** The entire modern AI economy is this pattern at increasing scale.

## 6. Debugging training: read the altitude log

Part 2 called the loss curve a hiker's altitude log. The patterns to recognize:

- **Loss flat from the start** → learning rate too small, data not shuffled, or a bug (labels misaligned is the classic).
- **Loss explodes / NaN** → learning rate too large; the hiker is leaping across valleys.
- **Train loss falls, validation loss rises** → Part 4's overfitting, live on stage; stop early or regularize (dropout is the neural-network flavor of that penalty).
- **The best first test of any new pipeline**: overfit *one tiny batch* on purpose — if the model can't reach ~zero loss on 32 examples, the plumbing is broken, not the hyperparameters. Cheapest sanity check in deep learning.

## Practice (25 minutes — run the loop, then break it on purpose)

CPU is fine; no GPU needed. You'll train a real network, then reproduce the two classic beginner failures so you recognize them later:

```python
import torch, torch.nn as nn
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

X, y = load_digits(return_X_y=True)                    # 8x8 images, 10 classes
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=.25, stratify=y, random_state=0)
Xtr = torch.tensor(Xtr, dtype=torch.float32) / 16      # scale to 0..1
Xte = torch.tensor(Xte, dtype=torch.float32) / 16
ytr, yte = torch.tensor(ytr), torch.tensor(yte)

def make(): return nn.Sequential(nn.Linear(64,32), nn.ReLU(), nn.Linear(32,10))

def train(model, lr, epochs=30, zero=True):
    opt, loss_fn = torch.optim.AdamW(model.parameters(), lr=lr), nn.CrossEntropyLoss()
    for e in range(epochs):
        if zero: opt.zero_grad()                        # step 1 of the nine lines
        loss = loss_fn(model(Xtr), ytr)                 # forward + score
        loss.backward(); opt.step()                     # autograd + downhill
        if e % 10 == 0: print(f"  epoch {e:>2} loss {loss.item():.3f}")
    acc = (model(Xte).argmax(1) == yte).float().mean().item()
    print(f"  test accuracy {acc:.3f}")

print("A. healthy run (lr=1e-2):");        train(make(), 1e-2)
print("B. learning rate too big (lr=5):"); train(make(), 5.0)
print("C. forgot zero_grad():");           train(make(), 1e-2, zero=False)

# D. the cheapest sanity check in deep learning: overfit one tiny batch
m, tiny_x, tiny_y = make(), Xtr[:32], ytr[:32]
opt, loss_fn = torch.optim.AdamW(m.parameters(), lr=1e-2), nn.CrossEntropyLoss()
for _ in range(300):
    opt.zero_grad(); l = loss_fn(m(tiny_x), tiny_y); l.backward(); opt.step()
print(f"D. overfit-32 loss: {l.item():.4f}   (near zero = plumbing works)")
```

Expected results: run A drops the loss steadily and lands somewhere around 90% test accuracy. Run B's loss explodes or turns into NaN — the hiker leaping across valleys, which is what "learning rate too large" looks like from the outside. Run C is the sneaky one: nothing crashes, no error appears, the loss just behaves strangely because gradients accumulated across steps. Run D should reach near-zero loss; if it ever *doesn't* on a new pipeline of yours, the bug is in the plumbing (labels, shapes, scaling) and no amount of hyperparameter tuning will save it.

## Check yourself

1. Your team wants a neural network for a 40-column customer churn table. What do you propose first, and what would change your mind?
2. Training runs, nothing errors, but the loss wanders instead of falling. Which two bugs from this part would you check before touching the learning rate?
3. You have 400 labeled product photos and need a classifier by Friday. What's the plan, and roughly how much of the model do you actually train?

<details><summary>See answers</summary>

1. Propose gradient boosting as the baseline — on tabular data it usually wins, trains in seconds, and explains itself better. What would change your mind: a raw-signal column the table can't encode (free-text reviews, images), or a boosted baseline that plateaus well below the business need with evidence that representation learning would help.
2. A missing `zero_grad()` (gradients accumulate silently across steps — nothing crashes), and misaligned labels or unscaled inputs. The overfit-one-batch test settles it: if 32 examples can't reach near-zero loss, it's plumbing, not hyperparameters.
3. Transfer learning: take a pretrained image model, freeze the feature extractor, replace the final layer with your own classes, and train only that head. You train a tiny fraction of the parameters — minutes on CPU, real accuracy from a few hundred images.

</details>

## Key takeaways

- Deep learning wins on raw signal (images, audio, text) via representation learning; on tables, gradient boosting is still the honest baseline.
- The nine-line loop is the whole religion: zero_grad → forward → loss → backward (autograd) → step; batches are a feature, not a compromise.
- Transfer learning is the default: freeze a pretrained body, train a small head — the same adapt-a-giant move that prompting and fine-tuning repeat at LLM scale.
- Debug by reading the loss curve, and validate any new pipeline by overfitting one tiny batch first.

*Next up — Part 6: Transformers & Attention, Demystified.*
