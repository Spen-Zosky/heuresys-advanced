/**
 * packages/shared/src/schemas/skills.ts
 * Schemas for /v1/skills/* (sys.sys_skills).
 *
 * Skill records may be tenant-scoped (skill_tenant_id != NULL) or "global"
 * (skill_is_global = true, often skill_tenant_id NULL). The service
 * enforces visibility: a tenant-scoped skill is only visible to that tenant
 * (and PLATFORM_ADMIN); global skills are visible to all authenticated.
 */

import { z } from "zod";

export const SkillSchema = z.object({
  skillId: z.uuid(),
  tenantId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  escoUri: z.string().nullable(),
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillListQuerySchema = z.object({
  isGlobal: z.coerce.boolean().optional(),
  categoryId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SkillListQuery = z.infer<typeof SkillListQuerySchema>;

export const SkillListResponseSchema = z.object({
  items: z.array(SkillSchema),
  total: z.number().int().min(0),
});

export const CreateSkillBodySchema = z.object({
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(2048).nullable().optional(),
  /**
   * Force creation as a global (cross-tenant) skill. Only PLATFORM_ADMIN
   * may set this true; the service forces false for other actors.
   */
  isGlobal: z.boolean().optional().default(false),
  categoryId: z.uuid().nullable().optional(),
  escoUri: z.string().max(1024).nullable().optional(),
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSkillBody = z.infer<typeof CreateSkillBodySchema>;

export const UpdateSkillBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2048).nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  escoUri: z.string().max(1024).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSkillBody = z.infer<typeof UpdateSkillBodySchema>;

export const SkillIdParamSchema = z.object({ id: z.uuid() });
