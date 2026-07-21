/**
 * apps/api/src/modules/skills/routes.ts
 * 4 endpoints under /v1/skills (no DELETE per AUTH §6 matrix — skills are
 * referenced by position requirements + user evidence rows and shouldn't
 * be hard-deleted; soft-deactivation is post-MVP).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  SkillSchema,
  SkillListQuerySchema,
  SkillListResponseSchema,
  CreateSkillBodySchema,
  UpdateSkillBodySchema,
  SkillIdParamSchema,
} from "@heuresys/shared";
import { skillsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const skillsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("skill:read")],
    schema: { querystring: SkillListQuerySchema, response: { 200: SkillListResponseSchema } },
  }, async (req) => skillsService.list(actor(req), req.query, req.locale));

  app.get("/:id", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("skill:read")],
    schema: { params: SkillIdParamSchema, response: { 200: SkillSchema } },
  }, async (req) => skillsService.getById(actor(req), req.params.id, req.locale));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("skill:create")],
    schema: { body: CreateSkillBodySchema, response: { 201: SkillSchema } },
  }, async (req, reply) => {
    const skill = await skillsService.create(actor(req), req.body);
    reply.code(201).send(skill);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("skill:update")],
    schema: { params: SkillIdParamSchema, body: UpdateSkillBodySchema, response: { 200: SkillSchema } },
  }, async (req) => skillsService.update(actor(req), req.params.id, req.body));
};
