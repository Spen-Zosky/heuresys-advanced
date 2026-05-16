/**
 * apps/api/src/modules/brownfield-import-runs/routes.ts
 * 4 endpoints: list/get/trigger/patch.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  BrownfieldImportRunSchema, BrownfieldImportRunListQuerySchema,
  BrownfieldImportRunListResponseSchema, CreateBrownfieldImportRunBodySchema,
  UpdateBrownfieldImportRunBodySchema, BrownfieldImportRunIdParamSchema,
} from "@heuresys/shared";
import { brownfieldImportRunsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const brownfieldImportRunsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: { querystring: BrownfieldImportRunListQuerySchema, response: { 200: BrownfieldImportRunListResponseSchema } },
  }, async (req) => brownfieldImportRunsService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("brownfield_adaptation:read")],
    schema: { params: BrownfieldImportRunIdParamSchema, response: { 200: BrownfieldImportRunSchema } },
  }, async (req) => brownfieldImportRunsService.getById(actor(req), req.params.id));
  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("brownfield_adaptation:trigger")],
    schema: { body: CreateBrownfieldImportRunBodySchema, response: { 201: BrownfieldImportRunSchema } },
  }, async (req, reply) => {
    const r = await brownfieldImportRunsService.trigger(actor(req), req.body);
    reply.code(201).send(r);
  });
  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("brownfield_adaptation:trigger")],
    schema: { params: BrownfieldImportRunIdParamSchema, body: UpdateBrownfieldImportRunBodySchema, response: { 200: BrownfieldImportRunSchema } },
  }, async (req) => brownfieldImportRunsService.update(actor(req), req.params.id, req.body));
};
