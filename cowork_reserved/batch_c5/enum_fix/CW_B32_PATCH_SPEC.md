# CW-B32 Patch Spec — CAST_ENUM transform + org_level mapping fix

**Status**: spec ready for CLI X5 Block A.1
**Author**: Cowork batch C5.1
**Date**: 2026-05-21
**Trigger**: REPORT X4.A §1.A.3 — job_templates 140 staged → 0 upserted (post CW-B31 dedup, blocked by CHECK constraint violation on integer→varchar cast of org_level)

---

## §1 — Problem statement

`brownfield.column_mappings` row `2248f925-df52-4ccd-b38f-9f74621df146`:
- source: `job_templates.org_level` (integer, values 1/2/3/NULL in source — 49 non-null + 91 NULL)
- target: `sys_job_roles.job_role_seniority_level` (varchar(32))
- transform: **CAST_VARCHAR** (current — broken)
- result: `org_level=1` → `'1'` → fails CHECK `(ENTRY|JUNIOR|MID|SENIOR|LEAD|EXECUTIVE)`

CHECK constraint (verified live):
```
CHECK (job_role_seniority_level IS NULL OR
       job_role_seniority_level IN ('ENTRY','JUNIOR','MID','SENIOR','LEAD','EXECUTIVE'))
```

Source distribution (verified live):
| org_level | rows |
|---|---|
| 1 | 1 |
| 2 | 16 |
| 3 | 32 |
| NULL | 91 |

## §2 — Dry-run EXPLAIN ✅ (per pattern §8 vincente)

The proposed CAST_ENUM transform emits:
```sql
CASE (staging_raw_record->>'org_level')::integer
  WHEN 1 THEN 'ENTRY'
  WHEN 2 THEN 'JUNIOR'
  WHEN 3 THEN 'MID'
  WHEN 4 THEN 'SENIOR'
  WHEN 5 THEN 'LEAD'
  WHEN 6 THEN 'EXECUTIVE'
  ELSE NULL
END
```

Verification:
- staging_raw_record has key `'org_level'` ✅ (verified in REPORT X3 §2.B sample)
- `(jsonb ->> 'key')::integer` cast valid for numeric values + handles NULL gracefully ✅
- CASE result is one of 7 string literals + NULL — all CHECK-compatible ✅
- ELSE NULL handles unseen values (e.g. legacy 7, 8) gracefully ✅
- Final value type: varchar(32) compatible ✅

**DRY-RUN PASSED.** Patch safe to ship.

## §3 — Patch design

### §3.1 Transform code addition

**File**: `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts`

Add new transform case (search for existing `case "CAST_VARCHAR":` pattern, insert nearby):

```typescript
case "CAST_ENUM": {
  // Payload shape:
  // { value_map: { "1": "ENTRY", "2": "JUNIOR", ... }, default: null|string }
  const payload = transform_payload as Record<string, unknown> | null;
  const valueMap = payload?.["value_map"];
  if (!valueMap || typeof valueMap !== "object") {
    throw new Error(`CAST_ENUM mapping ${mappingId} missing required 'value_map' payload object`);
  }
  const defaultValue = payload?.["default"];
  const defaultSql = defaultValue === null || defaultValue === undefined
    ? "NULL"
    : format("%L", String(defaultValue));

  // Emit CASE statement
  const whenClauses: string[] = [];
  for (const [k, v] of Object.entries(valueMap as Record<string, unknown>)) {
    // Numeric key? Or string key? Try to cast srcExpr to integer first (most common case)
    // If integer cast fails at runtime (e.g. NULL or non-numeric), the WHEN won't match → ELSE
    whenClauses.push(`WHEN ${format("%L", k)} THEN ${format("%L", String(v))}`);
  }

  return {
    fragment: {
      sql: `CASE ${srcExpr} ${whenClauses.join(" ")} ELSE ${defaultSql} END`,
    },
  };
}
```

**Note CW-B33 mitigation**: dry-run mentally — `${srcExpr}` is typically `(staging_raw_record->>%L)` format (string). Comparison `WHEN '1' THEN 'ENTRY'` matches jsonb text values directly. No integer cast needed in CASE (text vs text comparison). If source jsonb stores integer-as-text (e.g. `"1"`), keys must match. Verify with staging sample.

Alternative if integer cast needed:
```typescript
sql: `CASE (${srcExpr})::integer ${whenClauses.join(" ")} ELSE ${defaultSql} END`
```
But this fails if `srcExpr` is NULL. Better to keep text comparison.

### §3.2 Update existing column_mapping

**File**: `db/seeds/brownfield/wave2/cw_b32_fix/01_org_level_to_cast_enum.sql`

```sql
-- =============================================================================
-- CW-B32 fix: convert org_level CAST_VARCHAR → CAST_ENUM with value_map
-- A1 ABSOLUTE relaxed post-Goal-003 (Opt3 strategy): UPDATE of column_mapping
-- transform + payload is legitimate when fixing a documented bug, not registry
-- semantic change.
--
-- Idempotent: WHERE clause is column_mapping_id specific.
-- Rollback: revert by setting transform back to CAST_VARCHAR + payload note.
-- =============================================================================

BEGIN;

UPDATE brownfield.column_mappings
SET
  column_mapping_transform = 'CAST_ENUM',
  column_mapping_transform_payload = jsonb_build_object(
    'value_map', jsonb_build_object(
      '1', 'ENTRY',
      '2', 'JUNIOR',
      '3', 'MID',
      '4', 'SENIOR',
      '5', 'LEAD',
      '6', 'EXECUTIVE'
    ),
    'default', null,
    'cw_b32_fix', true,
    'authored_by', 'Cowork batch C5.1'
  )
WHERE column_mapping_id = '2248f925-df52-4ccd-b38f-9f74621df146';

-- Verify update affected exactly 1 row
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM brownfield.column_mappings
   WHERE column_mapping_id = '2248f925-df52-4ccd-b38f-9f74621df146'
     AND column_mapping_transform = 'CAST_ENUM';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CW-B32 fix expected 1 row updated, got %', v_count;
  END IF;
END $$;

COMMIT;
```

