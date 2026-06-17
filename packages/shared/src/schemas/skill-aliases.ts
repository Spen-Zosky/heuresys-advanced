/**
 * packages/shared/src/schemas/skill-aliases.ts
 * Schemas for /v1/skill-aliases/* (sys.sys_skill_aliases).
 * Synonyms / multi-locale translations attached to a skill.
 * Scope is inherited from the parent skill (global → PLATFORM_ADMIN only;
 * tenant → tenant owner / PLATFORM_ADMIN).
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const SkillAliasSchema = z.object({
  aliasId: z.uuid(),
  skillId: z.uuid(),
  label: z.string(),
  locale: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type SkillAlias = z.infer<typeof SkillAliasSchema>;

export const SkillAliasListQuerySchema = z.object({
  skillId: z.uuid().optional(),
  locale: z.string().min(1).max(16).optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type SkillAliasListQuery = z.infer<typeof SkillAliasListQuerySchema>;

export const SkillAliasListResponseSchema = z.object({
  items: z.array(SkillAliasSchema),
  total: z.number().int().min(0),
});

export const CreateSkillAliasBodySchema = z.object({
  skillId: z.uuid(),
  label: z.string().min(1).max(255),
  locale: z.string().min(1).max(16).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSkillAliasBody = z.infer<typeof CreateSkillAliasBodySchema>;

export const UpdateSkillAliasBodySchema = z.object({
  label: z.string().min(1).max(255).optional(),
  locale: z.string().min(1).max(16).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSkillAliasBody = z.infer<typeof UpdateSkillAliasBodySchema>;

export const SkillAliasIdParamSchema = z.object({ id: z.uuid() });
