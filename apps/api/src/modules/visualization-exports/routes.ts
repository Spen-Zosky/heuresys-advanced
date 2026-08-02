/**
 * apps/api/src/modules/visualization-exports/routes.ts
 * 3 endpoints: list/get/create. Immutable.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import {
  VizExportSchema, VizExportListQuerySchema, VizExportListResponseSchema,
  CreateVizExportBodySchema, VizExportIdParamSchema,
} from "@heuresys/shared";
import { visualizationExportsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const visualizationExportsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("visualization:read")],
    schema: { querystring: VizExportListQuerySchema, response: { 200: VizExportListResponseSchema } },
  }, async (req) => visualizationExportsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizExportIdParamSchema, response: { 200: VizExportSchema } },
  }, async (req) => visualizationExportsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("visualization:create")],
    schema: { body: CreateVizExportBodySchema, response: { 201: VizExportSchema } },
  }, async (req, reply) => {
    const e = await visualizationExportsService.create(actor(req), req.body);
    reply.code(201).send(e);
  });

  // #36 (B5) — il download vero. Non ha schema di risposta perché il corpo NON
  // è JSON: è il documento (SVG, Mermaid o JSON) servito col proprio MIME e un
  // nome file, così il browser lo salva invece di mostrarlo.
  app.get("/:id/download", {
    preHandler: [requirePermission("visualization:read")],
    schema: { params: VizExportIdParamSchema },
  }, async (req, reply) => {
    const doc = await visualizationExportsService.getContent(actor(req), req.params.id);
    reply
      .header("content-type", doc.contentType)
      .header("content-disposition", `attachment; filename="${doc.filename}"`)
      .send(doc.content);
  });
};
