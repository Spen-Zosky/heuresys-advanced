# Platform Capabilities — Discovery & Roadmap (AI · Data-mining · Scraping · CMS · BI)

> **Status**: **APPROVED PROGRAM** (Enzo, S958) — all 5 capabilities are in scope, sequence decided by CLI. Decomposition of the 5 capability directions into independent sub-projects with evidence-based feasibility. **No code until each sub-project is brainstormed → spec'd → approved → planned.** Execution model: **capability-by-capability in the sequence below**, each with its own `design → spec → Enzo gate → plan → implementation` cycle (the 5 sum to months of real work — not a single session). All included, none precluded. AI (②) already has a design spec: `2026-06-03-ai-semantic-matching-design.md`.
> Asset evidence: live DB probe + 60-module map (S958). The platform is HRMS/BPM, position-centric, ~60 API modules, PG16, Fastify 5, Next 15, `@heuresys/ui`. Data is synthetic case-study, no real PII (ADR-0023) — so AI/mining/scraping carry no privacy gate here.

## How to read this

Each capability is sized on: **use-cases** (grounded in the real domain + data), **what already exists** (asset reuse), **the gap** (what to build), **architecture options**, **effort** (S/M/L/XL), **risk**, **value**. Then a prioritized roadmap. Effort is order-of-magnitude, not a commitment — each sub-project gets a real estimate at its own brainstorm.

---

## ① BI — Business Intelligence / Analytics dashboards

