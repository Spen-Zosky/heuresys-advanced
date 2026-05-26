# CW-B35 Phase B+C — sys_skill_taxonomy_edges residual 331 rows

**Status**: triage + recommendation (defer to X9 Block D, low ROI)
**Author**: Cowork batch C9.4
**Date**: 2026-05-21
**Trigger**: REPORT 011 §1.A.6 — 331 rows residui post-Phase A (5 CLEAN sources fixed)

---

## §1 — Residual sources (331 rows total)

Per `forensic_cw_b35/01_CW_B35_FORENSIC.md` §3 + REPORT 011 §1.A.6 gap analysis:

| Source | Rows | Classification | Decision |
|---|---:|---|---|
| cross_entity_relations | 85 | NEEDS FILTER (source_entity_type='skill' AND target_entity_type='skill') | Phase B (defer or simple filter mapping) |
| semantic_entity_relations | 15 | NEEDS FILTER (same pattern) | Phase B |
| onet_esco_mappings | 135 | HETERO (occupation↔skill cross-domain) | Phase C (different target table — sys_cross_domain_mappings doesn't exist) |
| ontology_source_mappings | 40 | HETERO (cross-system mapping) | Phase C |
| skill_taxonomy_extensions | 52 | DEFER (unilateral schema, no peer) | Phase C |
| skill_matrices | 4 | DEFER (matrix semantics) | Phase C |

**Total Phase B (need filter)**: 100 rows (cross_entity_relations + semantic_entity_relations)
**Total Phase C (defer)**: 231 rows (onet_esco_mappings + ontology_source_mappings + skill_taxonomy_extensions + skill_matrices)

## §2 — Phase B option (filter-based 2 sources)

For cross_entity_relations + semantic_entity_relations (both have `source_entity_type` + `target_entity_type` keys):

**Option B.1 — Pre-staging UPDATE filter** (low effort, ~30 min):
```sql
-- Mark only skill→skill rows for inclusion; rest stay as silent_skipped
UPDATE staging.wave1_skill_taxonomy_edges
   SET staging_validation_status = 'REFERENCE_ONLY'  -- excludes from upsert
 WHERE staging_source_table IN ('cross_entity_relations','semantic_entity_relations')
   AND (staging_raw_record->>'source_entity_type' != 'skill'
        OR staging_raw_record->>'target_entity_type' != 'skill');
```
Then add column_mappings (LOOKUP_FK + LOOKUP_FK) for source_entity_id/target_entity_id like CW-B35 Phase A pattern.

**Option B.2 — Defer to X10/X11** (cross-domain macro-area):
- Volume 100 rows is small enough to wait
- When sys.* multi-domain tables are designed (es. sys_competency_edges, sys_role_skill_edges), these may belong there instead

**Recommendation**: **B.1 if X9 has bandwidth, else B.2 defer**. Cost-benefit: 100 rows for ~30 min CLI work = low ROI but achievable.

## §3 — Phase C option (heterogeneous 4 sources, 231 rows)

All 4 sources have semantic patterns NOT matching sys_skill_taxonomy_edges (parent↔child homogeneous skill graph):
- `onet_esco_mappings (135)`: ONET occupation ↔ ESCO skill (heterogeneous — different ontologies)
- `ontology_source_mappings (40)`: system_a.entity ↔ system_b.entity (cross-system, NOT skill graph)
- `skill_taxonomy_extensions (52)`: unilateral entries (no peer edge, just labels)
- `skill_matrices (4)`: matrix index, not edges

**Recommendation**: **DEFER all 4 to X9 SKILGRO macro-area planning**, where the team can decide:
1. Re-classify all 4 as REFERENCE_ONLY (drop from Wave 1, 0 audit noise)
2. Create new sys.* targets where appropriate (sys_cross_domain_mappings, sys_skill_taxonomy_metadata, etc.)
3. Triage skill_matrices semantics (might be entirely out-of-scope SDBI)

**Quick win**: Phase C.1 = REFERENCE_ONLY re-classify all 4 = ~5 min CLI work, 231 rows out of audit. No data loss (legacy_mirror preserved).

## §4 — Recommendation for X9 Block D

**Phase B.1 + Phase C.1 cumulative** (X9 Block D, ~45 min CLI):

```sql
-- Phase B.1: filter-based unlock 100 rows
-- (depending on X9 bandwidth — see §2)

-- Phase C.1: REFERENCE_ONLY 4 heterogeneous sources, 231 rows
UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = jsonb_set(
         coalesce(table_mapping_metadata, '{}'::jsonb),
         '{reclassified_reason}',
         to_jsonb('CW-B35 Phase C (Cowork C9.4): heterogeneous source not matching sys_skill_taxonomy_edges homogeneous skill-edge semantics. Re-classify pending dedicated macro-area or new sys_cross_domain_mappings target.'::text)
       )
 WHERE table_mapping_id IN (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
      AND st.source_table_name IN (
        'onet_esco_mappings',
        'ontology_source_mappings',
        'skill_taxonomy_extensions',
        'skill_matrices'
      )
 );
```

Acceptance: sys_skill_taxonomy_edges audit `nk_missing_skill_taxonomy_edge_parent_id` drops 331 → ≤100 (Phase B residual if §2 B.2 chosen).

## §5 — Effort estimate

CLI X9 Block D (CW-B35 Phase B+C combined): **45-60 min**
- Phase B.1 (filter + column_mappings) OR defer: 30 min OR 5 min
- Phase C.1 REFERENCE_ONLY (4 sources): 15 min
- Wave 1 retry + audit verify: 30 min (depending on whether existing Wave 1 in X9 covers)

---

*End CW-B35 Phase B+C re-evaluation — recommend incremental cleanup via X9 Block D*
