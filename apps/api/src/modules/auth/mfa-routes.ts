/**
 * apps/api/src/modules/auth/mfa-routes.ts
 *
 * Routes for MFA management (enroll, verify-setup, list, delete) plus the
 * login-challenge verify endpoint. Mounted under /v1/auth/mfa.
 *
 * Login-time gating IS wired (MVP-3 Tappa E + MVP-4 par.2.5 #4): /v1/auth/login
 * composes mfaService.beginLoginChallenge after password verification — a user
 * with a verified factor gets `mfa_required` + challengeToken; with the tenant
 * mandatory-MFA policy enabled, an in-scope user with NO factor gets
 * `mfa_enrollment_required` (restricted `enr` session). The WebAuthn
 * authentication ceremony below COMPLETES the login on a verified assertion
 * (sets cookies + returns the success bundle). This header previously said the
 * gating was "intentionally NOT wired" — that was stale (DEBT D-21, fixed S981).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  EnrollMfaBodySchema,
  EnrollMfaResponseSchema,
  VerifyMfaSetupBodySchema,
  VerifyMfaSetupResponseSchema,
  ListMfaFactorsResponseSchema,
  MfaFactorIdParamSchema,
  VerifyMfaLoginBodySchema,
  EmptyResponseSchema,
  EnrollEmailOtpBodySchema,
  EnrollEmailOtpResponseSchema,
  VerifyEmailOtpSetupBodySchema,
  VerifyEmailOtpSetupResponseSchema,
  ResendEmailOtpBodySchema,
  ResendEmailOtpResponseSchema,
  EnrollSmsOtpBodySchema,
  EnrollSmsOtpResponseSchema,
  VerifySmsOtpSetupBodySchema,
  VerifySmsOtpSetupResponseSchema,
  ResendSmsOtpBodySchema,
  ResendSmsOtpResponseSchema,
  ConfirmEnrollBodySchema,
  ConfirmEnrollResponseSchema,
  ResendEnrollConfirmBodySchema,
  ResendEnrollConfirmResponseSchema,
  GenerateRecoveryCodesResponseSchema,
  RecoveryCodesCountResponseSchema,
  WebauthnRegistrationOptionsResponseSchema,
  WebauthnRegistrationVerifyBodySchema,
  WebauthnRegistrationVerifyResponseSchema,
  WebauthnAuthenticationOptionsBodySchema,
  WebauthnAuthenticationOptionsResponseSchema,
  WebauthnAuthenticationVerifyBodySchema,
  WebauthnAuthenticationVerifyResponseSchema,
} from "@heuresys/shared";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { UnauthorizedError } from "../../errors/index.js";
import { userPermissionCodes } from "../../middleware/rbac.js";
import {
  type MfaService,
  sharedMfaService,
  buildMfaServiceWithMailer,
} from "./mfa-service.js";
import {
  type WebauthnService,
  sharedWebauthnService,
} from "./webauthn-service.js";
import { ConsoleMailer, type IMailer } from "./mailer.js";
import { createAuthService, type AuthService } from "./service.js";
import { setAuthCookies } from "./tokens.js";
import { env } from "../../config/env.js";
import { pool } from "../../db/client.js";

export interface MfaRoutesOptions {
  /** Override the whole service for tests. */
  service?: MfaService;
  /**
   * Mailer for EMAIL_OTP delivery. When provided (and no `service` override),
   * the route builds an MFA service bound to this mailer so EMAIL_OTP codes go
   * through the same seam as the rest of auth (InMemoryMailer in tests).
   */
  mailer?: IMailer;
  /** Override the WebAuthn service for tests (defaults to the shared singleton). */
  webauthnService?: WebauthnService;
  /** Override the auth service used to complete the WebAuthn login (tests). */
  authService?: AuthService;
}

