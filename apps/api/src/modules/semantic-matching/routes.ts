/**
 * apps/api/src/modules/semantic-matching/routes.ts
 * /v1/matching/* — read-only kNN endpoints (no writes → no CSRF). matching:read.
 *   GET /me/occupations            — caller's profile → ESCO occupations (ESS self)
 *   GET /users/:userId/occupations — any in-scope user → occupations (admin)
 *   GET /skills/:skillId/similar    — skill → similar skills (catalog)
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  MatchQuerySchema,
  OccupationMatchListResponseSchema,
  SkillMatchListResponseSchema,
  MatchUserIdParamSchema,
  MatchSkillIdParamSchema,
} from "@heuresys/shared";
import { semanticMatchingService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const semanticMatchingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/me/occupations", {
    preHandler: [requirePermission("matching:read")],
    schema: { querystring: MatchQuerySchema, response: { 200: OccupationMatchListResponseSchema } },
  }, async (req) => {
    const { items, evidenceCount } = await semanticMatchingService.myOccupations(actor(req), req.query);
    return { items, total: items.length, evidenceCount };
  });

  app.get("/users/:userId/occupations", {
    preHandler: [requirePermission("matching:read")],
    schema: { params: MatchUserIdParamSchema, querystring: MatchQuerySchema, response: { 200: OccupationMatchListResponseSchema } },
  }, async (req) => {
    const { items, evidenceCount } = await semanticMatchingService.userOccupations(actor(req), req.params.userId, req.query);
    return { items, total: items.length, evidenceCount };
  });

  app.get("/skills/:skillId/similar", {
    preHandler: [requirePermission("matching:read")],
    schema: { params: MatchSkillIdParamSchema, querystring: MatchQuerySchema, response: { 200: SkillMatchListResponseSchema } },
  }, async (req) => semanticMatchingService.similarSkills(actor(req), req.params.skillId, req.query));
};
