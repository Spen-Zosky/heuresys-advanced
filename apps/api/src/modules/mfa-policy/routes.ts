/**
 * apps/api/src/modules/mfa-policy/routes.ts
 * /v1/mfa-policy/* — per-tenant mandatory-MFA policy (MVP-4 par.2.5 #4).
 * Read = mfa_policy:read, write = mfa_policy:manage + CSRF (both seeded to
 * PLATFORM_ADMIN + TENANT_ADMIN only, mig 000104).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  ListMfaPoliciesResponseSchema,
  UpsertMfaPolicyParamsSchema,
  UpsertMfaPolicyBodySchema,
  UpsertMfaPolicyResponseSchema,
} from "@heuresys/shared";
import { mfaPolicyService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const mfaPolicyRoutes: FastifyPluginAsyncZod = async (app) => {
  /* --- GET / — list (PLATFORM all tenants, TENANT_ADMIN own) ---------- */
  app.get(
    "/",
    {
      preHandler: [requirePermission("mfa_policy:read")],
      schema: { response: { 200: ListMfaPoliciesResponseSchema } },
    },
    async (req) => mfaPolicyService.list(actor(req)),
  );

  /* --- PUT /:tenantId — idempotent upsert ----------------------------- */
  app.put(
    "/:tenantId",
    {
      preHandler: [app.verifyCsrf, requirePermission("mfa_policy:manage")],
      schema: {
        params: UpsertMfaPolicyParamsSchema,
        body: UpsertMfaPolicyBodySchema,
        response: { 200: UpsertMfaPolicyResponseSchema },
      },
    },
    async (req) =>
      mfaPolicyService.upsert(actor(req), req.params.tenantId, {
        enabled: req.body.enabled,
        roleCodes: req.body.roleCodes,
      }),
  );
};
