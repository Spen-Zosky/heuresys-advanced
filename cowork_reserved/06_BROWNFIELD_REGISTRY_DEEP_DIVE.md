# Brownfield Registry — Deep Dive

**Snapshot**: 2026-05-20T02:55Z
**Scope**: `heuresys_advanced.brownfield.*` (7 tabelle) — registry control plane

---

## §1 — Tables overview

| Table | Rows | Role |
|---|---|---|
| `source_exports` | 1 | Bundle metadata (1 = db-export-2026-05-15) |
| `source_tables` | 93 | Inventory source tables in scope Wave 1 |
| `source_columns` | 1164 | Inventory columns (avg 12.5 col/table) |
| `table_mappings` | 94 | source_table → target_table mapping |
| `column_mappings` | 1177 | source_column → target_column with transform_code |
| `import_runs` | 7 | Execution history |
| `tenant_id_mappings` | 4 | Legacy tenant_id → target tenant_id (Goal 003 mig 000033) |

---

## §2 — `table_mappings` (94) — by lexicon domain

| Lexicon domain | n source_tables | n table_mappings | Classification | Status |
|---|---|---|---|---|
| **ESKAP** | 29 | 29 | All IMPORT | All APPROVED |
| **SKILGRO** | 37 | 38 | All IMPORT | All APPROVED |
| **INDOOR** | 9 | 9 | All IMPORT | All APPROVED |
| **ITLAB** | 7 | 7 | All IMPORT | All APPROVED |
| **OPOURSKA** | 4 | 4 | All IMPORT | All APPROVED |
| **PROGOV** | 2 | 2 | All IMPORT | All APPROVED |
| **H2R** | 2 | 2 | All IMPORT | All APPROVED |
| **Other** (`import_skill_links`, `industry_ccnl_mapping`, `skill_adjacencies`) | 3 | 3 | All IMPORT | All APPROVED |
| **TOTAL** | 93 | 94 | 94 IMPORT | 94 APPROVED |

**Anomalia**: SKILGRO ha 38 table_mappings da 37 source_tables → 1 source mappa a 2 target (es. `competencies` → sys_skills + sys_skill_categories).

**Tutto wave=1**. Zero TRANSFORM/REFERENCE_ONLY/EXCLUDE classifications. Zero REJECTED/PROPOSED/NEEDS_CHANGES statuses.

---

## §3 — `column_mappings` (1177) — distribution per transform_code

| Transform code | Count | % | Target distribution (top) |
|---|---|---|---|
| **JSON_EXTRACT** | **759** | **64.5%** | sys_skills 227, sys_skill_taxonomy_edges 104, sys_learning_paths 59, sys_learning_modules 57, sys_compensation_bands 47, sys_blueprint_overrides 43, sys_esco_occupation_mappings 33, sys_position_skill_requirements 30, sys_job_roles 28, sys_skill_categories 28 |
| **CAST_TIMESTAMPTZ** | 130 | 11.0% | sys_skills 39, sys_skill_taxonomy_edges 12, sys_learning_modules 8, sys_compensation_bands 8, sys_position_skill_requirements 8 |
| **LINEAGE_SOURCE_NK** | 93 | 7.9% | 1 per source_table (natural key marker, no target write) |
| **TRIM** | 86 | 7.3% | (string normalization) |
| **LOOKUP_FK** | 49 | 4.2% | FK resolution (form a + form b post-P1) |
| **SKIP** | 39 | 3.3% | Explicit skip |
| **DIRECT_COPY** | 11 | 0.9% | sys_position_skill_requirements 6, sys_skill_taxonomy_edges 2, sys_skills 2, sys_learning_paths 1 |
| **UPPERCASE** | 3 | 0.3% | (string norm uppercase) |
| **CAST_INT** | 2 | 0.2% | sys_blueprint_process_registry, sys_activity_classifications |
| **CAST_VARCHAR** | 1 | <0.1% | sys_job_roles |
| **CAST_BOOLEAN** | 1 | <0.1% | sys_blueprint_process_registry |
| **CAST_NUMERIC** | 1 | <0.1% | sys_learning_modules |
| **LOWERCASE** | 1 | <0.1% | (string norm lowercase) |
| **CONSTANT** | 1 | <0.1% | sys_activity_classification_mappings |

