# Candidate CSV Codebook — `sys.*` Enrichment Proposals

> **Generated:** 2026-05-31 · **Scope:** interpret each web-research candidate CSV and decide whether to use it to populate/update the matching `sys.*` table.

---

## ⚠️ TOP BANNER — PROVENANCE / ADR-0023 WARNING (READ FIRST)

> **THESE CSVs ARE WEB-RESEARCH *CANDIDATES*, NOT AUTHORITATIVE DATA.**
>
> Per **ADR-0023** (and invariant **I12**), the **single authoritative data source** for this project is the **legacy `heuresys-evo` Docker DB** (`heuresys_evo_platform_db` / db `heuresys_platform`) — *never* the public web. Every row in every `*.candidate.csv` documented here was synthesized from public reference sources (ESCO/ISCO-08/O*NET, EU SME definition, Italian CCNL tables, HR/BPM KPI libraries, incentive-design literature, banking career frameworks). They are **enrichment scaffolding for human review**, not ground truth.
>
> **DO NOT bulk-load any of these CSVs.** Every candidate set must first be **reconciled against the legacy Docker DB** under the **full-reconciliation umbrella, backlog item B-50**. Reconciliation rules:
> - Legacy records **win** over candidate rows. Prefer *matching* an existing legacy record to *inventing* a candidate one.
> - Load strategy is **`ON CONFLICT` UPDATE-existing / INSERT-new keyed on the business code**, never blind `INSERT` (several candidate sets intentionally duplicate live codes to fill NULL descriptive columns).
> - Rows whose FK targets do not exist in the authoritative source must be **dropped, not fabricated**.
> - No real PII is involved anywhere — the legacy data is synthetic case-study data (I12 / ADR-0023). Provenance tagging here is *provenance*, not a privacy gate.

---

## 1. Summary table — all `sys.*` tables

Legend for **flag**: `OK` = coherent & populated · `SPARSE` = under-populated · `INCOHERENT` = co-mingled/contaminated rows · `EMPTY` = 0 rows.
**Candidate CSV?** column: `Y` = a `*.candidate.csv` was produced (see §2) · `N` = none · `skip` = explicitly evaluated and intentionally NOT enriched (see §3).

