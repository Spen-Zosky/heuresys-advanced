/**
 * packages/shared/src/schemas/process-kpi-templates.ts
 * Junction: blueprint process ↔ KPI definition with default weight + target.
 */
import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const ProcessKpiTemplateSchema = z.object({
  processKpiTemplateId: z.uuid(),
  processId: z.uuid(),
  kpiId: z.uuid(),
  defaultWeight: z.number(),
  defaultTarget: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ProcessKpiTemplate = z.infer<typeof ProcessKpiTemplateSchema>;

export const ProcessKpiTemplateListQuerySchema = z.object({
  processId: z.uuid().optional(),
  kpiId: z.uuid().optional(),
  ...paginationFields(500, 100),
});
export type ProcessKpiTemplateListQuery = z.infer<typeof ProcessKpiTemplateListQuerySchema>;

export const ProcessKpiTemplateListResponseSchema = z.object({
  items: z.array(ProcessKpiTemplateSchema), total: z.number().int().min(0),
});

export const UpsertProcessKpiTemplateBodySchema = z.object({
  processId: z.uuid(),
  kpiId: z.uuid(),
  defaultWeight: z.number().min(0).max(1).optional().default(1.0),
  defaultTarget: z.record(z.string(), z.unknown()).optional().default({}),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertProcessKpiTemplateBody = z.infer<typeof UpsertProcessKpiTemplateBodySchema>;

export const ProcessKpiTemplateIdParamSchema = z.object({ id: z.uuid() });
