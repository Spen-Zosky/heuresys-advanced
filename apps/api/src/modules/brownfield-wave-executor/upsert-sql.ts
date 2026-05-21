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
 * Goal 002 Item E + Goal 003 Item K: type-coerce auto-wrap for DIRECT_COPY/TRIM
 * into non-text targets. PG implicit text→numeric/date coercion works for
 * well-formed values but raises on malformed (caught by upsert try/catch
 * → audit `insert_failed:`). UUID intentionally excluded — UUID NK rows are
 * pre-filtered by the WHERE skip filter in buildUpsertSql.
 *
 * Goal 003 Item K extensions (interval, time, timetz, bytea) complete the
 * PG basic-type whitelist per Goal 002 REPORT §6 item 5 follow-up.
 */
const TYPE_CAST_MAP: Record<string, string> = {
  int2: "SMALLINT",
  int4: "INTEGER",
  int8: "BIGINT",
  numeric: "NUMERIC",
  bool: "BOOLEAN",
  date: "DATE",
  timestamptz: "TIMESTAMPTZ",
  timestamp: "TIMESTAMP",
  jsonb: "JSONB",
  json: "JSON",
  interval: "INTERVAL",
  time: "TIME",
  timetz: "TIMETZ",
  bytea: "BYTEA",
};

/**
 * Goal 003 Item B: CAST_* transforms whose inner cast target is compatible
 * with a wider set of PG basic types. The compiler emits an inner CAST to
 * the default type for each code (e.g., CAST_INT → INTEGER); when the actual
 * target column type differs, applyTypeCoerceWrap adds an outer CAST so the
 * value lands in target-type directly without relying on implicit coercion
 * (which can fail at INSERT time for narrow target types like smallint).
 *
 * Map: transform code → set of target colType values for which an outer
 * CAST to TYPE_CAST_MAP[colType] should be emitted. Outside this set, the
 * compiler-emitted inner cast is left untouched (passthrough behavior).
 */
const CAST_COMPATIBLE_TARGETS: Record<string, ReadonlySet<string>> = {
  CAST_INT:         new Set(["int2", "int4", "int8"]),
  CAST_NUMERIC:     new Set(["numeric"]),
  CAST_BOOLEAN:     new Set(["bool"]),
  CAST_TIMESTAMPTZ: new Set(["timestamptz", "timestamp"]),
  CAST_VARCHAR:     new Set([]),  // varchar handled by truncation wrapper, not here
};

/**
 * Wraps `frag` with `CAST(... AS <pgType>)` when:
 *   - transform is passthrough (null, DIRECT_COPY, TRIM) AND colType is in TYPE_CAST_MAP; OR
 *   - transform is CAST_* AND colType is in CAST_COMPATIBLE_TARGETS[transform]
 *     (Goal 003 Item B: re-cast compiler-emitted inner cast into target type
 *      so e.g. CAST_INT + smallint target → CAST(CAST(... AS INTEGER) AS SMALLINT)
 *      instead of relying on implicit int→smallint coercion at INSERT time).
 *
 * Otherwise returns frag unchanged.
 *
 * Exported for unit testing.
 */
export function applyTypeCoerceWrap(
  frag: string,
  colType: string | undefined,
  transform: string | null,
): string {
  if (!colType) return frag;
  const pgType = TYPE_CAST_MAP[colType];
  if (!pgType) return frag;

  // Path 1: passthrough transforms (Goal 002 Item E behavior, preserved)
  const isPassthrough =
    transform === null || transform === "DIRECT_COPY" || transform === "TRIM";
  if (isPassthrough) {
    return `CAST(${frag} AS ${pgType})`;
  }

  // Path 2: CAST_* transforms with compatible target type (Goal 003 Item B)
  if (transform && CAST_COMPATIBLE_TARGETS[transform]?.has(colType)) {
    return `CAST(${frag} AS ${pgType})`;
  }

  return frag;
}

/**
 * Target metadata structure mirrors engine.ts::TargetMeta. Re-declared here to
 * keep upsert-sql.ts free of a back-import on engine.ts (which is the consumer).
 */
