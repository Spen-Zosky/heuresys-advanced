/**
 * apps/api/src/modules/skill-aliases/routes.ts
 * 5 endpoints under /v1/skill-aliases. Scope inherits from parent skill.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  SkillAliasSchema,
  SkillAliasListQuerySchema,
  SkillAliasListResponseSchema,
  CreateSkillAliasBodySchema,
  UpdateSkillAliasBodySchema,
  SkillAliasIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { skillAliasesService, type ActorContext } from "./service.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const skillAliasesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: { querystring: SkillAliasListQuerySchema, response: { 200: SkillAliasListResponseSchema } },
  }, async (req) => skillAliasesService.list(actor(req), req.query));

  app.get("/:id", {
    schema: { params: SkillAliasIdParamSchema, response: { 200: SkillAliasSchema } },
  }, async (req) => skillAliasesService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf],
    schema: { body: CreateSkillAliasBodySchema, response: { 201: SkillAliasSchema } },
  }, async (req, reply) => {
    const a = await skillAliasesService.create(actor(req), req.body);
    reply.code(201).send(a);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf],
    schema: { params: SkillAliasIdParamSchema, body: UpdateSkillAliasBodySchema, response: { 200: SkillAliasSchema } },
  }, async (req) => skillAliasesService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf],
    schema: { params: SkillAliasIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await skillAliasesService.delete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
