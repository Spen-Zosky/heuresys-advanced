/**
 * apps/api/src/modules/visualization-graphs/routes.ts
 * 5 endpoints under /v1/visualization-graphs.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  VizGraphSchema, VizGraphListQuerySchema, VizGraphListResponseSchema,
  CreateVizGraphBodySchema, UpdateVizGraphBodySchema, VizGraphIdParamSchema,
} from "@heuresys/shared";
import { visualizationGraphsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const visualizationGraphsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizGraphListQuerySchema, response: { 200: VizGraphListResponseSchema } },
  }, async (req) => visualizationGraphsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizGraphIdParamSchema, response: { 200: VizGraphSchema } },
  }, async (req) => visualizationGraphsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: { body: CreateVizGraphBodySchema, response: { 201: VizGraphSchema } },
  }, async (req, reply) => {
    const g = await visualizationGraphsService.create(actor(req), req.body);
    reply.code(201).send(g);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizGraphIdParamSchema, body: UpdateVizGraphBodySchema, response: { 200: VizGraphSchema } },
  }, async (req) => visualizationGraphsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizGraphIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await visualizationGraphsService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
