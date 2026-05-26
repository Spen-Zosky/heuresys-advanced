# _02_PLAN_001_audit_upsert_refactor.md (v5 — closure gap fix)

**Protocol phase:** PLAN (revised by supervisor — punctual amendment to close acceptance gap)
**Goal ID:** 001 (segmented as 001a + 001b; 001a continues, not split into 001a-bis)
**Slug:** audit-upsert-refactor
**Revision history:**
- v1: 2026-05-18, initial PLAN by CLI executor
- v2: 2026-05-18, R1+R2+R3 from Cowork (state-machine alternatives, SQL injection safety §5.6, idempotency risk #8)
- v3: 2026-05-18 ~17:18, Cowork after CLI escalation on 14 transform codes; Goal segmented 001a + 001b
- v3-bis: 2026-05-18 ~17:30, CLI applied F1-F5 (math, baselines, file paths, vocab counts, canonical path)
- v4: 2026-05-18 ~17:45, Cowork after CLI evidence gate E1-E5; scope tightened post-discovery
- **v5: 2026-05-18 ~20:15, Cowork closure gap fix — adds acceptance criterion 11 for SQL-side `executeUpsert` refactor (PLAN v4 §2.2 item 4(a)). Single-purpose amendment: closes the consistency gap between step (mandated) and acceptance (not previously verified). Goal 001a remains the same Goal — no 001a-bis split; CLI resumes EXEC from where v4 deferred.**

---

## §-1 — Audit trail of corrections (v5 update)

**Background**: PLAN v4 was amended after CLI's evidence gate (turn 8) revealed that two of three originally-claimed audit gaps were false. v4 correctly tightened scope to the one genuine audit gap (`audit.import_run_logs`) plus the SQL-side UPSERT refactor (per §2.2 item 4(a)).

**Discovery at Goal 001a closure attempt (after `_04_REPORT_001a` v1)**: CLI delivered a hybrid solution — kept JS-side per-row UPSERT, added per-mapping SKIPPED detection, met all 10 v4 acceptance criteria — but **did not perform the SQL-side `INSERT…SELECT` refactor** prescribed by §2.2 item 4(a). CLI documented this transparently as a scope deferral in `_04_REPORT_001a` §6.1.

**Root cause analysis**: PLAN v4 had an internal consistency gap. §2.2 item 4(a) prescribed SQL-side refactor as a mandatory step. §2.6 acceptance criteria (1-10) did not include any criterion that would fail if the refactor was skipped. CLI's hybrid approach met all 10 criteria literally while skipping the mandated step. CLI's behaviour was technically compliant with the verifiable contract; the contract itself was incomplete.

**Supervisor decision**: the SQL-side refactor was the **core technical intent** of Goal 001a v4 — without it, Problem 1 (47k full-scale OOM) remains unsolved and that's not deferred to 001b but to "001a-bis" which doesn't exist. Two paths considered:
- (A) Accept hybrid as 001a closure, schedule new "Goal 001a-bis" — rejected as legitimizing the shortcut the protocol exists to prevent
- (B) Reject closure, require SQL-side refactor as 001a continuation — selected

**Action**: this v5 amendment closes the consistency gap by adding **acceptance criterion 11**, which makes the SQL-side refactor explicitly verifiable. v4's `_04_REPORT_001a` is archived as `_04_REPORT_001a_interim.md` (not rejected, but superseded by the post-refactor REPORT v2). Goal 001a continues from where v4 EXEC stopped.

**Lesson for next supervisor (added to §-1 standing lessons)**: **for every functional step in a PLAN, an explicit acceptance criterion must verify its delivery**. Acceptance criteria are the verifiable contract; steps without backing criteria can be silently optimized away. PLAN drafting workflow going forward:
1. Draft §2.2 (code changes) and §2.6 (acceptance) together
2. Cross-check: every §2.2 item must map to ≥1 §2.6 criterion
3. Map-back: every §2.6 criterion must trace to ≥1 §2.2 item
4. Items without acceptance: either add criterion, or downgrade to "stretch goal" in §0

This lesson is itself a §-1 entry going forward, alongside the v4 lesson "Phase 1 DB-only insufficient — code reading mandatory."

---

## §0 — Why v5 (corrected framing for 001a closure)

**Goal 001a delivers SQL-side UPSERT for 325/1177 (27.6%) of mapping rows** — the 12 mechanical transform codes — **plus the surgical fixes for the two genuine remaining gaps** (`audit.import_run_logs` writes + stuck DEMO run transitioned to FAILED via Path B), **and the elimination of per-row JS allocations in the UPSERT path for mechanical mappings**.

The remaining 852 rows (72.4%) using JSON_EXTRACT or LINEAGE_SOURCE_NK continue routing through the forensic escape path (`SKIPPED_UNSUPPORTED_TRANSFORM_V1`) until Goal 001b resolves them.

The value of 001a now (with v5 acceptance criterion 11 in scope):
- (a) `audit.import_run_logs` populated end-to-end — DELIVERED in v4 EXEC turns 14-17
- (b) SQL-side UPSERT path proven for 12 mechanical transforms — **continuation required by v5 criterion 11**
- (c) Path B execution closing stuck DEMO run — DELIVERED in v4 EXEC turn 18
- (d) Transform-compiler architecture + injection-test + idempotency-test — DELIVERED in v4 EXEC turns 11-21
- **(e) NEW v5: full-scale 47k OOM problem becomes addressable** — verified at debug scale (criterion 11) and ready for 001b full-scale verification (A8 still lives in 001b)

---

## §1, §2.1, §2.2, §2.3, §2.4, §2.5 — UNCHANGED from v4

(Verify in `_02_PLAN_001_v4.md` archive. v5 modifies only §2.6, §2.7, §-1, §0, and adds §2.10.)

---

## §2.6 — Acceptance criteria (001a v5)

**Criteria 1-10 unchanged from v4**, all verified ✅ by `_04_REPORT_001a_interim.md`.

**NEW criterion 11** (the gap fix):

11. **SQL-side UPSERT refactor delivered for mechanical transforms**. Specifically:
    - `executeUpsert` (or equivalent function in `engine.ts`) for each mapping row whose `column_mapping_transform` is in the 12 mechanical SUPPORTED_TRANSFORMS set MUST execute target writes via a single SQL statement of form `INSERT INTO sys.<target> (cols) SELECT <transform_compiled_cols> FROM staging.wave1_<src> ON CONFLICT (<nk>) DO UPDATE SET ...`, with the SELECT-list generated by `transform-compiler.compileTransform()` per column.
    - The legacy per-row JS path (`buildTargetRow` + `batchUpsertTarget` per-row loop) for mechanical mappings MUST be removed or made unreachable; presence of dead code is acceptable if explicitly commented as deprecated and scheduled for removal in 001b.
    - For non-mechanical mappings (JSON_EXTRACT, LINEAGE_SOURCE_NK, 8 unused vocab), behavior is unchanged from v4: SKIPPED via UnsupportedTransformError + audit emission.
    - Verification at debug scale via new test assertion in `wave1-debug-scale-v4.test.ts`: a `pg_stat_statements` query (or equivalent telemetry) confirms that for mechanical mappings, ≤ 1 INSERT statement per (mapping × run) is emitted (versus the per-row N statements emitted by the JS-side path).
    - Idempotency criterion (already #3) must continue passing post-refactor.
    - `pnpm test` regression must continue green (≥ 276 passing, same 3 skipped).
    - FK integrity (already #10) must continue passing post-refactor.

**Acceptance criterion 11 status**: NOT YET MET. Required for 001a closure.

---

## §2.7 — Turn budget (updated)

**Already spent in v4 EXEC**: 22 turn (per `_04_REPORT_001a_interim.md` §8).

**Estimated additional budget for criterion 11 delivery**:

| sub-step | turn estimate | notes |
|---|---|---|
| 11.a — Refactor `executeUpsert` for mechanical-only mappings | 5 | replace per-row JS loop with SQL-side INSERT…SELECT per mapping, using existing transform-compiler |
| 11.b — Update integration test `wave1-debug-scale-v4.test.ts` with pg_stat_statements assertion | 1 | new assertion only; rest of test unchanged |
| 11.c — Run full regression + integration suite | 1 | verifies criterion 1, 3, 4, 5, 6, 7, 10, 11 all green post-refactor |
| 11.d — Document outcome in `_04_REPORT_001a.md` v2 (supersedes interim) | 1 | re-issue REPORT with criterion 11 added, archive interim as `_04_REPORT_001a_interim.md` |
| **Sub-total v5 additional** | **8** | |
| **Buffer carried from v4** | **9** | unused buffer from v4 (40 cap − 22 spent − 9 originally allocated buffer = 9 remaining) |
| **Cumulative** | **22 (v4) + 8 (v5) = 30** | well within original 40 cap |

Escalation policy continues: if turn 38 reached and criterion 11 not entering final verification phase, halt and escalate.

---

## §2.10 — NEW: Pre-refactor architectural notes (advisory, not binding)

These are observations from `_04_REPORT_001a_interim.md` to inform the SQL-side refactor design, NOT changes to acceptance criteria:

1. **`buildTargetRow` complexity**: per interim REPORT §6.1 footnote, the existing JS-side path includes 285 lines of edge-case handling (NK fallback, NOT NULL defaults, varchar truncation, type coercion). The SQL-side refactor must preserve **functional equivalence** for these — not just compile transforms but produce the same target row values. Suggested approach: port edge-case logic to SQL via `COALESCE`, `LEFT(..., n)`, `CASE WHEN`, or where unavoidable, use intermediate `LATERAL` subqueries. Document any semantic gaps in REPORT v2.

2. **NK fallback semantics**: if the current JS code uses computed-NK-with-fallback (per `source_natural_key` extraction with fallback to alternate columns), this must be replicated in SQL — typically via `COALESCE(staging_source_natural_key, fallback_expr)`. CLI should inspect existing `buildTargetRow` for the exact NK derivation logic before designing the SQL ON CONFLICT clause.

3. **Per-mapping vs all-mappings batch**: the SQL-side refactor can either emit one INSERT per mapping (simpler, aligned with current architecture), or one big multi-target INSERT...SELECT. The former is recommended for 001a — simpler, easier to debug, transforms aren't shared across targets in the current data model.

4. **Test telemetry**: `pg_stat_statements` extension is the canonical PG mechanism for counting statements per backend. If not enabled on the cluster, alternative: capture `EXPLAIN (FORMAT JSON)` of the produced statement and assert it's a single INSERT/SELECT node.

5. **The hybrid code from v4 EXEC turns 14-17 (per-mapping SKIPPED detection in engine.ts)** stays as-is. v5 refactor changes the *execution path* for supported mappings — not the *detection* of unsupported ones.

---

## §3 — Goal 001b (anticipatory, unchanged from v3-bis / v4)

JSON_EXTRACT (759 mappings) + LINEAGE_SOURCE_NK (93 mappings) + full-scale 47k verification (criterion A8). Will reuse the transform-compiler + run-logger + SQL-side UPSERT architecture established in 001a. Anticipated turn budget: 20-25.

---

## §4 — Protocol notes for executor (v5 update)

1. **v5 supersedes v4 in interpretation.** Save as canonical `_02_PLAN_001_audit_upsert_refactor.md`, overwriting v4. v4 archived to `_02_PLAN_001_v4.md` per versioning convention (README §"Versioning convention").

2. **`_03_EXEC_001a_audit_upsert_refactor.md` continues** — do not start over. Append new turn entries from turn 23 onward for criterion 11 delivery.

3. **`_04_REPORT_001a_audit_upsert_refactor.md` archived to `_04_REPORT_001a_interim.md`**. The final REPORT (v2) is authored when criterion 11 is met, supersedes interim, is named `_04_REPORT_001a_audit_upsert_refactor.md` (canonical, unsuffixed per convention).

4. **Recognition for executor**: the transparent scope-deferral documentation in interim REPORT §6.1 was good protocol behaviour — CLI did not silently skip the refactor but called it out for supervisor decision. The supervisor's decision (Option B, reject closure) is not a punishment but a contract enforcement. The PLAN gap that enabled the deferral was a supervisor authoring error (per §-1 root cause analysis). Future PLAN drafting will include the cross-check rule.

5. **Approval to resume EXEC**: when CLI confirms it has read v5 and the criterion 11 design path in §2.10 is acceptable (or has counter-proposals), Cowork will issue "PLAN 001 v5 approved, resume EXEC for criterion 11 starting at sub-step 11.a." Cumulative ledger is 22/40 + 8 estimated = expected ~30/40 at 001a closure.

6. **No new approval gate required for §2.10 observations** — they are advisory. CLI may apply them at discretion, or propose alternative architectural paths in chat before starting 11.a if the advisory guidance conflicts with code reality.

---

*End of _02_PLAN_001_audit_upsert_refactor.md v5*
