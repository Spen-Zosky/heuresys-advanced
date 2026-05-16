/**
 * apps/api/src/modules/blueprint-processes/routes.ts
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  BlueprintProcessSchema, BlueprintProcessListQuerySchema, BlueprintProcessListResponseSchema,
  CreateBlueprintProcessBodySchema, UpdateBlueprintProcessBodySchema, BlueprintProcessIdParamSchema,
} from "@heuresys/shared";
import { blueprintProcessesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const blueprintProcessesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { querystring: BlueprintProcessListQuerySchema, response: { 200: BlueprintProcessListResponseSchema } },
  }, async (req) => blueprintProcessesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { params: BlueprintProcessIdParamSchema, response: { 200: BlueprintProcessSchema } },
  }, async (req) => blueprintProcessesService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:activate")],
    schema: { body: CreateBlueprintProcessBodySchema, response: { 201: BlueprintProcessSchema } },
  }, async (req, reply) => {
    const p = await blueprintProcessesService.create(actor(req), req.body);
    reply.code(201).send(p);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:override")],
    schema: { params: BlueprintProcessIdParamSchema, body: UpdateBlueprintProcessBodySchema, response: { 200: BlueprintProcessSchema } },
  }, async (req) => blueprintProcessesService.update(actor(req), req.params.id, req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:override")],
    schema: { params: BlueprintProcessIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await blueprintProcessesService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
