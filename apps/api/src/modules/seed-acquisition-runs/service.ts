/**
 * apps/api/src/modules/seed-acquisition-runs/service.ts
 * Tenant-scoped. seed_acquisition:trigger for POST/PATCH.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  SeedAcquisitionRun, SeedAcquisitionRunListQuery,
  CreateSeedAcquisitionRunBody, UpdateSeedAcquisitionRunBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(a: ActorContext, r: SeedAcquisitionRun): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && r.tenantId === a.tenantId;
}

export const seedAcquisitionRunsService = {
  async list(actor: ActorContext, query: SeedAcquisitionRunListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listRuns(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<SeedAcquisitionRun> {
    const t = await repo.findRunById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("SeedAcquisitionRun");
    return t;
  },
  async trigger(actor: ActorContext, body: CreateSeedAcquisitionRunBody): Promise<SeedAcquisitionRun> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const c = body.tenantId ?? actor.tenantId;
      if (!c) throw new ForbiddenError("PLATFORM_ADMIN must supply body.tenantId", "TENANT_ID_REQUIRED");
      tenantId = c;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    return repo.insertRun(pool, tenantId, body, actor.userId);
  },
  async update(actor: ActorContext, id: string, patch: UpdateSeedAcquisitionRunBody): Promise<SeedAcquisitionRun> {
    const t = await repo.findRunById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("SeedAcquisitionRun");
    const u = await repo.updateRunPartial(pool, id, patch, actor.userId);
    if (!u) throw new NotFoundError("SeedAcquisitionRun");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    const t = await repo.findRunById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("SeedAcquisitionRun");
    const ok = await repo.deleteRun(pool, id);
    if (!ok) throw new NotFoundError("SeedAcquisitionRun");
  },
};
