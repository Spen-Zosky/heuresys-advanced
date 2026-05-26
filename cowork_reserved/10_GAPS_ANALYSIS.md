# Gaps Analysis — Real vs Apparent

**Doc ID**: `10_GAPS_ANALYSIS`
**Author**: Cowork forensic agent (autonomous nighttime task)
**Created**: 2026-05-20
**Scope**: classificazione 4-tier (in realtà 5, incluso E DESIGN INTENTIONAL) dei gap tra `heuresys_platform.public` (~700k rows / 582 tabelle) e `heuresys_advanced.sys.*` (~37k rows / 118 tabelle, 38 popolate / 80 vuote).
**Cross-reference**: 01_DB_PLATFORM_INVENTORY.md · 02a_ADV_SYS.md · 02b_ADV_LEGACY_MIRROR.md · 05_EXTRACT_SCRIPTS_FORENSIC.md · 06_BROWNFIELD_REGISTRY_DEEP_DIVE.md · 08_AUDIT_TRAIL_ANALYSIS.md

---

## §1 — Classification framework (5-tier)

| Tier | Significance | Source evidence | Action |
|---|---|---|---|
| **A. POPULATED** | Target sys.* ha rows popolati significativi; lavoro fatto durante Wave 1. | sys.* row count ≥ source row count / 0.8 (≥80% hit ratio). | Verify quality + completeness, no SDBI needed. |
| **B. IMPORT GAP** | Source data in `legacy_mirror.*` + target schema sys.* esiste + `brownfield.column_mappings` ha mappings, MA sys.* vuoto (silent-skip transform-compiler issue, CW-B17). | Brownfield mappings ≥ 1 + sys.* rows = 0 + audit `wave_executor.stats[].silent_skip ≥ 1`. | **Opzione 1**: fix caso-per-caso (relax UQ, completare transform-compiler). **Opzione 3**: SDBI re-author specifici target. |
| **C. MIRROR GAP** | Source data in `platform.public` MA NON in `legacy_mirror.*` (extract-wave1-legacy.sh ha gap). Target schema sys.* esiste. | platform.public ≥ 1 row + legacy_mirror = 0 row (o assente) + sys.* schema present. | **Opzione 1**: estendi `extract-wave1-legacy.sh` (aggiungi tabelle al pg_dump lookup). **Opzione 2/3**: cross-DB read via dblink+SDBI. |
| **D. TRUE GAP / TARGET MISSING** | Source data ricco in `platform.public` MA target schema sys.* assente del tutto (no migration esistente). | platform.public ≥ 1 row + sys.* schema NON exists. | **Opzione 1**: estendere schema con nuove migrations 000034+. **Opzione 2**: SDBI propone target schema (AI). **Opzione 3**: ibrido. |
| **E. DESIGN INTENTIONAL** | Source data presente in platform MA NON destinato a sys.* per architectural design. | Tipo: analytics_events, kg_*, plugin_*, error_logs, sap_migration_*, account/session runtime. | Skip/exclude — no action needed. |

**Note**: Tier B ⊂ silent-skip (24 552 rows nel latest run); Tier C ⊂ extract script gap (4 MIRROR GAPS noted); Tier D ⊂ heuresys-evo unique features (Goals, Recruiting, Onboarding etc.).

---

## §2 — Master table per macro-area

> **Convention row counting**: source = `platform.public` total · mirror = `legacy_mirror.*` total · target = `sys.*` populated rows. brownfield mappings = N rows in `brownfield.column_mappings` for that target. Silent skip = `validated - upserted` per latest run (08d3bc9f).
> **Effort scale**: turni = 4-6h ciascuno. T = trivial (<1h), 1T = 1 turno, 2T+ = multi-turn.

### §2.1 Skills universe (8 macro-aree)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Skills core (canonical skills + families) | **A** | esco_skills 14011 + skill_classifications 7215 + skill_clusters 49 + competencies 32 + unknown_skills 30 = ~21k | esco_skills missing (MIRROR GAP) · skill_classifications 7215 · skill_clusters 49 | `sys_skills` + `sys_skill_families` | **6037 + 77** | sys_skills 349 + sys_skill_families 42 = 391 | All PASSED, no silent-skip on these targets | maintenance | rebuild (~3T) | maintenance | **HIGH (achieved)** |
| Skills categories (taxonomy) | **B** | ontology_categories 9 + skill_classifications subset + competencies subset | (in mirror) | `sys_skill_categories` | **0** | 45 | silent-skip 7256 rows (latest) | 2T fix (relax UQ CW-B20 + complete transform) | rebuild via SDBI ~3T | 1T fix | **HIGH** |
| Skills aliases | **B** | skill_aliases 80 + skill_synonyms 50 | (in mirror) | `sys_skill_aliases` | **0** | 16 | silent-skip 130 rows | 1T fix (silent-skip Class A pre-P1) | rebuild ~2T | 1T fix | MEDIUM |
| Skills taxonomy edges | **B** | skill_adjacencies 11634 + skill_relationships 16 + esco_skill_relations 5818 + onet_esco_mappings 135 + cross_entity_relations 85 + ontology_skill_relations 30 + ontology_source_mappings 40 + skill_taxonomy_extensions 52 + skill_pair_usage 111 + semantic_entity_relations 15 + skill_matrices 4 = ~17.9k | (in mirror, no skill_adjacencies — confirmed CW-B19) | `sys_skill_taxonomy_edges` | **0** | 133 | silent-skip 6306 rows | 2T fix (transform-compiler completion) | rebuild via SDBI ~3T | 1T fix | **HIGH** |
| Skills learning mappings (skill → course bridge) | **B** | course_esco_skills 717 + certification_esco_skills 664 + job_title_courses 207 | (in mirror) | `sys_skill_learning_mappings` | **0** | 23 | silent-skip 1588 rows | 1T fix | rebuild ~2T | 1T fix | MEDIUM |
| Skill assessments / evidence | **B+D** | employee_skills 1445 + employee_skill_assessments 3140 + employee_skill_mappings 1121 + employee_skill_profiles 312 + employee_skill_history 312 = ~6.3k | NOT in mirror (these are employee-level) | `sys_user_skill_evidence` (schema esiste, vuoto) | **0** | 0 | n/a (not in Wave 1) | 2T (extend extract Wave 2 + add mappings + run) | 2T (SDBI authoring from scratch) | 2T (hybrid) | MEDIUM |
| Skill gap / workforce planning | **C+D** | skill_gap_analyses 304 + skill_gap_snapshots N/A + skill_demand_metrics 200 + skill_supply_metrics 200 + skill_development_paths N/A = ~700 | skill_gap_analyses 304 + skill_demand_metrics 200 + skill_supply_metrics 200 + skill_development_paths in mirror | `sys_gap_analysis_results` + `sys_gap_closure_actions` + `sys_gap_closure_plans` + `sys_readiness_scores` (4 tables, all empty) | **0** | 0 | n/a | 2T (mapping authoring + run) | 2T (SDBI) | 2T | MEDIUM |
| Competency frameworks | **A (partial)** | competencies 32 + competency_frameworks N/A + competency_review_ratings 465 | competencies + competency_frameworks + competency_review_ratings in mirror | sys_skills (32 competenze upserted) + sys_skill_categories (review ratings not in target) | partially in sys_skills | 0 (review ratings not mapped) | OK on competencies | maintenance | rebuild for review_ratings (~1T) | maintenance | LOW |

