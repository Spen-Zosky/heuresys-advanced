# _01_PROMPT_001_audit_upsert_refactor.md

**Protocol phase:** PROMPT (supervisor → executor)
**Goal ID:** 001
**Slug:** audit-upsert-refactor
**Created:** 2026-05-18, by Cowork (supervisor)
**Target executor:** Claude Code CLI on Windows (DESKTOP-KH728P2)
**Predecessor artefacts:**
- `D:\heuresys-advanced\MIGRATION_STATUS_2026-05-18.md` (Phase 1 forensic baseline, committed at `93e1830`)
- `D:\heuresys-advanced\GOAL_B_REPORT_2026-05-18.md` (Goal B reconciliation, committed at `fc0228b`)
- `D:\heuresys-advanced\HANDOFF.md` (row D reconciled, committed at `fc0228b`)

---

## ⚠️ CRITICAL — Protocol rule for this turn

**Your output for this turn MUST be `_02_PLAN_001_audit_upsert_refactor.md`, not execution.**

This is the first phase of the `cowork_code_exchange/` opt-in protocol (regola 13 of `~/.claude/CLAUDE.md`):
- This file (`_01_PROMPT_001_*`) defines the task scope.
- Your next deliverable (`_02_PLAN_001_*`) is the **detailed execution plan**, written but **not executed**.
- After Cowork reviews and explicitly approves the PLAN in chat ("PLAN 001 approved, proceed with EXEC"), then and only then you produce `_03_EXEC_001_*` (action log) and `_04_REPORT_001_*` (closure report).

**Do NOT** start refactoring code in this turn. Do NOT touch the DB. Do NOT run tests. Do NOT execute prisma commands. The output of this turn is a **markdown planning document only**, saved at `D:\heuresys-advanced\cowork_code_exchange\_02_PLAN_001_audit_upsert_refactor.md`.

If you find yourself wanting to "just do a quick verification" or "just run the test once to see the current baseline" — **STOP**. Any verification must be itemized in the PLAN and approved before execution. The PLAN can include a "baseline measurement phase" as its first step, but that step is executed in EXEC, not in this turn.

---

## Task scope (verified state as of 2026-05-18 post-Goal-B)

The brownfield Wave 1 pipeline (`apps/api/src/modules/brownfield-wave-executor/`) is functionally blocked at full scale and architecturally incomplete on durability/audit. Three interlocking problems must be solved together because they cannot be verified in isolation:

### Problem 1 — JS-side UPSERT OOM at full scale (MIGRATION_STATUS §8.A blocker #1)

The executor's `executeUpsert()` performs per-row JS allocations for the UPSERT phase (after the SQL-side staging refactor at commit `306263b` eliminated the load-side bottleneck). On the 47k-row full Wave 1 dataset, this produces heap exhaustion at ~12-20 minutes into the UPSERT phase (per HANDOFF row D + claude-mem obs 10467 / befreixjk run).

Required transformation: rewrite `executeUpsert()` to perform SQL-side `INSERT … SELECT … FROM staging.wave1_<target> JOIN brownfield.column_mappings ON … ON CONFLICT (<natural_key>) DO UPDATE …`, with the SELECT list dynamically generated from `brownfield.column_mappings.column_mapping_transform` rows. The transform vocabulary (CAST, LOOKUP_FK, COPY, DEFAULT, REGEX) must be compiled to PG SQL fragments. The same staging-side pattern (commit `306263b`) demonstrates this approach is viable.

### Problem 2 — Audit machinery does not persist (MIGRATION_STATUS §8.A blocker #2 + high #3)

Three audit tables exist in schema `audit.*` but are empty even after "successful" debug-scale runs:
- `audit.import_run_logs` (state transitions)
- `audit.import_validation_results` (per-row validation outcomes)
- `audit.import_approval_decisions` (gate decisions)

Additionally, `brownfield.import_runs.import_run_status` shows a single row stuck `RUNNING` since 2026-05-16, because the executor's state machine maintains state in-memory but only writes the initial INSERT — subsequent transitions (RUNNING→VALIDATING→APPROVED→UPSERTING→COMPLETE / FAILED) are never UPDATE-ed back. The `failure_reason` column is consequently always NULL even on FAILED runs.

Required transformation: wire every state transition to write through to `brownfield.import_runs.import_run_status` AND emit a corresponding `audit.import_run_logs` row. Validation outcomes from the existing validation pass must write to `audit.import_validation_results`. Approval gate decisions must write to `audit.import_approval_decisions`. On any FAILED transition, `failure_reason` MUST be populated with a structured payload (error class, message, stack frame head, offending row identifier if applicable).

### Problem 3 — Lineage rows orphaned (GOAL_B_REPORT §6 item 1)

All 52 rows in `sys.sys_source_lineage_records` have `source_lineage_import_run_id = NULL`. Discovered in Goal B'. The executor produces lineage records but never sets the FK back to the originating `brownfield.import_runs` row.

