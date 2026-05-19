# _03_EXEC_002_json-extract-lineage-fullscale.md

**Protocol phase:** EXEC (executor action log)
**Goal ID:** 002
**Plan reference:** `_02_PLAN_002_json-extract-lineage-fullscale.md` v1 sha `5578b6026fdcd6117ae21b81b3ce3e3506c0de0dfe72201e8ad14d9c92e19672`
**Approval reference:** `_02b_APPROVAL_002.md` sha `fb983aeda8dfc0b965e29ecc3fe52ae84d158678fde3f2befd12396919915ac7`
**EXEC start:** 2026-05-19T03:08:00+00:00
**EXEC end:** 2026-05-19T03:55:00+00:00
**Turns used:** ~15 of 40 budget (well within escalation threshold 38)

---

## Step 0 — Baseline capture

| # | Check | Result |
|---|---|---|
| 0.1 | `pnpm test` baseline | ✅ 276 passed, 5 skipped, 0 failed (05:09 GMT+2) |
| 0.2 | Source SHAs vs DISCOVERY §10 | ⚠️ engine.ts + service.ts drift (sha changed from `4b7dd9cc…/8fbfc1a5…` to `d54ae177…/01739f6a…`) — caused by lint-fix commit 26254d6 in this same session, BENIGN: PLAN was authored reading the post-lint files, behavior unchanged. Other 8 files match. |
| 0.3 | DB row counts | ✅ sys_skills=394, lineage=681, audit.*=0, matches DISCOVERY §7 baseline |
| 0.4 | Backup mtime | ✅ `/home/ubuntu/backups/heuresys_advanced_pre_goal002_20260518_2233.dump` 124MB, mtime 2026-05-18T22:33Z, age ~4h within 6h gate |
| 0.5 | Migration 000031 | ✅ id=384 applied 2026-05-18T22:34:12Z |
| 0.6 | pg_stat_statements | ✅ extension 1.10 installed |
| 0.7 | pg_stat_statements_reset | deferred to per-test beforeAll per §2.10 #3 v1 default |
| 0.8 | U2 — 4 JSON_EXTRACT no direction | ✅ all 4 target `*_metadata` jsonb cols (blueprint_process_metadata x3, skill_metadata x1) → embed-default applicable |
| R2 | LOOKUP_FK match_on whitelist | ⚠️ regex from PLAN §2.4.1 was `(->>'[a-z_]+')?` requiring quotes on jsonb key. Real payload has no quotes (`metadata->>legacy_id`). PLAN AMENDED in-flight: regex relaxed to `(->>'?[a-z_]+'?)?`, compiler auto-quotes during SQL emission. All 11 distinct match_on values now match the relaxed regex. |

**Decision:** proceed with EXEC; document drift + R2 amendment in this log.

---

## Step 1 — Item A: JSON_EXTRACT compile + 8 tests + commit

**Commit:** `b6d7394 feat(api): MVP-3 Tappa D — JSON_EXTRACT + LINEAGE_SOURCE_NK compile (Goal 002 Items A+B)`

- `transform-compiler.ts`: added `InvalidJsonExtractPayloadError`; extended `SUPPORTED_TRANSFORMS` with `JSON_EXTRACT` + `LINEAGE_SOURCE_NK`; new JSON_EXTRACT case with per-segment `%L` escape; new LINEAGE_SOURCE_NK case returning `fragment=null`.
- `transform-compiler.test.ts`: 11 new tests (8 JE + 3 LSN) + 2 stale tests updated (size 13→15, removed JE/LSN from UnsupportedTransformError list).
- **Verification**: `pnpm exec vitest run test/transform-compiler.test.ts` → 60 passed; typecheck + lint clean.

## Step 2 — Items B + F: engine.ts audit branch

**Commit:** `e7bcdf8 feat(api): MVP-3 Tappa D — engine audit branch for LINEAGE_SOURCE_NK (Goal 002 Item F)`

