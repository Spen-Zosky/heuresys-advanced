"use client";

/**
 * SystemHealthLive — PRODUCTION /system-health observability dashboard, 100% LIVE.
 *
 * Replaces the former hardcoded-mock wiring (F7 closure). Every value here comes
 * from a real /v1 call hitting the OCI PostgreSQL:
 *   - GET /v1/observability/system-health  → pool, RBAC cache, tenant fleet,
 *     auth integrity, sys-schema census, audit feed, 24h request metrics.
 *   - GET /v1/auth/role-permissions         → the role×permission matrix.
 *
 * The brand-showcase mock lives in SystemHealthDashboard.tsx and is rendered ONLY
 * by /showcase/system-health (a documented demo artifact). This component is the
 * production-route renderer and contains NO fabricated values.
 *
 * Sections WITHOUT a /v1 backend were intentionally dropped from production (the
 * mock kept them as demo narrative): live LogStream (log tail = systemd/journalctl
 * infra, not app data), SQLSlowQueryTable (no pg_stat_statements read endpoint),
 * IncidentTimeline/AlertBanner (no incident module shipped), and KPI sparklines
 * (no time-series endpoint — point-in-time counters only). The live request-metrics
 * error rate already surfaces real degradation signals.
 *
 * Composed from @heuresys/ui primitives. English copy (this lives in components/,
 * outside the apps/web/src/app/** i18n guardrail — same as the showcase mock).
 */

import {
  AuditFeed,
  Badge,
  EmptyState,
  ErrorRateBreakdown,
  KPIStrip,
  RBACMatrix,
} from "@heuresys/ui";
import { Activity, Database, Lock, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useRolePermissions,
  useSystemHealth,
  type RolePermissionsResponse,
} from "@/lib/api/observability";

type RolePermissionItem = RolePermissionsResponse["items"][number];

