/**
 * packages/shared/src/schemas/brownfield-wave-executor.ts
 * Zod contract for the brownfield wave executor module (MVP-3 Tappa D).
 */
import { z } from "zod";

// -----------------------------------------------------------------------------
// State machine
// -----------------------------------------------------------------------------

export const WaveExecutorStateSchema = z.enum([
  "PENDING",      // run row created, no work started yet
  "STAGING",      // loading legacy rows into staging.wave1_*
  "VALIDATING",   // running validation rules on staging rows
  "APPROVED",     // validation passed; ready for upsert (auto-approve for wave 1)
  "UPSERTING",    // applying transforms + upsert into sys.sys_*
  "COMPLETE",     // upsert + lineage + audit done; acceptance criteria met
  "FAILED",       // any step failed; failure_reason populated
  "CANCELLED",    // user cancelled before completion
]);
export type WaveExecutorState = z.infer<typeof WaveExecutorStateSchema>;

export const TERMINAL_STATES: ReadonlyArray<WaveExecutorState> = ["COMPLETE", "FAILED", "CANCELLED"];

// -----------------------------------------------------------------------------
// Run trigger + report
// -----------------------------------------------------------------------------

export const WaveExecutorModeSchema = z.enum(["EXECUTE", "DRY_RUN"]);
export type WaveExecutorMode = z.infer<typeof WaveExecutorModeSchema>;

export const TriggerWaveBodySchema = z.object({
  wave: z.number().int().min(1).max(4),
  mode: WaveExecutorModeSchema.default("EXECUTE"),
  dryRun: z.boolean().optional(),     // alias for mode='DRY_RUN' from older callers
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type TriggerWaveBody = z.infer<typeof TriggerWaveBodySchema>;

// Per-target stage tally (one row per canonical target table)
export const WaveStageStatsSchema = z.object({
  target: z.string(),                                 // e.g. 'sys_skills'
  stagingTable: z.string(),                           // e.g. 'staging.wave1_skills'
  stagedRows: z.number().int().min(0),                // rows loaded into staging
  validatedRows: z.number().int().min(0),             // rows that passed validation
  failedRows: z.number().int().min(0),                // rows that failed validation
  upsertedRows: z.number().int().min(0),              // rows upserted into sys.sys_*
  lineageRows: z.number().int().min(0),               // lineage records written
});
export type WaveStageStats = z.infer<typeof WaveStageStatsSchema>;

export const WaveExecutorRunSchema = z.object({
  runId: z.string().uuid(),
  wave: z.number().int().min(1).max(4),
  mode: WaveExecutorModeSchema,
  state: WaveExecutorStateSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  initiatedBy: z.string().uuid().nullable(),
  stats: z.array(WaveStageStatsSchema),
  totalStaged: z.number().int().min(0),
  totalUpserted: z.number().int().min(0),
  totalFailed: z.number().int().min(0),
  failureReason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});
export type WaveExecutorRun = z.infer<typeof WaveExecutorRunSchema>;

export const WaveExecutorRunListQuerySchema = z.object({
  wave: z.coerce.number().int().min(1).max(4).optional(),
  state: WaveExecutorStateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type WaveExecutorRunListQuery = z.infer<typeof WaveExecutorRunListQuerySchema>;

export const WaveExecutorRunListResponseSchema = z.object({
  items: z.array(WaveExecutorRunSchema),
  total: z.number().int().min(0),
});
export type WaveExecutorRunListResponse = z.infer<typeof WaveExecutorRunListResponseSchema>;

export const WaveExecutorRunIdParamSchema = z.object({ runId: z.string().uuid() });
export type WaveExecutorRunIdParam = z.infer<typeof WaveExecutorRunIdParamSchema>;

// -----------------------------------------------------------------------------
// Acceptance criteria report (post-COMPLETE)
// -----------------------------------------------------------------------------

export const AcceptanceCheckSchema = z.object({
  name: z.string(),
  query: z.string(),
  expected: z.string(),
  actual: z.string(),
  pass: z.boolean(),
});
export type AcceptanceCheck = z.infer<typeof AcceptanceCheckSchema>;

export const WaveAcceptanceReportSchema = z.object({
  runId: z.string().uuid(),
  wave: z.number().int().min(1).max(4),
  checks: z.array(AcceptanceCheckSchema),
  allPass: z.boolean(),
});
export type WaveAcceptanceReport = z.infer<typeof WaveAcceptanceReportSchema>;
