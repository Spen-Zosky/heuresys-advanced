/**
 * apps/api/src/modules/tenant-materialization/routes.ts
 * #4 WI-C — POST /v1/tenant-materialization (plan|apply) + GET /sources.
 * POST returns 200 (idempotent generate/apply, not a single-resource create).
 *
 * G2 (#61): the POST now also carries `tenant_materialization:execute`. It was
 * NOT unprotected before — the service calls ensurePlatformAdmin — but the gate
 * lived only there, so the RBAC matrix (what /admin/roles presents as the truth
 * on who can do what) never mentioned this endpoint. The permission is granted
 * to exactly PLATFORM_ADMIN, i.e. who the service already admitted: no change in
 * access, defense-in-depth at the middleware plus an honest matrix.
 *
 * GET /sources stays open to any authenticated caller. Gating it would RESTRICT
 * access that is allowed today — a behaviour change, outside the "make the matrix
 * honest" remit.
 *
 * ⚠ La rotta si chiamava `/archetypes` ed elencava un catalogo STATICO scritto in
 * TypeScript. Con #132 F3 (E29) quel catalogo non esiste piu': l'elenco si legge dal
 * database, ed e' quello dei MODELLI che hanno davvero del contenuto. Il nome vecchio
 * non e' stato tenuto come sinonimo di proposito — un alias che risponde con un'altra
 * cosa e' il modo piu' rapido per far credere che l'archetipo esista ancora.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";

import {
  MaterializeRequestBodySchema,
  MaterializeResultSchema,
  BuildSourceListResponseSchema,
} from "@heuresys/shared";
import { tenantMaterializationService } from "./service.js";

export const tenantMaterializationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/sources", {
    schema: { response: { 200: BuildSourceListResponseSchema } },
  }, async (req) => tenantMaterializationService.listSources(actor(req)));

  app.post("/", {
    preHandler: [
      app.verifyCsrf,
      // Keeps the service's published denial code: the middleware now denies
      // first, and a bare ForbiddenError would have downgraded the documented
      // TENANT_MATERIALIZE_ADMIN_ONLY to a generic FORBIDDEN — a silent break
      // for any client branching on error.code.
      requirePermission("tenant_materialization:execute", "TENANT_MATERIALIZE_ADMIN_ONLY"),
    ],
    schema: { body: MaterializeRequestBodySchema, response: { 200: MaterializeResultSchema } },
  }, async (req) => tenantMaterializationService.materialize(actor(req), req.body));
};
