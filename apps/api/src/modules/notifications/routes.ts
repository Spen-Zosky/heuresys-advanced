/**
 * apps/api/src/modules/notifications/routes.ts
 * POST /v1/notifications            — admin SYSTEM broadcast (notification:create + CSRF).
 * GET  /v1/notifications/broadcasts — audit of sent broadcasts (#74, ex D-70).
 *                                     Mandato K, R-9 (2026-09-17): spezzato da
 *                                     notification:create a notification:read, perché un
 *                                     ruolo di sola lettura (PLATFORM_OPERATOR) non deve
 *                                     poter anche inviare broadcast. notification:read è
 *                                     concesso anche a chi aveva già notification:create
 *                                     (PLATFORM_ADMIN, HRMS_MANAGER, TENANT_ADMIN, mig.
 *                                     000422), quindi nessuno perde l'audit che già aveva.
 * The per-user inbox + preferences live under /v1/me/* (self-scope).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  BroadcastNotificationBodySchema,
  BroadcastNotificationResponseSchema,
  ListBroadcastsQuerySchema,
  ListBroadcastsResponseSchema,
} from "@heuresys/shared";
import { notificationsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const notificationsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("notification:create")],
      schema: { body: BroadcastNotificationBodySchema, response: { 200: BroadcastNotificationResponseSchema } },
    },
    async (req) => notificationsService.broadcast(actor(req), req.body),
  );

  app.get(
    "/broadcasts",
    {
      preHandler: [requirePermission("notification:read")],
      schema: { querystring: ListBroadcastsQuerySchema, response: { 200: ListBroadcastsResponseSchema } },
    },
    async (req) => notificationsService.listBroadcasts(actor(req), req.query),
  );
};
