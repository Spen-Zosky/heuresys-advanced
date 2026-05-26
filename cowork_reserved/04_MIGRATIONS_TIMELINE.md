# Migrations Timeline — heuresys_advanced 33 migrations

**Generated**: 2026-05-20 (forensic analysis F4)
**Source**: `D:\heuresys-advanced\db\migrations\*.sql` (33 files, 000001..000033)
**Method**: Read tool, file-by-file complete enumeration (no inference, no sampling)
**Database target**: PostgreSQL 16, `heuresys_advanced`
**Applied**: 2026-05-18 / 2026-05-19 (per HANDOFF.md priming context)

---

## §1 — Summary timeline

| # | File | Topic | Schema target | Tables created (count) | Idempotent |
|---|---|---|---|---|---|
| 000001 | `init_extensions.sql` | PostgreSQL extensions bootstrap | (extensions) | 0 (3 ext.) | YES |
| 000002 | `init_sys_schema.sql` | 4 schemas + audit table + trigger fn | sys, staging, brownfield, audit | 1 (`sys_schema_migrations`) | YES |
| 000003 | `tenancies.sql` | Multi-tenant root registry | sys | 1 (`sys_tenancies`) | YES |
| 000004 | `users.sql` | Person/account anchor | sys | 1 (`sys_users`) | YES |
| 000005 | `auth_foundation.sql` | 11 auth tables + 8 roles + ~100 perms | sys | 11 (`sys_auth_*`, `sys_user_auth_roles`) | YES |
| 000006 | `user_profiles_and_evidence.sql` | Profile + evidence tables | sys | 10 | YES |
| 000007 | `enterprise_typing.sql` | ATECO/NACE + size/operating model + typing | sys | 5 | YES |
| 000008 | `blueprint_catalog.sql` | Industry blueprint catalog | sys | 5 | YES |
| 000009 | `organization_model.sql` | Org units + branches + hierarchies + history | sys | 5 | YES |
| 000010 | `job_role_model.sql` | Job families + job roles + ESCO occupation mappings | sys | 3 | YES |
| 000011 | `position_model.sql` | Position spine + 6 PIP base tables + PIP VIEW | sys | 7 + 1 view | YES |
| 000012 | `user_position_assignments.sql` | User × position bridge w/ I1 invariant | sys | 1 | YES |
| 000013 | `skill_taxonomy_model.sql` | Skill taxonomy + late FKs to evidence/PSR | sys | 6 + 2 late FK | YES |
| 000014 | `position_skill_requirements.sql` | PSR history (slow-changing) sibling | sys | 1 | YES |
| 000015 | `kpi_model.sql` | KPI cascade (10 tables) + late FKs | sys | 9 + 2 late FK | YES |
| 000016 | `learning_model.sql` | Learning + gap closure (10 tables) + late FKs | sys | 8 + 2 late FK | YES |
| 000017 | `assessment_gap_model.sql` | Assessment + readiness/talent/succession scores | sys | 10 + 1 late FK | YES |
| 000018 | `career_succession_model.sql` | Career paths + succession pools/candidates | sys | 10 + 1 late FK | YES |
| 000019 | `compensation_intelligence_model.sql` | Comp bands + reward gates + recommendations | sys | 11 + 1 late FK | YES |
| 000020 | `seed_acquisition_staging.sql` | AI seed acquisition pipeline (5 tables in sys) | sys | 5 | YES |
| 000021 | `seed_reference_bank.sql` | RTL_BANK_REFERENCE seeds (no users/positions) | sys | 0 (seeds only) | YES |
| 000022 | `visualization_graph_model.sql` | Semantic graph + layouts (ADR-0009/I10) | sys | 7 | YES |
| 000023 | `validation_views_and_checks.sql` | 10 cross-table validation VIEWs | sys | 0 (10 views) | YES |
| 000024 | `brownfield_import_staging.sql` | Brownfield source + import_runs + audit logs | brownfield, audit | 5 (4 brownfield + 1 audit) | YES |
| 000025 | `brownfield_lineage_and_mapping.sql` | table/column mappings + canonical lineage | brownfield, sys | 3 (2 brownfield + 1 sys) | YES |
| 000026 | `brownfield_import_validation.sql` | Brownfield validation + approval (audit) | audit | 2 | YES |
| 000027 | `ess_inbox_and_audit.sql` | ESS inbox + self-service audit (ADR-0011) | sys, audit | 2 + 1 view replace | YES |
| 000028 | `dashboard_permission_seed.sql` | `dashboard:view` perm + role mappings | sys | 0 (seeds only) | YES |
| 000029 | `brownfield_table_mapping_wave.sql` | ADR-0012: wave column on table_mappings | brownfield | 0 (ALTER only) | YES |
| 000030 | `brownfield_wave1_staging.sql` | 17 staging.wave1_* buffer tables (jsonb-uniform) | staging | 17 | YES |
| 000031 | `add_uq_sys_user_certifications.sql` | Goal 002 enabler: natural-key UQ index | sys | 0 (1 UQ index) | YES |
| 000032 | `sys_activity_classifications_check_relax.sql` | Goal 003 Item C: relax scheme CHECK | sys | 0 (constraint relax) | YES |
| 000033 | `brownfield_tenant_id_mappings_and_validate_lookup_fk.sql` | Goal 003 D+M: tenant map + LOOKUP_FK trigger | brownfield | 1 (`tenant_id_mappings`) + 2 fns + 1 trigger | YES |

**Aggregate counts (verified by enumeration):**
- Files: 33
- Tables created in `sys`: 117 (PIP base 7 + sys_users + sys_tenancies + ~107 others)
- Tables created in `brownfield`: 6 (`source_exports`, `source_tables`, `source_columns`, `import_runs`, `table_mappings`, `column_mappings`, `tenant_id_mappings`)
- Tables created in `audit`: 4 (`import_run_logs`, `import_validation_results`, `import_approval_decisions`, `user_self_service_actions`)
- Tables created in `staging`: 17 (Wave 1 buffer tables, all uniform jsonb shape)
- VIEWs: 11 (10 in 000023 + 1 PIP view in 000011)
- Functions: 3 (`sys.sys_set_updated_at`, `brownfield.validate_lookup_fk_payload`, `brownfield.validate_lookup_fk_payload_trigger`)
- Triggers: 1 named per row-table (set_updated_at) + 1 in 000033 (LOOKUP_FK validation)
- Extensions: 3 (`pgcrypto`, `uuid-ossp`, `pg_trgm`)

---

## §2 — Detailed analysis per migration

### 000001_init_extensions.sql
- **Topic**: PostgreSQL extension bootstrap
- **Schema**: extension-level (no schema)
- **Creates**: `pgcrypto` (gen_random_uuid, crypt), `uuid-ossp` (legacy compat uuid_generate_v4), `pg_trgm` (trigram fuzzy search)
- **Idempotency**: `CREATE EXTENSION IF NOT EXISTS` × 3
- **Notes**: Header notes the audit row to `sys.sys_schema_migrations` is written by the runner AFTER 000002 creates the table — i.e., 000001's own audit insert is guarded by table-exists check.

### 000002_init_sys_schema.sql
- **Topic**: Canonical + auxiliary schemas + migration audit table + shared trigger
- **Schema**: creates `sys`, `staging`, `brownfield`, `audit`
- **Creates**:
  - Function `sys.sys_set_updated_at()` (returns trigger, sets `NEW.updated_at := now()`) — reused by every table with `updated_at`
  - Table `sys.sys_schema_migrations` (PK serial, file_name, sha256, applied_at, applied_by, duration_ms)
  - Indexes: `sys_schema_migrations_file_name_uq` (UNIQUE), `sys_schema_migrations_applied_at_idx`
- **Idempotency**: `CREATE SCHEMA IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`
- **Notes**: Schemas are also created by `create_local_database` and `setup_oci_vm` scripts (redundancy kept for cases where DB was pre-created manually).

