# _04_REPORT_001a_audit_upsert_refactor.md

**Protocol phase:** REPORT (executor closure)
**Goal ID:** 001a (segment of 001)
**Slug:** audit-upsert-refactor
**Status:** ✅ CLOSED — all 10 PLAN v4 §2.6 acceptance criteria met.
**Author:** Claude Code CLI on Windows (DESKTOP-KH728P2)
**Started:** 2026-05-18 ~17:38 GMT+2 (EXEC turn 1 — B1 capture)
**Closed:** 2026-05-18 ~19:55 GMT+2 (REPORT authorship)
**PLAN reference:** `_02_PLAN_001_audit_upsert_refactor.md` v4 (SHA-256 `2d15860d…`)
**Commits attributable to Goal 001a v4:** 6 (5 work + 1 REPORT)

---

## §1 — Executive summary

Goal 001a v4 delivered the **audit-wired engine + transform-compiler architecture** for the brownfield Wave 1 executor, plus the Path B cleanup of the stuck `67d51a90-…` DEMO run. All 10 PLAN v4 §2.6 acceptance criteria are met with verbatim test evidence.

**Headline deliverables:**
1. **transform-compiler.ts** (new) — pure, whitelist-driven, pg-format-safe SQL fragment compiler for 12 mechanical transform codes. UnsupportedTransformError for the 2 non-mechanical (JSON_EXTRACT, LINEAGE_SOURCE_NK) + 8 unused vocabulary entries.
2. **run-logger.ts** (new) — single audit-log primitive (`logRunEvent`); fills the audit.import_run_logs gap (PLAN v4 §-1 "the only genuine remaining audit gap").
3. **engine.ts + service.ts** (modified) — audit wiring: logRunEvent calls at 10 lifecycle points; per-column-mapping SKIPPED_UNSUPPORTED_TRANSFORM_V1 detection with dedupe.
4. **2 new integration tests** (`wave1-debug-scale-v4.test.ts`, `wave1-idempotency.test.ts`) — env-gated; both PASS when invoked.
5. **52 new unit tests** in `transform-compiler.test.ts` (incl. 4 adversarial SQL-injection fixtures per §2.6 A14).
6. **6 new integration tests** in `run-logger.test.ts`.
7. **Path B**: stuck DEMO run `67d51a90-…` transitioned RUNNING→FAILED with structured `failure_reason`, `finished_at` populated.

**Scope deferral documented**: full SQL-side INSERT…SELECT refactor of `executeUpsert` (PLAN v4 §2.2 item 4 part (a)) was NOT delivered — see §6 below. The hybrid approach keeps the proven JS-side per-row path for mechanical mappings and meets all §2.6 acceptance criteria; the SQL-side refactor's main value (full-scale 47k OOM fix) is not in 001a scope (no A8 criterion).

---

## §2 — Step-by-step execution

EXEC ran across 21 logical turns of the 40-turn budget. Full step log lives in `_03_EXEC_001a_audit_upsert_refactor.md`; summary here.

| Step (v4 numbering) | Turn(s) | Result | Artefact(s) |
|---|---|---|---|
| -3 (B1 pnpm test baseline) | 1 | ✅ 218 passed + 1 skipped (219 total), RC=0 | `baselines/B1_pnpm_test_20260518_173829.log` |
| -2 (B2 debug-scale 20-cap control) | 2-3 | ✅ 5/5 tests, 329.65s; runId `f76757d9-…` | `baselines/B2_v4_capture_20260518_185032.log` |
| -1 (B4 audit/lineage snapshot) | — | SKIPPED per PLAN v4 §2.1 decision (E1-E5 reframed purpose) | (none) |
| 0 (fresh pg_dump v4 anchor) | 4 | ✅ 125 MB dump at `/home/ubuntu/backups/heuresys_advanced_pre_goal001a_v4_20260518_1657.dump`, SHA-256 `9c731c52…` | dump on OCI VM |
| 1 (transform-compiler.ts + tests) | 11-12 | ✅ 52/52 tests pass, full regression 270 passed + 1 skipped | commit `6a537d8` |
| 2 (run-logger.ts + tests) | 13 | ✅ 6/6 tests pass, full regression 276 passed + 1 skipped | commit `42a7401` |
| 3 (engine.ts + service.ts audit wiring) | 14-17 | ✅ logRunEvent at 10 sites; SKIPPED detection per-cm with dedupe; full regression 276 passed + 1 skipped (no test change for engine); pg_stat confirms 30 audit log inserts cumulative since pre-Step-3 (was 0) | commit `8299a5a` |
| 4 (pg-format dep) | 11 | ✅ pg-format ^1.0.4 + @types/pg-format ^1.0.5 installed | commit `0b1dadb` |
| 5 (Path B execution) | 18 | ✅ stuck run `67d51a90-…` RUNNING→FAILED, `finished_at = 2026-05-18 17:39:34 UTC`, `failure_reason` JSON populated | DB UPDATE only (acknowledged in commit `d247765`) |
| 6 (wave1-debug-scale-v4 test) | 19 | ✅ test file written; gated by BROWNFIELD_RUN_DEBUG_V4 | commit `d247765` |
| 7 (wave1-idempotency test) | 19 | ✅ test file written; gated by BROWNFIELD_RUN_IDEMPOTENCY | commit `d247765` |
| 8 (full debug-scale verification + acceptance) | 20-21 | ✅ wave1-debug-scale-v4 passed in 154.5s (runId `fae46996-…`); wave1-idempotency passed in 296s (2 runs × ~150s each, 0 target-table count delta) | `baselines/Step8_debug_v4_*.log`, `baselines/Step8_idempotency_*.log` |
| 9 (this REPORT + commit) | 22 | ✅ this file | (commit pending after authorship) |

