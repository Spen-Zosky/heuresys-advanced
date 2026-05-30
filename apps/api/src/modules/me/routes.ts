/**
 * apps/api/src/modules/me/routes.ts
 *
 * Employee Self-Service Portal routes (ADR-0011).
 *
 * Hard self-scope contract:
 *   - No `:userId` URL param anywhere under /v1/me/*.
 *   - userId is always sourced from req.user.userId via the local `selfActor`
 *     helper. Service methods never accept userId from request input.
 *   - Routes here use `requirePermission(":self")` perms from the seed.
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";
import {
  MeProfileSchema, UpdateMeProfileBodySchema,
  MePositionsResponseSchema,
  MeSkillsResponseSchema, MeSkillEvidenceSchema, CreateMeSelfAssessmentBodySchema,
  MeLearningResponseSchema, MeLearningAssignmentSchema, CreateMeEnrollmentBodySchema,
  MeGapsResponseSchema, MeAssessmentsResponseSchema,
  MeCareerResponseSchema, MeCareerTargetSchema, CreateMeCareerTargetBodySchema,
  MeInboxResponseSchema, MeInboxNotificationSchema, MeInboxQuerySchema,
  PatchMeInboxBodySchema, NotificationIdParamSchema,
  MeKpisResponseSchema,
  MeCertificationsResponseSchema, MeCertificationSchema, CreateMeCertificationBodySchema,
  MeDocumentsResponseSchema,
  MePermissionsResponseSchema,
} from "@heuresys/shared";
import { meService, type SelfActor } from "./service.js";
import { requirePermission, userPermissionCodes } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function selfActor(req: FastifyRequest): SelfActor {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  // Caller's own RBAC permission codes — drives the web sidebar (mirrors the API requirePermission
  // gate). Authenticated-only (reflects self); intentionally no requirePermission so every role can
  // read its own grants.
  app.get("/permissions", {
    schema: { response: { 200: MePermissionsResponseSchema } },
  }, async (req) => {
    const actor = selfActor(req);
    return { roles: actor.roles, permissions: userPermissionCodes({ roles: actor.roles }) };
  });

  app.get("/profile", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { response: { 200: MeProfileSchema } },
  }, async (req) => meService.getProfile(selfActor(req)));

  app.patch("/profile", {
    preHandler: [app.verifyCsrf, requirePermission("user_profile:update:self")],
    schema: { body: UpdateMeProfileBodySchema, response: { 200: MeProfileSchema } },
  }, async (req) => meService.updateProfile(selfActor(req), req.body));

  app.get("/positions", {
    preHandler: [requirePermission("user_position_assignment:read:self")],
    schema: { response: { 200: MePositionsResponseSchema } },
  }, async (req) => meService.listPositions(selfActor(req)));

  app.get("/skills", {
    preHandler: [requirePermission("skill:read:self")],
    schema: { response: { 200: MeSkillsResponseSchema } },
  }, async (req) => meService.listSkills(selfActor(req)));

  app.post("/skills/self-assessments", {
    preHandler: [app.verifyCsrf, requirePermission("skill:self_assess")],
    schema: { body: CreateMeSelfAssessmentBodySchema, response: { 201: MeSkillEvidenceSchema } },
  }, async (req, reply) => {
    const e = await meService.submitSelfAssessment(selfActor(req), req.body);
    reply.code(201).send(e);
  });

  app.get("/learning", {
    preHandler: [requirePermission("learning:read:self")],
    schema: { response: { 200: MeLearningResponseSchema } },
  }, async (req) => meService.listLearning(selfActor(req)));

  app.post("/learning/enrollments", {
    preHandler: [app.verifyCsrf, requirePermission("learning:enroll:self")],
    schema: { body: CreateMeEnrollmentBodySchema, response: { 201: MeLearningAssignmentSchema } },
  }, async (req, reply) => {
    const a = await meService.enrollLearning(selfActor(req), req.body);
    reply.code(201).send(a);
  });

  app.get("/gaps", {
    preHandler: [requirePermission("gap_analysis:read:self")],
    schema: { response: { 200: MeGapsResponseSchema } },
  }, async (req) => meService.listGaps(selfActor(req)));

  app.get("/assessments", {
    preHandler: [requirePermission("assessment:read:self")],
    schema: { response: { 200: MeAssessmentsResponseSchema } },
  }, async (req) => meService.listAssessments(selfActor(req)));

  app.get("/career", {
    preHandler: [requirePermission("career_succession:read:self")],
    schema: { response: { 200: MeCareerResponseSchema } },
  }, async (req) => meService.listCareerTargets(selfActor(req)));

  app.post("/career/target-positions", {
    preHandler: [app.verifyCsrf, requirePermission("career:request_target:self")],
    schema: { body: CreateMeCareerTargetBodySchema, response: { 201: MeCareerTargetSchema } },
  }, async (req, reply) => {
    const t = await meService.addCareerTarget(selfActor(req), req.body);
    reply.code(201).send(t);
  });

  app.get("/inbox", {
    preHandler: [requirePermission("notification:read:self")],
    schema: { querystring: MeInboxQuerySchema, response: { 200: MeInboxResponseSchema } },
  }, async (req) => meService.listInbox(selfActor(req), req.query));

  app.patch("/inbox/:notificationId", {
    preHandler: [app.verifyCsrf, requirePermission("notification:mark_read:self")],
    schema: { params: NotificationIdParamSchema, body: PatchMeInboxBodySchema, response: { 200: MeInboxNotificationSchema } },
  }, async (req) => meService.patchInbox(selfActor(req), req.params.notificationId, req.body));

  app.get("/kpis", {
    preHandler: [requirePermission("kpi:read:self")],
    schema: { response: { 200: MeKpisResponseSchema } },
  }, async (req) => meService.listKpis(selfActor(req)));

  app.get("/certifications", {
    preHandler: [requirePermission("certification:read:self")],
    schema: { response: { 200: MeCertificationsResponseSchema } },
  }, async (req) => meService.listCertifications(selfActor(req)));

  app.post("/certifications", {
    preHandler: [app.verifyCsrf, requirePermission("certification:upload:self")],
    schema: { body: CreateMeCertificationBodySchema, response: { 201: MeCertificationSchema } },
  }, async (req, reply) => {
    const c = await meService.addCertification(selfActor(req), req.body);
    reply.code(201).send(c);
  });

  app.get("/documents", {
    preHandler: [requirePermission("document:read:self")],
    schema: { response: { 200: MeDocumentsResponseSchema } },
  }, async (req) => meService.listDocuments(selfActor(req)));
};
