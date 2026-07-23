/**
 * apps/api/src/modules/teams/routes.ts
 * /v1/teams (the /v1/me/team self view lives in the me module).
 * Reads: team:list / team:read (R1b). Lifecycle (#75, S1028, ex D-71):
 * POST / + PATCH /:id + PUT|DELETE /:id/members/:userId — team:manage
 * (mig 000212: PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER) + CSRF.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  TeamCreateBodySchema,
  TeamDetailSchema,
  TeamListQuerySchema,
  TeamListResponseSchema,
  TeamIdParamSchema,
  TeamMemberParamSchema,
  TeamMemberUpsertBodySchema,
  TeamUpdateBodySchema,
} from "@heuresys/shared";
import { teamsService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const teamsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("team:list")],
    schema: { querystring: TeamListQuerySchema, response: { 200: TeamListResponseSchema } },
  }, async (req) => teamsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("team:read")],
    schema: { params: TeamIdParamSchema, response: { 200: TeamDetailSchema } },
  }, async (req) => teamsService.getById(actor(req), req.params.id));

  /* --- #75 lifecycle ----------------------------------------------------- */

  app.post("/", {
    preHandler: [app.verifyCsrf, requirePermission("team:manage")],
    schema: { body: TeamCreateBodySchema, response: { 201: TeamDetailSchema } },
  }, async (req, reply) => {
    const team = await teamsService.create(actor(req), req.body);
    return reply.code(201).send(team);
  });

  app.patch("/:id", {
    preHandler: [app.verifyCsrf, requirePermission("team:manage")],
    schema: { params: TeamIdParamSchema, body: TeamUpdateBodySchema, response: { 200: TeamDetailSchema } },
  }, async (req) => teamsService.update(actor(req), req.params.id, req.body));

  app.put("/:id/members/:userId", {
    preHandler: [app.verifyCsrf, requirePermission("team:manage")],
    schema: { params: TeamMemberParamSchema, body: TeamMemberUpsertBodySchema, response: { 200: TeamDetailSchema } },
  }, async (req) => teamsService.upsertMember(actor(req), req.params.id, req.params.userId, req.body));

  app.delete("/:id/members/:userId", {
    preHandler: [app.verifyCsrf, requirePermission("team:manage")],
    schema: { params: TeamMemberParamSchema, response: { 200: TeamDetailSchema } },
  }, async (req) => teamsService.removeMember(actor(req), req.params.id, req.params.userId));
};

// Re-exported so the me module can mount GET /v1/me/team without duplicating the service.
export { teamsService };
