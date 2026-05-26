# Forensic Inventory — `heuresys_advanced.staging`

**Snapshot**: 2026-05-20T02:27Z
**Scope**: 17 tables (15 per Wave 1 sys.* target + 2 misc)
**Provenienza**: migration `000030_brownfield_wave1_staging.sql` + populated by Wave 1 retry execution

---

## §1 — Tables (uniform jsonb-buffer schema)

| Table | Est rows | Size | Wave 1 target sys.* |
|---|---|---|---|
| `wave1_esco_occupation_mappings` | 7645 | 82 MB | sys_esco_occupation_mappings |
| `wave1_skill_categories` | 7256 | 17 MB | sys_skill_categories |
| `wave1_skill_taxonomy_edges` | 6306 | 9.8 MB | sys_skill_taxonomy_edges |
| `wave1_skills` | 5753 | 58 MB | sys_skills |
| `wave1_learning_modules` | 4522 | 11 MB | sys_learning_modules |
| `wave1_learning_paths` | 3498 | 9.5 MB | sys_learning_paths |
| `wave1_activity_classifications` | 3284 | 74 MB | sys_activity_classifications |
| `wave1_skill_learning_mappings` | 1588 | 2.8 MB | sys_skill_learning_mappings |
| `wave1_learning_path_steps` | 688 | 1.4 MB | sys_learning_path_steps |
| `wave1_job_roles` | 231 | 680 kB | sys_job_roles |
| `wave1_skill_aliases` | 130 | 304 kB | sys_skill_aliases |
| `wave1_user_certifications` | 88 | 312 kB | sys_user_certifications |
| `wave1_process_kpi_templates` | 81 | 256 kB | sys_process_kpi_templates |
| `wave1_skill_families` | 77 | 272 kB | sys_skill_families |
| `wave1_compensation_bands` | 75 | 256 kB | sys_compensation_bands |
| `wave1_blueprint_process_registry` | 63 | 200 kB | sys_blueprint_process_registry |
| `wave1_activity_classification_mappings` | 0 | 40 kB | sys_activity_classification_mappings |

**Total**: 41,285 staged rows (matching brownfield.import_runs latest STAGE_COMPLETE event: 41285)
**Total size**: ~270 MB (significativo per debug — jsonb storage di raw_record originali)

---

## §2 — Schema uniforme (creata da migration 000030)

Tutte le 17 staging tables hanno la stessa shape per consentire iteration generica del wave executor:

```sql
staging_row_id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
staging_import_run_id       uuid                                 -- FK brownfield.import_runs
staging_source_table        varchar(N)                           -- source table name (es. 'skill_classifications')
staging_source_record_id    varchar(N)                           -- legacy PK as string
staging_source_natural_key  varchar(N)                           -- natural key for ON CONFLICT
staging_source_content_hash char(N)                              -- sha256 or md5 for change detection
staging_raw_record          jsonb                                -- ENTIRE legacy row as jsonb
staging_validation_status   varchar(N)                           -- PENDING | PASSED | FAILED
staging_validation_errors   jsonb                                -- per-row error list
staging_mapping_confidence  numeric                              -- 0.0-1.0 (post-validation score)
staging_target_record_id    uuid                                 -- populated post-upsert
staging_upserted_at         timestamptz                          -- timestamp of upsert
created_at                  timestamptz                          -- staging row insert timestamp
```

**Funzione**: separate raw legacy row dal target sys schema. Permette validation, dry-run, idempotent retry, audit trail. Cleanup tra runs è TRUNCATE per recovery point (vedi migration 000030 comment).

---

## §3 — Wave executor lifecycle (from migration 000030 comment)

```
1. Wave executor loads legacy rows from db/seeds/brownfield/wave1/legacy_data/
   into staging.wave1_<target> table (1 row = 1 staging_raw_record jsonb + provenance)
2. Validation engine populates staging_validation_status + staging_validation_errors
3. Approval gate (auto-approve for wave 1) flips PENDING → PASSED
4. Upsert engine reads brownfield.column_mappings, applies transformations to
   staging_raw_record, and INSERTs into sys.sys_<target> with idempotent
   ON CONFLICT on the natural key, then writes the resulting target uuid
   back to staging_target_record_id and creates a sys_source_lineage_records row
5. audit.import_validation_results + audit.import_approval_decisions
   accumulate per-row outcomes
```

TRUNCATE policy: staging.wave1_<target> may be TRUNCATEd between runs; the run_id FK to brownfield.import_runs ensures isolation across waves.

---

## §4 — Implicazione SDBI

### §4.1 Staging pattern è asset riusabile

Lo schema uniforme jsonb-buffer staging.wave1_* è un buon pattern per:
- Separazione physical layer (raw data) da logical layer (sys target)
- Idempotent retry (TRUNCATE + re-INSERT)
- Validation prima di INSERT in sys
- Provenance tracking

**Per SDBI**: lo stesso pattern può essere esteso a Wave 2/3/4 staging tables, oppure (in SDBI puro/hybrid) lo schema temp_ separato può seguire un design simile.

### §4.2 Staging volume

41,285 staged rows attualmente. È volume modesto. SDBI scale può tranquillamente vivere in staging schema senza issues di performance/size.

---

## §5 — Verification

```sql
SELECT relname, reltuples::bigint FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
WHERE n.nspname='staging' AND c.relkind='r' ORDER BY reltuples DESC;
-- 41285 total expected
SELECT SUM(reltuples)::bigint FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
WHERE n.nspname='staging' AND c.relkind='r';
```

---

*End of 02c_ADV_STAGING.md*
