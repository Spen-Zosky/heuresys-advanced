# D6 — SDBI Option-B Slice DESIGN: PerformanceReviews + Feedback360

> **Owner**: CLI. **Type**: READ-ONLY design (SELECT-only; NO migrations applied, NO data mutated — the CLI executes later under a supervised, backup-guarded run). **Authored**: 2026-06-04 (S960+). **Gate**: every write action below is GATED on Enzo's sign-off of the schema decisions in §7.
>
> **Scope**: the SDBI (ADR-0014) Option-B minimal-viable slice from the W4 dossier (`RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md` §5) — the two cleanest entity/event-shaped, highest-value, non-analytics HRMS macro-areas that currently have **NO `sys.*` target schema**. This document designs the new `sys.*` tables, maps each legacy source, and lays out the execution sequence at plan level. It is the SDBI deliverable equivalent of the goals-pilot `01_SOURCE_DISCOVERY` + `02_TARGET_SCHEMA_PROPOSAL` + per-table mapping-cards, consolidated.
>
> **Provenance of numbers**: all counts/resolvability re-verified live this session against advanced (`localhost:5433` / `heuresys_advanced` / schema `sys`, non-superuser) and legacy (`oracle-vm-default` native PG `heuresys_platform`, read-only, no-PII ADR-0023). Each figure is a measured `count(*)`, not an estimate. Doctrine grounding: ADR-0014 (SDBI 6-phase), ADR-0024 / `EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` (I14, person = `employees`, key `LEGACY_EMP::` || employees.id), ADR-0023 (no-PII). Proven template: `db/seeds/brownfield/sdbi/goals_pilot/{01_temp_sdbi_ddl,02_phase3_temp_sdbi_seed,03_phase5_consolidation}.sql` + migration `000036`/`000037`.

---

## 1. Executive summary

The Option-B slice covers **5 legacy source tables** (2 entity-shaped, 1 child-ratings, 2 event-log). Live measurement produced **three structural findings that re-shape the original mini-spec** (`cowork_reserved/batch_c3/sdbi_scale/01_PerformanceReviews.md`):

1. **`nine_box_grid` is a VIEW, not a base table.** Its definition is a pure projection over `performance_reviews.{performance_box, potential_box, overall_rating, potential_rating}` joined to `employees`+`org_units`, with the 9 category labels computed in a `CASE`. There is **no independent nine-box data to import**: the box coordinates already live on `performance_reviews`. ⟹ nine-box becomes a **derived `sys.*` VIEW** over `sys_performance_reviews`, not an imported table. This eliminates the proposed `sys_nine_box_placements` import table.

2. **All the cascade-parent FK tables are empty-by-data.** `review_cycle_id`, `template_id` (on PR), `questionnaire_id`, `request_id`, `question_responses`, the `performance_review_id` back-links, and `competency_id` are **0-filled across all rows**. ⟹ the slice needs **no `review_cycles`/`templates`/`questionnaires`/`feedback_requests` companion tables** (Phase-4 FK traversal terminates immediately). These become NULL columns + metadata, exactly the goals-pilot "defer template_id" pattern.

3. **The I14 employee-FK resolves cleanly on the RTL reference subset.** All 5 sources FK to `employees_core` (270-row base; the `employees` name is a VIEW). On the 2 legacy tenants that collapse to the single canonical RTL tenant, employee resolvability is **98.8–100%** (per-table table below). The unresolved fraction is exactly (a) the 2 collapsed-out non-RTL tenants and (b) 2 PR subject + 1 cf author rows whose employee row was dropped in the S950 rebuild — a clean, documentable boundary, identical in kind to the W1b partial.

