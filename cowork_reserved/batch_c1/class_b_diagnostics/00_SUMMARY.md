# Class B Diagnostics — Summary

**Generated**: 2026-05-20 (Cowork autonomous Batch C1.6)
**Scope**: 12 silent-skip targets from Wave 1 run `08d3bc9f` (2026-05-19 18:52)
**Method**: SSH live queries on `oracle-vm-default` heuresys_advanced + code-read of transform-compiler.ts + upsert-sql.ts

---

## §1 — Master diagnostic table

| # | Target | Staged | RC | Effort | Depends on | Blocks | Priority |
|---:|---|---:|---|---|---|---|---|
| 1 | **sys_job_families** | 0 (no staging) | **D (no source mapping)** | 3-5h | — | sys_job_roles + sys_esco_occupation_mappings + sys_position_skill_requirements (cascade root) | **HIGHEST** |
| 2 | sys_skill_aliases | 130 | B (P1 fix + esco_skills lineage) | 1-2h | esco_skills upsert into sys_skills | — | HIGH |
| 3 | sys_skill_categories | 7256 | **F (required FK has no mapping)** | 3-5h | — (sys_skill_families parent exists) | UX skill normalization | HIGH |
| 4 | sys_skill_taxonomy_edges | 6306 | B + F + C (skill_adjacencies mirror gap) | 8-12h | sys_skills lineage strengthening + 5th MIRROR GAP fix | Skill graph UX | HIGH |
| 5 | sys_skill_learning_mappings | 1588 | F (2 of 3 sources lack FK) + semantic | 4-6h | sys_learning_modules lineage | Skill→course UX | MEDIUM |
| 6 | sys_learning_path_steps | 688 | **F (no LOOKUP_FK at all)** | 3-5h | sys_learning_paths lineage | Learning UX | MEDIUM |
| 7 | sys_esco_occupation_mappings | 7645 | A (sys_job_roles=0) + F | 6-10h or 2-3h relax | sys_job_roles | Career/recruiting UX | HIGH |
| 8 | sys_job_roles | 231 | A (sys_job_families=0) + F | 5-8h or 2-3h relax | sys_job_families | sys_esco_occupation_mappings + sys_position_skill_requirements | HIGH |
| 9 | sys_process_kpi_templates | 81 | A (sys_kpi_definitions=0) | 8-12h | sys_kpi_definitions bootstrap | KPI assignment UX | MEDIUM |
| 10 | sys_position_skill_requirements | 0 (no staging) | F (staging missing) + A (sys_positions=161) | 8-15h | staging whitelist + semantic decision + lineage | Position-centric UX (I1 invariant) | **CRITICAL** |
| 11 | sys_position_learning_requirements | 0 | **D (source-empty, legitimate)** | 0h (document only) | — | — | LOW |
| 12 | sys_blueprint_overrides | 0 (no staging) | A (sys_blueprint_activations=0) + F (placeholder authoring) | 0h (defer) or 12-20h re-arch | sys_blueprint_activations + semantic decision | Tenant blueprint UX | LOW (defer SDBI) |

**Root-cause legend**:
- A = cascade prerequisite (parent target empty)
- B = LOOKUP_FK form (b) `<col>_metadata->>'legacy_id'` resolves NULL (P1 fix landed `127e1a7` but lineage coverage gap remains)
- C = MIRROR GAP (source table missing in legacy_mirror)
- D = source-empty / no source mapping / source not extracted
- E = WHERE skip filter NK uuid invalid format (not observed in these 12)
- F = authoring incomplete (required NOT NULL FK has no mapping in registry)

---

## §2 — Cross-cutting findings

### Finding 1: P1 fix landed but is INSUFFICIENT
Commit `127e1a7` (2026-05-20 00:15 — 6h after the latest run) rewrites LOOKUP_FK form (b) `<col>_metadata->>'legacy_id'` to a lineage JOIN. **A fresh Wave 1 re-run will improve some targets but not most**, because lineage coverage is sparse:

| Parent target | Total rows | Lineage entries | Coverage |
|---|---:|---:|---:|
| `sys_skills` | 6037 | 444 | **7.4%** |
| `sys_learning_modules` | 4488 | 92 | **2.0%** |
| `sys_learning_paths` | 3227 | 135 | **4.2%** |
| `sys_activity_classifications` | 3276 | 3276 | 100% |
| `sys_compensation_bands` | 75 | 75 | 100% |
| `sys_skill_families` | 77 | 77 | 100% |

