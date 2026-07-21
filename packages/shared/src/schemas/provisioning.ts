/**
 * packages/shared/src/schemas/provisioning.ts
 * D-14 FASE 1+2 — tenant provisioning contract.
 *
 * POST /v1/tenants/provision takes an organisation from zero to operational in
 * one transactional call: a tenant + its first TENANT_ADMIN (identity + Argon2id
 * credential + role grants) + a per-tenant MFA policy + (F2) an OPTIONAL org
 * archetype materialized in the SAME transaction (org-units, positions,
 * incumbents — all-or-nothing). Admin-gated (tenant:create = PLATFORM_ADMIN).
 * F2 completeness: the admin gets the practiced role floor (TENANT_ADMIN +
 * USER, I17); a duplicate tenantCode is a clean 409 TENANT_CODE_EXISTS; the
 * whole endpoint sits behind the TENANT_PROVISION_ENABLED kill-switch.
 */
import { z } from "zod";
import { MaterializeCountsSchema } from "./tenant-materialization.js";
import { TenantSizeBandSchema } from "./tenants.js";

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
  tenantSizeBand: TenantSizeBandSchema.optional(),
  // first admin
  adminEmail: z.string().email().max(320),
  adminDisplayName: z.string().min(1).max(200),
  adminPassword: z.string().min(12).max(200),
  // F2: optional org archetype, materialized inside the SAME transaction
  // (validated against the deterministic catalog BEFORE any write).
  archetypeKey: z.string().min(1).max(64).optional(),
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
    // F2: the granted role floor — TENANT_ADMIN + USER (I17 as practiced)
    roles: z.array(z.string()),
  }),
  // F2: present only when archetypeKey was supplied — created counts of the
  // in-transaction materialization.
  archetype: z
    .object({
      key: z.string(),
      created: MaterializeCountsSchema,
    })
    .optional(),
});
export type ProvisionTenantResponse = z.infer<typeof ProvisionTenantResponseSchema>;
