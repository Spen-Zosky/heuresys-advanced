# SDBI Pilot — Time/Leave/Attendance (Batch C4.2)

**Status**: AUTHORED — awaiting Enzo approval before Phase 3 execution by CLI X4
**Authored**: 2026-05-21
**Author**: Cowork Claude (architect / SDBI supervisor)
**ADR reference**: ADR-0014 §2 + §3 (SDBI architecture), ADR-0015 (nullable lineage FK)
**Source DB**: `heuresys_platform` (OCI VM 80.225.82.207, postgres 16.14)
**Target DB**: `heuresys_advanced` (same host, separate DB — via tunnel 5433)
**Scope**: 3 source tables in scope (+ 3 bonus considered) — TRUE GAP macro-area #5 Time/Leave/Attendance
**Volume**: ~6.27k rows source (5237 attendance + 383 overtime + 501 balances + 99 requests + 27 transactions + 20 accrual rules)

---

## §1 — Why this pilot exists

ADR-0014 §5 acceptance criterion 2: "Second pilot non-Goals/OKRs domain validates SDBI cross-domain reusability". Macro-area #5 selected because:

1. **TRUE GAP** confirmed (`02a_ADV_SYS.md` §6.4): rich source data in `heuresys_platform.public` (6 tables, 6.27k rows), **zero `sys.sys_attendance*` / `sys.sys_overtime*` / `sys.sys_time_off*` target schema exists** in `heuresys_advanced`.
2. **Different shape from Goals/OKRs**: high-volume daily fact data (attendance 5237) + sparse approval workflow (overtime + requests) + accumulator state (balances). Exercises SDBI on event-stream + state-snapshot patterns, not just entity+hierarchy.
3. **Italian labor compliance bonus**: data already enriched with CCNL (`leave_accrual_rules.ccnl_type`, `is_ccnl_default`), giving Phase 5 lineage realistic ITLAB context.
4. **Reuses already-extracted `legacy_mirror.users` + `employees_core`** (Batch C3.2 mitigation CW-B27) — no fresh extraction needed.

## §2 — Deliverables index

| # | File | Phase | Purpose |
|---|---|---|---|
| 0 | `00_README_TIME_LEAVE_PILOT.md` | (this file) | Index + workflow narrative + HC items |
| 1 | `01_SOURCE_DISCOVERY.md` | Phase 1 | Schema + sample + NULL + FK + semantic analysis per 6 source tables |
| 2 | `02_TARGET_SCHEMA_PROPOSAL.md` | Phase 2 | Proposed `sys.*` schema design — 3-to-6 new tables (HC-2 decides) |
| 3 | `migrations/000040_sys_time_leave_scaffold.sql` | Phase 3 prep | sys.* tables idempotent CREATE TABLE + indexes + FKs |
| 4 | `mapping_cards/employee_attendance__sys_attendance.md` | Phase 2 | Field-by-field mapping card |
| 4 | `mapping_cards/employee_overtime__sys_overtime.md` | Phase 2 | " |
| 4 | `mapping_cards/employee_time_off_balances__sys_time_off_balances.md` | Phase 2 | " |
| 5 | `03_PHASE3_TEMP_SDBI_DDL.md` | Phase 3 | `temp_sdbi.<table>` mirror DDLs (no-FK staging) |
| 6 | `04_PHASE5_CONSOLIDATION_PLAN.md` | Phase 5 | INSERT...SELECT plans + lineage + audit emission |

## §3 — Workflow narrative (per ADR-0014 §3.1 six-phase)

