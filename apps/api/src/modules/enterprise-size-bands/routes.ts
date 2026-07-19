/**
 * apps/api/src/modules/enterprise-size-bands/routes.ts
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  EnterpriseSizeBandSchema, EnterpriseSizeBandListResponseSchema,
  UpsertEnterpriseSizeBandBodySchema, EnterpriseSizeBandIdParamSchema,
} from "@heuresys/shared";
import { enterpriseSizeBandsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const enterpriseSizeBandsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { response: { 200: EnterpriseSizeBandListResponseSchema } },
  }, async (req) => enterpriseSizeBandsService.list(actor(req)));
  app.get("/:id", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { params: EnterpriseSizeBandIdParamSchema, response: { 200: EnterpriseSizeBandSchema } },
  }, async (req) => enterpriseSizeBandsService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:update")],
    schema: { body: UpsertEnterpriseSizeBandBodySchema, response: { 200: EnterpriseSizeBandSchema } },
  }, async (req) => enterpriseSizeBandsService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:delete")],
    schema: { params: EnterpriseSizeBandIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await enterpriseSizeBandsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
