/**
 * apps/api/src/modules/blueprint-activations/routes.ts
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  BlueprintActivationSchema, BlueprintActivationListQuerySchema,
  BlueprintActivationListResponseSchema, CreateBlueprintActivationBodySchema,
  UpdateBlueprintActivationBodySchema, BlueprintActivationIdParamSchema,
} from "@heuresys/shared";
import { blueprintActivationsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

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
    preHandler: [app.verifyCsrf, requirePermission("blueprint:delete")],
    schema: { params: BlueprintActivationIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await blueprintActivationsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
