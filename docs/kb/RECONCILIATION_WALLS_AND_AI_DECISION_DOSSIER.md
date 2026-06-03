# RECONCILIATION WALLS & AI/MATCHING — CONSOLIDATED DECISION DOSSIER

> **Owner**: CLI. **Type**: read-only design-discovery synthesis (SELECT-only; no DB mutation, no code edits, no migrations). **Authored**: 2026-06-04 (S960+). **Gate**: every write action below is GATED on Enzo's semantic decision — this dossier turns each open wall into a clean decision-then-execute step.
>
> **Provenance of numbers**: all match-rates were re-verified live this session against advanced (`localhost:5433` / `heuresys_advanced` / schema `sys`) and legacy (`oracle-vm-default` native PG `heuresys_platform`). Each figure below is a measured `count(*)`, not an estimate. Doctrine grounding: `DATA_RECONCILIATION_PLAN.md`, `EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` (I14 / ADR-0024), `qa_artifacts/F0_reconciliation_triage.md`, `F3_bridge_discovery.md`, `F3b_walls_discovery.md`. Live registry authority: `sys.v_reconciliation_status`.
>
> **Live registry snapshot (verified S960+, `SELECT resolved_status, count(*) FROM sys.v_reconciliation_status GROUP BY 1`)**: `POPULATED 103 · NEEDS_DECISION 10 · NO_SOURCE 18 · REFERENCE_ONLY 5 · EXCLUDE 1 · IMPORT 1`. The 10 `NEEDS_DECISION` rows are exactly the KPI/succession/learning bridge targets dissected below; they are already-existing empty `sys.*` tables, **disjoint** from the SDBI TRUE-GAP macro-areas (which have no `sys.*` target at all).

---

## 1. Executive summary

The four reconciliation walls plus the SDBI workstream plus the AI/Voyage plan resolve into **one autonomously-executable item** (the AI substrate, decidable now) and **a set of semantic decisions only Enzo can make**. The recurring root cause across the three reconciliation walls is identical to what F3/F3b already found: **the legacy person is `employees` (I14), and only employee/incumbent-keyed facts reach v5 position instances; job-template-keyed and design-layer-template-keyed facts orphan against the real RTL workforce vocabulary.**

| # | Wall / topic | Recommended option | Measured match-rate (verified live) | Regr. risk | What it unblocks | Verdict |
|---|---|---|---|---|---|---|
| **W1a** | job→position bridge — **bridgeable** sub-tables | **Option A** (incumbent-based) | career_paths **40/40 (100%)**; talent_pool_members **40/40 (100%)**; learning_requirements 207 rows / 6-of-7 titles | MED | `sys_position_career_paths`, `sys_position_learning_requirements`, talent_pool→`sys_successor_candidates` user leg | **DECIDABLE NOW** (per-table cards, supervised run) |
| **W1b** | job→position bridge — **partial-coverage** sub-tables | **Option A** w/ documented partial | critical_positions **8/16 (50%)**; succession_relevance **9/31 (29%)**; successor_candidates user leg **122/206 (59%)** | MED | `sys_critical_positions`, `sys_position_succession_relevance` (partial) | **DECIDABLE NOW** — but Enzo must accept the documented partial boundary (collapsed-out tenants) |
| **W1c** | job→position bridge — **dead** sub-tables | none (A/B/C all ~0) | KPI reqs 0 facts on 4 overlap templates; skill reqs Option-B 68 broadcast rows (HIGH fabrication); succession_pools **0/24** | — | nothing mechanically | **NEEDS ENZO SEMANTIC DECISION** (derive from ESCO, or park) |
| **W2** | org-unit KPI template-vs-instance | **Option C(ii)** park empty-by-design (lean) **or C(i)** template re-import | kpi-FK now **100/100** (was stale "0"); org-unit FK: code-match **4/100**, name-match **0/100**, derive-from-targets reaches **20/26 OUs / 9 KPIs** | LOW (C-ii) / HIGH (C-i) | `sys_organization_unit_kpi_templates` (1 table) | **NEEDS ENZO SEMANTIC DECISION** (park vs introduce 2nd org-unit population) |
| **W3** | learning catalog event-sourced | **Option A** (re-import canonical catalog) gated on **Option C** granularity decision | catalog code-stable: courses **127/127**, paths **20/20**, course_modules **564/564**, learning_path_courses **124/124** both-leg | MED | `sys_learning_path_steps` (→124/124), `sys_learning_modules` catalog, `sys_user_learning_evidence`, `sys_skill_learning_mappings` | **NEEDS ENZO SEMANTIC DECISION** (course=module granularity + re-home of ~130 mis-placed rows), then A is autonomous |
| **W4** | SDBI Phase 2 (true-gap HRMS) | **Option B** (PerfReviews + Feedback360 slice) if greenlit, else **Option C** (park + ship 4 infra items) | 0/7 macro-areas have any `sys.*` schema; B covers **277/666 design cols (42%)**, FK 138/138 RTL | LOW (B) / MED (A) | up to 15 new `sys.*` tables (none exist) | **NEEDS ENZO GREENLIGHT** (multi-session production-write workstream) |
| **AI** | pgvector + Voyage semantic-matching | **P0 substrate now, then P1 first match surface** | substrate absent (`vector` available_version 0.8.2, installed NULL); corpus skills **21939**, ESCO labels 3040, job_roles 227; one-shot backfill **~774k tokens ≈ $0.05** | LOW (P0) / MED (P1) | `/v1/me/matching/occupations` + skill→skill; 4 sidecar embedding tables | **DECIDABLE NOW** for P0; P1 needs OD-1/OD-2/OD-5 confirmations |

