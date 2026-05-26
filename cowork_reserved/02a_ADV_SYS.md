# Forensic Inventory — `heuresys_advanced.sys` (TARGET schema)

**Snapshot**: 2026-05-20T02:15Z
**Scope**: 118 tables + 11 views in `sys.*` schema (TARGET principale del rewrite)

---

## §1 — Overview

| Metric | Value |
|---|---|
| Tables | 118 |
| Views | 11 |
| Populated tables (rows≥1) | 38 |
| Empty tables (rows=0) | 80 |
| FK constraints intra-`sys.*` | **319** (calcolato da pg_constraint) |
| Top FK target | `sys.sys_users` (130 referrers) |
| Second FK target | `sys.sys_tenancies` (74 referrers) — tenant boundary enforcement |
| Third FK target | `sys.sys_positions` (29 referrers) |

**Provenienza**: 100% via migrations 000001-000033 (db/migrations/) — il TARGET è interamente schema-defined-by-migration, **nessuna parte out-of-band**.

---

## §2 — Tabelle popolate (38) — sorted by row count desc

| # | Table | Rows | Source provenance |
|---|---|---|---|
| 1 | `sys_skills` | **6037** | Wave 1 retry (Goal 002+003) da legacy_mirror.skill_classifications/skill_clusters + brownfield UPSERT |
| 2 | `sys_auth_refresh_tokens` | 5436 | Runtime auth (test logins accumulated) |
| 3 | `sys_learning_modules` | **4488** | Wave 1 retry da legacy_mirror.course_modules + courses |
| 4 | `sys_source_lineage_records` | **4099** | Generated during Wave 1 retry (1:1 con upsert) |
| 5 | `sys_activity_classifications` | **3276** | Wave 1 retry Item C (Goal 003 mig 000032 CHECK relax) da legacy_mirror.industry_classifications |
| 6 | `sys_learning_paths` | **3227** | Wave 1 retry — **mismatch** vs source learning_paths 20 → investigare in F10 |
| 7 | `sys_auth_login_events` | 2666 | Runtime auth event log |
| 8 | `sys_auth_role_permissions` | **394** | Migration 000028 dashboard_permission_seed |
| 9 | `sys_users` | **163** | Mix: 5 test admins via `seed-test-admin.ts` + 158 da Wave 1 retry (sys_users target wave1) |
| 10 | `sys_user_position_assignments` | 161 | Wave 1 retry (1:1 con sys_positions) |
| 11 | `sys_positions` | 161 | Wave 1 retry da legacy_mirror.job_templates + onet_occupations (presumibilmente) |
| 12 | `sys_auth_permissions` | 99 | Migration seed |
| 13 | `sys_auth_password_reset_tokens` | 81 | Runtime |
| 14 | `sys_skill_families` | **77** | Wave 1 retry — corrisponde 1:1 con legacy_mirror tables source-side |
| 15 | `sys_compensation_bands` | **75** | Wave 1 retry — verificare source provenance |
| 16 | `sys_schema_migrations` | 33 | Migration runner |
| 17 | `sys_blueprint_process_registry` | **23** | Wave 1 retry (parziale — staging aveva 63, gap 40) |
| 18 | `sys_organization_unit_types` | 8 | Migration seed reference |
| 19 | `sys_auth_roles` | 8 | Migration seed (8 roles canonical) |
| 20 | `sys_reward_gate_catalog` | 7 | Migration 000021 seed_reference_bank |
| 21 | `sys_skill_proficiency_levels` | 6 | Migration seed |
| 22 | `sys_organization_units` | 6 | Migration seed RTL_BANK |
| 23 | `sys_operating_model_catalog` | 6 | Migration 000021 seed_reference_bank |
| 24 | `sys_user_auth_roles` | 5 | `seed-test-admin.ts` (5 test users role assignment) |
| 25 | `sys_kpi_assessment_methods` | 5 | Migration seed reference |
| 26 | `sys_branches` | 5 | Migration seed RTL_BANK |
| 27 | `sys_auth_identities` | 5 | `seed-test-admin.ts` (5 test users) |
| 28 | `sys_auth_credentials` | 5 | `seed-test-admin.ts` |
| 29 | `sys_assessment_methods` | 5 | Migration seed reference |
| 30 | `sys_enterprise_size_bands` | 4 | Migration 000021 seed |
| 31 | `sys_kpi_weighting_rules` | 3 | Migration seed reference |
| 32 | `sys_tenancies` | **2** | Migration seed RTL_BANK_REFERENCE + 1 second tenant |
| 33 | `sys_assessments` | 2 | Migration seed sample |
| 34 | `sys_user_profiles` | 1 | `seed-test-admin.ts` (Heuresys admin profile) |
| 35 | `sys_user_certifications` | 1 | `seed-test-admin.ts` sample |
| 36 | `sys_training_initiatives` | 1 | Migration 000021 seed sample |
| 37 | `sys_blueprint_variants` | 1 | Migration 000021 seed (1 default variant) |
| 38 | `sys_blueprint_families` | 1 | Migration 000021 seed |

