/**
 * apps/api/src/modules/job-families/routes.ts
 * 5 endpoints under /v1/job-families. Read open (any authenticated);
 * mutations gated by `job_family:create|update|delete` (000199, #61 G2 —
 * PLATFORM_ADMIN-only audience) with the service's ensurePlatformAdmin kept
 * as defense in depth. The public denial code stays JOB_FAMILY_ADMIN_ONLY.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";
import { requirePermission } from "../../middleware/rbac.js";

import {
  JobFamilySchema,
  JobFamilyListQuerySchema,
  JobFamilyListResponseSchema,
  CreateJobFamilyBodySchema,
  UpdateJobFamilyBodySchema,
  JobFamilyIdParamSchema,
  EmptyResponseSchema,
} from "@heuresys/shared";
import { jobFamiliesService } from "./service.js";

export const jobFamiliesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: { querystring: JobFamilyListQuerySchema, response: { 200: JobFamilyListResponseSchema } },
  }, async (req) => jobFamiliesService.list(actor(req), req.query, req.locale));

  app.get("/:id", {
    schema: { params: JobFamilyIdParamSchema, response: { 200: JobFamilySchema } },
  }, async (req) => jobFamiliesService.getById(actor(req), req.params.id, req.locale));

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("job_family:create", "JOB_FAMILY_ADMIN_ONLY")],
    schema: { body: CreateJobFamilyBodySchema, response: { 201: JobFamilySchema } },
  }, async (req, reply) => {
    const f = await jobFamiliesService.create(actor(req), req.body);
    reply.code(201).send(f);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("job_family:update", "JOB_FAMILY_ADMIN_ONLY")],
    schema: { params: JobFamilyIdParamSchema, body: UpdateJobFamilyBodySchema, response: { 200: JobFamilySchema } },
  }, async (req) => jobFamiliesService.update(actor(req), req.params.id, req.body));

  app.delete("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("job_family:delete", "JOB_FAMILY_ADMIN_ONLY")],
    schema: { params: JobFamilyIdParamSchema, response: { 204: EmptyResponseSchema } },
  }, async (req, reply) => {
    await jobFamiliesService.delete(actor(req), req.params.id);
    reply.code(204).send({});
  });
};