### §2.2 Learning universe (5 macro-aree)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Learning modules (catalog) | **A** | courses 127 + course_modules 564 = ~691 | courses 127 + course_modules 564 | `sys_learning_modules` | **4488** | 89 | upsert 4395/4522 = 97.2% | maintenance | rebuild ~2T | maintenance | **HIGH (achieved, but anomaly: 4488 sys vs 691 mirror)** |
| Learning paths (containers) | **A** | learning_paths 20 + learning_path_courses 124 + course_enrollments 3052 + skill_development_paths N/A | learning_paths 20 + learning_path_courses 124 + course_enrollments 3052 + skill_development_paths | `sys_learning_paths` | **3227** | 89 | upsert 3157/3498 = 90.2% (341 silent skip) | maintenance / 1T fix silent | rebuild ~2T | maintenance | **HIGH (achieved, anomaly: 3227 sys vs 20 mirror)** |
| Learning path steps | **B** | learning_path_courses 124 + course_modules 564 = ~688 | (in mirror) | `sys_learning_path_steps` | **0** | 20 | silent-skip 688 rows | 1T fix (transform completion) | rebuild ~1T | 1T fix | **HIGH** |
| Learning enrollments / completion / evidence | **C+D** | course_enrollments 3052 + module_completions 2899 + learning_path_enrollments 341 + learning_recommendations 1045 + learning_ratings 396 + certifications 88 + course_esco_skills 717 + certification_esco_skills 664 + learning_bookmarks N/A = ~9.2k | mostly in mirror | `sys_user_learning_assignments` + `sys_user_learning_evidence` + `sys_user_certifications` (3 tables empty, partially) | 1 (sys_user_certifications) | 18 (sys_user_certifications), 0 others | sys_user_certifications quasi-empty | 2T (mapping authoring + run) | 2T (SDBI) | 2T | **HIGH** |
| Learning gaps | **D** | skill_gap_analyses 304 + learning_recommendations 1045 (subset) | (in mirror) | `sys_learning_gaps` (empty) | **0** | 0 | n/a | 1T mapping + run | 1T SDBI | 1T | MEDIUM |

### §2.3 Job / Position / Career (5 macro-aree)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Job roles / families | **B** | job_templates 140 + job_families 27 + ccnl_job_title_mapping N/A | job_templates 140 | `sys_job_roles` + `sys_job_families` | **0 + 0** | 43 (sys_job_roles), 0 (sys_job_families) | silent-skip 231 rows (sys_job_roles), upstream cascade CW-B18 | 1T fix (sys_job_families parent first, then sys_job_roles) | rebuild ~2T | 1T fix | **HIGH** |
| ESCO occupation mappings | **B** | esco_occupations 3040 + onet_occupations 25 + occupation_industry_classifications 4565 + industry_occupation_mapping 15 | esco_occupations 3040 + occupation_industry_classifications 4565 | `sys_esco_occupation_mappings` | **0** | 53 | silent-skip 7645 rows (largest skip) | 2T fix | rebuild ~2T | 1T fix | **HIGH** |
| Positions | **A (partial)** | (mostly derived from job_templates + position-specific tables) | (mirror has job_templates 140) | `sys_positions` + `sys_user_position_assignments` | **161 + 161** | n/a (provenance unclear — see §2.4 of 05) | OK | n/a | n/a | n/a | LOW (already populated) |
| Position skill requirements | **B** | position_skill_requirements 1632 + job_template_skills 28983 + onet_occupation_skills 71 = ~30.7k | job_template_skills 28983 | `sys_position_skill_requirements` + `sys_position_skill_requirement_history` (both empty) | **0 + 0** | 53 (sys_position_skill_requirements) | silent-skip on position_skill_requirements / transform issue | 2T fix | rebuild via SDBI ~3T (analogy matching might help) | 2T | **HIGH** |
| Career paths | **D** | career_paths 32 + career_path_levels 75 + career_path_level_skills 100 + employee_career_paths 128 + career_goals 60 + career_goal_milestones 216 + career_skills 1106 = ~1.7k | NOT in mirror | `sys_career_paths` + `sys_career_path_steps` + `sys_user_career_plans` + `sys_user_target_positions` + `sys_position_career_paths` (5 tables, all empty) | **0** | 0 | n/a | 2T (extend extract Wave 2 + mappings + run) | 2T (SDBI) | 2T | MEDIUM |

### §2.4 KPI universe (1 macro-area, 8 sys tables)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KPI definitions / targets / measurements | **B+D** | job_kpis 2000 + tenant_job_kpis 80 + org_unit_kpis 100 + process_kpis 81 + employee_kpi_targets 412 + process_phases N/A = ~2.7k | process_kpis 81 + process_phases | `sys_kpi_definitions` + `sys_kpi_targets` + `sys_kpi_measurements` + `sys_kpi_metric_definitions` + `sys_kpi_assessment_results` + `sys_organization_unit_kpi_templates` + `sys_position_kpi_requirements` + `sys_process_kpi_templates` (8 tables, all empty) | **0** (all 8) | sys_process_kpi_templates 13 | silent-skip 81 rows (sys_process_kpi_templates) | 3T (extend extract + mappings + run, complex 8-target chain) | 3T (SDBI) | 2T (hybrid: AI mapping + use existing 13 column_mappings for process_kpi_templates) | **HIGH** |

