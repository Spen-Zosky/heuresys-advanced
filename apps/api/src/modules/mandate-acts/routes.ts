/**
 * apps/api/src/modules/mandate-acts/routes.ts — ADR-0050 D4 e D7 (mig 000475).
 *
 *   GET  /v1/mandate-acts                 elenco (filtri: status, userId)
 *   GET  /v1/mandate-acts/:id             un atto
 *   POST /v1/mandate-acts                 proposta (GRANT, REVOKE, CONFIRM)
 *   POST /v1/mandate-acts/:id/approve     approvazione di un secondo titolare: produce l'effetto
 *   POST /v1/mandate-acts/:id/reject      rifiuto, con nota
 *   POST /v1/mandate-acts/:id/withdraw    ritiro del proponente
 *
 * Tutte chiedono `role:assign`, lo stesso permesso delle rotte dei ruoli di una persona; il
 * service aggiunge il perimetro e le tre persone distinte.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  DecideMandateActBodySchema,
  MandateActIdParamSchema,
  MandateActListQuerySchema,
  MandateActListResponseSchema,
  MandateActSchema,
  ProposeMandateActBodySchema,
  RejectMandateActBodySchema,
} from "@heuresys/shared";
import { actorFromRequest as actorFromReq } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { mandateActsService } from "./service.js";

export const mandateActsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("role:assign")],
      schema: { querystring: MandateActListQuerySchema, response: { 200: MandateActListResponseSchema } },
    },
    async (req) => ({ items: await mandateActsService.list(actorFromReq(req), req.query) }),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("role:assign")],
      schema: { params: MandateActIdParamSchema, response: { 200: MandateActSchema } },
    },
    async (req) => mandateActsService.get(actorFromReq(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("role:assign")],
      schema: { body: ProposeMandateActBodySchema, response: { 201: MandateActSchema } },
    },
    async (req, reply) => {
      const act = await mandateActsService.propose(actorFromReq(req), req.body);
      reply.code(201).send(act);
    },
  );

  app.post(
    "/:id/approve",
    {
      preHandler: [app.verifyCsrf, requirePermission("role:assign")],
      schema: { params: MandateActIdParamSchema, body: DecideMandateActBodySchema, response: { 200: MandateActSchema } },
    },
    async (req) => mandateActsService.approve(actorFromReq(req), req.params.id, req.body.note ?? null),
  );

  app.post(
    "/:id/reject",
    {
      preHandler: [app.verifyCsrf, requirePermission("role:assign")],
      schema: { params: MandateActIdParamSchema, body: RejectMandateActBodySchema, response: { 200: MandateActSchema } },
    },
    async (req) => mandateActsService.reject(actorFromReq(req), req.params.id, req.body.note),
  );

  app.post(
    "/:id/withdraw",
    {
      preHandler: [app.verifyCsrf, requirePermission("role:assign")],
      schema: { params: MandateActIdParamSchema, body: DecideMandateActBodySchema, response: { 200: MandateActSchema } },
    },
    async (req) => mandateActsService.withdraw(actorFromReq(req), req.params.id, req.body.note ?? null),
  );
};
