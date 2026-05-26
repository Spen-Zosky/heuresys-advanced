# CW-B22 Patch Spec — `IS NOT DISTINCT FROM` → `=` optimization

**Author**: Cowork (deep-investigation C2.1)
**Date**: 2026-05-21
**Confidence**: HIGH
**Status**: AUTHORED — pending CLI X2 apply + test

---

## §1 — Problem statement

### Evidence from REPORT X1

- Wave 1 retry observed: Server PID 2686101 **stuck 17 min** on `staging.wave1_activity_classifications` staging-mark UPDATE (step 9 in `upsert-sql.ts`).
- Root cause stated by CLI: predicate `IS NOT DISTINCT FROM` cannot use btree index `sys_activity_classifications_scheme_code_uq`.
- Cardinality involved: 3284 staging rows × 3276 target rows = ~10M nested-loop comparisons instead of an indexed lookup.
- Same pattern affects step 8 (lineage write) and step 7 (NK match pairs build) on **all 17 Wave 1 target tables**, with worst-case cardinalities:
  - `sys_skills` ≈ 20048 rows
  - `sys_skill_taxonomy_edges` ≈ 17940 rows
  - `sys_activity_classifications` ≈ 3276 rows (the one that stalled)

### Exact code location

File: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`

| Step | Lines | What it does |
|---|---|---|
| 7 — NK match pairs build | 603–611 | Emits `(t.<nk> IS NOT DISTINCT FROM s.__nk_<nk>)` for each NK column |
| 8 — Lineage write JOIN | 627–683 | JOIN `src` ↔ `target` on `nkMatchPairs.join(" AND ")` |
| 9 — Staging mark UPDATE | 702–717 | Same `nkMatchPairs` reused in JOIN |

The single source of `nkMatchPairs` is line 608–610:
```typescript
nkMatchPairs.push(
  `(t.${format("%I", nkCol)} IS NOT DISTINCT FROM s.${format("%I", `__nk_${nkCol}`)})`,
);
```

### Why `IS NOT DISTINCT FROM` is slow

PostgreSQL's btree operator class for varchar/uuid does **not** include `IS NOT DISTINCT FROM` — only `=`, `<`, `>`, etc. When the planner sees `t.col IS NOT DISTINCT FROM s.col` it falls back to a sequential scan (or nested loop with seq scan on the inner relation). The UQ index `sys_activity_classifications_scheme_code_uq` is btree → unusable for this predicate.

By contrast `t.col = s.col` is supported by btree and the planner picks index-nested-loop or hash-join with index scan.

---

## §2 — Root cause analysis

### Why was `IS NOT DISTINCT FROM` chosen in the first place?

Reading the surrounding code (upsert-sql.ts §2 NK fallback + §5 WHERE skip filter), the NK columns are populated by `colEntries` SQL fragments that may evaluate to NULL in three cases:

1. **Compiled NK fragment yields NULL** (e.g., source column missing in `staging_raw_record->>`)
2. **NK column = `<short>_tenant_id`** → upsert-sql.ts line 312-313 explicitly assigns `NULL::uuid` and line 389 explicitly **exempts** `_tenant_id` NK cols from the WHERE skip filter
3. **Non-UUID NK fallback** to `COALESCE(staging_source_natural_key, 'OLDDB::' || ...)` (lines 318-323) — but this expression is `NOT NULL` by construction (staging_source_natural_key is always populated by `executeStage` in engine.ts:199)

So the **only NK column path that legitimately may be NULL is `_tenant_id`**. For all other NK columns the WHERE skip filter (lines 384-416) excludes any row whose NK value would be NULL — making `IS NOT DISTINCT FROM` semantically equivalent to `=` for the rows that actually reach step 7-8-9.

### Index landscape verified

Searched `db/migrations/*.sql` for UQ indexes on Wave 1 target tables:

| Target table | UQ index expr (from migration) | Plain cols / Expression-based |
|---|---|---|
| `sys_activity_classifications` | `(scheme, code)` (000007:35) | Plain (2 cols NOT NULL varchar) |
| `sys_skill_taxonomy_edges` | `(parent_id, child_id, kind)` (000013:141) | Plain (3 cols NOT NULL) |
| `sys_skills` | `(COALESCE(skill_tenant_id, '00…'::uuid), skill_code)` (000013:104) | **Expression-based** on tenant_id |
| `sys_skill_aliases` | `(skill_id, lower(label), COALESCE(locale, ''))` (000013:156) | **Expression-based** |
| `sys_skill_categories` / `sys_skill_families` | `(code)` (000013:25/42) | Plain |
| `sys_skill_learning_mappings` | `pair_uq` (000016:134) | Need verify but likely plain |

**Critical nuance**: when the UQ index uses `COALESCE(<col>, 'sentinel')` or `lower(<col>)`, raw column equality on `<col>` does NOT automatically use the index. The planner needs the JOIN predicate to **match the indexed expression** to choose the index scan path.

This means the fix is not a simple global `IS NOT DISTINCT FROM → =` replacement — it must be **index-aware** to ensure the new predicate aligns with the indexed expression for each target table.

---

## §3 — Patch design

### §3.1 Changes per file

#### File: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`

**Change 1 — Add helper `buildNkJoinPredicate` that emits index-aligned predicates.**

Insert after the existing helpers (before `executeUpsertSqlSidePerMapping`), around line 173 (post `ColEntry` interface):

```typescript
/**
 * CW-B22 — emits an index-aligned JOIN predicate for a single NK column.
 *
 * Rationale: `IS NOT DISTINCT FROM` is not supported by btree operator
 * classes, so the planner falls back to nested-loop seqscan even when a
 * UQ index covers the NK columns. The WHERE skip filter in this module
 * already eliminates any row where a non-tenant NK column would be NULL,
 * so for those columns we can safely use plain `=` and gain index scan.
 *
 * The only NK column that legitimately tolerates NULL is the
 * `<short>_tenant_id` column (line 312-313 of this file explicitly
 * assigns NULL::uuid for global rows, and line 389 of the skip filter
 * exempts `_tenant_id` NK cols from the NOT NULL check).
 *
 * Strategy:
 *   - For `_tenant_id` NK col → keep IS NOT DISTINCT FROM semantics by
 *     emitting COALESCE on both sides with a sentinel uuid. This matches
 *     the indexed expression used in sys.sys_skills UQ index
 *     (000013_skill_taxonomy_model.sql:105):
 *       COALESCE(skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
 *   - For all other NK cols → emit plain `t.col = s.col`. The WHERE
 *     skip filter (lines 384-416) guarantees both sides are NOT NULL
 *     for the rows that reach the JOIN.
 *
 * The targetMeta argument is needed only for the tenant_id column type
 * lookup; callers pass it through.
 */
