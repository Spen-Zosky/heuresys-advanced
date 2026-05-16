/**
 * apps/api/src/modules/career-paths/routes.ts
 * 5 endpoints under /v1/career-paths.
 * Permissions: career_succession:read/create/update (no :delete in seed,
 * reuses :update for DELETE).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  CareerPathSchema,
  CareerPathListQuerySchema,
  CareerPathListResponseSchema,
  CreateCareerPathBodySchema,
  UpdateCareerPathBodySchema,
  CareerPathIdParamSchema,
} from "@heuresys/shared";
import { careerPathsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const careerPathsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { querystring: CareerPathListQuerySchema, response: { 200: CareerPathListResponseSchema } },
  }, async (req) => careerPathsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("career_succession:read")],
    schema: { params: CareerPathIdParamSchema, response: { 200: CareerPathSchema } },
  }, async (req) => careerPathsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:create")],
    schema: { body: CreateCareerPathBodySchema, response: { 201: CareerPathSchema } },
  }, async (req, reply) => {
    const p = await careerPathsService.create(actor(req), req.body);
    reply.code(201).send(p);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: CareerPathIdParamSchema, body: UpdateCareerPathBodySchema, response: { 200: CareerPathSchema } },
  }, async (req) => careerPathsService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("career_succession:update")],
    schema: { params: CareerPathIdParamSchema, response: { 204: { type: "null" } as const } },
  }, async (req, reply) => {
    await careerPathsService.delete(actor(req), req.params.id);
    reply.code(204).send();
  });
};
