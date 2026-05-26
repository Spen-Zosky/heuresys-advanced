# DB Inventory CORRECTED — heuresys cluster (2026-05-20T01:30 GMT+2)

**Correction**: il documento precedente identificava erroneamente `heuresys_advanced.legacy_mirror` come source SDBI. Verifica completa rivela 3 database sul cluster Postgres:

| DB | Size | Ruolo SDBI |
|---|---|---|
| `heuresys_platform` | **1112 MB** | **SOURCE reale**: legacy heuresys-evo, CASCADIA-seeded, 582 tabelle public + 6 learning |
| `heuresys_advanced` | 609 MB | **TARGET**: nuovo rewrite (questo progetto), 113 sys.* tables, sparse |
| `heuresys_test` | 791 MB | Test/staging (TBD ruolo, da verificare separatamente) |

Cluster: `oracle-vm-default:5432` (Postgres 16.14). Connect via SSH + sudo postgres.

**Implicazione architetturale**: `heuresys_advanced.legacy_mirror` (91 tabelle) era subset parziale di `heuresys_platform.public` (582 tabelle) — vecchio approccio brownfield che si limitava all'~16% del legacy. SDBI deve leggere direttamente da `heuresys_platform.public` (full source), eventualmente via FDW o cross-DB query o dump selettivo, non da `legacy_mirror`.

---

## §1 — SOURCE: `heuresys_platform.public` (582 tabelle)

### §1.1 Top 20 per volume (data-rich)

| Tabella | Rows | Categoria |
|---|---|---|
| `kg_edges` | **140687** | Knowledge graph edges (meta) |
| `esco_occupation_skills` | 126051 | ESCO occupation↔skill junction |
| `job_template_skills` | **28983** | Job template requirements |
| `ext_pa0024` | 18272 | SAP HR ext infotype |
| `kg_nodes` | 17518 | Knowledge graph nodes |
| `esco_skills` | **14011** | ESCO skills taxonomy |
| `pcl2` | 12562 | SAP payroll cluster 2 |
| `skill_adjacencies` | 11634 | Skill graph |
| `pa0024` | 9640 | SAP HR infotype Qualifications |
| `skill_classifications` | **7215** | Skill classifications con cluster_id |
| `pa2002` | 6072 | SAP HR Attendance |
| `esco_skill_relations` | 5818 | ESCO skill relations |
| `pa2005` | 5358 | SAP HR Overtime |
| `employee_attendance` | 5237 | Real attendance records |
| `analytics_events` | 5000 | Analytics events |
| `employee_timeline` | 4641 | Employee historical events |
| `survey_responses` | 4482 | Survey responses |
| `semantic_entity_index` | 4115 | Semantic search index |
| `pa2006` | 3426 | SAP HR Leave |
| `industry_classifications` | 3276 | Industry classifications (NACE) |
| `employee_skill_assessments` | **3140** | Employee skill assessments |
| `course_enrollments` | 3052 | Course enrollments |
| `esco_occupations` | 3040 | ESCO occupations |
| `module_completions` | 2899 | Learning module completions |
| `job_kpis` | **2000** | Job-level KPIs |
| `job_skills` | 2000 | Job-level skills |
| `job_tasks` | 2000 | Job-level tasks |

### §1.2 Macro-aree funzionali (582 tabelle aggregate)

