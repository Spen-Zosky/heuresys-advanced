/**
 * apps/api/src/modules/successor-candidates/routes.ts
 * 5 endpoints under /v1/successor-candidates.
 */

import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  SuccessorCandidateSchema,
  SuccessorCandidateListQuerySchema,
  SuccessorCandidateListResponseSchema,
  CreateSuccessorCandidateBodySchema,
  UpdateSuccessorCandidateBodySchema,
  SuccessorCandidateIdParamSchema,
} from "@heuresys/shared";
import { successorCandidatesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const successorCandidatesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: SuccessorCandidateListQuerySchema, response: { 200: SuccessorCandidateListResponseSchema } },
  }, async (req) => successorCandidatesService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { params: SuccessorCandidateIdParamSchema, response: { 200: SuccessorCandidateSchema } },
  }, async (req) => successorCandidatesService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:create")],
    schema: { body: CreateSuccessorCandidateBodySchema, response: { 201: SuccessorCandidateSchema } },
  }, async (req, reply) => {
    const c = await successorCandidatesService.create(actor(req), req.body);
    reply.code(201).send(c);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: SuccessorCandidateIdParamSchema, body: UpdateSuccessorCandidateBodySchema, response: { 200: SuccessorCandidateSchema } },
  }, async (req) => successorCandidatesService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: SuccessorCandidateIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await successorCandidatesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
