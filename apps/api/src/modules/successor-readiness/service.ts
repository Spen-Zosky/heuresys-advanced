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
import { findCandidateById, subjectsOfCandidates } from "../successor-candidates/repository.js";
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

/**
 * #124 D4 / ADR-0032 — se ne vanno il punteggio di prontezza, l'orizzonte che ne
 * deriva («pronto ora», «fra sei mesi») e il payload che lo spiega. Restano il
 * candidato di riferimento e la data: si continua a sapere che la valutazione
 * c'e' stata e quando.
 */
const READINESS_JUDGMENT_FIELDS = ["score", "horizon", "payload"] as const;
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
    const page = await repo.listReadiness(pool, { tenantId, userIdAllowList, query });
    // #124 — pre-check a costo zero: solo se l'attore legge per solo mandato
    // piattaforma si paga la query che risolve i soggetti.
    if (!masksUnderPlatformMandate(actor, "EVALUATION", null)) return page;
    const soggetti = await subjectsOfCandidates(pool, page.items.map((r) => r.candidateId));
    return {
      ...page,
      items: page.items.map((r) =>
        masksUnderPlatformMandate(actor, "EVALUATION", soggetti.get(r.candidateId) ?? null)
          ? maskFields(r, READINESS_JUDGMENT_FIELDS)
          : r,
      ),
    };
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
    // Il candidato e' gia' stato caricato per il cancello organizzativo: I17 non
    // costa una query in piu'.
    return masksUnderPlatformMandate(actor, "EVALUATION", candidate.userId)
      ? maskFields(target, READINESS_JUDGMENT_FIELDS)
      : target;
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
