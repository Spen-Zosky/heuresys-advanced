/**
 * packages/shared/src/schemas/skill-taxonomy-edges.ts
 * Schemas for /v1/skill-taxonomy-edges/* (sys.sys_skill_taxonomy_edges).
 * Edges are immutable: only create/delete are supported by the API.
 * Kind values match the DB CHECK constraint (000013).
 */

import { z } from "zod";

export const SkillEdgeKindSchema = z.enum(["IS_A", "PART_OF", "RELATED", "PREREQUISITE_OF"]);
export type SkillEdgeKind = z.infer<typeof SkillEdgeKindSchema>;

export const SkillTaxonomyEdgeSchema = z.object({
  edgeId: z.uuid(),
  parentSkillId: z.uuid(),
  childSkillId: z.uuid(),
  kind: SkillEdgeKindSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type SkillTaxonomyEdge = z.infer<typeof SkillTaxonomyEdgeSchema>;

export const SkillTaxonomyEdgeListQuerySchema = z.object({
  parentSkillId: z.uuid().optional(),
  childSkillId: z.uuid().optional(),
  kind: SkillEdgeKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type SkillTaxonomyEdgeListQuery = z.infer<typeof SkillTaxonomyEdgeListQuerySchema>;

export const SkillTaxonomyEdgeListResponseSchema = z.object({
  items: z.array(SkillTaxonomyEdgeSchema),
  total: z.number().int().min(0),
});

export const CreateSkillTaxonomyEdgeBodySchema = z.object({
  parentSkillId: z.uuid(),
  childSkillId: z.uuid(),
  kind: SkillEdgeKindSchema.optional().default("IS_A"),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateSkillTaxonomyEdgeBody = z.infer<typeof CreateSkillTaxonomyEdgeBodySchema>;

export const SkillTaxonomyEdgeIdParamSchema = z.object({ id: z.uuid() });
