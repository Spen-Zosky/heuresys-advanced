/**
 * packages/shared/src/schemas/activity-classification-mappings.ts
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const ACTIVITY_MAPPING_KIND_VALUES = [
  "EXACT", "NARROWER", "BROADER", "RELATED", "APPROXIMATE",
] as const;
export const ActivityMappingKindSchema = z.enum(ACTIVITY_MAPPING_KIND_VALUES);
export type ActivityMappingKind = z.infer<typeof ActivityMappingKindSchema>;

export const ActivityClassificationMappingSchema = z.object({
  activityClassMappingId: z.uuid(),
  sourceId: z.uuid(),
  targetId: z.uuid(),
  kind: ActivityMappingKindSchema,
  confidence: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ActivityClassificationMapping = z.infer<typeof ActivityClassificationMappingSchema>;

export const ActivityMappingListQuerySchema = z.object({
  sourceId: z.uuid().optional(),
  targetId: z.uuid().optional(),
  kind: ActivityMappingKindSchema.optional(),
  ...paginationFields(500, 100),
});
export type ActivityMappingListQuery = z.infer<typeof ActivityMappingListQuerySchema>;

export const ActivityMappingListResponseSchema = z.object({
  items: z.array(ActivityClassificationMappingSchema), total: z.number().int().min(0),
});

export const CreateActivityMappingBodySchema = z.object({
  sourceId: z.uuid(),
  targetId: z.uuid(),
  kind: ActivityMappingKindSchema.optional().default("EXACT"),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateActivityMappingBody = z.infer<typeof CreateActivityMappingBodySchema>;

export const ActivityMappingIdParamSchema = z.object({ id: z.uuid() });
