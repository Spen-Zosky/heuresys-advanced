/**
 * apps/api/src/modules/seed-candidate-records/service.ts
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type { SeedCandidateRecord, SeedCandidateRecordListQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

function visible(a: ActorContext, r: SeedCandidateRecord): boolean {
  if (isPlatform(a)) return true;
  return a.tenantId !== null && r.tenantId === a.tenantId;
}

export const seedCandidateRecordsService = {
  async list(actor: ActorContext, query: SeedCandidateRecordListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listCandidates(pool, { tenantId, query });
  },
  async getById(actor: ActorContext, id: string): Promise<SeedCandidateRecord> {
    const t = await repo.findCandidateById(pool, id);
    if (!t || !visible(actor, t)) throw new NotFoundError("SeedCandidateRecord");
    return t;
  },
};
