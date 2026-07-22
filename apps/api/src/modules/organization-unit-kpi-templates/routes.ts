/**
 * apps/api/src/modules/organization-unit-kpi-templates/routes.ts
 * Gated by dedicated `organization_unit_kpi_template:*` permissions (000199,
 * #61 G2) — previously proxied on `bpm_process:*`; audience unchanged.
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  OrganizationUnitKpiTemplateSchema, OrganizationUnitKpiTemplateListQuerySchema,
  OrganizationUnitKpiTemplateListResponseSchema, UpsertOrganizationUnitKpiTemplateBodySchema,
  OrganizationUnitKpiTemplateIdParamSchema,
} from "@heuresys/shared";
import { organizationUnitKpiTemplatesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const organizationUnitKpiTemplatesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("organization_unit_kpi_template:read")],
    schema: { querystring: OrganizationUnitKpiTemplateListQuerySchema, response: { 200: OrganizationUnitKpiTemplateListResponseSchema } },
  }, async (req) => organizationUnitKpiTemplatesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("organization_unit_kpi_template:read")],
    schema: { params: OrganizationUnitKpiTemplateIdParamSchema, response: { 200: OrganizationUnitKpiTemplateSchema } },
  }, async (req) => organizationUnitKpiTemplatesService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("organization_unit_kpi_template:update")],
    schema: { body: UpsertOrganizationUnitKpiTemplateBodySchema, response: { 200: OrganizationUnitKpiTemplateSchema } },
  }, async (req) => organizationUnitKpiTemplatesService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("organization_unit_kpi_template:delete")],
    schema: { params: OrganizationUnitKpiTemplateIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await organizationUnitKpiTemplatesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
