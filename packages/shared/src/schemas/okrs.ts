/**
 * @heuresys/shared — OKR schemas (+ key results read). Backs /v1/okrs/* over
 * sys.sys_okrs + sys.sys_okr_key_results. Tenant-scoped. Zod v4. CHECK enums mirror 000037.
 */
import { z } from "zod";
import { paginationFields } from "./_pagination.js";

const META = z.record(z.string(), z.unknown());

export const OkrTypeEnum = z.enum(["COMPANY","DEPARTMENT","TEAM","INDIVIDUAL"]);
export const OkrPeriodTypeEnum = z.enum(["QUARTERLY","MONTHLY","YEARLY","CUSTOM"]);
export const OkrStatusEnum = z.enum(["DRAFT","ACTIVE","ACHIEVED","MISSED","CANCELLED","ARCHIVED"]);
export const KeyResultMetricTypeEnum = z.enum(["PERCENTAGE","NUMBER","CURRENCY","BOOLEAN","MILESTONE"]);
export const KeyResultStatusEnum = z.enum(["ON_TRACK","AT_RISK","BEHIND","COMPLETED","ABANDONED"]);

export const OkrSchema = z.object({
  okrId: z.uuid(),
  tenantId: z.uuid(),
  ownerUserId: z.uuid().nullable(),
  createdByUserId: z.uuid().nullable(),
  parentOkrId: z.uuid().nullable(),
  naturalKey: z.string(),
  objective: z.string(),
  description: z.string().nullable(),
  okrType: OkrTypeEnum,
  department: z.string().nullable(),
  periodType: OkrPeriodTypeEnum,
  periodStart: z.string(),
  periodEnd: z.string(),
  fiscalYear: z.number().int().nullable(),
  fiscalQuarter: z.number().int().nullable(),
  status: OkrStatusEnum,
  overallProgress: z.number(),
  confidenceLevel: z.number().nullable(),
  tags: z.array(z.unknown()),
  metadata: META,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Okr = z.infer<typeof OkrSchema>;

export const OkrListQuerySchema = z.object({
  status: OkrStatusEnum.optional(),
  okrType: OkrTypeEnum.optional(),
  ownerUserId: z.uuid().optional(),
  search: z.string().min(1).max(255).optional(),
  ...paginationFields(200, 50),
});
export type OkrListQuery = z.infer<typeof OkrListQuerySchema>;

export const OkrListResponseSchema = z.object({ items: z.array(OkrSchema), total: z.number().int().min(0) });

export const CreateOkrBodySchema = z.object({
  tenantId: z.uuid().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  parentOkrId: z.uuid().nullable().optional(),
  objective: z.string().min(1),
  description: z.string().nullable().optional(),
  okrType: OkrTypeEnum.optional().default("COMPANY"),
  department: z.string().max(100).nullable().optional(),
  periodType: OkrPeriodTypeEnum.optional().default("QUARTERLY"),
  periodStart: z.string(),
  periodEnd: z.string(),
  fiscalYear: z.number().int().nullable().optional(),
  fiscalQuarter: z.number().int().min(1).max(4).nullable().optional(),
  status: OkrStatusEnum.optional().default("ACTIVE"),
  metadata: META.optional().default({}),
});
export type CreateOkrBody = z.infer<typeof CreateOkrBodySchema>;

export const UpdateOkrBodySchema = z.object({
  objective: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  okrType: OkrTypeEnum.optional(),
  department: z.string().max(100).nullable().optional(),
  periodType: OkrPeriodTypeEnum.optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  status: OkrStatusEnum.optional(),
  overallProgress: z.number().optional(),
  ownerUserId: z.uuid().nullable().optional(),
  metadata: META.optional(),
});
export type UpdateOkrBody = z.infer<typeof UpdateOkrBodySchema>;

export const OkrIdParamSchema = z.object({ id: z.uuid() });

export const OkrKeyResultSchema = z.object({
  keyResultId: z.uuid(),
  tenantId: z.uuid(),
  okrId: z.uuid(),
  ownerUserId: z.uuid().nullable(),
  naturalKey: z.string(),
  description: z.string(),
  metricType: KeyResultMetricTypeEnum,
  startValue: z.number(),
  targetValue: z.number(),
  currentValue: z.number(),
  unit: z.string().nullable(),
  progressPercent: z.number(),
  status: KeyResultStatusEnum,
  weight: z.number(),
  confidenceLevel: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type OkrKeyResult = z.infer<typeof OkrKeyResultSchema>;
export const OkrKeyResultListResponseSchema = z.object({ items: z.array(OkrKeyResultSchema), total: z.number().int().min(0) });
