/**
 * apps/api/src/modules/dashboard/routes.ts
 * 1 endpoint: GET /v1/dashboard/widgets (role-gated).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import { DashboardWidgetsResponseSchema } from "@heuresys/shared";
import { dashboardService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/widgets", {
    preHandler: [requirePermission("dashboard:view")],
    schema: { response: { 200: DashboardWidgetsResponseSchema } },
  }, async (req) => dashboardService.getWidgets(actor(req)));
};
