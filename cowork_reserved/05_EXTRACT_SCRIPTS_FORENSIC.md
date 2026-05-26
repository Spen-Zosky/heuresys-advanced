# Extract Scripts Forensic — Out-of-Migration Genesis

**Snapshot**: 2026-05-20T02:40Z
**Scope**: Identificare CHI ha popolato COSA e QUANDO in `heuresys_advanced`, oltre alle 33 migrations

---

## §1 — Scripts inventory complete

| Script | Lines | Path | Purpose |
|---|---|---|---|
| `setup_oci_vm_database.sh` | 98 | db/scripts/ | One-shot bootstrap DB su VM (CREATE ROLE + CREATE DATABASE + schemas + extensions) |
| `create_local_database.{ps1,sh}` | 141 / 82 | db/scripts/ | Model A (localhost) bootstrap equivalente |
| `migrate.{ps1,sh}` | 98 / 67 | db/scripts/ | Migration runner (applica `db/migrations/*.sql` in lexical order, audit in sys_schema_migrations) |
| `reset_local_database.{ps1,sh}` | 73 / 52 | db/scripts/ | DROP+CREATE DB (destructive, dev only) |
| `validate_database.{ps1,sh}` | 159 / 143 | db/scripts/ | Esegue `sys.v_*` validation views + twice-run pg_dump diff |
| `extract-wave1-legacy.sh` | 115 | db/scripts/ | **CRITICAL** — pg_dump --data-only selettivo da heuresys_platform per 88 tabelle (7 lexicon domains) → `db/seeds/brownfield/wave1/legacy_data/*.sql` |
| `brownfield-wave-1-preflight.{ps1,sh}` | 165 / 185 | db/scripts/ | Pre-flight read-only check (6 step) — verifica brownfield+audit schema + Wave 1 mappings + 17 target tables present + source row estimates |
| `seed-reference-bank.ts` | 439 | db/scripts/ | Seed reference catalogs (enterprise_size_bands 4 + operating_model_catalog 6 + reward_gate_catalog 7 + assessment_methods 5 + ecc.) — invocato da `pnpm db:seed` |
| `seed-test-admin.ts` | 419 | db/scripts/ | Seed test admin users (5 personas) — invocato da `pnpm db:seed-test-admin` |
| `generate_wave1_seeds.mjs` | 486 | scripts/ | **CRITICAL** — Generates 4 SQL seed files (`00_source_export.sql`, `01_source_tables.sql`, `02_source_columns.sql`, `03_table_mappings.sql`) da catalog.json + tables_with_domains.csv + EXPLICIT_MAP hand-curated dictionary |
| `generate_wave1_column_mappings.mjs` | 675 | scripts/ | **CRITICAL** — Generates `04_column_mappings.sql` (1177 rows) via live DB introspection + per-target column prefix conventions + 14 transform rules |
| `run-wave1-fullscale.mjs` | 169 | scripts/ | Wave 1 execution via API REST (POST /v1/brownfield/wave-executor/runs, soft timeout 10min, hard 11min) |
| `cowork-exchange/` | (multiple) | scripts/ | Cowork↔CLI protocol scripts (validator, locks, inbox, etc.) — non rilevante per provenance dati |
| `sync-showcase.sh` | 29 | scripts/ | Non rilevante (UI sync) |

---

## §2 — Cronologia popolamento heuresys_advanced

### §2.1 Step 1 — DB cluster bootstrap (2026-05-18 mattina)

**Script**: `setup_oci_vm_database.sh`

Eseguito UNA volta via SSH a `oracle-vm-default`. Outcome:
- CREATE ROLE `heuresys` LOGIN PASSWORD '****' CREATEDB
- CREATE DATABASE `heuresys_advanced` OWNER heuresys (side-by-side con `heuresys_platform` legacy)
- CREATE SCHEMA `sys`, `staging`, `brownfield`, `audit` AUTHORIZATION heuresys
- CREATE EXTENSION `pgcrypto`, `uuid-ossp`, `pg_trgm`

DB inizialmente vuoto. Tutte le tabelle e dati arrivano dopo.

### §2.2 Step 2 — Schema scaffold via 33 migrations (2026-05-18)

**Script**: `migrate.sh` (o `migrate.ps1`)

Applica 33 migrations 000001-000027 + 000028 + 000029-000030 + 000031-000033 in lexical order. Vedi `04_MIGRATIONS_TIMELINE.md` per dettaglio.

