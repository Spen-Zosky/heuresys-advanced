/**
 * packages/shared/src/schemas/visualization-nodes.ts
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const VIZ_NODE_SOURCE_ENTITY_TYPE_VALUES = [
  "POSITION", "USER", "SKILL", "KPI", "PROCESS", "UNIT",
  "LEARNING_MODULE", "CAREER_PATH", "BLUEPRINT_VARIANT",
  "SUCCESSION_POOL", "GENERIC",
] as const;
export const VizNodeSourceEntityTypeSchema = z.enum(VIZ_NODE_SOURCE_ENTITY_TYPE_VALUES);
export type VizNodeSourceEntityType = z.infer<typeof VizNodeSourceEntityTypeSchema>;

export const VizNodeSchema = z.object({
  nodeId: z.uuid(),
  graphId: z.uuid(),
  sourceEntityType: VizNodeSourceEntityTypeSchema,
  sourceEntityId: z.uuid().nullable(),
  label: z.string(),
  type: z.string().nullable(),
  groupKey: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type VizNode = z.infer<typeof VizNodeSchema>;

export const VizNodeListQuerySchema = z.object({
  graphId: z.uuid().optional(),
  sourceEntityType: VizNodeSourceEntityTypeSchema.optional(),
  groupKey: z.string().min(1).max(128).optional(),
  ...paginationFields(500, 100),
});
export type VizNodeListQuery = z.infer<typeof VizNodeListQuerySchema>;

export const VizNodeListResponseSchema = z.object({
  items: z.array(VizNodeSchema), total: z.number().int().min(0),
});

export const CreateVizNodeBodySchema = z.object({
  graphId: z.uuid(),
  sourceEntityType: VizNodeSourceEntityTypeSchema,
  sourceEntityId: z.uuid().nullable().optional(),
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

export const VizNodeIdParamSchema = z.object({ id: z.uuid() });
