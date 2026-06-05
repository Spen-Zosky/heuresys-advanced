/**
 * packages/shared/src/schemas/skill-proficiency-levels.ts
 * Schemas for /v1/skill-proficiency-levels/* (sys.sys_skill_proficiency_levels).
 * Read-only catalog: 6 levels seeded in migration 000013
 * (NOVICE..MASTER), ranks 1..6.
 */

import { z } from "zod";

export const SkillProficiencyLevelCodeSchema = z.enum([
  "NOVICE",
  "BASIC",
  "COMPETENT",
  "PROFICIENT",
  "EXPERT",
  "MASTER",
]);
export type SkillProficiencyLevelCode = z.infer<typeof SkillProficiencyLevelCodeSchema>;

export const SkillProficiencyLevelSchema = z.object({
  proficiencyLevelId: z.uuid(),
  code: SkillProficiencyLevelCodeSchema,
  name: z.string(),
  rank: z.number().int().min(1).max(6),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SkillProficiencyLevel = z.infer<typeof SkillProficiencyLevelSchema>;

export const SkillProficiencyLevelListResponseSchema = z.object({
  items: z.array(SkillProficiencyLevelSchema),
  total: z.number().int().min(0),
});
