/**
 * packages/shared/src/schemas/activity-classifications.ts
 * ATECO + NACE catalog (global, no tenant).
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
// Must mirror the DB CHECK on sys.sys_activity_classifications.activity_classification_scheme
// (RD-08: varchar+CHECK is the structural authority). The unversioned "ATECO"/"NACE" codes are
// RETIRED as data since #73 (mig 000211, S1028 — legacy schemes archived to audit.* and deleted)
// but stay in the enum: the CHECK still allows them and dropping response-enum values for
// historically-valid data would turn any straggler row into a 500 on serialization (WS-5 lesson).
export const ACTIVITY_CLASS_SCHEME_VALUES = [
  "ATECO_2025", "NACE_REV_2_1", "ATECO_2007", "NACE_REV_2", "ATECO", "NACE",
] as const;
export const ActivityClassSchemeSchema = z.enum(ACTIVITY_CLASS_SCHEME_VALUES);
export type ActivityClassScheme = z.infer<typeof ActivityClassSchemeSchema>;

export const ActivityClassificationSchema = z.object({
  activityClassificationId: z.uuid(),
  scheme: ActivityClassSchemeSchema,
  code: z.string(),
  parentCode: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  level: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ActivityClassification = z.infer<typeof ActivityClassificationSchema>;

export const ActivityClassificationListQuerySchema = z.object({
  scheme: ActivityClassSchemeSchema.optional(),
  parentCode: z.string().min(1).max(32).optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(500, 100),
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

export const ActivityClassificationIdParamSchema = z.object({ id: z.uuid() });