export const mfaRoutes: FastifyPluginAsyncZod<MfaRoutesOptions> = async (app, opts) => {
  const service =
    opts.service ??
    (opts.mailer ? buildMfaServiceWithMailer(opts.mailer) : sharedMfaService);
  const webauthn = opts.webauthnService ?? sharedWebauthnService;
  // Used by the WebAuthn authentication ceremony to issue the session bundle
  // once the assertion verifies (mandatory-MFA #4). Stateless factory — safe
  // to build a second instance alongside the one in routes.ts.
  const authService =
    opts.authService ??
    createAuthService({
      jwtSign: (payload) => app.jwt.sign(payload),
      mailer: opts.mailer ?? new ConsoleMailer(app.log),
      log: app.log,
    });
  const secureCookies = env.COOKIE_SECURE ?? env.NODE_ENV === "production";

  /** Resolve the authenticated user's verified email from sys.sys_users. */
  async function getUserEmail(userId: string): Promise<string> {
    const u = await pool.query<{ user_email: string }>(
      `SELECT user_email FROM sys.sys_users WHERE user_id = $1`,
      [userId],
    );
    if (u.rows.length === 0) throw new UnauthorizedError("User not found");
    return u.rows[0]!.user_email;
  }

  /* --- POST /enroll -------------------------------------------------- */
  // Self-service: any authenticated user can enroll a TOTP factor.
  // No permission required beyond being authenticated.
  app.post(
    "/enroll",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: EnrollMfaBodySchema,
        response: { 201: EnrollMfaResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } },
    },
    async (req, reply) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      // Look up the email from sys.sys_users to inject into the otpauth label.
      const u = await pool.query<{ user_email: string }>(
        `SELECT user_email FROM sys.sys_users WHERE user_id = $1`,
        [req.user.userId],
      );
      if (u.rows.length === 0) throw new UnauthorizedError("User not found");
      const out = await service.enrollTotp({
        userId: req.user.userId,
        userEmail: u.rows[0]!.user_email,
      });
      reply.code(201).send(out);
    },
  );

  /* --- POST /verify-setup -------------------------------------------- */
  app.post(
    "/verify-setup",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: VerifyMfaSetupBodySchema,
        response: { 200: VerifyMfaSetupResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return service.verifyTotpSetup({
        userId: req.user.userId,
        factorId: req.body.factorId,
        code: req.body.code,
      });
    },
  );

  /* --- GET /factors -------------------------------------------------- */
  app.get(
    "/factors",
    {
      schema: { response: { 200: ListMfaFactorsResponseSchema } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      const items = await service.listFactors(req.user.userId);
      return { items, total: items.length };
    },
  );

  /* --- DELETE /factors/:factorId ------------------------------------ */
  app.delete(
    "/factors/:factorId",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        params: MfaFactorIdParamSchema,
        response: { 204: EmptyResponseSchema },
      },
    },
    async (req, reply) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      await service.deleteFactor({
        userId: req.user.userId,
        factorId: req.params.factorId,
      });
      reply.code(204).send({});
    },
  );

  /* === EMAIL_OTP enrollment (MVP-4) ================================= */

  /* --- POST /email-otp/enroll --------------------------------------- */
  // Self-service: any authenticated user. Server emails a CSPRNG 6-digit code
  // to their verified address; the response NEVER contains the code.
  app.post(
    "/email-otp/enroll",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: EnrollEmailOtpBodySchema,
        response: { 201: EnrollEmailOtpResponseSchema },
      },
      // Issuance rate-limit: cap email sends per user/hour (anti-spam, layered
      // on top of the per-factor 30s cooldown in the service).
      config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } },
    },
    async (req, reply) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      const userEmail = await getUserEmail(req.user.userId);
      const out = await service.enrollEmailOtp({ userId: req.user.userId, userEmail });
      reply.code(201).send(out);
    },
  );

  /* --- POST /email-otp/verify-setup --------------------------------- */
  app.post(
    "/email-otp/verify-setup",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: VerifyEmailOtpSetupBodySchema,
        response: { 200: VerifyEmailOtpSetupResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return service.verifyEmailOtpSetup({
        userId: req.user.userId,
        factorId: req.body.factorId,
        code: req.body.code,
      });
    },
  );

  /* --- POST /email-otp/resend --------------------------------------- */
  // Re-issue a fresh enrollment code. Cooldown enforced in the service (429
  // MFA_OTP_RESEND_COOLDOWN). For login-step resends use /email-otp/resend-login.
  app.post(
    "/email-otp/resend",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: ResendEmailOtpBodySchema,
        response: { 200: ResendEmailOtpResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      if (!req.body.factorId) {
        throw new UnauthorizedError("factorId required for enrollment resend", "MFA_OTP_INVALID");
      }
      const userEmail = await getUserEmail(req.user.userId);
      return service.resendEmailOtpEnroll({
        userId: req.user.userId,
        userEmail,
        factorId: req.body.factorId,
      });
    },
  );

  /* --- POST /email-otp/resend-login --------------------------------- */
  // Re-issue the EMAIL_OTP login code tied to a step-2 challenge token. No auth
  // cookie required (mirrors /verify-login) — the challenge token is the proof.
  app.post(
    "/email-otp/resend-login",
    {
      schema: {
        body: ResendEmailOtpBodySchema,
        response: { 200: ResendEmailOtpResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 5 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.body.challengeToken) {
        throw new UnauthorizedError("challengeToken required for login resend", "MFA_OTP_INVALID");
      }
      return service.resendEmailOtpLogin({ challengeToken: req.body.challengeToken });
    },
  );

  /* === TOFU v2: out-of-band enroll confirmation (MVP-4 §2.5) ========= */
  /* When the enroll-confirm mode is ON, the FIRST self-owned factor
   * (TOTP/WEBAUTHN/SMS_OTP) stays unverified after its possession proof and an
   * email code must be submitted here. Reachable from the restricted `enr`
   * session (prefix allowlist /v1/auth/mfa/). */

  /* --- POST /enroll-confirm ------------------------------------------ */
  app.post(
    "/enroll-confirm",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: ConfirmEnrollBodySchema,
        response: { 200: ConfirmEnrollResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return service.confirmEnroll({
        userId: req.user.userId,
        factorId: req.body.factorId,
        code: req.body.code,
      });
    },
  );

  /* --- POST /enroll-confirm/resend ----------------------------------- */
  app.post(
    "/enroll-confirm/resend",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: ResendEnrollConfirmBodySchema,
        response: { 200: ResendEnrollConfirmResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return service.beginEnrollConfirm({
        userId: req.user.userId,
        factorId: req.body.factorId,
      });
    },
  );

  /* === SMS_OTP enrollment (MVP-4 §2.5, code-only slice) ============= */
  /* Mirrors the EMAIL_OTP routes 1:1. Enrollment is gated server-side on a
   * production-capable SMS provider (404 SMS_NOT_CONFIGURED otherwise). */

  /* --- POST /sms-otp/enroll ------------------------------------------ */
  app.post(
    "/sms-otp/enroll",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: EnrollSmsOtpBodySchema,
        response: { 201: EnrollSmsOtpResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } },
    },
    async (req, reply) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      const out = await service.enrollSmsOtp({
        userId: req.user.userId,
        phoneNumber: req.body.phoneNumber,
      });
      reply.code(201).send(out);
    },
  );

  /* --- POST /sms-otp/verify-setup ------------------------------------ */
  app.post(
    "/sms-otp/verify-setup",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: VerifySmsOtpSetupBodySchema,
        response: { 200: VerifySmsOtpSetupResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return service.verifySmsOtpSetup({
        userId: req.user.userId,
        factorId: req.body.factorId,
        code: req.body.code,
      });
    },
  );

  /* --- POST /sms-otp/resend ------------------------------------------ */
  app.post(
    "/sms-otp/resend",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: ResendSmsOtpBodySchema,
        response: { 200: ResendSmsOtpResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      if (!req.body.factorId) {
        throw new UnauthorizedError("factorId required for enrollment resend", "MFA_OTP_INVALID");
      }
      return service.resendSmsOtpEnroll({
        userId: req.user.userId,
        factorId: req.body.factorId,
      });
    },
  );

  /* --- POST /sms-otp/resend-login ------------------------------------ */
  // No auth cookie required (mirrors /email-otp/resend-login) — the challenge
  // token is the proof.
  app.post(
    "/sms-otp/resend-login",
    {
      schema: {
        body: ResendSmsOtpBodySchema,
        response: { 200: ResendSmsOtpResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 5 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.body.challengeToken) {
        throw new UnauthorizedError("challengeToken required for login resend", "MFA_OTP_INVALID");
      }
      return service.resendSmsOtpLogin({ challengeToken: req.body.challengeToken });
    },
  );

  /* --- POST /verify-login (step-up auth) ---------------------------- */
  // Consumes a challengeToken (minted by /v1/auth/login at the mfa_required
  // step, MVP-3 Tappa E) and verifies the code. The /login second step is the
  // primary consumer; this standalone endpoint remains useful for "elevated
  // permission" re-prompts (e.g. before an admin destructive operation).
  app.post(
    "/verify-login",
    {
      schema: {
        body: VerifyMfaLoginBodySchema,
        response: { 200: EmptyResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 5 * 60 * 1000 } },
    },
    async (req) => {
      await service.verifyLoginChallenge({
        challengeToken: req.body.challengeToken,
        code: req.body.code,
      });
      return {};
    },
  );

  /* === recovery codes (MVP-4 §2.5) ================================= */

  /* --- POST /recovery-codes — (re)generate the user's backup codes --- */
  // Self-service; returns the plaintext set ONCE (regenerating invalidates the old set).
  app.post(
    "/recovery-codes",
    {
      preHandler: [app.verifyCsrf],
      schema: { response: { 200: GenerateRecoveryCodesResponseSchema } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return service.generateRecoveryCodes(req.user.userId);
    },
  );

  /* --- GET /recovery-codes — how many unused codes remain --- */
  app.get(
    "/recovery-codes",
    { schema: { response: { 200: RecoveryCodesCountResponseSchema } } },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return service.countRecoveryCodes(req.user.userId);
    },
  );

  /* === WEBAUTHN / FIDO2 passkey factor ============================== */
  // Two ceremonies. Registration (authenticated + CSRF) mints a verified
  // WEBAUTHN factor + credential. Authentication (login step-up — NO auth
  // cookie, the challengeToken from /v1/auth/login is the proof) is LIVE
  // (mandatory-MFA #4): a verified assertion COMPLETES the login below via
  // authService.completeMfaLogin + setAuthCookies. SECURITY: passkeys need a
  // secure context — unusable on the current plain-HTTP PROD origin until TLS
  // lands (see env WEBAUTHN_*).

  /* --- POST /webauthn/registration/options -------------------------- */
  // Self-service: any authenticated user. Returns the new (unverified) factorId
  // + the PublicKeyCredentialCreationOptionsJSON for navigator.credentials.create().
  app.post(
    "/webauthn/registration/options",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        response: { 200: WebauthnRegistrationOptionsResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      const userEmail = await getUserEmail(req.user.userId);
      const out = await webauthn.startRegistration({ userId: req.user.userId, userEmail });
      // options is the opaque PublicKeyCredentialCreationOptionsJSON blob — serialised
      // verbatim into the passthrough z.record response.
      return { factorId: out.factorId, options: out.options as unknown as Record<string, unknown> };
    },
  );

  /* --- POST /webauthn/registration/verify --------------------------- */
  app.post(
    "/webauthn/registration/verify",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        body: WebauthnRegistrationVerifyBodySchema,
        response: { 200: WebauthnRegistrationVerifyResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: 60 * 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return webauthn.verifyRegistration({
        userId: req.user.userId,
        factorId: req.body.factorId,
        // The opaque passthrough blob is the @simplewebauthn RegistrationResponseJSON.
        response: req.body.response as unknown as RegistrationResponseJSON,
        deviceLabel: req.body.deviceLabel ?? "Passkey",
      });
    },
  );

  /* --- POST /webauthn/authentication/options ------------------------ */
  // Login step-up: NO auth cookie (the challengeToken is the proof; mirrors
  // /email-otp/resend-login — no verifyCsrf). Rate-limited.
  app.post(
    "/webauthn/authentication/options",
    {
      schema: {
        body: WebauthnAuthenticationOptionsBodySchema,
        response: { 200: WebauthnAuthenticationOptionsResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 5 * 60 * 1000 } },
    },
    async (req) => {
      const out = await webauthn.startAuthentication({
        challengeToken: req.body.challengeToken,
      });
      // options is the opaque PublicKeyCredentialRequestOptionsJSON blob.
      return { options: out.options as unknown as Record<string, unknown> };
    },
  );

  /* --- POST /webauthn/authentication/verify ------------------------- */
  app.post(
    "/webauthn/authentication/verify",
    {
      schema: {
        body: WebauthnAuthenticationVerifyBodySchema,
        response: { 200: WebauthnAuthenticationVerifyResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const { userId } = await webauthn.verifyAuthentication({
        challengeToken: req.body.challengeToken,
        // The opaque passthrough blob is the @simplewebauthn AuthenticationResponseJSON.
        response: req.body.response as unknown as AuthenticationResponseJSON,
      });
      // Mandatory-MFA #4: a verified assertion COMPLETES the login. The consumed
      // challengeToken was the proof of the password step; issue the full bundle.
      const ua = req.headers["user-agent"];
      const result = await authService.completeMfaLogin({
        userId,
        ip: req.ip ?? null,
        userAgent: typeof ua === "string" ? ua.slice(0, 1024) : null,
      });
      setAuthCookies(reply, {
        accessJwt: result.accessJwt,
        refreshToken: result.refreshToken,
        csrfToken: result.csrfToken,
        secure: secureCookies,
      });
      return {
        status: "success" as const,
        user: result.user,
        roles: result.roles,
        permissions: userPermissionCodes({ roles: result.roles }),
        csrfToken: result.csrfToken,
      };
    },
  );
};

/** Helper used by tests (and the future login gating composition) to mint
    a challenge token without going through /login. */
export { sharedMfaService } from "./mfa-service.js";
