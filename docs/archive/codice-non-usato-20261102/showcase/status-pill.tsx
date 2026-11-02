// QW-E5 (de-dup): StatusPill / StatusBadge / statusTone were an identical copy in apps/web +
// apps/showcase. Promoted to @heuresys/ui (>= 0.1.7). This file is now a re-export shim so the
// existing import path (@/components/status-pill) stays valid for every call site. The upstream
// tone type is `StatusPillTone`; re-aliased to `StatusTone` for backward-compatible local imports.
export { StatusPill, StatusBadge, statusTone } from "@heuresys/ui";
export type { StatusPillTone as StatusTone } from "@heuresys/ui";
