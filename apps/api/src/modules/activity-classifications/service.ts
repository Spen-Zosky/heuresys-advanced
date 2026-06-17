/**
 * apps/api/src/modules/activity-classifications/service.ts
 * Global catalog: read for everyone (no tenant filter), write PLATFORM_ADMIN only.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  ActivityClassification, ActivityClassificationListQuery,
  CreateActivityClassificationBody, UpdateActivityClassificationBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export const activityClassificationsService = {
  async list(_actor: ActorContext, query: ActivityClassificationListQuery) {
    return repo.listAc(pool, query);
  },
  async getById(_actor: ActorContext, id: string): Promise<ActivityClassification> {
    const t = await repo.findAcById(pool, id);
    if (!t) throw new NotFoundError("ActivityClassification");
    return t;
  },
  async create(actor: ActorContext, body: CreateActivityClassificationBody): Promise<ActivityClassification> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const dup = await repo.findAcBySchemeCode(pool, body.scheme, body.code);
    if (dup) throw new ConflictError(
      `Classification '${body.scheme}/${body.code}' already exists`,
      "ACTIVITY_CLASSIFICATION_CONFLICT",
    );
    return repo.insertAc(pool, body);
  },
  async update(actor: ActorContext, id: string, patch: UpdateActivityClassificationBody): Promise<ActivityClassification> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const u = await repo.updateAcPartial(pool, id, patch);
    if (!u) throw new NotFoundError("ActivityClassification");
    return u;
  },
  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const ok = await repo.deleteAc(pool, id);
    if (!ok) throw new NotFoundError("ActivityClassification");
  },
};
