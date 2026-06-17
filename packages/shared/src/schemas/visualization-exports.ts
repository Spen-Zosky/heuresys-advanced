/**
 * packages/shared/src/schemas/visualization-exports.ts
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const VIZ_EXPORT_FORMAT_VALUES = [
  "SVG", "PDF", "PNG", "GENERIC_JSON", "REACT_FLOW_JSON", "MERMAID",
] as const;
export const VizExportFormatSchema = z.enum(VIZ_EXPORT_FORMAT_VALUES);
export type VizExportFormat = z.infer<typeof VizExportFormatSchema>;

export const VizExportSchema = z.object({
  exportId: z.uuid(),
  graphId: z.uuid(),
  layoutId: z.uuid().nullable(),
  format: VizExportFormatSchema,
  payloadUri: z.string().nullable(),
  generatedAt: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
});
export type VizExport = z.infer<typeof VizExportSchema>;

export const VizExportListQuerySchema = z.object({
  graphId: z.uuid().optional(),
  layoutId: z.uuid().optional(),
  format: VizExportFormatSchema.optional(),
  ...paginationFields(200, 50),
});
export type VizExportListQuery = z.infer<typeof VizExportListQuerySchema>;

export const VizExportListResponseSchema = z.object({
  items: z.array(VizExportSchema), total: z.number().int().min(0),
});

export const CreateVizExportBodySchema = z.object({
  graphId: z.uuid(),
  layoutId: z.uuid().nullable().optional(),
  format: VizExportFormatSchema,
  payloadUri: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateVizExportBody = z.infer<typeof CreateVizExportBodySchema>;

export const VizExportIdParamSchema = z.object({ id: z.uuid() });
