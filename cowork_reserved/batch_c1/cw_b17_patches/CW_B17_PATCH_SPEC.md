# CW-B17 Patch Spec — Silent-Skip Audit Class

**Status**: code authoring done, ready per CLI Batch X1 to apply + test
**Owner Cowork**: spec + code ready
**Owner CLI**: edit `upsert-sql.ts` + run test + commit

---

## §1 — Problem statement

`upsert-sql.ts` linee 384-416 implementa il WHERE skip filter che esclude staging rows con NK/required UUID columns NULL o non valid-format UUID. **Le righe escluse NON producono audit rows** — sono silent-skipped.

**Quantified impact** (da `08_AUDIT_TRAIL_ANALYSIS.md`):
- Latest Wave 1 retry run `08d3bc9f`: 41285 staged, 16733 upserted → **24552 silent-skipped (59%)**
- Audit trail tracks 207k rows MA solo `WAVE1_ALL_RULES` PASSED — zero rows per silent skip
- Forensic blind spot: impossibile debugging "perché Y rows non sono upserted"

---

## §2 — Patch design

Aggiungere step audit-emission PRIMA dell'INSERT principale (lines ~477-505):

### §2.1 New audit rule_code constant

In nuovo file `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts`:

```typescript
/**
 * Audit rule codes emitted by brownfield wave executor.
 *
 * Convention: <CATEGORY>_<TOPIC>_V<N>
 * - V1 = original
 * - V2+ = revised semantics
 *
 * Each rule_code is INSERTed into audit.import_validation_results with
 * a specific status (PASSED/WARNING/SKIPPED/FAILED) + payload jsonb.
 */
export const AUDIT_RULE_CODES = {
  // Pre-existing (Goal 002+003)
  WAVE1_ALL_RULES: "WAVE1_ALL_RULES",
  LEGACY_NULL_LINEAGE_DOCUMENTED_V1: "LEGACY_NULL_LINEAGE_DOCUMENTED_V1",
  HANDLED_VIA_LINEAGE_WRITE_V1: "HANDLED_VIA_LINEAGE_WRITE_V1",

  // CW-B17 fix (Opt3 Phase 1 — this patch)
  /**
   * Emitted for every staging row excluded by WHERE skip filter due to:
   * - NK uuid column NULL or invalid format
   * - Required uuid column NULL
   *
   * payload: { target_col: string, exclusion_reason: 'nk_null'|'nk_invalid_uuid'|'required_null',
   *            target_table: string, table_mapping_id: uuid }
   */
  WHERE_SKIP_FILTER_EXCLUDED_V1: "WHERE_SKIP_FILTER_EXCLUDED_V1",
} as const;

export type AuditRuleCode = (typeof AUDIT_RULE_CODES)[keyof typeof AUDIT_RULE_CODES];
```

### §2.2 Modify `upsert-sql.ts`

**Position**: insert NEW code block prima dell'INSERT principale (after line ~424 dove baseWhere è costruito, before line ~478 dove insertSql è eseguito).

**New code block** (~30 lines):

```typescript
// CW-B17 patch — emit audit for WHERE-skipped rows BEFORE main INSERT
// Identifies staging rows that satisfy validation_status='PASSED' but FAIL skipFilters,
// INSERTs one audit row per excluded row with rule_code=WHERE_SKIP_FILTER_EXCLUDED_V1.
// This closes the silent-skip forensic blind spot.
if (mode === "EXECUTE" && skipFilters.length > 0) {
  // Identify exclusion reason per row: NK uuid issue OR required uuid NULL
  const skipReasonCases: string[] = [];
  for (const nkCol of targetMeta.naturalKeyColumns) {
    const colType = targetMeta.columnTypes.get(nkCol);
    if (colType !== "uuid") continue;
    if (nkCol.endsWith("_tenant_id")) continue;
    const entry = colEntries.find((e) => e.targetCol === nkCol);
    if (!entry) {
      skipReasonCases.push(`WHEN TRUE THEN 'nk_missing_${format("%L", nkCol)}'`);
      continue;
    }
    skipReasonCases.push(
      `WHEN (${entry.sql}) IS NULL THEN 'nk_null_${format("%L", nkCol)}'`,
      `WHEN NOT ((${entry.sql})::text ~* ${UUID_REGEX_PG}) THEN 'nk_invalid_uuid_${format("%L", nkCol)}'`,
    );
  }
  for (const reqCol of targetMeta.requiredColumns) {
    const colType = targetMeta.columnTypes.get(reqCol);
    if (colType !== "uuid") continue;
    if (reqCol === targetMeta.pkColumn || reqCol === tenantCol || reqCol === globalCol || reqCol === metaCol || reqCol === nameCol) continue;
    if (targetMeta.naturalKeyColumns.includes(reqCol)) continue;
    const entry = colEntries.find((e) => e.targetCol === reqCol);
    if (!entry) {
      skipReasonCases.push(`WHEN TRUE THEN 'required_missing_${format("%L", reqCol)}'`);
      continue;
    }
    skipReasonCases.push(`WHEN (${entry.sql}) IS NULL THEN 'required_null_${format("%L", reqCol)}'`);
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
      // Continue — audit emission failure shouldn't block import
    }
  }
}
```

