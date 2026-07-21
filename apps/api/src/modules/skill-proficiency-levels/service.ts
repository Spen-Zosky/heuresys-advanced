/**
 * apps/api/src/modules/skill-proficiency-levels/service.ts
 * Read-only — catalog values are seeded by migration and cannot be mutated
 * through the API. Any authenticated actor can list.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { localize } from "../../lib/i18n/localize.js";
import type { Locale } from "../../middleware/locale.js";
import type { SkillProficiencyLevel } from "@heuresys/shared";

export type { ActorContext };

// i18n overlay: swap name/description to the requested locale (fallback = IT in-row).
const PROFICIENCY_LEVEL_I18N = {
  name: (s: SkillProficiencyLevel, t: string) => { s.name = t; },
  description: (s: SkillProficiencyLevel, t: string) => { s.description = t; },
};
import * as repo from "./repository.js";

export const skillProficiencyLevelsService = {
  async list(_actor: ActorContext, locale: Locale = "it") {
    const res = await repo.listProficiencyLevels(pool);
    await localize(pool, locale, "sys_skill_proficiency_levels", res.items, (s) => s.proficiencyLevelId, PROFICIENCY_LEVEL_I18N);
    return res;
  },
};
