/**
 * apps/api/src/modules/brownfield-table-mappings/routes.ts
 * 3 endpoints: list/get/PATCH-decide.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  BrownfieldTableMappingSchema, BrownfieldTableMappingListQuerySchema,
  BrownfieldTableMappingListResponseSchema, ApproveBrownfieldTableMappingBodySchema,
  BrownfieldTableMappingIdParamSchema,
} from "@heuresys/shared";
import { brownfieldTableMappingsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const brownfieldTableMappingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: { querystring: BrownfieldTableMappingListQuerySchema, response: { 200: BrownfieldTableMappingListResponseSchema } },
  }, async (req) => brownfieldTableMappingsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: { params: BrownfieldTableMappingIdParamSchema, response: { 200: BrownfieldTableMappingSchema } },
  }, async (req) => brownfieldTableMappingsService.getById(actor(req), req.params.id));
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("brownfield_adaptation:approve")],
    schema: { params: BrownfieldTableMappingIdParamSchema, body: ApproveBrownfieldTableMappingBodySchema, response: { 200: BrownfieldTableMappingSchema } },
  }, async (req) => brownfieldTableMappingsService.decide(actor(req), req.params.id, req.body));
};
