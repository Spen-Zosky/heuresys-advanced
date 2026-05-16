/**
 * apps/api/src/modules/auth/schema.ts
 * Zod request/response schemas for the /v1/auth/* endpoints.
 * Promoted to packages/shared in MVP-1 step 5.1.4.
 *
 * Per AUTH_SECURITY_PLAN §13 + API_IMPLEMENTATION_PLAN §6.1.
 */

import { z } from "zod";
import { ROLE_CODES } from "../../config/constants.js";
import { PasswordPolicy } from "./password.js";

export const RoleCodeSchema = z.enum(ROLE_CODES);

/* --- Login ----------------------------------------------------------------*/

export const LoginBodySchema = z.object({
  email: z.string().email().max(254),
  // No complexity check on login: legacy/weak hashes must still authenticate
  // so they can be transparently rehashed via needsRehash.
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

/* --- /auth/me -------------------------------------------------------------*/

export const MeResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(RoleCodeSchema),
  tenantId: z.string().uuid().nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/* --- Password reset -------------------------------------------------------*/

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

/* --- Admin revoke ---------------------------------------------------------*/

export const RevokeUserParamsSchema = z.object({
  userId: z.string().uuid(),
});
export type RevokeUserParams = z.infer<typeof RevokeUserParamsSchema>;

/* --- Empty response (Fastify schema for 204) ------------------------------*/

export const EmptyResponseSchema = z.object({}).strict();

/* --- Generic error envelope (documentation only — errorHandler emits) ----*/

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
