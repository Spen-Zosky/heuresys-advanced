/**
 * apps/api/src/modules/analytics/routes.ts
 * BI analytics Phase 1 — 2 role-gated read endpoints:
 *   GET /v1/analytics/workforce — headcount distribution (OU + position)
 *   GET /v1/analytics/kpi       — KPI achievement rollup
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  WorkforceAnalyticsResponseSchema,
  KpiAnalyticsResponseSchema,
  AttendanceAnalyticsResponseSchema,
  CompensationAnalyticsResponseSchema,
  SkillsCoverageAnalyticsResponseSchema,
  SkillsByCategoryAnalyticsResponseSchema,
  OrgNetworkAnalyticsResponseSchema,
  OvertimeAnalyticsResponseSchema,
  SkillsGroupShareAnalyticsResponseSchema,
  AnalyticsExportParamsSchema,
  AnalyticsExportQuerySchema,
} from "@heuresys/shared";
import { analyticsService, type ActorContext } from "./service.js";
import { toCsv } from "./csv.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

/** Date stamp (YYYY-MM-DD) for the download filename, taken from the payload's generatedAt. */
function stampFrom(payload: Record<string, unknown>): string {
  const g = payload.generatedAt;
  return typeof g === "string" ? g.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/workforce",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: WorkforceAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.workforce(actor(req)),
  );

  app.get(
    "/kpi",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: KpiAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.kpi(actor(req)),
  );

  app.get(
    "/attendance",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: AttendanceAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.attendance(actor(req)),
  );

  app.get(
    "/compensation",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: CompensationAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.compensation(actor(req)),
  );

  app.get(
    "/skills",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: SkillsCoverageAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.skills(actor(req)),
  );

  app.get(
    "/skills-by-category",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: SkillsByCategoryAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.skillsByCategory(actor(req)),
  );

  app.get(
    "/org-network",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: OrgNetworkAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.orgNetwork(actor(req)),
  );

  app.get(
    "/overtime",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: OvertimeAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.overtime(actor(req)),
  );

  app.get(
    "/skills-group-share",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: { response: { 200: SkillsGroupShareAnalyticsResponseSchema } },
    },
    async (req) => analyticsService.skillsGroupShare(actor(req)),
  );

  // Export any of the 9 views as a downloadable CSV (default) or JSON file.
  // Raw response (no 200 response-schema) so Fastify ships text/csv|application/json
  // verbatim instead of JSON-serialising. Same analytics:view gate + scope as the views.
  app.get(
    "/:view/export",
    {
      preHandler: [requirePermission("analytics:view")],
      schema: {
        params: AnalyticsExportParamsSchema,
        querystring: AnalyticsExportQuerySchema,
      },
    },
    async (req, reply) => {
      const { view } = req.params;
      const { format } = req.query;
      const payload = await analyticsService.exportView(actor(req), view);
      const stamp = stampFrom(payload);
      const filename = `analytics-${view}-${stamp}.${format}`;
      reply.header("content-disposition", `attachment; filename="${filename}"`);
      if (format === "json") {
        reply.type("application/json; charset=utf-8");
        return JSON.stringify(payload, null, 2);
      }
      reply.type("text/csv; charset=utf-8");
      return toCsv(payload);
    },
  );
};
