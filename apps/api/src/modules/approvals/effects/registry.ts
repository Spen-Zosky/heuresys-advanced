/**
 * apps/api/src/modules/approvals/effects/registry.ts
 * 3.3 slice-3a — apply-effect handler registry.
 *
 * Keyed by approval_request_resource_type. When an APPROVED request is applied,
 * applyRequest dispatches the registered handler INSIDE the same transaction as
 * markApplied — so a handler throw rolls the whole apply back (typed
 * APPLY_EFFECT_FAILED). An unknown/null resource_type → no handler → the apply is a
 * pure PENDING/APPROVED→APPLIED marker (backward-compatible). No schema change:
 * reuses the polymorphic resource_type/resource_id from mig 000132.
 */
import type { PoolClient } from "pg";
import type { ApprovalRequestRow } from "../repository.js";

export type ApplyEffectHandler = (client: PoolClient, request: ApprovalRequestRow) => Promise<void>;

const registry = new Map<string, ApplyEffectHandler>();

/** Register (or override) the apply-effect handler for a resource_type. */
export function registerApplyEffect(resourceType: string, handler: ApplyEffectHandler): void {
  registry.set(resourceType, handler);
}

/** The handler for a resource_type, or undefined (null/unknown → no-op pure marker). */
export function getApplyEffect(resourceType: string | null | undefined): ApplyEffectHandler | undefined {
  return resourceType ? registry.get(resourceType) : undefined;
}
