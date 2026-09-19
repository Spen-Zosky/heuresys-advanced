/**
 * apps/api/src/modules/seed-acquisition-runs/service.ts
 * Tenant-scoped. seed_acquisition:trigger for POST/PATCH.
 */
import { pool } from "../../db/client.js";
import { perimetroClienti, puoVedereCliente, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  SeedAcquisitionRun, SeedAcquisitionRunListQuery,
  CreateSeedAcquisitionRunBody, UpdateSeedAcquisitionRunBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(a: ActorContext, r: SeedAcquisitionRun): boolean {
  // Una corsa senza tenant (nata prima che l'azienda esistesse) e' visibile
  // solo a chi non ha filtro (PLATFORM_ADMIN) — stesso criterio di tenant-blueprints (R-5).
  if (r.tenantId === null) return perimetroClienti(a) === undefined;
  return puoVedereCliente(a, r.tenantId);
}

export const seedAcquisitionRunsService = {
  async list(actor: ActorContext, query: SeedAcquisitionRunListQuery) {
    const perimetro = perimetroClienti(actor);
    return repo.listRuns(pool, { tenantIds: perimetro ? [...perimetro] : undefined, query });
  },
  async getById(actor: ActorContext, id: string): Promise<SeedAcquisitionRun> {
    const t = await repo.findRunById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("SeedAcquisitionRun");
    return t;
  },
  async trigger(actor: ActorContext, body: CreateSeedAcquisitionRunBody): Promise<SeedAcquisitionRun> {
    const perimetro = perimetroClienti(actor);
    let tenantId: string;
    if (perimetro === undefined) {
      // PLATFORM_ADMIN: nessun filtro, indica il tenant.
      const c = body.tenantId ?? actor.tenantId;
      if (!c) throw new ForbiddenError("PLATFORM_ADMIN must supply body.tenantId", "TENANT_ID_REQUIRED");
      tenantId = c;
    } else if (actor.assignedTenantIds !== undefined) {
      // Ruolo di piattaforma assegnato (es. IMPLEMENTATION_CONSULTANT, D9=B): il
      // proprio tenant "di casa" (actor.tenantId, sempre valorizzato — I-G #35)
      // NON e' il perimetro. Deve indicare un tenant fra quelli assegnati. 404
      // (non 403) sul tenant fuori perimetro, per non confermarne l'esistenza
      // (stesso criterio di puoVedereCliente altrove).
      const c = body.tenantId;
      if (!c) {
        throw new ForbiddenError("Serve indicare tenantId", "TENANT_ID_REQUIRED");
      }
      if (!perimetro.has(c)) {
        throw new NotFoundError("Tenant");
      }
      tenantId = c;
    } else {
      // TENANT_ADMIN e simili: sempre e solo il proprio tenant.
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
