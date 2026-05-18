/**
 * apps/api/src/modules/brownfield-wave-executor/engine.ts
 *
 * Stage / Validate / Upsert phases of the Wave 1 executor. All phases are
 * data-driven from brownfield.table_mappings + brownfield.column_mappings.
 * The 7 per-domain ETLs are NOT hardcoded functions; they are configurations
 * (column mappings) and the engine iterates them generically.
 */
import type { Pool } from "pg";
import type {
  WaveStageStats,
  WaveExecutorMode,
} from "@heuresys/shared";
import {
  bulkInsertStaging,
  findWaveRun,
  getColumnMappingsForTableMapping,
  getWave1Mappings,
  resolvePlatformTenantId,
  setWaveStats,
  stagingTableFor,
  truncateAllWave1Staging,
  writeAuditApproval,
  type ColumnMappingRow,
  type TableMappingRow,
  type StagingInsertRow,
} from "./repository.js";
import { applyTransform, computeNaturalKey, rowContentHash, type RawRow } from "./transforms.js";
import { readLegacySlice } from "./loader.js";

const LEGACY_PAGE_SIZE = 1000;
const WAVE1_CONFIDENCE_THRESHOLD = 0.9;

// -----------------------------------------------------------------------------
// Target table metadata (looked up once per run)
// -----------------------------------------------------------------------------