**TOTAL**: 1177 (zero NULL transforms).

**Pattern dominante**: 65% JSON_EXTRACT — la maggior parte delle column mappings memorizza il valore source dentro `<target>_metadata` jsonb column del target. Pochi DIRECT_COPY (1%) — pattern di design "preserve everything in jsonb metadata, then explicit per first-class column".

### §3.1 PII disposition — tutto NONE

| `column_mapping_pii_disposition` | Count |
|---|---|
| `NONE` | 1177 |

Zero PSEUDONYMIZE / MASK / DROP / TAG_SYNTHETIC. Wave 1 source data = no PII (taxonomy/catalog data only).

---

## §4 — `source_columns` (1164) — data type distribution

| data_type | Count | % | Note |
|---|---|---|---|
| `character varying` | 295 | 25% | Tipico nomi/code |
| `uuid` | 261 | 22% | FK e PK uuid |
| `timestamp with time zone` | 181 | 16% | created_at/updated_at standard |
| `text` | 92 | 8% | Long form text |
| `integer` | 75 | 6% | Numerici |
| `numeric` | 68 | 6% | Decimali |
| `jsonb` | 67 | 6% | Embedded jsonb |
| `boolean` | 55 | 5% | Flag |
| `ARRAY` | 18 | 1.5% | Array types (typically text[]) |
| `USER-DEFINED` | 18 | 1.5% | Postgres custom types (vector, enum, etc.) |
| `date` | 16 | 1.4% | Date-only |
| `timestamp without time zone` | 10 | <1% | Plain timestamp |
| `smallint` | 8 | <1% | Small ints |
| (others) | tail | <1% | misc |

**TOTAL**: 1164.

**Insight**: 22% UUID + 16% timestamptz + 25% varchar = ~63% standard relational types. 6% jsonb + 1.5% USER-DEFINED + 1.5% ARRAY = ~9% complex types (challenge per transform).

---

## §5 — `import_runs` (7) — execution history forensic

