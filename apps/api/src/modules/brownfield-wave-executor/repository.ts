/**
 * apps/api/src/modules/brownfield-wave-executor/repository.ts
 *
 * Raw SQL for the wave executor. We extend `brownfield.import_runs` by stashing
 * the granular state machine + stage stats in `import_run_metadata.wave_executor`
 * jsonb, avoiding a dedicated table for the executor. Coarse status
 * (RUNNING/COMPLETED/FAILED) lives on `import_run_status`; the 6-state FSM
 * (PENDING/STAGING/VALIDATING/APPROVED/UPSERTING/COMPLETE plus FAILED/CANCELLED)
 * lives in metadata.
 */
import type { Pool, PoolClient } from "pg";
import type {
  WaveExecutorRun,
  WaveExecutorRunListQuery,
  WaveExecutorState,
  WaveExecutorMode,
  WaveStageStats,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

// -----------------------------------------------------------------------------
// Type for the in-jsonb wave executor block
// -----------------------------------------------------------------------------

interface WaveExecutorMetadata {
  state: WaveExecutorState;
  mode: WaveExecutorMode;
  stats: WaveStageStats[];
  failure_reason: string | null;
  started_at?: string;
  finished_at?: string;
}

interface ImportRunRow {
  import_run_id: string;
  import_run_wave: number | null;
  import_run_started_at: Date;
  import_run_finished_at: Date | null;
  import_run_status: string;
  import_run_initiated_by: string | null;
  import_run_metadata: Record<string, unknown> & { wave_executor?: WaveExecutorMetadata };
  created_at: Date;
}

function defaultMetadata(mode: WaveExecutorMode): WaveExecutorMetadata {
  return { state: "PENDING", mode, stats: [], failure_reason: null };
}

function unwrap(r: ImportRunRow): WaveExecutorRun {
  const we = r.import_run_metadata.wave_executor ?? defaultMetadata("EXECUTE");
  const finished = r.import_run_finished_at;
  const durationMs = finished
    ? finished.getTime() - r.import_run_started_at.getTime()
    : null;
  const stats = we.stats ?? [];
  const totalStaged = stats.reduce((acc, s) => acc + s.stagedRows, 0);
  const totalUpserted = stats.reduce((acc, s) => acc + s.upsertedRows, 0);
  const totalFailed = stats.reduce((acc, s) => acc + s.failedRows, 0);
  return {
    runId: r.import_run_id,
    wave: r.import_run_wave ?? 1,
    mode: we.mode,
    state: we.state,
    startedAt: r.import_run_started_at.toISOString(),
    finishedAt: finished ? finished.toISOString() : null,
    durationMs,
    initiatedBy: r.import_run_initiated_by,
    stats,
    totalStaged,
    totalUpserted,
    totalFailed,
    failureReason: we.failure_reason,
    metadata: r.import_run_metadata,
  };
}

const COLS = `import_run_id, import_run_wave, import_run_started_at,
  import_run_finished_at, import_run_status, import_run_initiated_by,
  import_run_metadata, created_at`;

// -----------------------------------------------------------------------------
// Run lifecycle
// -----------------------------------------------------------------------------

export async function createWaveRun(
  q: DbConnector,
  wave: number,
  mode: WaveExecutorMode,
  initiatedBy: string,
): Promise<WaveExecutorRun> {
  const exportRes = await q.query<{ source_export_id: string }>(
    `SELECT source_export_id FROM brownfield.source_exports
       ORDER BY created_at DESC LIMIT 1`,
  );
  const exportId = exportRes.rows[0]?.source_export_id ?? null;
  const metadata = { wave_executor: defaultMetadata(mode) };
  const res = await q.query<ImportRunRow>(
    `INSERT INTO brownfield.import_runs (
        import_run_export_id, import_run_wave, import_run_classification_scope,
        import_run_status, import_run_initiated_by, import_run_metadata
      ) VALUES ($1, $2, $3, 'RUNNING', $4, $5::jsonb)
      RETURNING ${COLS}`,
    [exportId, wave, "wave_executor", initiatedBy, JSON.stringify(metadata)],
  );
  return unwrap(res.rows[0]!);
}

export async function findWaveRun(
  q: DbConnector,
  runId: string,
): Promise<WaveExecutorRun | null> {
  const res = await q.query<ImportRunRow>(
    `SELECT ${COLS} FROM brownfield.import_runs WHERE import_run_id = $1`,
    [runId],
  );
  return res.rows[0] ? unwrap(res.rows[0]) : null;
}

export async function listWaveRuns(
  q: DbConnector,
  query: WaveExecutorRunListQuery,
): Promise<{ items: WaveExecutorRun[]; total: number }> {
  const where: string[] = [
    `import_run_classification_scope = 'wave_executor'`,
  ];
  const params: unknown[] = [];
  if (query.wave !== undefined) {
    params.push(query.wave);
    where.push(`import_run_wave = $${params.length}`);
  }
  if (query.state !== undefined) {
    params.push(query.state);
    where.push(`import_run_metadata->'wave_executor'->>'state' = $${params.length}`);
  }
  const whereClause = `WHERE ${where.join(" AND ")}`;
  const totalRes = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM brownfield.import_runs ${whereClause}`,
    params,
  );
  params.push(query.limit);
  const limPos = params.length;
  params.push(query.offset);
  const offPos = params.length;
  const res = await q.query<ImportRunRow>(
    `SELECT ${COLS} FROM brownfield.import_runs ${whereClause}
      ORDER BY import_run_started_at DESC LIMIT $${limPos} OFFSET $${offPos}`,
    params,
  );
  return {
    items: res.rows.map(unwrap),
    total: Number(totalRes.rows[0]?.total ?? 0),
  };
}

export async function updateWaveState(
  q: DbConnector,
  runId: string,
  state: WaveExecutorState,
  failureReason: string | null = null,
): Promise<WaveExecutorRun | null> {
  // Patch the wave_executor jsonb sub-object via jsonb_set, plus mirror coarse
  // status on import_run_status (RUNNING / COMPLETED / FAILED / CANCELLED).
  const coarse =
    state === "COMPLETE"
      ? "COMPLETED"
      : state === "FAILED"
      ? "FAILED"
      : state === "CANCELLED"
      ? "CANCELLED"
      : "RUNNING";
  const finishedSql =
    state === "COMPLETE" || state === "FAILED" || state === "CANCELLED"
      ? "COALESCE(import_run_finished_at, now())"
      : "import_run_finished_at";
  const res = await q.query<ImportRunRow>(
    `UPDATE brownfield.import_runs
        SET import_run_status = $2,
            import_run_finished_at = ${finishedSql},
            import_run_metadata = jsonb_set(
              jsonb_set(
                COALESCE(import_run_metadata, '{}'::jsonb),
                '{wave_executor,state}',
                to_jsonb($3::text)
              ),
              '{wave_executor,failure_reason}',
              COALESCE(to_jsonb($4::text), 'null'::jsonb)
            )
      WHERE import_run_id = $1
      RETURNING ${COLS}`,
    [runId, coarse, state, failureReason],
  );
  return res.rows[0] ? unwrap(res.rows[0]) : null;
}

export async function setWaveStats(
  q: DbConnector,
  runId: string,
  stats: WaveStageStats[],
): Promise<void> {
  await q.query(
    `UPDATE brownfield.import_runs
        SET import_run_metadata = jsonb_set(
          COALESCE(import_run_metadata, '{}'::jsonb),
          '{wave_executor,stats}',
          $2::jsonb
        )
      WHERE import_run_id = $1`,
    [runId, JSON.stringify(stats)],
  );
}

// -----------------------------------------------------------------------------
// Mapping resolution (table-level + column-level)
// -----------------------------------------------------------------------------

export interface TableMappingRow {
  table_mapping_id: string;
  source_table_id: string;
  source_table_schema: string | null;
  source_table_name: string;
  source_table_domain: string | null;
  target_schema: string;
  target_table: string;
  natural_key_pattern: string | null;
  metadata: Record<string, unknown>;
}

export async function getWave1Mappings(q: DbConnector): Promise<TableMappingRow[]> {
  const res = await q.query<TableMappingRow>(
    `SELECT tm.table_mapping_id            AS table_mapping_id,
            st.source_table_id             AS source_table_id,
            st.source_table_schema         AS source_table_schema,
            st.source_table_name           AS source_table_name,
            st.source_table_domain         AS source_table_domain,
            tm.table_mapping_target_schema AS target_schema,
            tm.table_mapping_target_table  AS target_table,
            tm.table_mapping_metadata->>'natural_key_pattern' AS natural_key_pattern,
            tm.table_mapping_metadata      AS metadata
       FROM brownfield.table_mappings tm
       JOIN brownfield.source_tables st
         ON st.source_table_id = tm.table_mapping_source_table_id
      WHERE tm.table_mapping_wave = 1
        AND tm.table_mapping_approval_status = 'APPROVED'
        AND tm.table_mapping_classification = 'IMPORT'
      ORDER BY st.source_table_domain, st.source_table_name`,
  );
  return res.rows;
}

export interface ColumnMappingRow {
  column_mapping_id: string;
  source_column_name: string;
  target_column: string;
  transform: string | null;
  transform_payload: Record<string, unknown>;
}

export async function getColumnMappingsForTableMapping(
  q: DbConnector,
  tableMappingId: string,
): Promise<ColumnMappingRow[]> {
  const res = await q.query<ColumnMappingRow>(
    `SELECT cm.column_mapping_id             AS column_mapping_id,
            sc.source_column_name            AS source_column_name,
            cm.column_mapping_target_column  AS target_column,
            cm.column_mapping_transform      AS transform,
            cm.column_mapping_transform_payload AS transform_payload
       FROM brownfield.column_mappings cm
       JOIN brownfield.source_columns sc
         ON sc.source_column_id = cm.column_mapping_source_column_id
      WHERE cm.column_mapping_table_mapping_id = $1`,
    [tableMappingId],
  );
  return res.rows;
}

// -----------------------------------------------------------------------------
// Staging operations
// -----------------------------------------------------------------------------

/**
 * Map canonical target → staging table name. The staging table name is
 * `staging.wave1_<target_short>` where target_short strips the `sys_` prefix.
 * E.g. `sys_skills` → `staging.wave1_skills`. Returns null for targets without
 * a dedicated staging table (those rare cases should be flagged at staging
 * time, not silently swallowed).
 */
export function stagingTableFor(target: string): string | null {
  // Strip 'sys_' prefix if present
  const short = target.startsWith("sys_") ? target.slice(4) : target;
  // The 17 explicit Wave 1 staging tables defined in migration 000030.
  const known = new Set([
    "skills", "skill_families", "skill_categories", "skill_taxonomy_edges",
    "skill_aliases", "learning_modules", "learning_paths", "learning_path_steps",
    "skill_learning_mappings", "user_certifications", "esco_occupation_mappings",
    "activity_classifications", "activity_classification_mappings",
    "compensation_bands", "process_kpi_templates", "blueprint_process_registry",
    "job_roles",
  ]);
  return known.has(short) ? `staging.wave1_${short}` : null;
}

export async function truncateAllWave1Staging(q: DbConnector): Promise<void> {
  const targets = [
    "wave1_skills", "wave1_skill_families", "wave1_skill_categories",
    "wave1_skill_taxonomy_edges", "wave1_skill_aliases",
    "wave1_learning_modules", "wave1_learning_paths", "wave1_learning_path_steps",
    "wave1_skill_learning_mappings", "wave1_user_certifications",
    "wave1_esco_occupation_mappings", "wave1_activity_classifications",
    "wave1_activity_classification_mappings", "wave1_compensation_bands",
    "wave1_process_kpi_templates", "wave1_blueprint_process_registry",
    "wave1_job_roles",
  ];
  // Single TRUNCATE for atomicity. RESTART IDENTITY is irrelevant (uuid PK).
  await q.query(`TRUNCATE ${targets.map((t) => `staging.${t}`).join(", ")} CASCADE`);
}

export interface StagingInsertRow {
  sourceTable: string;
  sourceRecordId: string;
  sourceNaturalKey: string | null;
  sourceContentHash: string;
  rawRecord: Record<string, unknown>;
  mappingConfidence?: number;
}

export async function bulkInsertStaging(
  q: DbConnector,
  runId: string,
  stagingTable: string,
  rows: StagingInsertRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  // Parameterized batched INSERT to keep parameter count manageable.
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values: string[] = [];
    const params: unknown[] = [];
    for (const row of slice) {
      params.push(
        runId,
        row.sourceTable,
        row.sourceRecordId,
        row.sourceNaturalKey,
        row.sourceContentHash,
        JSON.stringify(row.rawRecord),
        row.mappingConfidence ?? 1.0,
      );
      const off = params.length;
      values.push(
        `($${off - 6}, $${off - 5}, $${off - 4}, $${off - 3}, $${off - 2}, $${off - 1}::jsonb, $${off})`,
      );
    }
    const res = await q.query(
      `INSERT INTO ${stagingTable} (
          staging_import_run_id, staging_source_table, staging_source_record_id,
          staging_source_natural_key, staging_source_content_hash, staging_raw_record,
          staging_mapping_confidence
        ) VALUES ${values.join(", ")}
        ON CONFLICT (staging_import_run_id, staging_source_table, staging_source_record_id)
          DO NOTHING`,
      params,
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

export interface StagingRow {
  staging_row_id: string;
  staging_source_table: string;
  staging_source_record_id: string;
  staging_source_natural_key: string | null;
  staging_source_content_hash: string | null;
  staging_raw_record: Record<string, unknown>;
  staging_validation_status: string;
  staging_mapping_confidence: string; // numeric returns as string in node-postgres by default
  staging_target_record_id: string | null;
}

export async function listStagingForUpsert(
  q: DbConnector,
  stagingTable: string,
  runId: string,
): Promise<StagingRow[]> {
  const res = await q.query<StagingRow>(
    `SELECT staging_row_id, staging_source_table, staging_source_record_id,
            staging_source_natural_key, staging_source_content_hash,
            staging_raw_record, staging_validation_status,
            staging_mapping_confidence, staging_target_record_id
       FROM ${stagingTable}
      WHERE staging_import_run_id = $1
        AND staging_validation_status = 'PASSED'
        AND staging_target_record_id IS NULL
      ORDER BY staging_source_table, staging_source_record_id`,
    [runId],
  );
  return res.rows;
}

export async function listAllStagingForRun(
  q: DbConnector,
  stagingTable: string,
  runId: string,
): Promise<StagingRow[]> {
  const res = await q.query<StagingRow>(
    `SELECT staging_row_id, staging_source_table, staging_source_record_id,
            staging_source_natural_key, staging_source_content_hash,
            staging_raw_record, staging_validation_status,
            staging_mapping_confidence, staging_target_record_id
       FROM ${stagingTable}
      WHERE staging_import_run_id = $1
      ORDER BY staging_source_table, staging_source_record_id`,
    [runId],
  );
  return res.rows;
}

export async function updateStagingValidation(
  q: DbConnector,
  stagingTable: string,
  stagingRowId: string,
  status: "PASSED" | "FAILED" | "SKIPPED",
  errors: unknown[],
): Promise<void> {
  await q.query(
    `UPDATE ${stagingTable}
        SET staging_validation_status = $2,
            staging_validation_errors = $3::jsonb
      WHERE staging_row_id = $1`,
    [stagingRowId, status, JSON.stringify(errors)],
  );
}

export async function markStagingUpserted(
  q: DbConnector,
  stagingTable: string,
  stagingRowId: string,
  targetRecordId: string,
): Promise<void> {
  await q.query(
    `UPDATE ${stagingTable}
        SET staging_target_record_id = $2,
            staging_upserted_at = now()
      WHERE staging_row_id = $1`,
    [stagingRowId, targetRecordId],
  );
}

// -----------------------------------------------------------------------------
// Lineage + audit
// -----------------------------------------------------------------------------

export async function writeLineage(
  q: DbConnector,
  args: {
    tenantId: string;
    sourceSystem: string;
    sourceTable: string;
    sourceRecordId: string;
    sourceNaturalKey: string | null;
    sourceContentHash: string | null;
    importRunId: string;
    tableMappingId: string;
    targetTable: string;
    targetRecordId: string;
    mappingConfidence: number;
  },
): Promise<string> {
  const res = await q.query<{ source_lineage_record_id: string }>(
    `INSERT INTO sys.sys_source_lineage_records (
        source_lineage_tenant_id, source_lineage_source_system,
        source_lineage_source_table, source_lineage_source_record_id,
        source_lineage_source_natural_key, source_lineage_source_content_hash,
        source_lineage_import_run_id, source_lineage_table_mapping_id,
        source_lineage_target_table_name, source_lineage_target_record_id,
        source_lineage_mapping_confidence, source_lineage_validation_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'VALID')
      ON CONFLICT (source_lineage_source_system, source_lineage_source_table,
                   source_lineage_source_record_id, source_lineage_target_table_name)
        DO UPDATE SET
          source_lineage_source_content_hash = EXCLUDED.source_lineage_source_content_hash,
          source_lineage_mapping_confidence  = EXCLUDED.source_lineage_mapping_confidence,
          source_lineage_target_record_id    = EXCLUDED.source_lineage_target_record_id,
          source_lineage_validation_status   = 'VALID'
      RETURNING source_lineage_record_id`,
    [
      args.tenantId,
      args.sourceSystem,
      args.sourceTable,
      args.sourceRecordId,
      args.sourceNaturalKey,
      args.sourceContentHash,
      args.importRunId,
      args.tableMappingId,
      args.targetTable,
      args.targetRecordId,
      args.mappingConfidence,
    ],
  );
  return res.rows[0]!.source_lineage_record_id;
}

export async function writeAuditValidation(
  q: DbConnector,
  args: {
    runId: string;
    sourceTableId: string;
    sourceRecordId: string | null;
    ruleCode: string;
    status: "PASSED" | "FAILED" | "WARNING" | "SKIPPED";
    message?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await q.query(
    `INSERT INTO audit.import_validation_results (
        import_validation_result_run_id,
        import_validation_result_source_table_id,
        import_validation_result_source_record_id,
        import_validation_result_rule_code,
        import_validation_result_status,
        import_validation_result_message,
        import_validation_result_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      args.runId,
      args.sourceTableId,
      args.sourceRecordId,
      args.ruleCode,
      args.status,
      args.message ?? null,
      JSON.stringify(args.payload ?? {}),
    ],
  );
}

