# CW-B24 Patch Spec — Lineage self-conflict fix (deduplication)

**Author**: Cowork (deep-investigation C2.1)
**Date**: 2026-05-21
**Confidence**: MEDIUM-HIGH (root cause inferred from code analysis; needs CLI runtime verification with EXPLAIN)
**Status**: AUTHORED — pending CLI X2 apply + test

---

## §1 — Problem statement

### Evidence from REPORT X1

- PG error observed during Wave 1 retry, on the lineage INSERT (step 8 in `upsert-sql.ts`):
  ```
  ERROR: ON CONFLICT DO UPDATE command cannot affect row a second time
  ```
- Logged ~12+ times across multiple mappings during the run.
- **Impact**: When this error fires, the entire lineage INSERT for that mapping fails. The `catch` block at upsert-sql.ts:695-700 swallows it with `console.error` + continue → target rows are successfully inserted (step 6 succeeded earlier), but the **lineage trail is lost** for that mapping's entire batch. The mapping looks "successful" by row count but has no audit trail back to source.

### PG semantics behind the error

The error fires when an `INSERT … SELECT … ON CONFLICT … DO UPDATE` statement produces **two or more rows with the same conflict-target tuple** in a single command. PG cannot decide which one should "win" the conflict resolution, so it rejects the whole statement.

In our case, the conflict target is:
```sql
ON CONFLICT (
    source_lineage_source_system,
    source_lineage_source_table,
    source_lineage_source_record_id,
    source_lineage_target_table_name
)
```

### Exact code location

File: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`, lines 627-683 (the `lineageSql` template literal).

Decomposition of the SELECT projection (lines 655-667):

```sql
SELECT
  $3::uuid,                              -- source_lineage_tenant_id          (CONSTANT — same for every SELECT row)
  'heuresys_platform',                   -- source_lineage_source_system      (CONSTANT)
  s.staging_source_table,                -- source_lineage_source_table       (= $2 in WHERE — CONSTANT for the run)
  s.staging_source_record_id,            -- source_lineage_source_record_id   (VARIES per src row)
  s.staging_source_natural_key,
  s.staging_source_content_hash,
  $1::uuid,                              -- source_lineage_import_run_id      (CONSTANT)
  $4::uuid,                              -- source_lineage_table_mapping_id   (CONSTANT)
  $5::text,                              -- source_lineage_target_table_name  (CONSTANT)
  t.<pk>,                                -- source_lineage_target_record_id   (VARIES via JOIN)
  s.staging_mapping_confidence::numeric,
  'VALID'
