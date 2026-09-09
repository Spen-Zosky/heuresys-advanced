/**
 * apps/api/src/modules/projects/routes.ts
 * /v1/projects — `#143` F4.
 *
 * Letture: `project:list` / `project:read`. Ciclo di vita: `project:manage` + CSRF.
 * ⚠ Il permesso dice SE si possono gestire progetti; quale progetto lo decide il service
 * (mandato oppure «lo guidi adesso»), e nega con `PERMISSION_DENIED`.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import {
  ProjectCreateBodySchema,
  ProjectDetailSchema,
  ProjectIdParamSchema,
  ProjectListQuerySchema,
  ProjectListResponseSchema,
  ProjectMemberParamSchema,
  ProjectMemberUpsertBodySchema,
  ProjectProgressBodySchema,
  ProjectUpdateBodySchema,
} from "@heuresys/shared";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";
import { projectsService } from "./service.js";

export const projectsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("project:list")],
    schema: { querystring: ProjectListQuerySchema, response: { 200: ProjectListResponseSchema } },
  }, async (req) => projectsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("project:read")],
    schema: { params: ProjectIdParamSchema, response: { 200: ProjectDetailSchema } },
  }, async (req) => projectsService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("project:manage")],
    schema: { body: ProjectCreateBodySchema, response: { 201: ProjectDetailSchema } },
  }, async (req, reply) => {
    const p = await projectsService.create(actor(req), req.body);
    return reply.code(201).send(p);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("project:manage")],
    schema: {
      params: ProjectIdParamSchema, body: ProjectUpdateBodySchema,
      response: { 200: ProjectDetailSchema },
    },
  }, async (req) => projectsService.update(actor(req), req.params.id, req.body));

  /** L'avanzamento ha una rotta sua: e' il gesto che il capo progetto ripete, e passarlo
   *  da una PATCH generica costringerebbe a rimandare l'oggetto intero per un numero. */
  app.patch("/:id/progress", {
    preHandler: [app.verifyCsrf, requirePermission("project:manage")],
    schema: {
      params: ProjectIdParamSchema, body: ProjectProgressBodySchema,
      response: { 200: ProjectDetailSchema },
    },
  }, async (req) => projectsService.setProgress(actor(req), req.params.id, req.body));

  app.put("/:id/members/:userId", {
    preHandler: [app.verifyCsrf, requirePermission("project:manage")],
    schema: {
      params: ProjectMemberParamSchema, body: ProjectMemberUpsertBodySchema,
      response: { 200: ProjectDetailSchema },
    },
  }, async (req) => projectsService.upsertMember(
    actor(req), req.params.id, req.params.userId, req.body));

  app.delete("/:id/members/:userId", {
    preHandler: [app.verifyCsrf, requirePermission("project:manage")],
    schema: { params: ProjectMemberParamSchema, response: { 200: ProjectDetailSchema } },
  }, async (req) => projectsService.removeMember(actor(req), req.params.id, req.params.userId));
};

export { projectsService };
