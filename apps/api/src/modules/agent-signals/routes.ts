/**
 * apps/api/src/modules/agent-signals/routes.ts — ADR-0063, voce F4a (E6).
 *
 * `GET /v1/agent-signals?status=APERTA`: le segnalazioni degli agenti per chi chiede, e solo le sue
 * (il destinatario è sempre l'attore). Sola lettura, stesso permesso della casella degli avvisi
 * (`notification:read:self`): ogni persona ha la sua casella.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AgentSignalListSchema, AgentSignalsQuerySchema } from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { agentSignalsService as svc } from "./service.js";

export const agentSignalsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service", tenantGate: "service" },
    preHandler: [requirePermission("notification:read:self")],
    schema: { querystring: AgentSignalsQuerySchema, response: { 200: AgentSignalListSchema } },
  }, async (req) => svc.mie(actor(req), req.query.status));
};