FROM src s
JOIN sys.<target> t ON (<nkMatchPairs.join(" AND ")>)
```

**The UQ conflict-target columns reduce to only `staging_source_record_id` varying per row**, because:
- `source_system`, `source_table`, `target_table_name`: constants across the whole statement.
- `source_record_id`: comes from `s.staging_source_record_id`.

So **the error fires whenever the SELECT produces ≥2 rows with the same `staging_source_record_id`**.

---

## §2 — Root cause analysis

There are **two independent ways** for the SELECT to produce duplicate `staging_source_record_id` values:

### Cause A — Compound-PK source tables collapse to a single staging_source_record_id

Evidence: `engine.ts` line 182-183 (in `executeStage`):
```typescript
const pkColumns = (m.source_table_metadata?.["pk_columns"] as string[] | undefined) ?? ["id"];
const pkCol = pkColumns[0] ?? "id";
```
And line 198:
```sql
COALESCE(lm."${pkColQuoted}"::text, 'unknown'),  -- staging_source_record_id
```

**Only `pkColumns[0]` is used to derive `staging_source_record_id`**. If the legacy source table has a **compound primary key** (e.g., `(domain_id, code)`), two distinct rows like `(1, 'A')` and `(1, 'B')` both serialize to `staging_source_record_id = '1'`. The TRUNCATE+INSERT in executeStage has an `ON CONFLICT (staging_import_run_id, staging_source_table, staging_source_record_id) DO NOTHING` at line 205-206 → only one of the two rows survives staging. But if BOTH rows actually map to **different target rows** (via different NK natural keys), the staging dedup loses one of them silently.

The interaction with CW-B24: even after staging dedup, if there's still a single staging row but JOINing it against the target table matches **2+ target rows** (Cause B below), we still get the duplicate.

### Cause B — JOIN expansion: 1 staging row matches multiple target rows

Evidence: lines 668-669:
```sql
FROM src s
JOIN sys.<target> t ON (${nkMatchPairs.join(" AND ")})
```

The JOIN predicate uses the NK columns. If those NK fragments don't fully constrain the JOIN (e.g., one of the NK cols is NULL on the src side and `IS NOT DISTINCT FROM` matches all target rows with NULL on that col), the JOIN can be **a multiplier** rather than 1:1.

Concrete scenario for `sys_skills`:
- UQ index: `(COALESCE(skill_tenant_id, sentinel), skill_code)`.
- Target has rows `(NULL, 'CODE_X')` and `(tenant_A, 'CODE_X')`.
- Src row has `__nk_skill_tenant_id = NULL` and `__nk_skill_code = 'CODE_X'`.
- JOIN ON `(t.skill_tenant_id IS NOT DISTINCT FROM s.__nk_skill_tenant_id)` matches **only** `(NULL, 'CODE_X')` — OK, no expansion here.
- BUT if `__nk_skill_code` is also NULL (NK fragment yields NULL) and the WHERE skip filter doesn't catch it (e.g., for varchar NK cols the filter checks UUID only — verified: lines 384-416 check only uuid NK cols + uuid required cols, varchar NK cols are NOT in the skip filter) → JOIN matches ALL target rows where `skill_code IS NULL`. If target has 2+ such rows, BOOM.

### Cause C (most likely, per REPORT X1 "~12+ instances"): The WHERE skip filter doesn't catch all NULL NK cases

Verified by reading lines 384-416:

```typescript
// 5. WHERE skip filter
const skipFilters: string[] = [];
for (const nkCol of targetMeta.naturalKeyColumns) {
  const colType = targetMeta.columnTypes.get(nkCol);
  if (colType !== "uuid") continue;          // <-- ONLY uuid NK cols filtered
  if (nkCol.endsWith("_tenant_id")) continue; // <-- tenant_id NK exempted
  ...
}
for (const reqCol of targetMeta.requiredColumns) {
  ...
  if (colType !== "uuid") continue;          // <-- ONLY uuid required cols filtered
  ...
}
```

So **varchar/text NK cols with NULL values are NOT pre-filtered**. They propagate into the JOIN where `IS NOT DISTINCT FROM NULL` matches all NULL-on-target rows.

### Combined: why ~12+ instances

12 different mappings each have at least one combination where the SELECT produces duplicate `staging_source_record_id`. Most likely root cause is **Cause C** (varchar NK NULL + JOIN expansion), with some contribution from **Cause A** (compound-PK collapse → conceptually duplicates although staging dedup removes raw row duplicates).

---

## §3 — Patch design

### §3.1 Changes per file

#### File: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`

**Change 1 — Dedupe the SELECT output before INSERT, using `DISTINCT ON` on the UQ tuple.**

Replace the `lineageSql` template literal (current lines 627-683) with a version that pre-dedupes via a CTE:

Old code (lines 627-683):
```typescript
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
        ...
      )
    SELECT
      $3::uuid,
      'heuresys_platform',
      s.staging_source_table,
      s.staging_source_record_id,
      ...
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
        ...
  `;
