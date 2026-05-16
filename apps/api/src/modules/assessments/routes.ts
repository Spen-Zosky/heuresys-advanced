/**
 * apps/api/src/modules/assessments/routes.ts
 * 4 endpoints under /v1/assessments. No DELETE — use status=CANCELLED.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  AssessmentSchema,
  AssessmentListQuerySchema,
  AssessmentListResponseSchema,
  CreateAssessmentBodySchema,
  UpdateAssessmentBodySchema,
  AssessmentIdParamSchema,
} from "@heuresys/shared";
import { assessmentsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const assessmentsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("assessment:read")],
    schema: { querystring: AssessmentListQuerySchema, response: { 200: AssessmentListResponseSchema } },
  }, async (req) => assessmentsService.list(actor(req), req.query));

  app.get("/:id", {
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
