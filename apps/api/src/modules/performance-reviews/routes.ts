/**
 * apps/api/src/modules/performance-reviews/routes.ts — /v1/performance-reviews/*
 * (#92 passo 3/7). READ-only: superficie manageriale/HR delle valutazioni.
 * EVALUATION per-persona → orgGate "service" + `performance-review:read`.
 * L'autovalutazione della persona (self-scope) arrivera' sotto /v1/me/* col
 * passo 5 (ADR-0011), non qui.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  PerformanceReviewListQuerySchema, PerformanceReviewListResponseSchema,
  PerformanceReviewParamSchema, PerformanceReviewSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { performanceReviewsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const performanceReviewsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("performance-review:read")],
    schema: {
      querystring: PerformanceReviewListQuerySchema,
      response: { 200: PerformanceReviewListResponseSchema },
    },
  }, async (req) => performanceReviewsService.list(actor(req), req.query));

  app.get("/:reviewId", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("performance-review:read")],
    schema: {
      params: PerformanceReviewParamSchema,
      response: { 200: PerformanceReviewSchema },
    },
  }, async (req) => performanceReviewsService.getById(actor(req), req.params.reviewId));
};