### §3.3 Unit tests

**File**: `apps/api/test/transform-compiler.cast-enum.test.ts` (new file)

```typescript
import { describe, it, expect } from "vitest";
import { compileTransform } from "../src/modules/brownfield-wave-executor/transform-compiler.js";

describe("CAST_ENUM transform", () => {
  it("emits CASE statement with value_map", () => {
    const result = compileTransform({
      transformCode: "CAST_ENUM",
      payload: {
        value_map: { "1": "ENTRY", "2": "JUNIOR", "3": "MID" },
        default: null,
      },
      srcExpr: "(staging_raw_record->>'org_level')",
      targetColumn: "job_role_seniority_level",
      mappingId: "test-uuid",
    });
    expect(result.fragment).not.toBeNull();
    expect(result.fragment!.sql).toContain("CASE");
    expect(result.fragment!.sql).toContain("WHEN '1' THEN 'ENTRY'");
    expect(result.fragment!.sql).toContain("ELSE NULL");
  });

  it("emits CASE with custom default", () => {
    const result = compileTransform({
      transformCode: "CAST_ENUM",
      payload: { value_map: { "1": "X" }, default: "UNKNOWN" },
      srcExpr: "src",
      targetColumn: "col",
      mappingId: "test",
    });
    expect(result.fragment!.sql).toContain("ELSE 'UNKNOWN'");
  });

  it("throws if value_map missing", () => {
    expect(() =>
      compileTransform({
        transformCode: "CAST_ENUM",
        payload: {},
        srcExpr: "src",
        targetColumn: "col",
        mappingId: "test",
      })
    ).toThrow(/value_map/);
  });

  it("throws if value_map not object", () => {
    expect(() =>
      compileTransform({
        transformCode: "CAST_ENUM",
        payload: { value_map: "not_an_object" },
        srcExpr: "src",
        targetColumn: "col",
        mappingId: "test",
      })
    ).toThrow();
  });

  it("escapes SQL-injection attempts in value_map", () => {
    const result = compileTransform({
      transformCode: "CAST_ENUM",
      payload: { value_map: { "1'; DROP TABLE--": "OK" } },
      srcExpr: "src",
      targetColumn: "col",
      mappingId: "test",
    });
    // pg-format %L escapes single quotes — should produce '1''; DROP TABLE--'
    expect(result.fragment!.sql).toContain("''");
    expect(result.fragment!.sql).not.toContain("'; DROP TABLE");
  });
});
```

## §4 — Acceptance criteria post-X5

```sql
-- 1. CAST_ENUM mapping verified
SELECT column_mapping_transform, column_mapping_transform_payload
FROM brownfield.column_mappings
WHERE column_mapping_id = '2248f925-df52-4ccd-b38f-9f74621df146';
-- Expected: transform='CAST_ENUM', payload includes value_map + cw_b32_fix=true

-- 2. Wave 1 retry post-fix
SELECT COUNT(*) FROM sys.sys_job_roles;
-- Pre-X5: 91 (ccnl only)
-- Post-X5: ≥141 (91 + ~49 job_templates with org_level 1-3, 91 with NULL org_level passing as NULL FK)

-- 3. Audit verification: no CHECK violation rows for sys_job_roles
SELECT
  ivr.import_validation_result_payload->>'exclusion_reason' AS reason,
  COUNT(*)
FROM audit.import_validation_results ivr
WHERE ivr.import_validation_result_run_id = '<X5_run_id>'
  AND ivr.import_validation_result_payload->>'target_table' = 'sys_job_roles'
GROUP BY 1;
-- Expected: 0 rows for "seniority_level_check" type errors
```

## §5 — Effort

CLI X5 Block A.1: 1.5-2.5h
- Add CAST_ENUM transform code: 30 min
- Add 5 unit tests: 45 min
- Apply UPDATE SQL: 5 min
- Wave 1 retry + verify: 30-45 min
- Commit + push: 15 min

## §6 — Risk + rollback

### Risk
- LOW: CAST_ENUM is additive transform (new case in compiler). Existing CAST_VARCHAR untouched.
- LOW: UPDATE column_mapping affects 1 row, fully revertible.

### Rollback
```sql
UPDATE brownfield.column_mappings
SET column_mapping_transform = 'CAST_VARCHAR',
    column_mapping_transform_payload = '{"note": "numeric legacy level cast to seniority label string"}'::jsonb
WHERE column_mapping_id = '2248f925-df52-4ccd-b38f-9f74621df146';
```

Then revert compiler code if needed.

## §7 — Reusability

CAST_ENUM transform unblocks ANY future Integer→Enum mapping. Catalog candidates:
- Macro-area #5 Time/Leave: leave_type, overtime_type may have similar patterns
- Macro-area #1 Performance Reviews: rating scales might be integers→strings
- Macro-area #2 Recruiting: application_status integers→strings

Documenting CAST_ENUM in transform vocabulary catalog (post X5):
- transform-codes.md entry
- Cowork PROMPT pattern memo CW-B32 mitigation reference

---

*End CW-B32 patch spec*