### 000003_tenancies.sql
- **Topic**: Multi-tenant root registry (Invariant I5)
- **Schema**: sys
- **Creates**: Table `sys.sys_tenancies` (uuid PK, tenant_code natural key, status, size_band, jsonb metadata)
- **Constraints**: CHECK on `tenant_status` ∈ {ACTIVE, SUSPENDED, ARCHIVED, PENDING_ACTIVATION}; CHECK on `tenant_size_band` ∈ {XS, S, M, L, XL} (NULL allowed); UNIQUE on `tenant_code`
- **Trigger**: `sys_tenancies_set_updated_at` (DO block guarded)
- **Idempotency**: DROP CONSTRAINT IF EXISTS + ADD pattern for CHECKs; trigger guarded by `pg_trigger` existence query
- **Notes**: No `created_by`/`updated_by` — at bootstrap no users exist yet. `tenant_code` is the idempotent seeding key (used by `RTL_BANK_REFERENCE` insert in 000021).

### 000004_users.sql
- **Topic**: Person/account anchor (Invariant I7 — separate from auth tables)
- **Schema**: sys
- **Creates**: Table `sys.sys_users` (uuid PK, FK to sys_tenancies, email, status, type, is_synthetic flag)
- **Constraints**: CHECK on `user_status` (5 values), CHECK on `user_type` ∈ {STANDARD, SYNTHETIC_REFERENCE, SERVICE}, CHECK enforcing synthetic+type coherence (synthetic=true iff type='SYNTHETIC_REFERENCE'); UNIQUE on `(user_tenant_id, lower(user_email))` (case-insensitive per-tenant)
- **Trigger**: `sys_users_set_updated_at`
- **Notes**: No password/hash columns (auth in 000005). Per-tenant unique email is the idempotent key for synthetic user seeding.

### 000005_auth_foundation.sql
- **Topic**: 11 auth tables + 8 canonical roles + ~100 permissions + role×perm mapping
- **Schema**: sys
- **Creates** (11 tables):
  1. `sys_auth_identities` (per user × provider; CHECK provider ∈ {LOCAL, SSO_OIDC, SSO_SAML})
  2. `sys_auth_credentials` (Argon2id hash; partial UNIQUE on `(identity_id) WHERE is_current=true`)
  3. `sys_auth_sessions` (placeholder, future SSO)
  4. `sys_auth_refresh_tokens` (rotation chain via `family_id` + `previous_id` self-FK; UNIQUE on hash; revoke_reason CHECK 6 values)
  5. `sys_auth_login_events` (audit trail; CHECK event_type 16 values)
  6. `sys_auth_password_reset_tokens` (UNIQUE on token_hash)
  7. `sys_auth_mfa_factors` (kind ∈ {TOTP, WEBAUTHN, EMAIL_OTP, SMS_OTP}; foundation)
  8. `sys_auth_roles` (8 roles seeded)
  9. `sys_auth_permissions` (~100 perms seeded: 81 admin + 19 ESS)
  10. `sys_auth_role_permissions` (M:N join)
  11. `sys_user_auth_roles` (user × role × tenant assignment; partial UNIQUE active per tuple)
- **Seeds**: 8 roles (PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER, USER, READ_ONLY); 81 admin perms + 19 ESS `:self`-scoped perms (per AUTH_SECURITY_PLAN §6, §6.1); 7 role→perm mapping blocks (PLATFORM_ADMIN gets all, others curated sets)
- **Idempotency**: `ON CONFLICT (auth_role_code) DO NOTHING`, `ON CONFLICT (auth_permission_code) DO NOTHING`, role-perm via composite PK `ON CONFLICT DO NOTHING`
- **Notes**: PLATFORM_ADMIN granted via `CROSS JOIN`; TENANT_ADMIN excludes 5 perms (tenant:create/delete, role:create/update, brownfield:approve). MANAGER scope enforced at repository layer, not via perm code.

### 000006_user_profiles_and_evidence.sql
- **Topic**: Extended profile (1:1) + education/experience/certifications/documents + 5 evidence tables
- **Schema**: sys
- **Creates** (10 tables):
  1. `sys_user_profiles` (1:1 unique on `user_id`)
  2. `sys_user_education_records`
  3. `sys_user_professional_experiences`
  4. `sys_user_certifications`
  5. `sys_user_documents` (CHECK kind ∈ 6 values; URI-only, binaries NEVER in DB)
  6. `sys_person_evidence_records` (polymorphic anchor; CHECK type ∈ 6 values; CHECK source ∈ 7 values)
  7. `sys_user_skill_evidence` (FK to `sys_skills` ADDED LATER in 000013)
  8. `sys_user_learning_evidence` (FK to `sys_learning_modules` ADDED LATER in 000016)
  9. `sys_user_kpi_evidence` (FK to `sys_kpi_definitions` ADDED LATER in 000015)
  10. `sys_user_assessment_evidence` (FK to `sys_assessments` ADDED LATER in 000017)
- **Pattern note**: 4 evidence tables use plain `uuid` columns for FK targets that don't yet exist; FK constraints added in later migrations via guarded `DO $fk$ BEGIN IF NOT EXISTS ... ADD CONSTRAINT`. This is the "late-binding FK" pattern documented in headers.
- **Triggers**: All 10 tables get a `set_updated_at` trigger via guarded DO block.

### 000007_enterprise_typing.sql
- **Topic**: ATECO 2025 + NACE Rev 2.1 catalog + tenant typing
- **Schema**: sys
- **Creates** (5 tables):
  1. `sys_activity_classifications` (CHECK scheme ∈ {ATECO_2025, NACE_REV_2_1, ATECO_2007, NACE_REV_2}; UNIQUE on `(scheme, code)`) — **relaxed by 000032**
  2. `sys_activity_classification_mappings` (cross-scheme; CHECK kind ∈ {EXACT, NARROWER, BROADER, RELATED, APPROXIMATE})
  3. `sys_enterprise_size_bands` (CHECK code ∈ {XS, S, M, L, XL})
  4. `sys_operating_model_catalog` (RETAIL, WHOLESALE, MIXED, B2B_SERVICES, PUBLIC_SECTOR, MANUFACTURING — seeded in 000021)
  5. `sys_enterprise_typing_profiles` (per-tenant 1:1 via UNIQUE on `tenant_id`; CHECK regulatory_intensity ∈ {LOW, MEDIUM, HIGH, EXTREME})

### 000008_blueprint_catalog.sql
- **Topic**: Industry blueprint families + variants + process registry + per-tenant activation + overrides
- **Schema**: sys
- **Creates** (5 tables):
  1. `sys_blueprint_families` (UNIQUE on `family_code`)
  2. `sys_blueprint_variants` (FK to family, optional FK to size_band; UNIQUE on `variant_code`)
  3. `sys_blueprint_process_registry` (FK to variant, ordinal; UNIQUE on `(variant_id, process_code)`)
  4. `sys_blueprint_activations` (FK to tenant + variant; CHECK status ∈ {PROPOSED, ACTIVE, SUSPENDED, RETIRED}; partial UNIQUE "one ACTIVE per tenant")
  5. `sys_blueprint_overrides` (FK to activation + process; CHECK inclusion ∈ {IN, PARTIAL, OUT})

### 000009_organization_model.sql
- **Topic**: Org units + branches + closure-table hierarchies + history (Invariant I3 schema policy: sys.sys_*)
- **Schema**: sys
- **Creates** (5 tables):
  1. `sys_organization_unit_types` (CHECK 8 values: HEADQUARTERS..WAREHOUSE)
  2. `sys_organization_units` (per-tenant code UNIQUE; self-FK for parent; FK to type + manager user)
  3. `sys_branches` (1:1 with org_unit via UNIQUE; opening_hours jsonb; regulatory_zone)
  4. `sys_organization_hierarchies` (closure table: ancestor_id, descendant_id, depth, PK = pair)
  5. `sys_organization_unit_history` (CHECK change_type 7 values: CREATED..REACTIVATED)

### 000010_job_role_model.sql
- **Topic**: Job family + job roles + ESCO occupation mappings
- **Schema**: sys
- **Creates** (3 tables):
  1. `sys_job_families` (UNIQUE family_code)
  2. `sys_job_roles` (FK to family; CHECK seniority ∈ 6 values; UNIQUE job_role_code)
  3. `sys_esco_occupation_mappings` (FK to job_role; UNIQUE on `(job_role_id, esco_uri)`; confidence numeric(4,3))

