/**
 * apps/api/src/modules/skill-aliases/service.ts
 * Scope inherited from the parent skill:
 *   - read: any authenticated, but filtered by parent visibility
 *           (global OR own tenant).
 *   - write: PLATFORM_ADMIN for any skill; tenant actors only for skills
 *            within their own tenant. Global skill aliases are
 *            PLATFORM_ADMIN-only.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  SkillAlias,
  SkillAliasListQuery,
  CreateSkillAliasBody,
  UpdateSkillAliasBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

function tenantFilterFor(actor: ActorContext): string | undefined {
  return isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
}

async function authorizeWriteOnSkill(actor: ActorContext, skillId: string): Promise<void> {
  const scope = await repo.getSkillScope(pool, skillId);
  if (!scope) throw new NotFoundError("Skill");
  if (isPlatform(actor)) return;
  if (scope.isGlobal) {
    throw new ForbiddenError(
      "Only PLATFORM_ADMIN may modify aliases for global skills",
      "GLOBAL_SKILL_ALIAS_ADMIN_ONLY",
    );
  }
  if (!actor.tenantId || scope.tenantId !== actor.tenantId) {
    throw new NotFoundError("Skill"); // anti-enumeration
  }
}

export const skillAliasesService = {
  async list(actor: ActorContext, query: SkillAliasListQuery) {
    return repo.listAliases(pool, { tenantId: tenantFilterFor(actor), query });
  },

  async getById(actor: ActorContext, id: string): Promise<SkillAlias> {
    const target = await repo.findAliasById(pool, id, tenantFilterFor(actor));
    if (!target) throw new NotFoundError("SkillAlias");
    return target;
  },

  async create(actor: ActorContext, body: CreateSkillAliasBody): Promise<SkillAlias> {
    await authorizeWriteOnSkill(actor, body.skillId);
    const dup = await repo.findAliasByLabel(pool, body.skillId, body.label, body.locale ?? null);
    if (dup) {
      throw new ConflictError(
        `Alias '${body.label}'${body.locale ? ` (${body.locale})` : ""} already exists for this skill`,
        "SKILL_ALIAS_CONFLICT",
      );
    }
    return repo.insertAlias(pool, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateSkillAliasBody): Promise<SkillAlias> {
    // Re-fetch ignoring visibility, then authorize via parent-skill scope.
    const target = await repo.findAliasById(pool, id, undefined);
    if (!target) throw new NotFoundError("SkillAlias");
    await authorizeWriteOnSkill(actor, target.skillId);
    // If label or locale changed, ensure no duplicate.
    if (patch.label !== undefined || patch.locale !== undefined) {
      const nextLabel = patch.label ?? target.label;
      const nextLocale =
        patch.locale === undefined ? target.locale : (patch.locale ?? null);
      const dup = await repo.findAliasByLabel(pool, target.skillId, nextLabel, nextLocale);
      if (dup && dup.aliasId !== id) {
        throw new ConflictError(
          `Alias '${nextLabel}'${nextLocale ? ` (${nextLocale})` : ""} already exists for this skill`,
          "SKILL_ALIAS_CONFLICT",
        );
      }
    }
    const updated = await repo.updateAliasPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("SkillAlias");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findAliasById(pool, id, undefined);
    if (!target) throw new NotFoundError("SkillAlias");
    await authorizeWriteOnSkill(actor, target.skillId);
    const ok = await repo.deleteAlias(pool, id);
    if (!ok) throw new NotFoundError("SkillAlias");
  },
};
