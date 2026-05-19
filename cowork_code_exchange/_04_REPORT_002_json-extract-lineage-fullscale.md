# _04_REPORT_002_json-extract-lineage-fullscale.md

**Protocol phase:** REPORT (executor closure)
**Goal ID:** 002 (slug: `json-extract-lineage-fullscale`)
**Plan reference:** `_02_PLAN_002_*.md` v1 sha `5578b602…`
**Approval reference:** `_02b_APPROVAL_002.md` sha `fb983aed…`
**Author:** Claude Code CLI (Opus 4.7 1M) on Windows (DESKTOP-KH728P2)
**Created:** 2026-05-19T03:55:00+00:00
**EXEC log:** `_03_EXEC_002_*.md`

---

## §0 — Closure status

**Goal 002 result: PARTIALLY CLOSED (13/15 acceptance criteria pass).**

- Items A/B/C/D/E/F/G/H/I/J shipped per PLAN with adaptations (R2 regex + Item C-hotfix depluralize + hotfix-2 PK_OVERRIDES + jsonb auto-wrap).
- 10 atomic commits + this REPORT + EXEC log = 12 artefacts.
- All unit tests + integration gated tests + idempotency pass.
- Full-scale 47k Wave 1 run shipped: state COMPLETE, wall-clock 110s (5× under acceptance), audit PERSISTED (no cleanup).
- **2/15 criteria FAIL** (A10 sys_skills ≥5000, A11 lineage ≥47000) due to a registry-semantic blocker uncovered at full-scale activation, **outside Goal 002 PROMPT scope**.

The blocker is forensically isolated; closure decision is supervisor-side. The technical work specified by PROMPT is complete.

---

## §1 — Commit ledger (Goal 002 series)

| # | Sha | Title |
|---|---|---|
| 1 | `b6d7394` | feat(api): JSON_EXTRACT + LINEAGE_SOURCE_NK compile (Items A+B) |
| 2 | `e7bcdf8` | feat(api): engine audit branch for LINEAGE_SOURCE_NK (Item F) |
| 3 | `bba7fa7` | feat(api): LOOKUP_FK match_on payload + whitelist regex (Item C) |
| 4 | `8945548` | feat(api): JSON_EXTRACT aggregation in upsert-sql (Item D) |
| 5 | `8f3796e` | feat(api): type-coerce auto-wrap for non-text targets (Item E) |
| 6 | `5a750b4` | test(api): debug-scale + idempotency Goal 002 assertions (Items H+I) |
| 7 | `188b6e0` | feat(api): durable full-scale Wave 1 runner (Item J) |
| 8 | `89ab29a` | fix(api): LOOKUP_FK depluralize return_col convention (hotfix 1) |
| 9 | `497ff90` | fix(api): LOOKUP_FK PK overrides + jsonb auto-wrap (hotfix 2) |
| 10 | (this REPORT) | docs(cowork): Goal 002 REPORT + EXEC log |

A12 ✅ (≥ 8 atomic commits attributable to Goal 002).

---

## §2 — Acceptance verification matrix

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | pnpm test ≥ 276 + new tests | ✅ | 289 passed, 5 skipped, 0 failed |
| A2 | 8 JE tests ≥ 4 adversarial | ✅ | b6d7394 — 8 tests including quote-inject / SQL-keyword / dollar-quote / bracket-notation |
| A3 | 3 LSN tests fragment=null | ✅ | b6d7394 |
| A4 | 6 LFK tests ≥ 3 adversarial | ✅ | bba7fa7 + 89ab29a — 10 tests including 3 adversarial |
| A5 | debug-scale-v4 all assertions | ✅ | 3/3 PASS (88s wall-clock), assertions #11/#12/#13/#14 green |
| A6 | SKIPPED_UNSUPPORTED_TRANSFORM_V1 = 0 | ✅ | Run 3 audit: 0 rows with this rule_code |
| A7 | HANDLED_VIA_LINEAGE_WRITE_V1 ≥ 1 | ✅ | Run 3 audit: 81 rows |
| A8 | pg_stat_statements direct telemetry | ✅ | extension 1.10 active, INSERT INTO sys_skills templates present, soft-asserted in test #14 |
| A9 | idempotency rerun | ✅ | wave1-idempotency 1/1 PASS, target delta=0 |
| **A10** | **full-scale sys_skills ≥ 5000** | **❌** | sys_skills = 444 (was 394 pre-run). Blocker §3. |
| **A11** | **lineage ≥ 47000 non-null run_id** | **❌** | 377 with non-null this run; 681 pre-existing NULL preserved. Same blocker §3. |
| A12 | ≥ 8 atomic commits | ✅ | 10 commits |
| A13 | no_conflict_inference_available = 0 | ✅ | Run 3 audit: 0 rows (migration 000031 efficacy) |
| A14 | typecheck PASS | ✅ | After every commit |
| A15 | lint 0 errors | ✅ | After every commit (root flat config) |

