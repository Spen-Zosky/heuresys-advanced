# CASCADIA Lexicon Domains — Mapping

**Snapshot**: 2026-05-20T03:05Z
**Scope**: 7 lexicon domains (CASCADIA project di heuresys-evo) → cover 88/582 platform tables → bootstrap legacy_mirror

---

## §1 — CASCADIA lexicon (16 sigle canonical, from heuresys-evo CLAUDE.md)

Heuresys-evo (source legacy) ha introdotto un vocabolario controllato di 16 sigle che rappresentano catene relazionali ontologiche cross-domain. Sono accumulati attraverso 5 mesi di sprint S22→S62.

| Sigla | Significato | Stato heuresys-evo | Wave 1 advanced |
|---|---|---|---|
| **OPOURSKA** | Organization-Process-OrgUnit-Role-Skill-KPI-Assessment | base attiva | ✅ 4 tabelle imported (business_processes, esco_skills, job_templates, job_template_skills) |
| **PET** | Process/Enterprise/Talent (3 access perspectives) | base attiva | ⓘ orthogonal (not a source table set) |
| **INDOOR** | Industry-NACE-Domain-Org-OrgUnit-Roles | shipped S35.3 (4 profili) | ✅ 9 tabelle (industry_*, occupation_industry_*, benchmark_*, market_*) |
| **TALPIPE** | Talent Pipeline (Career/Succession/9Box/TalentPool/Mobility) | shipped S55+ L79+L82 | ❌ NOT in Wave 1 design |
| **H2R** | Hire-to-Retire (recruiting + onboarding) | shipped S55+ L81+L82+L83 | ✅ 2 tabelle MINIMAL (job_title_courses, job_title_learning_paths) — NOT full recruiting/onboarding |
| **SKILGRO** | Skill-Learning loop (gap→recommend→cert→reassess) | shipped S55+ L80 | ✅ 37 tabelle (skill_*, learning_*, course_*, cert_*, competency_*, ontology partial) |
| **GOKMER** | Goal-KPI-Measurement-Evaluation-Review (performance cycle) | shipped S55+ L80 | ❌ NOT in Wave 1 design |
| **PROGOV** | Process Governance (workflow/approval/audit/compliance) | deferred S58+ (secondary) | ⚠️ 2 tabelle ONLY (process_kpis, process_phases) — incomplete |
| **ESKAP** | ESCO + Knowledge graph Application Projection | shipped S35 phase18f | ✅ 29 tabelle (esco_*, onet_*, ontology_*, semantic_*) |
| **ITLAB** | Italian Labor (CCNL/INPS/sindacati/holidays) | shipped S35.1 phase18d | ✅ 7 tabelle (ccnl_*, sindacati, holidays) |
| **RBP** | Role-Based Permissions matrix | base attiva | ❌ NOT in Wave 1 (heuresys-evo specific, target uses sys_auth_*) |
| **DGOV** | Data Governance (multi-tenant + RLS + audit + GDPR) | base attiva (367 RLS) | ❌ Not applicable (target uses different model — I5 invariant) |
| **SMERTO** | Salary-Merit-Equity-Reward-Total (compensation cycle) | shipped S55+ L82 | ❌ NOT in Wave 1 design (Wave 1 has minimal compensation via ITLAB) |
| **PULSAR** | Pulse-LinkedScore-Action-Retention (engagement loop) | shipped S55+ L80 | ❌ NOT in Wave 1 |
| **EPRA** | Embedding-Prediction-Recommendation-Action (AI stack) | shipped pre-S55+ | ❌ NOT in Wave 1 |
| **CASCADIA** | Catena seeding realistic end-to-end (pipeline self-ref) | CLOSURE S57 | ⓘ meta-domain |

**Wave 1 cover**: 7 of 16 lexicon domains (44%) → ~88 tables → 200k+ rows in legacy_mirror.

**Wave 1 MISSING** (Wave 2/3/4 candidates): TALPIPE, GOKMER, SMERTO, PULSAR, EPRA + parts of H2R/PROGOV → ~80-100 source tables in platform NOT imported.

---

## §2 — Per-domain detailed mapping

### §2.1 ESKAP (Wave 1 — 29 tables ~150k rows source)

**Coverage in mirror**: 29/29 ✅ (esco_skills MISSING — anomaly, see §4)
**Target sys.* tables**: sys_skills (parziale 6037), sys_skill_taxonomy_edges (0), sys_esco_occupation_mappings (0), sys_skill_categories (0), sys_skill_families (parziale 77)
**Hit ratio**: medio — entities-rich, edges/mappings/categories silent-skip
**Issues**: CW-B17/B19 silent skip su skill_taxonomy_edges + esco_occupation_mappings

