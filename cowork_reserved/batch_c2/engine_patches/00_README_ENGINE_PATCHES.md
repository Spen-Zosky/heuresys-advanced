# 00 README — Engine Patches Batch C2.1

**Author**: Cowork (deep-investigation autonomous task)
**Date**: 2026-05-21
**Source**: REPORT X1 from CLI Wave 1 retry observations
**Status**: Patch specs AUTHORED — pending CLI X2 apply + acceptance

---

## §1 — Scope

This directory contains patch specs for the three critical issues identified by CLI in REPORT X1 §5 of the Wave 1 retry:

| ID | Topic | File | Confidence | Effort (CLI apply+test) |
|---|---|---|---|---|
| CW-B22 | `IS NOT DISTINCT FROM` → `=` optimization | `CW_B22_PATCH_SPEC.md` | HIGH | ~2.5 h |
| CW-B23 | ANALYZE staging tables post-populate | `CW_B23_PATCH_SPEC.md` | HIGH | ~2.5 h |
| CW-B24 | Lineage self-conflict fix (DISTINCT ON dedup) | `CW_B24_PATCH_SPEC.md` | MED-HIGH | ~3 h (3.5 h with optional Change 2) |
| **Total** | — | — | — | **~8 h** sequential, **~3 h** parallel (Change 1 each) |

All three patches target a single file each (engine.ts and/or upsert-sql.ts and/or service.ts), are read-only code investigations (NO live changes), and are designed to land in a single Wave 1 retry cycle.

---

## §2 — Integration order

**Recommended apply order**: CW-B22 → CW-B23 → CW-B24, in three sequential atomic commits (or one combined commit if the CI test suite passes with all three landed).

### Why this order

1. **CW-B22 first** (highest direct impact on the observed 17-min stall). Replaces `IS NOT DISTINCT FROM` with index-friendly `=`. Pure SQL semantics equivalence, zero behavioral change. If something breaks here, easy to revert in isolation.

2. **CW-B23 second** (hygiene + planner correctness). Adds ANALYZE between STAGE and VALIDATE phases. Doesn't change query semantics anywhere; just refreshes pg_class statistics. Best landed AFTER CW-B22 because:
   - With CW-B22 applied, the JOIN predicates are now index-friendly. The planner needs good stats to actually pick the index scan path — CW-B23 provides those stats.
   - If CW-B23 lands BEFORE CW-B22, the planner has good stats but still can't use the btree index due to `IS NOT DISTINCT FROM` → smaller perf win.

3. **CW-B24 last** (correctness fix for lineage dedup). Adds DISTINCT ON to lineage INSERT. The dedup logic depends on the JOIN behaving correctly, which CW-B22 helps with (faster, more predictable plans). CW-B24's audit query (Change 2) also benefits from fresh stats (CW-B23). So CW-B24 lands cleanest with both prior patches in place.

### Why combined commit could also work

All three patches are **independent at the code level**:
- CW-B22 touches lines 603-611 of upsert-sql.ts + adds a helper.
- CW-B23 touches engine.ts (new exported function) + service.ts (import + call site).
- CW-B24 touches lines 627-683 of upsert-sql.ts + optional forensic audit block.

No overlapping line ranges. They could be applied as three commits or one bundled commit per CLI preference. **Recommendation**: three commits for cleaner bisect if anything regresses.

### Hard ordering constraint

There is **no** hard dependency — any one of the three could ship without the others. However:
- Skipping CW-B22 leaves the 17-min stall on the table.
- Skipping CW-B23 hides any future stat-driven planner regressions.
- Skipping CW-B24 keeps the ~12+ lineage failures per Wave 1 run (silent data trail loss).

For full closure of REPORT X1 §5 P0/P1 items, **all three must land**.

---

## §3 — Interaction matrix