| Macro-area | N tabelle | Rows totali aggregati | Top tables |
|---|---|---|---|
| **Knowledge graph** | 2 | ~158k | kg_edges (140k), kg_nodes (17k) |
| **ESCO/ONET taxonomy** | ~22 | ~150k | esco_occupation_skills 126k, esco_skills 14k, esco_occupations 3k, onet_* (~15 tables) |
| **SAP HR infotypes** (pa\*, pb\*, ext_pa\*, ext_pb\*, hrp\*, pcl\*, t\*\*\*) | ~80 | ~80k | pcl2 12k, pa0024 9k, pa2002 6k, pa2005 5k, vari pa* / pb* a 1142 rows (employees consistenti) |
| **Employees core+ext** (employees_\*, employee_\*, contracts, addresses, bank, emergency, documents) | ~25 | ~10k | employees_core/pii/hr/payroll/staging (270 ciascuna), employee_documents 1089, employee_contracts 269, employee_skill_history 312, employee_certifications 729 |
| **Skills detail** | ~30 | ~80k | skill_classifications 7215, skill_adjacencies 11634, employee_skills 1445, employee_skill_assessments 3140, position_skill_requirements 1632, career_skills 1106, job_template_skills 28983 (in ESCO area), skill_aliases 80, skill_clusters 49, skill_development_paths 65 |
| **Goals & OKRs** | ~10 | ~5k | goals 1067, goal_updates 1811, goal_check_ins 1000, goal_milestones 1000, goal_comments 856, okrs 20, key_results 20, goal_alignments 100, goal_templates 40 |
| **KPI universe** | ~10 | ~3k | job_kpis 2000, employee_kpi_targets 412, org_unit_kpis 100, process_kpis 81, tenant_job_kpis 80, job_kpi_distribution 22 |
| **Job templates & families** | ~10 | ~30k | job_templates 140, job_template_skills 28983, job_skills 2000, job_tasks 2000, job_kpis 2000, job_qualifications 1500, job_families 27 |
| **Learning catalog** | ~10 | ~10k | courses 127, course_modules 564, course_enrollments 3052, course_enrollments_semantic 20, course_esco_skills 717, learning_paths 20, learning_path_courses 124, learning_path_enrollments 341, module_completions 2899, learning_recommendations 1045, learning_ratings 396, learning_bookmarks 43, learning_content_providers 12 |
| **Career & succession** | ~12 | ~3k | career_skills 1106, career_paths 32, career_path_levels 75, career_path_level_skills 100, career_path_recommendations 85, career_goals 60, career_goal_milestones 216, career_simulations 20, employee_career_paths 128, employee_career_progress 40, succession_candidates 206, succession_plans 31, talent_pool_members 40, talent_pools 24, mentorship_programs 12, mentorships 124, mentorship_sessions 355 |
| **Performance & calibration** | ~15 | ~3k | performance_reviews 292, performance_predictions 267, performance_trends 202, performance_skill_links 150, performance_review_templates 4, calibration_sessions 86, calibration_discussions 60, calibration_results 50, calibration_audit_log 30, calibration_adjustments 20, calibration_participants 30, review_cycles 35, review_cycle_participants 250, review_cycle_phases 20, self_reviews 30, self_assessment_evidence 237 |
| **Feedback & engagement** | ~12 | ~9k | feedback_360 714, feedback_360_questions 28, feedback_360_questionnaires 4, feedback_360_peer_suggestions 20, continuous_feedback 729, engagement_feedback 685, feedback_requests 246, feedback_categories 32, engagement_surveys 18, engagement_survey_responses 1327, engagement_survey_templates 20, engagement_action_plans 6, recognition 485 |
| **Wellbeing & pulse** | ~6 | ~3k | wellbeing_checkins 1142, wellbeing_goals 120, wellbeing_program_enrollments 67, wellbeing_resources 30, pulse_checks 1145, burnout_assessments 54 |
| **Surveys & survey infra** | ~5 | ~5k | survey_responses 4482, surveys 11, survey_questions 31, survey_templates 9 |
| **Recruiting & hiring** | ~15 | ~1.5k | recruiting_candidates 96, recruiting_interviews 77, recruiting_interview_participants 231, recruiting_interviewer_availability 80, recruiting_interview_templates 12, recruiting_offers 30, recruiting_requisitions 24, recruiting_candidate_history 213, candidates 100, requisitions 50, interviews 120, interview_feedback 56, applications 150, job_postings 20, job_postings_raw 8, internal_applications 72, internal_job_postings 10, internal_job_views 217, internal_job_alerts 36, internal_job_bookmarks 48 |
| **Onboarding & preboarding** | ~10 | ~700 | onboarding_tasks 153, onboarding_instances 33, onboarding_templates 19, onboarding_checklist 40, onboarding_template_tasks 16, onboarding_documents 12, preboarding_tasks 180, preboarding_sessions 30, preboarding_welcome_content 6, preboarding_equipment 95, preboarding_notifications 60, preboarding_templates 4 |
| **Compensation & rewards** | ~15 | ~2k | salary_history 317, salary_band_assignments 264, salary_bands 41, bonus_allocations 244, bonus_plans 14, merit_recommendations 208, merit_cycles 53, equity_grants 12, employee_pay_stubs 66, employee_benefits 24, employee_benefit_enrollments 99, contract_amendments 360, employee_contract_amendments 322, contracts 267 |
| **CCNL / Italian labor** | ~10 | ~250 | ccnl_contracts 7, ccnl_levels 36, ccnl_executive_bands 10, ccnl_seniority_rules 0, ccnl_job_title_mapping 91, sindacati 22, sindacato_tenant_links 12, industry_ccnl_mapping 14, tenant_ccnl_links 4, holidays 144 |
| **Time & leave** | ~8 | ~6k | employee_attendance 5237 (in employees area, also here), employee_overtime 383, employee_time_off_balances 501, employee_time_off_requests 99, leave_approval_steps 89, leave_balance_transactions 27, leave_accrual_rules 20, medical_certificates 44 |
| **Org structure** | ~12 | ~600 | org_units 76, org_unit_templates 225, org_unit_kpis 100, org_unit_tasks 100, org_unit_process_mapping 12, org_areas 8, org_chart_templates 9, org_chart_generation_sessions 3, org_chart_snapshots 3, org_levels 7, org_prototype_templates 36, org_prototype_rules 4, org_scenarios 2, org_templates 7 |
| **Tenants & multi-tenancy** | ~15 | ~150 | tenants 4, tenants_books 4, tenant_industry_classifications 4, tenant_org_units 47, tenant_org_charts 4, tenant_ccnl_links 4, tenant_onboarding_profiles 4, tenant_regulatory_compliance 10, tenant_revenue_periods 48, tenant_retirement_rules 4, tenant_schema_version 4, tenant_job_skills 160, tenant_job_kpis 80, tenant_job_tasks 100, tenant_jobs 20, tenant_sap_mapping 9, tenant_custom_skills 25, tenant_skill_dimensions 75, sap_config 49 |
| **RBP (role-based permissions)** | ~12 | ~500 | rbp_roles 8, rbp_role_permissions 179, rbp_role_dashboards 23, rbp_pages 170, rbp_sections 22, rbp_section_translations 44, rbp_field_classifications 30, rbp_field_policies 40, rbp_dashboards 11, rbp_dashboard_nav_items 279, rbp_functional_areas 34, rbp_area_perspectives 47, rbp_perspectives 3, rbp_scope_rules 8, rbp_data_classifications 5, rbp_teams 7, rbp_team_members 11, rbp_team_leaders 4, permissions 184, permission_overrides 10, employee_permission_overrides 10, role_permissions 20 |
| **Dashboards & widgets** | ~12 | ~700 | dashboards 20, dashboard_widgets 160, dashboard_elements 199, dashboard_presets 30, widget_templates 7, widget_catalog 27, role_default_dashboards 16, page_table_relations 300, page_table_sync_log 45, pages (platform_pages 154), workspace_templates 8, workspace_widgets 1, user_workspaces 5 |
| **News & social** | ~12 | ~1.6k | news_articles 32, news_categories 20, news_tags 8, news_article_tags 19, news_reads 1139, news_reactions 780, news_comments 422, news_bookmarks 15, social_posts 20, social_comments 20, social_likes 48, club_events 237, club_memberships 9, employee_clubs 39 |
| **Whistleblowing** | ~6 | ~80 | whistleblowing_reports 4, whistleblowing_messages 16, whistleblowing_attachments 7, whistleblowing_handlers 15, whistleblowing_audit_log 20, whistleblowing_settings 4 |
| **Predictions & AI** | ~15 | ~1.5k | model_predictions 267, performance_predictions 267, turnover_risk_scores 267, predictive_models 16, prediction_factors 13, prediction_actions 15, prediction_model_accuracy 0, ai_query_audit 410, ai_analytics_daily 772, ai_provider_config 2, ai_provider_metrics 1, ai_usage_log 1, ai_prompt_templates 12, ai_tenant_config 4, ai_escalation_queue 0, ai_escalation_queue 0, rag_messages 118, rag_sessions 30, rag_documents 24, rag_usage_stats 248, rag_knowledge_bases 0, rag_provider_keys 9, rag_document_chunks 0 |
| **Analytics & reporting** | ~10 | ~5k | analytics_events 5000, analytics_aggregations 64, error_analytics_hourly 0, report_definitions 6, report_executions 60, report_schedules 6, report_subscriptions 54, report_delivery_log 108, export_configurations 15, export_jobs 45, integration_sync_logs 100, integrations 20 |
| **Skill gap / workforce planning** | ~6 | ~700 | skill_gap_analyses 304, skill_gap_snapshots 36, workforce_plans 43, workforce_plan_actions 20, workforce_plan_scenarios 20 |
| **Industry & market** | ~10 | ~5k | industry_classifications 3276, industry_profiles 8, industry_occupation_mapping 15, occupation_industry_classifications 4565, market_benchmarks 32, market_salary_data 84, benchmark_configs 8, benchmark_reports 4, job_market_statistics 192, job_market_postings 20, job_market_sources 12, job_postings 20 |
| **Documents & signatures** | ~6 | ~1.5k | employee_documents 1089, document_acknowledgments 250, document_versions 24, document_comments 15, document_requests 15, document_locks 0, signature_requests 24, signature_recipients 72, employee_documents 1089 (already counted) |
| **Process & business** | ~6 | ~200 | business_processes 26, process_phases 63, process_kpis 81, process_skill_requirements 92, process_cost_centers 9, process_roles 61 |
| **Plugin system** | ~12 | ~50 | plugins 7, plugin_versions 7, plugin_installations 2, plugin_categories 10, plugin_api_keys 1, plugin_hooks 0, plugin_hook_executions 0, plugin_configurations 0, plugin_ui_slots 0, plugin_dependencies 1, plugin_webhooks 0, plugin_webhook_deliveries 0, plugin_reviews 0 |
| **Audit & system** | ~8 | ~1k | audit_logs 395, sso_login_attempts 48, login_attempts 7, data_subject_requests 20, data_retention_policies 8, sso_configurations 4, schema_migrations 240, db_table_registry 503 |
| **Enrichment pipeline** | ~12 | ~200 | enrichment_jobs 18, enrichment_job_events 91, enrichment_candidates 38, enrichment_sources 31, enrichment_trust_rules 10, enrichment_entity_descriptors 3, enrichment_llm_providers 3, enrichment_extraction_schemas 2, enrichment_merge_policies 2, enrichment_writes 1, enrichment_source_snapshots 27, enrichment_lineage 0, enrichment_matches 0, enrichment_merges 0, enrichment_observations 0 |
| **SAP migration infra** | ~12 | ~0 | sap_migration_jobs 0, sap_employee_mapping 0, sap_infotype_mappings 0, sap_delta_sync_log 0, sap_migration_rollback_log 0, sap_staged_data 0, payroll_export_jobs 1, payroll_export_files 0, payroll_export_employees 0, payroll_transmission_log 0, payroll_anomaly_patterns 0 (intentional empty — SAP migration framework non ancora attivato) |

