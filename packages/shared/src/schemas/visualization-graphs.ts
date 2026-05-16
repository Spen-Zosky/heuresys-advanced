/**
 * packages/shared/src/schemas/visualization-graphs.ts
 */
import { z } from "zod";

export const VIZ_GRAPH_TYPE_VALUES = [
  "ORG_CHART", "PROCESS_FLOW", "CAREER_PATH", "LEARNING_PATH",
  "SKILL_GAP_MAP", "SUCCESSION_MAP", "KPI_CASCADE",
  "POSITION_INTELLIGENCE_MAP", "ENTERPRISE_BLUEPRINT_MAP",
] as const;
export const VizGraphTypeSchema = z.enum(VIZ_GRAPH_TYPE_VALUES);
export type VizGraphType = z.infer<typeof VizGraphTypeSchema>;

export const VizGraphSchema = z.object({
  graphId: z.string().uuid(),
  tenantId: z.string().uuid(),
  code: z.string(),
  type: VizGraphTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
  sourceQuery: z.string().nullable(),
  version: z.number().int(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VizGraph = z.infer<typeof VizGraphSchema>;

export const VizGraphListQuerySchema = z.object({
  type: VizGraphTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type VizGraphListQuery = z.infer<typeof VizGraphListQuerySchema>;

export const VizGraphListResponseSchema = z.object({
  items: z.array(VizGraphSchema), total: z.number().int().min(0),
});

export const CreateVizGraphBodySchema = z.object({
  code: z.string().min(1).max(128),
  type: VizGraphTypeSchema,
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  sourceQuery: z.string().max(16384).nullable().optional(),
  isActive: z.boolean().optional().default(true),
  tenantId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateVizGraphBody = z.infer<typeof CreateVizGraphBodySchema>;

export const UpdateVizGraphBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  sourceQuery: z.string().max(16384).nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateVizGraphBody = z.infer<typeof UpdateVizGraphBodySchema>;

export const VizGraphIdParamSchema = z.object({ id: z.string().uuid() });
