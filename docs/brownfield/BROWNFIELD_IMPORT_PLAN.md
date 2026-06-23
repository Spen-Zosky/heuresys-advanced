# Brownfield Import Plan
## End‑to‑End Pipeline + 4 Sequential Import Waves

> **Status:** Planning deliverable #6 of 10.
> **Inputs:** `BROWNFIELD_ADAPTATION_MAP.md` (#4), `BROWNFIELD_TABLE_CLASSIFICATION_REPORT.md` (#5), `BROWNFIELD_EXCLUSION_REPORT.md` (#7).
> **Target runtime:** native PostgreSQL (ADR‑0004); location deferred (ADR‑0010).
> **Schema policy:** canonical `sys`; auxiliary `brownfield`/`staging`/`audit`; never RLS (I5).

---

## 1. Pipeline DAG

```text
                ┌───────────────────────────────────────────────┐
                │  docs/source_bundle/brownfield/db-export.zip  │
                │  (versioned source material)                  │
                └────────────────────┬──────────────────────────┘
                                     │ Task 3 — unzip
                                     ▼
        docs/source_bundle/brownfield/extracted/  (gitignored working copy)
                                     │ Task 4 — inspect_db_export.py
                                     ▼
        docs/brownfield/_inspection_artifacts/brownfield_export_inventory.json
                                     │ Tasks 5-6 — classify + adaptation map
                                     ▼
        docs/brownfield/_inspection_artifacts/tables_with_domains.csv   (576 rows)
                                     │ Human curation
                                     ▼
        BROWNFIELD_ADAPTATION_MAP.md  +  BROWNFIELD_TABLE_CLASSIFICATION_REPORT.md
                                     │ This document drives WAVES 1..4
                                     ▼
   ┌─── WAVE 1 (catalogs) ─── WAVE 2 (operating model) ─── WAVE 3 (synthetic) ─── WAVE 4 (advanced) ───┐
   │                                                                                                  │
   │  Per wave:                                                                                       │
   │    1. brownfield.source_exports          (record this run)                                       │
   │    2. brownfield.source_tables/columns   (metadata)                                              │
   │    3. staging.<tableset>                 (per-wave temporary candidate rows)                     │
   │    4. validation rules                   (run audit.import_validation_results)                   │
   │    5. human approval gate                (audit.import_approval_decisions)                       │
   │    6. idempotent upsert into sys.sys_*                                                            │
   │    7. lineage record                     (sys.sys_source_lineage_records)                       │
   │    8. audit log                          (audit.import_run_logs)                                 │
   │                                                                                                  │
   └──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                          sys.sys_*  (canonical state)
```

Each wave is **gated**: a wave does not start until the prior wave's acceptance criteria are met and the user explicitly approves the next.

---

## 2. Common Pipeline Steps

### 2.1 Source registration

Every import run inserts one row into `brownfield.source_exports`:

```sql
INSERT INTO brownfield.source_exports (
  source_export_id, zip_sha256, retrieved_at, file_count, schemas_in_zip, ingested_by, status
) VALUES (gen_random_uuid(), :sha, :ts, :nfiles, :schemas, current_user, 'INGESTED')
ON CONFLICT (zip_sha256) DO UPDATE SET retrieved_at = EXCLUDED.retrieved_at;
```

Subsequent metadata (per‑table, per‑column) inserts into `brownfield.source_tables` and `brownfield.source_columns`, all FK‑linked to the source export row.

### 2.2 Adaptation map check

Before staging, the pipeline verifies that every source table the wave touches is present in `brownfield.table_mappings` with `status = APPROVED`. Tables marked `EXCLUDE` or `REFERENCE_ONLY` are skipped; tables without a mapping abort the wave with `MISSING_MAPPING_<table>`.

### 2.3 Staging

Per wave, the pipeline loads the relevant CSV/SQL rows from the extracted zip into `staging.<wave>_<tableset>` (e.g. `staging.wave1_skills`, `staging.wave2_org_units`). Staging schemas can be `TRUNCATE`d between runs. Loading uses `COPY ... FROM STDIN` for speed; integrity constraints in staging are minimal (only PK).

### 2.4 Validation

For every staging row, run the validation rules from `BROWNFIELD_VALIDATION_CHECKLIST.md`:

- Natural key present and deterministic.
- Content hash present.
- Mapping confidence ≥ minimum for the wave (Wave 1 ≥ 0.9, Wave 2 ≥ 0.85, Wave 3 ≥ 0.80, Wave 4 ≥ 0.75).
- Target table exists in `sys`.
- Tenant boundary respected (no cross‑tenant FK).
- No FK constraint violations.
- No PII columns leaked (cross‑check against `EXCLUDE` keyword list).
- Lineage row prepared.

Results land in `audit.import_validation_results`. A wave proceeds to upsert **only** if every row in scope has `validation_status = PASSED` or has been explicitly approved with an override comment.

### 2.5 Approval gate (human)

For Waves 1–2, automated PASS may auto‑approve (still recorded in `audit.import_approval_decisions` with `approver = 'AUTO'` and `auto_approval_rule_id`). For Waves 3–4, a human approver must sign off (PR + comment).

### 2.6 Idempotent upsert into canonical

```sql
-- Pseudo-template per record
INSERT INTO sys.<target_table> (... columns ...)
VALUES (... transformed values ...)
ON CONFLICT (<natural_key_columns>) DO UPDATE
   SET <evolving_columns> = EXCLUDED.<evolving_columns>,
       updated_at = now(),
       updated_by = NULL  -- import is non-user actor
;
```

Re‑running a wave is **safe**: rows already present are updated only on evolving columns (typically not the natural key or the primary FK).

### 2.7 Lineage

After every upsert, write to `sys.sys_source_lineage_records`:

```sql
INSERT INTO sys.sys_source_lineage_records (
  lineage_id, tenant_id, target_table_name, target_record_id,
  source_system, source_table_name, source_record_id, source_natural_key,
  source_content_hash, import_run_id, mapping_confidence, validation_status, created_at
) VALUES (
  gen_random_uuid(), :tenant_id, 'sys.<target_table>', :target_id,
  'heuresys_platform', :source_table, :source_id, :natural_key,
  :sha, :run_id, :conf, 'PASSED', now()
)
ON CONFLICT (target_table_name, target_record_id) DO UPDATE
   SET source_content_hash = EXCLUDED.source_content_hash,
       mapping_confidence = EXCLUDED.mapping_confidence;
```

The natural key pattern is `OLDDB::<source_table>::<source_id>` or the domain‑specific business key from `IDEMPOTENT_SEEDING_RULES.md` (`ESCO_SKILL::<uri>`, `ATECO_2025::<code>`, …).

### 2.8 Audit logging

Every step appends to `audit.import_run_logs` (level, message, count, duration_ms). The full run is queryable for forensics.

### 2.9 Rollback

`sys.sys_*` is **never truncated** to roll back. Instead:

- Staging schemas (`staging.*`) — `TRUNCATE` freely; they hold transient data.
- `brownfield.*` — `TRUNCATE` only the per‑run rows; keep `source_exports` history.
- `audit.*` — never delete; mark `import_runs.status = ROLLED_BACK` with a note.
- `sys.sys_*` — to "undo" a wave, run a corrective wave that deletes only rows whose `sys.sys_source_lineage_records.import_run_id = :bad_run` AND whose canonical id is not referenced by other canonical rows. This must be explicitly authorized (high‑privilege procedure).

---

## 3. Wave 1 — Low‑Risk Catalogs

**Goal:** populate the canonical taxonomies and process registries with clean, low‑risk catalog data.
**Approval:** auto‑approval allowed if validation PASSED and confidence ≥ 0.9.

### 3.1 Source tables

| Source domain | Source tables | Target canonical |
|---------------|---------------|------------------|
| ESKAP | `esco_occupations`, `esco_skills`, `esco_qualifications`, `esco_skill_*`, `esco_isco_groups`, `esco_occupation_skills`, `cross_entity_relations`, … (29 tables) | `sys.sys_esco_occupation_mappings`, `sys.sys_skills`, `sys.sys_skill_taxonomy_edges`, `sys.sys_skill_aliases`, `sys.sys_user_education_records` (catalog only) |
| SKILGRO | `competency_frameworks`, `competencies`, `skill_*`, `courses`, `course_modules`, `learning_paths`, `learning_path_steps`, `certifications`, `certification_esco_skills`, … (39 tables) | `sys.sys_skill_families`, `sys.sys_skill_categories`, `sys.sys_skills`, `sys.sys_learning_modules`, `sys.sys_learning_paths`, `sys.sys_learning_path_steps`, `sys.sys_skill_learning_mappings`, `sys.sys_user_certifications` (catalog rows only) |
| INDOOR | `industry_classifications`, `industry_ccnl_mapping`, `industry_occupation_mapping`, `benchmark_configs`, `benchmark_reports` (10 tables) | `sys.sys_activity_classifications`, `sys.sys_activity_classification_mappings`, `sys.sys_esco_occupation_mappings`, `sys.sys_blueprint_overrides` |
| ITLAB | `ccnl_contracts`, `ccnl_levels`, `ccnl_seniority_rules`, `ccnl_executive_bands`, `ccnl_job_title_mapping`, `italian_holidays` (catalog only), `sindacati` (catalog only) (7 tables) | `sys.sys_compensation_bands` |
| PROGOV | `process_kpis`, `process_phases` (2 tables) | `sys.sys_process_kpi_templates` |
| OPOURSKA | `business_processes`, `job_templates`, `job_template_skills`, `esco_skills` (4 tables) | `sys.sys_blueprint_process_registry`, `sys.sys_job_roles`, `sys.sys_skills` |
| H2R | `job_title_courses`, `job_title_learning_paths` (2 catalog tables) | `sys.sys_skill_learning_mappings`, `sys.sys_position_learning_requirements` (when template instantiated) |

**Total Wave 1 source tables:** ≈ 93 (all IMPORT class).

### 3.2 Prerequisites

- MVP‑0 completed (`sys.sys_*` foundation + position + skill + KPI + learning tables exist).
- Seed acquisition source registry loaded (so ESCO/NACE/CCNL natural keys resolve to canonical source codes).
- `brownfield.*` schema populated by Tasks 3‑6 (inspection done).

### 3.3 Validation rules (Wave 1)

1. Natural key matches one of `ESCO_SKILL::<uri>`, `ESCO_OCCUPATION::<uri>`, `ATECO_2025::<code>`, `NACE_REV_2_1::<code>`, `CCNL::<contract>::<version>`, `LEARNING_MODULE::<scope>::<title_hash>`, `FIN_BANKING_KPI::<process>::<kpi>`, `JOB_ROLE::<family>::<code>`.
2. For ESCO rows: `esco_uri` must start with `http://data.europa.eu/esco/`.
3. For NACE/ATECO: `code` must match the regex defined in the source registry (4‑5 digits with `.` separator).
4. For CCNL: `contract_code` must exist in CNEL CCNL Archive source registry entry.
5. Confidence ≥ 0.9.

### 3.4 Acceptance criteria (Wave 1)

```sql
-- All wave 1 source tables present in brownfield.table_mappings with status=APPROVED
SELECT count(*) FROM brownfield.table_mappings
WHERE wave = 1 AND status = 'APPROVED';
-- Expected: ≈ 93

-- All validation results PASSED for wave 1
SELECT count(*) FROM audit.import_validation_results
WHERE import_run_id IN (SELECT id FROM brownfield.import_runs WHERE wave = 1)
  AND validation_status = 'PASSED';
-- Expected: equals total candidate count

-- Lineage rows for every imported canonical record
SELECT count(*) FROM sys.sys_source_lineage_records
WHERE import_run_id IN (SELECT id FROM brownfield.import_runs WHERE wave = 1);
-- Expected: equals total imported records
```

### 3.5 Rollback (Wave 1)

Low‑risk: deletion of orphaned catalog rows is safe. Procedure:

```sql
DELETE FROM sys.sys_skills s
USING sys.sys_source_lineage_records l
WHERE l.target_table_name = 'sys.sys_skills'
  AND l.target_record_id = s.skill_id
  AND l.import_run_id = :wave1_run_id
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_position_skill_requirements WHERE skill_id = s.skill_id
    UNION
    SELECT 1 FROM sys.sys_user_skill_evidence WHERE skill_id = s.skill_id
  );
```

Skill rows referenced by position requirements or evidence are **not** deleted — manual reconciliation required.

---

## 4. Wave 2 — Tenant Operating Model

**Goal:** populate tenant‑specific operating model (organization, blueprints, positions structure, KPI templates).
**Approval:** auto‑approval if confidence ≥ 0.85 and no cross‑tenant FK.

### 4.1 Source tables

| Source domain | Source tables (TRANSFORM) | Target canonical |
|---------------|---------------------------|------------------|
| DGOV (root) | `tenants` | `sys.sys_tenancies` |
| OPOURSKA | `company_profiles`, `company_sizes`, `cost_centers`, `locations`, `org_areas`, `org_charts`, `org_chart_*`, `org_units`, … (36 tables) | `sys.sys_organization_units`, `sys.sys_branches`, `sys.sys_enterprise_typing_profiles`, `sys.sys_job_families`, `sys.sys_blueprint_activations` |
| INDOOR | `blueprint_results`, `blueprint_runs`, `blueprint_templates` (3 tables) | `sys.sys_blueprint_variants`, `sys.sys_blueprint_activations` |
| GOKMER | `kpi_*`, `goal_*`, `objective_*`, `check_ins`, `performance_*`, `calibration_*` (37 tables) | `sys.sys_kpi_definitions`, `sys.sys_kpi_metric_definitions`, `sys.sys_process_kpi_templates`, `sys.sys_organization_unit_kpi_templates`, `sys.sys_kpi_targets`, `sys.sys_assessment_results` |
| PROGOV | `compliance_training_requirements`, `process_cost_centers`, `process_roles`, `process_skill_requirements`, `signature_recipients`, … (11 tables) | `sys.sys_position_learning_requirements`, `sys.sys_position_skill_requirements`, `sys.sys_position_kpi_requirements` |
| RBP | `canonical_demo_users`, `rbp_role_dashboards`, `rbp_role_permissions`, `user_pernr_mapping`, `user_workspaces` (6 tables) | `sys.sys_users` (synthetic), `sys.sys_auth_role_permissions` (for the 8 canonical roles only) |
| ITLAB | `sindacato_tenant_links`, `tenant_ccnl_links` (2 tables) | `sys.sys_enterprise_typing_profiles.tenant_metadata` JSONB |
| PET | `rbp_functional_areas`, `rbp_perspectives` (2 tables) | `sys.sys_auth_permissions` (resource scope) |

**Total Wave 2 source tables:** ≈ 80 (TRANSFORM class).

### 4.2 Prerequisites

- Wave 1 completed (catalogs in place; skill/KPI/learning FKs resolve).
- Tenant `RTL_BANK_REFERENCE` already seeded by 000021 (or skipped if importing legacy tenants).

### 4.3 Validation rules (Wave 2)

1. `tenant_id` in every transformed row matches the legacy `tenant_id` → resolved via `brownfield.tenant_id_mappings(legacy_id, canonical_tenant_id)`.
2. FK targets exist in `sys.sys_*` (skill_id, job_role_id, organization_unit_id).
3. No cross‑tenant FK (a position's org_unit must belong to the same tenant).
4. Org‑unit hierarchies form a DAG (no cycles).
5. KPI definitions reference a known metric and method.
6. Mapping confidence ≥ 0.85.

### 4.4 Acceptance criteria (Wave 2)

```sql
-- Every imported tenant has at least one organization unit
SELECT t.tenant_code
FROM sys.sys_tenancies t
LEFT JOIN sys.sys_organization_units u ON u.organization_unit_tenant_id = t.tenant_id
WHERE u.organization_unit_id IS NULL
  AND t.tenant_id IN (SELECT canonical_tenant_id FROM brownfield.tenant_id_mappings);
-- Expected: empty (every imported tenant has org structure)

-- No tenant boundary violations
SELECT count(*) FROM sys.v_tenant_boundary_violations;
-- Expected: 0

-- All TRANSFORM source tables for Wave 2 have lineage
SELECT count(DISTINCT source_table_name) FROM sys.sys_source_lineage_records
WHERE import_run_id IN (SELECT id FROM brownfield.import_runs WHERE wave = 2);
-- Expected: ≈ 80
```

### 4.5 Rollback (Wave 2)

Medium‑risk. Deletion of an org unit cascades to positions; rollback must check no canonical position created post‑import depends on it.

```sql
-- Mark tentative deletion candidates
SELECT u.organization_unit_id, u.organization_unit_code
FROM sys.sys_organization_units u
JOIN sys.sys_source_lineage_records l ON l.target_record_id = u.organization_unit_id
WHERE l.import_run_id = :wave2_run_id
  AND NOT EXISTS (SELECT 1 FROM sys.sys_positions WHERE position_organization_unit_id = u.organization_unit_id);
-- Review then delete only candidates with zero dependencies
```

Manual approval required.

---

## 5. Wave 3 — Demo Person Data Import

> ⚠️ **CORRECTED 2026-06-01 (ADR-0024 — employee-centric ingestion).** The previous version of this section imported legacy **`users`** as the person (`users → sys.sys_users`) and demoted `employees` to a `tenant_id` lookup. **That was backwards.** In the legacy DB the person is **`employees`** (207 FK hang off it vs 45 off `users`; `users` is a subordinate auth shell with `users.employee_id → employees.id`). The corrected routing: **`employees → sys.sys_users` + `sys.sys_user_*`**; **`users → sys.sys_auth_*` (credentials only)**. Full mapping: `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md`.

**Goal:** import demo **person** data — keyed on **`employees`** (the business entity) — assignments, skill evidence, learning evidence, KPI evidence, from the 4 legacy tenants (RTL Bank 158, SmartFood 82, EcoNova 26, Heuresys System 4 = **270 employees / 274 users total**). Coverage is driven by the **employee** count, not the user count (an employee without a `users` row is still imported as a person, with no credential).
**Nature of data:** the legacy `heuresys_platform` contains **demo data generated by the platform owner** for development. **No real PII**. Anonymization is therefore **not required**; rows are imported as‑is and **treated as real production data** (ADR-0026 — no synthetic-vs-real dichotomy; the `user_is_synthetic` flag was retired by 000154).
**Approval:** auto‑approval if validation PASSED and confidence ≥ 0.80 (no human gate required since no PII risk).

### 5.1 Source tables

| Source domain | Source tables (TRANSFORM) | Target canonical |
|---------------|---------------------------|------------------|
| **RBP·DGOV (person)** | **`employees`** (the business entity — keyed on `employees.id` / email; `user_type = STANDARD`) | **`sys.sys_users`** (identity) + `sys.sys_user_*` satellites |
| RBP·DGOV (auth shell) | `users` (credentials only — `username`/`role`/`totp`; `users.employee_id` = bridge to the employee) | `sys.sys_auth_*` (legacy hashes NOT imported — force reset) |
| H2R | `employee_job_assignments`, `employee_career_paths`, `employee_certifications`, `employee_skill_*`, `employee_kpi_targets`, `employee_documents` (metadata only), `employee_contracts` (boolean evidence), … (18 tables) | `sys.sys_user_position_assignments`, `sys.sys_user_certifications`, `sys.sys_user_skill_evidence`, `sys.sys_kpi_targets`, `sys.sys_user_documents`, `sys.sys_user_position_assignments.has_active_contract` |
| SKILGRO | `employee_certifications`, `employee_skill_assessments`, `employee_skill_history`, `employee_skill_mappings`, `employee_skill_profiles` (6 tables) | `sys.sys_user_certifications`, `sys.sys_user_skill_evidence` |
| GOKMER | `performance_reviews`, `check_ins` (evidence rows) | `sys.sys_assessment_results`, `sys.sys_user_kpi_evidence` |

**Total Wave 3 source tables:** ≈ 50 (TRANSFORM — no anonymization; legacy data is synthetic-by-provenance/ADR-0023 but treated as real, no synthetic flag — retired by 000154).

### 5.2 Demo Data Import Protocol (no anonymization)

Since the legacy data is demo (generated by the platform owner, no real PII), import is straightforward. **The driving table is `employees`** (ADR-0024); `users` is read only to attach credentials:

1. **Iterate over `employees`** (not `users`): every imported person row (one per `employees` row) receives `user_external_code = 'LEGACY_EMP::' || employees.id` and `user_type = 'STANDARD'` (imported employees are real tenant members — ADR-0024/0026 — not generated placeholders; the synthetic flag was retired by 000154).
2. **Email domains**: legacy domains (`rtl-bank.org`, `smartfood.org`, `econova.org`, `heuresys.com`) are kept as‑is — they are demo addresses, not real corporate domains. If duplicate emails arise across tenants, append a tenant suffix (`user@rtl-bank.org#RTL_BANK`) only when needed to satisfy the `(tenant, lower(email))` uniqueness constraint. Email is also the independent cross-check key (`employees.email = sys_users.user_email`).
3. **Tenant resolution**: read directly from `employees.tenant_id` (the employee *is* the tenant-scoped entity). No `users → tenant_id` indirection. Employees with no `users` row import as credential-less persons; the 2 platform users with `employee_id IS NULL` (auth-only accounts) are attached to the `Heuresys System` tenant (or downgraded to PLATFORM_ADMIN scope, see §7.5).
4. **Auth shell** (`users` → `sys.sys_auth_*`): for each `employees` row that *has* a `users` account (`users.employee_id = employees.id`), create the auth identity from `users.username`/`role`/`totp`. Legacy password hashes are **not imported** (different algorithm, possibly weak). New `sys.sys_auth_credentials` rows are generated with a placeholder hash flagged `must_rotate = true`; every user is forced to reset on first login. Employees without a `users` row get **no** credential (cannot log in until provisioned).
5. **Photos / document binaries**: not imported (out of MVP scope; only metadata in `sys.sys_user_documents`).
6. **Out‑of‑scope columns** (per I8): payroll fields, medical fields, attendance, benefits, bank details — **not migrated**, even if the values are demo (column‑level filter still applies for functional scope reasons).

**Defensive note**: a column‑level filter for PII patterns (fiscal_code, IBAN, passport, etc.) remains documented in `BROWNFIELD_TABLE_CLASSIFICATION_REPORT.md` §4.2 as a **safety net** in case future imports contain real data. It is **not enforced** on the current `heuresys_platform` legacy import since the data is known to be demo.

### 5.3 Validation rules (Wave 3)

In addition to common rules:

1. `user_type = 'STANDARD'` on every imported person row (imported employees are real tenant members; ADR-0026/000154 retired the synthetic flag + the SYNTHETIC_REFERENCE type).
2. Employee-centric crosswalk key `user_external_code = 'LEGACY_EMP::' || employees.id` present on every imported person row (ADR-0024).
3. Tenant resolution successful for every user (no `user_tenant_id IS NULL` except for PLATFORM_ADMIN platform users).
4. Out‑of‑scope columns (per I8) not present in target rows.
5. Assignment integrity: every assignment references a user and a position that exist in `sys`.
6. At most one ACTIVE PRIMARY assignment per user (enforced by partial unique index + checked in validation).
7. Mapping confidence ≥ 0.80.

### 5.4 Approval (Wave 3)

**Auto‑approval** if all validation rules in §5.3 return PASSED and confidence ≥ 0.80. The approval is still recorded in `audit.import_approval_decisions` with `approver = 'AUTO'` and the `auto_approval_rule_id` for traceability.

Human approval remains **mandatory** only if:

- A future brownfield import contains data flagged as real (sensitive‑review list in `BROWNFIELD_EXCLUSION_REPORT.md` §3 is triggered).
- Validation confidence is between 0.50 and 0.80 (uncertain mapping).
- Tenant resolution fails for > 1% of rows (suggests data drift).

### 5.5 Acceptance criteria (Wave 3)

```sql
-- Every Wave 3 person carries the employee-centric crosswalk key (ADR-0024)
SELECT count(*) FROM sys.sys_users
WHERE user_id IN (SELECT target_record_id FROM sys.sys_source_lineage_records
                  WHERE target_table_name = 'sys.sys_users' AND import_run_id IN
                  (SELECT id FROM brownfield.import_runs WHERE wave = 3))
  AND user_external_code NOT LIKE 'LEGACY_EMP::%';
-- Expected: 0

-- PII columns are NULL or absent
SELECT count(*) FROM sys.sys_users
WHERE user_id IN (...wave 3 imported...)
  AND (user_email NOT LIKE '%@reference.heuresys.local'
       OR user_metadata ? 'fiscal_code'
       OR user_metadata ? 'iban');
-- Expected: 0

-- Assignment cardinality
SELECT count(*) FROM sys.v_active_primary_assignment_per_user;
-- Expected: 0  (every user has ≤ 1 ACTIVE PRIMARY)
```

### 5.6 Rollback (Wave 3)

High‑risk. Procedure:

1. Delete `sys.sys_user_position_assignments` rows linked to Wave 3 lineage.
2. Delete `sys.sys_user_*_evidence` rows linked to Wave 3 lineage.
3. Delete `sys.sys_users` rows linked to Wave 3 lineage (via `sys.sys_source_lineage_records`) AND with no remaining FK references.
4. Mark `import_runs.status = 'ROLLED_BACK'`.

Manual privileged operation. Requires PI approval.

---

## 6. Wave 4 — Advanced Intelligence

**Goal:** import career, succession, talent score, salary band assignment, engagement evidence.
**Approval:** human gate required (sensitivity, policy).

### 6.1 Source tables

| Source domain | Source tables (TRANSFORM) | Target canonical |
|---------------|---------------------------|------------------|
| TALPIPE | `career_paths`, `career_path_levels`, `career_goals`, `ninebox_*`, `succession_pools`, `successor_*`, `promotion_*`, `mobility_*` (27 tables) | `sys.sys_career_paths`, `sys.sys_career_path_steps`, `sys.sys_user_career_plans`, `sys.sys_talent_scores`, `sys.sys_succession_pools`, `sys.sys_successor_candidates`, `sys.sys_successor_readiness` |
| PULSAR | `pulse_*`, `engagement_*`, `burnout_assessments`, `club_*`, `retention_*` (29 tables) | `sys.sys_user_assessment_evidence`, `sys.sys_gap_closure_plans`, `sys.sys_talent_scores` |
| SMERTO | `salary_band_assignments` (1 table) | `sys.sys_position_compensation_profiles` |
| EPRA | `ai_tenant_config` (subset only) | `sys.sys_tenancies.tenant_metadata.ai_config` JSONB |

**Total Wave 4 source tables:** ≈ 58 (TRANSFORM).

### 6.2 Validation rules (Wave 4)

1. Career path steps form a valid sequence (no orphan steps).
2. Succession pool references a critical position (`sys.sys_position_succession_relevance.is_critical = true`).
3. Talent scores in [0..1] normalized range.
4. Compensation profile **never stores amounts** — only band assignment.
5. Mapping confidence ≥ 0.75.

### 6.3 Approval (Wave 4)

Human approval mandatory (PI sign‑off). Engagement and succession data carries policy implications.

### 6.4 Acceptance criteria (Wave 4)

```sql
-- Career paths reachable
SELECT count(*) FROM sys.sys_career_paths cp
WHERE cp.career_path_id IN (SELECT target_record_id FROM sys.sys_source_lineage_records
                            WHERE target_table_name = 'sys.sys_career_paths'
                              AND import_run_id IN (SELECT id FROM brownfield.import_runs WHERE wave = 4))
  AND NOT EXISTS (SELECT 1 FROM sys.sys_career_path_steps WHERE career_path_id = cp.career_path_id);
-- Expected: 0  (every imported career path has steps)

-- No salary amounts leaked into compensation profile
SELECT count(*) FROM sys.sys_position_compensation_profiles
WHERE compensation_amount_min IS NOT NULL OR compensation_amount_max IS NOT NULL;
-- Expected: 0  (we only store band assignment; amounts come from CCNL catalog via band lookup)
```

### 6.5 Rollback (Wave 4)

Medium‑high risk. Similar procedure to Wave 3, restricted to Wave 4 lineage. Manual privileged operation.

---

## 7. Cross‑Wave Operational Notes

### 7.1 Order of execution

```text
Wave 1 (catalogs)              ── PASS gate ──┐
Wave 2 (operating model)       ── PASS gate ──┤
Wave 3 (synthetic person)      ── PASS gate ──┤── all green = brownfield import complete
Wave 4 (advanced intelligence) ── PASS gate ──┘
```

Each gate requires:

- All validation results PASSED for the wave.
- Approval recorded (auto for 1‑2 if confidence high, human for 3‑4).
- No `sys.v_tenant_boundary_violations` row introduced.
- Lineage coverage 100%.

### 7.2 Re‑run safety

The pipeline is **idempotent end‑to‑end**. Running Wave 1 a second time:

- Re‑reads `db-export.zip` (or the extracted copy).
- Re‑creates staging, validates again.
- `INSERT ... ON CONFLICT DO NOTHING` (or `DO UPDATE`) skips already‑imported rows.
- Lineage records are upserted (latest hash + confidence prevail).

### 7.3 Drift detection

After every wave, `db/scripts/validate_database.ps1` is re‑run. The twice‑run idempotency proof must remain green. If a wave introduced non‑idempotent DDL by accident, the proof fails and the wave is rolled back.

### 7.4 Monitoring

Per run, `audit.import_run_logs` records:

```text
level:        INFO | WARN | ERROR
message:      free text
count:        rows processed (when applicable)
duration_ms:  step duration
ts:           timestamp
```

Optional: forward to pino logger (`apps/api`) if importer runs inside the API process.

---

## 8. Wave 1‑4 Aggregate Numbers

**Exact counts** (computed from `tables_with_domains.csv` 2026‑05‑16 via the wave‑assignment heuristic mirroring `BROWNFIELD_ADAPTATION_MAP.md` §4, not estimates):

| Wave | Source tables | Target tables | Risk | Approval |
|-----:|--------------:|--------------:|------|----------|
| 1 — Catalogs (IMPORT class, all domains) | **93** | ≈ 12 | Low | Auto (confidence ≥ 0.9) |
| 2 — Operating model (TRANSFORM in OPOURSKA/PET/INDOOR/GOKMER/PROGOV/RBP/ITLAB/EPRA + default TRANSFORM) | **94** | ≈ 25 | Medium | Auto (confidence ≥ 0.85) + cross‑tenant FK check |
| 3 — Demo person data (TRANSFORM with employee/user indicators or H2R/SKILGRO‑person) — post Review #1 no anonymization | **31** | ≈ 15 | Low (demo data) | Auto (confidence ≥ 0.80, no PII risk) |
| 4 — Advanced intelligence (TRANSFORM in TALPIPE/PULSAR/SMERTO) | **55** | ≈ 20 | Medium‑High | **Human gate mandatory** (policy/sensitivity, not privacy) |
| — REFERENCE_ONLY (not imported) | **219** | — | — | — |
| — EXCLUDE (never imported, plus 7 pre‑excluded by legacy export) | **84 (+ 7)** | — | — | — |
| **Total covered (waves 1‑4)** | **273** | **≈ 70 sys.sys_* tables touched** | — | — |
| **Total not imported (REF + EXCL)** | **303** | — | — | — |
| **Grand total (catalog.json)** | **576** ✓ | — | — | — |
| **Plus pre‑excluded by legacy export** | **+7** | — | — | — |
| **Raw total (`.meta-tables.json`)** | **583** ✓ | — | — | — |

Verifica: 93 + 94 + 31 + 55 = 273 source tables in waves 1‑4. 273 + 219 + 84 = 576 catalog.json. + 7 pre‑excluded = 583 raw. **Numeri quadrati esattamente**.

---

## 9. Implementation Roadmap

| Step | Owner | When |
|------|-------|------|
| **9.0 Write per‑wave runner documentation** under `docs/brownfield/wave_runners/` — one file per wave (`wave_1_runner.md`, `wave_2_runner.md`, `wave_3_runner.md`, `wave_4_runner.md`). Each document specifies: input artifacts consumed (CSV + adaptation map rows for that wave), staging table layout, transformation rules per source table, validation queries, approval matrix, expected output rows in `sys.*`, rollback playbook, observability checkpoints. Documentation **must be written before** the corresponding runner Python implementation (9.4), so the implementation has a contract to satisfy and a reviewer has criteria to gate. | Dev | Post‑MVP (before 9.4) |
| 9.1 Implement `staging.*` per‑wave tables | Dev | MVP‑0 (skeleton in 000020) |
| 9.2 Implement `brownfield.*` + `audit.*` (000024‑000026) | Dev | MVP‑0 |
| 9.3 Implement `brownfield_adaptation` API module (CRUD on table_mappings, run trigger, validation, approval) | Dev | MVP‑1 |
| 9.4 Implement Python wave runners (`apply_wave_1.py`, …) — extend the empty placeholders in `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/scripts/`. Each runner reads the wave's `docs/brownfield/wave_runners/wave_N_runner.md` spec authored in 9.0 and satisfies it test‑first. | Dev | Post‑MVP (after 9.0) |
| 9.5 Wave 1 dry run + auto approval | Dev | Post‑MVP |
| 9.6 Wave 2 dry run + auto approval | Dev | Post‑MVP |
| 9.7 Wave 3 dry run + auto approval (post Review #1: demo data → no human gate) | Dev | Post‑MVP |
| 9.8 Wave 4 dry run + human approval (PI sign‑off) | PI | Post‑MVP |

Wave execution is **post‑MVP**. The MVP scope is the canonical platform itself. Brownfield import is an enrichment activity that happens after the platform exists and is validated.

---

## 10. Verification Checklist

- [x] Pipeline DAG documented (§1)
- [x] Common pipeline steps documented (§2)
- [x] Wave 1 fully specified (§3)
- [x] Wave 2 fully specified (§4)
- [x] Wave 3 fully specified with demo data import protocol (§5) — no anonymization (data is owner‑generated demo), auto‑approval if PASSED
- [x] Wave 4 fully specified (§6)
- [x] Cross‑wave operational notes (§7)
- [x] Aggregate numbers reconcile with adaptation map (§8)
- [x] Implementation roadmap (§9)
- [x] Rollback procedure per wave (§3.5, §4.5, §5.6, §6.5)
- [x] Lineage strategy explicit
- [x] No Docker; runtime via `.env` per ADR‑0010
