/**
 * packages/shared/src/schemas/visualization-node-layouts.ts
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const VizNodeLayoutSchema = z.object({
  nodeLayoutId: z.uuid(),
  layoutId: z.uuid(),
  nodeId: z.uuid(),
  x: z.number(),
  y: z.number(),
  z: z.number().nullable(),
  locked: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type VizNodeLayout = z.infer<typeof VizNodeLayoutSchema>;

export const VizNodeLayoutListQuerySchema = z.object({
  layoutId: z.uuid().optional(),
  nodeId: z.uuid().optional(),
  ...paginationFields(1000, 200),
});
export type VizNodeLayoutListQuery = z.infer<typeof VizNodeLayoutListQuerySchema>;

export const VizNodeLayoutListResponseSchema = z.object({
  items: z.array(VizNodeLayoutSchema), total: z.number().int().min(0),
});

export const UpsertVizNodeLayoutBodySchema = z.object({
  layoutId: z.uuid(),
  nodeId: z.uuid(),
  x: z.number().min(-100000).max(100000),
  y: z.number().min(-100000).max(100000),
  z: z.number().min(-100000).max(100000).nullable().optional(),
  locked: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertVizNodeLayoutBody = z.infer<typeof UpsertVizNodeLayoutBodySchema>;

export const VizNodeLayoutIdParamSchema = z.object({ id: z.uuid() });
