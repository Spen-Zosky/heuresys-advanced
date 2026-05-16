/**
 * apps/api/src/modules/skill-families/service.ts
 * Platform-level taxonomy anchor (cross-tenant). Read open to authenticated;
 * mutations PLATFORM_ADMIN-only. Pattern mirrors jobFamiliesService.
 *
 * Note: DELETE cascades to sys_skill_categories (ON DELETE CASCADE in
 * 000013). That is intentional but we surface a clear error path with a
 * pre-check rather than relying on the cascade alone, since it would also
 * orphan sys_skills.skill_category_id (ON DELETE SET NULL). To stay
 * conservative, we refuse deletion when categories are attached.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  SkillFamily,
  SkillFamilyListQuery,
  CreateSkillFamilyBody,
  UpdateSkillFamilyBody,
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
      "Only PLATFORM_ADMIN may manage skill families",
      "SKILL_FAMILY_ADMIN_ONLY",
    );
  }
}

export const skillFamiliesService = {
  async list(_actor: ActorContext, query: SkillFamilyListQuery) {
    return repo.listSkillFamilies(pool, query);
  },

  async getById(_actor: ActorContext, id: string): Promise<SkillFamily> {
    const target = await repo.findSkillFamilyById(pool, id);
    if (!target) throw new NotFoundError("SkillFamily");
    return target;
  },

  async create(actor: ActorContext, body: CreateSkillFamilyBody): Promise<SkillFamily> {
    ensurePlatformAdmin(actor);
    const dup = await repo.findSkillFamilyByCode(pool, body.code);
    if (dup) {
      throw new ConflictError(
        `Skill family code '${body.code}' already exists`,
        "SKILL_FAMILY_CODE_CONFLICT",
      );
    }
    return repo.insertSkillFamily(pool, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateSkillFamilyBody): Promise<SkillFamily> {
    ensurePlatformAdmin(actor);
    const target = await repo.findSkillFamilyById(pool, id);
    if (!target) throw new NotFoundError("SkillFamily");
    const updated = await repo.updateSkillFamilyPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("SkillFamily");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    ensurePlatformAdmin(actor);
    const target = await repo.findSkillFamilyById(pool, id);
    if (!target) throw new NotFoundError("SkillFamily");
    // Pre-check attached categories: refuse to cascade silently.
    const childCheck = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_skill_categories
        WHERE skill_category_family_id = $1`,
      [id],
    );
    if (Number(childCheck.rows[0]?.n ?? 0) > 0) {
      throw new ConflictError(
        "Cannot delete skill family with attached categories",
        "SKILL_FAMILY_IN_USE",
      );
    }
    const ok = await repo.deleteSkillFamily(pool, id);
    if (!ok) throw new NotFoundError("SkillFamily");
  },
};
