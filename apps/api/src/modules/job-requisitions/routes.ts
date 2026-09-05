/**
 * apps/api/src/modules/job-requisitions/routes.ts
 * 4 rotte sotto /v1/job-requisitions (#54 F3).
 *
 * Nessuna DELETE: una richiesta di personale non si cancella, si porta a `CANCELLED`. Chi
 * si e' candidato resta appeso sotto, e cancellare la radice cancellerebbe la storia di
 * persone reali — che e' l'opposto di cio' che ADR-0035 chiede («ritirare non e' cancellare»).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  JobRequisitionSchema,
  JobRequisitionListQuerySchema,
  JobRequisitionListResponseSchema,
  JobRequisitionCreateBodySchema,
  JobRequisitionUpdateBodySchema,
  JobRequisitionIdParamSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { jobRequisitionsService } from "./service.js";

export const jobRequisitionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("job-requisition:read")],
      schema: {
        querystring: JobRequisitionListQuerySchema,
        response: { 200: JobRequisitionListResponseSchema },
      },
    },
    async (req) => jobRequisitionsService.list(actor(req), req.query),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("job-requisition:read")],
      schema: { params: JobRequisitionIdParamSchema, response: { 200: JobRequisitionSchema } },
    },
    async (req) => jobRequisitionsService.getById(actor(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: { body: JobRequisitionCreateBodySchema, response: { 201: JobRequisitionSchema } },
    },
    async (req, reply) => {
      const creata = await jobRequisitionsService.create(actor(req), req.body);
      reply.code(201).send(creata);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("job-requisition:manage")],
      schema: {
        params: JobRequisitionIdParamSchema,
        body: JobRequisitionUpdateBodySchema,
        response: { 200: JobRequisitionSchema },
      },
    },
    async (req) => jobRequisitionsService.update(actor(req), req.params.id, req.body),
  );
};