Required transformation: in the same UPSERT refactor (Problem 1), every lineage insert must include `source_lineage_import_run_id = :current_run_id`. Optionally (decision deferred to PLAN): backfill the existing 52 NULL rows to the stuck `67d51a90-7ad9-44e2-860d-0d2e0e945af8` run (the only `import_runs` row that exists), or alternatively transition that stuck row to FAILED with `failure_reason='STALE: pre-refactor in-memory state'` and leave the 52 lineage rows NULL as documented "pre-history". The PLAN should propose one of these two paths, with rationale.

---

## Out of scope for Goal A

The PLAN must explicitly mark these as out-of-scope to prevent scope creep:

- Wave 2 / 3 / 4 mapping discovery (deferred to future Goal C)
- Legacy `evo_heuresys` DB restore (deferred to future Goal D, only if forensic parity needed)
- `npm publish`, MFA enroll UI, graph renderers (MVP-3 deferred items per HANDOFF rows B, E-UI, F)
- Any changes to migrations 000001-000030 (schema is frozen at the bootstrap window 2026-05-18 01:39-01:40 UTC)
- Any changes to `sys.*` schema definitions or constraints
- Any changes to `legacy_mirror.*` (treated as immutable canonical source proxy)

---

## Constraints — these define the boundaries of any acceptable PLAN

### Code change boundaries

The PLAN may propose changes to files in these paths:
- `apps/api/src/modules/brownfield-wave-executor/**` (engine, validators, transforms, types)
- `apps/api/src/modules/brownfield-wave-executor/__tests__/**` (test updates if interfaces change)
- `db/scripts/extract-wave1-legacy.sh` if needed (unlikely)
- One new file allowed: a transform-compiler module if it warrants extraction

The PLAN must NOT propose changes to:
- `prisma/schema.prisma` (introspection is fine, schema is owned by migrations)
- Any file under `apps/api/src/modules/` other than `brownfield-wave-executor/`
- Any file under `apps/web/` (UI is out-of-scope)
- Any migration file in `db/migrations/`

### DB write boundaries

The PLAN must specify exactly which DB objects will be written, and confirm these are limited to:
- `audit.import_run_logs` (INSERT only, no UPDATE)
- `audit.import_validation_results` (INSERT only)
- `audit.import_approval_decisions` (INSERT only)
- `brownfield.import_runs` (UPDATE on existing rows for state transitions; INSERT for new runs initiated during testing)
- `staging.wave1_*` (any DDL/DML the engine already does — unchanged semantics)
- `sys.sys_source_lineage_records` (INSERT during UPSERT phase; optional one-time UPDATE for backfill if PLAN chooses that path)
- `sys.*` target tables (INSERT/UPDATE via the new SQL-side UPSERT — semantically identical to the current JS-side path)

The PLAN must NOT propose writes to:
- `legacy_mirror.*` (immutable)
- `brownfield.{column_mappings, source_columns, source_tables, table_mappings, source_exports}` (registry, frozen)
- `sys.sys_schema_migrations` (controlled by `db/scripts/migrate.{sh,ps1}`)
- Any other table not in the allowlist above

### Test boundaries

The PLAN must specify an acceptance test strategy that includes:
- The existing `pnpm test` suite must continue to pass at ≥218/219 (current baseline per HANDOFF). The single allowed failure (the 219th) must be the same test currently failing, not a regression. If you don't know which test is the 219th, the PLAN should include a "baseline `pnpm test` capture" step as Step 1 of EXEC.
- A debug-scale Wave 1 run (5-cap or 20-cap, per existing runbook §2) must complete end-to-end with audit tables populated AND lineage rows carrying `source_lineage_import_run_id`.
- A full-scale Wave 1 run (47k rows, no cap) must complete in ≤ 10 minutes wall-clock with `sys.sys_skills ≥ 5000`, `audit.import_run_logs` populated with full state-transition sequence, `brownfield.import_runs.import_run_status = COMPLETE`.

### Operational boundaries