**One-line bottom line**: I can execute **W1a/W1b (per-table Option-A cards), the AI P0 substrate, and W3-Option-A once its granularity decision lands** autonomously under the established supervised-run pattern. I **cannot** execute **W1c (KPI/skill requirement derivation), W2 (org-unit template), W3's granularity choice, or the SDBI greenlight** without Enzo's semantic authority — these are modeling decisions, not imports, and the no-fabrication mapping-card rule forbids me guessing them.

---

## 2. Wall W1 — job → position bridge (the dominant wall; blocks 9 `sys.*` tables)

**The wall.** v5 `sys_positions` carry `position_metadata->>'legacy_employee_id'` (verified **162/162, 100%, all distinct**) plus `legacy_position_text` (159), `legacy_org_unit_id` (161), `legacy_manager_id` (159). The blocked per-position facts in legacy are keyed at the JOB/OCCUPATION-TEMPLATE level, and that ESCO-generic template catalog is largely disjoint from the real RTL workforce (7 actual occupation titles). The only mechanism that reconnects facts to position *instances* is through the incumbent employee.

Blocks: `position_kpi_requirements`, `position_skill_requirements`, `position_learning_requirements`, `position_career_paths`, `career_path_steps`, `critical_positions`, `position_succession_relevance`, `succession_pools`, `successor_candidates`.

### Options

**Option A — incumbent-based bridge** (employee → fact → the v5 position they hold via `legacy_employee_id`). RULE: resolve each position's facts through its incumbent; attach facts keyed on that employee (`employee_career_progress`, `talent_pool_members`, `succession_candidates.candidate_employee_id`, `critical_roles.current_incumbent_id`, `succession_plans.incumbent_employee_id`) or on a job_title the employee holds (`job_title_courses.job_title` → B-51 `sys_job_roles` → `sys_positions`). Same mechanism that already seeded `legacy_position_text` and the B-51 job_roles. Doctrine-aligned (I14 / key `LEGACY_EMP::`).

**Option B — ESCO/occupation-template bridge** (bypass the incumbent, match by title/ESCO URI, broadcast template facts). DEAD-END.

**Option C — hierarchy / reports_to bridge** (walk `legacy_manager_id`). Org tree is 100% closed but **unblocks 0 tables** — a column scan of all 12 blocked-source legacy tables found ZERO manager/reports/parent/hierarchy columns. Orthogonal to this wall.

### Verbatim measured queries + results (verified live this session)