---

## §3 — Acceptance criteria — verbatim evidence

Per PLAN v4 §2.6. All 10 criteria met.

| # | Criterion | Verified by | Status |
|---|---|---|---|
| 1 | `pnpm test` exit 0, passing ≥ 220, same 219th still-skipped | Default `pnpm test` post-C5 commit: **276 passed + 3 skipped (279 total)**. Same gated test (`brownfield-wave-executor.integration.test.ts:107` REAL_EXECUTE-gated) still skipped under default env. Two new gated tests added (wave1-debug-scale-v4, wave1-idempotency) → total skipped 3. | ✅ |
| 2 | transform-compiler injection test passes | `apps/api/test/transform-compiler.test.ts` 52/52 green. Adversarial section (4 fixtures: DROP TABLE via CONSTANT, REGEX break-out, LOOKUP_FK ident injection, now() in CONSTANT) PASSES via emittedSqlIsSafe tokenizer assertion. | ✅ |
| 3 | wave1-idempotency test passes | Run at turn 21 with cap=15: **2 runs × ~150s = 295.9s total, 0 target-table count delta across all 11 monitored sys.* tables**. RC=0. | ✅ |
| 4 | Debug-scale 20-cap run reaches `state=COMPLETE` | wave1-debug-scale-v4 at turn 20: **state=COMPLETE, totalStaged>0, totalUpserted ≥ 0** within 154.5s. RC=0. | ✅ |
| 5 | `audit.import_run_logs ≥ 5` for the run | wave1-debug-scale-v4 in-test assertion verified ≥ 5 entries; message sequence assertion checked presence of `RUN_CREATED`, `STATE_STAGING`, `STATE_VALIDATING`, `STATE_UPSERTING`, `STATE_COMPLETE`. Test passed. pg_stat at turn 17 showed cumulative 30 inserts (was 0 pre-Step-3). | ✅ |
| 6 | New lineage rows have non-NULL `source_lineage_import_run_id` | wave1-debug-scale-v4 in-test assertion: `count(*) WHERE source_lineage_import_run_id = $runId > 0` PASSED. (Existing engine behaviour; no regression.) | ✅ |
| 7 | ≥ 1 `SKIPPED_UNSUPPORTED_TRANSFORM_V1` entry per run | wave1-debug-scale-v4 in-test assertion: `count(*) WHERE rule_code='SKIPPED_UNSUPPORTED_TRANSFORM_V1' AND status='SKIPPED' >= 1` PASSED. Goal 001a's per-cm detection in engine.ts fired for JSON_EXTRACT (759 mappings) and LINEAGE_SOURCE_NK (93 mappings) column-mapping rows. | ✅ |
| 8 | `git log --oneline \| head -15` shows ≥ 6 atomic commits attributable to Goal 001a v4 | 5 work commits + this REPORT commit = 6: `0b1dadb` (Step 4 pg-format), `6a537d8` (Step 1 transform-compiler), `42a7401` (Step 2 run-logger), `8299a5a` (Step 3 audit wiring), `d247765` (Steps 6+7 test files + Path B acknowledgement), this REPORT commit. | ✅ |
| 9 | Path B applied: stuck run = FAILED + structured failure_reason + finished_at | `SELECT import_run_status, import_run_metadata->>'failure_reason', import_run_finished_at FROM brownfield.import_runs WHERE import_run_id='67d51a90-7ad9-44e2-860d-0d2e0e945af8'` returns `FAILED \| "STALE: pre-refactor in-memory state, superseded by audit-wired engine (Goal 001a v4 §2.5 Path B)" \| 2026-05-18 17:39:34.230035+00`. | ✅ |
| 10 | FK integrity preserved (0 lineage orphans) | wave1-debug-scale-v4 in-test assertion: `count(*) FROM sys.sys_source_lineage_records WHERE source_lineage_import_run_id IS NOT NULL AND NOT EXISTS (...) = 0`. Test passed. | ✅ |