### §2.5 Compensation / Reward (4 macro-aree)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Compensation bands (CCNL) | **A** | ccnl_contracts + ccnl_executive_bands + ccnl_levels + sindacati 22 = ~250 | ccnl_contracts + ccnl_executive_bands + ccnl_levels + sindacati | `sys_compensation_bands` | **75** | 67 | upsert 75/75 = 100% | maintenance | rebuild ~1T | maintenance | DONE |
| Compensation recommendations / merit | **D** | merit_recommendations 208 + salary_history 317 + salary_band_assignments 264 = ~789 | NOT in mirror | `sys_compensation_recommendations` (empty) | **0** | 0 | n/a | 2T (extend extract + mappings + run) | 2T (SDBI) | 2T | MEDIUM |
| Bonus pools / variable pay | **D** | bonus_allocations 244 + bonus_plans 14 + equity_grants 12 = ~270 | NOT in mirror | `sys_bonus_pools` + `sys_payout_curves` + `sys_variable_pay_calculations` + `sys_objective_reward_rules` (4 tables, all empty) | **0** | 0 | n/a | 2T | 2T (SDBI) | 2T | MEDIUM |
| Reward gates | **A (partial)** | (no source, reference catalog only) | n/a | `sys_reward_gate_catalog` (7 rows from seed) + `sys_reward_gates` + `sys_reward_gate_results` (empty) | 7 catalog + 0 + 0 | 0 | n/a | n/a | n/a | n/a | LOW |
| Payroll handoff | **D** | (payroll_anomaly_patterns 0 + payroll_export_* 0 + payroll_transmission_log 0 = empty in platform) | n/a | `sys_payroll_handoff_records` (empty) | **0** | 0 | n/a | source-empty | source-empty | source-empty | LOW (Class E pseudo) |

### §2.6 Performance / Calibration / Assessment (3 macro-aree)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Performance reviews / predictions | **D** | performance_reviews 292 + performance_predictions 267 + performance_trends 202 + calibration_* ~196 = ~957 | competency_review_ratings 465 in mirror | `sys_assessment_results` + `sys_assessments` + `sys_assessment_methods` (some seeded) + `sys_behavioral_assessments` (empty) | sys_assessments 2 + sys_assessment_methods 5 + sys_kpi_assessment_methods 5 + 0 (results) + 0 (behavioral) | 0 | n/a (review_ratings not yet imported despite being in mirror) | 2T (extend extract + mappings) | 2T (SDBI) | 2T | **HIGH** |
| User assessment evidence | **D** | (linked to performance + 360 feedback systems) | n/a | `sys_user_assessment_evidence` + `sys_person_evidence_records` (empty) | **0 + 0** | 0 | n/a | 1T | 1T | 1T | MEDIUM |
| Critical positions / coverage | **D** | succession_plans 31 + succession_candidates 206 + talent_pool_members 40 + talent_pools 24 = ~300 | NOT in mirror | `sys_critical_positions` + `sys_critical_role_coverage_status` + `sys_position_succession_relevance` (empty) | **0** | 0 | n/a | 2T | 2T (SDBI) | 2T | MEDIUM |

### §2.7 Succession / Talent (1 macro-area, 6 sys tables)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Succession pools / candidates / readiness | **D** | succession_plans 31 + succession_candidates 206 + talent_pool_members 40 + talent_pools 24 + nine_box_grid view = ~301 | NOT in mirror | `sys_succession_pools` + `sys_succession_scores` + `sys_successor_candidates` + `sys_successor_readiness` + `sys_talent_scores` + `sys_enterprise_typing_profiles` (6 tables, all empty) | **0** (all 6) | 0 | n/a | 3T (extend extract + map + run, complex chain) | 3T (SDBI) | 2T | MEDIUM |

### §2.8 Blueprint / Activity classifications (3 macro-aree)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Activity classifications (ATECO/NACE) | **A** | industry_classifications 3276 + tenant_industry_classifications 4 + occupation_industry_classifications 4565 = ~7.8k | industry_classifications 3276 + tenant_industry_classifications 0 (MIRROR GAP) + occupation_industry_classifications 4565 | `sys_activity_classifications` + `sys_activity_classification_mappings` | **3276 + 0** | 36 + 7 | upsert 3276/3284 = 99.8% (sys_activity_classifications); 0 source mirror for sys_activity_classification_mappings (industry_ccnl_mapping MIRROR GAP) | maintenance | rebuild ~1T | maintenance | DONE for sys_activity_classifications; **C MIRROR GAP** for sys_activity_classification_mappings (1T to add to mirror + map) |
| Blueprint process registry | **B+C** | business_processes 26 (MIRROR GAP) + process_phases N/A | business_processes 0 (MIRROR GAP) | `sys_blueprint_process_registry` | **23** (partial, staging had 63) | 21 | silent-skip 63 rows (sys_blueprint_process_registry) | 1T (add business_processes to mirror + re-run) | 1T (SDBI) | 1T | MEDIUM |
| Blueprint overrides | **B** | benchmark_configs N/A + benchmark_reports N/A + tenant_industry_classifications 4 (MIRROR GAP) + holidays 144 | holidays 144 + benchmark_configs + benchmark_reports | `sys_blueprint_overrides` | **0** | 53 | source partially-empty + cascade | 1T (relax + complete map) | rebuild ~1T | 1T | LOW |
| Blueprint activations / variants | **D** | (no source, just reference) | n/a | `sys_blueprint_activations` + `sys_blueprint_variants` (1 seeded) + `sys_blueprint_families` (1 seeded) | 0 + 1 + 1 | 0 | n/a | n/a | n/a | n/a | LOW |

### §2.9 Organization (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Org structure (units / hierarchies / history) | **A (partial)+D** | org_units 76 + org_unit_templates 225 + org_unit_kpis 100 = ~401 | NOT in mirror | `sys_organization_units` (6 seeded) + `sys_organization_unit_types` (8 seeded) + `sys_organization_hierarchies` + `sys_organization_unit_history` (last 2 empty) | 6 + 8 + 0 + 0 | 0 | n/a | 2T (extend extract Wave 2 + map + run) | 2T (SDBI) | 2T | MEDIUM |

