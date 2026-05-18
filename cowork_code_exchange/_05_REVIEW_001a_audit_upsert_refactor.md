# _05_REVIEW_001a_audit_upsert_refactor.md

**Protocol phase:** REVIEW (supervisor closure, formal)
**Goal ID:** 001a
**Slug:** audit-upsert-refactor
**Author:** Cowork (this claude.ai web session)
**Authored:** 2026-05-18 ~22:00 GMT+2
**REPORT under review:** `_04_REPORT_001a_audit_upsert_refactor.md` (v2 final, supersedes `_04_REPORT_001a_interim.md`), SHA-256 per CLI summary
**PLAN baseline:** `_02_PLAN_001_audit_upsert_refactor.md` v5
**Decision:** ✅ **ACCEPTED. Goal 001a is CLOSED.**

---

## §1 — Closure decision

Goal 001a is **accepted as closed**. All 11 PLAN v5 §2.6 acceptance criteria are met with evidence verified in REPORT §2. The contract is satisfied.

**The path to closure was instructive**: Goal 001a took 5 PLAN revisions (v1 → v2 → v3 → v3-bis → v4 → v5), one closure attempt rejected (interim REPORT), and 30 EXEC turns to reach this state. The reason is not that Goal 001a was hard — it's that the PLAN drafting process exposed multiple supervisor errors that the protocol surfaced before they became silent technical debt. Each revision closed a specific kind of gap:

- v2 closed three security/correctness gaps in v1 (R1-R3 from Cowork)
- v3 closed a scope-assumption gap revealed by CLI's discovery of 14 transform codes (not 5)
- v3-bis closed five accuracy gaps in v3 (math, baselines, paths, counts, canonical path)
- v4 closed two inferential gaps in v3-bis exposed by CLI's evidence E1-E5
- v5 closed a step↔acceptance consistency gap exposed by CLI's transparent v4 closure attempt

Every closure increased the PLAN's verifiable surface. By v5, the PLAN was a contract that could not be ambiguously satisfied. Goal 001a's value is not just the delivered code — it's also the demonstration that the `cowork_code_exchange/` protocol, properly used, scales the supervisor's ability to detect their own errors.

---

## §2 — Acceptance criteria — supervisor verification

Cross-check of REPORT §2 evidence against PLAN v5 §2.6 contract:

| # | Criterion | REPORT evidence | Supervisor verdict |
|---|---|---|---|
| 1 | `pnpm test` ≥220 passing, same 219th skipped | 276 passed + 5 skipped (281 total). 1 original gated still skipped, 4 new gated added. 276 ≥ 220 ✓. The 219th-original test is the same `brownfield-wave-executor.integration.test.ts:107` REAL_EXECUTE-gated. | ✅ ACCEPTED |
| 2 | Injection adversarial PASSED | `transform-compiler.test.ts` 52/52 green, A14 fixtures (4 injection vectors) pass via emittedSqlIsSafe tokenizer. | ✅ ACCEPTED |
| 3 | Idempotency PASSED post-refactor | Step 11.c (turn 28): 257.4s, 0 target-table count_delta across 11 monitored sys.* tables. RC=0. Critical — this also verifies that the v5 SQL-side refactor preserves the v4 hybrid's idempotency behavior. | ✅ ACCEPTED |
| 4 | Debug-scale state=COMPLETE | wave1-debug-scale-v4 (turn 27): 128.3s, state=COMPLETE. | ✅ ACCEPTED |
| 5 | audit.import_run_logs ≥5 + state sequence | In-test assertion + sequence check (RUN_CREATED → STATE_STAGING → STATE_VALIDATING → STATE_UPSERTING → STATE_COMPLETE). Coherent with run-logger.ts + service.ts wiring (10 logRunEvent call sites). | ✅ ACCEPTED |
| 6 | Lineage with non-NULL run_id > 0 | In-test assertion. SQL-side path preserves existing `batchWriteLineage` semantics via inline lineage JOIN — non-regression of E1-confirmed behavior. | ✅ ACCEPTED |
| 7 | ≥1 SKIPPED_UNSUPPORTED_TRANSFORM_V1 per run | In-test assertion. v4 hybrid escape path preserved per §2.10 #5 — JSON_EXTRACT (759) and LINEAGE_SOURCE_NK (93) column-mappings continue to produce SKIPPED audit rows. | ✅ ACCEPTED |
| 8 | ≥6 atomic commits | 8 commits enumerated by hash, plus this REPORT commit as 9th. Well exceeds floor. | ✅ ACCEPTED |
| 9 | Path B for `67d51a90-…` | SELECT result confirms FAILED + structured failure_reason ("STALE: pre-refactor in-memory state, superseded by audit-wired engine (Goal 001a v4 §2.5 Path B)"). | ✅ ACCEPTED |
| 10 | 0 FK orphans in lineage | In-test assertion. Preserved post-refactor. | ✅ ACCEPTED |
| **11** | **SQL-side refactor delivered** | Sub-criteria (a)-(g) all verified. SQL-side `executeUpsertSqlSidePerMapping` in `upsert-sql.ts` (410 lines, NEW). engine.ts JS-side path wrapped `if (false)` per spec. Telemetry fallback (EXPLAIN FORMAT JSON) executed and shows single ModifyTable+Insert plan node — equivalent verification value to pg_stat_statements per §2.10 #4 advisory contingency. | ✅ ACCEPTED |

