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

// AA-compliant in both themes. Status tones are SEMANTIC (fixed), not
// palette-driven — the PaletteDropdown reskins only --palette-1..4, so using
// explicit semantic shades here does not break palette switching. The prior
// `text-{tone} on bg-{tone}/10` rendered saturated token text on a 10% tint
// and failed WCAG AA in light mode (e.g. warning amber ~1.99, success ~2.95);
// these shades measure >=4.5 against the pill's effective background in both
// light and dark themes (S952 forensic QA).
const TONE_CLASS: Record<StatusTone, string> = {
  success: "border-green-300/70 bg-green-100 text-green-800 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-300",
  warning: "border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "border-red-300/70 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  info: "border-blue-300/70 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300",
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
