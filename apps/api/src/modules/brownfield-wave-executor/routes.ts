/**
 * apps/api/src/modules/brownfield-wave-executor/routes.ts
 * 5 endpoints under /v1/brownfield/wave-executor.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  TriggerWaveBodySchema,
  WaveExecutorRunSchema,
  WaveExecutorRunListQuerySchema,
  WaveExecutorRunListResponseSchema,
  WaveExecutorRunIdParamSchema,
  WaveAcceptanceReportSchema,
} from "@heuresys/shared";
import { brownfieldWaveExecutorService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const brownfieldWaveExecutorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/runs", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: {
      querystring: WaveExecutorRunListQuerySchema,
      response: { 200: WaveExecutorRunListResponseSchema },
    },
  }, async (req) => brownfieldWaveExecutorService.list(actor(req), req.query));

  app.get("/runs/:runId", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: {
      params: WaveExecutorRunIdParamSchema,
      response: { 200: WaveExecutorRunSchema },
    },
  }, async (req) => brownfieldWaveExecutorService.getById(actor(req), req.params.runId));

  app.post("/runs", {
    preHandler: [app.verifyCsrf, requirePermission("brownfield_adaptation:trigger")],
    schema: {
      body: TriggerWaveBodySchema,
      response: { 201: WaveExecutorRunSchema },
    },
  }, async (req, reply) => {
    const r = await brownfieldWaveExecutorService.trigger(actor(req), req.body);
    reply.code(201).send(r);
  });

  app.post("/runs/:runId/cancel", {
    preHandler: [app.verifyCsrf, requirePermission("brownfield_adaptation:trigger")],
    schema: {
      params: WaveExecutorRunIdParamSchema,
      response: { 200: WaveExecutorRunSchema },
    },
  }, async (req) => brownfieldWaveExecutorService.cancel(actor(req), req.params.runId));

  app.get("/runs/:runId/acceptance", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: {
      params: WaveExecutorRunIdParamSchema,
      response: { 200: WaveAcceptanceReportSchema },
    },
  }, async (req) => brownfieldWaveExecutorService.getAcceptance(actor(req), req.params.runId));
};