**Root cause of low coverage**: the engine writes lineage only on first-insert path (`tally.lineageRows += upserted.length`), but most upserts hit ON CONFLICT DO UPDATE — those rows DO get lineage in current code path (see engine.ts:1124 ON CONFLICT clause), suggesting the issue is upstream — many source rows go through "single-row upsert" path or JSON_EXTRACT-driven UPDATE without lineage emission.

**Action**: deep-investigate the lineage write path. Possibly add lineage emit on EVERY successful target row, not just first-insert.

### Finding 2: 5th undocumented MIRROR GAP
`legacy_mirror.skill_adjacencies` has 0 rows (vs 11634 in platform). F10 §3.2 listed 4 MIRROR GAPS (`business_processes`, `esco_skills`, `industry_ccnl_mapping`, `tenant_industry_classifications`) all closed by C1.4 — `skill_adjacencies` was missed. Affects sys_skill_taxonomy_edges authoring.

### Finding 3: Staging table whitelist gap
Two targets (`sys_position_skill_requirements`, `sys_blueprint_overrides`) have full `brownfield.column_mappings` entries (53 each!) but NO corresponding `staging.wave1_*` table. Means the stage phase silently skipped them at the whitelist level — these target rows are never even surfaced in the audit trail. CW-B17 audit class fix (C1.5) won't catch this — needs separate detection.

### Finding 4: Authoring gaps are dominant root cause
**6 of 12** targets (50%) have **F-class root cause = column_mappings missing required NOT NULL FK resolution**:
- sys_skill_categories (skill_category_family_id)
- sys_skill_taxonomy_edges (10 of 11 sources lack edge_parent_id + edge_child_id mappings)
- sys_skill_learning_mappings (2 of 3 sources)
- sys_learning_path_steps (0 of 2 sources, fully)
- sys_esco_occupation_mappings (0 LOOKUP_FK at all)
- sys_blueprint_overrides (0 mappings for activation_id + process_id)

This is **authoring incompleteness**, not transform-compiler bugs. Solution: systematic FK-mapping audit during Wave 1 RETRO + extend `generate_wave1_column_mappings.mjs` with **required-NOT-NULL-FK auto-completion** logic.

### Finding 5: One target is legitimately source-empty
`sys_position_learning_requirements` (Class D) — `job_title_learning_paths` 0 rows in both mirror AND platform. No fix needed; document as SOURCE_EMPTY_ACCEPTED.

### Finding 6: One target is placeholder-authored
`sys_blueprint_overrides` — 53 mappings from 4 heterogeneous source tables (benchmark/holiday/etc.) into one target with no clear semantic intent. Recommend DEFER to SDBI.

---

## §3 — Recommended execution ordering

```
PHASE 0 (parallel, immediate):
  → C1.6.0 (this file) — ✅ DONE
  → CW-B17 audit class patch — ✅ DONE in C1.5
  → 5th MIRROR GAP fix (skill_adjacencies) — ~1h

PHASE 1 (cascade root, MUST come first):
  → sys_job_families bootstrap (3-5h)
    └→ unlocks sys_job_roles (5-8h)
      └→ unlocks sys_esco_occupation_mappings (6-10h)

PHASE 2 (parallel, leaf targets, depend on lineage strengthening):
  → engine.ts lineage write deep-investigation (4-6h)
    └→ Wave 1 retry → strengthens lineage coverage
  → After retry: sys_skill_aliases (1-2h) becomes 1-shot

PHASE 3 (authoring gaps, parallel):
  → sys_skill_categories required FK mapping (3-5h)
  → sys_skill_taxonomy_edges 10-source FK + mirror skill_adjacencies (8-12h)
  → sys_skill_learning_mappings 2-source FK (4-6h)
  → sys_learning_path_steps full FK authoring (3-5h)

PHASE 4 (critical-priority, complex):
  → sys_position_skill_requirements (staging whitelist + position semantics) (8-15h)

PHASE 5 (KPI universe, longest pole):
  → sys_kpi_definitions bootstrap (Class D, 12-18h)
    └→ unlocks sys_process_kpi_templates (1-2h additional)

PHASE 6 (cleanup / document):
  → sys_position_learning_requirements: document SOURCE_EMPTY (1h)
  → sys_blueprint_overrides: defer to SDBI (0h, decision recorded)
```

