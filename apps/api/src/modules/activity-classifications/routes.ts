/**
 * apps/api/src/modules/activity-classifications/routes.ts
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  ActivityClassificationSchema, ActivityClassificationListQuerySchema,
  ActivityClassificationListResponseSchema, CreateActivityClassificationBodySchema,
  UpdateActivityClassificationBodySchema, ActivityClassificationIdParamSchema,
} from "@heuresys/shared";
import { activityClassificationsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const activityClassificationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { querystring: ActivityClassificationListQuerySchema, response: { 200: ActivityClassificationListResponseSchema } },
  }, async (req) => activityClassificationsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { params: ActivityClassificationIdParamSchema, response: { 200: ActivityClassificationSchema } },
  }, async (req) => activityClassificationsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:create")],
    schema: { body: CreateActivityClassificationBodySchema, response: { 201: ActivityClassificationSchema } },
  }, async (req, reply) => {
    const a = await activityClassificationsService.create(actor(req), req.body);
    reply.code(201).send(a);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:update")],
    schema: { params: ActivityClassificationIdParamSchema, body: UpdateActivityClassificationBodySchema, response: { 200: ActivityClassificationSchema } },
  }, async (req) => activityClassificationsService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:update")],
    schema: { params: ActivityClassificationIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await activityClassificationsService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
