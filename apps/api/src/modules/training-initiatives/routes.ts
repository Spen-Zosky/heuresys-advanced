/**
 * apps/api/src/modules/training-initiatives/routes.ts
 * 4 endpoints under /v1/training-initiatives. No DELETE — use status=CANCELLED.
 * Permission guards from the seeded training_initiative:* set.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  TrainingInitiativeSchema,
  TrainingInitiativeListQuerySchema,
  TrainingInitiativeListResponseSchema,
  CreateTrainingInitiativeBodySchema,
  UpdateTrainingInitiativeBodySchema,
  TrainingInitiativeIdParamSchema,
} from "@heuresys/shared";
import { trainingInitiativesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const trainingInitiativesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("training_initiative:list")],
    schema: { querystring: TrainingInitiativeListQuerySchema, response: { 200: TrainingInitiativeListResponseSchema } },
  }, async (req) => trainingInitiativesService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("training_initiative:read")],
    schema: { params: TrainingInitiativeIdParamSchema, response: { 200: TrainingInitiativeSchema } },
  }, async (req) => trainingInitiativesService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("training_initiative:create")],
    schema: { body: CreateTrainingInitiativeBodySchema, response: { 201: TrainingInitiativeSchema } },
  }, async (req, reply) => {
    const t = await trainingInitiativesService.create(actor(req), req.body);
    reply.code(201).send(t);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("training_initiative:update")],
    schema: { params: TrainingInitiativeIdParamSchema, body: UpdateTrainingInitiativeBodySchema, response: { 200: TrainingInitiativeSchema } },
  }, async (req) => trainingInitiativesService.update(actor(req), req.params.id, req.body));
};
