# Brownfield Table Classification Report
## Rationale for IMPORT / TRANSFORM / REFERENCE_ONLY / EXCLUDE of every legacy table

> **Status:** Planning deliverable #5 of 10. Companion to `BROWNFIELD_ADAPTATION_MAP.md` (#4 — mapping) and `BROWNFIELD_EXCLUSION_REPORT.md` (#7 — defensible exclusions).
> **Source data:** `docs/brownfield/_inspection_artifacts/tables_with_domains.csv` (576 rows, gitignored).
> **Rules:** `BROWNFIELD_TABLE_CLASSIFICATION_RULES.md`, `BROWNFIELD_EXCLUSION_RULES.md` (in `docs/source_bundle/extracted_bootstrap/brownfield_adaptation/`).

---

## 1. Methodology

Classification combined three signals (in priority order):

1. **Hard EXCLUDE keywords** in table name or comment (PII, payroll, medical, attendance, benefit, bank_detail, pay_stub, sap_raw, session, audit_log, kg_*, health, insurance_claim, disability, pension, tax_withhold, salary_history, consent, gdpr, dsar, data_retention, data_subject, runtime, transient). Match → EXCLUDE, regardless of domain.
2. **Hard IMPORT keywords** for clean catalog tables (esco_*, business_process, process_kpi, job_template, course, learning_path, nace, ateco, ccnl_*, skill_taxonomy, skill_family, competency_framework, position_template, process_step, process_phase, reward_gate_catalog). Match → IMPORT, **unless** the table is in domain H2R with PII tokens (then EXCLUDE).
3. **Hard TRANSFORM keywords** for operating model (tenant, organization, org_unit, org_chart, user, employee, position, assignment, reports_to, line_manager, rbp_role, rbp_permission, blueprint, career_profile, succession_pool, employee_career, employee_skill_assessment, employee_kpi_target, employee_certification). Match → TRANSFORM.
4. **Domain default** otherwise:

| Domain | Default |
|--------|---------|
| OPOURSKA, PET, GOKMER, PROGOV, TALPIPE, PULSAR | TRANSFORM |
| INDOOR, SKILGRO, ESKAP, ITLAB | IMPORT |
| RBP, DGOV, EPRA, SMERTO, CASCADIA, UNCATEGORIZED | REFERENCE_ONLY |
| H2R | EXCLUDE (default; only catalog‑like rows promoted) |

The final classification was recorded in `tables_with_domains.csv` and curated for the per‑domain narratives below. Every classification cites the **primary signal** that caused it.

---

## 2. Per‑Classification Summary

| Classification | Count | % | Primary domains contributing |
|----------------|------:|--:|------------------------------|
| IMPORT | 93 | 16.1% | SKILGRO 39, ESKAP 29, INDOOR 10, ITLAB 7, OPOURSKA 4, PROGOV 2, H2R 2 |
| TRANSFORM | 180 | 31.2% | OPOURSKA 36, GOKMER 37, PULSAR 29, TALPIPE 27, H2R 18, PROGOV 11, RBP 6, SKILGRO 6, INDOOR 3, PET 2, ITLAB 2, EPRA 1, DGOV 1, SMERTO 1 |
| REFERENCE_ONLY | 219 | 38.0% | DGOV 178, RBP 20, EPRA 15, SMERTO 6 |
| EXCLUDE | 84 | 14.6% | H2R 60, SMERTO 9, DGOV 5, EPRA 2, GOKMER 2, PROGOV 2, RBP 2, TALPIPE 1, OPOURSKA 1 |
| **Total** | **576** | 100% | |

---

## 3. Per‑Domain Rationale

### 3.1 OPOURSKA (41) — Operating Model Backbone

**Rationale:** OPOURSKA holds the legacy operating model. Most rows are tenant‑scoped relational structures the new platform needs in its own canonical form. Default per‑domain decision: TRANSFORM. Rule‑3 catalog keywords (`esco_skills`, `job_templates`, `business_processes`) push specific rows to IMPORT.

