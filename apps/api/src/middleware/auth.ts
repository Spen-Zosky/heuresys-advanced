/**
 * apps/api/src/middleware/auth.ts
 * Decorates `req.user` from a valid JWT access cookie. Does NOT enforce
 * presence — public routes (login, healthz, readyz) still work. Per-route
 * enforcement is done by the RBAC middleware (requirePermission).
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { COOKIES } from "../config/constants.js";
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
      }>(token);
      req.user = {
        userId: payload.sub,
        tenantId: payload.tenant_id,
        roles: payload.roles ?? [],
        jti: payload.jti,
        familyId: payload.fam,
      };
    } catch (err) {
      // Token invalid / expired — leave req.user undefined; RBAC handles 401.
      req.log.debug({ err }, "JWT verify failed");
    }
  });
};

export const authPlugin = fp(plugin, { name: "auth", dependencies: ["@fastify/jwt", "@fastify/cookie"] });
