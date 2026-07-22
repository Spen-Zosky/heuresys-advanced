/**
 * apps/api/src/modules/operating-models/routes.ts
 * Gated by dedicated `operating_model:*` permissions (000199, #61 G2) —
 * previously proxied on `enterprise_typing:*`; audience unchanged.
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  OperatingModelSchema, OperatingModelListResponseSchema,
  UpsertOperatingModelBodySchema, OperatingModelIdParamSchema,
} from "@heuresys/shared";
import { operatingModelsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const operatingModelsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("operating_model:read")],
    schema: { response: { 200: OperatingModelListResponseSchema } },
  }, async (req) => operatingModelsService.list(actor(req)));
  app.get("/:id", {
    preHandler: [requirePermission("operating_model:read")],
    schema: { params: OperatingModelIdParamSchema, response: { 200: OperatingModelSchema } },
  }, async (req) => operatingModelsService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("operating_model:update")],
    schema: { body: UpsertOperatingModelBodySchema, response: { 200: OperatingModelSchema } },
  }, async (req) => operatingModelsService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("operating_model:delete")],
    schema: { params: OperatingModelIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await operatingModelsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
