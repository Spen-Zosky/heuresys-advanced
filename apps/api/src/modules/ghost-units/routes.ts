/**
 * apps/api/src/modules/ghost-units/routes.ts
 * 4 endpoint sotto /v1/ghost-units (ADR-0063 D2, voce G1 del piano AI-driven).
 * Permessi: organization_unit:list per leggere, organization_unit:update per riformare.
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
    preHandler: [requirePermission("organization_unit:list")],
    schema: {
      querystring: GhostUnitsQuerySchema,
      response: { 200: GhostUnitsResponseSchema },
    },
  }, async (req) => ghostUnitsService.list(actor(req), req.query.tenantId));

  app.get("/storia", {
    preHandler: [requirePermission("organization_unit:list")],
    schema: {
      querystring: GhostUnitsQuerySchema,
      response: { 200: GhostUnitsHistoryResponseSchema },
    },
  }, async (req) => ghostUnitsService.history(actor(req), req.query.tenantId));

  // La deriva voce per voce: che cosa cambierebbe una riforma, prima di chiederla.
  app.get("/deriva", {
    preHandler: [requirePermission("organization_unit:list")],
    schema: {
      querystring: GhostUnitsQuerySchema,
      response: { 200: GhostDriftResponseSchema },
    },
  }, async (req) => ghostUnitsService.drift(actor(req), req.query.tenantId));

  // La riforma non inventa niente: riallinea la storia all'albero vivo, e se l'albero non è
  // cambiato non scrive niente. Per questo basta il permesso di aggiornare l'organigramma.
  app.post("/riforma", {
    preHandler: [app.verifyCsrf, requirePermission("organization_unit:update")],
    schema: {
      body: GhostRiformaBodySchema,
      response: { 200: GhostRiformaResponseSchema },
    },
  }, async (req) => ghostUnitsService.riforma(actor(req), req.body.tenantId));
};
