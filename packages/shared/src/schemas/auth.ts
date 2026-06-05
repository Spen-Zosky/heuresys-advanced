/**
 * packages/shared/src/schemas/auth.ts
 * Zod request/response schemas for /v1/auth/*. Consumed by:
 *  - @heuresys/api (route validation + handler types)
 *  - @heuresys/web (form validation + fetch result typing) [MVP-2a]
 *
 * Per AUTH_SECURITY_PLAN §13 + API_IMPLEMENTATION_PLAN §6.1.
 */

import { z } from "zod";
import { RoleCodeSchema } from "./role-codes.js";

/* --- Password complexity policy ------------------------------------------ */

/**
 * Password creation/reset policy (NOT enforced on login, so legacy weak
 * hashes can still authenticate and get rehashed via needsRehash).
 * Per AUTH_SECURITY_PLAN §3 last block.
 */
export const PasswordPolicy = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .refine(
    (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p),
    { error: "Password must contain upper, lower, digit, and symbol" },
  );

/* --- Login --------------------------------------------------------------- */

export const LoginBodySchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
  /**
   * MFA second-step fields (MVP-3 Tappa E). When the first step returns
   * `status: "mfa_required"`, the client re-POSTs /login with the same
   * email+password plus the `challengeToken` it received and the `mfaCode`
   * (6-digit TOTP) from the authenticator app.
   */
  challengeToken: z.string().min(1).max(512).optional(),
  mfaCode: z.string().min(1).max(16).optional(),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

/**
 * Successful login (no MFA, or MFA second-step verified). `status` is the
 * discriminator vs the MFA-required arm. The pre-MFA fields
 * (user/roles/csrfToken) are preserved for backward compatibility.
 */
export const LoginResponseSchema = z.object({
  status: z.literal("success"),
  user: z.object({
    userId: z.uuid(),
    email: z.email(),
  }),
  roles: z.array(RoleCodeSchema),
  csrfToken: z.string().min(1),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/**
 * First-step response when the account has a verified MFA factor: no tokens
 * are issued; the client must complete the challenge. `challengeToken` is an
 * opaque, single-use, short-TTL handle into the server-side challenge store.
 */
export const LoginMfaRequiredResponseSchema = z.object({
  status: z.literal("mfa_required"),
  challengeToken: z.string().min(1),
  availableKinds: z.array(z.string()),
});
export type LoginMfaRequiredResponse = z.infer<typeof LoginMfaRequiredResponseSchema>;

/** /login 200 body union — success bundle OR MFA-required challenge. */
export const LoginResultResponseSchema = z.discriminatedUnion("status", [
  LoginResponseSchema,
  LoginMfaRequiredResponseSchema,
]);
export type LoginResultResponse = z.infer<typeof LoginResultResponseSchema>;

/* --- /auth/me ------------------------------------------------------------ */

export const MeResponseSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  roles: z.array(RoleCodeSchema),
  tenantId: z.uuid().nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/* --- Password reset ------------------------------------------------------ */

export const PasswordResetRequestBodySchema = z.object({
  email: z.email().max(254),
});
export type PasswordResetRequestBody = z.infer<typeof PasswordResetRequestBodySchema>;

export const PasswordResetCompleteBodySchema = z
  .object({
    token: z.string().min(1).max(512),
    newPassword: PasswordPolicy,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "newPassword and confirmPassword must match",
    path: ["confirmPassword"],
  });
export type PasswordResetCompleteBody = z.infer<typeof PasswordResetCompleteBodySchema>;

/* --- Admin revoke -------------------------------------------------------- */

export const RevokeUserParamsSchema = z.object({
  userId: z.uuid(),
});
export type RevokeUserParams = z.infer<typeof RevokeUserParamsSchema>;

/* --- Empty response (Fastify schema for 204) ----------------------------- */

export const EmptyResponseSchema = z.strictObject({});

/* --- Generic error envelope --------------------------------------------- */

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

/* --- Role × Permission read-only matrix (MVP-2a) ------------------------ */

export const RolePermissionItemSchema = z.object({
  roleCode: z.string(),
  permissionCode: z.string(),
  permissionResource: z.string(),
  permissionAction: z.string(),
});
export type RolePermissionItem = z.infer<typeof RolePermissionItemSchema>;

export const RolePermissionsResponseSchema = z.object({
  items: z.array(RolePermissionItemSchema),
  total: z.number().int().min(0),
});
export type RolePermissionsResponse = z.infer<typeof RolePermissionsResponseSchema>;

/* --- Active session listing (MVP-3 Tappa E admin endpoint) -------------- */

export const ActiveSessionSchema = z.object({
  familyId: z.uuid(),
  tenantId: z.uuid(),
  firstIssuedAt: z.iso.datetime(),
  lastIssuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
});
export type ActiveSession = z.infer<typeof ActiveSessionSchema>;

export const ListActiveSessionsParamsSchema = z.object({
  userId: z.uuid(),
});
export type ListActiveSessionsParams = z.infer<typeof ListActiveSessionsParamsSchema>;

export const ListActiveSessionsResponseSchema = z.object({
  items: z.array(ActiveSessionSchema),
  total: z.number().int().min(0),
});
export type ListActiveSessionsResponse = z.infer<typeof ListActiveSessionsResponseSchema>;