### §2.10 Users / Profiles / Documents (3 macro-aree)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Users + user profiles | **A (partial)+D** | users 274 + employees_core 270 + employees_pii 270 + employees_hr 270 + employees_payroll 270 + user_pernr_mapping 571 = ~1.9k | NOT in mirror | `sys_users` (163) + `sys_user_profiles` (1) + `sys_user_certifications` (1) | 163 + 1 + 1 | n/a | sys_users 158 from Wave 1 retry (provenance unclear) + 5 from seed-test-admin | 2T (extend extract Wave 2 employees + map + run — PII careful) | 2T (SDBI with PII disposition) | 2T | **HIGH** (PII-sensitive) |
| User documents | **D** | employee_documents 1089 + document_acknowledgments 250 + document_versions 24 + signature_requests 24 = ~1.4k | NOT in mirror | `sys_user_documents` (empty) | **0** | 0 | n/a | 2T | 2T (SDBI) | 2T | LOW |
| User education / professional experiences | **D** | (pa0022 education-like infotypes + employee_certifications 729) | NOT in mirror | `sys_user_education_records` + `sys_user_professional_experiences` (empty) | **0 + 0** | 0 | n/a | 2T | 2T | 2T | LOW |

### §2.11 Goals / OKRs (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Goals / OKRs / key results | **D (TRUE GAP)** | goals 1067 + okrs 20 + key_results N/A + goal_updates 1811 + goal_check_ins 1000 + goal_milestones 1000 + goal_comments 856 = ~5.8k | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | 3T (extend schema sys_goals/okrs/key_results migrations + extract Wave 2 + map + run) | 3T (SDBI propone target schema) | 3T (hybrid) | **HIGH** (major HRMS feature) |

### §2.12 Recruiting / Hiring (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Recruiting / candidates / interviews / requisitions | **D (TRUE GAP)** | recruiting_* tables ~1.5k (recruiting_candidates + applications + interviews + requisitions + offers) | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | 3T (extend schema sys_recruiting_* + extract Wave 2 + map + run) | 3T (SDBI) | 3T | MEDIUM (less critical than Goals) |

### §2.13 Onboarding / Preboarding (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Onboarding / preboarding tasks | **D (TRUE GAP)** | onboarding_tasks 153 + preboarding_tasks 180 + onboarding_processes N/A = ~700 | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | 2T (extend schema sys_onboarding_* + extract + map + run) | 2T (SDBI) | 2T | LOW |

### §2.14 Surveys / Engagement / Feedback (3 macro-aree)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Survey infra / responses | **D (TRUE GAP)** | survey_responses 4482 + surveys (parent) N/A + engagement_surveys + survey_questions N/A = ~5k | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | 3T (extend schema sys_surveys + extract + map + run, high volume + complex) | 3T (SDBI) | 3T | MEDIUM |
| Engagement / pulse / wellbeing | **D (TRUE GAP)** | engagement_survey_responses 1327 + pulse_checks 1145 + wellbeing_checkins 1142 + engagement_feedback 685 + check_ins 2495 = ~6.8k | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | 3T (similar) | 3T (SDBI) | 3T | MEDIUM |
| 360 feedback / continuous feedback | **D (TRUE GAP)** | feedback_360 714 + continuous_feedback 729 + feedback_responses 0 (empty in platform) + recognition 485 = ~2k | NOT in mirror | `sys_behavioral_assessments` exists (vuoto, semantically diverso) | n/a | n/a | n/a | 2T (extend schema sys_feedback_* OR map a sys_behavioral_assessments) | 2T (SDBI) | 2T | MEDIUM |

### §2.15 Time / Leave / Attendance (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Time / attendance / overtime / leave balances | **D (TRUE GAP)** | employee_attendance 5237 + employee_overtime 383 + employee_time_off_balances 501 + leave_balances view + attendance_records view = ~6.1k | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | 3T (extend schema sys_time_* + extract + map + run, high volume) | 3T (SDBI) | 3T | MEDIUM |

### §2.16 News / Social / Recognition (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| News articles / reads / reactions / comments | **E (probably out-of-HRMS-core)** | news_articles 32 + news_reads 1139 + news_reactions 780 + news_comments 422 + social_* | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | skip | skip or SDBI propose if needed | skip | LOW (Class E) |

### §2.17 Mentorship (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mentorships / mentor sessions / programs | **D (TRUE GAP)** | mentorships 124 + mentorship_sessions 355 + mentorship_programs N/A = ~500 | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | 2T | 2T (SDBI) | 2T | LOW |

### §2.18 Predictions / ML (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Model predictions / turnover risk | **D / E** | model_predictions 267 + predictive_models N/A + performance_predictions 267 + turnover_risk_scores N/A + ai_analytics_daily 772 + ai_query_audit 410 = ~1.7k | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | skip or 2T extend | skip or 2T SDBI | skip | LOW (Class E candidate — runtime AI inference, not entity data) |

### §2.19 SAP HR infotypes (1 macro-area, ~80 tables)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SAP HR PA/PB/PCL/HRP/T infotypes | **E (DESIGN INTENTIONAL)** | pa* + pb* + pcl* + hrp* + t* + ext_* ~80 tables, ~80k rows | NOT in mirror (out-of-scope Wave 1) | **NESSUN target sys.*** (no SAP integration in target rewrite scope) | n/a | n/a | n/a | skip | skip (or full SAP migration project, multi-month) | skip | n/a (Class E confirmed) |

### §2.20 CCNL / Italian labor extension (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CCNL contracts (base — already imported) | **A** | ccnl_contracts + ccnl_levels + ccnl_executive_bands + sindacati 22 | (in mirror) | `sys_compensation_bands` | 75 | 67 | OK | maintenance | rebuild | maintenance | DONE |
| Holidays + ITLAB extension | **B** | holidays 144 + industry_ccnl_mapping 14 (MIRROR GAP) | holidays 144 + industry_ccnl_mapping 0 (MIRROR GAP) | `sys_blueprint_overrides` (per mappings, empty) | 0 | 53 (sys_blueprint_overrides) | source-partially-empty | 1T (add industry_ccnl_mapping to mirror + remap) | 1T (SDBI) | 1T | LOW |

### §2.21 Whistleblowing (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Whistleblowing reports / handlers | **D (TRUE GAP)** | whistleblowing_reports 4 + whistleblowing_handlers 15 + other ~6 tables = ~80 | NOT in mirror | **NESSUN target sys.*** | n/a | n/a | n/a | 2T | 2T (SDBI) | 2T | LOW |

### §2.22 Knowledge graph / ESCO meta (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Knowledge graph (kg_edges + kg_nodes + semantic_entity_index + semantic_*) | **E (DESIGN INTENTIONAL)** | kg_edges 140687 + kg_nodes 17518 + semantic_entity_index 4115 + semantic_search_log + ontology_* ~22 tables = ~165k | semantic_entity_index 4115 + cross_entity_relations etc. (some in mirror as ESKAP domain) | `sys_visualization_*` 7 tables empty (visualization sub-system, different shape) | 0 | n/a | n/a | skip (meta layer for dashboard runtime) | partial — ESKAP subset is in scope, KG runtime is not | n/a | n/a |

