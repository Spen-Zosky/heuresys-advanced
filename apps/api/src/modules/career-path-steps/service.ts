/**
 * apps/api/src/modules/career-path-steps/service.ts
 *
 * Steps inherit visibility/edit rights from parent career path.
 * Unique (path_id, ordinal) at service level. Position FKs validated if present.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  CareerPath,
  CareerPathStep,
  CareerPathStepListQuery,
  CreateCareerPathStepBody,
  UpdateCareerPathStepBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findCareerPathById } from "../career-paths/repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}
function pathVisible(actor: ActorContext, p: CareerPath): boolean {
  if (p.isGlobal) return true;
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && p.tenantId === actor.tenantId;
}

async function ensurePathEditable(actor: ActorContext, pathId: string): Promise<CareerPath> {
  const parent = await findCareerPathById(pool, pathId);
  if (!parent) throw new NotFoundError("CareerPath");
  if (!pathVisible(actor, parent)) throw new NotFoundError("CareerPath");
  if (parent.isGlobal && !isPlatform(actor)) {
    throw new ForbiddenError(
      "Only PLATFORM_ADMIN may modify steps of global career paths",
      "GLOBAL_CAREER_PATH_STEP_EDIT_FORBIDDEN",
    );
  }
  return parent;
}

export const careerPathStepsService = {
  async list(actor: ActorContext, query: CareerPathStepListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listSteps(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<CareerPathStep> {
    const target = await repo.findStepById(pool, id);
    if (!target) throw new NotFoundError("CareerPathStep");
    const parent = await findCareerPathById(pool, target.pathId);
    if (!parent || !pathVisible(actor, parent)) throw new NotFoundError("CareerPathStep");
    return target;
  },

  async create(actor: ActorContext, body: CreateCareerPathStepBody): Promise<CareerPathStep> {
    await ensurePathEditable(actor, body.pathId);
    if (body.originPositionId && !(await repo.positionExists(pool, body.originPositionId))) {
      throw new NotFoundError("Position");
    }
    if (body.targetPositionId && !(await repo.positionExists(pool, body.targetPositionId))) {
      throw new NotFoundError("Position");
    }
    const dup = await repo.findStepByPathOrdinal(pool, body.pathId, body.ordinal);
    if (dup) {
      throw new ConflictError(
        `Ordinal ${body.ordinal} already used in career path`,
        "CAREER_PATH_STEP_ORDINAL_CONFLICT",
      );
    }
    return repo.insertStep(pool, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateCareerPathStepBody): Promise<CareerPathStep> {
    const target = await repo.findStepById(pool, id);
    if (!target) throw new NotFoundError("CareerPathStep");
    await ensurePathEditable(actor, target.pathId);
    if (patch.originPositionId !== undefined && patch.originPositionId !== null) {
      if (!(await repo.positionExists(pool, patch.originPositionId))) throw new NotFoundError("Position");
    }
    if (patch.targetPositionId !== undefined && patch.targetPositionId !== null) {
      if (!(await repo.positionExists(pool, patch.targetPositionId))) throw new NotFoundError("Position");
    }
    if (patch.ordinal !== undefined && patch.ordinal !== target.ordinal) {
      const dup = await repo.findStepByPathOrdinal(pool, target.pathId, patch.ordinal);
      if (dup && dup.careerPathStepId !== id) {
        throw new ConflictError(
          `Ordinal ${patch.ordinal} already used in career path`,
          "CAREER_PATH_STEP_ORDINAL_CONFLICT",
        );
      }
    }
    const updated = await repo.updateStepPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("CareerPathStep");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findStepById(pool, id);
    if (!target) throw new NotFoundError("CareerPathStep");
    await ensurePathEditable(actor, target.pathId);
    const ok = await repo.deleteStep(pool, id);
    if (!ok) throw new NotFoundError("CareerPathStep");
  },
};