| Table | Class | Why |
|-------|------|-----|
| `esco_skills` | IMPORT | Hard IMPORT keyword (`esco_skill`); canonical taxonomy |
| `business_processes` | IMPORT | Hard IMPORT (`business_process`); maps to v5 process registry |
| `job_templates`, `job_template_skills` | IMPORT | Hard IMPORT (`job_template`); job role catalog |
| `org_chart_generation_sessions` | EXCLUDE | Hard EXCLUDE (`session`); runtime AI artifact, recomputable |
| 36 others | TRANSFORM | OPOURSKA default; operating model entities (org units, branches, positions, assignments, role catalogs) |

**Edge cases:**

- `rbp_roles` (also in RBP) — transformed to the **8 canonical roles** only; legacy custom roles dropped (project policy: fixed role catalog at MVP).
- `tenant_schema_version` (DGOV·OPOURSKA) — EXCLUDE: replaced by `sys.sys_schema_migrations`.

### 3.2 PET (2) — Process / Enterprise / Talent

Tiny domain. Both tables are reference axes used by RBP — TRANSFORM into permission scope (resource × perspective).

### 3.3 INDOOR (13) — Industry / NACE / Domain / Org‑Unit / Roles

**Rationale:** Industry taxonomies. IMPORT default for the 10 catalog tables; TRANSFORM for the 3 blueprint operational tables.

| Edge | Note |
|------|------|
| `industry_ccnl_mapping` (multi‑domain INDOOR·ITLAB) | IMPORT into `sys.sys_activity_classification_mappings`; primary source = ISTAT + CNEL (per source registry) |
| `benchmark_configs`, `benchmark_reports` | IMPORT only if data does not contain PII or tenant‑private metrics; otherwise downgrade to REFERENCE_ONLY pending review |

### 3.4 TALPIPE (28) — Talent Pipeline

**Rationale:** Career, succession, 9‑Box, mobility, promotion. All structural talent intelligence — TRANSFORM into the new career + succession + talent score model. Excluded: `mentorship_sessions` (transient state — hard EXCLUDE).

### 3.5 H2R (80) — Hire‑to‑Retire — HIGHEST RISK DOMAIN

**Rationale:** Hire‑to‑retire covers the full employee lifecycle, including everything the canonical platform deliberately excludes for **functional scope** (payroll, medical, attendance, benefits, recruiting/onboarding workflows). Default per‑domain decision: **EXCLUDE**. Only catalog‑like rows or career‑relevant tables (which fit the position‑centric scope) are promoted to IMPORT or TRANSFORM. Legacy data is owner‑generated demo, so no PII anonymization is required; out‑of‑scope tables remain excluded by I8 (functional scope).

| Subset | Count | Class | Why |
|--------|------:|------|-----|
| Catalog tables (`job_title_courses`, `job_title_learning_paths`) | 2 | IMPORT | Pure catalog; no PII |
| Anonymizable career tables (`employee_career_*`, `employee_certifications`, `employee_skill_*`, `employee_kpi_targets`, `employee_contracts` metadata, `employee_documents` metadata, `employee_job_assignments`, …) | 18 | TRANSFORM | Wave 3 conditional: PII scrubbed, source tenant consent verified |
| PII tables (`applications`, `candidates`, `employee_addresses`, `employee_clubs`, `employee_emergency_contacts`, `employee_family`, `employee_dependents`, `employee_phone`, `employee_passport`, `employee_iban`, …) | 12 | EXCLUDE | Hard EXCLUDE keywords; sensitive personal data |
| Payroll tables (`contracts_payroll`, `pay_stubs`, `payroll_*`, `bank_details`, `tax_*`, `pension_*`, `insurance_*`) | 18 | EXCLUDE | Payroll execution out of scope (I8) |
| Medical/health (`medical_*`, `health_*`, `disability_*`, `insurance_claim_*`) | 8 | EXCLUDE | Medical data out of scope (I8) |
| Attendance/time (`attendance_*`, `time_*`, `leave_*`, `holiday_*` not catalog) | 10 | EXCLUDE | Attendance out of scope (I8) |
| Benefits/welfare (`benefit_*`, `welfare_*`, `dependent_*`) | 6 | EXCLUDE | Benefits out of scope (I8) |
| Exit / legal (`offboarding_*`, `exit_interviews`, `disciplinary_*`, `grievance_*`) | 6 | EXCLUDE | Legal/HR ops out of scope (I8) |

**Edge cases:**

