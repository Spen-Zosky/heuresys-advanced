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
import { LoginResponseSchema } from "./auth.js";

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

/* --- TOFU v2: out-of-band enroll confirmation ------------------------- */
/**
 * Returned by verify-setup (TOTP/SMS) and webauthn registration verify when
 * the enroll-confirm mode is ON and this is the user's FIRST factor: the factor
 * is NOT yet verified — a confirmation code was emailed out-of-band and must be
 * submitted to POST /v1/auth/mfa/enroll-confirm to activate it.
 */
export const EnrollConfirmRequiredSchema = z.object({
  factorId: z.uuid(),
  kind: MfaKindSchema,
  verified: z.literal(false),
  confirmRequired: z.literal(true),
  /** Masked email destination of the confirmation code. */
  emailHint: z.string().min(3),
  expiresInSeconds: z.number().int().positive(),
});
export type EnrollConfirmRequired = z.infer<typeof EnrollConfirmRequiredSchema>;

export const ConfirmEnrollBodySchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, "Six-digit confirmation code required"),
});
export type ConfirmEnrollBody = z.infer<typeof ConfirmEnrollBodySchema>;

export const ConfirmEnrollResponseSchema = z.object({
  factorId: z.uuid(),
  kind: MfaKindSchema,
  verified: z.literal(true),
});
export type ConfirmEnrollResponse = z.infer<typeof ConfirmEnrollResponseSchema>;

export const ResendEnrollConfirmBodySchema = z.object({
  factorId: z.uuid(),
});
export type ResendEnrollConfirmBody = z.infer<typeof ResendEnrollConfirmBodySchema>;

export const ResendEnrollConfirmResponseSchema = z.object({
  emailHint: z.string().min(3),
  expiresInSeconds: z.number().int().positive(),
});
export type ResendEnrollConfirmResponse = z.infer<typeof ResendEnrollConfirmResponseSchema>;

export const VerifyMfaSetupResponseSchema = z.union([
  z.object({
    factorId: z.uuid(),
    kind: MfaKindSchema,
    verified: z.literal(true),
  }),
  EnrollConfirmRequiredSchema,
]);
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

/* ===================================================================== */
/* === SMS_OTP factor (MVP-4 §2.5, code-only slice) ==================== */
/* ---------------------------------------------------------------------
 * Second factor delivered as a 6-digit one-time code texted to a phone the
 * user provides at enrollment (stored in the factor metadata, masked in every
 * response). Reuses the EMAIL_OTP challenge machinery (hashed-at-rest codes,
 * TTL, lockout, single-use). Enrollment is gated on a production-capable SMS
 * provider (404 SMS_NOT_CONFIGURED otherwise) — the code-only slice ships the
 * full flow behind that gate without a real provider.
 * ------------------------------------------------------------------- */

/** E.164: leading +, 7-15 digits total, no separators. */
export const PhoneE164Schema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone number must be E.164 (+391234567890)");
export type PhoneE164 = z.infer<typeof PhoneE164Schema>;

export const EnrollSmsOtpBodySchema = z.strictObject({
  phoneNumber: PhoneE164Schema,
});
export type EnrollSmsOtpBody = z.infer<typeof EnrollSmsOtpBodySchema>;

export const EnrollSmsOtpResponseSchema = z.object({
  factorId: z.uuid(),
  kind: z.literal("SMS_OTP"),
  /** Partially-masked destination e.g. "+39•••567" — for UI confirmation. */
  phoneHint: z.string().min(3),
  /** Seconds until the texted code expires (client countdown). */
  expiresInSeconds: z.number().int().positive(),
  verified: z.literal(false),
});
export type EnrollSmsOtpResponse = z.infer<typeof EnrollSmsOtpResponseSchema>;

export const VerifySmsOtpSetupBodySchema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, "Six-digit SMS code required"),
});
export type VerifySmsOtpSetupBody = z.infer<typeof VerifySmsOtpSetupBodySchema>;

export const VerifySmsOtpSetupResponseSchema = z.union([
  z.object({
    factorId: z.uuid(),
    kind: z.literal("SMS_OTP"),
    verified: z.literal(true),
  }),
  EnrollConfirmRequiredSchema,
]);
export type VerifySmsOtpSetupResponse = z.infer<typeof VerifySmsOtpSetupResponseSchema>;

/** Resend contracts mirror EMAIL_OTP (challengeToken for login, factorId for enroll). */
export const ResendSmsOtpBodySchema = ResendEmailOtpBodySchema;
export type ResendSmsOtpBody = z.infer<typeof ResendSmsOtpBodySchema>;
export const ResendSmsOtpResponseSchema = ResendEmailOtpResponseSchema;
export type ResendSmsOtpResponse = z.infer<typeof ResendSmsOtpResponseSchema>;

/* --- recovery codes (MVP-4 §2.5) -------------------------------------- */

