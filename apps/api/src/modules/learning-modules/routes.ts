/**
 * apps/api/src/modules/learning-modules/routes.ts
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  LearningModuleSchema,
  LearningModuleListQuerySchema,
  LearningModuleListResponseSchema,
  CreateLearningModuleBodySchema,
  UpdateLearningModuleBodySchema,
  LearningModuleIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { learningModulesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const learningModulesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("learning:read")],
    schema: { querystring: LearningModuleListQuerySchema, response: { 200: LearningModuleListResponseSchema } },
  }, async (req) => learningModulesService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("learning:read")],
    schema: { params: LearningModuleIdParamSchema, response: { 200: LearningModuleSchema } },
  }, async (req) => learningModulesService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("learning:create")],
    schema: { body: CreateLearningModuleBodySchema, response: { 201: LearningModuleSchema } },
  }, async (req, reply) => {
    const m = await learningModulesService.create(actor(req), req.body);
    reply.code(201).send(m);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("learning:update")],
    schema: { params: LearningModuleIdParamSchema, body: UpdateLearningModuleBodySchema, response: { 200: LearningModuleSchema } },
  }, async (req) => learningModulesService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("learning:delete")],
    schema: { params: LearningModuleIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await learningModulesService.delete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