| `sys.*` table | rowCount | flag | Candidate CSV? |
|---|---:|---|---|
| sys_activity_classification_mappings | 0 | EMPTY | N |
| sys_activity_classifications | 3276 | OK | N |
| sys_assessment_methods | 5 | SPARSE | N |
| sys_assessments | 615 | INCOHERENT | N |
| sys_assessment_results | 1560 | SPARSE | N |
| sys_attendance | 3180 | SPARSE | N |
| sys_auth_credentials | 5 | SPARSE | N |
| sys_auth_identities | 5 | SPARSE | N |
| sys_auth_login_events | 11013 | OK | N |
| sys_auth_mfa_factors | 6 | SPARSE | N |
| sys_auth_password_reset_tokens | 148 | SPARSE | N |
| sys_auth_permissions | 99 | SPARSE | N |
| sys_auth_refresh_tokens | 4938 | OK | N |
| sys_auth_role_permissions | 394 | OK | N |
| sys_auth_roles | 8 | OK | N |
| sys_auth_sessions | 0 | EMPTY | N |
| sys_behavioral_assessments | 0 | EMPTY | N |
| sys_blueprint_activations | 0 | EMPTY | N |
| sys_blueprint_families | 1 | SPARSE | N |
| sys_blueprint_overrides | 0 | EMPTY | **skip** |
| sys_blueprint_process_registry | 23 | OK | N |
| sys_blueprint_variants | 1 | SPARSE | N |
| sys_bonus_pools | 0 | EMPTY | N |
| sys_branches | 0 | EMPTY | N |
| sys_career_path_steps | 0 | EMPTY | N |
| sys_career_paths | 0 | EMPTY | **Y** |
| sys_compensation_bands | 87 | INCOHERENT | **Y** |
| sys_compensation_recommendations | 0 | EMPTY | N |
| sys_critical_positions | 0 | EMPTY | N |
| sys_critical_role_coverage_status | 0 | EMPTY | N |
| sys_employee_position_fit_scores | 0 | EMPTY | N |
| sys_enterprise_size_bands | 4 | SPARSE | N |
| sys_enterprise_typing_profiles | 0 | EMPTY | **Y** |
| sys_esco_occupation_mappings | 7645 | INCOHERENT | **Y** |
| sys_gap_analysis_results | 0 | EMPTY | N |
| sys_gap_closure_actions | 0 | EMPTY | N |
| sys_gap_closure_plans | 0 | EMPTY | N |
| sys_goal_alignments | 100 | OK | N |
| sys_goal_check_ins | 1000 | SPARSE | N |
| sys_goal_comments | 856 | INCOHERENT | N |
| sys_goal_milestones | 1000 | SPARSE | N |
| sys_goal_templates | 40 | INCOHERENT | N |
| sys_goal_updates | 1811 | INCOHERENT | N |
| sys_goals | 1067 | INCOHERENT | N |
| sys_inbox_notifications | 0 | EMPTY | N |
| sys_job_families | 27 | OK | N |
| sys_job_roles | 202 | INCOHERENT | **Y** |
| sys_kpi_assessment_methods | 5 | SPARSE | N |
| sys_kpi_assessment_results | 0 | EMPTY | N |
| sys_kpi_definitions | 0 | EMPTY | **Y** |
| sys_kpi_measurements | 0 | EMPTY | N |
| sys_kpi_metric_definitions | 0 | EMPTY | **Y** |
| sys_kpi_targets | 0 | EMPTY | N |
| sys_kpi_weighting_rules | 3 | SPARSE | N |
| sys_learning_gaps | 0 | EMPTY | N |
| sys_learning_modules | 5052 | SPARSE | N |
| sys_learning_path_steps | 0 | EMPTY | **skip** |
| sys_learning_paths | 3354 | SPARSE | N |
| sys_leave_accrual_rules | 20 | SPARSE | N |
| sys_leave_balance_transactions | 20 | SPARSE | N |
| sys_objective_reward_rules | 0 | EMPTY | **Y** |
| sys_okr_check_ins | 25 | INCOHERENT | N |
| sys_okr_key_results | 20 | INCOHERENT | N |
| sys_okrs | 20 | INCOHERENT | N |
| sys_operating_model_catalog | 6 | SPARSE | **Y** |
| sys_organization_hierarchies | 0 | EMPTY | N |
| sys_organization_unit_history | 0 | EMPTY | N |
| sys_organization_unit_kpi_templates | 0 | EMPTY | **skip** |
| sys_organization_unit_types | 8 | SPARSE | N |
| sys_organization_units | 26 | OK | N |
| sys_overtime | 221 | SPARSE | N |
| sys_payout_curves | 0 | EMPTY | **Y** |
| sys_payroll_handoff_records | 0 | EMPTY | N |
| sys_person_evidence_records | 0 | EMPTY | N |
| sys_position_career_paths | 0 | EMPTY | N |
| sys_position_compensation_profiles | 160 | INCOHERENT | N |
| sys_position_economic_weight | 0 | EMPTY | N |
| sys_position_kpi_requirements | 0 | EMPTY | **skip** |
| sys_position_learning_requirements | 0 | EMPTY | **skip** |
| sys_position_skill_requirement_history | 0 | EMPTY | N |
| sys_position_skill_requirements | 0 | EMPTY | **Y** |
| sys_position_succession_relevance | 0 | EMPTY | N |
| sys_positions | 162 | INCOHERENT | N |
| sys_process_kpi_templates | 0 | EMPTY | **skip** |
| sys_readiness_scores | 0 | EMPTY | N |
| sys_reward_gate_catalog | 7 | OK | N |
| sys_reward_gate_results | 0 | EMPTY | N |
| sys_reward_gates | 0 | EMPTY | **skip** |
| sys_schema_migrations | 43 | OK | N |
| sys_seed_acquisition_runs | 0 | EMPTY | N |
| sys_seed_approval_decisions | 0 | EMPTY | N |
| sys_seed_candidate_records | 0 | EMPTY | N |
| sys_seed_source_evidence | 0 | EMPTY | N |
| sys_seed_validation_results | 0 | EMPTY | N |
| sys_skill_aliases | 80 | OK | N |
| sys_skill_categories | 0 | INCOHERENT | **Y** |
| sys_skill_families | 77 | OK | **Y** |
| sys_skill_learning_mappings | 0 | EMPTY | **Y** |
| sys_skill_proficiency_levels | 6 | SPARSE | N |
| sys_skill_taxonomy_edges | 11965 | OK | N |
| sys_skills | 20073 | INCOHERENT | N |
| sys_source_lineage_records | 69450 | OK | N |
| sys_succession_pools | 0 | EMPTY | N |
| sys_succession_scores | 0 | EMPTY | N |
| sys_successor_candidates | 0 | EMPTY | N |
| sys_successor_readiness | 0 | EMPTY | N |
| sys_talent_scores | 0 | EMPTY | N |
| sys_tenancies | 3 | SPARSE | N |
| sys_time_off_balances | 494 | SPARSE | N |
| sys_time_off_requests | 69 | SPARSE | N |
| sys_training_initiatives | 1 | SPARSE | N |
| sys_user_assessment_evidence | 0 | EMPTY | N |
| sys_user_auth_roles | 161 | OK | N |
| sys_user_career_plans | 0 | EMPTY | N |
| sys_user_certifications | 423 | SPARSE | N |
| sys_user_documents | 0 | EMPTY | N |
| sys_user_education_records | 0 | EMPTY | N |
| sys_user_kpi_evidence | 0 | EMPTY | N |
| sys_user_learning_assignments | 0 | EMPTY | N |
| sys_user_learning_evidence | 0 | EMPTY | N |
| sys_user_position_assignments | 160 | OK | N |
| sys_user_professional_experiences | 0 | EMPTY | N |
| sys_user_profiles | 1 | SPARSE | N |
| sys_user_skill_evidence | 902 | SPARSE | N |
| sys_users | 161 | OK | N |
| sys_variable_pay_calculations | 0 | EMPTY | N |
| sys_visualization_edges | 160 | SPARSE | N |
| sys_visualization_exports | 0 | EMPTY | N |
| sys_visualization_graphs | 1 | SPARSE | N |
| sys_visualization_layouts | 0 | EMPTY | N |
| sys_visualization_node_layouts | 0 | EMPTY | N |
| sys_visualization_nodes | 161 | SPARSE | N |
| sys_visualization_styles | 0 | EMPTY | N |

**Totals:** 128 `sys.*` tables · **14 candidate CSVs produced** · **7 tables explicitly evaluated and skipped** (§3).

---

## 2. Per-candidate-CSV codebook (14 CSVs)