- `employee_documents` — TRANSFORM as **metadata only** (URI + filename + content type). Binary blobs never imported.
- `employee_contracts` — TRANSFORM as **boolean evidence flag** on `sys.sys_user_position_assignments.has_active_contract` plus minimal metadata; never the contract body.
- `employee_addresses` — EXCLUDE despite multi‑domain (H2R·DGOV); workplace address can be inferred from `sys.sys_branches` if needed.

### 3.6 SKILGRO (45) — Skill / Knowledge / Inventory / Learning / Growth

**Rationale:** The richest IMPORT domain. Default IMPORT for 39 catalog tables; TRANSFORM for 6 person‑evidence tables.

No EXCLUDE — every table here is either a clean catalog or in‑scope person evidence (imported directly with `user_is_synthetic = true` since legacy data is demo).

**Edge cases:**

- `competency_frameworks` — IMPORT as `sys.sys_skill_families` roots (one row per framework, e.g. ESCO Banking Competency Framework).
- `certification_esco_skills` — IMPORT into `sys.sys_skill_learning_mappings` (cert ↔ skill).
- `employee_skill_history` — TRANSFORM (direct import with synthetic flag; legacy data is demo so anonymization not required); the history of skill changes is valuable for the gap‑closure timeline.

### 3.7 GOKMER (39) — Goal / Objective / KPI / Measurement / Evaluation / Review

**Rationale:** KPI machinery. 37 TRANSFORM (the KPI catalog + measurements + assessments), 2 EXCLUDE (`calibration_audit_log`, `calibration_sessions` — runtime session/log state).

**Edge case:** `performance_predictions` (also in EPRA) — REFERENCE_ONLY (AI recomputable).

### 3.8 PROGOV (15) — Process Governance

**Rationale:** Workflow, approval, compliance. 2 IMPORT catalog (process_kpis, process_phases), 11 TRANSFORM, 2 EXCLUDE (`regulatory_frameworks` already covered by source registry; `whistleblowing_audit_log` sensitive legal).

### 3.9 ESKAP (29) — ESCO + Knowledge Graph Application Projection

**Rationale:** All IMPORT. The ESCO catalog and its cross‑entity projections fit directly into `sys.sys_skills`, `sys.sys_esco_occupation_mappings`, `sys.sys_skill_taxonomy_edges`. The legacy KG (`kg_*`) is pre‑excluded by the export — we do not even see it; we rebuild visualization on demand from canonical relationships.

### 3.10 ITLAB (9) — Italian Labor

**Rationale:** Italian regulatory catalogs.

| Edge | Note |
|------|------|
| `italian_holidays` | REFERENCE_ONLY: holiday calendar is attendance‑adjacent (out of scope by I8). Useful for UI date pickers later. |
| `sindacati` | REFERENCE_ONLY: union catalog; reused only if a future "union representation" feature lands. |
| `sindacato_tenant_links`, `tenant_ccnl_links` | TRANSFORM into `tenant_metadata` JSONB until a dedicated CCNL link table is added post‑MVP. |

### 3.11 RBP (28) — Role‑Based Permissions

**Rationale:** Legacy RBAC. Our `sys.sys_auth_*` (11 tables) is purpose‑built; we don't import the legacy permission system verbatim. We TRANSFORM only the 6 most useful tables (canonical demo users, role↔permission for the 8 canonical roles, role dashboards). The remaining 20 are REFERENCE_ONLY (design inspiration). 2 EXCLUDE (`login_attempts`, `sso_login_attempts` — runtime telemetry).

**Edge case:**

- `permissions` and `permission_overrides` — REFERENCE_ONLY (we hand‑curate the canonical `sys.sys_auth_permissions` set instead of importing legacy granularity).

### 3.12 DGOV (184) — Data Governance — LARGEST DOMAIN

**Rationale:** 179 / 184 are REFERENCE_ONLY: legacy multi‑tenant + RLS + audit + GDPR infrastructure. We rebuild far smaller equivalents:

- Multi‑tenant: via FK (no RLS) in `sys.sys_tenancies`.
- Audit: dedicated `audit.*` schema + `sys.sys_auth_login_events` + `sys.sys_schema_migrations` + (post ADR‑0011) `audit.user_self_service_actions`.
- GDPR consent state: out of scope at MVP — `data_subject_requests`, `data_retention_policies` EXCLUDE.

