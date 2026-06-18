/**
 * apps/api/src/modules/approvals/service.ts
 * 3.3 slice-D — generic approval runtime service + state machine.
 *
 * Tenant model (I5): a request belongs to ONE tenant, derived from its approvers
 * (all approvers must share a single tenant). A non-platform actor may only create
 * a request whose approvers are in the actor's own tenant. Reads are tenant-filtered
 * (PLATFORM_ADMIN cross-tenant). Decision authority is doubly gated: the approval:decide
 * permission (route) PLUS a data-layer check that the actor owns the PENDING step.
 *
 * Request status is re-derived from the steps on every decision, inside a transaction:
 *   ANY step REJECTED                       → REJECTED (terminal)
 *   ALL_OF AND every step APPROVED          → APPROVED (terminal)
 *   ANY_OF AND ≥1 step APPROVED             → APPROVED (terminal; PENDING siblings → SKIPPED)
 *   otherwise                               → stays PENDING
 *   APPROVED → APPLIED (explicit apply call only)
 */
import { pool, withTransaction } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from "../../errors/index.js";
import { emitNotification } from "../../lib/notifications/emit.js";
import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalStep,
  ApprovalStepDetail,
  ApprovalRequestListItem,
  ApprovalListResponse,
  ApprovalStatus,
  ApprovalStepStatus,
  ApprovalDecisionPolicy,
  ApprovalPriority,
  CreateApprovalRequestBody,
  DecideApprovalStepBody,
  ApprovalListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export type { ActorContext };

const DEFAULT_LIST_LIMIT = 50;

function buildScope(a: ActorContext): repo.ScopeFilter {
  const platform = isPlatform(a);
  return { isPlatform: platform, tenantId: platform ? null : a.tenantId };
}

/* --- row → contract mappers ------------------------------------------------ */
const toRequest = (r: repo.ApprovalRequestRow): ApprovalRequest => ({
  approvalRequestId: r.approvalRequestId,
  tenantId: r.tenantId,
  title: r.title,
  body: r.body,
  resourceType: r.resourceType,
  resourceId: r.resourceId,
  status: r.status as ApprovalStatus,
  decisionPolicy: r.decisionPolicy as ApprovalDecisionPolicy,
  priority: r.priority as ApprovalPriority,
  metadata: r.metadata,
  resolvedAt: r.resolvedAt,
  appliedAt: r.appliedAt,
  createdAt: r.createdAt,
  createdBy: r.createdBy,
  updatedAt: r.updatedAt,
});

