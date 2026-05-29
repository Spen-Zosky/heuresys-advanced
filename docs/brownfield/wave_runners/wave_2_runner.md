# Wave 2 Execution Runbook

## RTL_BANK_REFERENCE Tenant Operating Model — Brownfield Import

> **Status**: DRAFT (planning deliverable per `BOOTSTRAP_EXECUTION_PLAN.md` RD-22, refresh forensic DOC-7 2026-05-26). Awaiting P0 closure + Enzo sign-off before opening execution session.
> **Owner**: Enzo Spenuso (single decider, single executor).
> **Predecessor**: `WAVE_1_EXECUTION_RUNBOOK.md` (template + lessons learned).
> **Successor**: `wave_3_runner.md` (sensitive tenant data + human approval).
> **Parent plan**: `BROWNFIELD_IMPORT_PLAN.md` §4 (Wave 2 specification).
> **Roadmap context**: `MVP_4_ROADMAP.md` stream 2.1.

---

## §0 Scope

**Goal**: popolare i target canonical `sys.*` che descrivono il **tenant operating model** del tenant di riferimento `RTL_BANK_REFERENCE` — organizzazione, blueprint activations, posizioni, KPI definitions, process roles, position requirements. Tutto resta confinato al singolo tenant (no cross-tenant leak); il modello è la base su cui Wave 3 (demo person data) si attacca.

**Source**: ~94 source tables del legacy `heuresys_platform.public` (TRANSFORM class) per i domain `DGOV`, `OPOURSKA`, `INDOOR`, `GOKMER`, `PROGOV`, `RBP`, `ITLAB`, `PET`. Riferimento `BROWNFIELD_IMPORT_PLAN.md` §4.1.

**Target**: ~31 `sys.*` canonical tables. Esemplificative:
- `sys.sys_organization_units` (org hierarchy DAG)
- `sys.sys_branches` (5 RTL Bank branches)
- `sys.sys_blueprint_activations` (tenant-specific blueprint instance)
- `sys.sys_blueprint_variants` (tenant override deltas)
- `sys.sys_enterprise_typing_profiles` (industry + size + maturity)
- `sys.sys_job_families` (RTL Bank family tree)
- `sys.sys_kpi_definitions` (tenant KPI definitions)
- `sys.sys_process_kpi_templates` (process×KPI bindings)
- `sys.sys_organization_unit_kpi_templates` (org_unit×KPI bindings)
- `sys.sys_kpi_targets` (tenant target values)
- `sys.sys_position_skill_requirements` (position×skill matrix)
- `sys.sys_position_kpi_requirements` (position×KPI matrix)
- `sys.sys_position_learning_requirements` (position×training matrix)
- `sys.sys_assessment_results` (tenant assessment evidence)

**Tenant boundary (I5)**: ogni canonical row Wave 2 ha `*_tenant_id` resolvable via `brownfield.tenant_id_mappings(legacy_id → canonical_tenant_id)`. Il mapping deve esistere e puntare a `RTL_BANK_REFERENCE` per Wave 2 scope (altri tenant restano Wave 3 ambit).

**Approval**: auto-approval con confidence ≥ 0.85 + zero cross-tenant FK + PASSED validation. Human gate non richiesto (operating model è strutturale, non sensitive).

**Acceptance threshold (RD-33 default)**: 85% dei ~94 source tables con `state = COMPLETE`, consistente con pragmatismo Wave 1 (13/19 IMPORT target shipped pragmatic).

---

## §1 Pre-flight

### §1.1 Infrastructure required (live before run)

1. **SSH tunnel** OCI VM tunnel `localhost:5433 → oracle-vm-default:5432` UP:
   ```bash
   ssh -fN -L 5433:localhost:5432 oracle-vm-default
   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT version();"
   ```
2. **Baseline tests green** (regression prevention):
   ```bash
   cd apps/api && pnpm test         # target ≥ 341 PASS / 1 fail pre-esistente skills:131
   cd apps/api && pnpm typecheck    # 0 error
   ```