### 000011_position_model.sql
- **Topic**: THE SPINE — `sys_positions` + 6 PIP base requirement tables + PIP VIEW (Invariants I1, I2, I9 + ADR-0008)
- **Schema**: sys
- **Creates** (7 tables + 1 view):
  1. `sys_positions` (the central HRMS object; FK to tenant, org_unit, job_role, owner_user, self-FK for reports_to; CHECK criticality ∈ {CRITICAL, HIGH, MEDIUM, LOW}; CHECK economic_weight ∈ [0,1]; jsonb ai_hints)
  2. `sys_position_skill_requirements` (FK to position; skill_id w/o FK yet → late-bound in 000013; CHECK proficiency 6 values; CHECK criticality)
  3. `sys_position_kpi_requirements` (kpi_definition_id late-bound in 000015)
  4. `sys_position_learning_requirements` (learning_path_id late-bound in 000016)
  5. `sys_position_career_paths` (career_path_id late-bound in 000018)
  6. `sys_position_compensation_profiles` (compensation_band_id late-bound in 000019)
  7. `sys_position_succession_relevance` (CHECK readiness_horizon 5 values)
- **View**: `sys.sys_position_intelligence_profiles_v` — PIP as VIEW (NOT JSONB blob per I9/ADR-0008). Aggregates 6 base tables via `jsonb_agg` subqueries.
- **Notes**: Header explicitly states "Position OWNER ≠ Position INCUMBENT" — incumbent in 000012.

### 000012_user_position_assignments.sql
- **Topic**: User × position bridge with Invariant I1 enforcement
- **Schema**: sys
- **Creates**: Table `sys.sys_user_position_assignments`
- **Constraints**: CHECK kind ∈ {PRIMARY, SECONDARY, INTERIM, ACTING}; CHECK status ∈ {ACTIVE, ENDED, PROPOSED, CANCELLED}; CHECK fte ∈ [0,1]; CHECK dates_ordered (`end_date >= start_date OR end_date IS NULL`)
- **Invariant enforcement**: Partial UNIQUE `sys_upa_one_primary_active_per_user` ON `(user_id) WHERE kind='PRIMARY' AND status='ACTIVE'` — at most ONE ACTIVE PRIMARY per user

### 000013_skill_taxonomy_model.sql
- **Topic**: Skill taxonomy + late-binding FKs back to 000006/000011
- **Schema**: sys
- **Creates** (6 tables):
  1. `sys_skill_families`
  2. `sys_skill_categories` (FK to family)
  3. `sys_skill_proficiency_levels` (CHECK code ∈ {NOVICE..MASTER}; SEEDS 6 rows immediately via `ON CONFLICT DO NOTHING`)
  4. `sys_skills` (tenant_id nullable for global skills; UNIQUE on `(COALESCE(tenant_id, sentinel_uuid), code)`; GIN trigram index on name)
  5. `sys_skill_taxonomy_edges` (parent/child; CHECK kind ∈ {IS_A, PART_OF, RELATED, PREREQUISITE_OF})
  6. `sys_skill_aliases` (UNIQUE on `(skill_id, lower(label), COALESCE(locale,''))`; GIN trigram on label)
- **Late-binding FKs added here**:
  - `sys_user_skill_evidence.skill_id` → `sys_skills` (ON DELETE RESTRICT)
  - `sys_position_skill_requirements.skill_id` → `sys_skills` (ON DELETE RESTRICT)

### 000014_position_skill_requirements.sql
- **Topic**: PSR history sibling (slow-changing audit)
- **Schema**: sys
- **Creates**: `sys_position_skill_requirement_history` — old_proficiency + new_proficiency + change_reason + actor_user_id (full audit trail of proficiency drift)
- **Notes**: Header clarifies the main PSR table is in 000011; this only adds history.

### 000015_kpi_model.sql
- **Topic**: KPI cascading (10 tables) — definitions → metrics → process/org templates → targets → measurements → assessment → results
- **Schema**: sys
- **Creates** (9 net tables):
  1. `sys_kpi_definitions` (CHECK polarity ∈ {HIGHER_IS_BETTER, LOWER_IS_BETTER, TARGET_RANGE})
  2. `sys_kpi_metric_definitions` (CHECK aggregation ∈ 7 values)
  3. `sys_process_kpi_templates` (FK to blueprint_process + kpi)
  4. `sys_organization_unit_kpi_templates`
  5. `sys_kpi_targets` (scope CHECK: position_id OR user_id must be NOT NULL)
  6. `sys_kpi_measurements`
  7. `sys_kpi_assessment_methods` (CHECK code ∈ {DELTA_VS_TARGET, PERCENTILE, BANDED, LINEAR_SCORE, STEPPED})
  8. `sys_kpi_weighting_rules` (CHECK kind ∈ {LINEAR, CAPPED, STEP})
  9. `sys_kpi_assessment_results`
- **Late-binding FKs**: `sys_user_kpi_evidence.kpi_id` + `sys_position_kpi_requirements.kpi_definition_id` → `sys_kpi_definitions`

### 000016_learning_model.sql
- **Topic**: Learning + gap closure (Invariant I11: completion ≠ mastery)
- **Schema**: sys
- **Creates** (8 tables):
  1. `sys_learning_modules` (CHECK kind ∈ 6 values; CHECK delivery ∈ 4 values; tenant nullable for global)
  2. `sys_training_initiatives` (CHECK status ∈ 5 values: PLANNED..CANCELLED)
  3. `sys_learning_paths`
  4. `sys_learning_path_steps`
  5. `sys_skill_learning_mappings` (skill ↔ module + target_proficiency)
  6. `sys_user_learning_assignments` (CHECK scope: initiative OR module OR path NOT NULL; CHECK status ∈ 6 values)
  7. `sys_learning_gaps` (CHECK severity ∈ {LOW, MEDIUM, HIGH, CRITICAL})
  8. `sys_gap_closure_actions` (CHECK kind ∈ 6 values: TRAINING_ASSIGNMENT..MENTORING; CHECK status 4 values)
- **Late-binding FKs**: `sys_user_learning_evidence.module_id`, `sys_position_learning_requirements.learning_path_id`

### 000017_assessment_gap_model.sql
- **Topic**: Assessment + readiness + talent/succession scores
- **Schema**: sys
- **Creates** (10 tables): `sys_assessment_methods`, `sys_assessments` (CHECK kind ∈ {MANAGER, THREE_SIXTY, PEER, SELF, EXTERNAL}; CHECK status ∈ 4 values), `sys_assessment_results`, `sys_behavioral_assessments`, `sys_employee_position_fit_scores` (CHECK dimension ∈ 6 values), `sys_gap_analysis_results` (CHECK kind ∈ 6 values), `sys_gap_closure_plans` (CHECK status ∈ 5 values), `sys_readiness_scores` (CHECK horizon ∈ {READY_NOW..NOT_READY}), `sys_talent_scores` (potential/performance/band), `sys_succession_scores`
- **Late-binding FK**: `sys_user_assessment_evidence.assessment_id` → `sys_assessments`

### 000018_career_succession_model.sql
- **Topic**: Career paths + succession pools + critical role coverage
- **Schema**: sys
- **Creates** (10 tables): `sys_career_paths` (CHECK kind ∈ {VERTICAL, LATERAL, SPECIALIST, MANAGERIAL, CROSS_FUNCTIONAL}), `sys_career_path_steps`, `sys_user_career_plans` (CHECK status ∈ 4 values), `sys_user_target_positions` (CHECK review_status ∈ 4 values), `sys_critical_positions`, `sys_succession_pools` (CHECK status ∈ {ACTIVE, ARCHIVED, PROPOSED}), `sys_successor_candidates` (CHECK status 4 + readiness CHECK), `sys_successor_readiness`, `sys_critical_role_coverage_status` (per-position aggregated readiness counters)
- **Late-binding FK**: `sys_position_career_paths.career_path_id` → `sys_career_paths`

