/**
 * apps/api/src/modules/learning-paths/service.ts
 * Mirrors learning-modules visibility model:
 *   - PLATFORM_ADMIN may create global (tenant_id NULL, is_global=true) or
 *     tenant-scoped (body.tenantId required if non-global).
 *   - Non-platform actors: pinned to own tenant, isGlobal forced false.
 *   - Global edits/deletes restricted to PLATFORM_ADMIN.
 *   - Delete blocked if any path step still references this path.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  LearningPath,
  LearningPathListQuery,
  CreateLearningPathBody,
  UpdateLearningPathBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}
function visible(actor: ActorContext, p: LearningPath): boolean {
  if (p.isGlobal) return true;
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && p.tenantId === actor.tenantId;
}

export const learningPathsService = {
  async list(actor: ActorContext, query: LearningPathListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listPaths(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<LearningPath> {
    const target = await repo.findPathById(pool, id);
    if (!target) throw new NotFoundError("LearningPath");
    if (!visible(actor, target)) throw new NotFoundError("LearningPath");
    return target;
  },

  async create(actor: ActorContext, body: CreateLearningPathBody): Promise<LearningPath> {
    let tenantId: string | null;
    let isGlobal = body.isGlobal;
    if (isPlatform(actor)) {
      if (isGlobal) {
        tenantId = null;
      } else {
        tenantId = body.tenantId ?? actor.tenantId ?? null;
        if (!tenantId) {
          throw new ForbiddenError(
            "PLATFORM_ADMIN must supply body.tenantId for non-global paths",
            "TENANT_ID_REQUIRED",
          );
        }
      }
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
      isGlobal = false;
    }
    const dup = await repo.findPathByCodeInScope(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `Learning path code '${body.code}' already exists in this scope`,
        "LEARNING_PATH_CODE_CONFLICT",
      );
    }
    return repo.insertPath(pool, tenantId, { ...body, isGlobal }, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateLearningPathBody): Promise<LearningPath> {
    const target = await repo.findPathById(pool, id);
    if (!target) throw new NotFoundError("LearningPath");
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may edit global learning paths",
        "GLOBAL_LEARNING_PATH_EDIT_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("LearningPath");
      }
    }
    const updated = await repo.updatePathPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("LearningPath");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findPathById(pool, id);
    if (!target) throw new NotFoundError("LearningPath");
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may delete global learning paths",
        "GLOBAL_LEARNING_PATH_DELETE_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("LearningPath");
      }
    }
    if (await repo.pathHasSteps(pool, id)) {
      throw new ConflictError(
        "Cannot delete learning path with attached steps",
        "LEARNING_PATH_HAS_STEPS",
      );
    }
    const ok = await repo.deletePath(pool, id);
    if (!ok) throw new NotFoundError("LearningPath");
  },
};
