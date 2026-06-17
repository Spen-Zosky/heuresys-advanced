/**
 * apps/api/src/modules/assessment-methods/routes.ts
 * 1 endpoint under /v1/assessment-methods — GET list, read-only catalog.
 * Reuses assessment:read permission.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import { AssessmentMethodListResponseSchema } from "@heuresys/shared";
import { assessmentMethodsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const assessmentMethodsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("assessment:read")],
    schema: { response: { 200: AssessmentMethodListResponseSchema } },
  }, async (req) => assessmentMethodsService.list(actor(req)));
};