```
# Advanced bridge surface
psql :5433 -c "SELECT count(*), count(position_metadata->>'legacy_employee_id'),
  count(DISTINCT position_metadata->>'legacy_employee_id') FROM sys.sys_positions;"
  -> 162 | 162 | 162            (100% carry a distinct legacy_employee_id)

# sys_users LEGACY_EMP:: crosswalk (the succession/talent user-leg)
psql :5433 -c "SELECT count(*), count(*) FILTER(WHERE user_external_code LIKE 'LEGACY_EMP::%')
  FROM sys.sys_users;"  -> 161 | 160

# Option A per-table — legacy facts intersected with the 162-position incumbent set
# (extracted the 162 distinct legacy_employee_id from advanced, fed as VALUES to legacy VM)
ssh oracle-vm-default psql heuresys_platform:
  critical_roles_total                 16
  critical_roles_incumbent_in_posset    8     -> sys_critical_positions 8/16 = 50%
  succession_plans_total               31
  succession_plans_incumbent_in_posset  9     -> sys_position_succession_relevance 9/31 = 29%
  succession_candidates_total         206
  succession_candidates_in_posset     122     -> sys_successor_candidates user-leg 122/206 = 59%
  talent_pool_members_total            40
  talent_pool_members_in_posset        40     -> 40/40 = 100%
  employee_career_progress_total       40
  employee_career_progress_in_posset   40     -> sys_position_career_paths 40/40 = 100%
  talent_pools_total                   24     -> sys_succession_pools: ZERO position/employee key, 0/24

# Option A KPI dead-end proof (orphaned job_kpis keyspace)
ssh oracle-vm-default psql heuresys_platform:
  job_kpis_total                     2000  (400 distinct job_template_id)
  job_templates_total                 140
  job_kpis_with_existing_template     210  -> only 210/2000 reference an existing template
```

(Prior F3 measurements, consistent and carried forward: Option A resolves **158/162 (97.5%)** of positions to a legacy ESCO occupation via incumbent and **162/162 (100%)** via incumbent `job_title`; `job_title_courses` 207 rows, 6/7 real occupation titles match; `job_templates` sharing an ESCO URI with an employee occupation = 4, and `job_kpis` on those 4 = **0**. Option B: only **4/140** templates overlap a v5 occupation title, carrying **0** KPIs, broadcast fan-out up to 29 positions per title — HIGH fabrication. Option C: 159/162 carry `legacy_manager_id`, 159/159 managers are themselves position incumbents, but 0/12 blocked sources key on hierarchy.)

### Recommendation

**Adopt Option A as the ONLY viable bridge, applied PER-TABLE with explicit per-table coverage acceptance — it is not one mechanical import.** Three tiers:

- **W1a — IMPORT NOW (clean):** `sys_position_career_paths` (40/40), `sys_position_learning_requirements` (`job_title_courses`, 6/7 titles, 1:N fan-out is a design choice not a gap), talent_pool_members → `sys_successor_candidates` user leg (40/40). Each its own card, supervised run, backup-guarded.
- **W1b — IMPORT WITH DOCUMENTED PARTIAL COVERAGE:** `sys_critical_positions` (8/16 = 50%) and `sys_position_succession_relevance` (9/31 = 29%). The unresolved fraction is **exactly the collapsed-out SmartFood/EcoNova tenants** — a clean documentable boundary, not a modeling gap. Enzo must accept the partial.
- **W1c — CANNOT be unblocked by any option, needs an Enzo semantic decision (NOT an import):** `sys_position_kpi_requirements` + `sys_position_skill_requirements` (job-template keyspace carries 0 facts on the 4 workforce-overlapping templates; genuinely job-LEVEL facts with no instance-resolvable source) and `sys_succession_pools` (talent_pools 0/24, no position/employee key). For W1c the realistic path is to **DERIVE** position-level KPI/skill requirements from the position's ESCO occupation profile rather than re-key the orphaned legacy `job_kpis` — a modeling decision, flagged for Enzo (and it ties directly into the AI plan's P3 ESCO-derivation slice).

Regression risk MED for A: heterogeneous coverage → each table needs its own card + validate-after-each; mitigated by the established idempotent supervised-run pattern and existing integration-test coverage.

---

## 3. Wall W2 — org-unit KPI template-vs-instance (`sys_organization_unit_kpi_templates` empty)

**The wall.** The target needs three FKs: `kpi_id` → `sys_kpi_definitions`, `unit_id` → `sys_organization_units`, `tenant_id`. **The kpi-FK is NO LONGER a wall**: the S958.1 KPI-catalog unification imported all 100 legacy org-unit KPI codes into `sys_kpi_definitions`. The **only remaining wall is the ORG-UNIT FK**, a genuine template-vs-instance namespace split: legacy `org_unit_kpis` hangs off `public.org_unit_templates` (design-layer blueprint, generic codes), while `sys_organization_units` was imported from a DIFFERENT legacy table `public.org_units` (instance-layer, 26 RTL-Bank rows). There is no FK bridge between these two legacy namespaces.

### Options

- **A** — treat `org_unit_kpis` as templates, match org-unit by CODE.
- **A-name** — same but match by NAME.
- **B** — derive OU-level KPI instances from `sys_kpi_targets` aggregated user → active-assignment → position → org_unit (do not import legacy at all).
- **C(i)** — re-import the legacy org-unit TEMPLATE taxonomy (`org_unit_templates`) as its own sys org-unit layer first; then `org_unit_kpis` imports 1:1 at 100%. (Introduces a SECOND org-unit population.)
- **C(ii)** — formally declare the table empty-by-design for the RTL reference tenant (mirroring `activity_classification_mappings` ADR-0025 §5.4).

