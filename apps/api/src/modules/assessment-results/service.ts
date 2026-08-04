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
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

/**
 * #124 / ADR-0032 — what goes when an evaluation is read under the platform
 * mandate. The judgment itself (`score`), the free text written about it
 * (`narrative`) and the untyped `metadata` record, which cannot be verified
 * field by field. What STAYS: the dimension, the assessor, the date — the
 * technical administrator keeps knowing that the evaluation exists.
 */
const EVALUATION_JUDGMENT_FIELDS = ["score", "narrative", "metadata"] as const;

export const assessmentResultsService = {
  async list(actor: ActorContext, query: AssessmentResultListQuery) {
    // ADR-0027 F3: a result's subject is the PARENT assessment's subject user — filter the
    // list by the actor's organizational read scope, like the parent assessments module.
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const page = await repo.listResults(pool, { tenantId, userIdAllowList, query });

    // #124 — cheap pre-check: with a null subject this answers "is this actor a
    // platform-mandate-only reader at all", so a normal caller never pays for
    // the subject lookup below.
    if (!masksUnderPlatformMandate(actor, "EVALUATION", null)) return page;
    const subjects = await repo.subjectsOfAssessments(pool, page.items.map((i) => i.assessmentId));
    return {
      ...page,
      items: page.items.map((r) =>
        masksUnderPlatformMandate(actor, "EVALUATION", subjects.get(r.assessmentId) ?? null)
          ? maskFields(r, EVALUATION_JUDGMENT_FIELDS)
          : r,
      ),
    };
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
    // #124 — the parent was already fetched for the org gate, so the subject is
    // in hand and I17 costs nothing here.
    return masksUnderPlatformMandate(actor, "EVALUATION", parent.subjectUserId)
      ? maskFields(target, EVALUATION_JUDGMENT_FIELDS)
      : target;
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
