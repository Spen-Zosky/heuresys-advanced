/**
 * apps/api/src/modules/successor-candidates/service.ts
 * Tenant inherited from parent pool. User must be in same tenant.
 * Unique (pool_id, user_id) enforced at service level.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ConflictError, ForbiddenError } from "../../errors/index.js";
import type {
  SuccessorCandidate,
  SuccessorCandidateListQuery,
  CreateSuccessorCandidateBody,
  UpdateSuccessorCandidateBody,
  SuccessorReadinessDistributionResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findPoolById } from "../succession-pools/repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

/**
 * #124 D4 / ADR-0032 — se ne va il giudizio di quanto una persona sia pronta a
 * succedere; restano il candidato, il pool e lo STATO della candidatura (I20).
 * `metadata` resta: misurato S1054, contiene la sola chiave `storia36`.
 */
const CANDIDATE_JUDGMENT_FIELDS = ["readinessLevel"] as const;

export const successorCandidatesService = {
  async list(actor: ActorContext, query: SuccessorCandidateListQuery) {
    // ADR-0027 F3: filter the list by the actor's organizational read scope (D-50).
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const page = await repo.listCandidates(pool, { tenantId, userIdAllowList, query });
    if (!masksUnderPlatformMandate(actor, "EVALUATION", null)) return page;
    return {
      ...page,
      items: page.items.map((c) =>
        masksUnderPlatformMandate(actor, "EVALUATION", c.userId)
          ? maskFields(c, CANDIDATE_JUDGMENT_FIELDS)
          : c,
      ),
    };
  },

  async readinessDistribution(actor: ActorContext): Promise<SuccessorReadinessDistributionResponse> {
    // Stays TENANT-wide by design (F3 aggregates doctrine): grouped counts only, no
    // per-person data is exposed, so the org axis does not apply.
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    const dist = await repo.getReadinessDistribution(pool, tenantId);

    // #124 — **vincolo 5** di `lib/scope/mask.ts`, e qui morde davvero per la
    // prima volta: «gli aggregati seguono il dato». Le RIGHE dei candidati
    // restano visibili al mandato piattaforma (e' il senso di ADR-0032), quindi
    // pubblicare anche i conteggi per livello su 20 candidati distribuiti
    // 6/6/5/3 restringerebbe l'insieme dei possibili in modo sostanziale: si
    // saprebbe che esattamente 3 di quelle 20 persone sono a sei mesi.
    // La soppressione e' DICHIARATA: una lista vuota e basta si legge come
    // «non ci sono candidati», che sarebbe una bugia diversa ma pur sempre una
    // bugia. `total` resta perche' e' gia' deducibile dalla lista dei candidati.
    if (!masksUnderPlatformMandate(actor, "EVALUATION", null)) return dist;
    return { items: [], total: dist.total, masked: ["items"] };
  },

  async getById(actor: ActorContext, id: string): Promise<SuccessorCandidate> {
    const target = await repo.findCandidateById(pool, id);
    if (!target) throw new NotFoundError("SuccessorCandidate");
    // ADR-0027 F3: gate the per-target read on the organizational axis (self / HR-mandate /
    // transitive org sub-tree). 404 (not 403) avoids existence enumeration.
    if (!(await canReadOrgTarget(pool, actor, target.userId, target.tenantId))) {
      throw new NotFoundError("SuccessorCandidate");
    }
    return masksUnderPlatformMandate(actor, "EVALUATION", target.userId)
      ? maskFields(target, CANDIDATE_JUDGMENT_FIELDS)
      : target;
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
