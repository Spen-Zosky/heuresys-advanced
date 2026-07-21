/**
 * apps/api/src/modules/skill-proficiency-levels/routes.ts
 * 1 endpoint under /v1/skill-proficiency-levels — GET list, read-only catalog.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import { SkillProficiencyLevelListResponseSchema } from "@heuresys/shared";
import { skillProficiencyLevelsService } from "./service.js";

export const skillProficiencyLevelsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", {
    schema: { response: { 200: SkillProficiencyLevelListResponseSchema } },
  }, async (req) => skillProficiencyLevelsService.list(actor(req), req.locale));
};