All CSVs share two universal pre-load transforms (not repeated per row): **surrogate `*_id` UUID generation at insert** and **audit columns** (`created_at/created_by/updated_at/updated_by`) **set by the ingestion pipeline** — these are intentionally absent from every CSV. The `source_url` column, where present, is **provenance-only and not a DB column** — drop it (or fold into the target's `*_metadata` jsonb) before INSERT.

---

### 2.1 `sys_skill_categories.candidate.csv`

- **File path:** `D:\heuresys-advanced\sys_skill_categories.candidate.csv`
- **Target table:** `sys.sys_skill_categories` (live flag: `INCOHERENT`, 0 rows — the empty middle layer of a 3-level taxonomy: `sys_skill_families` 77 → **categories (empty)** → `sys_skills` 20,073)
- **Candidate rows:** 27
- **Source URLs:** ESCO skill main classification & escopedia (transversal/skills-pillar), O*NET content model 2.A (basic) + 2.B (cross-functional).

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `skill_category_code` | `skill_category_code` | Direct. Proposed stable codes (`ESCO-SG-*`, `ESCO-TSC-*`, `ONET-2A/2B*`, `DIGCOMP-*`). NOT NULL varchar. |
| `skill_category_name` | `skill_category_name` | Direct. Published ESCO/O*NET/DigComp category label. |
| `skill_category_description` | `skill_category_description` | Direct (nullable text). Synthesised one-line scope summary. |
| `family_code_hint` | `skill_category_family_id` | **NOT a value map.** Target is NOT NULL uuid FK → `sys_skill_families`. Hint is a `skill_family_code` string the importer must resolve to the family uuid. 9 `ESCO-SG-*` rows anchor 1:1 to existing `OLDDB::esco_skill_groups::*` codes; the rest are best-effort family mappings needing review. |
| `source_url` | *(none)* | Provenance only. Optionally → `skill_category_metadata` jsonb. |

**Pre-load transforms:** resolve `family_code_hint` → real `skill_family_id` uuid (FK is NOT NULL); default `skill_category_metadata` jsonb (NOT NULL) to `'{}'` or attach provenance; generate surrogate id + tenant scope + audit. **Only the 9 ESCO-SG-* rows are 1:1 safe; the 18 TSC/ONET/DIGCOMP rows require human review before import.**

---

### 2.2 `sys_skill_learning_mappings.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\enrichment_candidates\sys_skill_learning_mappings.candidate.csv`
- **Target table:** `sys.sys_skill_learning_mappings` (`EMPTY`, 0 rows — bridge: "module develops skill to a target proficiency")
- **Candidate rows:** 30
- **Source URLs:** ESCO skill main + digital-skills concepts, Coursera Career Learning Paths / Professional Certificates, edX professional certificates / courses.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `skill_name` | `skill_learning_mapping_skill_id` | FK → `sys_skills.skill_id`. CSV carries the ESCO skill *label*, not the UUID; resolve via `sys_skills.skill_name`/`skill_esco_uri`. Only 3 labels (JavaScript, 'perform ICT troubleshooting', 'manage environmental management system') are verbatim-real from live DB. |
| `esco_skill_uri_ref` | *(resolution aid)* | Not a column. 3 URIs genuine; rest are **ESCO-pattern PLACEHOLDERS** — do not persist as real URIs. |
| `learning_module_title` | `skill_learning_mapping_module_id` | FK → `sys_learning_modules.learning_module_id`. CSV carries a representative public course title; resolve (or create module) against `sys_learning_modules.learning_module_title`. |
| `learning_module_kind` | *(context — `sys_learning_modules.learning_module_kind`)* | `COURSE` matches only observed live kind. |
| `learning_module_delivery` | *(context — `...learning_module_delivery`)* | `SELF_PACED` matches only observed delivery. |
| `duration_minutes` | *(context — `...learning_module_duration_minutes`)* | Plausible durations; not a mapping-table column. |
| `target_proficiency` | `skill_learning_mapping_target_proficiency` | Direct. CHECK `{NOVICE,BASIC,COMPETENT,PROFICIENT,EXPERT,MASTER}` — all conform. |
| `mapping_metadata_note` | `skill_learning_mapping_metadata` | Wrap into required jsonb, e.g. `{"note":"...","provenance":"candidate"}`. |
| `source_url` | *(none)* | Provenance only. |

**Pre-load transforms:** resolve BOTH FKs (skill + module) by label → UUID; drop rows whose skill/module do not exist in the authoritative source (do not invent); wrap note into jsonb metadata; generate surrogate id + audit. 27 of 30 skill labels + their URIs are placeholders.

---

### 2.3 `sys_esco_occupation_mappings.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\enrichment_candidates\sys_esco_occupation_mappings.candidate.csv`
- **Target table:** `sys.sys_esco_occupation_mappings` (`INCOHERENT`, 7645 rows — job-role↔ESCO occupation crosswalk; **`job_role_id` is 100% NULL — the actual incoherence**)
- **Candidate rows:** 26
- **Source URLs:** ESCO ISCO escopedia + occupation_main, ESCO occupation C251, IHE ISCO-08 code system, ILO ISCO-08 structure + Vol.1 PDF.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `esco_label` | `esco_occupation_mapping_esco_label` | Preferred English ESCO label. Fills the 60.2% null_label gap. |
| `isco_code` | `esco_occupation_mapping_isco_code` | ISCO-08 4-digit unit-group code (verified vs IHE/ILO). Fills 60.2% null_isco gap. |
| `isco_group_uri` | `esco_occupation_mapping_esco_uri` | **CANDIDATE-ONLY substitute.** ISCO-group URI `…/esco/isco/C<code>` (real, resolvable) — NOT the leaf occupation UUID existing rows use. **Do NOT load as authoritative `esco_uri`; placeholder pending real UUID resolution.** |
| `confidence` | `esco_occupation_mapping_confidence` | Left at `1.000` to mirror existing degenerate data; should be derived in real use. |
| `metadata_description_en` | `…_metadata ->> 'description_en'/'description'` | jsonb key. Paraphrased from ISCO-08/ESCO group defs. |
| `metadata_parent_uri` | `…_metadata ->> 'parent_uri'` | jsonb key. ISCO minor-group (3-digit) parent URI. |
| `source_url` | *(none)* | Provenance only — drop on load. |

**Pre-load transforms:** **this CSV does NOT and cannot fix the `job_role_id` NULL wiring** — that requires legacy/business mapping, not web data. Resolve real leaf occupation UUIDs via ESCO API before trusting `esco_uri`; pack metadata keys into jsonb. ISCO codes/labels reliable; URIs + confidence are placeholders.

---

### 2.4 `sys_compensation_bands.candidate.csv`

- **File path:** `D:\heuresys-advanced\cowork_code_exchange\enrichment_candidates\sys_compensation_bands.candidate.csv`
- **Target table:** `sys.sys_compensation_bands` (`INCOHERENT`, 87 rows — co-mingles job-family bands, CCNL headers, trade-union rows, and ~50+ `OLDDB::ccnl_*` NULL-salary orphans; 86.2% NULL on min/mid/max_eur)
- **Candidate rows:** 23
- **Source URLs:** lexplain CCNL metalmeccanici/commercio/chimici-farmaceutici, studiocerbone metalmeccanica minimi, soldioggi CCNL credito.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `compensation_band_code` | `compensation_band_code` | Synthetic `CCNL_<sector>_<year>_<level>`, mirrors existing `CCNL_*_2024`. **May collide with 7 existing CCNL header rows — de-dup required.** |
| `compensation_band_name` | `compensation_band_name` | Human label sector+level. |
| `compensation_band_min_eur` | `compensation_band_min_eur` | **Only sourced figure:** 2024 monthly *minimo tabellare* × 13 mensilità (ANNUAL). |
| `compensation_band_mid_eur` | `compensation_band_mid_eur` | **DERIVED estimate** min × ~1.10. Not sourced. |
| `compensation_band_max_eur` | `compensation_band_max_eur` | **DERIVED estimate** min × ~1.22–1.25. Not sourced. |
| `compensation_band_is_global` | `compensation_band_is_global` | `false` (CCNL bands are sector-scoped). |
| `ccnl_code` | `compensation_band_metadata ->> 'ccnl_code'` | jsonb key (schema already declares it). |
| `source_url` | `compensation_band_metadata ->> 'source_url'` | jsonb key. |

**Pre-load transforms:** **`ON CONFLICT` de-dup against existing CCNL header rows**; do NOT overwrite OLDDB-provenance rows; pack `ccnl_code`+`source_url` into jsonb; assign tenant_id; generate surrogate id + audit. **The Credito/Bancari CCNL (most relevant to RTL_BANK) was deliberately NOT enriched** (only behind PDF). mid/max are model estimates only.

---

### 2.5 `sys_enterprise_typing_profiles.candidate.csv`

- **File path:** `D:\heuresys-advanced\sys_enterprise_typing_profiles.candidate.csv`
- **Target table:** `sys.sys_enterprise_typing_profiles` (`EMPTY`, 0 rows — per-tenant enterprise classification profile)
- **Candidate rows:** 36
- **Source URLs:** EC SME definition, NACE (Wikipedia + infobelpro), quantgov manufacturing, lisam/findlaw most-regulated industries, EUR-Lex 2003/361/EC.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `industry_class_scheme` + `industry_class_code` | `enterprise_typing_industry_class_id` | **Resolution helpers, not columns.** Join → `sys_activity_classifications` WHERE scheme='NACE' AND code=`<code>` AND level=1 → stored UUID. Classic NACE Rev.2 lettering (K=Financial, Q=Health, C=Manufacturing). |
| `industry_class_name` | *(none — denorm label)* | English review label only; live stores Italian; code is the join key. |
| `size_band_code` | `enterprise_typing_size_band_id` | Resolve → `sys_enterprise_size_bands` (XS/S/M/L). |
| `operating_model_code` | `enterprise_typing_operating_model_id` | Resolve → `sys_operating_model_catalog` (B2B_SERVICES/MANUFACTURING/MIXED/PUBLIC_SECTOR/RETAIL/WHOLESALE). |
| `regulatory_intensity` | `enterprise_typing_regulatory_intensity` | Direct. CHECK `{LOW,MEDIUM,HIGH,EXTREME}`. |
| `employee_count` | `enterprise_typing_employee_count` | Direct int (nullable). Within EU SME band bounds. |
| `revenue_eur` | `enterprise_typing_revenue_eur` | Direct numeric (nullable). Plausible, invented. |
| `country_code` | `enterprise_typing_country_code` | Direct char. ISO 3166-1 alpha-2 — **verify DDL char length accepts 2.** |
| `source_url` | *(none)* | Provenance only → optional metadata. |

**Pre-load transforms:** resolve 3 dimension codes → UUID FKs (drop unresolved rows or extend dimension); **`enterprise_typing_tenant_id` is NOT NULL FK and absent from CSV — only 3 real tenants exist; intended use is to pick ONE matching archetype per real tenant, not bulk-insert all 36**; generate surrogate id + audit. employee_count/revenue/country are invented, not measured.

---

### 2.6 `sys_operating_model_catalog.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\enrichment_candidates\sys_operating_model_catalog.candidate.csv`
- **Target table:** `sys.sys_operating_model_catalog` (`SPARSE`, 6 rows — value-delivery archetype lookup; `operating_model_description` 100% NULL)
- **Candidate rows:** 29 (first 6 reproduce existing codes to fill the NULL description column; +23 public-taxonomy additions)
- **Source URLs:** MIT CISR operating models, Wikipedia operating model + value shop, ResearchGate Stabell/Fjeldstad, nealcabage archetypes, Salesforce/ChannelEngine D2C.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `operating_model_code` | `operating_model_code` | SCREAMING_SNAKE. First 6 = existing live codes → de-dup; remaining 23 are additions. |
| `operating_model_name` | `operating_model_name` | Human label. |
| `operating_model_description` | `operating_model_description` | Fills the 100%-NULL column. One-sentence canonical description. |
| `taxonomy_family` | `operating_model_metadata` | Not a physical column. Fold into jsonb `{"taxonomy_family":"...","source":"...","provenance":"candidate-web"}`. |
| `source_url` | *(none / metadata)* | Provenance only. |

**Pre-load transforms:** **`ON CONFLICT (operating_model_code)` UPDATE-existing / INSERT-new — never blind insert** (first 6 rows exist); fold `taxonomy_family`+`source_url` into the `'{}'` metadata jsonb; generate surrogate id + audit. The 23 additions need product/domain granularity validation.

---

### 2.7 `sys_kpi_definitions.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\enrichment_candidates\sys_kpi_definitions.candidate.csv`
- **Target table:** `sys.sys_kpi_definitions` (`EMPTY`, 0 rows — KPI master catalog, parent of a 10-table KPI cascade, migration 000015)
- **Candidate rows:** 28 (20 HR people-analytics KPIs + 8 BPM process KPIs)
- **Source URLs:** ClearPoint human-capital KPIs, AIHR absenteeism, kpidepot training cost, BambooHR HR metrics, Kissflow BPM metrics, Veryable first-pass yield, execviva BPM KPIs, aimultiple process KPIs, ExtensisHR 14 HR metrics.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `code` | `kpi_definition_code` | varchar(128) NOT NULL, unique per tenant. SCREAMING_SNAKE `HR_*`/`BPM_*` (convention, not enforced). |
| `name` | `kpi_definition_name` | varchar(255) NOT NULL. |
| `description` | `kpi_definition_description` | text, nullable. |
| `formula` | `kpi_definition_formula` | text, nullable. Human-readable, not machine-executable. |
| `unit` | `kpi_definition_unit` | varchar(64), nullable. Free-text (no CHECK) — percent/days/currency/hours/score/count are suggestions. |
| `polarity` | `kpi_definition_polarity` | varchar(32) NOT NULL, CHECK `{HIGHER_IS_BETTER,LOWER_IS_BETTER,TARGET_RANGE}` — all conform. |
| `source_url` | *(none)* | Provenance only → optional `kpi_definition_metadata` jsonb. |

**Pre-load transforms:** decide tenant scope — these are **global-catalog candidates** → set `kpi_definition_is_global=true` / `tenant_id=NULL`; default `kpi_definition_metadata` jsonb; generate surrogate id + audit. These 20 parent codes are also the FK anchors for §2.8 — seed this table **first**.

---

### 2.8 `sys_kpi_metric_definitions.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\candidates\sys_kpi_metric_definitions.candidate.csv`
- **Target table:** `sys.sys_kpi_metric_definitions` (`EMPTY`, 0 rows — raw measurable components of a parent KPI)
- **Candidate rows:** 41 metric components across 20 standard HR KPIs *(research figure; on-disk header order is `parent_kpi_code,parent_kpi_name,code,name,unit,aggregation,source_url`)*
- **Source URLs:** SHRM benchmarking toolkit, ExtensisHR 14 HR metrics, BambooHR HR metrics, ClearPoint human-capital KPIs.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `code` | `kpi_metric_definition_code` | Stable SCREAMING_SNAKE (e.g. `TTF_AVG_DAYS`). Unique within parent KPI. |
| `name` | `kpi_metric_definition_name` | Human label. |
| `unit` | `kpi_metric_definition_unit` | days/hours/count/EUR. Nullable in schema; always populated here. Currency=EUR by assumption (RTL_BANK). |
| `aggregation` | `kpi_metric_definition_aggregation` | NOT NULL, CHECK `{SUM,AVG,MIN,MAX,COUNT,RATIO,CUSTOM}` — candidate values (SUM/AVG/COUNT) valid. |
| `parent_kpi_code` | `kpi_metric_definition_kpi_id` | **Late-binding FK** → `sys_kpi_definitions.kpi_definition_id`. CSV carries parent CODE, not UUID — parent table also empty, so resolve by code after seeding §2.7. |
| `parent_kpi_name` | *(none — context)* | Helper to identify/seed parent KPI. |
| `source_url` | *(none — provenance)* | Optional → `kpi_metric_definition_metadata.candidate_source_url`. |

**Pre-load transforms:** **seed `sys_kpi_definitions` (§2.7) FIRST**, then resolve `parent_kpi_code` → parent UUID; generate surrogate id + tenant + audit. Metric decompositions are HR-analytics convention, not verified legacy taxonomy.

---

### 2.9 `sys_payout_curves.candidate.csv`

- **File path:** `D:\heuresys-advanced\sys_payout_curves.candidate.csv`
- **Target table:** `sys.sys_payout_curves` (`EMPTY`, 0 rows — variable-pay curve-template library, migration 000019, decision-support only)
- **Candidate rows:** 18
- **Source URLs:** Meridian annual-incentive basics + goal-setting, CAP annual incentive payouts, Aurochs payout-curve design + curve types, salesmanagement.org, incentivate, Pearl Meyer executive incentive, Everstage AIP.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `payout_curve_code` | `payout_curve_code` | varchar(64) NOT NULL, unique per (COALESCE(tenant_id,sentinel),code). Proposed SCREAMING_SNAKE codes. |
| `payout_curve_name` | `payout_curve_name` | varchar(128) NOT NULL. |
| `payout_curve_kind` | `payout_curve_kind` | varchar(32) NOT NULL, CHECK `{LINEAR,CAPPED,STEPPED,SIGMOID}` — all conform. Accelerator/decelerator/convex force-fit into SIGMOID (only non-LINEAR continuous bucket). |
| `payout_curve_payload` | `payout_curve_payload` | jsonb NOT NULL. **INVENTED convention — no Zod schema for curves exists in `@heuresys/shared` yet.** Consuming engine must read this exact shape or payload must be re-shaped. |
| `payout_curve_is_global` | `payout_curve_is_global` | boolean NOT NULL. All `true` (platform templates, tenant_id NULL). |
| `source_url` | *(none)* | Provenance only — drop before INSERT. |

**Pre-load transforms:** confirm the curve-consuming engine reads the proposed `payout_curve_payload` JSON shape (or re-shape it); if heuresys_platform has equivalent curve config, **legacy wins**; generate surrogate id + audit. Domain owner should rule on the SIGMOID/CAPPED force-fits (possible ADR/schema extension).

---

### 2.10 `sys_objective_reward_rules.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\enrichment_candidates\sys_objective_reward_rules.candidate.csv`
- **Target table:** `sys.sys_objective_reward_rules` (`EMPTY`, 0 rows — compensation-intelligence config, migration 000019, decision-support only)
- **Candidate rows:** 24
- **Source URLs:** salarycube variable-comp + STI guide, bentega KPIs, qobra/everstage AIP, bankdirector pay-for-performance, bscdesigner/solverglobal/strategy2act/rightanglesol bank balanced-scorecard, rhythmsystems KPI examples, EBA remuneration guidelines (CRD).

**Field mapping** — the real table stores everything beyond `code`/`name` in a single `objective_reward_rule_payload` jsonb; **CSV columns 3–16 are a proposed payload schema an ETL step must JSON-pack:**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `code` | `objective_reward_rule_code` | varchar(128) NOT NULL, unique per tenant. `ORR_*`. |
| `name` | `objective_reward_rule_name` | varchar(255) NOT NULL. |
| `objective_category` | `…_payload.objective_category` | FINANCIAL/RISK/CUSTOMER/INTERNAL_PROCESS/COMPLIANCE/LEARNING_GROWTH/STRATEGIC/INDIVIDUAL/TEAM. |
| `objective_weight_pct` | `…_payload.objective_weight` | Scorecard weight. |
| `threshold_achievement_pct` | `…_payload.threshold_pct` | Min achievement for any payout. |
| `target_achievement_pct` | `…_payload.target_pct` | 100% payout point. |
| `maximum_achievement_pct` | `…_payload.maximum_pct` | Max-payout achievement. |
| `payout_curve_kind` | `…_payload.payout_curve_kind` | LINEAR/CAPPED/STEPPED/SIGMOID (mirrors §2.9). |
| `payout_cap_pct` | `…_payload.payout_cap_pct` | Max payout-factor cap. |
| `role_multiplier` | `…_payload.role_multiplier` | Default 1.00. |
| `company_modifier` | `…_payload.company_modifier` | Default 1.00. |
| `bonus_pool_scope` | `…_payload.bonus_pool_scope` | TENANT/ORG_UNIT/POSITION_FAMILY. |
| `required_reward_gates` | `…_payload.required_reward_gates[]` | Comma-list of `sys_reward_gate_catalog` codes (FIN_BANKING ships 7). |
| `measurement_unit` | `…_payload.measurement_unit` | percent/currency/ratio/count/score. |
| `polarity` | `…_payload.polarity` | HIGHER_IS_BETTER / LOWER_IS_BETTER. |
| `description` | `…_payload.description` | Narrative (governance §12 explainability). |
| `source_url` | *(none — provenance)* | Drop before load. |

**Pre-load transforms:** **JSON-pack columns 3–16 into `objective_reward_rule_payload`** (payload key names inferred from FIN_BANKING blueprint, not a committed Zod schema); **`objective_reward_rule_tenant_id` is NOT NULL with (tenant_id,code) unique — no global pattern here, must attach to a concrete tenant (e.g. RTL_BANK)**; verify `required_reward_gates` against live catalog; generate surrogate id + audit. Weights are NOT normalized to 100 (real plans pick 3–6 per role).

---

### 2.11 `sys_career_paths.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\enrichment_candidates\sys_career_paths.candidate.csv`
- **Target table:** `sys.sys_career_paths` (`EMPTY`, 0 rows — named career-progression route templates; child `sys_career_path_steps` also empty)
- **Candidate rows:** 25 (12 VERTICAL, 4 LATERAL, 3 SPECIALIST, 3 MANAGERIAL, 3 CROSS_FUNCTIONAL)
- **Source URLs:** CFI career map + finance career path, 300hours risk, eFinancialCareers risk, Indeed banking, BankersByDay compliance/audit, RobertHalf internal audit, Coursera/4dayweek/CapitalOne IT, ESCO occupation_main.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `career_path_code` | `career_path_code` | NOT NULL varchar. Invented mnemonics `CP-<FAMILY>-<KIND>-NN`. Replace with legacy codes if they exist. |
| `career_path_name` | `career_path_name` | NOT NULL varchar. |
| `career_path_description` | `career_path_description` | Nullable text. Public-source summary, not legacy-verified. |
| `career_path_kind` | `career_path_kind` | NOT NULL, CHECK `{VERTICAL,LATERAL,SPECIALIST,MANAGERIAL,CROSS_FUNCTIONAL}` — all validated. |
| `career_path_is_global` | `career_path_is_global` | NOT NULL boolean. All `false` (tenant-scoped). |
| `source_url` | *(none)* | Provenance only — drop. |
| *(omitted)* | `career_path_id` / `career_path_tenant_id` / `career_path_metadata` | Surrogate uuid + tenant FK (RTL_BANK) + NOT NULL jsonb (default `'{}'`) — supply at insert. |

**Pre-load transforms:** assign `career_path_tenant_id` (RTL_BANK); default `career_path_metadata` jsonb; **child `sys_career_path_steps` rows are NOT provided** and must be wired to real `sys_positions` IDs separately; generate surrogate id + audit. Illustrative banking templates, not real RTL Bank paths.

---

### 2.12 `sys_job_roles.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\enrichment_candidates\sys_job_roles.candidate.csv`
- **Target table:** `sys.sys_job_roles` (`INCOHERENT`, 202 rows — tenant job-role catalogue; **91/202 = 45% are `OLDDB::ccnl_job_title_mapping::*` contamination artifacts**)
- **Candidate rows:** 30
- **Source URLs:** ESCO occupation + occupation_main + 4 specific occupation GUIDs (financial manager, bank manager, banking products manager, financial broker), ISCO-08 gist, ESCO ISCO escopedia.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `job_role_code` | `job_role_code` | `REF-` prefix marks PROPOSED public-reference seeds (vs tenant `RTL-*`/`DEPT-*` and `OLDDB::` artifacts). |
| `job_role_name` | `job_role_name` | NOT NULL. Aligned to ESCO/ISCO-08 titles. |
| `job_role_description` | `job_role_description` | Nullable (75.7% null live). Adapted from ESCO scope notes. |
| `job_role_seniority_level` | `job_role_seniority_level` | varchar, likely +CHECK (RD-08). Live observed ENTRY/JUNIOR/MID; candidate adds SENIOR/MANAGER/EXECUTIVE — **VERIFY CHECK domain; remap rejected values.** |
| `esco_occupation_code` | `job_role_metadata ->> 'esco_occupation_code'` | jsonb key. Verified ISCO-08 4-digit code (high confidence). |
| `esco_occupation_title` | `job_role_metadata ->> 'esco_occupation_title'` | jsonb key. ESCO preferred label. |
| `esco_occupation_uri` | `job_role_metadata ->> 'esco_occupation_uri'` | jsonb key. **Full GUID URI only for 4 confirmed rows; all others carry the ESCO ROOT URI as a PLACEHOLDER — resolve via live ESCO API, do not trust as-is.** |

**Pre-load transforms:** validate `job_role_seniority_level` CHECK domain (remap if needed); pack ESCO keys into `job_role_metadata` jsonb; resolve placeholder URIs via ESCO API; assign tenant + surrogate id + audit. **This proposal does NOT clean the 91 `OLDDB::` contaminated rows — that is a separate B-50 data-quality task.**

---

### 2.13 `sys_skill_families.candidate.csv`

- **File path:** `D:\heuresys-advanced\sys_skill_families.candidate.csv`
- **Target table:** `sys.sys_skill_families` (`OK`, 77 rows — top-level skill/competency grouping catalogue; 31.2% null descriptions are existing bare-ISCO rows)
- **Candidate rows:** 34 (fills missing ISCO-08 major groups 5–9 + sub-major groups, plus full ESCO top-level skill groups)
- **Source URLs:** isco-ilo netlify, ILO ISCO-08 structure, Wikipedia ISCO, ESCO skill_main + transversal escopedia.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `skill_family_code` | `skill_family_code` | Candidate uses synthetic `ISCO::<code>`/`ESCO::<slug>` prefixes to avoid collision. **Live table stores ISCO rows under BARE numeric codes — reconcile keying (likely bare digits) to avoid duplicate semantic rows.** |
| `skill_family_name` | `skill_family_name` | NOT NULL. Verbatim official ISCO-08/ESCO labels. |
| `skill_family_description` | `skill_family_description` | Nullable text. From official defs; load may leave ISCO rows NULL to mirror current data. |
| `skill_family_metadata` | `skill_family_metadata` | jsonb NOT NULL. **Candidate `{taxonomy,level,reusability}` shape does NOT match either live schema (`{uri,broader_uri}` for ESCO; `{version,framework_type,...}` for competency frameworks) — must be normalized.** |
| `source_url` | *(none)* | Provenance only — drop. |

**Pre-load transforms:** **reconcile `skill_family_code` keying to bare digits** before insert (avoid duplicate ISCO rows); normalize `skill_family_metadata` to whichever schema the legacy adapter emits; generate surrogate id + audit. Public-classification reference, no PII.

---

### 2.14 `sys_position_skill_requirements.candidate.csv`

- **File path:** `D:\heuresys-advanced\qa_artifacts\enrichment_candidates\sys_position_skill_requirements.candidate.csv`
- **Target table:** `sys.sys_position_skill_requirements` (`EMPTY`, 0 rows — junction: "to hold position X you need skill Y at proficiency Z, criticality C, weight W"; I9-adjacent Position Intelligence Profile competency layer)
- **Candidate rows:** 41 *(research figure; 42 data rows on disk)*
- **Source URLs:** 4 specific ESCO occupation profiles (financial controller / regulatory affairs manager / bank teller + closest banking occupations), ESCO skill_main, ESCO essential escopedia.

**Field mapping**

| CSV column | → `sys.*` column | Note |
|---|---|---|
| `position_title` | `position_id` | Human label for review; resolve → `sys_positions.position_id` by `position_title` within RTL_BANK tenant. Titles verified present in seed. |
| `skill_name` | `skill_id` | Human label; resolve → `sys_skills.skill_id` via exact match on `sys_skills.skill_name` (lowercase ESCO labels). Non-matching names must be fuzzy-matched on `skill_esco_uri` or **dropped, not invented.** |
| `required_proficiency` | `required_proficiency` | varchar+CHECK `{NOVICE,BASIC,COMPETENT,PROFICIENT,EXPERT,MASTER}`. **Heuristic estimate — ESCO has no proficiency grading.** |
| `weight` | `weight` | numeric 0..1 relative importance. **Heuristic estimate (0.50–0.95), NOT from ESCO.** |
| `criticality` | `criticality` | varchar+CHECK `{CRITICAL,HIGH,MEDIUM,LOW}`. **Strongest public grounding:** ESCO essential→CRITICAL/HIGH, optional→MEDIUM. |
| `source_url` | *(none — provenance)* | ESCO occupation profile page; optional → `position_skill_requirement_metadata` jsonb `{source:...}`. |

**Pre-load transforms:** resolve BOTH FKs (position_title→position_id, skill_name→skill_id) to UUIDs; drop/fuzzy-match skills not in the 20,073-row catalogue; assign tenant_id (RTL_BANK) + metadata jsonb + surrogate id + audit. Risk Analyst / Investment Advisor rows reuse skills from closest banking occupations (flagged approximate cross-mapping); proficiency + weight are plausible defaults a domain expert / legacy data must confirm.

---

## 3. "Not enriched" section — tables intentionally skipped

Six tables were explicitly evaluated and **deliberately NOT enriched** (no fabrication). All are **transactional/junction tables whose meaningful columns are FKs to tenant-internal surrogate UUIDs or per-instance runtime decisions** — none derivable from public web reference data. Producing rows would mean fabricating FK relationships, which ADR-0023 and the no-fabrication rule forbid. Their authoritative population path is the legacy Docker DB brownfield pipeline.

| Skipped table | Why skipped | Web-enrichable sibling (if any) |
|---|---|---|
| `sys_organization_unit_kpi_templates` | Pure junction: `unit_id`→`sys_organization_units` (tenant's private org chart), `kpi_id`→`sys_kpi_definitions` (empty), `tenant_id`→`sys_tenancies`; payload (weight/target jsonb) is the tenant's own performance-governance decision. | Parent catalog `sys_kpi_definitions` (see §2.7). |
| `sys_process_kpi_templates` | Pure link: `process_id`→`sys_blueprint_process_registry` (23 tenant BPM processes), `kpi_id`→`sys_kpi_definitions` (empty); only payload is per-tenant default_weight/default_target config. | `sys_kpi_definitions` (§2.7). |
| `sys_reward_gates` | Transactional INSTANCE table: binds a gate to a specific user/position over a specific assessment period (`user_id`, `position_id`, `period_start/end`, `catalog_id`, opaque payload). | Reference layer = sibling `sys_reward_gate_catalog` (already 7 rows, OK). |
| `sys_learning_path_steps` | Pure ordering/junction: two FKs to UUID PKs that exist only in this DB (`path_id`→`sys_learning_paths` 3354, `module_id`→`sys_learning_modules` 5052) + ordinal + dependency-graph jsonb. No human-meaningful web-researchable key. | Human-meaningful attributes live in `sys_learning_modules`, not here. |
| `sys_position_kpi_requirements` | Tenant junction: `position_id`→`sys_positions` (162 RTL_BANK positions), `kpi_definition_id`→`sys_kpi_definitions` (empty), payload = position-specific target/weight performance-contract values. | A public KPI *library* could enrich `sys_kpi_definitions` (§2.7), a different table. |
| `sys_position_learning_requirements` | Tenant junction: `position_id`→`sys_positions` (162) + `learning_path_id`→`sys_learning_paths` (3354) + is_mandatory + jsonb. The position→learning-path *assignment* is an HR-governance decision, never a published standard. | Course/skill catalogues exist publicly but never the assignment. |
| `sys_blueprint_overrides` | Per-activation customization: `activation_id`→`sys_blueprint_activations`, `process_id`→`sys_blueprint_process_registry`, CHECK-constrained IN/PARTIAL/OUT inclusion + user-authored rationale text. Runtime decisions bound by FK to the tenant's own activation. | None — pure runtime config. |

*(Note: the table above lists 7 rows — the 6 hard-skip tables flagged `skip` in §1, plus `sys_blueprint_overrides` which was also explicitly evaluated-and-skipped. All other `N` tables in §1 simply had no candidate produced and were not individually researched.)*

---

## 4. Recommended load order (when reconciliation under B-50 authorizes it)

Because of FK dependencies among the candidates, observe this ordering:

1. `sys_skill_families` (§2.13) → then `sys_skill_categories` (§2.1, FK to families) → skills already populated.
2. `sys_kpi_definitions` (§2.7) → then `sys_kpi_metric_definitions` (§2.8, late-binding FK to definitions).
3. `sys_operating_model_catalog` (§2.6) + `sys_enterprise_size_bands` (live) + `sys_activity_classifications` (live) → then `sys_enterprise_typing_profiles` (§2.5, resolves 3 dimension FKs).
4. Independent of each other: `sys_compensation_bands` (§2.4), `sys_payout_curves` (§2.9), `sys_objective_reward_rules` (§2.10), `sys_career_paths` (§2.11), `sys_job_roles` (§2.12), `sys_esco_occupation_mappings` (§2.3), `sys_position_skill_requirements`, `sys_skill_learning_mappings` (§2.2).

**Every step is gated on legacy reconciliation (B-50) first. No bulk load without that review.**