3. **`pnpm db:validate` twice-run idempotency proof green** prima di Wave 2 start (baseline preservata).
4. **WAL space libero** su OCI VM PostgreSQL: minimo **5-10 GB liberi** (Wave 2 stima 1-3 GB di staging + ~500MB indici post-upsert).

### §1.2 Backup pre-run (mandatory)

```bash
# Da OCI VM (SSH first)
ssh oracle-vm-default
pg_dump -U heuresys -d heuresys_advanced --schema-only > /tmp/heuresys_pre_wave2_$(date +%Y%m%d_%H%M%S).schema.sql
pg_dump -U heuresys -d heuresys_advanced --data-only --schema=sys > /tmp/heuresys_pre_wave2_$(date +%Y%m%d_%H%M%S).sys_data.sql
# Compress + transfer to local
gzip /tmp/heuresys_pre_wave2_*.sql
# scp pull from Windows side
scp oracle-vm-default:/tmp/heuresys_pre_wave2_*.sql.gz D:/heuresys-advanced/qa_artifacts/db_snapshots/
```

Snapshot file path target: `qa_artifacts/db_snapshots/heuresys_pre_wave2_<timestamp>.{schema,sys_data}.sql.gz` (gitignored, persistent on disk).

### §1.3 Pre-flight script (analogo Wave 1)

Deliverable da implementare (CODE side, post P0 closure): `db/scripts/brownfield-wave-2-preflight.{sh,ps1}` con check:

| # | Check | Expected |
|---|---|---|
| 1 | DB reachable via tunnel 5433 | OK |
| 2 | `brownfield` schema present | OK |
| 3 | `brownfield.table_mappings WHERE table_mapping_wave = 2 AND table_mapping_approval_status = 'APPROVED' AND table_mapping_classification IN ('IMPORT','TRANSFORM')` count | ≥ 80 (target ~94) |
| 4 | Every approved Wave 2 mapping references registered `brownfield.source_tables` row | 0 orphan |
| 5 | All ~31 canonical Wave 2 target tables exist under `sys.sys_*` | OK |
| 6 | `brownfield.tenant_id_mappings` ha row per legacy tenant `RTL_BANK_REFERENCE` | OK |
| 7 | Wave 1 baseline non disturbata (`SELECT COUNT(*) FROM sys.sys_skills` ≥ baseline post-Wave-1) | OK |
| 8 | (Informational) top 10 Wave 2 source tables by row count printed | INFO |

Exit 0 only when all checks PASSED.

### §1.4 P0 dependency check

Verificare che P0-2 (CW-B60-A engine silent-filter) e P0-3 (CW-B60-B scope ADR) siano CLOSED prima di Wave 2 trigger. Verifica:
- `cowork_reserved/bias_registry.md` mostra `CW-B60-A: MITIGATED`, `CW-B60-B: MITIGATED`.
- `apps/api/test/brownfield-wave-executor*.test.ts` ha nuovi unit test per silent-filter observability + scope rule.

---

## §2 Registry preparation

### §2.1 `brownfield.table_mappings` Wave 2 population

Wave 1 ha popolato `table_mappings` per source tables dei domain ESKAP/SKILGRO/INDOOR/ITLAB/PROGOV/OPOURSKA/H2R. Wave 2 estende il registry per i domain restanti (DGOV, GOKMER, RBP, PET + il TRANSFORM-class subset di INDOOR/OPOURSKA non già coperto).

**Pattern di population** (idempotente, analogo migration 000029 Wave 1 backfill):

```sql
-- Pseudo-template: per ogni source_table dominio Wave 2
INSERT INTO brownfield.table_mappings (
  table_mapping_id,
  table_mapping_source_table_id,
  table_mapping_target_schema,
  table_mapping_target_table,
  table_mapping_wave,
  table_mapping_classification,
  table_mapping_approval_status,
  table_mapping_confidence_threshold,
  table_mapping_created_at
)
SELECT
  gen_random_uuid(),
  st.source_table_id,
  'sys',
  '<target_table_name>',
  2,
  'TRANSFORM',
  'APPROVED',
  0.85,
  now()
FROM brownfield.source_tables st
WHERE st.source_table_domain = '<DOMAIN>'
  AND st.source_table_name = '<source_name>'
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.table_mappings tm
     WHERE tm.table_mapping_source_table_id = st.source_table_id
       AND tm.table_mapping_wave = 2
  );
```

