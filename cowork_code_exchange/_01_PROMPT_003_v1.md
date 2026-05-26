# _01_PROMPT_003_brownfield-seeding-complete.md

**Protocol phase:** PROMPT (supervisor → executor)
**Goal ID:** 003
**Slug:** brownfield-seeding-complete
**Created:** 2026-05-19T13:35:00+02:00, by Cowork Desktop
**Target executor:** Claude Code CLI on Windows (DESKTOP-KH728P2)
**Predecessor artefacts:**
- `_00_DISCOVERY_003_brownfield-seeding-complete.md` (facts; READ FIRST)
- `_05_REVIEW_002_*.md` (Goal 002 closure context + CW-B13 lesson)
- `_04_REPORT_002_*.md` (technical state inherited)
- `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` (4-wave canonical reference)
- `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md`

---

## ⚠️ CRITICAL — Anti-pattern guard (NON-NEGOTIABLE, per Enzo direttiva 2026-05-19)

**Goal 003 closes the entire brownfield seeding pipeline (Waves 1+2+3+4) to a state declarable "DBMS ready for functional development". This is a single, monolithic goal.**

The following patterns are **PROHIBITED** in EXEC and REPORT:

1. **NO scope reduction**. If a sub-task surfaces during EXEC, you do not drop it. You either solve it within budget or halt+escalate (which requires PLAN amendment from Cowork — see escalation policy §6 below). You do not silently defer.

2. **NO partial closure proposal**. REPORT 002 v1 §7 used "REVIEW + accept Goal 002 PARTIAL closure" as an exit path. That option is NOT AVAILABLE for Goal 003. The acceptance criteria §2.6 are all-must-pass; partial = REJECTED + interim REPORT + you continue.