const TENANT_NULL_SENTINEL_UUID =
  "'00000000-0000-0000-0000-000000000000'::uuid";

function buildNkJoinPredicate(
  nkCol: string,
  nkAliasCol: string,
  colType: string | undefined,
): string {
  const tCol = format("t.%I", nkCol);
  const sCol = format("s.%I", nkAliasCol);
  // _tenant_id NK columns are explicitly nullable on both sides and the
  // sys_*_uq index uses COALESCE(<col>, sentinel). Emit a predicate
  // that matches the indexed expression so btree can be used.
  if (colType === "uuid" && nkCol.endsWith("_tenant_id")) {
    return `(COALESCE(${tCol}, ${TENANT_NULL_SENTINEL_UUID}) = COALESCE(${sCol}, ${TENANT_NULL_SENTINEL_UUID}))`;
  }
  // For every other NK column, WHERE skip filter already guarantees
  // NOT NULL on both sides for the rows that reach the join. Plain `=`
  // is safe AND uses the btree index.
  return `(${tCol} = ${sCol})`;
}
```

**Change 2 — Replace the single-line `nkMatchPairs.push(...)` at lines 603–611.**

Old code (lines 603-611):
```typescript
const nkMatchPairs: string[] = [];
for (const nkCol of targetMeta.naturalKeyColumns) {
  if (!targetMeta.columns.has(nkCol)) continue;
  const entry = colEntries.find((e) => e.targetCol === nkCol);
  if (!entry) continue;
  nkMatchPairs.push(
    `(t.${format("%I", nkCol)} IS NOT DISTINCT FROM s.${format("%I", `__nk_${nkCol}`)})`,
  );
}
```

New code:
```typescript
const nkMatchPairs: string[] = [];
for (const nkCol of targetMeta.naturalKeyColumns) {
  if (!targetMeta.columns.has(nkCol)) continue;
  const entry = colEntries.find((e) => e.targetCol === nkCol);
  if (!entry) continue;
  // CW-B22 — use buildNkJoinPredicate to emit btree-friendly equality.
  // For _tenant_id NK col, emit COALESCE(<both sides>, sentinel) which
  // matches the UQ index expression (e.g. sys_skills_tenant_code_uq).
  // For all other NK cols, plain `=` (rows with NULL NK are pre-filtered
  // by the WHERE skip filter, lines 384-416).
  const colType = targetMeta.columnTypes.get(nkCol);
  nkMatchPairs.push(
    buildNkJoinPredicate(nkCol, `__nk_${nkCol}`, colType),
  );
}
```

**Rationale for changes**:
- The new predicate is btree-friendly for **all** Wave 1 target tables (verified migrations 000007, 000013, 000016).
- Backwards compatibility: COALESCE on `_tenant_id` produces identical semantics to `IS NOT DISTINCT FROM` for the tenant_id case, while plain `=` is provably equivalent for non-tenant NK cols given the WHERE skip filter.
- Single helper, single replacement point: maintenance burden minimal.
- The fix lands in step 7 (build pairs); step 8 (lineage) and step 9 (staging mark) automatically consume the new `nkMatchPairs` because they reference the same array (lines 669, 715 in current code).

### §3.2 Alternatives considered + rejected

**Alternative A — Drop `IS NOT DISTINCT FROM` everywhere, use unconditional `=`.**

- Pro: Simplest possible change (1-line replacement).
- Contro: Breaks for `_tenant_id` NK col where both sides may legitimately be NULL. PG `NULL = NULL` returns NULL (false), so global-tenant rows would never match and lineage/staging-mark would silently fail to attach them — a regression worse than the current 17-min stall.
- **Rejected**: silent data loss is unacceptable.

**Alternative B — Pre-filter rows in WHERE to guarantee non-NULL on all NK cols including `_tenant_id`, then use plain `=` for all.**

- Pro: Uniform predicate, no special-case helper.
- Contro: Excludes legitimate global-tenant rows (tenant_id NULL → COALESCE sentinel in indexed expression). The skip filter would need a redesign coordinated with the WHERE clause used by the INSERT … SELECT (step 6) — much bigger blast radius.
- **Rejected**: too much architectural disturbance; same effect achievable with localized helper.

**Alternative C — Switch the UQ index for `sys_skills` to a non-expression form** (drop COALESCE, use `(skill_tenant_id, skill_code)` and let NULL tenant_id rows coexist as long as `_code` differs).

- Pro: Removes need for COALESCE in the JOIN predicate entirely.
- Contro: Breaks existing constraint semantics (global skill uniqueness no longer enforced across NULL tenants). Migration would orphan all global-tenant ON CONFLICT inferences that already use COALESCE form. Requires a coordinated DB migration + code change spanning multiple PRs.
- **Rejected**: solves a smaller problem at a much larger cost.

**Chosen approach (Change 1+2)**: localized helper that emits the index-matching expression per column type. Zero DB schema changes. Minimal code disturbance.

---

## §4 — Test cases (specific) for CLI to author

### Unit tests (apps/api/test/wave-executor-upsert-sql.test.ts — extend existing or create new file)

**Test 1 — `buildNkJoinPredicate` emits COALESCE for `_tenant_id` NK column**:
```typescript
import { /* TBD: export buildNkJoinPredicate or test via integration */ } from "../src/modules/brownfield-wave-executor/upsert-sql";