### 000019_compensation_intelligence_model.sql
- **Topic**: Compensation intelligence + reward gates (Invariant I8: decision support ONLY, not payroll execution)
- **Schema**: sys
- **Creates** (11 net tables): `sys_compensation_bands`, `sys_position_economic_weight`, `sys_objective_reward_rules`, `sys_payout_curves` (CHECK kind ∈ {LINEAR, CAPPED, STEPPED, SIGMOID}), `sys_bonus_pools` (CHECK scope ∈ {TENANT, ORG_UNIT, POSITION_FAMILY}), `sys_variable_pay_calculations`, `sys_reward_gate_catalog`, `sys_reward_gates`, `sys_reward_gate_results` (CHECK status ∈ {PASSED, WARNING, BLOCKED, ESCALATED, OVERRIDDEN_WITH_REASON}), `sys_compensation_recommendations` (CHECK signal ∈ 5 values incl. SUPPRESSED_BY_GATE), `sys_payroll_handoff_records` (CHECK status ∈ 4 values)
- **Migration-time evolution**: lines 146-165 contain a guarded `DO $alter$` block that detects if `sys_reward_gate_catalog.reward_gate_catalog_blueprint_variant_id` was previously nullable and sets it NOT NULL when the table is empty — handles in-place upgrade from earlier versions. Then drops potential prior COALESCE-based unique index and recreates as plain UNIQUE so the seed in 000021 can use `ON CONFLICT (variant_id, code)`.
- **Late-binding FK**: `sys_position_compensation_profiles.compensation_band_id` → `sys_compensation_bands`

### 000020_seed_acquisition_staging.sql
- **Topic**: AI seed acquisition pipeline (located in `sys`, NOT `staging` — note schema choice)
- **Schema**: sys
- **Creates** (5 tables):
  1. `sys_seed_acquisition_runs` (CHECK status ∈ {RUNNING, COMPLETED, FAILED, CANCELLED})
  2. `sys_seed_candidate_records` (CHECK validation_status ∈ 7 values; UNIQUE on `(run_id, natural_key)`)
  3. `sys_seed_source_evidence`
  4. `sys_seed_validation_results` (CHECK status ∈ {PASSED, FAILED, WARNING, SKIPPED})
  5. `sys_seed_approval_decisions` (CHECK status ∈ {APPROVED, REJECTED, NEEDS_CHANGES})

### 000021_seed_reference_bank.sql
- **Topic**: RTL_BANK_REFERENCE foundational seeds (idempotent, DDL-free)
- **Schema**: sys (target schemas of INSERTs)
- **Creates**: 0 tables (seed-only migration)
- **Seeds inserted**:
  - 5 enterprise size bands (XS..XL)
  - 6 operating model codes (RETAIL..MANUFACTURING)
  - 8 organization unit types
  - 5 KPI assessment methods + 3 weighting rules
  - 5 assessment methods
  - 1 blueprint family `FIN_BANKING` + 1 variant `REGIONAL_RETAIL_BANK_MEDIUM` (joined on size band M)
  - 1 tenant `RTL_BANK_REFERENCE` (IT country, M size, ACTIVE, regulatory_intensity HIGH in jsonb metadata)
  - 7 reward gates (CONDUCT, COMPLIANCE, RISK, TRAINING, CERTIFICATION, CUSTOMER_HARM, AUDIT_FINDING) attached to the variant
  - 23 blueprint processes (ordinals 0..22; codes '00'..'22') for `REGIONAL_RETAIL_BANK_MEDIUM`
- **Idempotency**: ALL inserts use `ON CONFLICT ... DO NOTHING`
- **Notes**: Header explicitly states 158 synthetic Faker users + 5 branches + 25 branch positions + 30 HQ positions are loaded by `db/scripts/seed-reference-bank.ts` step 5.0.7 with seed=42 — **NOT in this migration**.

### 000022_visualization_graph_model.sql
- **Topic**: Semantic graph (nodes/edges) + per-layout coordinates (ADR-0009, Invariant I10)
- **Schema**: sys
- **Creates** (7 tables):
  1. `sys_visualization_graphs` (CHECK graph_type ∈ 9 values: ORG_CHART..ENTERPRISE_BLUEPRINT_MAP; UNIQUE on `(tenant_id, code, version)`)
  2. `sys_visualization_nodes` (CHECK source_entity_type ∈ 11 values)
  3. `sys_visualization_edges` (CHECK edge_type ∈ 8 values)
  4. `sys_visualization_layouts` (CHECK engine ∈ 9 values; partial UNIQUE "one default per graph")
  5. `sys_visualization_node_layouts` (x, y, z numeric coordinates; locked boolean; PER-LAYOUT — semantic kept in nodes table, coords kept here per ADR-0009)
  6. `sys_visualization_styles`
  7. `sys_visualization_exports` (CHECK format ∈ {SVG, PDF, PNG, GENERIC_JSON, REACT_FLOW_JSON, MERMAID})

### 000023_validation_views_and_checks.sql (STRATEGIC)
- **Topic**: 10 cross-table validation VIEWs — healthy DB returns 0 rows from each
- **Schema**: sys
- **Creates** (10 VIEWs):
  1. `v_orphan_position_assignments` (assignment user/position deleted)
  2. `v_tenant_boundary_violations` (assignment_tenant ≠ user_tenant ≠ position_tenant)
  3. `v_positions_without_job_role` (active position without job_role assigned)
  4. `v_pip_completeness` (active position without at least one skill requirement)
  5. `v_reward_gate_completeness` (tenant with ACTIVE blueprint missing gate seeds)
  6. `v_synthetic_user_flag_consistency` (CHECK redundancy across rows)
  7. `v_canonical_outside_sys` (any `sys_*` table outside `sys` schema)
  8. `v_active_primary_assignment_per_user` (users with >1 PRIMARY ACTIVE)
  9. `v_visualization_node_in_canonical_node` (polymorphic FK check across 10 source_entity_type values)
  10. `v_inbox_resource_consistency` — **PLACEHOLDER body** (empty VIEW with matching column types). Final body installed by 000027 via `CREATE OR REPLACE VIEW`.
- **Sample code snippet** (the placeholder pattern — strategic for understanding cross-migration coupling):
```sql
CREATE OR REPLACE VIEW sys.v_inbox_resource_consistency AS
SELECT
  NULL::uuid        AS notification_id,
  NULL::varchar(64) AS notification_resource_type,
  NULL::uuid        AS notification_resource_id
WHERE false;
```
- **Notes**: `validate_database.{ps1,sh}` runs `SELECT count(*) FROM <view>` for each and fails on non-zero. The placeholder ensures the validator can be wired before 000027 runs.

### 000024_brownfield_import_staging.sql
- **Topic**: Brownfield staging schema (operational metadata, NOT canonical data)
- **Schema**: brownfield + audit
- **Creates** (4 in brownfield, 1 in audit):
  - `brownfield.source_exports` (CHECK status ∈ {AVAILABLE, INGESTED, ARCHIVED, CORRUPTED})
  - `brownfield.source_tables` (CHECK classification ∈ {IMPORT, TRANSFORM, REFERENCE_ONLY, EXCLUDE}; **domain column** used by 000029 for wave classification)
  - `brownfield.source_columns` (per-column PII flag)
  - `brownfield.import_runs` (CHECK status ∈ {RUNNING, COMPLETED, FAILED, CANCELLED, AWAITING_APPROVAL}; CHECK wave ∈ [1,4] OR NULL)
  - `audit.import_run_logs` (CHECK level ∈ {DEBUG, INFO, WARN, ERROR, FATAL})

