/**
 * apps/api/src/modules/process-kpi-templates/routes.ts
 * 4 endpoints: list/get/PUT-upsert/delete.
 * Gated by dedicated `process_kpi_template:*` permissions (000199, #61 G2) —
 * previously proxied on `bpm_process:*`; audience unchanged.
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  ProcessKpiTemplateSchema, ProcessKpiTemplateListQuerySchema,
  ProcessKpiTemplateListResponseSchema, UpsertProcessKpiTemplateBodySchema,
  ProcessKpiTemplateIdParamSchema,
} from "@heuresys/shared";
import { processKpiTemplatesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const processKpiTemplatesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("process_kpi_template:read")],
    schema: { querystring: ProcessKpiTemplateListQuerySchema, response: { 200: ProcessKpiTemplateListResponseSchema } },
  }, async (req) => processKpiTemplatesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("process_kpi_template:read")],
    schema: { params: ProcessKpiTemplateIdParamSchema, response: { 200: ProcessKpiTemplateSchema } },
  }, async (req) => processKpiTemplatesService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("process_kpi_template:update")],
    schema: { body: UpsertProcessKpiTemplateBodySchema, response: { 200: ProcessKpiTemplateSchema } },
  }, async (req) => processKpiTemplatesService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("process_kpi_template:delete")],
    schema: { params: ProcessKpiTemplateIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await processKpiTemplatesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
