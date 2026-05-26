# Batch C2.2 — Cascade Class B Authoring Fixes

**Status**: SPEC — authoring proposals only. NO INSERT applied. CLI applies in Phase 1 of CLI Batch X2.
**Authored**: 2026-05-21 (Cowork autonomous, batch C2.2)
**Scope**: Unblock 4 Class B silent-skip targets diagnosed in `batch_c1/class_b_diagnostics/` and lock the cascade chain top-to-bottom.

---

## §1 — Targets in scope (4) — execution order

| # | Target | Staged | Block cause | Cascade depends on | Confidence | File |
|---|---|---:|---|---|---|---|
| 1 | `sys_job_roles` | 231 | `required_missing_job_role_family_id` | `sys_job_families` = 27 ✅ (post-X1) | **HIGH** | `01_sys_job_roles_mapping_fix.sql` |
| 2 | `sys_esco_occupation_mappings` | 7645 | `nk_missing_esco_occupation_mapping_job_role_id` | `sys_job_roles` (must be populated FIRST in same Wave) | **MEDIUM** | `02_sys_esco_occupation_mappings_fix.sql` |
| 3 | `sys_skill_categories` | 7256 | `required_missing_skill_category_family_id` | `sys_skill_families` = 77 ✅ | **MEDIUM** | `03_sys_skill_categories_fix.sql` |
| 4 | `sys_skill_taxonomy_edges` | 17924 | `nk_missing_skill_taxonomy_edge_parent_id` + child_id | `sys_skills` = 14455 ✅ (post-X1 MIRROR-GAP-fix) | **MEDIUM-LOW** | `04_sys_skill_taxonomy_edges_fix.sql` |

**Total unlock potential** (worst-case): 231 + 7645 + 7256 + 17924 = **33056 staging rows** ready for Wave 1 retry.

---

## §2 — Execution order — STRICT cascade ordering

```
PHASE A (sequential, must finish before next):
  1. Apply `01_sys_job_roles_mapping_fix.sql`   → INSERT new column_mappings
  2. Wave 1 retry (full) → sys_job_roles populated (target: ≥140 rows)
     → sys_job_roles lineage written → unlocks step 2
  3. Verify: SELECT COUNT(*) FROM sys.sys_job_roles ≥ 140

PHASE B (parallel after PHASE A.3 ok):
  4a. Apply `02_sys_esco_occupation_mappings_fix.sql`
  4b. Apply `03_sys_skill_categories_fix.sql`
  4c. Apply `04_sys_skill_taxonomy_edges_fix.sql`
  5. Wave 1 retry (full)
  6. Verify each target post-retry (see per-file §6)
```

**Why strict ordering for sys_job_roles before sys_esco_occupation_mappings**: the latter references `esco_occupation_mapping_job_role_id` → if sys_job_roles is empty when Wave 1 starts, the lineage records won't exist and the LOOKUP_FK form (b) JOIN will fail (resolve to NULL → silent skip persists).

**Why parallel for fixes 03/04**: independent of each other, both leaf-level (no cascade chains downstream within these 4 targets).

---

## §3 — Authoring strategy — synthetic source_column aliases

### §3.1 The CW-B20 UQ constraint problem

Live DB verification confirmed: for ALL 4 targets, the source_columns we'd ideally use for FK resolution (e.g. `competencies.framework_id`, `skill_classifications.skill_cluster_id`, `esco_skill_relations.source_skill_id`, `esco_skill_relations.target_skill_id`) are **already mapped** as JSON_EXTRACT → `_metadata` jsonb. The unique constraint `brownfield_column_mappings_pair_uq UNIQUE (table_mapping_id, source_column_id)` blocks adding a 2nd mapping for the same source_column.

Evidence (live SSH query, 2026-05-21):

```
sys_skill_categories|competencies|framework_id|skill_category_metadata|JSON_EXTRACT
sys_skill_taxonomy_edges|esco_skill_relations|source_skill_id|skill_taxonomy_edge_metadata|JSON_EXTRACT
sys_skill_taxonomy_edges|esco_skill_relations|target_skill_id|skill_taxonomy_edge_metadata|JSON_EXTRACT
sys_skill_taxonomy_edges|skill_adjacencies|skill_id|skill_taxonomy_edge_metadata|JSON_EXTRACT
sys_skill_taxonomy_edges|skill_adjacencies|adjacent_skill_id|skill_taxonomy_edge_metadata|JSON_EXTRACT
```

### §3.2 Synthetic alias pattern — adopted

To preserve **A1 ABSOLUTE** (no UPDATE/DELETE of existing wave=1 rows), the authoring strategy is:

