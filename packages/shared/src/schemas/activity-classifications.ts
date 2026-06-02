/**
 * packages/shared/src/schemas/activity-classifications.ts
 * ATECO + NACE catalog (global, no tenant).
 */
import { z } from "zod";

// Must mirror the DB CHECK on sys.sys_activity_classifications.activity_classification_scheme
// (RD-08: varchar+CHECK is the structural authority). The brownfield Wave-1 ingestion populates
// the unversioned "ATECO"/"NACE" scheme codes (3276 rows); omitting them here caused the
// GET /v1/activity-classifications LIST to 500 on response serialization (caught by WS-5).
export const ACTIVITY_CLASS_SCHEME_VALUES = [
  "ATECO_2025", "NACE_REV_2_1", "ATECO_2007", "NACE_REV_2", "ATECO", "NACE",
] as const;
export const ActivityClassSchemeSchema = z.enum(ACTIVITY_CLASS_SCHEME_VALUES);
export type ActivityClassScheme = z.infer<typeof ActivityClassSchemeSchema>;

export const ActivityClassificationSchema = z.object({
  activityClassificationId: z.string().uuid(),
  scheme: ActivityClassSchemeSchema,
  code: z.string(),
  parentCode: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  level: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ActivityClassification = z.infer<typeof ActivityClassificationSchema>;

export const ActivityClassificationListQuerySchema = z.object({
  scheme: ActivityClassSchemeSchema.optional(),
  parentCode: z.string().min(1).max(32).optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type ActivityClassificationListQuery = z.infer<typeof ActivityClassificationListQuerySchema>;

export const ActivityClassificationListResponseSchema = z.object({
  items: z.array(ActivityClassificationSchema), total: z.number().int().min(0),
});

export const CreateActivityClassificationBodySchema = z.object({
  scheme: ActivityClassSchemeSchema,
  code: z.string().min(1).max(32),
  parentCode: z.string().max(32).nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  level: z.number().int().min(1).max(10).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateActivityClassificationBody = z.infer<typeof CreateActivityClassificationBodySchema>;

export const UpdateActivityClassificationBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  parentCode: z.string().max(32).nullable().optional(),
  level: z.number().int().min(1).max(10).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateActivityClassificationBody = z.infer<typeof UpdateActivityClassificationBodySchema>;

export const ActivityClassificationIdParamSchema = z.object({ id: z.string().uuid() });
