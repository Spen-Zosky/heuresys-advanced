/**
 * apps/api/test/upsert-sql-cw-b34-nullable-nk.test.ts
 *
 * CW-B34 — Nullable FK vs NK UQ Semantic Divergence patch (ADR-0015/0016
 * engine companion fix). Verifies:
 *   1-3. `buildNkJoinPredicate` emits COALESCE-sentinel pattern for nullable
 *        UUID NK cols and _tenant_id NK cols (CW-B22 regression check), and
 *        plain `=` for non-nullable UUID NK cols.
 *   4.   `executeUpsertSqlSidePerMapping` (DRY_RUN mode, mock Pool) injects
 *        `NULL::uuid` colEntry for a nullable NK UUID col with no
 *        column_mapping AND omits the `IS NOT NULL` / UUID regex skip filter
 *        for that col — verifying the X5.A halt (7645 ESCO rows excluded as
 *        `nk_missing_*`) is structurally unblocked at the SQL-builder layer.
 */
import { describe, it, expect } from "vitest";
import type { Pool } from "pg";
import {
  buildNkJoinPredicate,
  executeUpsertSqlSidePerMapping,
  type TargetMeta,
} from "../src/modules/brownfield-wave-executor/upsert-sql.js";
import type {
  ColumnMappingRow,
  TableMappingRow,
} from "../src/modules/brownfield-wave-executor/repository.js";

const TENANT_SENTINEL = "'00000000-0000-0000-0000-000000000000'::uuid";

describe("buildNkJoinPredicate — CW-B34 nullable NK UUID col", () => {
  it("emits COALESCE-sentinel pattern for nullable UUID NK col (ADR-0016 ESCO case)", () => {
    const sql = buildNkJoinPredicate(
      "esco_occupation_mapping_job_role_id",
      "__nk_esco_occupation_mapping_job_role_id",
      "uuid",
      true, // isNullable
    );
    expect(sql).toContain("COALESCE");
    expect(sql).toContain(TENANT_SENTINEL);
    expect(sql).toContain("t.esco_occupation_mapping_job_role_id");
    expect(sql).toContain("s.__nk_esco_occupation_mapping_job_role_id");
  });

  it("emits plain `=` for non-nullable UUID NK col (regression check, e.g. sys_skills.skill_id)", () => {
    const sql = buildNkJoinPredicate(
      "skill_id",
      "__nk_skill_id",
      "uuid",
      false, // isNullable
    );
    expect(sql).not.toContain("COALESCE");
    // pg-format leaves lowercase identifiers unquoted; assert the column refs
    // and the equality operator are present without imposing a quoting style.
    expect(sql).toContain("t.skill_id");
    expect(sql).toContain("s.__nk_skill_id");
    expect(sql).toMatch(/t\.skill_id\s*=\s*s\.__nk_skill_id/);
  });

  it("preserves COALESCE-sentinel for _tenant_id NK col regardless of nullable flag (CW-B22 regression)", () => {
    // CW-B22 contract: `_tenant_id` NK cols use COALESCE(sentinel) even if
    // columnNullable map says false (defensive — naming-convention escape
    // hatch survives DB-metadata-driven nullability flip-flops).
    const sql = buildNkJoinPredicate(
      "skill_tenant_id",
      "__nk_skill_tenant_id",
      "uuid",
      false, // isNullable=false; tenant suffix should still trigger COALESCE
    );
    expect(sql).toContain("COALESCE");
    expect(sql).toContain(TENANT_SENTINEL);
  });
});

