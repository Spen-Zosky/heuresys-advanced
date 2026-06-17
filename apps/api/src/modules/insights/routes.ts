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
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  FlightRiskListResponseSchema,
  FlightRiskScoreSchema,
  FlightRiskUserIdParamSchema,
  InsightsRecomputeResponseSchema,
  SuccessionReadinessListResponseSchema,
  SkillGapListResponseSchema,
} from "@heuresys/shared";
import { insightsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

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

  /* --- P2 slice B: succession-readiness --- */
  app.get(
    "/succession-readiness",
    { preHandler: [requirePermission("insights:view")], schema: { response: { 200: SuccessionReadinessListResponseSchema } } },
    async (req) => insightsService.successionReadiness(actor(req)),
  );
  app.post(
    "/succession-readiness/recompute",
    { preHandler: [app.verifyCsrf, requirePermission("insights:admin")], schema: { response: { 200: InsightsRecomputeResponseSchema } } },
    async (req) => insightsService.recomputeReadiness(actor(req)),
  );

  /* --- P2 slice C: skill-gap --- */
  app.get(
    "/skill-gap",
    { preHandler: [requirePermission("insights:view")], schema: { response: { 200: SkillGapListResponseSchema } } },
    async (req) => insightsService.skillGap(actor(req)),
  );
  app.post(
    "/skill-gap/recompute",
    { preHandler: [app.verifyCsrf, requirePermission("insights:admin")], schema: { response: { 200: InsightsRecomputeResponseSchema } } },
    async (req) => insightsService.recomputeSkillGap(actor(req)),
  );
};
