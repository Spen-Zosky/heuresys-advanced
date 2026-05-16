/**
 * packages/shared/src/schemas/learning-paths.ts
 * Curated sequence of learning modules. Global+tenant visibility.
 */

import { z } from "zod";

export const LearningPathSchema = z.object({
  learningPathId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  targetOutcome: z.string().nullable(),
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LearningPath = z.infer<typeof LearningPathSchema>;

export const LearningPathListQuerySchema = z.object({
  isGlobal: z.coerce.boolean().optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type LearningPathListQuery = z.infer<typeof LearningPathListQuerySchema>;

export const LearningPathListResponseSchema = z.object({
  items: z.array(LearningPathSchema),
  total: z.number().int().min(0),
});

export const CreateLearningPathBodySchema = z.object({
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  targetOutcome: z.string().max(4096).nullable().optional(),
  isGlobal: z.boolean().optional().default(false),
  tenantId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateLearningPathBody = z.infer<typeof CreateLearningPathBodySchema>;

export const UpdateLearningPathBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  targetOutcome: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateLearningPathBody = z.infer<typeof UpdateLearningPathBodySchema>;

export const LearningPathIdParamSchema = z.object({ id: z.string().uuid() });
