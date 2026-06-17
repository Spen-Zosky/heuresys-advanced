/**
 * apps/api/src/modules/brownfield-source-exports/routes.ts
 * 2 endpoints: list/get. Read-only.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  BrownfieldSourceExportSchema, BrownfieldSourceExportListQuerySchema,
  BrownfieldSourceExportListResponseSchema, BrownfieldSourceExportIdParamSchema,
} from "@heuresys/shared";
import { brownfieldSourceExportsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const brownfieldSourceExportsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: { querystring: BrownfieldSourceExportListQuerySchema, response: { 200: BrownfieldSourceExportListResponseSchema } },
  }, async (req) => brownfieldSourceExportsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: { params: BrownfieldSourceExportIdParamSchema, response: { 200: BrownfieldSourceExportSchema } },
  }, async (req) => brownfieldSourceExportsService.getById(actor(req), req.params.id));
};