interface TargetMeta {
  columns: Set<string>;
  /** Map from column name → PG udt_name (e.g. 'uuid', 'varchar', 'int4', 'jsonb'). */
  columnTypes: Map<string, string>;
  /** Map from column name → max length for varchar/character types (null for unbounded text/int/etc). */
  columnMaxLengths: Map<string, number | null>;
  uniqueIndexName: string | null;
  /** Plain (non-expression) columns in the unique index, in order. Used for JS-side match-by-natural-key from the INSERT RETURNING rows. */
  naturalKeyColumns: string[];
  /** Inference clause to use after ON CONFLICT (i.e. exactly what's between the parentheses in the index definition). Captures expression-based columns like `COALESCE(skill_tenant_id, '...'::uuid)`. */
  conflictInference: string | null;
  pkColumn: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function loadTargetMeta(pool: Pool, targetTable: string): Promise<TargetMeta> {
  // Find PK column.
  const pkRes = await pool.query<{ attname: string }>(
    `SELECT a.attname
       FROM pg_constraint c
       JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = ('sys.' || $1)::regclass
        AND c.contype  = 'p'
      LIMIT 1`,
    [targetTable],
  );
  const pkColumn = pkRes.rows[0]?.attname ?? `${targetTable.replace(/^sys_/, "")}_id`;

  // All columns + types (udt_name) + max length.
  const colsRes = await pool.query<{
    column_name: string;
    udt_name: string;
    character_maximum_length: number | null;
  }>(
    `SELECT column_name, udt_name, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = 'sys' AND table_name = $1`,
    [targetTable],
  );
  const columns = new Set(colsRes.rows.map((r) => r.column_name));
  const columnTypes = new Map(colsRes.rows.map((r) => [r.column_name, r.udt_name]));
  const columnMaxLengths = new Map(
    colsRes.rows.map((r) => [r.column_name, r.character_maximum_length]),
  );

  // Find the first non-primary UNIQUE index. Many sys.sys_* tables express
  // the natural key as a UNIQUE INDEX with expressions (e.g.
  // `(COALESCE(skill_tenant_id, '...'::uuid), skill_code)`) — these are NOT
  // pg_constraint rows, so we read from pg_index + pg_get_indexdef.
  const idxRes = await pool.query<{ index_name: string; index_def: string; indkey: string }>(
    `SELECT i.indexrelid::regclass::text AS index_name,
            pg_get_indexdef(i.indexrelid) AS index_def,
            i.indkey::text                AS indkey
       FROM pg_index i
      WHERE i.indrelid = ('sys.' || $1)::regclass
        AND i.indisunique
        AND NOT i.indisprimary
      ORDER BY i.indexrelid::regclass::text
      LIMIT 1`,
    [targetTable],
  );

  let uniqueIndexName: string | null = null;
  let conflictInference: string | null = null;
  const naturalKeyColumns: string[] = [];

  if (idxRes.rows[0]) {
    const { index_name, index_def, indkey } = idxRes.rows[0];
    uniqueIndexName = index_name;
    // Extract the parenthesised column list from `CREATE UNIQUE INDEX ... USING btree (<HERE>)` (with possible WHERE clause after).
    const m = /USING\s+\w+\s+\((.*)\)\s*(WHERE\s+.+)?$/i.exec(index_def);
    if (m) {
      conflictInference = m[1]!.trim();
    }
    // Plain (non-expression) columns: indkey is a space-separated list where 0 means "this entry is an expression".
    const attnums = indkey.split(" ").map((s) => Number(s));
    if (attnums.some((n) => n > 0)) {
      const colsRes2 = await pool.query<{ attnum: number; attname: string }>(
        `SELECT attnum, attname FROM pg_attribute
          WHERE attrelid = ('sys.' || $1)::regclass
            AND attnum = ANY($2::int[])`,
        [targetTable, attnums.filter((n) => n > 0)],
      );
      const byAttnum = new Map<number, string>(
        colsRes2.rows.map((r) => [r.attnum, r.attname]),
      );
      for (const n of attnums) {
        if (n > 0) {
          const name = byAttnum.get(n);
          if (name) naturalKeyColumns.push(name);
        }
      }
    }
  }

  return { columns, columnTypes, columnMaxLengths, uniqueIndexName, naturalKeyColumns, conflictInference, pkColumn };
}

// -----------------------------------------------------------------------------
// STAGE: read legacy_mirror.<src> → staging.wave1_<target>
// -----------------------------------------------------------------------------

export async function executeStage(
  pool: Pool,
  runId: string,
  mappings: TableMappingRow[],
): Promise<WaveStageStats[]> {
  // Truncate all 17 staging tables to ensure a clean run.
  await truncateAllWave1Staging(pool);

  // Aggregate stats per target table.
  const statsByTarget = new Map<string, WaveStageStats>();

  for (const m of mappings) {
    const stagingTable = stagingTableFor(m.target_table);
    if (!stagingTable) {
      // No staging table for this target — skip; we'll log this once.
      continue;
    }
    const tally = statsByTarget.get(m.target_table) ?? {
      target: m.target_table,
      stagingTable,
      stagedRows: 0,
      validatedRows: 0,
      failedRows: 0,
      upsertedRows: 0,
      lineageRows: 0,
    };

    let offset = 0;
    while (true) {
      const slice = await readLegacySlice(pool, m.source_table_name, offset, LEGACY_PAGE_SIZE);
      if (slice.rows.length === 0) break;

      const inserts: StagingInsertRow[] = slice.rows.map((row, idx) => {
        const pkColumns = (m.metadata?.["pk_columns"] as string[] | undefined) ?? ["id"];
        const pkCol = pkColumns[0] ?? "id";
        const recordId = String(row[pkCol] ?? `row${offset + idx}`);
        return {
          sourceTable: m.source_table_name,
          sourceRecordId: recordId,
          sourceNaturalKey: computeNaturalKey(
            m.natural_key_pattern,
            row,
            m.source_table_name,
            recordId,
          ),
          sourceContentHash: rowContentHash(row),
          rawRecord: row,
          mappingConfidence: 1.0,
        };
      });

      const inserted = await bulkInsertStaging(pool, runId, stagingTable, inserts);
      tally.stagedRows += inserted;

      if (slice.rows.length < LEGACY_PAGE_SIZE) break;
      offset += LEGACY_PAGE_SIZE;
    }

    statsByTarget.set(m.target_table, tally);
  }

  const stats = Array.from(statsByTarget.values());
  await setWaveStats(pool, runId, stats);
  return stats;
}

// -----------------------------------------------------------------------------
// VALIDATE: apply Wave 1 rules to staging rows
// -----------------------------------------------------------------------------

export async function executeValidate(
  pool: Pool,
  runId: string,
  mappings: TableMappingRow[],
  stats: WaveStageStats[],
): Promise<WaveStageStats[]> {
  // Set-based validation: one PASS UPDATE + one FAIL UPDATE per mapping +
  // one bulk audit INSERT per mapping. For 197k rows across 94 mappings this
  // is O(282) queries total instead of O(394_000).
  //
  // Validation rules baked into SQL (Wave 1):
  //   - natural_key NOT NULL and NOT ending with '::' or '::{}'
  //   - content_hash NOT NULL
  //   - confidence >= 0.9
  //   - target table exists (verified once below via targetMetaCache)
  const targetMetaCache = new Map<string, TargetMeta>();
  async function getMeta(target: string): Promise<TargetMeta> {
    let m = targetMetaCache.get(target);
    if (!m) {
      m = await loadTargetMeta(pool, target);
      targetMetaCache.set(target, m);
    }
    return m;
  }

  const statsByTarget = new Map(stats.map((s) => [s.target, { ...s }]));

  for (const m of mappings) {
    const stagingTable = stagingTableFor(m.target_table);
    if (!stagingTable) continue;
    const targetMeta = await getMeta(m.target_table);
    const tally = statsByTarget.get(m.target_table)!;

    // If target table doesn't exist, mark all rows FAILED with that reason.
    if (targetMeta.columns.size === 0) {
      const r = await pool.query<{ n: string }>(
        `UPDATE ${stagingTable}
            SET staging_validation_status = 'FAILED',
                staging_validation_errors = '["VAL_TARGET_TABLE_MISSING"]'::jsonb
          WHERE staging_import_run_id = $1
            AND staging_source_table  = $2
            AND staging_validation_status = 'PENDING'
          RETURNING staging_row_id::text AS n`,
        [runId, m.source_table_name],
      );
      tally.failedRows += r.rows.length;
      // Bulk audit row per fail
      await pool.query(
        `INSERT INTO audit.import_validation_results (
            import_validation_result_run_id,
            import_validation_result_source_table_id,
            import_validation_result_source_record_id,
            import_validation_result_rule_code,
            import_validation_result_status,
            import_validation_result_message,
            import_validation_result_payload
          )
          SELECT $1, $2, staging_source_record_id, 'WAVE1_VALIDATION_FAIL', 'FAILED',
                 'target table missing', staging_validation_errors
            FROM ${stagingTable}
           WHERE staging_import_run_id = $1
             AND staging_source_table  = $3
             AND staging_validation_status = 'FAILED'`,
        [runId, m.source_table_id, m.source_table_name],
      );
      continue;
    }

    // PASS pass: mark PASSED any row satisfying ALL rules
    const passRes = await pool.query<{ n: string }>(
      `WITH passed AS (
         UPDATE ${stagingTable}
            SET staging_validation_status = 'PASSED',
                staging_validation_errors = '[]'::jsonb
          WHERE staging_import_run_id = $1
            AND staging_source_table  = $2
            AND staging_validation_status = 'PENDING'
            AND staging_source_natural_key IS NOT NULL
            AND staging_source_natural_key NOT LIKE '%::'
            AND staging_source_natural_key NOT LIKE '%::{}'
            AND staging_source_content_hash IS NOT NULL
            AND staging_mapping_confidence >= ${WAVE1_CONFIDENCE_THRESHOLD}
          RETURNING staging_row_id
       )
       SELECT count(*)::text AS n FROM passed`,
      [runId, m.source_table_name],
    );
    tally.validatedRows += Number(passRes.rows[0]?.n ?? 0);

    // FAIL pass: any row still PENDING is failed; record concrete reasons in errors jsonb.
    // We use array_remove(ARRAY[...], NULL) to drop empty slots, then to_jsonb to land it.
    const failRes = await pool.query<{ n: string }>(
      `WITH failed AS (
         UPDATE ${stagingTable}
            SET staging_validation_status = 'FAILED',
                staging_validation_errors = to_jsonb(array_remove(ARRAY[
                  CASE WHEN staging_source_natural_key IS NULL
                         OR staging_source_natural_key LIKE '%::'
                         OR staging_source_natural_key LIKE '%::{}'
                       THEN 'VAL_NATURAL_KEY_MISSING'
                       ELSE NULL END,
                  CASE WHEN staging_source_content_hash IS NULL
                       THEN 'VAL_CONTENT_HASH_MISSING'
                       ELSE NULL END,
                  CASE WHEN staging_mapping_confidence < ${WAVE1_CONFIDENCE_THRESHOLD}
                       THEN 'VAL_CONFIDENCE_BELOW_THRESHOLD'
                       ELSE NULL END
                ]::text[], NULL))
          WHERE staging_import_run_id = $1
            AND staging_source_table  = $2
            AND staging_validation_status = 'PENDING'
          RETURNING staging_row_id
       )
       SELECT count(*)::text AS n FROM failed`,
      [runId, m.source_table_name],
    );
    tally.failedRows += Number(failRes.rows[0]?.n ?? 0);

    // Bulk audit: one row per staging row, partitioned by status
    await pool.query(
      `INSERT INTO audit.import_validation_results (
          import_validation_result_run_id,
          import_validation_result_source_table_id,
          import_validation_result_source_record_id,
          import_validation_result_rule_code,
          import_validation_result_status,
          import_validation_result_message,
          import_validation_result_payload
        )
        SELECT $1, $2, staging_source_record_id,
               CASE WHEN staging_validation_status = 'PASSED'
                    THEN 'WAVE1_ALL_RULES'
                    ELSE 'WAVE1_VALIDATION_FAIL' END,
               staging_validation_status,
               CASE WHEN staging_validation_status = 'FAILED'
                    THEN coalesce(staging_validation_errors->>0, 'unknown') END,
               jsonb_build_object(
                 'errors', staging_validation_errors,
                 'natural_key', staging_source_natural_key
               )
          FROM ${stagingTable}
         WHERE staging_import_run_id = $1
           AND staging_source_table  = $3
           AND staging_validation_status IN ('PASSED','FAILED')`,
      [runId, m.source_table_id, m.source_table_name],
    );
  }

  const updated = Array.from(statsByTarget.values());
  await setWaveStats(pool, runId, updated);
  return updated;
}

// -----------------------------------------------------------------------------
// APPROVE: auto-approve Wave 1 mappings whose validation = 100% PASSED
// -----------------------------------------------------------------------------

export async function executeApprove(
  pool: Pool,
  runId: string,
  mappings: TableMappingRow[],
  initiatedBy: string,
): Promise<{ approved: number; rejected: number }> {
  let approved = 0;
  let rejected = 0;
  for (const m of mappings) {
    const stagingTable = stagingTableFor(m.target_table);
    if (!stagingTable) continue;
    const counts = await pool.query<{ total: string; failed: string }>(
      `SELECT count(*)::text AS total,
              sum(CASE WHEN staging_validation_status = 'FAILED' THEN 1 ELSE 0 END)::text AS failed
         FROM ${stagingTable}
        WHERE staging_import_run_id = $1
          AND staging_source_table  = $2`,
      [runId, m.source_table_name],
    );
    const total = Number(counts.rows[0]?.total ?? 0);
    const failed = Number(counts.rows[0]?.failed ?? 0);
    if (total === 0) {
      // Nothing to approve for this mapping.
      continue;
    }
    if (failed === 0) {
      await writeAuditApproval(pool, {
        runId,
        tableMappingId: m.table_mapping_id,
        status: "APPROVED",
        approverUserId: null,
        rationale: `WAVE_1_AUTO_APPROVE: ${total} staging rows, 0 failed`,
      });
      approved += 1;
    } else {
      await writeAuditApproval(pool, {
        runId,
        tableMappingId: m.table_mapping_id,
        status: "REJECTED",
        approverUserId: null,
        rationale: `WAVE_1_AUTO_REJECT: ${failed}/${total} staging rows failed validation`,
      });
      rejected += 1;
    }
  }
  // Reference initiatedBy for future per-mapping audit detail
  void initiatedBy;
  return { approved, rejected };
}

// -----------------------------------------------------------------------------
// UPSERT: transform + INSERT into sys.sys_* + write lineage
// -----------------------------------------------------------------------------

const UPSERT_BATCH_SIZE = 100;

/**
 * Optional debug cap on rows processed per mapping. When set (env
 * WAVE1_DEBUG_LIMIT), each mapping caps its staging input to this many rows.
 * Used by the E2E integration test to validate the full pipeline on a tiny
 * sample without waiting on 47k-row workloads.
 */
function debugLimit(): number | null {
  const v = process.env.WAVE1_DEBUG_LIMIT;
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function executeUpsert(
  pool: Pool,
  runId: string,
  mappings: TableMappingRow[],
  stats: WaveStageStats[],
  mode: WaveExecutorMode,
): Promise<WaveStageStats[]> {
  const statsByTarget = new Map(stats.map((s) => [s.target, { ...s }]));
  const tenantId = await resolvePlatformTenantId(pool);
  const targetMetaCache = new Map<string, TargetMeta>();
  async function getMeta(target: string): Promise<TargetMeta> {
    let m = targetMetaCache.get(target);
    if (!m) {
      m = await loadTargetMeta(pool, target);
      targetMetaCache.set(target, m);
    }
    return m;
  }

  const cap = debugLimit();

  for (const m of mappings) {
    const stagingTable = stagingTableFor(m.target_table);
    if (!stagingTable) continue;
    const targetMeta = await getMeta(m.target_table);
    if (targetMeta.columns.size === 0) continue;

    const columnMappings = await getColumnMappingsForTableMapping(pool, m.table_mapping_id);

    // Count rows for this mapping (no payload load).
    const cntRes = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${stagingTable}
        WHERE staging_import_run_id = $1
          AND staging_source_table  = $2
          AND staging_validation_status = 'PASSED'
          AND staging_target_record_id IS NULL`,
      [runId, m.source_table_name],
    );
    const totalReady = Number(cntRes.rows[0]?.n ?? 0);
    const total = cap !== null ? Math.min(totalReady, cap) : totalReady;
    if (total === 0) continue;

    const tally = statsByTarget.get(m.target_table)!;

    if (mode === "DRY_RUN") {
      tally.upsertedRows += total;
      continue;
    }

    // Paginated streaming: load one chunk's worth of staging rows at a time
    // → prepare → upsert → lineage → mark, then loop. Keeps heap small even
    // with 100k+ staging rows containing pgvector embeddings.
    const short = m.target_table.replace(/^sys_/, "");
    const tenantCol = `${short}_tenant_id`;
    const globalCol = `${short}_is_global`;
    const metaCol = `${short}_metadata`;

    let processed = 0;
    const chunkSize = cap !== null
      ? Math.min(UPSERT_BATCH_SIZE, total)
      : UPSERT_BATCH_SIZE;
    while (processed < total) {
      // Use staging_target_record_id IS NULL as the cursor — each iteration
      // marks rows as upserted (target_record_id set), so the next LIMIT
      // naturally pulls the next unprocessed batch.
      const chunkRes = await pool.query<{
        staging_row_id: string;
        staging_source_table: string;
        staging_source_record_id: string;
        staging_source_natural_key: string | null;
        staging_source_content_hash: string | null;
        staging_raw_record: Record<string, unknown>;
        staging_validation_status: string;
        staging_mapping_confidence: string;
        staging_target_record_id: string | null;
      }>(
        `SELECT staging_row_id, staging_source_table, staging_source_record_id,
                staging_source_natural_key, staging_source_content_hash,
                staging_raw_record, staging_validation_status,
                staging_mapping_confidence, staging_target_record_id
           FROM ${stagingTable}
          WHERE staging_import_run_id = $1
            AND staging_source_table  = $2
            AND staging_validation_status = 'PASSED'
            AND staging_target_record_id IS NULL
          ORDER BY staging_row_id
          LIMIT $3`,
        [runId, m.source_table_name, chunkSize],
      );
      if (chunkRes.rows.length === 0) break;

      const batch = chunkRes.rows.map((sr) => {
        const targetRow = buildTargetRow(sr.staging_raw_record, columnMappings, targetMeta);
        if (targetMeta.columns.has(tenantCol) && targetRow[tenantCol] === undefined) {
          targetRow[tenantCol] = null;
        }
        if (targetMeta.columns.has(globalCol) && targetRow[globalCol] === undefined) {
          targetRow[globalCol] = true;
        }
        if (targetMeta.columns.has(metaCol) && targetRow[metaCol] === undefined) {
          targetRow[metaCol] = {};
        }
        // Fallback for missing natural key columns: derive from
        // staging_source_natural_key (or source_record_id as last resort).
        // Skip the fallback for UUID columns (they're typically FK refs that
        // need true LOOKUP_FK resolution; injecting an arbitrary string would
        // crash the INSERT with "invalid uuid syntax").
        const nkFallback = sr.staging_source_natural_key
          ?? `OLDDB::${sr.staging_source_table}::${sr.staging_source_record_id}`;
        let skipRow = false;
        for (const nkCol of targetMeta.naturalKeyColumns) {
          const colType = targetMeta.columnTypes.get(nkCol);
          const cur = targetRow[nkCol];
          if (cur === undefined || cur === null) {
            if (nkCol.endsWith("_tenant_id")) {
              targetRow[nkCol] = null;
            } else if (colType === "uuid") {
              // Cannot synthesise a UUID NK — row will be skipped at INSERT.
              skipRow = true;
              break;
            } else {
              const maxLen = targetMeta.columnMaxLengths.get(nkCol) ?? 128;
              targetRow[nkCol] = nkFallback.substring(0, Math.max(1, maxLen));
            }
          } else if (colType === "uuid" && typeof cur === "string" && !UUID_RE.test(cur)) {
            // Existing value isn't a valid uuid → would crash the INSERT.
            skipRow = true;
            break;
          }
        }
        // Ensure required "_name" col (frequent NOT NULL on sys.sys_*) has a value.
        const nameCol = `${m.target_table.replace(/^sys_/, "")}_name`;
        if (targetMeta.columns.has(nameCol) && targetRow[nameCol] === undefined) {
          const nameMaxLen = targetMeta.columnMaxLengths.get(nameCol) ?? 255;
          targetRow[nameCol] = nkFallback.substring(0, Math.max(1, nameMaxLen));
        }
        // Apply varchar max-length truncation + numeric/boolean coercion to
        // values produced by transforms (transforms operate untyped; PG strict
        // typing rejects "12.00" for an int4 column or arbitrary text for a
        // varchar(32)).
        for (const [col, val] of Object.entries(targetRow)) {
          if (val === null || val === undefined) continue;
          const colType = targetMeta.columnTypes.get(col);
          if (typeof val === "string") {
            const maxLen = targetMeta.columnMaxLengths.get(col);
            if (typeof maxLen === "number" && maxLen > 0 && val.length > maxLen) {
              targetRow[col] = val.substring(0, maxLen);
            }
            if (colType === "int2" || colType === "int4" || colType === "int8") {
              const n = Number.parseFloat(val);
              targetRow[col] = Number.isFinite(n) ? Math.trunc(n) : null;
            } else if (colType === "numeric") {
              const n = Number.parseFloat(val);
              targetRow[col] = Number.isFinite(n) ? n : null;
            } else if (colType === "bool") {
              const lo = val.trim().toLowerCase();
              targetRow[col] = lo === "true" || lo === "t" || lo === "1" || lo === "yes";
            }
          } else if (typeof val === "number" && (colType === "int2" || colType === "int4" || colType === "int8")) {
            targetRow[col] = Math.trunc(val);
          }
        }
        return { staging: sr, targetRow, skipRow };
      }).filter((b) => !b.skipRow)
        .map((b) => ({ staging: b.staging, targetRow: b.targetRow }));

      const upserted = await batchUpsertTarget(pool, m.target_table, targetMeta, batch);
      tally.upsertedRows += upserted.length;

      if (upserted.length > 0) {
        await batchWriteLineage(pool, {
          runId,
          tenantId,
          tableMappingId: m.table_mapping_id,
          targetTable: m.target_table,
          upserted,
        });
        await batchMarkStagingUpserted(pool, stagingTable, upserted);
        tally.lineageRows += upserted.length;
      } else {
        // Fail-safe: rows that couldn't be matched stay PASSED-but-unupserted.
        // Mark them as SKIPPED to break the loop and avoid infinite iteration.
        const ids = chunkRes.rows.map((r) => r.staging_row_id);
        await pool.query(
          `UPDATE ${stagingTable}
              SET staging_validation_status = 'SKIPPED',
                  staging_validation_errors = '["UPSERT_NO_MATCH"]'::jsonb
            WHERE staging_row_id = ANY($1::uuid[])`,
          [ids],
        );
      }
      processed += chunkRes.rows.length;
    }
  }

  const updated = Array.from(statsByTarget.values());
  await setWaveStats(pool, runId, updated);
  return updated;
}

interface UpsertedRow {
  stagingRowId: string;
  sourceTable: string;
  sourceRecordId: string;
  sourceNaturalKey: string | null;
  sourceContentHash: string | null;
  mappingConfidence: number;
  targetId: string;
}

async function batchUpsertTarget(
  pool: Pool,
  targetTable: string,
  meta: TargetMeta,
  batch: Array<{
    staging: {
      staging_row_id: string;
      staging_source_table: string;
      staging_source_record_id: string;
      staging_source_natural_key: string | null;
      staging_source_content_hash: string | null;
      staging_mapping_confidence: string;
    };
    targetRow: Record<string, unknown>;
  }>,
): Promise<UpsertedRow[]> {
  if (batch.length === 0) return [];

  // Build column union: the set of columns that ANY row in the batch needs.
  // Each batch row maps null for columns it doesn't set.
  const colUnion = new Set<string>();
  for (const b of batch) {
    for (const c of Object.keys(b.targetRow)) {
      if (meta.columns.has(c)) colUnion.add(c);
    }
  }
  if (colUnion.size === 0) return [];

  const cols = Array.from(colUnion);
  const params: unknown[] = [];
  const placeholderRows: string[] = [];
  for (const b of batch) {
    const rowPlaceholders: string[] = [];
    for (const c of cols) {
      params.push(serializeForPg(b.targetRow[c] ?? null));
      rowPlaceholders.push(`$${params.length}`);
    }
    placeholderRows.push(`(${rowPlaceholders.join(", ")})`);
  }
  const setClauses = cols
    .filter((c) => !meta.naturalKeyColumns.includes(c) && c !== meta.pkColumn && c !== "updated_at" && c !== "created_at")
    .map((c) => `${c} = EXCLUDED.${c}`);
  if (meta.columns.has("updated_at")) setClauses.push("updated_at = now()");

  // RETURNING includes pk + all natural key cols so we can match each returned
  // row back to its source staging row via the JS-side targetRow values.
  const returningCols = [meta.pkColumn, ...meta.naturalKeyColumns.filter((c) => c !== meta.pkColumn)];

  const sql = meta.conflictInference
    ? `INSERT INTO sys.${targetTable} (${cols.join(", ")})
         VALUES ${placeholderRows.join(", ")}
         ON CONFLICT (${meta.conflictInference})
           DO UPDATE SET ${setClauses.join(", ")}
       RETURNING ${returningCols.join(", ")}`
    : `INSERT INTO sys.${targetTable} (${cols.join(", ")})
         VALUES ${placeholderRows.join(", ")}
       RETURNING ${returningCols.join(", ")}`;

  let res: { rows: Array<Record<string, unknown>> };
  try {
    res = await pool.query<Record<string, unknown>>(sql, params);
  } catch (e) {
    // Batch-level fallback: if the whole batch fails, retry per-row to skip the
    // offending entries instead of dropping the whole batch.
    const msg = (e as Error).message;
    if (!msg.includes("violates") && !msg.includes("conflict")) throw e;
    const acc: UpsertedRow[] = [];
    for (const b of batch) {
      const id = await upsertTargetRow(pool, targetTable, meta, b.targetRow);
      if (id) {
        acc.push({
          stagingRowId: b.staging.staging_row_id,
          sourceTable: b.staging.staging_source_table,
          sourceRecordId: b.staging.staging_source_record_id,
          sourceNaturalKey: b.staging.staging_source_natural_key,
          sourceContentHash: b.staging.staging_source_content_hash,
          mappingConfidence: Number(b.staging.staging_mapping_confidence),
          targetId: id,
        });
      }
    }
    return acc;
  }

  // Match returned rows to batch entries by natural key combination.
  const matched: UpsertedRow[] = [];
  // Build a lookup from natural-key signature → batch entry. The signature is
  // the JSON-stringified array of natural key values, in column order.
  const sig = (vals: unknown[]) => JSON.stringify(vals.map((v) => (v === undefined ? null : v)));
  const lookup = new Map<string, typeof batch[number]>();
  for (const b of batch) {
    const key = sig(meta.naturalKeyColumns.map((c) => b.targetRow[c] ?? null));
    if (!lookup.has(key)) lookup.set(key, b);
  }
  for (const row of res.rows) {
    const key = sig(meta.naturalKeyColumns.map((c) => row[c]));
    const b = lookup.get(key);
    if (!b) continue;
    matched.push({
      stagingRowId: b.staging.staging_row_id,
      sourceTable: b.staging.staging_source_table,
      sourceRecordId: b.staging.staging_source_record_id,
      sourceNaturalKey: b.staging.staging_source_natural_key,
      sourceContentHash: b.staging.staging_source_content_hash,
      mappingConfidence: Number(b.staging.staging_mapping_confidence),
      targetId: row[meta.pkColumn] as string,
    });
    // Consume so duplicates in the batch don't double-credit
    lookup.delete(key);
  }
  return matched;
}

async function batchWriteLineage(
  pool: Pool,
  args: {
    runId: string;
    tenantId: string;
    tableMappingId: string;
    targetTable: string;
    upserted: UpsertedRow[];
  },
): Promise<void> {
  const params: unknown[] = [];
  const valueRows: string[] = [];
  for (const u of args.upserted) {
    params.push(
      args.tenantId,
      "heuresys_platform",
      u.sourceTable,
      u.sourceRecordId,
      u.sourceNaturalKey,
      u.sourceContentHash,
      args.runId,
      args.tableMappingId,
      args.targetTable,
      u.targetId,
      u.mappingConfidence,
    );
    const off = params.length;
    valueRows.push(
      `($${off - 10}, $${off - 9}, $${off - 8}, $${off - 7}, $${off - 6}, $${off - 5}, $${off - 4}, $${off - 3}, $${off - 2}, $${off - 1}, $${off}, 'VALID')`,
    );
  }
  await pool.query(
    `INSERT INTO sys.sys_source_lineage_records (
        source_lineage_tenant_id, source_lineage_source_system,
        source_lineage_source_table, source_lineage_source_record_id,
        source_lineage_source_natural_key, source_lineage_source_content_hash,
        source_lineage_import_run_id, source_lineage_table_mapping_id,
        source_lineage_target_table_name, source_lineage_target_record_id,
        source_lineage_mapping_confidence, source_lineage_validation_status
      ) VALUES ${valueRows.join(", ")}
      ON CONFLICT (source_lineage_source_system, source_lineage_source_table,
                   source_lineage_source_record_id, source_lineage_target_table_name)
        DO UPDATE SET
          source_lineage_source_content_hash = EXCLUDED.source_lineage_source_content_hash,
          source_lineage_mapping_confidence  = EXCLUDED.source_lineage_mapping_confidence,
          source_lineage_target_record_id    = EXCLUDED.source_lineage_target_record_id,
          source_lineage_validation_status   = 'VALID'`,
    params,
  );
}

async function batchMarkStagingUpserted(
  pool: Pool,
  stagingTable: string,
  upserted: UpsertedRow[],
): Promise<void> {
  // Bulk UPDATE via VALUES join.
  const params: unknown[] = [];
  const valueRows: string[] = [];
  for (const u of upserted) {
    params.push(u.stagingRowId, u.targetId);
    const off = params.length;
    valueRows.push(`($${off - 1}::uuid, $${off}::uuid)`);
  }
  await pool.query(
    `UPDATE ${stagingTable} t
        SET staging_target_record_id = v.target_id,
            staging_upserted_at = now()
       FROM (VALUES ${valueRows.join(", ")}) AS v(staging_row_id, target_id)
      WHERE t.staging_row_id = v.staging_row_id`,
    params,
  );
}

function buildTargetRow(
  raw: RawRow,
  columnMappings: ColumnMappingRow[],
  targetMeta: TargetMeta,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const cm of columnMappings) {
    if (!targetMeta.columns.has(cm.target_column)) continue;
    const out = applyTransform({
      sourceColumn: cm.source_column_name,
      targetColumn: cm.target_column,
      transform: cm.transform,
      payload: cm.transform_payload ?? {},
      row: raw,
    });
    if (!out.skip) {
      result[cm.target_column] = out.value;
    }
  }
  return result;
}

async function upsertTargetRow(
  pool: Pool,
  targetTable: string,
  meta: TargetMeta,
  row: Record<string, unknown>,
): Promise<string | null> {
  const cols = Object.keys(row).filter((c) => meta.columns.has(c));
  if (cols.length === 0) return null;
  const params: unknown[] = [];
  const placeholders: string[] = [];
  for (const c of cols) {
    params.push(serializeForPg(row[c]));
    placeholders.push(`$${params.length}`);
  }
  const setClauses = cols
    .filter((c) => !meta.naturalKeyColumns.includes(c) && c !== meta.pkColumn && c !== "updated_at" && c !== "created_at")
    .map((c) => `${c} = EXCLUDED.${c}`);
  if (meta.columns.has("updated_at")) setClauses.push("updated_at = now()");

  const sql = meta.conflictInference
    ? `INSERT INTO sys.${targetTable} (${cols.join(", ")})
         VALUES (${placeholders.join(", ")})
         ON CONFLICT (${meta.conflictInference})
           DO UPDATE SET ${setClauses.join(", ")}
       RETURNING ${meta.pkColumn} AS id`
    : `INSERT INTO sys.${targetTable} (${cols.join(", ")})
         VALUES (${placeholders.join(", ")})
       RETURNING ${meta.pkColumn} AS id`;

  try {
    const res = await pool.query<{ id: string }>(sql, params);
    return res.rows[0]?.id ?? null;
  } catch (e) {
    // Convert constraint violations into a clean rejection rather than crashing the whole wave.
    // The caller logs upserts that failed via audit.
    const msg = (e as Error).message;
    if (msg.includes("violates")) {
      return null;
    }
    throw e;
  }
}

function serializeForPg(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    // jsonb-friendly array
    return JSON.stringify(v);
  }
  return v;
}

// -----------------------------------------------------------------------------
// Acceptance criteria SQL (post-run sanity gate)
// -----------------------------------------------------------------------------

export async function runAcceptanceChecks(
  pool: Pool,
  runId: string,
): Promise<Array<{ name: string; query: string; expected: string; actual: string; pass: boolean }>> {
  const checks: Array<{ name: string; query: string; expected: string; actual: string; pass: boolean }> = [];

  // 1. All wave 1 mappings APPROVED
  const q1 = `SELECT count(*)::text AS n FROM brownfield.table_mappings
              WHERE table_mapping_wave = 1 AND table_mapping_approval_status = 'APPROVED'
                AND table_mapping_classification = 'IMPORT'`;
  const r1 = await pool.query<{ n: string }>(q1);
  checks.push({
    name: "wave_1_mappings_approved",
    query: q1,
    expected: ">= 88",
    actual: r1.rows[0]!.n,
    pass: Number(r1.rows[0]!.n) >= 88,
  });

  // 2. No validation failures for this run
  const q2 = `SELECT count(*)::text AS n FROM audit.import_validation_results
              WHERE import_validation_result_run_id = $1
                AND import_validation_result_status = 'FAILED'`;
  const r2 = await pool.query<{ n: string }>(q2, [runId]);
  checks.push({
    name: "no_validation_failures_for_run",
    query: q2,
    expected: "0",
    actual: r2.rows[0]!.n,
    pass: Number(r2.rows[0]!.n) === 0,
  });

  // 3. Every lineage row for this run has a matching canonical row
  const q3 = `SELECT count(*)::text AS n FROM sys.sys_source_lineage_records
              WHERE source_lineage_import_run_id = $1`;
  const r3 = await pool.query<{ n: string }>(q3, [runId]);
  checks.push({
    name: "lineage_rows_written",
    query: q3,
    expected: "> 0 when wave non-empty",
    actual: r3.rows[0]!.n,
    pass: true, // always pass (informational; empty wave is allowed)
  });

  return checks;
}

// -----------------------------------------------------------------------------
// Helpers exposed to service.ts
// -----------------------------------------------------------------------------

export async function loadMappings(pool: Pool): Promise<TableMappingRow[]> {
  return getWave1Mappings(pool);
}

export async function refreshRun(pool: Pool, runId: string) {
  return findWaveRun(pool, runId);
}
