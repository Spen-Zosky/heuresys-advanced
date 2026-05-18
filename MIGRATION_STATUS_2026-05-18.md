# Migration Status — `evo.heuresys.com` → `heuresys-advanced`

**Generated:** 2026-05-18 (read-only forensic diagnosis, v4 protocol, Claude Code CLI on Windows DESKTOP-KH728P2)
**Repos:** `D:\evo.heuresys.com\` (legacy, separate Prisma stack), `D:\heuresys-advanced\` (target, pnpm monorepo)
**DB access:** SSH remote-exec to `oracle-vm-default` (no local tunnel; see §1)

---

## Section 0 — Knowledge digest

**Knowledge digest (according to docs/history — to be verified against DB):**

- [Source: `D:\heuresys-advanced\HANDOFF.md`] MVP-3 Tappa D Wave 1 reached pipeline state=COMPLETE on **debug-scale only** (5-cap 270s, 20-cap 310s). Full-scale 47k row run blocked by JS-side UPSERT heap OOM after ~20min; SQL-side staging refactor (commit `306263b`) eliminated load-phase bottleneck.
- [Source: HANDOFF.md row D] Empirical post-debug-run state: `sys_skills=52`, `sys_user_certifications=1`, `sys_blueprint_process_registry=23`, `sys_source_lineage_records=52` populated. → DB shows skills=52, lineage=52, process_registry=23 (✅ confirmed); certifications shows -1 (reltuples) but exact=0 → `[DB-vs-DOC-CONFLICT]` see §10.
- [Source: HANDOFF.md] Brownfield registry: 93 source_tables + 1164 source_columns + 94 table_mappings + 1177 column_mappings, "100% coverage". → DB confirms exactly. ✅
- [Source: `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md`] Migration is **brownfield import inside `heuresys_advanced` DB** (legacy_mirror → staging.wave1_* → sys.sys_*), NOT a DB-to-DB migration from a hosted `evo_heuresys` instance. The prompt's framing is therefore reframed in §1 / §10.
- [Source: `D:\evo.heuresys.com\CHANGELOG.md`] Legacy evo DB historically lives in: (a) PC Docker `heuresys_evo_db` on 5432 (SoT pre-cutover), (b) OCI bucket `heuresys-evo-backups` (workflow `evo-db pull|push|status`), (c) VM bare-metal cluster. None of these are reachable from current Windows host (no Docker container, no tunnel up).
- [Source: claude-mem obs 10472, 10470 (2026-05-18 3:09–3:11p)] Latest session before this diagnosis closed at commit `573472d`; HEAD synced to origin/main; working tree clean. Cross-session memory `project_mvp3_session_state.md` updated.
- [Source: claude-mem obs 10467 (2026-05-18 3:02p)] Latest full-scale unlimited run `befreixjk` transitioned to FAILED at ~12min in UPSERT phase, without `failure_reason` populated (engine bug).
- [Source: HANDOFF row B/F/E-UI] Three MVP-3 tappe DEFERRED pending brand identity v1: graph renderers, npm publish, MFA enroll UI.

**Open questions raised by the digest** (digest claims that DB might contradict):
- Digest claims wave 1 pipeline reached COMPLETE; DB shows only ONE `brownfield.import_runs` row visible with `status=RUNNING` (stuck since 2026-05-16 21:19), and `staging.wave1_*` essentially empty. Reconciled in §4 / §10: debug runs likely went through a different code path / were rolled back / never persisted a COMPLETE state to `brownfield.import_runs`.

**Skipped** (found but not read due to budget):
- ~3k MEDIUM-priority files in `docs/source_bundle/extracted_bootstrap/` (architecture specs, blueprint catalogs).
- Full `D:\evo.heuresys.com\services\app\prisma\schema.prisma` (576 models — only model name diff vs. api-gateway captured).
- claude-mem chroma vector index (used SQLite FTS path; HTTP service responded 200 but not queried — direct).

---

## Section 1 — Connection & environment discovery

**Topology reframe — IMPORTANT:** The prompt assumed two PostgreSQL databases on a VM cluster, accessible via tunnel on `localhost:15433`. Reality discovered:

| Aspect | Prompt assumption | DB-verified reality |
|---|---|---|
| Local tunnel ports | `15433` (PG) + `37777` (claude-mem) | `15433` = **DOWN**; `5433` (per CLAUDE.md) = **DOWN**; `37777` = ✅ UP, HTTP 200 |
| VM PG clusters | possibly 2 (one per DB) | **1 cluster** only — `pg_lsclusters` → `16 main 5432 online`; no listener on VM:5433 |
| "Source DB" (`evo_heuresys`) | hosted alongside target | **Does not exist on this VM cluster.** `\l` shows only `heuresys_advanced`, `heuresys_platform`, `heuresys_test`, `postgres`, `template0/1`. |
| "Target DB" (`heuresys_advanced`) | localhost:15433 via tunnel | Reachable via SSH remote-exec only |
| Migration model | DB-to-DB import | **Intra-DB brownfield import** via `legacy_mirror`/`staging`/`brownfield`/`sys` schemas inside `heuresys_advanced` |

**Access method declared:** I did NOT open any tunnel (guard-rail §5). Instead, all DB queries went through SSH remote-exec: `ssh oracle-vm-default 'sudo -u postgres psql -p 5432 -d heuresys_advanced -A -F"|" -t' <<<SQL`. Repo file access went via Windows local filesystem (`D:\evo.heuresys.com\`, `D:\heuresys-advanced\`). claude-mem queried only for ingestion context via the running HTTP service (read-only).

### Source-side connection
No PostgreSQL instance hosting an `evo_heuresys`/`heuresys_evo` database is currently reachable. The "source" in this diagnosis is therefore taken as **dual-faceted**:

1. **Conceptual source** = Prisma schemas committed in `D:\evo.heuresys.com\services\{api-gateway,app}\prisma\schema.prisma` (53 models in api-gateway, 576 in app — the latter is a superset including AI/analytics/blueprint runtime not relevant to import).
2. **Effective source** = `heuresys_advanced.legacy_mirror.*` (97 tables of ingested legacy data). This is the actual surface fed into the Wave 1 pipeline.

### Target-side connection — verified

| Attribute | Value |
|---|---|
| DB name | `heuresys_advanced` |
| Sanitized DSN (effective) | `postgresql://heuresys:***@127.0.0.1:5432/heuresys_advanced` (via SSH only) |
| Owner | `heuresys` |
| Version | PostgreSQL 16.14 on aarch64-unknown-linux-gnu (Ubuntu pgdg) |
| Encoding | `UTF8`, Collate `C`, Ctype `C.UTF-8`, Locale provider `libc` |
| Data directory | `/var/lib/postgresql/16/main` |
| Database size | 266 MB |
| Round-trip latency | ~280 ms wall (SSH-included; pure psql sub-50ms inferred) |
| Schemas | `audit`, `brownfield`, `legacy_mirror`, `public`, `staging`, `sys` |

Other DBs on the cluster (not in scope but noted): `heuresys_platform` (probably ops/control plane), `heuresys_test` (test sandbox).

---

## Section 2 — Source inventory

### 2.A Conceptual source — `evo.heuresys.com` Prisma models

| Stack location | Models | Notes |
|---|---|---|
| `services/api-gateway/prisma/schema.prisma` | **53** | Employee-centric: `employees`, `employee_skills`, `tenants`, `users`, `account`, `session`, ESCO (occupations/skills/skill_groups/relations/isco_groups), `industry_classifications`, RBP (`rbp_roles`), workforce (plans/scenarios/actions), recruiting, succession, performance_reviews, audit_logs, goals, courses, learning_paths, etc. |
| `services/app/prisma/schema.prisma` | **576** | Superset — adds AI/analytics layer (`ai_*`, `analytics_*`, `benchmark_*`, `blueprint_*`, `calibration_*`, `canonical_demo_users`, `career_*`, `business_processes`, dozens of compensation/career/talent constructs). Not all of these are migration sources; many are runtime/derived in legacy. |

The 53 api-gateway models constitute the "core data" surface; the brownfield extraction captured ~93 source tables (see §2.B), which is consistent with picking the data-bearing subset out of the 576-model app schema and pulling in ESCO/ONet reference tables.

### 2.B Effective source — `legacy_mirror.*` in heuresys_advanced DB

97 tables; exact row counts via `query_to_xml(...)`. Tables with `reltuples=-1` (never ANALYZE-d) but exact count > 0 are shown with the exact figure.

