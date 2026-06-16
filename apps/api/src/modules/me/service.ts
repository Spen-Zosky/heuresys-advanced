/**
 * apps/api/src/modules/me/service.ts
 * All methods take the canonical userId from the route, which sources it
 * from req.user.userId. No method accepts userId from user input.
 */
import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  MeProfile, UpdateMeProfileBody, CreateMeSelfAssessmentBody,
  CreateMeEnrollmentBody, CreateMeCareerTargetBody,
  MeInboxQuery, PatchMeInboxBody,
  CreateMeCertificationBody,
  MeInterfacesResponse,
  UserPreference, UpdateUserPreferenceBody,
  NotificationPreferencesResponse, UpdateNotificationPreferenceBody,
} from "@heuresys/shared";
import { NotificationTypeSchema } from "@heuresys/shared";
import * as repo from "./repository.js";
import * as authRepo from "../auth/repository.js";
import type { ListActiveSessionsResponse, RevokeOtherSessionsResponse } from "@heuresys/shared";
import { userPermissionCodes } from "../../middleware/rbac.js";
import { emitNotification } from "../../lib/notifications/emit.js";

/** Web layout's ADMIN_ROLES (hybrid gate): the admin sidebar section requires one of these roles
 *  AND the per-item permission. Mirrors apps/web (authenticated)/layout.tsx so the DB-driven
 *  sidebar does not leak admin nav to a pure USER (who holds several *:read codes for ESS). */
const UI_ADMIN_ROLES = new Set([
  "PLATFORM_ADMIN", "TENANT_ADMIN", "BLUEPRINT_MANAGER", "HRMS_MANAGER", "PROCESS_OWNER", "MANAGER",
]);
const UI_PERSPECTIVES = [
  { code: "PROCESS" as const, label: "Process" },
  { code: "ENTERPRISE" as const, label: "Enterprise" },
  { code: "TALENT" as const, label: "Talent" },
];

export interface SelfActor { userId: string; tenantId: string | null; roles: string[] }

function requireTenant(a: SelfActor): string {
  if (!a.tenantId) throw new ForbiddenError("Tenant context required");
  return a.tenantId;
}

export const meService = {
  /** Sidebar registry filtered to the caller (U1). ESS items are always visible; admin items
   *  require an admin-class role AND the per-item permission. All 3 PET perspectives are always
   *  returned (an empty one renders an honest empty-state in the UI). */
  async getInterfaces(actor: SelfActor): Promise<MeInterfacesResponse> {
    const permSet = new Set(userPermissionCodes({ roles: actor.roles }));
    const hasAdminRole = actor.roles.some((r) => UI_ADMIN_ROLES.has(r));
    const rows = await repo.loadActiveInterfaces(pool);
    const visible = rows.filter((i) => {
      if (!i.requiresAdmin) return true; // ESS / always-visible
      if (!hasAdminRole) return false; // admin section gated to admin-class roles
      if (i.requiredResource === null || i.requiredAction === null) return true; // e.g. dashboard
      return permSet.has(`${i.requiredResource}:${i.requiredAction}`);
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

  async submitSelfAssessment(actor: SelfActor, body: CreateMeSelfAssessmentBody) {
    const tenantId = requireTenant(actor);
    if (!(await repo.skillVisibleToTenant(pool, body.skillId, tenantId))) {
      throw new NotFoundError("Skill");
    }
    return repo.insertSelfAssessment(pool, actor.userId, tenantId, body);
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
};
