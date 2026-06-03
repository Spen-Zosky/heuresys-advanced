# F0 Reconciliation Triage — verified A/B/C/D classification of 65 empty `sys.*` tables

> Generated from the F0 workflow (run `wf_10873576-5a0`, S960, 2026-06-03): 11 domain agents + an adversarial verifier each, cross-querying advanced `:5433` + legacy `heuresys_platform` (588 base tables) + brownfield registry. **READ-ONLY** — zero DB writes. Employee-centric doctrine (I14/ADR-0024) enforced in every agent.
> **This report is the sign-off gate before F1.** Spec: `docs/superpowers/specs/2026-06-03-reconciliation-closure-design.md`. Plan: `docs/superpowers/plans/2026-06-03-reconciliation-f0-triage.md`.

## Summary

| Bucket | Meaning | Count | This cycle |
|---|---|---|---|
| A | Import now (source 1:1, FK closure complete) | 4 | F2 import |
| B | Structural wall (source exists, a FK needs modeling) | 18 | F3 walls |
| C | Needs-decision (derived analytics) | 23 | F4 dossier — **STOP** |
| D | No-source / app-generated | 20 | F1 EXCLUDE/NO_SOURCE |
| **Total** | | **65** | |

## Closure assertions

- buckets sum to 65: **PASS**
- every A/B has a legacy_source with rows>0: **PASS**
- every B has a named wall: **PASS**
- C/D rows carrying a legacy_source (manual review): sys_auth_sessions → session
- low-confidence rows flagged for you: 18 — sys_gap_analysis_results (medium), sys_career_path_steps (medium), sys_position_career_paths (medium), sys_position_learning_requirements (medium), sys_position_economic_weight (medium), sys_user_target_positions (medium), sys_kpi_measurements (medium), sys_kpi_metric_definitions (medium), sys_user_kpi_evidence (medium), sys_behavioral_assessments (medium), sys_enterprise_typing_profiles (medium), sys_learning_gaps (medium), sys_critical_role_coverage_status (medium), sys_readiness_scores (medium), sys_succession_scores (medium), sys_successor_readiness (medium), sys_talent_scores (medium), sys_activity_classification_mappings (medium)
- failed domains (none expected): none

## Bucket B — structural walls breakdown

| Wall | Tables |
|---|---|
| job_to_position_bridge | sys_career_path_steps, sys_position_career_paths, sys_position_kpi_requirements, sys_position_learning_requirements, sys_position_skill_requirements, sys_critical_positions, sys_position_succession_relevance, sys_succession_pools, sys_successor_candidates (9) |
| learning_catalog_reimport | sys_learning_path_steps, sys_skill_learning_mappings, sys_user_learning_assignments, sys_user_learning_evidence (4) |
| org_unit_template_vs_instance | sys_organization_unit_kpi_templates (1) |
| other | sys_bonus_pools, sys_process_kpi_templates, sys_branches, sys_inbox_notifications (4) |

## All 65 (compact)

| Table | Dom | Bkt | Legacy source | Rows | Wall | Conf |
|---|---|---|---|---|---|---|
| sys_career_paths | career_position | A | career_paths | 32 | — | high |
| sys_user_career_plans | career_position | A | employee_career_paths | 128 | — | high |
| sys_gap_analysis_results | gap | A | public.skill_gap_analyses | 304 | — | medium |
| sys_user_documents | runtime_app | A | employee_documents | 1089 | — | high |
| sys_career_path_steps | career_position | B | career_path_levels | 75 | job_to_position_bridge | medium |
| sys_position_career_paths | career_position | B | career_path_levels | 75 | job_to_position_bridge | medium |
| sys_bonus_pools | comp | B | public.bonus_plans | 14 | other:tenant_id Wave-2 reconciliation — 8/14 source rows (SmartFood=5, EcoNova=3) have legacy tenant_id with NO crosswalk in brownfield.tenant_id_mappings | high |
| sys_organization_unit_kpi_templates | kpi | B | org_unit_kpis | 100 | org_unit_template_vs_instance | high |
| sys_position_kpi_requirements | kpi | B | tenant_job_kpis | 80 | job_to_position_bridge | high |
| sys_process_kpi_templates | kpi | B | process_kpis | 81 | other:legacy business_processes keyspace (BP-001..BP-SF-007) does not map to blueprint_process_registry ordinals (00..22) | high |
| sys_branches | org | B | public.locations | 34 | other:location_to_org_unit_bridge | high |
| sys_inbox_notifications | runtime_app | B | notifications | 238 | other: notification_type + resource_type CHECK-enum remap — legacy free-form type varchar not 1:1, and legacy has NO resource_type/resource_id columns to fill the constrained target columns | high |
| sys_learning_path_steps | skills_learning | B | learning_path_courses | 124 | learning_catalog_reimport | high |
| sys_position_learning_requirements | skills_learning | B | job_title_courses | 207 | job_to_position_bridge | medium |
| sys_position_skill_requirements | skills_learning | B | position_skill_requirements | 1632 | job_to_position_bridge | high |
| sys_skill_learning_mappings | skills_learning | B | course_esco_skills | 717 | learning_catalog_reimport | high |
| sys_user_learning_assignments | skills_learning | B | course_enrollments | 3052 | learning_catalog_reimport | high |
| sys_user_learning_evidence | skills_learning | B | course_enrollments | 3052 | learning_catalog_reimport | high |
| sys_critical_positions | succession_talent | B | public.critical_roles (16) + public.succession_plans (31) | 16 | job_to_position_bridge | high |
| sys_position_succession_relevance | succession_talent | B | public.critical_roles (16) + public.succession_plans (31) | 16 | job_to_position_bridge | high |
| sys_succession_pools | succession_talent | B | public.talent_pools (primary, 24) + public.succession_plans (31) / public.critical_roles (16) | 24 | job_to_position_bridge | high |
| sys_successor_candidates | succession_talent | B | public.succession_candidates (206) + public.talent_pool_members (40) | 206 | job_to_position_bridge | high |
| sys_position_economic_weight | career_position | C | — | — | — | medium |
| sys_user_target_positions | career_position | C | — | — | — | medium |
| sys_compensation_recommendations | comp | C | — | — | — | high |
| sys_payout_curves | comp | C | — | — | — | high |
| sys_variable_pay_calculations | comp | C | — | — | — | high |
| sys_gap_closure_actions | gap | C | — | — | — | high |
| sys_gap_closure_plans | gap | C | — | — | — | high |
| sys_kpi_assessment_results | kpi | C | — | — | — | high |
| sys_kpi_measurements | kpi | C | — | — | — | medium |
| sys_kpi_metric_definitions | kpi | C | — | — | — | medium |
| sys_user_kpi_evidence | kpi | C | — | — | — | medium |
| sys_objective_reward_rules | reward_blueprint | C | — | — | — | high |
| sys_reward_gate_results | reward_blueprint | C | — | — | — | high |
| sys_behavioral_assessments | sdbi_misc | C | — | — | — | medium |
| sys_enterprise_typing_profiles | sdbi_misc | C | — | — | — | medium |
| sys_person_evidence_records | sdbi_misc | C | — | — | — | high |
| sys_learning_gaps | skills_learning | C | — | — | — | medium |
| sys_critical_role_coverage_status | succession_talent | C | — | — | — | medium |
| sys_employee_position_fit_scores | succession_talent | C | — | — | — | high |
| sys_readiness_scores | succession_talent | C | — | — | — | medium |
| sys_succession_scores | succession_talent | C | — | — | — | medium |
| sys_successor_readiness | succession_talent | C | — | — | — | medium |
| sys_talent_scores | succession_talent | C | — | — | — | medium |
| sys_organization_hierarchies | org | D | — | — | — | high |
| sys_organization_unit_history | org | D | — | — | — | high |
| sys_blueprint_activations | reward_blueprint | D | — | — | — | high |
| sys_blueprint_overrides | reward_blueprint | D | — | — | — | high |
| sys_reward_gates | reward_blueprint | D | — | — | — | high |
| sys_auth_sessions | runtime_app | D | session | 0 | — | high |
| sys_payroll_handoff_records | runtime_app | D | — | — | — | high |
| sys_user_preferences | runtime_app | D | — | — | — | high |
| sys_visualization_exports | runtime_app | D | — | — | — | high |
| sys_visualization_layouts | runtime_app | D | — | — | — | high |
| sys_visualization_node_layouts | runtime_app | D | — | — | — | high |
| sys_visualization_styles | runtime_app | D | — | — | — | high |
| sys_activity_classification_mappings | sdbi_misc | D | — | — | — | medium |
| sys_user_professional_experiences | sdbi_misc | D | — | — | — | high |
| sys_seed_acquisition_runs | seed_engine | D | — | — | — | high |
| sys_seed_approval_decisions | seed_engine | D | — | — | — | high |
| sys_seed_candidate_records | seed_engine | D | — | — | — | high |
| sys_seed_source_evidence | seed_engine | D | — | — | — | high |
| sys_seed_validation_results | seed_engine | D | — | — | — | high |
| sys_position_skill_requirement_history | skills_learning | D | — | — | — | high |

## Bucket A — detail (4)

### sys_career_paths
**source:** career_paths (32 rows) · **confidence:** high · **domain:** career_position

**fk_closure:** All NOT-NULL columns resolve. Verified target DDL: the only NOT-NULL columns WITHOUT a default are career_path_code and career_path_name (career_path_id/kind/is_global/metadata all have defaults). career_path_tenant_id is NULLABLE (FK -> sys_tenancies, 2 rows present, ON DELETE CASCADE). created_by/updated_by NULLABLE (-> sys_users, ON DELETE SET NULL). code derivable (slug of legacy name/id), name = legacy career_paths.name, kind mappable from legacy path_type (linear/branching/matrix) into the CHECK set (VERTICAL/LATERAL/SPECIALIST/MANAGERIAL/CROSS_FUNCTIONAL). No person or position FK on this table -> no employee/position bridge required.

**rationale:** [VERIFIED] Re-ran legacy count public.career_paths = 32 (>0). Legacy DDL maps ~1:1: name->career_path_name, description->career_path_description, path_type->career_path_kind (CHECK-mappable), tenant_id->career_path_tenant_id (nullable, FK resolves to the 2 present sys_tenancies). Every NOT-NULL/FK target column resolves from data already in sys.* with no missing bridge -> deterministic import -> A.

**evidence:** Re-confirmed legacy count(*) public.career_paths = 32 via ssh oracle-vm-default sudo -u postgres. Target \d sys.sys_career_paths: NOT-NULL-no-default = career_path_code, career_path_name only; FKs -> sys_tenancies (count=2) + sys_users (nullable). brownfield.table_mappings has NO row for this target (query returned 0 rows).

### sys_user_career_plans
**source:** employee_career_paths (128 rows) · **confidence:** high · **domain:** career_position

**fk_closure:** All NOT-NULL/FK columns resolve under the employee-centric doctrine. Verified target DDL: NOT-NULL = user_career_plan_tenant_id (-> sys_tenancies, 2 present) and user_career_plan_user_id (-> sys.sys_users, 161); user_career_plan_status NOT-NULL has a default (ACTIVE) + CHECK (ACTIVE/COMPLETED/PAUSED/CANCELLED) mappable from legacy status (active/completed/paused/changed). user_career_plan_path_id (-> sys_career_paths) and user_career_plan_target_position_id (-> sys_positions) are NULLABLE (ON DELETE SET NULL). The user_id resolves via the EMPLOYEE crosswalk: legacy employee_career_paths.employee_id -> employees_core (NOT users); sys_users carry user_external_code='LEGACY_EMP::'||employees.id. Verified overlap: 66 distinct legacy employees across 128 rows, of which 57 have a matching sys_users crosswalk -> those rows' NOT-NULL user_id resolves; rows whose employee was not imported simply skip (coverage, not a structural wall).

**rationale:** [VERIFIED] Re-ran legacy count public.employee_career_paths = 128 (>0). EMPLOYEE-CENTRIC doctrine respected: the legacy FK is employee_id -> employees_core (verified in DDL: fk_ecp_employee), NOT users — driver is employees, crosswalk 'LEGACY_EMP::'. Columns map ~1:1: employee_id->user, path_id->user_career_plan_path_id (nullable), status->user_career_plan_status, target_completion/started_at->metadata/horizon. Every NOT-NULL/FK resolves (tenant present, user resolves via 57/66 crosswalk hits, path/target nullable). Source populated + FKs resolve -> A (not B, not C).

**evidence:** Re-confirmed legacy employee_career_paths = 128 (66 distinct non-null employee_id). Legacy DDL: fk_ecp_employee employee_id -> employees_core(id) (EMPLOYEE not users), path_id -> career_paths, status CHECK, tenant_id NOT NULL -> tenants. Crosswalk verified: sys_users w/ LEGACY_EMP:: = 160; ANY-match of the distinct legacy employee codes against sys_users = 57. Target DDL: NOT-NULL tenant_id + user_id; path_id & target_position_id nullable. No brownfield mapping row.

### sys_gap_analysis_results
**source:** public.skill_gap_analyses (304 rows) · **confidence:** medium · **domain:** gap

**fk_closure:** NOT-NULL FKs: gap_analysis_result_tenant_id -> sys_tenancies (2 rows, resolvable), gap_analysis_result_user_id -> sys_users (161 rows). VERIFIED: all 304 legacy rows have target_entity_type='employee' (304/304) and target_entity_id resolves to legacy employees (304/304 EXISTS) -> the EMPLOYEE-centric path (I14/ADR-0024), NOT the false-friend legacy users path. Person FK resolves through the LEGACY_EMP:: crosswalk (sys_users.user_external_code = 'LEGACY_EMP::'||employees.id, format confirmed live; 160/161 sys_users carry it). Per-row coverage is PARTIAL: of 180 distinct employee subjects, 146 (81%) land in the RTL-collapsed sys_users; the remaining ~34 subjects are a match-or-skip residual = partial-coverage reconciliation, NOT a structural modeling wall (the bridge mechanism exists and works, no human decision required to wire it). Nullable position_id -> sys_positions (162) resolvable.

**rationale:** [VERIFIED] Derived analytics table (overall_score, kind, payload jsonb of computed gap results). Real legacy source WITH rows positively confirmed: skill_gap_analyses count(*)=304 re-run, a derived-analytics table with near-1:1 columns (overall_match_score->overall_score, skill_gaps/recommendations/priority_skills jsonb->payload, analysis_type maps to kind, all SKILL-domain). Tie-breaker: real source WITH rows -> never C/D. The mandatory person FK resolves via the correct employee-centric crosswalk (all 304 rows reference an employee target that resolves to employees), and tenant/position FKs resolve from populated sys.* tables; the FK mechanism resolves without any modeling decision (just match-or-skip), so A over B (B requires a FK that CANNOT resolve without a decision). Confidence medium: column mapping is not strictly 1:1 (legacy is SKILL-only while target kind is multi-kind SKILL/KPI/LEARNING/CERTIFICATION/BEHAVIORAL/COMPOSITE) and per-row person-FK coverage is partial (146/180 distinct subjects, 81%).

