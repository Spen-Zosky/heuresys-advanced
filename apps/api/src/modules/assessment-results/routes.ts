/**
 * apps/api/src/modules/assessment-results/routes.ts
 * 3 endpoints under /v1/assessment-results — list, get, create. No update/delete (immutable).
 * Permissions: assessment:read for list/get, assessment:create for POST.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  AssessmentResultSchema,
  AssessmentResultListQuerySchema,
  AssessmentResultListResponseSchema,
  CreateAssessmentResultBodySchema,
  AssessmentResultIdParamSchema,
} from "@heuresys/shared";
import { assessmentResultsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const assessmentResultsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("assessment:read")],
    schema: { querystring: AssessmentResultListQuerySchema, response: { 200: AssessmentResultListResponseSchema } },
  }, async (req) => assessmentResultsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("assessment:read")],
    schema: { params: AssessmentResultIdParamSchema, response: { 200: AssessmentResultSchema } },
  }, async (req) => assessmentResultsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("assessment:create")],
    schema: { body: CreateAssessmentResultBodySchema, response: { 201: AssessmentResultSchema } },
  }, async (req, reply) => {
    const r = await assessmentResultsService.create(actor(req), req.body);
    reply.code(201).send(r);
  });
};
