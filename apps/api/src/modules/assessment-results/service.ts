/**
 * apps/api/src/modules/assessment-results/service.ts
 *
 * Immutable scoring rows attached to a parent assessment.
 *   - list/get: tenant-scoped (PLATFORM_ADMIN cross-tenant, others pinned)
 *   - create: validate parent assessment visibility, propagate tenant from parent,
 *     optionally validate assessorUserId belongs to the same tenant.
 *
 * No update / no delete — results are append-only audit trail.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import { emitNotification } from "../../lib/notifications/emit.js";
import type {
  AssessmentResult,
  AssessmentResultListQuery,
  CreateAssessmentResultBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findAssessmentById } from "../assessments/repository.js";
import { getUserTenant } from "../assessments/repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

export const assessmentResultsService = {
  async list(actor: ActorContext, query: AssessmentResultListQuery) {
    // ADR-0027 F3: a result's subject is the PARENT assessment's subject user — filter the
    // list by the actor's organizational read scope, like the parent assessments module.
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    return repo.listResults(pool, { tenantId, userIdAllowList, query });
  },

  async getById(actor: ActorContext, id: string): Promise<AssessmentResult> {
    const target = await repo.findResultById(pool, id);
    if (!target) throw new NotFoundError("AssessmentResult");
    // ADR-0027 F3: gate the per-target read on the org axis via the PARENT assessment's
    // subject (self / HR-mandate / transitive org sub-tree). 404 avoids existence enumeration.
    const parent = await findAssessmentById(pool, target.assessmentId);
    if (!parent) throw new NotFoundError("AssessmentResult");
    if (!(await canReadOrgTarget(pool, actor, parent.subjectUserId, target.tenantId))) {
      throw new NotFoundError("AssessmentResult");
    }
    return target;
  },

  async create(actor: ActorContext, body: CreateAssessmentResultBody): Promise<AssessmentResult> {
    const parent = await findAssessmentById(pool, body.assessmentId);
    if (!parent) throw new NotFoundError("Assessment");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || parent.tenantId !== actor.tenantId) {
        throw new NotFoundError("Assessment");
      }
    }
    if (body.assessorUserId) {
      const u = await getUserTenant(pool, body.assessorUserId);
      if (!u) throw new NotFoundError("User");
      if (u.tenantId !== parent.tenantId) {
        throw new ForbiddenError(
          "Assessor user does not belong to the assessment's tenant",
          "ASSESSOR_NOT_IN_TENANT",
        );
      }
    }
    const created = await repo.insertResult(pool, parent.tenantId, body);
    // 3.4 MANAGER_FEEDBACK_READY — notify the assessment subject a result is in (best-effort).
    try {
      const subj = await pool.query<{ uid: string; tid: string }>(
        `SELECT assessment_subject_user_id AS uid, assessment_tenant_id AS tid
           FROM sys.sys_assessments WHERE assessment_id = $1`,
        [body.assessmentId],
      );
      const row = subj.rows[0];
      if (row) {
        await emitNotification(pool, {
          tenantId: row.tid,
          userId: row.uid,
          type: "MANAGER_FEEDBACK_READY",
          subject: "Feedback di valutazione disponibile",
          body: "Un valutatore ha registrato un risultato per la tua valutazione.",
          priority: "MEDIUM",
          resourceType: "ASSESSMENT",
          resourceId: body.assessmentId,
          actionUrl: "/me/assessments",
          createdBy: actor.userId,
        });
      }
    } catch {
      /* best-effort */
    }
    return created;
  },
};