export interface TargetMeta {
  columns: Set<string>;
  columnTypes: Map<string, string>;
  columnMaxLengths: Map<string, number | null>;
  /** CW-B34: DB-level is_nullable map. WHERE skip filter consults this to allow NULL for legitimately nullable NK UUID cols (ADR-0015/0016 pattern). */
  columnNullable: Map<string, boolean>;
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

/**
 * CW-B22 — emits an index-aligned JOIN predicate for a single NK column.
 *
 * `IS NOT DISTINCT FROM` is not supported by btree operator classes, so the
 * planner falls back to nested-loop seqscan even when a UQ index covers the
 * NK columns (observed 17min stall on sys_activity_classifications staging
 * mark, REPORT X1 §5 CW-B22).
 *
 * The WHERE skip filter in this module (§5, lines 384-416) already excludes
 * rows where a non-tenant NK column would be NULL, so for those columns we
 * can safely use plain `=` and gain index scan.
 *
 * The only NK column that legitimately tolerates NULL is `<short>_tenant_id`
 * (line 312-313 explicitly assigns NULL::uuid for global rows, and line 389
 * of the skip filter exempts `_tenant_id` NK cols from the NOT NULL check).
 * For these we emit COALESCE(both sides, sentinel) which matches the indexed
 * expression used in sys_*_tenant_code_uq indexes (verified consistent across
 * 7 migrations: '00000000-0000-0000-0000-000000000000'::uuid project-wide).
 */
const TENANT_NULL_SENTINEL_UUID =
  "'00000000-0000-0000-0000-000000000000'::uuid";

export function buildNkJoinPredicate(
  nkCol: string,
  nkAliasCol: string,
  colType: string | undefined,
  isNullable: boolean,
): string {
  const tCol = format("t.%I", nkCol);
  const sCol = format("s.%I", nkAliasCol);
  // CW-B22 (tenant_id) + CW-B34 (generic nullable NK UUID): both lean on COALESCE
  // with a sentinel to make NULL = NULL match in the JOIN-back. Without this,
  // plain `t.col = s.__nk_col` returns FALSE for NULL on either side, and the
  // lineage JOIN produces 0 rows for ADR-0015/0016 nullable-FK target tables
  // even when the INSERT successfully wrote them.
  if (colType === "uuid" && (nkCol.endsWith("_tenant_id") || isNullable)) {
    return `(COALESCE(${tCol}, ${TENANT_NULL_SENTINEL_UUID}) = COALESCE(${sCol}, ${TENANT_NULL_SENTINEL_UUID}))`;
  }
  return `(${tCol} = ${sCol})`;
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

  // 1. Compiled fragments from mechanical column_mappings.
  // JSON_EXTRACT cms are handled separately below (Goal 002 Item D aggregation).
  for (const cm of columnMappings) {
    if (cm.transform === "JSON_EXTRACT") continue; // handled by JE aggregation step
    if (!targetMeta.columns.has(cm.target_column)) continue;
    let compiled;
    try {
      // CW-B22-α (batch X2 Block B R-01 mitigation): synthetic source_column
      // aliases (e.g. 'esco_occupation_code__fk_family_alias') must read from
      // the real underlying column in staging_raw_record. The cascade-fix
      // authoring pattern (cowork_reserved/batch_c2/cascade_fixes/) stores
      // the real column name in transform_payload.aliased_from when present.
      const aliasedFrom = (cm.transform_payload as Record<string, unknown> | null)?.[
        "aliased_from"
      ];
      const effectiveSourceCol =
        typeof aliasedFrom === "string" ? aliasedFrom : cm.source_column_name;
      const srcExpr = format("(staging_raw_record->>%L)", effectiveSourceCol);
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

    // Apply varchar truncation wrapper or type-coerce auto-wrap
    let frag = compiled.fragment.sql;
    const colType = targetMeta.columnTypes.get(cm.target_column);
    const maxLen = targetMeta.columnMaxLengths.get(cm.target_column);
    if (
      (colType === "varchar" || colType === "bpchar") &&
      typeof maxLen === "number" &&
      maxLen > 0
    ) {
      frag = `LEFT(${frag}, ${maxLen})`;
    } else {
      frag = applyTypeCoerceWrap(frag, colType, cm.transform);
    }

    // Avoid duplicate columns (if same target col has multiple cms, keep first)
    if (!colEntries.some((e) => e.targetCol === cm.target_column)) {
      colEntries.push({ targetCol: cm.target_column, sql: frag });
    }
  }

  // 1b. Goal 002 Item D: JSON_EXTRACT aggregation per target_column.
  // GROUP all JSON_EXTRACT cms by target_column; emit one jsonb_build_object
  // SELECT entry per (target_column) group with keys derived from
  // lastSegment(payload.path) after stripping `$.legacy.` (or `$.`).
  // Mixed-transform guard: skip group if target_column already has an entry
  // from the mechanical loop above. Type guard: skip group if target is not jsonb.
  const jsonExtractGroups = new Map<string, ColumnMappingRow[]>();
  for (const cm of columnMappings) {
    if (cm.transform !== "JSON_EXTRACT") continue;
    if (!targetMeta.columns.has(cm.target_column)) continue;
    if (!jsonExtractGroups.has(cm.target_column)) {
      jsonExtractGroups.set(cm.target_column, []);
    }
    jsonExtractGroups.get(cm.target_column)!.push(cm);
  }

  function jsonExtractKey(path: string): string {
    const stripped = path.replace(/^\$\.legacy\./, "").replace(/^\$\./, "");
    const segs = stripped.split(".").filter((s) => s.length > 0);
    return segs[segs.length - 1] ?? stripped;
  }

  for (const [targetCol, cms] of jsonExtractGroups) {
    if (targetMeta.columnTypes.get(targetCol) !== "jsonb") {
      // §2.5.3 type guard: JE into non-jsonb target → skip silently
      // (engine-side validation would catch this earlier in well-formed registries)
      continue;
    }
    if (colEntries.some((e) => e.targetCol === targetCol)) {
      // §2.5.3 mixed-transform guard: a non-JE mapping already populates this
      // target_column → ambiguous semantics → skip JE group, keep mechanical entry
      continue;
    }
    const pairs: string[] = [];
    for (const cm of cms) {
      const path = (cm.transform_payload as Record<string, unknown> | null)?.["path"];
      if (typeof path !== "string") continue;
      const key = jsonExtractKey(path);
      let compiled;
      try {
        compiled = compileTransform({
          transformCode: "JSON_EXTRACT",
          payload: cm.transform_payload ?? {},
          srcExpr: "staging_raw_record", // raw jsonb root, NOT ->>%L
          targetColumn: cm.target_column,
          mappingId: cm.column_mapping_id,
        });
      } catch {
        continue; // malformed payload, skip this cm
      }
      if (compiled.fragment === null) continue;
      pairs.push(`${format("%L", key)}, ${compiled.fragment.sql}`);
    }
    if (pairs.length === 0) continue;
    colEntries.push({
      targetCol,
      sql: `jsonb_build_object(${pairs.join(", ")})`,
    });
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

  // 5. WHERE skip filter (CW-B34: respect columnNullable for UUID NK cols).
  //
  // ADR-0015/0016 introduced legitimately nullable NK UUID columns
  // (sys_job_roles.job_role_family_id, sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id).
  // Pre-patch, the filter excluded any staging row whose NK UUID col would be
  // NULL pre-INSERT (REPORT X5.A §2.B.6: 7645/7645 ESCO rows excluded as
  // `nk_missing_esco_occupation_mapping_job_role_id`). The fix: when the DB
  // column is nullable, skip the `IS NOT NULL` + UUID regex check AND inject
  // an explicit `NULL::uuid` in colEntries when no column_mapping is present
  // (so DISTINCT ON / ON CONFLICT inference can still reference the column).
  // Naming-convention escape `endsWith('_tenant_id')` retained for backward
  // compat — it's a CW-B22 sentinel-coalesce pattern that's orthogonal to
  // DB nullability and stays in place to avoid behavior drift on tenant cols.
  // Required-cols loop below is unchanged: by definition requiredColumns is
  // built from `is_nullable === 'NO'` (engine.ts:88-93), so columnNullable is
  // always false there — no branch needed.
  const skipFilters: string[] = [];
  for (const nkCol of targetMeta.naturalKeyColumns) {
    const colType = targetMeta.columnTypes.get(nkCol);
    if (colType !== "uuid") continue;
    if (nkCol.endsWith("_tenant_id")) continue; // _tenant_id NK is allowed NULL (CW-B22)
    const isNullable = targetMeta.columnNullable.get(nkCol) === true;
    const entry = colEntries.find((e) => e.targetCol === nkCol);
    if (!entry) {
      if (isNullable) {
        // CW-B34: inject explicit NULL so INSERT colsList/selectList stay aligned
        // and conflict inference / DISTINCT ON have the column to reference.
        colEntries.push({ targetCol: nkCol, sql: "NULL::uuid" });
        continue;
      }
      skipFilters.push("FALSE");
      continue;
    }
    if (isNullable) {
      // CW-B34: nullable NK UUID col with compiled fragment — NULL is acceptable,
      // skip presence/regex check (PG UQ tolerates NULL ≠ NULL semantics).
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

  // CW-B17 patch — emit audit for WHERE-skipped rows BEFORE main INSERT.
  // Identifies staging rows that satisfy validation_status='PASSED' but FAIL skipFilters.
  // Closes the silent-skip forensic blind spot (Goal 003 W1 retry: 24552/41285 = 59% lost).
  if (mode === "EXECUTE" && skipFilters.length > 0) {
    // Identify exclusion reason per row: NK uuid issue OR required uuid NULL.
    const skipReasonCases: string[] = [];
    for (const nkCol of targetMeta.naturalKeyColumns) {
      const colType = targetMeta.columnTypes.get(nkCol);
      if (colType !== "uuid") continue;
      if (nkCol.endsWith("_tenant_id")) continue;
      const entry = colEntries.find((e) => e.targetCol === nkCol);
      if (!entry) {
        skipReasonCases.push(`WHEN TRUE THEN ${format("%L", "nk_missing_" + nkCol)}`);
        continue;
      }
      skipReasonCases.push(
        `WHEN (${entry.sql}) IS NULL THEN ${format("%L", "nk_null_" + nkCol)}`,
        `WHEN NOT ((${entry.sql})::text ~* ${UUID_REGEX_PG}) THEN ${format("%L", "nk_invalid_uuid_" + nkCol)}`,
      );
    }
    for (const reqCol of targetMeta.requiredColumns) {
      const colType = targetMeta.columnTypes.get(reqCol);
      if (colType !== "uuid") continue;
      if (
        reqCol === targetMeta.pkColumn ||
        reqCol === tenantCol ||
        reqCol === globalCol ||
        reqCol === metaCol ||
        reqCol === nameCol
      )
        continue;
      if (targetMeta.naturalKeyColumns.includes(reqCol)) continue;
      const entry = colEntries.find((e) => e.targetCol === reqCol);
      if (!entry) {
        skipReasonCases.push(`WHEN TRUE THEN ${format("%L", "required_missing_" + reqCol)}`);
        continue;
      }
      skipReasonCases.push(
        `WHEN (${entry.sql}) IS NULL THEN ${format("%L", "required_null_" + reqCol)}`,
      );
    }

    if (skipReasonCases.length > 0) {
      const auditSkipSql = `
        INSERT INTO audit.import_validation_results (
          import_validation_result_run_id,
          import_validation_result_source_table_id,
          import_validation_result_source_record_id,
          import_validation_result_rule_code,
          import_validation_result_status,
          import_validation_result_message,
          import_validation_result_payload
        )
        SELECT
          $1::uuid,
          $3::uuid,
          staging_source_record_id,
          'WHERE_SKIP_FILTER_EXCLUDED_V1',
          'SKIPPED',
          'Staging row validation_status=PASSED but excluded by WHERE skip filter (NK uuid NULL/invalid or required uuid NULL)',
          jsonb_build_object(
            'target_table', $4::text,
            'table_mapping_id', $5::uuid,
            'exclusion_reason', CASE ${skipReasonCases.join(" ")} ELSE 'unknown' END,
            'staging_row_id', staging_row_id
          )
        FROM ${qStagingTable}
        WHERE staging_import_run_id = $1
          AND staging_source_table = $2
          AND staging_validation_status = 'PASSED'
          AND staging_target_record_id IS NULL
          AND NOT (${skipFilters.join(" AND ")})
      `;
      try {
        await pool.query(auditSkipSql, [
          runId,
          mapping.source_table_name,
          mapping.source_table_id,
          mapping.target_table,
          mapping.table_mapping_id,
        ]);
      } catch (e) {
        console.error(
          `[sql-side-upsert] CW-B17 audit emission failed for mapping ${mapping.table_mapping_id}: ${(e as Error).message}`,
        );
        // Continue — audit emission failure should NOT block import
      }
    }
  }

  // 6. INSERT INTO sys.<target> ... SELECT ... ON CONFLICT ... RETURNING <pk>
  // CW-B31 dedup (sym pattern CW-B24 lineage write X2): pre-filter duplicate
  // conflict-key rows BEFORE main INSERT. When source has rows sharing the
  // target UQ key (e.g. job_templates 140 rows with PROTO-X-Y job_code
  // duplicates × 4 cross-tenant), PG raises "ON CONFLICT DO UPDATE command
  // cannot affect row a second time" → engine try/catch absorbs → 0 upserted.
  //
  // Key technicality: `conflictInference` lists target column names (e.g.
  // "job_role_code" or "scheme, code"). The staging table does NOT have those
  // columns — the conflict key value is produced by colEntries[i].sql
  // expressions (e.g. `TRIM(staging_raw_record->>'job_code')`). So DISTINCT ON
  // must operate on the EXPRESSIONS that produce the target conflict columns,
  // not on the target column names themselves.
  const conflictKeyCols = conflictInference.split(",").map((s) => s.trim());
  const conflictKeyExprs = conflictKeyCols
    .map((ck) => {
      const entry = colEntries.find((e) => e.targetCol === ck);
      return entry ? entry.sql : ck;
    })
    .join(", ");
  const insertSql = `
    WITH staging_filtered AS (
      SELECT *
        FROM ${qStagingTable}
       WHERE ${baseWhere.join(" AND ")}
       ${limitClause}
    ),
    staging_deduped AS (
      SELECT DISTINCT ON (${conflictKeyExprs}) *
        FROM staging_filtered
       ORDER BY ${conflictKeyExprs},
                staging_mapping_confidence DESC NULLS LAST,
                staging_row_id ASC
    )
    INSERT INTO ${qTargetTable} (${colsList})
    SELECT ${selectList}
      FROM staging_deduped
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
    // CW-B22 + CW-B34 — use buildNkJoinPredicate for btree-friendly equality.
    // For _tenant_id NK col emit COALESCE(both sides, sentinel) matching the
    // UQ index expression. For other UUID NK cols that are DB-nullable
    // (ADR-0015/0016), apply the same COALESCE pattern so NULL=NULL matches
    // in the JOIN-back (otherwise lineage_rows=0 even when INSERT succeeds).
    // For non-nullable NK cols, plain `=` (rows with NULL NK are pre-filtered
    // by WHERE skip filter §5).
    const colType = targetMeta.columnTypes.get(nkCol);
    const isNullable = targetMeta.columnNullable.get(nkCol) === true;
    nkMatchPairs.push(buildNkJoinPredicate(nkCol, `__nk_${nkCol}`, colType, isNullable));
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

  // 8. Lineage write: 1 INSERT via JOIN.
  // CW-B24 — DISTINCT ON the UQ tuple (source_record_id is the only
  // varying component; source_system/source_table/target_table_name are
  // all constants in this statement). Guards against:
  //  (a) Compound-PK source tables where pkColumns[0] alone may collide
  //      across multiple legacy rows (engine.ts:182-183 uses only the
  //      first PK column).
  //  (b) JOIN expansion when an NK column is NULL on src and target has
  //      multiple matching rows (the varchar/text NK case escapes the
  //      WHERE skip filter at lines 384-416, which only filters uuid NK).
  // ORDER BY staging_mapping_confidence DESC, staging_row_id picks the
  // most-confident match deterministically; ties broken by stable
  // staging_row_id ordering.
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
    ),
    joined AS (
      SELECT
        s.staging_row_id,
        s.staging_source_table,
        s.staging_source_record_id,
        s.staging_source_natural_key,
        s.staging_source_content_hash,
        s.staging_mapping_confidence,
        t.${qPkCol} AS target_pk
      FROM src s
      JOIN ${qTargetTable} t ON (${nkMatchPairs.join(" AND ")})
    ),
    deduped AS (
      SELECT DISTINCT ON (staging_source_record_id)
        staging_source_table,
        staging_source_record_id,
        staging_source_natural_key,
        staging_source_content_hash,
        staging_mapping_confidence,
        target_pk
      FROM joined
      ORDER BY staging_source_record_id,
               staging_mapping_confidence DESC,
               staging_row_id ASC
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
      staging_source_table,
      staging_source_record_id,
      staging_source_natural_key,
      staging_source_content_hash,
      $1::uuid,
      $4::uuid,
      $5::text,
      target_pk,
      staging_mapping_confidence::numeric,
      'VALID'
    FROM deduped
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
