/**
 * apps/api/src/modules/successor-candidates/routes.ts
 * 5 endpoints under /v1/successor-candidates.
 */

import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  SuccessorCandidateSchema,
  SuccessorCandidateListQuerySchema,
  SuccessorCandidateListResponseSchema,
  SuccessorReadinessDistributionResponseSchema,
  CreateSuccessorCandidateBodySchema,
  UpdateSuccessorCandidateBodySchema,
  SuccessorCandidateIdParamSchema,
} from "@heuresys/shared";
import { successorCandidatesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const successorCandidatesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: SuccessorCandidateListQuerySchema, response: { 200: SuccessorCandidateListResponseSchema } },
  }, async (req) => successorCandidatesService.list(actor(req), req.query));

  app.get("/readiness-distribution", {
    config: { orgGate: "aggregate" },
    preHandler: [requirePermission("career_succession:read")],
    schema: { response: { 200: SuccessorReadinessDistributionResponseSchema } },
  }, async (req) => successorCandidatesService.readinessDistribution(actor(req)));

  app.get("/:id", {
    config: { orgGate: "service" },
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
