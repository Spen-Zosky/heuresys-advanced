/**
 * apps/api/src/modules/enterprise-typing-profiles/routes.ts
 */
import { z } from "zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  EnterpriseTypingProfileSchema, EnterpriseTypingProfileListQuerySchema,
  EnterpriseTypingProfileListResponseSchema, UpsertEnterpriseTypingProfileBodySchema,
  EnterpriseTypingProfileIdParamSchema,
} from "@heuresys/shared";
import { enterpriseTypingProfilesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const enterpriseTypingProfilesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { querystring: EnterpriseTypingProfileListQuerySchema, response: { 200: EnterpriseTypingProfileListResponseSchema } },
  }, async (req) => enterpriseTypingProfilesService.list(actor(req), req.query));
  app.get("/:id", {
    preHandler: [requirePermission("enterprise_typing:read")],
    schema: { params: EnterpriseTypingProfileIdParamSchema, response: { 200: EnterpriseTypingProfileSchema } },
  }, async (req) => enterpriseTypingProfilesService.getById(actor(req), req.params.id));
  app.put("/", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:update")],
    schema: { body: UpsertEnterpriseTypingProfileBodySchema, response: { 200: EnterpriseTypingProfileSchema } },
  }, async (req) => enterpriseTypingProfilesService.upsert(actor(req), req.body));
  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("enterprise_typing:delete")],
    schema: { params: EnterpriseTypingProfileIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await enterpriseTypingProfilesService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