```

New code:
```typescript
  // 8. Lineage write: 1 INSERT via JOIN.
  // CW-B24 — DISTINCT ON the UQ tuple (source_record_id is the only
  // varying component; source_system/source_table/target_table_name are
  // all constants in this statement). This guards against:
  //  (a) Compound-PK source tables where pkColumns[0] alone may collide
  //      across multiple legacy rows (engine.ts:182-183 uses only the
  //      first PK column).
  //  (b) JOIN expansion when an NK column is NULL on src and target has
  //      multiple rows with NULL on the corresponding column (the
  //      varchar/text NK case escapes the WHERE skip filter at lines
  //      384-416, which only filters uuid NK cols).
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
```

**Change 2 — Optional: emit a forensic audit row when the SELECT had duplicates eliminated (so we don't silently lose lineage signal).**

Add immediately AFTER the `pool.query(lineageSql, ...)` block (around line 700), but BEFORE step 9 staging mark:

```typescript
  // CW-B24 forensic — count how many JOIN rows were collapsed by the
  // DISTINCT ON dedup. If > 0, write an audit row so the issue is
  // visible to ops; this is a leading indicator of either compound-PK
  // collapse (Cause A) or NK NULL+JOIN expansion (Cause C).
  if (mode === "EXECUTE" && lineageCount > 0) {
    try {
      const dedupAuditSql = `
        WITH src AS (
          SELECT ${nkAliasSelects}, staging_source_record_id
            FROM ${qStagingTable}
           WHERE ${baseWhere.join(" AND ")}
           ${limitClause}
        ),
        joined_count AS (
          SELECT count(*)::bigint AS n
            FROM src s
            JOIN ${qTargetTable} t ON (${nkMatchPairs.join(" AND ")})
        )
        SELECT (n - $6::bigint) AS collapsed FROM joined_count
      `;
      const dedupRes = await pool.query<{ collapsed: string }>(dedupAuditSql, [
        runId,
        mapping.source_table_name,
        tenantId,
        mapping.table_mapping_id,
        mapping.target_table,
        String(lineageCount),
      ]);
      const collapsed = Number(dedupRes.rows[0]?.collapsed ?? 0);
      if (collapsed > 0) {
        await pool.query(
          `INSERT INTO audit.import_validation_results (
              import_validation_result_run_id,
              import_validation_result_source_table_id,
              import_validation_result_source_record_id,
              import_validation_result_rule_code,
              import_validation_result_status,
              import_validation_result_message,
              import_validation_result_payload
            ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'LINEAGE_DEDUP_COLLAPSED_V1', 'WARNING',
                      $4, $5::jsonb)`,
          [
            runId,
            mapping.source_table_id,
            mapping.table_mapping_id,
            `${collapsed} lineage row(s) collapsed by DISTINCT ON dedup (CW-B24). Likely compound-PK source or NK NULL+JOIN expansion.`,
            JSON.stringify({
              collapsed_count: collapsed,
              kept_count: lineageCount,
              source_table: mapping.source_table_name,
              target_table: mapping.target_table,
              table_mapping_id: mapping.table_mapping_id,
            }),
          ],
        );
      }
    } catch (e) {
      console.error(
        `[sql-side-upsert] CW-B24 dedup audit failed for mapping ${mapping.table_mapping_id}: ${(e as Error).message}`,
      );
      // Continue — audit emission failure should NOT block import.
    }
  }