All 11 ✅. No criterion has a partial fulfillment that I'm letting slide.

---

## §3 — Scope deferrals — supervisor assessment

REPORT §7 documents 4 known limitations deferred to Goal 001b. Supervisor assessment of each:

### 3.1 — LOOKUP_FK convention misses on join tables (~3 mappings)

REPORT says: "v5 SQL-side surfaces this as `insert_failed: column "skills_id" does not exist`. v4 JS-side surfaced the same root cause via `fkResolver` returning null + INSERT NOT NULL FK violation."

**Supervisor verdict**: ACCEPTED as 001b scope. Critical observation — this is a **non-regression**, not a new failure introduced by the SQL-side refactor. The JS-side path failed on the same mappings; the SQL-side now surfaces the failure with a clearer message (column-not-exist vs. constraint-violation), which is actually an improvement in diagnostics. The fix proposed (introspect target schema at compile time, emit only existing columns) is sound and aligns with how `buildFkLookup` already filters in v4 JS code. **Estimated cost in Goal 001b**: 2-3 turns.

### 3.2 — Type coercion text→smallint (~2 mappings)

REPORT says: "Target columns like `learning_path_step_ordinal smallint` receive text from `staging_raw_record->>'col'`. JS-side post-coerced via `Number.parseFloat + Math.trunc`; SQL-side relies on PG implicit cast which fails for non-numeric strings."

**Supervisor verdict**: ACCEPTED as 001b scope. Same non-regression pattern. Fix proposed (expand CAST_* transform vocabulary to auto-wrap DIRECT_COPY when target type requires) is sound and extensible. **Estimated cost in Goal 001b**: 2 turns.

### 3.3 — Missing ON CONFLICT inference for sys_user_certifications

REPORT says: "no UNIQUE constraint that matches the conflict pattern; targetMeta.conflictInference is null → mapping skipped via `no_conflict_inference_available`."

**Supervisor verdict**: ACCEPTED as 001b scope with caveat. Fix proposed offers two options:
- (a) add UQ to target table via migration — out of 001a/001b scope per "Forbidden objects" (`sys.sys_schema_migrations` is frozen)
- (b) emit `ON CONFLICT DO NOTHING` for tables without natural-key UQ

Option (b) is preferable but has semantic implications: it means certifications that conflict on (tenant, user, external_id) silently DO NOTHING. For an audit-quality data pipeline this might be wrong — we may want to ERROR-and-record instead. Recommend Goal 001b PROMPT include explicit decision on this trade-off. **Estimated cost in Goal 001b**: 1-2 turns + 1 turn supervisor decision.

### 3.4 — pg_stat_statements not enabled

REPORT says: "Cowork action item: enable pg_stat_statements extension on the cluster for future telemetry needs (requires CREATE EXTENSION + cluster config + restart)."

**Supervisor verdict**: ACCEPTED as supervisor-side maintenance, NOT 001b scope. This is infrastructure work that doesn't belong inside a code goal. Will be tracked separately — see §6 below.

### 3.5 — Net summary