### §2.3 Insertion point

Locate this block:
```typescript
const baseWhere = [
  `staging_import_run_id = $1`,
  `staging_source_table = $2`,
  `staging_validation_status = 'PASSED'`,
  `staging_target_record_id IS NULL`,
  ...skipFilters,
];
const limitClause = cap !== null ? `LIMIT ${cap}` : "";
```

Insert the NEW block IMMEDIATELY AFTER this `baseWhere` declaration, before `conflictInference` check (line ~427).

---

## §3 — Test cases

Add to `apps/api/test/upsert-sql.cw-b17.test.ts` (new file):

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp } from "./helpers/build-test-app.js";
// ... imports + setup boilerplate ...

describe("CW-B17 silent skip audit emission", () => {
  it("emits WHERE_SKIP_FILTER_EXCLUDED_V1 audit row for NK uuid NULL", async () => {
    // Setup: staging row with NULL NK uuid, validation PASSED
    // Run: executeUpsertSqlSidePerMapping
    // Assert: audit.import_validation_results has 1 row with rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
    //         AND payload.exclusion_reason = 'nk_null_<col>'
  });

  it("emits audit row for required uuid NULL", async () => {
    // Setup: staging row with NULL required FK uuid (non-NK)
    // Assert: audit row with rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
    //         AND payload.exclusion_reason = 'required_null_<col>'
  });

  it("emits audit row for malformed NK uuid", async () => {
    // Setup: staging row with NK uuid = 'not-a-uuid'
    // Assert: audit row with rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
    //         AND payload.exclusion_reason = 'nk_invalid_uuid_<col>'
  });

  it("does NOT emit audit row for upserted-successful rows", async () => {
    // Setup: staging row with valid NK, required uuids
    // Assert: 0 audit rows with rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
    //         + sys.<target> has 1 new row (upserted)
  });

  it("emits multiple audit rows when multiple staging rows are excluded", async () => {
    // Setup: 5 staging rows with NULL NK uuids
    // Assert: 5 audit rows with rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
  });

  it("DRY_RUN mode does NOT emit audit rows (only EXECUTE mode)", async () => {
    // Setup: staging row that would be excluded
    // Run: mode='DRY_RUN'
    // Assert: 0 audit rows emitted
  });
});
```

(Implementation per CLI to expand based on existing test infrastructure pattern in `transform-compiler.test.ts`)

---

## §4 — Verification post-apply

After CLI applies + test passes, re-run Wave 1 retry and verify:

```sql
-- Should be non-zero post-fix (was 0 pre-fix)
SELECT COUNT(*) FROM audit.import_validation_results
WHERE import_validation_result_rule_code = 'WHERE_SKIP_FILTER_EXCLUDED_V1';
-- Expected: ~24552 (matching latest run silent-skip count)

-- Distribution by exclusion_reason
SELECT
  import_validation_result_payload->>'exclusion_reason' AS reason,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_rule_code = 'WHERE_SKIP_FILTER_EXCLUDED_V1'
GROUP BY 1 ORDER BY 2 DESC;
-- Expected: top reasons identificheranno i target con maggior silent skip
-- (sys_skill_taxonomy_edges, sys_esco_occupation_mappings, etc.)

-- Distribution by target_table
SELECT
  import_validation_result_payload->>'target_table' AS target,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_rule_code = 'WHERE_SKIP_FILTER_EXCLUDED_V1'
GROUP BY 1 ORDER BY 2 DESC;
-- Expected: 12 target empty (Class B silent skip identifiers) appariranno qui
```

---

## §5 — Backwards compatibility

- Modification è additive (new INSERT statement before existing INSERT)
- Existing test cases NON impattati
- Audit table schema invariato (uses existing columns)
- Volume impact: ~25k rows per Wave 1 run (currently 207k → 232k = +12%)
- Storage cost: trivial (jsonb payload small)

---

## §6 — Effort estimate per CLI

- Read upsert-sql.ts → apply patch: 0.5h
- Create audit-rule-codes.ts: 0.2h
- Write 6 unit tests: 2-3h
- Run `pnpm typecheck` + `pnpm test`: 0.5h
- If tests pass: commit `feat(api): CW-B17 silent skip audit emission (WHERE_SKIP_FILTER_EXCLUDED_V1)`
- If tests fail: debug + iterate (~1-2h buffer)
- **Total CLI effort**: 3-6h

---

*End CW-B17 patch spec*
