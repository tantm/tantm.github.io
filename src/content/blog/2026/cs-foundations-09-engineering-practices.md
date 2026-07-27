---
title: 'Git, Testing, Code Review — the Real Job Skills'
description: 'Git as a graph you stop fearing, the three tests worth writing, reviews that catch what compilers cannot, and reading code as the underrated superpower.'
date: 2026-08-03
category: Developer
tags: [cs-foundations, git, testing, career]
lang: en
translationKey: cs-foundations-09
series: cs-foundations
part: 9
---

Nothing in this part is on a university syllabus, and all of it is in every working day. The uncomfortable truth of professional software: **code is read, reviewed, and maintained far more than it is written** — and the skills for that side of the job are learnable, mechanical, and chronically undertaught. Four of them, then.

## Git: it's a graph, and you already know graphs

Part 3 taught you graphs; Git is one — **commits are nodes pointing at their parents; branches are just movable name-tags on nodes**. Internalize that sentence and Git's menace evaporates: merging is joining two chains at a node; `HEAD` is "the tag you're standing on"; nothing you've committed is ever truly lost (`git reflog` is the graph's undo history — the panic-eraser everyone learns one bad afternoon too late).

Daily craft, distilled:

- **Commits are units of meaning, not save points.** One logical change per commit, with a message whose first line answers *"what does applying this do?"* ("Fix duplicate orders on retry" — not "fix", not "wip"). Your future self bisecting a bug at 2 a.m. is the audience.
- **Branches are cheap conversation scopes**: one branch = one reviewable change. The thousand-line branch that "does everything" is unreviewable (see below) and unmergeable in equal measure.
- **Pull before you push, and read what happened.** Merge conflicts aren't errors — they're Git *refusing to guess* between two truths (a very check-then-act flavor of problem, P8); resolving them means deciding, not deleting one side until it compiles.

## Testing: three kinds pay rent, the rest is theater

S02-P03 said it for pipelines; here's the general form. Coverage percentage is a vanity metric (Part 4's accuracy-lies lesson, transplanted) — what matters is *which* tests exist:

1. **Behavior tests for the logic that earns money** — small, fast, hand-checkable (5 inputs, known answers). They define what the code *promises*, which is why they double as documentation that can't go stale.
2. **Regression tests from every real bug** — the incident-leaves-a-fixture habit: each production bug becomes the test that prevents its sequel. This is how suites grow teeth instead of weight.
3. **One end-to-end smoke test** — does the whole thing start, connect, and answer at all? It catches the "everything passes but nothing runs" class of failure that unit tests are structurally blind to.

The discipline that makes all three work: **tests run on every change, automatically** (CI), and a red test blocks the merge. A test suite that can be skipped is a suggestion box. And the design side-effect nobody advertises: code that's hard to test (needs a database, the network, and a full moon) is *telling you* its dependencies are tangled — the same border-typing instinct from S02-P03 fixes both.

## Code review: the highest-leverage hour of your week

Review exists to catch what compilers and tests can't: wrong assumptions, missing edge cases, unclear naming, designs that will hurt in six months. Craft for both sides:

**As the author** — you are selling a change, so lower the price: keep it small (a 200-line review gets *better* scrutiny than a 2,000-line one — reviewer attention is Part 6's fixed budget, human edition), write a description saying *why* (the diff already shows what), and review your own diff first — you'll catch a third of the comments before anyone else spends time on them.

**As the reviewer** — read the description, then the tests (*they state intended behavior faster than the code does*), then the code. Comment on: correctness (walk one concrete input through it — P4's habit), edge cases (empty, duplicate, concurrent — the P8 question "what if two of these run at once?"), and clarity ("I couldn't follow this" is valid, valuable feedback). Skip style nits a formatter should own — automate those out of the conversation entirely. And distinguish **blocking** ("this loses data when X") from **preference** ("I'd name this differently") — reviews rot into resentment when every comment carries the same weight.

The cultural core, worth stating once and meaning: **review the code, not the person; receive review as free senior attention, not as attack.** Teams that get this compound; teams that don't churn.

## Reading code: the skill interviews never test

You'll spend more hours in *other people's code* than your own — debugging it, extending it, reviewing it. The mechanical method, since nobody teaches one:

1. **Entry points first** — `main`, the route table, the DAG definition: what runs when?
2. **Follow one real request/row end to end** — depth on one path beats breadth on all files (the same single-example walk that P4 recommended for review).
3. **Read the tests as specification** — they demonstrate intended use with working examples.
4. **Ask the graph, not your eyes**: `git log -p -- path/file` answers "why is this weird code here?" better than staring — someone fixed a real bug with that weirdness, and the commit message (see above, on writing good ones — the loop closes) says which.

## Key takeaways

- Git is a graph: commits are nodes, branches are name-tags, reflog is the undo — commit units of meaning with messages your 2 a.m. self can bisect by.
- Three tests pay rent: behavior tests on money-earning logic, a regression test per real bug, one smoke test — enforced by CI or they're suggestions.
- Reviews: authors sell small changes with a why; reviewers walk one input, flag blocking vs preference, and let formatters own style.
- Reading code is the hidden half of the job: entry points → one path end-to-end → tests as spec → `git log` for the archaeology.

*Next up — Part 10: Design Patterns & Abstractions: When to Use, When to Skip.*