Wave 2 registry population script: `db/scripts/brownfield-wave-2-register.{ts,sh}` (deliverable da implementare). Pattern: idempotent INSERT...WHERE NOT EXISTS, safe to re-run.

### §2.2 Column mappings Wave 2

Per ogni table mapping Wave 2, popolare `brownfield.column_mappings` con il mapping field-by-field. Wave 1 ha 1271 column_mappings; Wave 2 stima **+800-1200 nuovi column_mappings** (operating model più ampio + cross-table FK chains).

Pattern: column_mappings sono hand-curated per quality, ma scaffolded da script auto-discovery (`db/scripts/brownfield-discover-columns.ts` se esiste, altrimenti deliverable nuovo).

### §2.3 Expected counts

| Domain | Wave 2 source tables | Target sys.* tables | Expected row volume |
|---|---:|---:|---:|
| DGOV (tenant root) | 1 | 1 (`sys_tenancies`) | 1 (RTL_BANK_REFERENCE) |
| OPOURSKA (org structure) | ~36 | ~5 (org_units, branches, enterprise_typing, job_families, blueprint_activations) | ~5k rows (units + positions + branches) |
| INDOOR (blueprint) | 3 | 2 (blueprint_variants, blueprint_activations) | ~50 (blueprints + variants) |
| GOKMER (KPI + goals) | ~37 | ~6 (kpi_definitions, metric_definitions, kpi_targets, process_kpi_templates, organization_unit_kpi_templates, assessment_results) | ~2k (definitions + targets + assessments) |
| PROGOV (process governance) | ~11 | ~3 (position_learning_requirements, position_skill_requirements, position_kpi_requirements) | ~3k (requirements matrix) |
| RBP (role-based perm sync) | 6 | ~2 (sys_users SYNTHETIC, sys_auth_role_permissions canonical 8 roles only) | ~158 (RTL synthetic users) + 394 mappings (canonical roles only) |
| ITLAB (tenant CCNL link) | 2 | metadata JSONB extension on `sys_enterprise_typing_profiles.tenant_metadata` | inline |
| PET (rbp scope) | 2 | extension on `sys_auth_permissions` (resource scope) | inline |
| **TOTAL** | **~94** | **~31** | **~10-15k rows** |

---

## §3 Staging migration

### §3.1 Staging tables Wave 2

Pattern (mirror Wave 1): `staging.wave2_<tableset>` tables, uniform jsonb buffer + PK minimo. Migrations attese in range **000044+**:

| Migration suggerita | Content |
|---|---|
| `000044_staging_wave2_tenant_root.sql` | `staging.wave2_tenants` (DGOV) |
| `000045_staging_wave2_org_structure.sql` | `staging.wave2_org_units`, `staging.wave2_branches`, `staging.wave2_cost_centers`, ... (OPOURSKA bucket) |
| `000046_staging_wave2_kpi_goals.sql` | `staging.wave2_kpi_definitions`, `staging.wave2_kpi_targets`, `staging.wave2_assessment_results`, ... (GOKMER bucket) |
| `000047_staging_wave2_requirements.sql` | `staging.wave2_position_requirements_skill`, `staging.wave2_position_requirements_kpi`, `staging.wave2_position_requirements_learning` (PROGOV) |
| `000048_staging_wave2_role_perms.sql` | `staging.wave2_rbp_users`, `staging.wave2_rbp_role_perms` (RBP) |
| `000049_staging_wave2_metadata.sql` | helper staging for ITLAB + PET (small) |
| `000050_brownfield_table_mappings_wave_2_backfill.sql` | idempotent UPDATE Wave 2 backfill (analogo 000029 Wave 1) |

Numerazione tentativa: definitiva post P0 closure + revisione gap 000035.

### §3.2 Idempotency

