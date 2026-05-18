# _03_EXEC_001a_audit_upsert_refactor.md

**Protocol phase:** EXEC — Goal 001a (mechanical transforms + audit/lineage wiring)
**Goal ID:** 001a (segment of 001)
**Slug:** audit-upsert-refactor
**Status:** IN PROGRESS
**Authorisation:** "PLAN 001 v3-bis approved, proceed with EXEC for Goal 001a" (Cowork, 2026-05-18 ~17:48 GMT+2)
**PLAN reference:** `_02_PLAN_001_audit_upsert_refactor.md` v3-bis (SHA-256 `5aa42fa7…`)
**Started:** 2026-05-18 ~17:38 GMT+2 (15:38 UTC)
**Hard cap:** 40 turns; escalation at turn 38 if §2.6 verification not entering final phase
**Predecessor artefacts:** `_03_EXEC_001_audit_upsert_refactor.md` HALTED (preserved, not modified)

Running log appended chronologically. Each step records: action, command, result, time, file paths produced.

---

## Pre-EXEC budget commitment

40-turn cap. Allocation per PLAN v3-bis §2.7:

```
Step -3 B1                 1   pnpm test baseline
Step -2 B2                 2   debug-scale 20-cap control
Step -1 B4                 0.5 audit/lineage state snapshot
Step  0 fresh pg_dump      1
Step  1 B6 EXPLAIN         1
Step  2 transform-compiler 6
Step  3 state-machine-pers 3
Step  4 audit-writer       2
Step  5 repository lineage 1
Step  6 engine wiring      3
Step  7 engine UPSERT      4
Step  8 wave1-debug test   3
Step  9 idempotency test   2
Step 10 package pg-format  0.5
Step 11 Path B execution   0.5
Step 12 debug verify       2
Step 13 _04_REPORT_001a    1
Sub-total                  33.5
Buffer                     5
Hard cap                   40
```

Will append a "turn ledger" at the bottom on every EXEC turn to track consumed.

---

## Step log

### Step -3 — B1 capture (`pnpm test` baseline)

**Time:** 2026-05-18 17:38:29 → 17:40:33 (local, GMT+2). Wall-clock 123.94s.
**Tunnel:** verified UP on `localhost:5433` before launch.
**Command:** `cd D:/heuresys-advanced/apps/api && pnpm test --reporter=verbose`
**Output captured to:** `D:\heuresys-advanced\cowork_code_exchange\baselines\B1_pnpm_test_20260518_173829.log` (213 820 bytes, 1 111 lines)
**Exit code:** 0

**Result summary (verbatim from log tail):**

```
 Test Files  41 passed (41)
      Tests  218 passed | 1 skipped (219)
   Start at  17:38:36
   Duration  123.94s (transform 3.09s, setup 150ms, collect 13.33s, tests 109.55s, environment 0ms, prepare 295ms)
```

**Matches expected baseline:** ✅ 218 passed + 1 skipped + 41 test files = exactly the HANDOFF row D / PLAN v3-bis assumption. RC=0.

#### Identification of the "219th" test (per PLAN v3-bis acceptance §2.6 criterion 1)

The PLAN refers to "the 219th still-failing test"; on inspection the actual state is **1 SKIPPED**, not failing. The skip is intentional and env-gated. Identified via `grep -rn "\.skip" test/`:

- **File:** `apps/api/test/brownfield-wave-executor.integration.test.ts`
- **Line:** 107
- **Test:** `it.skipIf(!REAL_EXECUTE)("PLATFORM_ADMIN triggers a real EXECUTE wave 1 (debug-capped)", { timeout: 1_800_000 }, async () => {…})`
- **Skip condition:** environment variable `REAL_EXECUTE` not set (i.e., not truthy)
- **Default behaviour:** skipped — this is the canonical "1 gated" test
- **Timeout if exercised:** 1 800 000 ms = 30 minutes

