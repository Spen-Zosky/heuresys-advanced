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
  // 6-digit TOTP/EMAIL_OTP, or a recovery code (16 hex chars, may be typed with
  // separators) — normalized server-side before matching. Upper bound 40 covers both.
  mfaCode: z.string().min(1).max(40).optional(),
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
  /**
   * The caller's flattened RBAC permission codes, resolved server-side from the
   * boot-loaded role×permission cache. Present so the client can derive what it
   * may do from what it MAY DO, not from an enumeration of role names: the
   * landing decision (#116) reads `dashboard:view` here instead of guessing from
   * `roles`. Same payload as GET /v1/me/permissions, delivered with the login so
   * the redirect costs no extra round-trip.
   */
  permissions: z.array(z.string()),
  csrfToken: z.string().min(1),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/* --- Where a successful login lands (#116) -------------------------------- */

/** The permission the API enforces on the dashboard surface itself. */
export const DASHBOARD_PERMISSION = "dashboard:view";

/**
 * The landing rule, derived from grants rather than enumerated from role names:
 * **you land on the dashboard if you may view the dashboard.**
 *
 * It lives beside `LoginResponseSchema` because it consumes that contract's
 * `permissions` field, and because the regression test that must fail when
 * someone re-hardcodes a role list needs to read this rule and the live RBAC map
 * in the same process (`apps/api/test/landing-derivation.integration.test.ts`).
 *
 * History — both earlier shapes decided from the SET OF ROLE NAMES: an
 * ADMIN_ROLES allowlist, then (D-68) its inversion. The inversion closed a
 * fall-through and opened the mirror defect: every role outside the self-service
 * set was sent to /dashboard WITHOUT checking it could see it. Measured
 * 2026-08-04 on the live map: 6 of 13 roles hold `dashboard:view`, so CEO,
 * ORG_DIRECTOR, TEAM_LEADER and WHISTLEBLOWING_CUSTODIAN landed on a page they
 * are denied — 28 of the 45 people who land there.
 */
export function landingForPermissions(permissions: readonly string[]): string {
  return permissions.includes(DASHBOARD_PERMISSION) ? "/dashboard" : "/me";
}

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

/**
 * First-step response when the tenant's mandatory-MFA policy is enabled, the
 * user is in scope, and they have NO verified MFA factor (MVP-4 §2.5 #4).
 * The server sets a RESTRICTED enrollment-only session cookie (access JWT with
 * claim `enr: true` and roles []) — every permission-gated route denies it; the
 * only usable surface is the MFA self-service enrollment under /v1/auth/mfa.
 * `csrfToken` lets the client send the CSRF header on the enrollment POSTs.
 * After enrolling + verifying a factor the client re-submits /login from
 * scratch and completes the regular `mfa_required` challenge.
 */
export const LoginEnrollmentRequiredResponseSchema = z.object({
  status: z.literal("mfa_enrollment_required"),
  csrfToken: z.string().min(1),
  /** Factor kinds the user may enroll (UI hint). */
  allowedKinds: z.array(z.string()),
});
export type LoginEnrollmentRequiredResponse = z.infer<
  typeof LoginEnrollmentRequiredResponseSchema
>;

/** /login 200 body union — success bundle, MFA challenge, or enrollment gate. */
export const LoginResultResponseSchema = z.discriminatedUnion("status", [
  LoginResponseSchema,
  LoginMfaRequiredResponseSchema,
  LoginEnrollmentRequiredResponseSchema,
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

/* --- Self-service session management (MVP-4 §2.5, /v1/me/security/sessions) ---- */

// The list reuses ListActiveSessionsResponseSchema. The current-session family is
// resolved separately via GET /v1/auth/sessions/current (from the access JWT `fam`
// claim — the refresh token is opaque + HttpOnly and is never parsed outside the
// rotation flow), and the client marks the matching row as "this device".
export const RevokeSessionParamsSchema = z.object({ familyId: z.uuid() });
export const RevokeSessionResponseSchema = z.object({ revoked: z.literal(true) });
export const RevokeOtherSessionsBodySchema = z.object({ currentFamilyId: z.uuid().nullable() });
export const RevokeOtherSessionsResponseSchema = z.object({ revokedFamilies: z.number().int().min(0) });
export type RevokeOtherSessionsResponse = z.infer<typeof RevokeOtherSessionsResponseSchema>;
export const CurrentSessionResponseSchema = z.object({ familyId: z.uuid().nullable() });
export type CurrentSessionResponse = z.infer<typeof CurrentSessionResponseSchema>;
