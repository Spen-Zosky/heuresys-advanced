/**
 * apps/api/src/modules/learning-gaps/routes.ts
 * 5 endpoints under /v1/learning-gaps.
 * Permissions: gap_analysis:read for list/get, gap_analysis:create for POST,
 * gap_analysis:update for PATCH and DELETE (no gap_analysis:delete in seed).
 */

import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  LearningGapSchema,
  LearningGapListQuerySchema,
  LearningGapListResponseSchema,
  CreateLearningGapBodySchema,
  UpdateLearningGapBodySchema,
  LearningGapIdParamSchema,
} from "@heuresys/shared";
import { learningGapsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const learningGapsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("gap_analysis:read")],
    schema: { querystring: LearningGapListQuerySchema, response: { 200: LearningGapListResponseSchema } },
  }, async (req) => learningGapsService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("gap_analysis:read")],
    schema: { params: LearningGapIdParamSchema, response: { 200: LearningGapSchema } },
  }, async (req) => learningGapsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("gap_analysis:create")],
    schema: { body: CreateLearningGapBodySchema, response: { 201: LearningGapSchema } },
  }, async (req, reply) => {
    const g = await learningGapsService.create(actor(req), req.body);
    reply.code(201).send(g);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("gap_analysis:update")],
    schema: { params: LearningGapIdParamSchema, body: UpdateLearningGapBodySchema, response: { 200: LearningGapSchema } },
  }, async (req) => learningGapsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("gap_analysis:update")],
    schema: { params: LearningGapIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await learningGapsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
