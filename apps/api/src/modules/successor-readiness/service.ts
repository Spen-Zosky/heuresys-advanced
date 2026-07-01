/**
 * apps/api/src/modules/successor-readiness/service.ts
 * Append-only. Tenant inherited from parent candidate.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type {
  SuccessorReadiness,
  SuccessorReadinessListQuery,
  CreateSuccessorReadinessBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findCandidateById } from "../successor-candidates/repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

export const successorReadinessService = {
  async list(actor: ActorContext, query: SuccessorReadinessListQuery) {
    // F3 (ADR-0027): resolve the actor's organizational read scope and constrain the list
    // to subjects they may see (D-50). PLATFORM_ADMIN → all; HR-mandated → tenant;
    // managerial → org sub-tree; everyone else → self.
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    return repo.listReadiness(pool, { tenantId, userIdAllowList, query });
  },

  async getById(actor: ActorContext, id: string): Promise<SuccessorReadiness> {
    const target = await repo.findReadinessById(pool, id);
    if (!target) throw new NotFoundError("SuccessorReadiness");
    // F3 (ADR-0027): the readiness subject is the parent candidate's user; gate the
    // per-target read on the actor's organizational scope, not just tenant (D-50).
    const candidate = await findCandidateById(pool, target.candidateId);
    if (!candidate) throw new NotFoundError("SuccessorReadiness");
    if (!(await canReadOrgTarget(pool, actor, candidate.userId, target.tenantId))) {
      throw new NotFoundError("SuccessorReadiness");
    }
    return target;
  },

  async create(actor: ActorContext, body: CreateSuccessorReadinessBody): Promise<SuccessorReadiness> {
    const parent = await findCandidateById(pool, body.candidateId);
    if (!parent) throw new NotFoundError("SuccessorCandidate");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || parent.tenantId !== actor.tenantId) {
        throw new NotFoundError("SuccessorCandidate");
      }
    }
    return repo.insertReadiness(pool, parent.tenantId, body);
  },
};
