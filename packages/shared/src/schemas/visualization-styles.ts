/**
 * packages/shared/src/schemas/visualization-styles.ts
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const VizStyleSchema = z.object({
  styleId: z.uuid(),
  graphId: z.uuid(),
  nodeType: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type VizStyle = z.infer<typeof VizStyleSchema>;

export const VizStyleListQuerySchema = z.object({
  graphId: z.uuid().optional(),
  nodeType: z.string().min(1).max(64).optional(),
  ...paginationFields(200, 50),
});
export type VizStyleListQuery = z.infer<typeof VizStyleListQuerySchema>;

export const VizStyleListResponseSchema = z.object({
  items: z.array(VizStyleSchema), total: z.number().int().min(0),
});

export const CreateVizStyleBodySchema = z.object({
  graphId: z.uuid(),
  nodeType: z.string().max(64).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
  icon: z.string().max(64).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateVizStyleBody = z.infer<typeof CreateVizStyleBodySchema>;

export const VizStyleIdParamSchema = z.object({ id: z.uuid() });
