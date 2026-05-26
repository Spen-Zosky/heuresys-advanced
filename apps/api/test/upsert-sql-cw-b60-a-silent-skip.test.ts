/**
 * apps/api/test/upsert-sql-cw-b60-a-silent-skip.test.ts
 *
 * CW-B60-A (S934, 2026-05-26) — Observability fix for the forensic engine
 * silent-filter detected by C19.1 X19 accept-as-residual (3 Wave-1 targets
 * AUTO_APPROVED + 0 upserted with NO log emission and NO audit row).
 *
 * Root cause: `executeUpsertSqlSidePerMapping` exits early at
 * `if (upsertedCount === 0) return { skipped:false, ... }` when the main
 * INSERT returns rowCount=0 (most plausible trigger: setClauses.length===0 →
 * ON CONFLICT DO NOTHING + duplicates). Pre-fix, this path produced:
 *   - no logger.error (skipped:false short-circuits engine.ts:839 branch)
 *   - no audit row (CW-B17 audit only covers skipFilter-excluded rows)
 *
 * Affected targets observed in run 6f561559 (run-id, see PREFLIGHT_REPORT §5):
 *   sys_skill_categories                  UQ=(skill_category_code)              — varchar NK only
 *   sys_activity_classification_mappings  UQ=(source_id, target_id)             — 2 uuid NK, both required FK
 *   sys_process_kpi_templates             UQ=(process_id, kpi_id)               — 2 uuid NK, both required FK
 *
 * All 3 lack `_tenant_id` NK (the COALESCE-sentinel pattern CW-B49 handles).
 * Their column_mappings frequently cover only the NK cols, leaving
 * setClauses empty → DO NOTHING → silent rowCount=0 on duplicate inputs.
 *
 * Fix contract verified here:
 *   1. When INSERT returns rowCount=0, emit one audit row with
 *      rule_code='SILENT_UPSERT_ZERO_ROWS_V1', status='SKIPPED' to
 *      audit.import_validation_results.
 *   2. Result shape unchanged: { upsertedRows:0, lineageRows:0, skipped:false }
 *      (back-compat: callers that branch on `skipped` must still see false).
 *   3. Happy path (rowCount>0) must NOT emit the silent audit (no false alarms).
 *
 * Spec authority: cowork_reserved/bias_registry.md CW-B61 (to be written
 * post-fix as the bias entry documenting this observability gap).
 */
import { describe, it, expect } from "vitest";
import type { Pool } from "pg";
import {
  executeUpsertSqlSidePerMapping,
  type TargetMeta,
} from "../src/modules/brownfield-wave-executor/upsert-sql.js";
import type {
  ColumnMappingRow,
  TableMappingRow,
} from "../src/modules/brownfield-wave-executor/repository.js";

const RUN_ID = "00000000-0000-0000-0000-00000000ru01";
const TENANT_ID = "00000000-0000-0000-0000-00000000tn01";

/**
 * sys_skill_categories targetMeta from db/migrations/000013_skill_taxonomy_model.sql §2.
 * UQ = (skill_category_code) — varchar NK only, no `_tenant_id` NK.
 * skill_category_family_id is uuid + required + FK + non-NK (will appear in
 * the requiredColumns skipFilter loop).
 */
function skillCategoriesMeta(): TargetMeta {
  return {
    columns: new Set([
      "skill_category_id",
      "skill_category_family_id",
      "skill_category_code",
      "skill_category_name",
      "skill_category_description",
      "skill_category_metadata",
      "created_at",
      "updated_at",
    ]),
    columnTypes: new Map([
      ["skill_category_id", "uuid"],
      ["skill_category_family_id", "uuid"],
      ["skill_category_code", "varchar"],
      ["skill_category_name", "varchar"],
      ["skill_category_description", "text"],
      ["skill_category_metadata", "jsonb"],
      ["created_at", "timestamptz"],
      ["updated_at", "timestamptz"],
    ]),
    columnMaxLengths: new Map<string, number | null>([
      ["skill_category_id", null],
      ["skill_category_family_id", null],
      ["skill_category_code", 64],
      ["skill_category_name", 128],
      ["skill_category_description", null],
      ["skill_category_metadata", null],
    ]),
    columnNullable: new Map([
      ["skill_category_id", false],
      ["skill_category_family_id", false],
      ["skill_category_code", false],
      ["skill_category_name", false],
      ["skill_category_description", true],
      ["skill_category_metadata", false],
    ]),
    // Required (NOT NULL no default): family_id + code + name. metadata has default '{}'.
    requiredColumns: new Set([
      "skill_category_family_id",
      "skill_category_code",
      "skill_category_name",
    ]),
    uniqueIndexName: "sys_skill_categories_code_uq",
    naturalKeyColumns: ["skill_category_code"],
    conflictInference: "skill_category_code",
    pkColumn: "skill_category_id",
  };
}

function skillCategoriesMapping(): TableMappingRow {
  return {
    table_mapping_id: "00000000-0000-0000-0000-00000060a001",
    source_table_id: "00000000-0000-0000-0000-00000060a002",
    source_table_schema: "legacy_mirror",
    source_table_name: "skill_categories_legacy",
    source_table_domain: null,
    target_schema: "sys",
    target_table: "sys_skill_categories",
    natural_key_pattern: null,
    metadata: {},
    source_table_metadata: { pk_columns: ["id"] },
  };
}

function skillCategoriesColumnMappings(): ColumnMappingRow[] {
  return [
    {
      column_mapping_id: "00000000-0000-0000-0000-00000060a101",
      source_column_name: "code",
      target_column: "skill_category_code",
      transform: "DIRECT_COPY",
      transform_payload: {},
    },
    {
      column_mapping_id: "00000000-0000-0000-0000-00000060a102",
      source_column_name: "name",
      target_column: "skill_category_name",
      transform: "DIRECT_COPY",
      transform_payload: {},
    },
  ];
}

