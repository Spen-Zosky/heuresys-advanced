# Forensic Inventory — `heuresys_platform` (SOURCE legacy heuresys-evo)

**Snapshot**: 2026-05-20T02:10Z (overnight forensic session)
**DB size**: 1112 MB
**Postgres version**: 16.14
**Connection**: oracle-vm-default:5432, sudo postgres, read-only

---

## §1 — Schema overview

| Schema | Tables | Views | MatViews | Size | Ruolo |
|---|---|---|---|---|---|
| `public` | **582** | **110** | **6** | **1076 MB** | Main DB heuresys-evo: CASCADIA seed + 25 functional areas + dashboard runtime |
| `learning` | 6 | 3 | 0 | 472 kB | Sub-schema isolato (sembra nested learning module separato dal public.learning_*) |
| `analytics` | 0 | 10 | 0 | n/a | Solo views, no tables |

**Total**: 588 tables, 123 views, 6 matviews — 1112 MB

### §1.1 `learning` schema (isolated nested learning module)

6 tables:
| Table | Rows (est) | Size |
|---|---|---|
| `learning.certificates` | 32 | 64 kB |
| `learning.courses` | 64 | 136 kB |
| `learning.enrollments` | 68 | 96 kB |
| `learning.learning_path_courses` | 64 | 40 kB |
| `learning.learning_paths` | 16 | 64 kB |
| `learning.skill_gaps` | 64 | 72 kB |

3 views:
- `learning.v_course_popularity` (course completion analytics)
- `learning.v_employee_learning_summary` (per-employee learning summary, references `public.employees` view)
- `learning.v_skill_gap_analysis` (skill gap with course recommendations)

**Note**: `learning.*` è DIVERSO da `public.courses` / `public.learning_paths`. Probabilmente un nested learning module più recente / specifico-tenant. Da non confondere.

### §1.2 `analytics` schema — 10 views, 0 tables

Probabilmente analytics dashboard runtime (BI views derivate da public). Lista views via inventory.

### §1.3 `public.schema_migrations` — **240 migrations applied**

Range temporale:
- Earliest: 2025-12-19 (10 migrations base)
- Latest: 2026-05-14T00:22:05Z (`phase18u_rls_null_safe_policies`)
- Span: ~5 mesi di sviluppo

Migration phase prefixes (top groups):
| Prefix | Count | Topic |
|---|---|---|
| `0001-012` (numeric base) | ~20 | Bootstrap schema iniziale (Dec 2025) |
| `enterprise-taxonomy-phase1-6` | 6 | Taxonomy import phases (Apr 2026) |
| `phase14_*` to `phase18*` | ~50 | Incremental schema evolution (Apr-May 2026) |
| `S35.0_*` to `S35.7_*` | 30+ | CASCADIA pipeline sprint S35 (May 2026) |
| `S55+_*`, `S57_*`, `S62_*` | ~20 | Final closure stages |

Recent phase18 migrations (12-14 May 2026):
- `phase18d_italian_labor_context` (CCNL/sindacati/holidays)
- `phase18e_regulatory_frameworks`
- `phase18f_eskap_knowledge_graph` (ESCO + KG)
- `phase18g_audience_persona_label`
- `phase18h_smartfood_enrichment` (SmartFood tenant)
- `phase18i_econova_heuresys_enrichment` (EcoNova + Heuresys tenant)
- `phase18j_econova_jt_dedupe`
- `phase18k_heuresys_succession_scaffold`
- `phase18l_strip_mock_identities`
- `phase18m_widget_api_binding`
- `phase18n_widget_employee_context_binding`
- `phase18o_widget_profile_capability_binding`
- `phase18p_process_presets_v2` (4 process presets re-seeded)
- `phase18q_mv_rbac_matrix` (added mat view)
- `phase18r_rbac_widget_repoint_mv`
- `phase18s_idx_skill_assessments_composite`
- `phase18t_idx_audit_logs_created_at`
- `phase18u_rls_null_safe_policies` (RLS hardening)

---

## §2 — Tenants in `heuresys_platform.public.tenants` (4 active)

| Tenant ID | Slug | Name | Plan | Industry | Domain | Employees | Headcount range |
|---|---|---|---|---|---|---|---|
| `0c54b84a-...` | rtl-bank | RTL Bank | professional | Commercial Banking | rtl-bank.org | 156 | 100-500 (LARGE) |
| `1d7bf448-...` | smartfood | SmartFood S.r.l. | professional | Food Manufacturing | smartfood.org | 82 | 50-150 (MEDIUM) |
| `fb1e866c-...` | econova | EcoNova | professional | Renewable Energy | econova.org | 26 | 10-50 (SMALL) |
| `d5855519-...` | heuresys | Heuresys System | enterprise | HR Tech & Software | heuresys.com | 3 | 1-10 (SMALL) |