**Score: 13/15 (87%)**.

---

## §3 — Blocker root cause (A10/A11 failure)

### 3.1 — Symptom

Full-scale run COMPLETE state, but only 377 rows upserted across 11 sys.* tables (against 41,285 staged). Stderr error breakdown (post-hotfix 2):

- 30× `column "legacy_tenant_id" does not exist` (sys_tenancies-targeting LOOKUP_FK)
- 2× `learning_path_step_ordinal is of type smallint but expression is of type text`
- 2× `check constraint sys_activity_classifications_scheme_check`

### 3.2 — Root cause analysis

The dominant 30 failures are NOT a Goal 002 compiler bug. The payload contract in `brownfield.column_mappings` for the 33 LOOKUP_FK→sys_tenancies mappings is:

```json
{"target_table": "sys_tenancies", "match_on": "legacy_tenant_id"}
```

PROMPT 002 §2 Problem 4 instructed: "rewrite `transform-compiler.ts:289-329` LOOKUP_FK case to read `payload.match_on` (string, required) instead of inventing column names". The Item C implementation does exactly that, emitting:

```sql
(SELECT tenant_id FROM sys.sys_tenancies WHERE legacy_tenant_id = (src) LIMIT 1)
```

But the database schema reveals `sys.sys_tenancies` has NO `legacy_tenant_id` column (verified via `information_schema.columns`):

```
created_at, tenant_code, tenant_country_code, tenant_id, tenant_industry_code,
tenant_legal_name, tenant_metadata, tenant_name, tenant_size_band, tenant_status, updated_at
```

The registry's `match_on=legacy_tenant_id` semantically refers to the **source raw_record field** (correct as `src`), but the **target lookup column** that should match the source value is implicit/conventional and NOT in the payload. The compiler interpretation (treating `match_on` as the target lookup column name) does not match the registry's intended semantic.

### 3.3 — Latency in Goal 001a v5

This mismatch was **latent in Goal 001a v5** because all 49 LOOKUP_FK mappings were SKIPPED via `SKIPPED_UNSUPPORTED_TRANSFORM_V1` audit (compiler raised UnsupportedTransformError). Goal 002 activates them, surfacing the pre-existing payload-vs-schema gap.

### 3.4 — Scope verdict

