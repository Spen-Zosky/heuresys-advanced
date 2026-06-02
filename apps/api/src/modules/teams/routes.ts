/**
 * apps/api/src/modules/teams/routes.ts
 * 2 endpoints under /v1/teams (the /v1/me/team self view lives in the me module).
 * Read-only in R1b — teams are derived from the org by db/seeds/rtl-rebuild/13_teams_from_org.sql.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  TeamDetailSchema,
  TeamListQuerySchema,
  TeamListResponseSchema,
  TeamIdParamSchema,
} from "@heuresys/shared";
import { teamsService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const teamsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    preHandler: [requirePermission("team:list")],
    schema: { querystring: TeamListQuerySchema, response: { 200: TeamListResponseSchema } },
  }, async (req) => teamsService.list(actor(req), req.query));

  app.get("/:id", {
    preHandler: [requirePermission("team:read")],
    schema: { params: TeamIdParamSchema, response: { 200: TeamDetailSchema } },
  }, async (req) => teamsService.getById(actor(req), req.params.id));
};

// Re-exported so the me module can mount GET /v1/me/team without duplicating the service.
export { teamsService };