### Verbatim measured queries + results (verified live this session)

```
# kpi-FK overlap — CORRECTS the stale §7 "code-overlap 0" line (CRLF artifact, now retracted)
# extracted 100 distinct legacy org_unit_kpis.kpi_code, resolved against advanced sys_kpi_definitions
psql :5433: legacy_distinct=100, resolved=100        -> 100/100, the kpi-dim is FULLY resolved

# org-unit namespace cardinalities (legacy)
ssh oracle-vm-default psql heuresys_platform:
  org_unit_kpis        100 rows | 100 distinct kpi_code | 91 distinct org_unit_template_id
  org_unit_templates   225 rows | 25 distinct code
  org_units             76 rows | 75 distinct code

# Option A (CODE match) — legacy org_unit_kpis joined to org_unit_templates, code IN (26 sys ou codes)
ssh oracle-vm-default psql heuresys_platform:  4     -> 4/100 = 4% (only DIR-CORP)
# Option A-name: 0/100 (RTL names vs generic case-study template names) — strictly worse

# Advanced org-unit population provenance
psql :5433: sys_organization_units = 26 (24 referenced by a position)
```

(Prior F3b, carried forward and consistent: `sys_organization_units(26)` metadata `legacy_org_unit_id` resolves 26/26 in `org_units`, 0/26 in `org_unit_templates`; `tenant_org_units.source_unit_id` NULL on all 47 rows. Option B reaches **64 (org_unit,kpi) pairs / 20 of 26 OUs / only 9 distinct KPIs**, with an unauthored weight/target aggregation rule.)

### Recommendation

**NEEDS-DECISION (Enzo semantic call) — do NOT autonomously import.** Mechanical options score near-zero against the real RTL target: code-match 4/100, name-match 0/100 — both would silent-skip 96–100% of rows (the exact failure mode the plan forbids). Option B is a *derivation* (9 KPIs, fabricated aggregation semantics), not the legacy data. The genuine choice is **C(i)** (full legacy fidelity at 100% but introduces a second org-unit population — a real org-model decision touching I1/tenant scoping) vs **C(ii)** (park empty-by-design, honest for an RTL tenant whose org chart came from the instance layer).

**My evidence-based lean: C(ii) (park empty-by-design)** for the RTL reference tenant specifically, unless Enzo wants full legacy template fidelity → then C(i) as its own scoped org-model milestone. Also recommend updating `DATA_RECONCILIATION_PLAN.md` §7 line ~124 to retract the stale "code overlap = 0" framing (the kpi-dim is now 100/100; disjointness lives entirely on the org-unit dim — verified this session).

---

## 4. Wall W3 — learning catalog is event-sourced (F3b Wall-2)

**The wall.** A canonical learning catalog DOES exist in legacy with stable natural-key codes, but the advanced import discarded it in favor of operational-event rows. `sys.sys_learning_modules` is 7299/7300 event-derived (`OLDDB::<event>::<id>`); the catalog that DID land went into the WRONG table (`sys_learning_paths` as `CRS-*`/`PATH-*` rows). Consequently `sys.sys_learning_path_steps` is **0 rows** and structurally unbuildable: its NOT-NULL `learning_path_step_module_id` FK requires a catalog row in `sys_learning_modules`, of which exactly 0 exist. **This is a clean re-import problem, not a missing-source problem.**

### Options

- **A** — re-import the canonical learning catalog from legacy catalog tables (`courses` → `sys_learning_modules` as `CRS-<code>`, `learning_paths` → `sys_learning_paths` as `PATH-<code>`, `learning_path_courses` → `sys_learning_path_steps`). RECOMMENDED, gated on C.
- **B** — derive a synthetic module catalog from distinct event module refs. FALSIFIED (845/845 event rows have null parent-course link; any real derivation re-reads legacy → collapses into A).
- **C** — needs-decision: catalog re-home semantics (course = module vs course = path; module granularity course-level 127 vs course_module-level 564; fate of the ~130 mis-placed CRS-*/PATH- rows). LOW execution risk but BLOCKS A.

### Verbatim measured queries + results (verified live this session)

