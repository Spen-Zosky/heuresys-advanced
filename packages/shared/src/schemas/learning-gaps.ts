/**
 * packages/shared/src/schemas/learning-gaps.ts
 * Tenant-scoped gap records — what a user lacks vs. position requirements.
 * Severity: LOW / MEDIUM / HIGH / CRITICAL.
 */

import { z } from "zod";

export const LEARNING_GAP_SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const LearningGapSeveritySchema = z.enum(LEARNING_GAP_SEVERITY_VALUES);
export type LearningGapSeverity = z.infer<typeof LearningGapSeveritySchema>;

export const LearningGapSchema = z.object({
  learningGapId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  positionId: z.string().uuid().nullable(),
  skillId: z.string().uuid().nullable(),
  requiredProficiency: z.string().nullable(),
  currentProficiency: z.string().nullable(),
  score: z.number().nullable(),
  severity: LearningGapSeveritySchema,
  detectedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LearningGap = z.infer<typeof LearningGapSchema>;

export const LearningGapListQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  skillId: z.string().uuid().optional(),
  severity: LearningGapSeveritySchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type LearningGapListQuery = z.infer<typeof LearningGapListQuerySchema>;

export const LearningGapListResponseSchema = z.object({
  items: z.array(LearningGapSchema),
  total: z.number().int().min(0),
});

export const CreateLearningGapBodySchema = z.object({
  userId: z.string().uuid(),
  positionId: z.string().uuid().nullable().optional(),
  skillId: z.string().uuid().nullable().optional(),
  requiredProficiency: z.string().max(32).nullable().optional(),
  currentProficiency: z.string().max(32).nullable().optional(),
  score: z.number().min(-100).max(100).nullable().optional(),
  severity: LearningGapSeveritySchema.optional().default("MEDIUM"),
  /** PLATFORM_ADMIN may override; non-platform actors pinned to own tenant. */
  tenantId: z.string().uuid().optional(),
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

export const LearningGapIdParamSchema = z.object({ id: z.string().uuid() });