**Totale rows in sys.*: ~37k** (dominate da skills/auth/learning core).

---

## §3 — Tabelle vuote (80) — by macro-area

### §3.1 KPI universe (8 tables empty)
- `sys_kpi_definitions`
- `sys_kpi_targets`
- `sys_kpi_measurements`
- `sys_kpi_metric_definitions`
- `sys_kpi_assessment_results`
- `sys_organization_unit_kpi_templates`
- `sys_position_kpi_requirements`
- `sys_process_kpi_templates`

### §3.2 Skills detail (4 tables empty)
- `sys_skill_aliases`
- `sys_skill_categories`
- `sys_skill_taxonomy_edges`
- `sys_skill_learning_mappings`

### §3.3 Learning detail (4 tables empty)
- `sys_learning_path_steps`
- `sys_learning_gaps`
- `sys_user_learning_assignments`
- `sys_user_learning_evidence`

### §3.4 Job & career (8 tables empty)
- `sys_job_families`
- `sys_job_roles`
- `sys_esco_occupation_mappings`
- `sys_career_paths`
- `sys_career_path_steps`
- `sys_user_career_plans`
- `sys_user_target_positions`
- `sys_position_career_paths`

### §3.5 Position detail (8 tables empty)
- `sys_position_skill_requirements`
- `sys_position_skill_requirement_history`
- `sys_position_learning_requirements`
- `sys_position_compensation_profiles`
- `sys_position_economic_weight`
- `sys_position_succession_relevance`
- `sys_employee_position_fit_scores`
- `sys_critical_positions`

### §3.6 Assessment & evidence (6 tables empty)
- `sys_assessment_results`
- `sys_behavioral_assessments`
- `sys_user_assessment_evidence`
- `sys_user_skill_evidence`
- `sys_user_kpi_evidence`
- `sys_person_evidence_records`

### §3.7 Gap & readiness (5 tables empty)
- `sys_gap_analysis_results`
- `sys_gap_closure_actions`
- `sys_gap_closure_plans`
- `sys_readiness_scores`
- `sys_critical_role_coverage_status`

### §3.8 Succession & talent (6 tables empty)
- `sys_succession_pools`
- `sys_succession_scores`
- `sys_successor_candidates`
- `sys_successor_readiness`
- `sys_talent_scores`
- `sys_enterprise_typing_profiles`

### §3.9 Compensation extension (8 tables empty)
- `sys_compensation_recommendations`
- `sys_bonus_pools`
- `sys_payout_curves`
- `sys_variable_pay_calculations`
- `sys_objective_reward_rules`
- `sys_payroll_handoff_records`
- `sys_reward_gates`
- `sys_reward_gate_results`

### §3.10 Organization extension (2 tables empty)
- `sys_organization_hierarchies`
- `sys_organization_unit_history`

### §3.11 Blueprint detail (2 tables empty)
- `sys_blueprint_activations`
- `sys_blueprint_overrides`

### §3.12 Auth misc (2 tables empty — runtime state)
- `sys_auth_mfa_factors`
- `sys_auth_sessions`

### §3.13 User documents/education/experiences (3 tables empty)
- `sys_user_documents`
- `sys_user_education_records`
- `sys_user_professional_experiences`

### §3.14 Visualization (7 tables empty)
- `sys_visualization_edges`
- `sys_visualization_exports`
- `sys_visualization_graphs`
- `sys_visualization_layouts`
- `sys_visualization_nodes`
- `sys_visualization_node_layouts`
- `sys_visualization_styles`

### §3.15 Seed acquisition system (5 tables empty)
- `sys_seed_acquisition_runs`
- `sys_seed_approval_decisions`
- `sys_seed_candidate_records`
- `sys_seed_source_evidence`
- `sys_seed_validation_results`

### §3.16 Misc (2 tables empty)
- `sys_inbox_notifications`
- `sys_activity_classification_mappings`

---

## §4 — Views in `sys.*` (11)

| View | Type | Purpose probabile |
|---|---|---|
| `sys_position_intelligence_profiles_v` | regular view | PIP (Position Intelligence Profile) per I9 ADR-0008 invariant |
| `v_active_primary_assignment_per_user` | validation view | Constraint check user→position |
| `v_canonical_outside_sys` | validation view | Verifica nessun riferimento out-of-sys schema |
| `v_inbox_resource_consistency` | validation view | ESS inbox FK consistency |
| `v_orphan_position_assignments` | validation view | Position senza user assignment |
| `v_pip_completeness` | validation view | PIP completeness check |
| `v_positions_without_job_role` | validation view | Position senza job_role (gap) |
| `v_reward_gate_completeness` | validation view | Reward gate completeness |
| `v_synthetic_user_flag_consistency` | validation view | Synthetic user flag check |
| `v_tenant_boundary_violations` | **CRITICAL** validation view | Cross-tenant data leak check (I5 RD invariant) |
| `v_visualization_node_in_canonical_node` | validation view | Visualization graph node consistency |

**Note importante**: 11 views sono **validation/integrity views** (introdotte da migration 000023). Servono per detection RLS/boundary violations + structural integrity. Nessuna è una "dashboard view" (quelle stanno in heuresys_platform).

