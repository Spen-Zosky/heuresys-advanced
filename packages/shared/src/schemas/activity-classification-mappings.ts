/**
 * packages/shared/src/schemas/activity-classification-mappings.ts
 */
import { z } from "zod";

export const ACTIVITY_MAPPING_KIND_VALUES = [
  "EXACT", "NARROWER", "BROADER", "RELATED", "APPROXIMATE",
] as const;
export const ActivityMappingKindSchema = z.enum(ACTIVITY_MAPPING_KIND_VALUES);
export type ActivityMappingKind = z.infer<typeof ActivityMappingKindSchema>;

export const ActivityClassificationMappingSchema = z.object({
  activityClassMappingId: z.string().uuid(),
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  kind: ActivityMappingKindSchema,
  confidence: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ActivityClassificationMapping = z.infer<typeof ActivityClassificationMappingSchema>;

export const ActivityMappingListQuerySchema = z.object({
  sourceId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),
  kind: ActivityMappingKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type ActivityMappingListQuery = z.infer<typeof ActivityMappingListQuerySchema>;

export const ActivityMappingListResponseSchema = z.object({
  items: z.array(ActivityClassificationMappingSchema), total: z.number().int().min(0),
});

export const CreateActivityMappingBodySchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  kind: ActivityMappingKindSchema.optional().default("EXACT"),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateActivityMappingBody = z.infer<typeof CreateActivityMappingBodySchema>;

export const ActivityMappingIdParamSchema = z.object({ id: z.string().uuid() });
