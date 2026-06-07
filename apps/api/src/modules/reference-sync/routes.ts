/**
 * apps/api/src/modules/reference-sync/routes.ts
 * /v1/reference-sync/* — cap⑤ official reference-data refresh (ESCO P1).
 *   GET  /sources    — registered official sources + latest run
 *   GET  /runs       — sync run history (run-level lineage)
 *   GET  /runs/:id   — single run
 *   POST /runs       — trigger a sync (reference_sync:trigger, CSRF)
 *
 * Reference taxonomies are GLOBAL platform infra → PLATFORM_ADMIN-only (no tenant
 * surface). The `deps` seam lets the integration suite inject a fixture fetcher.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  ReferenceSyncSourceListResponseSchema,
  ReferenceSyncRunListResponseSchema,
  ReferenceSyncRunSchema,
  ReferenceSyncRunIdParamSchema,
  ReferenceSyncTriggerBodySchema,
  ReferenceSyncTriggerResponseSchema,
} from "@heuresys/shared";
import { referenceSyncService, defaultDeps, type ActorContext, type ReferenceSyncDeps } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId };
}

export interface ReferenceSyncRoutesOptions {
  deps?: ReferenceSyncDeps;
}

export const referenceSyncRoutes: FastifyPluginAsyncZod<ReferenceSyncRoutesOptions> = async (app, opts) => {
  const deps = opts.deps ?? defaultDeps;

  app.get(
    "/sources",
    { preHandler: [requirePermission("reference_sync:read")], schema: { response: { 200: ReferenceSyncSourceListResponseSchema } } },
    async () => referenceSyncService.listSources(),
  );

  app.get(
    "/runs",
    { preHandler: [requirePermission("reference_sync:read")], schema: { response: { 200: ReferenceSyncRunListResponseSchema } } },
    async () => referenceSyncService.listRuns(),
  );

  app.get(
    "/runs/:id",
    {
      preHandler: [requirePermission("reference_sync:read")],
      schema: { params: ReferenceSyncRunIdParamSchema, response: { 200: ReferenceSyncRunSchema } },
    },
    async (req) => referenceSyncService.getRun(req.params.id),
  );

  app.post(
    "/runs",
    {
      preHandler: [app.verifyCsrf, requirePermission("reference_sync:trigger")],
      schema: { body: ReferenceSyncTriggerBodySchema, response: { 200: ReferenceSyncTriggerResponseSchema } },
    },
    async (req) => referenceSyncService.runEscoSync(actor(req), deps),
  );
};
