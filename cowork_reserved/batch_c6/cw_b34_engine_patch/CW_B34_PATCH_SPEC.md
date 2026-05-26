# CW-B34 Patch Spec — Nullable NK UUID columns in WHERE skip filter

**Status**: spec ready for CLI X6 (Block A — engine fix)
**Author**: Cowork batch C6.1
**Date**: 2026-05-21
**Trigger**: REPORT X5.A §2.B.6 + halt notice `2026-05-21T12-19-00Z__008_halt_adr_0016_unexpected_fail.md`
**Decision**: Enzo approved Option A (engine COALESCE-aware skip filter, mirror CW-B22 pattern)

---

## §1 — Problem statement

`apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:431-442` builds a WHERE clause that excludes ANY staged row where a UUID column in `targetMeta.naturalKeyColumns` would resolve to NULL pre-INSERT. Current heuristic:

```typescript
// upsert-sql.ts:431-442 (BEFORE)
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
```

The naming-convention escape hatch (`endsWith("_tenant_id")`) is the existing CW-B22 mitigation but only covers tenant columns. Post-ADR-0015/0016 we have non-tenant NK UUID columns that are LEGITIMATELY nullable:
- `sys_job_roles.job_role_family_id` (ADR-0015)
- `sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id` (ADR-0016 — surfaced X5.A)

REPORT X5.A §2.B.6 documented 7645/7645 ESCO staged rows excluded as `nk_missing_esco_occupation_mapping_job_role_id` despite migration 000041 making the DB column nullable.

## §2 — Root cause (CW-B34)

**Nullable FK vs NK UQ Semantic Divergence**: ADR-0015/0016 changed DB layer (column nullable + UQ index unchanged). PG default UQ semantics treat NULL as distinct → multi-NULL rows allowed. BUT the engine layer pre-INSERT WHERE filter uses col-existence-required heuristic without consulting DB nullability metadata.

## §3 — Dry-run EXPLAIN ✅ (pattern §8 vincente)

### §3.1 Proposed predicate emission

For nullable NK UUID col (e.g. `esco_occupation_mapping_job_role_id`), the filter becomes:

```sql
-- BEFORE (current):
(staging_raw_record->>'job_id')::uuid IS NOT NULL
  AND (staging_raw_record->>'job_id')::text ~* '^[0-9a-fA-F]{8}-...'

-- AFTER (CW-B34 fix, when columnNullable.get(nkCol) === true):
-- (filter SKIPPED entirely — NULL is acceptable; UQ tolerates NULL)
```

For non-nullable NK UUID col (legacy behavior preserved):

```sql
-- AFTER (unchanged):
(staging_raw_record->>'pk_id')::uuid IS NOT NULL
  AND (staging_raw_record->>'pk_id')::text ~* '^[0-9a-fA-F]{8}-...'
```

### §3.2 Verification (dry-run mental EXPLAIN)

- `columnNullable.get('esco_occupation_mapping_job_role_id')` → `true` (post-migration 000041) ✅
- Filter array gets `[]` instead of `[IS NOT NULL, ~* UUID]` for that col ✅
- WHERE clause baseWhere `[run_id, source_table, status, target_id IS NULL]` no longer joined with `FALSE` (when `entry` missing) or with `IS NOT NULL` for nullable col ✅
- Conflict inference `(esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri)` still works at INSERT time — PG accepts NULL in NK UQ (NULL ≠ NULL default semantic) ✅
- For dedup phase (CW-B31 DISTINCT ON pattern X4.A), nullable NK col produces multiple NULL/<uri> distinct groups — acceptable for ESCO catalog ✅

**DRY-RUN PASSED.** Patch safe to ship.

### §3.3 What about `FALSE` skip case (no column_mapping for NK col)?

Current: `if (!entry) { skipFilters.push("FALSE"); continue; }` — this `FALSE` excludes ALL rows when no mapping exists.

