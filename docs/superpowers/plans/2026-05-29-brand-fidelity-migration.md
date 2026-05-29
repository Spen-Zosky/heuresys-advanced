# Plan — Brand-fidelity migration (real app → canonical UX/IX by object type)

**Date**: 2026-05-29 · **Owner**: CLI (Claude) · **Status**: DRAFT — awaiting Enzo approval before mass execution.

## Goal (Enzo, verbatim intent)

> Le dashboard "vere" e i loro oggetti interni devono avere **esattamente** il design UX/IX e i comportamenti della showcase canonica, **in funzione della loro tipologia**.

Translation: every real page in `apps/web/src/app/(authenticated)/*` must render with the canonical branded components + behaviors (as demonstrated by `/showcase/system-health`, `/showcase/shell`, `/showcase/dashboard-cards`, `/showcase/tables`…), fed by real `/v1/*` data. No basic/plain objects; each object type maps to its canonical `@heuresys/ui` component.

## Where we are (verified 2026-05-29)

- **Done (uncommitted, not yet E2E-verified)**: `(authenticated)/layout.tsx` rebuilt to branded `DashboardShell` (sidebar + header + footer, role-gated, testids preserved) — **Phase 1 shell**. New route `app/page.tsx` (logo `/app` redirect). typecheck ✓, `next build` ✓, console clean ✓ on `/dashboard` + `/positions`.
- **Done basic (uncommitted)**: `/dashboard` page restyled to `PageHeader`-ish + `KPIStrip` + real `AuditFeed` + `EmptyState`. **This is below canonical fidelity** — to be upgraded in this plan (reference page).
- **Not done**: the other ~40 pages still use basic objects (plain tables, plain cards).
- **Open anomaly**: theme propagation — `/me` rendered light while `/dashboard` rendered dark in dev. Must be locked (see Foundation A).
- **Dev stack** currently running locally (API :3001 + web :3000). VM showcase live at `:3013/showcase/*` (reference).

## Foundation A — Theme propagation (do first; blocks everything)

Infra already present (verified): `RootLayout` sets `<html class="dark">` + boot script (localStorage `heuresys-theme`, default dark); `globals.css` `@import "@heuresys/ui/styles"` + `@source ".../@heuresys/ui/dist/**"` + `@theme inline` token map + `:root` (light) / `.dark` (dark `!important`) tokens.

Tasks:
1. Reproduce the `/me`-light anomaly in **production** mode (`next build` + `next start`), not dev (dev HMR/cold-compile is a known false-signal). If it only happens in dev → document as dev-only, not a prod bug.
2. If real: pinpoint cause. Prime suspects — (a) palette inline injection on `<html>` overriding dark tokens; (b) a page/segment not under the themed surface; (c) `ssr:false` boundary on some routes producing a light first-paint. Fix so **every** authenticated route inherits the dark canonical theme consistently.
3. Add a tiny E2E/visual assertion that `getComputedStyle(documentElement)` has the `dark` class + `--background` resolves to the dark token on a sample of routes, to prevent regression.

**Exit**: every `(authenticated)/*` route + `/me/*` renders dark-canonical, no flicker, in production build.

## Foundation B — Type → Component contract

Single source of truth for "which canonical component for which object type". Applied uniformly across all pages.

| Object type | Replace (current) | Canonical `@heuresys/ui` | Key behaviors |
|---|---|---|---|
| Page title block | plain `<h1>` | `PageHeader` | title, description, breadcrumbs, actions, badges |
| KPI / single metric | `KPIStrip` basic | `StatsCard` / `KPIStrip` rich | trend ▲▼, sparkline, target bar, icon tone |
| Data table / entity list | plain `<table>` + `Card` | `DataTable` / `DataTableWithCrossHair` | sort, filter, cross-hair, hover, status pills, progress bars, row chevron |
| Status / health | plain text | `StatusIcon` + Badge pill | tone colors success/warning/danger |
| Activity / audit log | none / plain list | `AuditFeed` | icon+tone per event, relative time |
| Empty state | plain text | `EmptyState` | icon + title + description + action |
| Tenant/fleet overview | plain table | `TenantFleetTable` | status dot, pool-util bars |
| RBAC matrix | plain (admin/roles) | `RbacMatrix` | interactive matrix |
| Trend / chart | none | `EChartsCard`, `Sparkline`, `LinearGauge`, `RadialGauge`, `CapabilityRadar`, `SkillHeatmap` | per data shape |
| Forms / wizards | basic `Input` | `FormWizard` + validated fields | steps, validation |
| Detail panels | `Card` | `Card` composition + `PageHeader` | hover lift |

