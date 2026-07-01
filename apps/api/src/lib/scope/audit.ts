/**
 * apps/api/src/lib/scope/audit.ts — F6 of ADR-0027 (scope-access audit).
 *
 * Every organizational-axis decision (list scope resolution + per-target read) records the AXIS
 * that authorized it — self / hr_mandate / org_subtree / platform / tenant / denied — so a later
 * review can tell WHY a sensitive access was granted, not just who. The record is emitted centrally
 * from the two resolver primitives (resolveOrgReadScope / canReadOrgTarget), so all F3 sensitive
 * modules are covered without per-module wiring.
 *
 * Transport is a standalone pino logger with the canonical app.log shape (same pattern as
 * modules/brownfield-wave-executor/upsert-sql.ts) so the audit line inherits the ops JSON format.
 * A tests-only in-memory capture (off by default) lets the F6 integration test assert the axis.
 */
import { pino } from "pino";

/** The authorizing axis of a scope decision (ADR-0027 §2.4 Pillar 4). */
export type ScopeAxis = "platform" | "hr_mandate" | "org_subtree" | "self" | "tenant" | "denied";

export interface ScopeAccessEvent {
  /** "resolve" = list scope resolution; "target" = per-target read gate. */
  op: "resolve" | "target";
  actorUserId: string;
  tenantId: string | null;
  /** present for op="target" (the subject whose record is being read). */
  targetUserId?: string;
  granted: boolean;
  axis: ScopeAxis;
}

const logger = pino({ name: "scope-audit", level: process.env.LOG_LEVEL ?? "info" });

// Tests-only in-memory capture. null = disabled (production default; only the pino line is emitted).
let capture: ScopeAccessEvent[] | null = null;
export function enableScopeAuditCapture(): void {
  capture = [];
}
export function drainScopeAuditCapture(): ScopeAccessEvent[] {
  const out = capture ?? [];
  capture = null;
  return out;
}

/** Record one scope decision: buffer it if a test is capturing, always emit the structured line. */
export function recordScopeAccess(evt: ScopeAccessEvent): void {
  if (capture) capture.push(evt);
  logger.info({ evt: "scope.access", ...evt }, `scope ${evt.op} ${evt.granted ? "granted" : "denied"} via ${evt.axis}`);
}
