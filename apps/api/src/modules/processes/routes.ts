/**
 * apps/api/src/modules/processes/routes.ts
 * /v1/processes — i processi del tenant (livello 1 e 2) e la scheda strutturata di ciascuno:
 * attività, unità con il loro ruolo e le persone, KPI, competenze, approvazioni, progetti (V4).
 * Sola lettura, con il permesso delle partecipazioni delle unità (organization_unit_processes:read).
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  TenantProcessIdParamSchema,
  TenantProcessListQuerySchema,
  TenantProcessListResponseSchema,
  TenantProcessSchedaSchema,
} from "@heuresys/shared";
import { processService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const processesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/",
    { preHandler: [requirePermission("organization_unit_processes:read")], schema: { querystring: TenantProcessListQuerySchema, response: { 200: TenantProcessListResponseSchema } } },
    async (req) => processService.list(actor(req), req.query),
  );
  app.get(
    "/:id/scheda",
    { preHandler: [requirePermission("organization_unit_processes:read")], schema: { params: TenantProcessIdParamSchema, response: { 200: TenantProcessSchedaSchema } } },
    async (req) => processService.scheda(actor(req), req.params.id),
  );
};
