/**
 * apps/api/src/modules/kpi-definitions/routes.ts
 * 5 endpoints under /v1/kpi-definitions.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  KpiDefinitionSchema,
  KpiDefinitionListQuerySchema,
  KpiDefinitionListResponseSchema,
  CreateKpiDefinitionBodySchema,
  UpdateKpiDefinitionBodySchema,
  KpiDefinitionIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { kpiDefinitionsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const kpiDefinitionsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("kpi:read")],
    schema: { querystring: KpiDefinitionListQuerySchema, response: { 200: KpiDefinitionListResponseSchema } },
  }, async (req) => kpiDefinitionsService.list(actor(req), req.query));

  app.get("/:id", {
    config: { orgGate: "catalog" },
    preHandler: [requirePermission("kpi:read")],
    schema: { params: KpiDefinitionIdParamSchema, response: { 200: KpiDefinitionSchema } },
  }, async (req) => kpiDefinitionsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("kpi:create")],
    schema: { body: CreateKpiDefinitionBodySchema, response: { 201: KpiDefinitionSchema } },
  }, async (req, reply) => {
    const k = await kpiDefinitionsService.create(actor(req), req.body);
    reply.code(201).send(k);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("kpi:update")],
    schema: { params: KpiDefinitionIdParamSchema, body: UpdateKpiDefinitionBodySchema, response: { 200: KpiDefinitionSchema } },
  }, async (req) => kpiDefinitionsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("kpi:delete")],
    schema: { params: KpiDefinitionIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await kpiDefinitionsService.delete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