|   | CW-B22 (IS NOT DISTINCT FROM → =) | CW-B23 (ANALYZE) | CW-B24 (DISTINCT ON dedup) |
|---|---|---|---|
| **CW-B22** | — | Complementary: B22 needs good stats from B23 to pick index scan reliably | Complementary: B24's dedup CTE benefits from B22's faster JOIN |
| **CW-B23** | Complementary | — | Complementary: B24's DISTINCT ON cardinality estimate improves with B23 |
| **CW-B24** | Complementary (B22 makes JOIN deterministic and fast) | Complementary | — |

**Bottom line**: there is no antagonism between any pair. All three are additive in benefit.

---

## §4 — Global acceptance criteria

After all three patches land + Wave 1 retry runs, all of the following must hold:

### A1 — No 17-min stall

Wave 1 full run (no `WAVE1_DEBUG_LIMIT`) completes in **≤ 10 min wall clock**. No single mapping's UPSERT phase exceeds **60 s** for staging-mark (step 9). Capture via:

```sql
SELECT message, occurred_at,
       LAG(occurred_at) OVER (ORDER BY occurred_at) AS prev_ts,
       occurred_at - LAG(occurred_at) OVER (ORDER BY occurred_at) AS step_duration
  FROM audit.brownfield_wave_executor_run_events
 WHERE run_id = '<latest-run-id>'
 ORDER BY occurred_at ASC;
```

Expected: no `step_duration` > 60 s.

### A2 — No PG `ON CONFLICT DO UPDATE second time` errors

```sql
SELECT count(*)
  FROM audit.brownfield_wave_executor_run_events
 WHERE run_id = '<latest-run-id>'
   AND level = 'ERROR'
   AND payload::text ILIKE '%ON CONFLICT DO UPDATE command cannot affect row a second time%';
```

Expected: `0`. Pre-patch baseline (from REPORT X1): ≥ 12.

### A3 — Lineage row count parity

For every mapping in the run, `upserted_rows ≈ lineage_rows` (DISTINCT ON may collapse a few in compound-PK cases; the gap must equal the sum of `collapsed_count` from `LINEAGE_DEDUP_COLLAPSED_V1` audit rows):

```sql
WITH upserts AS (
  SELECT jsonb_array_elements(wave_stats)->>'target' AS target,
         (jsonb_array_elements(wave_stats)->>'upsertedRows')::bigint AS up,
         (jsonb_array_elements(wave_stats)->>'lineageRows')::bigint AS ln
    FROM audit.brownfield_wave_executor_runs
   WHERE run_id = '<latest-run-id>'
),
collapsed AS (
  SELECT (import_validation_result_payload->>'target_table') AS target,
         SUM((import_validation_result_payload->>'collapsed_count')::bigint) AS collapsed
    FROM audit.import_validation_results
   WHERE import_validation_result_run_id = '<latest-run-id>'
     AND import_validation_result_rule_code = 'LINEAGE_DEDUP_COLLAPSED_V1'
   GROUP BY 1
)
SELECT u.target, u.up, u.ln, COALESCE(c.collapsed, 0) AS collapsed,
       u.up - u.ln - COALESCE(c.collapsed, 0) AS unexplained_gap
  FROM upserts u
  LEFT JOIN collapsed c USING (target)
 ORDER BY unexplained_gap DESC;
```

Expected: `unexplained_gap = 0` for every row. Any non-zero unexplained_gap surfaces a residual lineage loss path that the patches missed → investigate.

### A4 — STAGE_ANALYZE_COMPLETE event present

```sql
SELECT count(*) FROM audit.brownfield_wave_executor_run_events
 WHERE run_id = '<latest-run-id>' AND message = 'STAGE_ANALYZE_COMPLETE';
```

Expected: exactly 1 (per CW-B23).

### A5 — EXPLAIN shows index scan on activity_classifications JOIN

