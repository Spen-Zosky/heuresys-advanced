/**
 * apps/api/src/modules/position-succession-relevance/service.ts
 * 1:1 with position via unique index. Tenant inherited from position.
 * PUT/upsert idempotent.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  PositionSuccessionRelevance,
  PositionSuccessionRelevanceListQuery,
  UpsertPositionSuccessionRelevanceBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(actor: ActorContext, r: PositionSuccessionRelevance): boolean {
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && r.tenantId === actor.tenantId;
}

export const positionSuccessionRelevanceService = {
  async list(actor: ActorContext, query: PositionSuccessionRelevanceListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listRelevance(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<PositionSuccessionRelevance> {
    const target = await repo.findRelevanceById(pool, id);
    if (!target) throw new NotFoundError("PositionSuccessionRelevance");
    if (!visible(actor, target)) throw new NotFoundError("PositionSuccessionRelevance");
    return target;
  },

  async upsert(
    actor: ActorContext,
    body: UpsertPositionSuccessionRelevanceBody,
  ): Promise<PositionSuccessionRelevance> {
    if (!isPlatform(actor) && !actor.tenantId) {
      throw new ForbiddenError("Tenant context required");
    }
    const p = await repo.positionInTenant(pool, body.positionId, actor.tenantId ?? "");
    if (!p.exists || !p.tenantId) throw new NotFoundError("Position");
    if (!isPlatform(actor) && !p.sameTenant) {
      throw new ForbiddenError("Position not in actor tenant", "POSITION_NOT_IN_TENANT");
    }
    return repo.upsertRelevance(pool, p.tenantId, body, actor.userId);
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findRelevanceById(pool, id);
    if (!target) throw new NotFoundError("PositionSuccessionRelevance");
    if (!visible(actor, target)) throw new NotFoundError("PositionSuccessionRelevance");
    const ok = await repo.deleteRelevance(pool, id);
    if (!ok) throw new NotFoundError("PositionSuccessionRelevance");
  },
};
