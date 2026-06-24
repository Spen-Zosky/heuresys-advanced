/**
 * packages/shared/src/schemas/learning-gaps.ts
 * Tenant-scoped gap records — what a user lacks vs. position requirements.
 * Severity: LOW / MEDIUM / HIGH / CRITICAL.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const LEARNING_GAP_SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const LearningGapSeveritySchema = z.enum(LEARNING_GAP_SEVERITY_VALUES);
export type LearningGapSeverity = z.infer<typeof LearningGapSeveritySchema>;

export const LearningGapSchema = z.object({
  learningGapId: z.uuid(),
  tenantId: z.uuid(),
  userId: z.uuid(),
  userName: z.string().nullable(), // G-02: human names resolved on the list endpoint
  positionId: z.uuid().nullable(),
  positionTitle: z.string().nullable(),
  skillId: z.uuid().nullable(),
  skillName: z.string().nullable(),
  requiredProficiency: z.string().nullable(),
  currentProficiency: z.string().nullable(),
  score: z.number().nullable(),
  severity: LearningGapSeveritySchema,
  detectedAt: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LearningGap = z.infer<typeof LearningGapSchema>;

export const LearningGapListQuerySchema = z.object({
  userId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  skillId: z.uuid().optional(),
  severity: LearningGapSeveritySchema.optional(),
  ...paginationFields(200, 50),
});
export type LearningGapListQuery = z.infer<typeof LearningGapListQuerySchema>;

export const LearningGapListResponseSchema = z.object({
  items: z.array(LearningGapSchema),
  total: z.number().int().min(0),
});

export const CreateLearningGapBodySchema = z.object({
  userId: z.uuid(),
  positionId: z.uuid().nullable().optional(),
  skillId: z.uuid().nullable().optional(),
  requiredProficiency: z.string().max(32).nullable().optional(),
  currentProficiency: z.string().max(32).nullable().optional(),
  score: z.number().min(-100).max(100).nullable().optional(),
  severity: LearningGapSeveritySchema.optional().default("MEDIUM"),
  /** PLATFORM_ADMIN may override; non-platform actors pinned to own tenant. */
  tenantId: z.uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateLearningGapBody = z.infer<typeof CreateLearningGapBodySchema>;

export const UpdateLearningGapBodySchema = z.object({
  requiredProficiency: z.string().max(32).nullable().optional(),
  currentProficiency: z.string().max(32).nullable().optional(),
  score: z.number().min(-100).max(100).nullable().optional(),
  severity: LearningGapSeveritySchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateLearningGapBody = z.infer<typeof UpdateLearningGapBodySchema>;

export const LearningGapIdParamSchema = z.object({ id: z.uuid() });
