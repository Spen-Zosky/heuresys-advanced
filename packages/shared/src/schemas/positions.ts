/**
 * packages/shared/src/schemas/positions.ts
 * Zod schemas for /v1/positions/* including PIP read (ADR-0008) and the
 * skill / kpi sub-resources.
 *
 * Per API_IMPLEMENTATION_PLAN §6.3 + TARGET_SCHEMA_DESIGN.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
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
  ...paginationFields(200, 50),
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
  // human-readable skill identity, resolved via a LEFT JOIN on the list endpoint
  // (B-06 fix); null on create/update responses, which don't join.
  skillCode: z.string().nullable(),
  skillName: z.string().nullable(),
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
  // human-readable KPI identity, resolved via a LEFT JOIN on the list endpoint
  // (B-06 fix); null on create/update responses, which don't join.
  kpiCode: z.string().nullable(),
  kpiName: z.string().nullable(),
  targetTemplate: z.record(z.string(), z.unknown()),
  weight: z.number(),
  rank: z.number().int().min(1).nullable(), // WI-D2: 1 = highest priority; null = unranked
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PositionKpiRequirement = z.infer<typeof PositionKpiRequirementSchema>;

export const PositionKpiListResponseSchema = z.object({
  items: z.array(PositionKpiRequirementSchema),
});
export type PositionKpiListResponse = z.infer<typeof PositionKpiListResponseSchema>;

/* --- kpi sub-resource writes (WI-D2) ----------------------------------- */

export const AddPositionKpiBodySchema = z.object({
  kpiDefinitionId: z.uuid(),
  targetTemplate: z.record(z.string(), z.unknown()).optional().default({}),
  weight: z.number().min(0).max(9.999).optional().default(1), // numeric(4,3)
  rank: z.number().int().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type AddPositionKpiBody = z.infer<typeof AddPositionKpiBodySchema>;

export const UpdatePositionKpiBodySchema = z.object({
  targetTemplate: z.record(z.string(), z.unknown()).optional(),
  weight: z.number().min(0).max(9.999).optional(),
  rank: z.number().int().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdatePositionKpiBody = z.infer<typeof UpdatePositionKpiBodySchema>;

export const PositionKpiIdParamSchema = z.object({
  id: z.uuid(),
  kpiId: z.uuid(), // = kpi_definition_id (natural sub-resource key, UNIQUE per position)
});

/* --- learning sub-resources (#25 A/L5, S1016) --------------------------- */
/* Read-only bridge position -> learning: mandatory paths declared on the
 * position (sys_position_learning_requirements) and the module coverage of
 * the position's required skills (sys_position_skill_requirements JOIN
 * sys_skill_learning_mappings). Names resolved via LEFT JOIN on the list
 * endpoints (same convention as skill/kpi sub-resources, B-06). */

export const PositionLearningRequirementSchema = z.object({
  requirementId: z.uuid(),
  positionId: z.uuid(),
  tenantId: z.uuid(),
  learningPathId: z.uuid(),
  learningPathCode: z.string().nullable(),
  learningPathName: z.string().nullable(),
  isMandatory: z.boolean(),
  deadlineRule: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PositionLearningRequirement = z.infer<typeof PositionLearningRequirementSchema>;

export const PositionLearningRequirementListResponseSchema = z.object({
  items: z.array(PositionLearningRequirementSchema),
});
export type PositionLearningRequirementListResponse = z.infer<
  typeof PositionLearningRequirementListResponseSchema
>;

export const PositionLearningModuleSchema = z.object({
  skillId: z.uuid(),
  skillCode: z.string().nullable(),
  skillName: z.string().nullable(),
  requiredProficiency: SkillProficiencySchema,
  learningModuleId: z.uuid(),
  learningModuleCode: z.string().nullable(),
  learningModuleTitle: z.string().nullable(),
  learningModuleKind: z.string().nullable(),
  learningModuleDelivery: z.string().nullable(),
  learningModuleDurationMinutes: z.number().int().nullable(),
  targetProficiency: SkillProficiencySchema,
});
export type PositionLearningModule = z.infer<typeof PositionLearningModuleSchema>;

export const PositionLearningModuleListResponseSchema = z.object({
  items: z.array(PositionLearningModuleSchema),
});
export type PositionLearningModuleListResponse = z.infer<
  typeof PositionLearningModuleListResponseSchema
>;
