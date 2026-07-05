/**
 * apps/api/src/modules/user-career-plans/routes.ts
 * 5 endpoints under /v1/user-career-plans.
 * Permissions: career_succession:read/create/update (DELETE reuses :update).
 */

import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  UserCareerPlanSchema,
  UserCareerPlanListQuerySchema,
  UserCareerPlanListResponseSchema,
  CreateUserCareerPlanBodySchema,
  UpdateUserCareerPlanBodySchema,
  UserCareerPlanIdParamSchema,
} from "@heuresys/shared";
import { userCareerPlansService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const userCareerPlansRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: UserCareerPlanListQuerySchema, response: { 200: UserCareerPlanListResponseSchema } },
  }, async (req) => userCareerPlansService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("career_succession:read")],
    schema: { params: UserCareerPlanIdParamSchema, response: { 200: UserCareerPlanSchema } },
  }, async (req) => userCareerPlansService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:create")],
    schema: { body: CreateUserCareerPlanBodySchema, response: { 201: UserCareerPlanSchema } },
  }, async (req, reply) => {
    const p = await userCareerPlansService.create(actor(req), req.body);
    reply.code(201).send(p);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: UserCareerPlanIdParamSchema, body: UpdateUserCareerPlanBodySchema, response: { 200: UserCareerPlanSchema } },
  }, async (req) => userCareerPlansService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: UserCareerPlanIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await userCareerPlansService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
