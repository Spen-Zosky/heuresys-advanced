/**
 * packages/shared/src/schemas/learning-path-steps.ts
 * Ordered modules within a learning path.
 * Unique (path_id, ordinal). Module FK to sys.sys_learning_modules.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const LearningPathStepSchema = z.object({
  learningPathStepId: z.uuid(),
  pathId: z.uuid(),
  moduleId: z.uuid(),
  ordinal: z.number().int().min(0).max(32767),
  isPrerequisiteFor: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LearningPathStep = z.infer<typeof LearningPathStepSchema>;

export const LearningPathStepListQuerySchema = z.object({
  pathId: z.uuid().optional(),
  moduleId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type LearningPathStepListQuery = z.infer<typeof LearningPathStepListQuerySchema>;

export const LearningPathStepListResponseSchema = z.object({
  items: z.array(LearningPathStepSchema),
  total: z.number().int().min(0),
});

export const CreateLearningPathStepBodySchema = z.object({
  pathId: z.uuid(),
  moduleId: z.uuid(),
  ordinal: z.number().int().min(0).max(32767),
  isPrerequisiteFor: z.array(z.string()).optional().default([]),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateLearningPathStepBody = z.infer<typeof CreateLearningPathStepBodySchema>;

export const UpdateLearningPathStepBodySchema = z.object({
  moduleId: z.uuid().optional(),
  ordinal: z.number().int().min(0).max(32767).optional(),
  isPrerequisiteFor: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateLearningPathStepBody = z.infer<typeof UpdateLearningPathStepBodySchema>;

export const LearningPathStepIdParamSchema = z.object({ id: z.uuid() });