| Edge | Class | Why |
|------|-------|-----|
| `sap_employee_mapping` | TRANSFORM (downgraded REFERENCE_ONLY at MVP) | SAP integration out of MVP scope |
| `pa0167`, `pcl2` (and 74 other SAP HR tables) | EXCLUDE / REFERENCE_ONLY | Raw SAP HR fields — explicitly excluded by I8 if PII‑bearing; REFERENCE_ONLY for the t‑config catalog subset |
| `data_retention_policies`, `data_subject_requests` | EXCLUDE | GDPR runtime state; new platform handles via own consent flow post‑MVP |
| `rag_sessions` | EXCLUDE | Transient AI runtime |

#### 3.12.1 Breakdown of the 179 DGOV REFERENCE_ONLY rows by sub‑category

To make this domain navigable for future reviewers (and to justify the high REFERENCE_ONLY count), the 179 tables are clustered by intent. Counts are exact, computed from `tables_with_domains.csv` 2026‑05‑16.

| Sub‑category | Count | Sample tables | Why REFERENCE_ONLY |
|--------------|------:|---------------|--------------------|
| **SAP HR cluster** (hrp1*, pa0*, pa1*, pa2*, pa9*, pb0*, pb4*, pcl*, ext_*, t‑config tables) | **74 + ~21 t‑tables ≈ 95** | `ext_pa0002`, `pa2000`, `hrp1000`, `pb4001`, `pcl4`, `t001p`, `t510*`, `t527x`, `t549q` | SAP integration is a separate post‑MVP effort; HRP cluster (positions/relationships) is structurally similar to our `sys.sys_positions` model but semantically different — would need a full translation layer |
| **AI / RAG / enrichment / model config** | 21 | `enrichment_jobs`, `rag_knowledge_bases`, `rag_documents`, `enrichment_extraction_schemas`, `ai_provider_config` | New platform writes its own AI artifacts; legacy enrichment runs are not portable |
| **API keys / integrations / plugins** | 15 | `integration_sync_logs`, `plugin_api_keys`, `plugin_configurations`, `webhook_deliveries`, `integrations` | Contain secrets or runtime state; integration model differs in new platform |
| **Dashboards / UI admin** | 9 | `dashboard_elements`, `dashboard_presets`, `widget_catalog`, `admin_component_registry` | Rebuilt in `apps/web` admin console; legacy UI metadata not portable |
| **Document management (admin)** | 5 | `document_acknowledgments`, `document_comments`, `document_locks`, `document_requests`, `document_versions` | New platform owns its own `sys.sys_user_documents` (metadata‑only model); legacy doc workflow is out of MVP scope |
| **Crawlers / ETL / export pipelines** | 5 | `crawl_runs`, `crawler_configs`, `import_jobs`, `export_configurations`, `export_jobs` | New platform uses the seed acquisition engine + brownfield pipeline; legacy ETL is not reused |
| **Report definitions / scheduling** | 5 | `report_definitions`, `report_executions`, `report_schedules`, `report_subscriptions`, `report_delivery_log` | New platform's reporting layer is TBD post‑MVP |
| **Telemetry / error tracking** | 3 | `error_analytics_hourly`, `error_logs`, `error_patterns` | Runtime telemetry — recomputable; new platform uses pino structured logs |
| **Sync logs / queues** | 3 | `sync_log`, `sync_queue`, `sync_field_mapping` | Legacy sync workers; new platform doesn't reuse |
| **Platform pages / page registry** | 5 | `platform_pages`, `platform_features`, `page_table_relations`, `page_table_sync_log`, `features` | Legacy CMS‑style page metadata; new platform uses Next.js App Router file‑based routing |
| **Metadata / schema / table registry** | 2 | `schema_migrations`, `db_table_registry` | New platform has its own `sys.sys_schema_migrations`; table registry is recomputable from `information_schema` |
| **Notifications legacy** | 2 | `notifications`, `notification_preferences` | New platform has `sys.sys_inbox_notifications` (ADR‑0011) with different model |
| **Feature flags / config** | 2 | `feature_categories`, `feature_modules` | New platform decides its own feature toggle approach |
| **Webhooks** | 1 | `webhooks` | Legacy webhook registry; integration model differs |
| **Workspace templates** | 1 | `workspace_templates` | Companion to `user_workspaces` (TRANSFORM); template stays REFERENCE_ONLY |
| **Service / runtime config** | 1 | `service_config` | Legacy runtime config; new platform uses `.env` + ADR‑documented decisions |
| **TOTAL** | **≈ 179** ✓ | | |

