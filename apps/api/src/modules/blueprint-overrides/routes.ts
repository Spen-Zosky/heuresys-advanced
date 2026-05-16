/**
 * apps/api/src/modules/blueprint-overrides/routes.ts
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  BlueprintOverrideSchema, BlueprintOverrideListQuerySchema, BlueprintOverrideListResponseSchema,
  UpsertBlueprintOverrideBodySchema, BlueprintOverrideIdParamSchema,
} from "@heuresys/shared";
import { blueprintOverridesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const blueprintOverridesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { querystring: BlueprintOverrideListQuerySchema, response: { 200: BlueprintOverrideListResponseSchema } },
  }, async (req) => blueprintOverridesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("blueprint:read")],
    schema: { params: BlueprintOverrideIdParamSchema, response: { 200: BlueprintOverrideSchema } },
  }, async (req) => blueprintOverridesService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:override")],
    schema: { body: UpsertBlueprintOverrideBodySchema, response: { 200: BlueprintOverrideSchema } },
  }, async (req) => blueprintOverridesService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("blueprint:override")],
    schema: { params: BlueprintOverrideIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await blueprintOverridesService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
