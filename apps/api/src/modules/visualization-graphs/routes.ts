/**
 * apps/api/src/modules/visualization-graphs/routes.ts
 * 5 endpoints under /v1/visualization-graphs.
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  VizGraphSchema, VizGraphListQuerySchema, VizGraphListResponseSchema,
  VizGraphSummaryResponseSchema, VizGraphRenderResponseSchema,
  CreateVizGraphBodySchema, UpdateVizGraphBodySchema, VizGraphIdParamSchema,
  CreateVizGraphVersionBodySchema, VizGraphVersionResponseSchema, VizGraphVersionListResponseSchema,
} from "@heuresys/shared";
import { visualizationGraphsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const visualizationGraphsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizGraphListQuerySchema, response: { 200: VizGraphListResponseSchema } },
  }, async (req) => visualizationGraphsService.list(actor(req), req.query));

  app.get("/summary", {
    preHandler: [requirePermission("visualization:read")],
    schema: { response: { 200: VizGraphSummaryResponseSchema } },
  }, async (req) => visualizationGraphsService.typeSummary(actor(req)));

  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizGraphIdParamSchema, response: { 200: VizGraphSchema } },
  }, async (req) => visualizationGraphsService.getById(actor(req), req.params.id));

  app.get("/:id/render", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizGraphIdParamSchema, response: { 200: VizGraphRenderResponseSchema } },
  }, async (req) => visualizationGraphsService.getRender(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: { body: CreateVizGraphBodySchema, response: { 201: VizGraphSchema } },
  }, async (req, reply) => {
    const g = await visualizationGraphsService.create(actor(req), req.body);
    reply.code(201).send(g);
  });

  // #36 (B5) — versionamento.
  app.get("/:id/versions", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizGraphIdParamSchema, response: { 200: VizGraphVersionListResponseSchema } },
  }, async (req) => visualizationGraphsService.listVersions(actor(req), req.params.id));

  app.post("/:id/versions", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: {
      params: VizGraphIdParamSchema,
      body: CreateVizGraphVersionBodySchema,
      response: { 201: VizGraphVersionResponseSchema },
    },
  }, async (req, reply) => {
    const r = await visualizationGraphsService.createVersion(actor(req), req.params.id, req.body);
    reply.code(201).send(r);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:update_layout")],
    schema: { params: VizGraphIdParamSchema, body: UpdateVizGraphBodySchema, response: { 200: VizGraphSchema } },
  }, async (req) => visualizationGraphsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:delete")],
    schema: { params: VizGraphIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await visualizationGraphsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
