/**
 * packages/shared/src/schemas/enterprise-size-bands.ts
 */
import { z } from "zod";

export const ENTERPRISE_SIZE_BAND_CODE_VALUES = ["XS", "S", "M", "L", "XL"] as const;
export const EnterpriseSizeBandCodeSchema = z.enum(ENTERPRISE_SIZE_BAND_CODE_VALUES);
export type EnterpriseSizeBandCode = z.infer<typeof EnterpriseSizeBandCodeSchema>;

export const EnterpriseSizeBandSchema = z.object({
  enterpriseSizeBandId: z.string().uuid(),
  code: EnterpriseSizeBandCodeSchema,
  name: z.string(),
  minEmployees: z.number().int().nullable(),
  maxEmployees: z.number().int().nullable(),
  minRevenueEur: z.number().nullable(),
  maxRevenueEur: z.number().nullable(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EnterpriseSizeBand = z.infer<typeof EnterpriseSizeBandSchema>;

export const EnterpriseSizeBandListResponseSchema = z.object({
  items: z.array(EnterpriseSizeBandSchema), total: z.number().int().min(0),
});

export const UpsertEnterpriseSizeBandBodySchema = z.object({
  code: EnterpriseSizeBandCodeSchema,
  name: z.string().min(1).max(128),
  minEmployees: z.number().int().min(0).nullable().optional(),
  maxEmployees: z.number().int().min(0).nullable().optional(),
  minRevenueEur: z.number().min(0).nullable().optional(),
  maxRevenueEur: z.number().min(0).nullable().optional(),
  description: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertEnterpriseSizeBandBody = z.infer<typeof UpsertEnterpriseSizeBandBodySchema>;

export const EnterpriseSizeBandIdParamSchema = z.object({ id: z.string().uuid() });
