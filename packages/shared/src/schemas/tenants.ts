/**
 * packages/shared/src/schemas/tenants.ts
 * Zod request/response schemas for /v1/tenants/*. Mirrors the column
 * definitions in sys.sys_tenancies (TARGET_SCHEMA_DESIGN §2.1) and the
 * CHECK constraints on tenant_status and tenant_size_band.
 *
 * Per API_IMPLEMENTATION_PLAN §6.2.
 */

import { z } from "zod";

import { paginationFields } from "./_pagination.js";
export const TENANT_STATUS_VALUES = [
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
  "PENDING_ACTIVATION",
] as const;
export type TenantStatus = (typeof TENANT_STATUS_VALUES)[number];
export const TenantStatusSchema = z.enum(TENANT_STATUS_VALUES);

export const TENANT_SIZE_BAND_VALUES = ["XS", "S", "M", "L", "XL"] as const;
export type TenantSizeBand = (typeof TENANT_SIZE_BAND_VALUES)[number];
export const TenantSizeBandSchema = z.enum(TENANT_SIZE_BAND_VALUES);

/** Canonical tenant read shape. */
export const TenantSchema = z.object({
  tenantId: z.uuid(),
  tenantCode: z.string().min(1).max(64),
  tenantName: z.string().min(1).max(255),
  tenantLegalName: z.string().max(255).nullable(),
  tenantCountryCode: z
    .string()
    .length(2, "ISO 3166-1 alpha-2 (2 chars)")
    .nullable(),
  tenantIndustryCode: z.string().max(32).nullable(),
  tenantSizeBand: TenantSizeBandSchema.nullable(),
  tenantStatus: TenantStatusSchema,
  tenantMetadata: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Tenant = z.infer<typeof TenantSchema>;

/* --- POST /v1/tenants ---------------------------------------------------- */

export const CreateTenantBodySchema = z.object({
  tenantCode: z.string().min(1).max(64),
  tenantName: z.string().min(1).max(255),
  tenantLegalName: z.string().max(255).nullable().optional(),
  tenantCountryCode: z.string().length(2).nullable().optional(),
  tenantIndustryCode: z.string().max(32).nullable().optional(),
  tenantSizeBand: TenantSizeBandSchema.nullable().optional(),
  tenantStatus: TenantStatusSchema.optional().default("PENDING_ACTIVATION"),
  tenantMetadata: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateTenantBody = z.infer<typeof CreateTenantBodySchema>;

/* --- PATCH /v1/tenants/:id ----------------------------------------------- */
// tenantCode is immutable; everything else can be patched.
export const UpdateTenantBodySchema = z.object({
  tenantName: z.string().min(1).max(255).optional(),
  tenantLegalName: z.string().max(255).nullable().optional(),
  tenantCountryCode: z.string().length(2).nullable().optional(),
  tenantIndustryCode: z.string().max(32).nullable().optional(),
  tenantSizeBand: TenantSizeBandSchema.nullable().optional(),
  tenantStatus: TenantStatusSchema.optional(),
  tenantMetadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateTenantBody = z.infer<typeof UpdateTenantBodySchema>;

/* --- GET /v1/tenants (list) --------------------------------------------- */

export const TenantListQuerySchema = z.object({
  status: TenantStatusSchema.optional(),
  countryCode: z.string().length(2).optional(),
  industryCode: z.string().max(32).optional(),
  sizeBand: TenantSizeBandSchema.optional(),
  ...paginationFields(200, 50),
});
export type TenantListQuery = z.infer<typeof TenantListQuerySchema>;

export const TenantListResponseSchema = z.object({
  items: z.array(TenantSchema),
  total: z.number().int().min(0),
});
export type TenantListResponse = z.infer<typeof TenantListResponseSchema>;

/* --- :id param ---------------------------------------------------------- */

export const TenantIdParamSchema = z.object({
  id: z.uuid(),
});
export type TenantIdParam = z.infer<typeof TenantIdParamSchema>;
