/**
 * packages/shared/src/schemas/provisioning.ts
 * D-14 FASE 1 — tenant provisioning contract.
 *
 * POST /v1/tenants/provision takes an organisation from zero to operational in
 * one transactional call: a tenant + its first TENANT_ADMIN (identity + Argon2id
 * credential + role grant) + a per-tenant MFA policy. Admin-gated (tenant:create
 * = PLATFORM_ADMIN only). No PII beyond the admin's own contact fields.
 */
import { z } from "zod";

export const ProvisionTenantBodySchema = z.object({
  // tenant
  tenantCode: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, "tenantCode must be uppercase letters, digits or underscore"),
  tenantName: z.string().min(1).max(200),
  tenantLegalName: z.string().min(1).max(200).optional(),
  tenantCountryCode: z.string().length(2).optional(),
  tenantIndustryCode: z.string().max(16).optional(),
  tenantSizeBand: z.string().max(16).optional(),
  // first admin
  adminEmail: z.string().email().max(320),
  adminDisplayName: z.string().min(1).max(200),
  adminPassword: z.string().min(12).max(200),
});
export type ProvisionTenantBody = z.infer<typeof ProvisionTenantBodySchema>;

export const ProvisionTenantResponseSchema = z.object({
  tenant: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
  }),
  admin: z.object({
    userId: z.string().uuid(),
    email: z.string(),
    // the first credential is issued must-rotate: the admin sets their own password at first login
    mustRotatePassword: z.boolean(),
  }),
});
export type ProvisionTenantResponse = z.infer<typeof ProvisionTenantResponseSchema>;
