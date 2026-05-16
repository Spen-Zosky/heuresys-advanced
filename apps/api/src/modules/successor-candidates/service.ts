/**
 * apps/api/src/modules/successor-candidates/service.ts
 * Tenant inherited from parent pool. User must be in same tenant.
 * Unique (pool_id, user_id) enforced at service level.
 */

import { pool } from "../../db/client.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  SuccessorCandidate,
  SuccessorCandidateListQuery,
  CreateSuccessorCandidateBody,
  UpdateSuccessorCandidateBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findPoolById } from "../succession-pools/repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}
function visible(actor: ActorContext, c: SuccessorCandidate): boolean {
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && c.tenantId === actor.tenantId;
}

export const successorCandidatesService = {
  async list(actor: ActorContext, query: SuccessorCandidateListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listCandidates(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<SuccessorCandidate> {
    const target = await repo.findCandidateById(pool, id);
    if (!target) throw new NotFoundError("SuccessorCandidate");
    if (!visible(actor, target)) throw new NotFoundError("SuccessorCandidate");
    return target;
  },

  async create(actor: ActorContext, body: CreateSuccessorCandidateBody): Promise<SuccessorCandidate> {
    const parent = await findPoolById(pool, body.poolId);
    if (!parent) throw new NotFoundError("SuccessionPool");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || parent.tenantId !== actor.tenantId) {
        throw new NotFoundError("SuccessionPool");
      }
    }
    const u = await repo.getUserTenant(pool, body.userId);
    if (!u) throw new NotFoundError("User");
    if (u.tenantId !== parent.tenantId) {
      throw new ForbiddenError(
        "Candidate user does not belong to the pool's tenant",
        "USER_NOT_IN_TENANT",
      );
    }
    const dup = await repo.findExisting(pool, body.poolId, body.userId);
    if (dup) {
      throw new ConflictError(
        "User is already a candidate in this pool",
        "SUCCESSOR_CANDIDATE_DUPLICATE",
      );
    }
    return repo.insertCandidate(pool, parent.tenantId, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateSuccessorCandidateBody): Promise<SuccessorCandidate> {
    const target = await repo.findCandidateById(pool, id);
    if (!target) throw new NotFoundError("SuccessorCandidate");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("SuccessorCandidate");
      }
    }
    const updated = await repo.updateCandidatePartial(pool, id, patch);
    if (!updated) throw new NotFoundError("SuccessorCandidate");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findCandidateById(pool, id);
    if (!target) throw new NotFoundError("SuccessorCandidate");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("SuccessorCandidate");
      }
    }
    const ok = await repo.deleteCandidate(pool, id);
    if (!ok) throw new NotFoundError("SuccessorCandidate");
  },
};