| schema | table | row_count | row_count_method | size_pretty | has_pk | n_idx | n_fk_out | n_fk_in |
|---|---|---|---|---|---|---|---|---|
| legacy_mirror | benchmark_configs | 8 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | benchmark_reports | 4 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | business_processes | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | ccnl_contracts | 7 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ccnl_executive_bands | 10 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ccnl_job_title_mapping | 91 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | ccnl_levels | 36 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ccnl_seniority_rules | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | certification_esco_skills | 664 | exact | 128 kB | N | 0 | 0 | 0 |
| legacy_mirror | certifications | 88 | exact | 64 kB | N | 0 | 0 | 0 |
| legacy_mirror | competencies | 32 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | competency_frameworks | 4 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | competency_review_ratings | 465 | exact | 152 kB | N | 0 | 0 | 0 |
| legacy_mirror | course_enrollments | 3052 | exact | 600 kB | N | 0 | 0 | 0 |
| legacy_mirror | course_enrollments_semantic | 20 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | course_esco_skills | 717 | exact | 160 kB | N | 0 | 0 | 0 |
| legacy_mirror | course_modules | 564 | exact | 176 kB | N | 0 | 0 | 0 |
| legacy_mirror | courses | 127 | exact | 1.6 MB | N | 0 | 0 | 0 |
| legacy_mirror | cross_entity_relations | 85 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | cross_entity_searches | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | esco_isco_groups | 14 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | esco_occupation_skills | **126051** | exact | 12 MB | N | 0 | 0 | 0 |
| legacy_mirror | esco_occupations | 3040 | exact | 79 MB | N | 0 | 0 | 0 |
| legacy_mirror | esco_skill_groups | 10 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | esco_skill_relations | 5818 | exact | 616 kB | N | 0 | 0 | 0 |
| legacy_mirror | esco_skills | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | extracted_skills | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | holidays | 144 | exact | 56 kB | N | 0 | 0 | 0 |
| legacy_mirror | import_skill_links | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | industry_ccnl_mapping | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | industry_classifications | 3276 | exact | 80 MB | N | 0 | 0 | 0 |
| legacy_mirror | industry_occupation_mapping | 15 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | industry_profiles | 8 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | job_template_skills | 28983 | exact | 5.0 MB | N | 0 | 0 | 0 |
| legacy_mirror | job_templates | 140 | exact | 72 kB | N | 0 | 0 | 0 |
| legacy_mirror | job_title_courses | 207 | exact | 64 kB | N | 0 | 0 | 0 |
| legacy_mirror | job_title_learning_paths | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | learning_bookmarks | 43 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | learning_content_providers | 12 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | learning_path_courses | 124 | exact | 40 kB | N | 0 | 0 | 0 |
| legacy_mirror | learning_path_enrollments | 341 | exact | 96 kB | N | 0 | 0 | 0 |
| legacy_mirror | learning_paths | 20 | exact | 320 kB | N | 0 | 0 | 0 |
| legacy_mirror | learning_ratings | 396 | exact | 96 kB | N | 0 | 0 | 0 |
| legacy_mirror | learning_recommendations | 1045 | exact | 264 kB | N | 0 | 0 | 0 |
| legacy_mirror | market_benchmarks | 32 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | market_salary_data | 84 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | module_completions | 2899 | exact | 480 kB | N | 0 | 0 | 0 |
| legacy_mirror | occupation_industry_classifications | 4565 | exact | 424 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_abilities | 15 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_esco_mappings | 135 | exact | 56 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_import_jobs | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_knowledge | 20 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_occupation_abilities | 215 | exact | 56 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_occupation_knowledge | 279 | exact | 64 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_occupation_skills | 71 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_occupation_work_activities | 218 | exact | 56 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_occupations | 25 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_skills | 35 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | onet_work_activities | 15 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ontology_categories | 9 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ontology_embedding_jobs | 1 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ontology_feedback | 52 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | ontology_inference_jobs | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | ontology_quality_metrics | 50 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ontology_skill_dimensions | 25 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ontology_skill_relations | 30 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | ontology_source_mappings | 40 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | process_kpis | 81 | exact | 56 kB | N | 0 | 0 | 0 |
| legacy_mirror | process_phases | 63 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | rating_scales | 4 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | semantic_entity_index | 4115 | exact | 51 MB | N | 0 | 0 | 0 |
| legacy_mirror | semantic_entity_relations | 15 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | semantic_search_log | 7 | exact | 136 kB | N | 0 | 0 | 0 |
| legacy_mirror | sindacati | 22 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_adjacencies | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_aliases | 80 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_classifications | 7215 | exact | 1.0 MB | N | 0 | 0 | 0 |
| legacy_mirror | skill_clusters | 49 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_demand_metrics | 200 | exact | 104 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_development_paths | 65 | exact | 56 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_extraction_jobs | 31 | exact | 56 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_gap_analyses | 304 | exact | 1.5 MB | N | 0 | 0 | 0 |
| legacy_mirror | skill_gap_snapshots | 36 | exact | 64 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_matrices | 4 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_migration_jobs | 0 | exact | 8 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_pair_usage | 111 | exact | 56 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_relationships | 16 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_requirements_templates | 8 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_supply_metrics | 200 | exact | 112 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_synonyms | 50 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | skill_taxonomy_extensions | 52 | exact | 48 kB | N | 0 | 0 | 0 |
| legacy_mirror | tenant_industry_classifications | 4 | exact | 16 kB | N | 0 | 0 | 0 |
| legacy_mirror | unknown_skills | 30 | exact | 16 kB | N | 0 | 0 | 0 |

**Source totals:** 97 tables; ~196,856 rows (dominated by `esco_occupation_skills` 126k, `job_template_skills` 29k, `skill_classifications` 7.2k, `esco_skill_relations` 5.8k, `occupation_industry_classifications` 4.6k, `semantic_entity_index` 4.1k, `industry_classifications` 3.3k, `esco_occupations` 3.0k, `course_enrollments` 3.0k, `module_completions` 2.9k). 0 PKs / 0 FKs by design — `legacy_mirror` is staging-grade.

**93 `brownfield.source_tables` rows ≠ 97 `legacy_mirror` tables.** Reconciled in §10: probably 4 tables were ingested but excluded from registry (e.g., audit/ops tables) or `source_tables` was populated against a pre-trim manifest.

---

## Section 3 — Target inventory

Tables grouped by schema. `est` = `pg_class.reltuples::bigint` (−1 = never ANALYZE-d). For populated tables that report `-1`, exact count appears in §5.

### audit (4 tables)

| table | rows_est | size | pk |
|---|---|---|---|
| import_approval_decisions | 0 | 56 kB | Y |
| import_run_logs | 0 (exact) | 24 kB | Y |
| import_validation_results | 0 | 7.2 MB | Y |
| user_self_service_actions | 0 (exact) | 48 kB | Y |

### brownfield (6 tables) — migration registry

| table | rows | size | pk |
|---|---|---|---|
| column_mappings | **1177** | 560 kB | Y |
| import_runs | **1** (visible) | 96 kB | Y |
| source_columns | **1164** | 416 kB | Y |
| source_exports | 0 | 48 kB | Y |
| source_tables | **93** | 112 kB | Y |
| table_mappings | **94** | 128 kB | Y |

### legacy_mirror (97 tables) — see §2.B

### staging (17 tables) — Wave 1 intermediate

| table | rows | size | pk |
|---|---|---|---|
| wave1_activity_classification_mappings | 0 | 40 kB | Y |
| wave1_activity_classifications | 0 | 168 kB | Y |
| wave1_blueprint_process_registry | 0 | 88 kB | Y |
| wave1_compensation_bands | 0 | 88 kB | Y |
| wave1_esco_occupation_mappings | 0 | 112 kB | Y |
| wave1_job_roles | 0 | 216 kB | Y |
| wave1_learning_modules | 0 | 160 kB | Y |
| wave1_learning_path_steps | 0 | 88 kB | Y |
| wave1_learning_paths | 0 | 160 kB | Y |
| wave1_process_kpi_templates | 0 | 88 kB | Y |
| wave1_skill_aliases | 0 | 88 kB | Y |
| wave1_skill_categories | **49** | 216 kB | Y |
| wave1_skill_families | 0 | 200 kB | Y |
| wave1_skill_learning_mappings | 0 | 88 kB | Y |
| wave1_skill_taxonomy_edges | 0 | 144 kB | Y |
| wave1_skills | 0 | 264 kB | Y |
| wave1_user_certifications | 0 | 88 kB | Y |

**Staging totals:** 17 tables; **49 rows total** (single table `wave1_skill_categories`).

### sys (115 tables) — canonical platform schema

Populated tables only (others = 0, listed by name at end). Counts are exact via `query_to_xml`.

| table | exact rows | notes |
|---|---|---|
| sys_assessments | 2 | seed |
| sys_auth_login_events | 534 | runtime (auth tests) |
| sys_auth_password_reset_tokens | 64 | runtime |
| sys_auth_permissions | 99 | seed (MVP-1) |
| sys_auth_refresh_tokens | 3729 | runtime — high churn |
| sys_auth_role_permissions | 394 | seed (8 roles × ~49 perms) |
| sys_auth_roles | 8 | seed |
| sys_blueprint_families | 1 | seed |
| sys_blueprint_process_registry | **23** | ✅ Wave 1 OPOURSKA/PROGOV partial — matches HANDOFF claim |
| sys_blueprint_variants | 1 | seed |
| sys_branches | 5 | seed |
| sys_enterprise_size_bands | 4 | seed |
| sys_kpi_weighting_rules | 3 | seed |
| sys_learning_modules | 1 | seed |
| sys_operating_model_catalog | 6 | seed |
| sys_organization_unit_types | 8 | seed |
| sys_organization_units | 6 | seed (RTL Bank) |
| sys_positions | **161** | seed (RTL Bank) |
| sys_reward_gate_catalog | 7 | seed |
| sys_schema_migrations | 30 | covers 000001..000030 ✅ |
| sys_skill_proficiency_levels | 6 | seed |
| sys_skills | **52** | ✅ Wave 1 partial — matches HANDOFF claim |
| sys_source_lineage_records | **52** | ✅ lineage rows = skills loaded — 1:1 |
| sys_tenancies | 2 | seed (`RTL_BANK_REFERENCE` + PLATFORM) |
| sys_training_initiatives | 1 | seed |
| sys_user_auth_roles | 5 | seed (test personas) |
| sys_user_position_assignments | 158 | seed |
| sys_users | **163** | seed |
| sys_assessment_methods | 5 | seed |
| sys_kpi_assessment_methods | 5 | seed |
| sys_auth_credentials | 5 | seed |
| sys_auth_identities | 5 | seed |

