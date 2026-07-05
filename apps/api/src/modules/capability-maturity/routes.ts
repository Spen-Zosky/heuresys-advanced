/**
 * apps/api/src/modules/capability-maturity/routes.ts
 * /v1/capability/maturity/* — Maturity engine Phase-2 (Gap#1 Step 4).
 *   GET  /maturity                       — active L0..L5 scorecard (scope-filtered)
 *   GET  /maturity/org-units/:orgUnitId  — single org-unit + audited criteria (404)
 *   POST /maturity/recompute             — derive levels from MLCE (capability:admin, CSRF)
 *
 * Mounted under the same /v1/capability prefix as composition (distinct route paths).
 * Reads = capability:read; recompute = capability:admin + CSRF.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  CapabilityMaturityScoreSchema,
  CapabilityMaturityListResponseSchema,
  CapabilityMaturityOrgUnitParamSchema,
  CapabilityMaturityRecomputeResponseSchema,
} from "@heuresys/shared";
import { capabilityMaturityService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const capabilityMaturityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/maturity",
    { config: { orgGate: "aggregate" }, preHandler: [requirePermission("capability:read")], schema: { response: { 200: CapabilityMaturityListResponseSchema } } },
    async (req) => capabilityMaturityService.maturity(actor(req)),
  );

  app.get(
    "/maturity/org-units/:orgUnitId",
    { config: { orgGate: "aggregate" }, preHandler: [requirePermission("capability:read")], schema: { params: CapabilityMaturityOrgUnitParamSchema, response: { 200: CapabilityMaturityScoreSchema } } },
    async (req) => capabilityMaturityService.orgUnit(actor(req), req.params.orgUnitId),
  );

  app.post(
    "/maturity/recompute",
    { preHandler: [app.verifyCsrf, requirePermission("capability:admin")], schema: { response: { 200: CapabilityMaturityRecomputeResponseSchema } } },
    async (req) => capabilityMaturityService.recompute(actor(req)),
  );
};