Ogni staging table:
- `CREATE TABLE IF NOT EXISTS staging.wave2_<name> (...)`.
- `TRUNCATE`-able per re-run safety.
- Minimal constraints (only PK on natural key).
- Run twice → empty diff su schema.

---

## §4 Execution steps

### §4.1 Trigger via API

```bash
# 1. Login as PLATFORM_ADMIN
curl -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@heuresys.com", "password": "<from .env>"}' \
  -c cookies.txt

# 2. Extract CSRF token from cookie
CSRF=$(grep hrx_csrf cookies.txt | awk '{print $NF}')

# 3. Trigger Wave 2 run
curl -X POST http://localhost:3001/v1/brownfield/import-runs \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b cookies.txt \
  -d '{"wave": 2, "mode": "EXECUTE"}'
# Response: { "import_run_id": "<uuid>", "state": "PENDING" }
```

Alternativa: trigger via UI `/brownfield-adaptation` (Wave 2 button — verificare presenza, eventualmente nuovo deliverable UI minore).

### §4.2 State machine (8 states)

Riferimento `apps/api/src/modules/brownfield-wave-executor/`. State machine canonical (NOT 6 stati come da doc legacy, **8 stati** verificato 2026-05-26):

```
PENDING → STAGING → VALIDATING → APPROVED → UPSERTING → COMPLETE
                                                ↓           ↑
                                            (cancel)     (idempotent re-run)
                                                ↓
                                          FAILED or CANCELLED
```

Wave executor process loop:
1. **PENDING**: row inserita in `brownfield.import_runs`, executor loop picks up.
2. **STAGING**: per ogni APPROVED mapping, drop+recreate `staging.wave2_<table>`, bulk insert from `legacy_mirror.<source>`.
3. **VALIDATING**: per ogni staging row, run validation rules (§5). Populate `audit.import_validation_results`.
4. **APPROVED**: auto-approval se 100% PASSED + confidence ≥ 0.85; record decision in `audit.import_approval_decisions` con `approver = 'AUTO'`.
5. **UPSERTING**: per ogni staged row APPROVED, idempotent `INSERT ... ON CONFLICT (natural_key) DO UPDATE SET ...` su target `sys.*`. Lineage row per ogni canonical row.
6. **COMPLETE**: state finale success.
7. **FAILED**: state finale error con `failure_reason` populated.
8. **CANCELLED**: state finale user-initiated cancel.

### §4.3 Audit watch (live monitoring)

Durante execution, monitorare:

```sql
-- Stato corrente run
SELECT import_run_id, import_run_state, import_run_started_at,
       import_run_completed_at, import_run_failure_reason
  FROM brownfield.import_runs
 WHERE import_run_wave = 2
 ORDER BY import_run_started_at DESC LIMIT 5;

-- Eventi live
SELECT import_event_level, import_event_message, import_event_count,
       import_event_duration_ms, import_event_ts
  FROM audit.import_run_logs
 WHERE import_event_run_id = '<wave2_run_id>'
 ORDER BY import_event_ts DESC LIMIT 50;

-- Validation results
SELECT import_validation_result_status, COUNT(*) AS cnt
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<wave2_run_id>'
 GROUP BY 1;
```

### §4.4 Post-run validation

```sql
-- 1. Tutti Wave 2 mapping APPROVED hanno run COMPLETED
SELECT tm.table_mapping_target_table,
       MAX(ir.import_run_state) AS last_state,
       COUNT(*) AS attempts
  FROM brownfield.table_mappings tm
  LEFT JOIN brownfield.import_runs ir
    ON ir.import_run_wave = 2
   AND ir.import_run_source_table_id = tm.table_mapping_source_table_id
 WHERE tm.table_mapping_wave = 2
 GROUP BY tm.table_mapping_target_table
 ORDER BY 1;

-- 2. Lineage coverage Wave 2
SELECT lr.source_lineage_target_table_name,
       COUNT(*) AS lineage_rows
  FROM sys.sys_source_lineage_records lr
 WHERE lr.source_lineage_import_run_id IN (
   SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 2
 )
 GROUP BY 1
 ORDER BY 2 DESC;

-- 3. Tenant boundary violations (must be 0)
SELECT * FROM sys.v_tenant_boundary_violations;
```