3. **NO "outside Goal X scope"** disclaimer. The Goal 003 PROMPT is comprehensive. If the scope contains a gap that you discover mid-EXEC, that gap is YOURS to close (per the protocol's executor accountability). Surface the discovery transparently per E1+E2 patterns, propose a fix in chat, get unblocked, continue.

4. **NO Goal 004/005 deferral**. There is no Goal 004 planned. If you find yourself drafting Goal-004-recommendations in REPORT §6, stop — you're proposing scope reduction. Document the work AS PART OF Goal 003 completion.

5. **NO early exit**. EXEC closure requires all 4 waves at the volume thresholds in §2 below. Reaching the turn budget cap without closure → halt + escalate, not partial REPORT.

These guards exist because Goal 001a v4→v5 + Goal 002 partial closure demonstrated that even well-disciplined executors gravitate toward partial closure when the scope is large. Goal 003 inverts that gravity: the closure-or-halt rule is the only path.

---

## ⚠️ CRITICAL — Protocol rule for this turn

**Your output for this turn MUST be `_02_PLAN_003_brownfield-seeding-complete.md`, not execution.**

PLAN-only this turn. After Cowork persists `_02b_APPROVAL_003.md` matching your PLAN sha256, then you start EXEC.

Do NOT touch DB, do NOT run tests, do NOT modify source files. Output is markdown only.

---

## §1 — Verified facts (inherited from DISCOVERY 003)

### 1.1 — Current state

- Wave 1: 94 mappings APPROVED, 8/15 sys.* targets at volume, 7/15 empty (DISCOVERY §2.2)
- LOOKUP_FK semantic gap: 38/49 mappings affected (`legacy_<X>_id` patterns) — DISCOVERY §2.3
- Wave 2/3/4: 0 mapping registry rows + `brownfield.tenant_id_mappings` table doesn't exist
- Migration 000031 + pg_stat_statements: active per Goal 002 Cowork-side actions

### 1.2 — Volume targets (DISCOVERY §4)

- Wave 1: every APPROVED mapping → ≥1 lineage row per non-empty source table; every target sys.* with ≥1 row OR documented "source empty in legacy_mirror"
- Wave 2: 4 tenants populated + RTL_BANK organization_units + blueprint_variants + KPI_definitions
- Wave 3: 270 employees + 274 users + assignments + skill evidence + learning evidence for RTL_BANK
- Wave 4: career_paths + succession_pools + ≥1 talent_score/user — PARTIAL acceptable if Wave 3 baseline solid

### 1.3 — Cross-check rule U-2026-05-19-01 (enforcement)

Any new `(target_table, match_on)` payload for LOOKUP_FK MUST pass payload-vs-schema cross-check BEFORE EXEC. Invalid mappings block the wave until corrected.

---

## §2 — Problems to solve in this goal (interlocked, single closure required)

### Problem 1 — LOOKUP_FK semantic compiler fix

Resolve the 38 affected mappings:

- **33 `legacy_tenant_id → sys_tenancies`**: convention to apply: lookup via `tenant_metadata->>'legacy_id'` if `tenant_metadata` jsonb contains `legacy_id` key (EXEC step 0 verifies this); else fallback to `tenant_code` deterministic mapping via `brownfield.tenant_id_mappings` (which Goal 003 creates per Problem 5).
- **5 `legacy_user_id → sys_users`**: analogous pattern with `user_metadata->>'legacy_id'`.

Implementation: extend `transform-compiler.ts::LOOKUP_FK` case to recognize the `legacy_<X>_id` pattern and emit the jsonb-lookup SQL. The whitelist regex from Goal 002 PLAN §2.4.1 extends to cover this third form.

### Problem 2 — Wave 1 volume gap closure

After Problem 1 is fixed, the 7 empty Wave 1 targets must populate (subject to source data availability). Investigate per-target:

- `sys_skill_categories, sys_skill_taxonomy_edges, sys_skill_aliases, sys_learning_path_steps, sys_skill_learning_mappings`: their source tables (legacy_mirror.*) likely have data — verify and fix any blocking issues.
- `sys_activity_classifications`: had 2 CHECK constraint violations in Goal 002. Decide and apply: either fix legacy values or relax CHECK constraint. (This may require migration 000032; allowed for Goal 003 only on `sys_activity_classifications_*_check`).
- `sys_job_roles, sys_process_kpi_templates`: investigate empty state.

Goal: every Wave 1 target has rows OR has documented "source-empty" justification.

### Problem 3 — Type-coerce auto-wrap completeness

REPORT 002 §3.5 mentioned 2 mappings failing on `smallint` because transform is `CAST_INT` (not in DIRECT_COPY/TRIM auto-wrap). Extend Item E from Goal 002 to recognize ALL `CAST_*` transforms as eligible for auto-wrap when target type matches the CAST type. Test coverage extension required.

### Problem 4 — Migration 000032 (if needed for Problem 2 sys_activity_classifications CHECK)

If you decide to relax the CHECK constraint (Problem 2), write migration 000032 with: backup the current CHECK definition + relaxed CHECK + comment explaining the relaxation. Apply via SSH on VM with backup gate. Idempotent + reversible.

### Problem 5 — `brownfield.tenant_id_mappings` table creation (migration 000033)

Per `BROWNFIELD_IMPORT_PLAN.md` §4.1, Wave 2 requires this table:

```sql
CREATE TABLE brownfield.tenant_id_mappings (
  legacy_id varchar PRIMARY KEY,
  canonical_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id),
  notes text,
  created_at timestamptz DEFAULT now()
);
```

Populate from legacy_mirror.tenants (or analog) — 4 tenants total. Migration 000033 is mandatory for Goal 003.

### Problem 6 — Wave 2 mapping registry authoring + execution

Wave 2 (~80 source tables → tenant operating model). Per BROWNFIELD_IMPORT_PLAN §4.1 source domains: DGOV root + OPOURSKA (36 tables) + INDOOR (3) + GOKMER (37) + PROGOV (11) + RBP (6) + ITLAB (2) + PET (2).

Tasks:
- Discover source tables via `SELECT table_name FROM information_schema.tables WHERE table_schema='legacy_mirror'`
- Cross-reference with TARGET_SCHEMA_DESIGN.md to identify target sys.* per source
- Author ~80 `brownfield.table_mappings` rows + ~80 sets of `brownfield.column_mappings` rows
- Each LOOKUP_FK payload passes cross-check U-2026-05-19-01 BEFORE registration
- Author `db/migrations/000034_brownfield_wave2_staging.sql` (analog to 000030) for 80 staging tables
- Trigger Wave 2 run + verify acceptance per BROWNFIELD_IMPORT_PLAN §4.4

Volume target: 4 tenants + RTL_BANK organization_units (at least 10) + blueprint_variants + KPI_definitions populated.

### Problem 7 — Wave 3 mapping registry authoring + execution

Wave 3 (~50 source tables → demo person data). Per BROWNFIELD_IMPORT_PLAN §5.1 source domains: RBP·DGOV `users` + H2R (18 tables) + SKILGRO (6 tables) + GOKMER (performance_reviews, check_ins).

Tasks:
- Author ~50 `brownfield.table_mappings` + column_mappings
- Wave 3 specific: every imported user row gets `user_is_synthetic=true` + `user_type='SYNTHETIC_REFERENCE'`
- Out-of-scope columns per I8 (payroll, medical, attendance, benefits, bank): filter out at mapping level
- Author `db/migrations/000035_brownfield_wave3_staging.sql`
- Trigger Wave 3 run + verify per BROWNFIELD_IMPORT_PLAN §5.5

Volume target: 270 employees + 274 users with auth credentials regenerated (placeholder hash + `must_rotate=true`) + assignments + skill evidence + learning evidence for RTL_BANK at minimum.

### Problem 8 — Wave 4 mapping registry authoring + execution

Wave 4 (~58 source tables → advanced intelligence). Per BROWNFIELD_IMPORT_PLAN §6.1 source domains: TALPIPE (27) + PULSAR (29) + SMERTO (1) + EPRA subset (1).

Tasks:
- Author ~58 `brownfield.table_mappings` + column_mappings
- Per §6.2: career path steps form valid sequence; succession pool references critical position; talent scores in [0..1]; compensation profile NEVER stores amounts (only band assignment)
- Author `db/migrations/000036_brownfield_wave4_staging.sql`
- Trigger Wave 4 run + verify per BROWNFIELD_IMPORT_PLAN §6.4

Volume target: career_paths + ≥1 talent_score per user + succession_pools populated for RTL_BANK.

### Problem 9 — Goal 002 hygiene piggyback (per REPORT 002 §6 items 4 + 5)

- 681 pre-existing NULL `source_lineage_import_run_id` rows: decide policy (retain vs purge) and apply. Recommend: retain as documented pre-history (since the FK is `NULL` not invalid).
- TYPE_CAST_MAP completeness (Item E from Goal 002): extend to all PG basic types per Problem 3.

### Problem 10 — Final acceptance verification + REPORT 003

- Full re-run of waves 1+2+3+4 in sequence (single execution session) with audit trail PERSISTED.
- Author REPORT 003 with verbatim verification of every acceptance criterion §2.6.
- No partial closure path — REPORT 003 either has all ✅ or you halt+escalate before submitting it.

---

## §3 — Out of scope for Goal 003

ONLY these are explicitly out-of-scope:

- ANY changes to `apps/web/` (frontend untouched)
- ANY changes to migrations 000001-000031 (frozen; new migrations 000032+ allowed per Problems 4/5/6/7/8 only)
- ANY changes to `legacy_mirror.*` (immutable source proxy)
- MFA UI, npm publish, brand identity — gated to other workstreams
- Real data anonymization (legacy is demo, no PII protection layer per I12 + ADR-0011 Wave 3 protocol)
- React Flow / Mermaid renderers (gated brand identity)

Everything brownfield-import-related IS in scope. If a sub-issue emerges that you're tempted to call out-of-scope, re-read §"Anti-pattern guard" above.

---

## §4 — Constraints

### 4.1 — Code change boundaries

May modify:
- `apps/api/src/modules/brownfield-wave-executor/**` (all files including transform-compiler.ts, upsert-sql.ts, engine.ts)
- `apps/api/test/**` (test extensions)
- `scripts/run-wave1-fullscale.mjs` → may generalize to `scripts/run-wave-fullscale.mjs <wave>` covering all 4 waves
- NEW: `db/migrations/000032_*.sql` through `000036_*.sql` (one per allowed migration)
- NEW: `db/seeds/brownfield/wave{2,3,4}/*.sql` for new mapping registry seeds

May NOT modify (per §3 out-of-scope):
- migrations 000001-000031
- legacy_mirror schema
- apps/web/**

### 4.2 — DB write boundaries

ALL writes allowed within `heuresys_advanced` DB except:
- `legacy_mirror.*` (immutable)
- `brownfield.table_mappings` UPDATE/DELETE of existing wave=1 rows (Wave 1 registry is frozen — INSERT new rows for Wave 2/3/4 OK)
- `sys.sys_schema_migrations` direct manipulation (use migrate scripts)

### 4.3 — Test boundaries

- `pnpm test` continues to pass at ≥289 + new tests for Wave 2/3/4 (estimated +30 tests minimum across waves)
- Adversarial fixtures for new LOOKUP_FK convention added to transform-compiler.test.ts
- Idempotency test extended to cover all 4 waves OR new per-wave idempotency tests added
- Wave 1+2+3+4 end-to-end test via the generalized `run-wave-fullscale.mjs` script

### 4.4 — Operational boundaries

- Backup gate: fresh pg_dump pre-Goal-003 verified at EXEC step 0 (auto-create if mtime > 6h)
- Per-wave backup: pg_dump between Wave 1 close and Wave 2 start (recovery point if Wave 2 corrupts data)
- Migration application: via existing `db/scripts/migrate.{sh,ps1}` pattern; CLI runs from Windows or applies via SSH
- Turn budget: **80 turns**, escalation at turn **76** if Wave 4 not entering final verification
- Per-wave commit checkpoint: each wave closure = atomic commit + smoke test BEFORE moving to next wave
- Git push at the end of EXEC (not per-commit) to avoid churn on origin

---

## §5 — Required structure of `_02_PLAN_003_*.md`

### §-1 — Standing lessons inherited

Include lessons from Goal 001a v5 PLAN §-1 + Goal 002 PLAN §-1 PLUS:

- **L7 (NEW, from Goal 002 closure)**: payload-vs-schema cross-check (U-2026-05-19-01) MUST run before any LOOKUP_FK mapping registration; runtime semantic gaps surface at full-scale execution, not at unit test.
- **L8 (NEW, from Enzo direttiva 2026-05-19)**: scope-reduction is not an option; halt+escalate is the only allowed pause primitive.

### §0 — Executive summary (max 12 lines, plain English)

### §1 — Vocab / state reference (inherited from DISCOVERY 003)

### §2.1 — Baseline capture plan (EXEC step 0 — ~10-12 measurements)

Including: pnpm test baseline, source SHAs, DB state per-wave (sys.*, legacy_mirror.* counts), migration status, pg_stat_statements reset, U1 (tenant_metadata schema check), U2 (Wave 2 sources vs targets gap), U3 (verify RTL_BANK_REFERENCE present), backup mtime, idempotency baseline.

### §2.2 — Code change plan (per problem, ordered by dependency)

Items A-K covering Problems 1-10 above. For each: file, current state, intended change, risk class, test coverage. Order:
1. Item A — LOOKUP_FK semantic fix (Problem 1)
2. Item B — Type-coerce CAST_* generalize (Problem 3)
3. Item C — Migration 000032 if needed (Problem 4)
4. Item D — Migration 000033 tenant_id_mappings (Problem 5)
5. Item E — Wave 2 mapping registry seed (Problem 6.1-6.3)
6. Item F — Migration 000034 + Wave 2 execution (Problem 6.4-6.5)
7. Item G — Wave 3 mapping registry seed (Problem 7.1-7.3)
8. Item H — Migration 000035 + Wave 3 execution (Problem 7.4-7.5)
9. Item I — Wave 4 mapping registry seed (Problem 8.1-8.3)
10. Item J — Migration 000036 + Wave 4 execution (Problem 8.4-8.5)
11. Item K — Goal 002 hygiene (Problem 9)
12. Item L — Final verification + REPORT (Problem 10)

### §2.3 — DB write plan (per object, per wave)

### §2.4 — Injection safety design (CRITICAL — extension for new LOOKUP_FK pattern + Wave 2/3/4 payloads)

The new `legacy_<X>_id` convention requires explicit SQL emission pattern; document with adversarial fixtures.

### §2.5 — Per-wave execution design

Sequencing: Wave 1 closure → backup → Wave 2 → backup → Wave 3 → backup → Wave 4 → final verification. Halt-gate between waves: if a wave's acceptance criteria fail, halt + escalate, don't proceed to next.

### §2.6 — Acceptance criteria (ALL must pass; no partial closure allowed)

Minimum criteria. You may add more, but every §2.2 Item must map to ≥1 criterion AND vice versa (G11).

#### Wave 1 closure
- A1-W1 `pnpm test` ≥289 + new tests, 5 skipped same env-gate
- A2-W1 LOOKUP_FK semantic fix tests including 5+ adversarial fixtures (Problem 1)
- A3-W1 Type-coerce CAST_* extension tests (Problem 3)
- A4-W1 Wave 1 full-scale re-run: every APPROVED mapping has ≥1 successful upsert OR documented source-empty exception
- A5-W1 Every Wave 1 sys.* target has rows OR audit note "source_empty_in_legacy_mirror"
- A6-W1 sys_activity_classifications: 0 CHECK violations post-Problem-4 fix
- A7-W1 0 `SKIPPED_UNSUPPORTED_TRANSFORM_V1` audit rows for Wave 1 run

#### Wave 2 closure
- A8-W2 `brownfield.tenant_id_mappings` table exists with 4 tenants (migration 000033)
- A9-W2 ~80 Wave 2 table_mappings + column_mappings registered, all U-2026-05-19-01-validated
- A10-W2 Migration 000034 applied (Wave 2 staging tables)
- A11-W2 Wave 2 full-scale run: state=COMPLETE, audit PERSISTED
- A12-W2 sys.sys_tenancies has 4 rows; sys.sys_organization_units ≥10 for RTL_BANK; sys.sys_kpi_definitions populated

#### Wave 3 closure
- A13-W3 ~50 Wave 3 mappings registered + U-validated
- A14-W3 Migration 000035 applied
- A15-W3 Wave 3 full-scale run: state=COMPLETE
- A16-W3 sys.sys_users: 274 rows with `user_is_synthetic=true` + `user_type='SYNTHETIC_REFERENCE'`
- A17-W3 sys.sys_user_position_assignments: ≥270 rows (1+ per employee)
- A18-W3 PII safety: 0 rows with `user_email` matching real-corp-domain patterns; 0 metadata containing `fiscal_code`/`iban`/etc.

#### Wave 4 closure
- A19-W4 ~58 Wave 4 mappings registered + U-validated
- A20-W4 Migration 000036 applied
- A21-W4 Wave 4 full-scale run: state=COMPLETE
- A22-W4 sys.sys_career_paths populated; ≥1 talent_score per user; sys_succession_pools populated for RTL_BANK
- A23-W4 sys.sys_position_compensation_profiles has 0 rows with `compensation_amount_min/max` (band assignment only per §6.2)

#### Cross-wave
- A24 0 `audit.import_validation_results.skip_reason='no_conflict_inference_available'` across all 4 waves
- A25 `pnpm test` final: ≥320 passing (estimated +30 tests added across waves)
- A26 typecheck PASS, lint 0 errors throughout
- A27 ≥20 atomic commits attributable to Goal 003 (one per Item + per-wave checkpoint)
- A28 REPORT 003 has verbatim evidence for ALL 27 criteria above with SHA-anchored timestamps

### §2.7 — Turn budget breakdown (80 cap, escalation at 76)

Honest per-Item allocation. If estimate > 80, declare in §2.7 and propose either (a) reduce scope (NOT ALLOWED per anti-pattern guard), (b) ask Cowork for higher cap, or (c) split waves to a follow-up — escalation conversation only, no silent partial.

### §2.8 — Risk register

Top 8 risks (more than usual given scope). Examples:
- R1 LOOKUP_FK semantic mismatch on `legacy_<X>_id` resolution
- R2 Wave 2/3/4 mapping discovery misses canonical targets
- R3 Wave 3 PII safety check fails on some legacy demo data
- R4 Per-wave wall-clock budget overrun (cumulative >60min)
- R5 Migration apply on cluster causes lock contention with concurrent test runs
- R6 Cross-tenant FK violations during Wave 2 org_units import
- R7 sys_user_position_assignments unique constraint conflict (>1 PRIMARY ACTIVE per user)
- R8 audit.import_validation_results table size growth (~1M rows expected)

### §2.9 — Rollback plan (per wave + per migration)

Per-wave: pg_restore from pre-wave backup. Per migration: DROP / inverse DDL.

### §2.10 — Architectural advisory (decisions deferred to Cowork)

Sub-decisions you encounter but don't decide unilaterally. E.g., "compensation profile band-assignment convention if legacy uses amount, suggest mapping to nearest band; OR ask Cowork".

### §2.11 — G11 cross-check matrix

Mechanical bidirectional verification per Goal 001a v5 + Goal 002 v1 pattern.

---

## §6 — Escalation policy (CRITICAL)

Halt + escalate ONLY for these cases:

- (a) U-2026-05-19-01 cross-check fails on > 5% of new mappings — registry semantic ambiguity exceeds your ability to resolve via documented conventions
- (b) Turn budget hits 76 (escalation threshold) and Wave 4 not entered final verification — propose budget extension OR honest acknowledgment that Goal 003 was over-scoped at PROMPT time
- (c) Source data quality issue blocks ≥1 wave entirely (e.g., legacy_mirror.users empty when Wave 3 needs 274 users)
- (d) Architecture decision required (e.g., schema extension needed for a target that has no current sys.* analog)

Halt format:
1. Update STATE 003: `current_phase: HALT`, `halt_reasons: [...]`, `next_actor: Cowork`
2. Emit `exec_halt` inbox message to Cowork with summary
3. Wait. Do NOT propose partial closure.

---

## §7 — After you write `_02_PLAN_003_*.md`

1. Save PLAN at `cowork_code_exchange/_02_PLAN_003_brownfield-seeding-complete.md`
2. Compute sha256
3. Update `_00_STATE_003.md`: `current_phase: PLAN`, `plan_version: v1`, `plan_sha256: <sha>`, `next_actor: Cowork`
4. Emit `plan_ready` in `.inbox/cowork/pending/` via `pnpm cowork:notify cowork plan_ready --goal 003`
5. Stop. Wait for `_02b_APPROVAL_003.md` to appear

Honest budget summary in chat: if your honest estimate exceeds 80 turns, raise it in the PLAN §2.7 + chat — do NOT silently absorb. Better to escalate scope debate at PLAN-time than mid-EXEC.

---

## §8 — Hard guard-rails for THIS PROMPT turn

1. **NO code changes** during PROMPT turn
2. **NO DB writes** (read-only diagnosis OK in PLAN baseline §2.1 design, but execute at EXEC step 0)
3. **NO test execution**
4. **NO git operations** except read-only (log/status/diff for §2.9 design)
5. **NO new SSH tunnels**
6. **No secrets in PLAN**
7. PLAN is markdown-only artefact

---

*End of _01_PROMPT_003_brownfield-seeding-complete.md*
