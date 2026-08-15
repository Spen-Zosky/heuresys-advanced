/**
 * apps/api/src/modules/me/service.ts
 * All methods take the canonical userId from the route, which sources it
 * from req.user.userId. No method accepts userId from user input.
 */
import { pool, withTransaction } from "../../db/client.js";
import { dominiCheApronoUnaSuperficie } from "../../lib/scope/domains.js";
import { almenoUnaCellaAperta } from "../../lib/scope/matrix.js";
import type { RoleCode } from "../../config/constants.js";
import { NotFoundError, ForbiddenError, ConflictError, UnprocessableEntityError } from "../../errors/index.js";
import type {
  MeProfile, MeProfileFull, UpdateMeProfileBody, CreateMeSelfAssessmentBody,
  CreateMeEnrollmentBody, CreateMeCareerTargetBody,
  MeInboxQuery, PatchMeInboxBody,
  CreateMeCertificationBody,
  MeInterfacesResponse,
  UserPreference, UpdateUserPreferenceBody,
  NotificationPreferencesResponse, UpdateNotificationPreferenceBody,
  MeSurveysResponse, MeSurveyDetail, SubmitMeSurveyResponseBody, SubmitMeSurveyResult,
} from "@heuresys/shared";
import { NotificationTypeSchema } from "@heuresys/shared";
import * as repo from "./repository.js";
import * as goalsRepo from "../goals/repository.js";
import { buildGoalTimeline } from "../goals/service.js";
import * as gapsRepo from "../learning-gaps/repository.js";
import * as evidenceRepo from "../evidence/repository.js";
import * as authRepo from "../auth/repository.js";
import * as gdprRepo from "../gdpr/repository.js";
import { ConsentPurposeEnum } from "@heuresys/shared";
import type {
  ListActiveSessionsResponse,
  RevokeOtherSessionsResponse,
  ConsentStateResponse,
  ConsentEventBody,
  ConsentEventResponse,
} from "@heuresys/shared";
import { userPermissionCodes } from "../../middleware/rbac.js";
import { emitNotification } from "../../lib/notifications/emit.js";

// #119 — `UI_ADMIN_ROLES` lived here: a hand-written set of 7 role names that
// gated the administrative sidebar sections. It omitted `CEO`, so the person
// running the whole company saw no administrative section at all — and nothing
// failed when the role was added to the RBAC map and to nobody's list.
//
// The gate is now `hasAnyDomain` (lib/scope/domains.ts): you are offered the
// administrative sections if you hold a standing reason to look beyond your own
// record — you manage an org unit, lead a team, own a process, or carry a
// mandate. Three of those four are facts in the data, so a nomination made today
// takes effect today. The hybrid gate is unchanged: the per-item permission pair
// is still checked first, and an item is offered only if BOTH agree.
// Sidebar sections (S1009 IA redesign) — 5 always-returned collapsible groups, in display
// order. Replaces the 3 PET perspectives. An empty section renders an honest empty-state in
// the UI, so a non-admin (e.g. ESS-only) still gets a coherent sidebar.
const UI_PERSPECTIVES = [
  { code: "OVERVIEW" as const, label: "Panoramica" },
  { code: "GOVERNANCE" as const, label: "Governance" },
  { code: "WORKFORCE" as const, label: "Forza lavoro" },
  { code: "INTELLIGENCE" as const, label: "Intelligence" },
  { code: "PERSONAL" as const, label: "Area personale" },
];

export interface SelfActor { userId: string; tenantId: string | null; roles: string[] }

function requireTenant(a: SelfActor): string {
  if (!a.tenantId) throw new ForbiddenError("Tenant context required");
  return a.tenantId;
}

/** One submitted answer (zod-validated shape). */
type SurveyAnswerInput = SubmitMeSurveyResponseBody["answers"][number];

/** Enforce that the answer's populated value column matches the question's type. rating/nps take a
 *  ratingValue (and reject a text/choice value); text takes a textValue; choice takes a choiceValue.
 *  A mismatch is a 422 SURVEY_ANSWER_TYPE_MISMATCH (semantic, payload was schema-valid). */
