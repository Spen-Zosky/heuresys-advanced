/**
 * apps/api/src/modules/candidates/routes.ts
 * 4 rotte sotto /v1/candidates (#54 F3, terza fetta).
 *
 * Permessi riusati dalla richiesta (`job-requisition:read` / `:manage`): il recruiting e'
 * un ciclo solo, e chi lo conduce lo conduce per intero. Separarli dopo e' additivo.
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
      preHandler: [requirePermission("job-requisition:read")],
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
      preHandler: [requirePermission("job-requisition:read")],
      schema: { params: CandidateIdParamSchema, response: { 200: CandidateSchema } },
    },
    async (req) => candidatesService.getById(actor(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
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
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: {
        params: CandidateIdParamSchema,
        body: CandidateUpdateBodySchema,
        response: { 200: CandidateSchema },
      },
    },
    async (req) => candidatesService.update(actor(req), req.params.id, req.body),
  );
};