---

## §5 — FK graph synthesis (319 FK constraints)

### §5.1 Top FK targets (verso quale tabella convergono più FK)

| Target | Referrers | Significato |
|---|---|---|
| `sys.sys_users` | **130** | Centralità users — quasi ogni table referenza un user (created_by, assignee, etc.) |
| `sys.sys_tenancies` | **74** | **Tenant boundary enforcement** (I5 invariant: ogni tenant-scoped table has tenant_id FK) |
| `sys.sys_positions` | 29 | Position-centric model (I1 invariant) |
| `sys.sys_skills` | 8 | Skill-centric references |
| `sys.sys_organization_units` | 8 | Org structure references |
| `sys.sys_kpi_definitions` | 8 | KPI hub (anche se vuoto, schema designed) |
| `sys.sys_visualization_graphs` | 5 | Visualization sub-system |
| `sys.sys_learning_modules` | 5 | Learning references |
| `sys.sys_seed_candidate_records` | 3 | Seed acquisition system |
| `sys.sys_learning_paths` | 3 | Learning paths |
| `sys.sys_career_paths` | 3 | Career paths |
| `sys.sys_blueprint_variants` | 3 | Blueprint variants (already 1 row) |
| `sys.sys_activity_classifications` | 3 | Activity classifications |
| ... | ... | tail dei target meno frequenti |

### §5.2 Top FK source tables (con più FK uscenti)

| Source | FK outgoing | Note |
|---|---|---|
| `sys_positions` | 7 | Hub centrale: ref users, org_units, tenancies, blueprint_variants, etc. |
| `sys_user_target_positions` | 6 | Junction position-user with multiple refs |
| `sys_user_skill_evidence` | 6 | User+skill+tenant+assessor+evidence chain |
| `sys_user_learning_assignments` | 6 | User+learning+tenant chain |
| `sys_user_career_plans` | 6 | Career planning chain |
| `sys_user_assessment_evidence` | 6 | Assessment evidence chain |
| `sys_organization_units` | 6 | Org hierarchy + tenant + types |
| `sys_kpi_targets` | 6 | KPI assignment chain |
| `sys_gap_closure_plans` | 6 | Gap closure with assignee+approval chain |
| `sys_enterprise_typing_profiles` | 6 | Enterprise profiling references |

**Pattern**: tabelle con 5-7 FK sono "junction tables" (collegano N entità). Typical HR domain shape.

### §5.3 Tenant isolation enforcement check

74 FK verso `sys.sys_tenancies` confermano **I5 invariant** (Tenant isolation = FK + API middleware filter, NEVER RLS). Ogni tenant-scoped table ha esplicito `*_tenant_id` FK.

---

## §6 — Implicazione SDBI

### §6.1 Sys.* è SCHEMA-COMPLETE per il rewrite design

Il target ha schema **ricco e completo** per le aree definite. Mancano solo i dati. 38 popolate / 118 vuote NON è un problema di "schema mancante" — è un problema di **import incompleto**.

### §6.2 Macro-aree dove sys.* esiste ma NON è popolato (sub-set tipico SDBI scope)

Le 80 sys.* vuote rappresentano i target naturali SDBI. Le source candidate sono in `heuresys_platform.public` (vedi `01_DB_PLATFORM_INVENTORY.md` §6.1) o già in `legacy_mirror.*` (vedi `02b_ADV_LEGACY_MIRROR.md`).

### §6.3 Macro-aree con dati in platform MA target sys.* assente

Goals/OKRs/Recruiting/Onboarding/Surveys/Time-Leave/News/Mentorship/Predictions/Feedback/CCNL/SAP-HR-infotypes — NON ci sono target sys.* dedicati. Decision SDBI: ESTENDE schema (nuove migrations 000034+) o SKIP queste aree?

### §6.4 Views validation (11) sono asset preziosi

Le 11 views in sys.* sono **validation infrastructure** — utili per:
- Pre-SDBI sanity check (verificare integrità prima di seed)
- Post-SDBI verification (verificare 0 boundary violations dopo seed)
- Goal 004+ continuous monitoring

---

## §7 — Verification anchors

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='sys' AND table_type='BASE TABLE';  -- 118
SELECT COUNT(*) FROM information_schema.views WHERE table_schema='sys';  -- 11
SELECT COUNT(*) FROM pg_constraint c JOIN pg_class cl ON c.conrelid=cl.oid JOIN pg_namespace n ON cl.relnamespace=n.oid WHERE n.nspname='sys' AND c.contype='f';  -- 319+
SELECT COUNT(*) FROM sys.sys_skills;          -- 6037
SELECT COUNT(*) FROM sys.sys_learning_modules; -- 4488
SELECT COUNT(*) FROM sys.sys_source_lineage_records; -- 4099
SELECT COUNT(*) FROM sys.sys_users;            -- 163
SELECT COUNT(*) FROM sys.sys_tenancies;        -- 2
SELECT COUNT(*) FROM sys.sys_schema_migrations; -- 33
```

---

*End of 02a_ADV_SYS.md*