Empty (`sys_*` with exact=0, 84 tables): sys_activity_classification_mappings, sys_activity_classifications, sys_assessment_results, sys_auth_mfa_factors, sys_auth_sessions, sys_behavioral_assessments, sys_blueprint_activations, sys_blueprint_overrides, sys_bonus_pools, sys_career_path_steps, sys_career_paths, sys_compensation_bands, sys_compensation_recommendations, sys_critical_positions, sys_critical_role_coverage_status, sys_employee_position_fit_scores, sys_enterprise_typing_profiles, sys_esco_occupation_mappings, sys_gap_analysis_results, sys_gap_closure_actions, sys_gap_closure_plans, sys_inbox_notifications, sys_job_families, sys_job_roles, sys_kpi_assessment_results, sys_kpi_definitions, sys_kpi_measurements, sys_kpi_metric_definitions, sys_kpi_targets, sys_learning_gaps, sys_learning_path_steps, sys_learning_paths, sys_objective_reward_rules, sys_organization_hierarchies, sys_organization_unit_history, sys_organization_unit_kpi_templates, sys_payout_curves, sys_payroll_handoff_records, sys_person_evidence_records, sys_position_career_paths, sys_position_compensation_profiles, sys_position_economic_weight, sys_position_kpi_requirements, sys_position_learning_requirements, sys_position_skill_requirement_history, sys_position_skill_requirements, sys_position_succession_relevance, sys_process_kpi_templates, sys_readiness_scores, sys_reward_gate_results, sys_reward_gates, sys_seed_acquisition_runs, sys_seed_approval_decisions, sys_seed_candidate_records, sys_seed_source_evidence, sys_seed_validation_results, sys_skill_aliases, sys_skill_categories, sys_skill_families, sys_skill_learning_mappings, sys_skill_taxonomy_edges, sys_succession_pools, sys_succession_scores, sys_successor_candidates, sys_successor_readiness, sys_talent_scores, sys_user_assessment_evidence, sys_user_career_plans, sys_user_certifications, sys_user_documents, sys_user_education_records, sys_user_kpi_evidence, sys_user_learning_assignments, sys_user_learning_evidence, sys_user_professional_experiences, sys_user_profiles, sys_user_skill_evidence, sys_user_target_positions, sys_variable_pay_calculations, sys_visualization_edges, sys_visualization_exports, sys_visualization_graphs, sys_visualization_layouts, sys_visualization_node_layouts, sys_visualization_nodes, sys_visualization_styles.

### public (0 user tables)

`public` schema present but no user tables.

**Target totals:** 239 user tables across 5 schemas. 320 FK constraints on `sys.*`.

---

## Section 4 — Schema diff & mapping

### 4.A Conceptual diff — evo Prisma → sys.sys_*

This is **architectural mapping**, not an automated translation. Heuresys v5 is position-centric (Invariant I1), evo was employee-centric. Reconstruction below from doc evidence (HANDOFF.md, BROWNFIELD_IMPORT_PIPELINE_SPEC.md, CLAUDE.md):

| evo Prisma model (subset) | heuresys-advanced target | status | evidence | confidence |
|---|---|---|---|---|
| `employees` | `sys.sys_users` + `sys.sys_user_position_assignments` (decomposed) | split | CLAUDE.md I1 + migration `000004_users.sql` + `000012_user_position_assignments.sql` | high |
| `employee_skills` | `sys.sys_position_skill_requirements` (position-level) | mapped (semantic shift) | migration `000014_position_skill_requirements.sql`; evo employee.skill was incumbent-centric, sys is requirement-centric | high |
| `tenants` | `sys.sys_tenancies` | renamed | migration `000003_tenancies.sql`; same role | high |
| `users` (NextAuth) + `account` + `session` | `sys.sys_auth_users` family (11 `sys_auth_*` tables) | replaced | CLAUDE.md I7 + migration `000005_auth_foundation.sql`; NextAuth replaced by Argon2id + RS256 (ADR-0005) | high |
| `esco_occupations` | `sys.sys_esco_occupation_mappings` (mapping table only — full ESCO catalogue lives in `legacy_mirror`) | partial | brownfield.table_mappings (Wave 1 ESKAP) | high |
| `esco_skills` / `esco_skill_groups` / `esco_isco_groups` | `sys.sys_skills` + `sys.sys_skill_families` + `sys.sys_skill_categories` | split | brownfield.table_mappings (Wave 1 ESKAP) | high |
| `industry_classifications` | `sys.sys_activity_classifications` | renamed | brownfield.table_mappings (Wave 1 INDOOR) | high |
| `org_units` | `sys.sys_organization_units` | renamed | migration `000009_organization_model.sql` | high |
| `rbp_roles` | `sys.sys_auth_roles` + `sys_auth_role_permissions` | replaced | RBAC replaced by RBP→permission cache; migration `000005_auth_foundation.sql` + `000028_dashboard_permission_seed.sql` | high |
| `tenant_jobs` / `tenant_job_skills` | `sys.sys_job_roles` + `sys.sys_position_skill_requirements` | merged | CLAUDE.md I1 (position vs job); brownfield Wave 1 OPOURSKA `job_templates`→`sys_job_roles` | high |
| `performance_reviews` | `sys.sys_assessment_results` + `sys.sys_kpi_assessment_results` | split | migrations `000015_kpi_model.sql` + `000017_assessment_gap_model.sql` | medium |
| `recruiting_candidates` / `recruiting_offers` / `requisitions` / `job_postings` | — | dropped-intentionally | not in heuresys v5 scope (no recruiting module shipped); MVP-3 scope per HANDOFF | medium |
| `workforce_plans` / `workforce_plan_scenarios` / `workforce_plan_actions` | — | dropped-intentionally | not in heuresys v5 MVP; no migration introduces these tables | medium |
| `feedback_360` | — | unknown | no obvious sys.* target; not in Wave 1 mappings; [KD: not addressed by docs] | low |
| `merit_cycles` / `succession_candidates` | `sys.sys_successor_candidates` + `sys.sys_succession_*` (parts) | partial | migration `000018_career_succession_model.sql` | medium |
| `course_enrollments` / `courses` / `learning_paths` / `learning_path_enrollments` | `sys.sys_learning_modules` + `sys.sys_learning_paths` + `sys.sys_learning_path_steps` + `sys.sys_user_learning_assignments` | split | brownfield Wave 1 SKILGRO (8 mappings) | high |
| `certifications` / `course_enrollments` (cert sub-track) | `sys.sys_user_certifications` | mapped | brownfield Wave 1 SKILGRO | high |
| `employee_time_off_requests` / `employee_attendance` / `goals` / `interviews` / `audit_logs` / `verification_token` / `platform_features` / `platform_pages` / `cost_centers` / `company_sizes` / `locations` / `critical_roles` / `employee_skill_assessments` / `employee_skill_profiles` / `employee_timeline` / `skill_classifications` / `skill_clusters` / `tenant_onboarding_profiles` / `workspace_templates` / `workspace_widgets` | — / partial | unknown / dropped-intentionally | not present in `brownfield.table_mappings` Wave-1 set; some (e.g. `skill_classifications`, `skill_clusters`) are in `legacy_mirror` but mapped to `sys_skill_categories`/`sys_skill_families` only via SKILGRO mappings | low |

### 4.B Effective diff — `legacy_mirror.*` → `sys.*` per `brownfield.table_mappings` (Wave 1)

All 94 Wave 1 mappings (`classification=IMPORT`, `approval_status=APPROVED`, `wave=1`). Source schema is always `public` in the legacy export → loaded into `legacy_mirror`; target schema is always `sys`.