```

This Change 2 is **optional** but recommended; if scope is tight, ship Change 1 alone and defer the forensic audit to a follow-up.

### §3.2 Alternatives considered + rejected

**Alternative A — Remove `ON CONFLICT` entirely + use `NOT EXISTS` pre-filter.**

- Pro: No more conflict resolution semantics — single insert path.
- Contro: Re-running Wave 1 (a re-import) would silently skip rows that already have lineage; UPDATE semantics on content_hash/confidence/run_id are valuable (current ON CONFLICT DO UPDATE refreshes these). Losing UPDATE is a real loss of audit utility.
- **Rejected**: ON CONFLICT DO UPDATE has correct semantics for idempotent re-imports; the duplicate issue is upstream (multiple SELECT rows), not in conflict handling itself.

**Alternative B — Use `ROW_NUMBER() OVER (PARTITION BY uq_tuple ORDER BY confidence DESC) = 1` instead of `DISTINCT ON`.**

- Pro: More explicit "keep the best of each group" semantics.
- Contro: ROW_NUMBER + WHERE rn=1 requires an additional CTE layer and an extra projection. DISTINCT ON is PG-native, expresses the same intent more concisely, and the planner handles both identically.
- **Rejected** in favor of DISTINCT ON for code clarity. Both are correct.

**Alternative C — Make compound-PK source tables write a multi-column `staging_source_record_id` (e.g., a JSON of all PK cols).**

- Pro: Eliminates Cause A at the root.
- Contro: Requires schema changes to `staging.wave1_*` tables, migration of existing lineage rows, and update of every downstream consumer of `staging_source_record_id`. Massive blast radius for solving one of two causes. The other cause (NK NULL+JOIN expansion) is not addressed.
- **Rejected**: out of scope for an engine-level patch; should be a future ADR if compound-PK becomes a recurring issue.

**Alternative D — Tighten the WHERE skip filter to also exclude varchar/text NK NULL cases.**

- Pro: Removes Cause C at the root.
- Contro: Changes the row-acceptance semantics of the whole upsert pipeline, not just lineage. Some mappings may legitimately have NULL varchar NK cols that get a fallback expression (line 318-323) → they shouldn't be filtered. Risk of regression in upsert row counts.
- **Rejected** for now; DISTINCT ON is a defense-in-depth alternative that protects against both Cause A and Cause C without changing acceptance semantics. The WHERE filter tightening can be a future improvement (CW-B25?).

**Chosen approach (Change 1, optionally Change 2)**: dedupe at the SQL level using `DISTINCT ON` on the conflict UQ tuple. Surgical, doesn't change row-acceptance semantics, addresses both Cause A and Cause C. Optional forensic audit logs how many rows were collapsed for ops visibility.

---

## §4 — Test cases (specific) for CLI to author

### Unit tests (compile-only — SQL string assertions)

**Test 1 — Lineage SQL contains `DISTINCT ON (staging_source_record_id)`**:
```typescript
test("CW-B24: lineage INSERT uses DISTINCT ON dedup", async () => {
  // Capture the generated SQL via a hook or by intercepting pool.query.
  // Easiest: refactor lineageSql build into an exported helper for unit
  // testing, OR snapshot-test the SQL emitted by executeUpsertSqlSidePerMapping
  // with a minimal fixture.
  const sql = buildLineageSqlForTest(/* mockArgs */);
  expect(sql).toContain("DISTINCT ON (staging_source_record_id)");
  expect(sql).toContain("ORDER BY staging_source_record_id");
  expect(sql).toContain("staging_mapping_confidence DESC");
});
```

### Integration tests

**Test 2 — Synthetic compound-PK source → no PG error + collapsed audit row**:
```typescript
test("CW-B24: compound-PK source table produces no lineage conflict error", async () => {
  // Seed legacy_mirror.<test_table> with 2 rows sharing pkColumns[0]
  // but differing in pkColumns[1]. Both should map to the same target
  // row OR different target rows.
  // Trigger Wave 1 (DRY_RUN or EXECUTE with debug_limit).
  // Assert: no ERROR in run events log, no FAILED state, lineage rows
  // present in sys.sys_source_lineage_records.
});
```

**Test 3 — JOIN expansion (NK NULL + target has 2+ matches) → no PG error**:
```typescript
test("CW-B24: NK NULL JOIN expansion produces no lineage conflict", async () => {
  // Pre-populate sys.sys_<target> with 2 rows that both match NULL on
  // some non-uuid NK col. Seed a staging row with NK fragments that
  // would JOIN to both.
  // Assert: lineage INSERT succeeds (no ON CONFLICT DO UPDATE second-time
  // error), 1 row in sys.sys_source_lineage_records for the
  // staging_source_record_id, and audit.import_validation_results has
  // a 'LINEAGE_DEDUP_COLLAPSED_V1' row with collapsed_count >= 1.
});
```

**Test 4 — DISTINCT ON picks the row with highest staging_mapping_confidence**:
```typescript
test("CW-B24: when JOIN produces ties, DISTINCT ON keeps highest confidence", async () => {
  // Seed src to produce 2 joined rows with different
  // staging_mapping_confidence values (e.g., 0.9 and 1.0).
  // Assert: sys.sys_source_lineage_records contains the row with
  // confidence 1.0, NOT 0.9.
});
```

**Test 5 — Re-import idempotency: second wave run doesn't break ON CONFLICT DO UPDATE**:
```typescript
test("CW-B24: second wave 1 run updates existing lineage rows without error", async () => {
  await triggerWave1({ mode: "EXECUTE", debugLimit: 50 });
  const before = await pool.query("SELECT count(*) FROM sys.sys_source_lineage_records");
  // Re-trigger the same wave with a new run_id; content_hash should
  // unchange but import_run_id should refresh.
  await triggerWave1({ mode: "EXECUTE", debugLimit: 50 });
  const after = await pool.query("SELECT count(*) FROM sys.sys_source_lineage_records");
  expect(after.rows[0].count).toBe(before.rows[0].count); // same UQ tuples → updated, not inserted
});
```

### Regression test (post-Wave-1 retry)

**Test 6 — Full Wave 1 retry: zero `ON CONFLICT DO UPDATE … second time` errors in console.error log**:
```text
Run: pnpm test -- wave-executor.integration --bail
Grep test stderr / run events log for the literal string
"ON CONFLICT DO UPDATE command cannot affect row a second time"
Expected: ZERO occurrences.
```

---

## §5 — Acceptance criteria post-patch

### Query 1 — Verify no lineage write failures in run events

```sql
SELECT COUNT(*)
  FROM audit.brownfield_wave_executor_run_events
 WHERE run_id = '<latest-run-id>'
   AND (
        payload->>'error_class' = 'error'
        AND payload->>'message' ILIKE '%ON CONFLICT DO UPDATE%'
       );
