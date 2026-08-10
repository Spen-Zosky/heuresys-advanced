/**
 * apps/api/src/modules/calibration-sessions/routes.ts — /v1/calibration-sessions/*
 * (#92 passo 3/7). READ-only: le 35 sessioni reali di RTL Bank.
 * Sessione = meta di tenant (orgGate "catalog"); discussioni = EVALUATION
 * per-persona (orgGate "service"). Permesso: `performance-review:read`;
 * `calibration:manage` restera' alle scritture (passo 4).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  CalibrationSessionListQuerySchema, CalibrationSessionListResponseSchema,
  CalibrationSessionParamSchema, CalibrationSessionDetailSchema,
  CalibrationDiscussionListResponseSchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { calibrationSessionsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const calibrationSessionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("performance-review:read")],
    schema: {
      querystring: CalibrationSessionListQuerySchema,
      response: { 200: CalibrationSessionListResponseSchema },
    },
  }, async (req) => calibrationSessionsService.list(actor(req), req.query));

  app.get("/:sessionId", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("performance-review:read")],
    schema: {
      params: CalibrationSessionParamSchema,
      response: { 200: CalibrationSessionDetailSchema },
    },
  }, async (req) => calibrationSessionsService.getById(actor(req), req.params.sessionId));

  app.get("/:sessionId/discussions", {
    config: { orgGate: "service" },
    preHandler: [requirePermission("performance-review:read")],
    schema: {
      params: CalibrationSessionParamSchema,
      response: { 200: CalibrationDiscussionListResponseSchema },
    },
  }, async (req) => calibrationSessionsService.listDiscussions(actor(req), req.params.sessionId));
};
