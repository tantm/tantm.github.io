---
title: 'Migration Architectures: Legacy to Modern Without Falling'
description: 'Every long-lived platform eventually walks between schools. The strangler fig, parallel run with reconciliation, and cutovers designed as two-way doors.'
date: 2026-07-28
category: Architecture
tags: [dp-architectures, migration, strangler, data-platform]
lang: en
translationKey: dp-arch-13
series: dp-architectures
part: 13
cover: images/dp-arch-migration.png
---

Part 1 warned that architectures are rented, not bought. This part is about moving day — the discipline of getting from the platform you have to the school you chose, **while the business keeps reading its numbers**. Data migrations fail differently from app migrations: the app can be rolled back, but a report that showed wrong numbers for a month has already done its damage. Hence the whole art: *never be wrong in public.*

![Migration Architectures: Legacy to Modern Without Falling](images/dp-arch-migration.png)

## What you'll learn

- Migrate by use case rather than by layer, so value arrives before the project ends.
- Run old and new in parallel and let reconciliation earn the trust, not the slide deck.
- Backfill idempotently and keep a two-way door open until you're sure.
- Sequence the whole thing, including the decommission nobody schedules.

**Prerequisites:** Parts 2-3 (the platforms you're moving between) and Part 12 (cost, which funds the migration).

## 1. The birth pain

The trigger is one of Part 8's graduation signals, a dying vendor, an unpayable license, or an acquisition. The naive plan is always the same: "rebuild on the new stack, switch over on a weekend, decommission." It fails for the same three reasons every time: the legacy system encodes **undocumented business logic** (that weird `CASE` statement *is* the revenue definition), consumers are **more numerous than anyone knows** (spreadsheets, cron jobs, a partner's API), and data quality issues are **discovered, not known** — the new pipeline faithfully reproduces numbers nobody realized were wrong, or fixes them and breaks every trendline.

So the master rule: **no big bang.** Everything below is a way of buying the right to be gradual.

## 2. The strangler fig: migrate by use case, not by layer

Named after the fig that grows around a tree until the tree is gone. Applied to data platforms: don't migrate "the warehouse" — migrate **one report, one pipeline, one domain at a time**, each running end-to-end on the new stack while everything else stays put.

```mermaid
flowchart LR
    S[Sources] --> L["Legacy platform<br/><i>shrinking</i>"]
    S --> N["New platform<br/><i>growing</i>"]
    L --> C1["Consumers (remaining)"]
    N --> C2["Consumers (migrated)"]
    L -. "use case by use case" .-> N
```

Two rules make it work. **Pick the first use case for learning, not impact** — small, low-politics, but touching the full path (ingest → transform → serve), so it flushes out the platform's unknowns early. And **freeze the legacy** as each piece migrates: new features land only on the new stack, or the fig never finishes strangling. The anti-pattern is migrating layer-by-layer ("all ingestion first") — you carry both platforms at full weight for the entire project with nothing fully delivered.

## 3. Parallel run and reconciliation: earn trust with numbers

For any use case whose numbers matter, run **old and new side by side** on the same inputs, and **reconcile automatically**:

```mermaid
flowchart LR
    I[Same inputs] --> OL["Legacy pipeline"]
    I --> NW["New pipeline"]
    OL --> R{"Reconciliation<br/><i>daily, automated</i>"}
    NW --> R
    R -->|"match streak reached"| CO["Cutover"]
    R -->|"mismatch"| X["Explain: bug, or legacy was wrong?"]
```

The craft is in the details: compare at multiple grains (totals first, then per-dimension slices — totals can match while segments are wildly off); define **tolerance up front** (bit-identical is often impossible across engines — agree what "equal" means before the first run); and treat every mismatch as a fork: *new bug* (fix it) or *legacy was wrong* (document it, get the business to sign off on the new number — this happens far more often than anyone expects). Cut over only after a **pre-agreed green streak**, not "when it feels stable".

Parallel run costs double compute for weeks. That is not waste; it is the price of *never being wrong in public* — and it's temporary, which the Part 12 lens should treat as a project cost, not a run-rate.

## 4. Backfill and the two-way door

Moving history has its own physics: backfill in **partitioned, idempotent, resumable** chunks (S02's mantra at terabyte scale), validate counts per chunk as you go, and expect the past to be dirtier than the present — schema versions nobody remembers, timezones that changed, IDs that were recycled.

And design the cutover as a **two-way door**: keep the legacy path warm (but frozen) for an agreed period after switching, with a rehearsed way back. The mere existence of a rollback plan changes cutover from a bet into a decision. Decommissioning — the actual finish line — happens only after a full business cycle (often month-end or quarter-end close) proves out on the new stack. Migrations that skip this step aren't finished; they're *paused in the riskiest possible position*, paying for two platforms indefinitely.

## 5. The sequencing playbook

1. **Inventory consumers first** — you cannot strangle what you can't see; query logs and catalog lineage (Part 10's tooling, reused) find the spreadsheet-and-cron long tail.
2. **First use case: learning over impact** (see above).
3. **Freeze legacy features** from day one of each migrated piece.
4. **Parallel run where numbers matter; direct swap where they don't** (an internal exploratory dashboard doesn't need a reconciliation regime).
5. **Cut over on evidence** (green streak), keep the door open, decommission after a full cycle.

## 6. Scoring on the five axes