### §2.23 Dashboards / Widgets / Views runtime (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboards / widgets / sidebar | **E (DESIGN INTENTIONAL)** | dashboards 20 + dashboard_widgets 160 + dashboard_elements N/A + sidebar_links + ... ~12 tables | NOT in mirror | n/a (target rewrite uses different dashboard layer) | n/a | n/a | n/a | skip | skip | skip | n/a |

### §2.24 RBP / Audit / System tables (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| RBP role-based perms (~22 tables) | **E** | rbp_functional_areas 33 + rbp_role_permissions 179 + rbp_pet_mappings 47 + ... = ~500 | NOT in mirror | `sys_auth_roles` (8) + `sys_auth_permissions` (99) + `sys_auth_role_permissions` (394) + `sys_auth_credentials/identities` etc. | done by migration seed | n/a | n/a | n/a (semantically diverso) | skip | skip | n/a |
| Audit logs / system | **E** | audit_logs 395 + system_audit_logs N/A + schema_migrations 240 = ~635 | NOT in mirror | `sys_schema_migrations` (33 — target only) + audit.* (separate schema) | done | n/a | n/a | n/a (already runtime audit separate) | skip | skip | n/a |
| Inbox notifications | **D** | notifications 238 + notification_preferences 266 = ~500 | NOT in mirror | `sys_inbox_notifications` (empty) | **0** | 0 | n/a | 1T | 1T (SDBI) | 1T | LOW |

### §2.25 Seed acquisition system (1 macro-area)

| Macro-area | Tier | Source rows platform | Source rows mirror | Target sys.* tables | sys.* populated rows | Brownfield mappings | Audit evidence | Effort Opt1 | Effort Opt2 | Effort Opt3 | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SDBI scaffolding (sys_seed_*) | **E (DESIGN INTENTIONAL)** | n/a | n/a | `sys_seed_acquisition_runs` + `sys_seed_approval_decisions` + `sys_seed_candidate_records` + `sys_seed_source_evidence` + `sys_seed_validation_results` (5 tables empty) | **0** (all 5) | 0 | n/a | n/a | populated by SDBI itself (Opzione 2/3) | n/a | n/a (will be populated by SDBI execution if chosen) |

---

## §3 — Stats summary

### §3.1 Per Tier classification

| Class | N macro-areas | Total source rows (platform) | Total source rows (mirror) | Total sys.* populated rows | Effort total Opt1 (turni) | Opt2 (turni) | Opt3 (turni) |
|---|---:|---:|---:|---:|---:|---:|---:|
| **A POPULATED** | 6 (Skills core, Learning modules, Learning paths, Compensation bands, Activity classifications, Competency frameworks partial) | ~30k | ~17k | ~17k | 0 (maintenance) | n/a (rebuild ~10T) | 0 |
| **B IMPORT GAP** | 11 (Skills categories, Skills aliases, Skills taxonomy edges, Skills learning mappings, Skill assessments, Skill gap, Learning path steps, Job roles/families, ESCO occupation mappings, Position skill requirements, Blueprint process registry, Blueprint overrides, Holidays/ITLAB ext, KPI universe pt1) | ~60k mirror-available | ~60k | 0 (mostly) | 14-18T | 16-22T | 12-16T |
| **C MIRROR GAP** | 4 (business_processes, esco_skills, industry_ccnl_mapping, tenant_industry_classifications) | ~14k | 0 (gap!) | partial | 1-2T (extend extract script) | 1-2T | 1-2T |
| **D TRUE GAP** | 13 (Goals/OKRs, Recruiting, Onboarding, Surveys/Engagement, Time/Leave, Mentorship, Career paths, Performance reviews, Succession, Compensation recommendations, Bonus pools, Org structure ext, Users ext, User documents, Education records, Whistleblowing, Critical positions, Inbox notifications, Feedback systems) | ~30k | 0 (none in mirror) | 0 (except 163 sys_users + 1 profiles) | 28-40T | 28-40T | 22-32T (hybrid is fastest if SDBI proposes target schemas) |
| **E DESIGN INTENTIONAL** | 6 (SAP HR infotypes ~80k, Knowledge graph 165k, Dashboards/widgets, News/social, RBP, Predictions/ML, SDBI scaffolding 5 tables) | ~250k | n/a | n/a | 0 | 0 | 0 |
| **TOTAL** | ~40 macro-aree | ~700k source aggregate | ~200k mirror | ~37k sys.* (37k+) | **43-60T** (~170-240h) | **45-64T** (~180-256h) | **34-50T** (~136-200h) |

### §3.2 Per dominio lexicon (cross-reference to Wave 1 7 domains)

| Lexicon domain | Macro-aree A | B | C | D | E | Coverage Wave 1 | Action need |
|---|---|---|---|---|---|---|---|
| **OPOURSKA** (skills + job templates + business_processes) | 1 (Skills core) | 3 (categories, aliases, taxonomy edges) | 1 (business_processes) | 0 | 0 | partial | fix Class B + extend Class C |
| **SKILGRO** (skill-learning loop) | 2 (Learning modules, Learning paths) | 4 (path steps, learning mappings, assessments, gap) | 0 | 1 (enrollment/evidence ext) | 0 | partial | fix Class B + extend Class D |
| **INDOOR** (industry classifications) | 1 (Activity classifications) | 1 (Blueprint overrides) | 2 (industry_ccnl_mapping, tenant_industry_classifications) | 0 | 0 | high | fix Class C + B |
| **ITLAB** (CCNL/sindacati/holidays) | 1 (Compensation bands) | 0 | 1 (Holidays ext) | 0 | 0 | high | minor extend |
| **OPOURSKA position** | 0 | 3 (Job roles, ESCO mappings, Position skills) | 0 | 0 | 0 | low | fix Class B (high pri) |
| **TALPIPE** (talent/succession/9box) | 0 | 0 | 0 | 4 (Career paths, Succession, Critical positions, Talent scores) | 0 | none | extend |
| **H2R** (recruiting + onboarding) | 0 | 0 | 0 | 2 (Recruiting, Onboarding) | 0 | none | extend |
| **GOKMER** (goals + KPI cycle) | 0 | 1 (KPI universe) | 0 | 2 (Goals/OKRs, Performance reviews) | 0 | none | extend |
| **SMERTO** (compensation/reward) | 1 (Compensation bands done) | 0 | 0 | 3 (Compensation rec, Bonus pools, Payroll handoff) | 0 | partial | extend |
| **PULSAR** (engagement) | 0 | 0 | 0 | 3 (Surveys, Engagement, 360 feedback) | 0 | none | extend |
| **PROGOV** (process governance) | 0 | 1 (Blueprint process registry partial) | 1 (business_processes) | 0 | 0 | partial | fix B + C |
| **DGOV** (audit + governance) | 0 | 0 | 0 | 1 (Whistleblowing) | 1 (Audit/RBP) | n/a | optional extend |
| **EPRA** (AI/predictions) | 0 | 0 | 0 | 0 | 1 (Predictions) | n/a | skip |
| **ESKAP** (ESCO + KG) | (partial in Skills core) | 1 (ESCO occupation mappings, partial taxonomy edges) | 1 (esco_skills missing) | 0 | 1 (KG runtime) | partial | fix B + C |

