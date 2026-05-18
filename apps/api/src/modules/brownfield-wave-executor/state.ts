/**
 * apps/api/src/modules/brownfield-wave-executor/state.ts
 * State machine for the wave executor.
 */
import type { WaveExecutorState } from "@heuresys/shared";

const ALLOWED: Record<WaveExecutorState, ReadonlyArray<WaveExecutorState>> = {
  PENDING: ["STAGING", "FAILED", "CANCELLED"],
  STAGING: ["VALIDATING", "FAILED", "CANCELLED"],
  VALIDATING: ["APPROVED", "FAILED", "CANCELLED"],
  APPROVED: ["UPSERTING", "FAILED", "CANCELLED"],
  UPSERTING: ["COMPLETE", "FAILED", "CANCELLED"],
  COMPLETE: [],
  FAILED: [],
  CANCELLED: [],
};

export function isTerminal(state: WaveExecutorState): boolean {
  return state === "COMPLETE" || state === "FAILED" || state === "CANCELLED";
}

export function canTransition(
  from: WaveExecutorState,
  to: WaveExecutorState,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: WaveExecutorState,
  to: WaveExecutorState,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid wave executor transition: ${from} → ${to}`);
  }
}
