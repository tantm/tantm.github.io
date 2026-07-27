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

You have the math intuitions (Part 2) and the workbench (Part 3). This part is the core loop of machine learning itself — and deliberately not a catalog of algorithms. Models come and go; **the discipline of evaluating them honestly is permanent**, and it's the exact discipline that returns, wearing fancier clothes, when Part 12 evaluates LLM apps.

## What "learning" actually is

Strip the mystique: supervised learning is **fitting a function to examples**. You show the machine rows of (features → known answer), it adjusts parameters (Part 2's matrices) to make its guesses less wrong (Part 2's gradient descent), and you hope the fitted function works on rows it *hasn't seen*.

That last clause is the entire game. Fitting the data you have is easy — a lookup table does it perfectly. **Generalizing** to tomorrow's data is the only thing anyone pays for. Every practice in this post exists to answer one question: *is my model genuinely generalizing, or just memorizing?*

## Discipline 1 — Baseline before brilliance

Before any model, compute the dumbest possible predictor: predict the majority class, predict yesterday's value, predict the average.

```python
from sklearn.dummy import DummyClassifier
base = DummyClassifier(strategy="most_frequent").fit(X_tr, y_tr)
print(base.score(X_te, y_te))   # churn rate 5%? this scores 95% by saying "no churn"
```

Two gifts: your real model now has a number to beat (a fraud model at 97% accuracy looks great until the baseline is 98%), and stakeholder conversations gain a floor ("our model adds 12 points over always-guessing-no"). Skipping the baseline is how teams celebrate models that do literally nothing.

## Discipline 2 — Accuracy lies; read the confusion matrix

With imbalanced classes (fraud, churn, defects — i.e., most valuable problems), accuracy is a vanity metric. The honest picture is the **confusion matrix** — and from it, two numbers with *business meanings*:

- **Precision** — of everything I flagged, how much was real? (Low precision = crying wolf: analysts drown in false alarms.)
- **Recall** — of everything real, how much did I catch? (Low recall = sleeping guard: fraud walks past.)

They trade off against each other via the **decision threshold**: a model outputs probabilities (Part 2's distributions), and *you* choose where to cut. Lower the threshold → catch more (recall ↑), flag more junk (precision ↓). So the right question is never "is 0.5 good?" but **"which mistake is more expensive here?"** — blocking a real customer, or missing a fraudster? That is a business decision wearing a math costume, and making it explicit is a big part of the job. (**F1** collapses the pair into one number when you must rank models; report all three when humans decide.)

## Discipline 3 — Overfitting: the one disease every model catches

An overfit model has memorized the training data's noise instead of its pattern: brilliant on data it has seen, useless on data it hasn't. The diagnostic is beautifully simple — **compare train score vs test score**:

| Train | Test | Diagnosis |
|---|---|---|
| 99% | 71% | **Overfitting** — memorized; simplify or get more data |
| 74% | 72% | Healthy fit — the 2-point gap is honest |
| 61% | 60% | **Underfitting** — model too simple for the pattern |

The knobs, in the order to reach for them: **more/better data** (beats cleverness embarrassingly often), **simpler model or fewer features**, and **regularization** — a penalty for large parameters that tells the model "extraordinary claims require extraordinary evidence" (that's the `C` in Part 3's `LogisticRegression`, the `max_depth` in a tree). And recall from Part 3 that **leakage is fake generalization**: a test score contaminated by leaked information shows a healthy gap while lying about both numbers.

## Discipline 4 — Spend your test set like it's your last

You tune the threshold, try features, adjust regularization — each time peeking at the test score. Congratulations: you are now *fitting the test set by hand*, one decision at a time. The professional setup:

- **Cross-validation for development**: split train into k folds, rotate validation, average — every tuning decision reads CV scores, never the test set (`cross_val_score(pipe, X_tr, y_tr, cv=5)`).
- **The test set is touched once**, at the end, to report the final number. Touched twice, it's a validation set; touched weekly, it's a training set with extra steps.

This habit scales all the way up: Part 12's LLM eval sets rot for exactly the same reason when prompts get tuned against them.

## The fundamentals checklist

Every supervised project, same six lines: split honestly first (time-aware, leak-free — Part 3) → baseline → pick the metric by asking *which mistake is expensive* → train simple before fancy → diagnose with the train/test gap → tune on CV, report on the untouched test set. Ninety percent of "the model failed in production" stories violated one of these six.

## Key takeaways

- Learning = fitting; generalizing = the product. Every discipline here detects memorization masquerading as skill.
- Baseline first — a model has no meaning without a dumb number to beat.
- Precision vs recall is a business decision about which mistake costs more; the threshold is where you encode it.
- Diagnose with the train/test gap; tune on cross-validation; spend the test set exactly once.

*Next up — Part 5: Deep Learning with PyTorch, Practically.*
