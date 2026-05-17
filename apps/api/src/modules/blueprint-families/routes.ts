/**
 * apps/api/src/modules/blueprint-families/routes.ts
 */
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  BlueprintFamilySchema, BlueprintFamilyListQuerySchema, BlueprintFamilyListResponseSchema,
  CreateBlueprintFamilyBodySchema, UpdateBlueprintFamilyBodySchema, BlueprintFamilyIdParamSchema,
} from "@heuresys/shared";
import { blueprintFamiliesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const blueprintFamiliesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { querystring: BlueprintFamilyListQuerySchema, response: { 200: BlueprintFamilyListResponseSchema } },
  }, async (req) => blueprintFamiliesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { params: BlueprintFamilyIdParamSchema, response: { 200: BlueprintFamilySchema } },
  }, async (req) => blueprintFamiliesService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:activate")],
    schema: { body: CreateBlueprintFamilyBodySchema, response: { 201: BlueprintFamilySchema } },
  }, async (req, reply) => {
    const f = await blueprintFamiliesService.create(actor(req), req.body);
    reply.code(201).send(f);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:override")],
    schema: { params: BlueprintFamilyIdParamSchema, body: UpdateBlueprintFamilyBodySchema, response: { 200: BlueprintFamilySchema } },
  }, async (req) => blueprintFamiliesService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:override")],
    schema: { params: BlueprintFamilyIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await blueprintFamiliesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
