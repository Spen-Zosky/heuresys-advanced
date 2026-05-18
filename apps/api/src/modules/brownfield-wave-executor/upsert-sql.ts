/**
 * apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts
 *
 * Goal 001a v5 criterion 11 — SQL-side UPSERT implementation for mechanical
 * column mappings. Replaces the JS-side per-row path (`buildTargetRow` +
 * `batchUpsertTarget` + `upsertTargetRow` chunk loop in engine.ts) for
 * mechanical mappings.
 *
 * Architecture: per-mapping single INSERT INTO sys.<target>, with SELECT
 * list built from `transform-compiler.compileTransform()` fragments + system
 * defaults (tenant_id, is_global, metadata, _name) + required-col fallbacks
 * + varchar truncation wrappers. WHERE clause excludes rows that would fail
 * UUID NK / required-UUID column constraints (preserving JS-side skip
 * semantics via SQL filter rather than JS-level skipRow flag).
 *
 * Statement count per mapping × run (mechanical path):
 *   - 1 INSERT INTO sys.<target> ... ON CONFLICT (...) DO UPDATE SET ...
 *     RETURNING <pk>, <nk_cols>
 *   - 1 INSERT INTO sys.sys_source_lineage_records (lineage write, JOIN-based)
 *   - 1 UPDATE staging.<wave1_table> (mark upserted, JOIN-based)
 * Total INSERT statements per mapping: 2 (target + lineage). Criterion 11
 * verifies ≤ 1 INSERT INTO sys.<target_table> per mapping — satisfied.
 *
 * For non-mechanical column mappings, the engine's hybrid v4 path remains:
 * SKIPPED_UNSUPPORTED_TRANSFORM_V1 audit emission per column_mapping_id.
 */
import format from "pg-format";
import type { Pool } from "pg";
import type { WaveExecutorMode } from "@heuresys/shared";
import {
  compileTransform,
  UnsupportedTransformError,
} from "./transform-compiler.js";
import type {
  ColumnMappingRow,
  TableMappingRow,
} from "./repository.js";

/**
 * Target metadata structure mirrors engine.ts::TargetMeta. Re-declared here to
 * keep upsert-sql.ts free of a back-import on engine.ts (which is the consumer).
 */
export interface TargetMeta {
  columns: Set<string>;
  columnTypes: Map<string, string>;
  columnMaxLengths: Map<string, number | null>;
  requiredColumns: Set<string>;
  uniqueIndexName: string | null;
  naturalKeyColumns: string[];
  conflictInference: string | null;
  pkColumn: string;
}

export interface ExecuteSqlSideArgs {
  runId: string;
  tenantId: string;
  mapping: TableMappingRow;
  /** Pre-filtered to mechanical-only column mappings (caller responsibility). */
  columnMappings: ColumnMappingRow[];
  targetMeta: TargetMeta;
  /**
   * Fully-qualified staging table name as returned by `repository.stagingTableFor()` —
   * e.g. "staging.wave1_skills". Caller must pass a trusted value from the
   * whitelist; this string is interpolated directly into SQL.
   */
  stagingTable: string;
  mode: WaveExecutorMode;
  cap: number | null;
}

export interface ExecuteSqlSideResult {
  upsertedRows: number;
  lineageRows: number;
  /** True if the mapping was skipped entirely (returned without writing). */
  skipped: boolean;
  skipReason?: string;
}

/**
 * PostgreSQL regex for UUID format validation. Note: PG strict UUID type
 * also rejects non-canonical formats at INSERT time; the WHERE filter here
 * pre-empts the row before it reaches INSERT.
 */
const UUID_REGEX_PG = "'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'";

interface ColEntry {
  targetCol: string;
  sql: string;
}

