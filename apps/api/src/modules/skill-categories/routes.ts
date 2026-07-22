/**
 * apps/api/src/modules/skill-categories/routes.ts
 * 5 endpoints under /v1/skill-categories. Read open; mutations gated by
 * `skill_taxonomy:*` (000199, #61 G2 — PLATFORM_ADMIN-only, matrix-honest);
 * service ensurePlatformAdmin kept as defense in depth, denial code stays
 * SKILL_CATEGORY_ADMIN_ONLY.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  SkillCategorySchema,
  SkillCategoryListQuerySchema,
  SkillCategoryListResponseSchema,
  CreateSkillCategoryBodySchema,
  UpdateSkillCategoryBodySchema,
  SkillCategoryIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { skillCategoriesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const skillCategoriesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: { querystring: SkillCategoryListQuerySchema, response: { 200: SkillCategoryListResponseSchema } },
  }, async (req) => skillCategoriesService.list(actor(req), req.query, req.locale));

  app.get("/:id", {
    schema: { params: SkillCategoryIdParamSchema, response: { 200: SkillCategorySchema } },
  }, async (req) => skillCategoriesService.getById(actor(req), req.params.id, req.locale));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("skill_taxonomy:create", "SKILL_CATEGORY_ADMIN_ONLY")],
    schema: { body: CreateSkillCategoryBodySchema, response: { 201: SkillCategorySchema } },
  }, async (req, reply) => {
    const c = await skillCategoriesService.create(actor(req), req.body);
    reply.code(201).send(c);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("skill_taxonomy:update", "SKILL_CATEGORY_ADMIN_ONLY")],
    schema: { params: SkillCategoryIdParamSchema, body: UpdateSkillCategoryBodySchema, response: { 200: SkillCategorySchema } },
  }, async (req) => skillCategoriesService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("skill_taxonomy:delete", "SKILL_CATEGORY_ADMIN_ONLY")],
    schema: { params: SkillCategoryIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await skillCategoriesService.delete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