### §2.2 SKILGRO (Wave 1 — 37 tables ~19k rows source)

**Coverage in mirror**: 37/37 ✅
**Target sys.* tables**: sys_skills (parziale), sys_learning_modules (4488 ✅), sys_learning_paths (3227 ✅), sys_learning_path_steps (0), sys_skill_learning_mappings (0), sys_skill_aliases (0), sys_user_certifications (1)
**Hit ratio**: alto — learning core ✅, detail/aliases silent-skip
**Issues**: CW-B19 source mismatch (course→module no lineage), CW-B20 UQ block

### §2.3 INDOOR (Wave 1 — 9 tables ~7k rows source)

**Coverage in mirror**: 8/9 — `industry_ccnl_mapping` MISSING (MIRROR GAP 14 rows)
**Target sys.* tables**: sys_activity_classifications (3276 ✅), sys_activity_classification_mappings (0), sys_esco_occupation_mappings (0), sys_blueprint_overrides (0)
**Hit ratio**: parziale — base classifications OK, mappings silent-skip
**Issues**: MIRROR GAP industry_ccnl_mapping; brownfield mappings to sys_blueprint_overrides 53 ma sys.* empty

### §2.4 ITLAB (Wave 1 — 7 tables ~250 rows source)

**Coverage in mirror**: 7/7 ✅
**Target sys.* tables**: sys_compensation_bands (75 ✅), sys_job_roles (0)
**Hit ratio**: parziale — compensation OK, job_roles cascade gap
**Issues**: CW-B18 sys_job_families empty (cascade prerequisite)

### §2.5 PROGOV (Wave 1 — 2 tables ~144 rows source)

**Coverage in mirror**: 2/2 ✅
**Target sys.* tables**: sys_process_kpi_templates (0), sys_blueprint_process_registry (23 ⚠️)
**Hit ratio**: scarso — sys_blueprint_process_registry partial, process_kpi_templates silent-skip
**Issues**: business_processes 0 rows (source-empty in legacy_mirror, also empty in platform!) — minor authoring issue

### §2.6 OPOURSKA (Wave 1 — 4 tables ~29k rows source)

**Coverage in mirror**: 3/4 (esco_skills 14011 MISSING — MIRROR GAP CRITICAL)
**Target sys.* tables**: sys_blueprint_process_registry (partial), sys_skills (parziale 6037), sys_job_roles (0), sys_position_skill_requirements (0)
**Hit ratio**: parziale — skills via altre fonti, job_roles/position_skill_requirements silent
**Issues**: MIRROR GAP esco_skills (la fonte primaria di 14k skills MAI importata); cascade gaps

### §2.7 H2R (Wave 1 — 2 tables ~207 rows source)

**Coverage in mirror**: 2/2 ✅ (job_title_courses 207, job_title_learning_paths 0 source-empty)
**Target sys.* tables**: sys_skill_learning_mappings (0), sys_position_learning_requirements (0)
**Hit ratio**: zero — entrambi silent-skip
**Issues**: CW-B19 source-side gap

---

## §3 — Domains NON in Wave 1 — Wave 2/3/4 candidates

### §3.1 TALPIPE (Talent Pipeline) — DOMAIN MISSING

Source tables in platform NOT in mirror:
- `succession_candidates` 206, `succession_plans` 31, `talent_pools` 24, `talent_pool_members` 40
- `career_paths` 32, `career_path_levels` 75, `career_path_level_skills` 100
- `employee_career_paths` 128, `employee_career_progress` 40, `career_goals` 60, `career_goal_milestones` 216
- `mentorship_programs` 12, `mentorships` 124, `mentorship_sessions` 355, `mentor_match_scores` 30
- `career_recommendations` 192, `career_simulations` 20, `career_profiles` 158
- `internal_job_views` 217, `internal_applications` 72, `internal_mobility_*` (~50)
**Estimated tables**: ~25 tables, ~3k+ rows
**Target sys.* existing**: sys_succession_*, sys_career_*, sys_user_target_positions (TUTTI vuoti)
**Effort**: Wave 2 design ~15-25h

### §3.2 GOKMER (Goal-KPI-Measurement) — DOMAIN MISSING

