/**
 * apps/api/src/modules/organization-unit-kpi-templates/routes.ts
 */
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  OrganizationUnitKpiTemplateSchema, OrganizationUnitKpiTemplateListQuerySchema,
  OrganizationUnitKpiTemplateListResponseSchema, UpsertOrganizationUnitKpiTemplateBodySchema,
  OrganizationUnitKpiTemplateIdParamSchema,
} from "@heuresys/shared";
import { organizationUnitKpiTemplatesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const organizationUnitKpiTemplatesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("bpm_process:read")],
    schema: { querystring: OrganizationUnitKpiTemplateListQuerySchema, response: { 200: OrganizationUnitKpiTemplateListResponseSchema } },
  }, async (req) => organizationUnitKpiTemplatesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("bpm_process:read")],
    schema: { params: OrganizationUnitKpiTemplateIdParamSchema, response: { 200: OrganizationUnitKpiTemplateSchema } },
  }, async (req) => organizationUnitKpiTemplatesService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("bpm_process:update")],
    schema: { body: UpsertOrganizationUnitKpiTemplateBodySchema, response: { 200: OrganizationUnitKpiTemplateSchema } },
  }, async (req) => organizationUnitKpiTemplatesService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("bpm_process:update")],
    schema: { params: OrganizationUnitKpiTemplateIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await organizationUnitKpiTemplatesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