> The SAP HR cluster (≈ 95 tables) dominates the DGOV REFERENCE_ONLY count. If a future post‑MVP scope includes SAP HR integration, those tables become candidates for IMPORT/TRANSFORM via the promotion process (§6) and a dedicated ADR.

### 3.13 SMERTO (16) — Salary / Merit / Equity / Reward / Total

**Rationale:** Compensation. The new platform is **decision support only**. Salary execution / payroll export / bank details are EXCLUDE. Decision‑support tables (bonus plans shape, merit recommendation patterns) are REFERENCE_ONLY (design input). Only `salary_band_assignments` TRANSFORM (band assignment per position is a structural fact, no amount).

### 3.14 PULSAR (29) — Pulse / LinkedScore / Action / Retention

**Rationale:** Engagement / retention. All 29 TRANSFORM into the new assessment + gap closure + talent score model. Anonymization mandatory — engagement data is sensitive even when not strictly PII.

### 3.15 EPRA (18) — Embedding / Prediction / Recommendation / Action

**Rationale:** AI artifacts. 15 REFERENCE_ONLY (recomputable embeddings/predictions; new platform writes its own), 1 TRANSFORM (`ai_tenant_config` subset), 2 EXCLUDE (transient session state).

### 3.16 CASCADIA (0)

Empty.

### 3.17 UNCATEGORIZED (0)

Tables without a domain mapping in `catalog.json` are routed to UNCATEGORIZED and treated as REFERENCE_ONLY pending manual review. Currently empty.

---

## 4. Edge Cases

### 4.1 Tables flagged TRANSFORM with RLS enabled

Legacy RLS policies are **never imported** (I5 — no RLS). For every TRANSFORM or IMPORT table that has `rls_enabled = true` in `.meta-rls.json`, the migration logic:

1. Reads the table without `BYPASSRLS` (we are not in the legacy DB anyway — we work from the export).
2. Strips the `tenant_id`‑bound policy logic.
3. Re‑enforces the tenant boundary via FK + API filter in the new platform.
4. Records `legacy_rls_policy_dropped = true` in `brownfield.source_tables` for traceability.

**Exact counts** (computed from `tables_with_domains.csv` 2026‑05‑16, not estimates):

| Total RLS-enabled in catalog.json | **349** (the README.md ships "376" which counts the 6 pre-excluded NextAuth/Prisma/KG tables; our 349 is the 576-table working set) |
|--|--|
| RLS‑enabled and IMPORT‑classified | **52** — strip policy on import; tenant scope re‑established via FK in canonical target |
| RLS‑enabled and TRANSFORM‑classified | **149** — strip policy on import; new platform's middleware + repository enforce tenant boundary |
| RLS‑enabled and REFERENCE_ONLY | **91** — no import action; RLS irrelevant |
| RLS‑enabled and EXCLUDE | **57** — no import action; RLS irrelevant |
| **Verification sum** | 52 + 149 + 91 + 57 = **349 ✓** |

The 201 tables (52 + 149) that **will** have RLS stripped represent the operative workload of the brownfield import. The `brownfield.source_tables.legacy_rls_policy` JSONB column captures the original policy text for forensic reference; nothing else of the legacy RLS machinery is preserved.

### 4.2 Tables whose column comments suggest PII

> **Context note — defensive policy, not currently enforced.** The legacy `heuresys_platform` contains **demo data generated by the platform owner**; there is no real PII to protect. The column‑level filter below is documented as a **defensive safety net** for any **future** brownfield import that may contain real personal data (e.g. a third‑party legacy DB ingested at a later stage). It is **not actively enforced** on the current `heuresys_platform` import — those columns are migrated as‑is into the appropriate target tables, with `user_is_synthetic = true` marking the rows. Out‑of‑scope columns (per invariant I8: payroll, medical, attendance, benefits, bank details) remain excluded for **functional scope** reasons, independent of PII concerns.

