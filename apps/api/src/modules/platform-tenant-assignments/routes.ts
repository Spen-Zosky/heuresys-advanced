/**
 * apps/api/src/modules/platform-tenant-assignments/routes.ts — mandato K, R-0 (D9=B, passo 37).
 *
 * Tre rotte: elencare, assegnare, revocare. **Non esiste una DELETE**: un'assegnazione non si
 * cancella, si revoca (`platform_user_tenant_assignment_revoked_at`, ADR-0035) — la storia di
 * chi ha visto quale cliente resta leggibile.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  CreatePlatformTenantAssignmentBodySchema,
  PlatformTenantAssignmentIdParamSchema,
  PlatformTenantAssignmentListQuerySchema,
  PlatformTenantAssignmentListResponseSchema,
  PlatformTenantAssignmentSchema,
} from "@heuresys/shared";
import { platformTenantAssignmentsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const platformTenantAssignmentsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("platform_tenant_assignment:manage")],
    schema: {
      querystring: PlatformTenantAssignmentListQuerySchema,
      response: { 200: PlatformTenantAssignmentListResponseSchema },
    },
  }, async (req) => platformTenantAssignmentsService.list(req.query));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("platform_tenant_assignment:manage")],
    schema: {
      body: CreatePlatformTenantAssignmentBodySchema,
      response: { 201: PlatformTenantAssignmentSchema },
    },
  }, async (req, reply) => {
    const creata = await platformTenantAssignmentsService.create(actor(req), req.body);
    return reply.code(201).send(creata);
  });

  app.post("/:id/revoke", {
    preHandler: [app.verifyCsrf, requirePermission("platform_tenant_assignment:manage")],
    schema: {
      params: PlatformTenantAssignmentIdParamSchema,
      response: { 200: PlatformTenantAssignmentSchema },
    },
  }, async (req) => platformTenantAssignmentsService.revoke(req.params.id));
};
