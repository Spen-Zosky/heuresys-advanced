# Brand Component Contract — object type → canonical `@heuresys/ui`

> **Status**: APPROVED (Enzo, S947 2026-05-29) — referenced by every page PR in the brand-fidelity migration.
> **Authority**: this is the single source of truth for "which canonical component for which object type". Every real page in `apps/web/src/app/(authenticated)/*` (admin SPA + ESS `/me/*`) must render with the components below, fed by real `/v1/*` data (LIVE DATA E2E ONLY doctrine — see `NEXT_SESSION_MVP_2A.md`).
> **Reference implementations**: the `/showcase/*` routes (`dashboard-cards`, `tables`, `page-types`, `charts`, `forms`, `primary-initial-page`, `system-health`) are the canonical visual/behavioral references. Component prop signatures below are verified against `node_modules/@heuresys/ui/dist/index.d.ts` @ `@heuresys/ui@0.1.1`.

## 0. Import rule (non-negotiable — CW-B59)

`@heuresys/ui` is a single-barrel package: importing **any** symbol eagerly evaluates heavy class-based libs (three / @react-three, echarts, d3, recharts) at module load. During the Next build's server-side page-data collection those hit a CJS/ESM interop edge ("Class extends value undefined") and crash the build.

- **Real authenticated pages are all `"use client"`** (they use TanStack Query). Empirically (verified S946/S947, `next build` exit 0) a `"use client"` page/layout may import **directly** from `@heuresys/ui` for the lightweight components (Card, PageHeader, StatsCard, KPIStrip, AuditFeed, EmptyState, StatusIcon, Badge, DataTable, DataTableWithCrossHair, Button, Input, etc.). This is the default for migration.
- **Heavy chart components** (`EChartsCard`, `CapabilityRadar`, `SkillHeatmap`, three-based viz) — verify `next build` exit 0 after adding them to a page. If a build crash recurs, fall back to a per-page client proxy (`dynamic(() => import("@heuresys/ui").then(m => ({ default: m.X })), { ssr: false })`) exactly like `apps/web/src/app/showcase/_ui-client.tsx`.
- **Server components** (anything exporting `metadata`) must **never** import `@heuresys/ui` directly — use a `ssr:false` client proxy. (Authenticated pages don't hit this; showcase pages do.)

## 1. Type → component map

| Object type | Replace (current plain) | Canonical `@heuresys/ui` | Key props / behaviors | Showcase ref |
|---|---|---|---|---|
| Page title block | plain `<h1>` + `<p>` | **`PageHeader`** | `title, description, breadcrumbs, actions, badges, divider` | `/showcase/page-types` |
| KPI / single rich metric | plain number | **`StatsCard`** | `label, value, unit, trend (number), trendDirection 'up'\|'down'\|'flat', sparkline number[], icon, animate` — animated count-up + sparkline + trend badge | `/showcase/dashboard-cards` |
| KPI row / strip | manual grid of divs | **`KPIStrip`** (`items: KpiCardData[]`) | per item: `label, value, unit, icon, iconTone, sparkline, sparklineTone, footerLeft, footerRight, body` | `/showcase/dashboard-cards` |
| Data table / entity list | plain `<table>` + `Card` | **`DataTable<T>`** (generic, tanstack `columns`/`data`/`pageSize`/`emptyMessage`) — wrap in **`DataTableWithCrossHair`** (`children`, `enableCrossHair`, `caption`) for the cross-hair/hover affordance | sort, filter, hover, cross-hair, status pills, row chevron, progress bars | `/showcase/tables` |
| Status / health indicator (icon-only) | raw text | **`StatusIcon`** (`icon, tone, size`) + **`Badge`** (`variant`) | tone colors success/warning/danger/info | `/showcase/icons`, `/showcase/tables` |
| Status / health indicator (badge/pill) | raw text | **`StatusPill`** (`tone, children`) / **`StatusBadge`** (`value`) | `statusTone()` maps ~30 known backend strings to a tone; token-driven since @heuresys/ui 1.1.0 — tinted background + `-ink` text ramp, WCAG AA in both themes | `/showcase/tables` |
| Activity / audit log | none / plain `<ul>` | **`AuditFeed`** (`events: AuditEvent[], title, subtitle, onViewAll`) | per event `icon, tone, title, description, meta` (relative time via `formatRelativeTime`) | `/showcase/dashboard-cards` |
| Empty state | plain text | **`EmptyState`** (`icon, title, description, action`) / **`ErrorState`** (`+retry`) | branded empty/error surface | `/showcase/page-types` |
| Tenant / fleet overview | plain table | **`TenantFleetTable`** (`rows, title, subtitle, onOpenDetail, onSearch, onOpenFilters`) | status dot, pool-util bars, search/filter slots | `/showcase/tables` |
| RBAC matrix | plain table | **`RbacMatrix`** (`roles, areas, assignments, readonly, onChange`) | interactive role×area matrix | `/showcase/page-types` |
| Trend / chart | none | **`EChartsCard`** (`option, height, loading, onEvents, ariaLabel`), **`Sparkline`** (`data, stroke, fill, showPoints, showMinMax`), **`LinearGauge`** (`value, max, label, segments, tone`), **`RadialGauge`** (`value, max, min, label, unit, size, thickness, tone`), **`CapabilityRadar`** (`axes, series, max, rings`), **`SkillHeatmap`** (`rows, cols, cells, colorScale, onCellClick`) | per data shape; heavy → see import rule | `/showcase/charts` |
| Forms / wizards | basic `<input>`/`<select>` | **`FormWizard<T>`** (`steps, initial, onComplete, onSaveDraft, draft, title`) + `Input` (`label, helperText, errorText, variant`) | steps, validation, draft save | `/showcase/forms` |
| Detail panel | bare `Card` | **`Card`** composition (`Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter`) + **`PageHeader`** | hover lift (`.hx-card-hover`), `rounded-card`, `shadow-card`, `bg-card` tokens | `/showcase/page-types` |
| Graph / diagram | plain | **`MermaidDiagram`** (`source, ariaLabel`) | declarative graph render | `/showcase/page-types` |
| Time-range selector | plain buttons | **`TimeRangeSelector`** (`value, onChange, options`) | controlled pill radiogroup | `/showcase/system-health` |

`iconTone` / `tone` palette tokens: `success | warning | danger | info | palette-1 | palette-2 | palette-3 | palette-4`.

## 2. Theming (Foundation A)

Every authenticated route inherits the **dark canonical theme** from `RootLayout` (`<html class="dark">` + boot script, default dark, override via `localStorage heuresys-theme`). Token map in `apps/web/src/app/globals.css` (`:root` light / `.dark` `!important` dark). Components consume tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-palette-N`) so palette/theme switches propagate without per-page work. Pages must use these utility classes, never hard-coded hex.

## 3. Per-page verification protocol (every page, non-negotiable)

1. `tsc --noEmit` green (TS strict: `noUncheckedIndexedAccess`, narrow `T|undefined`; unused → `_`).
2. `next build` green (catches SSR/CW-B59).
3. Playwright E2E green — run against a **production build** (`next start`), not `next dev` (cold-compile = false-negative).
4. Console clean (no hydration/runtime errors).
5. Visual review vs the showcase counterpart (theme inherited, correct component per type, behaviors present).
6. Load-bearing testids preserved/updated (`nav-*`, `dashboard-*`, `counter-*`, `app-logout`, `app-user-email`).
7. Atomic commit per page/cluster. Push only on Enzo's ok.

## 4. Live-data rule

No mock data, no fixtures, no hard-coded `initialData`/`placeholderData`. Every cell/chart/table/form fed by a real `/v1/*` call. Where a canonical behavior needs data the API doesn't return (trends/sparkline week-over-week, per-tenant health, pool-util): **API-first** — open a mini API milestone (shared Zod schema → repository → service → route → integration test) before the UI. Decision S947: API-first everywhere; no fabricated trends.