```
# Advanced state
psql :5433: sys_learning_modules total=7300, OLDDB=7299, non-OLDDB(catalog)=1
psql :5433: sys_learning_path_steps = 0

# Legacy canonical catalog cardinality (code-stable NKs)
ssh oracle-vm-default psql heuresys_platform:
  courses               127 rows | 127 distinct code
  learning_paths         20 rows |  20 distinct code
  course_modules        564 rows | 564 retain course_id (60 distinct parent courses)
  learning_path_courses 124 rows |  20 distinct path

# sys_learning_path_steps is 100% buildable once a module catalog exists:
ssh oracle-vm-default psql heuresys_platform (learning_path_courses LEFT JOIN paths + courses):
  total=124 | path_resolves=124 | course_resolves=124 | both=124   -> 124/124 = 100%
```

(Prior F3b, carried forward: the 845 `OLDDB::course_modules` rows have `course_id: null` in metadata — advanced-only derivation is impossible. Only 60 of 127 legacy course codes currently exist anywhere in advanced as mis-placed `sys_learning_paths CRS-*` rows; all 20/20 path codes present. F3b DEAD_END targets `sys_user_learning_evidence` 0/2657 and `sys_skill_learning_mappings` 0/717 — both unblocked once a course=module catalog exists; the skill leg of the latter already resolves 635/717 = 88.6%.)

### Recommendation

**Option A (canonical catalog re-import) gated on the Option-C semantic decision**, recommended granularity = **1 `sys_learning_module` per legacy course (127 modules, NK code `CRS-<code>`)** plus optionally 564 finer `course_module` sub-units if a sub-module model is wanted. Evidence is decisive: a real, code-stable catalog exists; `sys_learning_path_steps` becomes 100% (124/124) buildable once the module catalog lands. Option B is falsified by measurement. The one genuine blocker is **not** data availability but a **re-home decision** (Option C): the legacy course currently mis-lives as a `sys_learning_paths` row and must be re-homed/dual-homed as a `sys_learning_module`. This is a structural correction requiring a backup + migration (re-home, not pure ON CONFLICT add) → regression risk MED, mitigated by full code-stability/idempotency. **After the decision, A is a deterministic idempotent import I can run.**

---

## 5. Wall W4 — SDBI Phase 2 (Semantic-Driven Brownfield Import)

**The surface.** SDBI (ADR-0014, ACCEPTED S951) is the AI-led mechanism to EXTEND the `sys.*` schema for source areas whose target table is **MISSING** — distinct from the deterministic brownfield wave pipeline (100% coverage of existing legacy) and from the reconciliation-closure cycle (fills already-existing empty `sys.*` tables). The Goals/OKRs pilot proves the end-to-end pattern is real and reusable. **7 macro-areas still have NO `sys.*` target schema.**

### Options

- **A — Full scope: all 7 remaining macro-areas** (PerformanceReviews, Feedback360, Mentorship, Surveys/Engagement, PredictionsML, TalentPool, Compensation-history). ~666 source columns of human-design surface (perf 165, feedback 112, mentorship 53, engagement 87, predictions 110, talent 63, documents 76); ~8–10k rows; ~75–125h.
- **B — Minimal-viable slice: PerformanceReviews + Feedback360** (the cleanest 1:1 entity-shaped, highest-value, non-analytics areas). Covers 277/666 design cols (~42%); ~2.3k rows; ~20–35h.
- **C — Defer the stream; ship only the 4 missing Phase-1 infra items** (SDBI audit rule_codes, the 4 SDBI lineage columns on `sys_source_lineage_records`, `docs/sdbi/RUNBOOK.md`, promote the goals_pilot 3-file template). ~6–10h, zero data-write risk.

### Verbatim measured queries + results (verified live this session)

```
# SDBI substrate is absent (advanced)
psql :5433:
  temp_sdbi_tables                 0      (schema exists, no staging tables persist)
  sdbi_lineage_cols (on sys_source_lineage_records LIKE '%sdbi%')   0
  sdbi_target_schemas (sys tables ~ review|feedback|mentor|survey|engage|pulse|predict|nine_box|calibrat)  0

# Goals/OKRs pilot IS a real SDBI run (the proven template)
psql :5433 (sys_source_lineage_records, target ~ goal|okr):
  rows=5939 | avg confidence=0.900 | distinct source tables=11

# Legacy macro-area source volumes (sample, populated)
ssh oracle-vm-default psql heuresys_platform:
  performance_reviews 292 | competency_review_ratings 465 | feedback_360 714
  continuous_feedback 729 | nine_box_grid 265
```

