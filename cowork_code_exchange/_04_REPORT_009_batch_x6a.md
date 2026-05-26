# REPORT 009 — CLI Batch X6.A (CW-B34 engine patch — SUCCESS, ADR-0016 ACCEPTED)

**Executed**: 2026-05-21T12:40Z → 2026-05-21T13:10Z (~30min wall-clock active CLI; Wave 1 retry 185.6s)
**Sessions**: 1 (X6.A complete, single bundle commit + push)
**By**: Claude Code CLI on Windows (Opus 4.7 1M ctx)
**Pre-conditions**: X5.A interim commit `ea4ebe6` + STATE handoff `99850e5` visible. Baseline sys_job_roles=202, sys_esco_occupation_mappings=0, sys_users=163 (post X5.A halt §2.B.5).
**Directive**: `cowork_code_exchange/.inbox/cli/pending/2026-05-21T12-50-00Z__008__exec_directive_cw_b34.md` (Option A approved, spec authoritative `cw_b34_engine_patch/CW_B34_PATCH_SPEC.md`).

---

## §0 — Pre-conditions verified
- SSH tunnel localhost:5433 ✅ (re-opened mid-session — was down at start)
- PG 16, `heuresys_advanced` DB ✅
- Last commit `99850e5` X5.A session-close visible ✅
- Spec `CW_B34_PATCH_SPEC.md` + directive both read in full ✅
- Live DB baseline confirmed: sys_job_roles=202, sys_esco_occupation_mappings=0, sys_users=163

---

## §1 — Engine patch outcomes (CW-B34 — SUCCESS)

### §1.1 engine.ts — TargetMeta extension + columnNullable populate

**File**: `apps/api/src/modules/brownfield-wave-executor/engine.ts`

- `TargetMeta` interface gains `columnNullable: Map<string, boolean>` field
- `loadTargetMeta` populates the map from existing `is_nullable` column already in `colsRes.rows` query (no extra DB roundtrip — only Map construction added)
- `return` statement includes the new field

Diff size: +6 / -1 LOC.

### §1.2 upsert-sql.ts — Nullable-aware WHERE skip filter §5

