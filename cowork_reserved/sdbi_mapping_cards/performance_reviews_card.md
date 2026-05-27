# Mapping Card — PerformanceReviews cluster → `sys.sys_performance_*` / `sys.sys_review_*`

## Metadata
- mapping_card_id: PERFREV-MAP-01
- source: `heuresys_platform.public.{performance_review_templates, review_cycles, review_cycle_phases, review_cycle_participants, performance_reviews, self_reviews, goal_review_ratings, competency_review_ratings}`
- target: `heuresys_advanced.sys.{sys_performance_review_templates, sys_review_cycles, sys_review_cycle_phases, sys_review_cycle_participants, sys_performance_reviews, sys_self_reviews, sys_goal_review_ratings, sys_competency_review_ratings}`
- created: 2026-05-27
- author: SDBI AI (CLI Claude Code, opus-4.7) — CLI-owned post-S939, no Cowork
- approver: Enzo (scope authorized 2026-05-27; design pilot)
- confidence_overall: **0.80 MEDIUM** (schema-design high; data-import unverified — source 0-row)
- workflow_phase: 2 (TARGET ANALOGY MATCHING) — **data import DEFERRED**

## ⚠ Source-data status (CW-B16/B21)
All 8 source tables in `heuresys_platform.public` are **schema-only: 0 rows** (verified 2026-05-27 via `SELECT count(*)`). The HR transactional demo data that fed the shipped pilots lived in `legacy_mirror.*` (export `db-export-2026-05-15`); the perf-review tables were never mirrored. **Therefore this card delivers the TARGET SCHEMA DESIGN only** (Phase 2). Phase 3-6 (temp_sdbi seed → consolidation → lineage → cleanup) are **deferred** until the source data is located/extracted (carry-over to a future PROMPT). Row counts and FK-resolution ratios below are marked `n/a (0-row)`.

## Source semantic analysis
- semantic_type: cluster of ENTITY (templates, cycles, reviews) + JUNCTION/child (phases, participants, ratings, self_reviews).
- Aggregate root: `review_cycles` (1) → `review_cycle_phases` (N), `review_cycle_participants` (N), `performance_reviews` (N). `performance_reviews` (1) → `self_reviews` / `goal_review_ratings` / `competency_review_ratings` (N).
- 4-tier multi-rater: self (self_reviews + self_* on performance_reviews) / manager (manager_* fields) / calibration (calibrated_* + box grid performance_box×potential_box) / acknowledgment (participant flags). 360-feedback fields present on cycles but the feedback_360_* tables are a SEPARATE macro-area (not in this cluster).
- contains_pii: LOW (free-text comments may include names; no SSN/email columns).
- temporal: mixed (date periods + event timestamps). `performance_reviews` legacy audit cols are `timestamp WITHOUT TZ` → cast UTC on import.
- soft_delete: only `performance_review_templates.deleted_at`.

## Target schema design (shipped — migration 000046)

8 tables, conventions: `sys.sys_<plural>`; per-table column prefix; `*_tenant_id` FK → `sys.sys_tenancies` (I5, no RLS); categoricals `varchar(N)+CHECK` (RD-08); `date` vs `timestamptz` (RD-09); `*_natural_key` + UQ `(tenant_id, natural_key)`; `*_metadata jsonb` provenance; FK intra-cluster + `sys.sys_users`/`sys.sys_goals`.

| target | src cols | notes |
|---|---|---|
| `sys_performance_review_templates` | 16 | 1:1 prefix-rename; `template_sections` NOT NULL DEFAULT `[]`. |
| `sys_review_cycles` | 34 | all deadlines as `date`; `cycle_review_template_id` FK templates; `cycle_competency_framework_id`/`cycle_rating_scale_id` kept nullable (no sys.* target) + ref in metadata. |
| `sys_review_cycle_phases` | 14 | FK `phase_cycle_id` → cycles ON DELETE CASCADE. |
| `sys_review_cycle_participants` | 17 | `employee_id`/`manager_id` → `sys_users`; status CHECK **ported** (8 values UPPERCASE). |
| `sys_performance_reviews` | 52 | `content_embedding` + `embedding_*` (4 cols) SKIPPED (HC: 0-row, vector noise); legacy `timestamp` → `timestamptz`; box-grid + overall_rating CHECKs ported (1-5, 1-3, 1-3). |
| `sys_self_reviews` | 22 | FK → performance_reviews CASCADE; status CHECK ported (DRAFT/SUBMITTED). |
| `sys_goal_review_ratings` | 13 | `goal_id` → `sys_goals` (resolvable); FK → performance_reviews CASCADE. |
| `sys_competency_review_ratings` | 15 | `competency_id` → `competency_rating_legacy_competency_id` nullable (no sys.* competency target); `self_evidence text[]` → `jsonb`. |

