/**
 * apps/api/src/modules/capability-composition/routes.ts
 * /v1/capability/composition/* — MLCE Phase-1 (Gap#1 Step 3).
 *   GET  /composition                          — active scores (optional ?subjectType filter)
 *   GET  /composition/:subjectType/:subjectId  — single subject + lineage (404 if absent/out-of-scope)
 *   POST /composition/recompute                — bottom-up recompute (capability:admin, CSRF)
 *
 * Reads = capability:read (admin / ORG_DIRECTOR / HR — no ESS self-view). The
 * recompute write = capability:admin + CSRF (mirrors insights:admin /recompute).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  CapabilityScoreSchema,
  CapabilityScoreListResponseSchema,
  CapabilityCompositionListQuerySchema,
  CapabilitySubjectParamSchema,
  CapabilityRecomputeResponseSchema,
  EssentialCapabilityRankingSchema,
  VrioScorecardSchema,
} from "@heuresys/shared";
import { capabilityCompositionService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const capabilityCompositionRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/composition",
    {
      config: { orgGate: "service" },
      preHandler: [requirePermission("capability:read")],
      schema: { querystring: CapabilityCompositionListQuerySchema, response: { 200: CapabilityScoreListResponseSchema } },
    },
    async (req) => capabilityCompositionService.composition(actor(req), req.query.subjectType),
  );

  // #55 F1 — Essential Capability Ranker. Literal path before the /:subjectType/:subjectId
  // param route so "essential-ranking" is not swallowed as a subjectType.
  app.get(
    "/composition/essential-ranking",
    {
      // Org-wide aggregate (skill-level, no per-person rows) → `aggregate` gate, like the
      // sibling capability-maturity endpoints. D-51 requires the declaration because the
      // `capability` resource is SKILL-sensitive; the ranking never exposes who-holds-what.
      config: { orgGate: "aggregate" },
      preHandler: [requirePermission("capability:read")],
      schema: { response: { 200: EssentialCapabilityRankingSchema } },
    },
    async (req) => capabilityCompositionService.essentialRanking(actor(req)),
  );

  // #56 F2 — VRIO scorecard. Same literal-before-param ordering as essential-ranking.
  app.get(
    "/composition/vrio",
    {
      // Org-wide aggregate over skill-group totals; no per-person row is ever emitted, so the
      // `aggregate` gate applies exactly as for F1 (D-51 requires the explicit declaration
      // because the `capability` resource is SKILL-sensitive).
      config: { orgGate: "aggregate" },
      preHandler: [requirePermission("capability:read")],
      schema: { response: { 200: VrioScorecardSchema } },
    },
    async (req) => capabilityCompositionService.vrioScorecard(actor(req)),
  );

  app.get(
    "/composition/:subjectType/:subjectId",
    {
      config: { orgGate: "service" },
      preHandler: [requirePermission("capability:read")],
      schema: { params: CapabilitySubjectParamSchema, response: { 200: CapabilityScoreSchema } },
    },
    async (req) => capabilityCompositionService.subject(actor(req), req.params.subjectType, req.params.subjectId),
  );

  app.post(
    "/composition/recompute",
    {
      preHandler: [app.verifyCsrf, requirePermission("capability:admin")],
      schema: { response: { 200: CapabilityRecomputeResponseSchema } },
    },
    async (req) => capabilityCompositionService.recompute(actor(req)),
  );
};