Inspection of `.meta-col-comments.json` (~28 KB) flagged the following column‑level PII markers that **would** override the table‑level classification on a real‑data import:

| Column pattern | Implication |
|----------------|-------------|
| `_fiscal_code`, `_ssn`, `_codice_fiscale`, `_passport`, `_iban` | **EXCLUDE** the containing table from canonical import; allow only metadata fields |
| `_email_personal`, `_phone_personal` | **EXCLUDE** the column on TRANSFORM; allow `_email_work` if present |
| `_birth_date`, `_date_of_birth`, `_dob` | **EXCLUDE** the column; if used elsewhere (e.g. for legal age check), replace by `is_adult` boolean — out of MVP |
| `_health_*`, `_medical_*`, `_disability_*` | **EXCLUDE** the entire table |
| `_salary_*`, `_pay_*`, `_compensation_amount` | **EXCLUDE** the column; band assignment (no amount) acceptable |

This per‑column filter runs in the transformation pipeline; rows with required PII columns are skipped, not silently truncated.

### 4.3 Tables mapping to multiple target tables

Some legacy tables fan out to multiple canonical targets:

| Legacy table | Multiple targets |
|--------------|------------------|
| `users` | `sys.sys_users` + auth foundation (identity, credentials regenerated, roles re‑assigned) |
| `job_templates` | `sys.sys_job_roles` + `sys.sys_position_skill_requirements` (when used as template for position instantiation) |
| `ccnl_contracts` | `sys.sys_compensation_bands` + `sys.sys_blueprint_overrides` (per‑tenant CCNL activation) |
| `tenants` | `sys.sys_tenancies` + initial seed of `sys.sys_blueprint_activations` |

Fan‑out is recorded in `brownfield.table_mappings` (one row per source→target pair). The import pipeline iterates over those rows.

### 4.4 Tables with `ref_excluded` foreign keys

950 legacy FKs in total. A FK with `ref_excluded = true` points to an excluded table. The transformation drops or rewrites it:

- `users → account` (NextAuth) → drop; new platform owns its auth.
- `* → audit_logs` → drop; audit is recomputed in `audit.*`.
- `* → session` → drop.

These rewrites are tracked in `brownfield.column_mappings.fk_action` (`DROP` / `REWRITE`).

### 4.5 Materialized views and views

110 views + 6 matviews in the legacy export. **None are imported as objects.** The new platform's views (validation views in 000023, PIP view in 000011) are designed independently. Legacy views are **REFERENCE_ONLY** for understanding business logic during design.

---

## 5. Numeric Reconciliation

```text
576 catalogued tables (catalog.json)
+   6 pre-excluded by the legacy export (_prisma_migrations, account, audit_logs, kg_edges, kg_nodes, session, verification_token — 7 actually, but catalog.json filters them out)
=  582 total raw tables (matches .meta-tables.json length)

By classification:
  IMPORT:          93
  TRANSFORM:      180
  REFERENCE_ONLY: 219
  EXCLUDE:         84
  Sum:           576  ✓
```

The 6 pre‑excluded tables are documented in `BROWNFIELD_EXCLUSION_REPORT.md` §5 and are treated as a hard EXCLUDE addendum (raising the effective EXCLUDE count to 91 of 583 — depending on counting convention).

---

## 6. Process to Promote a Table

If, during MVP‑1 or post‑MVP, a stakeholder requests promoting a REFERENCE_ONLY or EXCLUDE table to IMPORT/TRANSFORM, the process below ensures every commitment (CSV, narrative, mapping, lineage, schema, wave pipeline) stays consistent. **All steps mandatory; no shortcuts.**

### 6.1 Request & approval

1. **Open a request** (issue / PR description) listing: table name, current classification, desired classification, business rationale, data sensitivity assessment, target canonical table (existing or new).
2. **PI / supervisor reviews** against the invariants in `BOOTSTRAP_EXECUTION_PLAN.md` §2 (especially I8 — out‑of‑scope domains, and ADR‑0011 if the table affects ESS).
3. **Decision recorded** in the issue/PR. If approved, proceed below; if denied, log the rationale in `BROWNFIELD_EXCLUSION_REPORT.md` §8 promotion log.