### §3.3 Effort breakdown per Tier

| Tier | N macro-aree | Avg effort/macro-area | Total Opt1 (h) | Total Opt2 (h) | Total Opt3 (h) |
|---|---:|---|---:|---:|---:|
| A POPULATED | 6 | 0h (maintenance) | 0 | 60h (full rebuild) | 0 |
| B IMPORT GAP | 11 | 4-6h each (fix silent-skip + relax UQ + transform-compiler completion) | 50-70h | 60-80h | 40-60h (SDBI for hard cases) |
| C MIRROR GAP | 4 | 2-3h each (extend extract-wave1-legacy.sh + restore + remap) | 8-12h | 8-12h | 8-12h |
| D TRUE GAP | 13 | 10-15h each (extend migrations + extract + map + run) | 130-200h | 130-200h | 100-150h (hybrid SDBI faster for unmapped target schema) |
| E DESIGN INTENTIONAL | 6 | 0h (skip) | 0 | 0 | 0 |
| **TOTAL** | 40 | — | **188-282h** | **258-352h** | **148-222h** |

**Note**: Opt2 baseline is higher because rebuild Class A + redesign all targets via SDBI is wasteful. Opt3 is fastest because reuses existing brownfield infrastructure for Class A/B/C while leveraging SDBI for Class D where no target schema exists.

---

## §4 — TOP 10 priority macro-areas (ranked)

Criteria: (a) volume row impact, (b) coverage HRMS-critical-for-functional-dev, (c) effort/value ratio, (d) dependency centrality.

| Rank | Macro-area | Tier | Volume impact | HRMS criticality | Effort/value | Justification |
|---:|---|---|---|---|---|---|
| **1** | **Goals / OKRs / key results** | D | ~5.8k source | **CRITICAL** (mandatory HRMS feature) | 3T → unlock Goals/OKRs entire workstream | TRUE GAP, no schema; 1067 goals + 1811 updates + ~4k granular records lost without action |
| **2** | **Position skill requirements** | B | ~30.7k source | **CRITICAL** (Position-centric I1 invariant) | 2T → unblock position-driven workforce planning | Largest single-target unmapped volume (job_template_skills 28983); brownfield has 53 mappings already |
| **3** | **ESCO occupation mappings** | B | ~7.7k source | **HIGH** (Occupation taxonomy backbone) | 2T → unlock career paths + recruiting | Largest silent-skip count (7645 rows in latest run); upstream cascade for sys_job_roles |
| **4** | **Skills taxonomy edges** | B | ~17.9k source | **HIGH** (Skill graph navigation) | 2T → unlock skill adjacency UX | 6306 silent-skip; 10 source tables contribute; mappings exist (133) |
| **5** | **Skills categories** | B | ~7.3k source | **HIGH** (Skill normalization hierarchy) | 1T → unlock skill_clusters UX | 7256 silent-skip; CW-B20 UQ block; mappings exist (45) |
| **6** | **KPI universe (8 sys tables)** | B+D | ~2.7k source | **CRITICAL** (Performance management) | 3T → unlock entire perf-mgmt workstream | 8 target tables empty, only process_kpi_templates has mappings; complete miss for definitions/targets/measurements |
| **7** | **Users + user profiles (PII-aware)** | A partial + D | ~1.9k source | **CRITICAL** (Identity backbone) | 2T → unlock multi-tenant identity | 163 sys_users present but provenance unclear; 270 employees_core not yet imported; PII careful |
| **8** | **Job roles / families** | B | ~167 source | **HIGH** (Position graph parent) | 1T → unblock chain to position_skill_requirements | sys_job_families empty blocks sys_job_roles (CW-B18 cascade); upstream of position chain |
| **9** | **Performance reviews / assessments** | D | ~1k source | **HIGH** (Calibration + review cycle) | 2T → unlock perf cycle UX | 957 reviews + calibration data lost; sys_assessments exists (2 seeded) but no real data |
| **10** | **Learning enrollments + evidence (sys_user_learning_*)** | C+D | ~9.2k source | **HIGH** (Learning compliance + transcript) | 2T → unlock user learning history | course_enrollments 3052 + module_completions 2899 + learning_path_enrollments 341 not in target |

**Tier-A confirmed achieved** (no action): Skills core 6037, Learning modules 4488, Learning paths 3227 (anomaly noted), Compensation bands 75, Activity classifications 3276.

---

## §5 — Implications per opzioni strategiche

### §5.1 Opzione 1 — Brownfield-only extension (fix + extend Wave 2/3)

**Cosa serve fare (concreto)**:

1. **Class C fix immediato (4 mirror gaps)**: estendi `extract-wave1-legacy.sh` per includere `business_processes` (26 rows), `esco_skills` (14011 rows), `industry_ccnl_mapping` (14 rows), `tenant_industry_classifications` (4 rows). Restore in `legacy_mirror`. Effort: 1-2T.
2. **Class B fix transform-compiler** (11 macro-aree, 24552 silent-skip rows): relax UQ constraint CW-B20 (per `sys_skill_categories`), completare transform compiler per 8 target con upsertedRows=0, ri-eseguire Wave 1 retry. Effort: 14-18T.
3. **Class D extension (13 macro-aree)**: per ciascuna, sequenza completa:
   - Aggiungi 1-3 nuove migrations sys.* (es. `000034_goals_okrs_schema.sql`, `000035_recruiting_schema.sql`, etc.)
   - Estendi `extract-wave2-legacy.sh` (nuovo script) con tabelle source
   - Estendi `EXPLICIT_MAP` in `generate_wave2_seeds.mjs`
   - Estendi `generate_wave2_column_mappings.mjs` con nuovi target prefix
   - Estendi `brownfield-wave-2-preflight.sh` con nuovi target
   - Run `run-wave2-fullscale.mjs`
   - Effort: 130-200h (10-15h per macro-area × 13)

