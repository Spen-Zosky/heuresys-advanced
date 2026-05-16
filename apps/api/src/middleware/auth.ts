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
      }>(token);
      req.user = {
        userId: payload.sub,
        tenantId: payload.tenant_id,
        roles: payload.roles ?? [],
        jti: payload.jti,
      };
    } catch (err) {
      // Token invalid / expired — leave req.user undefined; RBAC handles 401.
      req.log.debug({ err }, "JWT verify failed");
    }
  });
};

export const authPlugin = fp(plugin, { name: "auth", dependencies: ["@fastify/jwt", "@fastify/cookie"] });
