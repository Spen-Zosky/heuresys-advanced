/**
 * apps/api/src/modules/observability/routes.ts
 * GET /system-health · GET /slow-queries · GET /request-series (#35 B7) —
 * all platform-only.
 *
 * Gate: `observability:read` (000178, #61 G2 — PLATFORM_ADMIN-only audience;
 * historically proxied on `tenant:create` before the matrix had a dedicated
 * code). Read-only GETs → NO app.verifyCsrf.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  RequestSeriesQuerySchema,
  RequestSeriesResponseSchema,
  SlowQueriesQuerySchema,
  SlowQueriesResponseSchema,
  SystemHealthResponseSchema,
} from "@heuresys/shared";
import { observabilityService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const observabilityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/system-health", {
    preHandler: [requirePermission("observability:read")],
    schema: { response: { 200: SystemHealthResponseSchema } },
  }, async (req) => observabilityService.getSystemHealth(actor(req)));

  /* --- #35 B7 (S1028) ----------------------------------------------------- */

  app.get("/slow-queries", {
    preHandler: [requirePermission("observability:read")],
    schema: { querystring: SlowQueriesQuerySchema, response: { 200: SlowQueriesResponseSchema } },
  }, async (req) => {
    const res = await observabilityService.getSlowQueries(actor(req), req.query);
    // A degraded read returns 200 with an empty panel, which on screen is
    // indistinguishable from "healthy database, no traffic yet". Without this
    // line the loss of pg_stat_statements in PROD would be invisible.
    if (!res.extensionAvailable) {
      req.log.warn(
        { reason: res.degradedReason },
        "pg_stat_statements unavailable — slow-queries degraded to an empty result",
      );
    }
    return res;
  });

  app.get("/request-series", {
    preHandler: [requirePermission("observability:read")],
    schema: { querystring: RequestSeriesQuerySchema, response: { 200: RequestSeriesResponseSchema } },
  }, async (req) => observabilityService.getRequestSeries(actor(req), req.query));
};