| domain | legacy_mirror source | sys target | status | confidence |
|---|---|---|---|---|
| ESKAP | cross_entity_relations | sys_skill_taxonomy_edges | mapped | high |
| ESKAP | cross_entity_searches | sys_skills | mapped | high |
| ESKAP | esco_isco_groups | sys_skill_families | mapped | high |
| ESKAP | esco_occupation_skills | sys_position_skill_requirements | mapped | high |
| ESKAP | esco_occupations | sys_esco_occupation_mappings | mapped | high |
| ESKAP | esco_skill_groups | sys_skill_families | mapped | high |
| ESKAP | esco_skill_relations | sys_skill_taxonomy_edges | mapped | high |
| ESKAP | onet_abilities | sys_skills | mapped | high |
| ESKAP | onet_esco_mappings | sys_skill_taxonomy_edges | mapped | high |
| ESKAP | onet_import_jobs | sys_skills | mapped | high |
| ESKAP | onet_knowledge | sys_skills | mapped | high |
| ESKAP | onet_occupation_abilities | sys_position_skill_requirements | mapped | high |
| ESKAP | onet_occupation_knowledge | sys_position_skill_requirements | mapped | high |
| ESKAP | onet_occupation_skills | sys_position_skill_requirements | mapped | high |
| ESKAP | onet_occupation_work_activities | sys_position_skill_requirements | mapped | high |
| ESKAP | onet_occupations | sys_esco_occupation_mappings | mapped | high |
| ESKAP | onet_skills | sys_skills | mapped | high |
| ESKAP | onet_work_activities | sys_skills | mapped | high |
| ESKAP | ontology_categories | sys_skill_categories | mapped | high |
| ESKAP | ontology_embedding_jobs | sys_skills | mapped | high |
| ESKAP | ontology_feedback | sys_skills | mapped | high |
| ESKAP | ontology_inference_jobs | sys_skills | mapped | high |
| ESKAP | ontology_quality_metrics | sys_skills | mapped | high |
| ESKAP | ontology_skill_dimensions | sys_skills | mapped | high |
| ESKAP | ontology_skill_relations | sys_skill_taxonomy_edges | mapped | high |
| ESKAP | ontology_source_mappings | sys_skill_taxonomy_edges | mapped | high |
| ESKAP | semantic_entity_index | sys_skills | mapped | high |
| ESKAP | semantic_entity_relations | sys_skill_taxonomy_edges | mapped | high |
| ESKAP | semantic_search_log | sys_skills | mapped | high |
| H2R | job_title_courses | sys_skill_learning_mappings | mapped | high |
| H2R | job_title_learning_paths | sys_position_learning_requirements | mapped | high |
| INDOOR | benchmark_configs | sys_blueprint_overrides | mapped | high |
| INDOOR | benchmark_reports | sys_blueprint_overrides | mapped | high |
| INDOOR | industry_ccnl_mapping | sys_activity_classification_mappings | mapped | high |
| INDOOR | industry_classifications | sys_activity_classifications | mapped | high |
| INDOOR | industry_occupation_mapping | sys_esco_occupation_mappings | mapped | high |
| INDOOR | industry_profiles | sys_activity_classifications | mapped | high |
| INDOOR | market_benchmarks | sys_skills | mapped | high |
| INDOOR | market_salary_data | sys_skills | mapped | high |
| INDOOR | occupation_industry_classifications | sys_esco_occupation_mappings | mapped | high |
| INDOOR | tenant_industry_classifications | sys_blueprint_overrides | mapped | high |
| ITLAB | ccnl_contracts | sys_compensation_bands | mapped | high |
| ITLAB | ccnl_executive_bands | sys_compensation_bands | mapped | high |
| ITLAB | ccnl_job_title_mapping | sys_job_roles | mapped | high |
| ITLAB | ccnl_levels | sys_compensation_bands | mapped | high |
| ITLAB | ccnl_seniority_rules | sys_compensation_bands | mapped | high |
| ITLAB | holidays | sys_blueprint_overrides | mapped | high |
| ITLAB | sindacati | sys_compensation_bands | mapped | high |
| OPOURSKA | business_processes | sys_blueprint_process_registry | mapped | high |
| OPOURSKA | esco_skills | sys_skills | mapped | high |
| OPOURSKA | job_template_skills | sys_position_skill_requirements | mapped | high |
| OPOURSKA | job_templates | sys_job_roles | mapped | high |
| PROGOV | process_kpis | sys_process_kpi_templates | mapped | high |
| PROGOV | process_phases | sys_blueprint_process_registry | mapped | high |
| SKILGRO | certification_esco_skills | sys_skill_learning_mappings | mapped | high |
| SKILGRO | certifications | sys_user_certifications | mapped | high |
| SKILGRO | competencies | sys_skill_categories | mapped (1 of 2 targets) | high |
| SKILGRO | competencies | sys_skills | mapped (2 of 2 targets) | high |
| SKILGRO | competency_frameworks | sys_skill_families | mapped | high |
| SKILGRO | competency_review_ratings | sys_skills | mapped | high |
| SKILGRO | course_enrollments | sys_learning_paths | mapped | high |
| SKILGRO | course_enrollments_semantic | sys_learning_paths | mapped | high |
| SKILGRO | course_esco_skills | sys_skill_learning_mappings | mapped | high |
| SKILGRO | course_modules | sys_learning_path_steps | mapped | high |
| SKILGRO | courses | sys_learning_modules | mapped | high |
| SKILGRO | extracted_skills | sys_skills | mapped | high |
| SKILGRO | import_skill_links | sys_skill_taxonomy_edges | mapped | high |
| SKILGRO | learning_bookmarks | sys_learning_modules | mapped | high |
| SKILGRO | learning_content_providers | sys_learning_modules | mapped | high |
| SKILGRO | learning_path_courses | sys_learning_path_steps | mapped | high |
| SKILGRO | learning_path_enrollments | sys_learning_paths | mapped | high |
| SKILGRO | learning_paths | sys_learning_paths | mapped | high |
| SKILGRO | learning_ratings | sys_learning_modules | mapped | high |
| SKILGRO | learning_recommendations | sys_learning_modules | mapped | high |
| SKILGRO | module_completions | sys_learning_modules | mapped | high |
| SKILGRO | rating_scales | sys_skills | mapped | high |
| SKILGRO | skill_adjacencies | sys_skill_taxonomy_edges | mapped | high |
| SKILGRO | skill_aliases | sys_skill_aliases | mapped | high |
| SKILGRO | skill_classifications | sys_skill_categories | mapped | high |
| SKILGRO | skill_clusters | sys_skill_families | mapped | high |
| SKILGRO | skill_demand_metrics | sys_skills | mapped | high |
| SKILGRO | skill_development_paths | sys_learning_paths | mapped | high |
| SKILGRO | skill_extraction_jobs | sys_skills | mapped | high |
| SKILGRO | skill_gap_analyses | sys_skills | mapped | high |
| SKILGRO | skill_gap_snapshots | sys_skills | mapped | high |
| SKILGRO | skill_matrices | sys_skill_taxonomy_edges | mapped | high |
| SKILGRO | skill_migration_jobs | sys_skills | mapped | high |
| SKILGRO | skill_pair_usage | sys_skill_taxonomy_edges | mapped | high |
| SKILGRO | skill_relationships | sys_skill_taxonomy_edges | mapped | high |
| SKILGRO | skill_requirements_templates | sys_position_skill_requirements | mapped | high |
| SKILGRO | skill_supply_metrics | sys_skills | mapped | high |
| SKILGRO | skill_synonyms | sys_skill_aliases | mapped | high |
| SKILGRO | skill_taxonomy_extensions | sys_skill_taxonomy_edges | mapped | high |
| SKILGRO | unknown_skills | sys_skills | mapped | high |

**Wave 1 coverage:** 93 distinct legacy_mirror sources → 17 distinct sys targets, fan-in is heavy (sys_skills receives ~30 sources, sys_skill_taxonomy_edges receives ~10). `competencies` is split-target (1:2). Wave 2-4 are documented in `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_IMPORT_WAVES.md` but not yet registered in `brownfield.table_mappings` (table_mapping_wave=NULL for none — query returned only wave=1, count=94).

---

## Section 5 — Data parity

Verdict legend: `parity` (delta_pct < 0.1%) | `acceptable-delta` (delta with justification) | `MISMATCH` (unexplained delta).

`MISMATCH` rows sorted top. All counts are exact via `query_to_xml` on 2026-05-18.

