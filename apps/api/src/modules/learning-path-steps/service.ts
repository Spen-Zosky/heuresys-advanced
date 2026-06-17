/**
 * apps/api/src/modules/learning-path-steps/service.ts
 *
 * Steps inherit visibility/edit rights from their parent path.
 * Conflicts:
 *   - (path_id, ordinal) unique → LEARNING_PATH_STEP_ORDINAL_CONFLICT 409.
 *   - module_id must exist → 404 LearningModule.
 *   - parent path must be visible to actor (404 if cross-tenant).
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  LearningPathStep,
  LearningPathStepListQuery,
  CreateLearningPathStepBody,
  UpdateLearningPathStepBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findPathById } from "../learning-paths/repository.js";
import type { LearningPath } from "@heuresys/shared";

function pathVisible(actor: ActorContext, p: LearningPath): boolean {
  if (p.isGlobal) return true;
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && p.tenantId === actor.tenantId;
}

async function ensurePathEditable(actor: ActorContext, pathId: string): Promise<LearningPath> {
  const parent = await findPathById(pool, pathId);
  if (!parent) throw new NotFoundError("LearningPath");
  if (!pathVisible(actor, parent)) throw new NotFoundError("LearningPath");
  if (parent.isGlobal && !isPlatform(actor)) {
    throw new ForbiddenError(
      "Only PLATFORM_ADMIN may modify steps of global learning paths",
      "GLOBAL_LEARNING_PATH_STEP_EDIT_FORBIDDEN",
    );
  }
  return parent;
}

export const learningPathStepsService = {
  async list(actor: ActorContext, query: LearningPathStepListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listSteps(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<LearningPathStep> {
    const target = await repo.findStepById(pool, id);
    if (!target) throw new NotFoundError("LearningPathStep");
    const parent = await findPathById(pool, target.pathId);
    if (!parent || !pathVisible(actor, parent)) {
      throw new NotFoundError("LearningPathStep");
    }
    return target;
  },

  async create(actor: ActorContext, body: CreateLearningPathStepBody): Promise<LearningPathStep> {
    await ensurePathEditable(actor, body.pathId);
    if (!(await repo.moduleExists(pool, body.moduleId))) {
      throw new NotFoundError("LearningModule");
    }
    const dup = await repo.findStepByPathOrdinal(pool, body.pathId, body.ordinal);
    if (dup) {
      throw new ConflictError(
        `Ordinal ${body.ordinal} already used in path`,
        "LEARNING_PATH_STEP_ORDINAL_CONFLICT",
      );
    }
    return repo.insertStep(pool, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateLearningPathStepBody): Promise<LearningPathStep> {
    const target = await repo.findStepById(pool, id);
    if (!target) throw new NotFoundError("LearningPathStep");
    await ensurePathEditable(actor, target.pathId);
    if (patch.moduleId !== undefined) {
      if (!(await repo.moduleExists(pool, patch.moduleId))) {
        throw new NotFoundError("LearningModule");
      }
    }
    if (patch.ordinal !== undefined && patch.ordinal !== target.ordinal) {
      const dup = await repo.findStepByPathOrdinal(pool, target.pathId, patch.ordinal);
      if (dup && dup.learningPathStepId !== id) {
        throw new ConflictError(
          `Ordinal ${patch.ordinal} already used in path`,
          "LEARNING_PATH_STEP_ORDINAL_CONFLICT",
        );
      }
    }
    const updated = await repo.updateStepPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("LearningPathStep");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findStepById(pool, id);
    if (!target) throw new NotFoundError("LearningPathStep");
    await ensurePathEditable(actor, target.pathId);
    const ok = await repo.deleteStep(pool, id);
    if (!ok) throw new NotFoundError("LearningPathStep");
  },
};