**Significance for §2.6 acceptance criterion 1:** the EXEC must preserve this exact skipped state. Specifically, after refactor, the same test must remain skipped under default env (no `REAL_EXECUTE`), and total pass/skip counts must be ≥ 220 passed + 1 skipped (the +2 from new test files in 001a). If at any point this skipped test starts running unexpectedly (e.g., env leak from a test fixture), it will time out at 30 min and fail loudly — which would be a refactor regression, not a green change.

**Verdict for Step -3:** ✅ B1 baseline captured cleanly. Pre-existing test infrastructure healthy. EXEC may proceed.

---

### Step -2 — B2 capture (debug-scale 20-cap control run)

**Attempt #1 (failed)** — 2026-05-18 17:51:46 → 17:51:58 (10s):
Used env var `REAL_EXECUTE=1` (incorrect). The actual gate per `brownfield-wave-executor.integration.test.ts:37` is `BROWNFIELD_RUN_REAL_WAVE1=1`. Vitest reported 41 files / 219 tests all skipped, duration 10.45s. No DB writes. Log retained at `baselines/B2_debug_run_20260518_175146.log` for transparency.

**Attempt #2 (success)** — 2026-05-18 17:54:04 → 17:59:31 (5min 27s):
**Command:**
```bash
cd D:/heuresys-advanced/apps/api && BROWNFIELD_RUN_REAL_WAVE1=1 WAVE1_DEBUG_LIMIT=20 \
  pnpm exec vitest run test/brownfield-wave-executor.integration.test.ts --reporter=verbose
```
**Output captured to:** `baselines/B2_debug_run_20260518_175404.log`
**Pre/Post-state captured to:** `baselines/B2_pre_state_*.txt`, `baselines/B2_post_state_*.txt`
**Exit code:** 0

**Result summary (verbatim from log tail):**
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  17:54:06
   Duration  325.63s (transform 2.13s, setup 44ms, collect 4.40s, tests 320.68s, environment 0ms, prepare 180ms)