Source tables NOT in mirror:
- `goals` 1067, `goal_updates` 1811, `goal_check_ins` 1000, `goal_milestones` 1000, `goal_comments` 856, `goal_alignments` 100, `goal_templates` 40, `goal_review_ratings` 155
- `okrs` 20, `key_results` 20, `okr_check_ins` 15, `okr_checkins` 10
- `job_kpis` 2000, `tenant_job_kpis` 80, `org_unit_kpis` 100, `process_kpis` 81 (already in mirror), `employee_kpi_targets` 412, `job_kpi_distribution` 22
**Estimated**: ~18 tables, ~9k rows
**Target sys.* existing**: sys_kpi_definitions/targets/measurements/metric_definitions/assessment_results (5 tables empty) + sys_process_kpi_templates + sys_position_kpi_requirements + sys_user_kpi_evidence + sys_organization_unit_kpi_templates (TUTTI empty)
**TARGET DESIGN MISSING**: sys_goals / sys_okrs / sys_key_results NOT in schema (Tier D TRUE GAP)
**Effort**: Wave 2/3 schema extension + import ~20-30h

### §3.3 SMERTO (Compensation full) — DOMAIN MOSTLY MISSING

Source tables NOT in mirror:
- `salary_history` 317, `salary_band_assignments` 264, `salary_bands` 41
- `bonus_allocations` 244, `bonus_plans` 14, `merit_recommendations` 208, `merit_cycles` 53, `equity_grants` 12
- `employee_pay_stubs` 66, `employee_benefits` 24, `employee_benefit_enrollments` 99
**Target sys.* existing**: sys_compensation_recommendations + sys_bonus_pools + sys_payout_curves + sys_variable_pay_calculations + sys_objective_reward_rules + sys_payroll_handoff_records + sys_position_compensation_profiles + sys_reward_gates + sys_reward_gate_results (TUTTI empty)
**Effort**: Wave 3 ~15-20h

### §3.4 PULSAR (Engagement & Wellbeing) — DOMAIN MISSING

Source tables NOT in mirror:
- `engagement_surveys` 18, `engagement_survey_responses` 1327, `engagement_survey_templates` 20, `engagement_action_plans` 6
- `survey_responses` 4482, `surveys` 11, `survey_questions` 31, `survey_templates` 9
- `pulse_checks` 1145, `wellbeing_checkins` 1142, `wellbeing_goals` 120, `wellbeing_program_enrollments` 67, `wellbeing_resources` 30, `burnout_assessments` 54
- `feedback_360` 714, `feedback_360_*` ~52, `continuous_feedback` 729, `engagement_feedback` 685, `feedback_requests` 246, `feedback_categories` 32, `recognition` 485
**Target sys.* existing**: sys_behavioral_assessments + sys_assessment_results (only 2 tables, semantically diverse)
**TARGET DESIGN MISSING**: nessun sys_survey* / sys_engagement* / sys_wellbeing* / sys_pulse*
**Effort**: Wave 3 schema extension + import ~25-35h

### §3.5 EPRA (Predictions/AI) — DOMAIN MISSING

Source tables NOT in mirror:
- `model_predictions` 267, `performance_predictions` 267, `performance_trends` 202, `turnover_risk_scores` 267, `predictive_models` 16, `prediction_factors` 13, `prediction_actions` 15
- `ai_*` ~12 tables (audit, config, metrics, prompt_templates, ecc.)
- `rag_*` ~8 tables (sessions, messages, documents, providers, ecc.)
**Target sys.* existing**: sys_talent_scores (empty) + sys_employee_position_fit_scores (empty) + sys_readiness_scores (empty)
**TARGET DESIGN MISSING**: nessun sys_prediction* / sys_ai* / sys_rag*
**Effort**: Wave 4 (potentially out-of-scope per HRMS core) ~10-30h

### §3.6 H2R extension (full recruiting + onboarding) — DOMAIN MISSING (Wave 1 had only 2 tables MINIMAL)

Source tables NOT in mirror:
- `recruiting_candidates` 96, `applications` 150, `interviews` 120, `interview_feedback` 56, `recruiting_offers` 30, `requisitions` 50, `recruiting_requisitions` 24, `candidates` 100, `recruiting_*_history` (~10)
- `recruiting_interview_*` (~4 tables)
- `internal_job_postings` 10, `internal_job_bookmarks` 48, `internal_job_alerts` 36, `job_postings` 20, `saved_jobs` 18
- `onboarding_tasks` 153, `onboarding_instances` 33, `onboarding_templates` 19, `onboarding_*` (~5)
- `preboarding_tasks` 180, `preboarding_*` (~5)
**Estimated**: ~30 tables, ~1.5k rows
**TARGET DESIGN MISSING**: nessun sys_recruiting* / sys_onboarding* / sys_application*
**Effort**: Wave 4 schema extension + import ~25-40h

### §3.7 SAP HR infotypes (pa\*/pb\*/pcl\*/hrp\*/t\*\*\*) — INTENTIONAL OUT-OF-SCOPE?

