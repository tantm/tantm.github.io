---
title: "ML Fundamentals: Learn, Evaluate, Don't Overfit"
description: 'What "learning" actually is, why accuracy lies, precision vs recall as a business decision, and overfitting — the one disease every model catches.'
date: 2026-07-30
category: AI
tags: [ai-roadmap, ml, evals]
lang: en
translationKey: ai-roadmap-04
series: ai-roadmap
part: 4
---

You have the math intuitions (Part 2) and the workbench (Part 3). This part is the core loop of machine learning itself — and deliberately not a catalog of algorithms. Models come and go; **the discipline of evaluating them honestly is permanent**.

## What you'll learn

- Explain what "learning" means mechanically, and why generalizing is the only thing that counts.
- Build a baseline first, so no model gets celebrated for doing nothing.
- Pick precision or recall by asking which mistake costs more — and set the threshold that encodes it.
- Diagnose overfitting from the train/test gap, and spend a test set exactly once.

**Prerequisites:** Part 3 (the scikit-learn workbench and leak-free splits). Part 2 helps but isn't required.

## 1. What "learning" actually is

Strip the mystique: supervised learning is **fitting a function to examples**. You show the machine rows of (features → known answer), it adjusts parameters (Part 2's matrices) to make its guesses less wrong (Part 2's gradient descent), and you hope the fitted function works on rows it *hasn't seen*.

That last clause is the entire game. Fitting the data you have is easy — a lookup table does it perfectly. **Generalizing** (working on data the model never saw) to tomorrow's data is the only thing anyone pays for. Every practice in this post answers one question: *is my model genuinely generalizing, or just memorizing?*

## 2. Baseline before brilliance

Before any model, compute the dumbest possible predictor: predict the majority class, predict yesterday's value, predict the average.

```python
from sklearn.dummy import DummyClassifier
base = DummyClassifier(strategy="most_frequent").fit(X_tr, y_tr)
print(base.score(X_te, y_te))   # churn rate 5%? this scores 95% by saying "no churn"
```

Two gifts: your real model now has a number to beat (a fraud model at 97% accuracy looks great until the baseline is 98%), and stakeholder conversations gain a floor ("our model adds 12 points over always-guessing-no"). Skipping the baseline is how teams celebrate models that do literally nothing.

## 3. Accuracy lies; read the confusion matrix

With imbalanced classes (fraud, churn, defects — i.e., most valuable problems), accuracy is a vanity metric. The honest picture is the **confusion matrix** (a 2×2 table of right and wrong predictions by class) — and from it, two numbers with *business meanings*:

- **Precision** — of everything I flagged, how much was real? (Low precision = crying wolf: analysts drown in false alarms.)
- **Recall** — of everything real, how much did I catch? (Low recall = sleeping guard: fraud walks past.)

They trade off against each other through the **decision threshold** (the probability above which you call it a "yes"). A model outputs probabilities, and *you* choose where to cut. Lower the threshold and you catch more (recall up) but flag more junk (precision down).

So the right question is never "is 0.5 good?" It is **"which mistake is more expensive here?"** — blocking a real customer, or missing a fraudster? That is a business decision wearing a math costume. Making it explicit is a big part of the job. (**F1** collapses the pair into one number when you must rank models; report all three when humans decide.)

![Precision and recall trade off against each other; the threshold is where you encode which mistake costs more.](images/s03-p04-concept1.png)

## 4. Overfitting: the one disease every model catches

An overfit model has memorized the training data's noise instead of its pattern: brilliant on data it has seen, useless on data it hasn't. The diagnostic is beautifully simple — **compare train score vs test score**:

| Train | Test | Diagnosis |
|---|---|---|
| 99% | 71% | **Overfitting** — memorized; simplify or get more data |
| 74% | 72% | Healthy fit — the 2-point gap is honest |
| 61% | 60% | **Underfitting** — model too simple for the pattern |

The knobs, in the order to reach for them: **more/better data** (beats cleverness embarrassingly often), **simpler model or fewer features**, and **regularization** (a penalty for large parameters) — it tells the model "extraordinary claims require extraordinary evidence". That's the `C` in `LogisticRegression`, the `max_depth` in a tree.

One warning from Part 3: **leakage is fake generalization**. A test score contaminated by leaked information shows a healthy-looking gap while lying about both numbers.

## 5. Spend your test set like it's your last

