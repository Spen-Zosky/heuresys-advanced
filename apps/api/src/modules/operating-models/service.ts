/**
 * apps/api/src/modules/operating-models/service.ts
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { OperatingModel, UpsertOperatingModelBody } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }
function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }

export const operatingModelsService = {
  async list(_actor: ActorContext) { return repo.listOm(pool); },
  async getById(_actor: ActorContext, id: string): Promise<OperatingModel> {
    const t = await repo.findOmById(pool, id);
    if (!t) throw new NotFoundError("OperatingModel");
    return t;
  },
  async upsert(actor: ActorContext, body: UpsertOperatingModelBody): Promise<OperatingModel> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    return repo.upsertOm(pool, body);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const ok = await repo.deleteOm(pool, id);
    if (!ok) throw new NotFoundError("OperatingModel");
  },
};
