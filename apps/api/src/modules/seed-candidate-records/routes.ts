/**
 * apps/api/src/modules/seed-candidate-records/routes.ts
 * 2 read-only endpoints.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  SeedCandidateRecordSchema, SeedCandidateRecordListQuerySchema,
  SeedCandidateRecordListResponseSchema, SeedCandidateRecordIdParamSchema,
} from "@heuresys/shared";
import { seedCandidateRecordsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const seedCandidateRecordsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { querystring: SeedCandidateRecordListQuerySchema, response: { 200: SeedCandidateRecordListResponseSchema } },
  }, async (req) => seedCandidateRecordsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: { params: SeedCandidateRecordIdParamSchema, response: { 200: SeedCandidateRecordSchema } },
  }, async (req) => seedCandidateRecordsService.getById(actor(req), req.params.id));
};
