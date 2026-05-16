/**
 * apps/api/src/modules/career-path-steps/routes.ts
 * 5 endpoints under /v1/career-path-steps.
 * Permissions: career_succession:read/create/update.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  CareerPathStepSchema,
  CareerPathStepListQuerySchema,
  CareerPathStepListResponseSchema,
  CreateCareerPathStepBodySchema,
  UpdateCareerPathStepBodySchema,
  CareerPathStepIdParamSchema,
} from "@heuresys/shared";
import { careerPathStepsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const careerPathStepsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: CareerPathStepListQuerySchema, response: { 200: CareerPathStepListResponseSchema } },
  }, async (req) => careerPathStepsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { params: CareerPathStepIdParamSchema, response: { 200: CareerPathStepSchema } },
  }, async (req) => careerPathStepsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:create")],
    schema: { body: CreateCareerPathStepBodySchema, response: { 201: CareerPathStepSchema } },
  }, async (req, reply) => {
    const s = await careerPathStepsService.create(actor(req), req.body);
    reply.code(201).send(s);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: CareerPathStepIdParamSchema, body: UpdateCareerPathStepBodySchema, response: { 200: CareerPathStepSchema } },
  }, async (req) => careerPathStepsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: CareerPathStepIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await careerPathStepsService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
