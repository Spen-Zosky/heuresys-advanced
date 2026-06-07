/**
 * apps/api/src/modules/insights/routes.ts
 * /v1/insights/* — cap③ data-mining flight-risk surface.
 *   GET  /flight-risk               — scored list (scope-filtered, highest risk first)
 *   GET  /users/:userId/flight-risk — single subject (scope-checked)
 *   POST /recompute                 — recompute scores in-platform (insights:admin, CSRF)
 *
 * All reads are insights:view (admin/manager-only, D-6 — flight-risk is sensitive,
 * NO ESS self-view). The recompute write is insights:admin + CSRF (mirrors matching:reindex).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  FlightRiskListResponseSchema,
  FlightRiskScoreSchema,
  FlightRiskUserIdParamSchema,
  InsightsRecomputeResponseSchema,
} from "@heuresys/shared";
import { insightsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const insightsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/flight-risk",
    {
      preHandler: [requirePermission("insights:view")],
      schema: { response: { 200: FlightRiskListResponseSchema } },
    },
    async (req) => insightsService.flightRisk(actor(req)),
  );

  app.get(
    "/users/:userId/flight-risk",
    {
      preHandler: [requirePermission("insights:view")],
      schema: { params: FlightRiskUserIdParamSchema, response: { 200: FlightRiskScoreSchema } },
    },
    async (req) => insightsService.userFlightRisk(actor(req), req.params.userId),
  );

  app.post(
    "/recompute",
    {
      preHandler: [app.verifyCsrf, requirePermission("insights:admin")],
      schema: { response: { 200: InsightsRecomputeResponseSchema } },
    },
    async (req) => insightsService.recompute(actor(req)),
  );
};
