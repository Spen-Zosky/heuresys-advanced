/**
 * apps/api/src/modules/assessment-methods/routes.ts
 * 1 endpoint under /v1/assessment-methods — GET list, read-only catalog.
 * Reuses assessment:read permission.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import { AssessmentMethodListResponseSchema } from "@heuresys/shared";
import { assessmentMethodsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const assessmentMethodsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("assessment:read")],
    schema: { response: { 200: AssessmentMethodListResponseSchema } },
  }, async (req) => assessmentMethodsService.list(actor(req)));
};
