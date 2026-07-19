/**
 * apps/api/src/modules/activity-classifications/routes.ts
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  ActivityClassificationSchema, ActivityClassificationListQuerySchema,
  ActivityClassificationListResponseSchema, CreateActivityClassificationBodySchema,
  UpdateActivityClassificationBodySchema, ActivityClassificationIdParamSchema,
} from "@heuresys/shared";
import { activityClassificationsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

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
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:delete")],
    schema: { params: ActivityClassificationIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await activityClassificationsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