Outcome dopo step 2 (al termine di migrate.sh first run):
- 118 sys.* tabelle (vuote tranne reference catalogs seeded da 000021)
- 4 audit.* tabelle (vuote)
- 7 brownfield.* tabelle (vuote per import_runs, ma `table_mappings` 94 + `source_tables` 93 + `source_columns` 1164 + `column_mappings` 1177 popolate da migrations 000029-000030 via INSERT statements embedded)
- 17 staging.* tabelle vuote (create da 000030)
- `sys.sys_users` ha 0 row (i 5 test admin arrivano nello step 4)

### §2.3 Step 3 — Extract legacy data + populate `legacy_mirror` (2026-05-18)

**Script**: `extract-wave1-legacy.sh`

Eseguito (probabilmente) post-migrations. Output: 11 file SQL in `db/seeds/brownfield/wave1/legacy_data/` (gitignored, ~356 MB):
- `wave1_eskap.sql` + 3 split files (esco_occupations, esco_occupation_skills, semantic_entity_index)
- `wave1_skilgro.sql`
- `wave1_indoor.sql` + 1 split (industry_classifications)
- `wave1_itlab.sql`
- `wave1_progov.sql`
- `wave1_opourska.sql`
- `wave1_h2r.sql`

**Processo dump**:
```bash
ssh oracle-vm-default \
  "sudo -u postgres pg_dump --data-only --no-owner --no-privileges --no-tablespaces \
   --no-comments --format=plain --column-inserts --rows-per-insert=1000 \
   -t public.<table> -t public.<table> ... -d heuresys_platform"
```

**Restoration in heuresys_advanced.legacy_mirror**: i file SQL output sono `INSERT INTO public.<table>` per default. **C'è uno step IMPLICITO** che li importa nel `legacy_mirror` schema. Possibili approcci:
1. `sed 's/public\./legacy_mirror./g'` + `psql -f ...` (search-and-replace)
2. `psql -c "SET search_path TO legacy_mirror" -f wave1_*.sql` (search_path trick)
3. Restoration via altro tool

**Verifica empirica**: `legacy_mirror.*` ha 93 tabelle (88 da script + 5 in più, probabilmente run-time addons), 81 popolate, ~200k rows.

Lo step di restoration **non è scriptato nel repo** (extract-wave1-legacy.sh produce solo i file SQL). Quindi: probabilmente eseguito manualmente da Enzo o da uno script ad-hoc non committato.

### §2.4 Step 4 — Reference catalogs + test admin (2026-05-18)

**Scripts**: `seed-reference-bank.ts` (`pnpm db:seed`) + `seed-test-admin.ts` (`pnpm db:seed-test-admin`)

Outcome:
- `sys.sys_assessment_methods` 5 rows
- `sys.sys_kpi_assessment_methods` 5 rows
- `sys.sys_assessments` 2 rows
- `sys.sys_enterprise_size_bands` 4 rows
- `sys.sys_kpi_weighting_rules` 3 rows
- `sys.sys_operating_model_catalog` 6 rows
- `sys.sys_reward_gate_catalog` 7 rows
- `sys.sys_training_initiatives` 1 row
- `sys.sys_blueprint_families` 1 row
- `sys.sys_blueprint_variants` 1 row
- `sys.sys_organization_unit_types` 8 rows
- `sys.sys_organization_units` 6 rows
- `sys.sys_branches` 5 rows
- `sys.sys_skill_proficiency_levels` 6 rows
- `sys.sys_tenancies` 2 rows (RTL_BANK_REFERENCE + 1 second)
- `sys.sys_auth_roles` 8 rows (8 roles canonical)
- `sys.sys_auth_permissions` 99 rows
- `sys.sys_auth_role_permissions` 394 rows (RBP matrix)

E poi seed-test-admin.ts crea:
- 5 `sys.sys_users` (test personas: admin@heuresys.com, tenant_admin_test, manager_test, employee_test, outsider_test)
- 5 `sys.sys_auth_credentials`
- 5 `sys.sys_auth_identities`
- 5 `sys.sys_user_auth_roles`
- 1 `sys.sys_user_profiles`
- 1 `sys.sys_user_certifications` (sample)
- 161 `sys.sys_positions` + 161 `sys.sys_user_position_assignments` (note: 161 più di 5 — probabilmente provenienti da una source diversa, da indagare)

**Anomalia da indagare**: `sys.sys_positions` 161 rows e `sys.sys_user_position_assignments` 161 rows non hanno ovvia provenienza da seed-test-admin (5 users). Probabile che siano popolati da brownfield Wave 1 retry (job_templates 140 + some other source).

### §2.5 Step 5 — Brownfield registry pre-seeded via migrations 000029-000030 + scripts

