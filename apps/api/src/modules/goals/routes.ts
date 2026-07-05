/**
 * apps/api/src/modules/goals/routes.ts — /v1/goals/*
 * Reads: requirePermission("goal:read"). Writes: app.verifyCsrf + goal:{create,update,delete}.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  GoalSchema, GoalListQuerySchema, GoalListResponseSchema,
  CreateGoalBodySchema, UpdateGoalBodySchema, GoalIdParamSchema,
} from "@heuresys/shared";
import { goalsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const goalsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("goal:read")],
    schema: { querystring: GoalListQuerySchema, response: { 200: GoalListResponseSchema } },
  }, async (req) => goalsService.listGoals(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("goal:read")],
    schema: { params: GoalIdParamSchema, response: { 200: GoalSchema } },
  }, async (req) => goalsService.getGoal(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("goal:create")],
    schema: { body: CreateGoalBodySchema, response: { 201: GoalSchema } },
  }, async (req, reply) => { reply.code(201).send(await goalsService.createGoal(actor(req), req.body)); });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("goal:update")],
    schema: { params: GoalIdParamSchema, body: UpdateGoalBodySchema, response: { 200: GoalSchema } },
  }, async (req) => goalsService.updateGoal(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("goal:delete")],
    schema: { params: GoalIdParamSchema },
  }, async (req, reply) => { await goalsService.deleteGoal(actor(req), req.params.id); reply.code(204).send(); });
};
