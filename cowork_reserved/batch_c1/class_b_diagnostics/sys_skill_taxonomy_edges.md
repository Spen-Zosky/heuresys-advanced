# Class B Diagnostic — sys_skill_taxonomy_edges

## §1 — State summary
- Target rows now: **0**
- Source tables (11 sources, the WIDEST fan-in of any silent-skip target):
  - `esco_skill_relations` (5818)
  - `skill_adjacencies` (**0 in legacy_mirror** — UNDOCUMENTED MIRROR GAP! 11634 in platform)
  - `skill_relationships` (16)
  - `cross_entity_relations` (85)
  - `onet_esco_mappings` (135)
  - `ontology_skill_relations` (30)
  - `ontology_source_mappings` (40)
  - `skill_taxonomy_extensions` (52)
  - `skill_pair_usage` (111)
  - `semantic_entity_relations` (15)
  - `skill_matrices` (4)
  - `import_skill_links` (0 in mirror — likely source-empty too)
- Column mappings count: **133** (largest after sys_skills 349)
- LOOKUP_FK count: **2** (`skill_taxonomy_edge_parent_id` + `skill_taxonomy_edge_child_id` on source `skill_relationships`)
- JSON_EXTRACT count: 104
- LINEAGE_SOURCE_NK: 11 (1 per source_table)
- DIRECT_COPY: 2
- TRIM/CAST: 14
- Staged rows in `staging.wave1_skill_taxonomy_edges`: **6306**
- Audit rows pre-existing: WAVE1_ALL_RULES PASSED 6306, HANDLED_VIA_LINEAGE_WRITE_V1 SKIPPED 11
- Required NOT NULL UUID cols: `skill_taxonomy_edge_parent_id` + `skill_taxonomy_edge_child_id` (both FK to sys_skills)
- UQ: `(parent_id, child_id, kind)` — `kind` is part of NK

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **B (lineage-empty for parents) + F (10 of 11 sources lack FK mappings) + C (1 MIRROR GAP)**

This is the MOST complex silent skip. Multiple compounding issues:

1. **Mirror GAP for skill_adjacencies**: legacy_mirror has 0 rows; platform has 11634. The extract-wave1-legacy.sh missed it (5th MIRROR GAP — not documented in F10 §3.2 which only listed 4).
   - Evidence: `SELECT COUNT(*) FROM legacy_mirror.skill_adjacencies` → 0; `SELECT COUNT(*) FROM heuresys_platform.public.skill_adjacencies` → 11634.

2. **Only 1 source has FK mapping**: of the 11 sources, only `skill_relationships` (16 rows!) has LOOKUP_FK mappings for parent_id + child_id. The other 10 sources have **no mapping** for the required NOT NULL UUID columns → WHERE skip filter pushes FALSE → all 5818+85+135+30+40+52+111+15+4 = 6290 rows silently dropped.

3. **For the 16 skill_relationships rows**: even with P1 fix, LOOKUP_FK form (b) `skill_metadata->>'legacy_id'` rewrites to a lineage JOIN against `source_lineage_target_table_name='sys_skills'` using `srcExpr = staging_raw_record->>'source_skill_id' / 'target_skill_id'`. But those source_skill_id UUIDs come from `esco_skills` / `skill_classifications` / `competencies` etc. — and lineage coverage for sys_skills is **444/6037 = 7.4%**. Most lookups will return NULL.

Evidence:
- `SELECT COUNT(*) FROM brownfield.column_mappings WHERE column_mapping_target_column='skill_taxonomy_edge_parent_id'` → 1 (only from `skill_relationships`).
- Same for `child_id`: only 1 mapping from `skill_relationships`.
- 10 of 11 sources have JSON_EXTRACT but no FK resolution for the 2 required cols.

## §3 — Proposed fix

**Three-part fix**:

1. **Class C extension**: restore `skill_adjacencies` (11634 rows) to legacy_mirror via pg_dump + COPY (same protocol as C1.4).
2. **Author 10 missing LOOKUP_FK mapping pairs**: for each of the 10 non-skill_relationships sources, identify the source column that carries the parent skill UUID and the child skill UUID. Examples:
   - `esco_skill_relations`: `source_skill_uri` / `target_skill_uri` → `match_on: "skill_external_uri" target_table: "sys_skills"` (assuming sys_skills has external_uri column; else use lineage approach).
   - `skill_adjacencies`: `from_skill_id` / `to_skill_id` → lineage JOIN via legacy_id.
   - Authoring cost: ~20 mappings × 15min each = 5h.
3. **Strengthen lineage coverage for sys_skills**: ensure every source upsert into sys_skills writes lineage (currently 7% coverage). This may require code change to engine.ts to write lineage for ALL upsert rows, not just first-insert path.

Effort: **8-12h** (1-2h mirror fix + 5-7h mapping authoring + 1-2h lineage code fix + 1h re-run).

## §4 — Acceptance criteria post-fix

- `sys_skill_taxonomy_edges` count: ≥ 5000 (substantial subset of the ~18k source rows, after dedup on (parent, child, kind)).
- All 11 source_tables represented in lineage (`sys_source_lineage_records`).
- Audit class `WHERE_SKIP_FILTER_EXCLUDED_V1`: 0 for sys_skill_taxonomy_edges.
- Audit class `LOOKUP_FK_UNRESOLVABLE` may be > 0 (legitimate for source rows whose FKs reference skills not in mirror, e.g. dangling ESCO refs).

## §5 — Dependencies su altri fix

- **Depends on**: (a) `skill_adjacencies` mirror restore; (b) sys_skills lineage coverage extension (or upstream import of `esco_skills` 14011 if not yet done).
- **Blocks**: skill graph navigation UX features (downstream of position skill requirements).
