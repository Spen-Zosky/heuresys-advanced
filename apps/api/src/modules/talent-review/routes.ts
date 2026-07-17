/**
 * apps/api/src/modules/talent-review/routes.ts — /v1/talent-review/* (A/L3, #29). READ-only.
 * Talent = EVALUATION. 9-box / fit / readiness / succession expose person rows →
 * orgGate "service" (resolveOrgReadScope in the service). Critical positions +
 * critical-role coverage are position-level with no person rows → orgGate "catalog".
 * All routes require `talent:read` (no self-scope — talent is a management surface).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  NineBoxListQuerySchema, NineBoxListResponseSchema,
  FitScoreListQuerySchema, FitScoreListResponseSchema,
  ReadinessScoreListQuerySchema, ReadinessScoreListResponseSchema,
  SuccessionScoreListQuerySchema, SuccessionScoreListResponseSchema,
  CriticalPositionListQuerySchema, CriticalPositionListResponseSchema,
  CriticalCoverageListQuerySchema, CriticalCoverageListResponseSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { talentReviewService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const talentReviewRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/nine-box", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("talent:read")],
    schema: {
      querystring: NineBoxListQuerySchema,
      response: { 200: NineBoxListResponseSchema },
    },
  }, async (req) => talentReviewService.listNineBox(actor(req), req.query));

  app.get("/fit", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("talent:read")],
    schema: {
      querystring: FitScoreListQuerySchema,
      response: { 200: FitScoreListResponseSchema },
    },
  }, async (req) => talentReviewService.listFit(actor(req), req.query));

  app.get("/readiness", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("talent:read")],
    schema: {
      querystring: ReadinessScoreListQuerySchema,
      response: { 200: ReadinessScoreListResponseSchema },
    },
  }, async (req) => talentReviewService.listReadiness(actor(req), req.query));

  app.get("/succession", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("talent:read")],
    schema: {
      querystring: SuccessionScoreListQuerySchema,
      response: { 200: SuccessionScoreListResponseSchema },
    },
  }, async (req) => talentReviewService.listSuccession(actor(req), req.query));

  app.get("/critical-positions", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("talent:read")],
    schema: {
      querystring: CriticalPositionListQuerySchema,
      response: { 200: CriticalPositionListResponseSchema },
    },
  }, async (req) => talentReviewService.listCriticalPositions(actor(req), req.query));

  app.get("/critical-coverage", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("talent:read")],
    schema: {
      querystring: CriticalCoverageListQuerySchema,
      response: { 200: CriticalCoverageListResponseSchema },
    },
  }, async (req) => talentReviewService.listCriticalCoverage(actor(req), req.query));
};
