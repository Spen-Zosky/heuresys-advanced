/**
 * packages/shared/src/schemas/kpi-definitions.ts
 * Schemas for /v1/kpi-definitions/* (sys.sys_kpi_definitions).
 * Same global+tenant visibility model as skills.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const KPI_POLARITY_VALUES = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "TARGET_RANGE"] as const;
export const KpiPolaritySchema = z.enum(KPI_POLARITY_VALUES);

export const KpiDefinitionSchema = z.object({
  kpiDefinitionId: z.uuid(),
  tenantId: z.uuid().nullable(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  formula: z.string().nullable(),
  unit: z.string().nullable(),
  polarity: KpiPolaritySchema,
  isGlobal: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type KpiDefinition = z.infer<typeof KpiDefinitionSchema>;

export const KpiDefinitionListQuerySchema = z.object({
  isGlobal: z.coerce.boolean().optional(),
  polarity: KpiPolaritySchema.optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
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
  tenantId: z.uuid().optional(),
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

export const KpiDefinitionIdParamSchema = z.object({ id: z.uuid() });

// ─────────────────────────────────────────────────────────────────────────────
// #31 (S1018) — KPI metrology: READ-only over the 000015 satellites
// (metric definitions, measurements, assessment-method & weighting-rule catalogs).
// CHECK enums mirror migration 000015.
// ─────────────────────────────────────────────────────────────────────────────

export const KpiMetricAggregationEnum = z.enum(["SUM","AVG","MIN","MAX","COUNT","RATIO","CUSTOM"]);
export const KpiMetricDefinitionSchema = z.object({
  metricId: z.uuid(),
  kpiId: z.uuid(),
  code: z.string(),
  name: z.string(),
  unit: z.string().nullable(),
  aggregation: KpiMetricAggregationEnum,
  createdAt: z.iso.datetime(),
});
export type KpiMetricDefinition = z.infer<typeof KpiMetricDefinitionSchema>;
export const KpiMetricListResponseSchema = z.object({
  items: z.array(KpiMetricDefinitionSchema), total: z.number().int().min(0),
});

export const KpiAssessmentMethodCodeEnum = z.enum(["DELTA_VS_TARGET","PERCENTILE","BANDED","LINEAR_SCORE","STEPPED"]);
export const KpiAssessmentMethodSchema = z.object({
  methodId: z.uuid(),
  code: KpiAssessmentMethodCodeEnum,
  name: z.string(),
  description: z.string().nullable(),
});
export type KpiAssessmentMethod = z.infer<typeof KpiAssessmentMethodSchema>;
export const KpiAssessmentMethodListResponseSchema = z.object({
  items: z.array(KpiAssessmentMethodSchema), total: z.number().int().min(0),
});

export const KpiWeightingRuleKindEnum = z.enum(["LINEAR","CAPPED","STEP"]);
export const KpiWeightingRuleSchema = z.object({
  ruleId: z.uuid(),
  code: z.string(),
  name: z.string(),
  kind: KpiWeightingRuleKindEnum,
  payload: z.record(z.string(), z.unknown()),
  description: z.string().nullable(),
});
export type KpiWeightingRule = z.infer<typeof KpiWeightingRuleSchema>;
export const KpiWeightingRuleListResponseSchema = z.object({
  items: z.array(KpiWeightingRuleSchema), total: z.number().int().min(0),
});

export const KpiMeasurementSchema = z.object({
  measurementId: z.uuid(),
  kpiId: z.uuid(),
  userId: z.uuid().nullable(),
  positionId: z.uuid().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  value: z.number(),
  unit: z.string().nullable(),
  source: z.string().nullable(),
  recordedAt: z.iso.datetime(),
});
export type KpiMeasurement = z.infer<typeof KpiMeasurementSchema>;
export const KpiMeasurementListQuerySchema = z.object({
  userId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  ...paginationFields(200, 50),
});
export type KpiMeasurementListQuery = z.infer<typeof KpiMeasurementListQuerySchema>;
export const KpiMeasurementListResponseSchema = z.object({
  items: z.array(KpiMeasurementSchema), total: z.number().int().min(0),
});