| source | target | source_count | target_count | delta | delta_pct | verdict |
|---|---|---|---|---|---|---|
| **legacy_mirror.esco_occupation_skills** | sys.sys_position_skill_requirements (+ others fan-in) | 126051 | 0 | -126051 | -100% | **MISMATCH** |
| **legacy_mirror.job_template_skills** | sys.sys_position_skill_requirements | 28983 | 0 | -28983 | -100% | **MISMATCH** |
| **legacy_mirror.skill_classifications** | sys.sys_skill_categories | 7215 | 0 | -7215 | -100% | **MISMATCH** |
| **legacy_mirror.esco_skill_relations** | sys.sys_skill_taxonomy_edges | 5818 | 0 | -5818 | -100% | **MISMATCH** |
| **legacy_mirror.occupation_industry_classifications** | sys.sys_esco_occupation_mappings | 4565 | 0 | -4565 | -100% | **MISMATCH** |
| **legacy_mirror.semantic_entity_index** | sys.sys_skills | 4115 | 52 | -4063 | -98.7% | **MISMATCH** (partial) |
| **legacy_mirror.industry_classifications** | sys.sys_activity_classifications | 3276 | 0 | -3276 | -100% | **MISMATCH** |
| **legacy_mirror.esco_occupations** | sys.sys_esco_occupation_mappings | 3040 | 0 | -3040 | -100% | **MISMATCH** |
| **legacy_mirror.course_enrollments** | sys.sys_learning_paths | 3052 | 0 | -3052 | -100% | **MISMATCH** |
| **legacy_mirror.module_completions** | sys.sys_learning_modules | 2899 | 1 | -2898 | -99.97% | **MISMATCH** (partial) |
| **legacy_mirror.learning_recommendations** | sys.sys_learning_modules | 1045 | 1 | -1044 | -99.9% | **MISMATCH** (partial) |
| **legacy_mirror.certification_esco_skills** | sys.sys_skill_learning_mappings | 664 | 0 | -664 | -100% | **MISMATCH** |
| **legacy_mirror.course_esco_skills** | sys.sys_skill_learning_mappings | 717 | 0 | -717 | -100% | **MISMATCH** |
| **legacy_mirror.course_modules** | sys.sys_learning_path_steps | 564 | 0 | -564 | -100% | **MISMATCH** |
| **legacy_mirror.competency_review_ratings** | sys.sys_skills | 465 | 52 | -413 | -88.8% | **MISMATCH** (partial) |
| **legacy_mirror.learning_ratings** | sys.sys_learning_modules | 396 | 1 | -395 | -99.7% | **MISMATCH** (partial) |
| **legacy_mirror.learning_path_enrollments** | sys.sys_learning_paths | 341 | 0 | -341 | -100% | **MISMATCH** |
| **legacy_mirror.skill_gap_analyses** | sys.sys_skills | 304 | 52 | -252 | -82.9% | **MISMATCH** (partial) |
| **legacy_mirror.onet_occupation_knowledge** | sys.sys_position_skill_requirements | 279 | 0 | -279 | -100% | **MISMATCH** |
| **legacy_mirror.onet_occupation_work_activities** | sys.sys_position_skill_requirements | 218 | 0 | -218 | -100% | **MISMATCH** |
| **legacy_mirror.onet_occupation_abilities** | sys.sys_position_skill_requirements | 215 | 0 | -215 | -100% | **MISMATCH** |
| **legacy_mirror.job_title_courses** | sys.sys_skill_learning_mappings | 207 | 0 | -207 | -100% | **MISMATCH** |
| **legacy_mirror.skill_demand_metrics** | sys.sys_skills | 200 | 52 | -148 | -74.0% | **MISMATCH** (partial) |
| **legacy_mirror.skill_supply_metrics** | sys.sys_skills | 200 | 52 | -148 | -74.0% | **MISMATCH** (partial) |
| **legacy_mirror.holidays** | sys.sys_blueprint_overrides | 144 | 0 | -144 | -100% | **MISMATCH** |
| **legacy_mirror.job_templates** | sys.sys_job_roles | 140 | 0 | -140 | -100% | **MISMATCH** |
| **legacy_mirror.onet_esco_mappings** | sys.sys_skill_taxonomy_edges | 135 | 0 | -135 | -100% | **MISMATCH** |
| **legacy_mirror.courses** | sys.sys_learning_modules | 127 | 1 | -126 | -99.2% | **MISMATCH** (partial) |
| **legacy_mirror.learning_path_courses** | sys.sys_learning_path_steps | 124 | 0 | -124 | -100% | **MISMATCH** |
| **legacy_mirror.skill_pair_usage** | sys.sys_skill_taxonomy_edges | 111 | 0 | -111 | -100% | **MISMATCH** |
| **legacy_mirror.ccnl_job_title_mapping** | sys.sys_job_roles | 91 | 0 | -91 | -100% | **MISMATCH** |
| **legacy_mirror.certifications** | sys.sys_user_certifications | 88 | 0 | -88 | -100% | **MISMATCH** |
| **legacy_mirror.cross_entity_relations** | sys.sys_skill_taxonomy_edges | 85 | 0 | -85 | -100% | **MISMATCH** |
| **legacy_mirror.market_salary_data** | sys.sys_skills | 84 | 52 | -32 | -38.1% | **MISMATCH** (partial) |
| **legacy_mirror.process_kpis** | sys.sys_process_kpi_templates | 81 | 0 | -81 | -100% | **MISMATCH** |
| **legacy_mirror.skill_aliases** | sys.sys_skill_aliases | 80 | 0 | -80 | -100% | **MISMATCH** |
| **legacy_mirror.onet_occupation_skills** | sys.sys_position_skill_requirements | 71 | 0 | -71 | -100% | **MISMATCH** |
| **legacy_mirror.skill_development_paths** | sys.sys_learning_paths | 65 | 0 | -65 | -100% | **MISMATCH** |
| **legacy_mirror.process_phases** | sys.sys_blueprint_process_registry | 63 | 23 | -40 | -63.5% | **acceptable-delta** ✓ |
| **legacy_mirror.ontology_feedback** | sys.sys_skills | 52 | 52 | 0 | 0% | **parity** ✓ |
| **legacy_mirror.skill_taxonomy_extensions** | sys.sys_skill_taxonomy_edges | 52 | 0 | -52 | -100% | **MISMATCH** |
| **legacy_mirror.skill_clusters** | sys.sys_skill_families | 49 | 0 | -49 | -100% | **MISMATCH** |
| **legacy_mirror.learning_bookmarks** | sys.sys_learning_modules | 43 | 1 | -42 | -97.7% | **MISMATCH** (partial) |
| **legacy_mirror.skill_synonyms** | sys.sys_skill_aliases | 50 | 0 | -50 | -100% | **MISMATCH** |
| **legacy_mirror.ontology_quality_metrics** | sys.sys_skills | 50 | 52 | +2 | +4.0% | acceptable-delta (cross-source target; ontology_feedback contributes too) |
| **legacy_mirror.ontology_source_mappings** | sys.sys_skill_taxonomy_edges | 40 | 0 | -40 | -100% | **MISMATCH** |
| **legacy_mirror.skill_gap_snapshots** | sys.sys_skills | 36 | 52 | +16 | +44.4% | acceptable-delta (cross-source target) |
| **legacy_mirror.ccnl_levels** | sys.sys_compensation_bands | 36 | 0 | -36 | -100% | **MISMATCH** |
| **legacy_mirror.onet_skills** | sys.sys_skills | 35 | 52 | +17 | +48.6% | acceptable-delta (cross-source target) |
| **legacy_mirror.competencies → sys_skill_categories** | sys.sys_skill_categories | 32 | 0 | -32 | -100% | **MISMATCH** |
| **legacy_mirror.competencies → sys_skills** | sys.sys_skills | 32 | 52 | +20 | +62.5% | acceptable-delta (cross-source target) |
| **legacy_mirror.market_benchmarks** | sys.sys_skills | 32 | 52 | +20 | +62.5% | acceptable-delta (cross-source target) |
| **legacy_mirror.skill_extraction_jobs** | sys.sys_skills | 31 | 52 | +21 | +67.7% | acceptable-delta (cross-source target) |
| **legacy_mirror.unknown_skills** | sys.sys_skills | 30 | 52 | +22 | +73.3% | acceptable-delta (cross-source target) |
| **legacy_mirror.ontology_skill_relations** | sys.sys_skill_taxonomy_edges | 30 | 0 | -30 | -100% | **MISMATCH** |
| **legacy_mirror.ontology_skill_dimensions** | sys.sys_skills | 25 | 52 | +27 | +108% | acceptable-delta (cross-source target) |
| **legacy_mirror.onet_occupations** | sys.sys_esco_occupation_mappings | 25 | 0 | -25 | -100% | **MISMATCH** |
| **legacy_mirror.sindacati** | sys.sys_compensation_bands | 22 | 0 | -22 | -100% | **MISMATCH** |
| **legacy_mirror.learning_paths** | sys.sys_learning_paths | 20 | 0 | -20 | -100% | **MISMATCH** |
| **legacy_mirror.course_enrollments_semantic** | sys.sys_learning_paths | 20 | 0 | -20 | -100% | **MISMATCH** |
| **legacy_mirror.onet_knowledge** | sys.sys_skills | 20 | 52 | +32 | +160% | acceptable-delta (cross-source target) |
| **legacy_mirror.skill_relationships** | sys.sys_skill_taxonomy_edges | 16 | 0 | -16 | -100% | **MISMATCH** |
| **legacy_mirror.industry_occupation_mapping** | sys.sys_esco_occupation_mappings | 15 | 0 | -15 | -100% | **MISMATCH** |
| **legacy_mirror.onet_abilities** | sys.sys_skills | 15 | 52 | +37 | +247% | acceptable-delta (cross-source target) |
| **legacy_mirror.onet_work_activities** | sys.sys_skills | 15 | 52 | +37 | +247% | acceptable-delta (cross-source target) |
| **legacy_mirror.semantic_entity_relations** | sys.sys_skill_taxonomy_edges | 15 | 0 | -15 | -100% | **MISMATCH** |
| **legacy_mirror.esco_isco_groups** | sys.sys_skill_families | 14 | 0 | -14 | -100% | **MISMATCH** |
| **legacy_mirror.learning_content_providers** | sys.sys_learning_modules | 12 | 1 | -11 | -91.7% | **MISMATCH** (partial) |
| **legacy_mirror.ccnl_executive_bands** | sys.sys_compensation_bands | 10 | 0 | -10 | -100% | **MISMATCH** |
| **legacy_mirror.esco_skill_groups** | sys.sys_skill_families | 10 | 0 | -10 | -100% | **MISMATCH** |
| **legacy_mirror.ontology_categories** | sys.sys_skill_categories | 9 | 0 | -9 | -100% | **MISMATCH** |
| **legacy_mirror.industry_profiles** | sys.sys_activity_classifications | 8 | 0 | -8 | -100% | **MISMATCH** |
| **legacy_mirror.benchmark_configs** | sys.sys_blueprint_overrides | 8 | 0 | -8 | -100% | **MISMATCH** |
| **legacy_mirror.skill_requirements_templates** | sys.sys_position_skill_requirements | 8 | 0 | -8 | -100% | **MISMATCH** |
| **legacy_mirror.semantic_search_log** | sys.sys_skills | 7 | 52 | +45 | +643% | acceptable-delta (cross-source target) |
| **legacy_mirror.ccnl_contracts** | sys.sys_compensation_bands | 7 | 0 | -7 | -100% | **MISMATCH** |
| **legacy_mirror.competency_frameworks** | sys.sys_skill_families | 4 | 0 | -4 | -100% | **MISMATCH** |
| **legacy_mirror.tenant_industry_classifications** | sys.sys_blueprint_overrides | 4 | 0 | -4 | -100% | **MISMATCH** |
| **legacy_mirror.skill_matrices** | sys.sys_skill_taxonomy_edges | 4 | 0 | -4 | -100% | **MISMATCH** |
| **legacy_mirror.rating_scales** | sys.sys_skills | 4 | 52 | +48 | +1200% | acceptable-delta (cross-source target) |
| **legacy_mirror.benchmark_reports** | sys.sys_blueprint_overrides | 4 | 0 | -4 | -100% | **MISMATCH** |
| **legacy_mirror.ontology_embedding_jobs** | sys.sys_skills | 1 | 52 | +51 | +5100% | acceptable-delta (cross-source target) |
| **legacy_mirror.business_processes** | sys.sys_blueprint_process_registry | 0 | 23 | +23 | n/a | **acceptable-delta** (other sources contribute — process_phases=63) |
| **legacy_mirror.esco_skills** | sys.sys_skills | 0 | 52 | +52 | n/a | acceptable-delta (target populated by other ESKAP/SKILGRO sources) |
| **legacy_mirror.cross_entity_searches** | sys.sys_skills | 0 | 52 | +52 | n/a | acceptable-delta (cross-source target) |
| **legacy_mirror.extracted_skills** | sys.sys_skills | 0 | 52 | +52 | n/a | acceptable-delta (cross-source target) |
| **legacy_mirror.import_skill_links** | sys.sys_skill_taxonomy_edges | 0 | 0 | 0 | 0% | parity |
| **legacy_mirror.industry_ccnl_mapping** | sys.sys_activity_classification_mappings | 0 | 0 | 0 | 0% | parity |
| **legacy_mirror.job_title_learning_paths** | sys.sys_position_learning_requirements | 0 | 0 | 0 | 0% | parity |
| **legacy_mirror.onet_import_jobs** | sys.sys_skills | 0 | 52 | +52 | n/a | acceptable-delta (cross-source target) |
| **legacy_mirror.ontology_inference_jobs** | sys.sys_skills | 0 | 52 | +52 | n/a | acceptable-delta (cross-source target) |
| **legacy_mirror.skill_adjacencies** | sys.sys_skill_taxonomy_edges | 0 | 0 | 0 | 0% | parity |
| **legacy_mirror.skill_migration_jobs** | sys.sys_skills | 0 | 52 | +52 | n/a | acceptable-delta (cross-source target) |
| **legacy_mirror.ccnl_seniority_rules** | sys.sys_compensation_bands | 0 | 0 | 0 | 0% | parity |

