/**
 * apps/api/src/modules/visualization-node-layouts/routes.ts
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  VizNodeLayoutSchema, VizNodeLayoutListQuerySchema, VizNodeLayoutListResponseSchema,
  UpsertVizNodeLayoutBodySchema, VizNodeLayoutIdParamSchema,
} from "@heuresys/shared";
import { visualizationNodeLayoutsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const visualizationNodeLayoutsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizNodeLayoutListQuerySchema, response: { 200: VizNodeLayoutListResponseSchema } },
  }, async (req) => visualizationNodeLayoutsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizNodeLayoutIdParamSchema, response: { 200: VizNodeLayoutSchema } },
  }, async (req) => visualizationNodeLayoutsService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { body: UpsertVizNodeLayoutBodySchema, response: { 200: VizNodeLayoutSchema } },
  }, async (req) => visualizationNodeLayoutsService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:delete")],
    schema: { params: VizNodeLayoutIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await visualizationNodeLayoutsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
