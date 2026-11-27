/**
 * apps/api/src/modules/scenari/routes.ts — il motore degli scenari what-if (ADR-0063 D5), voce F3b-2
 * del piano docs/piani/PIANO_heuresys-ai-driven_20261126.md.
 *
 *   GET  /v1/scenari          gli scenari del tenant, tutti, con il numero
 *   GET  /v1/scenari/:id      uno scenario con la sua ultima versione: ipotesi, opzioni, leve, risultati, fonti, equità
 *   POST /v1/scenari/uscite   calcola uno scenario di uscita (S-T1 effetto diretto, S-T2 cascata)
 *
 * Il calcolo scrive solo nelle tabelle degli scenari e della struttura ombra, mai sulle tabelle di
 * business (ADR-0063 D3): lo verificano le guardie della 000515 e la prova di integrazione.
 * Permessi `scenario:read` e `scenario:create` (000524), dei soli mandati HR del tenant; il servizio
 * pretende il tenant dell'attore (I5).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ScenarioDetailSchema, ScenarioExitsCreateSchema, ScenarioListSchema } from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { scenariService as svc } from "./service.js";

export const scenariRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service", tenantGate: "service" },
    preHandler: [requirePermission("scenario:read")],
    schema: { response: { 200: ScenarioListSchema } },
  }, async (req) => svc.list(actor(req)));

  app.get("/:id", {
    config: { orgGate: "service", tenantGate: "service" },
    preHandler: [requirePermission("scenario:read")],
    schema: { params: z.object({ id: z.uuid() }), response: { 200: ScenarioDetailSchema } },
  }, async (req) => svc.get(actor(req), req.params.id));

  app.post("/uscite", {
    config: { orgGate: "service", tenantGate: "service" },
    preHandler: [app.verifyCsrf, requirePermission("scenario:create")],
    schema: { body: ScenarioExitsCreateSchema, response: { 201: ScenarioDetailSchema } },
  }, async (req, reply) => {
    const d = await svc.createExits(actor(req), req.body);
    return reply.code(201).send(d);
  });
};
