/**
 * apps/api/src/modules/interviews/routes.ts
 * 4 rotte sotto /v1/interviews (#54 F3, quinta fetta).
 *
 * Permesso proprio del dominio colloquio (`interview:feedback`, un solo verbo per lettura E
 * scrittura — mandato K, R-10, 2026-09-19, mig. 000427), separato da `job-requisition:*`.
 *
 * ⚠ Nessuna DELETE. Un colloquio annullato è `CANCELLED` e uno disertato è `NO_SHOW`: sono
 * **esiti**, e dicono cose diverse che una riga cancellata non direbbe più. Il vocabolario
 * dello stato esiste proprio per non aver bisogno di cancellare.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  InterviewSchema,
  InterviewListQuerySchema,
  InterviewListResponseSchema,
  InterviewCreateBodySchema,
  InterviewUpdateBodySchema,
  InterviewIdParamSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { interviewsService } from "./service.js";

export const interviewsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("interview:feedback")],
      schema: {
        querystring: InterviewListQuerySchema,
        response: { 200: InterviewListResponseSchema },
      },
    },
    async (req) => interviewsService.list(actor(req), req.query),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("interview:feedback")],
      schema: { params: InterviewIdParamSchema, response: { 200: InterviewSchema } },
    },
    async (req) => interviewsService.getById(actor(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("interview:feedback")],
      schema: { body: InterviewCreateBodySchema, response: { 201: InterviewSchema } },
    },
    async (req, reply) => {
      const creato = await interviewsService.create(actor(req), req.body);
      reply.code(201).send(creato);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("interview:feedback")],
      schema: {
        params: InterviewIdParamSchema,
        body: InterviewUpdateBodySchema,
        response: { 200: InterviewSchema },
      },
    },
    async (req) => interviewsService.update(actor(req), req.params.id, req.body),
  );
};
