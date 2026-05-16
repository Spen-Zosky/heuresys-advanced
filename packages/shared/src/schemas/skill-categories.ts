/**
 * packages/shared/src/schemas/skill-categories.ts
 * Schemas for /v1/skill-categories/* (sys.sys_skill_categories).
 * FK to sys.sys_skill_families. Platform-level catalog.
 */

import { z } from "zod";

export const SkillCategorySchema = z.object({
  skillCategoryId: z.string().uuid(),
  familyId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const SkillCategoryListQuerySchema = z.object({
  familyId: z.string().uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SkillCategoryListQuery = z.infer<typeof SkillCategoryListQuerySchema>;

export const SkillCategoryListResponseSchema = z.object({
  items: z.array(SkillCategorySchema),
  total: z.number().int().min(0),
});

export const CreateSkillCategoryBodySchema = z.object({
  familyId: z.string().uuid(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(2048).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSkillCategoryBody = z.infer<typeof CreateSkillCategoryBodySchema>;

export const UpdateSkillCategoryBodySchema = z.object({
  familyId: z.string().uuid().optional(),
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2048).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSkillCategoryBody = z.infer<typeof UpdateSkillCategoryBodySchema>;

export const SkillCategoryIdParamSchema = z.object({ id: z.string().uuid() });