**Scripts** (run-time pre-Wave-1-execution):
1. `generate_wave1_seeds.mjs` — produce `db/seeds/brownfield/wave1/{00,01,02,03}_*.sql`
2. `generate_wave1_column_mappings.mjs` — produce `db/seeds/brownfield/wave1/04_column_mappings.sql`

I file 00-04 vengono **inclusi nelle migrations 000029-000030** o eseguiti come step separato. (Migration 000029 = `brownfield_table_mapping_wave.sql` ha INSERTs)

Outcome:
- `brownfield.source_exports` 1 row (db-export-2026-05-15)
- `brownfield.source_tables` 93 rows (1 per source table in scope Wave 1)
- `brownfield.source_columns` 1164 rows (1 per source column importable)
- `brownfield.table_mappings` 94 rows (TUTTE wave=1, classification=IMPORT, approval=APPROVED)
- `brownfield.column_mappings` 1177 rows (con 14 transform codes — vedi §3.4 di 02d_ADV_BROWNFIELD.md)

### §2.6 Step 6 — Brownfield Wave 1 retry execution (2026-05-18 / 19, 5+ runs)

**Script**: `run-wave1-fullscale.mjs` (Goal 002) + via API direct in Goal 003

Outcome cumulativo (latest run `08d3bc9f`):
- `staging.wave1_*` 41285 rows (1 per legacy row in scope)
- `audit.import_validation_results` 207276 rows (5+ runs × ~41k each)
- `audit.import_approval_decisions` 355 rows
- `audit.import_run_logs` 50 rows (9 events/run × 5 runs + 5 events/run K-hygiene)
- `brownfield.import_runs` 7 rows (5 successful Wave 1 + 1 K-hygiene + 1 DEMO failed)
- `sys.sys_skills` 6037 rows
- `sys.sys_learning_modules` 4488 rows
- `sys.sys_learning_paths` 3227 rows
- `sys.sys_activity_classifications` 3276 rows (post-mig 000032)
- `sys.sys_skill_families` 77 rows
- `sys.sys_compensation_bands` 75 rows
- `sys.sys_blueprint_process_registry` 23 rows (partial — staging aveva 63)
- `sys.sys_source_lineage_records` 4099 rows
- `sys.sys_positions` 161 rows + `sys.sys_user_position_assignments` 161 rows

Wall-clock latest run: 48 minuti (2896s), ~6 upserts/sec.

### §2.7 Step 7 — Goal 003 hot-fix tenant_id_mappings (2026-05-19)

**Source**: migration 000033 (INSERT statements)

Outcome:
- `brownfield.tenant_id_mappings` 4 rows (RTL_BANK + SmartFood + EcoNova + Heuresys System → tutti → RTL_BANK_REFERENCE)

---

## §3 — `EXPLICIT_MAP` dictionary (provenance dei 94 table_mappings)

Il file `generate_wave1_seeds.mjs` (lines 47-155) contiene un dictionary hand-curated di **93 source tables → target sys.* tables**. Questo è il **CUORE dell'autoria mapping** del brownfield Wave 1:

### §3.1 OPOURSKA mappings (4 source tables)

```javascript
business_processes:        [{ t: 'sys_blueprint_process_registry', ... }]
esco_skills:               [{ t: 'sys_skills', ... }]    // NOTE: esco_skills NON è in legacy_mirror!
job_templates:             [{ t: 'sys_job_roles', ... }]
job_template_skills:       [{ t: 'sys_position_skill_requirements', ... }]
```

### §3.2 INDOOR mappings (10 source tables)

```javascript
industry_classifications:    [→ sys_activity_classifications (ATECO_2025 + NACE_REV_2_1)]
industry_ccnl_mapping:       [→ sys_activity_classification_mappings]
industry_occupation_mapping: [→ sys_esco_occupation_mappings]
benchmark_configs:           [→ sys_blueprint_overrides]
benchmark_reports:           [→ sys_blueprint_overrides]
industry_profiles:           [→ sys_activity_classifications]
industry_size_bands:         [→ sys_activity_classifications]
occupation_industry_classifications: [→ sys_esco_occupation_mappings]
tenant_industry_classifications:     [→ sys_blueprint_overrides]
holidays:                    [→ sys_blueprint_overrides]   // Holiday catalog override
```

### §3.3 H2R mappings (2 source tables, IMPORT only)

```javascript
job_title_courses:        [→ sys_skill_learning_mappings]
job_title_learning_paths: [→ sys_position_learning_requirements]
```

