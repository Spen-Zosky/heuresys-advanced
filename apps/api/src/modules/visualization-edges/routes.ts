/**
 * apps/api/src/modules/visualization-edges/routes.ts
 * 4 endpoints: list/get/create/delete (no update — immutable).
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  VizEdgeSchema, VizEdgeListQuerySchema, VizEdgeListResponseSchema,
  CreateVizEdgeBodySchema, VizEdgeIdParamSchema,
} from "@heuresys/shared";
import { visualizationEdgesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const visualizationEdgesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizEdgeListQuerySchema, response: { 200: VizEdgeListResponseSchema } },
  }, async (req) => visualizationEdgesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizEdgeIdParamSchema, response: { 200: VizEdgeSchema } },
  }, async (req) => visualizationEdgesService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: { body: CreateVizEdgeBodySchema, response: { 201: VizEdgeSchema } },
  }, async (req, reply) => {
    const e = await visualizationEdgesService.create(actor(req), req.body);
    reply.code(201).send(e);
  });
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizEdgeIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await visualizationEdgesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
