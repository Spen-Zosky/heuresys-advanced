/**
 * apps/api/src/modules/brownfield-import-runs/service.ts
 * PLATFORM_ADMIN gated.
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  BrownfieldImportRun, BrownfieldImportRunListQuery,
  CreateBrownfieldImportRunBody, UpdateBrownfieldImportRunBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }
function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }

export const brownfieldImportRunsService = {
  async list(_actor: ActorContext, query: BrownfieldImportRunListQuery) {
    return repo.listRuns(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<BrownfieldImportRun> {
    const t = await repo.findRunById(pool, id);
    if (!t) throw new NotFoundError("BrownfieldImportRun");
    return t;
  },
  async trigger(actor: ActorContext, body: CreateBrownfieldImportRunBody): Promise<BrownfieldImportRun> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    return repo.insertRun(pool, body, actor.userId);
  },
  async update(actor: ActorContext, id: string, patch: UpdateBrownfieldImportRunBody): Promise<BrownfieldImportRun> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const u = await repo.updateRunPartial(pool, id, patch);
    if (!u) throw new NotFoundError("BrownfieldImportRun");
    return u;
  },
};
