/**
 * apps/api/src/modules/tenant-materialization/routes.ts
 * #4 WI-C — POST /v1/tenant-materialization (plan|apply) + GET /archetypes.
 * Read open (any authenticated); the materialize POST is service-gated to PLATFORM_ADMIN
 * (no granular permission in the seed, like job-families) + CSRF on the mutation.
 * POST returns 200 (idempotent generate/apply, not a single-resource create).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  MaterializeRequestBodySchema,
  MaterializeResultSchema,
  ArchetypeListResponseSchema,
} from "@heuresys/shared";
import { tenantMaterializationService } from "./service.js";

export const tenantMaterializationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/archetypes", {
    schema: { response: { 200: ArchetypeListResponseSchema } },
  }, async (req) => tenantMaterializationService.listArchetypes(actor(req)));

  app.post("/", {
    preHandler: [app.verifyCsrf],
    schema: { body: MaterializeRequestBodySchema, response: { 200: MaterializeResultSchema } },
  }, async (req) => tenantMaterializationService.materialize(actor(req), req.body));
};
