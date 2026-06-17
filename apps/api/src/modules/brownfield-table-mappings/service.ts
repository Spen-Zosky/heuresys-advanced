/**
 * apps/api/src/modules/brownfield-table-mappings/service.ts
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  BrownfieldTableMapping, BrownfieldTableMappingListQuery, ApproveBrownfieldTableMappingBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export const brownfieldTableMappingsService = {
  async list(_actor: ActorContext, query: BrownfieldTableMappingListQuery) {
    return repo.listMappings(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<BrownfieldTableMapping> {
    const t = await repo.findMappingById(pool, id);
    if (!t) throw new NotFoundError("BrownfieldTableMapping");
    return t;
  },
  async decide(actor: ActorContext, id: string, body: ApproveBrownfieldTableMappingBody): Promise<BrownfieldTableMapping> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const r = await repo.decideMapping(pool, id, body, actor.userId);
    if (!r) throw new NotFoundError("BrownfieldTableMapping");
    return r;
  },
};