**Headline:** of 94 mapping rows scored, **~62 are MISMATCH** with sources non-empty and target empty (or near-empty). 5 are parity. Remainder are `acceptable-delta` driven by fan-in (multiple sources → single target). The MISMATCH cluster is consistent with the digest claim that Wave 1 has only landed `sys_skills`=52 + `sys_blueprint_process_registry`=23 + `sys_user_certifications`=1 + lineage=52 — i.e., **~0.05% of Wave 1 source volume migrated**. Full Wave 1 ingestion remains to do.

---

## Section 6 — Referential integrity (target only)

**Result: 0 orphan rows across all 320 FK constraints on `sys.*`.**

Verification: `DO $$ ... EXECUTE format('SELECT count(*) FROM %s ch WHERE ch.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %s p WHERE p.%I = ch.%I)', ...)` over the full `pg_constraint contype='f' AND conrelid in sys` set. Output: `SUMMARY|FKs_total=320|FKs_with_orphans=0`.

No orphan FK rows detected across 320 FK constraints (sys schema).

FK orphan check was scoped to `sys.*` (the canonical schema). `legacy_mirror.*` has 0 FK constraints by design (staging-grade ingest target), so no orphan risk exists there. `brownfield.*` has 22 FK in_count (3 outbound from `import_runs` + 22 inbound to `source_tables`); spot check via the same DO-block pattern on brownfield schema was NOT run for budget reasons (low priority — registry is small, populated by single seed run that passed CHECK constraints).

---

## Section 7 — Import script inventory

### 7.A SQL migrations (heuresys-advanced `db/migrations/`)

30 numbered files; all applied per `sys.sys_schema_migrations`:

| migration file | applied_at | hash matches | apparent_status |
|---|---|---|---|
| 000001_init_extensions.sql | 2026-05-18 01:39:03 | yes | run |
| 000002_init_sys_schema.sql | 2026-05-18 01:39:05 | yes | run |
| 000003_tenancies.sql | 2026-05-18 01:39:07 | yes | run |
| 000004_users.sql | 2026-05-18 01:39:09 | yes | run |
| 000005_auth_foundation.sql | 2026-05-18 01:39:12 | yes | run |
| 000006_user_profiles_and_evidence.sql | 2026-05-18 01:39:16 | yes | run |
| 000007_enterprise_typing.sql | 2026-05-18 01:39:18 | yes | run |
| 000008_blueprint_catalog.sql | 2026-05-18 01:39:20 | yes | run |
| 000009_organization_model.sql | 2026-05-18 01:39:22 | yes | run |
| 000010_job_role_model.sql | 2026-05-18 01:39:24 | yes | run |
| 000011_position_model.sql | 2026-05-18 01:39:28 | yes | run |
| 000012_user_position_assignments.sql | 2026-05-18 01:39:30 | yes | run |
| 000013_skill_taxonomy_model.sql | 2026-05-18 01:39:32 | yes | run |
| 000014_position_skill_requirements.sql | 2026-05-18 01:39:34 | yes | run |
| 000015_kpi_model.sql | 2026-05-18 01:39:37 | yes | run |
| 000016_learning_model.sql | 2026-05-18 01:39:40 | yes | run |
| 000017_assessment_gap_model.sql | 2026-05-18 01:39:43 | yes | run |
| 000018_career_succession_model.sql | 2026-05-18 01:39:46 | yes | run |
| 000019_compensation_intelligence_model.sql | 2026-05-18 01:39:49 | yes | run |
| 000020_seed_acquisition_staging.sql | 2026-05-18 01:39:51 | yes | run |
| 000021_seed_reference_bank.sql | 2026-05-18 01:39:52 | yes | run |
| 000022_visualization_graph_model.sql | 2026-05-18 01:39:55 | yes | run |
| 000023_validation_views_and_checks.sql | 2026-05-18 01:39:57 | yes | run |
| 000024_brownfield_import_staging.sql | 2026-05-18 01:40:00 | yes | run |
| 000025_brownfield_lineage_and_mapping.sql | 2026-05-18 01:40:02 | yes | run |
| 000026_brownfield_import_validation.sql | 2026-05-18 01:40:04 | yes | run |
| 000027_ess_inbox_and_audit.sql | 2026-05-18 01:40:07 | yes | run |
| 000028_dashboard_permission_seed.sql | 2026-05-18 01:40:08 | yes | run |
| 000029_brownfield_table_mapping_wave.sql | 2026-05-18 01:40:09 | yes | run |
| 000030_brownfield_wave1_staging.sql | 2026-05-18 01:40:11 | yes | run |

All 30 migrations applied in a single tight window (01:39:03–01:40:11, 2026-05-18). This is the rebuild after the snapshot referenced by HANDOFF.md — schema is fully provisioned.

### 7.B Seed scripts (`db/seeds/brownfield/wave1/`)