test("CW-B22: tenant_id NK column emits COALESCE predicate", () => {
  // Suggested: expose buildNkJoinPredicate as a non-default export
  const pred = buildNkJoinPredicate("skill_tenant_id", "__nk_skill_tenant_id", "uuid");
  expect(pred).toContain("COALESCE");
  expect(pred).toContain("'00000000-0000-0000-0000-000000000000'::uuid");
  expect(pred).not.toContain("IS NOT DISTINCT FROM");
});
```

**Test 2 — `buildNkJoinPredicate` emits plain `=` for non-tenant NK columns**:
```typescript
test("CW-B22: non-tenant NK column emits plain equality", () => {
  const pred = buildNkJoinPredicate("activity_classification_scheme", "__nk_activity_classification_scheme", "varchar");
  expect(pred).toBe('(t."activity_classification_scheme" = s."__nk_activity_classification_scheme")');
  expect(pred).not.toContain("IS NOT DISTINCT FROM");
  expect(pred).not.toContain("COALESCE");
});
```

**Test 3 — `buildNkJoinPredicate` for uuid NK that is NOT tenant_id (e.g., skill_taxonomy_edge_parent_id)**:
```typescript
test("CW-B22: non-tenant uuid NK emits plain equality", () => {
  const pred = buildNkJoinPredicate("skill_taxonomy_edge_parent_id", "__nk_skill_taxonomy_edge_parent_id", "uuid");
  expect(pred).toBe('(t."skill_taxonomy_edge_parent_id" = s."__nk_skill_taxonomy_edge_parent_id")');
});
```

### Integration test (apps/api/test/wave-executor.integration.test.ts)

**Test 4 — Generated `nkMatchPairs` SQL uses `=` not `IS NOT DISTINCT FROM`**:
```typescript
test("CW-B22: lineage write SQL uses index-friendly equality, not IS NOT DISTINCT FROM", async () => {
  // After running wave 1 with WAVE1_DEBUG_LIMIT=20, capture the
  // generated INSERT INTO sys.sys_source_lineage_records SQL via a
  // server-log probe or query-log capture. Assert that the JOIN ON
  // clause contains exactly one " = " predicate per NK column and
  // zero "IS NOT DISTINCT FROM" predicates.
});
```

**Test 5 — EXPLAIN ANALYZE on synthetic lineage JOIN uses index scan**:
```typescript
test("CW-B22: synthetic JOIN on sys_activity_classifications uses btree index", async () => {
  // Seed a minimal staging.wave1_activity_classifications with 100 rows,
  // run EXPLAIN ANALYZE on the actual lineage-write query, assert plan
  // contains "Index Scan using sys_activity_classifications_scheme_code_uq"
  // and NOT "Seq Scan".
  // (Requires test fixture utility; alternative: snapshot the JOIN clause
  // as string and assert grep "= " in the join condition.)
});
```

### Regression test (post-Wave-1 retry)

**Test 6 — Full Wave 1 retry: no step-9 stall on `wave1_activity_classifications`**:
```text
Run: pnpm test -- wave-executor.integration --bail
With env: WAVE1_DEBUG_LIMIT unset (full 47k rows)
Acceptance: total wall time ≤ 5 min (was ≥ 17 min stuck on step 9 alone).
```

---

## §5 — Acceptance criteria post-patch

### Query 1 — UQ index used for `sys_activity_classifications` JOIN

After deploying the patch, run the following EXPLAIN ANALYZE on a freshly-staged `staging.wave1_activity_classifications`:

```sql
-- Simulates step 8 lineage JOIN
EXPLAIN (ANALYZE, BUFFERS)
  WITH src AS (
    SELECT staging_source_record_id,
           (staging_raw_record->>'classification_scheme') AS __nk_activity_classification_scheme,
           (staging_raw_record->>'classification_code')   AS __nk_activity_classification_code
      FROM staging.wave1_activity_classifications
     WHERE staging_validation_status = 'PASSED'
       AND staging_target_record_id IS NULL
     LIMIT 1000
  )
  SELECT t.activity_classification_id
    FROM src s
    JOIN sys.sys_activity_classifications t
      ON (t.activity_classification_scheme = s.__nk_activity_classification_scheme)
     AND (t.activity_classification_code   = s.__nk_activity_classification_code);