### §3.4 SKILGRO mappings (39 source tables)

Sample (più importanti):
- `competencies` → sys_skills + sys_skill_categories (1 source → 2 target)
- `competency_frameworks` → sys_skill_families
- `courses` → sys_learning_modules
- `course_modules` → sys_learning_path_steps
- `course_enrollments` → sys_learning_paths
- `learning_paths` → sys_learning_paths
- `learning_path_courses` → sys_learning_path_steps
- `skill_classifications` → sys_skill_categories
- `skill_clusters` → sys_skill_families
- `skill_adjacencies` → sys_skill_taxonomy_edges
- `skill_aliases` → sys_skill_aliases
- `skill_synonyms` → sys_skill_aliases
- `skill_relationships` → sys_skill_taxonomy_edges
- `certifications` → sys_user_certifications
- ecc.

### §3.5 ITLAB mappings (7 source tables)

```javascript
ccnl_contracts:        [→ sys_compensation_bands]
ccnl_executive_bands:  [→ sys_compensation_bands]
ccnl_job_title_mapping:[→ sys_job_roles]
ccnl_levels:           [→ sys_compensation_bands]
ccnl_seniority_rules:  [→ sys_compensation_bands]
sindacati:             [→ sys_compensation_bands]  // 'union reference promoted to band overlay'
```

### §3.6 PROGOV mappings (2 source tables)

```javascript
process_kpis:   [→ sys_process_kpi_templates]
process_phases: [→ sys_blueprint_process_registry]  // embedded as metadata.phases
```

### §3.7 ESKAP mappings (29 source tables)

Sample:
- `cross_entity_relations` → sys_skill_taxonomy_edges
- `esco_isco_groups` → sys_skill_families
- `esco_occupation_skills` → sys_position_skill_requirements
- `esco_occupations` → sys_esco_occupation_mappings
- `esco_skill_groups` → sys_skill_families
- `esco_skill_relations` → sys_skill_taxonomy_edges
- `onet_abilities` → sys_skills
- `onet_esco_mappings` → sys_skill_taxonomy_edges
- `onet_knowledge` → sys_skills
- `onet_occupation_*` → sys_position_skill_requirements
- `onet_occupations` → sys_esco_occupation_mappings
- `onet_skills` → sys_skills
- `onet_work_activities` → sys_skills
- `ontology_categories` → sys_skill_categories
- `ontology_skill_dimensions` → sys_skills
- `ontology_skill_relations` → sys_skill_taxonomy_edges
- `ontology_source_mappings` → sys_skill_taxonomy_edges
- `semantic_entity_*` → sys_skills + sys_skill_taxonomy_edges

### §3.8 Fallback heuristic `assignTarget()`

Per source tables NOT in EXPLICIT_MAP:
- ESKAP → sys_skill_taxonomy_edges (se nome contiene relation/edge/mapping) else sys_skills
- SKILGRO → sys_skills (skill) | sys_learning_modules (learn/course/module) | sys_skill_categories (else)
- INDOOR → sys_activity_classifications (industry/nace/ateco) | sys_esco_occupation_mappings (else)
- ITLAB → sys_compensation_bands (always)
- PROGOV → sys_process_kpi_templates (always)
- OPOURSKA → sys_blueprint_process_registry (always)
- H2R → sys_skill_learning_mappings (always)
- (unmapped) → sys_skills (`UNMAPPED::<name>::<id>`, h: 'NO_DOMAIN_RULE — TODO map')

---

## §4 — `generate_wave1_column_mappings.mjs` — column-level mapping authoring

Genera i 1177 column_mappings rows in `brownfield.column_mappings`.

**Strategy** (in priority order, from script header):
1. Per-source-table OVERRIDES (hand-curated)
2. Per-target-table SEMANTIC ALIASES (legacy_name → canonical target_name)
3. Canonical name match (es. legacy `created_at` → target `created_at`)
4. STANDARD lineage/audit defaults (id → *_legacy_id stored inside *_metadata)
5. EMBED_IN_METADATA fallback (record as JSON path inside <target>_metadata)
6. SKIP for explicit unmappable fixtures (AI embedding vectors, pgvector USER-DEFINED, transient deleted_at)

**Per-target column prefix** (line 93-100+, mapping concept → actual column name):
```javascript
sys_activity_classifications:           'activity_classification_',
sys_activity_classification_mappings:   'activity_class_mapping_',
sys_blueprint_overrides:                'blueprint_override_',
sys_blueprint_process_registry:         'blueprint_process_',
sys_compensation_bands:                 'compensation_band_',
sys_esco_occupation_mappings:           'esco_occupation_mapping_',
sys_job_roles:                          'job_role_',
... (continua per tutti i 20 target Wave 1)
```