### §1.3 Empty tables in source platform (rows = 0)

~50 tabelle, principalmente SAP ext_*/ pa*/pb* infotypes future-use, plugin system, error_logs, enrichment_pipeline midstate, sap_migration infra. **Non rilevanti per SDBI seeding** (source-empty per design).

---

## §2 — TARGET: `heuresys_advanced.sys` (113 tabelle)

[Vedi inventory dettagliato precedente nelle §2.1/2.2 — preservato qui per riferimento]

### §2.1 Popolate (~30) by macro-area

| Area | Tabelle popolate (rows) |
|---|---|
| Auth | sys_users (163), sys_auth_credentials (5), sys_auth_identities (5), sys_auth_roles (8), sys_auth_permissions (99), sys_auth_role_permissions (394), sys_auth_login_events (2666), sys_auth_refresh_tokens (5436), sys_auth_password_reset_tokens (81), sys_user_auth_roles (5), sys_user_profiles (1), sys_user_certifications (1) |
| Tenancy/Org | sys_tenancies (2), sys_branches (5), sys_organization_units (6), sys_organization_unit_types (8), sys_positions (161), sys_user_position_assignments (161) |
| Skills | sys_skills (6037), sys_skill_families (77), sys_skill_proficiency_levels (6) |
| Learning | sys_learning_modules (4488), sys_learning_paths (3227) |
| Compensation | sys_compensation_bands (75) |
| Classifications | sys_activity_classifications (3276) |
| Blueprint | sys_blueprint_process_registry (23), sys_blueprint_families (1), sys_blueprint_variants (1) |
| Reference | sys_assessment_methods (5), sys_kpi_assessment_methods (5), sys_assessments (2), sys_enterprise_size_bands (4), sys_kpi_weighting_rules (3), sys_operating_model_catalog (6), sys_reward_gate_catalog (7), sys_training_initiatives (1) |
| Lineage/Migrations | sys_source_lineage_records (4099), sys_schema_migrations (33) |