const toStep = (r: repo.ApprovalStepRow): ApprovalStep => ({
  approvalStepId: r.approvalStepId,
  requestId: r.requestId,
  tenantId: r.tenantId,
  approverUserId: r.approverUserId,
  ordinal: r.ordinal,
  levelPolicy: r.levelPolicy as ApprovalDecisionPolicy | null,
  status: r.status as ApprovalStepStatus,
  decisionComment: r.decisionComment,
  decidedAt: r.decidedAt,
  decidedBy: r.decidedBy,
  metadata: r.metadata,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const toStepDetail = (r: repo.ApprovalStepDetailRow): ApprovalStepDetail => ({
  ...toStep(r),
  approverEmail: r.approverEmail,
  approverName: r.approverName,
});

const toListItem = (r: repo.ApprovalRequestListRow): ApprovalRequestListItem => ({
  ...toRequest(r),
  stepCount: r.stepCount,
  pendingStepCount: r.pendingStepCount,
});

interface ChainPlan {
  status: "PENDING" | "APPROVED" | "REJECTED";
  activeOrdinal?: number; // PENDING: the first in-progress level (its pending steps get the inbox)
  failedOrdinal?: number; // REJECTED: the level that failed (it + higher → SKIPPED)
}

/** Level-aware re-derivation of the request status (slice-2 ordered chain).
 *  Evaluates levels in ascending ordinal; per-level quorum = the step's level_policy
 *  (falls back to the request policy). A level FAILS (→ REJECTED) on ALL_OF any-reject or
 *  ANY_OF all-reject; SATISFIES on ALL_OF all-approved or ANY_OF any-approved; otherwise it
 *  is the active (in-progress) level. A single level reproduces slice-1 deriveStatus exactly. */
function deriveChain(requestPolicy: string, steps: repo.ApprovalStepRow[]): ChainPlan {
  const ordinals = [...new Set(steps.map((s) => s.ordinal))].sort((a, b) => a - b);
  for (const ord of ordinals) {
    const lvl = steps.filter((s) => s.ordinal === ord);
    const policy = lvl.find((s) => s.levelPolicy)?.levelPolicy ?? requestPolicy;
    const total = lvl.length;
    const approved = lvl.filter((s) => s.status === "APPROVED").length;
    const rejected = lvl.filter((s) => s.status === "REJECTED").length;
    const failed = policy === "ALL_OF" ? rejected > 0 : rejected === total;
    if (failed) return { status: "REJECTED", failedOrdinal: ord };
    const satisfied = policy === "ALL_OF" ? approved === total : approved > 0;
    if (satisfied) continue; // level done → evaluate the next
    return { status: "PENDING", activeOrdinal: ord }; // first level still open
  }
  return { status: "APPROVED" };
}

export const approvalService = {
  async createRequest(a: ActorContext, body: CreateApprovalRequestBody): Promise<ApprovalRequest> {
    // Normalize to canonical ordered levels (slice-1 flat approverUserIds = a single level).
    const rawLevels = body.levels ?? [{ approverUserIds: body.approverUserIds!, policy: undefined }];
    const levels = rawLevels.map((l) => ({ approverUserIds: [...new Set(l.approverUserIds)], policy: l.policy }));
    const allIds = levels.flatMap((l) => l.approverUserIds);
    // The 000132 UNIQUE(request, approver) means an approver may appear in only ONE level.
    if (new Set(allIds).size !== allIds.length) {
      throw new ValidationError({ approverUserIds: "An approver may appear in only one level" }, "Duplicate approver across levels");
    }
    // Resolve approvers + derive the request tenant (all approvers share one tenant — I5).
    const approvers = await repo.resolveApprovers(pool, allIds);
    if (approvers.length !== allIds.length) {
      throw new ValidationError({ approverUserIds: "One or more approvers do not exist" }, "Unknown approver");
    }
    const tenants = new Set(approvers.map((u) => u.tenantId));
    if (tenants.has(null)) {
      throw new ValidationError({ approverUserIds: "An approver has no tenant" }, "Approver without tenant");
    }
    if (tenants.size !== 1) {
      throw new ValidationError({ approverUserIds: "All approvers must belong to a single tenant" }, "Cross-tenant approvers");
    }
    const requestTenant = approvers[0]!.tenantId!;
    // Non-platform actors may only target their own tenant (I5).
    if (!isPlatform(a) && a.tenantId !== requestTenant) {
      throw new ForbiddenError("Approvers must be in your tenant", "CROSS_TENANT_APPROVER");
    }

    const requestPolicy = body.decisionPolicy ?? "ALL_OF";
    // Materialize steps: ordinal = 1-based level index; level_policy = explicit per-level
    // policy or NULL (→ falls back to the request policy at derive time).
    const stepInputs: repo.StepInput[] = levels.flatMap((l, i) =>
      l.approverUserIds.map((uid) => ({ approverUserId: uid, ordinal: i + 1, levelPolicy: l.policy ?? null })),
    );

    const request = await withTransaction(async (client) => {
      const req = await repo.insertRequest(client, {
        tenantId: requestTenant,
        title: body.title,
        body: body.body ?? null,
        resourceType: body.resourceType ?? null,
        resourceId: body.resourceId ?? null,
        decisionPolicy: requestPolicy,
        priority: body.priority ?? "MEDIUM",
        createdBy: a.userId,
      });
      const steps = await repo.insertSteps(client, req.approvalRequestId, requestTenant, stepInputs);
      // Deliver ONLY the first level's steps to their inbox; higher levels open as prior
      // levels are satisfied (slice-2). Single-level requests behave exactly as slice-1.
      for (const step of steps) {
        if (step.ordinal !== 1) continue;
        await emitNotification(client, {
          tenantId: step.tenantId,
          userId: step.approverUserId,
          type: "APPROVAL_REQUEST",
          subject: req.title,
          body: req.body,
          priority: req.priority as ApprovalPriority,
          resourceType: "APPROVAL_STEP",
          resourceId: step.approvalStepId,
          actionUrl: `/approvals/${req.approvalRequestId}?step=${step.approvalStepId}`,
          createdBy: a.userId,
          dedupe: true,
        });
      }
      return req;
    });
    return toRequest(request);
  },

  async listRequests(a: ActorContext, query: ApprovalListQuery): Promise<ApprovalListResponse> {
    const items = await repo.listRequests(pool, buildScope(a), {
      status: query.status,
      resourceType: query.resourceType,
      limit: query.limit ?? DEFAULT_LIST_LIMIT,
    });
    return { items: items.map(toListItem), total: items.length };
  },

  async getRequest(a: ActorContext, id: string): Promise<ApprovalRequestDetail> {
    const detail = await repo.findRequestDetail(pool, buildScope(a), id);
    if (!detail) throw new NotFoundError("Approval request");
    return {
      ...toRequest(detail.request),
      createdByEmail: detail.createdByEmail,
      steps: detail.steps.map(toStepDetail),
    };
  },

  async decideStep(a: ActorContext, requestId: string, stepId: string, body: DecideApprovalStepBody): Promise<ApprovalStep> {
    const scope = buildScope(a);
    const decided = await withTransaction(async (client) => {
      const found = await repo.findStepWithRequest(client, scope, requestId, stepId);
      if (!found) throw new NotFoundError("Approval step");
      // Data-layer authority: you may only decide YOUR OWN step (necessary on top of the perm).
      if (found.step.approverUserId !== a.userId) {
        throw new ForbiddenError("Not your approval step", "PERMISSION_DENIED");
      }
      if (found.requestStatus !== "PENDING") {
        throw new ConflictError("Request already resolved", "REQUEST_RESOLVED");
      }
      // slice-2: the step's level must be ACTIVE (the MIN pending ordinal). A higher-level
      // approver cannot pre-decide before the prior levels resolve.
      const active = await repo.activePendingOrdinal(client, requestId);
      if (active !== null && found.step.ordinal !== active) {
        throw new ConflictError("This approval level is not yet active", "LEVEL_NOT_ACTIVE");
      }
      const newStatus = body.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const step = await repo.decideStepGuarded(client, stepId, newStatus, body.comment ?? null, a.userId);
      if (!step) throw new ConflictError("This step was already decided", "ALREADY_DECIDED");

      await repo.markInboxReadForStep(client, stepId, a.userId);

      // Re-derive the chain (level-aware) from all steps.
      const steps = await repo.loadSteps(client, requestId);
      const plan = deriveChain(found.requestPolicy, steps);
      if (plan.status === "REJECTED") {
        await repo.skipPendingGte(client, requestId, plan.failedOrdinal!); // failed level + higher → SKIPPED
        await repo.setRequestStatus(client, requestId, "REJECTED");
      } else if (plan.status === "APPROVED") {
        await repo.skipPendingGte(client, requestId, 1); // any leftover ANY_OF pending → SKIPPED
        await repo.setRequestStatus(client, requestId, "APPROVED");
      } else {
        // Still PENDING: a higher level may have just opened. Skip satisfied lower-level
        // siblings, then deliver the active level's pending steps to their inbox (dedupe →
        // already-notified steps are never re-notified, so level 1 stays put).
        await repo.skipPendingLt(client, requestId, plan.activeOrdinal!);
        const req = await repo.findRequestScoped(client, scope, requestId);
        const fresh = await repo.loadSteps(client, requestId);
        for (const s of fresh) {
          if (s.status !== "PENDING" || s.ordinal !== plan.activeOrdinal) continue;
          await emitNotification(client, {
            tenantId: s.tenantId,
            userId: s.approverUserId,
            type: "APPROVAL_REQUEST",
            subject: req?.title ?? "Approval required",
            body: req?.body ?? null,
            priority: (req?.priority as ApprovalPriority) ?? "MEDIUM",
            resourceType: "APPROVAL_STEP",
            resourceId: s.approvalStepId,
            actionUrl: `/approvals/${requestId}?step=${s.approvalStepId}`,
            createdBy: req?.createdBy ?? a.userId,
            dedupe: true,
          });
        }
      }
      return step;
    });
    return toStep(decided);
  },

  async applyRequest(a: ActorContext, id: string): Promise<ApprovalRequest> {
    const scope = buildScope(a);
    const current = await repo.findRequestScoped(pool, scope, id);
    if (!current) throw new NotFoundError("Approval request");
    if (current.status !== "APPROVED") {
      throw new ConflictError("Request is not in APPROVED state", "NOT_APPROVED");
    }
    const applied = await withTransaction(async (client) => repo.markApplied(client, id));
    if (!applied) throw new ConflictError("Request is not in APPROVED state", "NOT_APPROVED");
    return toRequest(applied);
  },
};