### 000025_brownfield_lineage_and_mapping.sql
- **Topic**: Source→target mappings (approval gated) + CANONICAL lineage (Invariant I12)
- **Schema**: brownfield + sys
- **Creates** (2 in brownfield, 1 in sys):
  - `brownfield.table_mappings` (CHECK classification ∈ 4 values; CHECK approval_status ∈ {PROPOSED, APPROVED, REJECTED, NEEDS_CHANGES}; UNIQUE on `(source_table_id, target_schema, target_table)`)
  - `brownfield.column_mappings` (CHECK pii_disposition ∈ {NONE, PSEUDONYMIZE, MASK, DROP, TAG_SYNTHETIC})
  - `sys.sys_source_lineage_records` (polymorphic target via `(target_table_name, target_record_id)`; CHECK validation_status ∈ {VALID, STALE, CONFLICTED, REJECTED}; UNIQUE on `(source_system, source_table, source_record_id, target_table_name)`)

### 000026_brownfield_import_validation.sql
- **Topic**: Per-candidate validation results + human approval decisions
- **Schema**: audit
- **Creates** (2 tables):
  - `audit.import_validation_results` (CHECK status ∈ {PASSED, FAILED, WARNING, SKIPPED})
  - `audit.import_approval_decisions` (CHECK status ∈ {APPROVED, REJECTED, NEEDS_CHANGES, ESCALATED})

### 000027_ess_inbox_and_audit.sql
- **Topic**: ESS inbox + self-service audit (ADR-0011)
- **Schema**: sys + audit
- **Creates**:
  - `sys.sys_inbox_notifications` (CHECK type 6 values: TRAINING_DEADLINE..SYSTEM; CHECK priority {INFO, MEDIUM, HIGH, CRITICAL}; CHECK status {UNREAD, READ, DISMISSED, ARCHIVED}; CHECK resource_type 6 values)
  - `audit.user_self_service_actions` (CHECK action_type ∈ 8 values: PROFILE_UPDATE, SKILL_SELF_ASSESS, LEARNING_ENROLL, CAREER_TARGET_REQUEST, CERT_UPLOAD, DOC_UPLOAD, INBOX_MARK_READ, INBOX_DISMISS)
- **VIEW replacement**: `CREATE OR REPLACE VIEW sys.v_inbox_resource_consistency` with the REAL body — polymorphic FK consistency check across {POSITION, LEARNING_MODULE, ASSESSMENT, CAREER_TARGET=`sys_user_target_positions`, KPI, SKILL}
- **Notes**: Runs LAST in original sequence intentionally (header) so the VIEW replacement happens after all target sys tables exist.

### 000028_dashboard_permission_seed.sql
- **Topic**: MVP-2a 1.5.2 — single `dashboard:view` permission + role grants
- **Schema**: sys
- **Creates**: 0 tables
- **Seeds**: 1 permission (`dashboard:view`) granted to 6 roles (PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER) — USER/READ_ONLY excluded
- **Idempotency**: `ON CONFLICT (auth_permission_code) DO NOTHING` + composite PK on role_permissions

### 000029_brownfield_table_mapping_wave.sql
- **Topic**: ADR-0012 — wave smallint column on table_mappings (symmetric with `import_runs.import_run_wave`)
- **Schema**: brownfield
- **Creates**: 0 net tables (ALTER ADD COLUMN)
- **Changes**:
  - ADD COLUMN `table_mapping_wave smallint`
  - CHECK constraint: `wave IS NULL OR wave BETWEEN 1 AND 4`
  - Partial index `WHERE wave IS NOT NULL`
  - UPDATE backfill: rows with `wave IS NULL AND approval_status='APPROVED' AND classification IN (IMPORT, TRANSFORM)` joined to source_tables where `source_table_domain IN (ESKAP, SKILGRO, INDOOR, ITLAB, PROGOV, OPOURSKA, H2R)` — set wave=1
- **Idempotency**: filter `wave IS NULL` guarantees re-runs never override previously assigned wave. Backfill is no-op on fresh DB (empty table).
- **Notes** (anomaly to flag): the header references 7 Wave-1 source domains (matching CASCADIA lexicon sigle), but only the seed mapping data (not in this migration) would populate `source_table_domain`. Migration itself ships SAFE no-op semantics.

### 000030_brownfield_wave1_staging.sql (STRATEGIC)
- **Topic**: 17 uniform staging tables (jsonb-buffer pattern) for Wave 1 executor
- **Schema**: staging
- **Creates** (17 tables — all in a single procedural DO $$ block):
  - 17 targets: `skills, skill_families, skill_categories, skill_taxonomy_edges, skill_aliases, learning_modules, learning_paths, learning_path_steps, skill_learning_mappings, user_certifications, esco_occupation_mappings, activity_classifications, activity_classification_mappings, compensation_bands, process_kpi_templates, blueprint_process_registry, job_roles`
  - Naming convention: `staging.wave1_<target>` for each target sys.sys_<target>
  - Uniform shape: every table has the same 12 columns (staging_row_id, staging_import_run_id, staging_source_table, staging_source_record_id, staging_source_natural_key, staging_source_content_hash, staging_raw_record jsonb, staging_validation_status, staging_validation_errors, staging_mapping_confidence, staging_target_record_id, staging_upserted_at, created_at)
  - Per-table: 2 CHECK constraints (validation_status, mapping_confidence range), 3 indexes (run_status, unique on `(run_id, source_table, source_record_id)`, natural_key partial)
- **Sample code snippet** (the dynamic format pattern — strategic for understanding the wave-executor design):
```sql
EXECUTE format($f$
  CREATE TABLE IF NOT EXISTS staging.%I (
    staging_row_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    staging_import_run_id       uuid         NOT NULL REFERENCES brownfield.import_runs(import_run_id) ON DELETE CASCADE,
    staging_source_table        varchar(255) NOT NULL,
    staging_source_record_id    varchar(255) NOT NULL,
    staging_source_natural_key  varchar(512),
    staging_source_content_hash char(64),
    staging_raw_record          jsonb        NOT NULL,
    staging_validation_status   varchar(32)  NOT NULL DEFAULT 'PENDING',
    staging_validation_errors   jsonb        NOT NULL DEFAULT '[]'::jsonb,
    staging_mapping_confidence  numeric(4,3) NOT NULL DEFAULT 1.000,
    staging_target_record_id    uuid,
    staging_upserted_at         timestamptz,
    created_at                  timestamptz  NOT NULL DEFAULT now()
  )
$f$, staging_table);
```
- **Notes**: Uniform jsonb-buffer NOT per-target schema mirroring — wave executor reads `brownfield.column_mappings` as transformation config and applies generically. TRUNCATE policy: tables may be truncated between runs; run_id FK ensures isolation across waves.

### 000031_add_uq_sys_user_certifications.sql (Goal 002 hot-fix)
- **Topic**: Natural-key UNIQUE INDEX enabling brownfield upsert path
- **Schema**: sys
- **Creates**: 1 UNIQUE INDEX `sys_user_certifications_natural_key_uq` on `(tenant_id, user_id, name, issuer, COALESCE(issued_date, '0001-01-01'::date))`
- **Rationale (from header)**: Goal 001a REPORT §7 item 3 documented that 1 brownfield column_mapping (target `sys.sys_user_certifications`) was being skipped during wave-1 execution because the target had only its uuid PK — no natural-key UQ. The wave-executor's `engine.ts::loadTargetMeta()` (lines 97-141, query against pg_index) needs a UQ to derive `conflictInference` and emit a real ON CONFLICT clause. Without this index → `no_conflict_inference_available` skip.
- **Decision**: Goal 001a REVIEW §3.3 chose option (c) — add UQ to target table via migration. Path (a) silent `ON CONFLICT DO NOTHING` rejected for audit-quality reasons. Path (b) explicit error remains active for tables still lacking a UQ.
- **Sentinel value**: `COALESCE(issued_date, '0001-01-01'::date)` handles PG's "(NULL,NULL) ≠ (NULL,NULL)" quirk — without it, multiple rows with NULL issued_date would not be considered duplicates by the UNIQUE constraint.
- **Reversibility**: `DROP INDEX IF EXISTS sys.sys_user_certifications_natural_key_uq;`

### 000032_sys_activity_classifications_check_relax.sql (Goal 003 hot-fix)
- **Topic**: Relax `_scheme_check` CHECK constraint to accept legacy demo scheme values
- **Schema**: sys
- **Creates**: 0 net (constraint relaxation)
- **Changes**:
  - DROP CONSTRAINT `sys_activity_classifications_scheme_check`
  - ADD CONSTRAINT with expanded value set: original 4 (`ATECO_2025, NACE_REV_2_1, ATECO_2007, NACE_REV_2`) + 2 new (`ATECO, NACE` — base versions, no year/revision suffix)