### §2.2 Vuote (~83) by macro-area

[Skill detail / Learning detail / Job & career / KPI / Position detail / Assessment / Gap / Succession / Compensation extension / Org extension / Blueprint detail / Auth misc / User documents / Visualization / Seed acquisition — vedi inventory precedente, dettaglio invariato]

---

## §3 — Mappa source → target (cross-DB, prima approssimazione SDBI)

Match by analogy per macro-area. Le numerazioni sono indicative.

| # | Source area `heuresys_platform.public` | Volumi source | Target sys.* candidate | Status target | Note SDBI |
|---|---|---|---|---|---|
| 1 | users + employees_core/pii/hr/payroll | 274 + 270×4 | sys_users + sys_user_profiles + sys_user_education_records + sys_user_documents + sys_user_professional_experiences | partial (163 users; profili/edu/docs/prof empty) | **Mismatch users 274 vs 163**: investigare |
| 2 | skill_classifications + skill_clusters | 7215 + 49 | sys_skill_categories | empty | Source-rich; pilot candidate medium |
| 3 | skill_adjacencies + skill_relationships | 11634 + 16 | sys_skill_taxonomy_edges | empty | Largest skill detail target |
| 4 | skill_aliases + skill_synonyms | 80 + 50 | sys_skill_aliases | empty | Pilot facile |
| 5 | esco_skills + esco_skill_relations + esco_occupations + onet_* | 14k + 5.8k + 3k + ~1k | sys_skills (6037 partial pre-existing) + sys_esco_occupation_mappings (empty) | partial | sys_skills già popolato — verificare se da ESCO o da fonte interna; sys_esco_occupation_mappings da popolare via onet_esco_mappings (135) |
| 6 | job_kpis + tenant_job_kpis + employee_kpi_targets + org_unit_kpis + process_kpis + job_kpi_distribution | 2000 + 80 + 412 + 100 + 81 + 22 | sys_kpi_definitions + sys_kpi_targets + sys_kpi_metric_definitions + sys_process_kpi_templates + sys_position_kpi_requirements + sys_organization_unit_kpi_templates + sys_user_kpi_evidence | TUTTI empty | 8 sys_kpi_* target da popolare. Pattern split: definitions vs assignments vs measurements |
| 7 | job_templates + job_template_skills + job_families + job_qualifications + job_tasks + job_skills | 140 + 28983 + 27 + 1500 + 2000 + 2000 | sys_job_roles + sys_job_families + sys_position_skill_requirements | empty | Stesso pattern split source-rich → target-multi |
| 8 | business_processes + process_phases + process_kpis + process_skill_requirements + process_roles + process_cost_centers | 26 + 63 + 81 + 92 + 61 + 9 | sys_blueprint_process_registry (23 — mismatch!) + sys_process_kpi_templates | partial/empty | Verificare provenienza dei 23 attuali |
| 9 | courses + course_modules + course_esco_skills + course_enrollments + module_completions | 127 + 564 + 717 + 3052 + 2899 | sys_learning_modules (4488 partial pre-existing) + sys_learning_path_steps (empty) + sys_user_learning_assignments (empty) + sys_user_learning_evidence (empty) | partial | Investigare provenienza 4488 attuali; user-level enrollment data NON migrato |
| 10 | learning_paths + learning_path_courses + learning_path_enrollments | 20 + 124 + 341 | sys_learning_paths (3227 partial) + sys_learning_path_steps (empty) + sys_user_learning_assignments (empty) | partial | Mismatch 3227 target vs 20 source! Da investigare |
| 11 | employee_skills + employee_skill_assessments + employee_skill_mappings + employee_skill_profiles + employee_skill_history | 1445 + 3140 + 1121 + 312 + 312 | sys_user_skill_evidence + sys_position_skill_requirements + sys_position_skill_requirement_history | empty | User-level skill data tutta da migrare |
| 12 | career_paths + career_path_levels + career_path_level_skills + employee_career_paths + employee_career_progress + career_skills + career_goals + career_goal_milestones + career_simulations | 32 + 75 + 100 + 128 + 40 + 1106 + 60 + 216 + 20 | sys_career_paths + sys_career_path_steps + sys_user_career_plans + sys_user_target_positions + sys_position_career_paths | empty | 5 sys_career_* target da popolare |
| 13 | succession_candidates + succession_plans + talent_pools + talent_pool_members | 206 + 31 + 24 + 40 | sys_succession_pools + sys_succession_scores + sys_successor_candidates + sys_successor_readiness + sys_talent_scores | empty | Talent management completamente da popolare |
| 14 | mentorships + mentorship_programs + mentorship_sessions + mentor_match_scores | 124 + 12 + 355 + 30 | ? (no obvious sys_mentor_*) | target gap | Design gap nel target rewrite? |
| 15 | salary_history + salary_band_assignments + salary_bands + bonus_allocations + bonus_plans + merit_recommendations + merit_cycles + equity_grants + employee_pay_stubs | 317+264+41+244+14+208+53+12+66 | sys_compensation_bands (75 partial) + sys_compensation_recommendations + sys_bonus_pools + sys_payout_curves + sys_variable_pay_calculations + sys_objective_reward_rules + sys_position_compensation_profiles + sys_payroll_handoff_records | partial/empty | 7 sys_compensation/reward target da popolare |
| 16 | employee_certifications + certifications + certification_esco_skills | 729 + 88 + 664 | sys_user_certifications (1 attuale) | quasi-empty | Mismatch 1 vs 729 da risolvere |
| 17 | performance_reviews + performance_predictions + performance_trends + performance_skill_links + calibration_* (8 tables) + review_cycles + self_reviews | 292 + 267 + 202 + 150 + ~300 + 35 + 30 | sys_assessment_results + sys_behavioral_assessments + sys_user_assessment_evidence | empty | Performance cycle completamente da popolare |
| 18 | feedback_360 + continuous_feedback + engagement_feedback + feedback_requests | 714 + 729 + 685 + 246 | ? (sys_behavioral_assessments? new target?) | target gap | Design gap nel target |
| 19 | skill_gap_analyses + skill_gap_snapshots + workforce_plans + workforce_plan_actions + workforce_plan_scenarios | 304 + 36 + 43 + 20 + 20 | sys_gap_analysis_results + sys_gap_closure_actions + sys_gap_closure_plans + sys_readiness_scores + sys_critical_role_coverage_status + sys_critical_positions | empty | Workforce planning area da popolare |
| 20 | recruiting_candidates + applications + interviews + recruiting_offers + requisitions + recruiting_*_history (~16 tables) | ~1.5k aggregato | ? (sys_recruiting_* NON visibili nel target) | target gap | **Recruiting completamente assente nel target** — design choice o omission? |
| 21 | onboarding_tasks + onboarding_instances + preboarding_* (10 tables) | ~700 aggregato | ? (no sys_onboarding_*) | target gap | **Onboarding assente nel target** — design choice? |
| 22 | engagement_surveys + engagement_survey_responses + survey_responses + pulse_checks + wellbeing_checkins + wellbeing_goals + burnout_assessments | ~10k aggregato | ? (no sys_survey/engagement/pulse/wellbeing) | target gap | **Survey + engagement + wellbeing assenti nel target** |
| 23 | goals + goal_updates + goal_check_ins + goal_milestones + goal_alignments + goal_templates + okrs + key_results + goal_comments | ~7k aggregato | ? (no sys_goals/okrs) | target gap | **Goals/OKR assenti nel target** — design choice? |
| 24 | employee_attendance + employee_overtime + employee_time_off_balances + employee_time_off_requests + leave_balance_transactions + leave_accrual_rules + holidays | ~6k aggregato | ? (no sys_attendance/leave) | target gap | **Time & leave assenti nel target** |
| 25 | employee_documents + document_acknowledgments + document_versions + signature_requests | ~1.5k aggregato | sys_user_documents (empty) | empty | 1 sys.* target per molteplici source — semplice |
| 26 | ccnl_contracts + ccnl_levels + ccnl_executive_bands + sindacati + sindacato_tenant_links + holidays | ~250 aggregato | ? (no sys_ccnl/sindacati) | target gap | **CCNL/Italian labor compliance assente nel target** |
| 27 | news_articles + news_reads + news_reactions + news_comments + social_posts + social_likes + social_comments | ~2.5k aggregato | ? (no sys_news/social) | target gap | **News/social assenti** — out-of-scope per HRMS core? |
| 28 | analytics_events + analytics_aggregations + ai_query_audit + ai_analytics_daily | ~6.6k aggregato | sys_inbox_notifications (empty) + ? | minimal | Analytics/observability mostly out-of-scope per SDBI? |
| 29 | rbp_* (~25 tables) | ~700 aggregato | sys_auth_* (parz popolato 4 di 13) | partial | RBP design già esiste in target ma data NON migrata; sys_auth_roles 8 vs rbp_roles 8 ✅ matching |
| 30 | model_predictions + performance_predictions + turnover_risk_scores + predictive_models + prediction_factors | ~700 aggregato | ? (no sys_predictions) | target gap | Predictions/ML out-of-scope SDBI? |

