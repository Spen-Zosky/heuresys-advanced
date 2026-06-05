/**
 * packages/shared/src/schemas/visualization-edges.ts
 */
import { z } from "zod";

export const VIZ_EDGE_TYPE_VALUES = [
  "REPORTS_TO", "REQUIRES_SKILL", "NEXT_STEP", "SUCCESSOR_OF",
  "PART_OF", "INFLUENCES", "ESCALATES_TO", "GENERIC",
] as const;
export const VizEdgeTypeSchema = z.enum(VIZ_EDGE_TYPE_VALUES);
export type VizEdgeType = z.infer<typeof VizEdgeTypeSchema>;

export const VizEdgeSchema = z.object({
  edgeId: z.uuid(),
  graphId: z.uuid(),
  sourceNodeId: z.uuid(),
  targetNodeId: z.uuid(),
  type: VizEdgeTypeSchema,
  weight: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type VizEdge = z.infer<typeof VizEdgeSchema>;

export const VizEdgeListQuerySchema = z.object({
  graphId: z.uuid().optional(),
  sourceNodeId: z.uuid().optional(),
  targetNodeId: z.uuid().optional(),
  type: VizEdgeTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type VizEdgeListQuery = z.infer<typeof VizEdgeListQuerySchema>;

export const VizEdgeListResponseSchema = z.object({
  items: z.array(VizEdgeSchema), total: z.number().int().min(0),
});

export const CreateVizEdgeBodySchema = z.object({
  graphId: z.uuid(),
  sourceNodeId: z.uuid(),
  targetNodeId: z.uuid(),
  type: VizEdgeTypeSchema,
  weight: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateVizEdgeBody = z.infer<typeof CreateVizEdgeBodySchema>;

export const VizEdgeIdParamSchema = z.object({ id: z.uuid() });
