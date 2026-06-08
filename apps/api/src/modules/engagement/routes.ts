/**
 * apps/api/src/modules/engagement/routes.ts
 * /v1/engagement/* — normalized engagement cluster read-model (B-10b m2b). READ-ONLY.
 * All routes: requirePermission("surveys:read") (reuses the m2 survey permission). No writes → no CSRF.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  EngagementSurveyListResponseSchema,
  EngagementSurveyResultsResponseSchema,
  EngagementPulseResponseSchema,
  EngagementSurveyIdParamSchema,
} from "@heuresys/shared";
import { engagementService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const engagementRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/surveys", {
    preHandler: [requirePermission("surveys:read")],
    schema: { response: { 200: EngagementSurveyListResponseSchema } },
  }, async (req) => engagementService.listSurveys(actor(req)));

  app.get("/surveys/:surveyId/results", {
    preHandler: [requirePermission("surveys:read")],
    schema: { params: EngagementSurveyIdParamSchema, response: { 200: EngagementSurveyResultsResponseSchema } },
  }, async (req) => engagementService.surveyResults(actor(req), req.params.surveyId));

  app.get("/pulse", {
    preHandler: [requirePermission("surveys:read")],
    schema: { response: { 200: EngagementPulseResponseSchema } },
  }, async (req) => engagementService.pulse(actor(req)));
};
