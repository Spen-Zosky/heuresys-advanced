/**
 * packages/shared/src/schemas/visualization-exports.ts
 */
import { z } from "zod";

export const VIZ_EXPORT_FORMAT_VALUES = [
  "SVG", "PDF", "PNG", "GENERIC_JSON", "REACT_FLOW_JSON", "MERMAID",
] as const;
export const VizExportFormatSchema = z.enum(VIZ_EXPORT_FORMAT_VALUES);
export type VizExportFormat = z.infer<typeof VizExportFormatSchema>;

export const VizExportSchema = z.object({
  exportId: z.string().uuid(),
  graphId: z.string().uuid(),
  layoutId: z.string().uuid().nullable(),
  format: VizExportFormatSchema,
  payloadUri: z.string().nullable(),
  generatedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});
export type VizExport = z.infer<typeof VizExportSchema>;

export const VizExportListQuerySchema = z.object({
  graphId: z.string().uuid().optional(),
  layoutId: z.string().uuid().optional(),
  format: VizExportFormatSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type VizExportListQuery = z.infer<typeof VizExportListQuerySchema>;

export const VizExportListResponseSchema = z.object({
  items: z.array(VizExportSchema), total: z.number().int().min(0),
});

export const CreateVizExportBodySchema = z.object({
  graphId: z.string().uuid(),
  layoutId: z.string().uuid().nullable().optional(),
  format: VizExportFormatSchema,
  payloadUri: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateVizExportBody = z.infer<typeof CreateVizExportBodySchema>;

export const VizExportIdParamSchema = z.object({ id: z.string().uuid() });