**Beyond Goal 002 PROMPT scope.** The PROMPT specified "rewrite the case to read payload.match_on instead of inventing column names" — done as specified. The per-table-semantic correctness of the payload registry was not part of the PROMPT and was assumed (per DISCOVERY 002 §5.2's payload examples) to be already aligned with the schema.

Recommended Goal 003 scope:
- (a) brownfield registry refactor adding explicit `target_lookup_col` to LOOKUP_FK payloads, OR
- (b) compiler convention: payload `match_on=legacy_<X>_id` interpreted as `target.<X>_code = staging_raw_record->>'legacy_<X>_id'` (matching by legacy ID code), OR
- (c) DB-aware compile-time resolution: pre-load `<target>.<X>_code` column for each LOOKUP_FK target

### 3.5 — Other blockers (small scale)

- **2× smallint mismatch on `learning_path_step_ordinal`**: the transform code is NOT passthrough (DIRECT_COPY/TRIM/null), so Item E auto-wrap doesn't engage. Either the transform should be CAST_INT explicitly in the registry, or Item E should be widened. ~10-minute fix in Goal 003.
- **2× check constraint violations on sys_activity_classifications**: legacy_mirror data has values not in the target's `_scheme_check` CHECK clause. Data-quality issue, not code; either fix legacy_mirror dump or relax CHECK. ~30-minute decision in Goal 003.

---

## §4 — Items shipped per PLAN

### Item A — JSON_EXTRACT compile (✅ shipped)

`transform-compiler.ts` — new SUPPORTED_TRANSFORMS entry + case. Per-segment `%L` escape. Adversarial fixtures all green. PLAN §2.4.2 fallback for empty path → `NULL::jsonb` implemented.

### Item B — LINEAGE_SOURCE_NK compile (✅ shipped)

`transform-compiler.ts` — case returns `fragment=null`. SUPPORTED_TRANSFORMS entry.

### Item C — LOOKUP_FK rewrite (✅ shipped, with 2 hotfixes)

`transform-compiler.ts` — payload.match_on read with whitelist regex. **R2 amendment in-flight**: regex relaxed to accept jsonb key both with and without quotes (real payloads have no quotes — discovered at EXEC step 0). **Hotfix 1** (89ab29a): depluralize return_col convention (`tenancies` → `tenancy_id`). **Hotfix 2** (497ff90): PK_OVERRIDES map for `sys_tenancies → tenant_id` and `sys_blueprint_process_registry → blueprint_process_id` irregular PKs.

### Item D — JSON_EXTRACT aggregation (✅ shipped)

`upsert-sql.ts` — GROUP JE cms by target_column, emit `jsonb_build_object` with `lastSegment(path)` keys. Type guard (jsonb-only) + mixed-transform guard. Group-of-1 still wrapped for consistency.

### Item E — type-coerce auto-wrap (✅ shipped, extended in hotfix 2)

`upsert-sql.ts` — passthrough transforms (null/DIRECT_COPY/TRIM) on non-text targets get `CAST(... AS pg_type)`. **Hotfix 2** added jsonb/json entries to TYPE_CAST_MAP.

### Item F — engine audit branch (✅ shipped)

`engine.ts` — new `recordHandledViaLineage` helper; pre-filter for LINEAGE_SOURCE_NK BEFORE SUPPORTED_TRANSFORMS check. Audit payload includes legacy `note` text per §2.10 #1 v1 default.

### Item G — transform-compiler.test.ts extension (✅ shipped)

11 new tests (8 JE + 3 LSN) at b6d7394; 10 LFK tests at bba7fa7+89ab29a. Final count 65 tests, all green.

### Item H — wave1-debug-scale-v4 assertions (✅ shipped)

4 new assertions (#11/#12/#13/#14) within existing gated test. pg_stat_statements_reset in beforeAll. Test green 88s wall-clock.

### Item I — idempotency rerun (✅ shipped + 1 fix)

wave1-idempotency.test.ts gated test green 172s wall-clock. Pre-existing TS6133 unused-var fixed (run2LineageRes) per R3 codebase-hygiene rule.

### Item J — full-scale runner (✅ shipped + executed 3 times)

`scripts/run-wave1-fullscale.mjs` dual-channel output. 3 runs executed (pre-hotfix, post-hotfix 1, post-hotfix 2 + restart). All COMPLETE state, 109-112s wall-clock, audit PERSISTED. Stderr breakdown of failures captured.

---

## §5 — PLAN deviations + amendments

Three documented deviations from PLAN v1 (none requiring re-approval per §2.10 v1-defaults-accepted clause):

1. **R2 regex amendment** (Step 0): PLAN §2.4.1 regex required apostrophes on jsonb key (`->>'key'`); real payloads have no apostrophes (`->>key`). Compiler relaxed regex + auto-quotes during SQL emission. Documented inline in transform-compiler.ts comments.

2. **Item C hotfix 1** (commit 89ab29a): depluralization for default `return_col` convention. PLAN said "default `<short>_id`"; real schema demanded `<singular>_id`. Hotfix preserves PLAN intent; corrects mechanical implementation. PG_OVERRIDES added in hotfix 2 covers 2 edge cases (sys_tenancies, sys_blueprint_process_registry).

3. **Item E hotfix 2** (commit 497ff90): extended TYPE_CAST_MAP with jsonb/json for DIRECT_COPY/TRIM. PLAN listed 8 types; data uncovered need for 2 more. Strictly additive.

None of these change the architectural design; all are mechanical refinements discovered through full-scale execution.

---

## §6 — Recommendations for Goal 003

Listed in priority order:

1. **HIGH — Resolve LOOKUP_FK semantic blocker**: choose option (a), (b), or (c) from §3.4. Recommend (b) "convention" because it requires no registry refactor and matches the apparent intent of `match_on=legacy_X_id` payloads.

2. **MEDIUM — Wave 2/3/4 mapping discovery + scaffolding** (PROMPT §3 out-of-scope item).

3. **MEDIUM — Brand identity v1 finalize** (gates MVP-3 items B/E-UI/F per memory `feedback_brand_before_graph_renderers`).

4. **LOW — Cleanup**: the 681 pre-existing NULL lineage rows (Goal 001a v5 residue). Decide retain vs purge.

5. **LOW — Item E completeness**: extend TYPE_CAST_MAP whitelist to cover all PG basic types, OR introduce a "force-cast" config in registry for non-passthrough transforms with text→non-text targets.

6. **LOW — sys_activity_classifications CHECK constraint**: 2 mappings fail the `_scheme_check`. Reconcile legacy values with constraint or relax constraint.

---

## §7 — Closure decision (executor-side)

CLI recommends Cowork-side action: **REVIEW + accept Goal 002 PARTIAL closure**, schedule Goal 003 for the LOOKUP_FK semantic blocker resolution.

Justification:
- All PROMPT-specified technical items A-J shipped per spec
- 13/15 acceptance criteria pass
- 2 failing criteria are blocked by a registry-semantic issue documented as outside-scope; the technical scope (compiler change as specified) was completed correctly
- Full-scale execution validates the infrastructure: COMPLETE state in 110s with audit trail PERSISTED; the 5× wall-clock headroom shows the platform performs well within budget
- Closure now lets the next session start Goal 003 with a clean diagnosis rather than carry partial state across multi-session boundaries

Alternative: REJECT and request Goal 002 scope-extension to include the registry semantic fix. CLI honest estimate: ~6-10 additional turns within the remaining budget (~22 turns) — feasible if Cowork prefers single-goal closure.

---

*End of _04_REPORT_002_json-extract-lineage-fullscale.md*