**Note importante**: `d5855519-3ed1-4427-865f-fe75f1e42c4c` (Heuresys System) è anche presente in `heuresys_advanced.sys.sys_tenancies` (2 rows totali là). Conferma cross-DB tenant ID anchoring.

---

## §3 — Top 100 tabelle `public` per volume

| # | Table | Rows |
|---|---|---|
| 1 | `kg_edges` | 140687 |
| 2 | `esco_occupation_skills` | 126051 |
| 3 | `job_template_skills` | 28983 |
| 4 | `ext_pa0024` | 18272 |
| 5 | `kg_nodes` | 17518 |
| 6 | `esco_skills` | 14011 |
| 7 | `pcl2` | 12562 |
| 8 | `skill_adjacencies` | 11634 |
| 9 | `pa0024` | 9640 |
| 10 | `skill_classifications` | 7215 |
| 11 | `pa2002` | 6072 |
| 12 | `esco_skill_relations` | 5818 |
| 13 | `pa2005` | 5358 |
| 14 | `employee_attendance` | 5237 |
| 15 | `analytics_events` | 5000 |
| 16 | `employee_timeline` | 4641 |
| 17 | `occupation_industry_classifications` | 4565 |
| 18 | `survey_responses` | 4482 |
| 19 | `semantic_entity_index` | 4115 |
| 20 | `pa2006` | 3426 |
| 21 | `industry_classifications` | 3276 |
| 22 | `employee_skill_assessments` | 3140 |
| 23 | `course_enrollments` | 3052 |
| 24 | `esco_occupations` | 3040 |
| 25 | `module_completions` | 2899 |
| 26 | `pa0105` | 2598 |
| 27 | `check_ins` | 2495 |
| 28 | `pb0024` | 2400 |
| 29 | `pa0185` | 2268 |
| 30 | `job_kpis` | **2000** |
| 31 | `job_skills` | **2000** |
| 32 | `job_tasks` | **2000** |
| 33 | `pb4000` | 2000 |
| 34 | `pb4001` | 2000 |
| 35 | `pb4005` | 2000 |
| 36 | `goal_updates` | 1811 |
| 37 | `pa0001` | 1774 |
| 38 | `position_skill_requirements` | 1632 |
| 39 | `embedding_queue` | 1630 |
| 40 | `pb0022` | 1600 |
| 41 | `pa0021` | 1530 |
| 42 | `job_qualifications` | 1500 |
| 43 | `pa0002` | 1458 |
| 44 | `employee_skills` | 1445 |
| 45 | `pa2001` | 1444 |
| 46 | `engagement_survey_responses` | 1327 |
| 47 | `pulse_checks` | 1145 |
| 48-65 | `pa0000-pa2007` (SAP HR infotypes con 1142 rows ciascuno, consistente 1142 employees) | 1142 ×18 |
| 66 | `wellbeing_checkins` | 1142 |
| 67 | `news_reads` | 1139 |
| 68 | `pa0022` | 1138 |
| 69 | `pa0009` | 1134 |
| 70 | `employee_skill_mappings` | 1121 |
| 71 | `career_skills` | 1106 |
| 72 | `employee_documents` | 1089 |
| 73 | `goals` | **1067** |
| 74 | `ext_pa0002` | 1064 |
| 75 | `learning_recommendations` | 1045 |
| 76 | `pb0002` | 1010 |
| 77 | `goal_check_ins` | 1000 |
| 78 | `goal_milestones` | 1000 |
| 79 | `pb0001` | 1000 |
| 80 | `pa0015` | 912 |
| 81 | `goal_comments` | 856 |
| 82 | `news_reactions` | 780 |
| 83 | `ai_analytics_daily` | 772 |
| 84 | `continuous_feedback` | 729 |
| 85 | `employee_certifications` | 729 |
| 86 | `course_esco_skills` | 717 |
| 87 | `feedback_360` | 714 |
| 88 | `engagement_feedback` | 685 |
| 89 | `certification_esco_skills` | 664 |
| 90 | `user_pernr_mapping` | 571 |
| 91 | `course_modules` | 564 |
| 92 | `sync_queue` | 528 |
| 93 | `db_table_registry` | 503 |
| 94 | `employee_time_off_balances` | 501 |
| 95 | `recognition` | 485 |
| 96 | `blueprint_results` | 484 |
| 97 | `competency_review_ratings` | 465 |
| 98 | `news_comments` | 422 |
| 99 | `employee_kpi_targets` | 412 |
| 100 | `ai_query_audit` | 410 |