export async function writeAuditApproval(
  q: DbConnector,
  args: {
    runId: string;
    tableMappingId: string | null;
    status: "APPROVED" | "REJECTED" | "NEEDS_CHANGES" | "ESCALATED";
    approverUserId: string | null;
    rationale: string;
  },
): Promise<void> {
  await q.query(
    `INSERT INTO audit.import_approval_decisions (
        import_approval_decision_run_id,
        import_approval_decision_table_mapping_id,
        import_approval_decision_approver_user_id,
        import_approval_decision_status,
        import_approval_decision_rationale
      ) VALUES ($1, $2, $3, $4, $5)`,
    [args.runId, args.tableMappingId, args.approverUserId, args.status, args.rationale],
  );
}

// -----------------------------------------------------------------------------
// Platform-wide tenant resolution
// -----------------------------------------------------------------------------

/**
 * For Wave 1 catalog imports we use the platform-wide HEURESYS_PLATFORM tenant
 * so the rows are visible to every actual tenant. If the tenant doesn't exist
 * yet, fall back to the first available tenant_id in sys.sys_tenancies.
 */
export async function resolvePlatformTenantId(q: DbConnector): Promise<string> {
  const res = await q.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM sys.sys_tenancies
      WHERE tenant_code = 'HEURESYS_PLATFORM' OR tenant_code = 'PLATFORM'
      ORDER BY created_at ASC LIMIT 1`,
  );
  if (res.rows[0]) return res.rows[0].tenant_id;
  const fallback = await q.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM sys.sys_tenancies ORDER BY created_at ASC LIMIT 1`,
  );
  if (fallback.rows[0]) return fallback.rows[0].tenant_id;
  throw new Error("No tenant rows in sys.sys_tenancies — cannot resolve a platform tenant for wave import lineage");
}
