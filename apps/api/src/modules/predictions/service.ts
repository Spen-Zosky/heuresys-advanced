/**
 * apps/api/src/modules/predictions/service.ts
 * PredictionsML read-model with tenant-only visibility scope (no global rows).
 * READ-ONLY: legacy precomputed predictive-analytics values exposed as-is. No writes.
 * PLATFORM_ADMIN: unfiltered. Others: limited to own tenant; not-visible rows surface as 404 (no leak).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type {
  PredictiveModelListQuery, ModelPredictionListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/** List-scope filter: undefined = no filter (PLATFORM_ADMIN); else own tenant (zero-uuid if tenantless → 0 rows). */
function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
}

/** Throw 404 (not 403, to avoid tenant enumeration) when a row is outside the actor's scope. */
function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}

export const predictionsService = {
  // ── Models ──
  async listModels(a: ActorContext, query: PredictiveModelListQuery) {
    return repo.listModels(pool, listTenantFilter(a), query);
  },
  async getModel(a: ActorContext, id: string) {
    const m = await repo.findModelById(pool, id);
    if (!m) throw new NotFoundError("Predictive model");
    assertVisible(a, m.tenantId, "Predictive model");
    return m;
  },

  // ── Predictions ──
  async listPredictions(a: ActorContext, query: ModelPredictionListQuery) {
    return repo.listPredictions(pool, listTenantFilter(a), query);
  },
  async getPrediction(a: ActorContext, id: string) {
    const p = await repo.findPredictionById(pool, id);
    if (!p) throw new NotFoundError("Prediction");
    assertVisible(a, p.tenantId, "Prediction");
    return p;
  },
};
