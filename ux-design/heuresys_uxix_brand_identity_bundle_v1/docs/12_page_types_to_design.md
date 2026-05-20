# 12 — Page Types to Design

The Development Team must design and showcase all major interface types, not only the dashboard.

## 1. Dashboard shell

Includes:

- Header.
- Sidebar.
- Main content window.
- Footer.
- Collapsed and expanded sidebar.
- Long sidebar navigation.
- Dynamic header/sidebar/footer content.

## 2. Module content page with tabs

Example:

```text
Positions
[Catalogue] [Requirements] [Skills] [KPIs]
```

Must include:

- Page title.
- Breadcrumb.
- Top tabs.
- Content cards.
- Table or list.
- Filters.
- Contextual actions.
- Empty/loading/error states.

## 3. Module content page without tabs

Example:

```text
Executive Dashboard
```

Must include:

- Direct view rendering.
- No forced tabs.
- High-value summary layout.

## 4. Primary authenticated initial page

This is the page users return to after logout or after authenticated entry, distinct from the public landing page.

It may include:

- Tenant selection.
- Continue to dashboard.
- Recent workspace.
- User identity.
- Platform status.
- Support/help entry.

## 5. Login page

Must be professional, clear and secure-looking.

Must include:

- Heuresys logo.
- Login form.
- Forgot password.
- Tenant/company code if required.
- Authentication messages.
- Error state.
- Loading state.
- Optional SSO area.

## 6. Public landing page

Different from the authenticated primary page.

May include:

- Public brand identity.
- Product value proposition.
- Key modules.
- AI-augmented HRMS/BPM positioning.
- Contact/demo CTA.
- Minimal but polished visual storytelling.

## 7. Data-rich operational pages

Must showcase:

- Tables.
- Filters.
- Bulk actions.
- Status badges.
- Detail drawers.
- Forms.
- Validation.
- Charts.
- Infographics.

## 8. Executive/analytics pages

Must showcase:

- KPI cards.
- Trend charts.
- Risk/status indicators.
- Workforce intelligence views.
- Semantic icon colors.
- Carefully controlled "wow" graphics.

## 9. System Health / Admin Dashboard

A dedicated **observability page type** for SUPERUSER / PLATFORM_ADMIN role. Aggregates cross-tenant operational signals.

Must include the following macro-areas (see `docs/16_system_health_admin_dashboard_patterns.md` for per-widget specs):

```text
1. Alert banner (top, dismissible, severity-coded)
2. Page header with status pill + time range selector + refresh + export
3. KPI strip (5 cards: API uptime / DB pool / RBAC cache / Active tenants / Auth integrity)
4. Tenant fleet table (cross-tenant operational status)
5. Error rate breakdown + Incident timeline (2-col grid)
6. Charts row (latency p50/p95/p99 + active sessions by role)
7. SQL slow query top-10 (data-dense, cross-hair on)
8. RBAC permissions matrix (sticky first column, tri-state cells, cross-hair on)
9. Live log stream + Audit feed (2-col grid)
```

Sub-page entries in the sidebar:

```text
Platform
├── System Health          (this page)
├── Tenant Fleet           (drill-down)
├── Live Logs              (full-screen log view)
└── Audit Feed             (full-screen audit view)

Database
└── DB Supervisor          (multi-tab page — Schemas/Tables/Views/Indexes/…)

Administration
├── Platform Users
├── RBAC Mappings
├── Migrations
└── Configuration

Diagnostics
├── Incidents
└── SQL Console
```

## 10. Data visualization patterns (cross-cutting)

These patterns recur across multiple page types (executive dashboard, system health, tenant detail, analytics):

- **KPI cards with sparkline** — single big number + tiny inline SVG sparkline + footer delta (`▲ 0.04%` style).
- **Stacked status bar** — single horizontal bar split by status code or category, with legend rows below.
- **Vertical timeline with ring dots** — incident timeline / event log style; dots colored by severity.
- **Log streaming** — `<ol>` of `.log-line` rows, monospace timestamp + level badge + source pill + message; tailing footer; filter pills.
- **Permission matrix** — sticky first column + cells with tri-state icons (`granted` ✓ / `scoped` ◐ / `denied` ·).
- **Mini progress bar** — inline `<div>` width-percentage bar (pool util, completeness, coverage).
- **Inline charts in cards** — line charts (latency), bar segments (sessions by role), stacked bars (status mix). Recharts in production; inline SVG in HTML prototype.

All of the above are documented with markup + token references in `docs/16_system_health_admin_dashboard_patterns.md` and implemented in `@heuresys/ui/dashboard/*`.

## Rule

All page types must inherit the same design tokens, typography, palette, icon system and component language.
