# REPORT 012 — CLI Batch X8 (CW-B38 audit verify + CW-B39 cleanup — SUCCESS)

**Executed**: 2026-05-21T17:24Z → 2026-05-21T19:20Z (~2h CLI; 2× Wave 1 retries 55m + 57m wall-clock dominate)
**Sessions**: 1 (X8 fresh session post X7 handoff `bfd8982`)
**By**: Claude Code CLI on Windows (Opus 4.7 1M ctx)
**Predecessor**: REPORT X7 `_04_REPORT_011_batch_x7.md`
**Directive**: PROMPT 012 `_01_PROMPT_012_batch_x8.md` + 2 specs `cowork_reserved/batch_c8/cw_b3{8,9}_*/`

---

## §0 — Pre-conditions verified

- SSH tunnel 5433 ✅
- Last commit `bfd8982` X7 hardening visible ✅
- Baseline live counts:
  - sys_esco_occupation_mappings = 7645 (CW-B38 mitigated via mig 000042)
  - sys_learning_path_steps = 0 (CW-B39 target, was excluded 688 rows pre-X8)
  - sys_skill_taxonomy_edges = 11965
  - sys_users = 433, sys_job_roles = 202

---

## §1 — Block A outcomes (CW-B38 audit verify — SUCCESS)

### §1.A.1 Audit query result (verified clean)

```sql
SELECT n.nspname, c.relname, i.indexrelid::regclass, i.indnullsnotdistinct
  FROM pg_index i ... [full query per spec §3.A.1]
 WHERE ... nullable UUID NK col in non-PK UQ;
```

**Result** (matches spec §2 Cowork-prefigured):

| nspname | table_name | uq_index | indnullsnotdistinct |
|---|---|---|---|
| sys | sys_esco_occupation_mappings | sys_esco_occupation_mappings_pair_uq | **t** ✅ |

1 row only. Only `sys_esco_occupation_mappings` has the pattern + already mitigated (CW-B38 mig 000042 from X7). **No additional preventive migration required**. No new vulnerabilities. Halt-escalate **NOT triggered**.

### §1.A.2 Idempotent migration re-run

Re-applied `000042_sys_esco_occupation_mappings_uq_nulls_not_distinct.sql` directly via `psql -f`:
- SHA in `sys.sys_schema_migrations` matches file SHA (`381115a9b018f6dd32194d8c5de6a86b8055ddf0cf611146705f1ec70b465720`) ✅
- Apply sequence: `BEGIN / DROP INDEX / CREATE INDEX / COMMENT / COMMIT` (idempotent)
- Post re-apply: `indnullsnotdistinct = t` PRESERVED ✅

Note: `pnpm db:migrate` script applies ALL migrations sequentially (no skip on already-applied), and fails on pre-existing 000007 CHECK constraint violation unrelated to X8. Bypassed via direct psql -f to verify 000042 idempotency in isolation. Same approach as X5.B/X7.

### §1.A.3 Wave 1 retry × 2 — CW-B38 effectiveness verification

**Retry 1**: runId `09695229-06cd-41c5-9bd0-cd98d3aec690`
- Wall-clock: 55m 12s
- State: COMPLETED
- Post-retry count: **sys_esco_occupation_mappings = 7645** ✅

**Retry 2**: runId `b59b2f2f-204a-4363-a0d2-a746ca9c1ea1`
- Wall-clock: 57m 06s
- State: COMPLETED
- Post-retry count: **sys_esco_occupation_mappings STILL 7645** ✅

**Conclusion**: ESCO count STABLE across 2 consecutive Wave 1 retries (was previously 7645 → 15290 cross-run dup in X7 pre-mig-000042). CW-B38 mitigation **fully effective**. No cross-run duplicate emission. P0 trigger `cw_b38_regression_post_audit` NOT triggered.

---

## §2 — Block B outcomes (CW-B39 REFERENCE_ONLY cleanup — SUCCESS)

### §2.B.1 SQL applied

