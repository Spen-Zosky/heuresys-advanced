/**
 * apps/api/src/modules/approvals/effects/tenant-activation.ts
 * 3.3 slice-3a — the first real apply-effect handler.
 *
 * resource_type = 'TENANT_ACTIVATION', resource_id = the subject tenant. On apply it
 * flips sys_tenancies.tenant_status PENDING_ACTIVATION → ACTIVE — a real, pre-existing
 * schema transition (the CHECK already allows PENDING_ACTIVATION; mirrors the guarded
 * UPDATE idiom of tenants/repository.ts). State-guarded: a 0-row result (missing tenant
 * or not pending) throws APPLY_EFFECT_FAILED, which rolls back markApplied in the same
 * transaction. This is the natural apply-effect target named in the slice-3 spec — a
 * second handler (e.g. WI-C activation-with-materialization) registers the same way,
 * no rework.
 */
import type { PoolClient } from "pg";
import type { ApprovalRequestRow } from "../repository.js";
import { ConflictError } from "../../../errors/index.js";

export const TENANT_ACTIVATION = "TENANT_ACTIVATION";

export async function applyTenantActivation(client: PoolClient, request: ApprovalRequestRow): Promise<void> {
  const tenantId = request.resourceId;
  if (!tenantId) {
    throw new ConflictError("TENANT_ACTIVATION approval has no target tenant (resource_id)", "APPLY_EFFECT_FAILED");
  }
  const res = await client.query(
    `UPDATE sys.sys_tenancies
        SET tenant_status = 'ACTIVE', updated_at = now()
      WHERE tenant_id = $1 AND tenant_status = 'PENDING_ACTIVATION'`,
    [tenantId],
  );
  if ((res.rowCount ?? 0) !== 1) {
    throw new ConflictError("Target tenant is not in PENDING_ACTIVATION state", "APPLY_EFFECT_FAILED");
  }
}