/* ---------- helpers (pure, render-time) ---------------------------------- */

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TENANT_STATUS: Record<string, { dot: string; text: string; label: string }> = {
  ACTIVE: { dot: "bg-success", text: "text-success", label: "Active" },
  SUSPENDED: { dot: "bg-warning", text: "text-warning", label: "Suspended" },
  ARCHIVED: { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Archived" },
};
function tenantStatus(s: string) {
  return (
    TENANT_STATUS[s.toUpperCase()] ?? {
      dot: "bg-muted-foreground",
      text: "text-muted-foreground",
      label: s,
    }
  );
}

const HTTP_METHODS = ["GET", "POST", "PATCH", "DELETE", "PUT"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];
function parseMethod(route: string): HttpMethod {
  const head = route.trim().split(/\s+/)[0]?.toUpperCase();
  return (HTTP_METHODS as readonly string[]).includes(head ?? "")
    ? (head as HttpMethod)
    : "GET";
}
function parsePath(route: string): string {
  const parts = route.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : route;
}

/** Canonical role display order + tone; unknown roles (e.g. team roles) fall to the tail. */
const ROLE_TONE: Record<
  string,
  "warning" | "palette-1" | "palette-2" | "palette-3" | "muted-foreground"
> = {
  PLATFORM_ADMIN: "warning",
  TENANT_ADMIN: "palette-3",
  BLUEPRINT_MANAGER: "palette-1",
  HRMS_MANAGER: "palette-1",
  PROCESS_OWNER: "palette-2",
  MANAGER: "palette-2",
  USER: "muted-foreground",
  READ_ONLY: "muted-foreground",
};
const ROLE_ORDER = Object.keys(ROLE_TONE);

/**
 * Pivot the flat [{roleCode, permissionCode, ...}] list into the RBACMatrix shape.
 * The flat endpoint carries existence-only (granted/denied) — the mock's "scoped"
 * tri-state is not derivable from it, so cells are granted|denied (honest).
 */
function buildMatrix(items: ReadonlyArray<RolePermissionItem>) {
  const roleCodes = Array.from(new Set(items.map((i) => i.roleCode)));
  const orderedRoles = [
    ...ROLE_ORDER.filter((r) => roleCodes.includes(r)),
    ...roleCodes.filter((r) => !ROLE_ORDER.includes(r)).sort(),
  ];
  const roles = orderedRoles.map((code) => ({
    code,
    tone: ROLE_TONE[code] ?? ("muted-foreground" as const),
  }));

  const granted = new Set(items.map((i) => `${i.roleCode}|${i.permissionCode}`));
  const permMap = new Map<string, RolePermissionItem>();
  for (const it of items) if (!permMap.has(it.permissionCode)) permMap.set(it.permissionCode, it);
  const perms = Array.from(permMap.values()).sort((a, b) =>
    a.permissionCode.localeCompare(b.permissionCode),
  );

  const rows = perms.map((p) => ({
    permission: p.permissionCode,
    description: `${p.permissionResource} · ${p.permissionAction}`,
    states: orderedRoles.map((rc) =>
      granted.has(`${rc}|${p.permissionCode}`) ? ("granted" as const) : ("denied" as const),
    ),
  }));

  return { roles, rows };
}

/* ---------- component ---------------------------------------------------- */

export function SystemHealthLive() {
  const { t } = useTranslation();
  const health = useSystemHealth();
  const rolePerms = useRolePermissions();

  if (health.isLoading) {
    return (
      <main
        data-testid="system-health-loading"
        className="mx-auto max-w-7xl px-6 py-8"
      >
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (health.isError || !health.data) {
    return (
      <main data-testid="system-health-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">Failed to load system health.</p>
      </main>
    );
  }

  const d = health.data;
  const rm = d.requestMetrics;
  const totalUsers = d.tenantFleet.reduce((acc, t) => acc + t.userCount, 0);
  const activeTenants = d.tenantFleet.filter((t) => t.status.toUpperCase() === "ACTIVE").length;
  const matrix = rolePerms.data ? buildMatrix(rolePerms.data.items) : null;

  return (
    <main
      data-testid="system-health-page"
      className="mx-auto max-w-[1600px] space-y-6 px-6 py-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            System Health &amp; Observability
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cross-tenant platform observability — live pg.Pool, RBAC cache, auth integrity &amp;
            24h request metrics. Every value is read live from the OCI PostgreSQL via
            <code className="mx-1 font-mono text-xs">/v1/observability</code>.
          </p>
        </div>
        <Badge variant="secondary" data-testid="system-health-generated-at">
          updated {formatRelative(d.generatedAt)}
        </Badge>
      </div>

      <KPIStrip
        items={[
          {
            label: "API uptime · 24h",
            value: rm.uptime24hPct.toFixed(2),
            unit: "%",
            iconTone: "success",
            icon: <Activity className="h-4 w-4" />,
            footerLeft: `${rm.totalRequests.toLocaleString()} req`,
            footerRight: `${rm.avgDurationMs.toFixed(0)}ms avg`,
          },
          {
            label: "DB pool · pg 16",
            value: d.pool.active,
            unit: `/ ${d.pool.max} conn`,
            iconTone: "palette-2",
            icon: <Database className="h-4 w-4" />,
            body: (
              <div className="mt-3">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="bg-palette-2"
                    style={{
                      width: `${Math.min(100, Math.round((d.pool.active / d.pool.max) * 100))}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span className="num">
                    idle {d.pool.idle} · active {d.pool.active} · waiting {d.pool.waiting}
                  </span>
                  <span className="num">srv max {d.pool.serverMaxConnections}</span>
                </div>
              </div>
            ),
          },
          {
            label: "RBAC cache",
            value: d.rbac.mappingsLoaded,
            unit: "mappings",
            iconTone: "palette-3",
            icon: <Lock className="h-4 w-4" />,
            body: (
              <>
                <div className="mt-3 flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">{d.rbac.rolesLoaded} roles loaded</span>
                  <span className="font-mono text-success">LOADED</span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {d.rbac.loadedAt ? `last load · ${formatRelative(d.rbac.loadedAt)}` : "not loaded"}
                </div>
              </>
            ),
          },
          {
            label: "Active tenants",
            value: activeTenants,
            unit: `/ ${d.tenantFleet.length}`,
            iconTone: "palette-1",
            icon: <Users className="h-4 w-4" />,
            body: (
              <div className="mt-3 flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>{activeTenants} active</span>
                <span className="num">{totalUsers} users</span>
              </div>
            ),
          },
          {
            label: "Auth integrity · 24h",
            value: d.authIntegrity.replayRevoked,
            unit: "replay",
            iconTone: d.authIntegrity.replayRevoked > 0 ? "danger" : "success",
            icon: <ShieldCheck className="h-4 w-4" />,
            body: (
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">Login</div>
                  <div className="num font-medium text-foreground">{d.authIntegrity.login24h}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Failed</div>
                  <div className="num font-medium text-warning">{d.authIntegrity.failed24h}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Rotations</div>
                  <div className="num font-medium text-foreground">{d.authIntegrity.rotations}</div>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Tenant fleet — honest table over the real per-tenant fields the API exposes
          (code/name/status/users/lastActivity). The mock's per-tenant tables/errors1h/
          poolUtilPct do not exist in this architecture (I5: single schema + FK tenant
          isolation; the pg.Pool is global, surfaced in the DB-pool KPI above). */}
      <section
        data-testid="system-health-tenant-fleet"
        className="overflow-hidden rounded-card border border-border bg-card shadow-card"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Tenant fleet</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Active tenants — live user count + last login activity
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-5 py-2.5">Tenant</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Users</th>
              <th className="px-3 py-2.5">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {d.tenantFleet.map((t) => {
              const st = tenantStatus(t.status);
              return (
                <tr key={t.code}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">{t.code}</div>
                    <div className="text-[11px] text-muted-foreground">{t.name}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${st.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </td>
                  <td className="num px-3 py-3 text-right tabular-nums text-foreground">
                    {t.userCount}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatRelative(t.lastActivity)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Request-metrics error breakdown (live, last 24h). Endpoint sparklines are
          empty: only point-in-time recent errors exist (no per-route time series). */}
      <ErrorRateBreakdown
        overallRate={rm.errorRate5xxPct.toFixed(2)}
        totalRequests={rm.totalRequests}
        distribution={{
          "2xx": rm.byStatusClass.xx2,
          "3xx": rm.byStatusClass.xx3,
          "4xx": rm.byStatusClass.xx4,
          "5xx": rm.byStatusClass.xx5,
        }}
        endpoints={rm.recentErrors.slice(0, 8).map((e) => ({
          method: parseMethod(e.route),
          path: parsePath(e.route),
          statusBadge: String(e.status),
          statusTone: e.status >= 500 ? ("danger" as const) : ("warning" as const),
          sparkline: [],
          sparklineTone: e.status >= 500 ? ("danger" as const) : ("warning" as const),
        }))}
      />

      {matrix && matrix.rows.length > 0 ? (
        <RBACMatrix
          roles={matrix.roles}
          rows={matrix.rows}
          totalRoles={matrix.roles.length}
          totalMappings={rolePerms.data?.total}
          totalPermissions={matrix.rows.length}
          lastReload={d.rbac.loadedAt ? formatRelative(d.rbac.loadedAt) : undefined}
        />
      ) : (
        <EmptyState
          data-testid="system-health-rbac-empty"
          icon={<Lock className="h-6 w-6" />}
          title="RBAC matrix unavailable"
          description="The role-permission map could not be loaded."
        />
      )}

      <section className="grid gap-3 lg:grid-cols-5">
        {d.auditFeed.length > 0 ? (
          <AuditFeed
            events={d.auditFeed.map((ev) => ({
              icon: <ShieldCheck className="h-3.5 w-3.5" />,
              tone: "palette-3" as const,
              title: ev.actionType,
              description: ev.resourceType
                ? `${ev.resourceType}${ev.resourceId ? ` · ${ev.resourceId}` : ""}`
                : undefined,
              meta: (
                <>
                  <span>{formatRelative(ev.occurredAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>tenant={ev.tenantCode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{ev.userDisplayName}</span>
                </>
              ),
            }))}
          />
        ) : (
          <div className="lg:col-span-2">
            <EmptyState
              data-testid="system-health-audit-empty"
              icon={<ShieldCheck className="h-6 w-6" />}
              title="No recent self-service audit events"
              description="The audit feed is empty for the current window."
            />
          </div>
        )}
      </section>
    </main>
  );
}