**Decision**: keep `FALSE` for non-nullable cols (mapping absent = no way to satisfy NOT NULL constraint). For nullable cols, skip the `FALSE` push too — column will get NULL via `colEntries` system column default (or omitted from INSERT, letting PG accept NULL).

```typescript
// REVISED pseudo:
const isNullable = targetMeta.columnNullable.get(nkCol) === true;
const entry = colEntries.find((e) => e.targetCol === nkCol);

if (!entry) {
  if (isNullable) {
    // Inject NULL placeholder in colEntries so INSERT has explicit NULL for the col
    colEntries.push({ targetCol: nkCol, sql: "NULL::uuid" });
    continue;
  }
  skipFilters.push("FALSE");
  continue;
}

if (isNullable) {
  // No filter — NULL is acceptable
  continue;
}

skipFilters.push(`(${entry.sql}) IS NOT NULL`);
skipFilters.push(`(${entry.sql})::text ~* ${UUID_REGEX_PG}`);
```

## §4 — Patch design

### §4.1 TargetMeta extension (engine.ts)

**File**: `apps/api/src/modules/brownfield-wave-executor/engine.ts:36-50`

Add `columnNullable` field:

```typescript
interface TargetMeta {
  columns: Set<string>;
  columnTypes: Map<string, string>;
  columnMaxLengths: Map<string, number | null>;
  /** NEW (CW-B34): map column_name → DB-level is_nullable boolean. */
  columnNullable: Map<string, boolean>;
  requiredColumns: Set<string>;
  uniqueIndexName: string | null;
  naturalKeyColumns: string[];
  conflictInference: string | null;
  pkColumn: string;
}
```

**File**: `apps/api/src/modules/brownfield-wave-executor/engine.ts:80-91`

Populate `columnNullable` in `loadTargetMeta` (we already query `is_nullable` — just map it):

```typescript
// After line 84 (columnMaxLengths construction):
const columnNullable = new Map(
  colsRes.rows.map((r) => [r.column_name, r.is_nullable === "YES"]),
);
```

Update return statement (engine.ts:143):

```typescript
return {
  columns, columnTypes, columnMaxLengths, columnNullable,
  requiredColumns, uniqueIndexName, naturalKeyColumns, conflictInference, pkColumn,
};
```

### §4.2 WHERE skip filter patch (upsert-sql.ts)