**Effort totale Opt1**: **188-282h** (~30-50 turni).

**Risk**:
- Class B fix: medio (richiede deep dive su transform-compiler logic, ma asset esiste)
- Class D extension: alto (richiede schema design + mapping authoring + validation per ogni macro-area, possibili regressioni)
- Determinismo replay: confermato dai 5 wave_executor runs identici (audit trail safe)

**Time-to-functional-readiness**: ~6-10 settimane di lavoro full-time. Solido ma lungo.

### §5.2 Opzione 2 — Full SDBI rebuild (AI-driven, scrap brownfield)

**Cosa serve fare (concreto)**:

1. Sviluppare SDBI engine (5 sys_seed_* tables popolate by SDBI itself): scope rules, AI prompt templates, evidence collection, validation pipeline. Effort: ~15-20T per scaffold + base implementation.
2. Per ogni macro-area (40 totali, escluso Class E = 34):
   - Define discovery scope (source tables to scan)
   - AI proposes mapping_card (target sys.* + column-level)
   - Human review (UI/CLI)
   - Approve → generate INSERT statements → execute
   - Audit trail integrate
3. Run full pipeline per tutti i target.

**Effort totale Opt2**: **258-352h** (~45-65 turni).

**Risk**:
- Wasted brownfield investment (~50-80h sunk): EXPLICIT_MAP dictionary, 1177 column_mappings, 94 table_mappings, 14 transform codes — tutto da rifare via AI
- Class A targets (6037+4488+3227+3276+75+77 = ~17k rows già populate): rebuild = puro lavoro perso
- AI confidence varies: per source semplici (es. learning_modules) AI matching è banale, ma per source complessi (es. SAP HR infotypes che peraltro sono Class E) richiede prompt engineering significativo
- Time-to-first-result: lungo (SDBI engine va costruito prima di poter produrre output)

**Time-to-functional-readiness**: ~10-16 settimane.

### §5.3 Opzione 3 — Hybrid (brownfield + SDBI dove specifico)

**Cosa serve fare (concreto)**:

1. **Preserva e fix asset brownfield** (Class A POPULATED + Class B IMPORT GAP + Class C MIRROR GAP):
   - Class A: maintenance only
   - Class B: fix transform-compiler + relax UQ (14-18T)
   - Class C: extend extract-wave1-legacy.sh (1-2T)
   - Sub-total: ~15-20T
2. **SDBI per Class D TRUE GAP** (13 macro-aree, no target schema esistente):
   - SDBI scope: AI-led proposes target schema + column mapping + INSERT statements
   - Per macro-area: AI propone schema → human review → migration apply → AI propone column mapping (analog to EXPLICIT_MAP) → INSERT in `brownfield.table_mappings`/`column_mappings` (riutilizza infrastructure) → standard wave runner downstream
   - Effort: ~22-32T (faster than Opt1 D because AI accelerates schema authoring + mapping for unmapped territory)
3. **Audit trail vocabulary extension**: aggiungere `AI_CONFIDENCE_HIGH_ACCEPTED`, `AI_LOW_CONFIDENCE_NEEDS_REVIEW`, `ANALOGY_MATCH_SUGGESTED`, `SKIPPED_UNSUPPORTED_TRANSFORM_V1` rule_codes (chiude gap §4.3 di doc 08).
4. **Skip Class E DESIGN INTENTIONAL** (6 macro-aree).

**Effort totale Opt3**: **148-222h** (~25-40 turni).

**Risk**:
- Architectural complexity: due paths (brownfield + SDBI) da maintainer simultaneously
- Boundary definition: chi gestisce cosa (Class D edge cases, es. partial schema overlap)
- AI cost: per Class D, AI calls per schema design + mapping authoring (potenzialmente significativo per 13 macro-aree)
- Mitigation: SDBI alimenta `brownfield.table_mappings`/`column_mappings` invece di scrivere direttamente in sys.* — riutilizza tutto il downstream (staging, validation, audit, approval, upsert, lineage)

**Time-to-functional-readiness**: ~5-8 settimane (fastest of three).

### §5.4 Recap comparativo

| Criterion | Opt1 (Brownfield-only) | Opt2 (Full SDBI) | **Opt3 (Hybrid)** |
|---|---|---|---|
| Effort total (h) | 188-282 | 258-352 | **148-222** ⭐ |
| Time-to-first-result | medium (4 settimane to Class A+B+C complete) | slow (10+ settimane to SDBI engine ready) | **fast (1-2 settimane to Class B+C fixed)** ⭐ |
| Asset preservation | ✅ keep ~50-80h brownfield | ❌ discard | ✅ keep + augment ⭐ |
| Risk profile | medium (Class D extension is large unknown) | high (full new engine + AI variability) | **medium-low (proven core + AI only where needed)** ⭐ |
| Audit infrastructure | reuse | rebuild | **reuse + extend (4 new rule_codes)** ⭐ |
| Coverage at end | 100% if all 13 Class D extended | 100% | 100% (same target) |
| Maintenance long-term | known (brownfield 1 path) | known (SDBI 1 path) | medium (2 paths but both share downstream) |

---

## §6 — Verification anchors