- **Rationale (from header)**: Goal 002 REPORT §3.5 documented "2× sys_activity_classifications CHECK constraint violation on `_scheme_check`". Goal 003 EXEC step 0 found 2 distinct violating uppercased values via `SELECT DISTINCT UPPER(...->'classification_system') FROM staging.wave1_activity_classifications GROUP BY 1 ORDER BY 2 DESC` at 2026-05-19T16:40Z: ATECO=2210 rows, NACE=1066 rows, NULL=8 rows.
- **Decision**: Cowork-approved supervisor decision A2 Path C.1 (PROMPT 003 v2 §4, locked decisions_locked D7) — relax to include base versions per demo-data realism. 8 NULL rows remain filtered by source_empty exception (C5 acceptance criterion).
- **Reversibility**: revert to 4-value whitelist (DROP + ADD with original CHECK).

### 000033_brownfield_tenant_id_mappings_and_validate_lookup_fk.sql (Goal 003 hot-fix, STRATEGIC)
- **Topic**: 2-Part migration (CP-v2-1 file structure):
  - **Part 1 (Item D, P4)**: `brownfield.tenant_id_mappings` table + 4 seed rows mapping legacy UUIDs → RTL_BANK_REFERENCE
  - **Part 2 (Item M, P7, CP2)**: `validate_lookup_fk_payload()` SQL function + INSERT trigger on `brownfield.column_mappings`
- **Schema**: brownfield
- **Creates**:
  - 1 table `brownfield.tenant_id_mappings` (legacy_id varchar PK, canonical_tenant_id uuid FK to sys_tenancies, notes, created_at)
  - 4 INSERT seed rows (all 4 distinct legacy_tenant_ids → RTL_BANK_REFERENCE via subquery resolution)
  - 1 function `brownfield.validate_lookup_fk_payload(p_target_table, p_match_on) RETURNS boolean` (STABLE, plpgsql)
  - 1 trigger function `brownfield.validate_lookup_fk_payload_trigger()`
  - 1 BEFORE INSERT trigger on `brownfield.column_mappings` WHERE `column_mapping_transform='LOOKUP_FK'`
- **Part 1 Rationale (from header)**: Goal 003 EXEC step 0.8 evidence showed `tenant_metadata` jsonb does NOT contain `legacy_id` key (0/2 tenancies), `user_metadata` jsonb does NOT contain `legacy_id` key (0/163 users) → Item A primary jsonb-convention path is DEAD-CODE in Goal 003. Active path is FALLBACK-ONLY via this table (legacy_tenant_id) + `sys_users.user_email` (legacy_user_id).
- **Part 2 Rationale (from header)**: Closes U-2026-05-19-01 cross-check at DB level — any INSERT of LOOKUP_FK column_mapping with malformed (target_table, match_on) payload now raises EXCEPTION before the row lands.
- **Validation function — 4 accepted payload forms**:
  - (a) Literal column existing on `sys.<target_table>` — e.g. `(sys_skills, skill_name)`
  - (b) Expression `<col>_metadata->>'<key>'` where `<col>_metadata` is jsonb — e.g. `(sys_learning_modules, learning_module_metadata->>'legacy_id')`
  - (c) Form `legacy_<X>_id` where `sys.<target>.<X>_metadata` is jsonb — deferred to Goal 004+ when data populates
  - (d) Goal 003 Item A scope-locked fallback pairs: `(sys_tenancies, legacy_tenant_id)`, `(sys_users, legacy_user_id)`
- **Sample code snippet** (the validation function — strategic for understanding the brownfield safety perimeter):
```sql
CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_payload(
  p_target_table varchar,
  p_match_on     varchar
) RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_entity_name  varchar;
  v_metadata_col varchar;
  v_col_exists   boolean;
BEGIN
  IF p_target_table IS NULL OR p_match_on IS NULL THEN
    RETURN false;
  END IF;
  -- Form (a): literal column existing on sys.<target_table>
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'sys'
       AND table_name   = p_target_table
       AND column_name  = p_match_on
  ) INTO v_col_exists;
  IF v_col_exists THEN RETURN true; END IF;
  -- Form (b): <col>_metadata->>'<key>' jsonb-expr
  IF p_match_on ~ '^[a-z_][a-z0-9_]*->>''[a-z_][a-z0-9_]*''$' THEN
    v_metadata_col := substring(p_match_on FROM '^([a-z_][a-z0-9_]*)->>');
    SELECT EXISTS (... data_type IN ('jsonb','json')) INTO v_col_exists;
    IF v_col_exists THEN RETURN true; END IF;
  END IF;
  -- Form (c): legacy_<X>_id with <X>_metadata jsonb
  IF p_match_on ~ '^legacy_[a-z_][a-z0-9_]*_id$' THEN
    v_entity_name := substring(p_match_on FROM '^legacy_([a-z_][a-z0-9_]*)_id$');
    SELECT EXISTS (...) INTO v_col_exists;
    IF v_col_exists THEN RETURN true; END IF;
  END IF;
  -- Form (d): scope-locked Goal 003 fallback
  IF (p_target_table = 'sys_tenancies' AND p_match_on = 'legacy_tenant_id')
     OR (p_target_table = 'sys_users' AND p_match_on = 'legacy_user_id') THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;
```
- **Seed legacy IDs** (4 hardcoded UUIDs):
  - `0c54b84a-db6e-4da4-bc91-af5d480d524e`
  - `1d7bf448-ceac-4215-917d-45ff13678104`
  - `d5855519-3ed1-4427-865f-fe75f1e42c4c`
  - `fb1e866c-e90a-4e25-a146-f68d660a0be8`
- **Notes on Goal 004 forward-looking**: header documents that Goal 004 Wave 2 will UPDATE these mappings to per-tenant canonical IDs as SmartFood/EcoNova/Heuresys System tenancies are created.

---

## §3 — Schema evolution timeline

**Phase 1 — Bootstrap (000001-000002)**: extensions + 4 schemas + shared trigger fn + migrations audit table.

**Phase 2 — Multi-tenant + auth perimeter (000003-000006)**: tenancies → users → 11 auth tables → user profiles + 5 evidence tables (with deliberately late-bound FKs).

**Phase 3 — Reference data (000007-000010)**: enterprise typing (ATECO/NACE) → blueprint catalog → organization model → job role taxonomy. Builds the conceptual layer before HRMS spine.

**Phase 4 — HRMS spine (000011-000019)**: positions (with PIP VIEW) → user × position assignments → skill taxonomy (closes FKs to evidence + PSR) → PSR history → KPI cascade (closes FK to user_kpi_evidence + position_kpi_requirements) → learning + gap closure (closes FK to user_learning_evidence + position_learning_requirements) → assessment + scores → career + succession (closes FK to position_career_paths) → compensation + reward gates (closes FK to position_compensation_profiles).

**Phase 5 — Operational support (000020-000023)**: AI seed acquisition pipeline → seed reference bank (RTL_BANK_REFERENCE) → visualization graph model (ADR-0009) → 10 validation views (with 1 placeholder for 000027 inbox).

**Phase 6 — Brownfield + ESS (000024-000027)**: brownfield staging tables → table/column mappings + canonical lineage → import validation + approval (audit) → ESS inbox + self-service audit (replaces validation view placeholder).

**Phase 7 — MVP-2a permission seed (000028)**: dashboard:view perm + 6 role grants.

**Phase 8 — Brownfield wave 1 readiness (000029-000030)**: wave column + backfill on table_mappings → 17 uniform staging.wave1_* buffer tables (jsonb pattern, DO $$ loop).

**Phase 9 — Goal 002/003 hot-fixes (000031-000033)** (see §5 deep dive).