(Prior measurements carried forward: only 2 of ~40 SDBI-candidate legacy sources are registered in `brownfield.source_tables`; `brownfield` is single-wave (97 cards, wave 1 only); the FK axis is healthy (138/138 RTL via `LEGACY_EMP::`). PII is a non-issue — ADR-0023 no-PII global, all `column_mappings pii_disposition=NONE`.)

### Recommendation

**Option B (PerformanceReviews + Feedback360 slice) IF Enzo greenlights SDBI now, otherwise Option C as the parking move.** Rationale: (1) the pattern is PROVEN — Goals/OKRs is a real run (5939 lineage rows, avg confidence 0.900, 11 sources), so per-area risk is template-replication (LOW) not green-field invention; (2) PerfReviews + Feedback360 are entity/event-log shaped with a 100%-resolving employee FK on the RTL subset — they avoid the derived-analytics NEEDS-DECISION trap that Predictions/Talent would re-trigger; (3) they cover 42% of the design surface at ~20–35h with a clean defer boundary. **Whatever the choice, the 4 Option-C infra items are a prerequisite and should ship first** — they are measured-absent today and are the literal PROMPT 027 §4 Sessione-1 acceptance never closed. This is a **CLASS B Enzo greenlight** (multi-session production-write workstream with a real human-design budget), not an autonomous run.

---

## 6. AI Semantic-Matching (Capability ②) — pgvector + Voyage implementation plan

**Substrate state (verified live):** pgvector is AVAILABLE but NOT installed — `pg_available_extensions.name='vector'` returns 1 row (default_version 0.8.2), but `pg_extension WHERE extname='vector'` returns 0 rows. Enablement = a new idempotent migration `db/migrations/000059_*` with `CREATE EXTENSION IF NOT EXISTS vector;` (mirrors `000001_init_extensions.sql`). PG16 on the OCI VM is ARM64; pgvector 0.8.2 is the packaged build already present → ARM64 risk retired; only the per-DB `CREATE EXTENSION` is missing. **Latest migration on disk = 000058 → AI substrate starts at 000059.**

**Corpus (verified live):** `sys_skills` **21939** rows (3,014,088 chars total text incl. descriptions → ~753k tokens), distinct ESCO occupation labels **3040** (of 7645 mapping rows — embed once per URI), `sys_job_roles` **227** (~3k tokens). Person profiles (156 of 161 users have skill-evidence, 902 evidence rows) are MEAN-POOLED from skill vectors → **0 backfill tokens**.

### Phases

- **P0 SUBSTRATE (~0.5 day)** — migration 000059 = `CREATE EXTENSION IF NOT EXISTS vector` + 4 sidecar embedding tables + HNSW indexes (idempotent, IF NOT EXISTS). NO Voyage call; tables ship empty. Deliverable: `pnpm db:migrate` twice-run clean; `vector` in `pg_extension`; vitest integration test asserting extension present + each embedding table queryable+empty. **AUTONOMOUSLY EXECUTABLE.**
- **P1 PIPELINE + FIRST MATCH SURFACE (~3–4 days)** — (a) Voyage client `apps/api/src/integrations/voyage/` (env `VOYAGE_API_KEY` optional, recorded fixture for CI, never live in tests — mirrors InMemoryMailer); (b) backfill job + `POST /v1/matching/reindex` (gated `matching:admin`) embedding skills/ESCO/job_roles; (c) person-profile vectors by MEAN-POOL (pure SQL, 0 Voyage tokens); (d) FIRST match endpoint `GET /v1/me/matching/occupations` (ESS self-scope) + near-free `GET /v1/matching/skills/similar`. Full 7-step module pattern → `apps/api/test/semantic-matching.integration.test.ts` (RBAC + CSRF + I5 isolation + a seeded finance persona returns finance ESCO occupations + empty-profile → real empty-state). **Gated on OD-1/OD-2/OD-5.**
- **P2 BROADEN (~2–3 days)** — `GET /v1/me/matching/roles` (mobility) + `GET /v1/matching/people/similar` (succession/team-building) + incremental refresh hook + ESS mobility page + admin matching panel (live-data E2E only, Playwright). Each surface = own test + atomic commit.
- **P3 (DEFERRED, own thin plan)** — person→positions / position→candidates. Blocked on `position_skill_requirements` being 0 today; derive from each position's ESCO occupation embedding — **this is the same derivation that resolves W1c**. Its own Enzo gate.

### Schema changes (migration `000059_pgvector_substrate.sql`, idempotent)

