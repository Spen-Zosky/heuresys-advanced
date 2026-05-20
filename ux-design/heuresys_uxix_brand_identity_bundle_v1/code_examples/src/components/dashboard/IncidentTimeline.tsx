import type { ReactNode } from "react";

/**
 * Incident timeline — ol space-y with vertical chain + ring dots.
 * Spec: docs/16_system_health_admin_dashboard_patterns.md § 5.
 */

export type IncidentSeverity = "P1" | "P2" | "P3";
export type IncidentStatus = "ACTIVE" | "RESOLVED" | "ACKNOWLEDGED";

export type IncidentItem = Readonly<{
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;       // mono line
}>;

const SEVERITY_TONE: Record<IncidentSeverity, string> = { P1: "danger", P2: "warning", P3: "info" };
const STATUS_TONE: Record<IncidentStatus, string> = { ACTIVE: "warning", ACKNOWLEDGED: "info", RESOLVED: "success" };

export type IncidentTimelineProps = Readonly<{
  items: ReadonlyArray<IncidentItem>;
  title?: string;
  subtitle?: string;
  counts?: { p1?: number; p2?: number; p3?: number };
  onViewFullLog?: () => void;
}>;

export function IncidentTimeline({ items, title = "Incident timeline",
                                    subtitle = "Last 24h · severity tracked",
                                    counts, onViewFullLog }: IncidentTimelineProps) {
  return (
    <article className="rounded-card border border-border bg-card p-5 shadow-card lg:col-span-2">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {counts && (
          <div className="flex gap-1 text-[11px]">
            <SeverityPill sev="P1" count={counts.p1 ?? 0} />
            <SeverityPill sev="P2" count={counts.p2 ?? 0} />
            <SeverityPill sev="P3" count={counts.p3 ?? 0} />
          </div>
        )}
      </div>

      <ol className="relative mt-5 space-y-4 border-l border-border pl-5">
        {items.map((it, i) => {
          const sevTone = SEVERITY_TONE[it.severity];
          const statusTone = STATUS_TONE[it.status];
          const isResolved = it.status === "RESOLVED";
          return (
            <li key={i} className="relative">
              <span className={`absolute -left-[27px] mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-${sevTone} ring-4 ring-${sevTone}/20`}>
                {isResolved ? (
                  <svg className="h-2.5 w-2.5 text-card" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-card pulse-dot" />
                )}
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{it.title}</span>
                <span className={`rounded-sm bg-${statusTone}/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-${statusTone}`}>
                  {it.severity} · {it.status}
                </span>
              </div>
              {it.description && <p className="mt-0.5 text-xs text-muted-foreground">{it.description}</p>}
              {it.meta && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{it.meta}</div>}
            </li>
          );
        })}
      </ol>

      {onViewFullLog && (
        <div className="mt-4 border-t border-border pt-3 text-center">
          <button type="button" onClick={onViewFullLog} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            view full incident log →
          </button>
        </div>
      )}
    </article>
  );
}

function SeverityPill({ sev, count }: { sev: IncidentSeverity; count: number }) {
  const tone = SEVERITY_TONE[sev];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-${tone}/15 px-2 py-0.5 font-mono font-medium text-${tone}`}>
      {sev}·{count}
    </span>
  );
}