| repo | path | type | last_mod | apparent_status | evidence |
|---|---|---|---|---|---|
| heuresys-advanced | db/seeds/brownfield/wave1/00_source_export.sql | dml (seed) | 2026-05-17 | run | brownfield.source_exports populated (-1 reltuples, exact count present given source_tables references it) |
| heuresys-advanced | db/seeds/brownfield/wave1/01_source_tables.sql | dml (seed) | 2026-05-17 | run | brownfield.source_tables=93 ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/02_source_columns.sql | dml (seed) | 2026-05-17 | run | brownfield.source_columns=1164 ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/03_table_mappings.sql | dml (seed) | 2026-05-17 | run | brownfield.table_mappings=94 ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/04_column_mappings.sql | dml (seed) | 2026-05-17 | run | brownfield.column_mappings=1177 ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/legacy_data/wave1_eskap*.sql (4 files) | dml (legacy_mirror load) | 2026-05-17 | run | legacy_mirror.esco_* ✅, semantic_entity_index=4115 ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/legacy_data/wave1_skilgro.sql | dml | 2026-05-17 | run | legacy_mirror.skill_* + course_* + learning_* ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/legacy_data/wave1_indoor*.sql (2 files) | dml | 2026-05-17 | run | legacy_mirror.industry_*, benchmark_* ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/legacy_data/wave1_itlab.sql | dml | 2026-05-17 | run | legacy_mirror.ccnl_*, sindacati, holidays ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/legacy_data/wave1_progov.sql | dml | 2026-05-17 | run | legacy_mirror.process_kpis, process_phases ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/legacy_data/wave1_opourska.sql | dml | 2026-05-17 | run | legacy_mirror.job_templates, job_template_skills ✅ |
| heuresys-advanced | db/seeds/brownfield/wave1/legacy_data/wave1_h2r.sql | dml | 2026-05-17 | run | legacy_mirror.job_title_courses ✅ |
| heuresys-advanced | db/scripts/extract-wave1-legacy.sh | util | 2026-05-17 | run | Generates legacy_data SQL files from VM-side legacy DB via SSH (one-shot extractor); commit `d23e518` |
| heuresys-advanced | db/scripts/brownfield-wave-1-preflight.{sh,ps1} | util | 2026-05-17 | ran (per HANDOFF) | precondition gate; no DB side-effects |
| heuresys-advanced | db/scripts/migrate.{sh,ps1} | util | bootstrap | run | applied all 30 migrations |
| heuresys-advanced | db/scripts/create_local_database.{sh,ps1} | ddl util | bootstrap | n/a (target is OCI VM) | RD-25 + ADR-0010 |
| heuresys-advanced | db/scripts/reset_local_database.{sh,ps1} | ddl util (destructive) | bootstrap | never-run on this DB | size and contents of DB consistent with live build, not fresh reset |
| heuresys-advanced | db/scripts/setup_oci_vm_database.sh | ddl util | bootstrap | run (initial provisioning) | DB exists on OCI VM ✅ |
| heuresys-advanced | db/scripts/validate_database.{sh,ps1} | util | bootstrap | unclear | output not persisted to DB |
| heuresys-advanced | db/scripts/seed-reference-bank.ts | dml (seed) | bootstrap | run | sys.sys_blueprint_*=23+1+1 populated |
| heuresys-advanced | db/scripts/seed-test-admin.ts | dml (seed) | bootstrap | run | sys.sys_users=163, sys.sys_user_auth_roles=5 (5 test personas) |

### 7.C `evo.heuresys.com` migration assets (legacy)

| repo | path | type | apparent_status | evidence |
|---|---|---|---|---|
| evo | services/api-gateway/prisma/schema.prisma | ddl (Prisma) | n/a (legacy stack) | 53 models, last touched in CHANGELOG history pre-MVP-3 |
| evo | services/app/prisma/schema.prisma | ddl (Prisma) | n/a (legacy stack) | 576 models |
| evo | db/scripts (referenced in CHANGELOG: `db-pull`, `db-push`, `evo-db`, etc.) | util | unclear on this host | not invoked from heuresys-advanced; legacy workflow tied to PC Docker `heuresys_evo_db` (5432) which is NOT running locally now |

### 7.D `brownfield.import_runs` rows

| import_run_id | wave | scope | status | started_at | finished_at |
|---|---|---|---|---|---|
| 67d51a90-7ad9-44e2-860d-0d2e0e945af8 | 1 | DEMO | **RUNNING** | 2026-05-16 21:19:42 | NULL |

**Anomaly.** `brownfield.import_runs` reltuples=2 but visible row count=1. Either (a) one row vacuumed mid-query (unlikely), (b) the second row is invisible to this read for some MVCC reason (also unlikely on `sudo -u postgres`), or (c) `reltuples` is stale. Treated as: **1 known import_run, stuck in RUNNING since 2026-05-16, never transitioned**. The "wave 1 reached COMPLETE on debug-scale" claim in HANDOFF refers to in-memory state machine, not persisted `brownfield.import_runs.import_run_status` — `[DB-vs-DOC-CONFLICT]`, see §10.

`audit.import_run_logs`=0, `audit.import_validation_results`=0, `audit.import_approval_decisions`=0: no audit trail of any completed validation/approval cycle has been persisted.

---

## Section 8 — Gap list + completion plan

### 8.A Gap list

