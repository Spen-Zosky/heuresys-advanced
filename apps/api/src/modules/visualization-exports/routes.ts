/**
 * apps/api/src/modules/visualization-exports/routes.ts
 * 3 endpoints: list/get/create. Immutable.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  VizExportSchema, VizExportListQuerySchema, VizExportListResponseSchema,
  CreateVizExportBodySchema, VizExportIdParamSchema,
} from "@heuresys/shared";
import { visualizationExportsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const visualizationExportsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizExportListQuerySchema, response: { 200: VizExportListResponseSchema } },
  }, async (req) => visualizationExportsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizExportIdParamSchema, response: { 200: VizExportSchema } },
  }, async (req) => visualizationExportsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: { body: CreateVizExportBodySchema, response: { 201: VizExportSchema } },
  }, async (req, reply) => {
    const e = await visualizationExportsService.create(actor(req), req.body);
    reply.code(201).send(e);
  });
};
