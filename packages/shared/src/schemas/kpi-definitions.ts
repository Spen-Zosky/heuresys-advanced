/**
 * packages/shared/src/schemas/kpi-definitions.ts
 * Schemas for /v1/kpi-definitions/* (sys.sys_kpi_definitions).
 * Same global+tenant visibility model as skills.
 */

import { z } from "zod";

export const KPI_POLARITY_VALUES = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET_RANGE"] as const;
export const KpiPolaritySchema = z.enum(KPI_POLARITY_VALUES);

export const KpiDefinitionSchema = z.object({
  kpiDefinitionId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  formula: z.string().nullable(),
  unit: z.string().nullable(),
  polarity: KpiPolaritySchema,
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type KpiDefinition = z.infer<typeof KpiDefinitionSchema>;

export const KpiDefinitionListQuerySchema = z.object({
  isGlobal: z.coerce.boolean().optional(),
  polarity: KpiPolaritySchema.optional(),
  search: z.string().min(1).max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type KpiDefinitionListQuery = z.infer<typeof KpiDefinitionListQuerySchema>;

export const KpiDefinitionListResponseSchema = z.object({
  items: z.array(KpiDefinitionSchema),
  total: z.number().int().min(0),
});

export const CreateKpiDefinitionBodySchema = z.object({
  code: z.string().min(1).max(128),
  name: z.string().min(1).max(255),
  description: z.string().max(2048).nullable().optional(),
  formula: z.string().max(2048).nullable().optional(),
  unit: z.string().max(64).nullable().optional(),
  polarity: KpiPolaritySchema.optional().default("HIGHER_IS_BETTER"),
  isGlobal: z.boolean().optional().default(false),
  tenantId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateKpiDefinitionBody = z.infer<typeof CreateKpiDefinitionBodySchema>;

export const UpdateKpiDefinitionBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2048).nullable().optional(),
  formula: z.string().max(2048).nullable().optional(),
  unit: z.string().max(64).nullable().optional(),
  polarity: KpiPolaritySchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateKpiDefinitionBody = z.infer<typeof UpdateKpiDefinitionBodySchema>;

export const KpiDefinitionIdParamSchema = z.object({ id: z.string().uuid() });
