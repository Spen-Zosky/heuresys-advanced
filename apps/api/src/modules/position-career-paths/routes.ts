/**
 * apps/api/src/modules/position-career-paths/routes.ts
 * 4 endpoints under /v1/position-career-paths — list/get/create/delete. No PATCH.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  PositionCareerPathSchema,
  PositionCareerPathListQuerySchema,
  PositionCareerPathListResponseSchema,
  CreatePositionCareerPathBodySchema,
  PositionCareerPathIdParamSchema,
} from "@heuresys/shared";
import { positionCareerPathsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const positionCareerPathsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: PositionCareerPathListQuerySchema, response: { 200: PositionCareerPathListResponseSchema } },
  }, async (req) => positionCareerPathsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { params: PositionCareerPathIdParamSchema, response: { 200: PositionCareerPathSchema } },
  }, async (req) => positionCareerPathsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:create")],
    schema: { body: CreatePositionCareerPathBodySchema, response: { 201: PositionCareerPathSchema } },
  }, async (req, reply) => {
    const l = await positionCareerPathsService.create(actor(req), req.body);
    reply.code(201).send(l);
  });

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: PositionCareerPathIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await positionCareerPathsService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
