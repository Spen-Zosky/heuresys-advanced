/**
 * apps/api/src/modules/agent-weekly-summary/routes.ts — ADR-0063 D3, piano voce F0c (E5).
 *
 * `GET /v1/agent-weekly-summary?week=YYYY-MM-DD`: il riepilogo settimanale delle scritture fatte con
 * l'assistente (confermate, negate, autonome). Sola lettura. Permesso `agent_capability:read`
 * (Direttore HR, amministratore del tenant, piattaforma): è lo stesso pubblico del registro delle
 * capacità, e il servizio restringe al tenant chi non ha il mandato di piattaforma.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AgentWeeklySummaryQuerySchema, AgentWeeklySummarySchema } from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { agentWeeklySummaryService as svc } from "./service.js";

export const agentWeeklySummaryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service", tenantGate: "service" },
    preHandler: [requirePermission("agent_capability:read")],
    schema: { querystring: AgentWeeklySummaryQuerySchema, response: { 200: AgentWeeklySummarySchema } },
  }, async (req) => svc.get(actor(req), req.query.week));
};
