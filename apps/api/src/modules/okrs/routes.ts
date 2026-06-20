/**
 * apps/api/src/modules/okrs/routes.ts — /v1/okrs/*
 * Reads: okr:read. Writes: app.verifyCsrf + okr:{create,update,delete}.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  OkrSchema, OkrListQuerySchema, OkrListResponseSchema,
  CreateOkrBodySchema, UpdateOkrBodySchema, OkrIdParamSchema, OkrKeyResultListResponseSchema,
} from "@heuresys/shared";
import { okrsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const okrsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("okr:read")],
    schema: { querystring: OkrListQuerySchema, response: { 200: OkrListResponseSchema } },
  }, async (req) => okrsService.listOkrs(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("okr:read")],
    schema: { params: OkrIdParamSchema, response: { 200: OkrSchema } },
  }, async (req) => okrsService.getOkr(actor(req), req.params.id));

  app.get("/:id/key-results", {
    preHandler: [requirePermission("okr:read")],
    schema: { params: OkrIdParamSchema, response: { 200: OkrKeyResultListResponseSchema } },
  }, async (req) => okrsService.listKeyResults(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("okr:create")],
    schema: { body: CreateOkrBodySchema, response: { 201: OkrSchema } },
  }, async (req, reply) => { reply.code(201).send(await okrsService.createOkr(actor(req), req.body)); });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("okr:update")],
    schema: { params: OkrIdParamSchema, body: UpdateOkrBodySchema, response: { 200: OkrSchema } },
  }, async (req) => okrsService.updateOkr(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("okr:delete")],
    schema: { params: OkrIdParamSchema },
  }, async (req, reply) => { await okrsService.deleteOkr(actor(req), req.params.id); reply.code(204).send(); });
};
