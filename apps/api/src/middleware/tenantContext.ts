/**
 * apps/api/src/middleware/tenantContext.ts
 * Sets req.tenantId from req.user.tenantId. PLATFORM_ADMIN may operate
 * cross-tenant — req.tenantId remains undefined for them on cross-tenant
 * endpoints; repository layer never substitutes a default.
 *
 * Per AUTH_SECURITY_PLAN §7.
 */

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { ForbiddenError } from "../errors/index.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req) => {
    if (!req.user) return; // public route — auth handled per-route
    if (req.user.tenantId) {
      req.tenantId = req.user.tenantId;
      return;
    }
    // No tenant on the JWT. Allowed only for PLATFORM_ADMIN; otherwise 403.
    if (!req.user.roles.includes("PLATFORM_ADMIN")) {
      throw new ForbiddenError("Tenant context required");
    }
  });
};

export const tenantContextPlugin = fp(plugin, { name: "tenantContext", dependencies: ["auth"] });
