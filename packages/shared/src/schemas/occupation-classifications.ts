/**
 * packages/shared/src/schemas/occupation-classifications.ts
 * ISCO-08 + CP2021 occupation catalog (global, no tenant) — asse PROFESSIONE,
 * simmetrico ad activity-classifications (asse ATTIVITÀ). Mig 000206.
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
// Must mirror the DB CHECK on sys.sys_occupation_classifications.occupation_classification_scheme
// (RD-08: varchar+CHECK is the structural authority). STRICT by design: ESCO
// occupations live in sys_esco_occupation_mappings (ADR-0016), not here.
export const OCCUPATION_CLASS_SCHEME_VALUES = ["ISCO_08", "CP_2021"] as const;
export const OccupationClassSchemeSchema = z.enum(OCCUPATION_CLASS_SCHEME_VALUES);
export type OccupationClassScheme = z.infer<typeof OccupationClassSchemeSchema>;

export const OccupationClassificationSchema = z.object({
  occupationClassificationId: z.uuid(),
  scheme: OccupationClassSchemeSchema,
  code: z.string(),
  parentCode: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  level: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type OccupationClassification = z.infer<typeof OccupationClassificationSchema>;

export const OccupationClassificationListQuerySchema = z.object({
  scheme: OccupationClassSchemeSchema.optional(),
  parentCode: z.string().min(1).max(32).optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(500, 100),
});
export type OccupationClassificationListQuery = z.infer<typeof OccupationClassificationListQuerySchema>;

export const OccupationClassificationListResponseSchema = z.object({
  items: z.array(OccupationClassificationSchema), total: z.number().int().min(0),
});

export const CreateOccupationClassificationBodySchema = z.object({
  scheme: OccupationClassSchemeSchema,
  code: z.string().min(1).max(32),
  parentCode: z.string().max(32).nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(4096).nullable().optional(),
  level: z.number().int().min(1).max(10).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateOccupationClassificationBody = z.infer<typeof CreateOccupationClassificationBodySchema>;

export const UpdateOccupationClassificationBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).nullable().optional(),
  parentCode: z.string().max(32).nullable().optional(),
  level: z.number().int().min(1).max(10).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateOccupationClassificationBody = z.infer<typeof UpdateOccupationClassificationBodySchema>;

export const OccupationClassificationIdParamSchema = z.object({ id: z.uuid() });
