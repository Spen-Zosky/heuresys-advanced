/**
 * apps/api/src/modules/time-off/service.ts — A/L8 (#33). READ-only.
 *
 * Leave data is PERSONAL (data-classes: `leave`). Requests + balance transactions
 * are person-level → gated by the ORGANIZATIONAL axis (resolveOrgReadScope: self /
 * transitive org sub-tree / HR-mandate tenant / platform all — ADR-0027 F3, I18).
 * Accrual rules are tenant leave POLICY (no person rows) → tenant-scoped only
 * (route declares orgGate:"catalog"). Self views (/v1/me/time-off) are I17-floored.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import type {
  TimeOffRequestListQuery,
  LeaveAccrualRuleListQuery,
  LeaveBalanceTransactionListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope } from "../../lib/scope/resolver.js";

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
};
