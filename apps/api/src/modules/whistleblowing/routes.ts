/**
 * apps/api/src/modules/whistleblowing/routes.ts — /v1/whistleblowing (#51 E/E1).
 *
 * PUBLIC (no auth, no CSRF — like /v1/leads):
 *   POST /                 anonymous submit, per-IP rate-limited + honeypot
 *   GET  /status/:code     anonymous case tracking by code
 *
 * CUSTODIAN console (whistleblowing:read / :manage — the WHISTLEBLOWING_CUSTODIAN role
 * ONLY; mig 000181 removes these grants from every other role, PLATFORM_ADMIN included):
 *   GET   /reports
 *   GET   /reports/:id
 *   PATCH /reports/:id
 *
 * The public routes carry NO orgGate: they expose no per-person org data (a report has no
 * reporter FK). The custodian routes are isolated by RBAC, not by the org axis — that is
 * the whole point of the D.Lgs 24/2023 derogation to ADR-0027.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  WhistleblowingSubmitSchema,
  WhistleblowingSubmitResponseSchema,
  WhistleblowingStatusResponseSchema,
  WhistleblowingListResponseSchema,
  WhistleblowingReportSchema,
  WhistleblowingUpdateSchema,
  WhistleblowingIdParamSchema,
  WhistleblowingCodeParamSchema,
} from "@heuresys/shared";
import { whistleblowingService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const whistleblowingRoutes: FastifyPluginAsyncZod = async (app) => {
  // --- PUBLIC channel (anonymous) ---
  app.post(
    "/",
    {
      config: { rateLimit: { max: 5, timeWindow: 60 * 1000 } },
      schema: { body: WhistleblowingSubmitSchema, response: { 200: WhistleblowingSubmitResponseSchema } },
    },
    async (req) => whistleblowingService.submit(req.body),
  );

  app.get(
    "/status/:code",
    {
      config: { rateLimit: { max: 20, timeWindow: 60 * 1000 } },
      schema: { params: WhistleblowingCodeParamSchema, response: { 200: WhistleblowingStatusResponseSchema } },
    },
    async (req) => whistleblowingService.statusByCode(req.params.code),
  );

  // --- CUSTODIAN console (whistleblowing:read / :manage — custodian role only) ---
  app.get(
    "/reports",
    {
      preHandler: [requirePermission("whistleblowing:read")],
      schema: { response: { 200: WhistleblowingListResponseSchema } },
    },
    async (req) => whistleblowingService.list(actor(req)),
  );

  app.get(
    "/reports/:id",
    {
      preHandler: [requirePermission("whistleblowing:read")],
      schema: { params: WhistleblowingIdParamSchema, response: { 200: WhistleblowingReportSchema } },
    },
    async (req) => whistleblowingService.getById(actor(req), req.params.id),
  );

  app.patch(
    "/reports/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("whistleblowing:manage")],
      schema: {
        params: WhistleblowingIdParamSchema,
        body: WhistleblowingUpdateSchema,
        response: { 200: WhistleblowingReportSchema },
      },
    },
    async (req) => whistleblowingService.update(actor(req), req.params.id, req.body),
  );
};