### §3.1 Volume aggregate by macro-area

(da inventory categorical pre-esistente)

| Macro-area | N tabelle | Rows aggregate stimate | Note |
|---|---|---|---|
| Knowledge graph | 2 | ~158k | kg_edges, kg_nodes |
| ESCO/ONET taxonomy | ~22 | ~150k | esco_occupation_skills 126k dominante |
| SAP HR infotypes (pa\*/pb\*/ext\*/pcl\*/hrp\*/t\*\*\*) | ~80 | ~80k | 1142 employees consistente cross-tables |
| Employees core+ext | ~25 | ~10k | employees_core/pii/hr/payroll 270 ciascuna |
| Skills detail | ~30 | ~80k | skill_classifications 7215, skill_adjacencies 11634 |
| Goals & OKRs | ~10 | ~5k | goals 1067, goal_updates 1811, goal_check_ins 1000, goal_milestones 1000 |
| KPI universe | ~10 | ~3k | job_kpis 2000, employee_kpi_targets 412, org_unit_kpis 100, process_kpis 81 |
| Job templates & families | ~10 | ~30k | job_template_skills 28983 dominante |
| Learning catalog | ~10 | ~10k | course_enrollments 3052, module_completions 2899 |
| Career & succession | ~12 | ~3k | career_skills 1106, succession_candidates 206, mentorship 124+355 |
| Performance & calibration | ~15 | ~3k | performance_reviews 292, calibration_* 86+60+50 |
| Feedback & engagement | ~12 | ~9k | engagement_survey_responses 1327, feedback_360 714 |
| Wellbeing & pulse | ~6 | ~3k | pulse_checks 1145, wellbeing_checkins 1142 |
| Surveys & survey infra | ~5 | ~5k | survey_responses 4482 |
| Recruiting & hiring | ~15 | ~1.5k | recruiting_* + applications + candidates |
| Onboarding & preboarding | ~10 | ~700 | onboarding_tasks 153, preboarding_tasks 180 |
| Compensation & rewards | ~15 | ~2k | salary_history 317, bonus_allocations 244 |
| CCNL / Italian labor | ~10 | ~250 | ccnl_* + sindacati 22 + holidays 144 |
| Time & leave | ~8 | ~6k | employee_attendance 5237, employee_overtime 383 |
| Org structure | ~12 | ~600 | org_units 76, org_unit_templates 225 |
| Tenants & multi-tenancy | ~15 | ~150 | 4 tenants + sub-tables |
| RBP (role-based perms) | ~22 | ~500 | rbp_* extensive system |
| Dashboards & widgets | ~12 | ~700 | dashboards 20, dashboard_widgets 160 |
| News & social | ~12 | ~1.6k | news_articles 32 + reads 1139 + reactions 780 |
| Whistleblowing | ~6 | ~80 | whistleblowing_reports 4 + handlers 15 |
| Predictions & AI | ~15 | ~1.5k | model_predictions 267, ai_query_audit 410 |
| Analytics & reporting | ~10 | ~5k | analytics_events 5000 |
| Skill gap / workforce planning | ~6 | ~700 | skill_gap_analyses 304, workforce_plans 43 |
| Industry & market | ~10 | ~5k | industry_classifications 3276, market_benchmarks 32 |
| Documents & signatures | ~6 | ~1.5k | employee_documents 1089 |
| Process & business | ~6 | ~200 | business_processes 26, process_kpis 81 |
| Plugin system | ~12 | ~50 | plugins 7 |
| Audit & system | ~8 | ~1k | audit_logs 395, schema_migrations 240 |
| Enrichment pipeline | ~12 | ~200 | enrichment_jobs 18 |
| SAP migration infra | ~12 | ~0 | sap_migration_* mostly empty (framework non attivato) |

**Totale rows**: ~700k+ aggregate (consistente con DB size 1112 MB)

---

## §4 — Empty tables in `heuresys_platform.public` (64 / 582)