| Object | Key / shape | Note |
|---|---|---|
| `CREATE EXTENSION IF NOT EXISTS vector` | — | enablement |
| `sys.sys_skill_embeddings` | `skill_id` FK→`sys_skills` UNIQUE, `embedding vector(1024)`, `model_id`, `source_text_hash` | sidecar keeps hot table narrow; CASCADE-safe re-embed |
| `sys.sys_esco_occupation_embeddings` | keyed by distinct `esco_uri` (3040), `embedding vector(1024)`, `label_text`, `isco_code` | embed once per URI; 4605 unlabeled rows = known gap (OD-6) |
| `sys.sys_job_role_embeddings` | `job_role_id` FK→`sys_job_roles` UNIQUE | |
| `sys.sys_user_profile_embeddings` | `user_id` FK→`sys_users` UNIQUE, `tenant_id` (I5), `derived_from_evidence_count` | DERIVED by mean-pool — never a Voyage call |
| HNSW indexes | `USING hnsw (embedding vector_cosine_ops)`, `m=16, ef_construction=64` | corpus small+static → HNSW over IVFFlat (no `lists`/ANALYZE tuning) |
| Permission seed | `matching:read` (ESS+admin) + `matching:admin` (reindex) | `INSERT...ON CONFLICT DO NOTHING`, mirrors 000057 |

No changes to existing `sys.*` business tables — all embeddings in NEW sidecar tables (preserves I3/I4/I1/I5/I7).

### Voyage integration & cost

- **Model/dim**: spec said `voyage-3` (now legacy/no free tokens) → use **`voyage-3.5`** (same $0.06/1M, 1024 default, Matryoshka-capable 256/512/1024/2048). Multilingual IT/EN (RTL data is Italian) — embed `skill_name+skill_description` concatenated, no translation. `input_type='document'` on backfill, `'query'` at match time (asymmetric retrieval). `source_text_hash` (sha256) per row → hash-skip makes re-runs ~0 tokens. CI: zero live calls (recorded fixture).
- **Cost (MEASURED, ~4 chars/token)**: skills ~753k tok + ESCO ~18k + job_roles ~3k = **one-shot backfill ~774k tokens ≈ $0.046 (under 5 US cents)**. Person profiles + queries = 0 backfill tokens (mean-pooled). Per-query match ≈ $0.000003. `voyage-4-lite` would be $0 (first 200M tok/mo free) — an open decision. **The entire AI substrate is a sub-dollar cost item.**

### Risks (P×I)

| Risk | P×I | Mitigation |
|---|---|---|
| Match quality/relevance | med×med — the only real risk | hybrid re-rank (cosine kNN + pg_trgm lexical on `sys_skills_name_trgm_idx`) + a small EVAL set of known person→occupation pairs asserted in the P1 integration test (make it a **P1** deliverable, not P2) |
| ESCO embeddable-surface gap | high×low-med | only 3040/7645 mapping rows carry a label; embed the 3040 in P1, document the unlabeled remainder as reduced-recall (OD-6) |
| Person-profile sparsity | med×med | 156/161 users have evidence (~5.8 skills/person); real empty-state for 0-evidence persons; surface `derived_from_evidence_count`; never fabricate |
| HNSW recall vs exact | low×low | corpus tiny → generous `ef_search` or even exact seq-scan over 3040 occupations (sub-ms) |
| Voyage key handling | low×low | `VOYAGE_API_KEY` optional in env (CI/dev boot without it); fixture in tests; secret-hygiene grep before commit; extend `LOG_REDACT_PATHS` |
| Model legacy/versioning | low×low | store `model_id` per row → a model switch is a clean re-embed, not a schema change |

---

## 7. DECISIONS REQUESTED FROM ENZO

Each item: the exact question · my recommended answer · the measured evidence · what I do once you decide.

**D1 — W1a: import the 3 clean incumbent-keyed position facts now?** (`sys_position_career_paths`, `sys_position_learning_requirements`, `sys_successor_candidates` user-leg).
→ **Recommend YES.** Evidence: career_paths **40/40 (100%)**, talent_pool_members **40/40 (100%)**, learning via job_title_courses 207 rows / 6-of-7 titles — all verified live. Doctrine-aligned (I14, `LEGACY_EMP::`). On YES I author + run each card per-table under the supervised pattern (backup → author → validate-after-each → integration test green → atomic commit). **Autonomous once decided.**