File: `db/seeds/brownfield/wave2/cw_b39_fix/01_learning_path_steps_reclassify.sql`
- UPDATE 2 table_mappings (`course_modules` + `learning_path_courses` → sys_learning_path_steps) to REFERENCE_ONLY
- Annotated via `table_mapping_metadata.reclassified_reason` jsonb (per CW-B40 pattern from X7 — `table_mapping_rationale` column does NOT exist)
- DO block assertion: **exactly 2 rows** updated ✅

Applied between retry 1 (verifies CW-B38) and retry 2 (verifies CW-B39 effect). Timing chosen to avoid interference with in-flight wave snapshot.

### §2.B.2 Audit verification post-cleanup

Wave 1 retry 2 (runId `b59b2f2f-204a-4363-a0d2-a746ca9c1ea1`) audit:

```
sys_learning_path_steps audit rows total: 0 (was 688 in X7)
nk_missing_learning_path_step_path_id: 0 (was 688 in X7)
```

**100% drop** ✅. Both `course_modules` (564 rows) + `learning_path_courses` (124 rows) successfully removed from Wave 1 pipeline via REFERENCE_ONLY classification. Halt-escalate `cw_b39_unexpected_source_count` NOT triggered.

`sys_learning_path_steps` count = 0 PRESERVED (was 0 pre-X8; no functional regression — target was already empty pending X9 SKILGRO).

---

## §3 — Audit forensics post-X8 (full distribution Retry 2)

```
reason                                       | count
---------------------------------------------+-------
nk_missing_skill_learning_mapping_skill_id   | 1381  (X9 SKILGRO deferred — CW-B37 deep fix)
nk_missing_skill_taxonomy_edge_parent_id     |  331  (CW-B35 Phase B/C deferred non-CW-B35 sources)
nk_missing_blueprint_process_variant_id      |   89  (pre-existing bias, low-volume)
nk_missing_user_certification_user_id        |   88
nk_null_process_kpi_template_process_id      |   81
nk_missing_skill_alias_skill_id              |   50
required_missing_skill_category_family_id    |   32  (competencies deferred X9)
```

**Comparison vs X7 audit**:

| Reason | X7 | X8 | Delta |
|---|---|---|---|
| nk_missing_learning_path_step_path_id | 688 | **0** | **-100%** ✅ |
| All other reasons | unchanged | unchanged | preserved |

**No NEW high-volume reasons emerged** (>500 rows). No new bias candidates surfaced. Bias catalog stable at 45 (pre-X8) + audit-resolved CW-B38/B39.

---

## §4 — Pattern memo §12 cross-check (CLI feedback on Cowork additions)

Cowork batch C8 added 5 new anti-patterns + 3 new vincenti to pattern memo §12. CLI cross-check during X8 execution:

| Pattern | CLI X8 experience | Feedback |
|---|---|---|
| Inline Mitigation Scope (vincente) | Block A audit + Block B reclassify both fit "inline OK" categories | ✅ pattern validated |
| UPDATE-in-place pivot for UQ-constrained registry (vincente) | CW-B39 used UPDATE pattern correctly (no INSERT pivot attempted) | ✅ pattern adopted |
| Bias Registry SoT race condition protocol | Not exercised in X8 (no new bias registry edits required) | Pending future exercise |
| CW-B38 anti-pattern (NULLS NOT DISTINCT) | X8 verified Cowork's audit claim (1 row only, already mitigated) | ✅ confirmed accurate |
| CW-B39 anti-pattern (Mixed Misclassification + Half-Resolvable) | X8 cleanup applied → 0 audit rows for target | ✅ confirmed effective |

All Cowork patterns hold up under CLI execution. Pattern memo §12 quality strong.

---

## §5 — Cowork spec improvements suggested (post-X8)

### §5.1 Pre-flight script: `pnpm db:migrate` cannot be used in current state
- Multiple migrations not registered in `sys.sys_schema_migrations` (000034/36/37/38/41/42 — some inserted manually post-apply)
- Script re-applies ALL files sequentially and fails on 000007 CHECK constraint violation (pre-existing rows)
- **Recommendation**: author a `pnpm db:migrate:registered` variant that consults `sys.sys_schema_migrations` and SKIPS applied entries (`WHERE NOT EXISTS`). Out of X8 scope, candidate for engine/tooling batch.