Deliverable: short doc `docs/architecture/brand-component-contract.md` codifying this, referenced by every page PR.

## Page rollout order (phased; each phase = its own verified, committed unit)

0. **Foundation A + B** (theme lock + contract doc). Commit.
1. **Reference page — `/dashboard`** to FULL canonical fidelity (rich `StatsCard`s, themed sections, real `AuditFeed`, `EmptyState`). Proves the pattern end-to-end. Commit.
2. **List pages** — `/users`, `/positions`, `/tenants`, `/gaps`, `/skills`, `/kpis` → `DataTableWithCrossHair` (status pills, filters, hover, chevron). Commit per page or small batch.
3. **Detail pages** — `/users/[id]`, `/positions/[id]/{skills,kpis,learning}`, `/tenants/[id]/*` → `PageHeader` + `Card` composition. Commit.
4. **Intelligence / charts** — `/compensation-intelligence`, `/visualizations`, `/career-succession`, `/organization/org-chart` → charts/gauges (gated on data availability, see API section). Commit.
5. **ESS `/me/*`** (≈14 pages) → branded ESS pattern (the `/showcase/primary-initial-page` model: quick KPIs, quick-actions, activity). Commit per cluster.
6. **Admin/Ops** — `/admin/roles` → `RbacMatrix`; `/system-health` → confirm `SystemHealthDashboard`; `/blueprints`, `/processes`, `/brownfield-adaptation`, `/seed-acquisition/runs`. Commit.
7. **Cleanup** — remove the now-redundant `/showcase/*` routes from `apps/web` (kept only in `apps/showcase`); drop the `_ui-client` ssr:false proxy if no longer needed. (Enzo already approved this cleanup.) Commit.

## API extensions needed (API-first; do before the UI that needs them)

Canonical behaviors that need data the current API does NOT return → mini API milestones (shared Zod schema → repository/service/route → integration test → then UI):

- **Dashboard trends/sparklines**: week-over-week deltas + short series for the StatsCards. Extend `GET /v1/dashboard/widgets` (or a new `/v1/dashboard/trends`).
- **Table health metrics**: per-tenant/per-resource status, errors/1h, pool-util (for the TenantFleet-style tables). New aggregate endpoints where the data exists.
- **Where data genuinely doesn't exist**: render the static/current-value variant of the component (no fabricated trends — live-data doctrine). Flag each such case in the page PR.

## Verification protocol (every page, non-negotiable)

1. typecheck (`tsc --noEmit`) green.
2. `next build` green (catches SSR/CW-B59).
3. Playwright E2E green — **run against a production build** (`next start`), not `next dev`, to avoid cold-compile false-negatives. Preserve/update load-bearing testids (`nav-*`, `dashboard-*`, `counter-*`, `app-logout`, `app-user-email`).
4. Console clean (no hydration/runtime errors).
5. Visual review vs the canonical showcase counterpart (theme inherited, correct component per type, behaviors present).
6. Atomic commit per page/cluster. Push only on Enzo's ok.

## Risks / honesty register

| Risk | Impact | Mitigation |
|---|---|---|
| Scope is large (~40 pages × per-type) | multi-session effort | phased, each phase shippable + verified independently |
| Full behavior fidelity needs API data not present | partial fidelity on charts/trends | API-first mini-milestones; honest static fallback where no data |
| `@heuresys/ui` barrel = heavy bundle (~2.16MB First Load) | perf | known; consider subpath/tree-shake later (separate concern, not blocking) |
| Layout change touches all pages | wide blast radius | already proven (Phase 1 build+console green); E2E gate per phase |
| Dev-mode E2E false-negatives | wasted cycles | always verify E2E in production build |

## Decision points for Enzo (before execution)

1. Approve the **type→component contract** (Foundation B table) — or adjust mappings.
2. Approve the **rollout order** (or reprioritize which pages first).
3. **API extensions**: green-light extending endpoints for trends/health metrics, or accept static-value fidelity where data is missing?
4. Pace: how many phases per session; push policy.

---
*Current uncommitted work (Phase 1 shell + basic dashboard + `/app` route) is the starting point for Phase 0/1. It will be verified (prod E2E) and committed as execution begins, with the dashboard upgraded to full canonical fidelity in Phase 1.*
