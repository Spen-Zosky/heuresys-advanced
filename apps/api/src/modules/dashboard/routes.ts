/**
 * apps/api/src/modules/dashboard/routes.ts
 * 4 endpoint: GET /v1/dashboard/widgets (role-gated) · /catalog · /catalog/:code
 * · /catalog/:code/data (#142 F3b — i dati dentro le viste).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import { z } from "zod";
import {
  DashboardCatalogResponseSchema,
  DashboardDataResponseSchema,
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

  // #142 F3b — i dati dentro le viste. Stessa assenza di `requirePermission` e stessa
  // ragione: il permesso e' quello della FAMIGLIA richiesta, quindi dipende dal parametro
  // e non puo' stare in un middleware statico. Il service lo applica e nega con `FORBIDDEN`,
  // lo stesso codice che `requirePermission` userebbe.
  app.get("/catalog/:code/data", {
    schema: {
      params: z.object({ code: z.string().min(1).max(48) }),
      response: { 200: DashboardDataResponseSchema },
    },
  }, async (req) => dashboardService.getDashboardData(actor(req), req.params.code));
};
