/**
 * apps/api/src/modules/succession-pools/routes.ts
 * 5 endpoints under /v1/succession-pools.
 */

import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  SuccessionPoolSchema,
  SuccessionPoolListQuerySchema,
  SuccessionPoolListResponseSchema,
  CreateSuccessionPoolBodySchema,
  UpdateSuccessionPoolBodySchema,
  SuccessionPoolIdParamSchema,
} from "@heuresys/shared";
import { successionPoolsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const successionPoolsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: SuccessionPoolListQuerySchema, response: { 200: SuccessionPoolListResponseSchema } },
  }, async (req) => successionPoolsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { params: SuccessionPoolIdParamSchema, response: { 200: SuccessionPoolSchema } },
  }, async (req) => successionPoolsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:create")],
    schema: { body: CreateSuccessionPoolBodySchema, response: { 201: SuccessionPoolSchema } },
  }, async (req, reply) => {
    const p = await successionPoolsService.create(actor(req), req.body);
    reply.code(201).send(p);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: SuccessionPoolIdParamSchema, body: UpdateSuccessionPoolBodySchema, response: { 200: SuccessionPoolSchema } },
  }, async (req) => successionPoolsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: SuccessionPoolIdParamSchema, response: { 204: z.null() } },
  }, async (req, reply) => {
    await successionPoolsService.delete(actor(req), req.params.id);
    reply.code(204).send(null);
  });
};