## Transform codes (per ADR §3.6, to apply at Phase 3 when data exists)
- DIRECT_COPY for matching types; `*_id` → prefixed `*_<entity>_id`.
- LOOKUP_TENANT_ID via `brownfield.tenant_id_mappings` (tenant_id → canonical).
- LOOKUP_USER_BY_LEGACY_EMPLOYEE (employee_id/reviewer_id/manager_id → `sys_users.user_id`); fallback NULL + `legacy_*_id` in metadata (pilot precedent: goals).
- LOOKUP_GOAL (`goal_id` → `sys_goals.goal_id` via legacy_id metadata).
- UPPERCASE for categoricals before CHECK; CAST_TO_TIMESTAMPTZ (UTC) for `timestamp without tz`.
- natural_key: `'PERF_REVIEW::' || tenant_id || '::' || legacy_id` (analogous per table).
- SKIP: `content_embedding`, `embedding_text_hash`, `embedding_model`, `embedding_generated_at`.

## FK resolution strategy
| FK | resolution |
|---|---|
| `*_tenant_id` | `brownfield.tenant_id_mappings.canonical_tenant_id` |
| `*_employee_user_id` / `*_reviewer_user_id` / `*_manager_user_id` / `*_calibrated_by` / `*_finalized_by` | `sys_users.user_id` via legacy employee path; NULL fallback + metadata |
| `phase_cycle_id` / `participant_cycle_id` / `review_cycle_id` | intra-cluster via `temp_sdbi` `_legacy_source_id ↔ cycle_id` |
| `self_review_performance_review_id` / `goal_rating_*` / `competency_rating_*` | intra-cluster via `_legacy_source_id ↔ review_id` |
| `goal_rating_goal_id` | `sys_goals.goal_id` via legacy id metadata |
| `cycle_competency_framework_id` / `cycle_rating_scale_id` / `competency_rating_legacy_competency_id` | no sys.* target → nullable, legacy id in metadata |

## Pre-flight checks
- Source row counts: **0 / 0 / 0 / 0 / 0 / 0 / 0 / 0** (all empty, 2026-05-27).
- Sample validation: n/a (0-row).
- FK non-NULL ratios: n/a (0-row) — to measure at Phase-1 on populated data.

## Post-execution acceptance (when Phase 3-6 runs)
- `sys.sys_*` count = source count per table (modulo soft-delete).
- 0 NULL on NOT NULL cols; tenant FK all resolve.
- Lineage rows = upserted rows, with `source_lineage_sdbi_mapping_card_id='PERFREV-MAP-01'` + confidence + model id (migration 000045).
- Audit `SDBI_CONSOLIDATION_COMPLETE_V1` per target; `SDBI_TEMP_CLEANUP_V1` post-cleanup.

## Confidence breakdown
| aspect | confidence | notes |
|---|---|---|
| Schema/type design | 0.90 | introspected from live source DDL |
| Categorical CHECK completeness | 0.65 | only participant/self_review whitelists known; others TODO(CHECK) pending data |
| FK resolution | 0.75 | intra-cluster solid; user lookup unverified (0-row) |
| Data import readiness | n/a | source empty — deferred |
| **Overall** | **0.80 MEDIUM** | design-confident; import unverified |

## Human review notes / carry-over (PROMPT 028+)
- [DEFERRED] Locate PerformanceReviews source data (heuresys-evo dump?) and extend the extract to mirror the 8 tables into `legacy_mirror`, then run Phase 3-6.
- [TODO(CHECK)] Add value-CHECK whitelists for `review_type`, `review_status`, `cycle_type`, `cycle_status`, `phase_status`, `template_type`, `review_potential_rating`, `*_rating_scale_type`, `review_self_assessment_status`, `competency_rating_ksaba_dimension` once real values are observed.
- [OPEN] Whether `feedback_360_*` (separate macro-area) should compose with cycles or stand alone.

---
*End mapping_card performance_reviews_card.md — design pilot, import deferred.*
