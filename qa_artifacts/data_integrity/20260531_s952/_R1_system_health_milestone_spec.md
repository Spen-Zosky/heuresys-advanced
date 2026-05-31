# R1 — system-health live-wire milestone spec (S952)

**Decision taken by user**: "Apri mini-milestone API e wire live."
**Material discovery (R20)**: it is NOT a mini-milestone. `apps/web/src/components/SystemHealthDashboard.tsx` is a **dual-use shared component** (consumed by BOTH `app/showcase/system-health` dev demo AND `app/(authenticated)/system-health` production) with **100% hardcoded mock data** (KPIStrip, TenantFleetTable, ErrorRateBreakdown, IncidentTimeline, SQLSlowQueryTable, RBACMatrix, LogStream, AuditFeed). Header even hardcodes `enzo.spenuso SUPERUSER`. Wiring production live requires splitting prod-vs-showcase data AND building data sources — several of which **do not exist**.

## Widget feasibility breakdown

| Widget | Live source | Feasible now? |
|---|---|---|
| DB pool (total/idle/active/peak) | in-process `pg.Pool` (`pool.totalCount/idleCount/waitingCount`) | ✅ yes |
| RBAC cache (roles/mappings/last refresh) | in-process RBAC cache loader state | ✅ yes |
| Active tenants + per-tenant user counts | `SELECT count(*) ... GROUP BY tenant` on `sys.sys_users`/`sys_tenants` | ✅ yes |
| Auth integrity (login/failed/rotation/replay) | `sys.sys_auth_login_events`, `sys_auth_refresh_tokens` aggregates | ✅ yes |
| Tenant fleet (users, tables, errors1h, lastActivity, poolUtil) | partial: users✅, tables✅ (pg_catalog per-schema), errors1h❌, poolUtil❌ (no per-tenant pool), lastActivity≈ (max audit/login ts) | ⚠️ partial |
| DB supervisor (schemas/tables/views/indexes/fn/triggers/seq/constraints) | `pg_catalog`/`information_schema` counts | ✅ yes |
| Audit feed | `sys.sys_audit_log` recent rows — **verify table exists** | ⚠️ if audit table present |
| Slow-query table | `pg_stat_statements` — **verify extension enabled** | ⚠️ only if extension on |
| API uptime %/sparkline | needs a metrics store (none) | ❌ no infra |
| Error-rate breakdown (2xx/4xx/5xx by endpoint) | needs request-metrics store (none) | ❌ no infra |
| Live log stream | needs a log-aggregation API (logs go to pino/stdout) | ❌ no infra |
| Incident timeline | needs an incident subsystem (none) | ❌ no infra |

## Recommended bounded approach (no-mock doctrine compliant)
1. **API**: new module `observability` (7-step pattern) exposing `GET /v1/observability/system-health` (PLATFORM_ADMIN, `system:admin`) returning ONLY the ✅/⚠️-feasible aggregates (pool, rbac, tenants, auth-integrity, schema-counts, tenant-fleet[partial], audit-feed[if present], slow-queries[if pg_stat_statements]). Real SQL + in-process probes. Shared Zod schema in `@heuresys/shared`. Integration test hitting the real DB.
2. **Component**: refactor `SystemHealthDashboard` to be **prop-driven** (accept a `data` prop). Showcase route keeps passing the existing mock demo data (dev-only brand demo — legitimate). Production route fetches `/v1/observability/system-health` and passes REAL data.
3. **Non-instrumented widgets** (uptime/error-rate/logs/incidents): in PRODUCTION, OMIT them or render an honest `"not yet instrumented"` empty-state — **never mock**. Keep them in the showcase demo. (Or open follow-up items to build metrics/logging/incident infra.)
4. **E2E**: update the existing `/system-health` Playwright test (text-locator based) for the real prod content; assert on seeded real values.

## Scope estimate
~6–8 files (shared schema, api repo/service/routes, app.ts register, integration test, component refactor, prod page wire, showcase page pass-through, E2E update). Real milestone, **not** a tail-end task — recommend executing as its own focused session/milestone (e.g. API `5.1.x — observability/system-health aggregators`). The non-instrumented widgets are genuine product decisions (omit vs build-infra) — **user call**.

## Interim safety
Until wired, the production `/system-health` exposes mock data labeled as real (incl. a non-existent `SUPERUSER` role + fabricated tenants/incidents). If that is unacceptable in the meantime, gate/hide the production nav entry (reversible) — see R1 option "Nascondi/disabilita".
