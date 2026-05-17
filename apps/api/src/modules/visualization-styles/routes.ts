/**
 * apps/api/src/modules/visualization-styles/routes.ts
 * 4 endpoints — no PATCH (immutable per row; delete + re-create to change).
 */
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  VizStyleSchema, VizStyleListQuerySchema, VizStyleListResponseSchema,
  CreateVizStyleBodySchema, VizStyleIdParamSchema,
} from "@heuresys/shared";
import { visualizationStylesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const visualizationStylesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizStyleListQuerySchema, response: { 200: VizStyleListResponseSchema } },
  }, async (req) => visualizationStylesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizStyleIdParamSchema, response: { 200: VizStyleSchema } },
  }, async (req) => visualizationStylesService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: { body: CreateVizStyleBodySchema, response: { 201: VizStyleSchema } },
  }, async (req, reply) => {
    const s = await visualizationStylesService.create(actor(req), req.body);
    reply.code(201).send(s);
  });
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizStyleIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await visualizationStylesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
