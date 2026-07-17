/**
 * apps/api/src/modules/compensation/service.ts
 * Decision-support layer for compensation intelligence + reward gates.
 * NOT payroll execution (invariant I8).
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  CompensationProfile,
  RewardGatesListQuery,
  RewardGate,
  CompensationRecommendation,
  CreateCompensationRecommendationBody,
  PayrollHandoffRecord,
  CreatePayrollHandoffRecordBody,
  CompensationDistributionResponse,
  VariablePayCalculationListQuery,
  CompensationRecommendationListQuery,
  BonusPoolListQuery,
  ObjectiveRewardRuleListQuery,
  PositionEconomicWeightListQuery,
  PayrollHandoffRecordListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

function requireTenant(a: ActorContext): string {
  if (!a.tenantId) {
    throw new ForbiddenError("Tenant context required", "TENANT_CONTEXT_REQUIRED");
  }
  return a.tenantId;
}

/** Reduce an OrgReadScope to the (tenantId?, userIdAllowList?) repo filter for the
 *  person-level compensation reads (A/L7 #32 — mirrors time-off/service.ts). */
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

/** Tenant filter for the catalog reads: PLATFORM_ADMIN → all tenants; else own tenant. */
function catalogTenant(actor: ActorContext): string | undefined {
  return isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
}

export const compensationService = {
  async getProfileByPosition(actor: ActorContext, positionId: string): Promise<CompensationProfile> {
    const positionTenant = await repo.findPositionTenantId(pool, positionId);
    if (!positionTenant) throw new NotFoundError("Position");
    if (!isPlatform(actor) && positionTenant !== actor.tenantId) {
      throw new NotFoundError("Position");
    }
    const profile = await repo.findCompensationProfileByPositionId(pool, positionId);
    if (!profile) throw new NotFoundError("CompensationProfile");
    return profile;
  },

  async listRewardGates(
    actor: ActorContext,
    query: RewardGatesListQuery,
  ): Promise<{ items: RewardGate[]; total: number }> {
    // ADR-0027 F3 (D-50): gate cross-user reward-gate reads by the actor's ORGANIZATIONAL
    // sub-tree. PLATFORM_ADMIN → all tenants; HR-mandated (TENANT_ADMIN, HRMS_MANAGER) →
    // whole tenant; managerial → transitive org sub-tree; everyone else → self.
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    // A caller filtering by an explicit userId they may not read gets an empty page
    // (not another user's data) — mirrors the users-module per-target gate.
    if (query.userId && !(await canReadOrgTarget(pool, actor, query.userId, tenantId ?? null))) {
      return { items: [], total: 0 };
    }
    return repo.listRewardGates(pool, { tenantId, userIdAllowList, query });
  },

  async getRewardGateDistribution(actor: ActorContext): Promise<CompensationDistributionResponse> {
    const tenantId = isPlatform(actor) ? undefined : requireTenant(actor);
    return repo.getRewardGateStatusDistribution(pool, tenantId);
  },

  async createRecommendation(
    actor: ActorContext,
    body: CreateCompensationRecommendationBody,
  ): Promise<CompensationRecommendation> {
    // Sanity: target user must belong to actor's tenant (unless PLATFORM_ADMIN).
    const targetUserTenant = await repo.findUserTenantId(pool, body.userId);
    if (!targetUserTenant) throw new NotFoundError("User");
    let tenantId: string;
    if (isPlatform(actor)) {
      tenantId = targetUserTenant;
    } else {
      const myTenant = requireTenant(actor);
      if (targetUserTenant !== myTenant) {
        throw new NotFoundError("User");
      }
      tenantId = myTenant;
    }
    if (body.positionId) {
      const posTenant = await repo.findPositionTenantId(pool, body.positionId);
      if (!posTenant || posTenant !== tenantId) {
        throw new NotFoundError("Position");
      }
    }
    return repo.insertCompensationRecommendation(pool, tenantId, body);
  },

  async createHandoffRecord(
    actor: ActorContext,
    body: CreatePayrollHandoffRecordBody,
  ): Promise<PayrollHandoffRecord> {
    const tenantId = isPlatform(actor)
      ? (actor.tenantId ?? null)
      : requireTenant(actor);
    if (!tenantId) {
      throw new ForbiddenError(
        "PLATFORM_ADMIN must operate within a tenant context for handoff records",
        "TENANT_CONTEXT_REQUIRED",
      );
    }
    return repo.insertPayrollHandoffRecord(pool, tenantId, body);
  },

  // ── A/L7 (#32) reads ────────────────────────────────────────────────────────

  /** Org-gated per-person variable pay (I18) — gated on the calculation's subject user. */
  async listVariablePay(actor: ActorContext, query: VariablePayCalculationListQuery) {
    return repo.listVariablePay(pool, { ...(await orgFilter(actor)), query });
  },

  /** Org-gated per-person compensation recommendations (I18). */
  async listRecommendations(actor: ActorContext, query: CompensationRecommendationListQuery) {
    return repo.listRecommendations(pool, { ...(await orgFilter(actor)), query });
  },

  /** Tenant/OU bonus pools (no person rows) — tenant-scoped only. */
  async listBonusPools(actor: ActorContext, query: BonusPoolListQuery) {
    return repo.listBonusPools(pool, catalogTenant(actor), query);
  },

  /** Tenant objective reward-rule catalog — tenant-scoped only. */
  async listObjectiveRewardRules(actor: ActorContext, query: ObjectiveRewardRuleListQuery) {
    return repo.listObjectiveRewardRules(pool, catalogTenant(actor), query);
  },

  /** Position economic weight — tenant-scoped only (no person rows). */
  async listPositionEconomicWeight(actor: ActorContext, query: PositionEconomicWeightListQuery) {
    return repo.listPositionEconomicWeight(pool, catalogTenant(actor), query);
  },

  /** Tenant payroll handoff records (no user column) — tenant-scoped only. */
  async listPayrollHandoffRecords(actor: ActorContext, query: PayrollHandoffRecordListQuery) {
    return repo.listPayrollHandoffRecords(pool, catalogTenant(actor), query);
  },
};
