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
    { message: "Password must contain upper, lower, digit, and symbol" },
  );

/* --- Login --------------------------------------------------------------- */

export const LoginBodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const LoginResponseSchema = z.object({
  user: z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
  }),
  roles: z.array(RoleCodeSchema),
  csrfToken: z.string().min(1),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/* --- /auth/me ------------------------------------------------------------ */

export const MeResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(RoleCodeSchema),
  tenantId: z.string().uuid().nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/* --- Password reset ------------------------------------------------------ */

export const PasswordResetRequestBodySchema = z.object({
  email: z.string().email().max(254),
});
export type PasswordResetRequestBody = z.infer<typeof PasswordResetRequestBodySchema>;

export const PasswordResetCompleteBodySchema = z
  .object({
    token: z.string().min(1).max(512),
    newPassword: PasswordPolicy,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "newPassword and confirmPassword must match",
    path: ["confirmPassword"],
  });
export type PasswordResetCompleteBody = z.infer<typeof PasswordResetCompleteBodySchema>;

/* --- Admin revoke -------------------------------------------------------- */

export const RevokeUserParamsSchema = z.object({
  userId: z.string().uuid(),
});
export type RevokeUserParams = z.infer<typeof RevokeUserParamsSchema>;

/* --- Empty response (Fastify schema for 204) ----------------------------- */

export const EmptyResponseSchema = z.object({}).strict();

/* --- Generic error envelope --------------------------------------------- */

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
