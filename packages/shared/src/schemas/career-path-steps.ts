/**
 * packages/shared/src/schemas/career-path-steps.ts
 * Position transitions within a career path. Unique (path_id, ordinal).
 * Either origin or target position may be null (lateral entry / open end).
 */

import { z } from "zod";

export const CareerPathStepSchema = z.object({
  careerPathStepId: z.string().uuid(),
  pathId: z.string().uuid(),
  ordinal: z.number().int().min(0).max(32767),
  originPositionId: z.string().uuid().nullable(),
  targetPositionId: z.string().uuid().nullable(),
  requiredProficiencyUplift: z.record(z.string(), z.unknown()),
  typicalDurationMonths: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CareerPathStep = z.infer<typeof CareerPathStepSchema>;

export const CareerPathStepListQuerySchema = z.object({
  pathId: z.string().uuid().optional(),
  originPositionId: z.string().uuid().optional(),
  targetPositionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type CareerPathStepListQuery = z.infer<typeof CareerPathStepListQuerySchema>;

export const CareerPathStepListResponseSchema = z.object({
  items: z.array(CareerPathStepSchema),
  total: z.number().int().min(0),
});

export const CreateCareerPathStepBodySchema = z.object({
  pathId: z.string().uuid(),
  ordinal: z.number().int().min(0).max(32767),
  originPositionId: z.string().uuid().nullable().optional(),
  targetPositionId: z.string().uuid().nullable().optional(),
  requiredProficiencyUplift: z.record(z.string(), z.unknown()).optional().default({}),
  typicalDurationMonths: z.number().int().min(0).max(1200).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateCareerPathStepBody = z.infer<typeof CreateCareerPathStepBodySchema>;

export const UpdateCareerPathStepBodySchema = z.object({
  ordinal: z.number().int().min(0).max(32767).optional(),
  originPositionId: z.string().uuid().nullable().optional(),
  targetPositionId: z.string().uuid().nullable().optional(),
  requiredProficiencyUplift: z.record(z.string(), z.unknown()).optional(),
  typicalDurationMonths: z.number().int().min(0).max(1200).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateCareerPathStepBody = z.infer<typeof UpdateCareerPathStepBodySchema>;

export const CareerPathStepIdParamSchema = z.object({ id: z.string().uuid() });
