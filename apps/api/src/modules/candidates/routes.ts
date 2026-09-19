/**
 * apps/api/src/modules/candidates/routes.ts
 * 4 rotte sotto /v1/candidates (#54 F3, terza fetta).
 *
 * Permessi propri del dominio candidato (`candidate:read` / `candidate:write`), separati da
 * `job-requisition:*` (mandato K, R-10, 2026-09-19, mig. 000427): il ciclo del recruiting
 * restava un permesso solo per costruzione, non per necessita' — l'estensione era gia'
 * dichiarata additiva quando questo modulo e' nato.
 *
 * ⚠ Nessuna DELETE, e qui la ragione e' piu' forte che altrove: cancellare un candidato
 * cancellerebbe le sue candidature, i suoi colloqui e i giudizi che li accompagnano. La
 * conservazione si governa con `status = 'ARCHIVED'` e `retentionUntil`, che sono dati
 * dichiarati e verificabili — non con una riga che sparisce.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  CandidateSchema,
  CandidateListQuerySchema,
  CandidateListResponseSchema,
  CandidateCreateBodySchema,
  CandidateUpdateBodySchema,
  CandidateIdParamSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { candidatesService } from "./service.js";

export const candidatesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("candidate:read")],
      schema: {
        querystring: CandidateListQuerySchema,
        response: { 200: CandidateListResponseSchema },
      },
    },
    async (req) => candidatesService.list(actor(req), req.query),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("candidate:read")],
      schema: { params: CandidateIdParamSchema, response: { 200: CandidateSchema } },
    },
    async (req) => candidatesService.getById(actor(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("candidate:write")],
      schema: { body: CandidateCreateBodySchema, response: { 201: CandidateSchema } },
    },
    async (req, reply) => {
      const creato = await candidatesService.create(actor(req), req.body);
      reply.code(201).send(creato);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("candidate:write")],
      schema: {
        params: CandidateIdParamSchema,
        body: CandidateUpdateBodySchema,
        response: { 200: CandidateSchema },
      },
    },
    async (req) => candidatesService.update(actor(req), req.params.id, req.body),
  );
};
