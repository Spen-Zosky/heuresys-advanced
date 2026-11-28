/**
 * apps/api/src/modules/ghost-units/routes.ts
 * 4 endpoint sotto /v1/ghost-units (ADR-0063 D2, voce G1 del piano AI-driven).
 * Permessi ghost_unit:read per leggere e ghost_unit:reform per riformare (000526): per ora dei soli
 * ruoli PLATFORM_ADMIN e HRMS_MANAGER, per decisione di Enzo del 2026-11-28.
 */

import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  GhostDriftResponseSchema,
  GhostRiformaBodySchema,
  GhostRiformaResponseSchema,
  GhostUnitsHistoryResponseSchema,
  GhostUnitsQuerySchema,
  GhostUnitsResponseSchema,
} from "@heuresys/shared";
import { ghostUnitsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const ghostUnitsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("ghost_unit:read")],
    schema: {
      querystring: GhostUnitsQuerySchema,
      response: { 200: GhostUnitsResponseSchema },
    },
  }, async (req) => ghostUnitsService.list(actor(req), req.query.tenantId));

  app.get("/storia", {
    preHandler: [requirePermission("ghost_unit:read")],
    schema: {
      querystring: GhostUnitsQuerySchema,
      response: { 200: GhostUnitsHistoryResponseSchema },
    },
  }, async (req) => ghostUnitsService.history(actor(req), req.query.tenantId));

  // La deriva voce per voce: che cosa cambierebbe una riforma, prima di chiederla.
  app.get("/deriva", {
    preHandler: [requirePermission("ghost_unit:read")],
    schema: {
      querystring: GhostUnitsQuerySchema,
      response: { 200: GhostDriftResponseSchema },
    },
  }, async (req) => ghostUnitsService.drift(actor(req), req.query.tenantId));

  // La riforma non inventa niente: riallinea la storia all'albero vivo, e se l'albero non è
  // cambiato non scrive niente.
  app.post("/riforma", {
    preHandler: [app.verifyCsrf, requirePermission("ghost_unit:reform")],
    schema: {
      body: GhostRiformaBodySchema,
      response: { 200: GhostRiformaResponseSchema },
    },
  }, async (req) => ghostUnitsService.riforma(actor(req), req.body.tenantId));
};
