/**
 * apps/api/src/modules/brownfield-wave-executor/service.ts
 * Orchestration of the 6-state wave executor. PLATFORM_ADMIN gated.
 */
import { pool } from "../../db/client.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  WaveExecutorRun,
  WaveExecutorRunListQuery,
  WaveAcceptanceReport,
  TriggerWaveBody,
} from "@heuresys/shared";
import {
  createWaveRun,
  findWaveRun,
  listWaveRuns,
  updateWaveState,
} from "./repository.js";
import {
  executeApprove,
  executeStage,
  executeUpsert,
  executeValidate,
  loadMappings,
  runAcceptanceChecks,
} from "./engine.js";
import { ensureLegacyMirrorDDL, loadLegacyMirrorData } from "./loader.js";
import { isTerminal } from "./state.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}
function isPlatform(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}

export const brownfieldWaveExecutorService = {
  async list(_actor: ActorContext, query: WaveExecutorRunListQuery) {
    return listWaveRuns(pool, query);
  },

  async getById(_actor: ActorContext, runId: string): Promise<WaveExecutorRun> {
    const r = await findWaveRun(pool, runId);
    if (!r) throw new NotFoundError("WaveExecutorRun");
    return r;
  },

  async trigger(actor: ActorContext, body: TriggerWaveBody): Promise<WaveExecutorRun> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    if (body.wave !== 1) {
      throw new ValidationError(`Wave ${body.wave} executor not implemented (Wave 1 only)`, "WAVE_NOT_IMPLEMENTED");
    }
    const mode = body.mode ?? (body.dryRun ? "DRY_RUN" : "EXECUTE");
    const run = await createWaveRun(pool, body.wave, mode, actor.userId);

    // Synchronous orchestration. For long-running waves we accept the
    // request blocking until COMPLETE/FAILED. Tests inject for this.
    try {
      // STAGING phase: ensure legacy_mirror is present + ingested, then stage rows.
      await updateWaveState(pool, run.runId, "STAGING");
      await ensureLegacyMirrorDDL(pool);
      const legacyCount = await countLegacyMirrorRows(pool);
      if (legacyCount === 0) {
        // Need to import dumps the first time.
        await loadLegacyMirrorData(pool);
      }
      const mappings = await loadMappings(pool);
      const stageStats = await executeStage(pool, run.runId, mappings);

      // VALIDATING
      await updateWaveState(pool, run.runId, "VALIDATING");
      const validateStats = await executeValidate(pool, run.runId, mappings, stageStats);

      // APPROVED
      await updateWaveState(pool, run.runId, "APPROVED");
      await executeApprove(pool, run.runId, mappings, actor.userId);

      // UPSERTING
      await updateWaveState(pool, run.runId, "UPSERTING");
      await executeUpsert(pool, run.runId, mappings, validateStats, mode);

      // COMPLETE
      await updateWaveState(pool, run.runId, "COMPLETE");
    } catch (e) {
      const msg = (e as Error).message;
      await updateWaveState(pool, run.runId, "FAILED", msg).catch(() => {});
      throw e;
    }
    const final = await findWaveRun(pool, run.runId);
    if (!final) throw new NotFoundError("WaveExecutorRun");
    return final;
  },

  async cancel(actor: ActorContext, runId: string): Promise<WaveExecutorRun> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const r = await findWaveRun(pool, runId);
    if (!r) throw new NotFoundError("WaveExecutorRun");
    if (isTerminal(r.state)) {
      throw new ValidationError(`Cannot cancel run in terminal state ${r.state}`, "RUN_TERMINAL");
    }
    const updated = await updateWaveState(pool, runId, "CANCELLED", "User cancelled");
    if (!updated) throw new NotFoundError("WaveExecutorRun");
    return updated;
  },

  async getAcceptance(actor: ActorContext, runId: string): Promise<WaveAcceptanceReport> {
    if (!isPlatform(actor)) throw new ForbiddenError("PLATFORM_ADMIN required");
    const r = await findWaveRun(pool, runId);
    if (!r) throw new NotFoundError("WaveExecutorRun");
    const checks = await runAcceptanceChecks(pool, runId);
    return {
      runId,
      wave: r.wave,
      checks,
      allPass: checks.every((c) => c.pass),
    };
  },
};

async function countLegacyMirrorRows(pool: ReturnType<typeof getPool>): Promise<number> {
  // Probe on esco_occupations (ESKAP, ~3k rows): a stable, always-included
  // Wave 1 source table whose presence indicates the dumps have been loaded.
  // We don't probe esco_skills because it's not in the canonical 88-table
  // Wave 1 dump set (see db/scripts/extract-wave1-legacy.sh).
  const res = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'legacy_mirror' AND table_name = 'esco_occupations'
     ) AS exists`,
  );
  if (!res.rows[0]?.exists) return 0;
  const cntRes = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM legacy_mirror.esco_occupations`,
  );
  return Number(cntRes.rows[0]?.n ?? 0);
}

// Lightweight type indirection to avoid pulling pg types into the public surface.
function getPool() {
  return pool;
}