**Proposed new schema: 4 base `sys.*` tables + 1 derived VIEW** (down from the mini-spec's 7):
`sys_performance_reviews` · `sys_performance_review_competency_ratings` · `sys_feedback_360_responses` · `sys_continuous_feedback` + `sys_nine_box_grid` (VIEW).

**Invariant impact**: all NEW tables → purely additive. **Regression risk LOW** (no existing `sys.*` table touched; pattern is template-replication of a proven run). **Effort**: ~12–20h including the 4 prerequisite SDBI infra items (D6-infra), well inside the 20–35h Option-B envelope.

| Source (legacy) | Live rows | Shape | Target | RTL-resolvable | In-scope? |
|---|---|---|---|---|---|
| `performance_reviews` | **292** | entity (4-stage review lifecycle) | `sys_performance_reviews` | emp 159/161, reviewer 157/161 (RTL=161) | YES |
| `competency_review_ratings` | **465** | child of PR (per-competency rating) | `sys_performance_review_competency_ratings` | 465/465 via parent PR (RTL=465) | YES |
| `nine_box_grid` | **265** (VIEW) | derived projection of PR | `sys_nine_box_grid` (**VIEW**) | n/a (derived) | YES — as VIEW |
| `feedback_360` | **714** | event (multi-rater feedback) | `sys_feedback_360_responses` | 390/390 both legs (RTL=390) | YES |
| `continuous_feedback` | **729** | event (peer praise/coaching) | `sys_continuous_feedback` | to 474/474, from 473/474 (RTL=474) | YES |

---

## 2. Live source discovery (Phase 1) — measured this session

### 2.1 Row counts (real `count(*)`, NOT `pg_stat` which read stale-zero)

```
ssh oracle-vm-default psql heuresys_platform (count(*)):
  performance_reviews        292
  competency_review_ratings  465
  nine_box_grid              265   ← VIEW (pg_class.relkind='v')
  feedback_360               714
  continuous_feedback        729
```

### 2.2 Canonical entity shapes (from `\d` introspection)

- **`performance_reviews`** (53 cols) — the core review entity. 4-stage workflow (`self_*` → `manager_*` → `calibrated_*` → `finalized_*`), each stage a `(rating, comments, submitted_at)` triplet. Carries the 9-box coordinates inline (`performance_box`, `potential_box` ∈ 1..3 CHECK), `overall/goal_achievement/competency/potential` ratings, jsonb side-channels (`competency_ratings`, `goal_ratings`, `recommended_actions`, `section_ratings`), and a **`content_embedding vector(1536)` + embedding metadata** (legacy AI layer — **skip on import**, our own pgvector substrate is `vector(1024)`, migration 000060). FKs: `employee_id`, `reviewer_id`, `calibrated_by`, `finalized_by` → `employees_core`; `tenant_id` → `tenants`; `review_cycle_id`/`template_id` → cycle/template tables (**0-filled**).
- **`competency_review_ratings`** (15 cols) — child of a review, one row per (review, competency). KSABA dimension (`knowledge|skill|behavior`), `self_rating`/`manager_rating` (numeric 3,2), evidence `text[]`, weight. UQ `(performance_review_id, competency_name)`. FKs: `performance_review_id` → PR, `employee_id`/`tenant_id`. `competency_id` **0-filled** (free-text `competency_name` is the real key).
- **`nine_box_grid`** (VIEW, 11 cols) — `SELECT … FROM performance_reviews pr JOIN employees e … WHERE pr.status='completed' AND performance_box IS NOT NULL AND potential_box IS NOT NULL`, with `nine_box_category` a 9-way `CASE` over the box coords. **No own storage.**
- **`feedback_360`** (23 cols) — multi-rater event. `target_employee_id` + `reviewer_employee_id` + `relationship_type` (`self|peer|manager`), `overall_rating` (1..5 CHECK), `is_anonymous`, free-text strengths/improvement, `status` (`completed`). Carries `content_embedding vector(1536)` (**skip**). FKs: target/reviewer → `employees_core`; `questionnaire_id`/`request_id`/`performance_review_id`/`question_responses` all **0-filled**.
- **`continuous_feedback`** (17 cols) — lightweight peer event. `from_employee_id` → `to_employee_id`, `feedback_type` CHECK (`praise|constructive|suggestion|coaching|recognition`), `message`, `is_private`, `visibility`, `tags text[]`, `related_goal_id` (**215/729 filled** → soft link to `sys_goals`, which exists). FKs: from/to → `employees_core`; `competency_id`/`performance_review_id` 0-filled.

### 2.3 Distinct categorical values (for RD-08 `varchar + CHECK`, NEVER ENUM)

```
pr.review_type            : annual, mid_year
pr.status                 : completed, in_progress, submitted   (legacy 'draft' default unused)
pr.potential_rating       : high, low, medium
pr.self_assessment_status : not_started
crr.ksaba_dimension       : behavior, knowledge, skill
f360.relationship_type    : manager, peer, self
f360.status               : completed
cf.feedback_type          : coaching, constructive, praise, recognition, suggestion
cf.visibility             : private, (null)
cf.category               : (null)
rating ranges: pr.overall 1.85..5.00 · pr.potential_box 1..3 · crr.self_rating 2.00..5.00
```
(CHECK sets will be supersets of observed values — include the legacy default literals + obvious siblings, matching the goals-pilot `goal_status` superset pattern.)

---

## 3. Employee-FK resolvability (I14) — the decisive measurement

Method: exported the 160 advanced `LEGACY_EMP::` employee ids (`sys.sys_users.user_external_code LIKE 'LEGACY_EMP::%'` → strip prefix), `\copy`-loaded them into a temp table on the legacy VM, intersected each source's employee FK against that set, scoped to the 2 legacy tenants that map to the canonical RTL tenant (`brownfield.tenant_id_mappings`: `0c54b84a…` and `d5855519…` → `86ba7a65…`).

```
adv_emp_loaded            160        (sys_users: 161 total, 160 LEGACY_EMP::-coded)
tenant map                2 legacy → 1 canonical RTL   (other 2 PR tenants = collapsed-out)

performance_reviews   RTL=161   emp_resolves 159 (98.8%)  reviewer 157 (97.5%)  both 157
competency_ratings    RTL=465   emp_resolves 465 (100%)   via-parent-PR 465 (100%)
feedback_360          RTL=390   target 390 (100%)         both legs 390 (100%)
continuous_feedback   RTL=474   to 474 (100%)             from 473 (99.8%)  both 473
```

**Verdict**: the I14 employee-centric crosswalk is fully viable on the RTL reference subset (the slice's import scope). The ~1–2% non-resolving rows are 2 PR subjects + 1 cf author whose `employees_core` row was dropped in the S950 collapse — handled by the goals-pilot precedent: keep the row, set the FK NULL, record the real `legacy_employee_id` in `*_metadata`. The non-RTL fraction (PR 131/292, etc.) belongs to the 2 collapsed-out tenants and is **out of scope for the RTL reference import** (documented boundary, not a gap), exactly the W1b treatment.

---

## 4. Target schema design (Phase 2) — proposed `sys.*` tables

All follow the established convention (verified against `000037_sys_goals_okrs_scaffold.sql`): `sys.sys_<plural>`; PK `<entity>_id uuid DEFAULT gen_random_uuid()`; tenant FK `<entity>_tenant_id → sys.sys_tenancies(tenant_id) ON DELETE RESTRICT` (I5: FK + middleware, **NEVER RLS** — drop the legacy `tenant_isolation` RLS policy, do not port it); natural key `<entity>_natural_key varchar(512)` + UQ `(tenant_id, natural_key)`; `<entity>_metadata jsonb NOT NULL DEFAULT '{}'`; categorical `varchar(N) + CHECK` (RD-08); `date` for date-only / `timestamptz` for time-of-day (RD-09); `created_at` always, `updated_at` + `sys_set_updated_at` trigger only on mutable (snapshot) entities, omitted on immutable event logs.

### 4.1 `sys.sys_performance_reviews` (entity ← `performance_reviews`, ~30 cols post-trim)

| Column | Type | Note |
|---|---|---|
| `review_id` | uuid PK | gen_random_uuid |
| `review_tenant_id` | uuid NN | FK → sys_tenancies, ON DELETE RESTRICT |
| `review_natural_key` | varchar(512) NN | `PERF_REVIEW::<tenant>::<legacy id>`; UQ(tenant, nk) |
| `review_subject_user_id` | uuid | FK → sys_users ON DELETE SET NULL (legacy `employee_id`; NULL if unresolved + id in metadata) |
| `review_reviewer_user_id` | uuid | FK → sys_users ON DELETE SET NULL (`reviewer_id`) |
| `review_calibrated_by_user_id` | uuid | FK → sys_users ON DELETE SET NULL |
| `review_finalized_by_user_id` | uuid | FK → sys_users ON DELETE SET NULL |
| `review_period_start` / `review_period_end` | date NN | RD-09; CHECK end >= start |
| `review_type` | varchar(32) NN DEFAULT 'ANNUAL' | CHECK in (ANNUAL, MID_YEAR, QUARTERLY, PROBATION, PROJECT) |
| `review_status` | varchar(32) NN DEFAULT 'DRAFT' | CHECK in (DRAFT, IN_PROGRESS, SUBMITTED, CALIBRATED, FINALIZED, COMPLETED, CANCELLED) |
| `review_potential_rating` | varchar(16) | CHECK NULL or in (LOW, MEDIUM, HIGH) |
| `review_overall_rating` | numeric(3,2) | CHECK NULL or 1..5 |
| `review_goal_achievement_rating` / `review_competency_rating` / `review_self_rating` / `review_calibrated_rating` / `review_pre_calibration_rating` | numeric(3,2)/(3,1) | each CHECK NULL or 1..5 |
| `review_performance_box` / `review_potential_box` | integer | CHECK NULL or 1..3 (feeds the 9-box VIEW) |
| `review_strengths` / `review_areas_for_improvement` / `review_manager_comments` / `review_employee_comments` / `review_self_comments` / `review_development_plan` / `review_career_aspirations` / `review_calibration_notes` | text | free-text |
| `review_section_ratings` / `review_competency_ratings_snapshot` / `review_goal_ratings_snapshot` / `review_recommended_actions` | jsonb DEFAULT '[]'/'{}' | preserve legacy jsonb side-channels |
| `review_self_submitted_at` / `review_manager_submitted_at` / `review_calibrated_at` / `review_finalized_at` / `review_self_review_completed_at` / `review_shared_at` / `review_submitted_at` / `review_acknowledged_at` | timestamptz | 4-stage workflow lifecycle |
| `review_self_assessment_status` | varchar(20) DEFAULT 'NOT_STARTED' | CHECK in (NOT_STARTED, IN_PROGRESS, COMPLETED) |
| `review_metadata` | jsonb NN DEFAULT '{}' | holds `legacy_id`, unresolved `legacy_employee_id`/`legacy_reviewer_id`, legacy `review_cycle_id`/`template_id`, dropped embedding hash |
| `created_at` / `updated_at` | timestamptz NN | + `sys_set_updated_at` trigger; CHECK updated>=created |

**Dropped on import** (CW-B18-aware, documented in mapping-card): `content_embedding`, `embedding_text_hash`, `embedding_model`, `embedding_generated_at` (legacy 1536-d AI layer — our substrate is separate, 1024-d), `goals_auto_populated`/`goals_count`/`competencies_count` (recomputable counters → metadata if wanted).

### 4.2 `sys.sys_performance_review_competency_ratings` (child ← `competency_review_ratings`, ~14 cols)

| Column | Type | Note |
|---|---|---|
| `rating_id` | uuid PK | |
| `rating_tenant_id` | uuid NN | FK → sys_tenancies RESTRICT |
| `rating_review_id` | uuid NN | FK → sys_performance_reviews ON DELETE CASCADE |
| `rating_subject_user_id` | uuid | FK → sys_users SET NULL (legacy `employee_id`) |
| `rating_natural_key` | varchar(512) NN | `PERF_COMP_RATING::<tenant>::<legacy id>`; UQ(tenant, nk) |
| `rating_ksaba_dimension` | varchar(20) | CHECK NULL or in (KNOWLEDGE, SKILL, BEHAVIOR, ATTITUDE) |
| `rating_competency_name` | varchar(100) NN | the real key (legacy `competency_id` 0-filled) |
| `rating_self_rating` / `rating_manager_rating` | numeric(3,2) | CHECK NULL or 1..5 |
| `rating_self_comment` / `rating_manager_comment` | text | |
| `rating_self_evidence` | text[] | preserve array |
| `rating_weight` | numeric(3,2) DEFAULT 1.0 | |
| `rating_metadata` | jsonb NN DEFAULT '{}' | `legacy_id`, `legacy_competency_id` |
| `created_at` / `updated_at` | timestamptz NN | + trigger |

Secondary UQ `(rating_review_id, rating_competency_name)` mirrors the legacy business key.

### 4.3 `sys.sys_feedback_360_responses` (event ← `feedback_360`, ~16 cols)

| Column | Type | Note |
|---|---|---|
| `response_id` | uuid PK | |
| `response_tenant_id` | uuid NN | FK RESTRICT |
| `response_natural_key` | varchar(512) NN | `FEEDBACK_360::<tenant>::<legacy id>`; UQ |
| `response_target_user_id` | uuid | FK → sys_users SET NULL (`target_employee_id`) |
| `response_reviewer_user_id` | uuid | FK → sys_users SET NULL (`reviewer_employee_id`) — NULL-able preserves anonymity |
| `response_review_id` | uuid | FK → sys_performance_reviews SET NULL (legacy `performance_review_id`, 0-filled → NULL) |
| `response_relationship_type` | varchar(32) | CHECK NULL or in (SELF, PEER, MANAGER, DIRECT_REPORT, SKIP_LEVEL, EXTERNAL) |
| `response_overall_rating` | numeric(3,2) | CHECK NULL or 1..5 |
| `response_strengths` / `response_areas_for_improvement` | text | |
| `response_is_anonymous` | boolean NN DEFAULT true | |
| `response_status` | varchar(32) NN DEFAULT 'PENDING' | CHECK in (PENDING, IN_PROGRESS, COMPLETED, DECLINED, EXPIRED) |
| `response_sentiment_score` | numeric(3,2) | nullable (0-filled today) |
| `response_submission_time_seconds` | integer | nullable |
| `response_completed_at` | timestamptz | |
| `response_metadata` | jsonb NN DEFAULT '{}' | `legacy_id`, legacy `questionnaire_id`/`request_id`/`review_cycle_id`, unresolved ids |
| `created_at` | timestamptz NN | **immutable event-log → NO updated_at, NO trigger** |

### 4.4 `sys.sys_continuous_feedback` (event ← `continuous_feedback`, ~16 cols)

| Column | Type | Note |
|---|---|---|
| `feedback_id` | uuid PK | |
| `feedback_tenant_id` | uuid NN | FK RESTRICT |
| `feedback_natural_key` | varchar(512) NN | `CONTINUOUS_FEEDBACK::<tenant>::<legacy id>`; UQ |
| `feedback_from_user_id` | uuid | FK → sys_users SET NULL (`from_employee_id`) |
| `feedback_to_user_id` | uuid | FK → sys_users SET NULL (`to_employee_id`) — was NN in legacy; SET NULL + metadata if the 1 unresolved |
| `feedback_related_goal_id` | uuid | FK → sys_goals SET NULL (215/729 filled; `sys_goals` exists from goals pilot) |
| `feedback_type` | varchar(30) NN DEFAULT 'PRAISE' | CHECK in (PRAISE, CONSTRUCTIVE, SUGGESTION, COACHING, RECOGNITION) |
| `feedback_message` | text NN | |
| `feedback_category` | varchar(50) | nullable (0-filled today) |
| `feedback_visibility` | varchar(20) NN DEFAULT 'PRIVATE' | CHECK in (PRIVATE, MANAGER, TEAM, PUBLIC) |
| `feedback_is_private` | boolean NN DEFAULT false | |
| `feedback_tags` | text[] | |
| `feedback_sentiment_score` | numeric(3,2) | nullable (8/729 filled) |
| `feedback_acknowledged` | boolean NN DEFAULT false | |
| `feedback_acknowledged_at` | timestamptz | |
| `feedback_metadata` | jsonb NN DEFAULT '{}' | `legacy_id`, legacy `competency_id`/`performance_review_id`, unresolved ids |
| `created_at` | timestamptz NN | **immutable event-log → NO updated_at** |

### 4.5 `sys.sys_nine_box_grid` (**VIEW**, not a table — re-derive over `sys_performance_reviews`)

```
CREATE OR REPLACE VIEW sys.sys_nine_box_grid AS
SELECT pr.review_tenant_id AS tenant_id, pr.review_subject_user_id AS user_id,
       u.user_display_name AS employee_name, pr.review_overall_rating AS overall_rating,
       pr.review_potential_rating AS potential_rating,
       pr.review_performance_box AS performance_box, pr.review_potential_box AS potential_box,
       CASE WHEN pr.review_performance_box=3 AND pr.review_potential_box=3 THEN 'Star'
            … (9-way, verbatim from legacy view definition) … ELSE 'Not Rated' END AS nine_box_category,
       pr.review_metadata->>'legacy_review_cycle_id' AS review_cycle_id
FROM sys.sys_performance_reviews pr
LEFT JOIN sys.sys_users u ON pr.review_subject_user_id = u.user_id
WHERE pr.review_status='COMPLETED' AND pr.review_performance_box IS NOT NULL AND pr.review_potential_box IS NOT NULL;
```
Department/`org_unit` leg deferred (legacy joined `org_units` by `employee.org_unit_id`; in advanced the org leg is via `sys_user_position_assignments` — add later if a dept facet is wanted, else drop the column). This honours I9-style "projection is a VIEW, never a stored blob" and removes the import table entirely.

---

## 5. Mapping cards (Phase 2 — per-source provenance summary)

Each gets a full `cowork_reserved/sdbi_mapping_cards/<source>__<target>.md` at execution time (ADR-0014 §3.6 format). Compressed here:

- **`performance_reviews → sys_performance_reviews`** (confidence ~0.90): entity, snapshot+lifecycle. FK strategy — `employee_id`/`reviewer_id`/`calibrated_by`/`finalized_by` → `sys_users` via `LEGACY_EMP::`||id JOIN (resolve 159/157 RTL, else NULL+metadata, I14); `tenant_id` via `brownfield.tenant_id_mappings`; `review_cycle_id`/`template_id` → metadata (0-filled). Drop 4 embedding cols. CHECK supersets per §2.3. NK `PERF_REVIEW::<tenant>::<id>`.
- **`competency_review_ratings → sys_performance_review_competency_ratings`** (confidence ~0.93): child; resolve `rating_review_id` from the temp_sdbi PR mirror by `_legacy_source_id` (goals-pilot milestone pattern); `employee_id` → sys_users. UQ on (review, competency_name). NK `PERF_COMP_RATING::<tenant>::<id>`.
- **`nine_box_grid → sys_nine_box_grid` (VIEW)** (confidence 1.0, deterministic): NOT an import. Re-create the legacy CASE projection over `sys_performance_reviews`. No staging row, no lineage row (a VIEW has no source rows) — record its existence in the runbook/ADR note instead.
- **`feedback_360 → sys_feedback_360_responses`** (confidence ~0.92): event. target/reviewer → sys_users (390/390 RTL); `performance_review_id`/`questionnaire_id`/`request_id`/`question_responses` → metadata (0-filled). Drop embedding cols. NK `FEEDBACK_360::<tenant>::<id>`.
- **`continuous_feedback → sys_continuous_feedback`** (confidence ~0.93): event. from/to → sys_users (474/473 RTL); `related_goal_id` → `sys_goals` SET NULL (215 filled); `competency_id`/`performance_review_id` → metadata. NK `CONTINUOUS_FEEDBACK::<tenant>::<id>`.

Lineage (Phase 5): one bulk `INSERT … sys.sys_source_lineage_records` per target (prefix `source_lineage_*`, verified live), `source_system='heuresys_platform'`, NK `OLDDB::<table>::<id>`, `mapping_confidence` per card, `metadata` with `sdbi_mapping_card_id` + `sdbi_ai_model_id` — exactly the goals-pilot `03_phase5_consolidation.sql` pattern.

---

## 6. Invariant impact + regression risk

| Invariant / rule | Impact | How satisfied |
|---|---|---|
| **I1 position-centric** | none | feedback/reviews hang off the *person* (`sys_users`), the legitimate subject of a review; no position re-modeling |
| **I3/I4 schema discipline** | additive | all targets `sys.sys_<plural>`; staging in `temp_sdbi.*` (ADR-0014); no `usr_*`/`br_*` |
| **I5 tenant isolation = FK + middleware, NEVER RLS** | enforced | every table has `*_tenant_id` FK + UQ(tenant, nk); the legacy `tenant_isolation` RLS policy is **NOT ported** (dropped on import) |
| **I7 auth separate** | none | no `sys_auth_*` touched; reviewers/subjects are persons not credentials |
| **I9 PIP-as-view** | reinforced | `sys_nine_box_grid` modeled as a derived VIEW, not a stored blob — consistent with the PIP doctrine |
| **I12/ADR-0023 no-PII** | none | synthetic case-study data; no masking layer; review text is fictional |
| **I14 employee-centric** | central | person FK = `LEGACY_EMP::`||employees_core.id → sys_users; `employees` (VIEW) / `users` collision avoided; unresolved → NULL+metadata not drop |
| **RD-08 categorical = varchar+CHECK** | enforced | 8 CHECK sets (§2.3), zero ENUM |
| **RD-09 date vs timestamptz** | enforced | `review_period_*` = date; all lifecycle stamps = timestamptz |

**Regression risk: LOW.** Rationale per R20 criteria: (1) volume measured — 5 sources, ~2.2k RTL rows, 4 base tables; (2) all NEW objects → zero existing-table mutation, additive migration only; (3) high pattern-repetitivity — direct replica of the proven goals-pilot run (5939 lineage rows, 0.900 avg confidence, twice-run-clean); (4) test coverage — the slice ships its own integration test (RBAC + I5 isolation + count assertions, §8); (5) risk register below.

| Risk | P×I | Mitigation |
|---|---|---|
| Unresolved employee FK silently dropped | low×med | explicit NULL+metadata pattern (goals-pilot precedent); count-assert resolved vs total in the test |
| CHECK set too narrow → import row rejected | low×low | CHECK = superset of measured distinct values + legacy defaults |
| temp_sdbi pollution | low×low | isolated schema, TRUNCATE-and-retry, no FK to sys.* (ADR-0014 §3.2) |
| nine-box VIEW depends on PR column rename | low×low | VIEW authored in the same migration as the table; CI typecheck/test catches drift |
| Non-RTL tenant rows expected but absent | low×low | scope explicitly = RTL reference subset; boundary documented in lineage + this doc |

---

## 7. Schema decisions needing Enzo sign-off (CLASS B)

These are modeling choices the no-fabrication rule forbids me deciding unilaterally:

1. **D6-S1 — Entity granularity / table count.** Confirm the **4 base tables + 1 VIEW** design (vs the mini-spec's 7 tables). The reduction is driven by the live findings (nine-box is a VIEW; cycles/templates/questionnaires/requests are 0-filled). Recommend: **4 + VIEW**.
2. **D6-S2 — Which of the 5 sources are in-scope.** Recommend: **all 5** — performance_reviews + competency_review_ratings + nine_box_grid(VIEW) + feedback_360 + continuous_feedback. (No source is empty or analytics-derived; all resolve cleanly.)
3. **D6-S3 — Rating scales.** Confirm the unified scale: numeric ratings on a **1.00–5.00** CHECK (matches measured ranges 1.85–5.00 / 2.00–5.00) and box coordinates **1–3** CHECK. Keep `numeric(3,2)` (legacy precision); `pre_calibration_rating` stays `numeric(3,1)` as in legacy.
4. **D6-S4 — Import scope = RTL reference subset only**, with the non-RTL collapsed tenants and the 2 PR + 1 cf unresolved-employee rows recorded as a documented boundary (W1b-style partial). Recommend: **YES**.
5. **D6-S5 — nine_box VIEW department leg.** Drop the `department` column for now (legacy joined `org_units`; advanced org leg is indirect via assignments) OR derive it via `sys_user_position_assignments`. Recommend: **drop for v1**, add later if a dept facet is requested.
6. **D6-S6 — `sys_feedback_360_responses` reviewer anonymity.** Keep `response_reviewer_user_id` nullable + `response_is_anonymous` (no separate redaction). Recommend: **YES** (no-PII anyway, ADR-0023).
7. **D6-S7 — Greenlight the Option-B production-write workstream itself** (the D6 multi-session run) AND the 4 prerequisite SDBI infra items (§8 step 0). This is the CLASS-B greenlight from dossier D6.

---

## 8. Execution sequence (plan level — NO SQL here; the run is a later supervised, backup-guarded step)

**Step 0 — D6-infra prerequisites (the 4 measured-absent Option-C items; ship FIRST regardless).**
The 4 ADR-0014 §3.4 SDBI lineage columns are **not yet on `sys_source_lineage_records`** (verified live — columns end at `source_lineage_metadata`, no `*_sdbi_*`). (a) migration `000063` = `ALTER TABLE sys.sys_source_lineage_records ADD COLUMN IF NOT EXISTS source_lineage_sdbi_mapping_card_id text / _confidence numeric / _ai_model_id text / _human_approver text`; (b) register the SDBI `rule_code`s in `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` (ADR-0014 §3.5 list); (c) author `docs/sdbi/RUNBOOK.md`; (d) promote the goals-pilot 3-file template to a reusable `db/seeds/brownfield/sdbi/_template/`. (Migration 000063 is the next free number — latest on disk = **000062**.)

**Step 1 — Migration `000064` (schema scaffold).** New `sys.sys_performance_reviews` + `sys_performance_review_competency_ratings` + `sys_feedback_360_responses` + `sys_continuous_feedback` (full FK/CHECK/UQ/index/trigger per §4) + `CREATE OR REPLACE VIEW sys.sys_nine_box_grid`. Idempotent (`CREATE TABLE IF NOT EXISTS` + `DO`-guarded `ADD CONSTRAINT IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`), modeled byte-for-byte on `000037`. Twice-run-clean proven before Step 2.

**Step 2 — temp_sdbi DDL (SDBI Phase 3 staging).** `db/seeds/brownfield/sdbi/perf_feedback/01_temp_sdbi_ddl.sql` — 4 mirror tables (no FK, `_legacy_source_*` pointer columns), modeled on goals-pilot `01_temp_sdbi_ddl.sql`. No mirror for the VIEW.

**Step 3 — staging seed (SDBI Phase 3 populate).** `02_phase3_temp_sdbi_seed.sql` — `INSERT … SELECT` from `legacy_mirror.*` (extend the mirror first: per memory obs 13893, `performance_reviews`/`feedback_360` were absent from `legacy_mirror` — a Phase-3 pre-step extends the extract for these 5 sources, mirroring the goals-pilot `legacy_mirror.goals` provisioning), resolving tenant via `tenant_id_mappings`, employee via `LEGACY_EMP::` JOIN, optional FKs → NULL+metadata. Idempotent `ON CONFLICT (_legacy_source_id) DO NOTHING`.

**Step 4 — consolidation seed (SDBI Phase 5).** `03_phase5_consolidation.sql` — `INSERT … sys.* … ON CONFLICT (tenant, natural_key) DO UPDATE/NOTHING`, child review_id resolved from the temp PR mirror, + bulk lineage rows + the new SDBI lineage columns populated (now that 000063 added them) + `SDBI_CONSOLIDATION_COMPLETE_V1` audit marker. Modeled on goals-pilot `03_phase5_consolidation.sql`.

**Step 5 — integration test.** `apps/api/test/sdbi-perf-feedback.integration.test.ts` (or a DB-level validation in `db:validate`): assert each `sys.*` count = resolved-RTL count (`sys_performance_reviews` ≈ 161, `competency_ratings` ≈ 465, `feedback_360_responses` ≈ 390, `continuous_feedback` ≈ 474); 0 NULL on NOT-NULL cols; all non-NULL employee FKs resolve in `sys_users`; I5 — every row's tenant = canonical RTL; `sys_nine_box_grid` returns only `COMPLETED` rows with both boxes set. (No API module is in scope for D6 — the surface endpoints are a later MVP, this slice is the data substrate. If/when an API module is added it follows the mandatory 7-step pattern.)

**Step 6 — Phase 6 cleanup + commit.** `DROP TABLE temp_sdbi.*` for the 4 mirrors (`SDBI_TEMP_CLEANUP_V1`), update `SOT_STATE.md` + `HANDOFF.md` + reconciliation registry, atomic commit `feat(db): SDBI Option-B slice — perf-reviews + feedback360 (4 tables + nine-box VIEW)`. No push without explicit ask.

**Dependency order within the run**: 000063 (infra) → 000064 (schema) → temp_sdbi DDL → PR mirror → competency/feedback/continuous mirrors → consolidate PR → consolidate children/events → VIEW (already in 000064) → lineage/audit → test → cleanup. Cascade is shallow (only competency_ratings depends on PR); feedback_360 + continuous_feedback are independent.
