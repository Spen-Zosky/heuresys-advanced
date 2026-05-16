/**
 * apps/api/src/modules/successor-readiness/routes.ts
 * 3 endpoints under /v1/successor-readiness — list, get, create. Immutable.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  SuccessorReadinessSchema,
  SuccessorReadinessListQuerySchema,
  SuccessorReadinessListResponseSchema,
  CreateSuccessorReadinessBodySchema,
  SuccessorReadinessIdParamSchema,
} from "@heuresys/shared";
import { successorReadinessService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const successorReadinessRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: SuccessorReadinessListQuerySchema, response: { 200: SuccessorReadinessListResponseSchema } },
  }, async (req) => successorReadinessService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { params: SuccessorReadinessIdParamSchema, response: { 200: SuccessorReadinessSchema } },
  }, async (req) => successorReadinessService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:create")],
    schema: { body: CreateSuccessorReadinessBodySchema, response: { 201: SuccessorReadinessSchema } },
  }, async (req, reply) => {
    const r = await successorReadinessService.create(actor(req), req.body);
    reply.code(201).send(r);
  });
};