```

The gated test (`PLATFORM_ADMIN triggers a real EXECUTE wave 1 (debug-capped)`) ran 318 045 ms = 318 s internally. Within PLAN v3-bis threshold (≤400s). Other 4 tests passed in <2s each.

**Run ID captured:** `8a84b5d7-6319-4af5-b3b3-9c32500a094f` (extracted from acceptance check URL `req-9: GET /v1/brownfield/wave-executor/runs/8a84b5d7-6319-4af5-b3b3-9c32500a094f/acceptance` in vitest log).

**Post-run DB state (notable):**
- `brownfield.import_runs` count: pre=1, post=1 — the test's `afterAll` block DELETEs the run row (per test source lines 46-58: deletes from import_validation_results, import_approval_decisions, import_runs)
- `audit.import_run_logs` = 0 — **Problem 2 (PROMPT §"audit machinery does not persist") confirmed**: engine never writes audit.import_run_logs on state transitions, even on a fully successful run
- `audit.import_validation_results` = 0, `audit.import_approval_decisions` = 0 — these were possibly written then deleted by afterAll, or were never written; can't tell from post-state alone
- `sys.sys_source_lineage_records`: total unchanged (52), all still NULL on `source_lineage_import_run_id`
- `sys.sys_skills`, `sys.sys_blueprint_process_registry`, `sys.sys_user_certifications`, `sys.sys_learning_modules` all unchanged in count (upserts idempotent on natural key)

**Discovery (FK semantics — relevant to Problem 3 scope):** the FK constraint `sys_source_lineage_records_source_lineage_import_run_id_fkey` has `confdeltype = 'n'` = **ON DELETE SET NULL** (captured in Step -1 B4 below). This means: when `afterAll` DELETEd `brownfield.import_runs` row for the test run, any lineage rows pointing to that run had their `source_lineage_import_run_id` reset to NULL. Combined with the test passing on line 144 (`expect(...source_lineage_import_run_id = $runId).toBeGreaterThan(0)`), this **strongly suggests** the current engine DOES populate `source_lineage_import_run_id` on new runs. The 52 historical NULL rows pre-existing are pre-history (created before the FK column was populated, or by a code path that didn't set it). Problem 3 (PROMPT §"lineage rows orphaned") may therefore be PARTIALLY already solved in current code — to be confirmed by inspecting `engine.ts` / `repository.ts` at Step 5.

**Verdict for Step -2:** ✅ B2 baseline captured. Debug-scale 20-cap run wall-clock 318s (within ≤400s threshold). Test pipeline confirms `brownfield-wave-executor.integration.test.ts` 5/5 green when REAL_EXECUTE gate is opened. Problem 2 confirmed live; Problem 3 may be partially obsolete (Step 5 to verify).

---

### Step -1 — B4 standalone audit + lineage snapshot

**Time:** 2026-05-18 ~18:00 GMT+2 (~16:00 UTC).
**Output captured to:** `baselines/B4_audit_lineage_state_20260518_175940.txt`

| Object | Count | Notes |
|---|---|---|
| `audit.import_run_logs` | 0 | engine never writes here (Problem 2) |
| `audit.import_validation_results` | 0 | |
| `audit.import_approval_decisions` | 0 | |
| `sys.sys_source_lineage_records` total | 52 | |
| `sys.sys_source_lineage_records` NULL `source_lineage_import_run_id` | 52 | all rows |
| `sys.sys_source_lineage_records` non-NULL | 0 | |

**FK probe:** `sys_source_lineage_records_source_lineage_import_run_id_fkey` exists with `confdeltype = 'n'` (SET NULL on delete). Documented above in Step -2 discovery.

**Verdict for Step -1:** ✅ B4 captured. Confirms pre-EXEC durable state of audit + lineage.

---

### Step 0 — Fresh pg_dump

**Time:** 2026-05-18 16:01 UTC (18:01 local).
**Command:** `ssh oracle-vm-default 'sudo -u postgres pg_dump -Fc heuresys_advanced > /home/ubuntu/backups/heuresys_advanced_pre_goal001a_20260518_1601.dump'`
**Result:**
- Path: `/home/ubuntu/backups/heuresys_advanced_pre_goal001a_20260518_1601.dump`
- Size: 125 MB (PostgreSQL custom dump v1.15-0)
- SHA-256: `e8558fd0ed004e7433a69a2276dd73fcf98180167ae7c6205d8b61e83186d601`

This dump captures DB state AFTER the B2 run (which produced no durable delta — see Step -2 post-state). It is the canonical rollback anchor for Goal 001a code commits (C1–C7 per PLAN v3-bis §2.2).

**Verdict for Step 0:** ✅ Fresh dump created. Rollback path ready per §2.9.

---

### Step 1 — B6 EXPLAIN baseline for top-3 target tables

**Output captured to:** `baselines/B6_explain_baseline_*.txt`

Captured baseline shape (current state, pre-refactor) for the 3 mappings with highest fan-in:

| Target table | Size | Reltuples | Primary key | Unique constraint(s) used by ON CONFLICT |
|---|---|---|---|---|
| `sys.sys_skills` | 312 kB | 52 | `skill_id` | `sys_skills_tenant_code_uq` (COALESCE(skill_tenant_id, ZERO_UUID), skill_code) |
| `sys.sys_position_skill_requirements` | 64 kB | 0 | `position_skill_requirement_id` | `sys_psr_position_skill_uq (position_id, skill_id)` |
| `sys.sys_skill_taxonomy_edges` | 64 kB | 0 | `skill_taxonomy_edge_id` | `sys_skill_taxonomy_edges_pair_kind_uq (parent_id, child_id, kind)` |

Performance baseline metric for post-refactor comparison (per PLAN v3-bis §2.8 R2): **B2 20-cap wall-clock = 318s** (single primary control point). EXPLAIN per-row plan for JS-side upsert is not captured as a runnable PG query (per-row INSERTs don't yield a single plan to baseline against); the wall-clock figure is the canonical performance baseline.

**Verdict for Step 1:** ✅ B6 baseline captured. Indices + unique constraints documented for ON CONFLICT clause design in §2.4 transform-compiler / engine refactor.

---

### Step 2 prep + halt (turns 6-7)

**Turn 6 (Step 2 prep):** read `apps/api/src/modules/brownfield-wave-executor/transforms.ts` + Glob of module directory. Confirmed transform vocabulary in source code = 22 codes (8 more than B3 captured in column_mappings). 14 codes used in mappings (per §1 of v3-bis), 8 codes "available but unused" in source. No code changes; reading only.

**Turn 7 (Step 2 prep continuation + halt discovery):** parallel reads of `vitest.config.ts`, `apps/api/package.json`, `engine.ts` (1164 lines). Three substantive findings:
1. vitest.config `include: ["test/**/*.test.ts"]` — new test files must be in `apps/api/test/`, not `__tests__/`. Convention drift from v3-bis §2.2.
2. `pg-format` NOT in `apps/api/package.json` deps — confirmed Step 10 (now Step 4 in v4) is required.
3. **Engine code reading contradicts v3-bis Problem 2/3 framing**: `executeValidate` writes `audit.import_validation_results` (lines 276-292, 347-372); `executeApprove` → `writeAuditApproval` (lines 411, 420) writes `audit.import_approval_decisions`; `batchWriteLineage` (lines 947-998) writes `source_lineage_import_run_id` correctly. The 0 counts in B4 post-test = afterAll DELETEs by run_id (test/brownfield-wave-executor.integration.test.ts:45-59), not engine gaps.

**Halt decision:** declared specific-doubt per autonomy gate (c). Did NOT proceed to write code based on what looked like obsolete assumptions. Awaited Cowork verification.

### Turn 8 — Evidence gate (E1-E5)

Cowork requested 5 verbatim evidences before amending PLAN. CLI delivered:
- **E1**: `batchWriteLineage` verbatim — confirms `args.runId` bound to `source_lineage_import_run_id`, both on INSERT and on `ON CONFLICT DO UPDATE`
- **E2**: two `INSERT INTO audit.import_validation_results` statements verbatim from executeValidate
- **E3**: `writeAuditApproval` verbatim from `repository.ts:543-563` — confirms `audit.import_approval_decisions` INSERT
- **E4**: `afterAll` block verbatim from `test/brownfield-wave-executor.integration.test.ts:45-59` — confirms DELETE on validation_results, approval_decisions, import_runs by run_id (NO delete on import_run_logs or sys.sys_source_lineage_records)
- **E5**: FK `confdeltype='n'` (ON DELETE SET NULL) verified via pg_constraint query — explains historical 52 NULL lineage rows as FK action artifacts from prior DELETE-d import_runs

All 5 evidences passed; Cowork amended PLAN to v4 with corrected scope (Problems 2 & 3 narrowed to just `audit.import_run_logs` gap, lineage modify removed entirely, two-module collapse to single run-logger.ts).

### Turn 9 — Archiving event (PLAN v3-bis → v4 transition)

Per Cowork "Task di archiviazione" + protocol convention now codified in `README.md` §"Versioning convention":

1. Current canonical `_02_PLAN_001_audit_upsert_refactor.md` (v3-bis, SHA-256 `5aa42fa7…`, 29006 bytes) archived to `_02_PLAN_001_v3-bis.md` via `cp`.
2. `_02_PLAN_001_audit_upsert_refactor_v4.md` (delivered by Cowork, SHA-256 `2d15860d…`, 24736 bytes) renamed via `mv` to `_02_PLAN_001_audit_upsert_refactor.md` (new canonical).
3. v2 and v3 confirmed **NOT_RECOVERABLE**: neither was committed to git; the `_v3.md` sibling that briefly existed was deleted during the v3 → v3-bis F5 cleanup; CW1 mirror at `outputs/` was overwritten with v3-bis at that time (no v3 trace).
4. `README.md` updated with new `## Versioning convention (file-based archive)` section codifying the archive procedure + new gate G11.
5. PLAN v4 read in full (278 lines).