**Cumulative observation**: ALL canonical business data tables live in `sys.*` (Invariant I3/I4 enforced architecturally). Auxiliary schemas `audit` and `brownfield` only host operational metadata; `staging` only hosts Wave 1 jsonb buffers. The canonical lineage table `sys.sys_source_lineage_records` IS in `sys` (Invariant I12 — lineage is canonical).

---

## §4 — Dependency graph

### Hard dependencies (FK at table-creation time)
- **000003 → 000002** (sys schema)
- **000004 → 000003** (FK to sys_tenancies)
- **000005 → 000004** (FK to sys_users) + 000003 (FK to sys_tenancies)
- **000006 → 000005** (uses sys_users for created_by/updated_by) — but several FK to skills/learning/kpi/assessment are LATE-BOUND
- **000007 → 000003, 000005**
- **000008 → 000003, 000005, 000007** (FK to size_band on variant)
- **000009 → 000003, 000005**
- **000010 → 000005** (only created_by/updated_by; no business FK)
- **000011 → 000003, 000005, 000009, 000010** (FK to tenant, org_unit, job_role, owner_user; self-FK reports_to) — PIP base tables also created here with placeholder uuid columns
- **000012 → 000003, 000005, 000011**
- **000013 → 000003, 000005** + **late-binds** FK to 000006 (`sys_user_skill_evidence.skill_id`) and 000011 (`sys_position_skill_requirements.skill_id`)
- **000014 → 000011, 000013**
- **000015 → 000003, 000005, 000008** (FK to blueprint_process) + **late-binds** FK to 000006 (user_kpi_evidence) and 000011 (position_kpi_requirements)
- **000016 → 000003, 000005, 000011, 000013** + **late-binds** FK to 000006 (user_learning_evidence) and 000011 (position_learning_requirements)
- **000017 → 000003, 000005, 000011** + **late-binds** FK to 000006 (user_assessment_evidence)
- **000018 → 000003, 000005, 000011** + **late-binds** FK to 000011 (position_career_paths)
- **000019 → 000003, 000005, 000008, 000009, 000011** + **late-binds** FK to 000011 (position_compensation_profiles)
- **000020 → 000003, 000005**
- **000021 → 000003, 000007 (size_bands), 000008 (families/variants), 000015 (assessment_methods, weighting_rules), 000017 (assessment_methods), 000009 (org_unit_types), 000019 (reward_gate_catalog)**. THE BIG SEED — depends on most reference catalogs.
- **000022 → 000003, 000005**
- **000023 → ALL prior tables** (validation views reference 9 sys tables + 1 placeholder for 000027)
- **000024 → 000005** (FK to sys_users for initiated_by)
- **000025 → 000003 (sys.sys_source_lineage_records), 000024 (brownfield.source_tables/import_runs)** 
- **000026 → 000024**
- **000027 → 000003, 000005, 000011, 000016, 000017, 000018, 000015, 000013** (replaces v_inbox_resource_consistency body referencing all of these)
- **000028 → 000005 (sys_auth_roles), seeds**
- **000029 → 000025 (brownfield.table_mappings), 000024 (source_tables.source_table_domain)**
- **000030 → 000024 (brownfield.import_runs FK)**
- **000031 → 000006 (sys_user_certifications)**
- **000032 → 000007 (sys_activity_classifications)**
- **000033 → 000003 (sys.sys_tenancies for canonical_tenant_id FK), 000025 (brownfield.column_mappings for the INSERT trigger)**

### Late-binding FK pattern (deliberate pattern — strategic)
The repo uses a "late-binding FK" idiom: a table is created with a plain `uuid` column at migration N, then the FK constraint is added at migration M (M > N) via guarded `DO $fk$ BEGIN IF NOT EXISTS ... ADD CONSTRAINT`. This pattern is used:
- 4 times for `sys_user_*_evidence` tables (000006 → 000013/000015/000016/000017)
- 5 times for `sys_position_*_requirements`/`*_profiles`/`*_paths` (000011 → 000013/000015/000016/000018/000019)
- Total: **9 late-bound FKs** documented inline in headers.

Reason (per 000006 + 000011 headers): keeps DDL ordering clean (catalogs created before consumers) without forcing a topological re-shuffle.

---

## §5 — Goal 002/003 hot-fixes deep dive (000031-000033)

These 3 migrations are the only ones authored AFTER the initial bootstrap wave (000001-000030 applied on 2026-05-18 per HANDOFF.md). They were authored under the Cowork↔CLI exchange protocol (cowork_code_exchange/Goal 002 + Goal 003) on 2026-05-19.

### 000031 — Goal 002: Enable brownfield upsert for `sys_user_certifications`
- **Trigger**: Goal 001a REPORT §7 item 3 — wave-1 executor was skipping ALL column_mappings targeting `sys.sys_user_certifications` because the engine's `loadTargetMeta()` query against `pg_index` returned 0 inferred conflict targets (only the uuid PK existed; no natural key).
- **Decision chain**: Goal 001a REVIEW §3.3 enumerated 3 paths (silent ON CONFLICT, explicit error, add UQ). Goal 002 chose option (c) — add UQ — but path (b) remains active for OTHER tables still lacking a UQ.
- **What it ships**: 1 `CREATE UNIQUE INDEX IF NOT EXISTS` on 5-tuple natural key with sentinel-date COALESCE.
- **What it does NOT do**: doesn't apply to ANY other certificate-like table (no scan for similar pattern). Surgical fix only.

### 000032 — Goal 003 Item C: Relax ATECO/NACE scheme CHECK
- **Trigger**: Goal 002 REPORT §3.5 documented "2× sys_activity_classifications CHECK constraint violation on _scheme_check" — meaning the wave-1 import of ATECO data was failing.
- **Investigation (EXEC step 0)**: `SELECT DISTINCT UPPER(staging_raw_record->>'classification_system') ... FROM staging.wave1_activity_classifications` revealed (2026-05-19T16:40Z): `ATECO`=2210 rows, `NACE`=1066 rows, NULL=8 rows.
- **Decision (D7 in APPROVAL 003)**: A2 Path C.1 — relax to include base versions per demo-data realism. NULL rows remain filtered out via source_empty exception (C5).
- **What it ships**: DROP + re-ADD `_scheme_check` with 6 values instead of 4.
- **What it does NOT do**: doesn't add ATECO/NACE entries to the catalog itself (those come from the wave-1 import after this relaxation lifts the gate).

### 000033 — Goal 003 Items D + M: tenant mapping table + LOOKUP_FK validation
The most architecturally interesting of the 3 hot-fixes. Ships in 2 parts under CP-v2-1 file structure (counter-proposal accepted in APPROVAL 003).

**Part 1 — `brownfield.tenant_id_mappings`** (Item D):
- Trigger: Goal 003 EXEC step 0.8 evidence — `tenant_metadata` jsonb does NOT contain `legacy_id` key (0/2 tenancies), `user_metadata` jsonb does NOT contain `legacy_id` key (0/163 users) → Item A primary jsonb-convention path is **DEAD-CODE** in Goal 003.
- Pivot: Active path becomes FALLBACK-ONLY via this dedicated mapping table (`legacy_tenant_id`) + `sys_users.user_email` lookup (`legacy_user_id`).
- Seeds: 4 hardcoded legacy UUIDs all pointing to `RTL_BANK_REFERENCE` (resolved at INSERT via subquery, NOT hardcoded UUID).
- Forward design: Goal 004 Wave 2 will UPDATE these mappings to per-tenant canonical IDs as SmartFood/EcoNova/Heuresys System tenancies are created.

**Part 2 — `validate_lookup_fk_payload()` function + INSERT trigger** (Item M, CP2):
- Trigger: Closes cross-check U-2026-05-19-01 at DB level — any INSERT of LOOKUP_FK `column_mapping` with malformed (target_table, match_on) payload now raises EXCEPTION before the row lands.
- Function (STABLE, plpgsql) accepts 4 forms:
  - (a) Literal column on sys.<target>
  - (b) `<col>_metadata->>'<key>'` jsonb-expression
  - (c) `legacy_<X>_id` w/ `sys.<target>.<X>_metadata` jsonb (deferred primary path)
  - (d) Scope-locked Goal 003 fallback pairs: `(sys_tenancies, legacy_tenant_id)`, `(sys_users, legacy_user_id)`
