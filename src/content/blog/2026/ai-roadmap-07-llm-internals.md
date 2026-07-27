---
title: 'How LLMs Work: Tokens, Context, Sampling'
description: 'Tokens are not words, context is working memory with rent, and temperature is a dial on a distribution — the mechanical facts behind every LLM behavior that surprises engineers.'
date: 2026-08-02
category: AI
tags: [ai-roadmap, llm]
lang: en
translationKey: ai-roadmap-07
series: ai-roadmap
part: 7
---

Part 6 gave you the engine (attention, pretraining). This part is the operator's manual: the handful of mechanical facts — tokens, context, the generation loop, sampling — that explain nearly every "why did it do that?" you'll hit while building. None of it is exotic; all of it is billable.

## Tokens: the model's alphabet is not yours

Models don't read words or characters — they read **tokens**: statistically common chunks learned from data (the BPE family of tokenizers). `"understanding"` might be one token; `"antidisestablishmentarianism"` five; `" the"` (with its leading space!) one of the most common of all. Roughly: **1 token ≈ ¾ of an English word**.

Mechanical consequences you'll meet in week one:

- **You are billed in tokens**, input and output separately — cost intuition starts with `len(tokens)`, not `len(words)`, and every provider ships a tokenizer you can run locally to count before you spend.
- **Non-English pays a tax**: tokenizers trained mostly on English split Vietnamese, Thai, or code-mixed text into more, smaller tokens — same sentence, more tokens, more cost, less effective context. (Writing this blog's VI posts costs more tokens than the EN ones. We checked.)
- **Character-level tasks are genuinely hard**: "how many r's in strawberry" fails not from stupidity but because the model sees `[straw][berry]`, not letters. Same reason for weakness at exact string reversal or arithmetic on long digit strings — the digits get chunked unevenly.

## Context: working memory that charges rent

The **context window** is everything the model can "see" for this call: system prompt + conversation + retrieved documents + its own output so far. Three facts define how you engineer around it:

1. **It's a hard cap** — exceed it and something must be dropped or refused; long conversations silently truncate the oldest turns, which is why the model "forgets" the instruction from an hour ago. There is no memory *between* calls at all: the model is stateless, and "chat history" is literally your app resending the transcript every time.
2. **It's priced linearly and computed quadratically** (Part 6) — long context is a real cost decision, not a free convenience.
3. **Attention is a budget** (Part 6's fine print) — burying the key fact on page 40 of pasted context measurably hurts; putting instructions at the start/end helps. This is the mechanical case for retrieval (Part 9): *select* the relevant 2%, don't ship the haystack.

## Generation: one token at a time, forever

The loop that produces every response:

```text
1. Feed the full context through the network (Part 6)
2. Get a probability distribution over the entire vocabulary (Part 2!)
3. Pick ONE token from it   ← the only "decision" that exists
4. Append it to the context; go to 1 (KV cache makes this cheap)
```

Everything the model "does" is this loop. Consequences: output is billed per token *and* slow per token (streaming exists because users watch the loop run — first token slow, rest fast, per Part 6's KV cache); the model cannot "plan ahead" except insofar as good next-token prediction implies it; and `max_tokens` is a guillotine, not a target — hit it and your JSON is cut off mid-brace (always check the finish reason; truncated structured output is a classic silent bug).

## Sampling: temperature is a dial on the distribution

Step 3 above has options. **Greedy** (temperature 0): always take the most probable token — near-deterministic, best for extraction, classification, structured output. **Sampling** (temperature > 0): draw from the distribution — Part 2's temperature idea made real: low T sharpens the distribution toward the top choices; high T flattens it, letting unlikely tokens through (creativity and nonsense enter through the same door). **Top-p** caps sampling to the smallest set of tokens covering p probability mass — a quality floor under high temperatures.

The working defaults: **0 for anything a machine consumes** (JSON, tool calls, evals need reproducibility), **~0.7 for prose humans read**, and change one knob, not both. And a myth worth killing: temperature 0 does *not* make the model truthful — it makes it *consistent*. A confidently wrong distribution sampled greedily is just consistently wrong.

## Hallucination, mechanically (a promise kept)

Part 2 promised the honest explanation; you now have all the parts. The model's only operation is "emit a plausible next token given context." When the context (plus pretrained knowledge) doesn't contain the answer, the *most plausible continuation* of an authoritative-sounding sentence is… an authoritative-sounding completion. A fabricated citation is not a malfunction — it is the distribution working as designed on insufficient grounding. Which yields the engineering corollary that runs Parts 9 and 12: **you don't prompt hallucination away; you ground it away** (put the truth in context — RAG) **and you catch it** (evals, citations, verification). "Don't hallucinate" in a system prompt is a wish, not a control — S07-P10's PDF-vs-code distinction, again.

## Reading a model card like an engineer

Before adopting any model, five lines answer most of it: **context length** (and output cap — often much smaller), **knowledge cutoff** (facts after it must arrive via context — retrieval again), **price per input/output token** (output usually costs several× input — verbose prompts are cheap, verbose answers aren't), **modalities and tool support** (function calling? vision? structured output mode?), and **latency class** (a frontier model and a small fast model often pair better than either alone — Part 13's routing). Benchmarks are the last thing to read, not the first; your eval set (Part 12) outranks their leaderboard.

## Key takeaways

- Tokens ≈ ¾ word, billed both ways, with a non-English tax — and character-level failures are tokenization, not stupidity.
- Context is stateless working memory with rent: hard cap, quadratic compute, uneven attention — retrieval exists because of all three.
- Generation is one-token-at-a-time from a distribution; temperature 0 = consistent (not truthful), ~0.7 for prose, and `max_tokens` is a guillotine.
- Hallucination is the mechanism working on missing grounding: ground it (RAG) and catch it (evals) — don't wish it away in the prompt.

*Next up — Part 8: Prompt Engineering as an Engineering Discipline.*
