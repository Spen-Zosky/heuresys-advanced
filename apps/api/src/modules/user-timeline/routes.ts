/**
 * apps/api/src/modules/user-timeline/routes.ts
 * D5 (#49) — 2 GET sotto /v1/user-timeline. Nessuna scrittura: la storia si
 * importa, non si redige.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  UserTimelineListQuerySchema,
  UserTimelineListResponseSchema,
  UserTimelineSummaryResponseSchema,
} from "@heuresys/shared";
import { userTimelineService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const userTimelineRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("timeline:read")],
    schema: {
      querystring: UserTimelineListQuerySchema,
      response: { 200: UserTimelineListResponseSchema },
    },
  }, async (req) => userTimelineService.list(actor(req), req.query));

  app.get("/summary", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("timeline:read")],
    schema: {
      querystring: UserTimelineListQuerySchema,
      response: { 200: UserTimelineSummaryResponseSchema },
    },
  }, async (req) => userTimelineService.summary(actor(req), req.query));
};
