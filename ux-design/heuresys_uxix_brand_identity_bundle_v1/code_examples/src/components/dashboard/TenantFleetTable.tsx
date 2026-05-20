import type { ReactNode } from "react";
import { DataTableWithCrossHair } from "@/components/ui/DataTableWithCrossHair";

/**
 * Tenant fleet table — cross-tenant operational status.
 * Spec: docs/16_system_health_admin_dashboard_patterns.md § 3.
 */

export type TenantStatus = "healthy" | "degraded" | "down";

export type TenantRow = Readonly<{
  code: string;                                  // e.g. "RTL_BANK_REFERENCE"
  initials: string;                              // 2-letter badge content (e.g. "RB")
  initialsTone: "palette-1" | "palette-2" | "palette-3" | "palette-4" | "warning";
  tenantId: string;                              // shortened display, e.g. "01HQF7…NB3K"
  status: TenantStatus;
  users: number;
  tables: number;
  errors1h: number;
  lastActivity: string;                          // e.g. "2m ago"
  poolUtilPct: number;                           // 0..100
}>;

const STATUS_TONE: Record<TenantStatus, { tone: string; label: string }> = {
  healthy:  { tone: "success", label: "Healthy" },
  degraded: { tone: "warning", label: "Degraded" },
  down:     { tone: "danger",  label: "Down" },
};

function poolTone(pct: number) {
  if (pct >= 85) return "danger";
  if (pct >= 60) return "warning";
  if (pct >= 20) return "success";
  return "palette-1";
}

function errorsTone(n: number) {
  if (n >= 50) return "text-danger";
  if (n >= 10) return "text-warning";
  return "text-muted-foreground";
}

export type TenantFleetTableProps = Readonly<{
  rows: ReadonlyArray<TenantRow>;
  title?: string;
  subtitle?: string;
  onOpenDetail?: (row: TenantRow) => void;
  onSearch?: (query: string) => void;
  onOpenFilters?: () => void;
}>;

export function TenantFleetTable({
  rows,
  title = "Tenant fleet",
  subtitle = "Cross-tenant operational status — schema metrics, brownfield import state, last activity",
  onOpenDetail,
  onSearch,
  onOpenFilters,
}: TenantFleetTableProps) {
  return (
    <section aria-label="Tenant fleet operativo">
      <article className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="search" placeholder="Filter tenant…" aria-label="Filtra tenant per nome o codice"
                     onChange={(e) => onSearch?.(e.target.value)}
                     className="h-9 rounded-control border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
            </div>
            <button type="button" onClick={onOpenFilters}
                    className="inline-flex h-9 items-center gap-2 rounded-control border border-border px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground hover:border-foreground/30">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filters
            </button>
          </div>
        </div>

        <DataTableWithCrossHair enableCrossHair>
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-5 py-2.5">Tenant</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Users</th>
              <th className="px-3 py-2.5 text-right">Tables</th>
              <th className="px-3 py-2.5 text-right">Errors · 1h</th>
              <th className="px-3 py-2.5">Last activity</th>
              <th className="px-3 py-2.5">Pool util.</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const st = STATUS_TONE[r.status];
              const pt = poolTone(r.poolUtilPct);
              return (
                <tr key={r.code}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md bg-${r.initialsTone}/15 font-mono text-xs font-semibold text-${r.initialsTone}`}>
                        {r.initials}
                      </span>
                      <div>
                        <div className="font-medium text-foreground">{r.code}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">tenant_id · {r.tenantId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full bg-${st.tone}/10 px-2 py-0.5 text-xs font-medium text-${st.tone}`}>
                      <span className={`h-1.5 w-1.5 rounded-full bg-${st.tone}`} />
                      {st.label}
                    </span>
                  </td>
                  <td className="num px-3 py-3 text-right tabular-nums text-foreground">{r.users}</td>
                  <td className="num px-3 py-3 text-right tabular-nums text-foreground">{r.tables}</td>
                  <td className={`num px-3 py-3 text-right tabular-nums ${errorsTone(r.errors1h)}`}>{r.errors1h}</td>
                  <td className="px-3 py-3"><span className="font-mono text-[11px] text-muted-foreground">{r.lastActivity}</span></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                        <div className={`h-full bg-${pt}`} style={{ width: `${r.poolUtilPct}%` }} />
                      </div>
                      <span className="num font-mono text-[10px] text-muted-foreground">{r.poolUtilPct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button type="button" aria-label="Apri dettaglio tenant" onClick={() => onOpenDetail?.(r)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTableWithCrossHair>
      </article>
    </section>
  );
}

export type { TenantRow as TenantFleetRow };
