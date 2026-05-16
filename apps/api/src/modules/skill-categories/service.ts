/**
 * apps/api/src/modules/skill-categories/service.ts
 * Platform-level taxonomy. Read open; mutations PLATFORM_ADMIN-only.
 * FK validation against sys_skill_families on create/update.
 * DELETE refuses if skills are attached (ON DELETE SET NULL would orphan
 * skill_category_id silently — we prefer an explicit 409).
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  SkillCategory,
  SkillCategoryListQuery,
  CreateSkillCategoryBody,
  UpdateSkillCategoryBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function ensurePlatformAdmin(actor: ActorContext): void {
  if (!actor.roles.includes("PLATFORM_ADMIN")) {
    throw new ForbiddenError(
      "Only PLATFORM_ADMIN may manage skill categories",
      "SKILL_CATEGORY_ADMIN_ONLY",
    );
  }
}

export const skillCategoriesService = {
  async list(_actor: ActorContext, query: SkillCategoryListQuery) {
    return repo.listSkillCategories(pool, query);
  },

  async getById(_actor: ActorContext, id: string): Promise<SkillCategory> {
    const target = await repo.findSkillCategoryById(pool, id);
    if (!target) throw new NotFoundError("SkillCategory");
    return target;
  },

  async create(actor: ActorContext, body: CreateSkillCategoryBody): Promise<SkillCategory> {
    ensurePlatformAdmin(actor);
    if (!(await repo.familyExists(pool, body.familyId))) {
      throw new NotFoundError("SkillFamily");
    }
    const dup = await repo.findSkillCategoryByCode(pool, body.code);
    if (dup) {
      throw new ConflictError(
        `Skill category code '${body.code}' already exists`,
        "SKILL_CATEGORY_CODE_CONFLICT",
      );
    }
    return repo.insertSkillCategory(pool, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateSkillCategoryBody): Promise<SkillCategory> {
    ensurePlatformAdmin(actor);
    const target = await repo.findSkillCategoryById(pool, id);
    if (!target) throw new NotFoundError("SkillCategory");
    if (patch.familyId !== undefined && !(await repo.familyExists(pool, patch.familyId))) {
      throw new NotFoundError("SkillFamily");
    }
    const updated = await repo.updateSkillCategoryPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("SkillCategory");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    ensurePlatformAdmin(actor);
    const target = await repo.findSkillCategoryById(pool, id);
    if (!target) throw new NotFoundError("SkillCategory");
    const n = await repo.countSkillsInCategory(pool, id);
    if (n > 0) {
      throw new ConflictError(
        `Cannot delete skill category: ${n} skills still attached`,
        "SKILL_CATEGORY_IN_USE",
      );
    }
    const ok = await repo.deleteSkillCategory(pool, id);
    if (!ok) throw new NotFoundError("SkillCategory");
  },
};
