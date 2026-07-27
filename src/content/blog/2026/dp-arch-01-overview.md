---
title: 'The Data Platform Architecture Map'
description: 'There is no best data platform architecture — only one that fits your constraints. The five axes that decide, and a map of every school this series will visit.'
date: 2026-07-28
category: Architecture
tags: [dp-architectures, data-platform, architecture, data-engineer]
lang: en
translationKey: dp-arch-01
series: dp-architectures
part: 1
cover: images/dp-arch-map.png
---

Ask five architects to design "a data platform" and you will get five different diagrams — and, uncomfortably, all five can be right. A data platform for a 10-person startup, a 500-store retailer, and a regulated bank are three different machines that happen to share a name.

This series is a guided tour of the major architecture schools — warehouse, lakehouse, streaming, mesh, small data, multi-tenant, and more — with one question asked relentlessly: **under which constraints does this design win?**

![The Data Platform Architecture Map](images/dp-arch-map.png)

## The uncomfortable premise: there is no "best"

Architecture debates sound like technology debates ("lakehouse vs warehouse!") but are actually **constraint debates**. Every school on this map was invented by someone whose constraints made the previous school painful:

- The data lake was born because warehouses couldn't hold cheap, messy, unstructured data.
- The lakehouse was born because lakes became swamps nobody could trust.
- Kappa was born because maintaining Lambda's two codepaths hurt.
- Data mesh was born because one central team became everyone's bottleneck.
- And the "small data" counter-movement was born because most companies adopted all of the above while their entire history still fits on one large server.

None of these inventions deleted the previous one. **They stacked.** Your job is not to pick the newest — it's to pick the one whose birth-pain matches your current pain.

## The five axes that actually decide

Before any diagram, score your situation on five axes. Every recommendation in this series traces back to them:

| Axis | The question | Why it dominates |
|---|---|---|
| **Scale** | GBs, TBs, or PBs — and growing how fast? | Below ~1 TB, almost everything works; above, physics starts voting |
| **Latency** | Decisions in months, minutes, or milliseconds? | Real-time is 10× the operational cost of batch — pay only if the business acts on it |
| **Team** | 1 engineer, a team, or many domain teams? | Architectures have headcount requirements; a mesh with 3 engineers is a diagram, not a platform |
| **Budget** | What can you spend to run it monthly? | Cost is an architecture input, not an afterthought (Part 12 is entirely this) |
| **Compliance** | PII? Residency? Audit? Regulators? | One "data must stay on-prem" flips the whole map (Part 10) |

Write your five answers down now — seriously, in a note. Each part of this series ends by telling you which answers point toward, or away from, that architecture.

## The map

```mermaid
flowchart TB
    subgraph Foundational["Foundational schools"]
        W["Classic Warehouse<br/><i>P2 — BI & reporting</i>"]
        L["Lake & Lakehouse<br/><i>P3 — cheap scale + trust</i>"]
    end
    subgraph Latency["Latency-driven"]
        LK["Lambda vs Kappa<br/><i>P4 — streaming</i>"]
        RT["Real-time OLAP<br/><i>P5 — sub-second serving</i>"]
        ED["Event-driven & CDC<br/><i>P6 — data in motion</i>"]
    end
    subgraph Org["Organization-driven"]
        M["Data Mesh<br/><i>P7 — many domain teams</i>"]
        SD["Small Data<br/><i>P8 — most companies</i>"]
        MT["Multi-tenant<br/><i>P9 — one platform, many customers</i>"]
    end
    subgraph Constraint["Constraint-driven"]
        RG["Regulated industries<br/><i>P10</i>"]
        AI["AI-ready<br/><i>P11</i>"]
        C["Cost / FinOps<br/><i>P12</i>"]
        MG["Migration<br/><i>P13</i>"]
    end
    Foundational --> Latency --> Org --> Constraint --> D["Decision framework<br/><i>P14 — choose yours</i>"]
```

Four groups, one ending. The **foundational** schools answer "where does data live and how is it shaped". The **latency-driven** group exists because someone said "yesterday's data is too old". The **organization-driven** group exists because architecture must match the shape of your company (Conway's law does not spare data teams). The **constraint-driven** group are overlays — regulation, AI-readiness, cost, and the art of migrating between all of the above without dropping the business.

## Same problem, three customers, three right answers

To make "it depends" concrete, here's one problem — *"we want dashboards for sales and inventory"* — solved correctly three ways:

- **Startup (2 engineers, 50 GB, no compliance):** Postgres replica + DuckDB + a BI tool. Zero distributed systems. This is Part 8, and it is not a compromise — it is the correct architecture for these constraints.
- **Mid-size retailer (a data team, 5 TB, daily + some hourly):** a warehouse or lakehouse with medallion layers, batch ELT, orchestrated — Parts 2–3, the industry's bread and butter.
- **Bank (many teams, regulators, on-prem data):** the same logical layers, but wrapped in PII zoning, audit lineage, residency controls, hybrid deployment — Part 10. The diagram doubles in size before the first table is loaded, and that's the cost of the constraint, not over-engineering.

Same business question. Three architectures. All correct. That's the whole thesis of this series.

## Two warnings before we start

1. **Resume-driven architecture is real.** The gravitational pull toward "what's on the conference stage" is strong. The map above has no "trendy" axis — that's deliberate.
2. **Architectures are rented, not bought.** Constraints change: the startup grows, the batch business goes real-time. Part 13 (migration) is on the map because *every* long-lived platform eventually walks between schools. Design with the exit in mind.

## Key takeaways

- There is no best data platform architecture — each school was born from a specific pain, and they stack rather than replace each other.
- Five axes decide everything: scale, latency, team shape, budget, compliance. Score yourself before touching a diagram.
- The same business need has different correct architectures for a startup, a mid-size company, and a regulated enterprise.
- Beware resume-driven architecture; design with migration in mind — constraints will change.

*Next up — Part 2: The Classic Data Warehouse, Still Undefeated.*
