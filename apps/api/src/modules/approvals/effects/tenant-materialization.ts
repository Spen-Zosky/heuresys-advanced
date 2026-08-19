/**
 * apps/api/src/modules/approvals/effects/tenant-materialization.ts
 * #34 B/B3 — second real apply-effect handler.
 *
 * resource_type = 'TENANT_MATERIALIZATION', resource_id = the target tenant,
 * metadata.variantVersionId = da quale MODELLO costruire. On apply it runs the very
 * same `repo.materialize` the direct endpoint runs — but as the *consequence of an
 * approval* rather than of a PLATFORM_ADMIN calling it directly. This is the seam the
 * slice-3 spec named ("a second handler registers the same way, no rework") and it is
 * what turns the BPM runtime from scaffolding into a real approval flow: until now the
 * registry held exactly one handler and sys_approval_requests had never been used.
 *
 * WHY mode is hardcoded 'apply': `plan` is a dry-run preview, so it is a thing you do
 * BEFORE requesting approval, never the outcome of one. An approved request means
 * "carry it out"; materializing in plan mode would mark the approval APPLIED while
 * changing nothing — an approval that silently did nothing is worse than a failure.
 *
 * TRANSACTIONALITY: the handler receives the apply transaction's client and passes it
 * straight down, so the whole materialization (org units, positions, users,
 * assignments, evidence) commits or rolls back together with markApplied. A partially
 * materialized tenant left behind by a failed approval is therefore impossible.
 *
 * IDEMPOTENCY comes for free from repo.materialize itself (it skips what already
 * exists) — re-applying yields 0 created / all skipped rather than duplicates.
 */
import type { PoolClient } from "pg";
import type { ApprovalRequestRow } from "../repository.js";
import { ConflictError } from "../../../errors/index.js";
import { BlueprintBuildSource } from "../../tenant-materialization/blueprint-build-source.js";
import { findTenantStatus, materialize } from "../../tenant-materialization/repository.js";

export const TENANT_MATERIALIZATION = "TENANT_MATERIALIZATION";

export async function applyTenantMaterialization(
  client: PoolClient,
  request: ApprovalRequestRow,
): Promise<void> {
  const tenantId = request.resourceId;
  if (!tenantId) {
    throw new ConflictError(
      "TENANT_MATERIALIZATION approval has no target tenant (resource_id)",
      "APPLY_EFFECT_FAILED",
    );
  }

  // ⚠ ERA la chiave di un archetipo scritto in TypeScript, letta dai metadati. Ritirato
  //   da `#132` F3 (E29): qualunque azienda si costruisse nasceva la stessa banca. Ora si
  //   indica la VERSIONE DI MODELLO, e il contenuto si legge dal database.
  const variantVersionId = request.metadata["variantVersionId"];
  if (typeof variantVersionId !== "string" || variantVersionId.length === 0) {
    throw new ConflictError(
      "TENANT_MATERIALIZATION approval has no metadata.variantVersionId",
      "APPLY_EFFECT_FAILED",
    );
  }

  // Same M-1 guard as the direct endpoint: the target tenant must exist and be ACTIVE.
  // Re-checked HERE and not only at request time, because approval is asynchronous — the
  // tenant may have been archived between the request and its approval.
  const status = await findTenantStatus(client, tenantId);
  if (status === null) {
    throw new ConflictError("Target tenant no longer exists", "APPLY_EFFECT_FAILED");
  }
  if (status !== "ACTIVE") {
    throw new ConflictError(
      `Target tenant is not ACTIVE (status=${status})`,
      "APPLY_EFFECT_FAILED",
    );
  }

  // Il piano si legge PRIMA della costruzione: un modello vuoto o incoerente fa fallire
  // l'atto invece di costruire zero righe «con successo» (`#132` F2).
  const piano = await new BlueprintBuildSource(client, variantVersionId).plan();
  await materialize(client, tenantId, piano, "apply");
}