---

## §4 — Insights operativi per SDBI conversation

### §4.1 Riconciliazione numeri Enzo's expectation

Le tue aspettative (decine di KPI, processi di business, etc.) sono **VERE in source `heuresys_platform.public`**: 2000 job_kpis, 81 process_kpis, 412 employee_kpi_targets, 100 org_unit_kpis. Il **target `heuresys_advanced.sys`** mostra 0 per `sys_kpi_*` perché Wave 1 brownfield non li ha mai importati (legacy_mirror non li includeva).

### §4.2 ~10 sys.* macro-aree con TARGET GAP DESIGN

Il target rewrite ha **omissioni di design** rispetto alla source ricca:
- Goals/OKRs (10 source tables, 0 target)
- Recruiting & hiring (16+ source tables, 0 target)
- Onboarding/preboarding (10 source tables, 0 target)
- Surveys/engagement/wellbeing (12 source tables, 0 target)
- Time/leave/attendance (8 source tables, 0 target)
- CCNL/Italian labor (10 source tables, 0 target)
- News/social/communications (12 source tables, 0 target)
- Mentorship (4 source tables, 0 target)
- Predictions/ML (5 source tables, 0 target)
- Feedback systems (4 source tables, 0 target)

**Domanda critica**: SDBI deve solo **mappare le aree esistenti nel target** o anche **estendere il target schema** per coprire questi 10 macro-gap?