---

## §5 Acceptance criteria

### §5.1 Quantitative (verifiable via SQL)

```sql
-- AC-W2-01: ≥ 85% Wave 2 target tables COMPLETE (target ~31 → ≥ 26)
SELECT COUNT(DISTINCT tm.table_mapping_target_table) AS completed_targets,
       COUNT(DISTINCT tm.table_mapping_target_table) FILTER (WHERE ir.import_run_state IS NOT NULL) * 1.0 /
       NULLIF(COUNT(DISTINCT tm.table_mapping_target_table), 0) AS completion_ratio
  FROM brownfield.table_mappings tm
  LEFT JOIN brownfield.import_runs ir
    ON ir.import_run_wave = 2
   AND ir.import_run_state = 'COMPLETE'
 WHERE tm.table_mapping_wave = 2
   AND tm.table_mapping_approval_status = 'APPROVED';
-- Expected: completion_ratio ≥ 0.85
```

```sql
-- AC-W2-02: lineage row per ogni canonical record Wave 2 upserted
SELECT (
  SELECT COUNT(*) FROM sys.sys_organization_units u
   WHERE u.organization_unit_id IN (
     SELECT source_lineage_target_record_id FROM sys.sys_source_lineage_records
      WHERE source_lineage_target_table_name = 'sys_organization_units'
        AND source_lineage_import_run_id IN (
          SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 2
        )
   )
) AS units_with_lineage,
(
  SELECT COUNT(*) FROM sys.sys_organization_units
   WHERE organization_unit_tenant_id = (
     SELECT canonical_tenant_id FROM brownfield.tenant_id_mappings
      WHERE legacy_id = 'RTL_BANK_REFERENCE'
   )
) AS rtl_units_total;
-- Expected: units_with_lineage = rtl_units_total (full coverage)
```

```sql
-- AC-W2-03: zero tenant boundary violation
SELECT COUNT(*) FROM sys.v_tenant_boundary_violations;
-- Expected: 0
```

```sql
-- AC-W2-04: zero silent-skip (post CW-B60-A fix)
SELECT COUNT(*) FROM audit.import_validation_results
 WHERE import_validation_result_run_id IN (
   SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 2
 )
 AND import_validation_result_status NOT IN ('PASSED', 'SKIPPED');
-- Expected: 0 (zero FAIL not addressed)
-- Plus: SKIPPED rows have non-NULL exclusion_reason (CW-B17 patch)
```

### §5.2 Qualitative (verifiable via inspection)

- **AC-W2-05**: Twice-run idempotency: re-eseguire Wave 2 immediatamente dopo COMPLETE → 0 nuove canonical rows, 0 nuove lineage rows (eccetto evolving columns updated), 0 errori, 0 audit delta significativo.
- **AC-W2-06**: Test suite globale `pnpm test` ≥ baseline (no regression introdotta da Wave 2 execution).
- **AC-W2-07**: `pnpm db:validate` twice-run schema-only diff = ∅.
- **AC-W2-08**: Acceptance log linked in runner doc (this file) con `executed-at: <timestamp>` + `run_id: <uuid>` + `final_state: COMPLETE` + acceptance SQL outputs.

---

## §6 Rollback procedure

### §6.1 Light rollback (preferred — wave-scoped corrective)

Procedura: corrective wave run (mode `CORRECTIVE_DELETE`):

```sql
-- 1. Mark current Wave 2 run as FAILED with reason
UPDATE brownfield.import_runs
   SET import_run_state = 'FAILED',
       import_run_failure_reason = 'Manual rollback by Enzo: <reason>',
       import_run_completed_at = now()
 WHERE import_run_id = '<wave2_run_id>';

-- 2. Identify canonical rows from this run
-- 3. Per ogni target table Wave 2, delete only rows referenced by lineage AND not referenced by other canonical:
--    pattern per sys.sys_organization_units esemplificativo:
DELETE FROM sys.sys_organization_units u
USING sys.sys_source_lineage_records lr
WHERE lr.source_lineage_target_table_name = 'sys_organization_units'
  AND lr.source_lineage_target_record_id = u.organization_unit_id
  AND lr.source_lineage_import_run_id = '<wave2_run_id>'
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_positions p
     WHERE p.position_organization_unit_id = u.organization_unit_id
  );
-- Replicare per ogni target Wave 2 con NOT EXISTS check su dipendenze FK

-- 4. Truncate staging Wave 2
TRUNCATE TABLE staging.wave2_org_units, staging.wave2_branches, ...
  RESTART IDENTITY CASCADE;
```

