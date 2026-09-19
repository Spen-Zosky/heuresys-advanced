/**
 * apps/api/src/modules/seed-candidate-records/service.ts
 */
import { pool } from "../../db/client.js";
import { perimetroClienti, puoVedereCliente, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type { SeedCandidateRecord, SeedCandidateRecordListQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(a: ActorContext, r: SeedCandidateRecord): boolean {
  return puoVedereCliente(a, r.tenantId);
}

export const seedCandidateRecordsService = {
  async list(actor: ActorContext, query: SeedCandidateRecordListQuery) {
    const perimetro = perimetroClienti(actor);
    return repo.listCandidates(pool, { tenantIds: perimetro ? [...perimetro] : undefined, query });
  },
  async getById(actor: ActorContext, id: string): Promise<SeedCandidateRecord> {
    const t = await repo.findCandidateById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("SeedCandidateRecord");
    return t;
  },

  /** L'istruttoria: che cosa è stato verificato su questo record. */
  async validations(actor: ActorContext, id: string) {
    const t = await repo.findCandidateById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("SeedCandidateRecord");
    const items = await repo.listValidations(pool, id);
    return { items, total: items.length };
  },

  /** Le fonti: da dove viene questo record. */
  async evidence(actor: ActorContext, id: string) {
    const t = await repo.findCandidateById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("SeedCandidateRecord");
    const items = await repo.listEvidence(pool, id);
    return { items, total: items.length };
  },
};
