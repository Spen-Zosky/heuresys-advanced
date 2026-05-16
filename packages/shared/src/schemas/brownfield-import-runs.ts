/**
 * packages/shared/src/schemas/brownfield-import-runs.ts
 * Read-only + trigger for brownfield.import_runs.
 */
import { z } from "zod";

export const BROWNFIELD_IMPORT_STATUS_VALUES = [
  "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "AWAITING_APPROVAL",
] as const;
export const BrownfieldImportStatusSchema = z.enum(BROWNFIELD_IMPORT_STATUS_VALUES);
export type BrownfieldImportStatus = z.infer<typeof BrownfieldImportStatusSchema>;

export const BrownfieldImportRunSchema = z.object({
  importRunId: z.string().uuid(),
  exportId: z.string().uuid().nullable(),
  wave: z.number().int().nullable(),
  classificationScope: z.string().nullable(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  status: BrownfieldImportStatusSchema,
  initiatedBy: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});
export type BrownfieldImportRun = z.infer<typeof BrownfieldImportRunSchema>;

export const BrownfieldImportRunListQuerySchema = z.object({
  exportId: z.string().uuid().optional(),
  status: BrownfieldImportStatusSchema.optional(),
  wave: z.coerce.number().int().min(0).max(32767).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type BrownfieldImportRunListQuery = z.infer<typeof BrownfieldImportRunListQuerySchema>;

export const BrownfieldImportRunListResponseSchema = z.object({
  items: z.array(BrownfieldImportRunSchema), total: z.number().int().min(0),
});

export const CreateBrownfieldImportRunBodySchema = z.object({
  exportId: z.string().uuid().nullable().optional(),
  wave: z.number().int().min(0).max(32767).nullable().optional(),
  classificationScope: z.string().max(32).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateBrownfieldImportRunBody = z.infer<typeof CreateBrownfieldImportRunBodySchema>;

export const UpdateBrownfieldImportRunBodySchema = z.object({
  status: BrownfieldImportStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateBrownfieldImportRunBody = z.infer<typeof UpdateBrownfieldImportRunBodySchema>;

export const BrownfieldImportRunIdParamSchema = z.object({ id: z.string().uuid() });
