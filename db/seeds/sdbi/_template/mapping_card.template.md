# Mapping Card — `public.<SOURCE_TABLE>` → `sys.<TARGET_TABLE>`

> SDBI Phase 2 artifact (ADR-0014 §3.6). One card per source table. Author in Phase 2; Enzo approves
> every LOW/MEDIUM field before Phase 3. Reference: the 10 goals-pilot cards in
> `db/seeds/brownfield/sdbi/goals_pilot/` (historical authoring lives under cowork_reserved/).

## Metadata
- mapping_card_id: `<MAPPING_CARD_ID>`
- source: `heuresys_platform.public.<SOURCE_TABLE>` (<N> rows — measured live, no estimate)
- target: `heuresys_advanced.sys.<TARGET_TABLE>`
- created: `<YYYY-MM-DD>`
- author: SDBI AI (`<AI_MODEL_ID>`)
- approver: PENDING (`<APPROVER>`)
- confidence_overall: **<CONFIDENCE>** (HIGH ≥ 0.85 / MEDIUM 0.60-0.85 / LOW < 0.60)
- workflow_phase: 2 (TARGET ANALOGY MATCHING)

## Source semantic analysis
- semantic_type: entity | junction | hierarchy | aggregation
- contains_pii: false (ADR-0023 — legacy is synthetic, no real PII)
- temporal: snapshot | event-log | mixed
- soft_delete: YES (`deleted_at`) | NO
- hierarchy: none | self-FK `<col>` (max depth N observed)

## Field mapping (per column — enumerate ALL source columns; CW-B18 completeness gate)

| source_col | source_type | target_col | target_type | transform | confidence | reasoning |
|---|---|---|---|---|---|---|
| id | uuid | `<ENTITY>_metadata->>'legacy_id'` | jsonb | STORE_IN_METADATA | HIGH | new uuid generated target-side; legacy id retained for lineage |
| tenant_id | uuid | `<ENTITY>_tenant_id` | uuid | LOOKUP_TENANT_ID (brownfield.tenant_id_mappings) | HIGH | proven path |
| employee_id | uuid | `<ENTITY>_subject_user_id` | uuid | LOOKUP_USER via LEGACY_EMP:: (I14) | MEDIUM | resolve sys_users.user_external_code='LEGACY_EMP::'||id; NULL passes through |
| … | … | … | … | … | … | … |
| created_at | timestamp | created_at | timestamptz | CAST_TO_TIMESTAMPTZ (UTC) | MEDIUM | source has no TZ — assume UTC, document here |

## Computed target columns
- `<ENTITY>_natural_key`: `'<NK_PREFIX>::' || tenant::text || '::' || source_id::text`
- `<ENTITY>_metadata`: `{ legacy_id, legacy_table, … }`

## FK resolution strategy
- `source.tenant_id` → `sys.sys_tenancies` via `brownfield.tenant_id_mappings`
- `source.<user_fk>` → `sys.sys_users` via `LEGACY_EMP::` crosswalk (I14 — never users.id)
- `source.<self_fk>` → two-pass / Phase-5 late-bind via temp_sdbi `_legacy_source_<fk>_id`

## Pre-flight checks (measured live, no estimate)
- Source row count: <N>
- NOT NULL source columns enumerated + each has a mapping: YES/NO (CW-B18)
- FK non-NULL ratio sampled (CW-B19): <…>
- Sample validation (5 rows transform → reasonable target values): PASS/FAIL

## Post-execution acceptance
- `temp_sdbi.<ENTITY>` count = source row count (modulo soft-delete)
- 0 NULL on NOT NULL target columns
- All FK resolutions valid (0 dangling)
- Lineage rows = upserted rows; 4 SDBI columns populated
- Audit: `SDBI_CONSOLIDATION_COMPLETE_V1` emitted

## Human review notes
[Enzo's feedback / corrections — required for every LOW/MEDIUM field before Phase 3]
