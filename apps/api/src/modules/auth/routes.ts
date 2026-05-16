/**
 * apps/api/src/modules/auth/routes.ts
 * Wires the 7 /v1/auth/* endpoints. Schema validation + per-route rate
 * limits + CSRF opt-in + RBAC enforcement (admin-revoke).
 *
 * Per AUTH_SECURITY_PLAN §4, §5, §8 + API_IMPLEMENTATION_PLAN §6.1.
 *
 * Note on HTTP status: login + refresh return 200 with body. AUTH §13 lists
 * 204, but HTTP requires 204 to have an empty body — Fastify strips the
 * body when status is 204. 200 with body is the correct + safe choice.
 * Logout and password-reset endpoints return 204 (no body).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  LoginBodySchema,
  LoginResponseSchema,
  MeResponseSchema,
  PasswordResetRequestBodySchema,
  PasswordResetCompleteBodySchema,
  RevokeUserParamsSchema,
  EmptyResponseSchema,
} from "./schema.js";
import { createAuthService, type AuthService } from "./service.js";
import { ConsoleMailer, type IMailer } from "./mailer.js";
import { setAuthCookies, clearAuthCookies } from "./tokens.js";
import { COOKIES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

export interface AuthRoutesOptions {
  /** Override the mailer (tests inject InMemoryMailer). */
  mailer?: IMailer;
  /** Override the constructed service (advanced testing only). */
  service?: AuthService;
}

function getUa(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, 1024) : null;
}

export const authRoutes: FastifyPluginAsyncZod<AuthRoutesOptions> = async (app, opts) => {
  const mailer = opts.mailer ?? new ConsoleMailer(app.log);
  const service =
    opts.service ??
    createAuthService({
      jwtSign: (payload) =>
        // @fastify/jwt v8: sign returns Promise<string> with async signature.
        app.jwt.sign(payload),
      mailer,
      log: app.log,
    });

  const secureCookies = env.NODE_ENV === "production";

  /* --- POST /login -------------------------------------------------- */
  app.post(
    "/login",
    {
      schema: {
        body: LoginBodySchema,
        response: { 200: LoginResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const result = await service.login({
        email: req.body.email,
        password: req.body.password,
        ip: req.ip ?? null,
        userAgent: getUa(req),
      });
      setAuthCookies(reply, {
        accessJwt: result.accessJwt,
        refreshToken: result.refreshToken,
        csrfToken: result.csrfToken,
        secure: secureCookies,
      });
      return { user: result.user, roles: result.roles, csrfToken: result.csrfToken };
    },
  );

  /* --- POST /refresh ------------------------------------------------ */
  app.post(
    "/refresh",
    {
      preHandler: [app.verifyCsrf],
      schema: {
        response: { 200: LoginResponseSchema },
      },
      config: { rateLimit: { max: 60, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const refreshCookie = req.cookies[COOKIES.REFRESH];
      if (!refreshCookie) {
        throw new UnauthorizedError("Refresh token missing", "REFRESH_MISSING");
      }
      const result = await service.refresh({
        refreshToken: refreshCookie,
        ip: req.ip ?? null,
        userAgent: getUa(req),
      });
      setAuthCookies(reply, {
        accessJwt: result.accessJwt,
        refreshToken: result.refreshToken,
        csrfToken: result.csrfToken,
        secure: secureCookies,
      });
      return { user: result.user, roles: result.roles, csrfToken: result.csrfToken };
    },
  );

  /* --- POST /logout ------------------------------------------------- */
  app.post(
    "/logout",
    {
      preHandler: [app.verifyCsrf],
      schema: { response: { 204: EmptyResponseSchema } },
    },
    async (req, reply) => {
      await service.logout({
        refreshToken: req.cookies[COOKIES.REFRESH],
        userId: req.user?.userId,
        tenantId: req.user?.tenantId ?? undefined,
        ip: req.ip ?? null,
        userAgent: getUa(req),
      });
      clearAuthCookies(reply);
      reply.code(204).send();
    },
  );

  /* --- GET /me ------------------------------------------------------ */
  app.get(
    "/me",
    {
      schema: { response: { 200: MeResponseSchema } },
      config: { rateLimit: { max: 600, timeWindow: 60 * 1000 } },
    },
    async (req) => {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      return service.getMe(req.user.userId);
    },
  );

  /* --- POST /password-reset/request -------------------------------- */
  app.post(
    "/password-reset/request",
    {
      schema: {
        body: PasswordResetRequestBodySchema,
        response: { 204: EmptyResponseSchema },
      },
      config: { rateLimit: { max: 5, timeWindow: 60 * 60 * 1000 } },
    },
    async (req, reply) => {
      await service.requestPasswordReset({
        email: req.body.email,
        ip: req.ip ?? null,
      });
      reply.code(204).send();
    },
  );

  /* --- POST /password-reset/complete ------------------------------- */
  app.post(
    "/password-reset/complete",
    {
      schema: {
        body: PasswordResetCompleteBodySchema,
        response: { 204: EmptyResponseSchema },
      },
      config: { rateLimit: { max: 10, timeWindow: 60 * 60 * 1000 } },
    },
    async (req, reply) => {
      await service.completePasswordReset({
        token: req.body.token,
        newPassword: req.body.newPassword,
        ip: req.ip ?? null,
      });
      reply.code(204).send();
    },
  );

  /* --- POST /admin/revoke-user/:userId ----------------------------- */
  // TENANT_ADMIN scope filter (own-tenant target) is enforced post-MVP;
  // for MVP-1 the permission grant gates access (PLATFORM_ADMIN, TENANT_ADMIN
  // per matrix). Cross-tenant target check is tracked as a follow-up.
  app.post(
    "/admin/revoke-user/:userId",
    {
      preHandler: [app.verifyCsrf, requirePermission("auth:revoke_user")],
      schema: {
        params: RevokeUserParamsSchema,
        response: { 204: EmptyResponseSchema },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      await service.adminRevokeUser({
        actorUserId: req.user.userId,
        actorTenantId: req.user.tenantId,
        actorRoles: req.user.roles,
        targetUserId: req.params.userId,
      });
      reply.code(204).send();
    },
  );
};
