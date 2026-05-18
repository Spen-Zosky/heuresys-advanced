/**
 * apps/api/src/modules/brownfield-wave-executor/run-logger.ts
 *
 * Single-primitive audit-log writer for brownfield wave executor runs.
 * Each call writes one row to `audit.import_run_logs`.
 *
 * Per PLAN v4 §2.2 item 2: this module collapses what v3-bis had as two
 * separate modules (state-machine-persister + audit-writer). Post-evidence
 * (CLI turn 8 E2/E3): the engine already writes `audit.import_validation_results`
 * and `audit.import_approval_decisions`. The only genuine remaining audit gap
 * is `audit.import_run_logs` (state-machine event log). This single primitive
 * fills that gap; engine.ts will call it at every state transition + at key
 * lifecycle events (PLAN v4 §2.2 item 4).
 *
 * Schema (per E3 verification + actual DB introspection):
 *   import_run_log_id      uuid       PK  DEFAULT gen_random_uuid()
 *   import_run_log_run_id  uuid       FK brownfield.import_runs(import_run_id)
 *   import_run_log_level   varchar
 *   import_run_log_message text
 *   import_run_log_payload jsonb
 *   created_at             timestamptz DEFAULT now()
 */
import type { Pool, PoolClient } from "pg";

/** Conventional severity levels. Free-form varchar at DB layer; this union is convention. */
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/** Accept either the shared pool or a transaction-bound client. */
export type DbConnector = Pool | PoolClient;

export interface LogRunEventArgs {
  /** brownfield.import_runs.import_run_id — must reference an existing row. */
  runId: string;
  /** Severity level. Convention: DEBUG/INFO/WARN/ERROR. */
  level: LogLevel;
  /** Short structured event identifier — e.g. "STATE_TRANSITION", "VALIDATION_BATCH". */
  message: string;
  /** Optional structured event payload (JSONB). Defaults to `{}` when omitted. */
  payload?: Record<string, unknown>;
}

/**
 * Append one row to `audit.import_run_logs`.
 *
 * @returns the auto-generated `import_run_log_id` (uuid).
 *
 * @throws PostgresError if `runId` does not reference an existing
 *         `brownfield.import_runs` row (FK violation). Callers should ensure
 *         the import_runs row is inserted BEFORE the first logRunEvent for it.
 */
export async function logRunEvent(
  q: DbConnector,
  args: LogRunEventArgs,
): Promise<string> {
  const { runId, level, message, payload } = args;
  const res = await q.query<{ import_run_log_id: string }>(
    `INSERT INTO audit.import_run_logs (
        import_run_log_run_id,
        import_run_log_level,
        import_run_log_message,
        import_run_log_payload
      ) VALUES ($1, $2, $3, $4::jsonb)
      RETURNING import_run_log_id`,
    [runId, level, message, JSON.stringify(payload ?? {})],
  );
  return res.rows[0]!.import_run_log_id;
}
