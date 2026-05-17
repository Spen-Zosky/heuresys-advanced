/**
 * apps/api/src/modules/auth/mfa-routes.ts
 *
 * Routes for MFA management (enroll, verify-setup, list, delete) plus the
 * login-challenge verify endpoint. Mounted under /v1/auth/mfa.
 *
 * Login-time gating (i.e. /v1/auth/login refusing to issue a session when
 * the user has verified MFA factors) is intentionally NOT wired here yet:
 * the response-shape change would force the existing frontend `/login`
 * to handle two response shapes, and the MFA enrollment UI itself is
 * gated by brand-identity v1 (the `/login` page-type is mandated by the
 * brand bundle, doc 12 L64-77). Once both UIs are designed, flip
 * AUTH_SECURITY_PLAN §3 "MFA bypass" mitigation by composing
 * mfaService.beginLoginChallenge into the auth service login() path.
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
} from "@heuresys/shared";
import { UnauthorizedError } from "../../errors/index.js";
import {
  type MfaService,
  sharedMfaService,
} from "./mfa-service.js";
import { pool } from "../../db/client.js";

export interface MfaRoutesOptions {
  /** Override for tests. */
  service?: MfaService;
}

export const mfaRoutes: FastifyPluginAsyncZod<MfaRoutesOptions> = async (app, opts) => {
  const service = opts.service ?? sharedMfaService;

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

  /* --- POST /verify-login (step-up auth) ---------------------------- */
  // Consumes a challenge token (issued by a future login-flow gating step)
  // and verifies the TOTP code. Today the challenge token is not yet
  // produced by /v1/auth/login; this endpoint is wired for the future flow
  // and is also useful for "elevated permission" re-prompts (e.g. before
  // an admin destructive operation).
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
};

/** Helper used by tests (and the future login gating composition) to mint
    a challenge token without going through /login. */
export { sharedMfaService } from "./mfa-service.js";
