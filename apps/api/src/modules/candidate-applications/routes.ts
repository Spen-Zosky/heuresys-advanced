/**
 * apps/api/src/modules/candidate-applications/routes.ts
 * 4 rotte sotto /v1/candidate-applications (#54 F3, quarta fetta).
 *
 * Permessi riusati dalla richiesta (`job-requisition:read` / `:manage`), come nelle tre
 * fette precedenti: il recruiting è un ciclo solo, e chi lo conduce lo conduce per intero.
 * Separarli in seguito è additivo.
 *
 * ⚠ Nessuna DELETE. Una candidatura è **il fatto che una persona si è presentata**, e quel
 * fatto non si disfa: si chiude con `WITHDRAWN` (ritirata da lei) o `REJECTED` con il suo
 * motivo (chiusa da noi). Cancellarla porterebbe via anche i colloqui e i giudizi che vi si
 * appendono — e la storia di una selezione è esattamente ciò che questo modulo serve a
 * conservare.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  CandidateApplicationSchema,
  CandidateApplicationListQuerySchema,
  CandidateApplicationListResponseSchema,
  CandidateApplicationCreateBodySchema,
  CandidateApplicationUpdateBodySchema,
  CandidateApplicationIdParamSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { candidateApplicationsService } from "./service.js";

export const candidateApplicationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("job-requisition:read")],
      schema: {
        querystring: CandidateApplicationListQuerySchema,
        response: { 200: CandidateApplicationListResponseSchema },
      },
    },
    async (req) => candidateApplicationsService.list(actor(req), req.query),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("job-requisition:read")],
      schema: {
        params: CandidateApplicationIdParamSchema,
        response: { 200: CandidateApplicationSchema },
      },
    },
    async (req) => candidateApplicationsService.getById(actor(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: {
        body: CandidateApplicationCreateBodySchema,
        response: { 201: CandidateApplicationSchema },
      },
    },
    async (req, reply) => {
      const creata = await candidateApplicationsService.create(actor(req), req.body);
      reply.code(201).send(creata);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: {
        params: CandidateApplicationIdParamSchema,
        body: CandidateApplicationUpdateBodySchema,
        response: { 200: CandidateApplicationSchema },
      },
    },
    async (req) => candidateApplicationsService.update(actor(req), req.params.id, req.body),
  );
};
