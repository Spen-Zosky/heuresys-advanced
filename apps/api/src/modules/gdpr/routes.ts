/**
 * apps/api/src/modules/gdpr/routes.ts
 * D-14 F3/F4 — admin GDPR surface (/v1/gdpr/*).
 *
 *   GET  /v1/gdpr/data-map               gdpr:read       classification registry
 *   GET  /v1/gdpr/requests               gdpr:read       registro delle richieste
 *   POST /v1/gdpr/users/:userId/export   gdpr:export     Art. 15/20 DSR bundle
 *   POST /v1/gdpr/users/:userId/erasure  gdpr:erase      Art. 17 (dryRun default true)
 *   POST /v1/gdpr/retention/run          gdpr:retention  registry-window sweep
 *
 * Self-service lives in the ME module (/v1/me/gdpr/export, /v1/me/consents —
 * ADR-0011). Exports/erasures are POST (state: sys_gdpr_requests accountability
 * row) and CSRF-protected like every state-changing route.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actorFromReq } from "../../lib/actor.js";
import {
  GdprDataMapResponseSchema,
  GdprUserIdParamSchema,
  GdprExportBundleSchema,
  GdprErasureBodySchema,
  GdprErasureReportSchema,
  GdprRetentionBodySchema,
  GdprRetentionReportSchema,
  GdprRequestListQuerySchema,
  GdprRequestListResponseSchema,
} from "@heuresys/shared";
import { gdprService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const gdprRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/data-map",
    {
      preHandler: [requirePermission("gdpr:read")],
      schema: { response: { 200: GdprDataMapResponseSchema } },
    },
    async (req) => gdprService.dataMap(actorFromReq(req)),
  );

  // Il REGISTRO delle richieste: si scriveva e non si poteva rileggere —
  // nessuna SELECT su sys_gdpr_requests in tutto il sorgente dell'API. Un
  // registro di accountability che nessuno consulta non dimostra niente.
  app.get(
    "/requests",
    {
      preHandler: [requirePermission("gdpr:read")],
      schema: {
        querystring: GdprRequestListQuerySchema,
        response: { 200: GdprRequestListResponseSchema },
      },
    },
    async (req) => gdprService.listRequests(actorFromReq(req), req.query),
  );

  app.post(
    "/users/:userId/export",
    {
      preHandler: [app.verifyCsrf, requirePermission("gdpr:export")],
      schema: {
        params: GdprUserIdParamSchema,
        response: { 200: GdprExportBundleSchema },
      },
    },
    async (req) => gdprService.exportSubject(actorFromReq(req), req.params.userId),
  );

  app.post(
    "/users/:userId/erasure",
    {
      preHandler: [app.verifyCsrf, requirePermission("gdpr:erase")],
      schema: {
        params: GdprUserIdParamSchema,
        body: GdprErasureBodySchema,
        response: { 200: GdprErasureReportSchema },
      },
    },
    async (req) => gdprService.eraseSubject(actorFromReq(req), req.params.userId, req.body.dryRun),
  );

  app.post(
    "/retention/run",
    {
      preHandler: [app.verifyCsrf, requirePermission("gdpr:retention")],
      schema: {
        body: GdprRetentionBodySchema,
        response: { 200: GdprRetentionReportSchema },
      },
    },
    async (req) => gdprService.runRetention(actorFromReq(req), req.body.dryRun),
  );
};
