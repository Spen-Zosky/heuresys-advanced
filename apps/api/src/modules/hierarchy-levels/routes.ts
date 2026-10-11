/**
 * apps/api/src/modules/hierarchy-levels/routes.ts
 * 1 endpoint di sola lettura sotto /v1/hierarchy-levels: il controllo del principio gerarchia-livelli (#265).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { HierarchyLevelsCheckQuerySchema, HierarchyLevelsCheckResponseSchema } from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { hierarchyLevelsService } from "./service.js";

export const hierarchyLevelsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/check", {
    preHandler: [requirePermission("organization_unit:read")],
    schema: { querystring: HierarchyLevelsCheckQuerySchema, response: { 200: HierarchyLevelsCheckResponseSchema } },
  }, async (req) => hierarchyLevelsService.check(actor(req), req.query));
};
