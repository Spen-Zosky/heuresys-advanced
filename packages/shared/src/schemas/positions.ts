/**
 * packages/shared/src/schemas/positions.ts
 * Zod schemas for /v1/positions/* including PIP read (ADR-0008) and the
 * skill / kpi sub-resources.
 *
 * Per API_IMPLEMENTATION_PLAN §6.3 + TARGET_SCHEMA_DESIGN.
 */

import { z } from "zod";

export const POSITION_CRITICALITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export const PositionCriticalitySchema = z.enum(POSITION_CRITICALITY_VALUES);

export const SKILL_PROFICIENCY_VALUES = [
  "NOVICE",
  "BASIC",
  "COMPETENT",
  "PROFICIENT",
  "EXPERT",
  "MASTER",
] as const;
export const SkillProficiencySchema = z.enum(SKILL_PROFICIENCY_VALUES);

export const REQUIREMENT_CRITICALITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export const RequirementCriticalitySchema = z.enum(REQUIREMENT_CRITICALITY_VALUES);

/* --- read shape -------------------------------------------------------- */

export const PositionSchema = z.object({
  positionId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  title: z.string(),
  organizationUnitId: z.uuid().nullable(),
  jobRoleId: z.uuid().nullable(),
  reportsToPositionId: z.uuid().nullable(),
  ownerUserId: z.uuid().nullable(),
  escoOccupationUri: z.string().nullable(),
  criticality: PositionCriticalitySchema.nullable(),
  economicWeight: z.number().min(0).max(1).nullable(),
  isActive: z.boolean(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  aiHints: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Position = z.infer<typeof PositionSchema>;

/* --- list query/response ----------------------------------------------- */

export const PositionListQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  criticality: PositionCriticalitySchema.optional(),
  organizationUnitId: z.uuid().optional(),
  jobRoleId: z.uuid().optional(),
  ownerUserId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type PositionListQuery = z.infer<typeof PositionListQuerySchema>;

export const PositionListResponseSchema = z.object({
  items: z.array(PositionSchema),
  total: z.number().int().min(0),
});
export type PositionListResponse = z.infer<typeof PositionListResponseSchema>;

/* --- create / update --------------------------------------------------- */

export const CreatePositionBodySchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  tenantId: z.uuid().optional(),
  organizationUnitId: z.uuid().nullable().optional(),
  jobRoleId: z.uuid().nullable().optional(),
  reportsToPositionId: z.uuid().nullable().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  escoOccupationUri: z.string().max(1024).nullable().optional(),
  criticality: PositionCriticalitySchema.nullable().optional(),
  economicWeight: z.number().min(0).max(1).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  aiHints: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreatePositionBody = z.infer<typeof CreatePositionBodySchema>;

export const UpdatePositionBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  organizationUnitId: z.uuid().nullable().optional(),
  jobRoleId: z.uuid().nullable().optional(),
  reportsToPositionId: z.uuid().nullable().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  escoOccupationUri: z.string().max(1024).nullable().optional(),
  criticality: PositionCriticalitySchema.nullable().optional(),
  economicWeight: z.number().min(0).max(1).nullable().optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  aiHints: z.record(z.string(), z.unknown()).optional(),
});
export type UpdatePositionBody = z.infer<typeof UpdatePositionBodySchema>;

/* --- :id param + position id -------------------------------------------- */

export const PositionIdParamSchema = z.object({
  id: z.uuid(),
});
export type PositionIdParam = z.infer<typeof PositionIdParamSchema>;

/* --- intelligence profile (PIP view) ------------------------------------ */

export const PositionIntelligenceProfileSchema = z.object({
  positionId: z.uuid(),
  tenantId: z.uuid(),
  code: z.string(),
  title: z.string(),
  organizationUnitId: z.uuid().nullable(),
  jobRoleId: z.uuid().nullable(),
  ownerUserId: z.uuid().nullable(),
  reportsToPositionId: z.uuid().nullable(),
  escoOccupationUri: z.string().nullable(),
  criticality: PositionCriticalitySchema.nullable(),
  economicWeight: z.number().nullable(),
  isActive: z.boolean(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  requiredSkills: z.unknown(),
  requiredKpis: z.unknown(),
  requiredLearningPaths: z.unknown(),
  careerPaths: z.unknown(),
  compensationProfile: z.unknown(),
  successionRelevance: z.unknown(),
  aiHints: z.record(z.string(), z.unknown()),
  updatedAt: z.iso.datetime(),
});
export type PositionIntelligenceProfile = z.infer<typeof PositionIntelligenceProfileSchema>;

/* --- skill sub-resource ------------------------------------------------- */

export const PositionSkillRequirementSchema = z.object({
  requirementId: z.uuid(),
  positionId: z.uuid(),
  tenantId: z.uuid(),
  skillId: z.uuid(),
  requiredProficiency: SkillProficiencySchema,
  weight: z.number(),
  criticality: RequirementCriticalitySchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PositionSkillRequirement = z.infer<typeof PositionSkillRequirementSchema>;

export const PositionSkillListResponseSchema = z.object({
  items: z.array(PositionSkillRequirementSchema),
});
export type PositionSkillListResponse = z.infer<typeof PositionSkillListResponseSchema>;

export const AddPositionSkillBodySchema = z.object({
  skillId: z.uuid(),
  requiredProficiency: SkillProficiencySchema,
  weight: z.number().min(0).max(10).optional().default(1),
  criticality: RequirementCriticalitySchema.optional().default("MEDIUM"),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type AddPositionSkillBody = z.infer<typeof AddPositionSkillBodySchema>;

export const PositionSkillIdParamSchema = z.object({
  id: z.uuid(),
  skillId: z.uuid(),
});

/* --- kpi sub-resource (read-only MVP-1) -------------------------------- */

export const PositionKpiRequirementSchema = z.object({
  requirementId: z.uuid(),
  positionId: z.uuid(),
  tenantId: z.uuid(),
  kpiDefinitionId: z.uuid(),
  targetTemplate: z.record(z.string(), z.unknown()),
  weight: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PositionKpiRequirement = z.infer<typeof PositionKpiRequirementSchema>;

export const PositionKpiListResponseSchema = z.object({
  items: z.array(PositionKpiRequirementSchema),
});
export type PositionKpiListResponse = z.infer<typeof PositionKpiListResponseSchema>;