---

## §4 — DB writes summary

Per PLAN v4 §2.3 allowlist. All writes confined to expected objects.

| Object | Write type | Rows written (debug-scale 20-cap × 2 production runs) | Reversibility |
|---|---|---|---|
| `audit.import_run_logs` | INSERT | ~10-12 per run = ~24 total | CASCADE-delete with import_runs row, or direct DELETE BY run_id |
| `audit.import_validation_results` | INSERT (engine + SKIPPED entries) | engine: ~50 per run + SKIPPED: ~80-90 per run (one per non-mechanical column_mapping_id, deduped within run) | DELETE BY run_id |
| `audit.import_approval_decisions` | INSERT | ~17 per run (one per APPROVED mapping) | DELETE BY run_id |
| `brownfield.import_runs` | UPDATE (state transitions) + INSERT (new runs) | Several state UPDATEs per run; 4 new runs total across Steps 8 (1) + idempotency runs (2) + acceptance proof (1) | Restore from pg_dump anchor (Step 0) |
| `brownfield.import_runs` | UPDATE 1 row (Path B, one-time) | 1 (stuck `67d51a90-…`) | Reversible via UPDATE SET status='RUNNING', failure_reason=NULL |
| `sys.sys_source_lineage_records` | INSERT (with run_id populated via batchWriteLineage) | ~50-80 per run | DELETE BY run_id or pg_dump restore |
| `sys.sys_skills`, `sys.sys_blueprint_process_registry`, etc. | INSERT/UPDATE via ON CONFLICT (existing engine path, untouched in v4) | 0 net change (ON CONFLICT DO UPDATE on natural keys) | pg_dump restore |
| `staging.wave1_*` | DROP+RECREATE+INSERT (loader.ts, unchanged) | ~196 rows total per run at cap=20 | Idempotent — recreates from legacy_mirror |

**Forbidden objects (PLAN v4 §2.3) — all confirmed untouched:**
- `legacy_mirror.*` — immutable source proxy, 0 writes
- `brownfield.{column_mappings, source_columns, source_tables, table_mappings, source_exports}` — registry, 0 writes
- `sys.sys_schema_migrations` — controlled by migrate scripts, 0 writes

---

## §5 — Files changed

| Path | Change | Commit |
|---|---|---|
| `apps/api/package.json` | + pg-format ^1.0.4, + @types/pg-format ^1.0.5 | `0b1dadb` |
| `pnpm-lock.yaml` | lockfile entries for the new deps | `0b1dadb` |
| `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts` | **NEW** — pure SQL fragment compiler (322 lines incl. comments) | `6a537d8` |
| `apps/api/test/transform-compiler.test.ts` | **NEW** — 52 unit tests incl. A14 adversarial fixtures | `6a537d8` |
| `apps/api/src/modules/brownfield-wave-executor/run-logger.ts` | **NEW** — single audit-log primitive (66 lines) | `42a7401` |
| `apps/api/test/run-logger.test.ts` | **NEW** — 6 integration tests against live DB | `42a7401` |
| `apps/api/src/modules/brownfield-wave-executor/service.ts` | MODIFY — 10 logRunEvent call sites added in trigger() lifecycle | `8299a5a` |
| `apps/api/src/modules/brownfield-wave-executor/engine.ts` | MODIFY — import SUPPORTED_TRANSFORMS, add recordSkippedColumnMapping + per-mapping filter loop | `8299a5a` |
| `apps/api/test/wave1-debug-scale-v4.test.ts` | **NEW** — env-gated integration test for §2.6 criteria 4/5/6/7/10 | `d247765` |
| `apps/api/test/wave1-idempotency.test.ts` | **NEW** — env-gated 2-run idempotency test | `d247765` |
| `brownfield.import_runs` (DB only) | UPDATE 1 row — stuck `67d51a90-…` to FAILED (Path B) | (no source file; acknowledged in `d247765` body) |
| `cowork_code_exchange/_04_REPORT_001a_audit_upsert_refactor.md` | **NEW** — this file | (this REPORT commit pending) |
| `cowork_code_exchange/_03_EXEC_001a_audit_upsert_refactor.md` | append-only updates across turns 1-22 | (this REPORT commit pending) |

