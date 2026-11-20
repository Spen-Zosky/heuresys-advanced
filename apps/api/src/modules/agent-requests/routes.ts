/**
 * apps/api/src/modules/agent-requests/routes.ts — tappa T2, migrazione 000501.
 *
 * `/v1/agent-requests`: le richieste dell'agente con previsione di spesa e tetto, e il registro di
 * costo e durata delle sue chiamate. Proporre e leggere le proprie sono aperti a ogni persona (e
 * all'assistente per conto suo) con `agent_conversation:use:self`; registrare una chiamata lo fa
 * SOLO il gettone dell'agente, col proprio codice e per una richiesta della persona (403 altrimenti);
 * decidere, leggere la coda di tutti e il registro chiedono i permessi nuovi di PLATFORM_ADMIN.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AgentCallListQuerySchema,
  AgentCallListResponseSchema,
  AgentCallSchema,
  AgentRequestIdParamSchema,
  AgentRequestListQuerySchema,
  AgentRequestListResponseSchema,
  AgentRequestSchema,
  CreateAgentCallBodySchema,
  CreateAgentRequestBodySchema,
  DecideAgentRequestBodySchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { agentRequestsService as svc } from "./service.js";

export const agentRequestsRoutes: FastifyPluginAsyncZod = async (app) => {
  const USA = requirePermission("agent_conversation:use:self");
  const DECIDE = requirePermission("agent_request:decide");
  const LEGGI_TUTTO = requirePermission("agent_request:read:all");

  app.get("/", {
    preHandler: [USA],
    schema: { querystring: AgentRequestListQuerySchema, response: { 200: AgentRequestListResponseSchema } },
  }, async (req) => svc.list(actor(req), req.query));

  app.post("/", {
    preHandler: [app.verifyCsrf, USA],
    schema: { body: CreateAgentRequestBodySchema, response: { 201: AgentRequestSchema } },
  }, async (req, reply) => reply.code(201).send(await svc.create(actor(req), req.body)));

  app.post("/:id/decision", {
    preHandler: [app.verifyCsrf, DECIDE],
    schema: {
      params: AgentRequestIdParamSchema,
      body: DecideAgentRequestBodySchema,
      response: { 200: AgentRequestSchema },
    },
  }, async (req) => svc.decide(actor(req), req.params.id, req.body));

  app.post("/calls", {
    preHandler: [app.verifyCsrf, USA],
    schema: { body: CreateAgentCallBodySchema, response: { 201: AgentCallSchema } },
  }, async (req, reply) => reply.code(201).send(await svc.recordCall(actor(req), req.body)));

  app.get("/calls", {
    preHandler: [LEGGI_TUTTO],
    schema: { querystring: AgentCallListQuerySchema, response: { 200: AgentCallListResponseSchema } },
  }, async (req) => svc.listCalls(req.query.limit));
};