Lista completa:
- **account** (Express session) | **ai_escalation_queue** | **api_keys** | **ccnl_seniority_rules** | **cross_entity_searches** | **document_locks** | **enrichment_lineage** | **enrichment_matches** | **enrichment_merges** | **enrichment_observations** | **error_analytics_hourly** | **error_logs** | **error_patterns** | **ext_hrp1007** | **ext_pa0025** | **ext_pb0002** | **extracted_skills** | **feedback_responses** | **hrp1003** | **hrp1006** | **hrp1007** | **hrp1008** | **hrp1010** | **hrp1011** | **hrp1013** | **hrp1014** | **hrp5002** | **import_skill_links** | **job_title_learning_paths** | **onet_import_jobs** | **ontology_inference_jobs** | **pa2003** | **pa2004** | **pa2010** | **pa2011** | **pa2012** | **pa2013** | **payroll_anomaly_patterns** | **payroll_export_employees** | **payroll_export_files** | **payroll_transmission_log** | **pb0003** | **pcl1** | **plugin_configurations** | **plugin_hook_executions** | **plugin_hooks** | **plugin_reviews** | **plugin_ui_slots** | **plugin_webhook_deliveries** | **plugin_webhooks** | **prediction_model_accuracy** | **rag_document_chunks** | **rag_knowledge_bases** | **sap_delta_sync_log** | **sap_employee_mapping** | **sap_infotype_mappings** | **sap_migration_jobs** | **sap_migration_rollback_log** | **sap_staged_data** | **session** (Express session) | **skill_migration_jobs** | **t510** | **t510g** | **verification_token**

**Tipologia empty**:
- Express session tables (`account`, `session`, `verification_token`) — runtime
- SAP migration framework (`sap_*` ~7 tables) — non attivato
- SAP HR PA infotype extensions (`pa2003-2013`, `ext_pa0025`, `pb0003`) — infotype future-use
- HRP infotypes (`hrp1003-1014`, `hrp5002`) — SAP HR positions future
- Plugin system (~7 tables) — plugin system attivo solo parzialmente
- Error infrastructure (`error_*`) — error tracking system non popolato
- Enrichment pipeline midstate (`enrichment_*` 4 of 12)
- Specific empty: `ccnl_seniority_rules`, `extracted_skills`, `import_skill_links`, `onet_import_jobs`, `job_title_learning_paths`, `cross_entity_searches`, `document_locks`, `feedback_responses`

**Non rilevanti per SDBI** — sono source-empty per design o framework non attivato.

---

## §5 — Views overview (123 views total)

### §5.1 `public.*` views (110)

Funzione: dashboards, analytics derivate, denormalized projections, RLS-friendly proxy.

Top views by name pattern:
- `v_*` (104 views): standard analytic views, prefisso convenzione
- `attendance_records`, `branches`, `employees`, `employees_full`, `error_stats`, `goal_hierarchy`, `leave_balances`, `leave_requests`, `nine_box_grid`, `recent_errors`, `total_compensation_tenant_aggregated` (11 senza prefisso `v_`)

Esempi rilevanti per SDBI mapping understanding:
- `v_employee_master`, `v_employee_sap_master`, `v_employee_context`, `v_employee_capability_snapshot`
- `v_skill_classification_stats`, `v_skill_clusters_summary`, `v_skills_classified`, `v_skills_gap`, `v_skills_matrix`
- `v_goal_cascade`, `v_okr_progress`, `v_goals_summary`, `v_team_goals`
- `v_compensation_bands`, `v_compensation_by_department`, `v_payroll_summary`
- `v_calibration_9box`, `v_calibration_bell_curve`, `v_performance_skill_summary`, `v_appraisal_status`
- `v_recruiting_pipeline`, `v_applicant_pipeline`, `v_requisition_pipeline`, `v_my_applications`
- `v_dei_demographics`, `v_dei_pay_equity`, `v_certification_compliance`, `v_compliance_summary`
- `v_org_hierarchy`, `v_org_structure`, `v_org_structure_stats`, `v_org_unit_headcount`
- `v_career_level_requirements`, `v_employee_career_overview`, `v_succession_pipeline`, `v_succession_readiness`
- `v_onboarding_dashboard`, `v_engagement_summary`, `v_engagement_analytics`, `v_feedback_summary`, `v_feedback_wall`
- `v_overtime_analysis`, `v_tenant_absence_stats`, `v_attendance_summary`
- `v_360_feedback_summary`, `v_360_response_rates`
- `v_sap_esco_skills`, `v_sap_only_tables` (SAP→ESCO bridge views)
- `v_employee_predictions`, `v_flight_risk_features`, `v_risk_distribution`
- `v_platform_tables`, `v_data_integrity_check`, `v_sync_dashboard`, `v_sync_status`, `v_sync_status_by_tenant`

