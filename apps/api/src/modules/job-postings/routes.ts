/**
 * apps/api/src/modules/job-postings/routes.ts
 * 4 rotte sotto /v1/job-postings (#54 F3, seconda fetta).
 *
 * Questa e' la faccia AUTENTICATA degli annunci. La vetrina pubblica del percorso prospect
 * (ADR-0026) sara' un endpoint suo, con il suo permesso e il suo filtro su `PUBLIC` — non un
 * parametro passato a queste rotte, che risponderebbe a chi ha gia' un account.
 *
 * Nessuna DELETE: un annuncio si porta a `CLOSED`. E comunque la FK verso la richiesta e'
 * `ON DELETE CASCADE`, quindi la sola cancellazione possibile e' quella della radice — che
 * a sua volta non si cancella (vedi job-requisitions/routes.ts).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  JobPostingSchema,
  JobPostingListQuerySchema,
  JobPostingListResponseSchema,
  JobPostingCreateBodySchema,
  JobPostingUpdateBodySchema,
  JobPostingIdParamSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { jobPostingsService } from "./service.js";

export const jobPostingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("job-requisition:read")],
      schema: {
        querystring: JobPostingListQuerySchema,
        response: { 200: JobPostingListResponseSchema },
      },
    },
    async (req) => jobPostingsService.list(actor(req), req.query),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("job-requisition:read")],
      schema: { params: JobPostingIdParamSchema, response: { 200: JobPostingSchema } },
    },
    async (req) => jobPostingsService.getById(actor(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: { body: JobPostingCreateBodySchema, response: { 201: JobPostingSchema } },
    },
    async (req, reply) => {
      const creato = await jobPostingsService.create(actor(req), req.body);
      reply.code(201).send(creato);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: {
        params: JobPostingIdParamSchema,
        body: JobPostingUpdateBodySchema,
        response: { 200: JobPostingSchema },
      },
    },
    async (req) => jobPostingsService.update(actor(req), req.params.id, req.body),
  );
};
