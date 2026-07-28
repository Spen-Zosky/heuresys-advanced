/**
 * apps/api/src/modules/organization-unit-history/routes.ts
 * 3 endpoint sotto /v1/organization-unit-history (registro append-only).
 * Permessi: organization_unit:list/read per leggere, :update per registrare.
 */

import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  OrganizationUnitHistorySchema,
  OrganizationUnitHistoryListQuerySchema,
  OrganizationUnitHistoryListResponseSchema,
  CreateOrganizationUnitHistoryBodySchema,
  OrganizationUnitHistoryIdParamSchema,
} from "@heuresys/shared";
import { organizationUnitHistoryService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const organizationUnitHistoryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("organization_unit:list")],
    schema: {
      querystring: OrganizationUnitHistoryListQuerySchema,
      response: { 200: OrganizationUnitHistoryListResponseSchema },
    },
  }, async (req) => organizationUnitHistoryService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("organization_unit:read")],
    schema: {
      params: OrganizationUnitHistoryIdParamSchema,
      response: { 200: OrganizationUnitHistorySchema },
    },
  }, async (req) => organizationUnitHistoryService.getById(actor(req), req.params.id));

  // Append-only: si aggiunge, non si modifica. Non esistono PATCH né DELETE, ed
  // è una scelta: un riordino organizzativo avvenuto non si riscrive.
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("organization_unit:update")],
    schema: {
      body: CreateOrganizationUnitHistoryBodySchema,
      response: { 201: OrganizationUnitHistorySchema },
    },
  }, async (req, reply) => {
    const h = await organizationUnitHistoryService.create(actor(req), req.body);
    reply.code(201).send(h);
  });
};
