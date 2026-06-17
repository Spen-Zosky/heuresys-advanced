/**
 * apps/api/src/modules/positions/service.ts
 * Business logic for the positions module. Scope filter:
 *  - PLATFORM_ADMIN: cross-tenant
 *  - Others: own-tenant only (positions are tenant-scoped)
 *  - position:update for MANAGER: must own the position (• per AUTH §6)
 *  - position:delete for MANAGER: not granted (— per AUTH §6)
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  Position,
  PositionListQuery,
  PositionListResponse,
  CreatePositionBody,
  UpdatePositionBody,
  PositionSkillRequirement,
  AddPositionSkillBody,
  PositionKpiRequirement,
  PositionIntelligenceProfile,
} from "@heuresys/shared";
import * as repo from "./repository.js";

const ADMIN_ROLES: RoleCode[] = ["PLATFORM_ADMIN", "TENANT_ADMIN", "HRMS_MANAGER"];

function isPlatformAdmin(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}
function isAdminLike(a: ActorContext): boolean {
  return a.roles.some((r) => ADMIN_ROLES.includes(r));
}
function isManager(a: ActorContext): boolean {
  return a.roles.includes("MANAGER");
}
function requireOwnTenant(a: ActorContext): string {
  if (!a.tenantId) throw new ForbiddenError("Tenant context required");
  return a.tenantId;
}

async function ensureSameTenant(actor: ActorContext, target: Position): Promise<void> {
  if (isPlatformAdmin(actor)) return;
  if (!actor.tenantId || target.tenantId !== actor.tenantId) {
    throw new NotFoundError("Position"); // anti-enumeration
  }
}

async function canUpdate(actor: ActorContext, target: Position): Promise<boolean> {
  if (isAdminLike(actor)) {
    if (isPlatformAdmin(actor)) return true;
    return target.tenantId === actor.tenantId;
  }
  if (isManager(actor)) {
    return target.tenantId === actor.tenantId && target.ownerUserId === actor.userId;
  }
  return false;
}

export const positionsService = {
  async list(actor: ActorContext, query: PositionListQuery): Promise<PositionListResponse> {
    const tenantId = isPlatformAdmin(actor) ? undefined : requireOwnTenant(actor);
    return repo.listPositions(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<Position> {
    const target = await repo.findPositionById(pool, id);
    if (!target) throw new NotFoundError("Position");
    await ensureSameTenant(actor, target);
    return target;
  },

  async create(actor: ActorContext, body: CreatePositionBody): Promise<Position> {
    // Route preHandler gates position:create (PLATFORM/TENANT/HRMS_MANAGER).
    let tenantId: string;
    if (isPlatformAdmin(actor)) {
      tenantId = body.tenantId ?? actor.tenantId ?? "";
      if (!tenantId) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId",
          "TENANT_ID_REQUIRED",
        );
      }
    } else {
      tenantId = requireOwnTenant(actor);
    }
    const dup = await repo.findPositionByCodeInTenant(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `Position code '${body.code}' already in use in this tenant`,
        "POSITION_CODE_CONFLICT",
      );
    }
    return repo.insertPosition(pool, tenantId, body, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdatePositionBody): Promise<Position> {
    const target = await repo.findPositionById(pool, id);
    if (!target) throw new NotFoundError("Position");
    if (!(await canUpdate(actor, target))) {
      // Hide existence for cross-tenant; 403 within tenant on insufficient scope.
      if (isPlatformAdmin(actor) || target.tenantId === actor.tenantId) {
        throw new ForbiddenError(
          "Insufficient privileges to update this position",
          "POSITION_UPDATE_FORBIDDEN",
        );
      }
      throw new NotFoundError("Position");
    }
    const updated = await repo.updatePositionPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("Position");
    return updated;
  },

  async softDelete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findPositionById(pool, id);
    if (!target) throw new NotFoundError("Position");
    // Only admin-like roles per matrix.
    if (!isAdminLike(actor)) {
      throw new ForbiddenError(
        "Insufficient privileges to delete positions",
        "POSITION_DELETE_FORBIDDEN",
      );
    }
    if (!isPlatformAdmin(actor) && target.tenantId !== actor.tenantId) {
      throw new NotFoundError("Position");
    }
    const ok = await repo.softDeletePosition(pool, id);
    if (!ok) {
      throw new ConflictError("Position already inactive", "POSITION_ALREADY_INACTIVE");
    }
  },

  /* -------------------------------------------------- PIP read */

  async getIntelligenceProfile(
    actor: ActorContext,
    id: string,
  ): Promise<PositionIntelligenceProfile> {
    const profile = await repo.findIntelligenceProfile(pool, id);
    if (!profile) throw new NotFoundError("Position");
    if (!isPlatformAdmin(actor)) {
      if (!actor.tenantId || profile.tenantId !== actor.tenantId) {
        throw new NotFoundError("Position");
      }
    }
    return profile;
  },

  /* -------------------------------------------------- skill requirements */

  async listSkills(actor: ActorContext, positionId: string): Promise<PositionSkillRequirement[]> {
    const pos = await this.getById(actor, positionId); // re-uses scope check
    return repo.listSkillRequirements(pool, pos.positionId);
  },

  async addSkill(
    actor: ActorContext,
    positionId: string,
    body: AddPositionSkillBody,
  ): Promise<PositionSkillRequirement> {
    const pos = await this.getById(actor, positionId);
    if (!(await canUpdate(actor, pos))) {
      throw new ForbiddenError(
        "Insufficient privileges to modify this position's skills",
        "POSITION_SKILL_WRITE_FORBIDDEN",
      );
    }
    const dup = await repo.findSkillRequirement(pool, pos.positionId, body.skillId);
    if (dup) {
      throw new ConflictError(
        "Skill requirement already exists on this position",
        "POSITION_SKILL_DUPLICATE",
      );
    }
    return repo.insertSkillRequirement(pool, pos.positionId, pos.tenantId, body, actor.userId);
  },

  async removeSkill(actor: ActorContext, positionId: string, skillId: string): Promise<void> {
    const pos = await this.getById(actor, positionId);
    if (!(await canUpdate(actor, pos))) {
      throw new ForbiddenError(
        "Insufficient privileges to modify this position's skills",
        "POSITION_SKILL_WRITE_FORBIDDEN",
      );
    }
    const ok = await repo.deleteSkillRequirement(pool, pos.positionId, skillId);
    if (!ok) throw new NotFoundError("Skill requirement");
  },

  /* -------------------------------------------------- kpi requirements (read-only) */

  async listKpis(actor: ActorContext, positionId: string): Promise<PositionKpiRequirement[]> {
    const pos = await this.getById(actor, positionId);
    return repo.listKpiRequirements(pool, pos.positionId);
  },
};
