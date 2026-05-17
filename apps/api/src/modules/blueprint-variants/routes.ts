/**
 * apps/api/src/modules/blueprint-variants/routes.ts
 */
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  BlueprintVariantSchema, BlueprintVariantListQuerySchema, BlueprintVariantListResponseSchema,
  CreateBlueprintVariantBodySchema, UpdateBlueprintVariantBodySchema, BlueprintVariantIdParamSchema,
} from "@heuresys/shared";
import { blueprintVariantsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const blueprintVariantsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { querystring: BlueprintVariantListQuerySchema, response: { 200: BlueprintVariantListResponseSchema } },
  }, async (req) => blueprintVariantsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { params: BlueprintVariantIdParamSchema, response: { 200: BlueprintVariantSchema } },
  }, async (req) => blueprintVariantsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:activate")],
    schema: { body: CreateBlueprintVariantBodySchema, response: { 201: BlueprintVariantSchema } },
  }, async (req, reply) => {
    const v = await blueprintVariantsService.create(actor(req), req.body);
    reply.code(201).send(v);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:override")],
    schema: { params: BlueprintVariantIdParamSchema, body: UpdateBlueprintVariantBodySchema, response: { 200: BlueprintVariantSchema } },
  }, async (req) => blueprintVariantsService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:override")],
    schema: { params: BlueprintVariantIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await blueprintVariantsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