### §4.3 Mismatch numerici da investigare

| Sys.* table | rows attuali | Source candidate | Note |
|---|---|---|---|
| `sys_users` 163 | vs `platform.users` 274 + `employees_*` 270 | mismatch da capire |
| `sys_learning_modules` 4488 | vs source `courses` 127 + `course_modules` 564 = 691 | target ha 6.5× più rows — provenienza da ESCO/other? |
| `sys_learning_paths` 3227 | vs source `learning_paths` 20 | target ha 161× più rows — strano |
| `sys_skills` 6037 | vs source `esco_skills` 14011 + altre fonti | sembra parziale ESCO; SDBI dovrebbe completare |
| `sys_user_certifications` 1 | vs source `employee_certifications` 729 | massivo gap, target da popolare |
| `sys_blueprint_process_registry` 23 | vs source `business_processes` 26 | quasi match, ma 3 missing |

### §4.4 Volume realistico SDBI scope

Source totale: **~700k+ rows distribuiti su 582 tables**.
Subset HRMS core (escludendo KG, ESCO/ONET base, SAP HR infotypes pa\*/pb\*, plugin/system, analytics/events): stimato ~80-100k rows core su ~250 tables.
Target sys.* da popolare: ~83 tabelle vuote + ~5 partial da espandere = ~88 tables targets.