1. **INSERT a new `brownfield.source_columns` row** as a SYNTHETIC ALIAS pointing to the same `source_table_id` but with a distinct name (e.g. `framework_id__fk_alias` or `source_skill_id__fk_parent_alias`). Data type and column metadata mirror the original (uuid). Add `is_synthetic_alias=true` + `aliased_from` metadata key (NB: `source_columns` doesn't have these cols natively; we use the existing `source_column_metadata` jsonb field if present, otherwise document only).
2. **INSERT a new `brownfield.column_mappings` row** mapping the SYNTHETIC ALIAS → LOOKUP_FK target column. UQ pair is `(table_mapping_id, NEW source_column_id)` → does NOT collide.
3. **At Wave 1 stage time**: the staging extractor needs to be aware that synthetic aliases read from the SAME underlying source column. This requires the staging code to either (a) look up `aliased_from` metadata, or (b) the LOOKUP_FK transform handler to read from `staging_raw_record->>'<actual_source_column_name>'` independent of the alias name.

### §3.3 LOOKUP_FK form (b) lineage JOIN — semantics

After P1 fix (commit `127e1a7`), LOOKUP_FK form (b) with payload `match_on: <target_table>_metadata->>'legacy_id'` is rewritten by the transform-compiler into a lineage JOIN:

```sql
-- Conceptual rewrite
(
  SELECT slr.source_lineage_target_record_id
  FROM sys.sys_source_lineage_records slr
  WHERE slr.source_lineage_target_table_name = '<target_table>'
    AND slr.source_lineage_source_record_id = (staging_raw_record->>'<actual_source_column>')::text
  LIMIT 1
)
```

Lineage coverage (verified live):
- `sys_job_families`: 27/27 = 100% (newly populated post-X1)
- `sys_job_roles`: 0 → will be populated by PHASE A.2 retry
- `sys_skill_families`: 77/77 = 100% (stable)
- `sys_skills`: 14455 rows in target, lineage entries by source: esco_skills 14011, ontology_feedback 52, ontology_quality_metrics 50, onet_skills 35, competencies 20, plus tail ~150 = **~14.3k total lineage entries**. Coverage ≈ 99% of target rows.

### §3.4 Alternative authoring path considered (REJECTED for this batch)

- **Drop+re-insert existing JSON_EXTRACT mapping**: violates A1 ABSOLUTE.
- **Relax UQ via migration**: architectural change, out of scope.
- **Use UNMAPPED source_columns** (e.g. `esco_occupation_uri` on `job_templates`): not feasible because almost all source columns are already mapped to JSON_EXTRACT (per generate_wave1_column_mappings.mjs default behavior — every source col becomes a JSON_EXTRACT to metadata unless explicitly transformed).

The synthetic-alias path is the only A1-ABSOLUTE-compliant strategy for cascade Class B unlock without engine code change.

---

## §4 — Per-fix idempotency + rollback

All INSERT SQL statements are guarded by either `ON CONFLICT DO NOTHING` (where a natural UQ exists) OR `WHERE NOT EXISTS (...)` predicates. Re-running an applied fix is safe (no duplicates, no errors).

**Rollback per fix** (cleanup):

```sql
-- 1. Identify synthetic source_columns and their mappings
WITH synth_cols AS (
  SELECT sc.source_column_id
  FROM brownfield.source_columns sc
  WHERE sc.source_column_name LIKE '%__fk_%_alias'
)
DELETE FROM brownfield.column_mappings cm
WHERE cm.column_mapping_source_column_id IN (SELECT source_column_id FROM synth_cols);

DELETE FROM brownfield.source_columns
WHERE source_column_name LIKE '%__fk_%_alias';
```

Cascade FK on `column_mappings → source_columns` ensures clean removal.

---

## §5 — Risk register

| Risk ID | Description | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Staging code does NOT honor alias→actual source column resolution | HIGH | CRITICAL | **Verify FIRST**: read `apps/api/src/services/brownfield/extract/stage.ts` or equivalent before applying any INSERT. If staging reads `staging_raw_record->>'<column_mapping_source_column.source_column_name>'` literally, alias path FAILS. In that case → fallback to engine-side patch (out of scope) or accept partial unlock. |
| R-02 | LOOKUP_FK validator trigger (`brownfield_column_mappings_lookup_fk_validate`) rejects payload format | MEDIUM | HIGH | Use the standard payload `{"target_table":"sys_xxx","match_on":"sys_xxx_metadata->>''legacy_id''"}` — already validated by U-2026-05-19-01 trigger spec. |
| R-03 | sys_job_roles lineage not written after Wave 1 step 2 (engine.ts CW-B22) | MEDIUM | CRITICAL | Phase A.2 verification: post-Wave 1, check `SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE source_lineage_target_table_name='sys_job_roles'` ≥ 140. If 0 → engine.ts patch from C2.1 needed first. |
| R-04 | UQ collision on synthetic alias name (re-run scenario) | LOW | LOW | All synthetic alias names are deterministic + INSERTs guarded with `WHERE NOT EXISTS`. Re-run no-op. |
| R-05 | sys_skill_taxonomy_edges LOOKUP_FK resolves both parent + child to same NULL (most rows) | HIGH | MEDIUM | Lineage coverage for sys_skills ≈ 99%, but `esco_skill_relations` uses URI not UUID → must use `skill_uri`/`related_skill_uri` as lineage keys OR pre-load esco_skills lineage with URI as `source_lineage_source_natural_key`. Document partial unlock acceptable: ~5-10k rows may legitimately become `LOOKUP_FK_UNRESOLVABLE`. |
| R-06 | sys_esco_occupation_mappings — no clean source col carries a job_role ref | HIGH | HIGH | Most `esco_occupations` rows have no canonical job_role mapping (ESCO catalog is independent). Recommend **architectural relax** option (nullable FK migration) as parallel track. Authoring fix attempts mapping via `esco_uri` matching to `job_role.job_role_metadata->>'esco_uri'` lineage — partial coverage expected (~20-40%). |

---

## §6 — Acceptance criteria — global

Post-Wave-1 retry (PHASE A + PHASE B applied):

```sql
-- Acceptance 1: targets unblocked
SELECT relname, n_live_tup FROM pg_stat_user_tables
WHERE schemaname='sys' AND relname IN (
  'sys_job_roles','sys_esco_occupation_mappings','sys_skill_categories','sys_skill_taxonomy_edges'
) ORDER BY relname;
-- Expected (minimum acceptable):
--   sys_job_roles: ≥ 140
--   sys_skill_categories: ≥ 32 (UQ-collapsed)
--   sys_skill_taxonomy_edges: ≥ 5000
--   sys_esco_occupation_mappings: ≥ 1500 (partial expected per R-06)

-- Acceptance 2: silent-skip exclusion reasons reduced
SELECT
  import_validation_result_payload->>'target_table' AS target,
  import_validation_result_payload->>'exclusion_reason' AS reason,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
  AND import_validation_result_payload->>'target_table' IN (
    'sys_job_roles','sys_esco_occupation_mappings','sys_skill_categories','sys_skill_taxonomy_edges'
  )
GROUP BY 1,2 ORDER BY 1,3 DESC;
-- Expected: significant reduction; legitimate residuals classified as LOOKUP_FK_UNRESOLVABLE
```

---

## §7 — Dependencies on upstream fixes

This batch ASSUMES the following already shipped (per X1 REPORT §1.4):

| Dep | Status | Source |
|---|---|---|
| P1 commit `127e1a7` — LOOKUP_FK form (b) lineage rewrite | ✅ shipped | X1 §0 |
| X1 §5.2.A — sys_job_families populated (27 rows + lineage) | ✅ shipped | X1 REPORT |
| X1 MIRROR-GAP-fix — sys_skills +14011 via esco_skills | ✅ shipped | X1 REPORT |
| CW-B17 audit class patch (C1.5) — exclusion_reason audit | ✅ shipped | C1.5 commit |

This batch DOES NOT depend on (deferred to later batches):

- engine.ts lineage write fix CW-B22/B23 (C2.1 spec exists, application TBD in X2 PHASE 0). If unshipped, R-03 likelihood goes from MEDIUM → HIGH. The cascade still works for sys_job_roles → sys_esco_occupation_mappings WITHIN the same Wave 1 run as long as Wave 1 processes targets in topological order (sys_job_families → sys_job_roles → sys_esco_occupation_mappings).

---

## §8 — Effort estimate — CLI execution

| Phase | Step | Effort |
|---|---|---|
| Pre-flight | Read all 4 SQL files, verify schema match | 30 min |
| Pre-flight | Read alias-resolution code in staging (R-01 mitigation) | 30 min |
| Apply A | Phase A INSERTs (sys_job_roles) | 5 min |
| Run A | Wave 1 retry (full, ~50 min) | 50 min |
| Verify A | Check sys_job_roles count + lineage | 15 min |
| Apply B | Phase B INSERTs (3 targets parallel-safe) | 10 min |
| Run B | Wave 1 retry (full, ~50 min) | 50 min |
| Verify B | Per-target acceptance criteria | 30 min |
| Document | Update HANDOFF with diff | 15 min |
| **TOTAL** | | **~4h** |

---

## §9 — Files in this batch

```
cowork_reserved/batch_c2/cascade_fixes/
├── 00_README_CASCADE_FIXES.md  ← this file
├── 01_sys_job_roles_mapping_fix.sql
├── 02_sys_esco_occupation_mappings_fix.sql
├── 03_sys_skill_categories_fix.sql
└── 04_sys_skill_taxonomy_edges_fix.sql
```

Each SQL file is self-contained (idempotent INSERTs + verification queries + per-target rollback) and follows the §3 spec format.

---

*End of 00_README_CASCADE_FIXES.md — Cowork autonomous batch C2.2.*
