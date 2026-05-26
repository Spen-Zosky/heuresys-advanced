# Macro-area 01 — Performance Reviews + Calibration

**Lexicon**: GOKMER (Goal-KPI-Measurement-Evaluation-Review)
**Tier 1 / Rank 2** · **Effort 6-10h pilot** · **Volume ~957 rows**
**Status**: Mini-spec for C4/scale plan. Full pilot deferred.

---

## §1 — Source tables in `heuresys_platform.public` (live counts 2026-05-21)

| Table | Rows | Schema introspect needed | Note |
|---|---|---|---|
| `performance_reviews` | 292 | ✅ live verified — 50+ columns incl. pgvector content_embedding(1536), 4-stage workflow (self_*, manager_*, calibrated_*, finalized_*) | Core entity, complex review lifecycle |
| `performance_predictions` | 267 | ⏳ verify | AI-generated forecast layer, ties to EPRA |
| `performance_trends` | 202 | ⏳ verify | Time-series aggregation |
| `calibration_sessions` | 86 | ⏳ verify | Manager calibration cycle anchor |
| `calibration_discussions` | 60 | ⏳ verify | Multi-row per session |
| `calibration_results` | 50 | ⏳ verify | Final rating outputs |
| `performance_review_cycles` | 0 | ⏳ verify | Cycle template (likely seed-data) |
| `performance_ratings` | 0 | source-empty — skip | |
| `performance_evidence` | 0 | source-empty — skip | |

**Total importable**: ~957 rows across 6 active tables.

---

## §2 — Proposed sys.* new tables

| sys.* table | Approx columns | Source mapping | Key FKs |
|---|---|---|---|
| `sys_performance_reviews` | ~25 (post-trim of pgvector + redundant timestamps) | from `performance_reviews` | tenant_id, employee_id → lm.employees_core, reviewer_id → lm.users, review_cycle_id, template_id |
| `sys_performance_review_cycles` | ~6 | from `performance_review_cycles` (if any rows) or seeded | tenant_id |
| `sys_performance_predictions` | ~10 | from `performance_predictions` | tenant_id, prediction_employee_id, prediction_model_id |
| `sys_performance_trends` | ~8 | from `performance_trends` | tenant_id, trend_employee_id, trend_period_start/end |
| `sys_calibration_sessions` | ~10 | from `calibration_sessions` | tenant_id, session_facilitator_user_id |
| `sys_calibration_discussions` | ~12 | from `calibration_discussions` | tenant_id, discussion_session_id → sys_calibration_sessions, discussion_employee_id |
| `sys_calibration_results` | ~10 | from `calibration_results` | tenant_id, result_session_id, result_employee_id, result_pre_rating/calibrated_rating |

**Total new sys.* tables**: 7. **Skip from source**: pgvector embedding cols + denormalized snapshots.

---

## §3 — FK resolution strategy

- **user_id**: resolved via `legacy_mirror.users` (C3.2 enabled). Use `LOOKUP_FK` with `match_on='user_email'` or `user_legacy_id` per pattern from Goals/OKRs.
- **employee_id**: resolved via `legacy_mirror.employees_core` (C3.2 enabled).
- **tenant_id**: via `brownfield.tenant_id_mappings`. Pre-flight verify all `performance_reviews.tenant_id` UUIDs are in the map.
- **review_cycle_id → sys_performance_review_cycles**: cascade FK. Insert cycles FIRST, then reviews. Order matters within Wave execution.
- **template_id**: defer (no canonical template table source yet) → store legacy UUID in `metadata` jsonb.
- **calibration FK chain**: calibration_sessions → calibration_discussions → calibration_results. Idem cascade insert order.
- **performance_predictions → sys_predictive_models** (cross-macro-area dep #8): if Predictions area not yet imported, leave `prediction_model_id` NULL or embed in metadata.

---

## §4 — Estimated complexity

| Dimension | Assessment |
|---|---|
| **Pilot effort** | MEDIUM (6-10h) — 7 sys.* tables, moderate FK fan-out, no schema discovery surprises expected |
| **Dependencies** | Hard: C3.2 users + employees (✅ done). Soft: #8 Predictions ML (defer FK resolution) |
| **Risks** | pgvector embedding cols (skip pattern available); 4-stage workflow timestamps require careful CAST_TIMESTAMPTZ |
| **Recommended timing** | Wave 2 (C4 batch), 2nd after #5 Time/Leave (after ITLAB foundation) |

---

## §5 — Recommended order in C4/C5/C6 scale

**C4 batch, 2nd pilot**. Sequence: #5 → #1 → #9.
