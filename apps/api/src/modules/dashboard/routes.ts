/**
 * apps/api/src/modules/dashboard/routes.ts
 * 1 endpoint: GET /v1/dashboard/widgets (role-gated).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import { DashboardWidgetsResponseSchema } from "@heuresys/shared";
import { dashboardService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/widgets", {
    preHandler: [requirePermission("dashboard:view")],
    schema: { response: { 200: DashboardWidgetsResponseSchema } },
  }, async (req) => dashboardService.getWidgets(actor(req)));
};