**evidence:** target \d: NOT NULL FKs gap_analysis_result_user_id->sys.sys_users, gap_analysis_result_tenant_id->sys.sys_tenancies, nullable position_id->sys.sys_positions. legacy \d public.skill_gap_analyses count(*)=304; target_entity_type group-by = employee|304|304 (all employee, all target_entity_id populated); EXISTS join target_entity_id->employees = 304/304 resolve; distinct employee targets = 180; sys_users matching LEGACY_EMP::target_entity_id = 146/180. sys_users=161 (160 LEGACY_EMP:: coded), sys_positions=162, sys_tenancies=2. No brownfield.table_mappings row for this target. Target currently 0 rows (not yet imported).

### sys_user_documents
**source:** employee_documents (1089 rows) · **confidence:** high · **domain:** runtime_app

**fk_closure:** All NOT-NULL/FK columns resolve deterministically on the importable subset. user_document_user_id->sys_users via the EMPLOYEE-CENTRIC crosswalk: legacy employee_documents.employee_id->employees_core.id (NOT users); sys_users carries user_external_code='LEGACY_EMP::'||id (160/161). Of 264 distinct legacy employees, 156 resolve to a sys_users row => 657/1089 rows importable (the 432 rows for 108 out-of-subset employees simply filter out — subset behavior, not an FK orphan/wall). tenant_id->sys_tenancies(2) resolves. user_document_kind is NOT-NULL default 'OTHER' with a CHECK that includes OTHER, so every legacy document_type maps. title (varchar 255 present), uri (legacy file_path varchar 500 present), mime_type (present), size_bytes (legacy file_size present). created_by/updated_by nullable.

**rationale:** [VERIFIED] A real populated EMPLOYEE-centric legacy source (1089 rows, 264 distinct employees, 657 importable rows on the RTL subset) maps ~1:1 to the target, and every NOT-NULL/FK column resolves from data already in sys.* (sys_users 161 via the I14/ADR-0024 employees->sys_users crosswalk, sys_tenancies 2). The legacy FK is employee_id->employees_core (employee-centric, correct driver — NOT the false-friend users). The kind CHECK's OTHER catch-all guarantees no categorical gap: contract->CONTRACT_REFERENCE, cv->CV, certificate->CERTIFICATE, and id_document/id_card/payslip/policy_acknowledgment->OTHER. Documents for employees outside the RTL subset filter out (no FK orphan, no wall). Tie-breaker: source exists AND every FK resolves -> A (not B); populated source -> never D despite 'documents' on the scaffold list.

**evidence:** VM re-run: count(employee_documents)=1089; distinct employee_id=264; legacy document_type = contract|264, cv|264, id_document|156, certificate|111, id_card|108, payslip|108, policy_acknowledgment|78. Legacy \d: FK employee_id->employees_core(id) (employee-centric); cols title, file_path, mime_type, file_size all present. Crosswalk: 156/264 distinct emps resolve, 657/1089 rows importable. Target \d kind CHECK includes OTHER (NOT-NULL default OTHER). sys_users LEGACY_EMP:: 160/161, email 161/161; sys_tenancies=2.

## Bucket B — detail (18)

### sys_career_path_steps — wall: `job_to_position_bridge`
**source:** career_path_levels (75 rows) · **confidence:** medium · **domain:** career_position

**fk_closure:** career_path_step_path_id (NOT NULL, FK -> sys_career_paths) resolves once career_paths is imported (bucket A). career_path_step_ordinal (NOT NULL) <- legacy level_order. BUT a faithful step requires career_path_step_origin_position_id / career_path_step_target_position_id -> sys.sys_positions (162 rows): legacy carries career_path_levels.target_job_id -> public.tenant_jobs (20 rows), a JOB not a POSITION. The only job link in the target is sys_positions.position_job_role_id -> sys_job_roles (227, nullable) — there is no deterministic legacy job->position pairing. The position FKs are NULLABLE (ON DELETE SET NULL), so a degenerate step (path_id+ordinal only) is insertable, but the meaningful step semantics (origin/target positions) cannot be populated without resolving the level's target job to a concrete position.

**rationale:** [VERIFIED] Re-ran legacy count public.career_path_levels = 75 (>0) and public.tenant_jobs = 20. Source populated -> not C/D. The natural ordered-step structure maps (level_order->ordinal, typical_duration_months->step_typical_duration_months, required_skills->required_proficiency_uplift jsonb). The required step semantics depend on the job->position bridge (legacy is job-keyed via target_job_id, target is position-keyed); that bridge is an unresolved modeling decision -> structural wall, not deterministic A -> B.

**evidence:** Re-confirmed legacy career_path_levels = 75, tenant_jobs = 20. Legacy DDL: career_path_levels.target_job_id -> tenant_jobs(id), level_order int NOT NULL, typical_duration_months. Target DDL: origin/target position FKs -> sys.sys_positions (count=162) but path is job-keyed in legacy; sys_positions job link = position_job_role_id -> sys_job_roles (count=227). No brownfield mapping row.

### sys_position_career_paths — wall: `job_to_position_bridge`
**source:** career_path_levels (75 rows) · **confidence:** medium · **domain:** career_position

**fk_closure:** Both junction FKs are NOT NULL: career_path_id -> sys_career_paths (resolves after bucket-A import) and position_id -> sys.sys_positions (162 present). position_career_path_tenant_id (NOT NULL) -> sys_tenancies (2) resolves. The blocker: legacy has NO direct position<->path junction. public.career_paths DDL has ZERO position/job columns (verified: id, tenant_id, name, description, department, path_type, is_active, ... embedding... — no position/job link). The only path<->job linkage is career_path_levels.target_job_id -> tenant_jobs (a JOB). Establishing which sys position belongs to which path therefore requires the legacy tenant_jobs -> sys_positions modeling bridge, which does not exist deterministically (sys_positions links to job_roles, not legacy jobs).

**rationale:** [VERIFIED] A populated upstream legacy source exists (career_path_levels 75 rows carry the only job linkage that could seed this junction), so not C/D. But the NOT-NULL position_id cannot be deterministically resolved: legacy links paths to jobs (via levels.target_job_id), never to positions, and the job->position mapping is the unresolved structural decision -> wall job_to_position_bridge -> B.

**evidence:** Verified public.career_paths DDL has no position/job columns; only career_path_levels.target_job_id -> tenant_jobs(count=20) provides any job linkage. Target DDL: NOT-NULL position_id -> sys_positions(162) + NOT-NULL career_path_id -> sys_career_paths + NOT-NULL tenant_id -> sys_tenancies(2); UNIQUE(position_id, career_path_id). No brownfield mapping row.

### sys_bonus_pools — wall: `other:tenant_id Wave-2 reconciliation — 8/14 source rows (SmartFood=5, EcoNova=3) have legacy tenant_id with NO crosswalk in brownfield.tenant_id_mappings`
**source:** public.bonus_plans (14 rows) · **confidence:** high · **domain:** comp

**fk_closure:** DOES NOT RESOLVE for all source rows. The sole NOT-NULL FK bonus_pool_tenant_id -> sys.sys_tenancies (2 active rows: RTL_BANK, HEURESYS). Re-verified: legacy bonus_plans spans 4 distinct tenant_id values (RTL Bank 0c54b84a=5, SmartFood 1d7bf448=5, EcoNova fb1e866c=3, Heuresys System d5855519=1). brownfield.tenant_id_mappings contains ONLY 2 of these 4 legacy ids (0c54b84a and d5855519, both -> RTL_BANK_REFERENCE); SmartFood (1d7bf448) and EcoNova (fb1e866c) have NO crosswalk row. Therefore 8/14 rows cannot resolve their NOT-NULL tenant FK without a modeling decision (creating the SmartFood/EcoNova tenancies = the deferred Wave-2 reconciliation, named verbatim in tenant_id_mappings.notes). The nullable org_unit FK is irrelevant. No employee/person FK on this target.

**rationale:** [CORRECTED A->B: NOT-NULL tenant FK does not resolve for all source rows] sys_bonus_pools is a budget-envelope container and legacy public.bonus_plans (14 rows, re-confirmed) maps ~1:1 on defining columns (total_budget->total_eur, period_start/end, status). HOWEVER the proposed A relied on the tenant FK resolving from sys.* already populated — it does NOT for 8 of 14 rows. The tie-breaker is explicit: 'Source exists AND EVERY (NOT-NULL) FK resolves -> A (not B)'. Here the NOT-NULL bonus_pool_tenant_id resolves for only the 2 RTL/Heuresys legacy tenants (6 rows); the SmartFood + EcoNova legacy tenants (8 rows) have no canonical tenancy and no crosswalk entry. This is a genuine structural wall (the Wave-2 multi-tenant reconciliation deferred per project state), not an optional refinement -> bucket B. On conservatism (A->B->C), B is the correct downgrade: a populated source exists (so never C/D), but a required FK needs a modeling decision.

**evidence:** legacy public.bonus_plans count(*)=14, tenant split RTL=5/SmartFood=5/EcoNova=3/Heuresys=1. sys.sys_tenancies has 2 ACTIVE rows (RTL_BANK 86ba7a65, HEURESYS 8bc5bc59). brownfield.tenant_id_mappings has 2 rows only: legacy 0c54b84a->RTL, d5855519->RTL; notes literally say 'Goal 004 Wave 2 will reconcile to per-tenant canonical IDs once SmartFood/EcoNova/Heuresys System tenancies are created'. SmartFood 1d7bf448 + EcoNova fb1e866c absent from mappings -> 8/14 rows' NOT-NULL tenant FK unresolved. No brownfield.table_mappings row for this target.

### sys_organization_unit_kpi_templates — wall: `org_unit_template_vs_instance`
**source:** org_unit_kpis (100 rows) · **confidence:** high · **domain:** kpi

**fk_closure:** PARTIAL. CORRECTION to stage-1: the kpi FK organization_unit_kpi_template_kpi_id->sys_kpi_definitions RESOLVES (re-verified 100/100 distinct org_unit_kpis.kpi_code 'KPI-0001'..'KPI-015' map exactly to sys_kpi_definitions; the keyspace 'KPI-xxxx' IS present in sys, 100 KPI-prefixed codes). The single real wall is the NOT-NULL organization_unit_kpi_template_unit_id->sys_organization_units(26 tenant instances): legacy org_unit_kpis.org_unit_template_id->org_unit_templates is a 225-row TEMPLATE catalog, not the tenant org-unit instances; no deterministic template->instance crosswalk. tenant_id derivable once unit resolved.

**rationale:** [VERIFIED] Bucket unchanged (B) but stage-1 rationale partly WRONG: the claimed kpi-code keyspace divergence ('KPI-0001' vs sys) is false — re-verification shows 100/100 org_unit_kpis codes exist in sys_kpi_definitions (sys has KPI-0001..KPI-0085 and KPI-001..KPI-015). The genuine wall is template-vs-instance: org_unit_kpis is keyed at the org_unit TEMPLATE level (org_unit_template_id->org_unit_templates, 225 rows) while the target requires a real org-unit INSTANCE (sys_organization_units, 26 rows) — the canonical org_unit_template_vs_instance wall. Required unit FK needs a modeling decision -> B.

**evidence:** Re-verified: org_unit_kpis=100 (exact). kpi-code closure 100/100 to sys_kpi_definitions (corrects stage-1 mismatch claim). NOT-NULL FKs: unit_id->sys_organization_units(26 instances), kpi_id->sys_kpi_definitions(243), tenant_id->sys_tenancies(2). legacy FK org_unit_template_id->org_unit_templates (225 templates, NOT instances) -> template->instance bridge required.

### sys_position_kpi_requirements — wall: `job_to_position_bridge`
**source:** tenant_job_kpis (80 rows) · **confidence:** high · **domain:** kpi

**fk_closure:** FAILS. NOT-NULL position_id->sys_positions(162 instances). Re-verified: legacy KPI tables key KPIs to JOBS, never to positions — tenant_job_kpis(80, FK tenant_job_id->tenant_jobs), job_kpis(2000, FK job_template_id->job_templates). The only legacy *position* table is position_skill_requirements (skills, not KPI). No legacy table links a KPI to a position instance -> the explicit job_to_position_bridge modeling decision is required. kpi_definition_id->sys_kpi_definitions also needs a code crosswalk (tenant_job_kpis.kpi_code varchar20). tenant_id derivable once position resolved.

**rationale:** [VERIFIED] A legacy source WITH rows exists for job-level KPIs (tenant_job_kpis=80 exact, job_kpis=2000 exact) but the target is POSITION-centric and no legacy table keys KPIs to a position instance (confirmed by scanning all public tables matching position/kpi: only position_skill_requirements is position-keyed, and it is skills not KPI). Resolving NOT-NULL position_id requires the job_to_position_bridge. Required FK unresolvable without a bridge -> B.

**evidence:** Re-verified counts: tenant_job_kpis=80, job_kpis=2000. NOT-NULL target FKs position_id->sys_positions(162), kpi_definition_id->sys_kpi_definitions(243), tenant_id->sys_tenancies(2). Legacy KPI-to-job FKs: tenant_job_kpis.tenant_job_id->tenant_jobs; job_kpis.job_template_id->job_templates. No KPI->position table exists (position/kpi table scan) -> job_to_position_bridge required.

### sys_process_kpi_templates — wall: `other:legacy business_processes keyspace (BP-001..BP-SF-007) does not map to blueprint_process_registry ordinals (00..22)`
**source:** process_kpis (81 rows) · **confidence:** high · **domain:** kpi

**fk_closure:** PARTIAL. kpi FK process_kpi_template_kpi_id->sys_kpi_definitions RESOLVES (re-verified: 81/81 distinct process_kpis.kpi_code map exactly to sys_kpi_definitions.kpi_definition_code, e.g. 'BP-001-KPI-01'). But NOT-NULL process_kpi_template_process_id->sys_blueprint_process_registry FAILS: legacy process_kpis.process_id->business_processes (26 rows, process_code 'BP-001','BP-EN-001','BP-SF-001' industry-variant keyspace) cannot map to sys_blueprint_process_registry (23 rows, code '00'..'22', smallint ordinal, single blueprint_variant) without a human-authored bridge. The registry has NO process_code/legacy-linkage column.

**rationale:** [VERIFIED] Legacy source WITH rows exists (process_kpis=81 exact) and the kpi FK resolves 1:1 by code (81/81 confirmed by comm with C-locale, contradicting the stage-1 implication that codes might diverge). But the NOT-NULL process FK to sys_blueprint_process_registry cannot resolve: legacy process keyspace (business_processes.process_code BP-xxx) is a different model from the blueprint registry ordinal codes (00..22). Required FK unresolvable without a modeling bridge -> structural wall -> B (not A). brownfield.table_mappings says IMPORT but that is contradicted by the failed process FK closure.

