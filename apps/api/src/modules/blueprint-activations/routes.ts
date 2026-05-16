/**
 * apps/api/src/modules/blueprint-activations/routes.ts
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  BlueprintActivationSchema, BlueprintActivationListQuerySchema,
  BlueprintActivationListResponseSchema, CreateBlueprintActivationBodySchema,
  UpdateBlueprintActivationBodySchema, BlueprintActivationIdParamSchema,
} from "@heuresys/shared";
import { blueprintActivationsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const blueprintActivationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { querystring: BlueprintActivationListQuerySchema, response: { 200: BlueprintActivationListResponseSchema } },
  }, async (req) => blueprintActivationsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { params: BlueprintActivationIdParamSchema, response: { 200: BlueprintActivationSchema } },
  }, async (req) => blueprintActivationsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:activate")],
    schema: { body: CreateBlueprintActivationBodySchema, response: { 201: BlueprintActivationSchema } },
  }, async (req, reply) => {
    const a = await blueprintActivationsService.create(actor(req), req.body);
    reply.code(201).send(a);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:activate")],
    schema: { params: BlueprintActivationIdParamSchema, body: UpdateBlueprintActivationBodySchema, response: { 200: BlueprintActivationSchema } },
  }, async (req) => blueprintActivationsService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:activate")],
    schema: { params: BlueprintActivationIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await blueprintActivationsService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
