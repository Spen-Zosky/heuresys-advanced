/**
 * apps/api/src/modules/predictions/routes.ts
 * /v1/predictions/* — PredictionsML read-model (models + typed predictions). READ-ONLY.
 * All routes: requirePermission("predictions:read"). No writes (no CSRF preHandler needed).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  PredictiveModelSchema, PredictiveModelListQuerySchema, PredictiveModelListResponseSchema,
  ModelPredictionSchema, ModelPredictionListQuerySchema, ModelPredictionListResponseSchema,
  PredictionIdParamSchema,
} from "@heuresys/shared";
import { predictionsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const predictionsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Models (registry) ──
  app.get("/models", {
    preHandler: [requirePermission("predictions:read")],
    schema: { querystring: PredictiveModelListQuerySchema, response: { 200: PredictiveModelListResponseSchema } },
  }, async (req) => predictionsService.listModels(actor(req), req.query));

  app.get("/models/:id", {
    preHandler: [requirePermission("predictions:read")],
    schema: { params: PredictionIdParamSchema, response: { 200: PredictiveModelSchema } },
  }, async (req) => predictionsService.getModel(actor(req), req.params.id));

  // ── Predictions (typed read-model) ──
  app.get("/", {
    preHandler: [requirePermission("predictions:read")],
    schema: { querystring: ModelPredictionListQuerySchema, response: { 200: ModelPredictionListResponseSchema } },
  }, async (req) => predictionsService.listPredictions(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("predictions:read")],
    schema: { params: PredictionIdParamSchema, response: { 200: ModelPredictionSchema } },
  }, async (req) => predictionsService.getPrediction(actor(req), req.params.id));
};
