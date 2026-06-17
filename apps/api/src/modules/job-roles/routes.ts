/**
 * apps/api/src/modules/job-roles/routes.ts
 * 4 endpoints under /v1/job-roles (no DELETE — perm not in seed).
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  JobRoleSchema,
  JobRoleListQuerySchema,
  JobRoleListResponseSchema,
  CreateJobRoleBodySchema,
  UpdateJobRoleBodySchema,
  JobRoleIdParamSchema,
} from "@heuresys/shared";
import { jobRolesService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const jobRolesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("job_role:read")],
    schema: { querystring: JobRoleListQuerySchema, response: { 200: JobRoleListResponseSchema } },
  }, async (req) => jobRolesService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("job_role:read")],
    schema: { params: JobRoleIdParamSchema, response: { 200: JobRoleSchema } },
  }, async (req) => jobRolesService.getById(actor(req), req.params.id));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("job_role:create")],
    schema: { body: CreateJobRoleBodySchema, response: { 201: JobRoleSchema } },
  }, async (req, reply) => {
    const r = await jobRolesService.create(actor(req), req.body);
    reply.code(201).send(r);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("job_role:update")],
    schema: { params: JobRoleIdParamSchema, body: UpdateJobRoleBodySchema, response: { 200: JobRoleSchema } },
  }, async (req) => jobRolesService.update(actor(req), req.params.id, req.body));
};
