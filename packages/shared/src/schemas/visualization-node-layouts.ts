/**
 * packages/shared/src/schemas/visualization-node-layouts.ts
 */
import { z } from "zod";

export const VizNodeLayoutSchema = z.object({
  nodeLayoutId: z.string().uuid(),
  layoutId: z.string().uuid(),
  nodeId: z.string().uuid(),
  x: z.number(),
  y: z.number(),
  z: z.number().nullable(),
  locked: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VizNodeLayout = z.infer<typeof VizNodeLayoutSchema>;

export const VizNodeLayoutListQuerySchema = z.object({
  layoutId: z.string().uuid().optional(),
  nodeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type VizNodeLayoutListQuery = z.infer<typeof VizNodeLayoutListQuerySchema>;

export const VizNodeLayoutListResponseSchema = z.object({
  items: z.array(VizNodeLayoutSchema), total: z.number().int().min(0),
});

export const UpsertVizNodeLayoutBodySchema = z.object({
  layoutId: z.string().uuid(),
  nodeId: z.string().uuid(),
  x: z.number().min(-100000).max(100000),
  y: z.number().min(-100000).max(100000),
  z: z.number().min(-100000).max(100000).nullable().optional(),
  locked: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertVizNodeLayoutBody = z.infer<typeof UpsertVizNodeLayoutBodySchema>;

export const VizNodeLayoutIdParamSchema = z.object({ id: z.string().uuid() });
