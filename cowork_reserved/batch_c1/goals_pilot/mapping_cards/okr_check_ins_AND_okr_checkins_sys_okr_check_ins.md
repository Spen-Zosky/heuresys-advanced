# Mapping Card — `public.okr_check_ins` + `public.okr_checkins` → `sys.sys_okr_check_ins` (MERGE)

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-10
- **TWO sources merged into ONE target** (novel pattern within this pilot)
- source A: `public.okr_check_ins` (15 rows, per-KR granular)
- source B: `public.okr_checkins` (10 rows, per-OKR aggregate w/ jsonb)
- target: `sys.sys_okr_check_ins` (25 rows expected)
- author: SDBI AI (Cowork Claude)
- confidence_overall: **0.85 HIGH** (auto-approve; HC-3 awaits Enzo to confirm merge strategy)
- workflow_phase: 2

## Source semantic comparison

| Aspect | `okr_check_ins` (A) | `okr_checkins` (B) |
|---|---|---|
| Scope | per-KR (granular) | per-OKR (aggregate) |
| Rows | 15 | 10 |
| Required FK | tenant, okr_id, employee_id, key_result_id, check_in_date | tenant, okr_id, checkin_date |
| Optional FK | key_result_id (schema nullable but always populated in samples) | author_id |
| Numeric fields | previous_value, new_value (numeric 15,2) | overall_progress, confidence_level (numeric 5,2) |
| Progress fields | previous_progress, new_progress (numeric 5,2) | overall_progress only |
| Free text | notes, blockers | status_update (text), blockers, next_steps |
| JSON | NONE | **key_result_updates jsonb** (array of {key_result_id, progress}) |
| Behavior | "I checked in on KR X at date Y with new value V" | "I checked in on OKR X overall at date Y with status narrative and snapshot of all KRs" |

## Merge strategy

Discriminator: `check_in_scope ∈ {KEY_RESULT, OKR_AGGREGATE}`

```
A rows (15) → check_in_scope='KEY_RESULT'
  - check_in_key_result_id = source A.key_result_id (NOT NULL)
  - check_in_subject_user_id = LOOKUP from A.employee_id (NOT NULL → NULL FK SET NULL)
  - check_in_previous_value, check_in_new_value, check_in_previous_progress, check_in_new_progress populated
  - check_in_overall_progress, check_in_status_update, check_in_next_steps, check_in_key_result_updates_snapshot NULL

B rows (10) → check_in_scope='OKR_AGGREGATE'
  - check_in_key_result_id = NULL (CHECK enforces)
  - check_in_subject_user_id = LOOKUP from B.author_id (nullable)
  - check_in_overall_progress, check_in_status_update, check_in_next_steps populated
  - check_in_key_result_updates_snapshot = B.key_result_updates (raw jsonb)
  - check_in_previous_value/new_value/previous_progress/new_progress NULL
```

CHECK constraint `sys_okr_ci_scope_kr_coherent` enforces consistency at DB level.

## Field mapping — Source A `okr_check_ins`

| source_col | target_col | transform | confidence |
|---|---|---|---|
| id | (metadata.legacy_id) | STORE_IN_METADATA | HIGH |
| tenant_id | check_in_tenant_id | LOOKUP_TENANT_ID | HIGH |
| okr_id | check_in_okr_id | LOOKUP_OKR_BY_LEGACY_ID | HIGH |
| key_result_id | check_in_key_result_id | LOOKUP_KR_BY_LEGACY_ID | HIGH |
| employee_id | check_in_subject_user_id | LOOKUP_USER_BY_LEGACY_EMPLOYEE | HIGH |
| check_in_date | check_in_date | DIRECT_COPY | HIGH |
| previous_value | check_in_previous_value | DIRECT_COPY | HIGH |
| new_value | check_in_new_value | DIRECT_COPY | HIGH |
| previous_progress | check_in_previous_progress | DIRECT_COPY | HIGH |
| new_progress | check_in_new_progress | DIRECT_COPY | HIGH |
| confidence_level | check_in_confidence_level | CAST integer → numeric(5,2) | HIGH |
| notes | check_in_notes | DIRECT_COPY | HIGH |
| blockers | check_in_blockers | DIRECT_COPY | HIGH |
| created_at | created_at | DIRECT_COPY | HIGH |
| (computed) | check_in_scope | LITERAL 'KEY_RESULT' | HIGH |

