# 16 — System Health / Admin Dashboard Patterns

Specs for the 14 widgets that compose the SUPERUSER / PLATFORM_ADMIN observability dashboard. Reference implementation: `ux-design/prototypes/superuser-system-health.html`.

## 1. Page architecture (mandatory order)

```text
[1]  Alert banner (top, dismissible, severity-coded)
[2]  Page header — title + status pill + time range + Aggiorna + Export
[3]  KPI strip — 5-card horizontal grid
[4]  Tenant fleet table — cross-tenant operational status
[5]  Error rate breakdown (3-col) + Incident timeline (2-col) — 5-col grid
[6]  Charts row — Latency p50/p95/p99 (2-col) + Active sessions by role (1-col) — 3-col grid
[7]  SQL slow query top-10 — full-width data-dense table
[8]  RBAC permissions matrix — full-width sticky-column matrix
[9]  Live log stream (3-col) + Audit feed (2-col) — 5-col grid
[10] Footer (universal rule + observability right-area)
```

## 2. KPI Strip

5-card grid: `grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3`.

Each card structure:

```html
<article class="rounded-card border border-border bg-card p-4 shadow-card">
  <div class="flex items-start justify-between">
    <div>
      <div class="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        API uptime · 24h
      </div>
      <div class="mt-2 flex items-baseline gap-1.5">
        <span class="num text-2xl font-semibold text-foreground">99.97</span>
        <span class="text-sm text-muted-foreground">%</span>
      </div>
    </div>
    <span class="inline-flex h-7 w-7 items-center justify-center rounded-control bg-success/10 text-success">
      <svg><!-- check / icon --></svg>
    </span>
  </div>
  <!-- inline mini-sparkline (SVG) -->
  <svg viewBox="0 0 120 28" class="mt-3 h-7 w-full"><!-- polyline + area --></svg>
  <div class="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
    <span>2 incidents</span>
    <span class="text-success">▲ 0.04%</span>
  </div>
</article>
```

Canonical 5 KPIs:
1. **API uptime · 24h** — `99.97%`, sparkline success, delta success
2. **DB pool · pg 16** — `18 / 50 conn`, mini progress bar palette-2, peak indicator
3. **RBAC cache** — `388 mappings · 8 roles loaded · LOADED · last refresh 14:38:12`
4. **Active tenants** — `4 / 4`, 4 sliver mini-grid color-coded by status, user count + warn count
5. **Auth integrity** — `0 replay`, 3-col grid Login/Failed/Rotation counts

## 3. Tenant Fleet table

Columns: `Tenant | Status | Users (right) | Tables (right) | Errors · 1h (right) | Last activity | Pool util | <chevron>`.

- **Tenant** cell: 8×8 colored badge with 2-letter initials (palette-N based on hash) + name + monospace `tenant_id` short hash
- **Status** pill: success/warning/danger with leading dot
- **Pool util**: 20×1.5 grey track + colored fill (success<60%, warning ≥60%, danger ≥85%)
- **Errors · 1h**: numeric with color tint (`text-muted-foreground` when 0, `text-warning` when ≥10, `text-danger` when ≥50)
- **Row hover**: cross-hair active + magnifier on parent card

## 4. Error Rate Breakdown

3-col card containing:

- Header: title + overall error rate (big number) + delta pill
- **Status code distribution**: stacked horizontal bar (success 2xx / info 3xx / warning 4xx / danger 5xx) with proportional widths
- 4-col legend grid: dot + label + count
- Divider
- **Top erroring endpoints**: 5 rows, each `[method+path] [status·count] [sparkline] [delta]`. Method colored: GET=info, POST=warning, PATCH=warning, DELETE=danger.

## 5. Incident Timeline

2-col card containing:

- Header: title + 3 severity pills (P1·count / P2·count / P3·count)
- `<ol class="relative space-y-4 border-l border-border pl-5">` with each `<li class="relative">`:
  - Ring dot: `absolute -left-[27px] mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-{severity} ring-4 ring-{severity}/20`
  - For ACTIVE: inner pulse-dot. For RESOLVED: inner check SVG (3-stroke white)
  - Title + status pill (ACTIVE/RESOLVED)
  - Description (muted)
  - Meta line monospace `[time] · [duration/elapsed] · [acks/extra]`
- Footer link "view full incident log →"

## 6. SQL Slow Query Top-10

Full-width data-dense table.

Columns: `# | Query | Tenant | Calls (right) | p95 (right) | Mean (right) | Total time | Last seen | <chevron>`.

- **Query** cell: 2-line — first line is the truncated SQL with palette-3 syntax color for keywords (`SELECT`, `FROM`, `WHERE`, `JOIN`, `INSERT`, `UPDATE`); second line is the operation label + diagnostic note (muted)
- **Tenant** pill: colored by tenant brand color (RTL_BANK=palette-1, GENESIS_DEMO=warning, etc.)
- **p95** colored: `text-danger` ≥1000ms, `text-warning` ≥300ms, `text-foreground` otherwise
- **Total time**: 24×1.5 grey track + colored fill (danger ≥80% of leader, warning ≥30%, palette-2 otherwise) + readable label "9.6 min"
- Header buttons: `Reset stats` (ghost) + `Open EXPLAIN` (palette-3 filled)
- Footer: monospace counter `showing 10 / 247 tracked queries`
- **Cross-hair**: enabled by default (data-dense rule trigger)

## 7. RBAC Permissions Matrix

Full-width matrix with sticky first column.

