/**
 * apps/api/src/modules/activity-classification-mappings/service.ts
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  ActivityClassificationMapping, ActivityMappingListQuery, CreateActivityMappingBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export const activityMappingsService = {
  async list(_actor: ActorContext, query: ActivityMappingListQuery) {
    return repo.listMappings(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<ActivityClassificationMapping> {
    const t = await repo.findMappingById(pool, id);
    if (!t) throw new NotFoundError("ActivityClassificationMapping");
    return t;
  },
  async create(actor: ActorContext, body: CreateActivityMappingBody): Promise<ActivityClassificationMapping> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    if (!(await repo.acExists(pool, body.sourceId))) throw new NotFoundError("ActivityClassification");
    if (!(await repo.acExists(pool, body.targetId))) throw new NotFoundError("ActivityClassification");
    const dup = await repo.findExistingMapping(pool, body.sourceId, body.targetId);
    if (dup) throw new ConflictError("Mapping already exists for this pair", "ACTIVITY_MAPPING_CONFLICT");
    return repo.insertMapping(pool, body);
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const ok = await repo.deleteMapping(pool, id);
    if (!ok) throw new NotFoundError("ActivityClassificationMapping");
  },
};
