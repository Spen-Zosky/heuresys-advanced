/**
 * apps/api/src/modules/observability/routes.ts
 * 1 endpoint: GET /v1/observability/system-health (platform-only).
 *
 * Gate: `observability:read` (000178, #61 G2 — PLATFORM_ADMIN-only audience;
 * historically proxied on `tenant:create` before the matrix had a dedicated
 * code). Read-only GET → NO app.verifyCsrf.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import { SystemHealthResponseSchema } from "@heuresys/shared";
import { observabilityService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const observabilityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/system-health", {
    preHandler: [requirePermission("observability:read")],
    schema: { response: { 200: SystemHealthResponseSchema } },
  }, async (req) => observabilityService.getSystemHealth(actor(req)));
};
