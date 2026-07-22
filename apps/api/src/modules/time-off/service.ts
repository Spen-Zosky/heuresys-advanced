/**
 * apps/api/src/modules/time-off/service.ts — A/L8 (#33), write path B3 (#34).
 *
 * Leave data is PERSONAL (data-classes: `leave`). Requests + balance transactions
 * are person-level → gated by the ORGANIZATIONAL axis (resolveOrgReadScope: self /
 * transitive org sub-tree / HR-mandate tenant / platform all — ADR-0027 F3, I18).
 * Accrual rules are tenant leave POLICY (no person rows) → tenant-scoped only
 * (route declares orgGate:"catalog"). Self views (/v1/me/time-off) are I17-floored.
 *
 * B3 (#34): `submitOwnRequest` is the ESS write path — it creates an APPROVAL
 * request (TIME_OFF_REQUEST, approver = direct org manager) and NOTHING else;
 * the leave tables are written by the apply-effect handler once approved
 * (approvals/effects/time-off-request.ts). Balance check here is advisory;
 * the hard, race-safe guard lives in the handler's apply transaction.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import type {
  TimeOffRequestListQuery,
  LeaveAccrualRuleListQuery,
  LeaveBalanceTransactionListQuery,
  CreateMeTimeOffRequestBody,
  MeTimeOffRequestSubmitted,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope } from "../../lib/scope/resolver.js";
import { ConflictError, ForbiddenError, ValidationError } from "../../errors/index.js";
import { approvalService } from "../approvals/service.js";
import { TIME_OFF_REQUEST } from "../approvals/effects/time-off-request.js";

/** Mon–Fri count over an inclusive ISO-date range (no holiday calendar — deterministic floor). */
function workingDays(startIso: string, endIso: string): number {
  let n = 0;
  const d = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  for (; d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/** Reduce an OrgReadScope to the (tenantId?, userIdAllowList?) repo filter. */
async function orgFilter(
  actor: ActorContext,
): Promise<{ tenantId?: string; userIdAllowList?: string[] }> {
  const scope = await resolveOrgReadScope(pool, actor);
  switch (scope.kind) {
    case "all":
      return {};
    case "tenant":
      return { tenantId: scope.tenantId };
    case "subtree":
    case "self":
      return { tenantId: scope.tenantId, userIdAllowList: scope.userIdAllowList };
  }
}

export const timeOffService = {
  /** Org-gated list of leave requests (I18). */
  async listRequests(actor: ActorContext, query: TimeOffRequestListQuery) {
    return repo.listRequests(pool, { ...(await orgFilter(actor)), query });
  },

  /** ESS self view (I17) — the caller's own requests. Needs only the caller's id
   *  (the `me` module's SelfActor satisfies this without a RoleCode[] cast). The
   *  incoming `userId` filter is STRIPPED: the me-module contract forbids taking a
   *  subject id from request input — the self scope is pinned to actor.userId. */
  async listOwnRequests(actor: { userId: string }, query: TimeOffRequestListQuery) {
    return repo.listRequestsForUser(pool, actor.userId, { ...query, userId: undefined });
  },

  /** Tenant leave policy (no person rows) — tenant-scoped only. */
  async listAccrualRules(actor: ActorContext, query: LeaveAccrualRuleListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listAccrualRules(pool, tenantId, query);
  },

  /** Org-gated per-balance ledger (I18) — gated on the balance's subject user. */
  async listBalanceTransactions(actor: ActorContext, query: LeaveBalanceTransactionListQuery) {
    return repo.listBalanceTransactions(pool, { ...(await orgFilter(actor)), query });
  },

  /** B3 (#34): ESS submission — creates the TIME_OFF_REQUEST approval, nothing else. */
  async submitOwnRequest(
    actor: ActorContext,
    body: CreateMeTimeOffRequestBody,
  ): Promise<MeTimeOffRequestSubmitted> {
    if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
    if (body.endDate < body.startDate) {
      throw new ValidationError({ endDate: "endDate must be on or after startDate" }, "Invalid date range");
    }
    if (body.startDate.slice(0, 4) !== body.endDate.slice(0, 4)) {
      // Balances are per calendar year — a cross-year span would need a split.
      throw new ValidationError({ endDate: "the range must stay within one calendar year" }, "Cross-year range");
    }
    const days =
      workingDays(body.startDate, body.endDate) -
      (body.halfDayStart ? 0.5 : 0) -
      (body.halfDayEnd ? 0.5 : 0);
    if (days <= 0) {
      throw new ValidationError({ startDate: "the range contains no working days" }, "Empty working range");
    }

    const year = Number(body.startDate.slice(0, 4));
    const balance = await repo.findBalanceAvailability(
      pool, actor.tenantId, actor.userId, body.leaveType, year,
    );
    if (!balance) {
      throw new ConflictError(`No ${body.leaveType} balance for ${year}`, "LEAVE_BALANCE_MISSING");
    }
    if (balance.availableDays < days) {
      throw new ConflictError(
        `Insufficient ${body.leaveType} balance: ${balance.availableDays} available, ${days} requested`,
        "LEAVE_BALANCE_INSUFFICIENT",
      );
    }

    const managerId = await repo.findDirectManagerUserId(pool, actor.userId);
    if (!managerId) {
      throw new ConflictError("No direct manager resolvable for the requester", "NO_APPROVER_RESOLVABLE");
    }

    const created = await approvalService.createRequest(actor, {
      title: `Time off ${body.leaveType} ${body.startDate} → ${body.endDate} (${days}g)`,
      body: body.reason ?? null,
      resourceType: TIME_OFF_REQUEST,
      priority: "MEDIUM",
      metadata: {
        subjectUserId: actor.userId,
        leaveType: body.leaveType,
        startDate: body.startDate,
        endDate: body.endDate,
        days,
        halfDayStart: body.halfDayStart === true,
        halfDayEnd: body.halfDayEnd === true,
        reason: body.reason ?? null,
      },
      approverUserIds: [managerId],
    });

    return {
      approvalRequestId: created.approvalRequestId,
      title: created.title,
      status: created.status,
      daysRequested: days,
      approverUserId: managerId,
    };
  },
};
