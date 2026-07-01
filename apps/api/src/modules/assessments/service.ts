/**
 * apps/api/src/modules/assessments/service.ts
 *
 * Tenant-scoped only (assessment_tenant_id NOT NULL):
 *   - PLATFORM_ADMIN: cross-tenant; must supply body.tenantId on create
 *     (or fall back to actor.tenantId if seeded with one).
 *   - Non-platform: pinned to own tenant.
 *
 * FK validation:
 *   - subjectUserId must exist and belong to the resolved tenant
 *     → 404 if user missing, 403 USER_NOT_IN_TENANT if mismatch.
 *   - methodId (optional) must exist if provided → 404.
 *
 * No DELETE — retire via status='CANCELLED'.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import { emitNotification } from "../../lib/notifications/emit.js";
import type {
  Assessment,
  AssessmentListQuery,
  CreateAssessmentBody,
  UpdateAssessmentBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { methodExists } from "../assessment-methods/repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

async function ensureSubjectInTenant(subjectUserId: string, tenantId: string): Promise<void> {
  const u = await repo.getUserTenant(pool, subjectUserId);
  if (!u) throw new NotFoundError("User");
  if (u.tenantId !== tenantId) {
    throw new ForbiddenError(
      "Subject user does not belong to the assessment's tenant",
      "USER_NOT_IN_TENANT",
    );
  }
}

export const assessmentsService = {
  async list(actor: ActorContext, query: AssessmentListQuery) {
    // ADR-0027 F3: resolve the actor's ORGANIZATIONAL read scope once, then filter the list
    // by it. PLATFORM_ADMIN -> all; HR-mandated (TENANT_ADMIN/HRMS_MANAGER) -> whole tenant;
    // managerial -> transitive org sub-tree; everyone else -> self.
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    return repo.listAssessments(pool, { tenantId, userIdAllowList, query });
  },

  async getById(actor: ActorContext, id: string): Promise<Assessment> {
    const target = await repo.findAssessmentById(pool, id);
    if (!target) throw new NotFoundError("Assessment");
    // ADR-0027 F3: gate the per-target read on the organizational axis (self / HR-mandate /
    // transitive org sub-tree). 404 (not 403) avoids existence enumeration across the boundary.
    if (!(await canReadOrgTarget(pool, actor, target.subjectUserId, target.tenantId))) {
      throw new NotFoundError("Assessment");
    }
    return target;
  },

  async create(actor: ActorContext, body: CreateAssessmentBody): Promise<Assessment> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const candidate = body.tenantId ?? actor.tenantId;
      if (!candidate) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId for assessments",
          "TENANT_ID_REQUIRED",
        );
      }
      tenantId = candidate;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    await ensureSubjectInTenant(body.subjectUserId, tenantId);
    if (body.methodId) {
      const ok = await methodExists(pool, body.methodId);
      if (!ok) throw new NotFoundError("AssessmentMethod");
    }
    const created = await repo.insertAssessment(pool, tenantId, body, actor.userId);
    // 3.4 ASSESSMENT_REQUEST — notify the subject of the new assessment (best-effort).
    try {
      await emitNotification(pool, {
        tenantId,
        userId: created.subjectUserId,
        type: "ASSESSMENT_REQUEST",
        subject: "Nuova valutazione richiesta",
        body: `Ti è stata assegnata una valutazione (${created.kind}).`,
        priority: "MEDIUM",
        resourceType: "ASSESSMENT",
        resourceId: created.assessmentId,
        actionUrl: "/me/assessments",
        createdBy: actor.userId,
      });
    } catch {
      /* best-effort */
    }
    return created;
  },

  async update(actor: ActorContext, id: string, patch: UpdateAssessmentBody): Promise<Assessment> {
    const target = await repo.findAssessmentById(pool, id);
    if (!target) throw new NotFoundError("Assessment");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("Assessment");
      }
    }
    if (patch.methodId !== undefined && patch.methodId !== null) {
      const ok = await methodExists(pool, patch.methodId);
      if (!ok) throw new NotFoundError("AssessmentMethod");
    }
    const updated = await repo.updateAssessmentPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("Assessment");
    return updated;
  },
};
