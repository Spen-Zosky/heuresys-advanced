/**
 * packages/shared/src/schemas/mfa-policy.ts
 * Zod schemas for /v1/mfa-policy — the per-tenant mandatory-MFA policy
 * (MVP-4 §2.5 #4). Consumed by @heuresys/api (route validation) and
 * @heuresys/web (admin policy UI typing).
 *
 * Semantics: one row per tenant, default OFF. When enabled, a login by a
 * tenant user whose roles intersect `roleCodes` (null = every role) and who
 * has NO verified MFA factor returns `status: "mfa_enrollment_required"`
 * instead of a session (see auth.ts LoginEnrollmentRequiredResponseSchema).
 */

import { z } from "zod";

export const MfaPolicySchema = z.object({
  policyId: z.uuid(),
  tenantId: z.uuid(),
  enabled: z.boolean(),
  /** null = the policy applies to every role of the tenant. */
  roleCodes: z.array(z.string()).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MfaPolicy = z.infer<typeof MfaPolicySchema>;

export const ListMfaPoliciesResponseSchema = z.object({
  items: z.array(MfaPolicySchema),
  total: z.number().int().min(0),
});
export type ListMfaPoliciesResponse = z.infer<typeof ListMfaPoliciesResponseSchema>;

export const UpsertMfaPolicyParamsSchema = z.object({
  tenantId: z.uuid(),
});
export type UpsertMfaPolicyParams = z.infer<typeof UpsertMfaPolicyParamsSchema>;

export const UpsertMfaPolicyBodySchema = z.object({
  enabled: z.boolean(),
  /**
   * Omitted or null = all roles in scope. A non-null list must not be empty
   * (an empty list would silently disable the policy — force the caller to be
   * explicit by sending enabled:false instead).
   */
  roleCodes: z.array(z.string().min(1).max(64)).min(1).max(16).nullish(),
});
export type UpsertMfaPolicyBody = z.infer<typeof UpsertMfaPolicyBodySchema>;

export const UpsertMfaPolicyResponseSchema = MfaPolicySchema;
