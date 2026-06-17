/**
 * apps/api/src/modules/blueprint-activations/service.ts
 * Tenant-scoped. Only one ACTIVE per tenant. blueprint:activate for POST,
 * blueprint:activate also for PATCH status, blueprint:override for other patches.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  BlueprintActivation, BlueprintActivationListQuery,
  CreateBlueprintActivationBody, UpdateBlueprintActivationBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(a: ActorContext, x: BlueprintActivation): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && x.tenantId === a.tenantId;
}

export const blueprintActivationsService = {
  async list(actor: ActorContext, query: BlueprintActivationListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listActivations(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<BlueprintActivation> {
    const t = await repo.findActivationById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("BlueprintActivation");
    return t;
  },
  async create(actor: ActorContext, body: CreateBlueprintActivationBody): Promise<BlueprintActivation> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const c = body.tenantId ?? actor.tenantId;
      if (!c) throw new ForbiddenError("PLATFORM_ADMIN must supply body.tenantId", "TENANT_ID_REQUIRED");
      tenantId = c;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    if (!(await repo.variantExists(pool, body.variantId))) throw new NotFoundError("BlueprintVariant");
    if ((body.status ?? "PROPOSED") === "ACTIVE") {
      const cur = await repo.findActiveByTenant(pool, tenantId);
      if (cur) {
        throw new ConflictError(
          "Tenant already has an ACTIVE blueprint activation",
          "BLUEPRINT_ACTIVATION_ACTIVE_CONFLICT",
        );
      }
    }
    return repo.insertActivation(pool, tenantId, body, actor.userId);
  },
  async update(actor: ActorContext, id: string, patch: UpdateBlueprintActivationBody): Promise<BlueprintActivation> {
    const t = await repo.findActivationById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("BlueprintActivation");
    if (patch.status === "ACTIVE" && t.status !== "ACTIVE") {
      const cur = await repo.findActiveByTenant(pool, t.tenantId);
      if (cur && cur.blueprintActivationId !== id) {
        throw new ConflictError(
          "Tenant already has an ACTIVE blueprint activation",
          "BLUEPRINT_ACTIVATION_ACTIVE_CONFLICT",
        );
      }
    }
    const u = await repo.updateActivationPartial(pool, id, patch, actor.userId);
    if (!u) throw new NotFoundError("BlueprintActivation");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findActivationById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("BlueprintActivation");
    const ok = await repo.deleteActivation(pool, id);
    if (!ok) throw new NotFoundError("BlueprintActivation");
  },
};