**Total Wave 1 fix effort**: ~45-75h (~8-15 turni) for the 10 actionable targets.

---

## §4 — Recommended priority list (executive)

| Rank | Target | Effort | Volume impact | Strategic value |
|---:|---|---|---|---|
| 1 | sys_job_families | 3-5h | small (27 rows) | CASCADE ROOT — unblocks 3 other targets w/ 8k+ rows |
| 2 | sys_position_skill_requirements | 8-15h | large (30k+ source) | I1 Position-centric invariant — HIGHEST architectural value |
| 3 | engine.ts lineage write fix | 4-6h | meta | unblocks ALL cascade B-class issues |
| 4 | sys_job_roles | 5-8h | 231 rows | unblocks sys_esco_occupation_mappings (7645) |
| 5 | sys_esco_occupation_mappings | 6-10h | 7645 rows | largest single silent skip; ESCO catalog backbone |
| 6 | sys_skill_taxonomy_edges | 8-12h | 6306 rows | skill graph UX |
| 7 | sys_skill_categories | 3-5h | 7256 rows | self-contained authoring fix |
| 8 | sys_skill_aliases | 1-2h | 130 rows | quickest win, depends on esco_skills upsert |
| 9 | sys_learning_path_steps | 3-5h | 688 rows | learning UX |
| 10 | sys_skill_learning_mappings | 4-6h | 1588 rows | skill→course UX |
| 11 | sys_process_kpi_templates | 8-12h | 81 rows | depends on KPI universe (Class D) |
| 12 | sys_position_learning_requirements | 0h | 0 rows | document only |
| 13 | sys_blueprint_overrides | 0h | 0 rows | defer to SDBI |

---

## §5 — Verification anchors

```sql
-- §1 confirm row counts
SELECT relname, n_live_tup FROM pg_stat_user_tables
WHERE schemaname='sys' AND relname IN (
  'sys_skill_aliases','sys_skill_categories','sys_skill_taxonomy_edges',
  'sys_skill_learning_mappings','sys_learning_path_steps','sys_esco_occupation_mappings',
  'sys_job_roles','sys_job_families','sys_process_kpi_templates',
  'sys_position_skill_requirements','sys_position_learning_requirements','sys_blueprint_overrides'
) ORDER BY relname;
-- Expected: all 0.

-- §2 Finding 1: lineage coverage
SELECT source_lineage_target_table_name, COUNT(DISTINCT source_lineage_target_record_id) AS covered
FROM sys.sys_source_lineage_records GROUP BY 1 ORDER BY 2;

-- §2 Finding 2: 5th MIRROR GAP
SELECT 'skill_adjacencies platform' AS k, COUNT(*) FROM heuresys_platform.public.skill_adjacencies
UNION ALL
SELECT 'skill_adjacencies mirror', COUNT(*) FROM heuresys_advanced.legacy_mirror.skill_adjacencies;
-- Expected: 11634 / 0.

-- §2 Finding 3: staging whitelist gap
SELECT relname FROM pg_stat_user_tables WHERE schemaname='staging' AND relname LIKE 'wave1_%';
-- Expected: no wave1_position_skill_requirements, no wave1_blueprint_overrides.

-- §2 Finding 4: column_mapping required-FK coverage
SELECT a.attname AS required_uuid_col,
  EXISTS(SELECT 1 FROM brownfield.column_mappings cm JOIN brownfield.table_mappings tm ON tm.table_mapping_id=cm.column_mapping_table_mapping_id WHERE tm.table_mapping_target_table='sys_skill_categories' AND cm.column_mapping_target_column=a.attname) AS has_mapping
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
WHERE n.nspname='sys' AND c.relname='sys_skill_categories' AND a.attnotnull AND format_type(a.atttypid,a.atttypmod)='uuid' AND a.attname<>'skill_category_id';
-- Expected: skill_category_family_id / has_mapping=false.
```

---

*End of 00_SUMMARY.md — generated by Cowork autonomous forensic agent in C1.6 batch.*
