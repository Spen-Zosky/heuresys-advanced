---
from: cli
to: cowork
goal_id: 008
slug: batch_x5
kind: exec_halt
ref_files:
  - cowork_code_exchange/_01_PROMPT_008_batch_x5.md
  - docs/architecture/adr/0016_sys_esco_occupation_mappings_nullable_job_role_fk.md
  - apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts
created_at: 2026-05-21T12:19:00Z
expected_response_kind: exec_directive
severity: P0
trigger: §7 "Block B retry: sys_esco_occupation_mappings still 0 → adr_0016_unexpected_fail"
---

# HALT — ADR-0016 nullable FK insufficient, sys_esco_occupation_mappings still 0

## §1 — Halt point
PROMPT 008 §4.B.6 acceptance failed. Wave 1 retry post-migration 000041 (runId `0f7461a1-42fc-4641-9aaf-10c29c56f388`, wall 186s, COMPLETED): `sys_esco_occupation_mappings` count = **0** (target ≥3000).

## §2 — Evidence

### §2.1 Migration 000041 confirmed applied
```sql
SELECT column_name, is_nullable FROM information_schema.columns
 WHERE table_schema='sys' AND table_name='sys_esco_occupation_mappings'
   AND column_name='esco_occupation_mapping_job_role_id';
-- Result: is_nullable = YES ✅
```

### §2.2 Wave 1 retry COMPLETED post-migration
runId `0f7461a1-42fc-4641-9aaf-10c29c56f388`, status COMPLETED, wall 186s.

### §2.3 Column mappings present, staging rows PASSED
```
 source_table                        | col_mappings | staging PASSED
 esco_occupations                    |  20          | 3040
 industry_occupation_mapping         |  10          | 15
 occupation_industry_classifications |  6           | 4565
 onet_occupations                    |  17          | 25
```
Total: 7645 PASSED staged rows.

### §2.4 ROOT CAUSE: WHERE skip filter excludes 7645/7645 rows
```sql
SELECT import_validation_result_payload->>'exclusion_reason' AS reason, COUNT(*)
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id='0f7461a1-42fc-4641-9aaf-10c29c56f388'
   AND import_validation_result_rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
   AND import_validation_result_payload->>'target_table' = 'sys_esco_occupation_mappings'
 GROUP BY 1;
-- Result:
-- nk_missing_esco_occupation_mapping_job_role_id | 7645
```

All 7645 rows excluded by upsert-sql.ts:384-416 WHERE skip filter because `esco_occupation_mapping_job_role_id` is in `targetMeta.naturalKeyColumns` AND no column_mapping populates it (cascade fix 02 from X2 was never applied due to CW-B26 semantic FK phantom).

## §3 — What I tried
1. Applied migration 000041 → DB column nullable ✅
2. Confirmed no business-logic code assumes NOT NULL (0 hits in apps/api/src + packages/shared/src) → no companion Zod/Row edits needed ✅
3. Wave 1 retry post-migration → 0 upserts ❌

## §4 — Diagnosis

Migration 000041 (ADR-0016) makes the **DB column** nullable, BUT the **engine WHERE skip filter** (upsert-sql.ts:384-416) excludes any row where a UUID column in `targetMeta.naturalKeyColumns` is NULL/missing. The NK is derived from the target table UQ index:
```
sys_esco_occupation_mappings UNIQUE on (esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri)
```
Even with nullable FK at the DB level, the engine treats NK columns as required for dedup, hence 7645 rows skipped.

## §5 — Proposed options

### Option A — Engine patch: skip filter aware of nullable NK
Modify upsert-sql.ts:384-416 to check `targetMeta.columnNullable` map (or query information_schema). If NK column is nullable, don't exclude rows where it's NULL. Recompute UQ conflict semantics: `COALESCE(col, sentinel) = COALESCE(col, sentinel)` like for `_tenant_id` (CW-B22 helper).

**Pro**: structural fix, replicable for any future nullable NK case.
**Contro**: engine code change, requires testing. ~2-3h.

### Option B — Cascade fix 02 (from X2) — apply with synthetic LOOKUP_FK to NULL
Apply `db/seeds/brownfield/wave2/cascade_fixes/02_sys_esco_occupation_mappings_fix.sql` (5 synthetic alias source_columns + 5 LOOKUP_FK column_mappings) but tweak so they LOOKUP_FK resolves to NULL (since CW-B26 confirmed no real FK). The LOOKUP_FK output would be NULL, satisfying the column-mapping presence requirement, and rows would then pass the WHERE filter with NULL FK.

**Pro**: no engine change.
**Contro**: hack — LOOKUP_FK with no resolution is semantic noise; pollutes registry with always-NULL mappings.

### Option C — Modify UQ index design
Change UQ to `(esco_occupation_mapping_esco_uri)` alone (drop job_role_id from NK). ESCO URI is unique per ESCO entry naturally.

**Pro**: aligns with semantic (ESCO entries are distinct by URI; job_role association is supplementary).
**Contro**: schema change + migration; requires data integrity validation.

## §6 — Recommendation
**Option A** is the right structural fix (mirror CW-B22 nullable-NK COALESCE pattern). Effort 2-3h. Future-proofs nullable NK columns generically.

**Option C** is also viable as a UQ redesign — depends on whether `(esco_uri)` alone is the true NK semantic per Heuresys data model.

**Option B** I reject — too hacky, adds technical debt to brownfield registry.

## §7 — What I can do meanwhile
- Commit Block A (CW-B32 fix sys_job_roles 91→202) + Block B partial (migration 000041 applied, ADR-0016 audit clean) + xos_lib housekeeping
- Push X5.A interim
- Write REPORT 008.A with Block B halted on this finding
- Continue to X5.B (Block C Time/Leave + Block D sys_users) in a fresh session — both independent of this halt

## §8 — Decision needed
Cowork: which option (A/B/C) for sys_esco_occupation_mappings unblock? OR alternative not listed?

CLI standing by for `exec_directive` after Cowork review.
