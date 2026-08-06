---
title: 'Governance, Catalog & Infra for Data Teams'
description: 'The catalog as the answer to "which table is real", lineage as blast-radius math, PII handled at the border, and the DevOps slice a data engineer actually needs.'
date: 2026-08-04
category: Data
tags: [de-roadmap, governance, devops]
lang: en
translationKey: de-roadmap-13
series: de-roadmap
part: 13
---

Around the fiftieth table, every data platform hits the same wall, and it isn't technical: an analyst asks *"there are three `orders` tables — which one is real?"*, a regulator asks *"where does customer data live?"*, and an engineer about to drop a column asks *"who breaks if I do?"*. **Governance** is the unglamorous name for being able to answer those three questions on demand. Skip it and the P12 trust problem returns at platform scale: not one wrong number, but a platform nobody dares to trust or change.

## What you'll learn

- Generate a catalog instead of maintaining one by hand, so it stays true.
- Read lineage as blast-radius math before you change a table.
- Handle PII at the border, where the control is cheap and complete.
- Take the slice of DevOps a data engineer genuinely needs, and skip the rest.

**Prerequisites:** Part 5 (layers) and Part 12 (quality). Part 8's orchestration is what runs most of this.

## 1. Catalog: the platform's phone book

A **data catalog** answers question one. Minimum viable entry per table: what it is (one honest sentence), the owner (a *team*, not a person who'll leave), source and update schedule, quality/SLA status (P12's panel), and sensitivity level (below). Two rules decide whether yours becomes real infrastructure or an abandoned wiki: **generate, don't transcribe** — schemas, freshness, and lineage must be *harvested* from warehouse metadata, dbt manifests, and orchestrator runs (hand-maintained docs are S04-P11's drift, documentation edition); humans add only the judgment layer (descriptions, ownership, sensitivity). And **catalog the certified, not everything** — a catalog listing 3,000 tables where 2,800 are scratch is noise wearing a search box; mark the gold layer (P05) as certified and let the rest be findable-but-unblessed. That marking *is* the answer to "which orders is real."

## 2. Lineage: blast-radius math for data

**Lineage** — which upstreams feed this table, which downstreams consume it — answers question three, and you already own the raw material: dbt's `ref()` graph (P06), the orchestrator's DAG (P08), warehouse query logs. Wired together, three chores become cheap: **impact analysis** ("who breaks if I drop this column?" — answered before the incident instead of by it), **root-cause triage** (P12's four layers told you *which layer* broke; lineage tells you *what else* is downstream of the break — one glance replaces one incident channel full of "is X affected?"), and **the compliance answer** (S07-P10's "where does customer data live?" becomes a graph query, not an archaeology project). The honest advice: start with what dbt and the orchestrator give you for free; buy or build column-level lineage only when impact analysis actually hurts — it's the S01-P10 second-occurrence rule for metadata tooling.

## 3. PII: handle it at the border, not everywhere

The rule that makes privacy tractable came up in P05 and now gets its full statement: **classify and minimize at ingest, so the platform's interior is boring.**

- **Classify on entry**: every source column gets a sensitivity tag (public / internal / PII / restricted) as part of the P12 contract conversation — the tag travels with lineage, so "where is PII?" stays answerable as data flows.
- **Minimize at bronze**: drop what you'll never need, hash identifiers used only for joins, tokenize what needs reversibility. The best PII strategy is the S04-P04 storage rule inverted — the cheapest data to protect is data you didn't keep.
- **Mask by role at the warehouse**: dynamic masking / column policies show analysts `***-**-1234` while the fraud team sees the real value — one table, per-role views, enforced by the engine (P07's constraint instinct: checks that can't be skipped), not by N sanitized copies drifting apart (S02-P05's "one definition, one home").
- **Deletion is a feature you design** (S07-P10): a customer-erasure request must map to *findable* rows — which is lineage + tags again, plus P09's snapshot-expiration lever in the lakehouse.

## 4. The DevOps slice a DE actually needs

You don't need the whole S04 curriculum on day one, but four pieces are non-negotiable, and you've met them all: **containers** for pipeline code (S01-P05's process+cgroups; the same image in dev and prod ends "works on my laptop" for transforms — S01-P12's artifact rule); **CI for data code** — dbt compile + tests on a PR against a scratch schema, plus P12's suite as the merge gate: treat a broken data test like a broken unit test, blocking (S01-P09's CI-makes-it-automatic, pointed at SQL); **IaC for the platform substrate** (S04-P11 verbatim: warehouses, buckets, orchestrator clusters, IAM — clicked infrastructure is unreproducible infrastructure, and data platforms live long enough for that to compound); and **environments for data** — the twist the app world doesn't have: staging *code* is easy, staging *data* is the hard part; the pragmatic pattern is prod-read-only for dev transforms plus writable scratch schemas, or zero-copy clones where the warehouse offers them. What you must never do is the classic shortcut: testing on a CSV sample that has none of prod's pathologies — that's how P12's anomaly checks pass in dev and fire on day one in prod.