| Run ID | Wave | Scope | Status | Started | Ended | Wall-clock |
|---|---|---|---|---|---|---|
| `0f6c0ea9-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 | ~10 min (Goal 002 retry?) |
| `0e0b4023-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 | ~10 min |
| `a9c3ebf8-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 | ~10 min |
| `c90b6969-...` | 1 | wave_executor | COMPLETED | 2026-05-19 | 2026-05-19 | ~10 min |
| `08d3bc9f-...` | 1 | wave_executor | COMPLETED | 2026-05-19 18:52 | 2026-05-19 19:41 | **48 min** (Goal 003 retry, latest) |
| `9e896773-...` | NULL | NULL | COMPLETED | 2026-05-19 | 2026-05-19 | K-hygiene step (Goal 003 Item K) |
| `67d51a90-...` | 1 | DEMO | FAILED | 2026-05-16 | 2026-05-18 | (44h orfano riconciliato) |

**5 successful Wave 1 runs** + 1 K-hygiene + 1 DEMO failed.

Forensic dettagliato in `08_AUDIT_TRAIL_ANALYSIS.md`.

---

## §6 — `tenant_id_mappings` (4) — Goal 003 mig 000033

```sql
0c54b84a-... (rtl-bank legacy)        → 86ba7a65-... (RTL_BANK_REFERENCE sys)
1d7bf448-... (smartfood legacy)       → 86ba7a65-... (RTL_BANK_REFERENCE)  -- collapsed
fb1e866c-... (econova legacy)         → 86ba7a65-... (RTL_BANK_REFERENCE)  -- collapsed
d5855519-... (heuresys System legacy) → 86ba7a65-... (RTL_BANK_REFERENCE)  -- collapsed
```

Tutti 4 legacy tenants collapsano a 1 target. **Per Goal 004**: espansione 1:N per ricreare 4 separate tenancies.

---

## §7 — Constraints + triggers + indexes

### §7.1 UQ critico (CW-B20)
`brownfield_column_mappings_pair_uq` UNIQUE (column_mapping_table_mapping_id, column_mapping_source_column_id) — **un solo mapping per (table_mapping, source_column) pair**.

### §7.2 CHECK constraints
- `table_mapping_classification` ∈ {IMPORT, TRANSFORM, REFERENCE_ONLY, EXCLUDE}
- `table_mapping_approval_status` ∈ {PROPOSED, APPROVED, REJECTED, NEEDS_CHANGES}
- `table_mapping_wave` NULL OR 1..4
- `column_mapping_pii_disposition` ∈ {NONE, PSEUDONYMIZE, MASK, DROP, TAG_SYNTHETIC}
- `import_run_status` ∈ {RUNNING, COMPLETED, FAILED, CANCELLED, AWAITING_APPROVAL}
- `import_run_wave` NULL OR 1..4

### §7.3 Triggers
- `brownfield_column_mappings_lookup_fk_validate` BEFORE INSERT WHEN transform='LOOKUP_FK' → invokes `brownfield.validate_lookup_fk_payload_trigger()` (Goal 003 Item M / CP2 enforcement of U-2026-05-19-01 cross-check)

### §7.4 Indexes (top)
- `brownfield_table_mappings_source_target_uq` UNIQUE (source_table_id, target_schema, target_table)
- `brownfield_table_mappings_wave_idx` PARTIAL btree (wave) WHERE wave IS NOT NULL
- `brownfield_column_mappings_pair_uq` UNIQUE
- `import_runs_status_started_idx` btree (status, started_at DESC)

### §7.5 FK cascade
- `column_mappings → table_mappings ON DELETE CASCADE` → drop table_mapping cancella tutti i column_mappings collegati
- `column_mappings → source_columns ON DELETE CASCADE` → drop source_column cancella column_mappings
- `table_mappings → source_tables ON DELETE CASCADE`
- `import_runs.initiated_by → sys_users ON DELETE SET NULL` (preserve audit anche se user deleted)

---

## §8 — Per-target macro-area summary

Stessa tabella di `02d_ADV_BROWNFIELD §4`, espansa con percentage hit ratio:

| Target sys.* | N col_mappings | sys.* rows | Hit | Note |
|---|---|---|---|---|
| `sys_skills` | 349 | 6037 | ✅ | from skill_classifications + competencies + others |
| `sys_skill_taxonomy_edges` | 133 | **0** | ❌ | CW-B19 source-side gap (skill_adjacencies has data) |
| `sys_learning_paths` | 89 | 3227 | ✅ | from learning_paths + course_enrollments + skill_development_paths |
| `sys_learning_modules` | 89 | 4488 | ✅ | from courses + course_modules + learning_recommendations + module_completions |
| `sys_compensation_bands` | 67 | 75 | ✅ | from ccnl_contracts/levels/executive_bands + sindacati |
| `sys_esco_occupation_mappings` | 53 | **0** | ❌ | CW-B18 cascade gap |
| `sys_blueprint_overrides` | 53 | 0 | ❌ (source-empty?) | from holidays + tenant_industry_classifications + benchmark_* |
| `sys_position_skill_requirements` | 53 | 0 | ❌ | source data present (job_template_skills 28983 + onet_occupation_skills 71) but compiler issue |
| `sys_skill_categories` | 45 | **0** | ❌ | CW-B20 UQ block |
| `sys_job_roles` | 43 | **0** | ❌ | CW-B18 cascade gap (sys_job_families empty) |
| `sys_skill_families` | 42 | 77 | ✅ | from competency_frameworks + skill_clusters |
| `sys_activity_classifications` | 36 | 3276 | ✅ | from industry_classifications + Item C mig 000032 |
| `sys_skill_learning_mappings` | 23 | **0** | ❌ | from job_title_courses (207) + course_esco_skills (717) + certification_esco_skills (664) — source data present but compiler/registry issue |
| `sys_blueprint_process_registry` | 21 | 23 | ⚠️ partial | from business_processes (which is empty in legacy_mirror!) + process_phases |
| `sys_learning_path_steps` | 20 | **0** | ❌ | CW-B19 source mismatch (course→module no lineage) |
| `sys_user_certifications` | 18 | 1 | ❌ quasi-empty | from certifications (88) + certification_esco_skills (664) — should be much more |
| `sys_skill_aliases` | 16 | **0** | ❌ | from skill_aliases (80) + skill_synonyms (50) — silent skip Class A pre-P1 |
| `sys_process_kpi_templates` | 13 | **0** | ❌ | from process_kpis (81) — silent skip |
| `sys_position_learning_requirements` | 7 | 0 | ❌ | from job_title_learning_paths (source-empty in legacy_mirror) |
| `sys_activity_classification_mappings` | 7 | 0 | ⓘ source-empty | from industry_ccnl_mapping (14 in platform, 0 in mirror!) |

### §8.1 Hit ratio summary

- **6 target popolati** (sys_skills 6037, sys_learning_modules 4488, sys_learning_paths 3227, sys_activity_classifications 3276, sys_skill_families 77, sys_compensation_bands 75)
- **1 target parziale** (sys_blueprint_process_registry 23/63)
- **1 target quasi-empty** (sys_user_certifications 1/?)
- **12+ target empty** con root cause categorizzato (CW-B17/B18/B19/B20)

---

## §9 — Implicazione strategiche

### §9.1 Investment authoring (~50-80 ore engineering)
- 93 source tables catalogati con metadata (row_estimate, schema)
- 1164 source columns inventariati con data_types
- 94 table_mappings authoring (con `EXPLICIT_MAP` dictionary hand-curated 89 entries + fallback heuristic per 3 unclassified)
- 1177 column_mappings via `generate_wave1_column_mappings.mjs` con 14 transform codes + per-target prefix conventions + per-source overrides

**Discardarlo equivale a perdita pura di investment**. Riusarlo per Wave 2/3/4 = leva maggiore.

### §9.2 Hit ratio reale = 36% (40% in numero, ma 6+1+1=8 target su 20 target con mappings = 40% — non bene)

I 12 silent-skip target sono spiegabili (vedi `08_AUDIT_TRAIL_ANALYSIS.md` §3 silent-skip 24552 rows). Risolvibili caso-per-caso (per Opzione 1 brownfield extension) OR riprogettabili (per Opzione 2 SDBI).

### §9.3 UQ constraint (CW-B20) è limitazione strutturale brownfield

Per Opzione 1: relax UQ via nuova migration (es. composite includendo target_column) OR introdurre source_columns aliases.
Per Opzione 2 (SDBI): bypass via temp_ schema (SDBI proprio non scrive in column_mappings).
Per Opzione 3 (Hybrid): brownfield mantiene UQ + SDBI gestisce casi UQ-blocked.

### §9.4 SKIP transform è "controlled exclusion"

39 SKIP transforms = colonne source esplicitamente NON-importate (vector embeddings, soft-delete deleted_at, etc.). Pattern utile per SDBI: 1 fonte può avere colonne "include" + colonne "exclude" deliberate.

### §9.5 CASCADE FK è asset

Drop di un table_mapping pulisce automaticamente column_mappings collegati. SDBI può sfruttare lo stesso pattern (drop temp_schema = clean state).

---

## §10 — Verification anchors

```sql
SELECT COUNT(*) FROM brownfield.source_tables;  -- 93
SELECT COUNT(*) FROM brownfield.source_columns; -- 1164
SELECT COUNT(*) FROM brownfield.table_mappings; -- 94
SELECT COUNT(*) FROM brownfield.column_mappings; -- 1177
SELECT COUNT(*) FROM brownfield.import_runs;    -- 7
SELECT COUNT(*) FROM brownfield.tenant_id_mappings; -- 4

-- Transform distribution
SELECT column_mapping_transform, COUNT(*) FROM brownfield.column_mappings GROUP BY 1 ORDER BY 2 DESC;
-- expected: JSON_EXTRACT 759, CAST_TIMESTAMPTZ 130, LINEAGE_SOURCE_NK 93, TRIM 86, LOOKUP_FK 49, SKIP 39, ...
```

---

*End of 06_BROWNFIELD_REGISTRY_DEEP_DIVE.md*
