/**
 * apps/api/src/modules/compensation/service.ts
 * Decision-support layer for compensation intelligence + reward gates.
 * NOT payroll execution (invariant I8).
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  CompensationProfile,
  RewardGatesListQuery,
  RewardGate,
  CompensationRecommendation,
  CreateCompensationRecommendationBody,
  PayrollHandoffRecord,
  CreatePayrollHandoffRecordBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}

function requireTenant(a: ActorContext): string {
  if (!a.tenantId) {
    throw new ForbiddenError("Tenant context required", "TENANT_CONTEXT_REQUIRED");
  }
  return a.tenantId;
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
    const tenantId = isPlatform(actor) ? undefined : requireTenant(actor);
    return repo.listRewardGates(pool, { tenantId, query });
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
};
