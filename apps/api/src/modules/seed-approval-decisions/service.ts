/**
 * apps/api/src/modules/seed-approval-decisions/service.ts
 * Append-only decision ledger. Tenant inherited from candidate.
 */
import { pool } from "../../db/client.js";
import { perimetroClienti, puoVedereCliente, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type {
  SeedApprovalDecision, SeedApprovalDecisionListQuery, CreateSeedApprovalDecisionBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export const seedApprovalDecisionsService = {
  async list(actor: ActorContext, query: SeedApprovalDecisionListQuery) {
    const perimetro = perimetroClienti(actor);
    return repo.listDecisions(pool, { tenantIds: perimetro ? [...perimetro] : undefined, query });
  },
  async getById(actor: ActorContext, id: string): Promise<SeedApprovalDecision> {
    const t = await repo.findDecisionById(pool, id);
    if (!t) throw new NotFoundError("SeedApprovalDecision");
    const ct = await repo.getCandidateTenant(pool, t.candidateId);
    if (!ct || !puoVedereCliente(actor, ct)) throw new NotFoundError("SeedApprovalDecision");
    return t;
  },
  async create(actor: ActorContext, body: CreateSeedApprovalDecisionBody): Promise<SeedApprovalDecision> {
    const ct = await repo.getCandidateTenant(pool, body.candidateId);
    if (!ct || !puoVedereCliente(actor, ct)) {
      throw new NotFoundError("SeedCandidateRecord");
    }
    return repo.insertDecision(pool, body, actor.userId);
  },
};
