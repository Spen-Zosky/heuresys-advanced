/**
 * apps/api/src/modules/learning-gaps/service.ts
 *
 * Tenant-scoped only. FK validation:
 *   - userId: must exist and belong to resolved tenant → 403 USER_NOT_IN_TENANT.
 *   - positionId (optional): must exist and belong to resolved tenant → 403 POSITION_NOT_IN_TENANT.
 *   - skillId (optional): must be visible to tenant (global or own) → 404 if missing.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  LearningGap,
  LearningGapListQuery,
  CreateLearningGapBody,
  UpdateLearningGapBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(actor: ActorContext, g: LearningGap): boolean {
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && g.tenantId === actor.tenantId;
}

async function validateFks(
  body: { userId: string; positionId?: string | null; skillId?: string | null },
  tenantId: string,
): Promise<void> {
  const u = await repo.getUserTenant(pool, body.userId);
  if (!u) throw new NotFoundError("User");
  if (u.tenantId !== tenantId) {
    throw new ForbiddenError(
      "Subject user does not belong to the gap's tenant",
      "USER_NOT_IN_TENANT",
    );
  }
  if (body.positionId) {
    const p = await repo.positionInTenant(pool, body.positionId, tenantId);
    if (!p.exists) throw new NotFoundError("Position");
    if (!p.sameTenant) {
      throw new ForbiddenError(
        "Position does not belong to the gap's tenant",
        "POSITION_NOT_IN_TENANT",
      );
    }
  }
  if (body.skillId) {
    const ok = await repo.skillVisibleToTenant(pool, body.skillId, tenantId);
    if (!ok) throw new NotFoundError("Skill");
  }
}

export const learningGapsService = {
  async list(actor: ActorContext, query: LearningGapListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listGaps(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<LearningGap> {
    const target = await repo.findGapById(pool, id);
    if (!target) throw new NotFoundError("LearningGap");
    if (!visible(actor, target)) throw new NotFoundError("LearningGap");
    return target;
  },

  async create(actor: ActorContext, body: CreateLearningGapBody): Promise<LearningGap> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const candidate = body.tenantId ?? actor.tenantId;
      if (!candidate) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId for learning gaps",
          "TENANT_ID_REQUIRED",
        );
      }
      tenantId = candidate;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    await validateFks(body, tenantId);
    return repo.insertGap(pool, tenantId, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateLearningGapBody): Promise<LearningGap> {
    const target = await repo.findGapById(pool, id);
    if (!target) throw new NotFoundError("LearningGap");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("LearningGap");
      }
    }
    const updated = await repo.updateGapPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("LearningGap");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findGapById(pool, id);
    if (!target) throw new NotFoundError("LearningGap");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("LearningGap");
      }
    }
    const ok = await repo.deleteGap(pool, id);
    if (!ok) throw new NotFoundError("LearningGap");
  },
};