- Trigger: BEFORE INSERT WHEN `column_mapping_transform='LOOKUP_FK'` → calls function → raises EXCEPTION with detailed MESSAGE + HINT + ERRCODE='check_violation' on false.
- Reversibility documented: DROP TRIGGER → DROP function (× 2).

### Observation on hot-fix pattern
All 3 hot-fixes share a recognizable signature:
- Header lengthy (~30-70 lines) with full Background/Rationale/Decision/Reversibility blocks
- Goal/PROMPT/APPROVAL cross-references (D7, A2 Path C.1, CP2)
- Investigation-driven (cited DISTINCT queries, count-of-rows evidence)
- Surgical scope — no opportunistic ADDs unrelated to the trigger issue
- Idempotency + reversibility documented explicitly per migration
- Trailing verification SQL comments (commented out for manual run by operator)

This contrasts with bootstrap migrations 000001-000030 which have terser headers (~3-15 lines, mostly topic/schema/invariant references).

---

## §6 — Idempotency assessment

All 33 migrations verified idempotent by file-level scan. Patterns observed:

| Pattern | Used by |
|---|---|
| `CREATE EXTENSION IF NOT EXISTS` | 000001 |
| `CREATE SCHEMA IF NOT EXISTS` | 000002, 000030 |
| `CREATE TABLE IF NOT EXISTS` | ALL DDL migrations |
| `CREATE OR REPLACE FUNCTION` | 000002, 000033 |
| `CREATE OR REPLACE VIEW` | 000011 (PIP), 000023 (10 views incl. placeholder), 000027 (replacement) |
| `CREATE [UNIQUE] INDEX IF NOT EXISTS` | ALL migrations adding indexes |
| `ALTER TABLE DROP CONSTRAINT IF EXISTS + ADD` (idempotent CHECK pattern) | ALL migrations adding CHECK constraints |
| Guarded `DO $trg$ BEGIN IF NOT EXISTS ... CREATE TRIGGER` | ALL migrations adding triggers |
| Guarded `DO $fk$ BEGIN IF NOT EXISTS ... ADD CONSTRAINT` (late-binding FK) | 000013, 000015, 000016, 000017, 000018, 000019 |
| `INSERT ... ON CONFLICT (...) DO NOTHING` | 000005, 000013 (proficiency_levels), 000021 (all 9 INSERTs), 000028, 000033 |
| `UPDATE ... WHERE wave IS NULL` (filter prevents re-override) | 000029 |
| `DO $alter$` (conditional NOT NULL only if column was nullable AND table empty) | 000019 (sys_reward_gate_catalog upgrade path) |
| `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` | 000033 |

**Strict idempotency verification claim**: per HANDOFF.md (priming context "running the full set twice produces an empty `pg_dump` diff (proven and recorded)"), this is asserted invariant — file-level review found no exception to it. The most likely candidate for non-idempotency would have been 000019's NOT NULL upgrade, but the guarded DO $alter$ block explicitly checks `is_nullable = 'YES'` before acting, making re-runs no-op.

**One observation worth flagging** (NOT a bug, but a subtlety): 000023 + 000027 use `CREATE OR REPLACE VIEW` for `sys.v_inbox_resource_consistency`. The placeholder in 000023 uses `NULL::uuid AS notification_id, NULL::varchar(64) AS notification_resource_type, NULL::uuid AS notification_resource_id` — column types match the final 000027 body exactly. This is deliberate (header comment: "Column types match the final body so CREATE OR REPLACE works on re-run") — otherwise re-running 000023 after 000027 would attempt to REPLACE the real view with the placeholder and PostgreSQL's `CREATE OR REPLACE VIEW` requires exact column-type match.

---

## §7 — Implications for SDBI strategic options

### Core/protected migrations (NEVER touch / require ADR + new migration)

These define schema invariants enforced architecturally:
- **000001-000005**: extensions + schemas + tenant + user + auth foundation. Any change is platform-breaking.
- **000007-000019**: the canonical HRMS spine. CHECK constraints embed business taxonomy (criticality bands, severities, statuses, kinds). Loosening them requires ADR.
- **000022**: visualization graph model (ADR-0009/I10 — semantic ≠ layout separation).
- **000023**: 10 validation views = the structural correctness contract (validator runs them at every CI). Modifying these requires re-thinking what "healthy" means.

### Extension/customizable migrations (can be added without breaking invariants)

- **000028-pattern**: new permission + role grant seeds (precedent: dashboard:view). Net-additive, idempotent, no schema change. Adding more `:<resource>:<action>` perms follows this exact template.
- **000031-pattern**: surgical UQ additions to enable brownfield upserts on tables currently lacking natural keys. Per Goal 001a REVIEW the option (c) precedent is opt-in per table.
- **000032-pattern**: CHECK constraint relaxation to accept legacy data realism (when documented via Cowork supervisor decision + reversibility).
- **000033-pattern**: brownfield safety perimeter expansion (validate_lookup_fk_payload extension). Adding new payload forms (e.g., new "form (e)") requires a new migration that does `CREATE OR REPLACE FUNCTION` with extended body — safe because function is STABLE and trigger is BEFORE INSERT.

### Strategic observations

1. **Late-binding FK idiom is load-bearing**. The pattern keeps the migration ordering linear (catalogs before consumers) AND allows evidence tables in 000006 to be defined together. A future restructuring that moves evidence tables AFTER skills/learning/kpi/assessment catalogs would be ADR-worthy but would eliminate the late-bound FKs (cleaner but reorders 6 migrations).

2. **PIP as VIEW (000011 line 272) is non-negotiable per Invariant I9 + ADR-0008**. If profiling shows the JSONB-agg subqueries are too slow, the header notes "can be promoted to MATERIALIZED VIEW in a follow-up migration" — `CREATE MATERIALIZED VIEW sys.sys_position_intelligence_profiles_v_mat` + `REFRESH` schedule. Do NOT replace with a JSONB blob column on `sys_positions`.

3. **000021 seeds are the foundation tenant** (RTL_BANK_REFERENCE). All `seed-reference-bank.ts` user/position/assignment population (158+25+30 records, seed=42) depends on these references. Changing the variant code or family code in 000021 would orphan everything downstream.

4. **000030's 17 staging tables are the wave-1 contract**. Adding a wave-1 target = adding a row to the `wave1_targets` array (inside the DO $$ block). The pattern is uniform jsonb-buffer, NOT per-target column mirroring — the wave executor reads `brownfield.column_mappings` for transformation config. To extend Wave 2 a new migration `000034_brownfield_wave2_staging.sql` should mirror the structure.

5. **Hot-fix migrations 000031-000033 establish precedent** for how brownfield-discovered issues are addressed: investigation evidence in header + decision linked to Cowork APPROVAL + idempotent + reversible + scope-locked. This is the template for future hot-fixes.

6. **Goal 004 Wave 2 forward signals** present in 000033 header explicitly: "Wave 2 (Goal 004) reconciles per-tenant as SmartFood/EcoNova/Heuresys System tenancies are created" — these 3 new tenancies will require:
   - A new seed migration (sibling of 000021, e.g. `000034_seed_secondary_tenants.sql`) creating tenant rows
   - UPDATE to `brownfield.tenant_id_mappings` row notes/canonical_tenant_id where appropriate
   - Possibly a new Wave 2 staging-buffer migration if the wave 1 targets are insufficient

7. **No migration exists for `legacy_mirror` schema** — confirmed by file enumeration. Per context, that schema is populated out-of-band via pg_dump from the legacy `heuresys_platform` (per CLAUDE.md `D:\heuresys-advanced` reference). It is NOT under migration control here. The brownfield pipeline (000024-000026, 000029-000030, 000033) reads FROM legacy_mirror but never DDLs it.

---

**End of forensic analysis 000001..000033 — 33/33 files enumerated, no inference, evidence cited line-numbers when relevant. No anomalies that prevent runtime; one subtlety flagged on 000023↔000027 view-type compatibility (verified intentional via header comments).**
