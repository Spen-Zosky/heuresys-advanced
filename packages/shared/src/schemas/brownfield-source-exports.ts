/**
 * packages/shared/src/schemas/brownfield-source-exports.ts
 * Read-only viewer for brownfield.source_exports (legacy data ingestion).
 */
import { z } from "zod";

export const BROWNFIELD_SOURCE_EXPORT_STATUS_VALUES = [
  "AVAILABLE", "INGESTED", "ARCHIVED", "CORRUPTED",
] as const;
export const BrownfieldSourceExportStatusSchema = z.enum(BROWNFIELD_SOURCE_EXPORT_STATUS_VALUES);
export type BrownfieldSourceExportStatus = z.infer<typeof BrownfieldSourceExportStatusSchema>;

export const BrownfieldSourceExportSchema = z.object({
  sourceExportId: z.uuid(),
  name: z.string(),
  fileHash: z.string().nullable(),
  retrievedAt: z.iso.datetime(),
  sizeBytes: z.number().int().nullable(),
  status: BrownfieldSourceExportStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type BrownfieldSourceExport = z.infer<typeof BrownfieldSourceExportSchema>;

export const BrownfieldSourceExportListQuerySchema = z.object({
  status: BrownfieldSourceExportStatusSchema.optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type BrownfieldSourceExportListQuery = z.infer<typeof BrownfieldSourceExportListQuerySchema>;

export const BrownfieldSourceExportListResponseSchema = z.object({
  items: z.array(BrownfieldSourceExportSchema), total: z.number().int().min(0),
});

export const BrownfieldSourceExportIdParamSchema = z.object({ id: z.uuid() });