export async function executeUpsertSqlSidePerMapping(
  pool: Pool,
  args: ExecuteSqlSideArgs,
): Promise<ExecuteSqlSideResult> {
  const { runId, tenantId, mapping, columnMappings, targetMeta, stagingTable, mode, cap } = args;

  if (columnMappings.length === 0) {
    return {
      upsertedRows: 0,
      lineageRows: 0,
      skipped: true,
      skipReason: "no_mechanical_column_mappings",
    };
  }

  const short = mapping.target_table.replace(/^sys_/, "");
  const tenantCol = `${short}_tenant_id`;
  const globalCol = `${short}_is_global`;
  const metaCol = `${short}_metadata`;
  const nameCol = `${short}_name`;

  // NK fallback expression: COALESCE(staging_source_natural_key, 'OLDDB::' || ...)
  const nkFallbackExpr =
    `COALESCE(staging_source_natural_key, 'OLDDB::' || staging_source_table || '::' || staging_source_record_id)`;

  const colEntries: ColEntry[] = [];

  // 1. Compiled fragments from mechanical column_mappings
  for (const cm of columnMappings) {
    if (!targetMeta.columns.has(cm.target_column)) continue;
    let compiled;
    try {
      const srcExpr = format("(staging_raw_record->>%L)", cm.source_column_name);
      compiled = compileTransform({
        transformCode: cm.transform,
        payload: cm.transform_payload ?? {},
        srcExpr,
        targetColumn: cm.target_column,
        mappingId: cm.column_mapping_id,
      });
    } catch (e) {
      if (e instanceof UnsupportedTransformError) {
        // Caller should have filtered these; defensively skip.
        continue;
      }
      throw e;
    }

    if (compiled.fragment === null) continue; // SKIP transform

    // Apply varchar truncation wrapper
    let frag = compiled.fragment.sql;
    const colType = targetMeta.columnTypes.get(cm.target_column);
    const maxLen = targetMeta.columnMaxLengths.get(cm.target_column);
    if (
      (colType === "varchar" || colType === "bpchar") &&
      typeof maxLen === "number" &&
      maxLen > 0
    ) {
      frag = `LEFT(${frag}, ${maxLen})`;
    }

    // Avoid duplicate columns (if same target col has multiple cms, keep first)
    if (!colEntries.some((e) => e.targetCol === cm.target_column)) {
      colEntries.push({ targetCol: cm.target_column, sql: frag });
    }
  }

  // 2. NK col fallback for missing non-UUID NK cols
  for (const nkCol of targetMeta.naturalKeyColumns) {
    if (colEntries.some((e) => e.targetCol === nkCol)) continue;
    if (!targetMeta.columns.has(nkCol)) continue;
    const colType = targetMeta.columnTypes.get(nkCol);
    if (colType === "uuid") {
      if (nkCol.endsWith("_tenant_id")) {
        colEntries.push({ targetCol: nkCol, sql: "NULL::uuid" });
      }
      // else: UUID NK without compiled fragment → all rows will be WHERE-filtered out
    } else {
      const maxLen = targetMeta.columnMaxLengths.get(nkCol) ?? 128;
      colEntries.push({
        targetCol: nkCol,
        sql: `LEFT(${nkFallbackExpr}, ${maxLen})`,
      });
    }
  }

  // 3. System column defaults (tenant_id, is_global, metadata, _name)
  if (targetMeta.columns.has(tenantCol) && !colEntries.some((e) => e.targetCol === tenantCol)) {
    colEntries.push({ targetCol: tenantCol, sql: "NULL::uuid" });
  }
  if (targetMeta.columns.has(globalCol) && !colEntries.some((e) => e.targetCol === globalCol)) {
    colEntries.push({ targetCol: globalCol, sql: "TRUE" });
  }
  if (targetMeta.columns.has(metaCol) && !colEntries.some((e) => e.targetCol === metaCol)) {
    colEntries.push({ targetCol: metaCol, sql: "'{}'::jsonb" });
  }
  if (targetMeta.columns.has(nameCol) && !colEntries.some((e) => e.targetCol === nameCol)) {
    const nameMaxLen = targetMeta.columnMaxLengths.get(nameCol) ?? 255;
    colEntries.push({
      targetCol: nameCol,
      sql: `LEFT(${nkFallbackExpr}, ${nameMaxLen})`,
    });
  }

  // 4. Required-col defaults for non-NK, non-system, non-UUID, missing required cols
  for (const reqCol of targetMeta.requiredColumns) {
    if (colEntries.some((e) => e.targetCol === reqCol)) continue;
    if (
      reqCol === targetMeta.pkColumn ||
      reqCol === tenantCol ||
      reqCol === globalCol ||
      reqCol === metaCol ||
      reqCol === nameCol
    )
      continue;
    if (targetMeta.naturalKeyColumns.includes(reqCol)) continue;
    const colType = targetMeta.columnTypes.get(reqCol);
    if (colType === "uuid") continue; // skip filter handles
    const colMax = targetMeta.columnMaxLengths.get(reqCol) ?? 128;
    if (colType === "varchar" || colType === "text" || colType === "bpchar") {
      colEntries.push({
        targetCol: reqCol,
        sql: `LEFT(${nkFallbackExpr}, ${colMax})`,
      });
    } else if (colType === "int2" || colType === "int4" || colType === "int8") {
      colEntries.push({ targetCol: reqCol, sql: "0" });
    } else if (colType === "bool") {
      colEntries.push({ targetCol: reqCol, sql: "FALSE" });
    } else if (colType === "numeric") {
      colEntries.push({ targetCol: reqCol, sql: "0" });
    } else if (colType === "jsonb" || colType === "json") {
      colEntries.push({ targetCol: reqCol, sql: "'{}'::jsonb" });
    }
    // timestamptz/timestamp/date: leave to PG default if any
  }

  if (colEntries.length === 0) {
    return {
      upsertedRows: 0,
      lineageRows: 0,
      skipped: true,
      skipReason: "no_target_columns_after_compilation",
    };
  }

  // 5. WHERE skip filter
  const skipFilters: string[] = [];
  for (const nkCol of targetMeta.naturalKeyColumns) {
    const colType = targetMeta.columnTypes.get(nkCol);
    if (colType !== "uuid") continue;
    if (nkCol.endsWith("_tenant_id")) continue; // _tenant_id NK is allowed NULL
    const entry = colEntries.find((e) => e.targetCol === nkCol);
    if (!entry) {
      skipFilters.push("FALSE");
      continue;
    }
    skipFilters.push(`(${entry.sql}) IS NOT NULL`);
    skipFilters.push(`(${entry.sql})::text ~* ${UUID_REGEX_PG}`);
  }
  for (const reqCol of targetMeta.requiredColumns) {
    if (
      reqCol === targetMeta.pkColumn ||
      reqCol === tenantCol ||
      reqCol === globalCol ||
      reqCol === metaCol ||
      reqCol === nameCol
    )
      continue;
    if (targetMeta.naturalKeyColumns.includes(reqCol)) continue;
    const colType = targetMeta.columnTypes.get(reqCol);
    if (colType !== "uuid") continue;
    const entry = colEntries.find((e) => e.targetCol === reqCol);
    if (!entry) {
      skipFilters.push("FALSE");
      continue;
    }
    skipFilters.push(`(${entry.sql}) IS NOT NULL`);
  }

  const baseWhere = [
    `staging_import_run_id = $1`,
    `staging_source_table = $2`,
    `staging_validation_status = 'PASSED'`,
    `staging_target_record_id IS NULL`,
    ...skipFilters,
  ];
  const limitClause = cap !== null ? `LIMIT ${cap}` : "";

  const conflictInference = targetMeta.conflictInference;
  if (!conflictInference) {
    return {
      upsertedRows: 0,
      lineageRows: 0,
      skipped: true,
      skipReason: "no_conflict_inference_available",
    };
  }

  const setClauses = colEntries
    .filter(
      (e) =>
        !targetMeta.naturalKeyColumns.includes(e.targetCol) &&
        e.targetCol !== targetMeta.pkColumn &&
        e.targetCol !== "updated_at" &&
        e.targetCol !== "created_at",
    )
    .map((e) => `${format("%I", e.targetCol)} = EXCLUDED.${format("%I", e.targetCol)}`);
  if (targetMeta.columns.has("updated_at")) {
    setClauses.push("updated_at = now()");
  }

  // SQL identifier helpers
  const qTargetTable = format("sys.%I", mapping.target_table);
  // stagingTable is already fully-qualified ("staging.wave1_<x>") from
  // repository.stagingTableFor() whitelist. Used directly without re-quoting
  // to match the pattern used elsewhere in engine.ts.
  const qStagingTable = stagingTable;
  const qPkCol = format("%I", targetMeta.pkColumn);
  const colsList = colEntries.map((e) => format("%I", e.targetCol)).join(", ");
  const selectList = colEntries.map((e) => e.sql).join(", ");
  const setClause =
    setClauses.length > 0
      ? `DO UPDATE SET ${setClauses.join(", ")}`
      : `DO NOTHING`;

  if (mode === "DRY_RUN") {
    const countSql = `
      SELECT count(*)::text AS n
        FROM ${qStagingTable}
       WHERE ${baseWhere.join(" AND ")}
       ${limitClause}
    `;
    const countRes = await pool.query<{ n: string }>(countSql, [
      runId,
      mapping.source_table_name,
    ]);
    return { upsertedRows: Number(countRes.rows[0]!.n), lineageRows: 0, skipped: false };
  }

  // 6. INSERT INTO sys.<target> ... SELECT ... ON CONFLICT ... RETURNING <pk>
  const insertSql = `
    INSERT INTO ${qTargetTable} (${colsList})
    SELECT ${selectList}
      FROM ${qStagingTable}
     WHERE ${baseWhere.join(" AND ")}
     ORDER BY staging_row_id
     ${limitClause}
    ON CONFLICT (${conflictInference}) ${setClause}
    RETURNING ${qPkCol}
  `;

  let upsertedCount = 0;
  try {
    const insertRes = await pool.query<Record<string, unknown>>(insertSql, [
      runId,
      mapping.source_table_name,
    ]);
    upsertedCount = insertRes.rowCount ?? 0;
  } catch (e) {
    const msg = (e as Error).message;
    return {
      upsertedRows: 0,
      lineageRows: 0,
      skipped: true,
      skipReason: `insert_failed: ${msg.substring(0, 240)}`,
    };
  }

  if (upsertedCount === 0) {
    return { upsertedRows: 0, lineageRows: 0, skipped: false };
  }

  // 7. NK match pairs for JOIN-back. Use the same compiled fragments aliased
  // via a CTE so the JOIN is clean.
  const nkMatchPairs: string[] = [];
  for (const nkCol of targetMeta.naturalKeyColumns) {
    if (!targetMeta.columns.has(nkCol)) continue;
    const entry = colEntries.find((e) => e.targetCol === nkCol);
    if (!entry) continue;
    nkMatchPairs.push(
      `(t.${format("%I", nkCol)} IS NOT DISTINCT FROM s.${format("%I", `__nk_${nkCol}`)})`,
    );
  }

  if (nkMatchPairs.length === 0) {
    // Cannot tie back; report upsert but no lineage
    return { upsertedRows: upsertedCount, lineageRows: 0, skipped: false };
  }

  // Build src CTE with NK fragments aliased
  const nkAliasSelects = targetMeta.naturalKeyColumns
    .filter((nkCol) => colEntries.some((e) => e.targetCol === nkCol))
    .map((nkCol) => {
      const entry = colEntries.find((e) => e.targetCol === nkCol)!;
      return `${entry.sql} AS ${format("%I", `__nk_${nkCol}`)}`;
    })
    .join(", ");

  // 8. Lineage write: 1 INSERT via JOIN
  const lineageSql = `
    WITH src AS (
      SELECT staging_row_id,
             staging_source_table,
             staging_source_record_id,
             staging_source_natural_key,
             staging_source_content_hash,
             staging_mapping_confidence,
             ${nkAliasSelects}
        FROM ${qStagingTable}
       WHERE ${baseWhere.join(" AND ")}
       ${limitClause}
    )
    INSERT INTO sys.sys_source_lineage_records (
        source_lineage_tenant_id,
        source_lineage_source_system,
        source_lineage_source_table,
        source_lineage_source_record_id,
        source_lineage_source_natural_key,
        source_lineage_source_content_hash,
        source_lineage_import_run_id,
        source_lineage_table_mapping_id,
        source_lineage_target_table_name,
        source_lineage_target_record_id,
        source_lineage_mapping_confidence,
        source_lineage_validation_status
      )
    SELECT
      $3::uuid,
      'heuresys_platform',
      s.staging_source_table,
      s.staging_source_record_id,
      s.staging_source_natural_key,
      s.staging_source_content_hash,
      $1::uuid,
      $4::uuid,
      $5::text,
      t.${qPkCol},
      s.staging_mapping_confidence::numeric,
      'VALID'
    FROM src s
    JOIN ${qTargetTable} t ON (${nkMatchPairs.join(" AND ")})
    ON CONFLICT (
        source_lineage_source_system,
        source_lineage_source_table,
        source_lineage_source_record_id,
        source_lineage_target_table_name
      )
      DO UPDATE SET
        source_lineage_source_content_hash = EXCLUDED.source_lineage_source_content_hash,
        source_lineage_mapping_confidence = EXCLUDED.source_lineage_mapping_confidence,
        source_lineage_target_record_id = EXCLUDED.source_lineage_target_record_id,
        source_lineage_import_run_id = EXCLUDED.source_lineage_import_run_id,
        source_lineage_table_mapping_id = EXCLUDED.source_lineage_table_mapping_id,
        source_lineage_validation_status = 'VALID'
  `;

  let lineageCount = 0;
  try {
    const lineageRes = await pool.query(lineageSql, [
      runId,
      mapping.source_table_name,
      tenantId,
      mapping.table_mapping_id,
      mapping.target_table,
    ]);
    lineageCount = lineageRes.rowCount ?? 0;
  } catch (e) {
    // Log + continue — lineage failure shouldn't poison the run
    console.error(
      `[sql-side-upsert] lineage write failed for mapping ${mapping.table_mapping_id}: ${(e as Error).message}`,
    );
  }

  // 9. Staging mark via UPDATE + JOIN
  const stagingMarkSql = `
    WITH src AS (
      SELECT staging_row_id,
             ${nkAliasSelects}
        FROM ${qStagingTable}
       WHERE ${baseWhere.join(" AND ")}
       ${limitClause}
    )
    UPDATE ${qStagingTable} sw
       SET staging_target_record_id = t.${qPkCol},
           staging_upserted_at = now()
      FROM src s
      JOIN ${qTargetTable} t ON (${nkMatchPairs.join(" AND ")})
     WHERE sw.staging_row_id = s.staging_row_id
  `;

  try {
    await pool.query(stagingMarkSql, [runId, mapping.source_table_name]);
  } catch (e) {
    console.error(
      `[sql-side-upsert] staging mark failed for mapping ${mapping.table_mapping_id}: ${(e as Error).message}`,
    );
  }

  return { upsertedRows: upsertedCount, lineageRows: lineageCount, skipped: false };
}