You tune the threshold, try features, adjust regularization — each time peeking at the test score. Congratulations: you are now *fitting the test set by hand*, one decision at a time. The professional setup:

- **Cross-validation for development**: split train into k folds, rotate validation, average — every tuning decision reads CV scores, never the test set (`cross_val_score(pipe, X_tr, y_tr, cv=5)`).
- **The test set is touched once**, at the end, to report the final number. Touched twice, it's a validation set; touched weekly, it's a training set with extra steps.

This habit scales all the way up: LLM eval sets (Part 12) rot for exactly the same reason when prompts get tuned against them.

## 6. The fundamentals checklist

Every supervised project, same six lines: split honestly first (time-aware, leak-free) → baseline → pick the metric by asking *which mistake is expensive* → train simple before fancy → diagnose with the train/test gap → tune on cross-validation, report on the untouched test set. Ninety percent of "the model failed in production" stories violated one of these six.

## Practice (20 minutes — watch accuracy lie, then fix it)

One file, scikit-learn only. You'll build an imbalanced problem and catch a model that scores 95% while being worthless:

```python
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

X, y = make_classification(n_samples=4000, weights=[0.95], flip_y=0.02, random_state=0)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, stratify=y, random_state=0)

# 1. Baseline — the number every model must beat
base = DummyClassifier(strategy="most_frequent").fit(X_tr, y_tr)
print("baseline acc:", base.score(X_te, y_te))

# 2. A real model — and the metric that tells the truth
clf = LogisticRegression(max_iter=1000).fit(X_tr, y_tr)
print("model acc:", clf.score(X_te, y_te))
print(classification_report(y_te, clf.predict(X_te), digits=2))

# 3. Move the threshold: trade precision for recall on purpose
proba = clf.predict_proba(X_te)[:, 1]
for t in (0.5, 0.3, 0.15):
    print(t, classification_report(y_te, (proba > t).astype(int), digits=2).splitlines()[3])

# 4. Overfit on purpose, then read the gap
from sklearn.tree import DecisionTreeClassifier
deep = DecisionTreeClassifier(max_depth=None).fit(X_tr, y_tr)
print("deep tree  train:", deep.score(X_tr, y_tr), "test:", deep.score(X_te, y_te))
shallow = DecisionTreeClassifier(max_depth=3).fit(X_tr, y_tr)
print("shallow    train:", shallow.score(X_tr, y_tr), "test:", shallow.score(X_te, y_te))
print("CV (dev signal):", cross_val_score(shallow, X_tr, y_tr, cv=5).mean())
```

Expected results: the baseline already scores about 0.95 — so the model's headline accuracy is nearly meaningless, and the classification report shows the recall on class 1 is what actually moved. As you lower the threshold, recall climbs and precision falls; you are choosing which mistake to make. The deep tree scores ~1.00 on train and clearly lower on test (memorization, visible in one line), while the shallow tree's two numbers sit close together. The CV mean is the number you would tune on — the test set stays untouched until the very end.

## Check yourself

1. Your fraud model reports 97% accuracy. What is the first number you ask for, and why?
2. A model flags 200 transactions; 30 are real fraud, and it missed 10 others. Which metric is weak here, and which threshold move would help — at what cost?
3. Train 0.99 / test 0.72 versus train 0.61 / test 0.60. Name each diagnosis and the first knob you'd reach for.

<details><summary>See answers</summary>

1. The baseline. If fraud is 3% of rows, "always say no" scores 97% too — the model may add nothing. Accuracy on imbalanced data means nothing without a floor to compare against.
2. Recall is weak: it caught 30 of 40 real cases (75%) while precision is 30/200 (15%). Lowering the threshold raises recall — you'd catch more of the 10 missed — at the cost of even lower precision, meaning more false alarms for analysts. Whether that trade is right depends on which mistake costs more.
3. First is overfitting (memorized noise): reach for more/better data, a simpler model, or stronger regularization. Second is underfitting (model too simple): reach for a more expressive model or better features. Both are read from the *gap*, not from either number alone.

</details>

## Key takeaways

- Learning = fitting; generalizing = the product. Every discipline here detects memorization masquerading as skill.
- Baseline first — a model has no meaning without a dumb number to beat.
- Precision vs recall is a business decision about which mistake costs more; the threshold is where you encode it.
- Diagnose with the train/test gap; tune on cross-validation; spend the test set exactly once.

*Next up — Part 5: Deep Learning with PyTorch, Practically.*