**D2 — W1b: import the 2 partial-coverage succession facts WITH a documented boundary?** (`sys_critical_positions` 8/16, `sys_position_succession_relevance` 9/31).
→ **Recommend YES, with the partial explicitly accepted.** Evidence: the unresolved 50%/71% is **exactly the collapsed-out SmartFood/EcoNova tenants** — a clean documentable boundary, not a modeling gap. On YES I import the resolvable fraction and annotate the boundary in the lineage + registry. **Autonomous once decided.**

**D3 — W1c: how to populate `sys_position_kpi_requirements` / `sys_position_skill_requirements` / `sys_succession_pools`?** (No bridge option resolves them.)
→ **Recommend DERIVE KPI/skill requirements from each position's ESCO occupation profile** (ties to AI plan P3), and **PARK `sys_succession_pools`** (talent_pools 0/24 carry no position/employee key). Evidence: job_kpis on the 4 workforce-overlapping templates = **0**; Option-B skill reqs = 68 ambiguous broadcast rows (HIGH fabrication). This is a **modeling decision, not an import** — I will NOT guess. On your call I scope it as the P3 ESCO-derivation slice.

**D4 — W2: `sys_organization_unit_kpi_templates` — park empty-by-design (C-ii) or introduce the template org-unit layer (C-i)?**
→ **Recommend C(ii) park empty-by-design** for the RTL reference tenant. Evidence: kpi-FK now **100/100** (stale "0" retracted), but org-unit FK code-match **4/100** / name-match **0/100**; C(i) would add a SECOND org-unit population (a real org-model decision). If you want full legacy fidelity, C(i) is the only 100% path → I scope it as its own org-model milestone. Either way I'll also retract the stale §7 "code-overlap 0" line. **Park = autonomous doc update; C-i = scoped milestone.**

**D5 — W3: learning catalog re-home — confirm course = module at 1-module-per-course (127) granularity + re-home the ~130 mis-placed `sys_learning_paths CRS-*/PATH-*` rows?**
→ **Recommend YES (course=module, 127 modules, NK `CRS-<code>`).** Evidence: catalog is code-stable (courses 127/127, paths 20/20, course_modules 564/564, learning_path_courses **124/124 both-leg**); `sys_learning_path_steps` becomes **100% (124/124)** buildable; Option B falsified (845/845 event rows null parent link). This is the gate that BLOCKS Option A. On YES I run the re-import (backup + re-home migration + idempotent catalog import → unblocks steps + evidence + skill-learning). **Autonomous once the granularity + re-home decision lands.**

**D6 — W4 (SDBI Phase 2): greenlight the PerfReviews+Feedback360 slice (Option B) now, or park (Option C)?**
→ **Recommend: ship the 4 Option-C infra items first regardless; then Option B IF you greenlight, else park.** Evidence: 0/7 macro-areas have any `sys.*` schema; B covers 277/666 cols (42%) at ~20–35h, entity-shaped, FK 138/138 RTL, avoids the analytics NEEDS-DECISION trap; the pattern is proven (Goals pilot 5939 rows / 0.900 confidence). **CLASS B greenlight** (multi-session production-write budget) — your call.

**D7 — AI ②: enable the pgvector P0 substrate now (migration 000059), and confirm P1 first-surface + model?**
→ **Recommend YES for P0 now** (autonomous, zero data-write risk: extension + 4 empty sidecar tables + HNSW, twice-run-clean). For P1 confirm: **OD-1** first surface = person→ESCO occupations + near-free skill→skill [recommended]; **OD-2** model = `voyage-3.5` @ 1024-dim ($0.06/1M, ~$0.05 total) [recommended] vs `voyage-4-lite` free-tier; **OD-5** `matching:read` granted to USER role (ESS self-scope). Evidence: substrate absent but available (0.8.2), corpus 21939 skills, one-shot backfill ~774k tok ≈ $0.05. On YES I ship P0 immediately; P1 needs the `VOYAGE_API_KEY` to be set for the live backfill (tests use a fixture).

---

### Autonomy split (what I execute once decided vs what needs your semantic call)

- **I can execute autonomously once decided** (deterministic, idempotent, supervised-run, test-covered): D1 (W1a cards), D2 (W1b partial import), D5 (W3 catalog re-import — after the granularity decision), D7-P0 (AI substrate migration 000059), the 4 SDBI infra items, and the §7 stale-line retraction.
- **Needs your semantic call before I touch anything** (modeling decisions, no-fabrication rule): D3 (W1c derivation/park), D4 (W2 park vs 2nd org-unit population), D6 (W4 SDBI greenlight + scope), and the P1/P2 AI surfaces (OD confirmations + API key).