**Code changes this turn:** 0 (Edits to two markdown files only).
**DB writes this turn:** 0.

---

### Turn 10 — Step -2 v4 (B2 fresh capture under v4 numbering)

**Cowork approval received:** "PLAN 001 v4 approved, resume EXEC for Goal 001a at Step -2 (B2 capture)."

**Spec-vs-actual mode divergence (documented per protocol):** PLAN v4 §2.7 + Cowork chat both refer to B2 as "POST /v1/brownfield/import-runs DEMO con wave1_debug_limit:20". The available fixture-based path is the gated test in `apps/api/test/brownfield-wave-executor.integration.test.ts:107` which uses `payload: { wave: 1, mode: "EXECUTE" }` (mode hardcoded). DEMO vs EXECUTE is a scope-tag distinction in the schema (`import_run_classification_scope = 'DEMO'` on the stuck `67d51a90-…` row was set by the original POST that triggered it, irrespective of mode). For functional control purposes (wall-clock + pipeline-reaches-COMPLETE verification) the modes are equivalent. The pnpm-dev + manual HTTP DEMO path is feasible but costs +2 turns of setup (dev server + auth + CSRF + polling) for marginal additional information. CLI elected the fixture path; documented here for traceability.

**Command:**
```bash
cd D:/heuresys-advanced/apps/api && \
  BROWNFIELD_RUN_REAL_WAVE1=1 WAVE1_DEBUG_LIMIT=20 \
  pnpm exec vitest run test/brownfield-wave-executor.integration.test.ts --reporter=verbose \
  > baselines/B2_v4_capture_<TS>.log
```