### §6.2 Heavy rollback (restore from pre-Wave-2 snapshot)

Se la light rollback non basta (es. cascade impacted Wave 1 baseline o sys.* table corrotta):

```bash
# Restore solo sys.* data (preserva schema migrations + Wave 1 baseline)
ssh oracle-vm-default
# Step 1: backup current state
pg_dump -U heuresys -d heuresys_advanced --data-only --schema=sys > /tmp/heuresys_pre_rollback_$(date +%Y%m%d_%H%M%S).sql

# Step 2: drop affected tables + restore from pre-Wave-2 snapshot
gunzip -c /tmp/heuresys_pre_wave2_<timestamp>.sys_data.sql.gz | psql -U heuresys -d heuresys_advanced

# Step 3: validate Wave 1 baseline preserved
psql -U heuresys -d heuresys_advanced -c "SELECT COUNT(*) FROM sys.sys_skills;"
# Expected: == Wave 1 baseline count
```

Heavy rollback è **destructive** — richiede backup-pre-rollback step (step 1 sopra) per recovery in caso di errore della rollback stessa. Approval esplicita Enzo prima di eseguire.

### §6.3 Investigation post-rollback

Prima di re-trigger Wave 2:
1. Identificare root cause failure (audit log, validation result, error message).
2. Fix mapping definition (column_mapping update, transform code change, target schema fix).
3. Update `cowork_reserved/bias_registry.md` con nuovo bias CW-B* se pattern.
4. Update unit test coverage in `apps/api/test/brownfield-wave-executor-*.test.ts` per evitare regression.
5. Re-trigger via §4.1 procedure.

---

## §7 Known risks

### §7.1 Cascade chain from Wave 1

Wave 2 target tables hanno FK verso Wave 1 catalog tables:
- `sys.sys_position_skill_requirements.skill_id → sys.sys_skills.skill_id` (Wave 1 catalog).
- `sys.sys_position_kpi_requirements.kpi_definition_id → sys.sys_kpi_definitions.kpi_definition_id` (parzialmente Wave 1 process_kpi_templates).
- `sys.sys_position_learning_requirements.learning_module_id → sys.sys_learning_modules.learning_module_id` (Wave 1 catalog).

Se Wave 1 ha gap (es. CW-B60 residuals 6/19), Wave 2 può fallire su FK resolution → propagate cascade. Mitigation:
- Pre-flight check #7 (§1.3) verifica Wave 1 baseline preservata.
- P0-2/P0-3 closure deve includere fix dei 6 residuals critici per Wave 2 dependency chain.

### §7.2 Cross-table refs intra-Wave-2

Wave 2 ha FK chains interni (es. `sys_positions.position_organization_unit_id → sys_organization_units.organization_unit_id`). Order di execution importa.

Mitigation: state machine + dependency order specificato in `brownfield.table_mappings.table_mapping_execution_order` (eventualmente nuovo campo da aggiungere, deliverable minore). Alternative: ordering hardcoded in executor module by target table dependency analysis.

### §7.3 Tenant boundary leak

