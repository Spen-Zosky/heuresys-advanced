/**
 * apps/api/src/modules/interview-feedback/routes.ts
 * 4 rotte sotto /v1/interview-feedback (#54 F3, sesta fetta).
 *
 * Permesso proprio del dominio colloquio (`interview:feedback`, stesso di `interviews/routes.ts`
 * — mandato K, R-10, 2026-09-19, mig. 000427), separato da `job-requisition:*`.
 *
 * ⚠ Nessuna DELETE, e qui la ragione è più forte che altrove: una valutazione è **il fatto
 * che una persona si è espressa** su un candidato, e su quel giudizio si decide
 * un'assunzione. Cancellarla toglierebbe la traccia di chi ha detto cosa proprio nel punto
 * in cui l'attribuzione conta. Una valutazione sbagliata si **corregge** con PATCH, che
 * lascia `updated_by` e `updated_at`.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  InterviewFeedbackSchema,
  InterviewFeedbackListQuerySchema,
  InterviewFeedbackListResponseSchema,
  InterviewFeedbackCreateBodySchema,
  InterviewFeedbackUpdateBodySchema,
  InterviewFeedbackIdParamSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { interviewFeedbackService } from "./service.js";

export const interviewFeedbackRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    {
      preHandler: [requirePermission("interview:feedback")],
      schema: {
        querystring: InterviewFeedbackListQuerySchema,
        response: { 200: InterviewFeedbackListResponseSchema },
      },
    },
    async (req) => interviewFeedbackService.list(actor(req), req.query),
  );

  app.get(
    "/:id",
    {
      preHandler: [requirePermission("interview:feedback")],
      schema: {
        params: InterviewFeedbackIdParamSchema,
        response: { 200: InterviewFeedbackSchema },
      },
    },
    async (req) => interviewFeedbackService.getById(actor(req), req.params.id),
  );

  app.post(
    "/",
    {
      preHandler: [app.verifyCsrf, requirePermission("interview:feedback")],
      schema: {
        body: InterviewFeedbackCreateBodySchema,
        response: { 201: InterviewFeedbackSchema },
      },
    },
    async (req, reply) => {
      const creato = await interviewFeedbackService.create(actor(req), req.body);
      reply.code(201).send(creato);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: [app.verifyCsrf, requirePermission("interview:feedback")],
      schema: {
        params: InterviewFeedbackIdParamSchema,
        body: InterviewFeedbackUpdateBodySchema,
        response: { 200: InterviewFeedbackSchema },
      },
    },
    async (req) => interviewFeedbackService.update(actor(req), req.params.id, req.body),
  );
};
