/**
 * apps/api/src/modules/agent-conversations/routes.ts — ADR-0056 D4, piano T6a.
 *
 * `/v1/agent-conversations`: le conversazioni dell'assistente della persona che chiama. Un solo
 * permesso, `agent_conversation:use:self`, che ogni ruolo ha (000483): il confine non è il ruolo ma
 * la proprietà, e lo tiene il servizio (una conversazione di un altro risponde 404). Scrive anche
 * l'assistente, con il gettone d'agente emesso per la persona; decidere una proposta no.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AgentActivityEventsQuerySchema,
  AgentActivityEventsResponseSchema,
  AgentActivityIdParamSchema,
  AgentActivitySchema,
  AgentConversationIdParamSchema,
  AgentConversationListResponseSchema,
  AgentConversationSchema,
  AgentProposalIdParamSchema,
  AgentProposalSchema,
  AppendAgentActivityEventsBodySchema,
  AppendAgentActivityEventsResponseSchema,
  CreateAgentActivityBodySchema,
  CreateAgentConversationBodySchema,
  CreateAgentProposalBodySchema,
  DecideAgentProposalBodySchema,
  UpdateAgentActivityBodySchema,
  UpdateAgentConversationBodySchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { agentConversationsService as svc } from "./service.js";

export const agentConversationsRoutes: FastifyPluginAsyncZod = async (app) => {
  const USA = requirePermission("agent_conversation:use:self");

  app.get("/", {
    preHandler: [USA],
    schema: { response: { 200: AgentConversationListResponseSchema } },
  }, async (req) => ({ items: await svc.list(actor(req)) }));

  app.post("/", {
    preHandler: [app.verifyCsrf, USA],
    schema: { body: CreateAgentConversationBodySchema, response: { 201: AgentConversationSchema } },
  }, async (req, reply) => reply.code(201).send(await svc.create(actor(req), req.body)));

  app.get("/:id", {
    preHandler: [USA],
    schema: { params: AgentConversationIdParamSchema, response: { 200: AgentConversationSchema } },
  }, async (req) => svc.get(actor(req), req.params.id));

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, USA],
    schema: {
      params: AgentConversationIdParamSchema,
      body: UpdateAgentConversationBodySchema,
      response: { 200: AgentConversationSchema },
    },
  }, async (req) => svc.update(actor(req), req.params.id, req.body));

  app.post("/:id/activities", {
    preHandler: [app.verifyCsrf, USA],
    schema: {
      params: AgentConversationIdParamSchema,
      body: CreateAgentActivityBodySchema,
      response: { 201: AgentActivitySchema },
    },
  }, async (req, reply) => reply.code(201).send(await svc.createActivity(actor(req), req.params.id, req.body)));

  app.patch("/activities/:activityId", {
    preHandler: [app.verifyCsrf, USA],
    schema: {
      params: AgentActivityIdParamSchema,
      body: UpdateAgentActivityBodySchema,
      response: { 200: AgentActivitySchema },
    },
  }, async (req) => svc.updateActivity(actor(req), req.params.activityId, req.body));

  app.get("/activities/:activityId/events", {
    preHandler: [USA],
    schema: {
      params: AgentActivityIdParamSchema,
      querystring: AgentActivityEventsQuerySchema,
      response: { 200: AgentActivityEventsResponseSchema },
    },
  }, async (req) => svc.events(actor(req), req.params.activityId, req.query.after));

  app.post("/activities/:activityId/events", {
    preHandler: [app.verifyCsrf, USA],
    schema: {
      params: AgentActivityIdParamSchema,
      body: AppendAgentActivityEventsBodySchema,
      response: { 201: AppendAgentActivityEventsResponseSchema },
    },
  }, async (req, reply) => reply.code(201).send(await svc.appendEvents(actor(req), req.params.activityId, req.body)));

  app.post("/activities/:activityId/proposals", {
    preHandler: [app.verifyCsrf, USA],
    schema: {
      params: AgentActivityIdParamSchema,
      body: CreateAgentProposalBodySchema,
      response: { 201: AgentProposalSchema },
    },
  }, async (req, reply) => reply.code(201).send(await svc.createProposal(actor(req), req.params.activityId, req.body)));

  app.post("/proposals/:proposalId/decision", {
    preHandler: [app.verifyCsrf, USA],
    schema: {
      params: AgentProposalIdParamSchema,
      body: DecideAgentProposalBodySchema,
      response: { 200: AgentProposalSchema },
    },
  }, async (req) => svc.decide(actor(req), req.params.proposalId, req.body));
};
