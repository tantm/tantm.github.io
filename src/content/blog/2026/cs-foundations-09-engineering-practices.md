---
title: 'Git, Testing, Code Review — the Real Job Skills'
description: 'Git as a graph you stop fearing, the three tests worth writing, reviews that catch what compilers cannot, and reading code as the underrated superpower.'
date: 2026-08-03
category: Developer
tags: [cs-foundations, git, testing, career]
lang: en
translationKey: cs-foundations-09
series: cs-foundations
cover: images/s01-p09-hero.png
part: 9
---

Nothing in this part is on a university syllabus, and all of it is in every working day. The uncomfortable truth of professional software: **code is read, reviewed, and maintained far more than it is written** — and the skills for that side of the job are learnable, mechanical, and chronically undertaught. Four of them, then.

## What you'll learn

- Think of Git as a graph, so "lost" work becomes findable instead of frightening.
- Write the three kinds of test that pay rent, and skip the ones that don't.
- Give and receive code review in a way that makes changes better rather than slower.
- Read unfamiliar code deliberately — the skill nobody interviews for and everybody needs.

**Prerequisites:** None. Some Git experience helps, but nothing here assumes fluency.

## 1. Git: it's a graph, and you already know graphs

Part 3 taught you graphs; Git is one — **commits are nodes pointing at their parents; branches are just movable name-tags on nodes**. Internalize that sentence and Git's menace evaporates: merging is joining two chains at a node; `HEAD` is "the tag you're standing on"; nothing you've committed is ever truly lost (`git reflog` is the graph's undo history — the panic-eraser everyone learns one bad afternoon too late).

Daily craft, distilled:

- **Commits are units of meaning, not save points.** One logical change per commit, with a message whose first line answers *"what does applying this do?"* ("Fix duplicate orders on retry" — not "fix", not "wip"). Your future self bisecting a bug at 2 a.m. is the audience.
- **Branches are cheap conversation scopes**: one branch = one reviewable change. The thousand-line branch that "does everything" is unreviewable (see below) and unmergeable in equal measure.
- **Pull before you push, and read what happened.** Merge conflicts aren't errors — they're Git *refusing to guess* between two truths (a very check-then-act flavor of problem, P8); resolving them means deciding, not deleting one side until it compiles.

## 2. Testing: three kinds pay rent, the rest is theater

S02-P03 said it for pipelines; here's the general form. Coverage percentage is a vanity metric (Part 4's accuracy-lies lesson, transplanted) — what matters is *which* tests exist:

1. **Behavior tests for the logic that earns money** — small, fast, hand-checkable (5 inputs, known answers). They define what the code *promises*, which is why they double as documentation that can't go stale.
2. **Regression tests from every real bug** — the incident-leaves-a-fixture habit: each production bug becomes the test that prevents its sequel. This is how suites grow teeth instead of weight.
3. **One end-to-end smoke test** — does the whole thing start, connect, and answer at all? It catches the "everything passes but nothing runs" class of failure that unit tests are structurally blind to.

The discipline that makes all three work: **tests run on every change, automatically** (CI), and a red test blocks the merge. A test suite that can be skipped is a suggestion box. And the design side-effect nobody advertises: code that's hard to test (needs a database, the network, and a full moon) is *telling you* its dependencies are tangled — the same border-typing instinct from S02-P03 fixes both.

## 3. Code review: the highest-leverage hour of your week

Review exists to catch what compilers and tests can't: wrong assumptions, missing edge cases, unclear naming, designs that will hurt in six months. Craft for both sides:

**As the author** — you are selling a change, so lower the price: keep it small (a 200-line review gets *better* scrutiny than a 2,000-line one — reviewer attention is Part 6's fixed budget, human edition), write a description saying *why* (the diff already shows what), and review your own diff first — you'll catch a third of the comments before anyone else spends time on them.

**As the reviewer** — read the description, then the tests (*they state intended behavior faster than the code does*), then the code. Comment on: correctness (walk one concrete input through it — P4's habit), edge cases (empty, duplicate, concurrent — the P8 question "what if two of these run at once?"), and clarity ("I couldn't follow this" is valid, valuable feedback). Skip style nits a formatter should own — automate those out of the conversation entirely. And distinguish **blocking** ("this loses data when X") from **preference** ("I'd name this differently") — reviews rot into resentment when every comment carries the same weight.

The cultural core, worth stating once and meaning: **review the code, not the person; receive review as free senior attention, not as attack.** Teams that get this compound; teams that don't churn.

## 4. Reading code: the skill interviews never test

You'll spend more hours in *other people's code* than your own — debugging it, extending it, reviewing it. The mechanical method, since nobody teaches one:

1. **Entry points first** — `main`, the route table, the DAG definition: what runs when?
2. **Follow one real request/row end to end** — depth on one path beats breadth on all files (the same single-example walk that P4 recommended for review).
3. **Read the tests as specification** — they demonstrate intended use with working examples.
4. **Ask the graph, not your eyes**: `git log -p -- path/file` answers "why is this weird code here?" better than staring — someone fixed a real bug with that weirdness, and the commit message (see above, on writing good ones — the loop closes) says which.

## Practice (25 minutes — lose a commit on purpose, then get it back)

Nothing here touches a real repository. You'll create a throwaway one, destroy work in the two ways that actually frighten people, and recover from both — after which `reflog` stops being trivia:

```bash
mkdir git-lab && cd git-lab && git init -q
for m in first second third; do echo "$m" >> log.txt; git add -A; git commit -qm "$m"; done
git log --oneline                       # three commits, a straight line

# 1. The graph, drawn by Git itself
git switch -qc feature
echo "feature work" >> log.txt && git commit -qam "feature commit"
git switch -q main && echo "main work" >> log.txt && git commit -qam "main commit"
git log --oneline --graph --all          # the fork is visible: branches are just labels

# 2. DESTROY #1: a hard reset that "loses" two commits
git switch -q feature
git log --oneline                        # note the top commit hash
git reset --hard HEAD~2
git log --oneline                        # the work is gone from the branch…

# 3. RECOVER: the commits still exist — reflog remembers where HEAD has been
git reflog | head -5
git reset --hard <hash-from-reflog>      # paste the hash of "feature commit"
git log --oneline                        # …and it's back. Nothing was ever deleted.

# 4. DESTROY #2: commit to nowhere (detached HEAD), then "lose" it
git switch -q --detach HEAD~1
echo "orphan work" >> log.txt && git commit -qam "orphan commit"
git switch -q feature                    # Git warns you're leaving a commit behind
git log --oneline --all | grep orphan || echo "orphan commit not on any branch"

# 5. RECOVER: find it in reflog and give it a name
git reflog | head -5
git branch rescued <orphan-hash>         # a branch is just a label pointing at a node
git log --oneline rescued | head -2
```

Expected results: after the hard reset the commits vanish from `git log` but are all still listed in `git reflog` — because a reset moves a *label*, it doesn't delete nodes. The same is true of the detached-HEAD commit: it's unreachable from any branch, not gone, and creating a branch at its hash makes it ordinary again. Once you've done this twice, the sentence "branches are labels on a graph of commits" becomes something you've verified rather than something you were told, and the panic that normally follows `reset --hard` disappears.

## Check yourself

1. A teammate force-pushed over your branch and your last two commits are "gone" from GitHub. What do you check locally, and why is the situation usually recoverable?
2. Your team has 4,000 unit tests, 92% coverage, and production breaks weekly on integration issues. What's wrong with this test suite?
3. You're asked to review a 2,000-line pull request. What do you do?

<details><summary>See answers</summary>

1. Check `git reflog` in your local clone: it records where your HEAD has been, so the commit hashes are still there and the objects still exist locally until garbage collection. Create a branch at the lost hash and push it. The lesson generalizes — Git almost never destroys committed work, it moves labels.
2. It's testing the wrong layer. Unit tests with high coverage verify that functions do what they were written to do; they can't catch mismatched assumptions *between* components, which is where production is failing. Add integration tests at the seams that break — the boundaries between services, the database contract, the deploy path — and stop treating coverage percentage as a quality metric.
3. Ask for it to be split. A 2,000-line review gets rubber-stamped, because nobody can hold that much context and reviewers' attention drops sharply with size — you'll approve bugs politely. If it genuinely can't be split (a generated file, a mechanical rename), say what you actually reviewed and what you didn't, so the record is honest.

</details>

## Key takeaways

- Git is a graph: commits are nodes, branches are name-tags, reflog is the undo — commit units of meaning with messages your 2 a.m. self can bisect by.
- Three tests pay rent: behavior tests on money-earning logic, a regression test per real bug, one smoke test — enforced by CI or they're suggestions.
- Reviews: authors sell small changes with a why; reviewers walk one input, flag blocking vs preference, and let formatters own style.
- Reading code is the hidden half of the job: entry points → one path end-to-end → tests as spec → `git log` for the archaeology.

*Next up — Part 10: Design Patterns & Abstractions: When to Use, When to Skip.*
