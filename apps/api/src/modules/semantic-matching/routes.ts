/**
 * apps/api/src/modules/semantic-matching/routes.ts
 * /v1/matching/* — kNN endpoints. All reads are matching:read; the single write
 * (reindex) is matching:admin + CSRF.
 *   GET  /me/occupations            — caller's profile → ESCO occupations (ESS self)
 *   GET  /users/:userId/occupations — any in-scope user → occupations (admin)
 *   GET  /me/positions              — caller's profile → matching positions (ESS self, AI ②·Fase 3)
 *   GET  /users/:userId/positions   — any in-scope user → matching positions (admin)
 *   GET  /me/job-roles              — caller's profile → matching job_roles (ESS self, AI ②·Fase 2)
 *   GET  /users/:userId/job-roles   — any in-scope user → matching job_roles (admin)
 *   GET  /users/:userId/similar     — person↔person similar users (ELEVATED-ROLE only, AI ②·Fase 2)
 *   GET  /skills/:skillId/similar    — skill → similar skills (catalog)
 *   GET  /search?q=...              — free-text query → occupations + skills (flag-gated, AI ②·Fase 2)
 *   POST /reindex                   — trigger the embedding backfill (matching:admin, CSRF)
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  MatchQuerySchema,
  OccupationMatchListResponseSchema,
  PositionMatchListResponseSchema,
  JobRoleMatchListResponseSchema,
  SimilarUserMatchListResponseSchema,
  SkillMatchListResponseSchema,
  FreeTextQuerySchema,
  FreeTextSearchResponseSchema,
  ReindexResponseSchema,
  MatchUserIdParamSchema,
  MatchSkillIdParamSchema,
} from "@heuresys/shared";
import { semanticMatchingService, defaultDeps, type ActorContext, type SemanticMatchingDeps } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

/** Routes options — `deps` lets the integration suite inject a non-destructive backfill + a FakeEmbedder. */
export interface SemanticMatchingRoutesOptions {
  deps?: SemanticMatchingDeps;
}

export const semanticMatchingRoutes: FastifyPluginAsyncZod<SemanticMatchingRoutesOptions> = async (app, opts) => {
  const deps = opts.deps ?? defaultDeps;

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

  app.get("/me/positions", {
    preHandler: [requirePermission("matching:read")],
    schema: { querystring: MatchQuerySchema, response: { 200: PositionMatchListResponseSchema } },
  }, async (req) => {
    const { items, evidenceCount } = await semanticMatchingService.myPositions(actor(req), req.query);
    return { items, total: items.length, evidenceCount };
  });

  app.get("/users/:userId/positions", {
    preHandler: [requirePermission("matching:read")],
    schema: { params: MatchUserIdParamSchema, querystring: MatchQuerySchema, response: { 200: PositionMatchListResponseSchema } },
  }, async (req) => {
    const { items, evidenceCount } = await semanticMatchingService.userPositions(actor(req), req.params.userId, req.query);
    return { items, total: items.length, evidenceCount };
  });

  // ── AI ②·Fase 2: person → job_roles ──
  app.get("/me/job-roles", {
    preHandler: [requirePermission("matching:read")],
    schema: { querystring: MatchQuerySchema, response: { 200: JobRoleMatchListResponseSchema } },
  }, async (req) => {
    const { items, evidenceCount } = await semanticMatchingService.myJobRoles(actor(req), req.query);
    return { items, total: items.length, evidenceCount };
  });

  app.get("/users/:userId/job-roles", {
    preHandler: [requirePermission("matching:read")],
    schema: { params: MatchUserIdParamSchema, querystring: MatchQuerySchema, response: { 200: JobRoleMatchListResponseSchema } },
  }, async (req) => {
    const { items, evidenceCount } = await semanticMatchingService.userJobRoles(actor(req), req.params.userId, req.query);
    return { items, total: items.length, evidenceCount };
  });

  // ── AI ②·Fase 2: person ↔ person (ELEVATED-ROLE only; no ESS self surface) ──
  app.get("/users/:userId/similar", {
    preHandler: [requirePermission("matching:read")],
    schema: { params: MatchUserIdParamSchema, querystring: MatchQuerySchema, response: { 200: SimilarUserMatchListResponseSchema } },
  }, async (req) => semanticMatchingService.similarPeople(actor(req), req.params.userId, req.query));

  app.get("/skills/:skillId/similar", {
    preHandler: [requirePermission("matching:read")],
    schema: { params: MatchSkillIdParamSchema, querystring: MatchQuerySchema, response: { 200: SkillMatchListResponseSchema } },
  }, async (req) => semanticMatchingService.similarSkills(actor(req), req.params.skillId, req.query));

  // ── AI ②·Fase 2: free-text search (flag-gated; embeds the query at request time via the DI seam) ──
  app.get("/search", {
    // QW-H6 (F-WS-H-4): tight per-route cap — free-text embeds the query at
    // request time via Voyage (billable external call), so it must be bounded
    // below the global 600/min limiter to cap cost/abuse.
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    preHandler: [requirePermission("matching:read")],
    schema: { querystring: FreeTextQuerySchema, response: { 200: FreeTextSearchResponseSchema } },
  }, async (req) => semanticMatchingService.freeTextSearch(actor(req), req.query, deps));

  // ── AI ②·Fase 2: reindex (matching:admin, CSRF; triggers the hash-skip-idempotent backfill) ──
  app.post("/reindex", {
    // QW-H6 (F-WS-H-4): very low cap — reindex runs a full embedding backfill
    // (expensive); a handful per hour is ample for an admin-triggered rebuild.
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    preHandler: [app.verifyCsrf, requirePermission("matching:admin")],
    schema: { response: { 200: ReindexResponseSchema } },
  }, async (req) => semanticMatchingService.reindex(actor(req), deps));
};
