import type { ReactNode } from "react";

/**
 * Live log stream — tailing ol with .log-line items.
 * Spec: docs/16_system_health_admin_dashboard_patterns.md § 8.
 */

export type LogLevel = "info" | "warn" | "error" | "debug" | "trace";

export type LogEntry = Readonly<{
  timestamp: string;       // e.g. "16:43:09.421"
  level: LogLevel;
  source: string;          // e.g. "auth" | "rbac" | "db" | "csrf" | "srv" | "migr" | "tenant"
  sourceTone?: "primary" | "palette-1" | "palette-2" | "palette-3" | "palette-4" | "success" | "warning" | "info" | "muted";
  message: ReactNode;
  meta?: ReactNode;        // additional muted key=value tail
}>;

export type LogStreamProps = Readonly<{
  entries: ReadonlyArray<LogEntry>;
  title?: string;
  sourceLabel?: string;     // e.g. "fastify · pino"
  activeFilter?: LogLevel | "all";
  totalCount?: number;
  windowLabel?: string;     // e.g. "last 15m"
  connected?: boolean;
  onFilterChange?: (level: LogLevel | "all") => void;
  onPauseToggle?: () => void;
  paused?: boolean;
}>;

export function LogStream({ entries, title = "Live log stream", sourceLabel = "fastify · pino",
                           activeFilter = "info", totalCount, windowLabel = "last 15m",
                           connected = true, onFilterChange, onPauseToggle, paused }: LogStreamProps) {
  return (
    <article className="rounded-card border border-border bg-card shadow-card lg:col-span-3">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-info pulse-dot" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{sourceLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "info", "warn", "error"] as const).map((f) => (
            <button key={f} type="button" onClick={() => onFilterChange?.(f)}
                    className={`rounded-control px-2 py-1 text-[11px] font-medium transition ${f === activeFilter ? "bg-accent text-foreground" : f === "warn" ? "text-warning hover:bg-accent" : f === "error" ? "text-danger hover:bg-accent" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
              {f}
            </button>
          ))}
          <button type="button" aria-label={paused ? "Riprendi stream" : "Pausa stream"} onClick={onPauseToggle}
                  className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-foreground">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {paused ? <polygon points="5 3 19 12 5 21 5 3" /> : <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>}
            </svg>
          </button>
        </div>
      </div>

      <ol className="max-h-[420px] divide-y divide-border/60 overflow-y-auto" aria-live="polite">
        {entries.map((e, i) => (
          <li key={i} className="log-line flex items-start gap-3 px-5 py-2">
            <span className="ts shrink-0 whitespace-nowrap font-mono">{e.timestamp}</span>
            <span className={`lvl-${e.level} shrink-0 font-mono font-semibold`}>{e.level.toUpperCase().padEnd(5)}</span>
            <span className={`shrink-0 rounded-sm bg-${e.sourceTone ?? "palette-1"}/15 px-1.5 font-mono text-[10px] text-${e.sourceTone ?? "palette-1"}`}>{e.source}</span>
            <span className="text-foreground">{e.message} {e.meta && <span className="text-muted-foreground">{e.meta}</span>}</span>
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between border-t border-border px-5 py-2.5 font-mono text-[10px] text-muted-foreground">
        <span>tailing · {entries.length}{totalCount != null ? ` / ${totalCount}` : ""} lines · {windowLabel}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full bg-${connected ? "success" : "danger"} pulse-dot`} />
          {connected ? "connected" : "disconnected"}
        </span>
      </div>
    </article>
  );
}
