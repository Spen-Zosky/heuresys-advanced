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
  LeadListResponseSchema,
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
    { preHandler: [requirePermission("leads:read")], schema: { response: { 200: LeadListResponseSchema } } },
    async (req) => leadsService.list(actor(req)),
  );
};
