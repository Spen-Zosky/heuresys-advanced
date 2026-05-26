"use client";

/* eslint-disable no-sparse-arrays */
// CODE-NEW-2 Pre-flight 2026-05-26: this file uses INTENTIONAL sparse arrays
// in scopeTitles[] for column alignment with states[] (empty slots = no title
// for that column). 25 no-sparse-arrays errors are false-positive for this
// data structure pattern; disabling rule file-wide is the correct mitigation
// vs refactoring data to explicit `undefined` placeholders (same semantic,
// just verbose).

/**
 * SUPERUSER System Health & Observability — canonical reference dashboard.
 *
 * Shared component, consumed by BOTH:
 *   - apps/web/src/app/showcase/system-health/page.tsx        (brand showcase, dev-only)
 *   - apps/web/src/app/(authenticated)/system-health/page.tsx (production, PLATFORM_ADMIN gated)
 *
 * Source of truth: ux-design/prototypes/superuser-system-health.html
 * Composed entirely from @heuresys/ui dashboard pattern components.
 *
 * Specs:
 *   - docs/16_system_health_admin_dashboard_patterns.md
 *   - docs/06_header_specification.md
 *   - docs/07_sidebar_specification.md
 *   - docs/08_footer_specification.md
 *   - docs/13_best_practices_for_modern_saas_ui.md
 */

import {
  AlertBanner,
  AuditFeed,
  DashboardFooter,
  DashboardHeader,
  DashboardShell,
  DashboardSidebar,
  DBSupervisorSidebar,
  ErrorRateBreakdown,
  HeuresysLogoBadge,
  HeuresysWordmark,
  IncidentTimeline,
  KPIStrip,
  LogStream,
  PageActions,
  RBACMatrix,
  SQLSlowQueryTable,
  TenantFleetTable,
  TimeRangeSelector,
} from "@heuresys/ui";
import {
  Activity, Layers, ScrollText, ShieldCheck, Users, Lock, Database, Settings, AlertCircle, Code2,
} from "lucide-react";