Questo prefix mapping è **knowledge encoded in the script** — riusabile per qualsiasi Wave 2/3/4 extension.

---

## §5 — Implications strategiche

### §5.1 Authoring brownfield è significativo

L'investment in:
- `EXPLICIT_MAP` dictionary (93 entries hand-curated)
- `assignTarget()` heuristic fallback
- `generate_wave1_column_mappings.mjs` (675 lines di logic per generare 1177 column_mappings)
- Per-target column prefix convention

è **~50-80 ore di engineering** (estima conservativa). Discard = perdita pura.

### §5.2 Extension a Wave 2/3/4 è FATTIBILE seguendo lo stesso pattern

Per estendere il brownfield ad altre source domain (Wave 2 = SAP HR, Wave 3 = transactional employee data, Wave 4 = analytics):

1. Aggiungere nuove migrations sys.* dove target schema manca (es. sys_goals/okrs/recruiting/onboarding/surveys)
2. Estendere `extract-wave1-legacy.sh` → `extract-waveN-legacy.sh` con nuovi 7 lexicon domains
3. Estendere `EXPLICIT_MAP` in `generate_waveN_seeds.mjs` con i nuovi (source → target) mapping
4. Estendere `generate_waveN_column_mappings.mjs` per i nuovi target column prefix
5. Adattare `brownfield-wave-N-preflight.sh` con nuovi target list
6. Triggerare via `run-waveN-fullscale.mjs` (eventually estendere a `run-wave-fullscale.mjs --wave N` per generalize)

Effort stimato per Wave 2 sola: ~20-40 ore engineering + ~2-5 ore execution wall-clock.

### §5.3 Mancano scripts per restoration legacy_mirror

`extract-wave1-legacy.sh` produce file SQL — manca lo step di restoration in `legacy_mirror`. Probabilmente eseguito ad-hoc da Enzo. **Gap di automation**: dovrebbe esistere uno script `restore-legacy-data.sh` che fa `psql -d heuresys_advanced -c "SET search_path TO legacy_mirror" -f wave1_*.sql`.

### §5.4 Fallback heuristic `assignTarget()` è zona grigia

Per source tables NOT in EXPLICIT_MAP (ce ne sono?), il fallback heuristic potrebbe produrre mapping non-ottimali. Verificare quante delle 94 `table_mappings` rows sono state generate via EXPLICIT_MAP vs fallback.

### §5.5 SDBI può riusare l'architettura ma sostituire EXPLICIT_MAP con AI

**Key insight per Opzione 3 (Hybrid)**: il `EXPLICIT_MAP` dictionary è esattamente ciò che SDBI propone di generare via AI semantic matching. Invece di hand-curated EXPLICIT_MAP, SDBI farebbe AI-led generation per source NOT-yet-mapped.

Workflow ibrido:
- **Brownfield**: per i 93 source tables già in EXPLICIT_MAP → standard pipeline (validated, fast, deterministic)
- **SDBI**: per nuovi source tables (Wave 2/3/4 areas not in legacy_mirror) → AI analogy matching propone mapping_card → human review → INSERT in EXPLICIT_MAP equivalent → standard pipeline downstream

Quindi SDBI può essere **front-end di analogy matching** che ALIMENTA il brownfield existing pipeline (Opzione 3).

---

## §6 — Verification anchors

```sql
-- Verify brownfield registry counts
SELECT COUNT(*) FROM brownfield.source_tables;  -- 93
SELECT COUNT(*) FROM brownfield.source_columns; -- 1164
SELECT COUNT(*) FROM brownfield.table_mappings; -- 94
SELECT COUNT(*) FROM brownfield.column_mappings; -- 1177

-- Verify run history
SELECT COUNT(*) FROM brownfield.import_runs; -- 7
SELECT import_run_status, COUNT(*) FROM brownfield.import_runs GROUP BY 1;

-- Verify staging volume
SELECT SUM(reltuples)::bigint FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
WHERE n.nspname='staging' AND c.relkind='r';  -- ~41285

-- Verify legacy_mirror is populated (not from migration)
SELECT relname, reltuples::bigint FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
WHERE n.nspname='legacy_mirror' AND c.relkind='r' ORDER BY reltuples DESC LIMIT 5;
-- Expected: esco_occupation_skills 126k, job_template_skills 28k, etc.
```

---

*End of 05_EXTRACT_SCRIPTS_FORENSIC.md*
