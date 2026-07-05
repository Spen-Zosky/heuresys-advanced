/**
 * apps/api/src/modules/position-succession-relevance/routes.ts
 * 4 endpoints under /v1/position-succession-relevance.
 * PUT-style upsert (idempotent on positionId).
 */

import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  PositionSuccessionRelevanceSchema,
  PositionSuccessionRelevanceListQuerySchema,
  PositionSuccessionRelevanceListResponseSchema,
  UpsertPositionSuccessionRelevanceBodySchema,
  PositionSuccessionRelevanceIdParamSchema,
} from "@heuresys/shared";
import { positionSuccessionRelevanceService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const positionSuccessionRelevanceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: PositionSuccessionRelevanceListQuerySchema, response: { 200: PositionSuccessionRelevanceListResponseSchema } },
  }, async (req) => positionSuccessionRelevanceService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("career_succession:read")],
    schema: { params: PositionSuccessionRelevanceIdParamSchema, response: { 200: PositionSuccessionRelevanceSchema } },
  }, async (req) => positionSuccessionRelevanceService.getById(actor(req), req.params.id));

  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { body: UpsertPositionSuccessionRelevanceBodySchema, response: { 200: PositionSuccessionRelevanceSchema } },
  }, async (req) => positionSuccessionRelevanceService.upsert(actor(req), req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: PositionSuccessionRelevanceIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await positionSuccessionRelevanceService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