describe("executeUpsertSqlSidePerMapping — CW-B34 nullable NK UUID skip filter (mock Pool)", () => {
  it("injects NULL::uuid for nullable NK UUID col without column_mapping AND omits IS NOT NULL skip filter (ADR-0016 ESCO unblock)", async () => {
    const capturedSql: string[] = [];
    const mockPool = {
      // pg.Pool#query has multiple overloads; the implementation here covers
      // the only call signatures used by executeUpsertSqlSidePerMapping
      // (text + params). All responses return rowCount:0 to short-circuit
      // upsertedCount === 0 → return early (skip lineage/staging-mark).
      query: async (sql: string) => {
        capturedSql.push(sql);
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;

    const targetMeta: TargetMeta = {
      columns: new Set([
        "esco_occupation_mapping_id",
        "esco_occupation_mapping_tenant_id",
        "esco_occupation_mapping_is_global",
        "esco_occupation_mapping_metadata",
        "esco_occupation_mapping_name",
        "esco_occupation_mapping_job_role_id",
        "esco_occupation_mapping_esco_uri",
      ]),
      columnTypes: new Map([
        ["esco_occupation_mapping_id", "uuid"],
        ["esco_occupation_mapping_tenant_id", "uuid"],
        ["esco_occupation_mapping_is_global", "bool"],
        ["esco_occupation_mapping_metadata", "jsonb"],
        ["esco_occupation_mapping_name", "varchar"],
        ["esco_occupation_mapping_job_role_id", "uuid"],
        ["esco_occupation_mapping_esco_uri", "varchar"],
      ]),
      columnMaxLengths: new Map([
        ["esco_occupation_mapping_name", 255],
        ["esco_occupation_mapping_esco_uri", 512],
      ]),
      // The critical bit: job_role_id is nullable (post-ADR-0016).
      columnNullable: new Map([
        ["esco_occupation_mapping_id", false],
        ["esco_occupation_mapping_tenant_id", true],
        ["esco_occupation_mapping_is_global", false],
        ["esco_occupation_mapping_metadata", false],
        ["esco_occupation_mapping_name", false],
        ["esco_occupation_mapping_job_role_id", true], // ADR-0016
        ["esco_occupation_mapping_esco_uri", false],
      ]),
      requiredColumns: new Set(["esco_occupation_mapping_esco_uri"]),
      uniqueIndexName: "sys_esco_occupation_mappings_pair_uq",
      naturalKeyColumns: [
        "esco_occupation_mapping_job_role_id",
        "esco_occupation_mapping_esco_uri",
      ],
      conflictInference:
        "esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri",
      pkColumn: "esco_occupation_mapping_id",
    };

    const mapping: TableMappingRow = {
      table_mapping_id: "00000000-0000-0000-0000-00000000aaaa",
      source_table_id: "00000000-0000-0000-0000-00000000bbbb",
      source_table_schema: "legacy_mirror",
      source_table_name: "esco_occupations",
      source_table_domain: null,
      target_schema: "sys",
      target_table: "sys_esco_occupation_mappings",
      natural_key_pattern: null,
      metadata: {},
      source_table_metadata: { pk_columns: ["id"] },
    };

    // One column_mapping for esco_uri (varchar) — no mapping for the nullable
    // NK UUID col job_role_id. Pre-patch this would emit `FALSE` skip filter.
    // Post-patch this should inject `NULL::uuid` for the col instead.
    const columnMappings: ColumnMappingRow[] = [
      {
        column_mapping_id: "00000000-0000-0000-0000-00000000cccc",
        source_column_name: "esco_uri",
        target_column: "esco_occupation_mapping_esco_uri",
        transform: "DIRECT_COPY",
        transform_payload: {},
      },
    ];

    const result = await executeUpsertSqlSidePerMapping(mockPool, {
      runId: "00000000-0000-0000-0000-00000000dddd",
      tenantId: "00000000-0000-0000-0000-00000000eeee",
      mapping,
      columnMappings,
      targetMeta,
      stagingTable: "staging.wave1_esco_occupation_mappings",
      mode: "EXECUTE",
      cap: null,
    });

    expect(result.skipped).toBe(false);
    expect(result.upsertedRows).toBe(0); // mock returns rowCount=0 → early return

    // The INSERT statement is the first non-audit-skip query. With skipFilters
    // empty (post-CW-B34, the nullable NK UUID col is the only UUID NK and it
    // skips the filter entirely), the CW-B17 audit-skip emission is gated off
    // and the INSERT is captured first.
    const insertSql = capturedSql.find((s) => /INSERT INTO/.test(s)) ?? "";
    expect(insertSql).toMatch(/INSERT INTO/);

    // Acceptance 1: NULL::uuid injected for the nullable NK UUID col with no
    // column_mapping (SELECT list of the INSERT).
    expect(insertSql).toMatch(/NULL::uuid/);

    // Acceptance 2: NO `IS NOT NULL` filter against the nullable col. Pre-patch
    // the WHERE included `(NULL::uuid) IS NOT NULL` which makes the predicate
    // FALSE for every row → 0 rows inserted. Post-patch this clause is omitted.
    expect(insertSql).not.toMatch(
      /esco_occupation_mapping_job_role_id[^\n]*IS NOT NULL/,
    );

    // Acceptance 3: NO `FALSE` literal in the WHERE skip filter for this col
    // (FALSE was the pre-CW-B34 escape for missing entries → blocked all rows).
    expect(insertSql).not.toMatch(/AND\s+FALSE\b/);

    // Acceptance 4: the INSERT still applies the canonical base predicates.
    expect(insertSql).toContain("staging_validation_status = 'PASSED'");
    expect(insertSql).toContain("staging_target_record_id IS NULL");
  });
});
