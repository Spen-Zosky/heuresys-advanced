/**
 * packages/shared/src/schemas/visualization-layouts.ts
 */
import { z } from "zod";

export const VIZ_LAYOUT_ENGINE_VALUES = [
  "AUTO", "DAGRE", "ELK", "HIERARCHICAL", "TREE",
  "SWIMLANE", "TIMELINE", "FORCE_DIRECTED", "MANUAL",
] as const;
export const VizLayoutEngineSchema = z.enum(VIZ_LAYOUT_ENGINE_VALUES);
export type VizLayoutEngine = z.infer<typeof VizLayoutEngineSchema>;

export const VizLayoutSchema = z.object({
  layoutId: z.uuid(),
  graphId: z.uuid(),
  engine: VizLayoutEngineSchema,
  version: z.number().int(),
  isDefault: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type VizLayout = z.infer<typeof VizLayoutSchema>;

export const VizLayoutListQuerySchema = z.object({
  graphId: z.uuid().optional(),
  engine: VizLayoutEngineSchema.optional(),
  isDefault: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type VizLayoutListQuery = z.infer<typeof VizLayoutListQuerySchema>;

export const VizLayoutListResponseSchema = z.object({
  items: z.array(VizLayoutSchema), total: z.number().int().min(0),
});

export const CreateVizLayoutBodySchema = z.object({
  graphId: z.uuid(),
  engine: VizLayoutEngineSchema.optional().default("AUTO"),
  isDefault: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateVizLayoutBody = z.infer<typeof CreateVizLayoutBodySchema>;

export const UpdateVizLayoutBodySchema = z.object({
  engine: VizLayoutEngineSchema.optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateVizLayoutBody = z.infer<typeof UpdateVizLayoutBodySchema>;

export const VizLayoutIdParamSchema = z.object({ id: z.uuid() });
