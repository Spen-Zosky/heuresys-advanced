/**
 * apps/api/src/modules/skill-taxonomy-edges/routes.ts
 * 4 endpoints under /v1/skill-taxonomy-edges (no PATCH — edges are immutable).
 * Read open with visibility filter; write PLATFORM_ADMIN.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  SkillTaxonomyEdgeSchema,
  SkillTaxonomyEdgeListQuerySchema,
  SkillTaxonomyEdgeListResponseSchema,
  CreateSkillTaxonomyEdgeBodySchema,
  SkillTaxonomyEdgeIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { skillTaxonomyEdgesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const skillTaxonomyEdgesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: { querystring: SkillTaxonomyEdgeListQuerySchema, response: { 200: SkillTaxonomyEdgeListResponseSchema } },
  }, async (req) => skillTaxonomyEdgesService.list(actor(req), req.query));

  app.get("/:id", {
    schema: { params: SkillTaxonomyEdgeIdParamSchema, response: { 200: SkillTaxonomyEdgeSchema } },
  }, async (req) => skillTaxonomyEdgesService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("skill:create")],
    schema: { body: CreateSkillTaxonomyEdgeBodySchema, response: { 201: SkillTaxonomyEdgeSchema } },
  }, async (req, reply) => {
    const e = await skillTaxonomyEdgesService.create(actor(req), req.body);
    reply.code(201).send(e);
  });

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("skill:delete")],
    schema: { params: SkillTaxonomyEdgeIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await skillTaxonomyEdgesService.delete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
