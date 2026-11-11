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
 * #35 B7 (S1028) re-lit two of the four dropped sections with REAL backends:
 * SQLSlowQueryTable (GET /v1/observability/slow-queries — live pg_stat_statements)
 * and the request sparklines (GET /v1/observability/request-series — the in-RAM
 * 24h minute ring). Still intentionally absent (no honest backend): live
 * LogStream (log tail = systemd/journalctl infra, not app data) and
 * IncidentTimeline/AlertBanner (no incident module shipped).
 *
 * Composed from @heuresys/ui primitives. V-9 del piano interfacce (2026-11-04): i testi
 * sono tradotti (`common:health.*`) e i numeri e i tempi relativi seguono la lingua della
 * persona; prima erano in inglese («req», «ms avg», «just now»).
 */

import { AuditFeed, Badge, ErrorRateBreakdown, Sparkline, SQLSlowQueryTable } from "@heuresys/ui";
import Link from "next/link";
import { PageHeader } from "@/components/intestazione-pagina";
import { SchedePagina } from "@/components/schede-pagina";
import { KPIStrip } from "@/components/indicatori-leggibili";
import { Activity, Database, Gauge, Lock, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCan } from "../lib/api/auth";
import { ROLE_PRECEDENCE } from "../lib/role-precedence";
import {
  useRequestSeries,
  useRolePermissions,
  useSlowQueries,
  useSystemHealth,
  type RolePermissionsResponse,
} from "@/lib/api/observability";
import { useFormat } from "@/lib/format";
import { useEnumLabel } from "@/lib/enum-labels";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { Leggibile } from "@/lib/leggibile";

type RolePermissionItem = RolePermissionsResponse["items"][number];

/* ---------- helpers (pure, render-time) ---------------------------------- */

function formatRelative(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(m) < 60) return rtf.format(m, "minute");
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
}

