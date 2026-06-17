/**
 * apps/api/src/modules/learning-modules/service.ts
 * Same global+tenant visibility model as skills + kpi-definitions.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  LearningModule,
  LearningModuleListQuery,
  CreateLearningModuleBody,
  UpdateLearningModuleBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(actor: ActorContext, m: LearningModule): boolean {
  if (m.isGlobal) return true;
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && m.tenantId === actor.tenantId;
}

export const learningModulesService = {
  async list(actor: ActorContext, query: LearningModuleListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listLearningModules(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<LearningModule> {
    const target = await repo.findLmById(pool, id);
    if (!target) throw new NotFoundError("LearningModule");
    if (!visible(actor, target)) throw new NotFoundError("LearningModule");
    return target;
  },

  async create(actor: ActorContext, body: CreateLearningModuleBody): Promise<LearningModule> {
    let tenantId: string | null;
    let isGlobal = body.isGlobal;
    if (isPlatform(actor)) {
      if (isGlobal) {
        tenantId = null;
      } else {
        tenantId = body.tenantId ?? actor.tenantId ?? null;
        if (!tenantId) {
          throw new ForbiddenError(
            "PLATFORM_ADMIN must supply body.tenantId for non-global modules",
            "TENANT_ID_REQUIRED",
          );
        }
      }
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
      isGlobal = false;
    }
    const dup = await repo.findLmByCodeInScope(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `Learning module code '${body.code}' already exists in this scope`,
        "LEARNING_MODULE_CODE_CONFLICT",
      );
    }
    return repo.insertLm(pool, tenantId, { ...body, isGlobal }, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateLearningModuleBody): Promise<LearningModule> {
    const target = await repo.findLmById(pool, id);
    if (!target) throw new NotFoundError("LearningModule");
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may edit global learning modules",
        "GLOBAL_LEARNING_EDIT_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("LearningModule");
      }
    }
    const updated = await repo.updateLmPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("LearningModule");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findLmById(pool, id);
    if (!target) throw new NotFoundError("LearningModule");
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may delete global learning modules",
        "GLOBAL_LEARNING_DELETE_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("LearningModule");
      }
    }
    const ok = await repo.deleteLm(pool, id);
    if (!ok) throw new NotFoundError("LearningModule");
  },
};
