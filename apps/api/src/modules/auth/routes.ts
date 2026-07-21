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
  LoginResultResponseSchema,
  MeResponseSchema,
  PasswordResetRequestBodySchema,
  PasswordResetCompleteBodySchema,
  RevokeUserParamsSchema,
  EmptyResponseSchema,
  RolePermissionsResponseSchema,
  ListActiveSessionsParamsSchema,
  ListActiveSessionsResponseSchema,
  CurrentSessionResponseSchema,
} from "./schema.js";
import { createAuthService, type AuthService } from "./service.js";
import { ConsoleMailer, type IMailer } from "./mailer.js";
import { setAuthCookies, clearAuthCookies, setEnrollmentCookies } from "./tokens.js";
import { COOKIES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

export interface AuthRoutesOptions {
  /** Override the mailer (tests inject InMemoryMailer). */
  mailer?: IMailer;
  /** Override the constructed service (advanced testing only). */
  service?: AuthService;
  /**
   * MFA service used to gate login (mailer-bound, built in buildApp). When
   * provided, it is threaded into the auth service so login-time EMAIL_OTP
   * sends use the same mailer as the rest of auth.
   */
  mfaService?: import("./mfa-service.js").MfaService;
  /**
   * Mandatory-MFA login enforcement (S989). Threaded into the auth service;
   * defaults to env.MFA_ENFORCEMENT_ENABLED inside the service when omitted.
   */
  mfaEnforcement?: boolean;
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
      ...(opts.mfaService ? { mfaService: opts.mfaService } : {}),
      ...(opts.mfaEnforcement !== undefined ? { mfaEnforcement: opts.mfaEnforcement } : {}),
    });

  // Secure cookies require HTTPS. COOKIE_SECURE overrides the NODE_ENV-based default
  // so a production deploy served over plain HTTP (no TLS) can set it false and keep
  // login working (the browser drops Secure cookies on HTTP). See config/env.ts.
  const secureCookies = env.COOKIE_SECURE ?? env.NODE_ENV === "production";

  /* --- POST /login -------------------------------------------------- */
  app.post(
    "/login",
    {
      schema: {
        body: LoginBodySchema,
        response: { 200: LoginResultResponseSchema },
      },
      // Login brute-force guard: prod-secure default 10/5min. Raise via
      // AUTH_LOGIN_RATELIMIT_MAX for E2E suites, where auth.setup (5 personas) +
      // login-mfa (direct logins, no storageState) would otherwise trip the 10 cap.
      config: { rateLimit: { max: Number(process.env.AUTH_LOGIN_RATELIMIT_MAX) || 10, timeWindow: 5 * 60 * 1000 } },
    },
    async (req, reply) => {
      const result = await service.login({
        email: req.body.email,
        password: req.body.password,
        challengeToken: req.body.challengeToken,
        mfaCode: req.body.mfaCode,
        ip: req.ip ?? null,
        userAgent: getUa(req),
      });
      if (result.status === "mfa_required") {
        // First step: no cookies issued; client must complete the challenge.
        return {
          status: "mfa_required" as const,
          challengeToken: result.challengeToken,
          availableKinds: result.availableKinds,
        };
      }
      if (result.status === "mfa_enrollment_required") {
        // Mandatory-MFA gate (#4): RESTRICTED enrollment-only session — access
        // JWT with claim `enr` + roles [] and the CSRF pair; NO refresh token.
        setEnrollmentCookies(reply, {
          accessJwt: result.accessJwt,
          csrfToken: result.csrfToken,
          secure: secureCookies,
        });
        return {
          status: "mfa_enrollment_required" as const,
          csrfToken: result.csrfToken,
          allowedKinds: result.allowedKinds,
        };
      }
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
        csrfToken: result.csrfToken,
      };
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
      return {
        status: "success" as const,
        user: result.user,
        roles: result.roles,
        csrfToken: result.csrfToken,
      };
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
      reply.code(204).send({});
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
      reply.code(204).send({});
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
      reply.code(204).send({});
    },
  );

  /* --- POST /admin/revoke-user/:userId ----------------------------- */
  // Permission grant gates access (PLATFORM_ADMIN, TENANT_ADMIN per matrix);
  // the per-target tenant scope (TENANT_ADMIN → own-tenant only) is enforced
  // in service.adminRevokeUser — see AUTH §6.
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
      reply.code(204).send({});
    },
  );

  /* --- GET /admin/users/:userId/sessions (MVP-3 Tappa E) ------------- */
  // Lists active refresh-token families (≈ sessions) for a target user.
  // Strict subset of the admin-revoke capability, so it reuses the
  // 'auth:revoke_user' permission. TENANT_ADMIN scoped to own tenant in the
  // service layer (see service.adminListSessions).
  app.get(
    "/admin/users/:userId/sessions",
    {
      // G2 (#61): reading another user's sessions is not revoking them. Same
      // audience as before (auth:revoke_user), now stated in the matrix.
      preHandler: [requirePermission("auth:sessions_read")],
      schema: {
        params: ListActiveSessionsParamsSchema,
        response: { 200: ListActiveSessionsResponseSchema },
      },
    },
    async (req) => {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }
      return service.adminListSessions({
        actorUserId: req.user.userId,
        actorTenantId: req.user.tenantId,
        actorRoles: req.user.roles,
        targetUserId: req.params.userId,
      });
    },
  );

  /* --- GET /role-permissions (read-only matrix for /admin/roles UI) --- */
  // Returns the full role × permission seed matrix. Pure read of the seed
  // tables; no mutations exposed in MVP-2a — full role CRUD lands in MVP-3.
  // G2 (#61): was gated by auth:revoke_user — a proxy, since reading the matrix
  // is not revoking a user. Same audience, now named for what it is.
  app.get(
    "/role-permissions",
    {
      preHandler: [requirePermission("role_matrix:read")],
      schema: {
        response: {
          200: RolePermissionsResponseSchema,
        },
      },
    },
    async () => {
      return service.listRolePermissions();
    },
  );

  /* --- GET /sessions/current — the caller's current session family -------------- */
  // Read from the access JWT `fam` claim. (Historically the refresh cookie was
  // path-scoped to /v1/auth and unreadable behind the /api proxy, which forced
  // the claim-based design; post-D-26 the refresh cookie is on path "/" too,
  // but the claim remains the right source — the refresh token is opaque and
  // HttpOnly, and no endpoint should parse it outside the rotation flow.)
  // The ESS sessions page uses it to flag "this device" + to pass
  // currentFamilyId to revoke-others. Authenticated-only (reflects self).
  app.get(
    "/sessions/current",
    { schema: { response: { 200: CurrentSessionResponseSchema } } },
    async (req) => {
      if (!req.user) throw new UnauthorizedError("Authentication required");
      return { familyId: req.user.familyId ?? null };
    },
  );
};
