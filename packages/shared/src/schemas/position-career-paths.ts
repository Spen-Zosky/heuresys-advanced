/**
 * packages/shared/src/schemas/position-career-paths.ts
 * Many-to-many link: which career paths apply to which positions.
 * Unique (position_id, career_path_id).
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
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
  ...paginationFields(200, 50),
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