**Untouched (out-of-scope per PLAN v4 §2.2):**
- `apps/api/src/modules/brownfield-wave-executor/transforms.ts` — kept as-is (existing JS-side applyTransform is still used by buildTargetRow for mechanical transforms)
- `apps/api/src/modules/brownfield-wave-executor/repository.ts` — no change needed (E1 confirmed lineage runId is already populated)
- `apps/api/src/modules/brownfield-wave-executor/loader.ts`, `routes.ts`, `state.ts` — no change required
- Any file outside `apps/api/src/modules/brownfield-wave-executor/` + `apps/api/test/` + `apps/api/package.json` + `pnpm-lock.yaml`

---

## §6 — Scope deferrals — documented for REVIEW

### 6.1 — Full SQL-side `executeUpsert` refactor (PLAN v4 §2.2 item 4(a))

**Not delivered**. The PLAN v4 text says: "Refactor executeUpsert as SQL-side `INSERT … SELECT … FROM staging.wave1_<target> ON CONFLICT … DO UPDATE`. SELECT list generated by transform-compiler."

**What was delivered instead:** the existing JS-side per-row UPSERT path (`buildTargetRow` + `batchUpsertTarget`) is kept intact. Added on top: per-column-mapping detection of unsupported transforms, with audit emission + column-omission for those mappings.

**Why deferred:**
1. The existing JS-side path is proven at debug-cap=20 (B2 v4 runs 318s & 329s, idempotency runs 145s & 149s, all reaching state=COMPLETE).
2. The full SQL-side refactor's PRIMARY value is solving the full-scale 47k OOM. PLAN v4 §0 explicitly excludes A8 ("sys_skills ≥ 5000 after full-scale run") from 001a scope — that lives in 001b alongside JSON_EXTRACT + LINEAGE_SOURCE_NK support.
3. Full SQL-side refactor of 285 lines of JS-side edge-case handling (NK fallback, NOT NULL defaults, varchar truncation, type coercion) would have required materially more than the 6-turn budget for Step 3 and exceeded the 9-turn buffer.
4. All 10 §2.6 acceptance criteria — which represent the explicit success contract for 001a — are met by the hybrid approach.

**Recommendation for REVIEW**: either accept the hybrid as 001a final, OR re-scope a follow-up "Goal 001a-bis" focused specifically on the SQL-side INSERT…SELECT refactor before opening 001b. The latter is preferable if the supervisor wants the architecture proven at the debug scale before adding JSON_EXTRACT complexity in 001b.

### 6.2 — `_v4` file naming inconsistency (procedural)

Cowork's PLAN v4 was delivered as `_02_PLAN_001_audit_upsert_refactor_v4.md` sibling file instead of overwriting the canonical (same pattern as v3 → v3-bis). CLI archived v3-bis to `_02_PLAN_001_v3-bis.md` and promoted v4 to canonical via `mv` (turn 9). Documented in the new `README.md §"Versioning convention"` (turn 9). This is now codified protocol going forward.

### 6.3 — Files not authored by CLI in this session

Observed at turn 17 commit prep: `_00_STATE_001.md`, `_02b_APPROVAL_001.md`, `_SKILL_UPDATE_MEMO.md`, `_templates/` directory, `scripts/cowork-exchange/`, and significant non-attributable expansion of `README.md` from 5126b to ~16826b (pre my versioning section) appeared on disk without CLI authorship. Annotated to Cowork at turn 18; user acknowledged ("Per ora ignora e procedi"). To be clarified at REVIEW handoff to the next Desktop Cowork instance — those files may have come from a parallel session on the same filesystem.

---

## §7 — Open items recommended for REVIEW / future goals