```sql
-- §2.x Master table reproducibility — sys.* row counts (verify column "sys.* populated rows")
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname='sys' AND n_live_tup>=0
ORDER BY n_live_tup DESC;

-- §2.x platform.public row counts (verify source rows column)
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname='public'
ORDER BY n_live_tup DESC LIMIT 50;

-- §2.x legacy_mirror row counts (verify mirror rows column)
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname='legacy_mirror'
ORDER BY n_live_tup DESC;

-- §3 silent-skip per target (latest run 08d3bc9f, used in TOP 10)
SELECT s->>'target' AS target,
       (s->>'stagedRows')::int AS staged,
       (s->>'upsertedRows')::int AS upserted,
       ((s->>'stagedRows')::int - (s->>'upsertedRows')::int) AS silent_skip
FROM brownfield.import_runs r,
     LATERAL jsonb_array_elements(r.import_run_metadata->'wave_executor'->'stats') s
WHERE r.import_run_id='08d3bc9f-e16d-418d-8414-17873ef170aa'
ORDER BY silent_skip DESC;

-- §3.x brownfield mappings count per target (verify "Brownfield mappings" column)
SELECT tm.table_mapping_target_table, COUNT(cm.column_mapping_id)
FROM brownfield.table_mappings tm
LEFT JOIN brownfield.column_mappings cm ON cm.column_mapping_table_mapping_id = tm.table_mapping_id
GROUP BY 1 ORDER BY 2 DESC;

-- §3.2 Mirror gap confirmation (Class C)
SELECT 'business_processes' AS tbl,
  (SELECT COUNT(*) FROM heuresys_platform.public.business_processes) AS platform_rows,
  (SELECT COUNT(*) FROM heuresys_advanced.legacy_mirror.business_processes) AS mirror_rows;
-- expected: platform=26, mirror=0 ➜ MIRROR GAP confirmed
```

---

## §7 — Anomalie / inconsistenze rilevate

1. **sys_learning_paths 3227 vs source learning_paths 20**: enorme amplification ratio (161×). Probabile join multi-source (learning_paths + course_enrollments 3052 + skill_development_paths) — da investigare in F10 (deliverable separato).
2. **sys_learning_modules 4488 vs source courses 127 + course_modules 564 = 691**: amplification 6.5×. Probabile contributo da `learning_recommendations` (1045) o multi-source.
3. **sys_positions 161 + sys_user_position_assignments 161 vs source job_templates 140**: non sono né 1:1 con seed-test-admin (5 users) né con job_templates (140). Provenienza opaca, da indagare.
4. **CW-B19 source mismatch skill_taxonomy_edges**: brownfield ha 133 mappings su `sys_skill_taxonomy_edges` ma `skill_adjacencies` (11634 rows) NON è nella lista mappings → verificare se è inclusa nelle 81 source_tables o se è il 12-esimo mirror gap.
5. **Audit rule_code vocabulary minimale**: 3 distinct codes su 207k audit rows. Gap critico: 24552 silent-skip rows non hanno `SKIPPED_UNSUPPORTED_TRANSFORM_V1` o `NO_CONFLICT_INFERENCE_AVAILABLE` rule_code emesso (vedi doc 08 §4.3). Da chiudere prima di qualsiasi opzione.
6. **12 source tables unmapped in audit** (93 source_tables totali in brownfield · 81 referenziati nei audit). Identificare quali — potrebbero essere stragglers Wave 1 oppure preparati per Wave 2.

---

## §8 — Summary findings + recommendation

### Findings (executive)

1. **Tier landscape**: 6 macro-aree POPULATED ✅ · 11 IMPORT GAP (silent-skip B fixable) · 4 MIRROR GAP (extract script extension C trivial) · 13 TRUE GAP (target schema missing D, includes Goals/OKRs/Recruiting/Onboarding/Surveys/Time-Leave critici) · 6 DESIGN INTENTIONAL (SAP HR/KG/Dashboards/Predictions skip).
2. **Silent-skip è il bug più grosso**: 24 552 rows (59% del staged) non tracciate in audit trail e non upserted nei 8 target B principali. La maggior parte di queste 8 target (sys_skill_categories 7256, sys_skill_taxonomy_edges 6306, sys_esco_occupation_mappings 7645, sys_skill_learning_mappings 1588, sys_learning_path_steps 688, sys_job_roles 231, sys_skill_aliases 130, sys_user_certifications 88) sono recuperabili con fix transform-compiler caso-per-caso (Opt1 leverage) o relax UQ + ri-run.
3. **TRUE GAP (Class D) è il lavoro più grande**: 13 macro-aree senza target schema, includono feature HRMS-critiche (Goals/OKRs, KPI universe full chain, Performance reviews, Succession). Effort 130-200h regardless of option.
4. **Mirror gaps (Class C) sono trivial fix**: 4 tabelle da aggiungere a `extract-wave1-legacy.sh` (~1-2T totali). `esco_skills` 14011 è il più impattante — unlock major skill normalization improvements.
5. **Asset brownfield ha valore consolidato**: 1177 column_mappings + 94 table_mappings + EXPLICIT_MAP dictionary (50-80h sunk engineering). Scrap = perdita.
6. **Audit infrastructure è asset preservabile**: schema mature, replay-safe, 65 MB storage cost trascurabile. Estendibile con nuovi rule_codes per SDBI integration.

### Recommendation

**OPZIONE 3 (Hybrid) è la scelta operativa raccomandata** con margine sostanziale:

- **Effort minore**: 148-222h vs 188-282h (Opt1) vs 258-352h (Opt2) — risparmio 40-100h
- **Time-to-first-result più rapido**: 1-2 settimane per fix Class B+C (vs 4 settimane Opt1, 10+ settimane Opt2)
- **Asset preservation**: brownfield investment intact + audit infrastructure reused + extended
- **Lower risk**: brownfield path è proven (5 wave_executor replay identici), SDBI focus solo dove necessario (Class D 13 macro-aree)
- **Cleaner long-term**: SDBI alimenta `brownfield.table_mappings`/`column_mappings` con AI-proposed entries, downstream pipeline è identica per tutti — single execution path
- **Audit-trail upgrade**: aggiungere 4-6 nuovi rule_codes chiude gap §4.3 (SKIPPED_UNSUPPORTED_TRANSFORM_V1 + AI_* rule_codes)

**Sequence operativa raccomandata Opt3**:

1. **Settimana 1**: Class C mirror gap fix (4 tabelle a extract script) + Class B fix silent-skip per 3 target più critici (Position skill requirements, ESCO occupation mappings, Skills categories) = ~6-8T
2. **Settimana 2**: completare Class B remaining (8 target) + audit rule_code vocabulary extension = ~6-8T
3. **Settimana 3-4**: SDBI engine scaffold (sys_seed_* tables populate) + AI prompt templates + first Class D pilot (Goals/OKRs) = ~10-12T
4. **Settimana 5-7**: SDBI rollout su remaining 12 Class D macro-aree = ~15-20T
5. **Settimana 8**: full integration test + verification view check + handoff = ~3-5T

**Total**: ~25-40T (~5-8 settimane).

---

*End of 10_GAPS_ANALYSIS.md* — Generated by Cowork autonomous forensic agent. Verified-by: cross-reference at 01/02a/02b/05/06/08 deliverables + SSH-confirmed row counts on oracle-vm-default.