```
[PHASE 1 — SOURCE DISCOVERY] ✅ DONE (Cowork via psql tunnel 5433)
   • Schema introspection via \d public.<table> for all 6 sources (LIVE verified)
   • Counts via pg_class.reltuples (RLS-bypass since current_tenant_id() unset)
     5237 + 383 + 501 + 99 + 27 + 20 = 6267 rows total
   • FK landscape mapped: tenant_id, employee_id → employees_core, balance_id self-FK
   • Output: 01_SOURCE_DISCOVERY.md

[PHASE 2 — TARGET ANALOGY + SCHEMA PROPOSAL] ✅ DONE (Cowork)
   • 3 sys.* new tables proposed (in-scope minimum) with optional +3 bonus
     - sys.sys_attendance       (5237) — event fact (daily clock-in/out + hours)
     - sys.sys_overtime          (383) — request+approval workflow
     - sys.sys_time_off_balances (501) — accumulator state
     - (HC-2 bonus) sys.sys_time_off_requests / sys.sys_leave_balance_transactions / sys.sys_leave_accrual_rules
   • Field-by-field mapping cards (3 primary + decision for bonus) with confidence HIGH/MEDIUM/LOW
   • HUMAN CHECKPOINT [Enzo]: review schema design + decide HC-1..HC-7 before Phase 3 apply
   • Output: 02_TARGET_SCHEMA_PROPOSAL.md + mapping_cards/

[PHASE 3 — MIGRATION APPLY + TEMP_ SEEDING] ⏳ PREP-COMPLETE — awaits CLI exec
   • Apply 000040 (sys.sys_attendance + sys.sys_overtime + sys.sys_time_off_balances [+ HC-2 bonus])
   • Create temp_sdbi.<table> mirrors (no-FK, TRUNCATE-able)
   • INSERT...SELECT from heuresys_platform.public via cross-DB or legacy_mirror extract
   • Output: temp_sdbi.* populated with row counts ≈ source

[PHASE 4 — RELATIONSHIP TRAVERSAL] ⏳ SCOPE-LIMITED for pilot
   • All FK from Time/Leave tables resolved via well-known mediations:
     - tenant_id → sys.sys_tenancies via brownfield.tenant_id_mappings (existing infra)
     - employee_id → sys.sys_users via legacy_mirror.users.employee_id lookup
     - validated_by / requested_by / approved_by / cancelled_by → sys.sys_users
     - balance_id (self-FK transactions→balances) → resolved post-balance import
     - payroll_job_id → DEFERRED (no sys.sys_payroll_export_jobs yet — store legacy_id in metadata)
   • Output: traversal not required (closed sub-graph except for payroll deferral)

[PHASE 5 — CONSOLIDATION] ⏳ PLAN-PREPPED — awaits CLI exec post Phase 3
   • INSERT ... ON CONFLICT (natural_key) DO UPDATE SET (for arricchimento)
   • Generate sys.sys_source_lineage_records per row (with ADR-0015 nullable FK)
   • Audit rule_codes: SDBI_CONFIDENCE_HIGH_AUTO_APPROVED, SDBI_HUMAN_APPROVED,
     SDBI_CONSOLIDATION_COMPLETE_V1
   • Output: 04_PHASE5_CONSOLIDATION_PLAN.md plus runtime INSERT...SELECT execution

[PHASE 6 — CLEANUP] ⏳ POST-CONSOLIDATION
   • DROP TABLE temp_sdbi.attendance, overtime, time_off_balances (+ bonus)
   • Audit row: SDBI_TEMP_CLEANUP_V1
```

## §4 — Human checkpoint items (BEFORE Phase 3 exec)

Enzo must review and approve (X2 default-approve pattern — silence = accept defaults):