### §5.2 `analytics.*` views (10) — 0 tables sotto

Solo views, computed real-time da public. Non rilevanti come source SDBI (sono OUTPUT).

### §5.3 `learning.*` views (3)

Già documentate §1.1 — sono interne al nested learning module.

### §5.4 `public.*` mat views (6)

| MatView | Purpose probabile |
|---|---|
| `mv_cross_tenant_rollup` | Cross-tenant aggregated metrics |
| `mv_tenant_owner_rollup` | Per-tenant-owner dashboard rollup |
| `mv_talent_signals` | Talent management signals |
| `mv_employee_performance_context` | Performance + skills + goals joined |
| `mv_occupation_similarity` | ESCO occupation similarity (semantic) |
| `mv_rbac_matrix` | RBAC matrix (created phase18q recente) |

**Refresh strategy** (da CLAUDE.md heuresys-evo): systemd timer ogni 4h UTC.

---

## §6 — Implications per SDBI

### §6.1 Source data realmente disponibile

Per ogni macro-area di interesse SDBI, le **fonti vere** sono:

| Macro-area target | Source candidates in platform.public | Volume disponibile |
|---|---|---|
| sys_users + sys_user_profiles | `users` 274 + `employees_*` 270 + `employees_pii` + `employees_hr` + `employees_payroll` | ~1.3k records |
| sys_skill_categories | `skill_classifications` 7215 + `skill_clusters` 49 | 7264 records (richissimo) |
| sys_skill_aliases | `skill_aliases` 80 + `skill_synonyms` 50 | 130 |
| sys_skill_taxonomy_edges | `skill_adjacencies` 11634 + `skill_relationships` 16 | 11650 |
| sys_skills (già 6037) | `esco_skills` 14011 + `unknown_skills` 30 + `skill_clusters` 49 | 14k+ ESCO |
| sys_job_roles + sys_job_families | `job_templates` 140 + `job_families` 27 + `job_template_skills` 28983 | ~29k |
| sys_kpi_definitions/targets/measurements (8 tables) | `job_kpis` 2000 + `tenant_job_kpis` 80 + `org_unit_kpis` 100 + `process_kpis` 81 + `employee_kpi_targets` 412 | ~2700 |
| sys_position_skill_requirements | `position_skill_requirements` 1632 | 1632 (1:1) |
| sys_user_certifications (già 1) | `employee_certifications` 729 + `certifications` 88 + `certification_esco_skills` 664 | ~1.5k |
| sys_assessment_results | `performance_reviews` 292 + `performance_predictions` 267 + `performance_trends` 202 + `calibration_*` ~300 | ~1k |
| sys_user_skill_evidence | `employee_skills` 1445 + `employee_skill_assessments` 3140 + `employee_skill_mappings` 1121 + `employee_skill_profiles` 312 + `employee_skill_history` 312 | ~6.3k |
| sys_learning_modules (già 4488) | `courses` 127 + `course_modules` 564 (mismatch ratio investigare) | 691 |
| sys_learning_path_steps | `learning_path_courses` 124 + `learning_paths` 20 | 144 |
| sys_user_learning_assignments + sys_user_learning_evidence | `course_enrollments` 3052 + `module_completions` 2899 + `learning_path_enrollments` 341 + `learning_recommendations` 1045 | ~7.3k |
| sys_career_paths + sys_career_path_steps | `career_paths` 32 + `career_path_levels` 75 + `career_path_level_skills` 100 + `employee_career_paths` 128 + `career_goals` 60 + `career_goal_milestones` 216 | ~600 |
| sys_succession_pools + sys_successor_* | `succession_candidates` 206 + `succession_plans` 31 + `talent_pool_members` 40 + `talent_pools` 24 | ~300 |
| sys_compensation_recommendations + sys_bonus_pools + sys_payout_curves + sys_variable_pay_calculations | `salary_history` 317 + `salary_band_assignments` 264 + `bonus_allocations` 244 + `bonus_plans` 14 + `merit_recommendations` 208 + `equity_grants` 12 | ~1.1k |
| sys_user_documents | `employee_documents` 1089 + `document_acknowledgments` 250 + `document_versions` 24 + `signature_requests` 24 | ~1.4k |
| sys_inbox_notifications | (nessun source ovvio, notifications 238? notification_preferences 266?) | discoverable |