/** Regenerate response — the plaintext codes are returned ONCE (never re-fetchable). */
export const GenerateRecoveryCodesResponseSchema = z.object({
  codes: z.array(z.string()),
});
export type GenerateRecoveryCodesResponse = z.infer<typeof GenerateRecoveryCodesResponseSchema>;

export const RecoveryCodesCountResponseSchema = z.object({
  remaining: z.number().int().nonnegative(),
});
export type RecoveryCodesCountResponse = z.infer<typeof RecoveryCodesCountResponseSchema>;

/* ===================================================================== */
/* === WEBAUTHN / FIDO2 passkey factor ================================= */
/* ---------------------------------------------------------------------
 * Public-key (passkey / security-key) second factor. The @simplewebauthn
 * browser<->server JSON blobs (PublicKeyCredentialCreationOptionsJSON, the
 * attestation/assertion responses) are opaque and version-evolving, so we
 * carry them as passthrough `z.record(z.string(), z.unknown())` objects and
 * let @simplewebauthn/server validate their internal shape. Only OUR fields
 * (factorId, deviceLabel, the literal flags) are strictly typed.
 *
 * Two ceremonies:
 *   1. Registration (authenticated): options -> verify, mints a verified
 *      WEBAUTHN factor + a credential row.
 *   2. Authentication (login step-up, NO auth cookie — the challengeToken is
 *      the proof): options -> verify. Dormant until login-gating mints the
 *      challengeToken (separate "mandatory-MFA" item).
 * ------------------------------------------------------------------- */

/* --- Registration: options (start) ---------------------------------- */
/** Body is intentionally empty: the server reads the user from the session. */
export const WebauthnRegistrationOptionsResponseSchema = z.object({
  /** The newly-created (unverified) WEBAUTHN factor this ceremony will confirm. */
  factorId: z.uuid(),
  /** The PublicKeyCredentialCreationOptionsJSON blob (opaque passthrough). */
  options: z.record(z.string(), z.unknown()),
});
export type WebauthnRegistrationOptionsResponse = z.infer<
  typeof WebauthnRegistrationOptionsResponseSchema
>;

/* --- Registration: verify ------------------------------------------- */
export const WebauthnRegistrationVerifyBodySchema = z.object({
  factorId: z.uuid(),
  /** The RegistrationResponseJSON from navigator.credentials.create() (opaque). */
  response: z.record(z.string(), z.unknown()),
  /** Friendly label for the authenticator (defaults to "Passkey" server-side). */
  deviceLabel: z.string().max(120).optional(),
});
export type WebauthnRegistrationVerifyBody = z.infer<
  typeof WebauthnRegistrationVerifyBodySchema
>;

export const WebauthnRegistrationVerifyResponseSchema = z.union([
  z.object({
    factorId: z.uuid(),
    kind: z.literal("WEBAUTHN"),
    verified: z.literal(true),
    deviceLabel: z.string(),
  }),
  EnrollConfirmRequiredSchema,
]);
export type WebauthnRegistrationVerifyResponse = z.infer<
  typeof WebauthnRegistrationVerifyResponseSchema
>;

/* --- Authentication: options (login step-up) ------------------------ */
/** No auth cookie: the challengeToken (issued at login step 1) is the proof. */
export const WebauthnAuthenticationOptionsBodySchema = z.object({
  challengeToken: z.string().min(1),
});
export type WebauthnAuthenticationOptionsBody = z.infer<
  typeof WebauthnAuthenticationOptionsBodySchema
>;

export const WebauthnAuthenticationOptionsResponseSchema = z.object({
  /** The PublicKeyCredentialRequestOptionsJSON blob (opaque passthrough). */
  options: z.record(z.string(), z.unknown()),
});
export type WebauthnAuthenticationOptionsResponse = z.infer<
  typeof WebauthnAuthenticationOptionsResponseSchema
>;

/* --- Authentication: verify ----------------------------------------- */
export const WebauthnAuthenticationVerifyBodySchema = z.object({
  challengeToken: z.string().min(1),
  /** The AuthenticationResponseJSON from navigator.credentials.get() (opaque). */
  response: z.record(z.string(), z.unknown()),
});
export type WebauthnAuthenticationVerifyBody = z.infer<
  typeof WebauthnAuthenticationVerifyBodySchema
>;

/**
 * On a verified assertion the endpoint COMPLETES the login (mandatory-MFA #4):
 * it sets the auth cookies and returns the same success bundle as POST /login -
 * the challengeToken was the proof of the password step, the assertion is the
 * second factor, so there is nothing left to exchange.
 */
export const WebauthnAuthenticationVerifyResponseSchema = LoginResponseSchema;
export type WebauthnAuthenticationVerifyResponse = z.infer<
  typeof WebauthnAuthenticationVerifyResponseSchema
>;