### §4.5 Pilot suggeriti rivisitati

Con source vera in vista, propongo:

| Difficoltà | Source | Target | Cosa valida |
|---|---|---|---|
| **FACILE** | `skill_aliases` (80) + `skill_synonyms` (50) | `sys_skill_aliases` | Base flow SDBI, 1 source → 1 target, ~130 rows |
| **MEDIA** | `skill_classifications` (7215) + `skill_clusters` (49) | `sys_skill_categories` + `sys_skill_taxonomy_edges` | 1-source-N-target, volume realistico, FK traversal |
| **DIFFICILE** | `job_templates` (140) + `job_template_skills` (28983) + `job_families` (27) | `sys_job_roles` + `sys_job_families` + `sys_position_skill_requirements` | Multi-hop FK, large volume, junction table |
| **MOLTO DIFFICILE** | `job_kpis` (2000) + `tenant_job_kpis` (80) + `process_kpis` (81) + `employee_kpi_targets` (412) | 8 sys_kpi_* tables | Split source-1 → target-many, semantic disambiguation |
| **EXPLORATORY** | `goals` (1067) + `okrs` (20) + `key_results` (20) | ? **target schema design extension** richiesta | Validate "extend target schema" SDBI capability |

---

## §5 — Open questions per SDBI conversation immediate

1. **Scope target gap (§4.2)**: 10 macro-aree assenti nel target rewrite. SDBI **mappa solo dove c'è target già** OR **estende target schema** per coprirle? Quest'ultima è scope significativamente più ampio.
2. **Cross-DB access** (`heuresys_platform.public` → `heuresys_advanced.sys`): FDW + cross-database query, OR dump→restore selettivo, OR materializzazione mirror tabella-per-tabella, OR direct script con 2 connection pool?
3. **`heuresys_test` 791 MB ruolo**: indagare se è production candidate, sviluppo legacy, o snapshot intermedio
4. **temp_ schema location**: in `heuresys_advanced` direttamente, o nuovo DB `heuresys_sdbi_staging`?
5. **Consolidation strategy**: temp_ → sys_ con `INSERT...ON CONFLICT`? `MERGE`? Manual review per ogni table?
6. **Lineage continuity**: `sys_source_lineage_records` (4099 rows attuali da Goal 002/003) — preservare? Estendere? Reset+rebuild?
7. **Quale pilot iniziale**: tra i 5 suggeriti §4.5, quale validare per primo?

---

*End of _99_DB_INVENTORY_2026-05-20.md (CORRECTED)*
