/**
 * apps/api/src/modules/notifications/routes.ts
 * POST /v1/notifications — admin SYSTEM broadcast (notification:create + CSRF).
 * The per-user inbox + preferences live under /v1/me/* (self-scope).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import { BroadcastNotificationBodySchema, BroadcastNotificationResponseSchema } from "@heuresys/shared";
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
};