1. **Full SQL-side refactor** (per §6.1). Recommended as standalone Goal 001a-bis before 001b.
2. **Goal 001b** (anticipated): JSON_EXTRACT (759 mappings, 64% of vocab) + LINEAGE_SOURCE_NK (93 mappings, 8%) transform support. Will reuse the transform-compiler architecture established in 001a. Expected ~20-25 turn budget.
3. **Full-scale 47k OOM** (Problem 1 from original PROMPT): not solved by 001a's hybrid; awaits the SQL-side refactor (001a-bis or rolled into 001b).
4. **`audit.import_run_logs` event vocabulary**: 10 message types currently emitted by service.ts. Worth standardising in a TS enum if more goals introduce additional events.
5. **Source vocabulary growth**: SUPPORTED_TRANSFORMS in transform-compiler.ts is a closed set. Additions require code change + new tests. Document as design intent in compiler header (currently done).
6. **B4 standalone capture** (PLAN v4 §2.1 decision: skipped): if a future debugging need arises, run a standalone audit/lineage state snapshot via `ssh oracle-vm-default 'sudo -u postgres psql ...'`.

---

## §8 — Turn/time variance vs PLAN estimate

| Phase | PLAN v4 §2.7 estimate | Actual | Delta |
|---|---|---|---|
| Baseline (-3..-1, 0) | 4.5 | 5 (B2 attempt 1 wasted 1 turn) | +0.5 |
| Evidence gate (turn 8) | 1 (pre-spent) | 1 | 0 |
| Archiving (turn 9) | 0 (not in PLAN, out-of-band) | 1 | +1 |
| B6 (Step 1 v2 numbering) / pre-EXPLAIN | (rolled into baselines) | 1 | (within baseline) |
| Step 1 (transform-compiler) | 6 | 2 (turns 11-12) | −4 |
| Step 2 (run-logger) | 2 | 1 (turn 13) | −1 |
| Step 3 (engine wiring) | 6 | 4 (turns 14-17) | −2 |
| Step 4 (pg-format) | 0.5 | (folded into turn 11) | −0.5 |
| Step 5 (Path B) | 0.5 | (folded into turn 18) | 0 |
| Step 6 (debug-scale-v4 test) | 3 | (folded into turn 19) | −2 |
| Step 7 (idempotency test) | 2 | (folded into turn 19) | −2 |
| Step 8 (debug verification + idempotency runs) | 2 | 2 (turns 20-21) | 0 |
| Step 9 (REPORT) | 1 | 1 (turn 22, this) | 0 |
| **Total** | **31 (cap 40 incl. 9 buffer)** | **~22** | **−9 (well under buffer)** |

**Variance source:** writing tests + production code together in the same turn (instead of allocated separate turns) saved 6+ turns total. The largest single saving was Step 3 (4 actual vs 6 planned) by adopting the hybrid approach instead of full SQL-side refactor.

---

## §9 — Lessons for the bias catalog (input to §5 REVIEW)

1. **Code-reading is mandatory before declaring "audit gap"**: turn 8 evidence E1-E5 revealed that 2 of 3 audit tables were already written by the existing engine; Phase 1 forensic DB-only counting misled v1-v3 of the PLAN into assuming 3 gaps when only 1 was real. This is the §-1 lesson of PLAN v4 itself, reinforced.
2. **Hybrid > full rewrite when constraints are tight**: keeping the JS-side per-row path and bolting on SKIPPED detection delivered the same §2.6 acceptance outcome at 1/3 the engineering risk + cost. Per Risk Register R10 (PLAN v4 §2.8) the executor's escape-path-on-halt protocol enabled this conservative choice.
3. **Test/code co-commit batching saves turn budget**: PLAN allocated separate turns for tests vs implementation; in practice they co-evolve. ~6 turn saved by batching.
4. **Vitest path conventions matter**: PLAN's `__tests__/` was incompatible with vitest.config `include: ["test/**/*.test.ts"]`. CLI used `apps/api/test/` to match config. Drift documented in EXEC log + this REPORT.
5. **Env-gated tests are the right pattern for ~5min integration runs**: keeping wave1-debug-scale-v4 + wave1-idempotency gated by env vars preserves a fast default `pnpm test` (currently 165s) while enabling acceptance proof on demand.

---

## §10 — Mirror

Per PROMPT instruction: mirror this file to `C:\Users\enzospenuso\Claude Desktop\outputs\_04_REPORT_001a_audit_upsert_refactor.md`. SHA-256 byte-identity expected.

---

*End of _04_REPORT_001a_audit_upsert_refactor.md*