function assertAnswerMatchesType(questionType: string, ans: SurveyAnswerInput): void {
  const fail = (reason: string): never => {
    throw new UnprocessableEntityError(
      { questionId: ans.questionId, questionType, reason },
      `Answer type mismatch: ${reason}`,
      "SURVEY_ANSWER_TYPE_MISMATCH",
    );
  };
  const hasRating = ans.ratingValue !== undefined && ans.ratingValue !== null;
  const hasText = ans.textValue !== undefined && ans.textValue !== null;
  const hasChoice = ans.choiceValue !== undefined && ans.choiceValue !== null;

  switch (questionType) {
    case "rating":
    case "nps":
      if (!hasRating) fail(`question type '${questionType}' requires ratingValue`);
      if (hasText || hasChoice) fail(`question type '${questionType}' accepts only ratingValue`);
      break;
    case "text":
      if (!hasText) fail("question type 'text' requires textValue");
      if (hasRating || hasChoice) fail("question type 'text' accepts only textValue");
      break;
    case "choice":
      if (!hasChoice) fail("question type 'choice' requires choiceValue");
      if (hasRating || hasText) fail("question type 'choice' accepts only choiceValue");
      break;
    default:
      fail(`unknown question type '${questionType}'`);
  }
}

/** Detect a Postgres unique-violation (SQLSTATE 23505) on the natural-key index (race re-submit). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export const meService = {
  /** Sidebar registry filtered to the caller (U1). ESS items are always visible; admin items
   *  require an admin-class role AND the per-item permission. All 5 sections are always
   *  returned (an empty one renders an honest empty-state in the UI). */
  async getInterfaces(actor: SelfActor): Promise<MeInterfacesResponse> {
    const permSet = new Set(userPermissionCodes({ roles: actor.roles }));
    const ctx = {
      userId: actor.userId,
      tenantId: actor.tenantId,
      roles: actor.roles as RoleCode[],
    };
    // #99 F7 — i domini che aprono una superficie, non tutti quelli attivi. `hasAnyDomain`
    // e' il predicato binario costruito su questo stesso insieme; qui serve l'insieme,
    // perche' M1 va interrogata dominio per dominio.
    const dominiCheAprono = await dominiCheApronoUnaSuperficie(pool, ctx);
    const hasAdminRole = dominiCheAprono.size > 0;
    const rows = await repo.loadActiveInterfaces(pool);
    const visible = rows.filter((i) => {
      // Una coppia permesso DICHIARATA si valuta SEMPRE, admin o no. La stesura
      // precedente usciva su `if (!i.requiresAdmin) return true` e non arrivava mai
      // a leggerla: la console delle segnalazioni, che ha `whistleblowing:read` e
      // `requires_admin=false`, finiva nel menu di TUTTI i 163 utenti mentre il
      // permesso lo detiene un ruolo solo. Verificato con tre login reali; l'API
      // poi rispondeva 403, quindi nessun dato e' mai uscito — ma un menu che offre
      // una funzione che appartiene a un'altra persona e' comunque una bugia.
      // Nella stessa condizione erano `me-surveys` e `me-time-off`: la loro coppia
      // permesso era inerte per la stessa ragione.
      if (i.requiredResource !== null && i.requiredAction !== null
          && !permSet.has(`${i.requiredResource}:${i.requiredAction}`)) return false;
      // ── il pavimento: invariato da #119. Una voce amministrativa esige un dominio che
      //    apra una superficie oltre il proprio record.
      if (i.requiresAdmin && !hasAdminRole) return false;
      // ── #99 F7, la cascata M3: fra i domini che aprono e le classi che la pagina espone
      //    deve esistere almeno una cella non-`none`.
      //
      //    ⚠ M1 RESTRINGE, NON SOSTITUISCE, e il contro-oracolo lo ha dimostrato: sostituendo
      //    il pavimento con la sola matrice, **109 persone guadagnavano** le voci di governo
      //    — perche' `team_peer` ha `PERSONAL = mask` («dei compagni di squadra vedi nome e
      //    competenze»), che tradotto in visibilita' di pagina diventava «puoi aprire la
      //    gestione utenti». E' il difetto da 109 persone gia' evitato in F6a, e sarebbe
      //    rientrato dalla finestra.
      //
      //    La granularita' che F7 aggiunge e' quella che al pavimento manca: chi guida una
      //    squadra apre una superficie, ma M1 gli da' `none` su COMPENSATION e EVALUATION —
      //    quindi la pagina delle retribuzioni non gli va offerta neanche se il permesso,
      //    domani, gli venisse concesso.
      return almenoUnaCellaAperta(dominiCheAprono, i.dataClasses);
    });
    return {
      perspectives: UI_PERSPECTIVES.map((p) => ({
        code: p.code,
        label: p.label,
        interfaces: visible
          .filter((i) => i.perspective === p.code)
          .map((i) => ({
            code: i.code,
            label: i.label,
            route: i.route,
            icon: i.icon,
            sidebarGroup: i.sidebarGroup,
            order: i.order,
          })),
      })),
    };
  },

  async getProfile(actor: SelfActor): Promise<MeProfile> {
    const p = await repo.loadProfile(pool, actor.userId, actor.roles);
    if (!p) throw new NotFoundError("User");
    return p;
  },

  /** Aggregate profile (anagraphic satellites, mig 000164) feeding the tabbed /me/profile UI. */
  async getProfileFull(actor: SelfActor): Promise<MeProfileFull> {
    const p = await repo.loadProfileFull(pool, actor.userId, actor.roles);
    if (!p) throw new NotFoundError("User");
    return p;
  },

  /** Employment contract history (mig 000165) — feeds the /me/profile Contratti tab. */
  async getContracts(actor: SelfActor) {
    const items = await repo.loadContracts(pool, actor.userId);
    return { items, total: items.length };
  },

  /** Cedolini sub-tab (F4) — the caller's own pay-slips history (read-only). */
  async getPaySlips(actor: SelfActor) {
    const items = await repo.loadPaySlips(pool, actor.userId);
    return { items, total: items.length };
  },

  /** Performance review history (read-only) — My HR Performance sub-tab (F3a). */
  async getPerformance(actor: SelfActor) {
    const items = await repo.loadPerformance(pool, actor.userId);
    return { items, total: items.length };
  },

  /** Attendance/overtime/leave consultation (imported, read-only) — My HR Presenze sub-tab (F3a). */
  async getAttendance(actor: SelfActor) {
    return repo.loadAttendance(pool, actor.userId);
  },

  /** Obiettivi sub-tab (F3b) — the caller's own goals. */
  async getGoals(actor: SelfActor) {
    const items = await repo.loadMyGoals(pool, actor.userId);
    return { items, total: items.length };
  },

  /** #26 (S1018): activity timeline of ONE own goal — I17 self-scope: 404 unless subject = caller. */
  async getGoalTimeline(actor: SelfActor, goalId: string) {
    const g = await goalsRepo.findGoalById(pool, goalId);
    if (!g || g.subjectUserId !== actor.userId) throw new NotFoundError("Goal");
    return buildGoalTimeline(g);
  },

  /** Rischio & Successione sub-tab (F3b) — own flight-risk + succession-readiness. */
  async getRisk(actor: SelfActor) {
    return repo.loadMyRisk(pool, actor.userId);
  },

  /** Percorsi sub-tab (F3b) — career paths from the PRIMARY position + own plans. */
  async getCareerPaths(actor: SelfActor) {
    return repo.loadMyCareerPaths(pool, actor.userId);
  },

  /** Personal analytics (F5.1) — own attendance trend + summary KPIs. */
  async getAnalytics(actor: SelfActor) {
    return repo.loadMyAnalytics(pool, actor.userId);
  },

  /** Personal approvals (F5.3, track-only) — the caller's own approval requests. */
  async getApprovals(actor: SelfActor) {
    return repo.loadMyApprovals(pool, actor.userId);
  },

  async updateProfile(actor: SelfActor, patch: UpdateMeProfileBody): Promise<MeProfile> {
    await repo.upsertProfile(pool, actor.userId, actor.tenantId, patch);
    const p = await repo.loadProfile(pool, actor.userId, actor.roles);
    if (!p) throw new NotFoundError("User");
    return p;
  },

  async listPositions(actor: SelfActor) {
    return repo.listMyPositions(pool, actor.userId);
  },

  async listSkills(actor: SelfActor) {
    return repo.listMySkills(pool, actor.userId);
  },

  /** #46 D1 — current skill possession (one row per skill), not the assessment trail. */
  async listSkillPossession(actor: SelfActor) {
    return repo.listMySkillPossession(pool, actor.userId);
  },

  async submitSelfAssessment(actor: SelfActor, body: CreateMeSelfAssessmentBody) {
    const tenantId = requireTenant(actor);
    if (!(await repo.skillVisibleToTenant(pool, body.skillId, tenantId))) {
      throw new NotFoundError("Skill");
    }
    return repo.insertSelfAssessment(pool, actor.userId, tenantId, body);
  },

  /* --- surveys (Surveys-M2 ESS self-response) ----------------------- */

  /** Surveys assigned to the caller that are active. requireTenant — the per-user assignment is
   *  tenant-scoped (FK isolation, never from request input). */
  async listSurveys(actor: SelfActor): Promise<MeSurveysResponse> {
    const tenantId = requireTenant(actor);
    const items = await repo.listMyAssignedSurveys(pool, actor.userId, tenantId);
    return { items, total: items.length };
  },

  /** One assigned survey + its questions + the caller's own existing answers. A survey that is
   *  not assigned to the caller (or cross-tenant) surfaces as 404 (no-leak). */
  async getSurvey(actor: SelfActor, surveyId: string): Promise<MeSurveyDetail> {
    const tenantId = requireTenant(actor);
    const assignment = await repo.findMySurveyAssignment(pool, actor.userId, tenantId, surveyId);
    if (!assignment) throw new NotFoundError("Survey");
    const [questions, myAnswers] = await Promise.all([
      repo.listSurveyQuestions(pool, surveyId),
      repo.listMySurveyAnswers(pool, actor.userId, tenantId, surveyId),
    ]);
    return {
      surveyId,
      title: assignment.title,
      status: assignment.surveyStatus,
      isAnonymous: assignment.isAnonymous,
      completedAt: assignment.completedAt ? assignment.completedAt.toISOString() : null,
      questions,
      myAnswers,
    };
  },

  /** Submit the caller's own answers (one append-only row per answer) + stamp the assignment
   *  completed, atomically. Guards: must be assigned (404), survey active (404), not already
   *  answered (409). Each answer's value column must match its question type (422), and the
   *  question must belong to this survey (422). A concurrent re-submit races on the natural-key
   *  unique → 23505 mapped to 409. */
  async submitSurvey(
    actor: SelfActor, surveyId: string, body: SubmitMeSurveyResponseBody,
  ): Promise<SubmitMeSurveyResult> {
    const tenantId = requireTenant(actor);
    const assignment = await repo.findMySurveyAssignment(pool, actor.userId, tenantId, surveyId);
    if (!assignment) throw new NotFoundError("Survey", "SURVEY_NOT_ASSIGNED");
    // Reading one's own answers no longer needs an assignment (2026-08-13); WRITING still
    // does, exactly as before. Without this line the widened read guard would have widened
    // the write path too — silently, which is the worse half of the change.
    if (!assignment.hasAssignment) throw new NotFoundError("Survey", "SURVEY_NOT_ASSIGNED");
    if (assignment.surveyStatus !== "active") throw new NotFoundError("Survey", "SURVEY_NOT_ASSIGNED");
    if (assignment.completedAt !== null) {
      throw new ConflictError("Survey already answered", "SURVEY_ALREADY_ANSWERED");
    }

    // Validate the answers against the survey's real questions (type ↔ column, membership).
    const questions = await repo.listSurveyQuestions(pool, surveyId);
    const byId = new Map(questions.map((q) => [q.questionId, q]));
    for (const ans of body.answers) {
      const q = byId.get(ans.questionId);
      if (!q) {
        throw new UnprocessableEntityError(
          { questionId: ans.questionId },
          "Answer references a question that is not part of this survey",
          "SURVEY_ANSWER_TYPE_MISMATCH",
        );
      }
      assertAnswerMatchesType(q.type, ans);
    }

    let completedAt: string;
    try {
      completedAt = await withTransaction(async (client) => {
        for (const ans of body.answers) {
          await repo.insertSurveyResponse(client, {
            surveyId,
            questionId: ans.questionId,
            tenantId,
            userId: actor.userId,
            naturalKey: `ESS::${surveyId}::${ans.questionId}::${actor.userId}`,
            ratingValue: ans.ratingValue ?? null,
            textValue: ans.textValue ?? null,
            choiceValue: ans.choiceValue ?? null,
          });
        }
        return repo.markSurveyAssignmentCompleted(client, actor.userId, tenantId, surveyId);
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError("Survey already answered", "SURVEY_ALREADY_ANSWERED");
      }
      throw err;
    }
    return { submitted: body.answers.length, completedAt };
  },

  /** Il curriculum di chi chiama: le esperienze precedenti all'ingresso. */
  async listProfessionalExperiences(actor: SelfActor) {
    return repo.listMyProfessionalExperiences(pool, actor.userId);
  },

  async listLearning(actor: SelfActor) {
    return repo.listMyLearning(pool, actor.userId);
  },

  async enrollLearning(actor: SelfActor, body: CreateMeEnrollmentBody) {
    const tenantId = requireTenant(actor);
    const created = await repo.insertEnrollment(pool, actor.userId, tenantId, body);
    // 3.4 TRAINING_DEADLINE — confirm the enrolment + flag deadlines (best-effort).
    try {
      await emitNotification(pool, {
        tenantId, userId: actor.userId, type: "TRAINING_DEADLINE",
        subject: "Percorso formativo in agenda",
        body: "Ti sei iscritto a un percorso formativo: controlla le scadenze previste.",
        priority: "INFO", resourceType: "LEARNING_MODULE", actionUrl: "/me/learning",
        createdBy: actor.userId,
      });
    } catch {
      /* best-effort */
    }
    return created;
  },

  async listGaps(actor: SelfActor) {
    return repo.listMyGaps(pool, actor.userId);
  },

  /** #30 (S1018): own gap-closure plans + actions on own gaps (I17 self floor). */
  async getGapsClosure(actor: SelfActor) {
    const [plans, actions] = await Promise.all([
      gapsRepo.listClosurePlansForUser(pool, actor.userId),
      gapsRepo.listClosureActionsForUser(pool, actor.userId),
    ]);
    return { plans, actions };
  },

  /** #27 (S1018): own evidence (I17). Private continuous feedback excluded (safe default). */
  async getEvidence(actor: SelfActor, types: string | undefined, limit: number, offset: number) {
    return evidenceRepo.listEvidenceForSubject(pool, actor.userId, types ? types.split(",").map((s) => s.trim()).filter(Boolean) as Parameters<typeof evidenceRepo.listEvidenceForSubject>[2] : [], false, limit, offset);
  },

  async listAssessments(actor: SelfActor) {
    return repo.listMyAssessments(pool, actor.userId);
  },

  async listCareerTargets(actor: SelfActor) {
    return repo.listMyCareerTargets(pool, actor.userId);
  },

  async addCareerTarget(actor: SelfActor, body: CreateMeCareerTargetBody) {
    const tenantId = requireTenant(actor);
    if (!(await repo.positionInTenant(pool, body.positionId, tenantId))) {
      throw new NotFoundError("Position");
    }
    const created = await repo.insertCareerTarget(pool, actor.userId, tenantId, body);
    // 3.4 CAREER_TARGET_STATUS — confirm the target + track its status (best-effort).
    try {
      await emitNotification(pool, {
        tenantId, userId: actor.userId, type: "CAREER_TARGET_STATUS",
        subject: "Obiettivo di carriera registrato",
        body: "Il tuo obiettivo di carriera è stato registrato (stato: richiesto).",
        priority: "INFO", resourceType: "CAREER_TARGET", resourceId: body.positionId,
        actionUrl: "/me/career", createdBy: actor.userId,
      });
    } catch {
      /* best-effort */
    }
    return created;
  },

  async listInbox(actor: SelfActor, query: MeInboxQuery) {
    return repo.listInbox(pool, actor.userId, query);
  },

  async patchInbox(actor: SelfActor, notificationId: string, body: PatchMeInboxBody) {
    const existing = await repo.findInboxNotification(pool, actor.userId, notificationId);
    if (!existing) throw new NotFoundError("Notification");
    const updated = await repo.patchInboxNotification(pool, actor.userId, notificationId, body);
    if (!updated) throw new NotFoundError("Notification");
    return updated;
  },

  /** 3.4 — all six notification types with their effective per-user state
   *  (default-on in-app, default-off email when no row exists). */
  async getNotificationPreferences(actor: SelfActor): Promise<NotificationPreferencesResponse> {
    const rows = await repo.getNotificationPreferenceRows(pool, actor.userId);
    const byType = new Map(rows.map((r) => [r.type, r]));
    const items = NotificationTypeSchema.options.map((notificationType) => {
      const r = byType.get(notificationType);
      return {
        notificationType,
        inAppEnabled: r ? r.in_app : true,
        emailEnabled: r ? r.email : false,
      };
    });
    return { items, total: items.length };
  },

  /** 3.4 — upsert one type's channels (partial), return the full refreshed list. */
  async updateNotificationPreference(
    actor: SelfActor,
    body: UpdateNotificationPreferenceBody,
  ): Promise<NotificationPreferencesResponse> {
    await repo.upsertNotificationPreference(
      pool,
      actor.tenantId,
      actor.userId,
      body.notificationType,
      body.inAppEnabled ?? null,
      body.emailEnabled ?? null,
    );
    return this.getNotificationPreferences(actor);
  },

  async listKpis(actor: SelfActor) {
    return repo.listMyKpis(pool, actor.userId);
  },

  /* --- #99 F5 (S1061) — tre superfici che I17 pretendeva e non c'erano.
   *     Self-scope per costruzione: filtrano su actor.userId e sul suo tenant. */

  async listMentorships(actor: SelfActor) {
    return repo.listMyMentorships(pool, actor.userId, requireTenant(actor));
  },

  async listProcessParticipations(actor: SelfActor) {
    return repo.listMyProcessParticipations(pool, actor.userId, requireTenant(actor));
  },

  async listSkillGapScores(actor: SelfActor) {
    return repo.listMySkillGapScores(pool, actor.userId, requireTenant(actor));
  },

  /** #59 F/F5 (ADR-0031) — the caller's OWN computed intelligence, evidence
   *  included. Self-scope by construction (filters on actor.userId only). */
  async getDevelopment(actor: SelfActor) {
    const { flightRisk, capability } = await repo.readMyDevelopment(pool, actor.userId);
    return { flightRisk, capability, generatedAt: new Date().toISOString() };
  },

  async listCertifications(actor: SelfActor) {
    return repo.listMyCertifications(pool, actor.userId);
  },

  async addCertification(actor: SelfActor, body: CreateMeCertificationBody) {
    const tenantId = requireTenant(actor);
    return repo.insertMyCertification(pool, actor.userId, tenantId, body);
  },

  async listDocuments(actor: SelfActor) {
    return repo.listMyDocuments(pool, actor.userId);
  },

  /** Caller's own UI preferences (WS-4 P1). Returns the brand defaults when no row exists yet —
   *  the server is the source of truth, re-applied on every login. */
  async getPreferences(actor: SelfActor): Promise<UserPreference> {
    return repo.loadPreferences(pool, actor.userId);
  },

  /** Partial update of the caller's UI preferences (theme and/or palette). Tenant is taken from
   *  the resolving actor (FK isolation, never from request input); null tenant is allowed (the
   *  column is nullable for platform-scoped users). */
  async updatePreferences(actor: SelfActor, patch: UpdateUserPreferenceBody): Promise<UserPreference> {
    return repo.upsertPreferences(pool, actor.userId, actor.tenantId, patch);
  },

  /* --- Self-service session management (MVP-4 §2.5) — refresh-token families --- */

  /** The caller's own active sessions, most-recent first, capped at 50 (the active set can be
   *  large with no-rotation logins). The "current" session is resolved client-side via
   *  GET /v1/auth/sessions/current (the refresh cookie is path-scoped to /v1/auth). */
  async listSessions(actor: SelfActor): Promise<ListActiveSessionsResponse> {
    const rows = await authRepo.listActiveRefreshTokenFamiliesForUser(pool, actor.userId, 50);
    return {
      items: rows.map((r) => ({
        familyId: r.familyId,
        tenantId: r.tenantId,
        firstIssuedAt: r.firstIssuedAt.toISOString(),
        lastIssuedAt: r.lastIssuedAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        ip: r.ip,
        userAgent: r.userAgent,
      })),
      total: rows.length,
    };
  },

  /** Revoke ONE of the caller's own families. user_id-guarded → a foreign familyId is a no-op
   *  that surfaces as 404 (cross-user revoke is impossible). */
  async revokeSession(actor: SelfActor, familyId: string): Promise<void> {
    const n = await authRepo.revokeRefreshFamilyForUser(pool, familyId, actor.userId, "LOGOUT");
    if (n === 0) throw new NotFoundError("Session");
  },

  /** Log out everywhere else: revoke all the caller's families except the current one. */
  async revokeOtherSessions(actor: SelfActor, currentFamilyId: string | null): Promise<RevokeOtherSessionsResponse> {
    const revokedFamilies = await authRepo.revokeOtherRefreshFamiliesForUser(pool, actor.userId, currentFamilyId, "LOGOUT");
    return { revokedFamilies };
  },

  /* --- D-14 F3/F4 — GDPR self-service: consent ledger (append-only) ------- */

  /** Current consent state = latest ledger event per purpose; purposes with no
   *  event ever are reported granted=false (no consent recorded). */
  async consentState(actor: SelfActor): Promise<ConsentStateResponse> {
    const state = await gdprRepo.getConsentState(pool, actor.userId);
    return {
      items: ConsentPurposeEnum.options.map((purpose) => ({
        purpose,
        granted: state.get(purpose)?.granted ?? false,
        lastChangedAt: state.get(purpose)?.lastChangedAt ?? null,
      })),
    };
  },

  async recordConsent(actor: SelfActor, body: ConsentEventBody): Promise<ConsentEventResponse> {
    const tenantId = requireTenant(actor);
    const { occurredAt } = await gdprRepo.insertConsentEvent(pool, {
      tenantId,
      userId: actor.userId,
      purpose: body.purpose,
      action: body.action,
      source: "ESS",
      note: body.note ?? null,
    });
    return { purpose: body.purpose, action: body.action, occurredAt };
  },

  /* --- ciò che un algoritmo dice di me (#126, Enzo 2026-08-04) ---------------------- */

  /** Le predizioni calcolate SU DI ME, ciascuna col modello che l'ha prodotta. */
  async listPredictions(actor: SelfActor) {
    const tenantId = requireTenant(actor);
    const items = await repo.listMyPredictions(pool, actor.userId, tenantId);
    return { items, total: items.length };
  },

  /** Gli abbinamenti in cui l'allievo sono io — mai il lato mentore, che sarebbe una
   *  graduatoria fra persone (Enzo, 2026-08-04). */
  async listMentorMatches(actor: SelfActor) {
    const tenantId = requireTenant(actor);
    const items = await repo.listMyMentorMatches(pool, actor.userId, tenantId);
    return { items, total: items.length };
  },

  /** Le rilevazioni di umore e carico che ho scritto io (Enzo, 2026-08-13). */
  async listPulseChecks(actor: SelfActor) {
    const tenantId = requireTenant(actor);
    const items = await repo.listMyPulseChecks(pool, actor.userId, tenantId);
    return { items, total: items.length };
  },
};