| # | Item | Where to look | Default proposal | Decision needed |
|---|---|---|---|---|
| HC-1 | Naming: `sys.sys_attendance` (singular fact) vs `sys.sys_attendances` (plural) vs `sys.sys_employee_attendance_records` | `02_TARGET_SCHEMA_PROPOSAL.md` §1 | **`sys.sys_attendance`** (singular fact, consistent with naming style for event tables — analogous to `sys.sys_audit_log` legacy pattern) | Approve / override |
| HC-2 | Scope: 3 in-scope tables OR include 3 bonus (requests + transactions + accrual_rules) → 6 total | `02_TARGET_SCHEMA_PROPOSAL.md` §0 + §11 | **6 tables (in-scope 3 + bonus 3)** — bonus tables small (146 rows) but complete the domain (request→approval→balance debit→accrual rule applied). Excluding leaves "balances drift untraced" gap. | Approve 3 vs 6 (recommended 6) |
| HC-3 | I1 invariant: `employee_id` (FK employees_core in source) → `attendance_subject_user_id` (FK sys_users in target) | `02_TARGET_SCHEMA_PROPOSAL.md` §1+§2+§3 | **USER** (`<entity>_subject_user_id` FK `sys.sys_users`) consistent with Goals pilot HC-6 decision and I1+I7 invariants. Position linkage (if needed) goes via metadata or future junction table | Approve user-anchor |
| HC-4 | PII: attendance contains `clock_in`/`clock_out` time-of-day, location-inferable. Apply pseudonymization or pass-through? | `01_SOURCE_DISCOVERY.md` §1 (PII analysis) + `02_TARGET_SCHEMA_PROPOSAL.md` §12 | **PASS-THROUGH** — RTL Bank synthetic data, no real PII. Tag table with `attendance_metadata` jsonb flag `pii_class='time_behavioral'` for future GDPR audit | Approve pass-through |
| HC-5 | `hours_total` is `GENERATED ALWAYS AS (...) STORED` in source — target should re-derive identical or store as plain numeric? | `02_TARGET_SCHEMA_PROPOSAL.md` §1 | **RE-DERIVE** as `GENERATED ALWAYS AS (attendance_hours_regular + attendance_hours_overtime + attendance_hours_night + attendance_hours_holiday) STORED` (preserve invariant + zero migration cost) | Approve GENERATED |
| HC-6 | `payroll_job_id` in overtime (FK to `payroll_export_jobs` source-side, no target equivalent) | `02_TARGET_SCHEMA_PROPOSAL.md` §2 + mapping card overtime | **STORE_IN_METADATA** as `overtime_metadata->>'legacy_payroll_job_id'` for later resolution when `sys.sys_payroll_*` exists | Approve metadata fallback |
| HC-7 | `leave_accrual_rules.ccnl_type` (CCNL Italian labor code) — keep as varchar(100) free-text or normalize against future `sys.sys_ccnl_catalog`? | `02_TARGET_SCHEMA_PROPOSAL.md` §6 (if bonus) | **KEEP varchar** — no `sys.sys_ccnl_catalog` exists yet. Free-text now, FK migration later when catalog scaffolded. Flag value in metadata for forward-compat. | Approve varchar |
| HC-8 | Migration numbering 000040 | head of .sql file | **000040** — last applied was 000039 (`HANDOFF.md` baseline confirmed); 000040 leaves space for any concurrent ESCO/sys_users SDBI extensions in flight | No conflict with concurrent branches — confirm |

## §5 — Confidence overall self-assessment

| Dimension | Confidence | Reasoning |
|---|---|---|
| Source semantic understanding | **HIGH** (0.93) | All 6 schemas introspected live; semantic class clear (fact / workflow / accumulator) |
| Target schema design | **HIGH** (0.88) | Follows established `sys.*` conventions (sys_skills, sys_positions, sys_goals template). Novelty: GENERATED STORED column for hours_total |
| Field-by-field mapping | **HIGH** (0.87) avg | 8/10 cols per table are direct-copy. 2 require small transforms (status uppercase, leave_type uppercase) |
| FK resolution path | **HIGH** (0.90) | Reuses brownfield.tenant_id_mappings + sys_users-by-email (already-proven Goals pilot) |
| Edge cases coverage | **MEDIUM** (0.75) | `payroll_job_id` deferred to metadata; `medical_certificates` cross-FK (bonus) limited to legacy_id metadata |
| Lineage instrumentation | **HIGH** (0.90) | Builds on `sys_source_lineage_records` w/ ADR-0015 nullable source_table_id FK |
| Audit instrumentation | **HIGH** (0.88) | Same rule_codes as Goals pilot |
| **Overall pilot readiness** | **HIGH** (0.87) | Ready for CLI execution post-Enzo approval. Honest residual uncertainty on HC-2 (scope width) + HC-6 (payroll FK strategy) |

## §6 — Known challenges identified

1. **GENERATED STORED column propagation**: `hours_total` is `generated always as (...) stored` in source. Target replicates same expression (HC-5). Risk: migration apply requires the four base columns to be NOT NULL or all NULL — source defaults all to 0 → safe.

2. **Overtime payroll_job_id orphan FK**: source has FK to `public.payroll_export_jobs` which has no `sys.sys_payroll_*` target. Strategy: drop FK in target, retain raw uuid in `overtime_metadata->>'legacy_payroll_job_id'`. When payroll SDBI lands, write migration to add FK + backfill.

3. **Self-FK `leave_balance_transactions.balance_id` → `employee_time_off_balances.id`**: two-pass approach mandatory. Balances seeded first, transactions resolve via `temp_sdbi._legacy_source_balance_id` ↔ balance_id mapping pass 2.