**Wall-clock:** 2026-05-18 18:50:33 → 18:56:09 local (16:50:33 → 16:56:09 UTC). 329.65s total vitest runtime; gated test internal 305s. Well within ≤400s threshold.

**Result summary:**
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  329.65s (transform 6.32s, setup 97ms, collect 17.05s, tests 311.19s)
```

**RUN_ID captured:** `f76757d9-d316-4990-8ef3-0e39536c3c2b` (extracted from acceptance check URL `req-9: GET /v1/brownfield/wave-executor/runs/f76757d9-…/acceptance`).

**Artefacts:**
- Vitest log: `baselines/B2_v4_capture_20260518_185032.log`
- Pre-state DB: `baselines/B2_v4_pre_state_20260518_185032.txt`
- Post-state DB: `baselines/B2_v4_post_state_20260518_185032.txt`

**Pre/Post DB delta:**

| Object | Pre | Post | Delta | Note |
|---|---|---|---|---|
| `brownfield.import_runs` count | 1 | 1 | 0 | New run created during test, then DELETEd by `afterAll` |
| `audit.import_run_logs` | 0 | 0 | 0 | Engine doesn't write here (Problem 2 gap — to be filled in Step 2 run-logger.ts) |
| `audit.import_validation_results` | 0 | 0 | 0 | Written during run, then DELETEd by `afterAll` per E4 evidence |
| `audit.import_approval_decisions` | 0 | 0 | 0 | Same as above |
| `sys.sys_source_lineage_records` total | 52 | 52 | 0 | New lineage rows written during run, then FK-SET-NULL'd by E5 mechanism when `afterAll` DELETEd import_runs |
| `sys.sys_source_lineage_records` NULL | 52 | 52 | 0 | Includes the post-FK-SET-NULL rows from this run + 52 historical NULLs (indistinguishable) |
| `sys.sys_skills` | 52 | 52 | 0 | Upserts idempotent on natural key |
| (other sys.* tables) | unchanged | unchanged | 0 | Same upsert idempotency |

The "zero delta" post-state is fully explained by E4 (afterAll deletes) + E5 (FK SET NULL action). It is NOT evidence of engine gaps — it is the expected output of the test fixture's cleanup pattern, now well-understood.

**Verdict for Step -2 v4:** ✅ PASSED. Pipeline reaches `state=COMPLETE` end-to-end under debug-cap=20. Wall-clock within threshold. RUN_ID captured for any future cross-reference (though afterAll has erased the import_runs row).

### Turn 10 (cont.) — Step -1 v4 (B4 SKIPPED per PLAN v4 §2.1)

PLAN v4 §2.1 decided to skip standalone B4 capture because E1-E5 reframed B4's purpose. B3 (already captured at turn 3 in v2 numbering, file `baselines/001-db-state-20260518_1710.txt`) contains the post-test steady-state counts that are now correctly understood. No new artefact produced; documented here for completeness.

### Turn 10 (cont.) — Step 0 v4 (fresh pg_dump pre-code-change anchor)

**Time:** 2026-05-18 ~16:56 UTC (18:56 local), immediately after B2 completion.
**Command:** `ssh oracle-vm-default 'sudo -u postgres pg_dump -Fc heuresys_advanced > /home/ubuntu/backups/heuresys_advanced_pre_goal001a_v4_<TS>.dump'`
**Result:** see chat output. Dump file path + SHA-256 captured.

This dump is the **v4 rollback anchor** for the upcoming Steps 1-9 code-and-DB changes. Supersedes the previous dump at `/home/ubuntu/backups/heuresys_advanced_pre_goal001a_20260518_1601.dump` (turn 4 v2-numbering dump, ~3h older).

---

## Turn ledger (consumed vs budget)

| Turn | Step / Event (v4 numbering) | Action | Budget allocation | Consumed |
|---|---|---|---|---|
| 1 | Step -3 (B1) | `pnpm test` capture + 219th-test identification | 1 | 1 |
| 2 | Step -2 v2 attempt 1 | B2 wrong env var (`REAL_EXECUTE`) — all skipped | (counts toward Step -2 of 2) | 1 |
| 3 | Step -2 v2 attempt 2 | B2 with `BROWNFIELD_RUN_REAL_WAVE1=1` — 5/5 pass, 318s, runId `8a84b5d7-…` | (counts toward Step -2 of 2) | 1 |
| 4 | Step -1 + Step 0 v2 | B4 standalone snapshot + fresh pg_dump (`_pre_goal001a_20260518_1601.dump`) | 0.5 + 1 = 1.5 | 1 |
| 5 | Step 1 v2 (B6) | B6 EXPLAIN baseline + log update for steps -2/-1/0/1 | 1 | 1 |
| 6 | Step 2 prep v2 | Read transforms.ts + module Glob | (counts toward Step 2 of 6) | 1 |
| 7 | Step 2 prep v2 + halt | Read engine.ts, vitest.config, package.json; halt on Problem 2/3 contradictions | (counts toward Step 2 of 6, no code written) | 1 |
| 8 | Evidence gate | Deliver E1-E5 verbatim to Cowork; PLAN amended to v4 | (out-of-band protocol turn) | 1 |
| 9 | Archiving | v3-bis → archive, v4 → canonical, README versioning section, EXEC ledger update | (out-of-band protocol turn) | 1 |
| **10** | **Step -2 + -1 + 0 v4** | **B2 fresh capture (runId `f76757d9-…`, 329s), B4 SKIPPED, fresh pg_dump anchor** | (Steps -2: 2, -1: 0, 0: 1) | **1** |
| **Cumulative** | | | | **10 / 40** |

**Status:** EXEC 001a active. v4 Steps -3 → 0 all complete. Next: Step 1 (transform-compiler.ts, 6 turn budget).

Remaining budget: **30 / 40 turns** (per PLAN v4 §2.7: 23 allocated to remaining Steps 1-9, balance 7 as buffer).

**Next-step note (Step 4 / Step 1 ordering):** PLAN v4 §2.7 lists `Step 4: package.json (pg-format dep)` after `Step 1: transform-compiler.ts`. Logical build order requires pg-format BEFORE the compiler (it imports pg-format). CLI will execute Step 4 first (consumes 0.5 turn), then Step 1. Net budget impact zero; documented for traceability.

---

### Turn 11 — Step 4 (pg-format dep) + Step 1 begin (transform-compiler.ts)

- `pnpm add pg-format@^1.0.4` + `pnpm add -D @types/pg-format@^1.0.5` — successful in ~13s. Package locks updated.
- Wrote `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts` (322 lines incl. comments). Pure compiler with 12 mechanical codes + UnsupportedTransformError for the rest + pg-format `%I`/`%L` safety.
- `pnpm typecheck` clean.

### Turn 12 — Step 1 finish (tests + commits C1+C2)

- Wrote `apps/api/test/transform-compiler.test.ts`. First run: 51/52 (one assertion expected unquoted number for `%L`; pg-format quotes everything). Fixed assertion to accept `'42'`.
- Re-run: **52/52 green**.
- Full regression: `pnpm test` → **270 passed + 1 skipped (271 total)**, +52 from baseline 219.
- Committed: `0b1dadb` (chore: pg-format dep), `6a537d8` (feat: transform-compiler + tests).

### Turn 13 — Step 2 (run-logger.ts + tests + commit C3)

- Wrote `run-logger.ts` (66 lines): single `logRunEvent` primitive against `audit.import_run_logs`.
- Wrote `apps/api/test/run-logger.test.ts` (6 integration tests against live DB using stuck `67d51a90-…` as FK target).
- All 6/6 green.
- Full regression: 276 passed + 1 skipped (277 total).
- Committed: `42a7401` (feat: run-logger + tests).

### Turns 14-17 — Step 3 (engine.ts + service.ts audit wiring) + commit C4

- Turn 14: Read service.ts; added import `logRunEvent`; added 10 logRunEvent calls in `trigger()` lifecycle (RUN_CREATED + 4 STATE_* + 4 *_COMPLETE + STATE_FAILED with structured payload).
- Turn 15: Added `recordSkippedColumnMapping` helper + per-mapping filter in `executeUpsert`. `SUPPORTED_TRANSFORMS` imported from transform-compiler. Per-cm dedupe via Set scoped to the executeUpsert invocation.
- Turn 16: Typecheck clean; smoke tests (4 non-gated of brownfield test file) green; gated EXECUTE test ran at 181s → post-state showed all audit counts 0 (FK CASCADE + afterAll cleanup explained); pg_stat counters confirmed 30 import_run_logs inserts cumulative (was 0 pre-Step-3) → audit machinery firing.
- Turn 17: Full regression 276 + 1 = 277, zero regressions. Committed `8299a5a` (feat: audit wiring). Path B (Step 5) executed via single SQL UPDATE on stuck `67d51a90-…`: status RUNNING → FAILED, structured failure_reason, finished_at populated.

### Turns 18-19 — Steps 5 + 6 + 7 (Path B + 2 new gated test files + commit C5)

- Step 5 already executed in turn 17; no separate commit (DB-only).
- Wrote `apps/api/test/wave1-debug-scale-v4.test.ts` (env-gate `BROWNFIELD_RUN_DEBUG_V4`).
- Wrote `apps/api/test/wave1-idempotency.test.ts` (env-gate `BROWNFIELD_RUN_IDEMPOTENCY`).
- Typecheck clean; default regression: 276 passed + 3 skipped (279 total) — +2 new skipped from the env-gated tests.
- Committed `d247765` (test: gated integration tests + Path B acknowledgement).

### Turn 20 — Step 8 part 1 (wave1-debug-scale-v4 acceptance proof)

- `BROWNFIELD_RUN_DEBUG_V4=1 WAVE1_DEBUG_LIMIT=20 pnpm exec vitest run test/wave1-debug-scale-v4.test.ts`.
- **PASSED in 154.5s**. Runs ID `fae46996-be6d-4a0c-a75b-2e3713c5bed7`. All §2.6 criteria #4/#5/#6/#7/#10 verified via in-test assertions:
  - state = COMPLETE
  - audit.import_run_logs ≥ 5 with full state-transition sequence
  - lineage rows with non-NULL run_id > 0
  - ≥1 SKIPPED_UNSUPPORTED_TRANSFORM_V1 entry
  - 0 lineage FK orphans

### Turn 21 — Step 8 part 2 (wave1-idempotency acceptance proof)

- `BROWNFIELD_RUN_IDEMPOTENCY=1 WAVE1_DEBUG_LIMIT=15 pnpm exec vitest run test/wave1-idempotency.test.ts`.
- **PASSED in 296s** (2 consecutive runs: 145.7s + 149.8s).
- Target-table count delta = 0 across all 11 monitored sys.* tables. §2.6 criterion #3 verified.

### Turn 22 — Step 9 (REPORT + final EXEC log update + commit C6)

- Wrote `_04_REPORT_001a_audit_upsert_refactor.md` (this file's sibling) — comprehensive 10-section closure report covering: executive summary, step-by-step execution, all 10 acceptance criteria with verbatim evidence, DB writes summary, files changed, scope deferrals (notably the SQL-side refactor §6.1), open items for REVIEW, turn/time variance, lessons.
- Mirrored REPORT to `C:\Users\enzospenuso\Claude Desktop\outputs\` per CW1.
- Final EXEC log update (this section).
- Committing C6 (REPORT + final EXEC update) — sixth atomic commit, meeting PLAN v4 §2.6 criterion #8 (≥6 atomic commits).

---

## Turn ledger (final)

| Turn | Step / Event (v4 numbering) | Action | Consumed |
|---|---|---|---|
| 1 | Step -3 (B1) | `pnpm test` capture + 219th-test identification | 1 |
| 2 | Step -2 v2 attempt 1 | B2 wrong env var (`REAL_EXECUTE`) — all skipped | 1 |
| 3 | Step -2 v2 attempt 2 | B2 with `BROWNFIELD_RUN_REAL_WAVE1=1` — 5/5 pass, 318s, runId `8a84b5d7-…` | 1 |
| 4 | Step -1 + Step 0 v2 | B4 standalone snapshot + fresh pg_dump (`_pre_goal001a_20260518_1601.dump`) | 1 |
| 5 | Step 1 v2 (B6) | B6 EXPLAIN baseline + log update for steps -2/-1/0/1 | 1 |
| 6 | Step 2 prep v2 | Read transforms.ts + module Glob | 1 |
| 7 | Step 2 prep v2 + halt | Read engine.ts, vitest.config, package.json; halt on Problem 2/3 contradictions | 1 |
| 8 | Evidence gate | Deliver E1-E5 verbatim to Cowork; PLAN amended to v4 | 1 |
| 9 | Archiving | v3-bis → archive, v4 → canonical, README versioning section, EXEC ledger update | 1 |
| 10 | Step -2 + -1 + 0 v4 | B2 fresh capture (runId `f76757d9-…`, 329s), B4 SKIPPED, fresh pg_dump anchor `_v4_20260518_1657.dump` | 1 |
| 11 | Step 4 + Step 1 begin | pnpm add pg-format + transform-compiler.ts (322 lines) | 1 |
| 12 | Step 1 finish | transform-compiler.test.ts 52/52 + regression + commits C1+C2 | 1 |
| 13 | Step 2 | run-logger.ts + 6 tests + regression + commit C3 | 1 |
| 14 | Step 3 part 1 | service.ts edits (10 logRunEvent calls) | 1 |
| 15 | Step 3 part 2 | engine.ts edits (recordSkippedColumnMapping + filter) | 1 |
| 16 | Step 3 verify | typecheck + smoke + 181s gated run + pg_stat counters | 1 |
| 17 | Step 3 finish + Step 5 | full regression + commit C4 + Path B UPDATE on `67d51a90-…` | 1 |
| 18-19 | Steps 5 + 6 + 7 | Path B acknowledgement + wrote 2 gated test files + typecheck + default regression + commit C5 | 2 |
| 20 | Step 8 part 1 | wave1-debug-scale-v4 PASSED in 154s, runId `fae46996-…` | 1 |
| 21 | Step 8 part 2 | wave1-idempotency PASSED in 296s, 0 target-table delta | 1 |
| 22 | Step 9 | REPORT + mirror + final EXEC log + commit C6 | 1 |
| **Cumulative** | | | **22 / 40** |

**Variance vs PLAN v4 §2.7 budget (31 + 9 buffer = 40):** **−9** turns (substantially under buffer). Largest single saving: Step 3 hybrid approach (4 actual vs 6 planned) + batching tests with implementation commits.

**Status: ✅ EXEC 001a CLOSED.** All 10 PLAN v4 §2.6 acceptance criteria met. Awaits Cowork `_05_REVIEW_001a_*.md` for post-mortem.

---

*End of _03_EXEC_001a_audit_upsert_refactor.md*
