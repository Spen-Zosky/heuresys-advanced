"use client";

import type { ReactNode } from "react";

/**
 * StatusPill — canonical token-driven status badge (brand-component-contract.md:
 * "Status / health indicator"). Semantic tones map to design tokens so palette/
 * theme switches re-skin automatically. Composition primitive for list/detail
 * pages; lives in apps/web (tenant-domain composition), built on @heuresys/ui
 * token classes.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
};

/** Heuristic mapping of common backend status/severity strings → a tone. */
export function statusTone(value: string | null | undefined): StatusTone {
  const v = (value ?? "").toUpperCase();
  if (["ACTIVE", "FILLED", "APPROVED", "COMPLETED", "DONE", "SUCCESS", "PUBLISHED", "ENABLED", "RESOLVED", "PASSED"].includes(v)) return "success";
  if (["OPEN", "PENDING", "PROPOSED", "DRAFT", "IN_PROGRESS", "RUNNING", "QUEUED", "SCHEDULED", "INFO"].includes(v)) return "info";
  if (["AT_RISK", "AT RISK", "WARNING", "HIGH", "MEDIUM", "REVIEW", "PARTIAL", "DEGRADED", "STALE"].includes(v)) return "warning";
  if (["INACTIVE", "SUSPENDED", "CRITICAL", "FAILED", "ERROR", "REJECTED", "BLOCKED", "EXPIRED", "REVOKED"].includes(v)) return "danger";
  return "neutral";
}

export function StatusPill({
  tone,
  children,
  className = "",
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Convenience: render a status string as a toned pill. */
export function StatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <StatusPill tone={statusTone(value)} className={className}>{value}</StatusPill>;
}