- **Sticky first column**: `<td class="sticky left-0 bg-card px-5 py-2.5">` with permission code (monospace 12px foreground) + description (monospace 10px muted)
- **8 role columns**: PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER, USER, READ_ONLY (header text colored per role brand)
- **Tri-state cells**:
  - `granted` → `bg-success/20 text-success` filled square with check icon
  - `scoped` → `bg-warning/20 text-warning` filled square with `◐` glyph (always with `title="<scope>"`)
  - `denied` → `bg-muted text-muted-foreground/60` filled square with `·` dot
- Header includes legend: 3 inline keys (granted / scoped / denied) + Export CSV button
- **Cross-hair**: enabled by default + sticky cell row-hover override active
- Footer: counter `showing N / 47 permission codes` + "view full matrix →" link

## 8. Live Log Stream

3-col card.

- Header: pulse-dot info + title "Live log stream" + source pill `fastify · pino`
- Filter pills row: `all` (ghost) | `info` (active) | `warn` | `error` | pause button (square)
- `<ol class="max-h-[420px] divide-y divide-border/60 overflow-y-auto" aria-live="polite">`
- Each `<li class="log-line flex items-start gap-3 px-5 py-2">`:
  - `.ts` mono color muted — timestamp `16:43:09.421`
  - `.lvl-{info|warn|error|debug|trace}` mono bold colored badge — `INFO ` / `WARN ` / `ERROR`
  - source pill — `auth` / `rbac` / `db` / `csrf` / `srv` / `migr` / `tenant`, colored bg per source
  - message text + muted tail (key=value pairs)
- Footer: tailing counter `tailing · 12 / 38421 lines · last 15m` + connection status pulse-dot success
- **Hover affordance**: bg `accent/0.9` + 4px left marker `--info` color + top/bottom 1px info rings

## 9. Audit Feed

2-col card.

- Header: title + subtitle + "view all →" link
- `<ul class="max-h-[420px] divide-y divide-border/60 overflow-y-auto">`
- Each `<li class="px-5 py-3">`:
  - Severity-colored icon circle (mt-0.5, 7×7, bg-{color}/15)
  - Title (foreground font-medium)
  - Description (xs muted-foreground)
  - Meta line mono `[timestamp] · [scope] · [actor]`
- **Hover affordance**: bg `accent/0.75` + 4px left primary marker + top/bottom primary/0.35 rings

## 10. Charts row

3-col grid card containing:

- **Latency chart** (2-col, lg:col-span-2):
  - Title + 3 inline legend keys (p50 palette-2 / p95 palette-1 / p99 warning) with current values
  - Inline SVG `viewBox="0 0 600 160"`: 3 grid lines + 3 polylines (p99 warning, p95 palette-1, p50 palette-2) + filled area under p50
  - 6-col x-axis labels (00:00 / 04:00 / 08:00 / 12:00 / 16:00 / now)
  - Shimmer animation overlay (subtle, respects reduced-motion)
- **Active sessions by role** (1-col):
  - Title + subtitle
  - 6 role rows, each: colored dot + role name + count (tabular-nums) + mini progress bar
  - Divider + total

## 11. DB Supervisor sidebar entry

See `docs/07_sidebar_specification.md` § "DB Supervisor sidebar entry — special variant" for full markup + sub-tree.

The 12 sub-tabs of the dedicated DB Supervisor page (with counts from canonical prototype):
- Schemas (5)
- Tables (576)
- Views & MViews (42)
- Indexes (1 284)
- Functions & Proc. (118)
- Triggers (63)
- Sequences (189)
- Constraints & FKs (950)
- Roles & Grants (14)
- Extensions (9)
- Connection Pools (3)
- Backups & PITR (14d)
- Vacuum & Bloat (ok)

## 12. Header pattern (observability-specific)

In addition to the canonical header (see `docs/06`), system-health adds:

- Breadcrumb: `Platform / System Health`
- Status pill next to page title: `inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success` with leading pulse-dot success and text `"All systems operational"` (or `"Degraded"` warning / `"Outage"` danger based on aggregate state).

## 13. Footer pattern (observability-specific right area)

Left area: canonical universal rule (© year · heuresys.com · 5 social icons).

Right area for system-health context-specific monospace 10px:
- Build version `v5.0.0-mvp3`
- Build SHA `f065ef2`
- Runtime location `OCI VM eu-milan-1`
- DB summary `pg 16 · pool 18/50`
- Tunnel status `tunnel 5433` with leading pulse-dot success
- Clock `19 May · 16:43 CET`

Separated by vertical bar `<span class="text-border">·</span>`.

## 14. Time range selector

Page header includes a 5-button segmented control:

```html
<div class="inline-flex items-center rounded-control border border-border bg-card p-0.5">
  <button>15m</button>
  <button>1h</button>
  <button class="bg-accent text-foreground">24h</button>  <!-- active -->
  <button>7d</button>
  <button>30d</button>
</div>
```

Plus 2 action buttons:
- `Aggiorna` (ghost outline, refresh icon)
- `Export report` (primary filled, download icon)

Time range affects all widgets on the page (KPI sparklines, charts, top-N endpoint stats, incident timeline window). State stored in `localStorage` under `heuresys-time-range`.

## Reference implementation

| Layer | Path |
|---|---|
| Canonical prototype | `ux-design/prototypes/superuser-system-health.html` |
| Bundle code_examples | `code_examples/src/components/dashboard/*.tsx` |
| Production library | `@heuresys/ui/dashboard/*.tsx` |
| Live showcase | `apps/showcase/src/app/showcase/system-health/page.tsx` |
