/**
 * apps/api/src/modules/observability/routes.ts
 * 1 endpoint: GET /v1/observability/system-health (platform-only).
 *
 * Gate: `tenant:create` — the only PLATFORM_ADMIN-exclusive permission that
 * yields a clean 403 for a TENANT_ADMIN persona (every read-verb candidate is
 * also granted to TENANT_ADMIN). Read-only GET → NO app.verifyCsrf.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import { SystemHealthResponseSchema } from "@heuresys/shared";
import { observabilityService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const observabilityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/system-health", {
    preHandler: [requirePermission("tenant:create")],
    schema: { response: { 200: SystemHealthResponseSchema } },
  }, async (req) => observabilityService.getSystemHealth(actor(req)));
};