- **Use-cases (real domain)**: workforce analytics (headcount by OU/role/tenant), KPI dashboards (now that `sys_kpi_definitions` 243 + `sys_kpi_targets` 248 exist), skill-gap heatmaps (skills 21939 × positions), attendance/overtime trends (3180 attendance rows), compensation equity/banding analysis, org-network metrics (the visualization graph).
- **Already exists**: `dashboard` + `observability` modules, **8 `visualization-*` modules** (graph model + RTL_ORG_CHART 158 nodes), KPI cluster, `compensation`, attendance; `@heuresys/ui` charts (d3/echarts per CLAUDE.md) + a `showcase/charts` gallery.
- **Gap**: aggregation/rollup endpoints (`/v1/analytics/*`) + dedicated dashboard pages composing `@heuresys/ui` charts + saved-view/filter model.
- **Architecture options**: **(A)** native — SQL aggregation views + `/v1/analytics/*` endpoints + Next pages with `@heuresys/ui` charts (consistent with the no-mock live-data doctrine, reuses everything). **(B)** embed an external BI tool (Metabase/Superset) — faster dashboards but a new service, auth bridging, off-brand UI, breaks the single-stack discipline.
- **Effort**: **M** (substrate is mostly there). **Risk**: low. **Value**: high (the data exists; the analytical views don't).
- **Recommendation**: option **A**. Best value-on-effort + lowest risk + zero new infra.

## ② AI — LLM-powered intelligence

- **Use-cases (ranked by fit)**: (1) **semantic skill-matching** position↔person↔ESCO (the richest data: 21939 skills + taxonomy + ESCO occupations); (2) succession/career recommendation (uses successor-readiness + career-paths); (3) KPI/analytics narrative insights ("explain this dashboard"); (4) JD/CV parsing → structured skills; (5) HR copilot/chatbot over the platform.
- **Already exists**: skills + `skill-taxonomy-edges` + ESCO occupation mappings + assessments + `learning-gaps` + `successor-readiness`. The repo is Anthropic-aware (Claude API natural fit).
- **Gap**: **no embedding substrate** — `pgvector` NOT installed (only `pg_trgm`). Need: pgvector + an embeddings pipeline (skills/positions/ESCO) + an LLM-call layer (Claude API) + prompt/eval harness.
- **Architecture options**: **(A)** start narrow — pgvector + embeddings for **semantic skill-matching** only (a contained, high-value first slice, no LLM-generation risk). **(B)** LLM-generation features (insights/copilot) — higher value but cost, latency, hallucination + eval burden.
- **Effort**: **L** (substrate to build). **Risk**: medium (API cost, quality/eval; no privacy gate — synthetic data). **Value**: high, differentiating.
- **Recommendation**: if AI is pursued, **start with (A) semantic skill-matching** — a self-contained slice that builds the embedding substrate and delivers immediate value, before any generative feature.

## ③ Data mining — predictive / inferential analytics

- **Use-cases**: attrition/flight-risk prediction, skill-gap forecasting, succession-readiness scoring, compensation-anomaly detection, org-network analysis (centrality/silos on the graph). Legacy had `model_predictions`/`performance_predictions` (267 rows, NOT imported) — evidence the domain expects this.
- **Already exists**: rich feature data (skills/positions/KPI/assessment/attendance/comp) + the visualization graph; `pg_trgm` for fuzzy matching.
- **Gap**: an analytics/ML pipeline (feature extraction → model → scored outputs into `sys_*_scores` tables that today are empty cat(ii) targets).
- **Note**: heavy overlap with ② (AI) and ① (BI). "Descriptive" = BI; "predictive/inferential" = data-mining; several use-cases (attrition, succession scoring) are AI-adjacent. Best treated **after** BI + AI substrate exist (it consumes both).
- **Effort**: **M-L**. **Risk**: medium (model quality, explainability). **Value**: high but depends on BI/AI foundations.
- **Recommendation**: sequence **after** ①/②; revisit scope once their substrate is in place (avoids building a 3rd parallel analytics stack).

## ④ CMS / documentation & content management

- **Use-cases**: HR policy management, **process documentation tied to the BPM/blueprint engine** (the natural hook — processes already modeled), knowledge base, employee handbook in ESS.
- **Already exists**: ESS `inbox`, BPM `blueprint-*`/`process-*` modules; **no content module**.
- **Gap**: a content model (`sys_documents` + versioning + categories) + an editor (rich-text) + publish/permission flow.
- **Architecture options**: **(A)** native — `sys_documents` module (7-step pattern) + a `@heuresys/ui` editor primitive + ESS/admin pages. **(B)** headless CMS (Payload/Strapi) — faster authoring UX but a new service + auth bridge + content lives outside the single PG/tenant model (breaks I5 tenant isolation discipline).
- **Effort**: **M**. **Risk**: low. **Value**: medium (useful, ties to BPM; not differentiating).
- **Recommendation**: option **A** if pursued; lower priority than ①/②.

## ⑤ Web scraping / crawling — external data ingestion

- **Use-cases (by safety)**: (1) **official open sources** — ESCO API/dumps (occupations/skills refresh), ISTAT/CCNL normative updates (legal, stable, the right first target); (2) salary/job-market benchmarks from licensed feeds; (3) job-board / LinkedIn scraping for sourcing — **ToS-risky, fragile, high-maintenance**.
- **Already exists**: `seed-acquisition-runs` + `seed-candidate-records` modules + the brownfield ingestion pipeline (staging → validate → upsert → lineage) — a ready ingestion backbone to plug a fetcher into.
- **Gap**: a fetcher/scheduler + per-source parsers + a watermark/delta layer (already noted missing in `brownfield.source_watermarks`).
- **Architecture options**: **(A)** API-first connectors to **official sources only** (ESCO/ISTAT) via the existing brownfield staging pattern — legal, robust. **(B)** generic web scraper (headless browser) for arbitrary sites — ToS/legal exposure, breakage, maintenance; recommend **against** for a production HR platform.
- **Effort**: **M-L**. **Risk**: **high** (ToS/legal for arbitrary scraping; maintenance). **Value**: medium (depends on source).
- **Recommendation**: **(A) official-source connectors only**, lowest priority; explicitly avoid arbitrary web scraping.

---

## Cross-cutting observations

- **Overlap**: ①②③ form one analytics/intelligence stack (descriptive → semantic → predictive). Building them as 3 independent silos would duplicate data pipelines. Sequence them so each reuses the prior's substrate.
- **No privacy gate** (synthetic data, ADR-0023) — but if real tenant data ever lands, AI/scraping acquire a privacy/consent layer (out of scope now, flag for later).
- **Single-stack discipline**: every "native vs external tool" choice above leans native (PG + Fastify + `@heuresys/ui`) to preserve tenant isolation (I5), the no-mock live-data doctrine, and brand consistency. External tools (Metabase/Strapi/headless browser) are faster locally but break those invariants.

## Prioritized roadmap (recommendation — you decide)

| Order | Capability | Why this slot | First slice | Effort |
|---|---|---|---|---|
| **1** | **① BI** | Highest value-on-effort; substrate ready; low risk; zero new infra; immediately uses the KPI cluster just built | `/v1/analytics/*` rollups + 2-3 dashboard pages (workforce + KPI + skill-gap) | M |
| **2** | **② AI — semantic skill-matching** | Differentiating; builds the embedding substrate the rest can reuse; contained first slice (no generative risk) | pgvector + skill/position embeddings + match endpoint | L |
| **3** | **③ Data-mining** | Consumes BI+AI substrate; avoids a 3rd parallel stack | attrition or succession-readiness scoring | M-L |
| **4** | **④ CMS** | Useful, low-risk, ties to BPM; not differentiating | `sys_documents` + editor + ESS knowledge base | M |
| **5** | **⑤ Scraping (official sources only)** | Highest risk, narrowest safe scope | ESCO/ISTAT connector on the brownfield pipeline | M-L |

**Rationale for #1 = BI**: it's the only one with the substrate already in place (dashboard/charts/graph/KPI), zero new infrastructure, low risk, and it cashes in the KPI reconciliation just completed. It also surfaces the data that makes ②/③ obviously valuable.

## Execution status & next step

All 5 approved (Enzo, S958). Sequence (CLI-decided): **① BI → ② AI → ③ data-mining → ④ CMS → ⑤ scraping**. Implementation order leads with BI (substrate ready, lowest risk, cashes in the KPI cluster); design/spec can be authored in any order.

| # | Capability | Design/spec | Plan | Implementation |
|---|---|---|---|---|
| ① | BI / analytics | ✅ `2026-06-03-bi-analytics-design.md` | pending Enzo review | — |
| ② | AI semantic matching | ✅ `2026-06-03-ai-semantic-matching-design.md` | pending Enzo review | — |
| ③ | data-mining | — | — | — |
| ④ | CMS | — | — | — |
| ⑤ | scraping (official sources) | — | — | — |

**Next**: Enzo reviews the AI spec; in parallel CLI designs ① BI (the implementation-lead). Each capability advances design → spec → review → plan → implement. The one external decision pending is the **Voyage API key** for AI's embedding substrate (see AI spec §4).