- **Team:** migrations are a *program*, not a side quest — someone owns the inventory, the streaks, and the freeze discipline, or entropy wins.
- **Budget:** double-running is temporary but real; the strangler order (highest-cost legacy pieces first) can make the migration self-funding.
- **Latency/Scale:** often the *reason* for the move — but resist upgrading latency mid-migration; change one variable at a time.
- **Compliance:** reconciliation records and the frozen-legacy audit trail are exactly the evidence Part 10 regimes demand — a migration done this way *improves* your audit posture.

## 7. Three customers

- **Startup graduating from Part 8:** open formats make it a ramp — new engine reads the same Parquet; "migration" may be a week of pipeline rewiring. This is the payoff of the exit-ramp design.
- **Mid-size replacing a legacy warehouse:** the full playbook above, one domain at a time, 6–18 months honestly; the trap is stopping at 80% and running both forever.
- **Enterprise / regulated:** add change-management gates per cutover and regulator-visible reconciliation evidence; the parallel-run streak becomes a formal acceptance criterion, and the two-way door is not optional.

## Practice (25 minutes — run a reconciliation, and find the difference that isn't a bug)

Parallel running is only as useful as the comparison you run on it. This exercise builds that comparison and then introduces the two discrepancies every real migration produces:

```sql
-- duckdb migrate.db  — same business question, two systems
CREATE TABLE legacy_daily(d DATE, orders INT, revenue DECIMAL(12,2));
CREATE TABLE new_daily   (d DATE, orders INT, revenue DECIMAL(12,2));

INSERT INTO legacy_daily VALUES
 ('2026-03-01', 1000, 52000.00), ('2026-03-02',  980, 50100.00),
 ('2026-03-03', 1010, 51750.00), ('2026-03-04', 1005, 51900.00);

INSERT INTO new_daily VALUES
 ('2026-03-01', 1000, 52000.00),          -- identical: the easy day
 ('2026-03-02',  980, 50100.05),          -- rounding: a difference that is NOT a bug
 ('2026-03-03', 1013, 51890.00),          -- 3 extra orders: late data the legacy job missed
 ('2026-03-04',  950, 49100.00);          -- materially short: THIS one is a bug
```

```sql
-- 1. The reconciliation query — the artifact that earns trust
SELECT l.d,
       l.orders  AS legacy_orders, n.orders  AS new_orders, n.orders - l.orders AS d_orders,
       l.revenue AS legacy_rev,    n.revenue AS new_rev,
       round(100.0 * (n.revenue - l.revenue) / l.revenue, 4) AS pct_diff,
       CASE WHEN abs(100.0*(n.revenue-l.revenue)/l.revenue) < 0.01 THEN 'within tolerance'
            WHEN abs(100.0*(n.revenue-l.revenue)/l.revenue) < 1.0  THEN 'investigate'
            ELSE 'BLOCKER' END AS verdict
FROM legacy_daily l JOIN new_daily n USING (d) ORDER BY l.d;

-- 2. The cutover gate: N consecutive green days, not "it looked fine yesterday"
SELECT count(*) AS green_days FROM (
  SELECT d FROM legacy_daily l JOIN new_daily n USING (d)
  WHERE abs(100.0*(n.revenue-l.revenue)/NULLIF(l.revenue,0)) < 0.01);
```

Expected results: day 1 matches exactly, and that's the day that tempts teams to declare victory. Day 2 differs by half a cent — a rounding difference that is *not* a bug, and if your tolerance is zero you will spend a week on it. Day 3 has *more* orders in the new system, which looks alarming and is usually the new pipeline being correct where the old one dropped late arrivals; you have to investigate to find out, and sometimes the answer is that the legacy number everyone trusts has been slightly wrong for years. Day 4 is the genuine blocker. The lesson is in the verdict column: you need a stated tolerance *before* you start comparing, or every difference becomes an argument, and a cutover rule based on consecutive green days rather than on a single good-looking morning.

## Check yourself

1. Your parallel run shows the new system reporting 1.3% more revenue than the legacy one. Is this a blocker?
2. Leadership wants to skip parallel running to save two months. What do you say?
3. The migration is "done" and the legacy system still runs. What's the risk, and what should have been scheduled?

<details><summary>See answers</summary>

1. Not necessarily — it's an *investigate*, and the investigation has three plausible endings: the new system is wrong, the legacy system has been wrong (late data, silently dropped rows, a rounding convention), or the two define the metric differently. All three are worth knowing before cutover, and the second one is the reason parallel running is valuable rather than merely cautious.
2. That parallel running is how you find out whether the new system is right *before* it's the only system. Without it, cutover is a bet, and the failure mode is discovering discrepancies after the legacy system is gone and there's nothing left to compare against. If time is the constraint, shorten the parallel window or narrow it to the highest-value metrics — don't remove the comparison.
3. You're paying for two platforms and, worse, some consumers are still reading the old one — so the numbers can silently diverge and nobody notices which source a given report used. Decommissioning should be scheduled as part of the migration, typically one full business cycle after cutover, with an explicit check that nothing is still querying the old system.

</details>

## Key takeaways

- No big bang: migrate use case by use case (strangler fig), freezing legacy as you go — never layer by layer.
- Parallel run + automated reconciliation is how numbers earn trust; agree tolerance and the green-streak threshold *before* the first comparison.
- Backfill idempotently in chunks; design cutover as a two-way door; decommission only after a full business cycle — that's the real finish line.
- Expect to discover that legacy was sometimes wrong; getting the business to sign off on *new correct numbers* is part of the migration, not a distraction from it.

*Next up — Part 14: Choosing Your Architecture: a Decision Framework.*