Operating model RTL_BANK_REFERENCE potrebbe accidentalmente importare FK cross-tenant se source data ha `tenant_id` ambiguo. Mitigation:
- Validation rule §3 (BROWNFIELD_IMPORT_PLAN §4.3 #3): "No cross-tenant FK".
- Post-run check AC-W2-03: `sys.v_tenant_boundary_violations = 0`.
- Tenant ID resolution via `brownfield.tenant_id_mappings` (single source of truth).

### §7.4 COALESCE-UQ class-of-bug (ADR-0018)

10 sys.* tables hanno UQ constraint con COALESCE pattern (vedi `helper replaceTargetColsInConflictInference`). Verificare che Wave 2 target tables affette siano upsertate con conflict inference pattern corretto (no silent skip).

### §7.5 LOOKUP_FK_2HOP transform (ADR-0017)

Alcuni source FK richiedono 2-hop resolution (source.id → legacy_mirror.X.id → sys.Y.id). Verificare che column_mappings Wave 2 dichiarino transform_code = 'LOOKUP_FK_2HOP' dove necessario. Mancato dichiare → NULL upsert → silent skip.

### §7.6 Pragmatic vs full completion

Wave 1 ha shipped 13/19 IMPORT targets pragmatically (RD-33 default 85% threshold). Wave 2 può seguire stesso pattern: target 85% completion, defer residual a Wave 2.1 corrective o Wave 3 dependency.

---

## §8 Authorship + sign-off

**Authored by**: Cowork Claude (supervisor) on direttiva Enzo Spenuso, 2026-05-26.
**Reviewed by**: (pending Enzo sign-off).
**Executed by**: (TBD — assigned at execution session opening).
**Execution log link**: (populated post-execution under `qa_artifacts/wave2_runs/<timestamp>/`).

### §8.1 Pre-execution checklist (sign-off gate)

- [ ] Runner doc reviewed da Enzo + sign-off acquisito.
- [ ] P0-2 (CW-B60-A) e P0-3 (CW-B60-B) closed in `bias_registry.md`.
- [ ] Pre-flight script `brownfield-wave-2-preflight.{ps1,sh}` deliverato + tested.
- [ ] Wave 2 staging migrations (000044+) deliverate + applied idempotently.
- [ ] `brownfield.table_mappings` Wave 2 populated + column_mappings curated.
- [ ] `brownfield.tenant_id_mappings` ha row RTL_BANK_REFERENCE.
- [ ] Backup pre-Wave-2 effettuato + verified.
- [ ] Baseline test suite green (no regression baseline).
- [ ] Twice-run idempotency proof baseline green.

### §8.2 Execution session opening prompt template

Quando si apre la sessione di execution Wave 2, il prompt template è:

```
SESSIONE WAVE 2 EXECUTION — BROWNFIELD OPERATING MODEL

Pre-flight required:
1. Tunnel SSH 5433 UP
2. Baseline test green (341 PASS / 1 fail pre-esistente)
3. Backup pre-Wave-2 effettuato

Goal: eseguire Wave 2 per RTL_BANK_REFERENCE operating model.

Read first:
- D:/heuresys-advanced/docs/brownfield/wave_runners/wave_2_runner.md (this doc)
- D:/heuresys-advanced/docs/brownfield/BROWNFIELD_IMPORT_PLAN.md §4
- D:/heuresys-advanced/cowork_reserved/bias_registry.md (verify CW-B60 MITIGATED)

Execute §4 procedure + monitor §4.3 audit watch + validate §5 acceptance criteria.

If any AC fails: §6 rollback procedure. Do NOT push uncommitted destructive changes.
```

---

## §9 References

| Path | Use |
|---|---|
| `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` §4 | Wave 2 specification source |
| `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md` | template runner reference |
| `docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md` | mapping spec per source table |
| `docs/architecture/adr/0012_brownfield_table_mapping_wave_column.md` | wave column schema |
| `docs/architecture/adr/0017_lookup_fk_2hop_transform.md` | 2-hop FK resolution pattern |
| `docs/architecture/adr/0018_coalesce_uq_class_of_bug.md` | COALESCE-UQ helper |
| `docs/MVP_4_ROADMAP.md` §2.1 | stream context |
| `apps/api/src/modules/brownfield-wave-executor/` | engine implementation |
| `db/scripts/brownfield-wave-1-preflight.{sh,ps1}` | template per wave-2 preflight |
| `cowork_reserved/bias_registry.md` | CW-B60 status |

---

**Fine wave_2_runner.md** — operational runbook, awaiting P0 closure + sign-off before execution.