const TENANT_STATUS: Record<string, { dot: string; text: string }> = {
  ACTIVE: { dot: "bg-success", text: "text-success" },
  SUSPENDED: { dot: "bg-warning", text: "text-warning" },
  ARCHIVED: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
};
function tenantStatus(s: string) {
  return TENANT_STATUS[s.toUpperCase()] ?? { dot: "bg-muted-foreground", text: "text-muted-foreground" };
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
// L'ordine di visualizzazione non vive piu' qui: e' quello canonico di
// `lib/role-precedence.ts`, la stessa fonte che decide il ruolo mostrato
// nell'intestazione. Una sola lista, un solo posto da aggiornare quando nasce
// un ruolo nuovo. (ROLE_TONE resta locale: e' il colore, non l'ordine.)
const ROLE_ORDER = ROLE_PRECEDENCE;

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
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const fmt = useFormat();
  const n = (v: number, max = 0) => fmt.numero(v, max);
  const rel = (iso: string | null) => formatRelative(iso, lang);
  const enumLabel = useEnumLabel();
  const health = useSystemHealth();
  // S-3: la matrice ruoli×permessi chiede `role_matrix:read`, che PLATFORM_OPERATOR non ha.
  // Senza il permesso la sezione non si mostra e la chiamata non parte (giro del banco L1).
  const canReadMatrix = useCan("role_matrix:read");
  const rolePerms = useRolePermissions(canReadMatrix);
  const slowQueries = useSlowQueries(10);           // #35 B7 — live pg_stat_statements
  const requestSeries = useRequestSeries(180, 5);   // #35 B7 — in-RAM 24h ring

  if (health.isLoading) {
    return (
      <main
        data-testid="system-health-loading"
        className="mx-auto max-w-7xl px-6 pb-8"
      >
        <StatoCaricamento />
      </main>
    );
  }
  if (health.isError || !health.data) {
    return (
      <main data-testid="system-health-error" className="mx-auto max-w-7xl px-6 pb-8">
        <StatoErrore errore={health.error} titolo={t("health.loadError")} onRiprova={() => void health.refetch()} />
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
      className="mx-auto max-w-[1600px] space-y-6 px-6 pb-8"
    >
      <PageHeader
        title={t("health.title")}
        description={t("health.description")}
        badges={
          <Badge variant="secondary" data-testid="system-health-generated-at">
            {t("health.updated", { when: rel(d.generatedAt) })}
          </Badge>
        }
      />

      <KPIStrip
        items={[
          {
            label: t("health.kpi.uptime"),
            value: fmt.numeroFisso(rm.uptime24hPct, 2),
            unit: "%",
            iconTone: "success",
            icon: <Activity className="h-4 w-4" />,
            footerLeft: t("health.kpi.requests", { count: rm.totalRequests, n: n(rm.totalRequests) }),
            footerRight: t("health.kpi.avgMs", { ms: n(rm.avgDurationMs) }),
          },
          {
            label: t("health.kpi.pool"),
            value: d.pool.active,
            unit: t("health.kpi.poolUnit", { max: d.pool.max }),
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
                    {t("health.kpi.poolDetail", { idle: d.pool.idle, active: d.pool.active, waiting: d.pool.waiting })}
                  </span>
                  <span className="num">{t("health.kpi.serverMax", { max: d.pool.serverMaxConnections })}</span>
                </div>
              </div>
            ),
          },
          {
            label: t("health.kpi.rbac"),
            value: d.rbac.mappingsLoaded,
            unit: t("health.kpi.rbacUnit"),
            iconTone: "palette-3",
            icon: <Lock className="h-4 w-4" />,
            body: (
              <>
                <div className="mt-3 flex items-baseline justify-between text-[11px]">
                  <span className="text-muted-foreground">{t("health.kpi.rolesLoaded", { count: d.rbac.rolesLoaded })}</span>
                  <span className="text-success">{d.rbac.loadedAt ? t("health.kpi.loaded") : t("health.kpi.notLoaded")}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {d.rbac.loadedAt ? t("health.kpi.lastLoad", { when: rel(d.rbac.loadedAt) }) : t("health.kpi.notLoaded")}
                </div>
              </>
            ),
          },
          {
            label: t("health.kpi.tenants"),
            value: activeTenants,
            unit: `/ ${d.tenantFleet.length}`,
            iconTone: "palette-1",
            icon: <Users className="h-4 w-4" />,
            body: (
              <div className="mt-3 flex items-baseline justify-between text-[11px] text-muted-foreground">
                <span>{t("health.kpi.activeCount", { count: activeTenants })}</span>
                <span className="num">{t("health.kpi.usersCount", { count: totalUsers, n: n(totalUsers) })}</span>
              </div>
            ),
          },
          {
            label: t("health.kpi.auth"),
            value: d.authIntegrity.replayRevoked,
            unit: t("health.kpi.replay"),
            iconTone: d.authIntegrity.replayRevoked > 0 ? "danger" : "success",
            icon: <ShieldCheck className="h-4 w-4" />,
            body: (
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">{t("health.kpi.logins")}</div>
                  <div className="num font-medium text-foreground">{d.authIntegrity.login24h}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("health.kpi.failed")}</div>
                  <div className="num font-medium text-warning">{d.authIntegrity.failed24h}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("health.kpi.rotations")}</div>
                  <div className="num font-medium text-foreground">{d.authIntegrity.rotations}</div>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* C5: dieci schermate diventano cinque schede. La matrice ruoli × permessi non si ripete
          qui: vive, leggibile, nella sua pagina (C1, C9). */}
      <SchedePagina
        schede={[
          { id: "aziende", titolo: t("health.tabs.fleet"), conteggio: d.tenantFleet.length, contenuto: (
            <>
            {/* Tenant fleet — honest table over the real per-tenant fields the API exposes
                (code/name/status/users/lastActivity). The mock's per-tenant tables/errors1h/
                poolUtilPct do not exist in this architecture (I5: single schema + FK tenant
                isolation; the pg.Pool is global, surfaced in the DB-pool KPI above). */}
            <section
              data-testid="system-health-tenant-fleet"
              className="overflow-hidden rounded-card border border-border bg-card shadow-card"
            >
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">{t("health.fleet.title")}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("health.fleet.description")}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="px-5 py-2.5">{t("health.fleet.tenant")}</th>
                    <th className="px-3 py-2.5">{t("health.fleet.status")}</th>
                    <th className="px-3 py-2.5 text-right">{t("health.fleet.users")}</th>
                    <th className="px-3 py-2.5">{t("health.fleet.lastActivity")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border"><Leggibile>
                  {d.tenantFleet.map((tn) => {
                    const st = tenantStatus(tn.status);
                    return (
                      <tr key={tn.code}>
                        <td className="px-5 py-3">
                          <div className="font-medium text-foreground">{tn.code}</div>
                          <div className="text-[11px] text-muted-foreground">{tn.name}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${st.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {t(`health.fleet.statusLabel.${tn.status.toUpperCase()}`, { defaultValue: tn.status })}
                          </span>
                        </td>
                        <td className="num px-3 py-3 text-right tabular-nums text-foreground">
                          {n(tn.userCount)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[11px] text-muted-foreground">
                            {rel(tn.lastActivity)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </Leggibile></tbody>
              </table>
            </section>
            </>
          ) },
          { id: "richieste", titolo: t("health.tabs.requests"), contenuto: (
            <>
            {/* Request-metrics error breakdown (live, last 24h). Endpoint sparklines are
                empty: only point-in-time recent errors exist (no per-route time series). */}
            <ErrorRateBreakdown
              overallRate={fmt.numeroFisso(rm.errorRate5xxPct, 2)}
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

            {/* --- #35 B7: request time-series sparklines (in-RAM 24h ring, live) --- */}
            {requestSeries.data && requestSeries.data.points.length > 0 ? (
              <section
                data-testid="system-health-request-series"
                className="grid gap-3 md:grid-cols-3"
              >
                {(() => {
                  const pts = requestSeries.data.points;
                  const cards = [
                    {
                      label: t("health.series.requests"),
                      data: pts.map((p) => p.total),
                      foot: t("health.series.requestsFoot", { n: n(pts.reduce((s, p) => s + p.total, 0)) }),
                    },
                    {
                      label: t("health.series.errors"),
                      data: pts.map((p) => p.xx5),
                      foot: t("health.series.errorsFoot", { count: pts.reduce((s, p) => s + p.xx5, 0) }),
                    },
                    {
                      label: t("health.series.latency"),
                      data: pts.map((p) => p.avgDurationMs),
                      foot: t("health.series.latencyFoot", { ms: n(Math.max(...pts.map((p) => p.avgDurationMs))) }),
                    },
                  ];
                  return cards.map((c) => (
                    <div key={c.label} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                        {c.label}
                      </div>
                      <div className="mt-3">
                        <Sparkline data={c.data} width={280} height={48} ariaLabel={c.label} />
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground num">{c.foot}</div>
                    </div>
                  ));
                })()}
              </section>
            ) : null}
            </>
          ) },
          { id: "database", titolo: t("health.tabs.database"), contenuto: (
            <>
            {/* --- #35 B7: SQL slow queries (live pg_stat_statements, app-db scope) --- */}
            {slowQueries.data && slowQueries.data.items.length > 0 ? (
              <div data-testid="system-health-slow-queries">
                <SQLSlowQueryTable
                  rows={(() => {
                    const items = slowQueries.data.items;
                    const maxTotal = Math.max(...items.map((q) => q.totalMs), 1);
                    return items.map((q) => ({
                      rank: q.rank,
                      query: (
                        <code className="font-mono text-xs">
                          {q.query.length > 120 ? `${q.query.slice(0, 120)}…` : q.query}
                        </code>
                      ),
                      tenant: "app-db",
                      tenantTone: "muted" as const,
                      calls: q.calls,
                      // p95 estimated as μ+1.645σ — pg_stat_statements has no percentiles
                      p95Ms: Math.max(0, Math.round(q.meanMs + 1.645 * q.stddevMs)),
                      meanMs: Math.round(q.meanMs * 100) / 100,
                      totalTimeBarPct: Math.round((q.totalMs / maxTotal) * 100),
                      totalTimeTone:
                        q.meanMs > 250 ? ("danger" as const) : q.meanMs > 50 ? ("warning" as const) : ("palette-2" as const),
                      totalTimeLabel: fmt.durata(q.totalMs),
                      lastSeen: t("health.slow.cumulative"),
                    }));
                  })()}
                  totalTracked={slowQueries.data.totalTracked}
                  sampleSince={
                    slowQueries.data.statsSince ? rel(slowQueries.data.statsSince) : undefined
                  }
                  totalCaptured={t("health.slow.p95Note")}
                />
              </div>
            ) : (
              <StatoVuoto
                testId="system-health-slow-queries-empty"
                icona={<Database className="h-6 w-6" />}
                titolo={
                  slowQueries.data && !slowQueries.data.extensionAvailable
                    ? t("health.slow.unavailableTitle")
                    : t("health.slow.emptyTitle")
                }
                motivo={
                  slowQueries.data && !slowQueries.data.extensionAvailable
                    ? t("health.slow.unavailableDesc")
                    : t("health.slow.emptyDesc")
                }
              />
            )}
            </>
          ) },
          { id: "registro", titolo: t("health.tabs.audit"), conteggio: d.auditFeed.length, contenuto: (
            <>
            <section className="grid gap-3 lg:grid-cols-5">
              {d.auditFeed.length > 0 ? (
                <AuditFeed
                  events={d.auditFeed.map((ev) => ({
                    icon: <ShieldCheck className="h-3.5 w-3.5" />,
                    tone: "palette-3" as const,
                    // F-3 (L6): l'identificativo della risorsa non va nel testo del registro;
                    // azione e tipo di risorsa si leggono a parole (etichetta, o il codice sciolto).
                    title: enumLabel("auditAction", ev.actionType),
                    description: ev.resourceType ? enumLabel("auditResource", ev.resourceType) : undefined,
                    meta: (
                      <>
                        <span>{rel(ev.occurredAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t("health.audit.tenant", { code: ev.tenantCode })}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ev.userDisplayName}</span>
                      </>
                    ),
                  }))}
                />
              ) : (
                <div className="lg:col-span-2">
                  <StatoVuoto
                    testId="system-health-audit-empty"
                    icona={<ShieldCheck className="h-6 w-6" />}
                    titolo={t("health.audit.emptyTitle")}
                    motivo={t("health.audit.emptyDesc")}
                  />
                </div>
              )}
            </section>
            </>
          ) },
          { id: "permessi", titolo: t("health.tabs.permissions"), nascosta: !canReadMatrix, contenuto: (
            <p className="text-sm" data-testid="system-health-rbac-link">
              {t("health.rbac.moved", { count: matrix?.rows.length ?? 0 })}{" "}
              <Link href="/admin/roles" className="font-medium text-primary underline">{t("health.rbac.open")}</Link>
            </p>
          ) },
        ]}
      />
    </main>
  );
}
