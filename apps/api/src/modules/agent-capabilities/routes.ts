/**
 * apps/api/src/modules/agent-capabilities/routes.ts — ADR-0053 A1/A3/D4, piano T3c.
 *
 * `/v1/agent-capabilities`: il registro delle capacità degli agenti. Leggere: `agent_capability:read`
 * (Direttore HR, amministratore del tenant, piattaforma). Scrivere il catalogo:
 * `agent_capability:manage` (piattaforma). Decidere il modo: `agent_capability:activate` (Direttore
 * HR per il suo tenant; la piattaforma solo per riportare a `CONFERMA`). Le regole fini stanno nel
 * servizio e nel database (000480).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AddAgentCapabilityOperationBodySchema,
  AgentCapabilityIdParamSchema,
  AgentCapabilityListResponseSchema,
  AgentCapabilitySchema,
  CreateAgentCapabilityBodySchema,
  DecideAgentCapabilityModeBodySchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { agentCapabilitiesService as svc } from "./service.js";

export const agentCapabilitiesRoutes: FastifyPluginAsyncZod = async (app) => {
  const conf = { orgGate: "service", tenantGate: "service" } as const;
  const LEGGE = requirePermission("agent_capability:read");
  const GESTISCE = requirePermission("agent_capability:manage");
  const DECIDE = requirePermission("agent_capability:activate");

  app.get("/", {
    config: conf,
    preHandler: [LEGGE],
    schema: { response: { 200: AgentCapabilityListResponseSchema } },
  }, async (req) => ({ items: await svc.list(actor(req)) }));

  app.get("/:id", {
    config: conf,
    preHandler: [LEGGE],
    schema: { params: AgentCapabilityIdParamSchema, response: { 200: AgentCapabilitySchema } },
  }, async (req) => svc.get(actor(req), req.params.id));

  app.post("/", {
    config: conf,
    preHandler: [app.verifyCsrf, GESTISCE],
    schema: { body: CreateAgentCapabilityBodySchema, response: { 201: AgentCapabilitySchema } },
  }, async (req, reply) => reply.code(201).send(await svc.create(actor(req), req.body)));

  app.post("/:id/operations", {
    config: conf,
    preHandler: [app.verifyCsrf, GESTISCE],
    schema: {
      params: AgentCapabilityIdParamSchema,
      body: AddAgentCapabilityOperationBodySchema,
      response: { 200: AgentCapabilitySchema },
    },
  }, async (req) => svc.addOperation(actor(req), req.params.id, req.body));

  app.post("/:id/publish", {
    config: conf,
    preHandler: [app.verifyCsrf, GESTISCE],
    schema: { params: AgentCapabilityIdParamSchema, response: { 200: AgentCapabilitySchema } },
  }, async (req) => svc.setStatus(actor(req), req.params.id, "PUBBLICATA"));

  app.post("/:id/retire", {
    config: conf,
    preHandler: [app.verifyCsrf, GESTISCE],
    schema: { params: AgentCapabilityIdParamSchema, response: { 200: AgentCapabilitySchema } },
  }, async (req) => svc.setStatus(actor(req), req.params.id, "RITIRATA"));

  app.post("/:id/mode", {
    config: conf,
    preHandler: [app.verifyCsrf, DECIDE],
    schema: {
      params: AgentCapabilityIdParamSchema,
      body: DecideAgentCapabilityModeBodySchema,
      response: { 200: AgentCapabilitySchema },
    },
  }, async (req) => svc.decide(actor(req), req.params.id, req.body));
};
