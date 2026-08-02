/**
 * apps/api/src/modules/leads/routes.ts — /v1/leads.
 * POST = PUBLIC (no auth, no CSRF — a public website form) + per-IP rate-limit +
 * honeypot (in the service). GET = leads:read (PLATFORM_ADMIN), CSV/XLSX-exportable
 * via the global onSend exporter.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  LeadCreateSchema,
  LeadCreateResponseSchema,
  LeadListQuerySchema,
  LeadListResponseSchema,
  LeadUpdateSchema,
  LeadIdParamSchema,
  LeadResponseSchema,
} from "@heuresys/shared";
import { leadsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/",
    {
      config: { rateLimit: { max: 5, timeWindow: 60 * 1000 } },
      schema: { body: LeadCreateSchema, response: { 200: LeadCreateResponseSchema } },
    },
    async (req) => leadsService.create(req.body),
  );

  app.get(
    "/",
    {
      preHandler: [requirePermission("leads:read")],
      schema: { querystring: LeadListQuerySchema, response: { 200: LeadListResponseSchema } },
    },
    async (req) => leadsService.list(actor(req), req.query),
  );

  /**
   * #4 W4 — avanzamento dello stato di una richiesta di contatto.
   * `leads:update` (stesso pubblico di `leads:read`, mig 000232) + CSRF come ogni mutazione.
   */
  app.patch(
    "/:leadId",
    {
      preHandler: [app.verifyCsrf, requirePermission("leads:update")],
      schema: {
        params: LeadIdParamSchema,
        body: LeadUpdateSchema,
        response: { 200: LeadResponseSchema },
      },
    },
    async (req) => leadsService.updateStatus(actor(req), req.params.leadId, req.body),
  );
};
