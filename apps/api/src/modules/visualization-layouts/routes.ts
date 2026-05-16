/**
 * apps/api/src/modules/visualization-layouts/routes.ts
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  VizLayoutSchema, VizLayoutListQuerySchema, VizLayoutListResponseSchema,
  CreateVizLayoutBodySchema, UpdateVizLayoutBodySchema, VizLayoutIdParamSchema,
} from "@heuresys/shared";
import { visualizationLayoutsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const visualizationLayoutsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizLayoutListQuerySchema, response: { 200: VizLayoutListResponseSchema } },
  }, async (req) => visualizationLayoutsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizLayoutIdParamSchema, response: { 200: VizLayoutSchema } },
  }, async (req) => visualizationLayoutsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: { body: CreateVizLayoutBodySchema, response: { 201: VizLayoutSchema } },
  }, async (req, reply) => {
    const l = await visualizationLayoutsService.create(actor(req), req.body);
    reply.code(201).send(l);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizLayoutIdParamSchema, body: UpdateVizLayoutBodySchema, response: { 200: VizLayoutSchema } },
  }, async (req) => visualizationLayoutsService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizLayoutIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await visualizationLayoutsService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
