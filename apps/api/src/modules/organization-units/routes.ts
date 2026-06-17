/**
 * apps/api/src/modules/organization-units/routes.ts
 * 5 endpoints under /v1/organization-units.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  OrganizationUnitSchema,
  OrganizationUnitListQuerySchema,
  OrganizationUnitListResponseSchema,
  CreateOrganizationUnitBodySchema,
  UpdateOrganizationUnitBodySchema,
  OrganizationUnitIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { organizationUnitsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const organizationUnitsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("organization_unit:read")],
    schema: { querystring: OrganizationUnitListQuerySchema, response: { 200: OrganizationUnitListResponseSchema } },
  }, async (req) => organizationUnitsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("organization_unit:read")],
    schema: { params: OrganizationUnitIdParamSchema, response: { 200: OrganizationUnitSchema } },
  }, async (req) => organizationUnitsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("organization_unit:create")],
    schema: { body: CreateOrganizationUnitBodySchema, response: { 201: OrganizationUnitSchema } },
  }, async (req, reply) => {
    const ou = await organizationUnitsService.create(actor(req), req.body);
    reply.code(201).send(ou);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("organization_unit:update")],
    schema: { params: OrganizationUnitIdParamSchema, body: UpdateOrganizationUnitBodySchema, response: { 200: OrganizationUnitSchema } },
  }, async (req) => organizationUnitsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("organization_unit:delete")],
    schema: { params: OrganizationUnitIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await organizationUnitsService.softDelete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
