/**
 * apps/api/src/modules/occupation-classifications/routes.ts
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  OccupationClassificationSchema, OccupationClassificationListQuerySchema,
  OccupationClassificationListResponseSchema, CreateOccupationClassificationBodySchema,
  UpdateOccupationClassificationBodySchema, OccupationClassificationIdParamSchema,
} from "@heuresys/shared";
import { occupationClassificationsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const occupationClassificationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("occupation_classification:read")],
    schema: { querystring: OccupationClassificationListQuerySchema, response: { 200: OccupationClassificationListResponseSchema } },
  }, async (req) => occupationClassificationsService.list(actor(req), req.query, req.locale));
  app.get("/:id", {
    preHandler: [requirePermission("occupation_classification:read")],
    schema: { params: OccupationClassificationIdParamSchema, response: { 200: OccupationClassificationSchema } },
  }, async (req) => occupationClassificationsService.getById(actor(req), req.params.id, req.locale));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("occupation_classification:create")],
    schema: { body: CreateOccupationClassificationBodySchema, response: { 201: OccupationClassificationSchema } },
  }, async (req, reply) => {
    const o = await occupationClassificationsService.create(actor(req), req.body);
    reply.code(201).send(o);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("occupation_classification:update")],
    schema: { params: OccupationClassificationIdParamSchema, body: UpdateOccupationClassificationBodySchema, response: { 200: OccupationClassificationSchema } },
  }, async (req) => occupationClassificationsService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("occupation_classification:delete")],
    schema: { params: OccupationClassificationIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await occupationClassificationsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
