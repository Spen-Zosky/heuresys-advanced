# _02_PLAN_001_audit_upsert_refactor.md (v3-bis — segmented + executor fixes)

> **v3-bis = v3 + fix F1-F5 from Cowork OBJ1-OBJ5, applied 2026-05-18 by executor under restricted delegation.**

**Protocol phase:** PLAN (revised by supervisor after executor halt, then by executor under restricted delegation)
**Goal ID:** 001 (segmented as 001a + 001b)
**Slug:** audit-upsert-refactor
**Revision history:**
- v1: 2026-05-18, initial PLAN by CLI executor
- v2: 2026-05-18, revised by CLI after R1+R2+R3 from Cowork (state-machine alternatives, SQL injection safety §5.6, idempotency risk #8)
- v3: 2026-05-18 ~17:30 GMT+2, revised by Cowork after CLI escalation: transform vocabulary discovered as 14 codes (not 5 assumed in v1/v2). Goal segmented into 001a + 001b.
- **v3-bis: 2026-05-18 ~17:45 GMT+2, revised by CLI under restricted delegation: F1 framing math (27.6% not 75%), F2 baseline state realignment + budget +5 turn, F3 file path correctness (engine.ts/repository.ts not invented modules) + rationale footnote on two-module audit factoring, F4 vocab count fix (UPPERCASE=3, LOWERCASE=1), F5 canonical path overwrite of v2.**

**Triggering event:** EXEC of v2 halted at turn 3 of 40 by CLI via PLAN §8 escape clause. Baseline B3 discovered 14 distinct `column_mapping_transform` values in `brownfield.column_mappings` (1177 rows total), against v2's assumption of 5. CLI's halt + transparent escalation is recorded as exemplary protocol conduct.

---

## §0 — Why segmentation now

The original v2 PLAN scoped Goal 001 as a single 40-turn task addressing three interlocking problems. CLI's discovery shows the actual transform vocabulary is ~3x larger than assumed, with at least two transforms (JSON_EXTRACT, LINEAGE_SOURCE_NK) being non-mechanical and requiring inspection of existing `transforms.ts` code before their PG SQL fragment can be designed.

A monolithic v3 (estimated by CLI at ~67 turns) would:
- Exceed sustainable attention budget for both executor and supervisor
- Inflate rollback complexity to 12+ atomic commits + DB restore
- Force JSON_EXTRACT design under pressure with everything else moving

Segmentation into 001a (mechanical transforms + audit/lineage wiring) and 001b (non-mechanical transforms + full-scale verification):

**Goal 001a delivers SQL-side UPSERT for 325/1177 (27.6%) of mapping rows — the 12 mechanical transform codes. The remaining 852 rows (72.4%) using JSON_EXTRACT or LINEAGE_SOURCE_NK are routed through the forensic escape path (`SKIPPED_UNSUPPORTED_TRANSFORM_V1`) until Goal 001b resolves them. The value of 001a is therefore not measured in row coverage but in:**

- **(a)** audit machinery becoming functional and verifiable end-to-end (`audit.import_run_logs` / `audit.import_validation_results` / `audit.import_approval_decisions` written and queryable),
- **(b)** lineage FK populated for new runs (`sys.sys_source_lineage_records.source_lineage_import_run_id` no longer NULL on post-refactor inserts),
- **(c)** Path B execution closing the stuck DEMO run (`67d51a90-...` transitioned to FAILED with structured payload),
- **(d)** the transform-compiler architecture proven and ready for incremental extension in 001b (JSON_EXTRACT + LINEAGE_SOURCE_NK plug in as additional whitelist entries on a verified foundation).

The trade-off accepted: Goal 001a leaves Problem 1 (full-scale 47k OOM) only partially solved — 72.4% of mapping rows bypass the new path. **This is acceptable** because:
- The currently-stuck pipeline produced only 52 lineage rows at debug-scale before the OOM, all with NULL run-id linkage
- Goal 001a will produce more usable + traceable data than the current state (325 mapping rows routed through audited new path vs. 0 today; every skip recorded forensically in `audit.import_validation_results`)
- Goal 001b closes the gap deterministically once JSON_EXTRACT design is settled

---

## §1 — Transform vocabulary discovered (from baseline B3)

Recorded as factual canvas for both 001a and 001b. Counts verified verbatim from `cowork_code_exchange/baselines/001-db-state-20260518_1710.txt`.

| transform_code | count | mechanical? | target goal | notes |
|---|---|---|---|---|
| JSON_EXTRACT | 759 | **NO** | 001b | jsonb path extraction; payload schema TBD by inspection |
| CAST_TIMESTAMPTZ | 130 | yes | 001a | `CAST(src AS TIMESTAMPTZ)` with NULL handling |
| LINEAGE_SOURCE_NK | 93 | **NO** | 001b | domain-specific; requires reading `transforms.ts` |
| TRIM | 86 | yes | 001a | `TRIM(src)` |
| LOOKUP_FK | 49 | yes | 001a | already designed in v2 §5.3 |
| SKIP | 39 | yes (marker) | 001a | omits column from SELECT list; no SQL emitted |
| DIRECT_COPY | 11 | yes | 001a | identity, formerly named COPY |
| UPPERCASE | 3 | yes | 001a | `UPPER(src)` |
| CAST_INT | 2 | yes | 001a | `CAST(src AS INTEGER)` |
| CAST_VARCHAR | 1 | yes | 001a | `CAST(src AS VARCHAR)` |
| CAST_BOOLEAN | 1 | yes | 001a | `CAST(src AS BOOLEAN)` |
| CAST_NUMERIC | 1 | yes | 001a | `CAST(src AS NUMERIC)` |
| LOWERCASE | 1 | yes | 001a | `LOWER(src)` |
| CONSTANT | 1 | yes | 001a | unconditional literal, semantics differ from v2's DEFAULT — payload value emitted as PG literal regardless of source column |

**Totals:** 325 mapping rows mechanical (001a scope) + 852 non-mechanical (001b scope) = 1177 ✅
Verification: 130+86+49+39+11+3+2+1+1+1+1+1 = 325 ✅ (UPPERCASE=3, LOWERCASE=1 per F4 fix)

**Note on CONSTANT vs DEFAULT semantics:** v2 §5.4 designed DEFAULT as `COALESCE(src, payload.value)`. The actual code CONSTANT is `payload.value` regardless of src (no COALESCE). The semantic difference matters: CONSTANT is "force this value", DEFAULT was "fallback if NULL". Goal 001a will implement CONSTANT per actual semantics. If a future mapping needs the DEFAULT semantics, it gets added as a separate transform code in a later goal.

---

## §2 — Goal 001a: foundations + audit wiring + mechanical transforms

**Executor scope:** complete this entire goal before starting Goal 001b. Goal 001b is a separate `_01_PROMPT_002_*` cycle (new PROMPT → new PLAN → new approval → new EXEC).

### §2.1 — Baseline status (corrected per F2)

Status at start of v3-bis EXEC, verified against `_03_EXEC_001_audit_upsert_refactor.md` HALTED snapshot:

| ID | Action | Status | Path |
|---|---|---|---|
| B1 (pnpm test) | Capture `pnpm test` output of current baseline | **NOT YET CAPTURED** | — |
| B2 (debug-scale control) | Run debug-scale 20-cap DEMO + capture wall-clock + outcome | **NOT YET CAPTURED** | — |
| B3 (transform vocab + DB state) | SELECT DISTINCT column_mapping_transform; sys/audit/lineage counts; staging.wave1_* counts | **✅ CAPTURED** | `baselines/001-db-state-20260518_1710.txt` |
| B4 (audit + lineage state) | Per-table count + sample of audit.* and sys.sys_source_lineage_records | **PARTIALLY in B3 file** — to be re-captured as standalone per F2 | — (target: `baselines/001-audit-lineage-state-<TS>.txt`) |
| B5 (pg_dump freshness gate) | Verify ≤6h old; capture file path + size | **✅ PASSED** (mtime 13:47 UTC, ~4h old) | `/home/ubuntu/backups/heuresys_advanced_pre_phase2_20260518_1347.dump` (130 MB) |

Additional artefact already on disk (executor-initiative, beyond v3 baseline list):
- **Source-files SHA capture** (rollback anchor): `baselines/001-source-shas-20260518_1710.txt` — SHA-256 of every `apps/api/src/modules/brownfield-wave-executor/*.ts` file at EXEC start. Used as the "files-unchanged" anchor for §2.9 rollback.

**New baseline B6** (must be captured at EXEC start of 001a, retained from v3):
- `EXPLAIN (ANALYZE, BUFFERS)` of the current JS-side UPSERT execution plan for top-3 most-frequent target tables (sys_skills, sys_position_skill_requirements, sys_skill_taxonomy_edges) at debug scale. Stored at `B6_explain_baseline_<TS>.txt`. Required for §2.8 R2 performance comparison.

**Step 0 of EXEC (fresh pg_dump per §2.7):** even though B5 dump is still within the 6-hour gate, create a fresh dump as the first EXEC action to maximize the safety margin. This is in addition to honouring B5.

### §2.2 — Code change plan (001a only) — corrected per F3

Files to modify (path relative to `D:\heuresys-advanced\`):

| # | path | current state | intended change | risk | covered by test |
|---|---|---|---|---|---|
| 1 | `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts` (**NEW**) | — | New module exporting `compileTransform(transformCode, payload, srcRef): SqlFragment`. Supports the 12 mechanical codes from §1. Returns `{ sql: string, params: any[] }` always parameterized. Throws `UnsupportedTransformError` for JSON_EXTRACT and LINEAGE_SOURCE_NK (intentional, surfaces in validation in 001a). | medium | new test `transform-compiler.test.ts` |
| 2 | `apps/api/src/modules/brownfield-wave-executor/state-machine-persister.ts` (**NEW**) | — | New module exporting `persistTransition(runId, from, to, payload, failureReason?)`. Internally calls `auditWriter.writeRunLog(...)` to record the audit row AND updates `brownfield.import_runs.import_run_status` via `repository.updateRunStatus(...)` in a single transaction. **Alternative rejected:** inlining into `engine.ts` (couples orchestration to persistence, untestable without live DB). See footnote ¹ at end of §2.2 for the rationale of keeping this module separate from `audit-writer.ts`. | low | new test `state-machine-persister.test.ts` |
| 3 | `apps/api/src/modules/brownfield-wave-executor/audit-writer.ts` (**NEW**) | — | Three low-level functions: `writeValidationResult(runId, mappingId, status, payload)`, `writeApprovalDecision(runId, decision, decidedBy, rationale)`, `writeRunLog(runId, fromStatus, toStatus, ts, eventPayload)`. Each writes one row to the corresponding `audit.*` table. Used by `state-machine-persister.ts` (writeRunLog) and by the engine directly (writeValidationResult, writeApprovalDecision). | low | new test `audit-writer.test.ts` |
| 4 | `apps/api/src/modules/brownfield-wave-executor/engine.ts` (**MODIFY** — refactor `executeUpsert()` in-place per F3) | per-row JS UPSERT with heap pressure at 47k; `executeUpsert()` is an internal function in this file, not a separate module | rewrite `executeUpsert()` as SQL-side `INSERT … SELECT … FROM staging.wave1_<target> ON CONFLICT … DO UPDATE`. SELECT list generated by `transform-compiler`. Mappings using unsupported transforms (JSON_EXTRACT/LINEAGE_SOURCE_NK in 001a) → recorded in `audit.import_validation_results` with `validation_status='SKIPPED_UNSUPPORTED_TRANSFORM_V1'` via `auditWriter.writeValidationResult(...)`, NOT included in INSERT. The pipeline continues; supported transforms get upserted normally. Wire state-transition calls to `state-machine-persister.persistTransition(...)` at every transition; `failure_reason` populated on FAILED with `{class, message, stack_head, ref}`. | medium-high | new integration test `wave1-debug-scale.test.ts` |
| 5 | `apps/api/src/modules/brownfield-wave-executor/repository.ts` (**MODIFY** — lineage INSERT per F3) | already has lineage INSERT helper; `source_lineage_import_run_id` parameter not yet supplied by callers, so column inserts NULL | extend the existing lineage INSERT SQL + helper signature to accept and bind `:current_run_id` for `source_lineage_import_run_id`. Engine.ts callers (modified in item 4) pass the active run id. | low | existing test `repository.test.ts` updated to assert `source_lineage_import_run_id` is NOT NULL when supplied |
| 6 | `package.json` (**MODIFY**) | — | add `pg-format@^1.0.4` as dependency (for `%I` and `%L` formatters used in transform-compiler). | low | covered by `transform-compiler.test.ts` |
| 7 | `apps/api/src/modules/brownfield-wave-executor/__tests__/transform-compiler.test.ts` (**NEW**) | — | Tests for all 12 mechanical transforms + the SQL injection adversarial test (R2 from v2): payload = `"'); DROP TABLE sys.sys_users; --"` must be quoted via `%L`, resulting SQL must be string literal, executing against staging must not affect sys.sys_users. | low | self-covering |
| 8 | `apps/api/src/modules/brownfield-wave-executor/__tests__/wave1-idempotency.test.ts` (**NEW**) | — | Runs debug-scale 20-cap pipeline twice consecutively. Asserts: target table count_delta = 0 between runs, lineage count_delta = 0, audit.import_run_logs count_delta = exactly +2 (the 2 new run-completed entries), audit.import_validation_results count_delta = 0 (no rows changed → no validations). | low | self-covering |

**¹ Footnote (per F3) — Rationale for two new modules (`state-machine-persister.ts` + `audit-writer.ts`) instead of one consolidated module:**

The two modules are layered, not redundant:

- **`audit-writer.ts`** is the **low-level primitive layer**: three thin functions each writing one row to one `audit.*` table. No state-machine logic, no transactions composed across multiple writes, no coupling to `state.ts`. Pure "write this audit row" semantics. Easy to unit-test by mocking the repo handle.
- **`state-machine-persister.ts`** is the **high-level atomic layer**: one function (`persistTransition`) that atomically persists a state transition (UPDATE `brownfield.import_runs` + INSERT one audit row via `audit-writer.writeRunLog`) inside a single caller-supplied transaction. It is the only module that knows transitions are atomic with their audit log. It calls into `audit-writer` (composition, not duplication).

Why not consolidate into one module:

1. **Different transaction boundaries.** State transitions are atomic with their audit row (must commit together or fail together). Validation results and approval decisions are NOT atomic with any state transition — they are emitted independently, often in batches, and may be re-issued without changing state. A single module would either force every audit write to participate in a state-transition transaction (over-coupling) or expose two modes (defeating the purpose of consolidation).
2. **Different call sites.** `state-machine-persister.persistTransition()` is called by the orchestrator at state-machine transitions (5-7 times per run). `audit-writer.writeValidationResult()` is called by the engine at validation-batch completion (many times per run). `audit-writer.writeApprovalDecision()` is called at approval gates (1-2 times per run). Mixing these into one module conflates very different call patterns and lifecycles.
3. **Different test surface.** `audit-writer.test.ts` is a pure repo-mock unit test (no state machine). `state-machine-persister.test.ts` includes the transition matrix from `state.ts` and tests illegal transitions are rejected, FAILED carries the structured payload, etc. Each module has its own clean test surface.

**Consolidation option for Cowork to consider** if the above rationale is not compelling: merge into one module `audit-machine.ts` exposing all four functions (`persistTransition`, `writeValidationResult`, `writeApprovalDecision`, `writeRunLog`). Cost: tests share a file (~200 LoC unit test file instead of two ~80 LoC files). Benefit: one fewer file in the tree. Cowork to decide in the v3-bis review.

### §2.3 — DB write plan (001a only)

| object | write_type | trigger | expected rows debug-scale | expected rows full-scale (still 001a) | reversibility |
|---|---|---|---|---|---|
| audit.import_run_logs | INSERT only | every state transition | ~5-8 per run | ~5-8 per run | rollback via DB restore; logical undo not required |
| audit.import_validation_results | INSERT only | per validated mapping row + per skipped mapping (UNSUPPORTED) | ~30-50 per debug run | ~1500-2000 per full run | rollback via DB restore |
| audit.import_approval_decisions | INSERT only | per approval gate decision | 1-2 per run | 1-2 per run | rollback via DB restore |
| brownfield.import_runs | UPDATE on existing | state transitions, finished_at, failure_reason | 1 row per active run | same | UPDATE has prior state recoverable from audit logs |
| brownfield.import_runs | INSERT new | when launching a new test run | 1-2 during EXEC testing | — | DELETE WHERE import_run_id IN (...) if needed |
| brownfield.import_runs | UPDATE 1 row (one-time) | Path B execution for stuck `67d51a90-...` | 1 | — | reversible via `UPDATE … SET status='RUNNING', failure_reason=NULL, finished_at=NULL WHERE import_run_id='67d51a90-...'` |
| sys.sys_source_lineage_records | INSERT during UPSERT phase | per emitted lineage row | tens per run | hundreds per run | rollback via DB restore; partial rollback per-run-id via DELETE |
| sys.sys_skills, sys.sys_skill_taxonomy_edges, etc. | INSERT/UPDATE via SQL-side UPSERT | per supported mapping row | hundreds per debug run | depends on how many of 325 mechanical mappings are exercised by 001a runs (probably all that match available staging data) | rollback via DB restore |
| staging.wave1_* | unchanged | as today | as today | as today | as today |

### §2.4 — Transform compiler design (001a, mechanical only)

12 codes to compile. Each SQL fragment uses `pg-format`:
- `%I` for identifiers (table/column names)
- `%L` for literal values (always escaped, never raw-concatenated)
- Named parameters for runtime values

Fragments (using `pg-format` style):

```
DIRECT_COPY:        format('%I', src_col)
CAST_TIMESTAMPTZ:   format('CAST(%I AS TIMESTAMPTZ)', src_col)
CAST_INT:           format('CAST(%I AS INTEGER)', src_col)
CAST_VARCHAR:       format('CAST(%I AS VARCHAR)', src_col)
CAST_BOOLEAN:       format('CAST(%I AS BOOLEAN)', src_col)
CAST_NUMERIC:       format('CAST(%I AS NUMERIC)', src_col)
TRIM:               format('TRIM(%I)', src_col)
UPPERCASE:          format('UPPER(%I)', src_col)
LOWERCASE:          format('LOWER(%I)', src_col)
CONSTANT:           format('%L', payload.value)                 -- literal, src ignored
SKIP:               (no SQL fragment; column omitted from SELECT list)
LOOKUP_FK:          format('(SELECT %I FROM %I.%I WHERE %I = %I)', 
                           target_pk_col, target_schema, target_table, lookup_col, src_col)
```

**Injection safety**: `pg-format`'s `%L` and `%I` are the canonical PostgreSQL escape mechanisms; no concatenation of user-controlled strings happens outside these formatters. The adversarial test in `transform-compiler.test.ts` will verify this with the payload `"'); DROP TABLE sys.sys_users; --"`.

**Unsupported transforms in 001a**: JSON_EXTRACT and LINEAGE_SOURCE_NK call sites in `engine.ts::executeUpsert()` invoke `compileTransform()`, which throws `UnsupportedTransformError('JSON_EXTRACT', mapping_id)`. The executor catches this, calls `auditWriter.writeValidationResult(...)` with status `SKIPPED_UNSUPPORTED_TRANSFORM_V1`, and continues with the next mapping. No silent skipping; every skip is recorded forensically.

### §2.5 — Lineage backfill decision (carry over from v2 §6, unchanged)

**Path B confirmed**: stuck run `67d51a90-...` transitioned to FAILED with `failure_reason = {"class":"STALE", "message":"Pre-refactor in-memory state, superseded by audit-wired engine", "ref":"Goal 001a §2.5 Path B"}`. `finished_at = now()` at transition time. The 52 NULL lineage rows are left as documented pre-history. All new runs after refactor populate the FK correctly.

### §2.6 — Acceptance criteria (001a)

1. `pnpm test` exit code = 0, passing ≥ 220 (was 218 baseline + 2 new test files added: `transform-compiler.test.ts` and `wave1-idempotency.test.ts`; the 219th still-failing test must be the same as B1 baseline)
2. `transform-compiler.test.ts` injection test PASSES (payload doesn't execute as SQL, sys.sys_users count unchanged)
3. `wave1-idempotency.test.ts` PASSES (double-run produces count_delta = 0 on target tables)
4. Debug-scale 20-cap run completes end-to-end with `brownfield.import_runs.import_run_status = 'COMPLETE'` (not stuck in RUNNING/VALIDATING)
5. After debug-scale run: `SELECT count(*) FROM audit.import_run_logs WHERE import_run_id = <new>` ≥ 5
6. After debug-scale run: `SELECT count(*) FROM sys.sys_source_lineage_records WHERE source_lineage_import_run_id = <new>` > 0 (any positive count proves FK populated)
7. After debug-scale run: `SELECT count(*) FROM audit.import_validation_results WHERE import_run_id = <new> AND validation_status = 'SKIPPED_UNSUPPORTED_TRANSFORM_V1'` ≥ 1 (proves the unsupported-transform escape path is exercised)
8. `git log --oneline | head -15` shows ≥ 7 atomic commits attributable to Goal 001a (one per code change item §2.2)
9. Path B execution: `SELECT import_run_status, failure_reason, finished_at FROM brownfield.import_runs WHERE import_run_id = '67d51a90-...'` returns `FAILED`, structured payload, non-NULL finished_at
10. Pre-existing FK integrity in target sys.* schema: still 0 orphans (verifies UPSERT didn't introduce any)

**A8 NOTE**: the v2 acceptance criterion A8 ("`sys.sys_skills ≥ 5000` after full-scale run") is **NOT** included in 001a. Full-scale 47k verification is deferred to 001b after JSON_EXTRACT and LINEAGE_SOURCE_NK are also supported. This is the explicit cost of segmentation.

### §2.7 — Turn budget for 001a (revised per F2)

| step | turn budget | notes |
|---|---|---|
| Step -3: B1 capture (`pnpm test` baseline) | 1 | tunnel must be up; output to `baselines/B1_pnpm_test_<TS>.txt` |
| Step -2: B2 capture (debug-scale 20-cap control run) | 2 | wall-clock ~5-7min for the run itself + capture step; output to `baselines/B2_debug_run_<TS>.log` |
| Step -1: B4 capture (audit/lineage standalone state snapshot) | 0.5 | minor SSH query; output to `baselines/B4_audit_lineage_state_<TS>.txt` |
| Step 0: fresh pg_dump | 1 | per §2.1 instruction even though B5 still in window |
| Step 1: B6 EXPLAIN baseline capture | 1 | top-3 target tables under current JS-side path |
| Step 2: transform-compiler.ts + test (12 codes + injection test) | 6 | |
| Step 3: state-machine-persister.ts + test | 3 | |
| Step 4: audit-writer.ts + test | 2 | |
| Step 5: repository.ts modification (lineage param) + test update | 1 | per F3: lineage logic lives in repository.ts + engine.ts, not a separate module |
| Step 6: engine.ts wiring (state-machine-persister + audit-writer calls) | 3 | |
| Step 7: engine.ts::executeUpsert() refactor in-place | 4 | per F3: not a separate module |
| Step 8: wave1-debug-scale.test.ts (integration) | 3 | |
| Step 9: wave1-idempotency.test.ts | 2 | |
| Step 10: package.json pg-format dep | 0.5 | |
| Step 11: Path B execution (stuck run → FAILED) | 0.5 | |
| Step 12: full debug-scale 20-cap verification | 2 | |
| Step 13: `_04_REPORT_001a` write + mirror | 1 | |
| **Sub-total** | **33.5** | |
| Buffer for escalation/debug | 5 | |
| **Hard cap 001a** | **~38.5 → round to 40** | |

Escalation policy: if turn 38 is reached and §2.6 verification is not entering final phase, stop, write `_04_REPORT_001a_partial.md`, escalate to Cowork (was "turn 33" in v3; bumped proportional to new cap per F2 mechanical adjustment).

### §2.8 — Risk register (001a)

Carried over from v2 §9 with one removal and one tightening (numbering preserved):

1. SQL injection through transform_payload (medium/high) — mitigated via `pg-format`%L/%I in §2.4 + adversarial test
2. Performance regression on debug-scale vs. JS-side (low/medium) — mitigated via B6 EXPLAIN baseline + comparison in `_04_REPORT_001a`
3. FK orphans introduced by stale lookup cache (medium/high) — mitigated by acceptance criterion 10 (re-check FK integrity post-run)
4. Test 219 (currently failing) starts passing for wrong reason (low/medium) — mitigated by capturing the exact test name in B1 and asserting in acceptance criterion 1 that the same one is still failing
5. Audit table writes deadlock with target-table writes under load (low/high) — mitigated by single-transaction-per-state-transition design + retry-on-deadlock at engine level
6. Memory leak in transform-compiler if cached strategies hold references (low/low) — mitigated by stateless compiler design (each call returns fresh fragment)
7. ~~Wave 2/3/4 mapping additions break new dynamic SQL if vocab grows~~ → **PARTIALLY MATERIALIZED**: the vocab already turned out to be larger than assumed. Mitigation now in place: the executor escape-path (audit.import_validation_results with `SKIPPED_UNSUPPORTED_TRANSFORM_V1`) handles future growth gracefully without silent failure.
8. Idempotency violation (medium/medium) — mitigated by §2.4 transform-compiler rejecting timestamp-aware functions at compile time + acceptance criterion 3 (idempotency test)
9. **NEW**: Goal 001a leaves 852 mapping rows un-routed through new path (high/medium) — by design. Mitigated by Goal 001b in immediate succession. Acceptable risk because pre-001a state was 100% blocked.

### §2.9 — Rollback plan (001a, file paths corrected per F3)

For the 7-8 atomic commits proposed (one per code change item, plus 1-2 for tests):

```bash
# Standard rollback: revert in reverse order
git revert <commit_engine_wiring_and_executeUpsert_refactor>   # item 4 + item 6 from §2.2
git revert <commit_repository_lineage_param>                    # item 5 from §2.2
git revert <commit_audit_writer>                                # item 3
git revert <commit_state_machine_persister>                     # item 2
git revert <commit_transform_compiler>                          # item 1
git revert <commit_package_json_pgformat>                       # item 6 (package.json)

# Verify post-revert: pnpm test returns to B1 baseline state
pnpm test
```

DB-side rollback for Path B execution (only DB write not covered by git revert):
```sql
UPDATE brownfield.import_runs
   SET import_run_status = 'RUNNING',
       failure_reason = NULL,
       finished_at = NULL
 WHERE import_run_id = '67d51a90-7ad9-44e2-860d-0d2e0e945af8';
```

Full DB restore (if granular rollback insufficient):
```bash
ssh oracle-vm-default
sudo -u postgres pg_restore -d heuresys_advanced --clean --if-exists --no-owner \
  /home/ubuntu/backups/heuresys_advanced_pre_phase2_20260518_<TS>.dump
```
Estimated downtime: 3-5 minutes for 266MB DB.

---

## §3 — Goal 001b: non-mechanical transforms + full-scale verification

**Triggered by:** approval of `_04_REPORT_001a` by Cowork (`_05_REVIEW_001a` issued). Until then, 001b is OUT OF SCOPE for any work.

**Scope summary** (full PROMPT will be `_01_PROMPT_002_*` after 001a closes — these are anticipatory notes, not a binding spec):
- Add JSON_EXTRACT to transform-compiler (759 mappings, 64% of vocab)
  - Inspect `apps/api/src/modules/brownfield-wave-executor/transforms.ts` to extract current behavior
  - PG SQL fragment likely uses `jsonb_extract_path_text(%I, %L, %L, ...)` with path components from payload — injection-safe via `%L`
  - Additional adversarial test: malicious path components (e.g. `["__proto__"]`, SQL keywords) handled correctly
- Add LINEAGE_SOURCE_NK to transform-compiler (93 mappings, ~8% of vocab)
  - Domain-specific; requires reading `transforms.ts` to understand current semantics
  - Likely related to natural-key construction for lineage tracking
- Full-scale 47k run verification: `sys.sys_skills ≥ 5000`, wall-clock ≤ 10min, audit complete
- The v2 acceptance criterion A8 lives here.

**Anticipated 001b turn budget:** 20-25 turns. Refined when `_01_PROMPT_002` is written.

---

## §4 — Protocol notes for executor

1. **This v3-bis PLAN supersedes v2 + v3 in interpretation; v3-bis is the canonical at `_02_PLAN_001_audit_upsert_refactor.md`.** Earlier versions live in git history. The standalone `_02_PLAN_001_audit_upsert_refactor_v3.md` file (if present) is removed by F5 as a duplicate.

2. **`_03_EXEC_001_audit_upsert_refactor.md` HALTED is preserved.** Do NOT modify it. When EXEC resumes for 001a, create a new file `_03_EXEC_001a_audit_upsert_refactor.md`. When 001b starts, `_03_EXEC_001b_*.md`.

3. **Baselines previously captured under v2 EXEC turns 1-3 are reusable.** Per §2.1 corrected status: B3 (vocab + DB state) and the executor-initiative source-files SHA capture are on disk and valid. B1, B2, B4 must still be captured (Steps -3, -2, -1 of EXEC). B5 dump gate currently PASSED but Step 0 refreshes it for maximum safety margin.

4. **The acknowledgement from Cowork**: the halt at turn 3 of v2 EXEC with full transparent escalation, three articulated options, and an honest budget revision was exemplary execution of the `cowork_code_exchange/` protocol. This is the pattern of behavior that justifies the protocol's overhead and should be reinforced. The "cost" of halting at turn 3 (3 turns spent on baseline + 1 turn on escalation = 4 turns) is properly recorded as part of Goal 001 total budget; the 40-turn cap on 001a is in addition to those 4, not replacing them.

5. **Approval to proceed** with v3-bis: when CLI confirms it has read this v3-bis PLAN and is ready to begin EXEC for 001a, Cowork will issue "PLAN 001 v3-bis approved, proceed with EXEC for Goal 001a" in chat. EXEC begins at that point with Step -3 (B1 capture) of §2.7.

---

*End of _02_PLAN_001_audit_upsert_refactor.md v3-bis*
