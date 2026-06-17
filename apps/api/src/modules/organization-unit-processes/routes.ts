/**
 * apps/api/src/modules/organization-unit-processes/routes.ts
 * /v1/organization-unit-processes/* — T2.5 org-unit ↔ business-process assignment.
 * Writes = organization_unit_processes:create/delete + CSRF. Reads (by-ou / by-process) =
 * organization_unit_processes:read. RACI role on the assignment row. (Permission CODE is
 * snake_case per project convention — cf. reference_sync:read for module /v1/reference-sync.)
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { z } from "zod";

import {
  OrgUnitProcessSchema,
  OrgUnitProcessCreateSchema,
  OrgUnitProcessIdParamSchema,
  OrgUnitProcessByOuParamSchema,
  OrgUnitProcessByProcessParamSchema,
  OrgUnitProcessesForOuResponseSchema,
  OrgUnitProcessesForProcessResponseSchema,
} from "@heuresys/shared";
import { organizationUnitProcessService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

const DeleteResponse = z.object({ deleted: z.literal(true) });

export const organizationUnitProcessesRoutes: FastifyPluginAsyncZod = async (app) => {
  /* --- writes (create/delete + CSRF) --- */
  app.post(
    "/",
    { preHandler: [app.verifyCsrf, requirePermission("organization_unit_processes:create")], schema: { body: OrgUnitProcessCreateSchema, response: { 200: OrgUnitProcessSchema } } },
    async (req) => organizationUnitProcessService.createAssignment(actor(req), req.body),
  );
  app.delete(
    "/:id",
    { preHandler: [app.verifyCsrf, requirePermission("organization_unit_processes:delete")], schema: { params: OrgUnitProcessIdParamSchema, response: { 200: DeleteResponse } } },
    async (req) => { await organizationUnitProcessService.deleteAssignment(actor(req), req.params.id); return { deleted: true as const }; },
  );

  /* --- reads (organization-unit-processes:read) --- */
  app.get(
    "/by-ou/:ouId",
    { preHandler: [requirePermission("organization_unit_processes:read")], schema: { params: OrgUnitProcessByOuParamSchema, response: { 200: OrgUnitProcessesForOuResponseSchema } } },
    async (req) => organizationUnitProcessService.listForOu(actor(req), req.params.ouId),
  );
  app.get(
    "/by-process/:processId",
    { preHandler: [requirePermission("organization_unit_processes:read")], schema: { params: OrgUnitProcessByProcessParamSchema, response: { 200: OrgUnitProcessesForProcessResponseSchema } } },
    async (req) => organizationUnitProcessService.listForProcess(actor(req), req.params.processId),
  );
};
