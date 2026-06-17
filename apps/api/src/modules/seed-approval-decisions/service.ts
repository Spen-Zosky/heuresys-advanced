/**
 * apps/api/src/modules/seed-approval-decisions/service.ts
 * Append-only decision ledger. Tenant inherited from candidate.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type {
  SeedApprovalDecision, SeedApprovalDecisionListQuery, CreateSeedApprovalDecisionBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export const seedApprovalDecisionsService = {
  async list(actor: ActorContext, query: SeedApprovalDecisionListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listDecisions(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<SeedApprovalDecision> {
    const t = await repo.findDecisionById(pool, id);
    if (!t) throw new NotFoundError("SeedApprovalDecision");
    if (!isPlatform(actor)) {
      const ct = await repo.getCandidateTenant(pool, t.candidateId);
      if (!ct || ct !== actor.tenantId) throw new NotFoundError("SeedApprovalDecision");
    }
    return t;
  },
  async create(actor: ActorContext, body: CreateSeedApprovalDecisionBody): Promise<SeedApprovalDecision> {
    const ct = await repo.getCandidateTenant(pool, body.candidateId);
    if (!ct) throw new NotFoundError("SeedCandidateRecord");
    if (!isPlatform(actor) && ct !== actor.tenantId) {
      throw new NotFoundError("SeedCandidateRecord");
    }
    return repo.insertDecision(pool, body, actor.userId);
  },
};
