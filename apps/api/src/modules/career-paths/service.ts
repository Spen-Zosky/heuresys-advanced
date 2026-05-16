/**
 * apps/api/src/modules/career-paths/service.ts
 * Same global+tenant visibility model as learning-paths.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  CareerPath,
  CareerPathListQuery,
  CreateCareerPathBody,
  UpdateCareerPathBody,
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
function visible(actor: ActorContext, p: CareerPath): boolean {
  if (p.isGlobal) return true;
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && p.tenantId === actor.tenantId;
}

export const careerPathsService = {
  async list(actor: ActorContext, query: CareerPathListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listCareerPaths(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<CareerPath> {
    const target = await repo.findCareerPathById(pool, id);
    if (!target) throw new NotFoundError("CareerPath");
    if (!visible(actor, target)) throw new NotFoundError("CareerPath");
    return target;
  },

  async create(actor: ActorContext, body: CreateCareerPathBody): Promise<CareerPath> {
    let tenantId: string | null;
    let isGlobal = body.isGlobal;
    if (isPlatform(actor)) {
      if (isGlobal) {
        tenantId = null;
      } else {
        tenantId = body.tenantId ?? actor.tenantId ?? null;
        if (!tenantId) {
          throw new ForbiddenError(
            "PLATFORM_ADMIN must supply body.tenantId for non-global career paths",
            "TENANT_ID_REQUIRED",
          );
        }
      }
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
      isGlobal = false;
    }
    const dup = await repo.findCareerPathByCodeInScope(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `Career path code '${body.code}' already exists in this scope`,
        "CAREER_PATH_CODE_CONFLICT",
      );
    }
    return repo.insertCareerPath(pool, tenantId, { ...body, isGlobal }, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateCareerPathBody): Promise<CareerPath> {
    const target = await repo.findCareerPathById(pool, id);
    if (!target) throw new NotFoundError("CareerPath");
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may edit global career paths",
        "GLOBAL_CAREER_PATH_EDIT_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("CareerPath");
      }
    }
    const updated = await repo.updateCareerPathPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("CareerPath");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findCareerPathById(pool, id);
    if (!target) throw new NotFoundError("CareerPath");
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may delete global career paths",
        "GLOBAL_CAREER_PATH_DELETE_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("CareerPath");
      }
    }
    if (await repo.careerPathHasSteps(pool, id)) {
      throw new ConflictError(
        "Cannot delete career path with attached steps",
        "CAREER_PATH_HAS_STEPS",
      );
    }
    const ok = await repo.deleteCareerPath(pool, id);
    if (!ok) throw new NotFoundError("CareerPath");
  },
};
