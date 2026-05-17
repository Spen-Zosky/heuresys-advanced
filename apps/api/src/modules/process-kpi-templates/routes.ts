/**
 * apps/api/src/modules/process-kpi-templates/routes.ts
 * 4 endpoints: list/get/PUT-upsert/delete.
 */
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  ProcessKpiTemplateSchema, ProcessKpiTemplateListQuerySchema,
  ProcessKpiTemplateListResponseSchema, UpsertProcessKpiTemplateBodySchema,
  ProcessKpiTemplateIdParamSchema,
} from "@heuresys/shared";
import { processKpiTemplatesService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const processKpiTemplatesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("bpm_process:read")],
    schema: { querystring: ProcessKpiTemplateListQuerySchema, response: { 200: ProcessKpiTemplateListResponseSchema } },
  }, async (req) => processKpiTemplatesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("bpm_process:read")],
    schema: { params: ProcessKpiTemplateIdParamSchema, response: { 200: ProcessKpiTemplateSchema } },
  }, async (req) => processKpiTemplatesService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("bpm_process:update")],
    schema: { body: UpsertProcessKpiTemplateBodySchema, response: { 200: ProcessKpiTemplateSchema } },
  }, async (req) => processKpiTemplatesService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("bpm_process:update")],
    schema: { params: ProcessKpiTemplateIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await processKpiTemplatesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
