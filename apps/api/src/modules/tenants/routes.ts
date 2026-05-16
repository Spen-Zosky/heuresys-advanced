/**
 * apps/api/src/modules/tenants/routes.ts
 * 5 endpoints under /v1/tenants with Zod validation, RBAC enforcement,
 * CSRF opt-in on mutations, and scope filters delegated to the service.
 *
 * Per API_IMPLEMENTATION_PLAN §6.2 + AUTH_SECURITY_PLAN §6 matrix.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  TenantSchema,
  TenantListQuerySchema,
  TenantListResponseSchema,
  CreateTenantBodySchema,
  UpdateTenantBodySchema,
  TenantIdParamSchema,
} from "@heuresys/shared";
import { EmptyResponseSchema } from "@heuresys/shared";
import { tenantsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actorFromReq(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return {
    userId: req.user.userId,
    tenantId: req.user.tenantId,
    roles: req.user.roles,
  };
}

export const tenantsRoutes: FastifyPluginAsyncZod = async (app) => {
  /* --- GET /v1/tenants --------------------------------------------- */
  app.get(
    "/",
    {
      preHandler: [requirePermission("tenant:read")],
      schema: {
        querystring: TenantListQuerySchema,
        response: { 200: TenantListResponseSchema },
      },
    },
    async (req) => tenantsService.list(actorFromReq(req), req.query),
  );

  /* --- GET /v1/tenants/:id ----------------------------------------- */
  app.get(
    "/:id",
    {
      preHandler: [requirePermission("tenant:read")],
      schema: {
        params: TenantIdParamSchema,
        response: { 200: TenantSchema },
      },
    },
    async (req) => tenantsService.getById(actorFromReq(req), req.params.id),
  );

  /* --- POST /v1/tenants -------------------------------------------- */
  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("tenant:create")],
      schema: {
        body: CreateTenantBodySchema,
        response: { 201: TenantSchema },
      },
    },
    async (req, reply) => {
      const tenant = await tenantsService.create(actorFromReq(req), req.body);
      reply.code(201).send(tenant);
    },
  );

  /* --- PATCH /v1/tenants/:id --------------------------------------- */
  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("tenant:update")],
      schema: {
        params: TenantIdParamSchema,
        body: UpdateTenantBodySchema,
        response: { 200: TenantSchema },
      },
    },
    async (req) =>
      tenantsService.update(actorFromReq(req), req.params.id, req.body),
  );

  /* --- DELETE /v1/tenants/:id (soft delete → ARCHIVED) -------------- */
  app.delete(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("tenant:delete")],
      schema: {
        params: TenantIdParamSchema,
        response: { 204: EmptyResponseSchema },
      },
    },
    async (req, reply) => {
      await tenantsService.archive(actorFromReq(req), req.params.id);
      reply.code(204).send();
    },
  );
};
