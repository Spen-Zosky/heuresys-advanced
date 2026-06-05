/**
 * packages/shared/src/schemas/position-career-paths.ts
 * Many-to-many link: which career paths apply to which positions.
 * Unique (position_id, career_path_id).
 */

import { z } from "zod";

export const PositionCareerPathSchema = z.object({
  positionCareerPathId: z.uuid(),
  positionId: z.uuid(),
  tenantId: z.uuid(),
  careerPathId: z.uuid(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PositionCareerPath = z.infer<typeof PositionCareerPathSchema>;

export const PositionCareerPathListQuerySchema = z.object({
  positionId: z.uuid().optional(),
  careerPathId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type PositionCareerPathListQuery = z.infer<typeof PositionCareerPathListQuerySchema>;

export const PositionCareerPathListResponseSchema = z.object({
  items: z.array(PositionCareerPathSchema),
  total: z.number().int().min(0),
});

export const CreatePositionCareerPathBodySchema = z.object({
  positionId: z.uuid(),
  careerPathId: z.uuid(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreatePositionCareerPathBody = z.infer<typeof CreatePositionCareerPathBodySchema>;

export const PositionCareerPathIdParamSchema = z.object({ id: z.uuid() });
