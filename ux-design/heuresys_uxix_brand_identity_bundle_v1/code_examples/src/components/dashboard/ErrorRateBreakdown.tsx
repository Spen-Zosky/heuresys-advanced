import type { ReactNode } from "react";

/**
 * Error rate breakdown — stacked status bar + top erroring endpoints.
 * Spec: docs/16_system_health_admin_dashboard_patterns.md § 4.
 */

export type StatusBucket = "2xx" | "3xx" | "4xx" | "5xx";

export type EndpointRow = Readonly<{
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;
  scope?: string;                              // e.g. "tenant=GENESIS_DEMO" | "all tenants"
  statusBadge: ReactNode;                      // e.g. "5xx · 89" | "401 · 34"
  statusTone: "danger" | "warning" | "muted";
  sparkline: ReadonlyArray<number>;            // 0..1 normalized
  sparklineTone: "danger" | "warning" | "primary" | "muted";
  delta?: ReactNode;                           // e.g. "▲ 412%"
  deltaTone?: "danger" | "warning" | "success" | "muted-foreground";
}>;

const METHOD_TONE: Record<EndpointRow["method"], string> = {
  GET: "text-info",
  POST: "text-warning",
  PATCH: "text-warning",
  DELETE: "text-danger",
  PUT: "text-warning",
};

export type ErrorRateBreakdownProps = Readonly<{
  overallRate: ReactNode;                      // e.g. "2.4"
  overallUnit?: ReactNode;                     // default "%"
  overallDelta?: ReactNode;                    // e.g. "▲ 1.8%"
  overallDeltaTone?: "warning" | "danger" | "success";
  totalRequests?: number;
  distribution: Readonly<Record<StatusBucket, number>>;  // counts per bucket
  endpoints: ReadonlyArray<EndpointRow>;
  onViewAll?: () => void;
}>;

const STATUS_TONE_BG: Record<StatusBucket, string> = {
  "2xx": "bg-success",
  "3xx": "bg-info",
  "4xx": "bg-warning",
  "5xx": "bg-danger",
};

export function ErrorRateBreakdown({ overallRate, overallUnit = "%", overallDelta,
                                     overallDeltaTone = "warning", totalRequests,
                                     distribution, endpoints, onViewAll }: ErrorRateBreakdownProps) {
  const total = (distribution["2xx"] ?? 0) + (distribution["3xx"] ?? 0) + (distribution["4xx"] ?? 0) + (distribution["5xx"] ?? 0);
  const pct = (n: number) => total > 0 ? (n / total) * 100 : 0;

  return (
    <article className="rounded-card border border-border bg-card p-5 shadow-card lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Error rate breakdown</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">HTTP status mix + top erroring endpoints · last 1h</p>
        </div>
        <div className="flex items-baseline gap-3 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">overall</div>
            <div className="num text-xl font-semibold text-foreground">{overallRate}<span className="text-sm text-muted-foreground">{overallUnit}</span></div>
          </div>
          {overallDelta && (
            <div className={`rounded-control bg-${overallDeltaTone}/10 px-2 py-1 font-mono text-[10px] font-medium text-${overallDeltaTone}`}>{overallDelta}</div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span>Status distribution{totalRequests != null ? ` · ${totalRequests.toLocaleString()} req` : ""}</span>
          <span className="font-mono">{pct(distribution["2xx"]).toFixed(1)}% / {pct(distribution["3xx"]).toFixed(1)}% / {(pct(distribution["4xx"]) + pct(distribution["5xx"])).toFixed(1)}%</span>
        </div>
        <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-border">
          {(["2xx", "3xx", "4xx", "5xx"] as const).map((b) => (
            <div key={b} className={STATUS_TONE_BG[b]} style={{ width: `${pct(distribution[b])}%` }} title={`${b} · ${distribution[b]}`} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
          {(["2xx", "3xx", "4xx", "5xx"] as const).map((b) => (
            <div key={b} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-sm ${STATUS_TONE_BG[b]}`} />
              <span className="text-muted-foreground">{b}</span>
              <span className="num ml-auto font-mono text-foreground">{distribution[b]?.toLocaleString() ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Top erroring endpoints</h3>
          {onViewAll && <button type="button" onClick={onViewAll} className="text-[11px] font-medium text-primary hover:underline">view all →</button>}
        </div>
        <ul className="space-y-2.5 text-sm">
          {endpoints.map((e, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto_80px_auto] items-center gap-3">
              <div className="min-w-0">
                <span className="font-mono text-xs text-foreground">
                  <span className={METHOD_TONE[e.method]}>{e.method}</span> {e.path}
                </span>
                {e.scope && <span className="ml-2 font-mono text-[10px] text-muted-foreground">{e.scope}</span>}
              </div>
              <span className={`rounded-sm bg-${e.statusTone}/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-${e.statusTone}`}>
                {e.statusBadge}
              </span>
              <EndpointSparkline values={e.sparkline} tone={e.sparklineTone} />
              {e.delta && <span className={`num text-right font-mono text-[10px] text-${e.deltaTone ?? "muted-foreground"}`}>{e.delta}</span>}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function EndpointSparkline({ values, tone }: { values: ReadonlyArray<number>; tone: string }) {
  if (values.length < 2) return <span />;
  const W = 80, H = 14;
  const step = W / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${H - v * (H - 2) - 1}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-3.5 w-full" aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={`hsl(var(--${tone}))`} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
