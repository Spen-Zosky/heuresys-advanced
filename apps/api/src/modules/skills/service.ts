/**
 * apps/api/src/modules/skills/service.ts
 * Skills CRUD with global-vs-tenant visibility scope.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  Skill,
  SkillListQuery,
  CreateSkillBody,
  UpdateSkillBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(actor: ActorContext, skill: Skill): boolean {
  if (skill.isGlobal) return true;
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && skill.tenantId === actor.tenantId;
}

export const skillsService = {
  async list(actor: ActorContext, query: SkillListQuery) {
    // PLATFORM_ADMIN: no tenant filter. Others: tenant filter limits to
    // (global OR own tenant) at SQL level.
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listSkills(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<Skill> {
    const target = await repo.findSkillById(pool, id);
    if (!target) throw new NotFoundError("Skill");
    if (!visible(actor, target)) throw new NotFoundError("Skill");
    return target;
  },

  async create(actor: ActorContext, body: CreateSkillBody): Promise<Skill> {
    // PLATFORM_ADMIN may create global (isGlobal=true with NULL tenant) or
    // tenant-scoped (supply tenantId). Others may only create skills inside
    // their own tenant (isGlobal forced to false).
    let tenantId: string | null;
    let isGlobal = body.isGlobal;
    if (isPlatform(actor)) {
      if (isGlobal) {
        tenantId = null;
      } else {
        tenantId = body.tenantId ?? actor.tenantId ?? null;
        if (!tenantId) {
          throw new ForbiddenError(
            "PLATFORM_ADMIN must supply body.tenantId for non-global skills",
            "TENANT_ID_REQUIRED",
          );
        }
      }
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
      isGlobal = false; // non-platform cannot create global skills
    }
    const dup = await repo.findSkillByCodeInScope(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `Skill code '${body.code}' already exists in this scope`,
        "SKILL_CODE_CONFLICT",
      );
    }
    return repo.insertSkill(pool, tenantId, { ...body, isGlobal }, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateSkillBody): Promise<Skill> {
    const target = await repo.findSkillById(pool, id);
    if (!target) throw new NotFoundError("Skill");
    // Only PLATFORM_ADMIN may edit global skills; others may edit only
    // skills in their own tenant.
    if (target.isGlobal && !isPlatform(actor)) {
      throw new ForbiddenError(
        "Only PLATFORM_ADMIN may edit global skills",
        "GLOBAL_SKILL_EDIT_FORBIDDEN",
      );
    }
    if (!target.isGlobal && !isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("Skill");
      }
    }
    const updated = await repo.updateSkillPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("Skill");
    return updated;
  },
};
