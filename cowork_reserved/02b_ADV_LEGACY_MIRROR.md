# Forensic Inventory — `heuresys_advanced.legacy_mirror`

**Snapshot**: 2026-05-20T02:25Z
**Scope**: 93 tables, **81 popolate** (87%), 12 empty
**Provenienza**: OUT-OF-MIGRATION via `db/scripts/extract-wave1-legacy.sh` (pg_dump --data-only selettivo da heuresys_platform.public, 88 tables originali + 5 aggiunte runtime durante Wave 1 retry)

---

## §1 — Overview + size

| Metric | Value |
|---|---|
| Tables | 93 |
| Populated | 81 (87%) |
| Empty | 12 |
| Total rows | ~200k+ (Top: esco_occupation_skills 126051) |
| Provenance | pg_dump da `heuresys_platform.public` (88 selected tables per 7 lexicon domains) |

---

## §2 — Tables top 30 per row count (via pg_class.reltuples — verified)

| Table | Rows | Lexicon domain (per extract-wave1-legacy.sh §) |
|---|---|---|
| `esco_occupation_skills` | **126051** | ESKAP (split file: `wave1_eskap_esco_occupation_skills.sql`) |
| `job_template_skills` | **28983** | OPOURSKA |
| `skill_classifications` | **7215** | SKILGRO |
| `esco_skill_relations` | 5818 | ESKAP |
| `occupation_industry_classifications` | 4565 | INDOOR |
| `semantic_entity_index` | 4115 | ESKAP (split file: `wave1_eskap_semantic_entity_index.sql`) |
| `industry_classifications` | **3276** | INDOOR (split file: `wave1_indoor_industry_classifications.sql`) |
| `course_enrollments` | 3052 | SKILGRO |
| `esco_occupations` | **3040** | ESKAP (split file: `wave1_eskap_esco_occupations.sql`) |
| `module_completions` | 2899 | SKILGRO |
| `learning_recommendations` | 1045 | SKILGRO |
| `course_esco_skills` | 717 | SKILGRO |
| `certification_esco_skills` | 664 | SKILGRO |
| `course_modules` | 564 | SKILGRO |
| `competency_review_ratings` | 465 | SKILGRO |
| `learning_ratings` | 396 | SKILGRO |
| `learning_path_enrollments` | 341 | SKILGRO |
| `skill_gap_analyses` | 304 | SKILGRO |
| `onet_occupation_knowledge` | 279 | ESKAP |
| `onet_occupation_work_activities` | 218 | ESKAP |
| `onet_occupation_abilities` | 215 | ESKAP |
| `job_title_courses` | 207 | H2R |
| `skill_demand_metrics` | 200 | SKILGRO |
| `skill_supply_metrics` | 200 | SKILGRO |
| `holidays` | 144 | ITLAB |
| `job_templates` | **140** | OPOURSKA |
| `onet_esco_mappings` | 135 | ESKAP |
| `courses` | **127** | SKILGRO |
| `learning_path_courses` | 124 | SKILGRO |
| `skill_pair_usage` | 111 | SKILGRO |

---

## §3 — Tables per lexicon domain (88 originali da script)

### §3.1 ESKAP (29 tables)

`cross_entity_relations`, `cross_entity_searches`, `esco_isco_groups`, `esco_skill_groups`, `esco_skill_relations`, `onet_abilities`, `onet_esco_mappings`, `onet_import_jobs`, `onet_knowledge`, `onet_occupation_abilities`, `onet_occupation_knowledge`, `onet_occupation_skills`, `onet_occupation_work_activities`, `onet_occupations`, `onet_skills`, `onet_work_activities`, `ontology_categories`, `ontology_embedding_jobs`, `ontology_feedback`, `ontology_inference_jobs`, `ontology_quality_metrics`, `ontology_skill_dimensions`, `ontology_skill_relations`, `ontology_source_mappings`, `semantic_entity_relations`, `semantic_search_log` + 3 split tables (`esco_occupations`, `esco_occupation_skills`, `semantic_entity_index`)

### §3.2 SKILGRO (37 tables)

`certification_esco_skills`, `certifications`, `competencies`, `competency_frameworks`, `competency_review_ratings`, `course_enrollments`, `course_enrollments_semantic`, `course_esco_skills`, `course_modules`, `courses`, `extracted_skills`, `learning_bookmarks`, `learning_content_providers`, `learning_path_courses`, `learning_path_enrollments`, `learning_paths`, `learning_ratings`, `learning_recommendations`, `module_completions`, `rating_scales`, `skill_aliases`, `skill_classifications`, `skill_clusters`, `skill_demand_metrics`, `skill_development_paths`, `skill_extraction_jobs`, `skill_gap_analyses`, `skill_gap_snapshots`, `skill_matrices`, `skill_migration_jobs`, `skill_pair_usage`, `skill_relationships`, `skill_requirements_templates`, `skill_supply_metrics`, `skill_synonyms`, `skill_taxonomy_extensions`, `unknown_skills`

