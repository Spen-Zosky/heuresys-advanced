/**
 * packages/shared/src/schemas/enterprise-typing-profiles.ts
 * 1:1 with tenant. Upsert by tenant.
 */
import { z } from "zod";

export const REGULATORY_INTENSITY_VALUES = ["LOW", "MEDIUM", "HIGH", "EXTREME"] as const;
export const RegulatoryIntensitySchema = z.enum(REGULATORY_INTENSITY_VALUES);
export type RegulatoryIntensity = z.infer<typeof RegulatoryIntensitySchema>;

export const EnterpriseTypingProfileSchema = z.object({
  enterpriseTypingProfileId: z.uuid(),
  tenantId: z.uuid(),
  industryClassId: z.uuid().nullable(),
  sizeBandId: z.uuid().nullable(),
  operatingModelId: z.uuid().nullable(),
  regulatoryIntensity: RegulatoryIntensitySchema,
  employeeCount: z.number().int().nullable(),
  revenueEur: z.number().nullable(),
  countryCode: z.string().length(2).nullable(),
  assessedAt: z.iso.datetime(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EnterpriseTypingProfile = z.infer<typeof EnterpriseTypingProfileSchema>;

export const EnterpriseTypingProfileListQuerySchema = z.object({
  regulatoryIntensity: RegulatoryIntensitySchema.optional(),
  industryClassId: z.uuid().optional(),
  sizeBandId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type EnterpriseTypingProfileListQuery = z.infer<typeof EnterpriseTypingProfileListQuerySchema>;

export const EnterpriseTypingProfileListResponseSchema = z.object({
  items: z.array(EnterpriseTypingProfileSchema), total: z.number().int().min(0),
});

export const UpsertEnterpriseTypingProfileBodySchema = z.object({
  tenantId: z.uuid().optional(),
  industryClassId: z.uuid().nullable().optional(),
  sizeBandId: z.uuid().nullable().optional(),
  operatingModelId: z.uuid().nullable().optional(),
  regulatoryIntensity: RegulatoryIntensitySchema.optional().default("MEDIUM"),
  employeeCount: z.number().int().min(0).nullable().optional(),
  revenueEur: z.number().min(0).nullable().optional(),
  countryCode: z.string().length(2).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type UpsertEnterpriseTypingProfileBody = z.infer<typeof UpsertEnterpriseTypingProfileBodySchema>;

export const EnterpriseTypingProfileIdParamSchema = z.object({ id: z.uuid() });