**File**: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`

- `TargetMeta` interface re-export gains `columnNullable` field (mirror engine.ts)
- §5 WHERE skip filter loop (line 431-442 pre-patch):
  - When `isNullable===true` and entry missing → push `{ targetCol, sql: "NULL::uuid" }` into `colEntries` (preserves DISTINCT ON `staging_deduped` + ON CONFLICT inference alignment) + `continue` (skip `FALSE` predicate)
  - When `isNullable===true` and entry present → `continue` (skip `IS NOT NULL` + UUID regex)
  - Non-nullable case preserved exactly (legacy behavior)
- `endsWith("_tenant_id")` escape hatch retained (CW-B22 sentinel-coalesce pattern, orthogonal to DB nullability; removal deferred — see §6.b)
- Required-cols loop §5 line 443-461 unchanged: `requiredColumns` Set is by-definition `is_nullable='NO'` (engine.ts:88-93), so columnNullable is always false there

Diff size: +35 / -5 LOC.

### §1.3 buildNkJoinPredicate — extended for lineage JOIN-back

**Critical thinking from directive §3** (NOT in spec §4.2 explicitly, but required):

After the `NULL::uuid` injection, `buildNkJoinPredicate` would emit plain `t.<col> = s.__nk_<col>`. With both sides NULL (ESCO case), `NULL = NULL` is FALSE in SQL → lineage JOIN-back returns 0 rows even when INSERT succeeds, breaking `sys_source_lineage_records` for ADR-0015/0016 targets.

**Fix**: extended `buildNkJoinPredicate` signature with `isNullable: boolean` parameter. For UUID NK cols that are `_tenant_id`-suffixed OR DB-nullable, emit COALESCE-sentinel pattern (mirror CW-B22). Caller (line ~686) computes `isNullable` from `targetMeta.columnNullable.get(nkCol)` and passes through.

Without this fix, post-patch lineage would still be 0 for ESCO despite target count reaching 7645. Verified live: lineage_rows = 11256 = 11227 upserted + 29 cross-table refresh delta (vs runId would have shown 0 for ESCO branch).

Diff size: +14 / -5 LOC (buildNkJoinPredicate + caller).

### §1.4 buildNkJoinPredicate exported for testability

Single-line change: `function` → `export function`. Enables 3 pure unit tests without refactor of the 600-line `executeUpsertSqlSidePerMapping`.

---

## §2 — Tests (apps/api/test/upsert-sql-cw-b34-nullable-nk.test.ts — NEW)

### §2.1 Unit tests (3) — `buildNkJoinPredicate`
- **T1** nullable UUID NK col (ESCO case) → emits COALESCE(sentinel) pattern ✅
- **T2** non-nullable UUID NK col regression (sys_skills.skill_id) → emits plain `t.col = s.col` ✅
- **T3** `_tenant_id` NK col regression (CW-B22) → COALESCE-sentinel preserved regardless of isNullable flag ✅

### §2.2 Integration (1) — `executeUpsertSqlSidePerMapping` via mock Pool
- **T4** ESCO TargetMeta + DRY_RUN→EXECUTE mode + mock Pool intercepts SQL:
  - NULL::uuid present in INSERT selectList ✅
  - No `IS NOT NULL` filter for nullable col ✅
  - No `FALSE` literal in WHERE skip filter ✅
  - Base predicates preserved (`staging_validation_status='PASSED'`, `staging_target_record_id IS NULL`) ✅

### §2.3 Test outcomes
- **New file**: 4/4 pass
- **Full suite**: 326/333 passing, 5 skipped, 2 failing (both **pre-existing**, NOT introduced by X6.A — see §5)
- **§7 halt threshold**: > 5 new failures → P1. **Observed: 0 new failures** → no halt

### §2.4 Typecheck
- `pnpm typecheck` (src tsconfig.json) ✅ clean
- `pnpm typecheck:test` (tsconfig.test.json) ✅ clean

---

## §3 — Wave 1 retry + acceptance

### §3.1 Wave 1 retry
- **runId**: `9a6bf483-a0be-42c3-afd0-0e8966d5eb8d`
- **wall-clock**: 185.6s (~3min, on par with X5.A 186s — no perf regression)
- **state**: COMPLETE
- **totalStaged**: 66997
- **totalUpserted**: 11227
- **lineage rows**: 11256

### §3.2 Acceptance checks (all PASS)

| name | actual | expected | pass |
|---|---|---|---|
| `wave_1_mappings_approved` | 95 | ≥88 | ✅ |
| `no_validation_failures_for_run` | 0 | 0 | ✅ |
| `lineage_rows_written` | 11256 | >0 | ✅ |

### §3.3 Target table deltas (post-patch vs §0 baseline)

| target | pre X6.A | post X6.A | target | status |
|---|---|---|---|---|
| sys_job_roles | 202 | **202** | preserved | ✅ no regression |
| sys_esco_occupation_mappings | 0 | **7645** | ≥3000 | ✅ **154% over target** |
| sys_users | 163 | 163 | X5.B scope | — out of X6.A scope |

### §3.4 Spec §5 acceptance criteria recap
1. `targetMeta.columnNullable` populated ✅
2. WHERE skip filter SKIPS for nullable NK UUID cols ✅
3. Non-nullable NK UUID preserved ✅ (`skill_taxonomy_edge_parent_id`, etc. still filtered)
4. `_tenant_id` NULL allowance preserved (CW-B22) ✅
5. Unit tests 4/4 PASS ✅
6. Full suite ≥322 pass (326 actual) ✅
7. ESCO ≥3000 (7645 actual) ✅
8. sys_job_roles preserved 202 ✅
9. 0 audit rows with `nk_missing_esco_occupation_mapping_job_role_id` ✅

**ALL 9 CRITERIA MET.**

---

## §4 — Exclusion-reason distribution post-patch (audit forensics)

```
reason                                       | count
---------------------------------------------+-------
nk_missing_skill_taxonomy_edge_parent_id     | 17924
required_missing_skill_category_family_id    |  7256
nk_missing_skill_learning_mapping_skill_id   |  1381
nk_missing_learning_path_step_path_id        |   688
nk_null_skill_learning_mapping_skill_id      |   207
nk_missing_blueprint_process_variant_id      |    89
nk_missing_user_certification_user_id        |    88
nk_null_process_kpi_template_process_id      |    81
nk_missing_skill_alias_skill_id              |    50
```

**Critical**: `nk_missing_esco_occupation_mapping_job_role_id` is **absent** → CW-B34 patch fully unblocks ADR-0016 target.

Remaining hits are **legitimate non-nullable NK gaps** — these are NOT NULL FK references where the source data lacks the canonical FK and engine correctly excludes (no semantic FK phantom case yet). They surface as **future bias-catalog candidates**:

- CW-B35 candidate: `sys_skill_taxonomy_edges.parent_id` 17924 missing — pattern similar to ADR-0015 (semantic FK phantom for taxonomy? worth pre-flight 5-sample check)
- CW-B36 candidate: `sys_skill_category_families.family_id` 7256 missing — required col, not NK, suggests upstream cascade
- CW-B37 candidate: `sys_skill_learning_mappings.skill_id` 1588 (1381 missing + 207 null invalid uuid) — split forensic case

Defer to Cowork batch C7 for triage.

---

## §5 — Pre-existing test failures (NOT introduced by X6.A)

Documented for transparency. Both pre-date X6.A and are out of scope:

### §5.1 `skills.integration.test.ts:131` — tenant scope visibility
- Created skills IDs not all present in subsequent list query result
- Unrelated to brownfield-wave-executor
- Pre-existing on `main` before X6.A bundle (verified: no engine.ts/upsert-sql.ts dependency)

### §5.2 `transform-compiler.test.ts:516` — SUPPORTED_TRANSFORMS size assert
- Test expects 15 entries, actual is 16 post-X5.A `CAST_ENUM` addition (commit `ea4ebe6`)
- Test assertion stale — should be updated to 16 (1-line fix)
- Recommend Cowork batch C7 prep includes this trivial fix

---

## §6 — Open items / strategic concerns

### §6.a `endsWith("_tenant_id")` redundancy check (directive §3 invitation)

Directive invited: "Se durante implementation noti che la condizione `endsWith('_tenant_id')` diventa redundant (perché tenant cols sono is_nullable=YES nel DB), considera se rimuoverla per ridurre special cases."

**Decision**: keep the check. Rationale:
- `_tenant_id` cols ARE typically `is_nullable=YES` in DB, BUT the check serves a SECONDARY purpose beyond NULL-allowance: it ensures the COALESCE-sentinel pattern is emitted **even if a future migration tightens the col to NOT NULL** without coordinated engine change. Defensive against silent regression.
- Removing it would tie tenant_id behavior to DB nullability flip-flops, which is the wrong coupling for a sentinel-based equality contract.
- Cost of retention: 1 condition + 1 string-suffix check per NK col iteration. Negligible.

If Cowork wants the check removed, propose dedicated ADR + bias-catalog entry — not in X6.A scope.

### §6.b `NULL::uuid` injection vs column omission (spec §3.3 question)

Spec §3.3 raised: "Inject NULL placeholder OR omit the col from INSERT?"

**Decision**: inject `NULL::uuid` (per spec §4.2 code). Rationale verified empirically:
- `conflictKeyExprs` (upsert-sql.ts:626-632) does `colEntries.find()` for each conflict-inference col. Omitting would fall back to staging col name — which doesn't exist in `staging_raw_record` schema → SQL error.
- DISTINCT ON `staging_deduped` references the same expressions — same constraint.
- INSERT colsList/selectList must align — injection keeps them in lockstep.

Live verification: 7645 ESCO rows successfully INSERTed with explicit `NULL::uuid` → ON CONFLICT inference works (no duplicate-key SQL errors observed).

### §6.c Lineage JOIN-back rescue (NOT in spec)

`buildNkJoinPredicate` extension is **scope creep relative to spec §4.2**, but necessary: without it, lineage_rows would be 0 for ADR-0015/0016 targets despite INSERT success. Documented as additive fix in §1.3 above.

If Cowork prefers strict spec adherence (no scope creep), the alternative is to revert the `buildNkJoinPredicate` change and accept `lineage_rows=0` for ESCO + similar future targets. Recommend keeping the fix — lineage is the audit trail and would otherwise silently break.

---

## §7 — Commit + push

- **Commit `eb48998`**: 4 files (engine.ts + upsert-sql.ts + new test + ADR-0016), +297 / -15
- **Push**: SUCCESS `99850e5..eb48998` → `origin/main`
- **Branch**: `main`

---

## §8 — REPORT template alignment + halt status

- §0 pre-conditions ✅
- §1 patch outcomes ✅
- §2 tests ✅
- §3 Wave 1 retry + acceptance ✅
- §4 audit forensics ✅
- §5 pre-existing failures (transparency) ✅
- §6 open items ✅
- §7 commit + push ✅
- §8 (this section) ✅

**Halt triggers (directive §7)**:
- sys_esco still 0 post-Wave1 → **NOT triggered** (7645 ≥ 3000)
- sys_job_roles regression < 202 → **NOT triggered** (202 preserved)
- test suite > 5 new failures → **NOT triggered** (0 new failures)

**Session status**: X6.A **COMPLETE**. Ready for Cowork REVIEW + X5.B unblock.

---

## §9 — Recommendations for Cowork batch C7

1. Triage future bias candidates from §4 (CW-B35/36/37) — pre-flight 5-sample on `skill_taxonomy_edge_parent_id` is the highest-volume blocker (17924 rows)
2. Trivial test fix: `transform-compiler.test.ts:516` expect 16 (post-CAST_ENUM)
3. ADR pattern memo §10 (writer authority + 2-step DB+engine bundling) — already in `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` per directive §9. Validate alignment with X6.A actual delta.
4. Consider whether `endsWith('_tenant_id')` redundancy removal warrants its own bias entry (§6.a discussion)

---

*End REPORT 009 — X6.A CW-B34 engine patch shipped + ADR-0016 ACCEPTED*
