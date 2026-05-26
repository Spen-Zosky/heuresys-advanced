# Forensic Inventory — `heuresys_advanced.brownfield`

**Snapshot**: 2026-05-20T02:29Z
**Scope**: 7 tables (registry control plane per brownfield import)
**Provenienza**: migrations `000024-000026` (infrastructure) + `000029-000030` (seeded) + `000033` (tenant_id_mappings + trigger)

---

## §1 — Tables overview

| Table | Rows | Purpose |
|---|---|---|
| `column_mappings` | **1177** | Per-column transform mapping (source_col → target_col + transform_code + payload) |
| `source_columns` | 1164 | Inventory di tutte le colonne source delle 93 tabelle in scope brownfield |
| `table_mappings` | 94 | Per-table mapping (source_table → target_table + wave + classification + approval status) |
| `source_tables` | 93 | Inventory delle source tables in scope (subset di legacy_mirror) |
| `import_runs` | 7 | Execution log delle Wave 1 retry runs (Goal 002 + Goal 003) |
| `tenant_id_mappings` | 4 | Tenant ID translation legacy → target (Goal 003 mig 000033) |
| `source_exports` | 1 | Source export bundle metadata (probably 1 wave 1 bundle) |

---

## §2 — `table_mappings` (94 rows) — distribution

| Dimension | Value |
|---|---|
| Wave assignment | TUTTE wave=1 (94 rows) |
| Classification | TUTTE IMPORT (94 rows) |
| Approval status | TUTTE APPROVED (94 rows) |

**DDL highlights**:
- `table_mapping_classification` CHECK: `IMPORT | TRANSFORM | REFERENCE_ONLY | EXCLUDE`
- `table_mapping_approval_status` CHECK: `PROPOSED | APPROVED | REJECTED | NEEDS_CHANGES`
- `table_mapping_wave` CHECK: `NULL OR 1..4`

**FK**: `table_mapping_source_table_id` → `brownfield.source_tables`; approved_by → `sys.sys_users`; run_id → `brownfield.import_runs`.

UNIQUE: `(source_table_id, target_schema, target_table)` — 1 mapping per source/target pair.

---

## §3 — `column_mappings` (1177 rows) — transform distribution

**KEY FINDING: 14 transform codes in registry, distribuzione:**

| transform_code | Count | % | Note |
|---|---|---|---|
| `JSON_EXTRACT` | **759** | **65%** | Estrae jsonb path da staging_raw_record in target jsonb metadata col |
| `CAST_TIMESTAMPTZ` | 130 | 11% | Cast string → timestamptz |
| `LINEAGE_SOURCE_NK` | 93 | 8% | Special: emette `fragment=null` + audit `HANDLED_VIA_LINEAGE_WRITE_V1` (no target write) |
| `TRIM` | 86 | 7% | Trim whitespace |
| `LOOKUP_FK` | **49** | 4% | FK resolution: form (a) legacy_<X>_id direct OR form (b) `<col>_metadata->>'legacy_id'` (P1 commit `127e1a7` lineage JOIN) |
| `SKIP` | 39 | 3% | Skip column (no transform) |
| `DIRECT_COPY` | 11 | 1% | Copy source value as-is |
| `UPPERCASE` | 3 | <1% | Uppercase string |
| `CAST_INT` | 2 | <1% | Cast → integer |
| `CAST_VARCHAR` | 1 | <1% | Cast → varchar |
| `CAST_BOOLEAN` | 1 | <1% | Cast → boolean |
| `CAST_NUMERIC` | 1 | <1% | Cast → numeric |
| `LOWERCASE` | 1 | <1% | Lowercase string |
| `CONSTANT` | 1 | <1% | Constant value |

**Total**: 1177 mappings.

**Trigger**: `brownfield_column_mappings_lookup_fk_validate` BEFORE INSERT WHEN `transform = 'LOOKUP_FK'` invoca `brownfield.validate_lookup_fk_payload_trigger()` (Goal 003 Item M, CP2). Enforces U-2026-05-19-01 cross-check rule.

**UQ critico** (CW-B20 surfaced Goal 003): `(column_mapping_table_mapping_id, column_mapping_source_column_id)` — un solo mapping per (table_mapping, source_column) pair. Vincolo che ha bloccato gli additive INSERT in Goal 003 Z1 evaluation.

---

## §4 — `column_mappings` distribution per target table (top 20)

