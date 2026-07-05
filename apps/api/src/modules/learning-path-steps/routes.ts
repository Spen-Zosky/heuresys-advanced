/**
 * apps/api/src/modules/learning-path-steps/routes.ts
 * 5 endpoints under /v1/learning-path-steps.
 * Permissions: learning:read/create/update/delete.
 */

import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  LearningPathStepSchema,
  LearningPathStepListQuerySchema,
  LearningPathStepListResponseSchema,
  CreateLearningPathStepBodySchema,
  UpdateLearningPathStepBodySchema,
  LearningPathStepIdParamSchema,
} from "@heuresys/shared";
import { learningPathStepsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const learningPathStepsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("learning:read")],
    schema: { querystring: LearningPathStepListQuerySchema, response: { 200: LearningPathStepListResponseSchema } },
  }, async (req) => learningPathStepsService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("learning:read")],
    schema: { params: LearningPathStepIdParamSchema, response: { 200: LearningPathStepSchema } },
  }, async (req) => learningPathStepsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("learning:create")],
    schema: { body: CreateLearningPathStepBodySchema, response: { 201: LearningPathStepSchema } },
  }, async (req, reply) => {
    const s = await learningPathStepsService.create(actor(req), req.body);
    reply.code(201).send(s);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("learning:update")],
    schema: { params: LearningPathStepIdParamSchema, body: UpdateLearningPathStepBodySchema, response: { 200: LearningPathStepSchema } },
  }, async (req) => learningPathStepsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("learning:delete")],
    schema: { params: LearningPathStepIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await learningPathStepsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
