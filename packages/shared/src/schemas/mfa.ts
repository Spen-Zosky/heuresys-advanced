/**
 * packages/shared/src/schemas/mfa.ts
 *
 * Zod request/response contracts for /v1/auth/mfa/*. Consumed by:
 *   - @heuresys/api (route validation + handler types)
 *   - @heuresys/web (future MFA enroll/verify UI on /login)
 *
 * Backend lands first (MVP-3 Tappa E partial). UI is gated by the
 * Heuresys brand identity v1 ( `/login` is a mandatory page type in
 * the bundle and needs decisions on palette + typography before the
 * MFA enrollment QR + verify form can be designed).
 */

import { z } from "zod";

/* --- Factor kinds (mirrors sys_auth_mfa_factors_kind_check) ---------- */

export const MfaKindSchema = z.enum(["TOTP", "WEBAUTHN", "EMAIL_OTP", "SMS_OTP"]);
export type MfaKind = z.infer<typeof MfaKindSchema>;

/* --- Enroll (start) -------------------------------------------------- */

/**
 * Body is intentionally empty for TOTP: the server generates the secret
 * and returns the otpauth URI for QR rendering by the client.
 */
export const EnrollMfaBodySchema = z.object({}).strict();
export type EnrollMfaBody = z.infer<typeof EnrollMfaBodySchema>;

export const EnrollMfaResponseSchema = z.object({
  factorId: z.string().uuid(),
  kind: MfaKindSchema,
  /** otpauth://totp/Heuresys:user@host?secret=BASE32&issuer=Heuresys */
  otpauthUri: z.string().url(),
  /** Base32-encoded shared secret. The client should NOT persist it; it
      exists only to let the user manually key the code into an authenticator
      app when QR scanning is not possible. */
  secret: z.string().min(16),
  verified: z.literal(false),
});
export type EnrollMfaResponse = z.infer<typeof EnrollMfaResponseSchema>;

/* --- Verify setup ---------------------------------------------------- */

export const VerifyMfaSetupBodySchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Six-digit TOTP code required"),
});
export type VerifyMfaSetupBody = z.infer<typeof VerifyMfaSetupBodySchema>;

export const VerifyMfaSetupResponseSchema = z.object({
  factorId: z.string().uuid(),
  kind: MfaKindSchema,
  verified: z.literal(true),
});
export type VerifyMfaSetupResponse = z.infer<typeof VerifyMfaSetupResponseSchema>;

/* --- List factors ---------------------------------------------------- */

export const MfaFactorListItemSchema = z.object({
  factorId: z.string().uuid(),
  kind: MfaKindSchema,
  verified: z.boolean(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});
export type MfaFactorListItem = z.infer<typeof MfaFactorListItemSchema>;

export const ListMfaFactorsResponseSchema = z.object({
  items: z.array(MfaFactorListItemSchema),
  total: z.number().int().min(0),
});
export type ListMfaFactorsResponse = z.infer<typeof ListMfaFactorsResponseSchema>;

/* --- Delete factor --------------------------------------------------- */

export const MfaFactorIdParamSchema = z.object({
  factorId: z.string().uuid(),
});
export type MfaFactorIdParam = z.infer<typeof MfaFactorIdParamSchema>;

/* --- Login challenge (returned by /login when MFA enabled) ----------- */
/* The /login response is extended with an optional `mfaChallenge` field
   instead of issuing the full session immediately. The client should
   then POST /v1/auth/mfa/verify with the challenge token + TOTP code. */

export const MfaChallengeSchema = z.object({
  /** Opaque short-lived token (5 min) tying the password-OK step to
      the upcoming MFA verify call. Stored in-memory server-side as
      challenge → userId mapping. */
  challengeToken: z.string().min(16),
  /** Which factor kinds the user has enrolled & verified. */
  availableKinds: z.array(MfaKindSchema),
});
export type MfaChallenge = z.infer<typeof MfaChallengeSchema>;

/* --- Verify login challenge ----------------------------------------- */

export const VerifyMfaLoginBodySchema = z.object({
  challengeToken: z.string().min(16),
  code: z.string().regex(/^\d{6}$/),
});
export type VerifyMfaLoginBody = z.infer<typeof VerifyMfaLoginBodySchema>;
