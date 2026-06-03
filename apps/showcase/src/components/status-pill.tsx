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

// AA-compliant, THEME-INDEPENDENT opaque chips. Status tones are SEMANTIC
// (fixed), not palette-driven — the PaletteDropdown reskins only --palette-1..4.
// IMPORTANT: do NOT use Tailwind `dark:` variants here — this project toggles
// dark mode via the `.dark` CLASS (ThemeProvider + CSS-var tokens), but
// Tailwind 4's default `dark:` variant is `@media (prefers-color-scheme: dark)`
// (NOT class-based), so `dark:` utilities fire off the OS scheme regardless of
// the app theme and break the other theme (S952: an earlier `dark:`-based fix
// rendered light-green text on near-white in light mode → ratio 1.22).
// Opaque light-tint bg + dark same-hue text reads correctly on BOTH the light
// card and the dark card (a colored chip), measuring >=6 contrast either way.
const TONE_CLASS: Record<StatusTone, string> = {
  success: "border-green-200 bg-green-100 text-green-800",
  warning: "border-amber-200 bg-amber-100 text-amber-800",
  danger: "border-red-200 bg-red-100 text-red-800",
  info: "border-blue-200 bg-blue-100 text-blue-800",
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