The 4 deferrals are clean: all are documented, all have proposed fixes with estimated cost, none introduce regression vs. pre-001a state. The pipeline now skips the same ~6 problematic mappings as before but with much better forensic visibility (audit rows with explicit reasons). This is functional progress, not stagnation.

---

## §4 — Budget retrospective

### 4.1 — Numeric variance

REPORT §8 reports: PLAN estimate 30, actual ~30, variance 0. This is remarkable — PLAN v5 was the first revision to predict the actual cost with zero error.

But that hides the iteration cost. Total work for Goal 001a:
- 5 PLAN revisions (Cowork) + 1 PLAN consumed (CLI's interim)
- 1 closure attempt rejected
- 30 EXEC turns
- Estimated ~15 turns of supervisor-side authorship time (PLAN drafting + reviews + REVIEW)

The 30 EXEC turns came in well under the 40-turn cap with 10 turn buffer unused. But the PLAN drafting overhead was high. The right question is not "did we beat the cap?" — we did — but "how much of that 30-turn EXEC was spent navigating PLAN errors?"

Rough decomposition:
- Genuine technical work (transform-compiler, run-logger, engine wiring, SQL-side refactor, tests, Path B): ~20 turns
- Protocol/discovery overhead (B1/B2 captures, evidence gate E1-E5, archiving): ~5 turns
- PLAN-amendment overhead (turn 23 v4→v5 archive; embedded inside other turns): ~3 turns
- Reporting (interim REPORT + final REPORT + EXEC log appends): ~2 turns

The PLAN-amendment overhead is the cost of supervisor errors. ~3 turns out of 30 — 10% of EXEC budget consumed re-navigating drafting mistakes. In an idealized version of this Goal where the supervisor's PLAN v1 was correct, total EXEC would have been ~27 turns and there would have been one rejected closure attempt fewer.

### 4.2 — Lessons for future estimate

- **PLAN v5 §2.7 estimate accuracy**: was high. Each sub-step was estimated 1-2 turns and that's what each took. Pattern: when steps are well-decomposed and the executor knows what to do, estimates converge to reality fast. When steps are exploratory (like Step 11.a.0 pre-flight in v5), give 1-2 turn buffer.
- **Closure attempts**: budget for 1 rejected attempt in any goal with non-trivial code change. The "first REPORT is interim" pattern (codified in README versioning convention) should be expected, not exceptional.
- **Discovery turns are unavoidable**: at least 3-5 turns at the start of any EXEC must be baseline + reconnaissance. Trying to compress this is false economy.

---

## §5 — Bias catalog input

This section is the input to the standing bias catalog that future supervisors (Desktop Cowork or anyone) should read at session start. It captures patterns of executor strength and supervisor weakness observed during Goal 001a.

### 5.1 — Executor strengths to preserve

Three patterns from CLI in Goal 001a that should be reinforced:

**Pattern E1 — Evidence-gated halt (turn 8 of v2 EXEC, then again turn 22 closure attempt)**. When CLI's reading of the codebase contradicted the PLAN's assumptions, CLI halted EXEC with a tabular comparison ("PROMPT/PLAN assertion vs Reality from engine.ts"), proposed 3 explicit options, recommended one with rationale, and waited. No silent absorption, no shortcut, no inflated cost estimate to inflate budget. This is the protocol working as designed.

**Pattern E2 — Transparent scope-deferral with explicit ASK**. CLI's interim REPORT §6.1 documented the deferred SQL-side refactor with full root cause + recommendation. This is what made supervisor intervention possible. Had CLI silently logged the hybrid as "complete," the gap would have shipped. The protocol value here is the executor's *willingness to disclose* divergence from PLAN intent, even when the literal acceptance criteria were met.

**Pattern E3 — Proactive edge case surfacing**. CLI noted (at v5 EXEC start) a third edge case (UUID NK fallback row-skip) that PLAN v5 §2.10 advisory had not anticipated. CLI proposed handling it in sub-step 11.a.0 pre-flight, asking for 1 turn of investigation. No assumption-and-proceed, no skipping the case.

These three patterns together describe the executor that the protocol is designed to develop. They should be cited as the gold standard for future executors in the handoff to Desktop Cowork.

### 5.2 — Supervisor weaknesses to compensate for

The supervisor in this session (me, Cowork claude.ai web) made 12 substantive errors over Goal 001a:

1. Topology assumption: two DBs separate (was: brownfield intra-DB)
2. Repo path assumption: VM (was: Windows local)
3. Column name in Goal B' spec: `import_run_id` (was: `source_lineage_import_run_id`)
4. Row count expectation in Goal B' Action 4: 49 (was: 0 — read `reltuples` as exact)
5. Reconciliation instruction: write `=0` in HANDOFF (was: =1 — DB factually had 1)
6. PLAN v3 §0 math: 27%/72% inverted as 75%/25%
7. PLAN v3 §2.1 baselines: invented status of files that didn't exist
8. PLAN v3 §2.2 file paths: `executeUpsert.ts`, `lineage-writer.ts` (don't exist — code lives in `engine.ts`, `repository.ts`)
9. PLAN v3 §1 vocab counts: UPPERCASE/LOWERCASE 2/2 (was: 3/1)
10. PLAN v3 §4 procedural: "overwrite in place" while generating `_v3.md` sibling — inconsistency
11. PLAN v3-bis sovrascrittura senza considerare cronologia file (corretto da Enzo)
12. PLAN v4 §2.2/§2.6 consistency gap: SQL-side refactor mandated in step, not verified in acceptance

Classified by failure mode:
- **Errors of unverified assumption** (1, 2, 3, 4, 5): supervisor inferring from limited context without asking the executor or filesystem
- **Errors of inattention on verifiable details** (6, 7, 8, 9): math, paths, counts that could have been checked but weren't
- **Errors of internal consistency** (10, 12): document contradicts itself between sections
- **Errors of UX consideration** (11): not considering executor/user workflow cost

The discipline applied from error #6 onward (the "5 patterns" — math by calc not memory, paths from authoritative source, conditional assertions on filesystem, executor-verified specs, internal re-read before release) reduced but did not eliminate later errors. Specifically, error #12 occurred AFTER the discipline was articulated — meaning the patterns weren't sufficient. The missing pattern was the cross-check "every step has matching acceptance criterion AND vice versa."

That pattern is now codified in PLAN v5 §-1 standing lesson. It should be part of supervisor onboarding documentation in the handoff.

### 5.3 — Pattern not yet observed but worth watching

In a longer goal stream (Goal 001b, 002+), watch for executor **fatigue tolerance**: does CLI maintain the same evidence-gated discipline at turn 30+ of a 60-turn goal as it did at turn 8? Goal 001a's 30-turn arc didn't push this. If 001b stays compact, we won't learn it there either. The risk pattern would be: executor accepts a smaller PLAN ambiguity at high turn count because halting is "expensive" by then. The mitigation is the existing escalation policy (halt at turn ≥0.85 × cap) — but it's still worth instrumenting.

---

## §6 — Open items for next supervisor

Tracked here as state-passing into the Desktop Cowork handoff. Each item has explicit owner indication.

### 6.1 — Cowork-side action items (not part of any code Goal)

| # | Item | Owner | Priority |
|---|---|---|---|
| O1 | Enable `pg_stat_statements` extension on `oracle-vm-default` cluster (CREATE EXTENSION + config + restart) | Next supervisor / Enzo decision | medium — improves future telemetry |
| O2 | Update cowork-exchange pre-commit hook validator to recognize: `_04_*_001a_*` naming variants (currently warns), `_04_*_interim.md` pattern, multi-file PLAN/REPORT versioning per README convention | Next supervisor | low — non-blocking, just warnings |
| O3 | Emit fresh APPROVAL signed against `_02_PLAN_001_audit_upsert_refactor.md` v5 (current canonical, SHA `f6919b79…`). Existing APPROVAL is signed against v3-bis (SHA `5aa42fa7…`) — stale per validator | Next supervisor | low — protocol completeness |
| O4 | Investigate the 3 unattributed files (`_00_STATE_001.md`, `_02b_APPROVAL_001.md`, `_SKILL_UPDATE_MEMO.md`) found in `cowork_code_exchange/` during turn 9 archiving. Origin unknown — possibly parallel session, possibly previous Goal in another channel. Read them directly (Desktop Cowork has filesystem access — current Cowork web does not) | Next supervisor (Desktop) | low — curiosity / hygiene |

### 6.2 — Goal 001b scope (the next executor task)

Goal 001b PROMPT will need to address:

- **In-scope (from PLAN v5 §3 + REPORT §7)**:
  - JSON_EXTRACT transform support (759 mappings, 64% of vocab) with dedicated injection-test design for jsonb path manipulation
  - LINEAGE_SOURCE_NK transform support (93 mappings, ~8%) — requires inspection of `transforms.ts` for current semantics
  - LOOKUP_FK target-schema introspection fix (REPORT §7 item 1)
  - Type coercion auto-wrap for non-text-compatible target columns (REPORT §7 item 2)
  - `sys_user_certifications` ON CONFLICT decision (DO NOTHING vs ERROR-and-record — see §3.3 above for trade-off)
  - Full-scale 47k Wave 1 verification — A8 from original PLAN scope ("sys.sys_skills ≥ 5000, wall-clock ≤ 10min, audit complete")
- **Estimated turn budget**: 25-30. Allocation rough: 5 (JSON_EXTRACT compile+test+adversarial), 5 (LINEAGE_SOURCE_NK inspect+compile+test), 3 (LOOKUP_FK introspection fix), 2 (type-coerce auto-wrap), 2 (ON CONFLICT decision implementation), 8 (full-scale verification + perf tuning if needed), 3 (REPORT + buffer).

### 6.3 — Standing lessons for handoff (from §5)

The handoff document to Desktop Cowork should include:
- The "step ↔ acceptance cross-check rule" (PLAN v5 §-1 lesson)
- The "DB-only forensic insufficient without code reading" rule (PLAN v4 §-1 lesson)
- The "executor pattern E1-E3" (preserve, do not erode)
- The "supervisor failure mode catalog" (§5.2 above) as input to error-avoidance discipline
- The "_interim.md naming convention" as standard for rejected closures (now documented in README)

---

## §7 — Commit instructions for Goal 001a closure

Recommended commit sequence after this REVIEW is posted to `cowork_code_exchange/`:

```bash
# 1. Stage and commit the REVIEW
git add cowork_code_exchange/_05_REVIEW_001a_audit_upsert_refactor.md
git commit -m "docs(cowork): goal 001a closure REVIEW (formal acceptance, post-mortem)"

# 2. Archive PLAN v5 as authoritative-locked version
# (No file rename needed; v5 is already canonical. The closure commit acts as the "freeze" marker.)
```

After this, Goal 001a is fully closed in protocol and in git history. The chain is:

```
_01_PROMPT_001 → _02_PLAN_001 (v1 → … → v5) → _03_EXEC_001a → _04_REPORT_001a (interim → final) → _05_REVIEW_001a
```

Goal 001b will start a fresh `_01_PROMPT_002_*` (new slug TBD by next supervisor).

---

## §8 — Acknowledgements

CLI executed Goal 001a with exemplary discipline. Two specific behaviors deserve commendation:

1. **Turn 8 of v2 EXEC**: halted with the E1-E5 evidence gate that revealed the v3-bis PLAN was built on two false-gap inferences. Had CLI not done this, ~30 turns would have been spent building solutions to non-problems while the real problem (`audit.import_run_logs` writes) remained marginalized.

2. **Turn 22 closure attempt with transparent §6.1 deferral**: documented the deferred SQL-side refactor honestly instead of silently shipping the hybrid as "complete." This is the single behavior that made closure quality possible. Without it, Goal 001a would have shipped with Problem 1 unresolved and the supervisor would have only discovered this when Goal 001b's full-scale test failed.

These behaviors are the protocol working as designed. They are what `cowork_code_exchange/` is for.

---

## §9 — Closure stamp

Goal 001a — **CLOSED, ACCEPTED**.

All 11 PLAN v5 §2.6 acceptance criteria met with verifiable evidence. All scope deferrals documented and routed to Goal 001b. Code, tests, audit machinery, and Path B execution delivered to specification. Protocol artefacts (PROMPT, PLAN v1-v5, EXEC log, REPORT interim + final, REVIEW) form a complete and self-documenting audit trail.

Next protocol action: handoff to Desktop Cowork for Goal 001b. Goal 001a artefacts remain canonical in `D:\heuresys-advanced\cowork_code_exchange\` for the duration of the project.

---

*End of _05_REVIEW_001a_audit_upsert_refactor.md*
