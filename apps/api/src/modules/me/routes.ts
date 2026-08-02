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
  MeProfileSchema, MeProfileFullSchema, MeContractsResponseSchema, MePaySlipsResponseSchema,
  MePerformanceResponseSchema, MeAttendanceResponseSchema, UpdateMeProfileBodySchema,
  MePositionsResponseSchema, MeGoalIdParamSchema, GoalTimelineResponseSchema,
  MeGapClosureResponseSchema, EvidenceSubjectQuerySchema, EvidenceListResponseSchema,
  MeSkillsResponseSchema, MeSkillEvidenceSchema, CreateMeSelfAssessmentBodySchema,
  MeSkillPossessionResponseSchema,
  MeSurveysResponseSchema, MeSurveyDetailSchema,
  SubmitMeSurveyResponseBodySchema, SubmitMeSurveyResultSchema, MeSurveyIdParamSchema,
  MeLearningResponseSchema, MeLearningAssignmentSchema, CreateMeEnrollmentBodySchema,
  MeProfessionalExperiencesResponseSchema,
  MeGapsResponseSchema, MeAssessmentsResponseSchema,
  MeCareerResponseSchema, MeCareerTargetSchema, CreateMeCareerTargetBodySchema,
  MeGoalsResponseSchema, MeRiskResponseSchema, MeCareerPathsResponseSchema,
  MeAnalyticsResponseSchema, MeApprovalsResponseSchema,
  MeInboxResponseSchema, MeInboxNotificationSchema, MeInboxQuerySchema,
  PatchMeInboxBodySchema, NotificationIdParamSchema,
  NotificationPreferencesResponseSchema, UpdateNotificationPreferenceBodySchema,
  MeDevelopmentResponseSchema,
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
  TimeOffRequestListQuerySchema, TimeOffRequestListResponseSchema,
  UserTimelineListQuerySchema, UserTimelineListResponseSchema, UserTimelineSummaryResponseSchema,
  CreateMeTimeOffRequestBodySchema, MeTimeOffRequestSubmittedSchema,
  GdprExportBundleSchema, ConsentStateResponseSchema,
  ConsentEventBodySchema, ConsentEventResponseSchema,
} from "@heuresys/shared";
import { meService, type SelfActor } from "./service.js";
import { gdprService } from "../gdpr/service.js";
import { actorFromRequest } from "../../lib/actor.js";
import { timeOffService } from "../time-off/service.js";
import { userTimelineService } from "../user-timeline/service.js";
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

  // Aggregate anagraphic/employment profile (mig 000164) — feeds the tabbed /me/profile UI.
  app.get("/profile/full", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { response: { 200: MeProfileFullSchema } },
  }, async (req) => meService.getProfileFull(selfActor(req)));

  // Employment contract history (mig 000165) — Contratti tab.
  app.get("/contracts", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { response: { 200: MeContractsResponseSchema } },
  }, async (req) => meService.getContracts(selfActor(req)));

  // Pay-slips / cedolini history (mig 000167) — Cedolini tab (F4). Self read-only consultation.
  app.get("/pay-slips", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { response: { 200: MePaySlipsResponseSchema } },
  }, async (req) => meService.getPaySlips(selfActor(req)));

  // Performance review history (read-only) — My HR Performance sub-tab (F3a).
  app.get("/performance", {
    preHandler: [requirePermission("assessment:read:self")],
    schema: { response: { 200: MePerformanceResponseSchema } },
  }, async (req) => meService.getPerformance(selfActor(req)));

  // Attendance/overtime/leave consultation (read-only) — My HR Presenze sub-tab (F3a).
  app.get("/attendance", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { response: { 200: MeAttendanceResponseSchema } },
  }, async (req) => meService.getAttendance(selfActor(req)));

  // A/L8 (#33): own time-off REQUESTS (the requests table, never surfaced before). Balances
  // stay on /me/attendance; this is the consultative request history. I17 self floor.
  app.get("/time-off/requests", {
    preHandler: [requirePermission("leave:read:self")],
    schema: { querystring: TimeOffRequestListQuerySchema, response: { 200: TimeOffRequestListResponseSchema } },
  }, async (req) => timeOffService.listOwnRequests(selfActor(req), req.query));

  // B3 (#34): ESS submission — creates a TIME_OFF_REQUEST approval (approver =
  // direct org manager); the leave tables are written only by the apply-effect
  // once approved. Full ActorContext (not SelfActor): createRequest applies I5.
  app.post("/time-off/requests", {
    preHandler: [app.verifyCsrf, requirePermission("leave:request:self")],
    schema: { body: CreateMeTimeOffRequestBodySchema, response: { 200: MeTimeOffRequestSubmittedSchema } },
  }, async (req) => timeOffService.submitOwnRequest(actorFromRequest(req), req.body));

  // D5 (#49): la propria storia. Pavimento I17 — il filtro e' l'identita' di
  // chi chiede, non il suo posto nell'organigramma.
  app.get("/timeline", {
    preHandler: [requirePermission("timeline:read:self")],
    schema: { querystring: UserTimelineListQuerySchema, response: { 200: UserTimelineListResponseSchema } },
  }, async (req) => userTimelineService.listOwn(actorFromRequest(req), req.query));

  app.get("/timeline/summary", {
    preHandler: [requirePermission("timeline:read:self")],
    schema: { querystring: UserTimelineListQuerySchema, response: { 200: UserTimelineSummaryResponseSchema } },
  }, async (req) => userTimelineService.summarizeOwn(actorFromRequest(req), req.query));

  app.get("/positions", {
    preHandler: [requirePermission("user_position_assignment:read:self")],
    schema: { response: { 200: MePositionsResponseSchema } },
  }, async (req) => meService.listPositions(selfActor(req)));

  app.get("/skills", {
    preHandler: [requirePermission("skill:read:self")],
    schema: { response: { 200: MeSkillsResponseSchema } },
  }, async (req) => meService.listSkills(selfActor(req)));

  // #46 D1 — current possession (sys_user_skills). Literal path before any /skills/:x.
  // Self-scope (I17): SKILL is sensitive, so another user's possession is org-gated and
  // does NOT live here — this endpoint only ever returns the caller's own inventory.
  app.get("/skills/possession", {
    preHandler: [requirePermission("skill:read:self")],
    schema: { response: { 200: MeSkillPossessionResponseSchema } },
  }, async (req) => meService.listSkillPossession(selfActor(req)));

  app.post("/skills/self-assessments", {
    preHandler: [app.verifyCsrf, requirePermission("skill:self_assess")],
    schema: { body: CreateMeSelfAssessmentBodySchema, response: { 201: MeSkillEvidenceSchema } },
  }, async (req, reply) => {
    const e = await meService.submitSelfAssessment(selfActor(req), req.body);
    reply.code(201).send(e);
  });

  /* --- surveys (Surveys-M2 ESS self-response) -------------------------- */

  // List the surveys ASSIGNED to me that are active (per-user M2 assignment). Self-scoped; the
  // userId is always req.user, never a URL param.
  app.get("/surveys", {
    preHandler: [requirePermission("surveys:respond:self")],
    schema: { response: { 200: MeSurveysResponseSchema } },
  }, async (req) => meService.listSurveys(selfActor(req)));

  // One assigned survey + its questions + my existing answers. A survey not assigned to me (or
  // cross-tenant) → 404 (no-leak).
  app.get("/surveys/:surveyId", {
    preHandler: [requirePermission("surveys:respond:self")],
    schema: { params: MeSurveyIdParamSchema, response: { 200: MeSurveyDetailSchema } },
  }, async (req) => meService.getSurvey(selfActor(req), req.params.surveyId));

  // Submit my own answers (append-only, one row per answer) + mark the assignment completed.
  // CSRF-protected state change. Re-submit → 409 SURVEY_ALREADY_ANSWERED; type mismatch → 422.
  app.post("/surveys/:surveyId/responses", {
    preHandler: [app.verifyCsrf, requirePermission("surveys:respond:self")],
    schema: {
      params: MeSurveyIdParamSchema,
      body: SubmitMeSurveyResponseBodySchema,
      response: { 201: SubmitMeSurveyResultSchema },
    },
  }, async (req, reply) => {
    const result = await meService.submitSurvey(selfActor(req), req.params.surveyId, req.body);
    reply.code(201).send(result);
  });

  app.get("/professional-experiences", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { response: { 200: MeProfessionalExperiencesResponseSchema } },
  }, async (req) => meService.listProfessionalExperiences(selfActor(req)));

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

  // #30 (S1018): own gap-closure plans + actions (read-only, I17 self floor).
  app.get("/gaps/closure", {
    preHandler: [requirePermission("gap_analysis:read:self")],
    schema: { response: { 200: MeGapClosureResponseSchema } },
  }, async (req) => meService.getGapsClosure(selfActor(req)));

  // #27 (S1018): own evidence drill-down ("why my scores"), I17 self floor.
  app.get("/evidence", {
    preHandler: [requirePermission("evidence:read:self")],
    schema: { querystring: EvidenceSubjectQuerySchema, response: { 200: EvidenceListResponseSchema } },
  }, async (req) => meService.getEvidence(selfActor(req), req.query.types, req.query.limit, req.query.offset));

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

  // /me/career sub-tabs (S1011 F3b). Obiettivi reads own goals (goal:read:self, mig 000166);
  // Rischio & Successione + Percorsi reuse career_succession:read:self. All self-scoped.
  app.get("/goals", {
    preHandler: [requirePermission("goal:read:self")],
    schema: { response: { 200: MeGoalsResponseSchema } },
  }, async (req) => meService.getGoals(selfActor(req)));

  // #26 (S1018): activity timeline of one OWN goal (updates ∪ check-ins ∪ milestones).
  app.get("/goals/:goalId/timeline", {
    preHandler: [requirePermission("goal:read:self")],
    schema: { params: MeGoalIdParamSchema, response: { 200: GoalTimelineResponseSchema } },
  }, async (req) => meService.getGoalTimeline(selfActor(req), req.params.goalId));

  app.get("/risk", {
    preHandler: [requirePermission("career_succession:read:self")],
    schema: { response: { 200: MeRiskResponseSchema } },
  }, async (req) => meService.getRisk(selfActor(req)));

  app.get("/career-paths", {
    preHandler: [requirePermission("career_succession:read:self")],
    schema: { response: { 200: MeCareerPathsResponseSchema } },
  }, async (req) => meService.getCareerPaths(selfActor(req)));

  // Personal analytics (F5.1) — own attendance trend + summary KPIs (broad self read).
  app.get("/analytics", {
    preHandler: [requirePermission("user_profile:read:self")],
    schema: { response: { 200: MeAnalyticsResponseSchema } },
  }, async (req) => meService.getAnalytics(selfActor(req)));

  // Personal approvals (F5.3, track-only) — the caller's own approval requests (approval:read:self, mig 000168).
  app.get("/approvals", {
    preHandler: [requirePermission("approval:read:self")],
    schema: { response: { 200: MeApprovalsResponseSchema } },
  }, async (req) => meService.getApprovals(selfActor(req)));

  app.get("/inbox", {
    preHandler: [requirePermission("notification:read:self")],
    schema: { querystring: MeInboxQuerySchema, response: { 200: MeInboxResponseSchema } },
  }, async (req) => meService.listInbox(selfActor(req), req.query));

  app.patch("/inbox/:notificationId", {
    preHandler: [app.verifyCsrf, requirePermission("notification:mark_read:self")],
    schema: { params: NotificationIdParamSchema, body: PatchMeInboxBodySchema, response: { 200: MeInboxNotificationSchema } },
  }, async (req) => meService.patchInbox(selfActor(req), req.params.notificationId, req.body));

  // 3.4 notification center — per-user delivery preferences (self). GET+PATCH both
  // under notification:read:self (self preference management, no separate write perm).
  app.get("/notification-preferences", {
    preHandler: [requirePermission("notification:read:self")],
    schema: { response: { 200: NotificationPreferencesResponseSchema } },
  }, async (req) => meService.getNotificationPreferences(selfActor(req)));

  app.patch("/notification-preferences", {
    preHandler: [app.verifyCsrf, requirePermission("notification:read:self")],
    schema: { body: UpdateNotificationPreferenceBodySchema, response: { 200: NotificationPreferencesResponseSchema } },
  }, async (req) => meService.updateNotificationPreference(selfActor(req), req.body));

  app.get("/kpis", {
    preHandler: [requirePermission("kpi:read:self")],
    schema: { response: { 200: MeKpisResponseSchema } },
  }, async (req) => meService.listKpis(selfActor(req)));

  // #59 F/F5 (ADR-0031, supersedes D-6): the caller's OWN computed scores with
  // evidence — coach framing lives in the web copy, the API is neutral data.
  app.get("/development", {
    preHandler: [requirePermission("insight:read:self")],
    schema: { response: { 200: MeDevelopmentResponseSchema } },
  }, async (req) => meService.getDevelopment(selfActor(req)));

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

  // D-14 F3/F4 — GDPR self-service (I17 floor): Art. 15/20 export of one's OWN
  // data + append-only consent ledger. POST for the export: it writes the
  // sys_gdpr_requests accountability row.
  app.post("/gdpr/export", {
    preHandler: [app.verifyCsrf, requirePermission("gdpr:export:self")],
    schema: { response: { 200: GdprExportBundleSchema } },
  }, async (req) => {
    // full ActorContext (typed roles) — the gdpr service tenant-guard is a
    // no-op for self, but the signature wants the shared actor shape.
    const a = actorFromRequest(req);
    return gdprService.exportSubject(a, a.userId);
  });

  app.get("/consents", {
    preHandler: [requirePermission("consent:manage:self")],
    schema: { response: { 200: ConsentStateResponseSchema } },
  }, async (req) => meService.consentState(selfActor(req)));

  app.post("/consents", {
    preHandler: [app.verifyCsrf, requirePermission("consent:manage:self")],
    schema: { body: ConsentEventBodySchema, response: { 200: ConsentEventResponseSchema } },
  }, async (req) => meService.recordConsent(selfActor(req), req.body));
};
