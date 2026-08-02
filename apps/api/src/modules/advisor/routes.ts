/**
 * apps/api/src/modules/advisor/routes.ts
 * /v1/advisor — #58 F4 fase 1, raccomandazioni prescrittive con citazioni obbligatorie.
 *   GET /suggestions  — deriva dalle scorecard, registra la traccia, restituisce
 *   GET /audit        — la traccia registrata, così com'è a database
 *
 * Read = `org_director:read`, la stessa porta delle scorecard che l'advisor cita: chi non
 * può vedere le fonti non deve poter vedere le conclusioni tratte da esse. `orgGate:
 * aggregate` per lo stesso motivo di F2/F3 — l'uscita è per capability e per unità, nessuna
 * cifra per-persona.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { AdvisorSuggestionsResponseSchema } from "@heuresys/shared";
import { advisorService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const advisorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/suggestions",
    {
      config: { orgGate: "aggregate" },
      preHandler: [requirePermission("org_director:read")],
      schema: { response: { 200: AdvisorSuggestionsResponseSchema } },
    },
    async (req) => advisorService.suggestions(actor(req)),
  );

  app.get(
    "/audit",
    {
      config: { orgGate: "aggregate" },
      preHandler: [requirePermission("org_director:read")],
      schema: { response: { 200: AdvisorSuggestionsResponseSchema } },
    },
    async (req) => advisorService.audit(actor(req)),
  );
};
