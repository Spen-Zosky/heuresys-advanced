/**
 * apps/api/src/middleware/auth.ts
 * Decorates `req.user` from a valid JWT access cookie. Does NOT enforce
 * presence — public routes (login, healthz, readyz) still work. Per-route
 * enforcement is done by the RBAC middleware (requirePermission).
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { COOKIES } from "../config/constants.js";
import { UnauthorizedError } from "../errors/index.js";
import type { RoleCode } from "../config/constants.js";

export interface AuthUser {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
  jti?: string;
  /** Refresh-token family of THIS session (access JWT `fam` claim). Lets self-service
   *  session management flag the current device without the refresh cookie (which is
   *  path-scoped to /v1/auth and not sent to /api/* through the web proxy). */
  familyId?: string;
  /** Mandatory-MFA enrollment-only session (access JWT `enr` claim, MVP-4 par. 2.5 #4).
   *  Such sessions carry roles [] so every requirePermission() denies them; the only
   *  usable surface is the MFA self-service enrollment under /v1/auth/mfa. */
  enrollmentOnly?: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    tenantId?: string;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      tenant_id: string | null;
      roles: RoleCode[];
      jti?: string;
      fam?: string;
      enr?: boolean;
      iat?: number;
      exp?: number;
      iss?: string;
      aud?: string;
    };
    // Typed as nullable: our auth hook is non-enforcing, so req.user remains
    // undefined for public routes and for requests with no/invalid token.
    // RBAC middleware re-checks via `if (!req.user)`.
    user: AuthUser | null;
  }
}

/**
 * Positive allowlist for enrollment-only sessions (mandatory-MFA #4, review
 * fix S981): an `enr` session may ONLY reach the MFA self-service surface,
 * /login (the post-enroll re-login re-submits the password with the enr
 * cookie still set), /logout, and the health probes. Everything else gets a
 * 401 MFA_ENROLLMENT_ONLY — containment no longer rests on roles:[] alone,
 * and a gated user who deep-links into the SPA bounces back to /login via
 * the existing 401 handling instead of landing in a dead authenticated shell.
 */
const ENR_ALLOW_PREFIXES = [
  "/v1/auth/mfa/",
  "/v1/auth/login",
  "/v1/auth/logout",
  "/healthz",
  "/readyz",
];

const plugin: FastifyPluginAsync = async (app) => {
  // Try to decode the JWT from the access cookie on every request. Failure
  // is non-fatal here — req.user remains undefined and downstream RBAC will
  // reject if the route requires auth.
  app.addHook("onRequest", async (req: FastifyRequest) => {
    const token = req.cookies[COOKIES.ACCESS];
    if (!token) return;
    try {
      const payload = await app.jwt.verify<{
        sub: string;
        tenant_id: string | null;
        roles: RoleCode[];
        jti?: string;
        fam?: string;
        enr?: boolean;
      }>(token);
      req.user = {
        userId: payload.sub,
        tenantId: payload.tenant_id,
        roles: payload.roles ?? [],
        jti: payload.jti,
        familyId: payload.fam,
        enrollmentOnly: payload.enr === true,
      };
    } catch (err) {
      // Token invalid / expired — leave req.user undefined; RBAC handles 401.
      req.log.debug({ err }, "JWT verify failed");
    }
    // OUTSIDE the try/catch (the catch above swallows verify failures and must
    // never swallow this): enforce the enrollment-only allowlist.
    if (req.user?.enrollmentOnly && !ENR_ALLOW_PREFIXES.some((p) => req.url.startsWith(p))) {
      throw new UnauthorizedError(
        "MFA enrollment required before this session can be used",
        "MFA_ENROLLMENT_ONLY",
      );
    }
  });
};

export const authPlugin = fp(plugin, { name: "auth", dependencies: ["@fastify/jwt", "@fastify/cookie"] });