**evidence:** Re-verified: process_kpis=81 (exact count). kpi-code closure 81/81 to sys_kpi_definitions (243). sys_blueprint_process_registry=23 rows, blueprint_process_code '00'..'22' (smallint ordinals, single variant b6e81585...), no process_code/legacy column. legacy business_processes=26, process_code 'BP-001'..'BP-SF-007'. Keyspaces incompatible -> process FK needs human bridge. brownfield mapping=IMPORT (contradicted).

### sys_branches — wall: `other:location_to_org_unit_bridge`
**source:** public.locations (34 rows) · **confidence:** high · **domain:** org

**fk_closure:** BLOCKED. branch_tenant_id -> sys.sys_tenancies(2, verified) ON DELETE RESTRICT OK; created_by/updated_by -> sys.sys_users(161, verified) nullable ON DELETE SET NULL OK; address/code/city/postal_code/country columns map ~1:1 from legacy locations. BUT branch_organization_unit_id is NOT NULL + UNIQUE (index sys_branches_organization_unit_uq) -> each branch must bind 1:1 to exactly one sys.sys_organization_units(26) row, and legacy provides no deterministic location->single-org-unit identity.

**rationale:** [VERIFIED] A real populated legacy source exists (public.locations, verified count=34; 10 of type 'branch', plus headquarters=8/office=8/factory=4/warehouse=2/NULL=2) whose columns (code,name,address,city,province,postal_code,country) map ~1:1 to sys_branches address fields — so NEVER C/D (real source WITH rows). However sys_branches.branch_organization_unit_id is NOT NULL AND UNIQUE, demanding a 1:1 location<->org_unit pairing. Re-verified the cardinality of the only candidate link: legacy public.org_units.default_location_id -> locations is strongly MANY-org-to-ONE-location (76 org_units, only 47 carry a default_location_id, pointing to just 13 DISTINCT locations; individual locations are shared by 3, 4, 7 and 15 org_units). This is the INVERSE cardinality of what the UNIQUE FK requires, and legacy locations has NO FK back to org_units. No deterministic rule maps each location to a single owning org_unit, so the required UNIQUE NOT-NULL FK cannot resolve without a human-authored bridge decision. -> Structural wall (B) confirmed.

**evidence:** Target empty (verified count=0). public.locations verified count=34 (branch=10, headquarters=8, office=8, factory=4, warehouse=2, NULL=2); columns code/name/address/city/province/postal_code/country present. sys_branches DDL: branch_organization_unit_id NOT NULL + UNIQUE index sys_branches_organization_unit_uq, FK -> sys_organization_units(26, verified). Cardinality proof: SELECT count(*)=76 total org_units, count(default_location_id)=47 with location, count(DISTINCT default_location_id)=13; GROUP BY default_location_id HAVING count>1 returned 8 locations shared by up to 15 org_units (values 3,4,3,4,7,3,3,15) -> NOT 1:1, it is many-org->one-location. Legacy locations has NO FK to org_units (only contracts + internal_mobility_postings reference it). No location->org_unit bridge exists -> UNIQUE NOT-NULL FK unresolvable without a modeling decision. No brownfield.table_mappings classification row exists for this target.

### sys_inbox_notifications — wall: `other: notification_type + resource_type CHECK-enum remap — legacy free-form type varchar not 1:1, and legacy has NO resource_type/resource_id columns to fill the constrained target columns`
**source:** notifications (238 rows) · **confidence:** high · **domain:** runtime_app

**fk_closure:** FK notification_user_id->sys_users RESOLVES employee-centrically: legacy notifications.user_id_employee_id->employees_core.id is non-null for 238/238 rows (re-verified); sys_users carries the crosswalk (LEGACY_EMP:: 160/161). Of 164 distinct legacy employees, 88 resolve to a sys_users row (76 orphan, subset-filtered) => 126/238 rows importable, a non-empty subset. tenant FK->sys_tenancies(2) resolves, created_by nullable. So the FK closure itself is satisfiable on the importable subset.

**rationale:** [VERIFIED] A populated employee-bridged legacy source (238 rows, user_id_employee_id 238/238 non-null, 126 rows importable) is positively confirmed, so NOT D despite 'notifications' being on the D scaffold list. But the target enforces strict CHECK enums absent from the legacy data: notification_type IN (TRAINING_DEADLINE, ASSESSMENT_REQUEST, MANAGER_FEEDBACK_READY, CAREER_TARGET_STATUS, GAP_CLOSURE_DUE, SYSTEM) and the (nullable) notification_resource_type IN (POSITION, LEARNING_MODULE, ASSESSMENT, CAREER_TARGET, KPI, SKILL). Legacy type values (approval_needed|56, review_pending|42, system_update|38, course_assigned|35, goal_reminder|34, feedback_received|33) map to NONE of the 6 target codes 1:1, and the legacy DDL has NO resource_type/resource_id column at all. A human-authored categorical translation rule is required — a modeling decision, not a deterministic import (A) and not derived analytics (C). FK resolves but the categorical CHECK-enum wall blocks deterministic import -> B.

**evidence:** VM re-run: count(notifications)=238; user_id_employee_id non-null=238/238; legacy type dist = approval_needed|56, review_pending|42, system_update|38, course_assigned|35, goal_reminder|34, feedback_received|33. Legacy \d notifications has columns type(varchar 50), title, message, action_url, action_label, metadata — NO resource_type/resource_id. Crosswalk: 88/164 distinct legacy emps resolve, 126/238 rows importable. Target CHECK enums verified via \d (type 6 codes, resource_type 6 codes). sys_users LEGACY_EMP:: 160/161, email 161/161.

### sys_learning_path_steps — wall: `learning_catalog_reimport`
**source:** learning_path_courses (124 rows) · **confidence:** high · **domain:** skills_learning

**fk_closure:** path_id (FK sys_learning_paths, NOT NULL) and module_id (FK sys_learning_modules, NOT NULL) both UNRESOLVABLE: legacy learning_path_courses (learning_path_id, course_id -> courses) and course_modules (course_id) carry no preserved legacy-id key, and sys_learning_paths=4667 / sys_learning_modules=7300 have only *_code columns (no legacy-id), so the re-imported catalog cannot be back-linked.

**rationale:** [VERIFIED] Real populated legacy source learning_path_courses=124 (verified DDL: learning_path_id, course_id, sequence_order, is_mandatory -> ordered path-step semantics); course_modules=564 is the module decomposition side. Source-with-rows -> not C/D. Not A: both NOT-NULL FKs require a legacy-course/path-id -> sys-catalog-id crosswalk that does not exist (the catalog was bulk re-imported, not key-preserving). Wall = learning_catalog_reimport. table_mappings = REFERENCE_ONLY (sources learning_path_courses + course_modules).

**evidence:** legacy public.learning_path_courses count=124 (verified; learning_path_id, course_id, sequence_order, is_mandatory). legacy public.course_modules count=564 (verified). sys_learning_paths=4667, sys_learning_modules=7300 (only *_code, no legacy-id col). table_mappings classification=REFERENCE_ONLY for sys_learning_path_steps (sources learning_path_courses, course_modules). Target currently 0 rows.

### sys_position_learning_requirements — wall: `job_to_position_bridge`
**source:** job_title_courses (207 rows) · **confidence:** medium · **domain:** skills_learning

**fk_closure:** position_id (FK sys_positions, NOT NULL) UNRESOLVABLE: legacy job_title_courses is keyed by job_title (varchar(100)) + course_id (verified DDL), NOT by any key mapping to the 162 sys_positions (no legacy-id col on sys_positions). learning_path_id (FK sys_learning_paths, NOT NULL) UNRESOLVABLE: legacy keys courses, not learning_paths, and sys_learning_paths=4667 has no legacy-id col (only learning_path_code) so no course/path crosswalk. tenant_id resolves (sys_tenancies=2).

**rationale:** [VERIFIED] The brownfield table_mappings-named source job_title_learning_paths is EMPTY (count=0, verified). The populated semantic equivalent job_title_courses has 207 rows (job_title -> course requirement, requirement_type, priority) -> a populated legacy source WITH rows exists, so not C/D. Not A: the position side cannot resolve (job_title varchar -> 162 sys_positions has no bridge: the job-vs-position split) and the learning side needs a course->sys_learning_path crosswalk that does not exist. Dominant wall = job_to_position_bridge. table_mappings = REFERENCE_ONLY. Conservative A->B.

**evidence:** legacy public.job_title_learning_paths count=0 (verified, named table_mappings source). legacy public.job_title_courses count=207 (verified) keyed by job_title varchar(100) + course_id -> courses(id) (verified DDL). sys_positions=162 (no legacy-id col). sys_learning_paths=4667 (only learning_path_code, no legacy-id). table_mappings classification=REFERENCE_ONLY for sys_position_learning_requirements (source job_title_learning_paths). Target currently 0 rows.

### sys_position_skill_requirements — wall: `job_to_position_bridge`
**source:** position_skill_requirements (1632 rows) · **confidence:** high · **domain:** skills_learning

**fk_closure:** position_id (FK sys_positions, NOT NULL) UNRESOLVABLE: legacy position_skill_requirements.position_id -> job_templates(id) (verified DDL fk_psr_position); sys_positions=162 has NO legacy-id/external-code column and position_esco_occupation_uri is populated 0/162, so no job_template->sys_position bridge exists. skill_id (FK sys_skills, NOT NULL) UNRESOLVABLE: legacy esco_skill_id -> esco_skills(id); sys_skills=21939 has no legacy-skill-id (only skill_esco_uri 14011/21939) so only a non-deterministic ESCO-URI crosswalk could be built. tenant_id resolves (sys_tenancies=2). Either NOT-NULL FK failing forces B; the position side fails outright.

**rationale:** [VERIFIED] Real populated legacy source position_skill_requirements (1632 rows, columns map ~1:1: position, esco_skill_id/custom_skill_name, minimum_proficiency, weight) -> not C/D. Not A: the position_id NOT-NULL FK references legacy job_templates (the job-vs-position split) with no bridge to the 162 sys_positions (no legacy-id column, ESCO occupation URI 0/162 populated), and the skill side has no deterministic legacy-id->sys_skills key. brownfield.table_mappings classifies all related sources (position_skill_requirements / skill_requirements_templates / job_template_skills / esco_occupation_skills / onet_*) as REFERENCE_ONLY, confirming non-deterministic import. Dominant wall = job_to_position_bridge. Conservative A->B.

**evidence:** legacy public.position_skill_requirements count=1632 (verified); DDL fk_psr_position FOREIGN KEY (position_id) REFERENCES job_templates(id); esco_skill_id REFERENCES esco_skills(id). sys_positions=162, position_esco_occupation_uri populated 0/162 (no occupation bridge). sys_skills=21939, skill_esco_uri populated 14011/21939, no legacy-skill-id col. table_mappings classification=REFERENCE_ONLY for sys_position_skill_requirements (sources: skill_requirements_templates(8), job_template_skills(28983), esco_occupation_skills(126051), onet_*). Target currently 0 rows.

### sys_skill_learning_mappings — wall: `learning_catalog_reimport`
**source:** course_esco_skills (717 rows) · **confidence:** high · **domain:** skills_learning

**fk_closure:** skill_id (FK sys_skills, NOT NULL) UNRESOLVABLE deterministically: legacy course_esco_skills keys skills by esco_skill_uri/skill_name (verified DDL), only a non-deterministic ESCO-URI match into sys_skills=21939 (skill_esco_uri 14011/21939) is possible. module_id (FK sys_learning_modules, NOT NULL) UNRESOLVABLE: legacy course_id -> courses has no crosswalk into sys_learning_modules=7300 (no legacy-id col).

**rationale:** [VERIFIED] Real populated legacy source course_esco_skills=717 (verified DDL: course_id, esco_skill_uri, skill_name, proficiency_level_gained -> the skill<->learning bridge); supporting certification_esco_skills=664, job_title_courses=207. Source-with-rows -> not C/D. Not A: the module side needs a course->sys_learning_module crosswalk that does not exist (re-imported catalog), and the skill side has only a non-deterministic ESCO-URI match. Wall = learning_catalog_reimport. table_mappings = REFERENCE_ONLY (sources job_title_courses, course_esco_skills, certification_esco_skills).

**evidence:** legacy public.course_esco_skills count=717 (verified; course_id -> courses, esco_skill_uri, proficiency_level_gained). certification_esco_skills=664; job_title_courses=207 (verified). sys_skills=21939 (skill_esco_uri 14011/21939, no legacy-id), sys_learning_modules=7300 (only learning_module_code, no legacy-id). table_mappings classification=REFERENCE_ONLY for sys_skill_learning_mappings. Target currently 0 rows.

### sys_user_learning_assignments — wall: `learning_catalog_reimport`
**source:** course_enrollments (3052 rows) · **confidence:** high · **domain:** skills_learning

**fk_closure:** user_id (FK sys_users, NOT NULL) RESOLVES via employee crosswalk: legacy course_enrollments.employee_id -> employees_core(id) (verified DDL fk_course_enrollments_employee), sys_users keyed by user_external_code='LEGACY_EMP::'||employees.id (verified sample + overlap spot-check 3/5). tenant_id RESOLVES (sys_tenancies=2). BUT the CHECK constraint sys_ula_scope_check requires at least one of module_id/path_id/initiative_id, all FK into sys_learning_modules(7300)/sys_learning_paths(4667)/sys_training_initiatives(1); the legacy course_id/learning_path_enrollment_id have no crosswalk into the re-imported catalog (no legacy-id col), so the mandatory scope target cannot resolve.

**rationale:** [VERIFIED] Real populated legacy source course_enrollments=3052 (verified DDL: employee_id, course_id, status, due_date, is/mandatory via enrollment_source -> assignment semantics). Employee-centric (I14/ADR-0024): the person FK resolves from legacy employees (employee_id -> employees_core), NOT from legacy users -> doctrine satisfied. Source-with-rows -> not C/D. Not A: the mandatory scope target (module/path/initiative) cannot resolve without the learning-catalog crosswalk. Person side fine; wall = learning_catalog_reimport.

**evidence:** legacy public.course_enrollments count=3052 (verified); DDL fk_course_enrollments_employee FK (employee_id) REFERENCES employees_core(id); course_id -> courses(id); status, due_date present. 269 distinct enrolled employees; spot-check 3/5 sampled employee_ids resolve to sys_users LEGACY_EMP:: (verified). sys_users=161, sys_learning_modules=7300, sys_learning_paths=4667, sys_training_initiatives=1 (no legacy-id cols). Person resolves via LEGACY_EMP:: (I14), catalog scope FK does not. Target currently 0 rows.

### sys_user_learning_evidence — wall: `learning_catalog_reimport`
**source:** course_enrollments (3052 rows) · **confidence:** high · **domain:** skills_learning

**fk_closure:** user_id (FK sys_users, NOT NULL) RESOLVES via employee crosswalk: course_enrollments.employee_id -> employees_core -> sys_users via 'LEGACY_EMP::' (verified sample + 3/5 overlap). tenant_id RESOLVES (sys_tenancies=2). module_id (FK sys_learning_modules, NOT NULL) UNRESOLVABLE: legacy course_id -> courses has no crosswalk into sys_learning_modules=7300 (catalog re-imported without a legacy-id key).

