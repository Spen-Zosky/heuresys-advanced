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

function visible(actor: ActorContext, r: SuccessorReadiness): boolean {
  if (isPlatform(actor)) return true;
  return actor.tenantId !== null && r.tenantId === actor.tenantId;
}

export const successorReadinessService = {
  async list(actor: ActorContext, query: SuccessorReadinessListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listReadiness(pool, { tenantId, query });
  },

  async getById(actor: ActorContext, id: string): Promise<SuccessorReadiness> {
    const target = await repo.findReadinessById(pool, id);
    if (!target) throw new NotFoundError("SuccessorReadiness");
    if (!visible(actor, target)) throw new NotFoundError("SuccessorReadiness");
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
