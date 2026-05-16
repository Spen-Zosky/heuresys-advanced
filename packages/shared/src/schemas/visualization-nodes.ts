/**
 * packages/shared/src/schemas/visualization-nodes.ts
 */
import { z } from "zod";

export const VIZ_NODE_SOURCE_ENTITY_TYPE_VALUES = [
  "POSITION", "USER", "SKILL", "KPI", "PROCESS", "UNIT",
  "LEARNING_MODULE", "CAREER_PATH", "BLUEPRINT_VARIANT",
  "SUCCESSION_POOL", "GENERIC",
] as const;
export const VizNodeSourceEntityTypeSchema = z.enum(VIZ_NODE_SOURCE_ENTITY_TYPE_VALUES);
export type VizNodeSourceEntityType = z.infer<typeof VizNodeSourceEntityTypeSchema>;

export const VizNodeSchema = z.object({
  nodeId: z.string().uuid(),
  graphId: z.string().uuid(),
  sourceEntityType: VizNodeSourceEntityTypeSchema,
  sourceEntityId: z.string().uuid().nullable(),
  label: z.string(),
  type: z.string().nullable(),
  groupKey: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VizNode = z.infer<typeof VizNodeSchema>;

export const VizNodeListQuerySchema = z.object({
  graphId: z.string().uuid().optional(),
  sourceEntityType: VizNodeSourceEntityTypeSchema.optional(),
  groupKey: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type VizNodeListQuery = z.infer<typeof VizNodeListQuerySchema>;

export const VizNodeListResponseSchema = z.object({
  items: z.array(VizNodeSchema), total: z.number().int().min(0),
});

export const CreateVizNodeBodySchema = z.object({
  graphId: z.string().uuid(),
  sourceEntityType: VizNodeSourceEntityTypeSchema,
  sourceEntityId: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(255),
  type: z.string().max(64).nullable().optional(),
  groupKey: z.string().max(128).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateVizNodeBody = z.infer<typeof CreateVizNodeBodySchema>;

export const UpdateVizNodeBodySchema = z.object({
  label: z.string().min(1).max(255).optional(),
  type: z.string().max(64).nullable().optional(),
  groupKey: z.string().max(128).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateVizNodeBody = z.infer<typeof UpdateVizNodeBodySchema>;

export const VizNodeIdParamSchema = z.object({ id: z.string().uuid() });
