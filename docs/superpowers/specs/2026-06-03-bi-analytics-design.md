# BI — Analytics Engine — Design Spec

> **Status**: DESIGN (S958, 2026-06-03). Capability ①/5 (implementation-lead) of the platform-capabilities program (`2026-06-03-platform-capabilities-roadmap.md`). **No code until reviewed + approved + planned.**
> **Core principle**: ONE analytics foundation (dimensional rollup layer + dashboard shell); every analytics view is an additive query/page on it. All scenarios additive, none precluded — same inclusive pattern as the AI spec.

## 1. Goal

Dimensional analytics / BI over the live HRMS/BPM data. The existing `dashboard` module is a **role-gated home summary** (counters, 8-week trends, learning deadlines, recent activity) — BI does **not** replace it; it adds the **drill-down dimensional analytics** that doesn't exist yet (by OU / role / tenant / period, with filters), cashing in the just-built KPI cluster.

## 2. Architecture — the analytics foundation

- **New API module `analytics`** (7-step pattern): `/v1/analytics/*` rollup endpoints. Raw parameterized SQL aggregation; **role + tenant scoping reused from `dashboard`** (PLATFORM / TENANT / TEAM via FK + middleware, I5 — never RLS).
- **Aggregation layer**: SQL views + CTEs by default; **materialized views** for heavy rollups (refresh job) — decided per-endpoint at plan time based on cost.
- **Frontend**: `apps/web/src/app/(authenticated)/analytics/*` pages composing **`@heuresys/ui` charts** (bar/line/heatmap/network — d3/echarts already in the lib). No new chart deps (Design-System rule). Live-data only (no mock/placeholder — `NEXT_SESSION_MVP_2A` doctrine): every cell from a real `/v1/analytics/*` call.
- **Shared filter/scope model**: dimensional filters (tenant / OU / period / role) + the role-gating from `dashboard`; optional saved-views (phase 3).

## 3. Scenarios as additive views (same foundation)

| Phase | View | Data (all live) | Chart |
|---|---|---|---|
| **1** | **Workforce analytics** | headcount by OU/role/tenant, distributions (161 users, 162 positions, 26 OUs, 24 teams) | bar / treemap |
| **1** | **KPI analytics** | the 243 definitions + 248 targets: achievement %, by-OU/period, trend | line / gauge |
| **2** | **Skill coverage / gap** | skill-evidence (902) × skills (21939) × positions/roles; coverage heatmap | heatmap |
| **2** | **Attendance / overtime** | attendance (3180) + overtime trends by OU/period | line / area |
| **2** | **Compensation equity** | comp bands × positions × OU; banding spread, equity | box / scatter |
| **3** | **Org-network metrics** | the visualization graph (RTL_ORG_CHART 158 nodes): span-of-control, depth, centrality | network (reuse `visualization-*`) |
| **3** | saved views + export (CSV/PDF) | — | — |

## 4. Technical decisions (recommended)

1. **Aggregation**: SQL views/CTE first; promote to **materialized view + scheduled refresh** only for endpoints proven slow (avoid premature MV maintenance). Decided per-endpoint at plan time with `EXPLAIN`.
2. **Charts**: `@heuresys/ui` only (no new deps). If a needed chart type is missing in the lib, it's added **in `ux-design-shared`** and consumed via `@heuresys/ui` (never built in this repo — Design-System rule).
3. **Scope**: reuse `dashboard`'s `highestScope`/`ScopeFilter` (PLATFORM/TENANT/TEAM) — consistent gating, no new model. Add dimensional filters on top.
4. **No external BI tool** (Metabase/Superset): native PG+Fastify+`@heuresys/ui` preserves tenant isolation (I5), live-data doctrine, brand — per the roadmap's single-stack discipline.

## 5. Components & data flow

```
sys.* (users/positions/OU/attendance/kpi_targets/comp/skill-evidence) + viz graph
   └─► analytics repository (parameterized SQL rollups, scope-filtered)
        └─► analytics service (ActorContext scope, reused from dashboard)
             └─► /v1/analytics/{workforce,kpi,skills,attendance,compensation,network}
                  └─► TanStack Query hooks ─► /analytics/* pages ─► @heuresys/ui charts
```

- Migration(s) `000057+` (if MVs/indexes needed): idempotent aggregation views.
- Shared Zod schemas in `@heuresys/shared/schemas/analytics`.
- Each endpoint: `requirePermission('analytics:view')` + scope filter; returns typed rollup rows + the dimensions used.

## 6. Testing

- Integration (`apps/api/test/analytics.integration.test.ts`): RBAC (`analytics:view`) + tenant/team scope isolation + **deterministic aggregates on the seed** (e.g. headcount sums to 161; KPI achievement computed from the 248 targets) + empty-state for an empty scope.
- E2E (Playwright, live data): an admin loads `/analytics/workforce` + `/analytics/kpi`, asserts charts render with seed-derived numbers (no mock).

## 7. Risks

| Risk | P | I | Mitigation |
|---|---|---|---|
| Aggregation perf on big tables | med | med | MV + index for proven-slow endpoints; `EXPLAIN` at plan |
| Cross-tenant scope leak | low | high | reuse dashboard scope (FK+middleware, I5); integration test asserts isolation |
| Missing chart type in `@heuresys/ui` | med | low | add in `ux-design-shared` → bump `@heuresys/ui`; never build in-repo |
| Scope-creep (too many views at once) | med | med | phased (P1 workforce+KPI first); each view ships independently |

## 8. Out of scope (this spec)

Predictive analytics (attrition/forecasting) = capability ③ data-mining (consumes this foundation). This spec is descriptive analytics only. Saved-views + export are phase 3 (ship core read views first).
