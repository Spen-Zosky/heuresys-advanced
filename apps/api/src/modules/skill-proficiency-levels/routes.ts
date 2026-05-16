/**
 * apps/api/src/modules/skill-proficiency-levels/routes.ts
 * 1 endpoint under /v1/skill-proficiency-levels — GET list, read-only catalog.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import { SkillProficiencyLevelListResponseSchema } from "@heuresys/shared";
import { skillProficiencyLevelsService, type ActorContext } from "./service.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const skillProficiencyLevelsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: { response: { 200: SkillProficiencyLevelListResponseSchema } },
  }, async (req) => skillProficiencyLevelsService.list(actor(req)));
};
