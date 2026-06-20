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
} from "@heuresys/shared";
import { capabilityCompositionService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const capabilityCompositionRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/composition",
    {
      preHandler: [requirePermission("capability:read")],
      schema: { querystring: CapabilityCompositionListQuerySchema, response: { 200: CapabilityScoreListResponseSchema } },
    },
    async (req) => capabilityCompositionService.composition(actor(req), req.query.subjectType),
  );

  app.get(
    "/composition/:subjectType/:subjectId",
    {
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
