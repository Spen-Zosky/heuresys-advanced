/**
 * apps/api/src/modules/enterprise-size-bands/service.ts
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { EnterpriseSizeBand, UpsertEnterpriseSizeBandBody } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }
function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }

export const enterpriseSizeBandsService = {
  async list(_actor: ActorContext) { return repo.listBands(pool); },
  async getById(_actor: ActorContext, id: string): Promise<EnterpriseSizeBand> {
    const t = await repo.findBandById(pool, id);
    if (!t) throw new NotFoundError("EnterpriseSizeBand");
    return t;
  },
  async upsert(actor: ActorContext, body: UpsertEnterpriseSizeBandBody): Promise<EnterpriseSizeBand> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    return repo.upsertBand(pool, body);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const ok = await repo.deleteBand(pool, id);
    if (!ok) throw new NotFoundError("EnterpriseSizeBand");
  },
};
