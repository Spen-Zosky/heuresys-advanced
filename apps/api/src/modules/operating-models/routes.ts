/**
 * apps/api/src/modules/operating-models/routes.ts
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  OperatingModelSchema, OperatingModelListResponseSchema,
  UpsertOperatingModelBodySchema, OperatingModelIdParamSchema,
} from "@heuresys/shared";
import { operatingModelsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const operatingModelsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { response: { 200: OperatingModelListResponseSchema } },
  }, async (req) => operatingModelsService.list(actor(req)));
  app.get("/:id", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { params: OperatingModelIdParamSchema, response: { 200: OperatingModelSchema } },
  }, async (req) => operatingModelsService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:update")],
    schema: { body: UpsertOperatingModelBodySchema, response: { 200: OperatingModelSchema } },
  }, async (req) => operatingModelsService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:update")],
    schema: { params: OperatingModelIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await operatingModelsService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