- `engine.ts`: new helper `recordHandledViaLineage` mirroring `recordSkippedColumnMapping` shape but with rule_code `HANDLED_VIA_LINEAGE_WRITE_V1`; column_mappings loop adds explicit branch for `LINEAGE_SOURCE_NK` BEFORE `SUPPORTED_TRANSFORMS.has(cm.transform)` check; dedupe by column_mapping_id.
- Payload includes the LINEAGE_SOURCE_NK `note` text (§2.10 #1 v1 default accepted).
- **Verification**: typecheck + lint clean (test coverage delegated to Step 6 integration).

## Step 3 — Item C: LOOKUP_FK rewrite + 6 tests + commit

**Commit:** `bba7fa7 feat(api): MVP-3 Tappa D — LOOKUP_FK match_on payload + whitelist regex (Goal 002 Item C)`

- `transform-compiler.ts` LOOKUP_FK case: read `payload.match_on`, validate via whitelist regex (relaxed per R2 amendment), accept plain column + jsonb extract (quoted/unquoted), drop secondary OR clause.
- `payload.return_col` validated via plain-column regex.
- **Test coverage**: 10 LOOKUP_FK tests (4 happy-path, 3 adversarial, 3 missing/invalid), 2 injection-defense tests replaced.
- **Verification**: 65 tests passed; typecheck + lint clean.

## Step 4 — Item D: JSON_EXTRACT aggregation in upsert-sql

**Commit:** `8945548 feat(api): MVP-3 Tappa D — JSON_EXTRACT aggregation in upsert-sql (Goal 002 Item D)`

- `upsert-sql.ts` per-cm loop skips JSON_EXTRACT; new step 1b: GROUP JE cms by target_column, emit one `jsonb_build_object('k1', frag1, ...)` SELECT entry per group with keys derived from `lastSegment(payload.path)` after stripping `$.legacy.`.
- Type guard: skip group if target_column not jsonb. Mixed-transform guard: skip group if target_column already has a non-JE entry.
- Group-of-1 still wraps in jsonb_build_object for consistency.
- ON CONFLICT REPLACE semantics (no merge) per §2.5.2.
- **Verification**: typecheck + lint clean.

## Step 5 — Item E: type-coerce auto-wrap

**Commit:** `8f3796e feat(api): MVP-3 Tappa D — type-coerce auto-wrap for non-text targets (Goal 002 Item E)`

- `upsert-sql.ts`: after `compileTransform`, if transform passthrough (null/DIRECT_COPY/TRIM) AND target type in {int2, int4, int8, numeric, bool, date, timestamptz, timestamp}, wrap in `CAST(<frag> AS <pg_type>)`. Whitelist map. UUID intentionally excluded.
- **Verification**: typecheck + lint + 65 tests pass.

## Step 6 — Items H + I: extend debug-scale + idempotency rerun

**Commit:** `5a750b4 test(api): MVP-3 Tappa D — debug-scale + idempotency Goal 002 assertions (Items H+I)`

- `wave1-debug-scale-v4.test.ts`:
  - beforeAll: `pg_stat_statements_reset()` (per-test scope per §2.10 #3)
  - criterion #7 strengthened: `SKIPPED_UNSUPPORTED_TRANSFORM_V1` now **= 0** (was ≥ 1)
  - new criteria #12, #13, #14: HANDLED_VIA_LINEAGE_WRITE_V1 ≥ 1, sys_skills metadata non-null, pg_stat_statements direct telemetry
- `wave1-idempotency.test.ts`: fixed pre-existing TS6133 by making `run2LineageRes` read explicit
- **Verification**:
  - Full suite: 289 passed | 5 skipped | 0 failed (+13 vs 276 baseline)
  - `BROWNFIELD_RUN_DEBUG_V4=1` debug-scale-v4: **3 passed** (88s wall-clock, all assertions including #11/#12/#13/#14 green)
  - `BROWNFIELD_RUN_IDEMPOTENCY=1` idempotency: **1 passed** (172s, target delta=0)

## Step 7 — Item J: full-scale runner script

**Commit:** `188b6e0 feat(api): MVP-3 Tappa D — durable full-scale Wave 1 runner (Goal 002 Item J)`

- `scripts/run-wave1-fullscale.mjs` per PLAN §2.2 Item J spec:
  - login via fetch to `:3001/v1/auth/login`
  - POST `/v1/brownfield/wave-executor/runs` `{wave:1, mode:EXECUTE}` NO cap
  - Hard timeout 11min (R3 mitigation)
  - Dual-channel output: JSON stdout + human stderr (§2.10 #4 accepted)
  - Exit codes: 0/1/2/3 per outcome
  - Acceptance endpoint check
  - NO cleanup — audit persists

## Step 8 — Full-scale execution + transcript

### Run 1 (pre-hotfix): runId `0e0b4023-e315-4991-9761-d2d89501fd02`

- **State**: COMPLETE ✅
- **Wall-clock**: 110.1s (FAR below A10's 600s gate) ✅
- **totalStaged**: 41,285 (Wave 1 47k bracket)
- **totalUpserted**: 377 ⚠️ (expected ≥ 5000 per A10)
- **acceptance.allPass**: true (endpoint-level checks)

Stderr server log revealed `insert_failed: column "tenancies_id" does not exist` → root cause: Item C default `return_col = ${short}_id` doesn't depluralize. Sys_tenancies → ${short}_id = tenancies_id (wrong PK name). Latent in Goal 001a v5 because LOOKUP_FK was SKIPPED.

### Hotfix 1 (commit `89ab29a`): depluralize convention

- transform-compiler.ts depluralizes `<short>` before `_id` suffix:
  - `ies` → `y` (tenancies → tenancy)
  - `<X>s` → `<X>` for non-`ss` endings
- Test updated for tenancy_id assertion.

### Run 2 (post-hotfix 1): runId `a9c3ebf8-0b05-41a2-b34c-c7e30b17c5a9`

- Same totalUpserted=377 — additional errors surfaced:
  - `column "tenancy_id" does not exist` (PK irregularity)
  - `column "skills_id" does not exist` (tsx watch had not reloaded ⚠️)
  - `learning_path_step_ordinal is of type smallint but expression is of type text` (Item E non-passthrough)
  - `skill_taxonomy_edge_metadata is of type jsonb but expression is of type text` (Item E doesn't cover jsonb)

### Hotfix 2 (commit `497ff90`): PK_OVERRIDES + jsonb auto-wrap

- pg_constraint scan revealed:
  - `sys_tenancies → tenant_id` (NOT tenancy_id)
  - `sys_blueprint_process_registry → blueprint_process_id` (drops "registry")
- Added `PK_OVERRIDES` map for these 2 exceptions.
- Extended Item E TYPE_CAST_MAP with `jsonb → JSONB`, `json → JSON`.
- Force-restarted dev server (`tsx watch` was not picking up file changes reliably).

### Run 3 (post-hotfix 2 + restart): runId `0f6c0ea9-f6e5-4081-b3c7-76df2021f53d`

- Same totalUpserted=377 — bottleneck is NOT in PK resolution but in **registry semantic mismatch**.

### Step 8 RCA — registry semantic blocker

Stderr error breakdown (post-hotfix 2):

| Skipped reason | Count |
|---|---|
| `column "legacy_tenant_id" does not exist` | 30 |
| `learning_path_step_ordinal is of type smallint but expression is of type text` | 2 |
| `check constraint sys_activity_classifications_scheme_check` | 2 |

**Root cause analysis**:

The 30 dominant failures stem from a **payload-semantic mismatch in the brownfield.column_mappings registry**, NOT a compiler bug:

- Payload contract observed in DISCOVERY 002 §5.2: `match_on=legacy_tenant_id` with `target_table=sys_tenancies`
- Compiler emits (per Item C contract): `WHERE legacy_tenant_id = (src) ... FROM sys.sys_tenancies`
- DB schema: `sys_tenancies` has NO `legacy_tenant_id` column (verified via `information_schema.columns` — the table has `tenant_code, tenant_id, tenant_country_code, tenant_industry_code, tenant_legal_name, tenant_metadata, tenant_name, tenant_size_band, tenant_status`)
- Apparent registry intent: `match_on=legacy_tenant_id` refers to the **source raw_record field** (correct as `src`), but the **target lookup column** is implicit/conventional, NOT in the payload. The compiler interpretation (treating `match_on` as the target lookup column) does not match the registry's actual semantic.

This was **latent in Goal 001a v5** because LOOKUP_FK mappings were SKIPPED entirely (audit `SKIPPED_UNSUPPORTED_TRANSFORM_V1`). Activating them in Goal 002 surfaces the pre-existing registry-vs-compiler semantic gap.

**Scope verdict**: this is a registry data-correctness issue + compiler semantic clarification, requires:
- (a) brownfield registry refactor to add `target_lookup_col` field to LOOKUP_FK payloads OR
- (b) compiler convention extension to map `match_on=legacy_X_id` → `target_table='sys_Xs'` lookup via `<X>_code` convention OR
- (c) inverse: payload `match_on` interpreted as `<col>_in_target = staging_raw_record->>'<match_on>'`

This is **beyond Goal 002's PROMPT scope** ("rewrite `transform-compiler.ts:289-329` LOOKUP_FK case to read `payload.match_on` instead of inventing column names" — done; the inventing-vs-reading was the spec; the per-table-semantic mismatch was not).

**Action**: documented as blocker for A10/A11. Recommended Goal 003 for registry/compiler semantic alignment.

### Step 8 final acceptance status

| Criterion | Result | Notes |
|---|---|---|
| A1 — pnpm test ≥ 276 + new tests | ✅ | 289 passed, 5 skipped, 0 failed |
| A2 — 8 JSON_EXTRACT tests (4+ adversarial) | ✅ | All green at commit b6d7394 |
| A3 — 3 LINEAGE_SOURCE_NK tests | ✅ | All green at commit b6d7394 |
| A4 — 6 LOOKUP_FK tests (3+ adversarial) | ✅ | 10 tests including 3 adversarial green at commit bba7fa7+89ab29a |
| A5 — debug-scale-v4 gated all assertions | ✅ | 3 passed including #11/#12/#13/#14 |
| A6 — SKIPPED_UNSUPPORTED_TRANSFORM_V1 = 0 | ✅ | Confirmed in run 3 audit (count=0) |
| A7 — HANDLED_VIA_LINEAGE_WRITE_V1 ≥ 1 | ✅ | Run 3 audit count = 81 (≥1 satisfied) |
| A8 — pg_stat_statements 1 INSERT INTO sys_skills template | ✅ | Soft-asserted in test, telemetry present |
| A9 — idempotency rerun | ✅ | wave1-idempotency 1/1 PASS, target delta=0 |
| **A10 — full-scale sys_skills ≥ 5000** | **❌** | Achieved 444 (was 394 pre-run, +50 INSERT). Blocked by registry semantic mismatch (30 LOOKUP_FK mappings fail). |
| **A11 — lineage ≥ 47000 with non-null run_id** | **❌** | Achieved 377 (377 with non-null run_id from this run; pre-existing 681 NULL preserved). Same blocker. |
| A12 — ≥ 8 atomic commits Goal 002 | ✅ | 10 commits: b6d7394 e7bcdf8 bba7fa7 8945548 8f3796e 5a750b4 188b6e0 89ab29a 497ff90 + this REPORT |
| A13 — no_conflict_inference_available = 0 | ✅ | Run 3 audit confirms (count=0, migration 000031 efficacy) |
| A14 — typecheck PASS | ✅ | After every commit |
| A15 — lint 0 errors | ✅ | After every commit |

**13/15 PASS, 2/15 FAIL (A10/A11 blocked by registry-semantic blocker outside Goal 002 scope)**

### Wall-clock summary

- Full-scale run avg: ~110s (≥ 5× faster than 600s soft-acceptance — extreme headroom)
- Per-mapping bottleneck: NOT timing; it's the silently-skipped 30 LOOKUP_FK mappings

---

## Step 9 — REPORT 002

See `_04_REPORT_002_json-extract-lineage-fullscale.md` for closure narrative.

---

*End of _03_EXEC_002_json-extract-lineage-fullscale.md*
