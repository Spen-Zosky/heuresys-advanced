/**
 * apps/api/src/modules/assessments/routes.ts
 * 4 endpoints under /v1/assessments. No DELETE — use status=CANCELLED.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  AssessmentSchema,
  AssessmentListQuerySchema,
  AssessmentListResponseSchema,
  CreateAssessmentBodySchema,
  UpdateAssessmentBodySchema,
  AssessmentIdParamSchema,
} from "@heuresys/shared";
import { assessmentsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const assessmentsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("assessment:read")],
    schema: { querystring: AssessmentListQuerySchema, response: { 200: AssessmentListResponseSchema } },
  }, async (req) => assessmentsService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("assessment:read")],
    schema: { params: AssessmentIdParamSchema, response: { 200: AssessmentSchema } },
  }, async (req) => assessmentsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("assessment:create")],
    schema: { body: CreateAssessmentBodySchema, response: { 201: AssessmentSchema } },
  }, async (req, reply) => {
    const a = await assessmentsService.create(actor(req), req.body);
    reply.code(201).send(a);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("assessment:update")],
    schema: { params: AssessmentIdParamSchema, body: UpdateAssessmentBodySchema, response: { 200: AssessmentSchema } },
  }, async (req) => assessmentsService.update(actor(req), req.params.id, req.body));
};
