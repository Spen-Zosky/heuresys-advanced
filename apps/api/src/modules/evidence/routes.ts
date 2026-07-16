/**
 * apps/api/src/modules/evidence/routes.ts — /v1/evidence/* (#27, S1018).
 * The explainability wedge: per-subject and per-score evidence drill-down.
 * SENSITIVE (EVALUATION/SKILL) → orgGate service (data-classes: evidence).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  EvidenceSubjectQuerySchema, EvidenceListResponseSchema,
  EvidenceForScoreQuerySchema, EvidenceForScoreResponseSchema,
} from "@heuresys/shared";
import { evidenceService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const evidenceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/subject/:userId", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("evidence:read")],
    schema: {
      params: z.object({ userId: z.uuid() }),
      querystring: EvidenceSubjectQuerySchema,
      response: { 200: EvidenceListResponseSchema },
    },
  }, async (req) => evidenceService.listForSubject(actor(req), req.params.userId, req.query.types, req.query.limit, req.query.offset));

  app.get("/for-score", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("evidence:read")],
    schema: { querystring: EvidenceForScoreQuerySchema, response: { 200: EvidenceForScoreResponseSchema } },
  }, async (req) => evidenceService.forScore(actor(req), req.query.scoreType, req.query.scoreId));
};