The maturity ladder, honestly: solo team — catalog is a README, governance is discipline; a few teams — generated catalog, dbt-level lineage, PII tags, CI gates (this covers most companies); platform scale — column-level lineage, access request workflows, a governance council. Climb when the *questions* start hurting, not when a vendor deck says so — governance ahead of its need is S01-P10's speculative abstraction with a compliance budget.

## Practice (25 minutes — generate a catalog and compute a blast radius)

Both artifacts in this part can be *derived* rather than written, which is the only version that stays true. Build both from a real schema:

```sql
-- duckdb gov.db — a small platform to introspect
CREATE TABLE stg_orders(order_id VARCHAR, customer_id VARCHAR, email VARCHAR, amount DECIMAL(10,2));
CREATE TABLE dim_customer(customer_id VARCHAR, email VARCHAR, country VARCHAR);
CREATE VIEW  fct_orders AS SELECT o.order_id, o.customer_id, o.amount, c.country
                           FROM stg_orders o JOIN dim_customer c USING (customer_id);
CREATE VIEW  rpt_revenue_by_country AS SELECT country, sum(amount) AS revenue
                                       FROM fct_orders GROUP BY 1;

-- 1. The catalog, GENERATED — never hand-maintained, therefore never stale
SELECT table_name, column_name, data_type FROM information_schema.columns ORDER BY 1, ordinal_position;

-- 2. PII discovery by convention: name patterns are a crude but honest first pass
SELECT table_name, column_name,
       CASE WHEN lower(column_name) SIMILAR TO '%(email|phone|ssn|address|name)%'
            THEN 'REVIEW: likely PII' ELSE '' END AS flag
FROM information_schema.columns WHERE flag <> '';

-- 3. Lineage as blast radius: who breaks if I change dim_customer?
SELECT view_name, sql FROM duckdb_views() WHERE sql ILIKE '%dim_customer%';
```

```bash
# 4. The same question in a dbt-style project, without any catalog tool:
grep -rl "ref('dim_customer')" models/ | sed 's/^/  direct consumer: /'
# then repeat for each of those models to walk the graph one hop further
```

Expected results: the catalog query produces the same table a wiki page would, except it cannot drift — regenerate it and it's correct, which is the whole argument for generating rather than writing. The PII scan is deliberately crude, and that's the point: a name-pattern pass finds most of it in minutes and gives you a review list, which beats a perfect classification scheme nobody ever runs. Query 3 turns "can I change this column?" into a list of names instead of a hallway conversation — and the first time you run it on a real warehouse and find eleven dependents you didn't know about is the moment lineage stops being a governance buzzword.

## Check yourself

1. Your team maintains a data dictionary in a wiki. It was accurate when written. What's wrong with this?
2. Someone asks whether they can drop a column. What do you need to answer safely, and what's the fallback if you don't have it?
3. Why is masking PII in reports weaker than handling it at ingestion?

<details><summary>See answers</summary>

1. It drifts silently. Schemas change with every deploy while the wiki changes only when someone remembers, so the document is wrong within weeks and — worse — nobody knows which parts. Generate the catalog from the schema so it's correct by construction, and reserve human writing for the things a schema cannot express: grain, ownership, and what a column *means*.
2. Column-level lineage, or failing that, a text search across your transformation code and BI definitions for the column name. The fallback when you have neither: deprecate rather than drop — stop populating it, announce it, wait one full business cycle, and watch for complaints before removing it. That's slower, but it degrades safely.
3. Because masking downstream protects one consumer, while the raw values still sit upstream where every other consumer and every future copy can read them. Handling it at the border — classify, minimize, mask or tokenize on the way in — protects every path at once, including the ones that don't exist yet.

</details>

## Key takeaways

- Governance = answering three questions on demand: which table is real (catalog), who breaks if I change this (lineage), where does sensitive data live (tags + lineage).
- Generate the catalog from metadata and certify the gold layer — hand-written docs drift, and a catalog of everything is a catalog of nothing.
- PII at the border: classify on entry, minimize at bronze, mask by role in the engine, and design deletion as a feature — the interior stays boring.
- The DE DevOps slice: containerized pipelines, CI with data tests as blocking gates, IaC for the substrate, and honest dev/prod data environments — climb the governance ladder when questions hurt, not before.

*Next up — Part 14: Thinking Like a Senior Data Engineer — the series finale.*
