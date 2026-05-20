import type { ReactNode } from "react";
import { DataTableWithCrossHair } from "@/components/ui/DataTableWithCrossHair";

/**
 * SQL slow query top-N table.
 * Spec: docs/16_system_health_admin_dashboard_patterns.md § 6.
 */

export type SqlSlowRow = Readonly<{
  rank: number;
  query: ReactNode;             // pre-colored SQL fragment (palette-3 keywords)
  queryNote?: ReactNode;        // muted operation label + diagnostic
  tenant: ReactNode;            // pill or text "all" / "cron" / tenant code
  tenantTone?: "warning" | "palette-1" | "palette-2" | "palette-3" | "muted";
  calls: number;
  p95Ms: number;
  meanMs: number;
  totalTimeBarPct: number;      // 0..100
  totalTimeTone?: "danger" | "warning" | "palette-2";
  totalTimeLabel: ReactNode;    // e.g. "9.6 min"
  lastSeen: ReactNode;          // e.g. "3s ago"
}>;

export type SQLSlowQueryTableProps = Readonly<{
  rows: ReadonlyArray<SqlSlowRow>;
  totalTracked?: number;
  sampleSince?: string;
  totalCaptured?: string;
  onResetStats?: () => void;
  onOpenExplain?: (row: SqlSlowRow) => void;
}>;

export function SQLSlowQueryTable({ rows, totalTracked, sampleSince, totalCaptured,
                                    onResetStats, onOpenExplain }: SQLSlowQueryTableProps) {
  return (
    <section aria-label="SQL slow queries top">
      <article className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-palette-3/15 text-palette-3">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">SQL slow query · top {rows.length}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">pg_stat_statements · threshold p95 &gt; 100ms · last 24h · ranked by total time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onResetStats && <button type="button" onClick={onResetStats} className="inline-flex h-9 items-center gap-2 rounded-control border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground hover:border-foreground/30">Reset stats</button>}
            {onOpenExplain && <button type="button" onClick={() => onOpenExplain(rows[0])} className="inline-flex h-9 items-center gap-2 rounded-control bg-palette-3/10 px-3 text-xs font-medium text-palette-3 transition hover:bg-palette-3/20">Open EXPLAIN</button>}
          </div>
        </div>

        <DataTableWithCrossHair enableCrossHair>
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <th className="w-10 px-3 py-2.5 text-right">#</th>
              <th className="px-3 py-2.5">Query</th>
              <th className="px-3 py-2.5">Tenant</th>
              <th className="px-3 py-2.5 text-right">Calls</th>
              <th className="px-3 py-2.5 text-right">p95</th>
              <th className="px-3 py-2.5 text-right">Mean</th>
              <th className="px-3 py-2.5">Total time</th>
              <th className="px-3 py-2.5">Last seen</th>
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const p95Tone = r.p95Ms >= 1000 ? "text-danger" : r.p95Ms >= 300 ? "text-warning" : "text-foreground";
              return (
                <tr key={r.rank}>
                  <td className="num px-3 py-2.5 text-right font-mono text-[10px] text-muted-foreground">{String(r.rank).padStart(2, "0")}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-[12px] text-foreground">{r.query}</div>
                    {r.queryNote && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{r.queryNote}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-md bg-${r.tenantTone ?? "muted"}/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-${r.tenantTone ?? "muted-foreground"}`}>
                      {r.tenant}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5 text-right tabular-nums text-foreground">{r.calls.toLocaleString()}</td>
                  <td className="num px-3 py-2.5 text-right tabular-nums"><span className={`font-mono font-medium ${p95Tone}`}>{r.p95Ms.toLocaleString()} ms</span></td>
                  <td className="num px-3 py-2.5 text-right tabular-nums font-mono text-muted-foreground">{r.meanMs.toLocaleString()} ms</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
                        <div className={`h-full bg-${r.totalTimeTone ?? "palette-2"}`} style={{ width: `${r.totalTimeBarPct}%` }} />
                      </div>
                      <span className="num font-mono text-[10px] text-foreground">{r.totalTimeLabel}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{r.lastSeen}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button type="button" aria-label="EXPLAIN plan" onClick={() => onOpenExplain?.(r)}
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

        <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] text-muted-foreground">
          <span className="font-mono">showing {rows.length}{totalTracked != null ? ` / ${totalTracked} tracked queries` : ""}</span>
          {(totalCaptured || sampleSince) && <span className="font-mono">{totalCaptured ? `total time captured · ${totalCaptured}` : ""}{sampleSince ? ` · sample since ${sampleSince}` : ""}</span>}
        </div>
      </article>
    </section>
  );
}