**rationale:** [VERIFIED] Real populated completion-evidence sources: course_enrollments=3052 (verified DDL has completed_at, score, passed, certificate_url, certificate_issued) + employee_training_records=320 (completion_date, score, certificate_url). Employee-centric (I14): person FK resolves from legacy employees not users -> doctrine satisfied. Source-with-rows -> not C/D. Not A: the NOT-NULL module_id requires the course->sys_learning_module crosswalk that does not exist. Wall = learning_catalog_reimport.

**evidence:** legacy public.course_enrollments count=3052 (verified; completed_at, score, passed, certificate_url, certificate_issued_at). legacy public.employee_training_records count=320 (verified). sys_learning_modules=7300 (only learning_module_code, no legacy-id col). Person resolves via LEGACY_EMP:: employee crosswalk (I14/ADR-0024, verified 3/5 overlap), module_id does not. Target currently 0 rows.

### sys_critical_positions — wall: `job_to_position_bridge`
**source:** public.critical_roles (16) + public.succession_plans (31) (16 rows) · **confidence:** high · **domain:** succession_talent

**fk_closure:** BLOCKED: tenant_id resolves; created_by nullable. NOT-NULL critical_position_position_id -> sys_positions cannot resolve: legacy critical_roles identifies the role by role_name (varchar) + current_incumbent_id (employee, 15/16) with NO position_id; succession_plans has position_name text + position_id filled 0/31. There is no legacy positions table to crosswalk role/job names to sys_positions UUIDs.

**rationale:** [VERIFIED] Real legacy source WITH rows (critical_roles=16: criticality_level, impact_if_vacant, succession_status; succession_plans criticality_level) maps semantically to critical_position_rationale/business_impact_score. But the mandatory critical_position_position_id (also UNIQUE) requires resolving a role/job name to a v5 sys_positions UUID — a modeling/bridge decision, not deterministic. Source WITH rows -> not C/D; FK needs decision -> B.

**evidence:** Re-run: critical_roles=16 (current_incumbent_id 15/16, role_name text, no position_id); succession_plans position_id 0/31; sys_positions=162 built structurally with no legacy crosswalk. No prior brownfield mapping.

### sys_position_succession_relevance — wall: `job_to_position_bridge`
**source:** public.critical_roles (16) + public.succession_plans (31) (16 rows) · **confidence:** high · **domain:** succession_talent

**fk_closure:** BLOCKED: tenant_id resolves (ON DELETE RESTRICT, sys_tenancies=2); created_by/updated_by nullable. NOT-NULL position_id -> sys_positions (also UNIQUE) cannot resolve: legacy criticality/relevance data lives on critical_roles (role_name text, criticality_level, succession_status) and succession_plans (position_name text, position_id 0/31) — no deterministic job/role-name -> sys_positions crosswalk.

**rationale:** [VERIFIED] A legacy source WITH rows exists carrying the is_critical / readiness_horizon semantics (critical_roles.criticality_level + succession_status, succession_plans.criticality_level + risk_level). But this table is keyed on a UNIQUE NOT-NULL position_id and that FK requires resolving job/role names to v5 position UUIDs — a modeling decision (job_to_position_bridge). Source WITH rows -> not C/D; required FK unresolved -> B.

**evidence:** Re-run: critical_roles=16 (role_name, criticality_level, succession_status), succession_plans=31 (position_id filled 0/31); target has UNIQUE NOT-NULL position_id -> sys_positions with no legacy position crosswalk; sys_positions=162. No prior brownfield mapping.

### sys_succession_pools — wall: `job_to_position_bridge`
**source:** public.talent_pools (primary, 24) + public.succession_plans (31) / public.critical_roles (16) (24 rows) · **confidence:** high · **domain:** succession_talent

**fk_closure:** BLOCKED on NOT-NULL succession_pool_position_id -> sys_positions. tenant_id resolves (sys_tenancies=2); created_by/updated_by are nullable. talent_pools (24, all active) is actually the CLEANEST pool-entity source (name/description/pool_type/criteria map 1:1 to pool name/description/metadata) but it has NO position concept at all. succession_plans carries position_name text with position_id filled 0/31; critical_roles carries role_name text with no position_id. No legacy positions table exists to crosswalk job/role names to sys_positions (162 structural rows built in v5). Therefore the mandatory position FK cannot resolve deterministically from any candidate source.

**rationale:** [CORRECTED B->B (source enriched, bucket unchanged): the proposal missed public.talent_pools (24 rows) + talent_pool_members (40) which are the cleanest pool-entity source — better than succession_plans/critical_roles for name/description/status. Re-verified: talent_pools=24 (all active). But ALL three candidate sources lack a resolvable position link, and the NOT-NULL succession_pool_position_id -> sys_positions requires a job/role-name->position-UUID modeling decision that does not exist in legacy data. Source WITH rows -> never C/D; required FK needs a modeling decision -> B. Bucket B stands, wall job_to_position_bridge.]

**evidence:** Re-run: talent_pools total=24 active=24 (no position column, only pool_type+criteria jsonb); succession_plans=31 position_id filled 0/31; critical_roles=16 (role_name, no position_id); sys_positions=162, sys_tenancies=2. No legacy positions table in F0 inventory. No prior brownfield mapping exists for this target.

### sys_successor_candidates — wall: `job_to_position_bridge`
**source:** public.succession_candidates (206) + public.talent_pool_members (40) (206 rows) · **confidence:** high · **domain:** succession_talent

**fk_closure:** PARTIAL: successor_candidate_user_id -> sys_users RESOLVES via the employee-centric crosswalk (160 distinct LEGACY_EMP:: codes in sys_users; succession_candidates.candidate_employee_id filled 206/206 with 147 distinct, talent_pool_members.employee_id filled 40/40 with 40 distinct). tenant_id resolves. BLOCKED on NOT-NULL successor_candidate_pool_id -> sys_succession_pools: the parent pool table is itself B-blocked by its job_to_position_bridge wall, so the mandatory pool FK has nothing deterministic to point at.

**rationale:** [CORRECTED B->B (source enriched, bucket unchanged): proposal omitted public.talent_pool_members (40 rows, employee_id 40/40) which is the natural pool<->member source. Re-verified both. Person FK confirmed resolvable via legacy EMPLOYEES (candidate_employee_id, doctrine respected — NOT users; this is correct per I14). But the mandatory successor_candidate_pool_id inherits the unresolved position bridge from sys_succession_pools. Source WITH rows + person FK resolves, but a required FK needs a modeling decision first -> conservative B.]

**evidence:** Re-run: succession_candidates=206 (candidate_employee_id 206/206, 147 distinct; critical_role_id 120/206); talent_pool_members=40 (employee_id 40/40, 40 distinct); sys_users LEGACY_EMP:: distinct=160. Parent sys_succession_pools is bucket B (position bridge). No prior brownfield mapping.

## Bucket C — detail (23)

### sys_position_economic_weight
**source:** (none) · **confidence:** medium · **domain:** career_position

**fk_closure:** NOT-NULL: position_economic_weight_position_id -> sys_positions (162), position_economic_weight_tenant_id -> sys_tenancies (2), position_economic_weight_value numeric(8,4). Both FKs resolve structurally. The unresolvable element is the DATA: value is a derived weighting/valuation with period_start/period_end and no legacy table provides a per-position economic-weight value. Verified job_evaluations DDL (15 rows): point-factor JOB grading keyed to job_analysis_id/job_title (a JOB, not a position) with total_points/job_grade/knowledge_points/problem_solving_points/accountability_points — a job-level evaluation, not a normalized per-position weight. salary_bands(41)/ccnl_executive_bands(10) are band catalogs, not per-position weights.

**rationale:** [VERIFIED] Derived analytics measurement (computed normalized weight per position over time). Exhaustive inventory grep (weight|economic|valuation|grade|evaluation|importance|criticality) surfaced no per-position weight table; job_evaluations is job-level point-factor scoring (15 rows, keyed to jobs via job_analysis_id/job_title, not positions) requiring a human-authored aggregation/derivation rule to become a per-position numeric weight with periods. No positively-found populated 1:1 source -> C. Conservative on doubt.

**evidence:** Inventory grep found no per-position weight table; candidates job_evaluations=15 (job_analysis_id/job_title keyed, total_points/job_grade — verified DDL is job-level, not position), salary_bands=41, ccnl_executive_bands=10. Target DDL: value numeric(8,4) NOT NULL + period_start/period_end date; position_id + tenant_id NOT-NULL FKs (resolve to 162 / 2). No brownfield mapping row.

### sys_user_target_positions
**source:** (none) · **confidence:** medium · **domain:** career_position

**fk_closure:** NOT-NULL: user_target_position_user_id -> sys_users (161, resolves via employee crosswalk), user_target_position_position_id -> sys_positions (162), user_target_position_tenant_id -> sys_tenancies (2). The user/position/tenant FKs are structurally resolvable, BUT there is NO legacy table holding a clean (employee -> aspirational position) pair with a review state. Verified career_simulations DDL (20 rows): derived analytics keyed to target_job_id/target_path_id/target_level_id (jobs/paths/levels, NOT a position) with computed fields is_reachable, skill_distance, current_gap_analysis jsonb, milestone_plan, alternative_paths — and zero review-workflow columns. The target's review workflow (review_status PENDING_REVIEW/APPROVED/REJECTED/WITHDRAWN, reviewer_user_id, review_notes) has no legacy analogue.

**rationale:** [VERIFIED] Aspirational/derived analytics: a user-authored career target plus an approval workflow. Exhaustive inventory grep (position|aspir|target|weight|valuation|grade|evaluation|ranking|importance|criticality) found NO position-keyed aspiration table; only employee_kpi_targets(412, KPI not position), job_evaluations(15, job-level), position_skill_requirements(1632, skill reqs not aspirations). Nearest career_simulations(20) is job/path/level-keyed derived prediction, not a 1:1 (user,position) target, and lacks the review workflow entirely. No positively-found populated 1:1 legacy source -> C (derived analytics, needs human-authored derivation rule). Conservative on doubt.

**evidence:** Inventory grep for position/target/aspiration: only employee_kpi_targets=412, job_evaluations=15, position_skill_requirements=1632 (none a user->position aspiration). career_simulations DDL verified: employee_id + target_job_id/target_path_id/target_level_id (no position FK), is_reachable/skill_distance/current_gap_analysis/milestone_plan jsonb (derived). Target DDL: review-workflow fields (review_status CHECK, reviewer_user_id, review_notes) with no legacy analogue. No brownfield mapping row.

### sys_compensation_recommendations
**source:** (none) · **confidence:** high · **domain:** comp