| Target | N column_mappings | sys.* rows attuali | Hit ratio |
|---|---|---|---|
| `sys.sys_skills` | 349 | **6037** | ✅ ricco |
| `sys.sys_skill_taxonomy_edges` | 133 | 0 | ❌ all silent-skip (CW-B19) |
| `sys.sys_learning_paths` | 89 | 3227 | ✅ |
| `sys.sys_learning_modules` | 89 | 4488 | ✅ |
| `sys.sys_compensation_bands` | 67 | 75 | ✅ |
| `sys.sys_esco_occupation_mappings` | 53 | 0 | ❌ CW-B18 cascade gap |
| `sys.sys_blueprint_overrides` | 53 | 0 | (probably approved but no source data) |
| `sys.sys_position_skill_requirements` | 53 | 0 | ❌ |
| `sys.sys_skill_categories` | 45 | 0 | ❌ CW-B20 UQ block |
| `sys.sys_job_roles` | 43 | 0 | ❌ CW-B18 cascade gap |
| `sys.sys_skill_families` | 42 | 77 | ✅ |
| `sys.sys_activity_classifications` | 36 | 3276 | ✅ (Item C migration 000032) |
| `sys.sys_skill_learning_mappings` | 23 | 0 | ❌ |
| `sys.sys_blueprint_process_registry` | 21 | 23 | ✅ partial (23/63) |
| `sys.sys_learning_path_steps` | 20 | 0 | ❌ CW-B19 source mismatch |
| `sys.sys_user_certifications` | 18 | 1 | ❌ quasi-empty |
| `sys.sys_skill_aliases` | 16 | 0 | ❌ |
| `sys.sys_process_kpi_templates` | 13 | 0 | ❌ |
| `sys.sys_position_learning_requirements` | 7 | 0 | ❌ |
| `sys.sys_activity_classification_mappings` | 7 | 0 | ⓘ source-empty |

**Pattern**: 49% target tables (47/94?) hanno hit ratio ≥1 row in sys.*. ~50% silent-skip.

---

## §5 — `import_runs` (7 rows) — execution log Wave 1 retry

| Run ID | Wave | Scope | Status | Started | Finished |
|---|---|---|---|---|---|
| `0f6c0ea9-f6e5-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 |
| `0e0b4023-e315-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 |
| `a9c3ebf8-0b05-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 |
| `c90b6969-dde7-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 |
| `08d3bc9f-e16d-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 |
| `9e896773-086b-...` | (null) | (null) | COMPLETED | 2026-05-19 | 2026-05-19 |
| `67d51a90-7ad9-...` | 1 | DEMO | FAILED | 2026-05-16 | 2026-05-18 |

5 wave_executor runs Wave 1 (Goal 002 + Goal 003 retry iterations) + 1 K-hygiene run senza wave + 1 DEMO run failed.

**Latest run** `08d3bc9f` (Goal 003 retry, REPORT 02c §5): wall-clock 2896s, 16733 upserted, 3653 lineage rows generated.

---

## §6 — `tenant_id_mappings` (4 rows) — Goal 003 Item D + M

```
legacy_tenant_id                              → canonical RTL_BANK_REFERENCE
0c54b84a-db6e-... (rtl-bank)                  → 86ba7a65-217f-... (RTL_BANK_REFERENCE in sys.sys_tenancies)
1d7bf448-ceac-... (smartfood)                 → 86ba7a65-217f-...
fb1e866c-e90a-... (econova)                   → 86ba7a65-217f-...
d5855519-3ed1-... (heuresys System)           → 86ba7a65-217f-...
```

**Rationale embedded**: "Goal 003 Wave 1 seed: all legacy tenants point to RTL_BANK_REFERENCE in single-tenant scope. Goal 004 Wave 2 will reconcile to per-tenant canonical IDs once SmartFood/EcoNova/Heuresys System tenancies are created."

Quindi: tutti i 4 tenants legacy → 1 tenant target (collapsed) in Goal 003. Goal 004 (futuro) farà espansione 1:N per ricreare i 4 tenants in target.

---

## §7 — Implicazione SDBI

### §7.1 Registry brownfield è ricco

1177 column_mappings authoring rappresenta significant investment di engineering (Goal 001-003). Discardarlo equivale a buttare ~50-80 ore di mapping authoring (assumendo 2-5 minuti per mapping).

### §7.2 Trigger validation enforcement è asset

`validate_lookup_fk_payload_trigger()` enforces shape correctness at registry-INSERT time. Pattern riusabile per SDBI nuovi mappings.

### §7.3 UQ constraint è anche limitazione (CW-B20)

L'UQ `(table_mapping, source_column)` forbidens additive LOOKUP_FK quando source_column è già JSON_EXTRACT-mapped. Per SDBI questo è un design constraint da valutare:
- Relax UQ (architectural change) → permette dual-mapping
- Mantenere UQ + creare synthetic source_columns aliases → registry pollution
- Bypass via temp_ schema (Opzione 2/3) → SDBI proprio non usa column_mappings

---

## §8 — Verification

```sql
SELECT COUNT(*) FROM brownfield.column_mappings;  -- 1177
SELECT column_mapping_transform, COUNT(*) FROM brownfield.column_mappings GROUP BY 1 ORDER BY 2 DESC;
SELECT COUNT(*) FROM brownfield.table_mappings WHERE table_mapping_wave=1;  -- 94
SELECT COUNT(*) FROM brownfield.source_tables;  -- 93
SELECT COUNT(*) FROM brownfield.source_columns;  -- 1164
SELECT COUNT(*) FROM brownfield.tenant_id_mappings;  -- 4
```

---

*End of 02d_ADV_BROWNFIELD.md*
