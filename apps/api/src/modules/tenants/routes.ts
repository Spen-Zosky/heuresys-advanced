/**
 * apps/api/src/modules/tenants/routes.ts
 * 5 endpoints under /v1/tenants with Zod validation, RBAC enforcement,
 * CSRF opt-in on mutations, and scope filters delegated to the service.
 *
 * Per API_IMPLEMENTATION_PLAN §6.2 + AUTH_SECURITY_PLAN §6 matrix.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actorFromReq } from "../../lib/actor.js";

import {
  TenantSchema,
  TenantListQuerySchema,
  TenantListResponseSchema,
  CreateTenantBodySchema,
  UpdateTenantBodySchema,
  TenantIdParamSchema,
  IndustryCodeListResponseSchema,
} from "@heuresys/shared";
import { EmptyResponseSchema } from "@heuresys/shared";
import { ProvisionTenantBodySchema, ProvisionTenantResponseSchema } from "@heuresys/shared";
import { tenantsService } from "./service.js";
import { provisionTenant } from "./provisioning.js";
import { requirePermission } from "../../middleware/rbac.js";
import { env } from "../../config/env.js";
import { ForbiddenError } from "../../errors/index.js";

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

  /* --- GET /v1/tenants/industry-codes ------------------------------- */
  /* Dichiarata PRIMA di `/:id` per leggibilità (la rotta statica vince comunque sul
     parametro). È il dominio ammesso per `tenantIndustryCode`: senza di essa il
     catalogo restava popolato ma invisibile a ogni client. D-83 / #79. */
  app.get(
    "/industry-codes",
    {
      preHandler: [requirePermission("tenant:read")],
      schema: {
        response: { 200: IndustryCodeListResponseSchema },
      },
    },
    async () => ({ items: await tenantsService.industryCodes() }),
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

  /* --- POST /v1/tenants/provision (D-14) — zero-to-operational -------- */
  app.post(
    "/provision",
    {
      preHandler: [app.verifyCsrf, requirePermission("tenant:create")],
      schema: {
        body: ProvisionTenantBodySchema,
        response: { 201: ProvisionTenantResponseSchema },
      },
    },
    async (req, reply) => {
      // D-14 F2: kill-switch (default ON; env TENANT_PROVISION_ENABLED=false
      // disables the whole endpoint without a deploy).
      if (!env.TENANT_PROVISION_ENABLED) {
        throw new ForbiddenError("Tenant provisioning is disabled", "FEATURE_DISABLED");
      }
      const result = await provisionTenant(actorFromReq(req), req.body);
      reply.code(201).send(result);
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
      reply.code(204).send({});
    },
  );
};
