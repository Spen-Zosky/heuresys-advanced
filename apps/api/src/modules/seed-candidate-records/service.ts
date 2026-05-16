/**
 * apps/api/src/modules/seed-candidate-records/service.ts
 */
import { pool } from "../../db/client.js";
import { NotFoundError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { SeedCandidateRecord, SeedCandidateRecordListQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext { userId: string; tenantId: string | null; roles: RoleCode[] }
function isPlatform(a: ActorContext): boolean { return a.roles.includes("PLATFORM_ADMIN"); }
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