```

**Expected**: `0`.

### Query 2 — Verify lineage row count matches expected staging rows

```sql
WITH
  upserted_total AS (
    SELECT SUM(stats_row->>'upsertedRows')::bigint AS n
      FROM (
        SELECT jsonb_array_elements(wave_stats) AS stats_row
          FROM audit.brownfield_wave_executor_runs
         WHERE run_id = '<latest-run-id>'
      ) x
  ),
  lineage_total AS (
    SELECT count(*) AS n
      FROM sys.sys_source_lineage_records
     WHERE source_lineage_import_run_id = '<latest-run-id>'
  )
SELECT
  upserted_total.n  AS upserted_rows,
  lineage_total.n   AS lineage_rows,
  upserted_total.n - lineage_total.n AS deficit
FROM upserted_total, lineage_total;
```

**Expected**:
- `deficit = 0` (every upserted row has a corresponding lineage row)
- OR `deficit > 0` BUT a corresponding `LINEAGE_DEDUP_COLLAPSED_V1` audit row exists explaining the deficit
- Should NEVER see `deficit > 0` without an explanatory audit row.

### Query 3 — Forensic: count of dedup-collapsed audit rows

```sql
SELECT
  import_validation_result_payload->>'source_table' AS source,
  import_validation_result_payload->>'target_table' AS target,
  (import_validation_result_payload->>'collapsed_count')::bigint AS collapsed,
  (import_validation_result_payload->>'kept_count')::bigint AS kept
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<latest-run-id>'
   AND import_validation_result_rule_code = 'LINEAGE_DEDUP_COLLAPSED_V1'
 ORDER BY collapsed DESC;
