/**
 * apps/api/src/modules/mentorship/routes.ts
 * /v1/mentorship/* — programs/pairings/sessions full CRUD + match-scores read-only.
 * Reads: requirePermission("mentorship:read"). Writes: app.verifyCsrf + mentorship:{create,update,delete}.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { actorFromRequest as actor } from "../../lib/actor.js";

import {
  MentorshipProgramSchema, MentorshipProgramListQuerySchema, MentorshipProgramListResponseSchema,
  CreateMentorshipProgramBodySchema, UpdateMentorshipProgramBodySchema,
  MentorshipSchema, MentorshipListQuerySchema, MentorshipListResponseSchema,
  CreateMentorshipBodySchema, UpdateMentorshipBodySchema,
  MentorshipSessionSchema, MentorshipSessionListResponseSchema,
  CreateMentorshipSessionBodySchema, UpdateMentorshipSessionBodySchema,
  MentorMatchScoreSchema, MentorMatchScoreListQuerySchema, MentorMatchScoreListResponseSchema,
  MentorshipIdParamSchema,
} from "@heuresys/shared";
import { mentorshipService } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";

export const mentorshipRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── Programs ──
  app.get("/programs", {
    preHandler: [requirePermission("mentorship:read")],
    schema: { querystring: MentorshipProgramListQuerySchema, response: { 200: MentorshipProgramListResponseSchema } },
  }, async (req) => mentorshipService.listPrograms(actor(req), req.query));

  app.get("/programs/:id", {
    preHandler: [requirePermission("mentorship:read")],
    schema: { params: MentorshipIdParamSchema, response: { 200: MentorshipProgramSchema } },
  }, async (req) => mentorshipService.getProgram(actor(req), req.params.id));

  app.post("/programs", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:create")],
    schema: { body: CreateMentorshipProgramBodySchema, response: { 201: MentorshipProgramSchema } },
  }, async (req, reply) => { reply.code(201).send(await mentorshipService.createProgram(actor(req), req.body)); });

  app.patch("/programs/:id", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:update")],
    schema: { params: MentorshipIdParamSchema, body: UpdateMentorshipProgramBodySchema, response: { 200: MentorshipProgramSchema } },
  }, async (req) => mentorshipService.updateProgram(actor(req), req.params.id, req.body));

  app.delete("/programs/:id", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:delete")],
    schema: { params: MentorshipIdParamSchema },
  }, async (req, reply) => { await mentorshipService.deleteProgram(actor(req), req.params.id); reply.code(204).send(); });

  // ── Pairings ──
  app.get("/pairings", {
    preHandler: [requirePermission("mentorship:read")],
    schema: { querystring: MentorshipListQuerySchema, response: { 200: MentorshipListResponseSchema } },
  }, async (req) => mentorshipService.listMentorships(actor(req), req.query));

  app.get("/pairings/:id", {
    preHandler: [requirePermission("mentorship:read")],
    schema: { params: MentorshipIdParamSchema, response: { 200: MentorshipSchema } },
  }, async (req) => mentorshipService.getMentorship(actor(req), req.params.id));

  app.post("/pairings", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:create")],
    schema: { body: CreateMentorshipBodySchema, response: { 201: MentorshipSchema } },
  }, async (req, reply) => { reply.code(201).send(await mentorshipService.createMentorship(actor(req), req.body)); });

  app.patch("/pairings/:id", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:update")],
    schema: { params: MentorshipIdParamSchema, body: UpdateMentorshipBodySchema, response: { 200: MentorshipSchema } },
  }, async (req) => mentorshipService.updateMentorship(actor(req), req.params.id, req.body));

  app.delete("/pairings/:id", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:delete")],
    schema: { params: MentorshipIdParamSchema },
  }, async (req, reply) => { await mentorshipService.deleteMentorship(actor(req), req.params.id); reply.code(204).send(); });

  // ── Sessions (nested + flat) ──
  app.get("/pairings/:id/sessions", {
    preHandler: [requirePermission("mentorship:read")],
    schema: { params: MentorshipIdParamSchema, response: { 200: MentorshipSessionListResponseSchema } },
  }, async (req) => mentorshipService.listSessions(actor(req), req.params.id));

  app.post("/pairings/:id/sessions", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:create")],
    schema: { params: MentorshipIdParamSchema, body: CreateMentorshipSessionBodySchema, response: { 201: MentorshipSessionSchema } },
  }, async (req, reply) => { reply.code(201).send(await mentorshipService.createSession(actor(req), req.params.id, req.body)); });

  app.get("/sessions/:id", {
    preHandler: [requirePermission("mentorship:read")],
    schema: { params: MentorshipIdParamSchema, response: { 200: MentorshipSessionSchema } },
  }, async (req) => mentorshipService.getSession(actor(req), req.params.id));

  app.patch("/sessions/:id", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:update")],
    schema: { params: MentorshipIdParamSchema, body: UpdateMentorshipSessionBodySchema, response: { 200: MentorshipSessionSchema } },
  }, async (req) => mentorshipService.updateSession(actor(req), req.params.id, req.body));

  app.delete("/sessions/:id", {
    preHandler: [app.verifyCsrf, requirePermission("mentorship:delete")],
    schema: { params: MentorshipIdParamSchema },
  }, async (req, reply) => { await mentorshipService.deleteSession(actor(req), req.params.id); reply.code(204).send(); });

  // ── Match scores (read-only) ──
  app.get("/match-scores", {
    preHandler: [requirePermission("mentorship:read")],
    schema: { querystring: MentorMatchScoreListQuerySchema, response: { 200: MentorMatchScoreListResponseSchema } },
  }, async (req) => mentorshipService.listMatchScores(actor(req), req.query));

  app.get("/match-scores/:id", {
    preHandler: [requirePermission("mentorship:read")],
    schema: { params: MentorshipIdParamSchema, response: { 200: MentorMatchScoreSchema } },
  }, async (req) => mentorshipService.getMatchScore(actor(req), req.params.id));
};