describe("executeUpsertSqlSidePerMapping — CW-B60-A silent-skip observability", () => {
  it("emits SILENT_UPSERT_ZERO_ROWS_V1 audit row when main INSERT returns rowCount=0 (silent skip path)", async () => {
    const capturedSqls: { sql: string; params?: unknown[] }[] = [];
    const mockPool = {
      // pg.Pool#query has multiple overloads; this signature covers the
      // (text, values) form used by executeUpsertSqlSidePerMapping.
      query: async (sql: string, params?: unknown[]) => {
        capturedSqls.push({ sql, params });
        // Simulate the silent-skip trigger: INSERT main returns rowCount=0
        // (e.g. ON CONFLICT DO NOTHING + duplicate rows in target).
        // All queries (CW-B17 audit, INSERT main, lineage, staging-mark, and
        // the new CW-B60-A audit emit) return rowCount=0 from the mock; the
        // function is exercised end-to-end via the silent branch.
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const result = await executeUpsertSqlSidePerMapping(mockPool, {
      runId: RUN_ID,
      tenantId: TENANT_ID,
      mapping: skillCategoriesMapping(),
      columnMappings: skillCategoriesColumnMappings(),
      targetMeta: skillCategoriesMeta(),
      stagingTable: "staging.wave1_skill_categories",
      mode: "EXECUTE",
      cap: null,
    });

    // 1. Back-compat: shape unchanged.
    expect(result.upsertedRows).toBe(0);
    expect(result.lineageRows).toBe(0);
    expect(result.skipped).toBe(false);

    // 2. CW-B60-A acceptance: silent audit row emitted.
    const silentAuditSql = capturedSqls.find(
      (c) =>
        /INSERT INTO audit\.import_validation_results/.test(c.sql) &&
        /SILENT_UPSERT_ZERO_ROWS_V1/.test(c.sql),
    );
    expect(
      silentAuditSql,
      "audit INSERT with rule_code='SILENT_UPSERT_ZERO_ROWS_V1' MUST be emitted when upsertedCount===0",
    ).toBeDefined();

    // 3. Audit row status='SKIPPED' (semantic alignment with WHERE_SKIP_FILTER_EXCLUDED_V1).
    expect(silentAuditSql!.sql).toMatch(/'SKIPPED'/);

    // 4. Audit row params include runId + table_mapping_id (so forensic query
    //    `SELECT * FROM audit.import_validation_results WHERE rule_code = '...'`
    //    can be correlated back to the affected mapping).
    expect(silentAuditSql!.params).toContain(RUN_ID);
    expect(silentAuditSql!.params).toContain(skillCategoriesMapping().table_mapping_id);
  });

  it("regression: does NOT emit SILENT_UPSERT_ZERO_ROWS_V1 when main INSERT returns rowCount > 0 (happy path stays quiet)", async () => {
    const capturedSqls: { sql: string; params?: unknown[] }[] = [];
    const mockPool = {
      query: async (sql: string, params?: unknown[]) => {
        capturedSqls.push({ sql, params });
        // Main INSERT returns rowCount=5; subsequent (lineage, staging-mark)
        // can return whatever — they don't trigger the silent path.
        if (/INSERT INTO sys\./.test(sql)) {
          return { rows: [], rowCount: 5 };
        }
        return { rows: [], rowCount: 5 };
      },
    } as unknown as Pool;

    const result = await executeUpsertSqlSidePerMapping(mockPool, {
      runId: RUN_ID,
      tenantId: TENANT_ID,
      mapping: skillCategoriesMapping(),
      columnMappings: skillCategoriesColumnMappings(),
      targetMeta: skillCategoriesMeta(),
      stagingTable: "staging.wave1_skill_categories",
      mode: "EXECUTE",
      cap: null,
    });

    expect(result.upsertedRows).toBe(5);
    expect(result.skipped).toBe(false);

    const silentAuditSqls = capturedSqls.filter((c) =>
      /SILENT_UPSERT_ZERO_ROWS_V1/.test(c.sql),
    );
    expect(
      silentAuditSqls,
      "no silent-skip audit must be emitted on the happy path",
    ).toHaveLength(0);
  });

  it("DRY_RUN mode never emits SILENT_UPSERT_ZERO_ROWS_V1 audit (count-only path, no side effects)", async () => {
    const capturedSqls: { sql: string; params?: unknown[] }[] = [];
    const mockPool = {
      query: async (sql: string, params?: unknown[]) => {
        capturedSqls.push({ sql, params });
        // DRY_RUN takes the count-only branch (upsert-sql.ts §6 mode==='DRY_RUN'),
        // returning a single row { n: '0' }.
        if (/SELECT count\(\*\)/.test(sql)) {
          return { rows: [{ n: "0" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const result = await executeUpsertSqlSidePerMapping(mockPool, {
      runId: RUN_ID,
      tenantId: TENANT_ID,
      mapping: skillCategoriesMapping(),
      columnMappings: skillCategoriesColumnMappings(),
      targetMeta: skillCategoriesMeta(),
      stagingTable: "staging.wave1_skill_categories",
      mode: "DRY_RUN",
      cap: null,
    });

    expect(result.skipped).toBe(false);
    expect(result.upsertedRows).toBe(0);

    // DRY_RUN must NOT write to audit (no side effects).
    const auditSqls = capturedSqls.filter((c) =>
      /INSERT INTO audit\.import_validation_results/.test(c.sql),
    );
    expect(
      auditSqls,
      "DRY_RUN must not emit any audit row (including silent-skip)",
    ).toHaveLength(0);
  });
});
