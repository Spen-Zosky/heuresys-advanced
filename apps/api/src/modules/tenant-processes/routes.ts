/**
 * apps/api/src/modules/tenant-processes/routes.ts — 2 rotte: lettura di un processo del tenant e
 * cambio del suo responsabile. ADR-0060, piano delle applet, voce P3.
 */
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  TenantProcessIdParamSchema, TenantProcessSchema,
  UpdateTenantProcessOwnerBodySchema, UpdateTenantProcessOwnerResponseSchema,
} from "@heuresys/shared";
import { tenantProcessesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const tenantProcessesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/:id", {
    preHandler: [requirePermission("bpm_process:read")],
    schema: { params: TenantProcessIdParamSchema, response: { 200: TenantProcessSchema } },
  }, async (req) => tenantProcessesService.getById(actor(req), req.params.id));

  app.patch("/:id/owner", {
    preHandler: [app.verifyCsrf, requirePermission("bpm_process:update")],
    schema: {
      params: TenantProcessIdParamSchema,
      body: UpdateTenantProcessOwnerBodySchema,
      response: { 200: UpdateTenantProcessOwnerResponseSchema },
    },
  }, async (req) => tenantProcessesService.updateOwner(actor(req), req.params.id, req.body));
};
