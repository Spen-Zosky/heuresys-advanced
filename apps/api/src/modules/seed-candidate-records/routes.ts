/**
 * apps/api/src/modules/seed-candidate-records/routes.ts
 * 4 endpoint in sola lettura: i record, il singolo record, la sua istruttoria
 * e le sue fonti.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  SeedCandidateRecordSchema, SeedCandidateRecordListQuerySchema,
  SeedCandidateRecordListResponseSchema, SeedCandidateRecordIdParamSchema,
  SeedValidationResultListResponseSchema, SeedSourceEvidenceListResponseSchema,
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

  // L'ISTRUTTORIA e le FONTI: due tabelle che si scrivevano e che nessuna API
  // leggeva. Sono la parte che dà valore probatorio alla pipeline — senza,
  // l'approvazione di un record è una firma senza istruttoria.
  app.get("/:id/validations", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: {
      params: SeedCandidateRecordIdParamSchema,
      response: { 200: SeedValidationResultListResponseSchema },
    },
  }, async (req) => seedCandidateRecordsService.validations(actor(req), req.params.id));

  app.get("/:id/evidence", {
    preHandler: [requirePermission("seed_acquisition:read")],
    schema: {
      params: SeedCandidateRecordIdParamSchema,
      response: { 200: SeedSourceEvidenceListResponseSchema },
    },
  }, async (req) => seedCandidateRecordsService.evidence(actor(req), req.params.id));
};
