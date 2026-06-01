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
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { userPermissionCodes } from "../../middleware/rbac.js";

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
    return repo.insertEnrollment(pool, actor.userId, tenantId, body);
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
    return repo.insertCareerTarget(pool, actor.userId, tenantId, body);
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
};