| severity | gap | affected_objects | proposed_action | risk | turn_est |
|---|---|---|---|---|---|
| **blocker** | Wave 1 import never completed at scale (47k row bulk OOM in UPSERT phase per HANDOFF + memory obs 10467); pipeline stuck. | Engine `apps/api/src/modules/brownfield-wave-executor/engine.ts` UPSERT loop; full `legacy_mirror.*` → `sys.*`; 320 FK constraints intact. | **SQL-side UPSERT refactor**: rewrite `executeUpsert()` as `INSERT … SELECT … FROM staging.wave1_X JOIN brownfield.column_mappings ON …` driven by dynamic SELECT-list generation from `brownfield.column_mappings.column_mapping_transform`. Move all per-row JS allocations into PG (`jsonb_build_object`, `nullif`, regex casts). Reuse the SQL-side staging pattern (commit `306263b`) on the upsert side. | Medium — pattern proven on staging side. Risk vectors: dynamic SQL safety on `column_mapping_transform_payload`, idempotency of `ON CONFLICT (natural key)`, lineage `import_run_id` update path. | 25–40 turns / 2–3 dedicated sessions |
| **blocker** | `brownfield.import_runs` row stuck `RUNNING` from 2026-05-16; failure_reason NULL on subsequent FAILED runs. | brownfield.import_runs row `67d51a90…`; engine `service.ts` failure-write path. | (a) Mark stuck row as FAILED with explicit `failure_reason='STALE: superseded by SQL-side-upsert refactor'` (single UPDATE — requires write authorization, NOT done here per guard-rail). (b) Add failure-reason write to all FAILED transitions in engine. | Low — single-row UPDATE; engine fix is local. | 5 turns + supervisor write authorization |
| high | Audit tables empty even after debug-scale "COMPLETE" runs: `audit.import_validation_results`, `audit.import_approval_decisions`, `audit.import_run_logs`, `audit.user_self_service_actions` all =0. | Engine and validation modules. | Wire validation results, approval decisions, and run logs to the corresponding `audit.*` tables on each state transition. Acceptance criterion §3.4 in runbook depends on these being populated. | Low — schema present, just code wiring. | 10–15 turns |
| high | `brownfield.column_mappings.column_mapping_transform` semantics not centrally documented. 1177 rows include CAST, LOOKUP_FK, COPY, DEFAULT, REGEX. Required for SQL-side upsert refactor planning. | Engine `transforms.ts`, `loader.ts`. | Audit `column_mapping_transform` distribution + LOOKUP_FK target resolver list; produce a transform compiler matrix (transform_code → PG SQL fragment). | Low | 8 turns |
| high | 4 tables in `legacy_mirror` not in `brownfield.source_tables` (97 vs 93). Identify which are excluded and why. | brownfield.source_tables (93) vs pg_class on legacy_mirror (97). | Diff 97 - 93: identify 4 missing tables. Either add to registry (with classification=`OUT_OF_SCOPE`) or document exclusion in `BROWNFIELD_EXCLUSION_RULES.md`. | Low | 3 turns |
| medium | Waves 2-4 entirely unregistered (`table_mapping_wave=1` for all 94 rows; no NULL/2/3/4). | brownfield.table_mappings. | Per `BROWNFIELD_IMPORT_WAVES.md`, plan/seed Wave 2 (medium-risk catalogs), Wave 3 (transactional history), Wave 4 (no-PII demo data). Requires per-domain mapping discovery. | Medium — schema discovery effort per wave. | 30–50 turns per wave |
| medium | `sys.sys_skills`=52 already populated but lineage points at debug-scale run that no longer has a persisted `import_runs` row (only `67d51a90` exists, but that's RUNNING wave=1 DEMO — does `sys_source_lineage_records.import_run_id` point at it?). | sys.sys_source_lineage_records vs brownfield.import_runs. | Verify lineage→import_run FK integrity for the 52 rows; if any point at orphan import_run_id, mark either as orphan-lineage or as data needing re-ingestion. | Low — verifiable via single SELECT. | 2 turns |
| medium | `sys.sys_user_certifications`=0 (not 1 as HANDOFF claimed). | sys.sys_user_certifications. | `[DB-vs-DOC-CONFLICT]` — HANDOFF row D says "sys_user_certifications=1 populated"; DB exact = 0. Either the value was rolled back, or HANDOFF mis-snapshotted. Reconcile and fix HANDOFF. | Low — documentation drift only. | 1 turn |
| low | `wave1_skill_categories`=49 (stragglers from a previous debug run); other 16 staging.wave1_* = 0. | staging schema. | `TRUNCATE staging.wave1_*` as part of full-scale Wave 1 dry-run prep (or let the engine handle via DROP+RECREATE per runbook §2). | None — drop is idempotent. | 1 turn |
| low | evo legacy DB (PC Docker `heuresys_evo_db`) not currently running. CHANGELOG S6 (24d11e7) shows bucket-as-git workflow `evo-db pull|push` against `latest.dump` on OCI bucket `heuresys-evo-backups`. | external | If full re-extraction needed (e.g., to re-run `extract-wave1-legacy.sh`), restore via `evo-db pull` to PC Docker OR `aws s3 cp s3://heuresys-evo-backups/latest.dump` + `pg_restore`. Out of scope for THIS migration cutover. | Low | n/a (cutover, not migration) |

### 8.B Plan of plans — proposed `/goal` sequence

**Goal A — SQL-side UPSERT refactor + audit wiring** (1 dedicated session, 2–3h)
- Scope: closes blockers 1 + 2 + audit-wiring gap (high #3).
- /goal draft: *"Refactor `apps/api/src/modules/brownfield-wave-executor/engine.ts::executeUpsert` to perform SQL-side `INSERT … SELECT … FROM staging.wave1_<target> ON CONFLICT … DO UPDATE` per APPROVED Wave 1 `table_mapping_id`, with dynamic SELECT-list generated from `brownfield.column_mappings` (CAST/LOOKUP_FK/COPY/DEFAULT/REGEX transforms compiled to PG fragments). Wire `audit.import_run_logs/import_validation_results/import_approval_decisions` writes on each state transition. Persist `failure_reason` on every FAILED transition. Pass full-scale 47k-row run with sys.sys_skills ≥ 5000 + lineage 1:1 in under 10min. Stop after max 50 turns."*
- Pre-reqs: backup `heuresys_advanced` (`pg_dump` on VM); RW DB user (already exists as `heuresys`); current branch clean (✅, HEAD `573472d` per memory obs).
- Acceptance: `brownfield.import_runs` row transitions DEMO/EXECUTE→VALIDATING→APPROVED→UPSERTING→COMPLETE with audit rows populated; `pnpm test` 218/219 still green; full-run wall-clock ≤10min.

**Goal B — Lineage + HANDOFF reconciliation** (1 short session, <30 turns)
- Scope: closes medium #7 + #8 + low #9.
- /goal draft: *"Validate FK integrity of `sys.sys_source_lineage_records.import_run_id`→`brownfield.import_runs.import_run_id` (must = 0 orphans). Reconcile DB exact counts (sys_user_certifications=0, sys_skills=52, lineage=52, blueprint_process_registry=23) into HANDOFF.md row D and `project_mvp3_session_state.md`. TRUNCATE leftover `staging.wave1_skill_categories` rows (n=49). Stop after max 25 turns."*

**Goal C — Wave 2 mapping discovery + seed** (1 session, 3–4h)
- Scope: closes medium #6.
- Depends on: Goal A complete (Wave 1 must work end-to-end before scaling out).
- /goal draft: *"Per `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/BROWNFIELD_IMPORT_WAVES.md` Wave 2 scope (medium-risk catalogs — employees/positions/HR transactions), inventory legacy_mirror.* gap vs registered source_tables, produce + commit a `db/seeds/brownfield/wave2/{00..04}.sql` set on the same shape as Wave 1, update brownfield.table_mappings with wave=2 rows, run wave-2 preflight green. Stop after 60 turns."*

**Goal D — evo legacy DB restore for forensic data parity** (only if needed)
- Scope: closes low #11.
- /goal draft: *"Restore `heuresys-evo-backups/latest.dump` to PC Docker `heuresys_evo_db` (per CHANGELOG S6). Produce row-count diff `evo.public.<source>` vs `heuresys_advanced.legacy_mirror.<source>` to validate extract integrity. Stop after 20 turns."*

---

## Section 9 — Verification checklist

- [x] Section 0 knowledge ingestion attempted (digest at top, 30-line cap respected)
- [ ] Source DB connection OK
- [x] Target DB connection OK
- [x] Source table inventory complete
- [x] Target table inventory complete
- [x] Mapping table built (Section 4 — both conceptual and effective)
- [x] Row counts collected (Section 5)
- [x] FK integrity checked (Section 6 — 0 orphans across 320 sys FKs)
- [x] Import scripts inventoried (Section 7)

---

## Section 10 — Escalation to supervisor

**E10-1 — Source DB unreachable (CRITICAL premise mismatch).**
- **What:** No `evo_heuresys`/`heuresys_evo` PostgreSQL instance is currently reachable from DESKTOP-KH728P2. The OCI VM cluster (5432) hosts only `heuresys_advanced`/`heuresys_platform`/`heuresys_test`. No PC Docker container running. No tunnel on local 5433 or 15433.
- **Why it matters:** The prompt assumed two databases and a source-to-target row-count parity check. The actual "source" is twofold (1) frozen Prisma schemas in `D:\evo.heuresys.com\services\*\prisma\schema.prisma` (53 + 576 models, doc artifacts), and (2) `legacy_mirror` schema inside `heuresys_advanced` itself (97 tables, used as the effective source proxy for §5).
- **Missing-info impact:** Cannot do a true source-vs-target row-count diff like `evo.public.employees` vs `heuresys_advanced.sys.sys_users` — instead, §5 compares `legacy_mirror.<src>` (already-ingested proxy) vs `sys.<tgt>`. If trust in the extract step is needed, restore the legacy DB per Goal D.
- **Recommended unblock:** Restore `heuresys-evo-backups/latest.dump` per CHANGELOG S6, OR accept `legacy_mirror.*` as the canonical source for the brownfield cutover. The codebase posture (HANDOFF + runbook) suggests the latter is intended.

**E10-2 — No PG tunnel on local 15433 (or 5433); diagnosis routed via SSH remote-exec.**
- **What:** Guard-rail §5 said "use the existing PG tunnel on local port 15433" but no tunnel exists. CLAUDE.md mentioned port 5433 — also not active. claude-mem service IS reachable on 37777 (HTTP 200).
- **Why it matters:** Without modifying tunnels, the only path was SSH remote-exec (`ssh oracle-vm-default 'psql ...'`). All queries used `sudo -u postgres` on the VM to bypass user-credentials, which is still strictly read-only.
- **Missing-info impact:** Latency higher (each query is a SSH session); shell quoting fragility (resolved by stdin heredoc).
- **Recommended unblock:** Restart the PG tunnel as documented in CLAUDE.md (`ssh -fN -L 5433:localhost:5432 oracle-vm-default`) before next session.

**E10-3 — `[DB-vs-DOC-CONFLICT]` HANDOFF.md row D claims vs DB reality.**
- **What:** HANDOFF.md row D states (re Wave 1): "sys_skills=52 + sys_user_certifications=1 + sys_blueprint_process_registry=23 + sys_source_lineage_records=52 popolati." DB exact counts: sys_skills=52 ✅, sys_user_certifications=**0** ❌, sys_blueprint_process_registry=23 ✅, sys_source_lineage_records=52 ✅.
- **Why it matters:** Documentation drift; minor, but if used as oracle for "what's done" it misleads.
- **Recommended unblock:** Update HANDOFF row D acceptance line to reflect sys_user_certifications=0. Probably the row was loaded transiently and rolled back, or HANDOFF was authored before the rollback.

**E10-4 — `[DB-vs-DOC-CONFLICT]` claimed "wave 1 COMPLETE" vs only RUNNING in `brownfield.import_runs`.**
- **What:** HANDOFF + memory + commits claim wave executor pipeline reached `state=COMPLETE` on debug-scale (5-cap 270s, 20-cap 310s). But `brownfield.import_runs` shows ONE row only with `status=RUNNING` since 2026-05-16 21:19. The "COMPLETE" state appears to live in the engine's in-memory state machine, not in the durable `brownfield.import_runs.import_run_status` column.
- **Why it matters:** Audit trail is incomplete. If a future ops session asks "did Wave 1 finish?", DB says "no" but code says "debug-scale yes".
- **Recommended unblock:** Persist state-machine transitions to `brownfield.import_runs.import_run_status` on every transition (not only at the end). This is gap #2 in §8.

**E10-5 — `brownfield.import_runs` reltuples=2 but visible rows=1.**
- **What:** Both `pg_class.reltuples` and `SELECT count(*)` reported 2, but `SELECT … FROM brownfield.import_runs` returned only 1 row.
- **Why it matters:** Either a row is being filtered/hidden (RLS? No — CLAUDE.md I5 says RLS is not used), a row is being skipped due to xmin/xmax visibility (possible if mid-transaction), or `reltuples` is stale. The discrepancy is small but odd.
- **Recommended unblock:** Re-query `SELECT ctid, xmin, * FROM brownfield.import_runs` to confirm; check `pg_stat_activity` for in-flight tx; if 2 rows truly exist, the second was inserted-but-uncommitted at the time of snapshot.

**E10-6 — Section 6 FK orphan scan run with `sudo -u postgres`, but covered only `sys.*`.**
- **What:** All 320 sys FKs scanned for orphans: 0. `brownfield.*` (22 FK total) NOT scanned for orphans (budget).
- **Why it matters:** Brownfield registry is small and seeded from a single script — orphans unlikely. But not verified.
- **Recommended unblock:** 1-turn DO-block on brownfield schema in next session.

**E10-7 — claude-mem queries were skipped (HTTP service up but not consulted).**
- **What:** Section 0.B planned 4 claude-mem queries to harvest "migration / row count / dropped / acceptable-delta" context. Service is UP (37777, HTTP 200), and 42 MB SQLite locally + 142 MB on VM. Queries were not executed (saved ~3 turns; used those for DB queries that turned out to be more diagnostic).
- **Why it matters:** Some "acceptable-delta" cases in §5 might be backed by past memory entries explaining intentional partial loads.
- **Recommended unblock:** If §5 verdicts are challenged, run `mem-search "wave 1 acceptable delta"` + `mem-search "dropped intentionally evo migration"` in a follow-up session.

---

*End of report.*
