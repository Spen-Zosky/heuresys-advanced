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
  OrgNetworkAnalyticsResponseSchema,
  OvertimeAnalyticsResponseSchema,
} from "@heuresys/shared";
import { analyticsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

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
};