export function SystemHealthDashboard() {
  return (
    <DashboardShell
      header={
        <DashboardHeader
          breadcrumb={[
            { label: "Platform", href: "#" },
            { label: "System Health" },
          ]}
          user={{ initials: "ES", username: "enzo.spenuso", role: "SUPERUSER", roleTone: "warning" }}
          language="IT"
          logo={<HeuresysWordmark variant="brand" size={24} />}
          logoBadge={<HeuresysLogoBadge>advanced</HeuresysLogoBadge>}
        />
      }
      sidebar={
        <DashboardSidebar
          groups={[
            {
              id: "platform",
              label: "Platform",
              items: [
                { id: "health", label: "System Health", href: "#", active: true, icon: <Activity className="h-4 w-4 shrink-0 text-primary" />, aux: <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success pulse-dot" /> },
                { id: "tenants", label: "Tenant Fleet", href: "#", icon: <Layers className="h-4 w-4 shrink-0" />, aux: <span className="font-mono text-[10px] text-muted-foreground">4</span> },
                { id: "logs", label: "Live Logs", href: "#", icon: <ScrollText className="h-4 w-4 shrink-0" />, aux: <span className="inline-flex h-1.5 w-1.5 rounded-full bg-info pulse-dot" /> },
                { id: "audit", label: "Audit Feed", href: "#", icon: <ShieldCheck className="h-4 w-4 shrink-0" /> },
              ],
            },
            { id: "database",
              label: (
                <span className="flex items-baseline gap-1.5">
                  <span>Database</span>
                  <span className="font-mono text-[9px] normal-case tracking-normal text-muted-foreground/60">pg 16</span>
                </span>
              ),
              customContent: <DBSupervisorSidebar />
            },
            {
              id: "administration",
              label: "Administration",
              items: [
                { id: "users", label: "Platform Users", href: "#", icon: <Users className="h-4 w-4 shrink-0" /> },
                { id: "rbac", label: "RBAC Mappings", href: "#", icon: <Lock className="h-4 w-4 shrink-0" /> },
                { id: "migrations", label: "Migrations", href: "#", icon: <Database className="h-4 w-4 shrink-0" /> },
                { id: "config", label: "Configuration", href: "#", icon: <Settings className="h-4 w-4 shrink-0" /> },
              ],
            },
            {
              id: "diagnostics",
              label: "Diagnostics",
              items: [
                { id: "incidents", label: "Incidents", href: "#", icon: <AlertCircle className="h-4 w-4 shrink-0" />, aux: <span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-warning">2</span> },
                { id: "sql", label: "SQL Console", href: "#", icon: <Code2 className="h-4 w-4 shrink-0" /> },
              ],
            },
          ]}
        />
      }
      footer={
        <DashboardFooter
          rightSlot={
            <>
              <span>v5.0.0-mvp3</span>
              <span aria-hidden="true" className="text-border">·</span>
              <span>OCI VM eu-milan-1</span>
              <span aria-hidden="true" className="text-border">·</span>
              <span>pg 16 · pool 18/50</span>
              <span aria-hidden="true" className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
                tunnel 5433
              </span>
            </>
          }
        />
      }
    >
      <div className="mx-auto max-w-[1600px] space-y-5">
        <AlertBanner
          variant="warning"
          title="1 active incident · GENESIS_DEMO"
          meta={
            <>
              <span className="rounded-full bg-warning/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warning">P2 · degraded</span>
              <span className="text-xs text-muted-foreground">slow query rate <span className="font-mono text-warning">+340%</span> · pool util <span className="font-mono">78%</span> · error rate <span className="font-mono">4.1%</span></span>
            </>
          }
          details={
            <>
              <span>started 16:35 · 8m ago</span>
              <span className="opacity-50">·</span>
              <span className="text-warning">auto-escalation to P1 in 4m if not acknowledged</span>
              <span className="opacity-50">·</span>
              <span>oncall: enzo.spenuso</span>
            </>
          }
          actions={[
            { label: "Acknowledge", onClick: () => {}, variant: "primary" },
            { label: "View incident →", onClick: () => {} },
          ]}
          onDismiss={() => {}}
        />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">System Health &amp; Observability</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
                All systems operational
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cross-tenant platform observability — Fastify API, PostgreSQL 16 pool, RBAC cache state, audit chain.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <TimeRangeSelector value="24h" />
            <PageActions onRefresh={() => {}} onExport={() => {}} />
          </div>
        </div>

        <KPIStrip items={[
          {
            label: "API uptime · 24h", value: "99.97", unit: "%", iconTone: "success",
            sparkline: [0.2, 0.3, 0.35, 0.3, 0.45, 0.55, 0.6, 0.55, 0.7, 0.65, 0.8, 0.7, 0.78],
            sparklineTone: "success",
            footerLeft: "2 incidents",
            footerRight: <span className="text-success">▲ 0.04%</span>,
          },
          {
            label: "DB pool · pg 16", value: "18", unit: "/ 50 conn", iconTone: "palette-2",
            sparklineTone: "primary",
            body: (
              <div className="mt-3">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-border"><div className="bg-palette-2" style={{ width: "36%" }} /></div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span className="num">idle 8 · active 10</span><span className="num">peak 32</span></div>
              </div>
            ),
          },
          {
            label: "RBAC cache", value: "388", unit: "mappings", iconTone: "palette-3",
            body: (
              <>
                <div className="mt-3 flex items-baseline justify-between text-[11px]"><span className="text-muted-foreground">8 roles loaded</span><span className="font-mono text-success">LOADED</span></div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">last refresh · 14:38:12</div>
              </>
            ),
          },
          {
            label: "Active tenants", value: "4", unit: "/ 4", iconTone: "palette-1",
            body: (
              <>
                <div className="mt-3 grid grid-cols-4 gap-1">
                  <div className="h-6 rounded-sm bg-success/40" title="RTL_BANK_REFERENCE" />
                  <div className="h-6 rounded-sm bg-warning/40" title="GENESIS_DEMO" />
                  <div className="h-6 rounded-sm bg-success/40" title="ACME_CORP" />
                  <div className="h-6 rounded-sm bg-success/40" title="HEURESYS_INTERNAL" />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>270 users</span><span className="text-warning">1 warn</span></div>
              </>
            ),
          },
          {
            label: "Auth integrity", value: "0", unit: "replay", iconTone: "success",
            body: (
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div><div className="text-muted-foreground">Login</div><div className="num font-medium text-foreground">142</div></div>
                <div><div className="text-muted-foreground">Failed</div><div className="num font-medium text-warning">3</div></div>
                <div><div className="text-muted-foreground">Rotation</div><div className="num font-medium text-foreground">87</div></div>
              </div>
            ),
          },
        ]} />

        <TenantFleetTable
          rows={[
            { code: "RTL_BANK_REFERENCE", initials: "RB", initialsTone: "palette-1", tenantId: "01HQF7…NB3K", status: "healthy",  users: 158, tables: 576, errors1h: 0,  lastActivity: "2m ago",  poolUtilPct: 42 },
            { code: "GENESIS_DEMO",        initials: "GD", initialsTone: "warning",   tenantId: "01HRT2…X8M9", status: "degraded", users: 62,  tables: 412, errors1h: 17, lastActivity: "8m ago",  poolUtilPct: 78 },
            { code: "ACME_CORP",           initials: "AC", initialsTone: "palette-2", tenantId: "01HVK9…P2L0", status: "healthy",  users: 47,  tables: 340, errors1h: 2,  lastActivity: "14m ago", poolUtilPct: 28 },
            { code: "HEURESYS_INTERNAL",   initials: "HI", initialsTone: "palette-3", tenantId: "01HXJ4…WQ7C", status: "healthy",  users: 3,   tables: 28,  errors1h: 0,  lastActivity: "1m ago",  poolUtilPct: 8  },
          ]}
        />

        <section className="grid gap-3 lg:grid-cols-5">
          <ErrorRateBreakdown
            overallRate="2.4"
            overallDelta="▲ 1.8%"
            overallDeltaTone="warning"
            totalRequests={38421}
            distribution={{ "2xx": 37152, "3xx": 346, "4xx": 615, "5xx": 308 }}
            endpoints={[
              { method: "POST", path: "/v1/positions",   scope: "tenant=GENESIS_DEMO", statusBadge: "5xx · 89", statusTone: "danger",  sparkline: [0.2,0.3,0.25,0.45,0.5,0.4,0.6,0.7,0.85], sparklineTone: "danger",  delta: "▲ 412%", deltaTone: "danger" },
              { method: "GET",  path: "/v1/skills/matrix", scope: "tenant=GENESIS_DEMO", statusBadge: "5xx · 47", statusTone: "danger",  sparkline: [0.3,0.25,0.4,0.45,0.4,0.55,0.7,0.78,0.85], sparklineTone: "danger",  delta: "▲ 168%", deltaTone: "danger" },
              { method: "POST", path: "/v1/auth/refresh", scope: "all tenants", statusBadge: "401 · 34", statusTone: "warning", sparkline: [0.5,0.45,0.5,0.45,0.5,0.45,0.5,0.45,0.5], sparklineTone: "warning", delta: "— 3%", deltaTone: "muted-foreground" },
              { method: "POST", path: "/v1/auth/login",   scope: "tenant=RTL_BANK",     statusBadge: "401 · 12", statusTone: "warning", sparkline: [0.4,0.35,0.4,0.3,0.35,0.4,0.35,0.4,0.35], sparklineTone: "warning", delta: "+ 8%",  deltaTone: "muted-foreground" },
              { method: "GET",  path: "/v1/me/profile",   scope: "tenant=ACME_CORP",    statusBadge: "403 · 6",  statusTone: "warning", sparkline: [0.25,0.25,0.2,0.25,0.2,0.25,0.2,0.25,0.2], sparklineTone: "warning", delta: "▼ 12%", deltaTone: "success" },
            ]}
          />

          <IncidentTimeline
            counts={{ p1: 0, p2: 1, p3: 3 }}
            items={[
              { severity: "P2", status: "ACTIVE", title: "GENESIS_DEMO degraded", description: "Slow query rate +340% on /v1/positions · pool util 78% sustained", meta: "16:35 · 8m ago · acks 0/3" },
              { severity: "P3", status: "RESOLVED", title: "RBAC cache rebuild", description: "388 mappings reloaded · 121ms · automatic on role update", meta: "14:38 · 2h ago · duration 121ms" },
              { severity: "P3", status: "RESOLVED", title: "Migration 000031 applied", description: "add_uq_sys_user_certifications · 42ms · idempotent", meta: "11:14 · 5h ago · downtime 0s" },
              { severity: "P3", status: "RESOLVED", title: "Pool exhaustion (transient)", description: "DB pool reached 47/50 for 90s during brownfield Wave 1 import", meta: "04:33 · 12h ago · self-healed" },
            ]}
          />
        </section>

        <SQLSlowQueryTable
          totalTracked={247}
          sampleSince="04:30:00"
          totalCaptured="23 min"
          rows={[
            { rank: 1,  query: <><span className="text-palette-3">SELECT</span> p.*, c.* <span className="text-palette-3">FROM</span> sys_positions p <span className="text-palette-3">LEFT JOIN</span> sys_competencies …</>, queryNote: "positions.list · joined skills + competencies", tenant: "GENESIS_DEMO",  tenantTone: "warning",   calls: 847,   p95Ms: 1240, meanMs: 682, totalTimeBarPct: 100, totalTimeTone: "danger",   totalTimeLabel: "9.6 min", lastSeen: "3s ago" },
            { rank: 2,  query: <><span className="text-palette-3">SELECT</span> sm.* <span className="text-palette-3">FROM</span> sys_skill_matrix sm <span className="text-palette-3">WHERE</span> sm.tenant_id = $1 <span className="text-palette-3">AND</span> …</>, queryNote: "skills.matrix.get · missing composite index", tenant: "GENESIS_DEMO",  tenantTone: "warning",   calls: 312,   p95Ms: 680,  meanMs: 421, totalTimeBarPct: 38,  totalTimeTone: "warning",  totalTimeLabel: "2.2 min", lastSeen: "12s ago" },
            { rank: 3,  query: <><span className="text-palette-3">SELECT</span> * <span className="text-palette-3">FROM</span> sys_position_intelligence_profile <span className="text-palette-3">WHERE</span> position_id = ANY($1)</>, queryNote: "pip.batch · materialized view refresh pending", tenant: "RTL_BANK", tenantTone: "palette-1", calls: 1248,  p95Ms: 412,  meanMs: 198, totalTimeBarPct: 36,  totalTimeTone: "warning",  totalTimeLabel: "4.1 min", lastSeen: "1s ago" },
            { rank: 4,  query: <><span className="text-palette-3">SELECT</span> u.*, ur.role_code <span className="text-palette-3">FROM</span> sys_users u <span className="text-palette-3">JOIN</span> sys_user_roles ur …</>, queryNote: "users.list.withRoles · n+1 candidate", tenant: "all", tenantTone: "muted", calls: 5124, p95Ms: 284, meanMs: 112, totalTimeBarPct: 28, totalTimeTone: "warning", totalTimeLabel: "9.6 min", lastSeen: "2s ago" },
            { rank: 5,  query: <><span className="text-palette-3">INSERT INTO</span> audit_log (event, payload, actor_id, …) <span className="text-palette-3">VALUES</span> …</>, queryNote: "audit.write · trigger fan-out on 3 dependent indexes", tenant: "all", tenantTone: "muted", calls: 12480, p95Ms: 186, meanMs: 42, totalTimeBarPct: 88, totalTimeTone: "palette-2", totalTimeLabel: "8.7 min", lastSeen: "just now" },
            { rank: 6,  query: <><span className="text-palette-3">SELECT</span> COUNT(*) <span className="text-palette-3">FROM</span> sys_audit_role_permissions <span className="text-palette-3">WHERE</span> …</>, queryNote: "rbac.cache.load · full scan, 388 mappings", tenant: "platform", tenantTone: "muted", calls: 8, p95Ms: 142, meanMs: 121, totalTimeBarPct: 4, totalTimeTone: "palette-2", totalTimeLabel: "1.0 s", lastSeen: "8m ago" },
            { rank: 7,  query: <><span className="text-palette-3">REFRESH MATERIALIZED VIEW CONCURRENTLY</span> mv_position_intelligence_profile</>, queryNote: "pip.refresh.scheduled · runs hourly", tenant: "cron", tenantTone: "muted", calls: 24, p95Ms: 128, meanMs: 102, totalTimeBarPct: 3, totalTimeTone: "palette-2", totalTimeLabel: "2.4 s", lastSeen: "42m ago" },
            { rank: 8,  query: <><span className="text-palette-3">SELECT</span> e.*, p.title <span className="text-palette-3">FROM</span> sys_employees e <span className="text-palette-3">JOIN</span> sys_positions p <span className="text-palette-3">ON</span> e.position_id …</>, queryNote: "employees.list.withPosition", tenant: "RTL_BANK", tenantTone: "palette-1", calls: 2168, p95Ms: 118, meanMs: 68, totalTimeBarPct: 24, totalTimeTone: "palette-2", totalTimeLabel: "2.5 min", lastSeen: "4s ago" },
            { rank: 9,  query: <><span className="text-palette-3">UPDATE</span> sys_auth_refresh_tokens <span className="text-palette-3">SET</span> revoked_at = now() <span className="text-palette-3">WHERE</span> family_id = $1</>, queryNote: "auth.refresh.rotate · family bulk revoke", tenant: "all", tenantTone: "muted", calls: 87, p95Ms: 114, meanMs: 38, totalTimeBarPct: 6, totalTimeTone: "palette-2", totalTimeLabel: "3.3 s", lastSeen: "37s ago" },
            { rank: 10, query: <><span className="text-palette-3">SELECT</span> COUNT(*), tenant_id <span className="text-palette-3">FROM</span> sys_audit_log <span className="text-palette-3">GROUP BY</span> tenant_id</>, queryNote: "audit.aggregate · dashboard counter", tenant: "all", tenantTone: "muted", calls: 1440, p95Ms: 104, meanMs: 52, totalTimeBarPct: 18, totalTimeTone: "palette-2", totalTimeLabel: "1.2 min", lastSeen: "1s ago" },
          ]}
        />

        <RBACMatrix
          totalRoles={8}
          totalMappings={388}
          totalPermissions={47}
          lastReload="14:38:12"
          roles={[
            { code: "PLATFORM_ADMIN",    tone: "warning"          },
            { code: "TENANT_ADMIN",      tone: "palette-3"        },
            { code: "BLUEPRINT_MANAGER", tone: "palette-1"        },
            { code: "HRMS_MANAGER",      tone: "palette-1"        },
            { code: "PROCESS_OWNER",     tone: "palette-2"        },
            { code: "MANAGER",           tone: "palette-2"        },
            { code: "USER",              tone: "muted-foreground" },
            { code: "READ_ONLY",         tone: "muted-foreground" },
          ]}
          rows={[
            { permission: "users:read",    description: "read user profiles + roles",          states: ["granted","granted","granted","granted","scoped","scoped","scoped","denied"], scopeTitles: [,,,,"tenant scope","reports-of-mine scope","self scope"] },
            { permission: "users:write",   description: "create / update / disable users",     states: ["granted","scoped","denied","scoped","denied","denied","denied","denied"], scopeTitles: [,"tenant scope",,"tenant scope"] },
            { permission: "positions:read",description: "position catalogue + PIP views",     states: ["granted","granted","granted","granted","granted","granted","scoped","granted"], scopeTitles: [,,,,,,"own position"] },
            { permission: "positions:write",description: "create / edit positions + reqs",     states: ["granted","scoped","granted","scoped","denied","denied","denied","denied"], scopeTitles: [,"tenant scope",,"tenant scope"] },
            { permission: "skills:write",  description: "skill catalogue + certifications",   states: ["granted","scoped","granted","granted","denied","scoped","scoped","denied"], scopeTitles: [,"tenant scope",,,,"reports-of-mine scope","self scope"] },
            { permission: "performance:read",description: "performance reviews + KPIs",       states: ["granted","granted","denied","granted","scoped","scoped","scoped","denied"], scopeTitles: [,,,,"process scope","reports-of-mine scope","self scope"] },
            { permission: "rbac:write",    description: "manage role-permission mappings",     states: ["granted","scoped","denied","denied","denied","denied","denied","denied"], scopeTitles: [,"tenant scope only"] },
            { permission: "audit:read",    description: "audit log access (immutable)",       states: ["granted","scoped","denied","scoped","denied","denied","denied","denied"], scopeTitles: [,"tenant scope",,"tenant scope"] },
            { permission: "system:admin",  description: "migrations, DB ops, tenant lifecycle",states: ["granted","denied","denied","denied","denied","denied","denied","denied"] },
          ]}
        />

        <section className="grid gap-3 lg:grid-cols-5">
          <LogStream
            totalCount={38421}
            entries={[
              { timestamp: "16:43:09.421", level: "info",  source: "auth", sourceTone: "palette-1", message: "request completed", meta: "method=POST url=/v1/auth/login statusCode=200 responseTime=82.4ms reqId=req-92a4f" },
              { timestamp: "16:43:08.117", level: "info",  source: "rbac", sourceTone: "palette-2", message: "permission granted", meta: "user=manager_test@rtl-bank.test perm=positions:read tenant=01HQF7…NB3K" },
              { timestamp: "16:43:06.998", level: "warn",  source: "db",   sourceTone: "palette-3", message: "slow query detected", meta: "query=positions.list duration=412ms threshold=300ms tenant=GENESIS_DEMO" },
              { timestamp: "16:43:04.612", level: "info",  source: "auth", sourceTone: "palette-1", message: "refresh token rotated", meta: "family=fam-7c2 user=admin@heuresys.com prev=tk-aa3 next=tk-bf1" },
              { timestamp: "16:43:01.245", level: "info",  source: "csrf", sourceTone: "warning",   message: "token verified", meta: "method=PATCH url=/v1/users/01HRT2 origin=rtl-bank.app" },
              { timestamp: "16:42:58.901", level: "warn",  source: "auth", sourceTone: "palette-1", message: "login attempt with unknown email", meta: "email=guest@unknown.net ip=185.220.x.x ua=curl/8.4.0" },
              { timestamp: "16:42:55.014", level: "info",  source: "db",   sourceTone: "palette-2", message: "pool stats", meta: "total=50 idle=8 active=10 waiting=0 tenant_filter=enabled" },
              { timestamp: "16:42:52.760", level: "info",  source: "migr", sourceTone: "success",   message: "migration applied", meta: "file=000031_add_uq_sys_user_certifications.sql duration=42ms" },
              { timestamp: "16:42:49.388", level: "error", source: "auth", sourceTone: "palette-1", message: "login failed · invalid credentials", meta: "email=outsider_test@rtl-bank.test attempts=3/5 ip=80.225.82.207" },
              { timestamp: "16:42:46.103", level: "info",  source: "rbac", sourceTone: "palette-2", message: "cache loaded", meta: "rolesLoaded=8 mappingsLoaded=388 elapsed=121ms" },
              { timestamp: "16:42:42.522", level: "debug", source: "tenant", sourceTone: "muted",   message: "context resolved", meta: "tenant_id=01HQF7…NB3K from=jwt-claim source=httpOnlyCookie" },
              { timestamp: "16:42:39.847", level: "info",  source: "srv",  sourceTone: "palette-1", message: "listening", meta: "port=3001 address=0.0.0.0 node=v20.18.0" },
            ]}
          />

          <AuditFeed
            events={[
              { tone: "warning",   icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, title: "SUPERUSER promotion", description: "enzo.spenuso → PLATFORM_ADMIN role granted", meta: <><span>16:38:22</span> · <span>tenant=PLATFORM</span> · <span>actor=system</span></> },
              { tone: "success",   icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>, title: "Migration applied", description: "000031_add_uq_sys_user_certifications.sql", meta: <><span>16:42:52</span> · <span>duration=42ms</span> · <span>idempotent</span></> },
              { tone: "palette-3", icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, title: "RBAC mapping updated", description: "HRMS_MANAGER + skills:write · 3 mappings affected", meta: <><span>16:31:09</span> · <span>tenant=RTL_BANK</span> · <span>actor=admin@heuresys.com</span></> },
              { tone: "info",      icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: "Brownfield import completed", description: "Wave 1 closure · 446 lineage rows documented · 15 target tables seeded", meta: <><span>16:33:07</span> · <span>run=g003_K</span> · <span>tenant=RTL_BANK</span></> },
              { tone: "danger",    icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, title: "Failed login burst", description: "3 attempts on outsider_test@rtl-bank.test · throttle engaged", meta: <><span>16:42:49</span> · <span>ip=80.225.82.207</span> · <span>throttle=60s</span></> },
              { tone: "palette-2", icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>, title: "User created", description: "paola.bertoni@rtl-bank.test · role=USER · 1 position assigned", meta: <><span>15:58:14</span> · <span>tenant=RTL_BANK</span> · <span>actor=manager_test</span></> },
            ]}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
