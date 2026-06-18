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

/** Pure re-derivation of request status from its steps (§2.3). */
function deriveStatus(policy: string, steps: repo.ApprovalStepRow[]): "APPROVED" | "REJECTED" | "PENDING" {
  if (steps.some((s) => s.status === "REJECTED")) return "REJECTED";
  if (policy === "ALL_OF" && steps.every((s) => s.status === "APPROVED")) return "APPROVED";
  if (policy === "ANY_OF" && steps.some((s) => s.status === "APPROVED")) return "APPROVED";
  return "PENDING";
}

export const approvalService = {
  async createRequest(a: ActorContext, body: CreateApprovalRequestBody): Promise<ApprovalRequest> {
    const approverIds = [...new Set(body.approverUserIds)];
    // Resolve approvers + derive the request tenant (all approvers share one tenant — I5).
    const approvers = await repo.resolveApprovers(pool, approverIds);
    if (approvers.length !== approverIds.length) {
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

    const request = await withTransaction(async (client) => {
      const req = await repo.insertRequest(client, {
        tenantId: requestTenant,
        title: body.title,
        body: body.body ?? null,
        resourceType: body.resourceType ?? null,
        resourceId: body.resourceId ?? null,
        decisionPolicy: body.decisionPolicy ?? "ALL_OF",
        priority: body.priority ?? "MEDIUM",
        createdBy: a.userId,
      });
      const steps = await repo.insertSteps(client, req.approvalRequestId, requestTenant, approverIds);
      // Deliver each step to the approver's inbox (3.4 notification center) in-txn.
      for (const step of steps) {
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
      const newStatus = body.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const step = await repo.decideStepGuarded(client, stepId, newStatus, body.comment ?? null, a.userId);
      if (!step) throw new ConflictError("This step was already decided", "ALREADY_DECIDED");

      await repo.markInboxReadForStep(client, stepId, a.userId);

      // Re-derive the parent request status from all its steps.
      const steps = await repo.loadSteps(client, requestId);
      const derived = deriveStatus(found.requestPolicy, steps);
      if (derived === "REJECTED") {
        await repo.setRequestStatus(client, requestId, "REJECTED");
      } else if (derived === "APPROVED") {
        if (found.requestPolicy === "ANY_OF") await repo.skipPendingSiblings(client, requestId);
        await repo.setRequestStatus(client, requestId, "APPROVED");
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