```

**Expected**: 0 to N rows. Each row identifies a mapping where dedup collapsed lineage entries — actionable signal for further investigation (likely a compound-PK source or NK NULL+JOIN expansion).

---

## §6 — Risk + rollback

### Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| DISTINCT ON picks the "wrong" row when multiple JOIN matches are legitimately distinct lineage entries | MED | MED — lineage trail loses one of the legit matches | Forensic audit (Change 2) surfaces every collapse; ops can investigate per-mapping. Long-term, fix Cause A (compound-PK) at staging-load level. |
| ORDER BY tie-breaking is non-deterministic | LOW | LOW — different reruns might pick different target_pk for tied rows | Tie-breaker is `staging_row_id ASC` which IS stable (staging_row_id is a bigint sequence) → deterministic. |
| Adding a CTE layer slows the lineage INSERT | LOW | LOW — DISTINCT ON on a small `joined` CTE is O(n log n) on n=20k = negligible | Run EXPLAIN ANALYZE on the new query post-patch; expected total time ≤ 500 ms per mapping. |
| Change 2 audit query (the forensic count) duplicates JOIN work | LOW | LOW — adds ~200 ms per mapping × 17 mappings = ~3 s total | Acceptable cost for observability. Can be feature-flagged off via `WAVE1_FORENSIC_AUDIT=0` env if it becomes a problem. |

### Rollback procedure

If the patch causes regression:

1. `git revert` Change 1 (lineage SQL rewrite). Optional: also revert Change 2 (forensic audit).
2. Re-run `pnpm test`. Baseline should be green.
3. Re-trigger Wave 1. Lineage failures will recur but target writes still succeed.

No DB schema changes. No data migration needed. Pure code revert.

---

## §7 — Effort estimate for CLI

| Step | Effort |
|---|---|
| Read patch spec + understand context | 20 min |
| Apply Change 1 (lineage SQL rewrite with CTE) | 25 min |
| Apply Change 2 (optional forensic audit) | 20 min |
| Write Tests 1-5 (unit + integration) | 90 min |
| Write Test 6 (regression grep) | 15 min |
| Run `pnpm test` baseline + verify all 69+ green plus new tests | 20 min |
| Wave 1 retry + verify Query 1-3 acceptance + capture forensic dedup signal | 30 min |
| Atomic commit + push | 10 min |
| **Total (Change 1 only)** | **~3 h** |
| **Total (Change 1+2)** | **~3.5 h** |

**Confidence on estimate**: MEDIUM. The SQL rewrite itself is straightforward but the integration tests (Tests 2-4) need careful fixture setup to reproduce the duplicate scenarios — that's where the time could vary.

---

## §8 — Open items / needs CLI runtime verification

- **Q1**: CLI needs to run an EXPLAIN ANALYZE on the new lineage SQL with a representative staging table (e.g., `wave1_skills` with 20k rows) to confirm the CTE-based plan stays under 500 ms.
- **Q2**: Which of the ~12 reported mappings hit Cause A vs Cause C? CLI should grep the Change 2 forensic audit output post-patch to categorize them; this informs whether a follow-up CW-B25 (tighten WHERE skip filter for varchar NK NULL) is needed.
- **Q3**: Does PG 16's planner cost-estimate the DISTINCT ON CTE accurately when stats are fresh? Should land **after CW-B23 (ANALYZE)** for best results. With stale stats, DISTINCT ON might pick a sort-then-unique plan when hash-aggregate would be faster.
- **Q4**: The forensic audit Change 2 issues a second JOIN-count query. For mappings with 20k JOIN rows this adds ~200ms. CLI to confirm acceptable. If not, feature-flag it: `if (process.env.WAVE1_FORENSIC_AUDIT !== '0') { … }`.

If Q3 surfaces a planner issue, additional `STATISTICS` hint or a hash-aggregate setting may be needed — defer to follow-up patch if observed.
