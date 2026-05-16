/**
 * apps/api/src/modules/training-initiatives/service.ts
 *
 * Always tenant-scoped (training_initiative_tenant_id NOT NULL).
 * - PLATFORM_ADMIN may read/write across tenants; must specify body.tenantId
 *   on create (or fall back to their actor.tenantId if present).
 * - Non-platform actors are pinned to their own tenant.
 *
 * FK validation:
 *   - moduleId must reference an existing learning module visible to the
 *     resolved tenantId (global OR same tenant).
 *   - facilitatorUserId, if provided, must exist and belong to the same tenant.
 *
 * No DELETE — retire by updating status to 'CANCELLED'.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  TrainingInitiative,
  TrainingInitiativeListQuery,
  CreateTrainingInitiativeBody,
  UpdateTrainingInitiativeBody,
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

function visible(actor: ActorContext, t: TrainingInitiative): boolean {
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && t.tenantId === actor.tenantId;
}

async function ensureModuleUsable(moduleId: string, tenantId: string): Promise<void> {
  const scope = await repo.getModuleScope(pool, moduleId);
  if (!scope) throw new NotFoundError("LearningModule");
  if (!scope.isGlobal && scope.tenantId !== tenantId) {
    throw new ForbiddenError(
      "Learning module not accessible in this tenant",
      "LEARNING_MODULE_NOT_IN_TENANT",
    );
  }
}

async function ensureFacilitatorInTenant(facilitatorUserId: string, tenantId: string): Promise<void> {
  const u = await repo.getUserTenant(pool, facilitatorUserId);
  if (!u) throw new NotFoundError("User");
  // PLATFORM_ADMIN users have user_tenant_id = NULL — not allowed as facilitator
  // of a tenant initiative (would create cross-tenant exposure). Require match.
  if (u.tenantId !== tenantId) {
    throw new ForbiddenError(
      "Facilitator user does not belong to the initiative's tenant",
      "FACILITATOR_NOT_IN_TENANT",
    );
  }
}

export const trainingInitiativesService = {
  async list(actor: ActorContext, query: TrainingInitiativeListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listTrainingInitiatives(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<TrainingInitiative> {
    const target = await repo.findTiById(pool, id);
    if (!target) throw new NotFoundError("TrainingInitiative");
    if (!visible(actor, target)) throw new NotFoundError("TrainingInitiative");
    return target;
  },

  async create(actor: ActorContext, body: CreateTrainingInitiativeBody): Promise<TrainingInitiative> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const candidate = body.tenantId ?? actor.tenantId;
      if (!candidate) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId for training initiatives",
          "TENANT_ID_REQUIRED",
        );
      }
      tenantId = candidate;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    await ensureModuleUsable(body.moduleId, tenantId);
    if (body.facilitatorUserId) {
      await ensureFacilitatorInTenant(body.facilitatorUserId, tenantId);
    }
    const dup = await repo.findTiByTenantCode(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `Training initiative code '${body.code}' already exists in this tenant`,
        "TRAINING_INITIATIVE_CODE_CONFLICT",
      );
    }
    return repo.insertTi(pool, tenantId, body, actor.userId);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: UpdateTrainingInitiativeBody,
  ): Promise<TrainingInitiative> {
    const target = await repo.findTiById(pool, id);
    if (!target) throw new NotFoundError("TrainingInitiative");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("TrainingInitiative");
      }
    }
    if (patch.facilitatorUserId !== undefined && patch.facilitatorUserId !== null) {
      await ensureFacilitatorInTenant(patch.facilitatorUserId, target.tenantId);
    }
    const updated = await repo.updateTiPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("TrainingInitiative");
    return updated;
  },
};
