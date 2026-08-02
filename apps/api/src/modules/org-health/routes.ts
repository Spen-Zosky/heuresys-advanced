/**
 * apps/api/src/modules/org-health/routes.ts
 * /v1/org-health — #57 F3 organizational health index.
 *   GET /  — one scored row per org-unit + the organization-level index
 *
 * Read = `org_director:read`, the permission that already gates the Org-Director console
 * where this scorecard is surfaced. The payload is an org-unit aggregate: no per-person
 * figure is emitted, which is why the `aggregate` org-gate applies (D-51) even though the
 * dimensions are derived from sensitive per-person sources.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { OrgHealthScorecardSchema } from "@heuresys/shared";
import { orgHealthService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const orgHealthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      config: { orgGate: "aggregate" },
      preHandler: [requirePermission("org_director:read")],
      schema: { response: { 200: OrgHealthScorecardSchema } },
    },
    async (req) => orgHealthService.scorecard(actor(req)),
  );
};