**File**: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:431-461`

Replace NK UUID loop (lines 431-442) and required UUID loop (lines 443-461) with nullable-aware version:

```typescript
// 5. WHERE skip filter (CW-B34: respect columnNullable for UUID cols)
const skipFilters: string[] = [];
for (const nkCol of targetMeta.naturalKeyColumns) {
  const colType = targetMeta.columnTypes.get(nkCol);
  if (colType !== "uuid") continue;
  if (nkCol.endsWith("_tenant_id")) continue; // _tenant_id NK allowed NULL (CW-B22)
  const isNullable = targetMeta.columnNullable.get(nkCol) === true;
  const entry = colEntries.find((e) => e.targetCol === nkCol);

  if (!entry) {
    if (isNullable) {
      // CW-B34: inject explicit NULL so INSERT has the column with NULL value
      colEntries.push({ targetCol: nkCol, sql: "NULL::uuid" });
      continue;
    }
    skipFilters.push("FALSE");
    continue;
  }

  if (isNullable) {
    // CW-B34: nullable NK UUID col — NULL acceptable, skip presence/regex check
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
  // Note: requiredColumns is by-definition NOT NULL (engine.ts:87-91 filter), so
  // columnNullable.get(reqCol) === false here. No nullable-aware branch needed.
  const entry = colEntries.find((e) => e.targetCol === reqCol);
  if (!entry) {
    skipFilters.push("FALSE");
    continue;
  }
  skipFilters.push(`(${entry.sql}) IS NOT NULL`);
}
```

**Note**: the required-cols loop (lines 443-461 original) is by definition non-nullable (requiredColumns Set is built filtering `is_nullable === "NO" AND column_default === null` per engine.ts:87-91). So no nullable-aware branch needed there — current behavior preserved.

### §4.3 Unit tests

**File**: `apps/api/test/upsert-sql.cw-b34-nullable-nk.test.ts` (NEW)

```typescript
import { describe, it, expect } from "vitest";
// import the internal helper — may require refactor to export the builder pure
// Alternative: integration test via wave1 retry on sys_esco_occupation_mappings

describe("CW-B34 nullable NK UUID handling", () => {
  it("skips IS NOT NULL filter for nullable NK UUID col", () => {
    const targetMeta = {
      columns: new Set(["esco_occupation_mapping_job_role_id", "esco_occupation_mapping_esco_uri"]),
      columnTypes: new Map([
        ["esco_occupation_mapping_job_role_id", "uuid"],
        ["esco_occupation_mapping_esco_uri", "varchar"],
      ]),
      columnNullable: new Map([
        ["esco_occupation_mapping_job_role_id", true], // post-ADR-0016
        ["esco_occupation_mapping_esco_uri", false],
      ]),
      columnMaxLengths: new Map(),
      requiredColumns: new Set(["esco_occupation_mapping_esco_uri"]),
      naturalKeyColumns: ["esco_occupation_mapping_job_role_id", "esco_occupation_mapping_esco_uri"],
      uniqueIndexName: "sys_esco_occupation_mappings_pair_uq",
      conflictInference: "(esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri)",
      pkColumn: "esco_occupation_mapping_id",
    };

    // Build upsert SQL with no column_mapping for job_role_id
    const result = buildUpsertSql({ /* ... fixtures ... */ });

    // Assertion 1: NULL::uuid injected in colEntries (or omitted to allow PG default NULL)
    expect(result.sql).toMatch(/esco_occupation_mapping_job_role_id.*NULL::uuid/);

    // Assertion 2: WHERE clause does NOT contain IS NOT NULL for that col
    expect(result.sql).not.toMatch(/esco_occupation_mapping_job_role_id.*IS NOT NULL/);

    // Assertion 3: WHERE clause is still otherwise sound
    expect(result.sql).toContain("staging_validation_status = 'PASSED'");
  });

  it("preserves IS NOT NULL filter for non-nullable NK UUID col (regression check)", () => {
    const targetMeta = {
      // ... same skill_id non-nullable scenario
      columnNullable: new Map([["skill_id", false]]),
      // ...
    };
    const result = buildUpsertSql({ /* ... */ });
    expect(result.sql).toMatch(/skill_id.*IS NOT NULL/);
  });

  it("preserves tenant_id NULL allowance (CW-B22 regression check)", () => {
    // _tenant_id continues to be skipped regardless of columnNullable
    const targetMeta = {
      // ... contains skill_tenant_id NK col
      columnNullable: new Map([["skill_tenant_id", false]]), // even if NOT NULL flag mistakenly true
      naturalKeyColumns: ["skill_tenant_id", "skill_code"],
    };
    const result = buildUpsertSql({ /* ... */ });
    expect(result.sql).not.toMatch(/skill_tenant_id.*IS NOT NULL/);
  });

  it("integration: sys_esco_occupation_mappings Wave 1 retry unblocks", async () => {
    // Live DB retry — verifies end-to-end. SKIP if not in CI w/ tunnel.
    // Pre: migration 000041 applied, brownfield mappings loaded
    // Run: wave1 runner
    // Assert: COUNT(*) FROM sys.sys_esco_occupation_mappings >= 3000
  });
});
```

**Effort estimate**: 4-5 unit tests, 1 integration test. ~45 min.

### §4.4 Integration verification (post-patch)

After patch + typecheck + unit tests:

```bash
cd D:\heuresys-advanced
pnpm typecheck                                                          # PASS
cd apps/api && pnpm exec vitest run test/upsert-sql.cw-b34-nullable-nk.test.ts  # 4/4 (skip integration if no tunnel)
pnpm test                                                                 # full suite — must not regress below 322 pass

# Wave 1 retry
pnpm tsx src/cli/brownfield-wave-run.ts --wave 1

# Acceptance
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT COUNT(*) FROM sys.sys_esco_occupation_mappings;"
# Expected: ≥3000 (target was 7645 staged → ≥3000 after dedup/lineage filter)
```

## §5 — Acceptance criteria post-X6

1. `targetMeta.columnNullable` populated from `information_schema.columns.is_nullable`
2. WHERE skip filter SKIPS `IS NOT NULL` + UUID regex for nullable NK UUID cols
3. Existing non-nullable NK UUID cols preserve current behavior (regression check)
4. `_tenant_id` continues to be NULL-allowed (CW-B22 regression check)
5. Unit tests 4/4 PASS
6. Full test suite ≥322 pass (no new regression)
7. Live retry: `sys_esco_occupation_mappings` count ≥3000
8. `sys_job_roles` count preserved at 202 (no regression on previous unblock)
9. Audit: 0 rows excluded with `nk_missing_esco_occupation_mapping_job_role_id` post-patch

## §6 — Risk + rollback

### Risk
- **LOW**: patch is additive — adds new field to TargetMeta + branches on it. Default behavior (non-nullable col) preserved.
- **MEDIUM**: regression risk on `sys_job_roles` family_id (ADR-0015 — also nullable). Post-patch may RE-enable rows previously excluded → unintentional unlock. Mitigation: verify count delta + audit log distribution post-patch.
- **LOW**: SQL injection — `nkCol` comes from target table introspection (engine.ts:125-139 pg_attribute), not user input.

### Rollback
1. Revert upsert-sql.ts patch (single function, mechanical revert)
2. Revert engine.ts TargetMeta extension
3. Wave 1 retry returns to baseline behavior

## §7 — Reusability + CW-B34 generalization

Post-patch, ANY future nullable NK UUID col (via new ADR ALTER COLUMN DROP NOT NULL) automatically inherits NULL-allowance in skip filter. Pattern aligns with CW-B22 tenant_id helper but generalized via DB metadata.

**Candidates that benefit immediately**:
- `sys_job_roles.job_role_family_id` (ADR-0015) — already populated 202, no immediate diff but consistent
- `sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id` (ADR-0016) — unblocks ≥3000 rows X6

**Future-flexible**: any `sys_position_skill_requirements`, `sys_competency_assessments`, or 11 macro-aree SDBI nullable-FK target inherits the fix.

## §8 — Effort

CLI X6 Block A.1: 1.5-2.5h
- Add `columnNullable` field to TargetMeta + populate in loadTargetMeta: 15 min
- Patch upsert-sql.ts WHERE skip filter: 30 min
- Unit tests (3 unit + 1 integration scaffold): 45 min
- Typecheck + full test suite + Wave 1 retry: 30 min
- Commit + push: 15 min

## §9 — Open questions

1. **Acceptance threshold target**: PROMPT 008 §4.B.6 said ≥3000. Live staged = 7645. Realistic ≥4000-5000 post-dedup (50%+ of staged). C6 acceptance: ≥3000 conservative, ≥5000 optimistic.
2. **CW-B34 also affects required UUID cols?** No — required cols by definition `is_nullable === "NO"` (engine.ts:87-91), so columnNullable always false there. No nullable-aware branch needed in required loop.
3. **Conflict inference behavior**: PG accepts multiple NULL+<uri> rows in UQ by default (NULL ≠ NULL). For ESCO catalog this is acceptable. If duplicates surface post-patch, refine UQ to NULLS NOT DISTINCT (deferred per ADR-0016 §9.2).

---

*End CW-B34 patch spec — engine companion fix for ADR-0015/0016 nullable FK pattern*