Probe query (synthetic post-Wave-1):
```sql
EXPLAIN (ANALYZE, BUFFERS)
  WITH src AS (
    SELECT (staging_raw_record->>'classification_scheme') AS __nk_activity_classification_scheme,
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

Expected: plan contains `Index Scan using sys_activity_classifications_scheme_code_uq` OR equivalent index-using node. Should NOT see `Seq Scan on sys_activity_classifications`.

### A6 — `pnpm test` all green

`pnpm test` in `apps/api` must remain at ≥ baseline 69 tests + new tests from each patch (target: ≥ 75 tests green, 0 failures).

---

## §5 — File index

| File | Bytes (approx) | Purpose |
|---|---|---|
| `00_README_ENGINE_PATCHES.md` | this file | Index + integration order + global acceptance |
| `CW_B22_PATCH_SPEC.md` | ~16k | IS NOT DISTINCT FROM → = with COALESCE-aware helper |
| `CW_B23_PATCH_SPEC.md` | ~14k | ANALYZE post-stage with new exported function + service.ts call site |
| `CW_B24_PATCH_SPEC.md` | ~17k | DISTINCT ON dedup in lineage INSERT + optional forensic audit |

---

## §6 — Constraints and self-imposed limits

- **NO code modifications**: this directory contains specs only. CLI X2 applies them.
- **NO database changes**: zero migration files, zero schema touches.
- **All file references are absolute**: `D:\heuresys-advanced\apps\api\src\modules\brownfield-wave-executor\<file>.ts` — line numbers cited match the file state observed during this investigation (working tree post-commits `1443b54` + `56f3b03`).
- **All SQL fragments are PG 16 syntax** (target runtime: OCI VM PostgreSQL 16, port 5433 via SSH tunnel).
- **All test signatures use vitest** (consistent with `apps/api/vitest.config.ts`).
- **Patch confidence levels**:
  - HIGH: CW-B22 + CW-B23 — well-understood PG behavior, low ambiguity, surgical changes.
  - MEDIUM-HIGH: CW-B24 — root cause inferred from code reading; CLI runtime verification (EXPLAIN, forensic audit counts) recommended to confirm Cause A vs Cause C breakdown.

---

## §7 — Out of scope (deferred)

These follow-up items emerged during this investigation but are NOT included in the three patches:

1. **Compound-PK source tables: lossy single-column `staging_source_record_id`** (Cause A behind CW-B24). The current `engine.ts:182-183` uses only `pkColumns[0]`, silently collapsing compound-PK source rows. CW-B24's DISTINCT ON is a downstream defense; a proper fix would compose a JSON of all PK columns. Future ADR candidate.
2. **WHERE skip filter doesn't cover varchar/text NK NULL cases** (Cause C behind CW-B24). The skip filter at upsert-sql.ts:384-416 filters only uuid NK and uuid required cols. Tightening this filter for varchar/text NK NULL is a candidate CW-B25.
3. **Wave 2/3 executor analogues**: when Wave 2 is built, it will need its own `analyzeWave2Staging` helper paralleling the CW-B23 pattern. Worth documenting as a template in `docs/api/`.
4. **Lineage UQ definition review**: the conflict target `(source_system, source_table, source_record_id, target_table_name)` is a strong tuple but tying everything to `source_record_id` as the unique key from a compound-PK source is the root weakness. Future ADR to consider a richer lineage UQ.
5. **Multi-table ANALYZE syntax (PG 16+)**: CW-B23 uses per-table loop. PG 16 supports `ANALYZE t1, t2, …`; the current loop is more resilient to per-table failure but a single-call variant could be benchmarked.

---

## §8 — Handoff to CLI X2

CLI's X2 session prompt should:

1. Read `00_README_ENGINE_PATCHES.md` first.
2. Read each `CW_B<NN>_PATCH_SPEC.md` in apply order.
3. Apply Change 1 + Change 2 (where applicable) per the spec.
4. Write unit + integration tests as specified.
5. Run baseline `pnpm test`, then add new tests, then `pnpm test` again.
6. Trigger Wave 1 full retry on OCI VM (SSH tunnel 5433 up).
7. Capture the §4 global acceptance queries' output in a REPORT X2 artefact under `cowork_reserved/batch_c2/verifications/`.
8. Atomic commit per patch (or single bundled if preferred).

Estimated total CLI session time: **6-9 h** depending on whether tests pass first-shot and Wave 1 retry surfaces no new issues.
