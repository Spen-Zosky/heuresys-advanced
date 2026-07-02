/**
 * apps/api/src/modules/succession-pools/service.ts
 * Tenant-scoped. Position must be in same tenant. Code unique per tenant.
 * Delete blocked when candidates attached.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  SuccessionPool,
  SuccessionPoolListQuery,
  CreateSuccessionPoolBody,
  UpdateSuccessionPoolBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

function visible(actor: ActorContext, p: SuccessionPool): boolean {
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && p.tenantId === actor.tenantId;
}

export const successionPoolsService = {
  async list(actor: ActorContext, query: SuccessionPoolListQuery) {
    // ADR-0027 F3: a pool's person subject is the position's ACTIVE incumbent (the person
    // whose succession is planned). Filter by the actor's organizational read scope;
    // vacant positions have no person subject and stay tenant-visible (D-50).
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    return repo.listPools(pool, { tenantId, userIdAllowList, query });
  },

  async getById(actor: ActorContext, id: string): Promise<SuccessionPool> {
    const target = await repo.findPoolById(pool, id);
    if (!target) throw new NotFoundError("SuccessionPool");
    if (!visible(actor, target)) throw new NotFoundError("SuccessionPool");
    // ADR-0027 F3: gate on the position's ACTIVE incumbent(s); a vacant position has no
    // person subject → tenant check above suffices. 404 avoids existence enumeration.
    const incumbents = await repo.positionIncumbentUserIds(pool, target.positionId);
    if (incumbents.length > 0) {
      let allowed = false;
      for (const incumbentUserId of incumbents) {
        if (await canReadOrgTarget(pool, actor, incumbentUserId, target.tenantId)) {
          allowed = true;
          break;
        }
      }
      if (!allowed) throw new NotFoundError("SuccessionPool");
    }
    return target;
  },

  async create(actor: ActorContext, body: CreateSuccessionPoolBody): Promise<SuccessionPool> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const candidate = body.tenantId ?? actor.tenantId;
      if (!candidate) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId for succession pools",
          "TENANT_ID_REQUIRED",
        );
      }
      tenantId = candidate;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    const pos = await repo.positionInTenant(pool, body.positionId, tenantId);
    if (!pos.exists) throw new NotFoundError("Position");
    if (!pos.sameTenant) {
      throw new ForbiddenError(
        "Position does not belong to the resolved tenant",
        "POSITION_NOT_IN_TENANT",
      );
    }
    const dup = await repo.findPoolByCodeInTenant(pool, tenantId, body.code);
    if (dup) {
      throw new ConflictError(
        `Succession pool code '${body.code}' already exists in this tenant`,
        "SUCCESSION_POOL_CODE_CONFLICT",
      );
    }
    return repo.insertPool(pool, tenantId, body, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateSuccessionPoolBody): Promise<SuccessionPool> {
    const target = await repo.findPoolById(pool, id);
    if (!target) throw new NotFoundError("SuccessionPool");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("SuccessionPool");
      }
    }
    const updated = await repo.updatePoolPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("SuccessionPool");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findPoolById(pool, id);
    if (!target) throw new NotFoundError("SuccessionPool");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("SuccessionPool");
      }
    }
    if (await repo.poolHasCandidates(pool, id)) {
      throw new ConflictError(
        "Cannot delete succession pool with attached candidates",
        "SUCCESSION_POOL_HAS_CANDIDATES",
      );
    }
    const ok = await repo.deletePool(pool, id);
    if (!ok) throw new NotFoundError("SuccessionPool");
  },
};
