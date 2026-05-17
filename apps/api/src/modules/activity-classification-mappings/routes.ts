/**
 * apps/api/src/modules/activity-classification-mappings/routes.ts
 */
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  ActivityClassificationMappingSchema, ActivityMappingListQuerySchema,
  ActivityMappingListResponseSchema, CreateActivityMappingBodySchema,
  ActivityMappingIdParamSchema,
} from "@heuresys/shared";
import { activityMappingsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const activityMappingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { querystring: ActivityMappingListQuerySchema, response: { 200: ActivityMappingListResponseSchema } },
  }, async (req) => activityMappingsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { params: ActivityMappingIdParamSchema, response: { 200: ActivityClassificationMappingSchema } },
  }, async (req) => activityMappingsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:create")],
    schema: { body: CreateActivityMappingBodySchema, response: { 201: ActivityClassificationMappingSchema } },
  }, async (req, reply) => {
    const m = await activityMappingsService.create(actor(req), req.body);
    reply.code(201).send(m);
  });
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:update")],
    schema: { params: ActivityMappingIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await activityMappingsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
