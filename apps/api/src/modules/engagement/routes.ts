/**
 * apps/api/src/modules/engagement/routes.ts
 * /v1/engagement/* — normalized engagement cluster read-model (B-10b m2b). READ-ONLY.
 * All routes: requirePermission("surveys:read") (reuses the m2 survey permission). No writes → no CSRF.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  EngagementSurveyListResponseSchema,
  EngagementTemplateListResponseSchema,
  EngagementSurveyResultsResponseSchema,
  EngagementPulseResponseSchema,
  EngagementSurveyIdParamSchema,
} from "@heuresys/shared";
import { engagementService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const engagementRoutes: FastifyPluginAsyncZod = async (app) => {
  // #235 — la lista non estrae nessuna colonna di persona: solo campagna, stato, periodo e
  // due conteggi (`question_count`, `response_count`). E' vero per come e' scritta la query,
  // non per come sono i dati oggi.
  app.get("/surveys", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "catalog" },
    schema: { response: { 200: EngagementSurveyListResponseSchema } },
  }, async (req) => engagementService.listSurveys(actor(req)));

  // #235 — aggregato per domanda (conteggio + media), MAI la singola risposta. La soglia di
  // k-anonimato nel repository e' cio' che rende vera questa dichiarazione anche domani.
  app.get("/surveys/:surveyId/results", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "aggregate" },
    schema: { params: EngagementSurveyIdParamSchema, response: { 200: EngagementSurveyResultsResponseSchema } },
  }, async (req) => engagementService.surveyResults(actor(req), req.params.surveyId));

  // #235 — aggregato per settimana ISO, stessa soglia.
  app.get("/pulse", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "aggregate" },
    schema: { response: { 200: EngagementPulseResponseSchema } },
  }, async (req) => engagementService.pulse(actor(req)));

  // #235 — catalogo di domande: `sys_survey_templates` non ha alcuna colonna di persona
  // (misurato su information_schema, non dedotto dal nome).
  app.get("/templates", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "catalog" },
    schema: { response: { 200: EngagementTemplateListResponseSchema } },
  }, async (req) => engagementService.listTemplates(actor(req)));
};
