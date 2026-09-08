/**
 * apps/api/src/modules/job-offers/routes.ts
 * 4 rotte sotto /v1/job-offers (#54 F3, settima e ultima fetta).
 *
 * Permessi riusati dalla richiesta (`job-requisition:read` / `:manage`), come nelle sei
 * fette precedenti: il recruiting è un ciclo solo, e chi lo conduce lo conduce per intero.
 *
 * ⚠ Nessuna DELETE. Un'offerta si ritira (`WITHDRAWN`) o scade (`EXPIRED`), e i due dicono
 * cose diverse: la prima è una decisione dell'azienda, la seconda il passare del tempo.
 * Cancellare la riga toglierebbe la traccia di una proposta economica che è stata
 * realmente fatta a una persona — e su quella si è deciso.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  JobOfferSchema,
  JobOfferListQuerySchema,
  JobOfferListResponseSchema,
  JobOfferCreateBodySchema,
  JobOfferUpdateBodySchema,
  JobOfferIdParamSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { jobOffersService } from "./service.js";

export const jobOffersRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("job-requisition:read")],
      schema: {
        querystring: JobOfferListQuerySchema,
        response: { 200: JobOfferListResponseSchema },
      },
    },
    async (req) => jobOffersService.list(actor(req), req.query),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("job-requisition:read")],
      schema: { params: JobOfferIdParamSchema, response: { 200: JobOfferSchema } },
    },
    async (req) => jobOffersService.getById(actor(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: { body: JobOfferCreateBodySchema, response: { 201: JobOfferSchema } },
    },
    async (req, reply) => {
      const creato = await jobOffersService.create(actor(req), req.body);
      reply.code(201).send(creato);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: {
        params: JobOfferIdParamSchema,
        body: JobOfferUpdateBodySchema,
        response: { 200: JobOfferSchema },
      },
    },
    async (req) => jobOffersService.update(actor(req), req.params.id, req.body),
  );
};