### §3.3 INDOOR (9 tables)

`benchmark_configs`, `benchmark_reports`, `industry_occupation_mapping`, `industry_profiles`, `market_benchmarks`, `market_salary_data`, `occupation_industry_classifications`, `tenant_industry_classifications` + split (`industry_classifications`)

### §3.4 ITLAB (7 tables)

`ccnl_contracts`, `ccnl_executive_bands`, `ccnl_job_title_mapping`, `ccnl_levels`, `ccnl_seniority_rules` (empty in source), `holidays`, `sindacati`

### §3.5 PROGOV (2 tables)

`process_kpis`, `process_phases`

### §3.6 OPOURSKA (2 tables)

`job_templates`, `job_template_skills`

### §3.7 H2R (2 tables)

`job_title_courses`, `job_title_learning_paths` (empty in source)

---

## §4 — Empty tables in legacy_mirror (12)

Confronto con heuresys_platform.public (lo stesso table può essere empty in entrambi o popolato in platform e non in mirror — quest'ultimo caso è il "mirror gap"):

| Empty table in mirror | Status in platform | Verdict |
|---|---|---|
| `business_processes` | 26 rows in platform | **MIRROR GAP** (mancante) — should be added |
| `ccnl_seniority_rules` | 0 in platform | Source-empty (genuine) |
| `cross_entity_searches` | 0 | Source-empty |
| `esco_skills` | **14011 in platform** | **MIRROR GAP critical** — esco_skills missing dal mirror! Importante per skill normalization |
| `extracted_skills` | 0 | Source-empty |
| `import_skill_links` | 0 | Source-empty |
| `industry_ccnl_mapping` | 14 in platform | **MIRROR GAP** |
| `job_title_learning_paths` | 0 | Source-empty |
| `onet_import_jobs` | 0 | Source-empty |
| `ontology_inference_jobs` | 0 | Source-empty |
| `skill_migration_jobs` | 0 | Source-empty |
| `tenant_industry_classifications` | 4 in platform | **MIRROR GAP** |

**Critical finding**: `esco_skills` (14011 rows) — **manca dal mirror**. Questo è significativo perché `sys.sys_skills` ha 6037 rows post-Wave-1 — la differenza 14011-6037 = 7974 rows che potrebbero essere stati estratti da `esco_skills` ma non lo sono perché `esco_skills` non è nel mirror. Il populato sys.sys_skills viene da skill_classifications (7215 rows) tramite mapping diverso.

**4 MIRROR GAPS** identificati:
1. `business_processes` (26 rows) — utile per sys_blueprint_process_registry (cascade vuoto in Goal 003)
2. `esco_skills` (14011 rows) — il dataset più ricco di skills nel platform
3. `industry_ccnl_mapping` (14 rows) — bridge industry↔CCNL
4. `tenant_industry_classifications` (4 rows) — tenant industry mapping

---

## §5 — Implicazione SDBI

### §5.1 Legacy mirror è asset di valore CRITICO

200k+ rows già "in casa" (in heuresys_advanced cluster), no cross-DB query needed per la maggior parte delle operazioni. Latency immediate per qualsiasi SDBI workload.

### §5.2 Estensione mirror è la prima leva strategica

Per le 10 macro-aree platform-but-not-in-mirror identificate in `01_DB_PLATFORM_INVENTORY.md §6.2` (Goals/OKRs, Recruiting, Onboarding, Surveys, Time-Leave, News, Mentorship, Predictions, Feedback, CCNL-extension, SAP-HR), il primo step è **estendere extract-wave1-legacy.sh** con nuove lexicon domains (Wave 2/3/4) per portare quei dati in legacy_mirror.

### §5.3 Critical mirror gaps SHOULD be fixed prima di qualsiasi SDBI

- `esco_skills` 14011 rows in mirror = unlock major skill normalization improvements
- `business_processes` 26 rows = unlock sys_blueprint_process_registry cascade target (Goal 003 INFEASIBLE)

---

## §6 — Verification anchors

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='legacy_mirror' AND table_type='BASE TABLE';  -- 93
SELECT relname, reltuples::bigint FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='legacy_mirror' AND c.relkind='r' ORDER BY reltuples DESC LIMIT 10;
-- Confronto cross-DB:
SELECT 'platform' AS db, COUNT(*) FROM dblink('host=localhost dbname=heuresys_platform', 'SELECT 1 FROM public.business_processes') AS t(x INT);
-- expected platform=26, advanced=0 → confirms mirror gap
```

---

*End of 02b_ADV_LEGACY_MIRROR.md*
