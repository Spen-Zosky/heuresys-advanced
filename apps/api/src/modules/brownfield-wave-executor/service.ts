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
import { logRunEvent } from "./run-logger.js";

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
    await logRunEvent(pool, {
      runId: run.runId,
      level: "INFO",
      message: "RUN_CREATED",
      payload: { wave: body.wave, mode, initiated_by: actor.userId },
    });

    // Synchronous orchestration. For long-running waves we accept the
    // request blocking until COMPLETE/FAILED. Tests inject for this.
    try {
      // STAGING phase: ensure legacy_mirror is present + ingested, then stage rows.
      await updateWaveState(pool, run.runId, "STAGING");
      await logRunEvent(pool, { runId: run.runId, level: "INFO", message: "STATE_STAGING" });
      await ensureLegacyMirrorDDL(pool);
      const legacyCount = await countLegacyMirrorRows(pool);
      if (legacyCount === 0) {
        // Need to import dumps the first time.
        await loadLegacyMirrorData(pool);
      }
      const mappings = await loadMappings(pool);
      const stageStats = await executeStage(pool, run.runId, mappings);
      await logRunEvent(pool, {
        runId: run.runId,
        level: "INFO",
        message: "STAGE_COMPLETE",
        payload: {
          mappings: mappings.length,
          staged_rows_total: stageStats.reduce((s, x) => s + x.stagedRows, 0),
        },
      });

      // VALIDATING
      await updateWaveState(pool, run.runId, "VALIDATING");
      await logRunEvent(pool, { runId: run.runId, level: "INFO", message: "STATE_VALIDATING" });
      const validateStats = await executeValidate(pool, run.runId, mappings, stageStats);
      await logRunEvent(pool, {
        runId: run.runId,
        level: "INFO",
        message: "VALIDATE_COMPLETE",
        payload: {
          validated_rows_total: validateStats.reduce((s, x) => s + x.validatedRows, 0),
          failed_rows_total: validateStats.reduce((s, x) => s + x.failedRows, 0),
        },
      });

      // APPROVED
      await updateWaveState(pool, run.runId, "APPROVED");
      await logRunEvent(pool, { runId: run.runId, level: "INFO", message: "STATE_APPROVED" });
      const approvalCounts = await executeApprove(pool, run.runId, mappings, actor.userId);
      await logRunEvent(pool, {
        runId: run.runId,
        level: "INFO",
        message: "APPROVE_COMPLETE",
        payload: approvalCounts,
      });

      // UPSERTING
      await updateWaveState(pool, run.runId, "UPSERTING");
      await logRunEvent(pool, { runId: run.runId, level: "INFO", message: "STATE_UPSERTING" });
      const upsertStats = await executeUpsert(pool, run.runId, mappings, validateStats, mode);
      await logRunEvent(pool, {
        runId: run.runId,
        level: "INFO",
        message: "UPSERT_COMPLETE",
        payload: {
          upserted_rows_total: upsertStats.reduce((s, x) => s + x.upsertedRows, 0),
          lineage_rows_total: upsertStats.reduce((s, x) => s + x.lineageRows, 0),
        },
      });

      // COMPLETE
      await updateWaveState(pool, run.runId, "COMPLETE");
      await logRunEvent(pool, { runId: run.runId, level: "INFO", message: "STATE_COMPLETE" });
    } catch (e) {
      const msg = (e as Error).message;
      const errorClass = (e as Error).name ?? "Error";
      const stackHead = ((e as Error).stack ?? "").split("\n").slice(0, 3).join("\n");
      await updateWaveState(pool, run.runId, "FAILED", msg).catch(() => {});
      await logRunEvent(pool, {
        runId: run.runId,
        level: "ERROR",
        message: "STATE_FAILED",
        payload: { error_class: errorClass, message: msg, stack_head: stackHead },
      }).catch(() => {});
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