~80 tables, ~80k rows (1142 employees consistente).
SAP integration completa: `pa0024` (qualifications 9640), `pa2002` (attendance 6072), `pa2005` (overtime 5358), 18 pa0* tables a 1142 rows ciascuna, `pb*` recruitment infotypes, `pcl2` payroll cluster (12562), `hrp*` positions, `t***` configuration tables.

**Decision strategica necessaria**: importare SAP-side completo? È un altro paradigma (SAP HR è normalmente integrato via separate tool, non rewrite). Probabilmente **out-of-SDBI-scope**, lasciare in heuresys_platform come SAP integration layer separato.

### §3.8 RBP (Role-Based Permissions heuresys-evo specific) — INTENTIONAL OUT-OF-SCOPE

~22 tables (rbp_*) — heuresys-evo specific RBP design. Il target rewrite usa `sys.sys_auth_*` (13 tables, alternative design). **Conversion semantic, not data migration** — skip data import, redesign permissions via sys_auth model.

---

## §4 — Critical MIRROR GAPS (from extract-wave1-legacy.sh script)

| Source table | Rows in platform | Status in mirror | Risk |
|---|---|---|---|
| `esco_skills` | **14011** | **NOT in mirror** ❌ | CRITICAL — la fonte primaria di skills. sys_skills 6037 popolato da altre fonti (skill_classifications 7215). esco_skills avrebbe arricchito sys_skills significativamente |
| `business_processes` | 26 | NOT in mirror | sys_blueprint_process_registry partial (23/63) — needs business_processes prereq |
| `industry_ccnl_mapping` | 14 | NOT in mirror | sys_activity_classification_mappings empty (1:1 mapping target) |
| `tenant_industry_classifications` | 4 | NOT in mirror | Tenant industry binding |

**Action**: Estendere `extract-wave1-legacy.sh` con questi 4 source tables → riposare in legacy_mirror via psql.

Effort: 1-2 turn (modifica script + pg_dump + restore).

---

## §5 — Recommended Wave 2/3/4 partitioning (per Opzione 1 brownfield extension)

| Wave | Lexicon domains | Source tables | Rows estimate | Target schema status |
|---|---|---|---|---|
| **Wave 2 — Workforce intelligence** | TALPIPE + GOKMER | ~43 tables | ~12k rows | ~14 sys.* targets exist (career, succession, kpi, gap analysis) — schema OK |
| **Wave 3 — Engagement & feedback** | PULSAR + SMERTO | ~30 tables | ~13k rows | ~10 sys.* targets exist (assessments, behavioral) + need NEW sys_survey/sys_engagement schemas |
| **Wave 4 — Hire-to-Retire full** | H2R extension + EPRA partial | ~35 tables | ~3k rows | Need NEW sys_recruiting/sys_onboarding schemas (TARGET DESIGN MISSING) |
| **Out-of-scope** | SAP HR, RBP heuresys-evo, dashboards, AI/RAG runtime, kg_*, plugin_*, analytics_events, error_*, sap_migration_* | ~250 tables | ~250k rows | Intentional skip per design |

**Total addressable**: ~108 source tables × ~28k rows in Wave 2/3/4 (vs ~200k Wave 1).

Effort total Opzione 1 (Wave 2 + 3 + 4 sequential): 60-100h (~30-50 turn).

---

## §6 — Implicazione strategica

**Lexicon mapping in 7 domains was DELIBERATE scope reduction at Wave 1 design time** (probably May 2026 bootstrap, when heuresys_advanced was first scaffolded). Authoring spent ~50-80 hours su EXPLICIT_MAP + transform engineering = significant investment.

**Per estendere a Wave 2/3/4**:
- Pattern (extract-script-per-domain + EXPLICIT_MAP additions + column_mappings authoring + migration target schemas) è **replicabile** seguendo lo stesso template
- SDBI può **alimentare l'EXPLICIT_MAP** con analogy matching AI (Opzione 3 hybrid)
- Per i 13 macro-aree TRUE GAP (target schema missing), SDBI propose-schema feature è essential — il brownfield non sa creare schemi

---

## §7 — Verification anchors

```sql
-- Verify Wave 1 lexicon coverage in legacy_mirror
SELECT
  CASE WHEN table_name IN ('esco_skills') THEN 'OPOURSKA (MISSING in mirror)'
       WHEN table_name IN ('business_processes') THEN 'OPOURSKA-PROGOV (MISSING in mirror, source-empty in platform)'
       ELSE 'present' END AS status, COUNT(*)
FROM information_schema.tables
WHERE table_schema='legacy_mirror' AND table_type='BASE TABLE'
GROUP BY 1;
```

---

*End of 09_LEXICON_DOMAINS_MAPPING.md*
