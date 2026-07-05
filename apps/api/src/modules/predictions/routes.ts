/**
 * apps/api/src/modules/predictions/routes.ts
 * /v1/predictions/* — PredictionsML read-model (models + typed predictions). READ-ONLY.
 * All routes: requirePermission("predictions:read"). No writes (no CSRF preHandler needed).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  PredictiveModelSchema, PredictiveModelListQuerySchema, PredictiveModelListResponseSchema,
  ModelPredictionSchema, ModelPredictionListQuerySchema, ModelPredictionListResponseSchema,
  PredictionIdParamSchema,
} from "@heuresys/shared";
import { predictionsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const predictionsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Models (registry) ──
  app.get("/models", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("predictions:read")],
    schema: { querystring: PredictiveModelListQuerySchema, response: { 200: PredictiveModelListResponseSchema } },
  }, async (req) => predictionsService.listModels(actor(req), req.query));

  app.get("/models/:id", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("predictions:read")],
    schema: { params: PredictionIdParamSchema, response: { 200: PredictiveModelSchema } },
  }, async (req) => predictionsService.getModel(actor(req), req.params.id));

  // ── Predictions (typed read-model) ──
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("predictions:read")],
    schema: { querystring: ModelPredictionListQuerySchema, response: { 200: ModelPredictionListResponseSchema } },
  }, async (req) => predictionsService.listPredictions(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("predictions:read")],
    schema: { params: PredictionIdParamSchema, response: { 200: ModelPredictionSchema } },
  }, async (req) => predictionsService.getPrediction(actor(req), req.params.id));
};