**fk_closure:** N/A for bucket C. (If treated as import: NOT-NULL FKs tenant->sys_tenancies(2) + user_id->sys_users(161); user_id would map from legacy employees via 'LEGACY_EMP::'||employees.id crosswalk, NEVER from legacy users. position_id FK nullable. Crosswalk would be resolvable, but the defining columns do not map 1:1 — and the same Wave-2 tenant gap as bonus_plans would also bite merit_recommendations' 2-tenant spread.)

**rationale:** [VERIFIED] sys_compensation_recommendations is a recommendation-ENGINE output: defining columns are compensation_recommendation_signal with analytics-gate values (PROPOSED/APPROVED/SUPPRESSED_BY_GATE/ADJUSTED/REJECTED — live CHECK confirmed), computed_at engine timestamp, and a narrative. Legacy public.merit_recommendations (208 rows, re-counted) is semantically adjacent (recommended_increase_amount, new_salary, justification, status) but its status enum (pending/submitted/manager_approved/hr_approved/final_approved/rejected — live CHECK confirmed) is a WORKFLOW-APPROVAL ladder that does NOT map 1:1 to the engine-signal enum; it has no SUPPRESSED_BY_GATE concept and no computed_at engine timestamp. The gate/suppression + computed-signal model is derived analytics requiring a human-authored derivation/gate rule, not a deterministic 1:1 import. The 1:1-column condition for A fails on the defining (signal/gate/computed) columns -> conservative C holds (A->B->C; not B because the blocker is the derivation semantics, not a single resolvable FK).

**evidence:** legacy public.merit_recommendations count(*)=208. Live target CHECK: signal IN (PROPOSED,APPROVED,SUPPRESSED_BY_GATE,ADJUSTED,REJECTED) + compensation_recommendation_computed_at engine default now(). Legacy CHECK: status IN (pending,submitted,manager_approved,hr_approved,final_approved,rejected) — workflow-approval, no gate/suppression, no engine computed_at. Columns not 1:1 on the defining signal/gate column. No brownfield.table_mappings row.

### sys_payout_curves
**source:** (none) · **confidence:** high · **domain:** comp

**fk_closure:** N/A for bucket C. Target's only FK (payout_curve_tenant_id) is nullable (is_global supports global rows); but no legacy source exists to populate it regardless.

**rationale:** [VERIFIED] sys_payout_curves is a reusable rule/configuration catalog of payout-function shapes (kind in LINEAR/CAPPED/STEPPED/SIGMOID + payload jsonb defining the curve). Re-searched the full legacy inventory (curve|payout|variable_pay|incentive|salary|comp|signal|score) — NO standalone curve/function-definition table exists. The only adjacent legacy data is embedded plan parameters (bonus_plans.performance_multipliers jsonb, merit_cycles.guideline_matrix jsonb), which are plan-level config blobs, not a standalone curve catalog. Populating this needs human-authored curve definitions -> needs-decision derived/authored config. No populated source positively found, so it stays C (never promoted to A/B).

**evidence:** grep -iE 'curve|payout|variable_pay|incentive|salary|comp|signal|score' qa_artifacts/F0_legacy_inventory.txt returned only salary_bands(41)/salary_history(317)/salary_band_assignments(264) [-> sys_compensation_bands, a different target], mentor_match_scores(30)/mv_talent_signals(270)/turnover_risk_scores(267) [talent/risk analytics] — NONE is a payout-curve-shape catalog. No brownfield.table_mappings row.

### sys_variable_pay_calculations
**source:** (none) · **confidence:** high · **domain:** comp

**fk_closure:** N/A for bucket C. (If a source existed: NOT-NULL FKs are tenant->sys_tenancies(2) and user_id->sys_users(161); user_id would map from legacy employees via crosswalk 'LEGACY_EMP::'||employees.id, NEVER from legacy users — but no 1:1 calc source exists.)

**rationale:** [VERIFIED] sys_variable_pay_calculations is derived analytics: per-user computed variable-pay results whose defining columns are engine outputs (variable_pay_calculation_signal_score numeric(8,4), computed_at engine timestamp, amount_eur). Re-confirmed against the live DDL. The superficially closest legacy table, public.bonus_allocations (244 rows, re-counted), is an allocation ledger (target_amount/actual_amount/performance_multiplier/status pending..paid) with NO signal_score and NO computed-at engine semantics -> columns do NOT map ~1:1. No scored variable-pay calculation table exists in the inventory (the *_scores tables found are talent/risk, not variable pay). Populating requires a human-authored signal/aggregation derivation rule -> needs-decision derived analytics, stays C.

**evidence:** Target has variable_pay_calculation_signal_score numeric(8,4) + computed_at (engine output) [live \d confirmed]. Nearest legacy public.bonus_allocations count(*)=244 has columns target_amount/actual_amount/performance_multiplier/status but NO score/signal/computed_at -> not a 1:1 source. No brownfield.table_mappings row.

### sys_gap_closure_actions
**source:** (none) · **confidence:** high · **domain:** gap

**fk_closure:** Mandatory NOT-NULL FK gap_closure_action_gap_id -> sys.sys_learning_gaps, VERIFIED EMPTY (count=0). Even if a source were found, the parent gap rows do not exist in sys.*, so the action FK cannot attach. gap_closure_action_tenant_id->sys_tenancies (2) resolvable; gap_closure_action_owner_user_id nullable->sys_users (161). No populated legacy source for skill/competency gap-closure actions exists.

**rationale:** [VERIFIED] Action items within closure plans (kind TRAINING_ASSIGNMENT/CERTIFICATION_REQUIRED/MANAGER_INTERVENTION/PEER_COACHING/ON_THE_JOB_EXPOSURE/MENTORING, status PROPOSED/IN_PROGRESS/COMPLETED/CANCELLED, due_date, payload) derived from learning gaps. Re-searched inventory: no legacy table with rows for per-gap closure actions exists (only wrong-domain engagement_action_plans|6, succession_plans|31, learning_paths|20). Bucket B requires a legacy source WITH rows whose FK fails to resolve; the precondition 'legacy source WITH rows' is absent, so B does not apply. Derived analytics with no 1:1 source, and the mandatory parent (sys_learning_gaps) is unpopulated (0 rows) -> populating requires a human-authored derivation rule AND prior population of learning gaps. Conservative choice C.

**evidence:** target \d: gap_closure_action_gap_id NOT NULL FK -> sys.sys_learning_gaps; kind CHECK (TRAINING_ASSIGNMENT/CERTIFICATION_REQUIRED/MANAGER_INTERVENTION/PEER_COACHING/ON_THE_JOB_EXPOSURE/MENTORING). sys.sys_learning_gaps count(*)=0 (EMPTY); sys_tenancies=2, sys_users=161. Inventory grep found no gap-closure-action table (only engagement_action_plans|6, succession_plans|31, learning_paths|20 - all different domains). No brownfield.table_mappings row for this target. Target currently 0 rows.

### sys_gap_closure_plans
**source:** (none) · **confidence:** high · **domain:** gap

**fk_closure:** NOT-NULL FKs (gap_closure_plan_tenant_id->sys_tenancies=2, gap_closure_plan_user_id->sys_users=161) would resolve, but no 1:1 legacy source feeds them. Inventory candidates are all wrong-domain: engagement_action_plans (6 rows, engagement-survey domain, owner_id/created_by -> legacy users false friend); succession_plans (31 rows, position-succession risk planning keyed on incumbent_employee_id, NOT competency/skill-gap closure); learning_paths (20 rows, generic catalog learning paths, not gap-derived person remediation plans). None is a valid source for a person/gap-centric closure plan.

**rationale:** [VERIFIED] Derived planning output (milestones jsonb, status PROPOSED/ACTIVE/COMPLETED/CANCELLED/ON_HOLD, owner_user_id, target_completion_date) representing remediation/development plans built from gap analyses. Re-searched inventory (closure|action_plan|development_plan|remediation|idp|learning_path|career_plan|growth_plan|succession_plan): the only populated near-candidates are engagement_action_plans (6, engagement domain + legacy users link), succession_plans (31, position succession not skill-gap closure), learning_paths (20, catalog not gap-derived) - all semantically wrong domain. No legacy table for skill/competency gap-closure plans exists. Populating needs a human-authored derivation rule turning gap-analysis results into closure plans -> needs-decision derived analytics (C). No real source WITH rows in the closure-plan domain, so tie-breaker 'source WITH rows -> never C' does not apply.

**evidence:** target \d: milestones jsonb + status CHECK (PROPOSED/ACTIVE/COMPLETED/CANCELLED/ON_HOLD), planning semantics. Inventory grep (closure|action_plan|development_plan|remediation|idp|learning_path|career_plan|growth_plan|succession_plan) returned engagement_action_plans|6, job_title_learning_paths|0, learning_path_courses|124, learning_path_enrollments|341, learning_paths|20, succession_plans|31 - none is a competency/skill-gap closure plan. succession_plans \d: position_name/incumbent_employee_id/criticality_level/risk_level = succession-risk domain. No brownfield.table_mappings row for this target. Target currently 0 rows.

### sys_kpi_assessment_results
**source:** (none) · **confidence:** high · **domain:** kpi

**fk_closure:** FKs would resolve if populated (kpi_id->sys_kpi_definitions 243; user_id->sys_users 161 nullable; position_id->sys_positions 162 nullable; method_id->sys_kpi_assessment_methods 5 nullable; tenant_id->sys_tenancies 2). But the table is computed output (score numeric(8,4) via a scoring method + period) and no legacy table provides assessment-result rows: legacy '*_results' tables are blueprint_results/calibration_results/key_results (unrelated to KPI scoring), and employee_kpi_targets holds raw target/actual + a generated achievement_percent, not a method-scored assessment.

**rationale:** [VERIFIED] Pure derived analytics (scored assessment results per user|position|period via one of 5 sys methods). No 1:1 legacy source: re-verification of '*_result/*_score' legacy tables found none KPI-scoring-shaped; employee_kpi_targets is targets/actuals with a generated achievement ratio, not a scored result tied to sys_kpi_assessment_methods. Computing scores requires a human-authored scoring rule + method mapping -> needs-decision (C).

**evidence:** Columns: kpi_assessment_result_score numeric(8,4), method_id->sys_kpi_assessment_methods(5), period_start/end, payload jsonb. Legacy %result%/%score% scan: blueprint_results, calibration_results, key_results, mentor_match_scores, turnover_risk_scores — none are KPI assessment results. Closest employee_kpi_targets(412)=targets/actuals + generated achievement_percent, not method-scored.

### sys_kpi_measurements
**source:** (none) · **confidence:** medium · **domain:** kpi

**fk_closure:** FKs resolvable if populated (kpi_id->sys_kpi_definitions 243; user_id->sys_users 161 nullable; position_id->sys_positions 162 nullable; tenant_id->sys_tenancies 2). Closest legacy employee_kpi_targets(412) carries actual_value+period but is job-target-centric (FK tenant_job_kpi_id->tenant_job_kpis; FK employee_id->employees_core) and would need a kpi_code crosswalk + employee->user mapping + a projection rule into a measurement series. No legacy 'measurement' table exists (legacy %measurement% scan returned none).

**rationale:** [VERIFIED] Derived/aggregation analytics. A generic time-series KPI measurement feed (value numeric(18,4) + source) has no row-for-row legacy source: the legacy %measurement% scan returned nothing, and employee_kpi_targets is a target/actual record per job-KPI, not a measurement stream. Projecting target-actuals into measurements requires a human-authored aggregation/derivation rule -> needs-decision (C). Not B because the gap is the derivation rule itself, not a single source whose FK merely lacks a bridge.

**evidence:** kpi_measurement_value numeric(18,4) NOT NULL, period_start/end, source varchar(64). Legacy %measurement% table scan: none. employee_kpi_targets=412 (actual_value + generated achievement_percent, FK tenant_job_kpi_id->tenant_job_kpis, employee_id->employees_core) — employee-centric per I14 but not a 1:1 measurement source -> derivation needed.

### sys_kpi_metric_definitions
**source:** (none) · **confidence:** medium · **domain:** kpi

**fk_closure:** Only NOT-NULL FK kpi_metric_definition_kpi_id->sys_kpi_definitions(243) resolves. But no legacy SOURCE of per-KPI metric-decomposition rows exists: legacy KPI tables (process_kpis, org_unit_kpis, job_kpis, tenant_job_kpis) are single-valued (one measurement_unit/benchmark/target per KPI row), they do not decompose a KPI into multiple aggregation-typed (SUM|AVG|MIN|MAX|COUNT|RATIO|CUSTOM) sub-metric definitions. Legacy *_metrics tables (skill_demand_metrics, skill_supply_metrics, ai_provider_metrics, ontology_quality_metrics) are unrelated domains, not per-KPI metric definitions.

**rationale:** [VERIFIED] Derived/authored analytics. The table models sub-metrics of a KPI with aggregation type; no legacy public table provides a 1:1 row source. Legacy KPIs carry a single benchmark, not a metric breakdown, and the four legacy '*_metrics' tables are skill/provider/ontology metrics, not KPI metric definitions. Populating requires a human-authored derivation of which metrics compose each KPI -> needs-decision (C). The single FK resolves, so it is not a structural-wall import; it is the absence of any populated 1:1 source.

**evidence:** kpi_id FK->sys_kpi_definitions(243) resolves; aggregation CHECK in {SUM,AVG,MIN,MAX,COUNT,RATIO,CUSTOM}. Legacy table scan for %metric% returned only skill_demand_metrics(200)/skill_supply_metrics(200)/ai_provider_metrics(1)/ontology_quality_metrics(50) — none are per-KPI metric decompositions. Legacy KPI rows are single-valued (one measurement_unit + benchmark).

### sys_user_kpi_evidence
**source:** (none) · **confidence:** medium · **domain:** kpi

**fk_closure:** NOT-NULL FKs: user_kpi_evidence_user_id->sys_users(161), tenant_id->sys_tenancies(2), kpi_id->sys_kpi_definitions(243) — all resolvable if data existed. Per I14/ADR-0024 the person driver is legacy employees (employee_kpi_targets.employee_id->employees_core), crosswalked to sys_users via user_external_code='LEGACY_EMP::'||employees.id or email — NEVER legacy users. But measured_value/target_value are derived achievement data, not a 1:1 import, and the kpi_code crosswalk + period grain need authoring.

**rationale:** [VERIFIED] Person-centric KPI evidence (measured vs target value per user/period). Under I14/ADR-0024 the correct driver is legacy employees + employee_kpi_targets (employee-centric, FK to employees_core), confirmed NOT legacy users (doctrine-correct in stage-1). However the values are a derived/aggregated achievement snapshot requiring a human-authored rule (which target/actual snapshot, period grain, kpi_code crosswalk) -> needs-decision (C). employee_kpi_targets(412) is the nearest source but is target/actual outcome data, not 1:1 user-period evidence rows; conservative tie-breaker keeps it C over a speculative B.

**evidence:** NOT-NULL FKs user_id->sys_users(161)/tenant_id->sys_tenancies(2)/kpi_id->sys_kpi_definitions(243); columns measured_value & target_value numeric(18,4), period_start/end. Legacy employee_kpi_targets=412 keyed employee_id->employees_core (I14 employee-centric driver, crosswalk LEGACY_EMP::, not users — doctrine respected). Derived achievement snapshot -> C.

### sys_objective_reward_rules
**source:** (none) · **confidence:** high · **domain:** reward_blueprint

**fk_closure:** Only required FK is tenant_id->sys_tenancies(count=2), resolvable; rest is code/name + jsonb payload. Target empty; no source for the rule content itself.

**rationale:** [VERIFIED] Derivation-rule table linking objectives to rewards: tenant + code(128) + name(255) + jsonb payload (unique on tenant+code) defining how objective attainment maps to reward outcomes. No 1:1 legacy source: legacy has the objective side (goals=1067, okrs=20, goal_templates=40) and the reward/comp side (bonus_plans=14, merit_cycles=53) but NO table encoding the objective->reward derivation rules; legacy exact scan ~* objective => 0 tables. Populating it needs a human-authored derivation/aggregation rule -> needs-decision derived analytics -> C.

**evidence:** psql \d sys.sys_objective_reward_rules: tenant FK(count=2) + code/name + payload jsonb only; unique(tenant,code). count=0. brownfield.table_mappings => 0 rows. Legacy pg_tables ~* objective => 0 rows. Legacy grep: goals=1067, okrs=20, goal_templates=40 (objective inputs, not reward-mapping rules); no rule/mapping table exists.

### sys_reward_gate_results
**source:** (none) · **confidence:** high · **domain:** reward_blueprint

**fk_closure:** FKs resolve (gate_id->sys_reward_gates count=0, tenant=2, evaluator user=161 nullable SET NULL), but target is empty and there is no source for the analytic content.

**rationale:** [VERIFIED] Derived analytics: evaluation outputs of reward gates -> result_status CHECK(PASSED/WARNING/BLOCKED/ESCALATED/OVERRIDDEN_WITH_REASON), result_score numeric(8,4), evaluator_user_id, override_reason text + payload jsonb. This is a per-gate scoring/assessment result with no 1:1 legacy source (no reward/gate legacy table; bonus_allocations/merit_recommendations are payout amounts, not gate-evaluation verdicts). Populating it requires a human-authored gate-evaluation/derivation rule applied over the (also unpopulated) gates. Classic scores/results/assessments pattern -> C (analytics with a derivation rule), not D scaffold.

**evidence:** psql \d sys.sys_reward_gate_results: status CHECK 5-value verdict array + score numeric(8,4) + evaluator_user_id (SET NULL) + override_reason. count=0. brownfield.table_mappings for sys_reward_gate_results => 0 rows. Legacy exact scan reward|gate => none relevant. No legacy candidate models gate-evaluation results (bonus_allocations=244 / merit_recommendations=208 are monetary payouts, not gate verdicts).

### sys_behavioral_assessments
**source:** (none) · **confidence:** medium · **domain:** sdbi_misc

**fk_closure:** behavioral_assessment_tenant_id -> sys_tenancies(2), behavioral_assessment_user_id -> sys_users(161) via employee-centric crosswalk (employees -> sys_users). FK closure is not the blocker; the blocker is the derivation.

**rationale:** [VERIFIED] Derived behavioral ASSESSMENT (DDL re-read: per-user behavioral_assessment_competency varchar(255), behavioral_assessment_score numeric(5,2) nullable, evidence_payload jsonb, recorded_at). Legacy candidates WITH rows confirmed by exact count: feedback_360=714, competency_review_ratings=465, calibration_discussions=60, calibration_results=50, burnout_assessments=54, competencies=32 (catalog). NONE map 1:1 to a single (competency, score) row: feedback_360 carries an overall rating + free-text + jsonb question_responses (not per-competency numeric); competency_review_ratings splits self_rating vs manager_rating (which to pick / how to collapse is a decision); calibration_* are bands/results not a per-competency numeric(5,2). Collapsing these heterogeneous sources into one normalized score per competency requires a human-authored derivation/aggregation rule (source selection, scale normalization, dedup). Derived score/assessment, no 1:1 source -> C (per criteria, derived scores/assessments go to C even when candidate legacy tables have rows).

**evidence:** Exact counts re-run: feedback_360|714, competency_review_ratings|465 (self+manager split), calibration_discussions|60, calibration_results|50, burnout_assessments|54, competencies|32. Target = single (competency varchar(255), score numeric(5,2)) per user. No 1:1 column alignment to any single source. brownfield.table_mappings = (none). sys_users=161, sys_tenancies=2. Target count=0.

### sys_enterprise_typing_profiles
**source:** (none) · **confidence:** medium · **domain:** sdbi_misc

**fk_closure:** enterprise_typing_tenant_id -> sys_tenancies(2) resolves; nullable analytic FKs resolve to populated dims: sys_activity_classifications=3276, sys_operating_model_catalog=6, sys_enterprise_size_bands=4. All created_by/updated_by nullable. FK closure is fine.

**rationale:** [VERIFIED] Per-tenant enterprise TYPING/assessment profile (DDL re-read: UNIQUE(enterprise_typing_tenant_id), assessed_at timestamp, regulatory_intensity CHECK in {LOW,MEDIUM,HIGH,EXTREME}, employee_count, revenue_eur, country_code + nullable industry/size-band/operating-model FKs). No 1:1 legacy source: I inspected legacy company_profiles (9) and found it is an ATECO/NACE code CATALOG (section/division/group/size codes, auto-populate trigger) — a reference dimension, NOT a per-tenant company profile. Other fragments (industry_profiles=8, tenant_industry_classifications=4, tenant_onboarding_profiles=4, regulatory_frameworks=10) each cover only a slice. The discriminating fields — size_band assignment, operating_model classification, regulatory_intensity rating — have NO legacy column and require a human-authored derivation/aggregation rule that 'types' each tenant (analytics-by-assessment). Derived assessment with no 1:1 source -> C, not A/B.

**evidence:** Re-ran inventory: company_profiles|9 (DDL = ATECO code catalog: profile_code/section_code/division_code/group_code/size_code + trg_profile_auto_populate — NOT a tenant profile), industry_profiles|8, tenant_industry_classifications|4, tenant_onboarding_profiles|4, regulatory_frameworks|10 — all partial/reference, none 1:1. Target UNIQUE(tenant_id) + regulatory_intensity CHECK(LOW/MEDIUM/HIGH/EXTREME) has no legacy analog. Ref dims populated: sys_enterprise_size_bands=4, sys_operating_model_catalog=6, sys_activity_classifications=3276. brownfield.table_mappings = (none). Target count=0.

### sys_person_evidence_records
**source:** (none) · **confidence:** high · **domain:** sdbi_misc

**fk_closure:** person_evidence_record_user_id + recorded_by -> sys_users(161) via employee-centric crosswalk; person_evidence_record_tenant_id -> sys_tenancies(2); polymorphic resource_type/resource_id are SOFT (no FK). FK closure is not the blocker.

**rationale:** [VERIFIED] Polymorphic derived EVIDENCE ledger (DDL re-read: person_evidence_type CHECK across SKILL/LEARNING/KPI/ASSESSMENT/CERTIFICATION/BEHAVIORAL; person_evidence_source CHECK across MANAGER_ASSESSMENT/THREE_SIXTY_ASSESSMENT/CERTIFICATION_VERIFIED/SELF_ASSESSMENT/TRAINING_COMPLETION_REASSESSMENT/EXTERNAL_VALIDATOR/AI_INFERRED; opaque jsonb payload + soft polymorphic resource pointer). I checked the closest-named legacy table self_assessment_evidence (237 rows, employee_id-keyed, evidence_type/title/description/verified) — it is REAL with rows but covers ONLY the SELF_ASSESSMENT source (1 of 7, tied to performance_review_id), i.e. a fragment, not 1:1. The full 6-type x 7-source target is a cross-domain UNION over many heterogeneous facts (employee_skill_assessments=3140, feedback_360=714, employee_certifications=729, employee_training_records=320, self_assessment_evidence=237) plus an AI_INFERRED provenance with no legacy analog. No single populated table is 1:1; materializing requires a human-authored rule deciding which facts become evidence rows, how to classify type/source, and the jsonb shape -> derived analytics -> C.

**evidence:** DDL CHECK enumerates 6 evidence types x 7 sources incl. AI_INFERRED (inferred provenance). self_assessment_evidence|237 (DDL: employee_id, evidence_type, performance_review_id) covers only SELF_ASSESSMENT subset, not 1:1. Candidate facts span many tables: employee_skill_assessments|3140, feedback_360|714, employee_certifications|729, employee_training_records|320 (exact counts re-run). brownfield.table_mappings = (none). FKs resolve: sys_users=161, sys_tenancies=2. Target count=0.

### sys_learning_gaps
**source:** (none) · **confidence:** medium · **domain:** skills_learning

**fk_closure:** user_id (FK sys_users, NOT NULL) and tenant_id resolve via employee crosswalk; position_id/skill_id are nullable. The blocker is NOT FK resolvability but the absence of a 1:1 per-gap legacy source: gap rows must be DERIVED by comparing required vs current proficiency.

**rationale:** [VERIFIED] Derived analytics (verified DDL: learning_gap_required_proficiency vs learning_gap_current_proficiency, learning_gap_score, learning_gap_severity -> computed comparison; feeds sys_gap_closure_actions). The closest legacy artifacts are analytics blobs, NOT 1:1 per-gap sources: skill_gap_analyses=304 stores skill_gaps/skill_matches/recommendations as JSONB per-analysis (verified DDL, analysis-level not row-per-gap, also carries analysis_embedding vector(1536)) and skill_development_paths=65 stores missing_skills as text[]. No deterministic 1:1 legacy table maps to per-(user,skill) gap rows; populating requires a human-authored derivation/aggregation rule (compare position skill requirements vs user proficiency). The 'real source -> never C' tie-breaker does NOT apply because no source maps ~1:1 — the candidates are themselves derived analytics blobs. No brownfield.table_mappings IMPORT/REFERENCE entry for this target (verified blank). Canonical derived-gaps case -> C.

**evidence:** legacy public.skill_gap_analyses count=304 (verified) with skill_gaps/skill_matches/skill_surplus/recommendations as jsonb (analysis-level, not per-gap) + analysis_embedding vector(1536). legacy public.skill_development_paths count=65 (verified) with missing_skills text[] (derived). Target columns learning_gap_score/severity/required_vs_current_proficiency are computed comparisons (verified DDL). No 1:1 row-per-gap legacy table; no brownfield.table_mappings row for sys_learning_gaps (verified blank). Target currently 0 rows.

### sys_critical_role_coverage_status
**source:** (none) · **confidence:** medium · **domain:** succession_talent

**fk_closure:** FKs: critical_role_coverage_status_position_id -> sys_positions (would need bridge), tenant_id (resolvable). Defining columns are aggregation counters: ready_now_count / ready_6mo_count / ready_1y_count (NOT-NULL int default 0) + overall_score numeric(5,2) + computed_at — pure derived aggregation.

**rationale:** [VERIFIED] Derived analytics: an aggregation/rollup of successor readiness per critical position (counts by horizon + overall coverage score). Although legacy critical_roles carries a single categorical succession_status (no_successor/successor_ready/at_risk/etc.), the target stores computed per-horizon COUNTS and a numeric coverage score that must be aggregated from candidate readiness via a human-authored rule. No 1:1 legacy source for the counts -> C.

**evidence:** Target has ready_now/6mo/1y_count integers + overall_score numeric + computed_at + payload (DDL confirmed); legacy critical_roles.succession_status is a single categorical, not the per-horizon counts the target requires. No aggregated-coverage base source in inventory. No prior brownfield mapping.

### sys_employee_position_fit_scores
**source:** (none) · **confidence:** high · **domain:** succession_talent

**fk_closure:** FKs: employee_position_fit_score_user_id -> sys_users (resolvable via LEGACY_EMP:: crosswalk), employee_position_fit_score_position_id -> sys_positions (would need bridge), tenant_id (resolvable). Defining columns: NOT-NULL dimension (CHECK SKILL/KPI/LEARNING/CERTIFICATION/BEHAVIORAL/OVERALL) + NOT-NULL score numeric(5,2) + computed_at — analytics outputs.

**rationale:** [VERIFIED] Derived analytics: a per-dimension FIT SCORE of an employee against a position. No legacy table stores such computed fit scores; the inventory holds raw position_skill_requirements (1632) as requirements but no employee-position fit score table. Must be computed from skills/KPI/learning data via a human-authored multi-dimension scoring rule. No 1:1 legacy source -> C (regardless of the additional position-bridge need; derived-analytics nature dominates).

**evidence:** Target enforces dimension CHECK enum + NOT-NULL score numeric(5,2) per (user,position,dimension) (DDL confirmed); F0 inventory has position_skill_requirements (1632) raw requirements but no computed fit-score table; derivation rule required. No prior brownfield mapping.

### sys_readiness_scores
**source:** (none) · **confidence:** medium · **domain:** succession_talent

**fk_closure:** FKs: readiness_score_user_id -> sys_users (resolvable), readiness_score_position_id -> sys_positions (would need bridge), tenant_id (resolvable). readiness_score_horizon is NOT NULL (CHECK enum) and readiness_score_value numeric(5,2) is the analytics output with no 1:1 legacy column.

**rationale:** [VERIFIED] Derived analytics: numeric readiness SCORE per user x position x horizon (computed_at). Legacy only has categorical readiness_level on succession_candidates (which lands in sys_successor_candidates, not as a numeric value here). The numeric readiness_score_value requires a human-authored scoring/derivation rule. Distinct from sys_successor_candidates (categorical, B) — this is the numeric-score variant -> C.

**evidence:** Target readiness_score_value numeric(5,2) + NOT-NULL readiness_score_horizon CHECK enum + payload (DDL confirmed); no numeric readiness base source in F0 inventory (succession_candidates.readiness_level is categorical only). No prior brownfield mapping.

### sys_succession_scores
**source:** (none) · **confidence:** medium · **domain:** succession_talent

**fk_closure:** FKs: succession_score_user_id -> sys_users (resolvable via crosswalk), succession_score_position_id -> sys_positions (would need bridge), tenant_id (resolvable). The defining payload succession_score_value numeric(5,2) + horizon + computed_at is a computed score with no 1:1 legacy column.

**rationale:** [VERIFIED] Derived analytics: a computed succession-fitness SCORE per user x position x horizon (succession_score_computed_at). Searched inventory — no legacy table holds such a numeric score; only categorical readiness in succession_candidates and the derived mv_talent_signals (a materialized view, not a base source). Must be derived by an aggregation/scoring rule (human-authored). Even if a position bridge would also be needed, the table is fundamentally derived-analytics with no 1:1 source -> C.

**evidence:** Target succession_score_value numeric(5,2) + succession_score_computed_at + payload jsonb (DDL confirmed); no scores base table in F0 inventory; mv_talent_signals is a derived MV (is_high_potential bool, attrition_risk_score int) not a succession-score source. No prior brownfield mapping.

### sys_successor_readiness
**source:** (none) · **confidence:** medium · **domain:** succession_talent

**fk_closure:** FKs: successor_readiness_candidate_id -> sys_successor_candidates (parent is itself B-blocked) and tenant_id (resolvable). The discriminating attribute successor_readiness_score numeric(5,2) + successor_readiness_horizon + payload jsonb is a derived assessment snapshot with no 1:1 legacy column.

**rationale:** [VERIFIED] Derived-analytics table: a numeric readiness SCORE + horizon snapshot per candidate, assessed_at timestamped. Searched inventory and semantics — legacy succession_candidates carries only a categorical readiness_level (CHECK enum ready_2_years etc.) which already lands in sys_successor_candidates.successor_candidate_readiness_level, NOT a numeric score here. No legacy numeric readiness score table exists. Populating requires a human-authored scoring/derivation rule -> C. Conservative tie-breaker: no 1:1 source with count>0 -> stays C.

**evidence:** Target column successor_readiness_score numeric(5,2) + horizon varchar + payload jsonb (DDL confirmed); legacy succession_candidates.readiness_level is categorical only and maps to the candidate table, not here; no numeric-score source in F0 inventory (only derived mv_talent_signals). No prior brownfield mapping.

### sys_talent_scores
**source:** (none) · **confidence:** medium · **domain:** succession_talent

**fk_closure:** FKs: talent_score_user_id -> sys_users (resolvable via LEGACY_EMP crosswalk), tenant_id (resolvable). No position FK. Defining columns talent_score_potential / talent_score_performance numeric(5,2) + talent_score_band varchar are analytics outputs with no 1:1 legacy column.

**rationale:** [VERIFIED] 9-box talent analytics (potential x performance band). Re-inspected the closest legacy artifact mv_talent_signals (270 rows): it is a derived MATERIALIZED VIEW exposing review_avg_12m, mood/stress avgs, attrition_risk_score int, is_high_potential BOOLEAN — NOT a 1:1 source for potential/performance numeric(5,2) scores or the categorical band. Producing talent_score_potential/performance/band needs a human-authored derivation rule (the boolean is_high_potential is not the numeric pair). No 1:1 base source -> C.

**evidence:** mv_talent_signals DDL confirmed = materialized view, columns is_high_potential boolean + attrition_risk_score integer (no potential/performance numeric scores); target has talent_score_potential/performance numeric(5,2) + band varchar(32). Derivation required. No prior brownfield mapping.

## Bucket D — detail (20)

### sys_organization_hierarchies
**source:** (none) · **confidence:** high · **domain:** org

**fk_closure:** All FKs resolve: ancestor_id + descendant_id -> sys.sys_organization_units (26 rows, verified) ON DELETE CASCADE; hierarchy_tenant_id -> sys.sys_tenancies (2 rows, verified) ON DELETE CASCADE. No person/user FK. PK (ancestor_id, descendant_id) + hierarchy_depth smallint. All referenced sys tables populated, but no source rows to insert.

**rationale:** [VERIFIED] Closure table (ancestor/descendant/depth) — a derived structural artifact, NOT a 1:1 legacy table. Re-confirmed: target empty (count=0). Re-ran legacy search for closure/ancestor/descendant/hierarchy candidates across all public.* tables — ZERO org hierarchy/closure tables exist (the only '_history'-pattern matches are employee_skill_history / salary_history / recruiting_candidate_history, all unrelated to org structure). The closure is the deterministic transitive closure of the adjacency-list parent pointer that ALREADY lives in legacy public.org_units.parent_id (verified 70/76 rows non-null) and is mapped to sys.sys_organization_units (self-FK organization_unit_parent_id). It is mechanically computable via a recursive CTE from sys.* data already loaded — app/engine-generated, no external legacy source, no human-authored aggregation rule (so not C, which needs a derivation DECISION; the closure is a mechanical derivation with one correct answer). Tie-breaker: derived structure with NO populated legacy source positively found -> D.

**evidence:** Target empty (verified count=0 via SELECT count(*) FROM sys.sys_organization_hierarchies). DDL: PK(ancestor_id,descendant_id) + hierarchy_depth smallint NOT NULL + hierarchy_tenant_id NOT NULL; FKs -> sys_organization_units(26, verified) & sys_tenancies(2, verified), all ON DELETE CASCADE. Legacy pg_tables scan (ILIKE %branch%/%hierarch%/%closure%/%ancestor%/%_history%) returned only employee_skill_history, salary_history, recruiting_candidate_history — NO org closure/hierarchy table. Adjacency source: legacy public.org_units total=76, with_parent=70 (parent_id self-ref). No brownfield.table_mappings classification row exists for this target.

### sys_organization_unit_history
**source:** (none) · **confidence:** high · **domain:** org

**fk_closure:** FKs: organization_unit_history_unit_id -> sys.sys_organization_units (26, verified) ON DELETE CASCADE; organization_unit_history_tenant_id -> sys.sys_tenancies (2, verified) ON DELETE CASCADE; organization_unit_history_actor_user_id -> sys.sys_users (161, verified, nullable ON DELETE SET NULL). All referenced sys tables populated, but no source rows to insert.

**rationale:** [VERIFIED] Audit/change-log table: organization_unit_history_change_type CHECK in {CREATED,RENAMED,MOVED,MERGED,SPLIT,DEACTIVATED,REACTIVATED}, jsonb old_value/new_value default '{}', effective_at default now(), actor_user_id, notes. Pattern '*_history' -> D unless a POPULATED legacy source is positively found. Re-confirmed: NO legacy org-unit change-log/history table exists. Exhaustive legacy '_history' search returned ONLY employee_skill_history / salary_history / recruiting_candidate_history (person/comp-centric, NOT org units). It is an app-generated audit trail materialized at runtime as org units are mutated through the API, not imported from legacy. Bucket D (*_history, app-generated, no source) confirmed.

**evidence:** Target empty (verified count=0). DDL: change_type varchar(32) CHECK (CREATED/RENAMED/MOVED/MERGED/SPLIT/DEACTIVATED/REACTIVATED), old_value/new_value jsonb DEFAULT '{}', effective_at timestamptz DEFAULT now(), actor_user_id FK -> sys_users(161, verified) ON DELETE SET NULL, created_at DEFAULT now(). Legacy '_history' table scan returned only employee_skill_history, salary_history, recruiting_candidate_history — no org-unit history/changelog. Legacy org candidates present (org_units 76, tenant_org_units 47, org_unit_templates 225, org_unit_kpis 100, org_unit_tasks 100, org_unit_process_mapping 12) — none is a history/audit table. No brownfield.table_mappings classification row exists for this target.

### sys_blueprint_activations
**source:** (none) · **confidence:** high · **domain:** reward_blueprint

**fk_closure:** FKs resolvable (tenant=2, variant->sys_blueprint_variants=1, created_by/updated_by user=161 nullable SET NULL), but target empty (count=0); no source row data.

**rationale:** [VERIFIED] *_activations tail-pattern: tenant-scoped lifecycle record activating a blueprint VARIANT (status CHECK PROPOSED/ACTIVE/SUSPENDED/RETIRED, effective_from/to, one-active-per-tenant partial unique index, set_updated_at trigger). App-generated runtime governance artifact created when a tenant activates a variant. Inspected legacy blueprint_runs(7) \d: it is an industry-profile org-design GENERATOR run (run_mode greenfield/overlay, template_id->blueprint_templates, produces blueprint_results=484 like org_unit_suggestion/skill_gap) — semantically unrelated to reward-blueprint variant activation lifecycle, and there is NO legacy blueprint_variants table at all. False friend confirmed. Tie-breaker: *_activations -> D unless a POPULATED legacy source positively found; none found.

**evidence:** psql \d sys.sys_blueprint_activations: status CHECK lifecycle + one_active_per_tenant partial unique + set_updated_at trigger; variant FK->sys_blueprint_variants(count=1). count=0. brownfield.table_mappings => 0 rows. Legacy blueprint_runs \d = run_mode greenfield/overlay, FK->blueprint_templates (org-design generator); legacy pg_tables ~* variant|activation => none. blueprint_runs=7 / blueprint_templates=3 / blueprint_results=484 all org-design generator, not variant activation.

### sys_blueprint_overrides
**source:** (none) · **confidence:** high · **domain:** reward_blueprint

**fk_closure:** FKs resolvable (activation->sys_blueprint_activations count=0, process->sys_blueprint_process_registry=23, created_by/updated_by user=161 nullable SET NULL), but target empty; no source data.

**rationale:** [VERIFIED] *_overrides tail-pattern: per-process inclusion override (CHECK IN/PARTIAL/OUT) on a blueprint activation, with rationale text + metadata jsonb + set_updated_at trigger -> human/app-generated configuration delta on top of an activation. The only brownfield table_mappings rows present are 4 REFERENCE_ONLY entries from semantically unrelated sources (benchmark_configs, benchmark_reports, holidays, tenant_industry_classifications) -> NOT a real 1:1 import source. The 2 legacy *_override tables (employee_permission_overrides, permission_overrides) are RBAC permission overrides, false friends. Tie-breaker: *_overrides -> D unless a POPULATED legacy import source positively found; none (REFERENCE_ONLY != import source).

**evidence:** psql brownfield.table_mappings JOIN source_tables for sys_blueprint_overrides => benchmark_configs / benchmark_reports / holidays / tenant_industry_classifications, ALL classification=REFERENCE_ONLY (noise, not IMPORT). \d sys.sys_blueprint_overrides: inclusion CHECK(IN/PARTIAL/OUT) + activation+process composite unique + set_updated_at trigger. count=0. process FK->sys_blueprint_process_registry(count=23), activation FK->sys_blueprint_activations(count=0). Legacy ~* override => employee_permission_overrides, permission_overrides (RBAC, false friends).

### sys_reward_gates
**source:** (none) · **confidence:** high · **domain:** reward_blueprint

**fk_closure:** NOT-NULL FKs resolve (tenant=2, catalog sys_reward_gate_catalog=7); optional user=161/position=162 resolve. But target is empty (count=0) and no source data exists to populate rows.

**rationale:** [VERIFIED] v5-native reward-blueprint governance/config: a gate INSTANCE keyed by period_start/end + catalog (+optional user/position) with jsonb payload, fed by sys_reward_gate_catalog (7 config rows). No legacy public table models 'reward gates' (exact name scan reward|gate => only employee_permission_overrides/permission_overrides, RBAC false friends). Inspected bonus_plans(14): it is the compensation/payout domain (bonus_type annual/quarterly/spot, total_budget, payout_date, calculation_method) = real bonus money to employees, NOT a period+catalog gate instance, no column maps to catalog_id. merit_cycles(53) = salary-increase guideline cycles, also compensation. No brownfield table_mappings row, no source_tables named reward/gate. App/engine-generated config with no positively-found populated legacy source -> conservative D.

**evidence:** psql \d sys.sys_reward_gates: catalog_id NOT NULL FK->sys_reward_gate_catalog(count=7), period_start/end date, payload jsonb. sys.sys_reward_gates count=0. brownfield.table_mappings for sys_reward_gates => 0 rows. Legacy exact name scan (pg_tables ~* reward|gate) => employee_permission_overrides, permission_overrides only. bonus_plans \d = compensation/payout (false friend), merit_cycles \d = merit increase cycles (false friend).

### sys_auth_sessions
**source:** session (0 rows) · **confidence:** high · **domain:** runtime_app

**fk_closure:** FKs auth_session_user_id->sys_users(161) and auth_session_tenant_id->sys_tenancies(2) would resolve, but irrelevant: zero source rows to import. Both are NOT-NULL but only matter if a source existed.

**rationale:** [VERIFIED] Runtime auth-session table (inet IP, user_agent, expires_at NOT NULL, revoked_at) generated by the API at login. The only name-matching legacy candidate public.session has count(*)=0 (re-verified on VM). Inventory search for *session* yields only domain sessions (calibration_sessions=86, mentorship_sessions=355, org_chart_generation_sessions=3, analysis_sessions=2, rag_sessions=30, preboarding_sessions=30) — none is an auth/login session. App-generated runtime artifact per the D criteria (sessions) with no populated source -> D.

**evidence:** VM re-run: SELECT count(*) FROM public.session = 0. Target \d: auth_session_ip(inet), auth_session_user_agent, auth_session_expires_at NOT NULL, FK user_id->sys_users(161), tenant_id->sys_tenancies(2). Inventory grep session = only domain sessions, no auth session. brownfield.table_mappings = (none).

### sys_payroll_handoff_records
**source:** (none) · **confidence:** high · **domain:** runtime_app

**fk_closure:** Only FK is payroll_handoff_record_tenant_id->sys_tenancies(2), resolvable. No person FK. But no populated source models an actual handoff/transmission event, so FK resolvability is moot.

**rationale:** [VERIFIED] (evidence corrected vs stage-1) The target is an integration/runtime engine output recording a transmitted payroll handoff (period_start/end, recipient_system, jsonb payload, handed_off_at, status PENDING/SENT/ACKNOWLEDGED/REJECTED default 'SENT'). Candidate legacy tables: payroll_export_jobs has 1 row whose status is 'validation_failed' (NOT 'draft' as stage-1 claimed) — i.e. an export job that failed validation and never reached transmission, NOT a handoff/transmission record; payroll_export_files=0, payroll_export_employees=0, payroll_transmission_log=0 (the table that would model actual transmission events is empty). The generic export_jobs(45) is a different domain (config_id/file_url/expires_at generic data exports, no payroll recipient_system/handoff semantics). No populated source holds real handoff/transmission events; the lone failed export job is not a deterministic 1:1 handoff source. App-generated integration artifact -> D.

**evidence:** VM re-run counts: payroll_export_jobs=1 (the single row status='validation_failed', verified by id query), payroll_export_files=0, payroll_export_employees=0, payroll_transmission_log=0. payroll_export_jobs \d = export-pipeline shape (progress_percent, validation_errors jsonb, export_file_path) not a handoff record. export_jobs(45) \d = generic export (config_id/file_url/expires_at). Target \d: recipient_system, payload jsonb, status CHECK (PENDING/SENT/ACKNOWLEDGED/REJECTED) default SENT, FK tenant_id->sys_tenancies(2). brownfield.table_mappings = (none).

### sys_user_preferences
**source:** (none) · **confidence:** high · **domain:** runtime_app

**fk_closure:** FK user_preference_user_id->sys_users(161) resolvable and user_preference_user_uq UNIQUE per user; tenant_id nullable. But there is no meaningful populated, doctrine-valid source to import from.

**rationale:** [VERIFIED] (evidence corrected vs stage-1) Target columns are user_preference_theme (dark/light CHECK, default 'dark') and user_preference_palette (balanced/cool-ocean/warm-sunset/brand-mono CHECK, default 'balanced') — UI/UX preferences app-generated by the P1 milestone (locked decision 3c). Stage-1 claimed 'no legacy table carries theme/palette' — that is FALSE: an information_schema column scan found legacy users.theme_preference (varchar 8) and users.palette_preference_id (varchar 32). HOWEVER these refute to D for two compounding reasons: (1) they are essentially unpopulated — only 1/274 users has a non-null theme_preference (value 'dark') and 1/274 a non-null palette_preference_id (273 NULL); a single stray value is not a populated source. (2) They sit on legacy `users` (the auth shell / FALSE FRIEND), and sys_user_preferences is a sys_user_* person-centric target which under I14/ADR-0024 must NOT be driven by legacy `users`. The notification_preferences table (266 rows) is a different concept (email/in-app toggles + quiet hours, zero theme/palette). dashboard_presets.theme_config(30)/rbp_dashboards.theme_config(11) are dashboard-presentation JSONB, not per-user UI prefs. App-generated UI preference, no doctrine-valid populated source -> D.

**evidence:** Target \d: only theme(dark/light)+palette(4-value) CHECK cols, default dark/balanced, user_uq unique. VM info_schema scan: users.theme_preference + users.palette_preference_id EXIST but theme_pref non-null=1/274, palette non-null=1/274 (273 NULL); theme value dist = NULL|273, dark|1. notification_preferences \d = email_enabled/in_app_enabled/goal_reminders/quiet_hours_* (no theme/palette). dashboard_presets=30, rbp_dashboards=11 hold theme_config JSONB (dashboard-level). brownfield.table_mappings = (none).

### sys_visualization_exports
**source:** (none) · **confidence:** high · **domain:** runtime_app

**fk_closure:** FK export_graph_id->sys_visualization_graphs(1) resolvable, export_layout_id nullable; but exports are render artifacts with no legacy source.

**rationale:** [VERIFIED] sys_visualization_* renderer/app-generated table recording produced graph-export artifacts (export_format CHECK SVG/PDF/PNG/GENERIC_JSON/REACT_FLOW_JSON/MERMAID, payload_uri, generated_at). These are engine outputs created when a user exports a graph. No legacy table holds graph-export records: legacy export_jobs(45) and payroll_export_jobs/files/configurations concern generic data/payroll exports (file_url/config_id/period), a different domain — none produce SVG/MERMAID/REACT_FLOW graph renders. On the D scaffold list; no populated graph-export source -> D.

**evidence:** Target \d: export_format CHECK (SVG/PDF/PNG/GENERIC_JSON/REACT_FLOW_JSON/MERMAID), export_graph_id->sys_visualization_graphs(=1), export_payload_uri. Legacy export_jobs(45) \d = generic data export (config_id/file_url/expires_at); payroll_export_* = payroll domain. No graph-render export source. brownfield.table_mappings = (none).

### sys_visualization_layouts
**source:** (none) · **confidence:** high · **domain:** runtime_app

**fk_closure:** FK layout_graph_id->sys_visualization_graphs(1) resolvable, but no source: layout-engine descriptors are generated by the layout engine.

**rationale:** [VERIFIED] sys_visualization_* renderer/app-generated table holding layout-engine descriptors (layout_engine CHECK AUTO/DAGRE/ELK/HIERARCHICAL/TREE/SWIMLANE/TIMELINE/FORCE_DIRECTED/MANUAL, version, is_default, layout_metadata jsonb), produced by the visualization layout engine at render time. The table is currently empty (0 rows) and no legacy table provides graph-layout-engine records — org_chart_* store finished excalidraw JSONB, not an engine/version descriptor. On the D scaffold list; no populated relational source -> D.

**evidence:** Target \d: layout_graph_id->sys_visualization_graphs(=1), layout_engine CHECK (9 engine values), is_default, version. sys.sys_visualization_layouts count=0. No legacy layout-engine table in inventory (org_chart_* are JSONB blobs). brownfield.table_mappings = (none).

### sys_visualization_node_layouts
**source:** (none) · **confidence:** high · **domain:** runtime_app

**fk_closure:** FK layout_id->sys_visualization_layouts (0 rows — parent empty) and node_id->sys_visualization_nodes(158). The parent layout table is empty, so there is nothing to anchor positions to; and no legacy relational coordinate source exists regardless.

**rationale:** [VERIFIED] sys_visualization_* renderer/app-generated table holding computed/manual x/y/z node coordinates per layout (numeric(10,2) x NOT NULL, y NOT NULL, z, locked). Coordinates are produced by the layout engine or user drag, not stored relationally in any legacy table — legacy org charts keep geometry inside excalidraw_format JSONB. It also depends on sys_visualization_layouts which is itself empty (0 rows), so there is no parent layout to attach positions to. App-generated, no relational source -> D.

**evidence:** Target \d: x/y NOT NULL numeric(10,2), z, locked, layout_id->sys_visualization_layouts (count=0), node_id->sys_visualization_nodes(=158), unique (layout_id,node_id). No legacy relational coordinate source (org_chart geometry is in excalidraw_format jsonb). brownfield.table_mappings = (none).

### sys_visualization_styles
**source:** (none) · **confidence:** high · **domain:** runtime_app

**fk_closure:** FK style_graph_id->sys_visualization_graphs(1) resolvable, but irrelevant: no legacy relational source for per-node-type styling.

**rationale:** [VERIFIED] sys_visualization_* renderer/app-generated table holding per-graph node-type color/icon style overrides (style_node_type, style_color, style_icon, style_metadata jsonb). No legacy table models graph node styling relationally. The only graph-ish legacy candidates (org_chart_snapshots=3, org_chart_templates=9, tenant_org_charts=4, org_chart_generation_sessions=3) embed all presentation inside JSONB blobs (tree_structure, excalidraw_format, template_structure) under a different org-chart domain model — there is no relational per-node-type style table to map 1:1. Explicitly on the D scaffold list (sys_visualization_*); no populated relational source found -> D.

**evidence:** Target \d: style_graph_id->sys_visualization_graphs(=1), style_node_type/color/icon. Inventory grep (visual|graph|layout|render|node_style|coord) yields only org_chart_*/tenant_org_charts. VM \d org_chart_snapshots = tree_structure/excalidraw_format/employees_map jsonb (blob, not relational style). brownfield.table_mappings = (none).

### sys_activity_classification_mappings
**source:** (none) · **confidence:** medium · **domain:** sdbi_misc

**fk_closure:** Both FKs (source_id, target_id) -> sys_activity_classifications which is populated (3276 rows), so a mapping COULD be inserted FK-wise. FK closure is not the issue; the absence of a populated crosswalk source is.

**rationale:** [VERIFIED] Self-referential SKOS-style crosswalk (DDL re-read: pairs two sys_activity_classifications rows, kind CHECK in {EXACT,NARROWER,BROADER,RELATED,APPROXIMATE} + confidence numeric(4,3), UNIQUE(source,target)). DECISIVE finding: sys_activity_classifications is an ATECO/NACE economic-activity taxonomy (scheme dist ATECO=2210, NACE=1066, total 3276) sourced 1:1 from legacy industry_classifications (count 3276 EXACT match; same self-referential parent_code hierarchy, level, classification_system NACE/ATECO). But industry_classifications is the DIMENSION (a parent_code tree), NOT a separate (source_code, target_code, mapping_kind, confidence) crosswalk table — there is NO legacy ATECO<->NACE equivalence crosswalk. The legacy crosswalks that exist (occupation_industry_classifications=4565, onet_esco_mappings=135, skill_taxonomy_extensions=52) are cross-ENTITY (occupation<->industry) or cross-taxonomy OCCUPATION/SKILL alignments, none a within-industry-taxonomy classification<->classification SKOS map. brownfield.table_mappings classifies this target REFERENCE_ONLY. No positively-found populated source -> reference scaffold authored from an alignment rule -> D (tie-breaker: reference scaffold stays D unless a POPULATED legacy source is found; none was).

**evidence:** brownfield.table_mappings.table_mapping_classification = REFERENCE_ONLY (re-verified, the only one of the 5 with any mapping). sys_activity_classifications scheme dist: ATECO=2210, NACE=1066 (total 3276) = exact rowcount of legacy industry_classifications (3276) -> that legacy table is the DIMENSION source, not a crosswalk (self-FK parent_code hierarchy, no source/target mapping cols). Nearest legacy crosswalks are cross-entity/cross-occupation: occupation_industry_classifications|4565, onet_esco_mappings|135, skill_taxonomy_extensions|52. No same-taxonomy industry-classification->industry-classification source. Target count=0. Both FKs -> sys_activity_classifications=3276.

### sys_user_professional_experiences
**source:** (none) · **confidence:** high · **domain:** sdbi_misc

**fk_closure:** All NOT-NULL FKs resolve: user_prof_exp_user_id + created_by/updated_by -> sys_users(161), user_prof_exp_tenant_id -> sys_tenancies(2), via employee-centric crosswalk (employees -> sys_users, NEVER legacy users). created_by/updated_by nullable. FK closure is NOT the blocker.

**rationale:** [VERIFIED] Records EXTERNAL prior-employer CV work history (employer varchar(255), role_title varchar(255), industry, start/end date, free-text description) — confirmed by re-reading the DDL. I re-ran the exhaustive grep (experien|employment|prior|work_history|previous|cv|resume|career_hist|past_role|tenure|external) over the 588-table inventory: ZERO external-employer-history tables. I also scanned legacy information_schema for any person column matching company_name|employer_name|organization_name|prev_company|former_employer — only job_market_postings / job_postings_raw matched (job-ad sources, not person history). The scattered 'years_experience' (candidates, employee_skills) are scalar attributes, not structured employment records. The employees_* satellites (core/hr/payroll/pii, 270 each) + employee_contracts describe the CURRENT employer relationship only. No populated legacy source; ESS self-entry satellite filled at app runtime. Target empty (0 rows). 'has source' requires positive count>0 which is absent -> D.

**evidence:** Inventory grep for experience/employment/prior/work_history/cv/resume = NO match. information_schema scan for external-employer cols = only job_market_postings/job_postings_raw (job ads). candidates.years_experience / employee_skills.years_experience are scalar counts, not history. Target sys_user_professional_experiences count=0. brownfield.table_mappings classification for this target = (none). FKs resolve: sys_users=161, sys_tenancies=2 (re-run).

### sys_seed_acquisition_runs
**source:** (none) · **confidence:** high · **domain:** seed_engine

**fk_closure:** FKs are app-runtime only: seed_acquisition_run_tenant_id->sys_tenancies (ON DELETE CASCADE), created_by/updated_by->sys_users (nullable, ON DELETE SET NULL actor refs). Root of the seed-engine chain (referenced by sys_seed_candidate_records). No external legacy anchor.

**rationale:** [VERIFIED] Root of an AI-driven seed-acquisition engine. Verified DDL columns prove it: seed_acquisition_run_prompt_template (text), seed_acquisition_run_source_registry_payload (jsonb '[]' default), seed_acquisition_run_code (generic), status CHECK RUNNING/COMPLETED/FAILED/CANCELLED. Re-ran count(*)=0 and confirmed brownfield.table_mappings classification=<none>. The two name-collision candidates are positively a DIFFERENT subsystem: crawl_runs (count re-verified=1) is a job-posting crawler (columns postings_found/postings_saved/skills_extracted, FK config_id->crawler_configs, feeds job_postings_raw); enrichment_jobs (count=18) is a field-level LLM enrichment engine that patches an EXISTING target_table/target_record_id/field_name with merge policies + idempotency + llm_cost_eur, not a generic prompt-template/source-registry acquisition run. No legacy table has a prompt_template + source_registry_payload analogue. sys_seed_* prefix + no populated 1:1 source -> D per tie-breaker.

**evidence:** sys.sys_seed_acquisition_runs count(*)=0 (re-run); brownfield.table_mappings='<none>' (re-run); legacy crawl_runs count=1 (DDL: postings_found/postings_saved/skills_extracted, FK crawler_configs, no prompt_template/source_registry); legacy enrichment_jobs count=18 (DDL: target_table/target_record_id/field_name/merge policy/idempotency - patches existing records, not seed acquisition).

### sys_seed_approval_decisions
**source:** (none) · **confidence:** high · **domain:** seed_engine

**fk_closure:** FK internal: seed_approval_decision_candidate_id->sys_seed_candidate_records (bucket D, empty, ON DELETE CASCADE), approver_user_id->sys_users (nullable). Human-in-the-loop decision log generated by the engine workflow; no external legacy source.

**rationale:** [VERIFIED] Human approval-decision audit log of the seed engine (status APPROVED/REJECTED/NEEDS_CHANGES, rationale, decided_at). App-generated workflow output keyed entirely on an empty bucket-D candidate table. Re-ran count(*)=0, no brownfield mapping. The only semantic legacy collision, leave_approval_steps (count re-verified=89), is HR leave-workflow approvals - a wholly different domain that does not map to generic seed-candidate approvals; no 1:1 populated legacy source exists. sys_seed_* prefix + approval/decision log semantics + empty bucket-D parent -> D (conservative tie-breaker holds).

**evidence:** sys.sys_seed_approval_decisions count(*)=0 (re-run); brownfield mapping='<none>'; legacy leave_approval_steps count=89 (HR leave domain, unrelated to seed candidates); FK target sys_seed_candidate_records empty (bucket D).

### sys_seed_candidate_records
**source:** (none) · **confidence:** high · **domain:** seed_engine

**fk_closure:** FKs internal to the seed engine: seed_candidate_record_run_id->sys_seed_acquisition_runs (bucket D, empty, ON DELETE CASCADE), seed_candidate_record_tenant_id->sys_tenancies. Domain is a free varchar(64) discriminator, natural_key varchar(512) engine-assigned, payload generic jsonb -> domain-agnostic engine staging, no external legacy key.

**rationale:** [VERIFIED] Generic AI-acquisition candidate staging row produced by the engine. Verified DDL: seed_candidate_record_domain is free varchar, seed_candidate_record_payload is generic jsonb, seed_candidate_record_natural_key engine-assigned, validation_status CHECK PENDING/PASSED/FAILED/WARNING/APPROVED/REJECTED/APPLIED. Re-ran count(*)=0, no brownfield mapping. Legacy collisions positively ruled out at schema level: public.candidates (count re-verified=100, NOT 96 as the stage-1 evidence string stated - the 96 was likely recruiting_candidates; bucket unaffected) is an ATS recruiting person table (first_name/last_name/email/resume_url/linkedin_url) - different domain; public.enrichment_candidates (count=38) is field-level LLM enrichment proposals (entity_type/field_name/candidate_value/confidence/fact_hash, FK job_id->enrichment_jobs) - single-field patches of existing records, not whole-record seed candidates. Neither maps 1:1 to this generic engine staging table; depends on an empty bucket-D parent run. sys_seed_* + no populated 1:1 source -> D.

**evidence:** sys.sys_seed_candidate_records count(*)=0 (re-run); brownfield mapping='<none>'; legacy candidates count=100 (DDL: ATS person table first/last/email/resume_url, distinct schema); enrichment_candidates count=38 (DDL: entity_type/field_name/candidate_value/confidence/fact_hash, FK enrichment_jobs - field-level not record-level); parent sys_seed_acquisition_runs empty (bucket D).

### sys_seed_source_evidence
**source:** (none) · **confidence:** high · **domain:** seed_engine

**fk_closure:** FK internal: seed_source_evidence_candidate_id->sys_seed_candidate_records (bucket D, empty, ON DELETE CASCADE). url + content_hash + retrieved_at + jsonb payload = web-retrieval provenance captured by the engine at runtime; no external legacy anchor.

**rationale:** [VERIFIED] Web-source provenance evidence (url, content_hash, retrieved_at) captured by the AI seed-acquisition engine per candidate. Pure runtime/engine artifact. Re-ran count(*)=0, no brownfield mapping. Legacy collisions are unrelated and distinct: self_assessment_evidence (count re-verified=237) is competency self-assessment attachments (person/skill domain); enrichment_source_snapshots (count=27 in inventory) belongs to the separate enrichment subsystem (keyed to enrichment_jobs/enrichment_candidates, captures snapshots of crawled sources for field enrichment, not generic seed-candidate web evidence). Neither is a 1:1 source; depends on an empty bucket-D candidate table. sys_seed_* + provenance/runtime artifact -> D.

**evidence:** sys.sys_seed_source_evidence count(*)=0 (re-run); brownfield mapping='<none>'; legacy self_assessment_evidence count=237 (self-assessment domain, unrelated); enrichment_source_snapshots=27 (separate enrichment subsystem, FK enrichment chain); FK target sys_seed_candidate_records empty (bucket D).

### sys_seed_validation_results
**source:** (none) · **confidence:** high · **domain:** seed_engine

**fk_closure:** FK internal: seed_validation_result_candidate_id->sys_seed_candidate_records (bucket D, empty, ON DELETE CASCADE). rule_code + status (PASSED/FAILED/WARNING/SKIPPED) + message + jsonb payload = engine-emitted validation output, no external legacy source.

**rationale:** [VERIFIED] Per-rule validation output emitted mechanically by the seed engine during the candidate validation phase (rule_code, status PASSED/FAILED/WARNING/SKIPPED). Although named *_results (superficially derived-analytics-like, which would suggest C), it is deterministically produced by engine validation rules - not a human-authored derivation/aggregation - and it is part of the sys_seed_* engine chain keyed on an empty bucket-D candidate table, so D not C. Re-ran count(*)=0, no brownfield mapping. Inventory grep for seed/validation returned only payroll_validation_rules (11, a payroll rule catalog - rules not results, different domain) and self_assessment/enrichment subsystem tables; no legacy table emits generic seed-rule validation results. sys_seed_* tie-breaker -> D.

**evidence:** sys.sys_seed_validation_results count(*)=0 (re-run); brownfield mapping='<none>'; inventory grep (validation): only payroll_validation_rules=11 (payroll rule catalog, not seed-rule results); no generic 'validation_results'/seed-rule source in legacy; FK target sys_seed_candidate_records empty (bucket D).

### sys_position_skill_requirement_history
**source:** (none) · **confidence:** high · **domain:** skills_learning

**fk_closure:** FK history_psr_id -> sys_position_skill_requirements (currently 0 rows) NOT NULL; history_tenant_id/position_id/skill_id NOT NULL, actor_user_id nullable. The table can only populate as a side-effect of UPDATEs to the parent requirement table, which is itself empty.

**rationale:** [VERIFIED] *_history audit/change-log table (verified DDL: old_proficiency/new_proficiency, old_weight/new_weight, change_reason, actor_user_id, effective_at -> classic row-level diff change-log shape). Per the *_history -> D tie-breaker, stays D unless a POPULATED legacy source is positively found: there is NO brownfield.table_mappings row for this target (classification blank, verified) and no legacy row-level proficiency-change audit source exists in the inventory. App-generated change log written on UPDATE of sys_position_skill_requirements (empty). No-source / app-generated.

**evidence:** Target FK position_skill_requirement_history_psr_id -> sys_position_skill_requirements (verified 0 rows). brownfield.table_mappings has NO row for sys_position_skill_requirement_history (classification empty, verified). Naming pattern *_history; columns are old/new proficiency+weight diff + actor + effective_at (change-log shape, verified DDL). Target currently 0 rows.

