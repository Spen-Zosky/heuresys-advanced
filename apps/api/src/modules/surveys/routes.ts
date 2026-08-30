/**
 * apps/api/src/modules/surveys/routes.ts
 * /v1/surveys/* — templates + surveys full CRUD; responses read-only (nested + flat).
 * Reads: requirePermission("surveys:read"). Writes: app.verifyCsrf + surveys:{create,update,delete}.
 *
 * #235 — L'ASSE ORGANIZZATIVO SULLE RISPOSTE. Fino a S1085 il solo cancello era RBAC + tenant:
 * chiunque avesse `surveys:read` leggeva *chi ha detto cosa sul clima aziendale*, anche di
 * persone fuori dalla propria catena. Misurato: 862 risposte su 862 portano
 * `response_subject_user_id` (nessuna anonima), e i 6 sondaggi esistenti dichiarano tutti
 * `survey_is_anonymous = false`.
 *
 * Le tre dichiarazioni, e perche' sono diverse fra loro:
 *   templates  → "catalog"  le domande sono catalogo. L'unica colonna di persona e'
 *                           `template_created_by_user_id`, cioe' l'AUTORE: la stessa specie
 *                           che la guardia GDPR della 000304 esclude, non un soggetto.
 *   surveys    → "service"  la campagna e' struttura, MA `survey_audience_ids` e' la platea.
 *                           Oggi e' vuota su tutte e 6 (misurato) — e proprio per questo
 *                           dichiararla "catalog" sarebbe cristallizzare una misura che puo'
 *                           cambiare domani. Il servizio filtra la platea con lo scope org,
 *                           cosi' la dichiarazione e' vera PER COSTRUZIONE, non per fortuna.
 *   responses  → "service"  il dato della persona. Lista filtrata, singola risposta gated.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  SurveyTemplateSchema, SurveyTemplateListQuerySchema, SurveyTemplateListResponseSchema,
  CreateSurveyTemplateBodySchema, UpdateSurveyTemplateBodySchema,
  SurveySchema, SurveyListQuerySchema, SurveyListResponseSchema,
  CreateSurveyBodySchema, UpdateSurveyBodySchema,
  SurveyResponseSchema, SurveyResponseListQuerySchema, SurveyResponseListResponseSchema,
  SurveyIdParamSchema,
} from "@heuresys/shared";
import { surveysService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const surveysRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Templates ──
  app.get("/templates", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "catalog" },
    schema: { querystring: SurveyTemplateListQuerySchema, response: { 200: SurveyTemplateListResponseSchema } },
  }, async (req) => surveysService.listTemplates(actor(req), req.query));

  app.get("/templates/:id", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "catalog" },
    schema: { params: SurveyIdParamSchema, response: { 200: SurveyTemplateSchema } },
  }, async (req) => surveysService.getTemplate(actor(req), req.params.id));

  app.post("/templates", {
    preHandler: [app.verifyCsrf, requirePermission("surveys:create")],
    schema: { body: CreateSurveyTemplateBodySchema, response: { 201: SurveyTemplateSchema } },
  }, async (req, reply) => { reply.code(201).send(await surveysService.createTemplate(actor(req), req.body)); });

  app.patch("/templates/:id", {
    preHandler: [app.verifyCsrf, requirePermission("surveys:update")],
    schema: { params: SurveyIdParamSchema, body: UpdateSurveyTemplateBodySchema, response: { 200: SurveyTemplateSchema } },
  }, async (req) => surveysService.updateTemplate(actor(req), req.params.id, req.body));

  app.delete("/templates/:id", {
    preHandler: [app.verifyCsrf, requirePermission("surveys:delete")],
    schema: { params: SurveyIdParamSchema },
  }, async (req, reply) => { await surveysService.deleteTemplate(actor(req), req.params.id); reply.code(204).send(); });

  // ── Surveys ──
  app.get("/", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "service" },
    schema: { querystring: SurveyListQuerySchema, response: { 200: SurveyListResponseSchema } },
  }, async (req) => surveysService.listSurveys(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "service" },
    schema: { params: SurveyIdParamSchema, response: { 200: SurveySchema } },
  }, async (req) => surveysService.getSurvey(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("surveys:create")],
    schema: { body: CreateSurveyBodySchema, response: { 201: SurveySchema } },
  }, async (req, reply) => { reply.code(201).send(await surveysService.createSurvey(actor(req), req.body)); });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("surveys:update")],
    schema: { params: SurveyIdParamSchema, body: UpdateSurveyBodySchema, response: { 200: SurveySchema } },
  }, async (req) => surveysService.updateSurvey(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("surveys:delete")],
    schema: { params: SurveyIdParamSchema },
  }, async (req, reply) => { await surveysService.deleteSurvey(actor(req), req.params.id); reply.code(204).send(); });

  // ── Responses (read-only event log) ──
  app.get("/:id/responses", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "service" },
    schema: { params: SurveyIdParamSchema, querystring: SurveyResponseListQuerySchema, response: { 200: SurveyResponseListResponseSchema } },
  }, async (req) => surveysService.listResponses(actor(req), req.params.id, req.query));

  app.get("/responses/:id", {
    preHandler: [requirePermission("surveys:read")],
    config: { orgGate: "service" },
    schema: { params: SurveyIdParamSchema, response: { 200: SurveyResponseSchema } },
  }, async (req) => surveysService.getResponse(actor(req), req.params.id));
};
