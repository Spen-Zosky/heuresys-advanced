/**
 * apps/api/src/modules/review-cycles/service.ts — #92 passo 3/7. READ-only.
 * Il ciclo e' META del processo (finestre, scadenze, stato macchina): nessun
 * giudizio per-persona, quindi niente mask. Tenant-scoped (orgGate "catalog");
 * PLATFORM_ADMIN vede tutti i tenant. Le scritture arrivano col passo 4.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import { NotFoundError } from "../../errors/index.js";
import type { ReviewCycle, ReviewCycleListQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

function catalogTenant(actor: ActorContext): string | undefined {
  return isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
}

export const reviewCyclesService = {
  async list(actor: ActorContext, query: ReviewCycleListQuery) {
    return repo.listReviewCycles(pool, catalogTenant(actor), query);
  },

  async getById(actor: ActorContext, id: string): Promise<ReviewCycle> {
    const cycle = await repo.findReviewCycleById(pool, id);
    // 404 anche fuori tenant: un 403 confermerebbe che il ciclo esiste altrove
    if (!cycle || (!isPlatform(actor) && cycle.tenantId !== actor.tenantId)) {
      throw new NotFoundError("ReviewCycle");
    }
    return cycle;
  },
};
