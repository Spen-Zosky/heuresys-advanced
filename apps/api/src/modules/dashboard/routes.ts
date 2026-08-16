/**
 * apps/api/src/modules/dashboard/routes.ts
 * 1 endpoint: GET /v1/dashboard/widgets (role-gated).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import { z } from "zod";
import {
  DashboardCatalogResponseSchema,
  DashboardDetailResponseSchema,
  DashboardWidgetsResponseSchema,
} from "@heuresys/shared";
import { dashboardService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/widgets", {
    preHandler: [requirePermission("dashboard:view")],
    schema: { response: { 200: DashboardWidgetsResponseSchema } },
  }, async (req) => dashboardService.getWidgets(actor(req)));

  // #142 F3a — il catalogo. SENZA `requirePermission`, e la ragione sta nel modello: non
  // esiste UN permesso per «vedere il catalogo». Ogni famiglia porta il proprio e il
  // Self-Service non ne ha (I17), quindi il filtro è per-riga dentro il service e ciò che
  // esce è già solo dell'attore. Un permesso unico qui sarebbe una porta in più da tenere
  // allineata alle otto vere — e il giorno che divergesse, nessuna delle due sarebbe fidata.
  app.get("/catalog", {
    schema: { response: { 200: DashboardCatalogResponseSchema } },
  }, async (req) => dashboardService.getCatalog(actor(req)));

  app.get("/catalog/:code", {
    schema: {
      params: z.object({ code: z.string().min(1).max(48) }),
      response: { 200: DashboardDetailResponseSchema },
    },
  }, async (req) => dashboardService.getDashboard(actor(req), req.params.code));
};
