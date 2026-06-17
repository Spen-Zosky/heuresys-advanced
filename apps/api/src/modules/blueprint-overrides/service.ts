/**
 * apps/api/src/modules/blueprint-overrides/service.ts
 * Upsert per (activation, process). Tenant inherited from activation.
 * Process must belong to the activation's variant.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  BlueprintOverride, BlueprintOverrideListQuery, UpsertBlueprintOverrideBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

async function ensureActivationVisible(actor: ActorContext, activationId: string): Promise<void> {
  const t = await repo.getActivationTenant(pool, activationId);
  if (!t) throw new NotFoundError("BlueprintActivation");
  if (!isPlatform(actor) && t !== actor.tenantId) throw new NotFoundError("BlueprintActivation");
}

export const blueprintOverridesService = {
  async list(actor: ActorContext, query: BlueprintOverrideListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listOverrides(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<BlueprintOverride> {
    const t = await repo.findOverrideById(pool, id);
    if (!t) throw new NotFoundError("BlueprintOverride");
    await ensureActivationVisible(actor, t.activationId);
    return t;
  },
  async upsert(actor: ActorContext, body: UpsertBlueprintOverrideBody): Promise<BlueprintOverride> {
    await ensureActivationVisible(actor, body.activationId);
    const aVariant = await repo.getActivationVariant(pool, body.activationId);
    const pVariant = await repo.getProcessVariant(pool, body.processId);
    if (!pVariant) throw new NotFoundError("BlueprintProcess");
    if (aVariant !== pVariant) {
      throw new ForbiddenError(
        "Process does not belong to the activation's variant",
        "OVERRIDE_PROCESS_VARIANT_MISMATCH",
      );
    }
    return repo.upsertOverride(pool, body, actor.userId);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findOverrideById(pool, id);
    if (!t) throw new NotFoundError("BlueprintOverride");
    await ensureActivationVisible(actor, t.activationId);
    const ok = await repo.deleteOverride(pool, id);
    if (!ok) throw new NotFoundError("BlueprintOverride");
  },
};