### §5.2 Wave 1 retry HARD_TIMEOUT default 11min insufficient
- `scripts/run-wave1-fullscale.mjs` HARD_TIMEOUT_MS defaults to 11min. Current Wave 1 wall-clock 55-57min → script aborts with "fetch failed" but wave run continues server-side.
- CLI workaround: poll `brownfield.import_runs` via psql to detect COMPLETED status.
- **Recommendation**: bump HARD_TIMEOUT_MS default to 75min OR make wave run async with status polling.

### §5.3 Mapping registry UPDATE pattern formalization
- 3 consecutive batches (X7 CW-B36/37 + X8 CW-B39) used identical UPDATE pattern:
  - UPDATE brownfield.table_mappings SET classification=REFERENCE_ONLY, metadata||=reclassified_reason
  - DO block assertion exact row count
- **Recommendation**: extract as helper SQL function `brownfield.reclassify_table_mapping_reference_only(target_table, source_table_names text[], reason text)` for future re-use. Out of X8 scope, future tooling batch.

---

## §6 — Next step recommendation for Cowork batch C9 / X9 SKILGRO planning

### §6.1 Confirmed-ready state post-X8

| Domain | Status | Remaining audit blockers |
|---|---|---|
| Engine (transforms, dedup, lineage, NULLS NOT DISTINCT) | hardened | 0 P0 known |
| Brownfield registry hygiene | hardened (3 batches of cleanup applied) | 0 misclassified mappings known |
| SDBI pilots | 2 completed (Goals/OKRs + Time/Leave + sys_users HYBRID) | none |
| Audit forensics | low-volume reasons remain (all deferred X9 OR ≤90 rows) | none blocking |

### §6.2 X9 SKILGRO macro-area scope (per PROMPT 012 §8)

**Highest-ROI unlocks** quantified by audit deferred:
- `nk_missing_skill_learning_mapping_skill_id` 1381 rows (CW-B37 deep fix, 2-hop LOOKUP_FK)
- `nk_missing_skill_taxonomy_edge_parent_id` 331 rows (CW-B35 Phase B+C)
- `required_missing_skill_category_family_id` 32 rows (competencies fuzzy)
- Plus learning domain re-architecture (CW-B39 forensic §4 conclusion): courses → sys_learning_modules canonical re-mapping

**Estimated X9 ROI**: ~5000-10000 row unlock (per PROMPT 012 §8 estimate). Cowork C9 dedicated batch recommended.

### §6.3 Concrete next-batch recommendations

1. **C9.1**: ADR-NNNN engine extension `LOOKUP_FK_2HOP` (intermediate_table + final_match_col semantics). Spec authoring 2-3h Cowork.
2. **C9.2**: SKILGRO learning domain audit — canonical source decision for sys_learning_modules (courses table re-mapping)
3. **C9.3**: CW-B35 Phase B+C re-evaluation — heterogeneous sources cross_entity_relations + onet_esco_mappings + filter-needed sources
4. **(housekeeping)**: tooling improvements per §5 above

---

## §7 — Halts NOT triggered

| Trigger (PROMPT 012 §5) | Severity | Status |
|---|---|---|
| cw_b38_new_vulnerability_<table> | P0 | NOT triggered (audit returned 1 expected row) |
| cw_b38_regression_post_audit | P0 | NOT triggered (7645 stable across 2 retries) |
| cw_b39_unexpected_source_count | P1 | NOT triggered (exactly 2 UPDATE) |
| regression_<sys_table> | P0 | NOT triggered (all target counts preserved) |

---

## §8 — Session status

- **X8 COMPLETE**
- All §3 + §4 acceptance criteria met
- 0 halts triggered
- 0 new bias candidates emerged
- 1 audit reason category fully resolved (`nk_missing_learning_path_step_path_id` 688 → 0)
- Ready for Cowork REVIEW + X9 SKILGRO macro-area planning

---

*End REPORT 012 — X8 hardening complete, ready for X9 SKILGRO*