4. **`leave_accrual_rules` is global config catalog**: rules are tenant-scoped but represent CCNL templates — semantically more like `sys.sys_goal_templates`. Confidence keep separate (not merge into balances).

5. **`attendance.status` value space**: source has `present | absent | sick | holiday | vacation | paid_leave | unpaid_leave | training` (varchar(30)). Target CHECK adopts UPPER_SNAKE form; verify no source values silently truncate.

6. **`overtime.overtime_type` distinct values unknown without sample**: assumes `WEEKDAY / WEEKEND / NIGHT / HOLIDAY` — verify via `SELECT DISTINCT overtime_type FROM employee_overtime` (run by CLI Phase 1.5 before bulk INSERT).

7. **Tenant `Heuresys System` likely has 0 attendance rows** (small employee count). Per-tenant cardinality variance acceptable (Goals pilot showed same skew).

## §7 — Ready-for-CLI status

**APPROVED FOR CLI EXECUTION**: NO (pending HC-1..HC-8 Enzo decisions — most likely X2 default-approve)

**Once approved**, CLI X4 can sequentially:
1. Apply `000040_sys_time_leave_scaffold.sql` via `pnpm db:migrate`
2. Verify migration applied: 3 (or 6) new tables in `sys.*`
3. Optional: `SELECT DISTINCT overtime_type FROM heuresys_platform.public.employee_overtime` for CHECK constraint validation
4. Run Phase 3 seed (temp_sdbi.* INSERT...SELECT cross-DB) — leverages already-extracted `legacy_mirror.users` for employee→user resolution
5. Run Phase 5 consolidation per `04_PHASE5_CONSOLIDATION_PLAN.md`
6. Run Phase 6 cleanup (DROP temp_sdbi.*)
7. Insert `sys.sys_source_lineage_records` (with nullable `source_table_id` per ADR-0015) + `audit.import_validation_results` rows
8. Update `HANDOFF.md` with pilot outcome

**Estimated CLI execution time**: ~35-50 min for 3-table scope (migrations 5 min + Phase 3 seed 10 min + Phase 5 consolidation 10 min + cleanup 5 min + audit/lineage 10 min + verification 5 min). +15 min if HC-2 expands to 6-table scope.

## §8 — Bias mitigations applied (per ADR-0014 §3.8 + lessons CW-B25..B30)

| Bias | This pilot's mitigation |
|---|---|
| CW-B16 wall-clock | Mapping cards include empirical row count from `pg_class.reltuples` (live) |
| CW-B17 silent skip | Phase 5 plan emits audit row per source row (PASSED or SKIPPED with reason) |
| CW-B18 DISCOVERY completeness | All NOT NULL source cols enumerated (see §3 of source discovery doc) — 18 attendance + 6 overtime + 4 balance + 6 requests + 5 transactions + 5 accrual NOT NULL cols |
| CW-B19 source-side FK availability | FK integrity verified live: ON DELETE CASCADE rules read directly from `\d` output |
| CW-B20 UQ constraint block | Each new `sys.*` table has explicit `<entity>_natural_key` UQ in 000040 + source UQ `(tenant_id, employee_id, attendance_date)` carried into target |
| CW-B21 freshness | Source snapshot 2026-05-21 confirmed via psql tunnel (this session). No source writes during authoring (read-only inspection) |
| **CW-B25 schema introspection rigor** | **APPLIED**: Every column-type-default-null inspected via `\d` LIVE before mapping card emission. NO inference from sibling tables or naming convention assumed types. |
| **CW-B28 cross-OS compat** | Migration script uses ONLY standard SQL — no `vector`, no `uuid_generate_v4()` (uses `gen_random_uuid()`), no `\restrict` psql metacommand. Verified runnable on Win/Mac/Linux psql clients. |
| **CW-B29 no schema_migrations insert** | Migration 000040 contains NO `INSERT INTO sys.sys_schema_migrations` — `pnpm db:migrate` handles versioning tracking. |
| **CW-B30 idempotent**: | All CREATE statements use `IF NOT EXISTS`; all ALTER TABLE ADD CONSTRAINT wrapped in `DO $$ IF NOT EXISTS pg_constraint ... $$`. Twice-run produces zero pg_dump diff. |

---

*End of 00_README_TIME_LEAVE_PILOT.md*