- Backup gate: before any DB write, verify a pg_dump of `heuresys_advanced` exists with mtime ≤ 6 hours. If not, **CREATE a fresh dump first** (this is one of the few writes you may propose autonomously in the PLAN). The PLAN should specify the exact dump command + path.
- Git discipline: the PLAN must propose **atomic commits per logical step** (audit wiring as one commit, transform compiler as one commit, UPSERT refactor as one commit, etc.). Each commit message should reference Goal 001 and the step. NO squashing.
- Turn budget: hard cap **40 turns** for the EXEC phase (down from CLI's original estimate of 50 in MIGRATION_STATUS §8.B — refined by Cowork because the lineage backfill problem #3 is well-scoped and adds minimal complexity, not 10 extra turns).

---

## Required structure of `_02_PLAN_001_*.md`

The PLAN you produce must contain these sections, in this order:

### §1 — Executive summary (max 10 lines)
What you intend to do, in your own words, in plain English. No code. This is the section Cowork reads first to assess fit.

### §2 — Baseline capture plan
The first steps of EXEC will be measurement, not change. Specify exactly:
- How you will capture the current `pnpm test` baseline (file path of stored output, format)
- How you will capture the current debug-scale run timing/outcome as control
- How you will capture the current state of `audit.*` and lineage tables (counts, samples)
- What "good" looks like for each baseline (the threshold below which you stop and escalate)

### §3 — Code change plan
For each file you propose to modify, write:
- Full file path
- Current state summary (1-2 lines: what it does today)
- Intended change (3-5 lines: what behavior changes)
- Risk class: low | medium | high
- Test coverage: which existing test exercises this code; if none, propose a new test

Order the changes by dependency (foundational first, dependent later). The PLAN should make clear which changes can be committed independently.

### §4 — DB write plan
For each DB object that will be written, write:
- Object (schema.table)
- Write type (INSERT, UPDATE, DELETE, DDL, VACUUM, etc.)
- Trigger (which code path produces this write)
- Expected row count per run (debug-scale and full-scale)
- Reversibility (can it be UNDONE without DB restore?)

### §5 — Transform compiler design (Problem 1 detail)
A standalone section because this is the trickiest part. Specify:
- The vocabulary of `brownfield.column_mappings.column_mapping_transform` values you found by inspection
- The SQL fragment each transform compiles to
- The LOOKUP_FK resolver: how you find the parent table's PK column at compile time
- Edge cases: NULL handling, type coercion failures, missing FK targets
- Dynamic-SQL safety: how you prevent injection through `column_mapping_transform_payload` content (whitelist? quote_ident? parameterization?)

### §6 — Lineage backfill decision
Choose one of:
- **Path A**: backfill the existing 52 NULL `source_lineage_import_run_id` rows to `67d51a90-...` (the stuck DEMO run). Pros / Cons.
- **Path B**: transition `67d51a90-...` to FAILED with `failure_reason='STALE: pre-refactor in-memory state'`, leave 52 rows NULL as documented pre-history, all NEW runs after refactor will populate the FK correctly. Pros / Cons.

Justify the choice.

### §7 — Acceptance criteria
A bulleted, machine-checkable list. Each criterion must be objectively verifiable from EXEC output (test result, SQL query result, file existence, etc.). Examples:
- `pnpm test` exit code = 0, passing count ≥ 218
- `SELECT count(*) FROM audit.import_run_logs WHERE import_run_id = <new_test_run>` ≥ 5 (one per state transition)
- Full-scale 47k run: wall-clock ≤ 600s, `SELECT count(*) FROM sys.sys_skills` ≥ 5000 after run
- `git log --oneline | head -10` shows ≥ 3 atomic commits attributable to Goal 001

### §8 — Turn budget breakdown
Allocate the 40-turn cap across the proposed steps. Be honest: if you think it's actually 50, say so in the PLAN and we negotiate before approval rather than discovering it mid-EXEC.

### §9 — Risk register
List the top 5 risks of this refactor, in order of severity. For each: probability, impact, mitigation. Examples of risks to consider:
- "SQL injection through `column_mapping_transform_payload`"
- "Performance regression on debug-scale (faster but uses worse plans)"
- "FK orphans introduced by new UPSERT path with stale lookup cache"
- "Test 219 (currently failing) starts passing for the wrong reason"
- "Audit table writes deadlock with target-table writes under load"

### §10 — Rollback plan
For each commit you propose, write the exact `git revert` or `git reset` command to undo it without affecting unrelated work. For DB-side rollback: confirm the pg_dump restore command and approximate downtime.

---

## What happens after you write `_02_PLAN_001_*.md`

1. You save the file at `D:\heuresys-advanced\cowork_code_exchange\_02_PLAN_001_audit_upsert_refactor.md`.
2. You also save a mirror at `C:\Users\enzospenuso\Claude Desktop\outputs\_02_PLAN_001_audit_upsert_refactor.md` (per CW1).
3. You confirm completion in chat with a brief summary (5-10 lines): "PLAN ready, here are the highlights / open questions".
4. **You stop.** Wait for Cowork to review and respond with either:
   - "PLAN 001 approved, proceed with EXEC" → you create `_03_EXEC_001_*` and start executing
   - "PLAN 001 revisions needed: [specific items]" → you update the PLAN
   - Specific questions → you answer in chat without modifying the PLAN until approved

If you're unclear on any aspect of this scope, ask in chat **before** writing the PLAN — not in the PLAN itself. Questions in the PLAN body are fine for "decisions deferred to supervisor", but unclear scope questions should be resolved first.

---

## Hard guard-rails for this PROMPT turn (the one producing the PLAN)

1. **NO code changes.** Not even "small ones". Not even "just adding a comment to clarify". The PLAN is markdown only.
2. **NO DB writes.** Not even diagnostic ones. If the PLAN needs DB inspection (column listings, current row counts), that goes in §2 Baseline capture plan — executed during EXEC.
3. **NO test execution.** Same rule: tests run during EXEC after PLAN approval, not now.
4. **NO git operations** except reading log/status/diff if useful for the PLAN's §10 rollback design.
5. **NO new SSH tunnels.**
6. **Secret hygiene**: no credentials in the PLAN even sanitized — refer to env var names only.
7. The PLAN is a **read-only-on-the-environment artefact**. Producing it must not change anything outside the two PLAN files themselves.

---

*End of _01_PROMPT_001_audit_upsert_refactor.md*