## Field mapping — Source B `okr_checkins`

| source_col | target_col | transform | confidence |
|---|---|---|---|
| id | (metadata.legacy_id) | STORE_IN_METADATA | HIGH |
| tenant_id | check_in_tenant_id | LOOKUP_TENANT_ID | HIGH |
| okr_id | check_in_okr_id | LOOKUP_OKR_BY_LEGACY_ID | HIGH |
| author_id | check_in_subject_user_id | LOOKUP_USER_BY_LEGACY_EMPLOYEE | HIGH |
| checkin_date | check_in_date | DIRECT_COPY (rename column) | HIGH |
| overall_progress | check_in_overall_progress | DIRECT_COPY | HIGH |
| confidence_level | check_in_confidence_level | DIRECT_COPY | HIGH |
| status_update | check_in_status_update | DIRECT_COPY | HIGH |
| blockers | check_in_blockers | DIRECT_COPY | HIGH |
| next_steps | check_in_next_steps | DIRECT_COPY | HIGH |
| key_result_updates | check_in_key_result_updates_snapshot | DIRECT_COPY (preserve jsonb) | HIGH |
| created_at | created_at | DIRECT_COPY | HIGH |
| (computed) | check_in_scope | LITERAL 'OKR_AGGREGATE' | HIGH |
| (computed) | check_in_key_result_id | LITERAL NULL | HIGH |

## Computed common fields
- `check_in_natural_key`:
  - For A rows: `'OKR_KR_CHECK_IN::' || tenant_slug || '::' || source_id::text`
  - For B rows: `'OKR_AGG_CHECK_IN::' || tenant_slug || '::' || source_id::text`
  - Different prefix prevents UQ collision across the two sources
- `check_in_metadata`: `{"legacy_id": "...", "legacy_table": "okr_check_ins" or "okr_checkins", "import_run_id": "..."}`

## FK resolution
- tenant: brownfield.tenant_id_mappings (both sources)
- okr: temp_sdbi.sys_okrs (both sources, resolved post-okrs-insert)
- key_result: temp_sdbi.sys_okr_key_results (A only, post-KRs-insert)
- subject_user: A.employee_id or B.author_id → sys_users via email lookup

## Pre-flight
- Source A: 15 rows; all have key_result_id populated (sampled live)
- Source B: 10 rows; all have author_id NULL? Sample shows author_id populated → revalidate
- Combined: 25 rows merge target
- Sample A: okr=6db7acc3, kr=049bae29, date=2026-02-21, new_value=15, new_progress=8, notes IT
- Sample B: okr=6db7acc3, author=00b9c9e7, date=2026-02-14, overall=28, status_update IT, kr_updates=[{progress:25, kr_id:03af2417...}]

## Acceptance
| # | Criterion |
|---|---|
| A1 | count = 25 (15 KEY_RESULT + 10 OKR_AGGREGATE) |
| A2 | KEY_RESULT rows: 100% have check_in_key_result_id NOT NULL |
| A3 | OKR_AGGREGATE rows: 100% have check_in_key_result_id NULL |
| A4 | CHECK `sys_okr_ci_scope_kr_coherent` passes |
| A5 | All check_in_okr_id resolve to existing sys_okrs |
| A6 | KR-scoped rows have check_in_key_result_id resolving to existing sys_okr_key_results |
| A7 | Lineage rows = 25 (with `legacy_table` discriminator in metadata) |

## Confidence: **0.85 HIGH** — auto-approve (HC-3 awaits confirmation of merge strategy)

## Human review notes
- **HC-3**: merge of two source tables into one target with discriminator is design judgement. Alternative: keep `sys_okr_check_ins` + create `sys_okr_aggregate_check_ins` separately (2 targets, 2 mapping cards). Default proposal: MERGE.
- If Enzo rejects merge, revert by:
  1. Modify migration 000035 to add 2 separate tables
  2. Adjust 2 mapping cards
  3. Adjust Phase 5 consolidation plan
  Estimated rollback effort: ~30 min.

---
*End*