```

**Expected**: plan contains `Index Scan using sys_activity_classifications_scheme_code_uq` OR `Index Cond:` with the NK columns. Should NOT see `Seq Scan on sys_activity_classifications`.

**Wall time**: ≤ 100 ms for 1000-row probe (current pre-patch would be seconds at this scale, minutes at 3284 rows).

### Query 2 — UQ index used for `sys_skills` JOIN (with COALESCE on tenant_id)

```sql
EXPLAIN (ANALYZE, BUFFERS)
  WITH src AS (
    SELECT staging_source_record_id,
           NULL::uuid                                       AS __nk_skill_tenant_id,
           (staging_raw_record->>'skill_code')              AS __nk_skill_code
      FROM staging.wave1_skills
     WHERE staging_validation_status = 'PASSED'
       AND staging_target_record_id IS NULL
     LIMIT 1000
  )
  SELECT t.skill_id
    FROM src s
    JOIN sys.sys_skills t
      ON COALESCE(t.skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = COALESCE(s.__nk_skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND (t.skill_code = s.__nk_skill_code);
```

**Expected**: plan uses `sys_skills_tenant_code_uq` index scan (the index is built on the COALESCE expression).

### Query 3 — Wave 1 retry completes without stall

End-to-end acceptance: full Wave 1 run (no DEBUG_LIMIT) finishes in ≤ 10 min wall clock. The single mapping that stalled 17 min (`wave1_activity_classifications`) should complete its full step 7+8+9 in ≤ 30 s.

---

## §6 — Risk + rollback

### Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Future NK column gains nullable semantics (e.g., new optional FK) | LOW | MED — would cause silent data loss | Add a comment + runtime assert: `if (colType === 'uuid' && nkCol !== <known tenant cols>) throw if WHERE skip filter doesn't exclude NULL` |
| UQ index drops or is rewritten in future migration | LOW | MED — fix would still work, just lose index scan | DBA review at migration time; CW-B22 helper is a perf optimization, not a correctness change |
| Expression-based UQ on a column not anticipated (e.g., a `lower(<col>)` UQ on a new table) | LOW | LOW — fix still correct, just no index scan benefit | Audit future Wave N target tables: if UQ uses `lower()/COALESCE()`, replicate the COALESCE-aware pattern |
| New non-tenant NK column that legitimately allows NULL | VERY LOW | MED | Documented in comment block; require code review check |

### Rollback procedure

If the patch causes any regression (acceptance test fail, observed correctness issue):

1. `git revert` the commit applying Change 1 + Change 2 (both in `upsert-sql.ts`).
2. Re-run `pnpm test` to confirm baseline green.
3. Re-trigger Wave 1 (will be slow again but data correctness preserved).
4. Investigate failure → likely a NK column whose schema assumption was wrong → patch the helper to handle that case explicitly.

No DB migration is involved, no irreversible operations. Pure code revert.

---

## §7 — Effort estimate for CLI

| Step | Effort |
|---|---|
| Read patch spec + understand context | 15 min |
| Apply Change 1 (add helper) + Change 2 (call site swap) | 10 min |
| Write Tests 1-3 (unit) | 30 min |
| Write Tests 4-5 (integration / EXPLAIN) | 45 min |
| Run `pnpm test` baseline + verify all 69+ tests still green | 15 min |
| Wave 1 retry (full data) + verify no 17-min stall | 15 min |
| Capture EXPLAIN ANALYZE output for §5 acceptance | 15 min |
| Atomic commit + push | 10 min |
| **Total** | **~2.5 h** |

**Confidence on estimate**: HIGH for the apply+test part. The Wave 1 retry duration is the main wildcard — if other unrelated issues surface during retry, that time may extend.

---

## §8 — Open items / needs CLI runtime verification

- **Q1**: Does PG 16 actually use the btree UQ index on `sys_activity_classifications_scheme_code_uq` for the new predicate? The migration confirms btree (no `USING gist/hash` clause), but final EXPLAIN ANALYZE confirms it. CLI must capture the post-patch plan.
- **Q2**: Are there other UQ indexes on Wave 1 target tables we haven't surveyed? Specifically `sys_skill_learning_mappings_pair_uq` (000016:134) — its column list needs spot-check. CLI to verify with `\d sys.sys_skill_learning_mappings` and confirm both NK cols are NOT NULL.
- **Q3**: The proposed `TENANT_NULL_SENTINEL_UUID` value `'00000000-…'::uuid` must match the EXACT sentinel used in `CREATE UNIQUE INDEX` for each tenant-aware target. CLI to grep `db/migrations/*.sql` for `COALESCE(.*_tenant_id` and confirm all use the same sentinel.

If any of Q1-Q3 surfaces a mismatch, the helper needs to be parametrized per table (uncommon: the sentinel is a project-wide convention).
