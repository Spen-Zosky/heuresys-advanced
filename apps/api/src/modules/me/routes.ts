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
  MeInterfacesResponseSchema,
  UserPreferenceSchema, UpdateUserPreferenceBodySchema,
  MyTeamsResponseSchema,
  ContentDocumentListResponseSchema, ContentDocumentDetailResponseSchema,
  MeContentFilterSchema, ContentIdParamSchema,
  ListContentMediaResponseSchema, ContentMediaDocParamSchema, ContentMediaIdParamSchema,
  ListActiveSessionsResponseSchema,
  RevokeSessionParamsSchema, RevokeSessionResponseSchema,
  RevokeOtherSessionsBodySchema, RevokeOtherSessionsResponseSchema,
} from "@heuresys/shared";
import { meService, type SelfActor } from "./service.js";
import { teamsService } from "../teams/service.js";
import { contentService } from "../content/service.js";
import { createMediaService } from "../content/media-service.js";
import { LocalDiskStore } from "../content/media-store.js";
import { env } from "../../config/env.js";
import { requirePermission, userPermissionCodes } from "../../middleware/rbac.js";
import { ForbiddenError, UnauthorizedError } from "../../errors/index.js";

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

  // DB-driven sidebar registry (U1) — the interfaces the caller can see, grouped by PET
  // perspective. Authenticated-only (reflects self), like /permissions; gating is in the service.
  app.get("/interfaces", {
    schema: { response: { 200: MeInterfacesResponseSchema } },
  }, async (req) => meService.getInterfaces(selfActor(req)));

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

  // UI preferences (WS-4 P1) — theme + palette, server source-of-truth. Self-scoped; GET returns
  // the brand defaults if no row exists yet, PATCH upserts (CSRF-protected state change).
  app.get("/preferences", {
    preHandler: [requirePermission("me:preferences:read")],
    schema: { response: { 200: UserPreferenceSchema } },
  }, async (req) => meService.getPreferences(selfActor(req)));

  app.patch("/preferences", {
    preHandler: [app.verifyCsrf, requirePermission("me:preferences:update")],
    schema: { body: UpdateUserPreferenceBodySchema, response: { 200: UserPreferenceSchema } },
  }, async (req) => meService.updatePreferences(selfActor(req), req.body));

  // "My team" (WS-4 R1b) — the caller's own teams (lead + member), with members. Self-scoped
  // (reflects the caller); delegates to the teams service, which owns the team data + scope axis.
  app.get("/team", {
    preHandler: [requirePermission("team:read:self")],
    schema: { response: { 200: MyTeamsResponseSchema } },
  }, async (req) => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    return teamsService.myTeams({
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      roles: req.user.roles,
    });
  });

  // ESS knowledge base (cap④ CMS P2) — published, tenant-scoped content the caller can read.
  // Self-scoped (own tenant); delegates to the content service, which owns the table + the
  // published-only/effective-window filter. Drafts are never visible here.
  app.get("/content", {
    preHandler: [requirePermission("me:content:read")],
    schema: { querystring: MeContentFilterSchema, response: { 200: ContentDocumentListResponseSchema } },
  }, async (req) => contentService.listPublishedForMe(selfActor(req).tenantId, req.query));

  app.get("/content/:id", {
    preHandler: [requirePermission("me:content:read")],
    schema: { params: ContentIdParamSchema, response: { 200: ContentDocumentDetailResponseSchema } },
  }, async (req) => contentService.getPublishedForMe(selfActor(req).tenantId, req.params.id));

  // ESS media serve (cap④ CMS P3 close, S982): the media of PUBLISHED documents
  // in the caller's tenant. Same blob store as the admin surface; the guard is
  // published-only (drafts / cross-tenant -> 404, no leak). Read-only — no
  // multipart, no CSRF. me:content:read covers it ("media is part of the
  // document", mig 000105).
  const meMediaService = createMediaService(new LocalDiskStore(env.MEDIA_STORAGE_DIR));
  const meTenant = (req: FastifyRequest): string => {
    const { tenantId } = selfActor(req);
    if (!tenantId) throw new ForbiddenError("ESS content requires a tenant context", "TENANT_REQUIRED");
    return tenantId;
  };

  app.get("/content/:id/media", {
    preHandler: [requirePermission("me:content:read")],
    schema: { params: ContentMediaDocParamSchema, response: { 200: ListContentMediaResponseSchema } },
  }, async (req) => meMediaService.listForPublishedDocument(meTenant(req), req.params.id));

  // Binary stream — no zod response schema (passthrough). Images are served
  // INLINE (handbook embeds render them); everything else stays attachment.
  // nosniff kept; the upload mime-allowlist excludes SVG, so inline is safe.
  app.get("/content/media/:mediaId", {
    preHandler: [requirePermission("me:content:read")],
    schema: { params: ContentMediaIdParamSchema },
  }, async (req, reply) => {
    const { row, stream } = await meMediaService.resolveForDownloadPublished(
      meTenant(req),
      req.params.mediaId,
    );
    const safeName = row.filename.replace(/[^\w.\- ]+/g, "_");
    const disposition = row.mime.startsWith("image/") ? "inline" : "attachment";
    reply
      .header("content-type", row.mime)
      .header("content-length", String(row.sizeBytes))
      .header("content-disposition", `${disposition}; filename="${safeName}"`)
      .header("x-content-type-options", "nosniff");
    return reply.send(stream);
  });

  // Session management (MVP-4 §2.5) — list + revoke the caller's own refresh-token families.
  // me:sessions:manage (granted to all roles). The "current" family is flagged client-side via
  // GET /v1/auth/sessions/current (the refresh cookie is not sent to /v1/me/*).
  app.get("/security/sessions", {
    preHandler: [requirePermission("me:sessions:manage")],
    schema: { response: { 200: ListActiveSessionsResponseSchema } },
  }, async (req) => meService.listSessions(selfActor(req)));

  app.delete("/security/sessions/:familyId", {
    preHandler: [app.verifyCsrf, requirePermission("me:sessions:manage")],
    schema: { params: RevokeSessionParamsSchema, response: { 200: RevokeSessionResponseSchema } },
  }, async (req) => {
    await meService.revokeSession(selfActor(req), req.params.familyId);
    return { revoked: true as const };
  });

  app.post("/security/sessions/revoke-others", {
    preHandler: [app.verifyCsrf, requirePermission("me:sessions:manage")],
    schema: { body: RevokeOtherSessionsBodySchema, response: { 200: RevokeOtherSessionsResponseSchema } },
  }, async (req) => meService.revokeOtherSessions(selfActor(req), req.body.currentFamilyId));
};
