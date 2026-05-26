# CW-B35 Forensic — sys_skill_taxonomy_edges.parent_id / child_id IMPORT GAP

**Status**: investigation complete — NOT Semantic FK Phantom, IS Import Mapping Gap
**Author**: Cowork batch C7.1
**Date**: 2026-05-21
**Audit trigger**: REPORT 009 §4 — 17924 rows excluded as `nk_missing_skill_taxonomy_edge_parent_id`

---

## §1 — Target schema

```
sys.sys_skill_taxonomy_edges
  skill_taxonomy_edge_id        uuid NOT NULL PK
  skill_taxonomy_edge_parent_id uuid NOT NULL  FK→sys_skills(skill_id) ON DELETE CASCADE
  skill_taxonomy_edge_child_id  uuid NOT NULL  FK→sys_skills(skill_id) ON DELETE CASCADE
  skill_taxonomy_edge_kind      varchar(32) NOT NULL DEFAULT 'IS_A' CHECK IN (IS_A,PART_OF,RELATED,PREREQUISITE_OF)
  skill_taxonomy_edge_metadata  jsonb NOT NULL DEFAULT '{}'
  ...

UNIQUE INDEX pair_kind_uq (parent_id, child_id, kind)
```

NK columns: `parent_id`, `child_id`, `kind`. parent_id + child_id are **NOT NULL UUID FKs** — same FK semantics as sys_skills.skill_id, not nullable per design.

## §2 — Source mapping audit

**11 sources mapped** to sys_skill_taxonomy_edges. ALL column_mappings APPROVED, BUT:

```
src col → target col coverage:
- skill_taxonomy_edge_id     ← all sources (LINEAGE_SOURCE_NK from 'id') ✅
- created_at                 ← all sources (CAST_TIMESTAMPTZ) ✅
- skill_taxonomy_edge_kind   ← NONE (defaults to 'IS_A' per DB default)
- skill_taxonomy_edge_parent_id ← NONE ❌ (gap)
- skill_taxonomy_edge_child_id  ← NONE ❌ (gap)
- skill_taxonomy_edge_metadata  ← all sources (JSON_EXTRACT *_entity_id etc.) ✅
```

**Root cause**: column_mappings for parent_id + child_id are MISSING. Source UUID FK candidates (source_skill_id, target_skill_id, etc.) exist in raw data but go ONLY to metadata JSONB, never to NK target columns.

## §3 — Per-source FK candidate matrix

Live introspect of `staging_raw_record` keys per source:

| Source | rows | parent FK candidate | child FK candidate | Classification |
|---|---:|---|---|---|
| skill_adjacencies | 11634 | `skill_id` | `adjacent_skill_id` | **CLEAN** ✅ |
| esco_skill_relations | 5818 | `source_skill_id` | `target_skill_id` | **CLEAN** ✅ |
| onet_esco_mappings | 135 | `onet_element_id` (string id) | `esco_skill_id` | **HETERO** (cross-domain) |
| skill_pair_usage | 111 | `skill_id_1` | `skill_id_2` | **CLEAN** ✅ |
| cross_entity_relations | 85 | `source_entity_id` (filter type='skill') | `target_entity_id` (filter type='skill') | **NEEDS FILTER** |
| skill_taxonomy_extensions | 52 | `skill_id` | unilateral (no peer) | **DEFER** |
| ontology_source_mappings | 40 | `source_id` (system varies) | `target_id` (table varies) | **HETERO** |
| ontology_skill_relations | 30 | `source_skill_id` | `target_skill_id` | **CLEAN** ✅ |
| skill_relationships | 16 | `source_skill_id` | `target_skill_id` | **CLEAN** ✅ |
| semantic_entity_relations | 15 | `source_entity_id` (filter type='skill') | `target_entity_id` (filter type='skill') | **NEEDS FILTER** |
| skill_matrices | 4 | `entity_id` (matrix entity, no peer) | n/a | **DEFER** |

**TOTAL**: 17940 staged rows
- CLEAN (5 sources): 11634+5818+111+30+16 = **17609 rows** unlockable via direct LOOKUP_FK
- NEEDS FILTER (2 sources): 85+15 = 100 rows unlockable with `WHERE source_entity_type='skill' AND target_entity_type='skill'` pre-filter
- HETERO/DEFER (4 sources): 135+52+40+4 = 231 rows — out of scope (cross-domain mappings, unidirectional, or different target table needed)

## §4 — 5-sample resolution check (Semantic FK Phantom workflow ADR-0016 §6)

**5/5 PASS** — source UUIDs resolve to sys_skills.skill_id via lineage. **NOT Semantic FK Phantom.**

```sql
WITH samples AS (
  SELECT staging_raw_record->>'source_skill_id' AS legacy_skill_uuid
    FROM staging.wave1_skill_taxonomy_edges
   WHERE staging_source_table = 'esco_skill_relations' LIMIT 5
)
SELECT s.legacy_skill_uuid,
       (SELECT slr.source_lineage_target_record_id
          FROM sys.sys_source_lineage_records slr
         WHERE slr.source_lineage_target_table_name = 'sys_skills'
           AND slr.source_lineage_source_record_id LIKE '%' || s.legacy_skill_uuid LIMIT 1) AS resolves_to_skill_id
  FROM samples s;
```

