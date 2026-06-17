/**
 * packages/shared/src/schemas/skill-families.ts
 * Schemas for /v1/skill-families/* (sys.sys_skill_families).
 * Platform-level catalog (no tenant_id) — PLATFORM_ADMIN manages.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const SkillFamilySchema = z.object({
  skillFamilyId: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SkillFamily = z.infer<typeof SkillFamilySchema>;

export const SkillFamilyListQuerySchema = z.object({
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type SkillFamilyListQuery = z.infer<typeof SkillFamilyListQuerySchema>;

export const SkillFamilyListResponseSchema = z.object({
  items: z.array(SkillFamilySchema),
  total: z.number().int().min(0),
});

export const CreateSkillFamilyBodySchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(2048).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSkillFamilyBody = z.infer<typeof CreateSkillFamilyBodySchema>;

export const UpdateSkillFamilyBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2048).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSkillFamilyBody = z.infer<typeof UpdateSkillFamilyBodySchema>;

export const SkillFamilyIdParamSchema = z.object({ id: z.uuid() });
