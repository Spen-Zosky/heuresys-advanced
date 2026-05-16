/**
 * packages/shared/src/schemas/process-kpi-templates.ts
 * Junction: blueprint process ↔ KPI definition with default weight + target.
 */
import { z } from "zod";

export const ProcessKpiTemplateSchema = z.object({
  processKpiTemplateId: z.string().uuid(),
  processId: z.string().uuid(),
  kpiId: z.string().uuid(),
  defaultWeight: z.number(),
  defaultTarget: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProcessKpiTemplate = z.infer<typeof ProcessKpiTemplateSchema>;

export const ProcessKpiTemplateListQuerySchema = z.object({
  processId: z.string().uuid().optional(),
  kpiId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type ProcessKpiTemplateListQuery = z.infer<typeof ProcessKpiTemplateListQuerySchema>;

export const ProcessKpiTemplateListResponseSchema = z.object({
  items: z.array(ProcessKpiTemplateSchema), total: z.number().int().min(0),
});

export const UpsertProcessKpiTemplateBodySchema = z.object({
  processId: z.string().uuid(),
  kpiId: z.string().uuid(),
  defaultWeight: z.number().min(0).max(1).optional().default(1.0),
  defaultTarget: z.record(z.string(), z.unknown()).optional().default({}),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertProcessKpiTemplateBody = z.infer<typeof UpsertProcessKpiTemplateBodySchema>;

export const ProcessKpiTemplateIdParamSchema = z.object({ id: z.string().uuid() });