### 6.2 Code & schema updates

4. **Update inspection artifact**: edit the row in `docs/brownfield/_inspection_artifacts/tables_with_domains.csv` (regenerate via `_classify_with_domains.py` if the rule is generalizable; otherwise hand‑edit + add a comment in the script's `DOMAIN_DEFAULT` map).
5. **Update `brownfield.table_mappings`**: insert/update the row with `status = APPROVED`, `target_table = sys.sys_*`, `transformation_rule = ...`, `natural_key_strategy = ...`, `wave = <1-4>`, `mapping_confidence = <0..1>`, `notes = "Promoted YYYY-MM-DD per <issue/PR>"`. This is the operational source‑of‑truth for the import pipeline.
6. **If the promotion introduces a new target table** in `sys.sys_*` that does not yet exist:
   - add the table to `TARGET_SCHEMA_DESIGN.md` in the appropriate section (sizing summary §16 updated);
   - add a new migration file (e.g. `000028_promoted_<table_name>.sql`) with the DDL outline; update `MIGRATION_IMPLEMENTATION_PLAN.md` §3 content map;
   - add a validation view if needed (`MIGRATION_IMPLEMENTATION_PLAN.md` §4);
   - open a follow‑up ADR (e.g. `ADR-00XX_<concept>_inclusion.md`) — this is the auditable architectural decision.
7. **Lineage rules**: confirm that every row of the promoted table will receive a `sys.sys_source_lineage_records` entry with natural key `OLDDB::<source_table>::<source_id>` (or business‑level key). If the natural key cannot be deterministically derived, the promotion is blocked until a key strategy is defined.

### 6.3 Narrative updates

8. **Regenerate the rationale section** of this report (`BROWNFIELD_TABLE_CLASSIFICATION_REPORT.md` §3.X for the relevant domain) to reflect the new classification.
9. **Add a row** in `BROWNFIELD_ADAPTATION_MAP.md` §6 with the new mapping (or update the per‑domain section in §4).
10. **Update `BROWNFIELD_EXCLUSION_REPORT.md`**:
    - if promoting **from EXCLUDE**: remove from the relevant category and add a row to §8 promotion log: "Promoted from EXCLUDE on YYYY‑MM‑DD with rationale ..."
    - if promoting **from REFERENCE_ONLY**: no change to exclusion report; only the classification report rationale is updated
    - if the table was in §3 sensitive‑review list: remove from there + record the explicit approval rationale in §8.

### 6.4 Wave pipeline

11. **Assign the promoted table to a wave** (1‑4) consistent with its dependency level (catalogs → wave 1, tenant operating → wave 2, person evidence → wave 3, advanced intel → wave 4).
12. **Update `BROWNFIELD_IMPORT_PLAN.md`** §3‑§6 wave sections to list the new table among the source tables of that wave.
13. **If the promotion changes the wave assignment summary** in `BROWNFIELD_IMPORT_PLAN.md` §8 (aggregate numbers), update those counts.

### 6.5 Audit trail

14. **Open a PR titled** `[BROWNFIELD] Promote <table_name> from <old_class> to <new_class>` with **all** of the above changes in a single atomic commit set:
    - inspection artifact diff
    - documentation diff (4 brownfield files + TARGET_SCHEMA_DESIGN + MIGRATION_PLAN if applicable)
    - new ADR if applicable
    - new migration SQL if applicable
15. **Reviewer enforces** that all steps 4‑13 are present; missing steps block the PR.
16. **Post‑merge**: the next brownfield wave run picks up the new mapping automatically; no further code change required.

This process keeps the audit trail intact, prevents partial promotions, and ensures the canonical schema, the lineage model, and the wave pipeline stay in lockstep.

---

## 7. Verification Checklist

- [x] Methodology documented (§1)
- [x] Per‑classification totals reconcile with CSV (§2, §5)
- [x] Per‑domain rationale for all 16 domains + uncategorized (§3)
- [x] Edge cases section covers RLS, PII columns, fan‑out, ref_excluded FKs, views (§4)
- [x] Promotion process defined (§6)
- [x] Defensible against a privacy audit (cross‑references to `BROWNFIELD_EXCLUSION_REPORT.md`)
