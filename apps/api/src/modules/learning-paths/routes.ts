/**
 * apps/api/src/modules/learning-paths/routes.ts
 * 5 endpoints under /v1/learning-paths.
 * Permissions: learning:read for list/get, learning:create for POST,
 * learning:update for PATCH, learning:delete for DELETE.
 */

import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  LearningPathSchema,
  LearningPathListQuerySchema,
  LearningPathListResponseSchema,
  CreateLearningPathBodySchema,
  UpdateLearningPathBodySchema,
  LearningPathIdParamSchema,
} from "@heuresys/shared";
import { learningPathsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const learningPathsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("learning:read")],
    schema: { querystring: LearningPathListQuerySchema, response: { 200: LearningPathListResponseSchema } },
  }, async (req) => learningPathsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("learning:read")],
    schema: { params: LearningPathIdParamSchema, response: { 200: LearningPathSchema } },
  }, async (req) => learningPathsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("learning:create")],
    schema: { body: CreateLearningPathBodySchema, response: { 201: LearningPathSchema } },
  }, async (req, reply) => {
    const p = await learningPathsService.create(actor(req), req.body);
    reply.code(201).send(p);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("learning:update")],
    schema: { params: LearningPathIdParamSchema, body: UpdateLearningPathBodySchema, response: { 200: LearningPathSchema } },
  }, async (req) => learningPathsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("learning:delete")],
    schema: { params: LearningPathIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await learningPathsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