Result: 5/5 NON-NULL skill_id resolved. Lineage table has **14011 sys_skills records sourced from esco_skills** — broad coverage of legacy skill IDs.

## §5 — Diagnosis

**CW-B35 is IMPORT MAPPING GAP, not Semantic FK Phantom.**

The fix is **not** nullable FK ADR (parent_id + child_id are SEMANTICALLY NOT NULL — every edge requires both endpoints). The fix is **adding the missing column_mappings** with LOOKUP_FK transform to resolve legacy UUID → sys_skills.skill_id via lineage.

## §6 — Proposed mitigation (CLI X7 Block A)

**Phase A — CLEAN sources (5 of 11)**: add 10 column_mappings (2 per source) with LOOKUP_FK transform.

```sql
-- Example pattern for esco_skill_relations
-- 1. parent_id ← source_skill_id (LOOKUP_FK via lineage)
INSERT INTO brownfield.column_mappings (
  column_mapping_table_mapping_id,
  column_mapping_source_column_id,
  column_mapping_target_column,
  column_mapping_transform,
  column_mapping_transform_payload
)
SELECT tm.table_mapping_id,
       sc.source_column_id,
       'skill_taxonomy_edge_parent_id',
       'LOOKUP_FK',
       jsonb_build_object(
         'lookup_table', 'sys_skills',
         'lookup_strategy', 'lineage',
         'lineage_source_table', 'esco_skills',
         'note', 'CW-B35 fix — resolve legacy skill UUID → sys_skills.skill_id via lineage'
       )
  FROM brownfield.table_mappings tm
  JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
  JOIN brownfield.source_columns sc ON sc.source_column_table_id = st.source_table_id
 WHERE tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
   AND st.source_table_name = 'esco_skill_relations'
   AND sc.source_column_name = 'source_skill_id';

-- 2. child_id ← target_skill_id (same pattern)
-- (repeat for ontology_skill_relations, skill_relationships, skill_pair_usage, skill_adjacencies)
```

**Acceptance criteria for Phase A**:
- 10 new column_mappings inserted (5 sources × 2 cols)
- Wave 1 retry post-fix: `sys_skill_taxonomy_edges` ≥ 14000 (80% of 17609 estimated post-dedup)
- audit `nk_missing_skill_taxonomy_edge_parent_id` for these 5 sources = 0 rows
- No regression on sys_skills (20048 preserved)

**Phase B — FILTER sources (2 of 11)**: add 4 column_mappings (2 per source) with conditional transform using `WHERE source_entity_type='skill' AND target_entity_type='skill'` pre-filter. Needs CASE expression OR new transform code LOOKUP_FK_CONDITIONAL.

**Acceptance Phase B**: +85+15 ≤ +100 rows unlocked (small but completes pattern).

**Phase C — DEFER (4 sources, 231 rows)**:
- onet_esco_mappings + ontology_source_mappings: re-classify to `REFERENCE_ONLY` or different target table (cross-domain mappings belong in sys_cross_domain_mappings or similar — not yet existent)
- skill_taxonomy_extensions + skill_matrices: defer to dedicated investigation (unidirectional/matrix semantics need design decision)

## §7 — Pattern catalog impact

**CW-B35 ≠ Semantic FK Phantom** (CW-B26 family). Different class:

**NEW PATTERN — "Import Mapping Gap"**:
- Source data has valid FK UUIDs that resolve via lineage (5/5 PASS resolution)
- column_mappings are INCOMPLETE — UUIDs only go to metadata JSONB, not to NK target cols
- Mitigation: add the missing LOOKUP_FK column_mappings (no ADR, no engine change, no migration)

Pattern memo §10 next batch (C8 or post-X7 debrief): catalog "Import Mapping Gap" as **fast unlock pattern** — high-volume rows recovered via SQL data fix in brownfield registry, no code change.

## §8 — Effort estimate

CLI X7 Block A.1 (CW-B35 Phase A only): 1-2h
- Source columns introspection (verify source_column_id values): 15 min
- Author 10 INSERT INTO brownfield.column_mappings: 30 min
- Wave 1 retry + acceptance verify: 30 min
- Commit + push: 15 min

Phase B + C: defer to C8 batch (out of scope CW-B35 acute unblock).

## §9 — Open questions

1. **LOOKUP_FK payload schema** — verify against existing X3 patterns (cascade_fixes/01_*) for canonical key names. Current registry uses `lookup_table` + `lookup_strategy` + `lineage_source_table` — confirm.
2. **kind column default** — DB default is 'IS_A'. Some sources have `relation_type` field (esco_skill_relations: "optional", "essential") that should arguably map to `skill_taxonomy_edge_kind` instead of metadata. Defer to C8 polishing pass.
3. **Dedup post-fix** — same (parent, child, kind) tuple could appear in multiple sources (e.g. skill_adjacencies vs esco_skill_relations both encoding same edge). CW-B31 DISTINCT ON dedup pattern handles this — verify post-Wave1 audit.

---

*End CW-B35 forensic — IMPORT GAP pattern identified*