### §6.2 Source areas SENZA target sys.* canonico

**Macro-aree con dati ricchi in platform che mancano nel target rewrite**:

| Source area platform | Volume source | Status target sys.* |
|---|---|---|
| Goals/OKRs (`goals`, `okrs`, `key_results`, `goal_updates`, etc.) | ~7k | **NO target schema** (assente sys_goals/sys_okrs/sys_key_results) |
| Recruiting (`recruiting_candidates`, `applications`, `interviews`, `requisitions`, etc.) | ~1.5k | **NO target schema** |
| Onboarding/preboarding (`onboarding_tasks`, `preboarding_*`) | ~700 | **NO target schema** |
| Surveys/engagement (`survey_responses`, `engagement_surveys`, `pulse_checks`, `wellbeing_*`) | ~10k | **NO target schema** |
| Time/leave/attendance (`employee_attendance`, `employee_overtime`, `employee_time_off_*`, `leave_*`) | ~6k | **NO target schema** |
| News/social (`news_articles`, `news_reads`, `social_*`) | ~2.5k | **NO target schema** (out-of-HRMS-core probably?) |
| Mentorship (`mentorships`, `mentorship_sessions`, `mentorship_programs`) | ~500 | **NO target schema** |
| Predictions/ML (`model_predictions`, `predictive_models`, `performance_predictions`, `turnover_risk_scores`) | ~700 | **NO target schema** |
| Feedback systems (`feedback_360`, `continuous_feedback`, `engagement_feedback`) | ~2.1k | Solo `sys_behavioral_assessments` (vuoto, semantically diverso) |
| CCNL/Italian labor (`ccnl_*`, `sindacati`, `holidays`, `industry_ccnl_mapping`) | ~250 | **NO target schema** dedicated |
| Whistleblowing (`whistleblowing_*` 6 tables) | ~80 | **NO target schema** |
| SAP HR infotypes pa\*/pb\*/pcl\*/hrp\*/t\*\*\* (~80 tabelle) | ~80k | **NO target schema** (intentional? SAP integration scope?) |

### §6.3 Source areas che probabilmente sono OUT-OF-SCOPE per SDBI

- **Knowledge graph** (kg_edges 140k, kg_nodes 17k): meta layer dashboard runtime
- **MV refresh / sync_queue / embedding_queue**: runtime cache, non transactional data
- **Audit_logs platform** (395): audit trail interno, non da migrare
- **Plugin system tables** (mostly empty): platform feature
- **Analytics_events** (5000): event stream, probabilmente non da migrare
- **db_table_registry, page_table_relations, platform_pages, platform_features**: schema meta-registry (admin tooling), non application data
- **rbp_*** ~22 tables: heuresys-evo specific RBP design; il target rewrite usa `sys_auth_role_permissions` + `sys_auth_permissions` quindi semantically diverso

---

## §7 — Constraints metodologici / known limitations

1. **xpath row count query intermittente**: alcune query con `query_to_xml` ritornano NULL per RLS o nomi tabelle non-standard. Confermati via `/tmp/platform_inv.txt` cached output che ha 582 row complete (582 lines, tutti con counts validi)
2. **DDL non incluso in questo deliverable**: per ogni macro-area, DDL completo è disponibile on-demand via `\d public.<table>`. Non riportato qui per brevità — verrà generato selective per le tabelle di pilot SDBI
3. **Sample rows non incluse**: stesso motivo. Disponibili on-demand
4. **FK graph platform**: ricco (582 tables); non riportato qui completo, generato selective per le aree di interesse SDBI in F10

---

## §8 — Verification anchors

```sql
-- Reproducible verification of key facts:
SELECT pg_database_size('heuresys_platform');  -- expected ~1112 MB
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';  -- expected 582
SELECT COUNT(*) FROM schema_migrations;  -- expected 240
SELECT COUNT(*) FROM tenants;  -- expected 4
SELECT COUNT(*) FROM users;  -- expected 274
SELECT COUNT(*) FROM employees_core;  -- expected 270
SELECT COUNT(*) FROM goals;  -- expected 1067
SELECT COUNT(*) FROM job_kpis;  -- expected 2000
```

Eseguiti via SSH 2026-05-20T02:10Z. SHA-256 anchoring di /tmp/platform_inv.txt (file caching) verificato.

---

*End of 01_DB_PLATFORM_INVENTORY.md*
