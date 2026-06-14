/**
 * apps/api/src/modules/skill-categories/routes.ts
 * 5 endpoints under /v1/skill-categories. Read open; write PLATFORM_ADMIN.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  SkillCategorySchema,
  SkillCategoryListQuerySchema,
  SkillCategoryListResponseSchema,
  CreateSkillCategoryBodySchema,
  UpdateSkillCategoryBodySchema,
  SkillCategoryIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { skillCategoriesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const skillCategoriesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: { querystring: SkillCategoryListQuerySchema, response: { 200: SkillCategoryListResponseSchema } },
  }, async (req) => skillCategoriesService.list(actor(req), req.query));

  app.get("/:id", {
    schema: { params: SkillCategoryIdParamSchema, response: { 200: SkillCategorySchema } },
  }, async (req) => skillCategoriesService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("skill:create")],
    schema: { body: CreateSkillCategoryBodySchema, response: { 201: SkillCategorySchema } },
  }, async (req, reply) => {
    const c = await skillCategoriesService.create(actor(req), req.body);
    reply.code(201).send(c);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("skill:update")],
    schema: { params: SkillCategoryIdParamSchema, body: UpdateSkillCategoryBodySchema, response: { 200: SkillCategorySchema } },
  }, async (req) => skillCategoriesService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("skill:update")],
    schema: { params: SkillCategoryIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await skillCategoriesService.delete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
