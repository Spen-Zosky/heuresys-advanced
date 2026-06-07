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
export const EnrollMfaBodySchema = z.strictObject({});
export type EnrollMfaBody = z.infer<typeof EnrollMfaBodySchema>;

export const EnrollMfaResponseSchema = z.object({
  factorId: z.uuid(),
  kind: MfaKindSchema,
  /** otpauth://totp/Heuresys:user@host?secret=BASE32&issuer=Heuresys */
  otpauthUri: z.url(),
  /** Base32-encoded shared secret. The client should NOT persist it; it
      exists only to let the user manually key the code into an authenticator
      app when QR scanning is not possible. */
  secret: z.string().min(16),
  verified: z.literal(false),
});
export type EnrollMfaResponse = z.infer<typeof EnrollMfaResponseSchema>;

/* --- Verify setup ---------------------------------------------------- */

export const VerifyMfaSetupBodySchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, "Six-digit TOTP code required"),
});
export type VerifyMfaSetupBody = z.infer<typeof VerifyMfaSetupBodySchema>;

export const VerifyMfaSetupResponseSchema = z.object({
  factorId: z.uuid(),
  kind: MfaKindSchema,
  verified: z.literal(true),
});
export type VerifyMfaSetupResponse = z.infer<typeof VerifyMfaSetupResponseSchema>;

/* --- List factors ---------------------------------------------------- */

export const MfaFactorListItemSchema = z.object({
  factorId: z.uuid(),
  kind: MfaKindSchema,
  verified: z.boolean(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});
export type MfaFactorListItem = z.infer<typeof MfaFactorListItemSchema>;

export const ListMfaFactorsResponseSchema = z.object({
  items: z.array(MfaFactorListItemSchema),
  total: z.number().int().min(0),
});
export type ListMfaFactorsResponse = z.infer<typeof ListMfaFactorsResponseSchema>;

/* --- Delete factor --------------------------------------------------- */

export const MfaFactorIdParamSchema = z.object({
  factorId: z.uuid(),
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

/* ===================================================================== */
/* === EMAIL_OTP factor (MVP-4) ======================================== */
/* ---------------------------------------------------------------------
 * Second factor kind delivered as a 6-digit one-time code emailed to the
 * user's VERIFIED address (sys_users.user_email). Unlike TOTP, the server
 * never returns the code in any response body — it is sent ONLY via the
 * mailer seam and stored hashed-at-rest. The contracts below carry NO
 * secret/code field on the issuance/response side by design.
 * ------------------------------------------------------------------- */

/**
 * Start EMAIL_OTP enrollment. Body is intentionally empty: the server reads
 * the destination from the authenticated user's verified email, generates a
 * CSPRNG code, emails it, and stores it hashed. The response confirms the
 * pending factor + the (masked) destination — never the code itself.
 */
export const EnrollEmailOtpBodySchema = z.strictObject({});
export type EnrollEmailOtpBody = z.infer<typeof EnrollEmailOtpBodySchema>;

export const EnrollEmailOtpResponseSchema = z.object({
  factorId: z.uuid(),
  kind: z.literal("EMAIL_OTP"),
  /** Partially-masked destination e.g. "a***@rtl-bank.org" — for UI confirmation. */
  emailHint: z.string().min(3),
  /** Seconds until the emailed code expires (client countdown). */
  expiresInSeconds: z.number().int().positive(),
  verified: z.literal(false),
});
export type EnrollEmailOtpResponse = z.infer<typeof EnrollEmailOtpResponseSchema>;

/**
 * Confirm EMAIL_OTP enrollment with the 6-digit code from the email. On
 * success the factor flips to verified=true.
 */
export const VerifyEmailOtpSetupBodySchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, "Six-digit email code required"),
});
export type VerifyEmailOtpSetupBody = z.infer<typeof VerifyEmailOtpSetupBodySchema>;

export const VerifyEmailOtpSetupResponseSchema = z.object({
  factorId: z.uuid(),
  kind: z.literal("EMAIL_OTP"),
  verified: z.literal(true),
});
export type VerifyEmailOtpSetupResponse = z.infer<typeof VerifyEmailOtpSetupResponseSchema>;

/**
 * Re-issue a fresh EMAIL_OTP code for an in-progress challenge (enroll or
 * login). Rate-limited server-side (issuance cooldown). The response NEVER
 * carries the code — only the new expiry for the client countdown.
 */
export const ResendEmailOtpBodySchema = z.object({
  /** For login step-up resends; omitted/ignored for enrollment resends. */
  challengeToken: z.string().min(16).optional(),
  factorId: z.uuid().optional(),
});
export type ResendEmailOtpBody = z.infer<typeof ResendEmailOtpBodySchema>;

export const ResendEmailOtpResponseSchema = z.object({
  expiresInSeconds: z.number().int().positive(),
});
export type ResendEmailOtpResponse = z.infer<typeof ResendEmailOtpResponseSchema>;
