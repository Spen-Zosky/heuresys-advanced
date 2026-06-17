/**
 * apps/api/src/modules/visualization-nodes/routes.ts
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  VizNodeSchema, VizNodeListQuerySchema, VizNodeListResponseSchema,
  CreateVizNodeBodySchema, UpdateVizNodeBodySchema, VizNodeIdParamSchema,
} from "@heuresys/shared";
import { visualizationNodesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const visualizationNodesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizNodeListQuerySchema, response: { 200: VizNodeListResponseSchema } },
  }, async (req) => visualizationNodesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizNodeIdParamSchema, response: { 200: VizNodeSchema } },
  }, async (req) => visualizationNodesService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: { body: CreateVizNodeBodySchema, response: { 201: VizNodeSchema } },
  }, async (req, reply) => {
    const n = await visualizationNodesService.create(actor(req), req.body);
    reply.code(201).send(n);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizNodeIdParamSchema, body: UpdateVizNodeBodySchema, response: { 200: VizNodeSchema } },
  }, async (req) => visualizationNodesService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizNodeIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await visualizationNodesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
