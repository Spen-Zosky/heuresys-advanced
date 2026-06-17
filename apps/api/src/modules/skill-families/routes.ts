/**
 * apps/api/src/modules/skill-families/routes.ts
 * 5 endpoints under /v1/skill-families. Pattern mirrors job-families:
 * read open (any authenticated); mutations gated in the service layer
 * to PLATFORM_ADMIN. CSRF on state-changing routes.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  SkillFamilySchema,
  SkillFamilyListQuerySchema,
  SkillFamilyListResponseSchema,
  CreateSkillFamilyBodySchema,
  UpdateSkillFamilyBodySchema,
  SkillFamilyIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { skillFamiliesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const skillFamiliesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: { querystring: SkillFamilyListQuerySchema, response: { 200: SkillFamilyListResponseSchema } },
  }, async (req) => skillFamiliesService.list(actor(req), req.query));

  app.get("/:id", {
    schema: { params: SkillFamilyIdParamSchema, response: { 200: SkillFamilySchema } },
  }, async (req) => skillFamiliesService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("skill:create")],
    schema: { body: CreateSkillFamilyBodySchema, response: { 201: SkillFamilySchema } },
  }, async (req, reply) => {
    const f = await skillFamiliesService.create(actor(req), req.body);
    reply.code(201).send(f);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("skill:update")],
    schema: { params: SkillFamilyIdParamSchema, body: UpdateSkillFamilyBodySchema, response: { 200: SkillFamilySchema } },
  }, async (req) => skillFamiliesService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("skill:update")],
    schema: { params: SkillFamilyIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await skillFamiliesService.delete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
