# _02_PLAN_002_json-extract-lineage-fullscale.md

**Protocol phase:** PLAN (executor → supervisor)
**Goal ID:** 002
**Slug:** json-extract-lineage-fullscale
**Author:** Claude Code CLI (Opus 4.7 1M) on Windows (DESKTOP-KH728P2)
**Created:** 2026-05-19T04:50:00+02:00
**Plan version:** v1
**Predecessor artefacts (READ + RESPECTED):**
- `_00_DISCOVERY_002_json-extract-lineage-fullscale.md` (facts — 526 lines)
- `_00_STATE_002.md` (machine contract, B1/B2/B3/C1 locked)
- `_01_PROMPT_002_json-extract-lineage-fullscale.md` (this turn's PROMPT, 388 lines)
- `_02_PLAN_001_audit_upsert_refactor.md` v5 (§-1 standing lessons inheritance)
- `_05_REVIEW_001a_audit_upsert_refactor.md` (closure pattern reference)
- `_04_REPORT_001a_audit_upsert_refactor.md` (acceptance pattern reference)

**Files inspected directly (source-of-truth reads, not summaries):**
- `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts` (336 lines, sha `7baae00d2b87…`)
- `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts` (491 lines, sha `cfde8b2ca48a…`)
- `apps/api/src/modules/brownfield-wave-executor/engine.ts` lines 1-200, 540-870 (1103 lines, sha `4b7dd9cc06aa…`)
- `apps/api/src/modules/brownfield-wave-executor/run-logger.ts` (67 lines, sha `2df532d55854…`)
- `apps/api/test/transform-compiler.test.ts` (362 lines), `wave1-debug-scale-v4.test.ts` (292 lines), `wave1-idempotency.test.ts` (168 lines)

---

## §-1 — Standing lessons (inherited from PLAN 001 v5)

1. **DB-only forensic insufficient**; code reading mandatory for any "engine does/doesn't X" claim. Applied: DISCOVERY 002 §6 corrected REPORT §7 item 3 via direct `pg_index` query; we will repeat this discipline at EXEC step 0 (E.g. verify column type via `information_schema.columns` not "I think it's varchar").
2. **G11 cross-check** — every functional step (§2.2) maps to ≥ 1 acceptance criterion (§2.6) AND vice versa. Applied: §2.2 ↔ §2.6 cross-check table in §2.11 below.
3. **Hybrid > full rewrite** when constraints tight; surface deferrals transparently (001a v5 E2 pattern). Applied: §2.5 Option β preserves the existing `executeUpsertSqlSidePerMapping` signature shape; JS-side dead-code wrapper stays untouched.
4. **Test/code co-commit batching** saves turn budget. Applied: §2.7 commit sequence groups production code + its targeted test in a single commit.
5. **Vitest path convention**: `test/**/*.test.ts` (NOT `__tests__/`). Applied: all new test fixtures live at `apps/api/test/`.
6. **Env-gated tests** are the right pattern for >2min integration runs. Applied: full-scale runner uses dedicated `tsx scripts/run-wave1-fullscale.mjs`, NOT vitest fixture (preserves audit trail per PROMPT §2 Problem 6).

---

## §0 — Executive summary

Close MVP-3 Tappa D by extending the Goal 001a v5 SQL-side UPSERT path to handle the 852 currently-skipped Wave 1 column mappings (72.4% of 1177) — distributed across JSON_EXTRACT (759), LINEAGE_SOURCE_NK (93), and LOOKUP_FK convention-misses (~3 of 49). Add type-coerce auto-wrap for DIRECT_COPY/TRIM into non-text targets. Validate the closure with a durable full-scale 47k Wave 1 run whose audit trail persists (no `afterAll` cleanup), satisfying acceptance ≥ 5000 sys_skills + wall-clock ≤ 10 min + import_run_status=COMPLETE + 0 `SKIPPED_UNSUPPORTED_TRANSFORM_V1` rows.

Turn budget honest estimate: **28 turns** (buffer 12 within 40 cap; escalation at 38 if telemetry lag).

---

## §1 — Vocab + payload reference (inherited from DISCOVERY 002)

Restated for in-context reference; full details in DISCOVERY 002 §3/§4/§5.

| Code | Count | Payload keys | Target column shape | Strategy |
|---|---|---|---|---|
| JSON_EXTRACT | 759 | `{path, direction?, source_dtype?}` | always `*_metadata` jsonb | NEW compile fragment + per-target-column `jsonb_build_object` aggregation |
| LINEAGE_SOURCE_NK | 93 | `{note}` (documentary) | always `*_id` uuid | NEW compile case → `fragment=null` + audit `HANDLED_VIA_LINEAGE_WRITE_V1` |
| LOOKUP_FK | 49 | `{target_table, match_on}` | varies | MODIFY existing case to read `payload.match_on`; whitelist regex |
| DIRECT_COPY / TRIM | (subset of 325) | `{}` | non-text target | NEW behaviour: auto-wrap in `CAST(... AS pg_type)` |
| 12 mechanical | 325 | (existing) | (varies) | UNCHANGED (shipped 001a v5) |

Path patterns (DISCOVERY §3.3): 758/759 follow `$.legacy.<column_name>`, depth 1-2 only; 1 outlier `$.phases[].order` returns NULL in both JS and SQL (DISCOVERY §3.4 confirmed). All 759 target columns are `*_metadata` jsonb (DISCOVERY §3.5).

`match_on` example forms (DISCOVERY §5.2):
- plain column: `legacy_tenant_id` (most common: 33/49 use this)
- expression with jsonb operator: `learning_module_metadata->>'legacy_id'`

DB preflight (DISCOVERY §6 + §13): migration 000031 applied → all Wave 1 targets have UQ visible to `loadTargetMeta`. `pg_stat_statements 1.10` enabled → criterion 11 verifiable via direct telemetry.

---

## §2.1 — Baseline capture plan (EXEC step 0)

Measurements taken before any source/DB write. Each artefact stored verbatim in `_03_EXEC_002_*.md` with verified-by timestamps.

| # | Measurement | Command | Expected baseline |
|---|---|---|---|
| 0.1 | `pnpm test` baseline | `pnpm --filter @heuresys/api test` | 276 passed \| 5 skipped \| 0 failed |
| 0.2 | Source SHAs (rollback anchor) | `sha256sum apps/api/src/modules/brownfield-wave-executor/*.ts` | matches DISCOVERY §10 fingerprints (or current main if drift since 2026-05-19T00:11Z) |
| 0.3 | DB row counts pre-run | `SELECT 'sys_skills', count(*) FROM sys.sys_skills UNION ALL ...` (11 tables per `wave1-idempotency.test.ts:46-58`) | snapshot for delta computation post-run |
| 0.4 | Backup mtime ≤ 6h | `ssh oracle-vm-default 'ls -la /home/ubuntu/backups/heuresys_advanced_pre_goal002_20260518_2233.dump'` | mtime 2026-05-18T22:33 UTC; age verified ≤ 6h at EXEC start or NEW dump created (~30s on VM) |
| 0.5 | Migration 000031 verified | `SELECT * FROM sys.sys_schema_migrations WHERE migration_id=384` | row present, sha matches DISCOVERY §13.2 |
| 0.6 | pg_stat_statements verified | `SELECT extname, extversion FROM pg_extension WHERE extname='pg_stat_statements'` | `('pg_stat_statements', '1.10')` |
| 0.7 | pg_stat_statements reset | `SELECT pg_stat_statements_reset();` | clean slate for telemetry assertions |
| 0.8 | Verify 4 JSON_EXTRACT-without-direction mappings | DISCOVERY 002 §11 U2 query (target_column types check) | jsonb-only → embed-default; scalar → UnsupportedTransformError per mapping (audit logged) |
| 0.9 | Existing wave1-debug-scale-v4 baseline (cap=20) | `BROWNFIELD_RUN_DEBUG_V4=1 pnpm --filter @heuresys/api exec vitest run test/wave1-debug-scale-v4.test.ts` | PASS green; capture audit counts pre-extension |

If 0.1-0.9 don't all confirm, halt and escalate before any code change.

---

## §2.2 — Code change plan (ordered by dependency)

For each item: file, current state, intended change, risk class, test coverage.

### Item A — `transform-compiler.ts`: add `JSON_EXTRACT` to SUPPORTED_TRANSFORMS + case branch

- **Current**: switch/case at lines 254-329; `SUPPORTED_TRANSFORMS` at 175-189 includes 12 mechanical + LOOKUP_FK + SKIP + null. `JSON_EXTRACT` raises `UnsupportedTransformError`.
- **Change**: extend `SUPPORTED_TRANSFORMS` with `"JSON_EXTRACT"`. Add case branch that:
  1. Reads `payload.path` (string, required; reject non-string with `InvalidJsonExtractPayloadError`).
  2. Strips `$.` prefix; splits on `.`; filters empty segments (matches JS-side `transforms.ts:113` parity).
  3. For each segment, escapes via `format("%L", segment)` then concatenates as `(srcExpr -> %L -> %L -> ... -> %L)`. The `srcExpr` for JSON_EXTRACT must be the raw jsonb subtree, NOT the `->>%L` string-extract — caller (upsert-sql.ts) constructs `(staging_raw_record -> %L)` form when transform is JSON_EXTRACT, vs `(staging_raw_record ->> %L)` for scalar transforms. See Item D for the caller-side change.
  4. Empty `path` or missing `$.` prefix → fallback: emit fragment that returns `NULL::jsonb` and audit-warn (does not throw); preserves JS semantics where invalid path returns null.
- **Risk class**: medium. Whitelist `%L` per-segment escapes injection at the jsonb-key level; PG returns NULL on missing key (semantically same as JS).
- **Test coverage**: new test block in `transform-compiler.test.ts` — 8 tests:
  - happy path `$.legacy.tenant_id` → `(src -> 'legacy' -> 'tenant_id')`
  - depth 1: `$.legacy` → `(src -> 'legacy')`
  - bracket outlier: `$.phases[].order` → `(src -> 'phases[]' -> 'order')` (NULL at runtime, matches JS)
  - adversarial: `$.legacy.foo';DROP TABLE--` → escaped to `'foo'';DROP TABLE--'`
  - adversarial: `$.legacy.SELECT` → escaped, no SQL syntax
  - adversarial: `$.legacy.$$evil$$` → escaped, no dollar-quoting
  - empty path → `NULL::jsonb` fallback
  - missing path key → `InvalidJsonExtractPayloadError`

### Item B — `transform-compiler.ts`: add `LINEAGE_SOURCE_NK` case

- **Current**: raises `UnsupportedTransformError`.
- **Change**: extend `SUPPORTED_TRANSFORMS` with `"LINEAGE_SOURCE_NK"`. Add case returning `{ fragment: null, targetColumn }` (semantically SKIP). Add a discriminator on the result so the caller can distinguish "skip-because-unsupported" (legacy SKIP code) from "skip-because-handled-by-lineage" (LINEAGE_SOURCE_NK).
  - Option B.1 (simpler): callers pre-detect transform code === `"LINEAGE_SOURCE_NK"` before calling compileTransform and emit the `HANDLED_VIA_LINEAGE_WRITE_V1` audit row themselves (engine.ts side).
  - Option B.2 (cleaner): extend `CompileResult` with optional `auditClassification?: "HANDLED_VIA_LINEAGE_WRITE_V1"` field; caller reads it after compile.
  - **DECISION**: Option B.1. Engine already pre-filters via `SUPPORTED_TRANSFORMS` (engine.ts:668-673); adding the case there is symmetrical and avoids touching the `CompileResult` shape. The compiler returns `fragment=null` (treated as SKIP by upsert-sql.ts:139). Audit emission happens in engine.ts before upsert-sql call (parallel to existing `recordSkippedColumnMapping` at engine.ts:606-638; new helper `recordHandledViaLineage` adjacent).
- **Risk class**: low. Pure additive; no other call-site impact.
- **Test coverage**: 3 tests in `transform-compiler.test.ts` — fragment=null returned; targetColumn preserved; SUPPORTED_TRANSFORMS contains the code.

### Item C — `transform-compiler.ts`: rewrite `LOOKUP_FK` case to read `payload.match_on`

- **Current**: lines 289-329 invent `lookup_col_primary` / `lookup_col_secondary` from target_table convention (`<short>_external_id` / `<short>_code`).
- **Change**:
  1. Read `payload.match_on` (string, required; throw `InvalidLookupFkPayloadError` if missing).
  2. Validate via whitelist regex `/^[a-z_][a-z0-9_]*(->>'[a-z_][a-z0-9_]*')?$/` (capture group 1 = column name, optional group 2 = jsonb key).
  3. For plain-column form (no `->>`): emit `WHERE %I = (%s)` with `%I` on the column name.
  4. For expression form: parse `<col>->>'<key>'`, escape `<col>` with `%I` and `<key>` with `%L`, emit `WHERE %I->>%L = (%s)`.
  5. Reject anything else → `InvalidLookupFkPayloadError("match_on does not match accepted forms")`.
  6. Read `payload.return_col` (optional, default `<short>_id`); reject expression form for return_col (PK is always a plain column).
  7. Drop the convention-based secondary fallback (`<short>_code` OR clause). Behaviour change: 49/49 mappings have just `(target_table, match_on)` so the secondary was always invented; removing it doesn't degrade real data and eliminates injection-prone double-interpolation.
  8. Keep `payload.target_table` validation as before (`format("%I", target_table)`).
- **Risk class**: medium. Behaviour change for the 49 LOOKUP_FK mappings; the secondary OR clause is removed (was DEAD against real data per DISCOVERY §5.1). 33/49 use `match_on=legacy_tenant_id` against `sys_tenancies` — primary regression fixture.
- **Test coverage**: 6 tests in `transform-compiler.test.ts`:
  - plain column: `match_on=legacy_tenant_id`, target=`sys_tenancies` → `WHERE legacy_tenant_id = (src)`
  - expression: `match_on=learning_module_metadata->>'legacy_id'` → `WHERE learning_module_metadata->>'legacy_id' = (src)`
  - adversarial: `match_on=legacy';DROP--` → throws `InvalidLookupFkPayloadError`
  - adversarial: `match_on=col->>'key';DROP--` → throws (regex anchor `$` rejects trailing payload)
  - adversarial: `match_on=col->>'k1'->>'k2'` → throws (regex allows ≤ 1 `->>` only)
  - missing `match_on` key → throws `InvalidLookupFkPayloadError`

### Item D — `upsert-sql.ts`: per-target-column aggregation for JSON_EXTRACT (Option β)

- **Current**: lines 116-157 build `colEntries` with 1 entry per `cm`; if multiple cms target the same column, keeps first (line 154 dedup).
- **Change**: pre-process `columnMappings` to GROUP BY `target_column` for JSON_EXTRACT mappings only. For each group:
  1. Skip the per-mapping compile loop for JSON_EXTRACT entries; instead, after the existing loop completes, iterate groups.
  2. For each (target_column, [cm1, ..., cmN]) JSON_EXTRACT group where the column type is jsonb:
     - Construct individual fragments by calling `compileTransform` for each cm with a `srcExpr` of `staging_raw_record` (the raw jsonb root, NOT `staging_raw_record->>%L`). JSON_EXTRACT operates on the entire raw record.
     - Derive key for each frag: `lastSegment(cm.transform_payload.path)` after stripping `$.legacy.` prefix (fallback to `$.` strip). Documented in transform-compiler.ts comment per §2.5 design.
     - Emit single colEntry: `{ targetCol, sql: format("jsonb_build_object(%s)", pairs.join(", "))` where `pairs = "%L, %s, %L, %s, ..."` with key literals and fragment expressions.
  3. For target_column already populated by a non-JSON_EXTRACT mapping (mixed-transform): error + audit `MIXED_TRANSFORM_TARGET_AMBIGUOUS` skip-reason, do NOT emit aggregation; existing colEntry from §2.2 Item D step 1 remains.
  4. For target_column where group has 1 JSON_EXTRACT mapping only: STILL wrap in `jsonb_build_object` (for consistency and predictable shape).
  5. On `ON CONFLICT DO UPDATE`: include the aggregated column in the SET clause as `metadata_col = EXCLUDED.metadata_col` (full REPLACE, per PROMPT §2.5 decision — source-of-truth is new run).
- **Risk class**: medium-high. New code path adds complexity to colEntries construction; must not corrupt the existing 325 mechanical mappings flow.
- **Test coverage**:
  - `transform-compiler.test.ts` already covers fragment-level compile.
  - `wave1-debug-scale-v4.test.ts` extension: assert at least 1 target row in `sys.sys_skills` has non-null `skill_metadata` after debug run; cross-check `jsonb_object_keys(skill_metadata)` returns ≥ 1 of the expected path-last-segment keys per DISCOVERY §3.3.

### Item E — `upsert-sql.ts`: type-coerce auto-wrap for DIRECT_COPY/TRIM into non-text targets

- **Current**: lines 142-157 apply `LEFT(frag, maxLen)` for varchar/bpchar only; no other type adaptation. A DIRECT_COPY into an int/bool/numeric/date column relies on PG's implicit cast from text, which works for `'123'::int` but fails for malformed values (caught by lines 350-358 try/catch → mapping skip).
- **Change**: after `compileTransform` returns and BEFORE the varchar-LEFT wrapper, inspect `colType = targetMeta.columnTypes.get(targetColumn)`. If `colType ∈ {int2, int4, int8, numeric, bool, date, timestamptz, timestamp}` AND the original `cm.transform` is `DIRECT_COPY` or `TRIM` or `null` (treated as DIRECT_COPY), wrap fragment in `CAST(<frag> AS <pg_type>)` using whitelist map per PROMPT §2 Problem 5. UUID is intentionally EXCLUDED — UUID rows are skip-filter-handled (lines 238-269).
- **Risk class**: medium. Adds wrapping that may surface previously-tolerated bad data as INSERT failures → mapping audit-logged as `insert_failed:` skip reason. The 001a v5 path already catches this (lines 350-358).
- **Test coverage**:
  - `transform-compiler.test.ts`: doesn't apply directly (compiler is type-agnostic; wrap happens in upsert-sql).
  - New test file or extension to `wave1-debug-scale-v4.test.ts`: assert at least 1 mapping with int/numeric target produces correctly-typed values in sys.* AFTER debug run (cross-check via `pg_typeof`).

### Item F — `engine.ts`: register LINEAGE_SOURCE_NK in audit emission path

- **Current**: lines 605-638 `recordSkippedColumnMapping` writes `SKIPPED_UNSUPPORTED_TRANSFORM_V1` for any cm not in `SUPPORTED_TRANSFORMS`. After Item B, LINEAGE_SOURCE_NK joins the supported set → would NO LONGER be audited.
- **Change**:
  1. Add new helper `recordHandledViaLineage(cm, m)` mirroring `recordSkippedColumnMapping` shape but with rule_code=`HANDLED_VIA_LINEAGE_WRITE_V1`, status=`HANDLED` (or `SKIPPED` — TBD per audit schema CHECK constraint; verify at EXEC step 0 with `\d audit.import_validation_results`).
  2. In the column_mappings loop (lines 666-673), add explicit branch: `if (cm.transform === "LINEAGE_SOURCE_NK") { await recordHandledViaLineage(cm, m); continue; }` (skip from `columnMappings` array entirely so upsert-sql doesn't try to emit a NULL fragment).
  3. Result: LINEAGE_SOURCE_NK mappings produce exactly 1 audit row per (mapping × run) with rule_code=HANDLED_VIA_LINEAGE_WRITE_V1; do NOT contribute to colEntries.
- **Risk class**: low. Pre-filter mirrors existing pattern; engine.ts:667 already has the branching primitive.
- **Test coverage**: extend `wave1-debug-scale-v4.test.ts`:
  - Assert `audit.import_validation_results.rule_code='HANDLED_VIA_LINEAGE_WRITE_V1'` count ≥ 1 per debug run (DISCOVERY §4.1: at least skill_id mapping is in scope at cap=20).
  - Assert NO LINEAGE_SOURCE_NK in `SKIPPED_UNSUPPORTED_TRANSFORM_V1` results.

### Item G — `transform-compiler.test.ts`: extension (8 + 3 + 6 = 17 new tests)

Already enumerated under Items A/B/C. Single file edit; minimal risk.

### Item H — `wave1-debug-scale-v4.test.ts`: extension

- **Current** (lines 1-95 inspected): 1 env-gated test (cap=20) verifies 5 criteria (#4/#5/#6/#7/#10 of PLAN v4 §2.6).
- **Change**: add 4 new assertions within the same `it.skipIf(!RUN_DEBUG_V4)` block (to stay env-gated; no new top-level test):
  - Assertion #11: `SKIPPED_UNSUPPORTED_TRANSFORM_V1` count = 0 for this `runId` (was ≥ 1 in 001a v4).
  - Assertion #12: `HANDLED_VIA_LINEAGE_WRITE_V1` count ≥ 1 for this `runId`.
  - Assertion #13: at least 1 sys.sys_skills row has non-null `skill_metadata` with `jsonb_object_keys` returning ≥ 1 expected key (e.g. `is_active` per DISCOVERY §3.3).
  - Assertion #14: `pg_stat_statements` count of `INSERT INTO sys.sys_skills%` for this run = 1 (criterion 11 from 001a v5 via direct telemetry; requires `pg_stat_statements_reset()` in beforeAll).
- **Risk class**: low. Additive assertions within existing scaffolding.

### Item I — `wave1-idempotency.test.ts`: rerun green

- **Current** (lines 1-80 inspected): env-gated, 2 consecutive 20-cap runs, asserts delta=0 on 11 sys.* tables.
- **Change**: NO code change. Run as-is post-Items A-F; assert still green. The new transform support (JSON_EXTRACT aggregation + LINEAGE_SOURCE_NK skip + LOOKUP_FK fix) MUST be idempotent (ON CONFLICT DO UPDATE replaces metadata, lineage MERGE pattern).

### Item J — NEW: `scripts/run-wave1-fullscale.mjs` (durable harness)

- **Why**: PROMPT §2 Problem 6 requires audit trail to persist (NOT cleaned up by `afterAll`). vitest is wrong tool. Use `tsx` script invocation.
- **Behaviour**:
  1. Login as admin via fetch to API on port 3001 (API server must be running; CI/dev convention).
  2. POST `/v1/brownfield/wave-executor/runs` `{ wave: 1, mode: "EXECUTE" }` with NO cap (don't set `WAVE1_DEBUG_LIMIT`).
  3. Poll status every 15s until terminal state OR 11min hard timeout.
  4. Print wall-clock + final state + brownfield.import_runs row + audit counts grouped by rule_code.
  5. Print pg_stat_statements summary for `INSERT INTO sys.%` queries.
  6. Exit non-zero if wall-clock > 10min OR state != COMPLETE OR any FAILED.
  7. Do NOT delete the import_runs row, ANY audit rows, or lineage rows. The audit trail persists as evidence.
- **Risk class**: medium. New runner; failure cost is "we don't get evidence" not "we corrupt data" (the run itself goes through the standard /v1/ endpoint which is fully audited).
- **Test coverage**: the runner IS the test. Manual run + transcript captured in `_03_EXEC_002_*.md`.

### Out-of-scope confirmations (per PROMPT §3)

- NO changes to `transforms.ts` (JS-side, dead-code-wrapped).
- NO changes to `repository.ts::writeLineage` (works as-is per Goal 001a v5 v3-bis evidence E1).
- NO changes to `run-logger.ts` (audit primitive sufficient; new audit rows go through existing `recordSkipped/recordHandled` pattern which uses inline `pool.query`, not `logRunEvent`).
- NO new migrations (000031 is the last DDL for this goal).
- NO changes to `apps/web/`.
- NO Wave 2/3/4 mapping introduction.

---

## §2.3 — DB write plan

Whitelist enforcement. Every row of expected writes maps to a §2.6 criterion.

| Object | Type | Trigger | Expected count (debug=20) | Expected count (full-scale) | Reversibility |
|---|---|---|---|---|---|
| `audit.import_run_logs` | INSERT (via existing `logRunEvent`) | engine state machine transitions | ≥ 5 | ≥ 5 per run × N runs | CASCADE on import_runs delete |
| `audit.import_validation_results` | INSERT | `recordSkippedColumnMapping` + new `recordHandledViaLineage` + upsert-sql skip path | `SKIPPED_UNSUPPORTED_TRANSFORM_V1`=0, `HANDLED_VIA_LINEAGE_WRITE_V1` ≥ 1, `insert_failed:*` ≥ 0 | `HANDLED_VIA_LINEAGE_WRITE_V1` ≥ 93 (per DISCOVERY §4.1) | explicit DELETE in test cleanup; manual purge for full-scale (intentionally retained) |
| `audit.import_approval_decisions` | INSERT | existing engine flow | ≥ 1 | ≥ 1 | explicit DELETE |
| `brownfield.import_runs` | INSERT + UPDATE | engine state machine (no change) | 1 row, COMPLETE | 1 row, COMPLETE | explicit DELETE (CASCADE-cleans logs) |
| `staging.wave1_*` | INSERT/UPDATE | engine.executeStage (no change) | bounded by debug-limit | up to 47k staging rows | TRUNCATE per `truncateAllWave1Staging` at next run |
| `sys.sys_source_lineage_records` | INSERT | upsert-sql lineage write (no change to writer) | ≥ 1 with non-null run_id | ≥ 47k with non-null run_id | explicit DELETE by run_id; 681 pre-existing NULL rows preserved (intentional) |
| `sys.sys_skills` + 10 other sys.* | INSERT/UPDATE | upsert-sql per-mapping path (extended for JSON_EXTRACT/CAST) | bounded by cap=20 staging | ≥ 5000 in sys_skills | `pg_restore` from `heuresys_advanced_pre_goal002_20260518_2233.dump` |
| `pg_stat_statements_reset()` | function call | EXEC step 0 + per-test beforeAll | N/A | N/A | stats-only, not data |

**Forbidden writes (per PROMPT §4.2)**: `legacy_mirror.*`, `brownfield.{column_mappings, source_columns, source_tables, table_mappings, source_exports}`, `sys.sys_schema_migrations` (controlled by `db/scripts/migrate.{sh,ps1}`), any DDL beyond `CREATE INDEX IF NOT EXISTS` style.

---

## §2.4 — Injection safety design (CRITICAL — LOOKUP_FK + JSON_EXTRACT)

Standalone section because both transforms read user-controlled payloads (DB-registered column_mappings; supplied by Cowork side via brownfield registry).

### 2.4.1 — LOOKUP_FK `match_on` whitelist

Regex: `/^[a-z_][a-z0-9_]*(->>'[a-z_][a-z0-9_]*')?$/`

Accepted forms (validated explicitly):
- `legacy_tenant_id` — plain column (33/49 mappings, primary regression fixture)
- `skill_name` — plain column
- `learning_module_metadata->>'legacy_id'` — single-step jsonb extract

Rejected forms (all produce `InvalidLookupFkPayloadError`):
- `legacy';DROP TABLE--` — quote injection
- `col->>'key';DROP--` — appended statement
- `col->>'k1'->>'k2'` — chained extract (depth > 1)
- `UPPER(col)` — function call
- `col || 'x'` — concatenation
- `col->'k'` — different operator
- `1=1` — predicate
- `*` — wildcard
- empty string, null, non-string types

`target_table` continues to use `format("%I", target_table)` — pg-format's identifier escape rejects anything that can't be safely `quote_ident`'d.

`return_col` (optional): plain regex `/^[a-z_][a-z0-9_]*$/` only; reject expression form (PK columns are always plain).

### 2.4.2 — JSON_EXTRACT path segment escaping

Strategy: per-segment `format("%L", segment)`. Path `$.legacy.tenant_id` produces:
```
(srcExpr -> 'legacy' -> 'tenant_id')
```

`%L` JSON-stringify-quotes any payload, so:
- `$.legacy.SELECT` → `(src -> 'legacy' -> 'SELECT')` (literal jsonb key lookup, no SQL keyword interpretation)
- `$.legacy.foo';DROP--` → `(src -> 'legacy' -> 'foo'';DROP--')` (literal key with embedded quote — escaped via `%L` doubling)
- `$.legacy.$$x$$` → `(src -> 'legacy' -> '$$x$$')` (literal key, no dollar-quote parsing)
- `$.phases[].order` → `(src -> 'phases[]' -> 'order')` (returns NULL at runtime — semantically equivalent to JS `row['phases[]']`)

Empty path or missing `$.` prefix: emit `NULL::jsonb` literal + audit `JSON_EXTRACT_INVALID_PATH_V1` warning (does NOT raise — JS-side returns null for these too).

### 2.4.3 — Adversarial fixtures list (covered in test items A, C)

| Vector | Fixture (path or match_on) | Expected behaviour |
|---|---|---|
| JE quote injection | `$.legacy.foo';DROP TABLE--` | escaped jsonb key lookup, no SQL execution |
| JE keyword | `$.legacy.SELECT` | escaped jsonb key lookup |
| JE dollar-quote | `$.legacy.$$x$$` | escaped jsonb key lookup |
| JE bracket | `$.phases[].order` | jsonb key lookup returns NULL at runtime |
| JE depth=5 (synthetic) | `$.a.b.c.d.e` | escaped 5-segment chain |
| JE empty | `` (empty) | `NULL::jsonb` + audit warn |
| LFK quote | `legacy';DROP--` | throws InvalidLookupFkPayloadError |
| LFK appended | `col->>'k';DROP--` | throws |
| LFK chained | `col->>'a'->>'b'` | throws |
| LFK func | `UPPER(c)` | throws |
| LFK missing | `payload={target_table: x}` | throws |

### 2.4.4 — Compile-time vs runtime split

- **Compile-time** (transform-compiler.ts): regex whitelist + `%I/%L` escape. Throws on unsupported forms. Rejected mappings audited via `recordSkippedColumnMapping` (existing flow at engine.ts:606-638).
- **Runtime** (PG): jsonb subtree returns NULL if path key missing. CAST failure caught by upsert-sql.ts:350-358 try/catch → mapping audit-logged as `insert_failed:` skip.

---

## §2.5 — JSON_EXTRACT aggregation design (CRITICAL — Option β)

### 2.5.1 — Algorithm

In `upsert-sql.ts::executeUpsertSqlSidePerMapping`:

1. Existing per-cm loop (lines 119-157) is augmented to SKIP cms with `cm.transform === "JSON_EXTRACT"`.
2. New post-loop step: GROUP collected JSON_EXTRACT cms by `cm.target_column`.
3. For each `(targetCol, [cm1, ..., cmN])` group where `targetMeta.columnTypes.get(targetCol) === "jsonb"`:
   - Compile each cm individually via `compileTransform` with `srcExpr = "staging_raw_record"` (raw jsonb root, NOT `staging_raw_record->>%L`). The compiler emits `(staging_raw_record -> 'legacy' -> 'tenant_id')` for path `$.legacy.tenant_id`.
   - Derive key via:
     ```ts
     function jsonExtractKey(path: string): string {
       const stripped = path.replace(/^\$\.legacy\./, "").replace(/^\$\./, "");
       return stripped.split(".").pop() ?? stripped; // last segment after dot-split
     }
     ```
   - 758/759 paths → key = column name from `$.legacy.<column>`. 1 outlier `$.phases[].order` → key = `"order"`.
   - Build `jsonb_build_object` SELECT-list entry:
     ```sql
     jsonb_build_object(
       'tenant_id', (staging_raw_record -> 'legacy' -> 'tenant_id'),
       'is_active', (staging_raw_record -> 'legacy' -> 'is_active'),
       ...
     )
     ```
   - Push as `colEntries.push({ targetCol, sql: <built_object> })`.
4. Mixed-transform target_column (e.g. someone wrote a DIRECT_COPY for the same `*_metadata` column): existing colEntry from step 1 stays; JSON_EXTRACT group is rejected with audit `MIXED_TRANSFORM_TARGET_AMBIGUOUS_V1` per offending cm. This case isn't observed in real data (DISCOVERY §3.5) but is guarded.
5. Group of 1 mapping: still wraps in `jsonb_build_object` for consistency. E.g. `jsonb_build_object('tenant_id', (raw -> 'legacy' -> 'tenant_id'))`.
6. 4 mappings without `direction` key (DISCOVERY §11 U2): at EXEC step 0.8, run U2's introspection query. If all 4 target jsonb columns → treat as embed-default. If any target scalar → audit `UNSUPPORTED_DIRECTION_NON_JSONB_V1` per offending cm + continue.

### 2.5.2 — ON CONFLICT semantics

When target row already exists, `DO UPDATE SET metadata_col = EXCLUDED.metadata_col` is added to the existing setClauses construction (upsert-sql.ts:290-298). This REPLACES the metadata entirely with the new build-object — legacy semantics not preserved by design (per PROMPT §2.5 explicit decision: source-of-truth is the new run, not a merge of old + new).

If the user wants MERGE semantics later (preserve prior keys not in new build-object), that's a Goal 003 feature (not 002).

### 2.5.3 — Mixed-transform check

```ts
// pseudo-code, in upsert-sql.ts after existing colEntries loop
const jeGroups = new Map<string, ColumnMappingRow[]>();
for (const cm of columnMappings) {
  if (cm.transform === "JSON_EXTRACT") {
    if (!jeGroups.has(cm.target_column)) jeGroups.set(cm.target_column, []);
    jeGroups.get(cm.target_column)!.push(cm);
  }
}
for (const [targetCol, cms] of jeGroups) {
  if (colEntries.some((e) => e.targetCol === targetCol)) {
    // Mixed-transform: existing entry was emitted by non-JE cm; skip JE group + audit
    // (audit emission delegated to engine.ts via return-value channel — TBD at impl,
    //  but a stderr log is acceptable for v1 since this case doesn't appear in real data)
    continue;
  }
  if (targetMeta.columnTypes.get(targetCol) !== "jsonb") {
    // Not jsonb: skip + audit UNSUPPORTED_JSON_EXTRACT_NON_JSONB_V1
    continue;
  }
  // Build jsonb_build_object SELECT entry
  ...
}
```

---

## §2.6 — Acceptance criteria (machine-checkable, G11 cross-checked)

Every criterion below maps to ≥ 1 §2.2 item; every §2.2 item produces effects verifiable by ≥ 1 criterion below. See §2.11 for the explicit cross-check matrix.

1. **A1** `pnpm --filter @heuresys/api test` exits 0; ≥ 276 + new tests passing; same 5 skipped (env-gated). Concretely: 276 baseline + 17 new transform-compiler tests = 293+ passing.
   - Verifies: Items A/B/C transform-compiler additions; baseline non-regression.

2. **A2** `transform-compiler.test.ts`: 8 new JSON_EXTRACT tests including ≥ 4 adversarial path fixtures, all green.
   - Verifies: Item A injection safety; Item A path-compile correctness.

3. **A3** `transform-compiler.test.ts`: 3 new LINEAGE_SOURCE_NK tests, fragment=null verified.
   - Verifies: Item B.

4. **A4** `transform-compiler.test.ts`: 6 new LOOKUP_FK match_on tests including ≥ 3 adversarial fixtures.
   - Verifies: Item C injection safety + behaviour change from convention-based to payload-driven.

5. **A5** `BROWNFIELD_RUN_DEBUG_V4=1 pnpm --filter @heuresys/api exec vitest run test/wave1-debug-scale-v4.test.ts`: green with assertions #4/#5/#6/#7/#10 (existing) + #11/#12/#13/#14 (new).
   - Verifies: Items D/E/F end-to-end at debug scale + Item H new assertions.

6. **A6** Debug-scale run: `audit.import_validation_results.rule_code='SKIPPED_UNSUPPORTED_TRANSFORM_V1'` count = 0 for this `runId`.
   - Verifies: Items A/B/C (all 14 codes now supported).

7. **A7** Debug-scale run: `audit.import_validation_results.rule_code='HANDLED_VIA_LINEAGE_WRITE_V1'` count ≥ 1 for this `runId`.
   - Verifies: Items B + F (new audit row class).

8. **A8** Debug-scale run: `pg_stat_statements` shows exactly 1 `INSERT INTO sys.sys_skills%` matching this run's statements (post-`pg_stat_statements_reset()` in beforeAll). Direct telemetry version of 001a v5 criterion 11.
   - Verifies: Item D doesn't multi-INSERT per mapping × run.

9. **A9** `BROWNFIELD_RUN_IDEMPOTENCY=1 pnpm --filter @heuresys/api exec vitest run test/wave1-idempotency.test.ts`: green; delta=0 on 11 sys.* tables between two consecutive runs.
   - Verifies: Item D `ON CONFLICT DO UPDATE` for jsonb aggregation is idempotent; Items B/E don't introduce new rows on rerun.

10. **A10** Full-scale 47k via `node scripts/run-wave1-fullscale.mjs`: durable run with audit trail PERSISTED (no afterAll cleanup), `brownfield.import_runs.import_run_status='COMPLETE'`, wall-clock ≤ 10 min, `sys.sys_skills` ≥ 5000 NEW rows.
    - Verifies: Item J + end-to-end orchestration; performance acceptance per PROMPT §2 Problem 6.

11. **A11** Full-scale run: `sys.sys_source_lineage_records` new row count ≥ 47000 with `source_lineage_import_run_id` non-null for all new rows; pre-existing 681 NULL rows unchanged.
    - Verifies: lineage write path (Goal 001a v5 unchanged) operates at full scale.

12. **A12** ≥ 8 atomic commits attributable to Goal 002 with signature `feat(api): MVP-3 Tappa D — <slice> (Goal 002 step <X>)` or `test(api): ... (Goal 002 step <X>)`. Commits sequence per §2.7.
    - Verifies: git discipline per PROMPT §4.4.

13. **A13** Full-scale run: `audit.import_validation_results.skip_reason='no_conflict_inference_available'` count = 0 (DISCOVERY §6.3 invariant).
    - Verifies: migration 000031 efficacy at full scale.

14. **A14** Final `pnpm --filter @heuresys/api typecheck`: PASS, no TS errors.
    - Verifies: source modifications are type-clean.

15. **A15** Final `pnpm --filter @heuresys/api lint`: 0 errors (zero-error baseline preserved post-session 2026-05-19 lint wiring).
    - Verifies: code quality discipline.

---

## §2.7 — Turn budget breakdown (40 cap, escalation at 38)

Honest estimate per step. Includes commit-and-typecheck per slice (lesson 4).

| Step | Description | Turn budget | Cumulative |
|---|---|---|---|
| 0 | Baseline capture per §2.1 (9 measurements + halt-gate if any fail) | 2 | 2 |
| 1 | Item A — JSON_EXTRACT compile + 8 tests + commit | 4 | 6 |
| 2 | Item B + F — LINEAGE_SOURCE_NK compile + engine audit branch + 3 tests + commit | 3 | 9 |
| 3 | Item C — LOOKUP_FK match_on rewrite + 6 tests + commit | 4 | 13 |
| 4 | Item D — JSON_EXTRACT aggregation in upsert-sql + commit | 5 | 18 |
| 5 | Item E — type-coerce auto-wrap in upsert-sql + commit | 2 | 20 |
| 6 | Items H + I — extend debug-scale-v4 assertions; rerun idempotency; commit | 4 | 24 |
| 7 | Item J — new full-scale runner script + commit | 3 | 27 |
| 8 | Full-scale execution + transcript capture + verify all 15 criteria | 4 | 31 |
| 9 | REPORT 002 authoring + EXEC log update + commit | 3 | 34 |
| 10 | Buffer for rework / debugging / clarifications | 4 | 38 (escalation threshold) |

Hard cap: 40. Buffer between 38 and 40 = 2 turns for emergency-only.

If during execution any single step exceeds its budget by > 50%, halt + escalate via STATE update with halt_reason rather than silent overrun.

---

## §2.8 — Risk register

Top 5 risks, probability × impact × mitigation. Each risk has an explicit mitigation that the executor MUST apply (not advisory).

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R1 | `jsonb_build_object` output exceeds target column size limit (jsonb columns have no length cap, but PG TOAST kicks in at ~2KB; very-large objects may hit `1GB` jsonb limit) | LOW | LOW | Wave 1 raw_record is bounded per legacy row (~few KB). 25-30 keys × short values = ~5KB worst case. No mitigation needed; if hit at full scale, audit + skip. |
| R2 | `match_on` regex too restrictive, blocks legitimate payloads | MEDIUM | HIGH (breaks 49 mappings if wrong) | DISCOVERY §5.2 surfaced 3 real patterns; regex covers all 3. AT EXEC step 0, query `SELECT DISTINCT match_on FROM brownfield.column_mappings WHERE column_mapping_transform='LOOKUP_FK'` and confirm all 49 distinct values match the regex BEFORE running EXEC step 3. If any don't match, halt + escalate. |
| R3 | Full-scale wall-clock > 10 min | MEDIUM | MEDIUM | Per-mapping single INSERT-SELECT is the bottleneck; expected ~5-7 min based on 001a v5 staging benchmarks. Mitigation: at step 8 capture per-mapping timings via pg_stat_statements; if any mapping > 30s, halt at 11 min hard timeout, escalate with revised acceptance proposal (NO silent variance per PROMPT). |
| R4 | LOOKUP_FK behaviour change breaks 49 mappings' UPSERT path (different col → different FK resolution → different `staging_target_record_id`) | MEDIUM | HIGH (corrupts existing sys.* rows by re-keying them) | The 49 LOOKUP_FK fragments feed correlated subqueries; result is a UUID FK column value. Different lookup column = different result on staging row. Mitigation: idempotency test (A9) — if delta != 0 on rerun, fix the LOOKUP_FK fragment to match prior semantics OR document the intentional change. |
| R5 | pg_stat_statements stats pollution across tests | LOW | LOW | `pg_stat_statements_reset()` in test beforeAll for any test that asserts on its counters (A8). Other tests don't read pg_stat_statements; pollution is harmless. |
| R6 | LINEAGE_SOURCE_NK audit `status` value not accepted by CHECK constraint on `audit.import_validation_results` | LOW | LOW | EXEC step 0 verifies via `\d audit.import_validation_results` + sample existing `status` values. If CHECK rejects `HANDLED`, fall back to `SKIPPED` with `rule_code` distinguishing the case (the rule_code is the real discriminator). |

---

## §2.9 — Rollback plan

Per code change: each commit is reversible via `git revert <sha>`. Sequence after EXEC:

1. If any §2.6 criterion fails irrecoverably and `git revert`-then-fix doesn't fit the turn budget: `git revert <commit1>..<commitN>` in reverse order, single new commit.
2. Lockfile not touched in this goal (no new deps). Rollback is source-only.

Per DB:
- No DDL in this goal (000031 already applied; 000032 not introduced).
- Rollback: `pg_restore` from `/home/ubuntu/backups/heuresys_advanced_pre_goal002_20260518_2233.dump` (124 MB, custom format).
  ```bash
  ssh oracle-vm-default \
    'sudo -u postgres pg_restore -d heuresys_advanced --clean --if-exists \
       /home/ubuntu/backups/heuresys_advanced_pre_goal002_20260518_2233.dump'
  ```
- Migration 000031 is **NOT** rolled back by this goal (the compiler now depends on `sys.sys_user_certifications_natural_key_uq` existing for conflictInference). If migration must be reverted, it requires its own goal.

Per audit:
- Full-scale run audit trail is intentionally retained on success. If rolling back (failure case), `pg_restore` clears it implicitly.
- Debug-scale test audit is cleaned by existing `afterAll` (lines 75-85 of wave1-debug-scale-v4.test.ts).

---

## §2.10 — Architectural advisory (non-binding observations)

Optional pre-EXEC discussion items. None block EXEC if Cowork doesn't respond.

1. **`recordHandledViaLineage` shape**: should it accept a 4th argument `note` so the audit row payload includes the LINEAGE_SOURCE_NK note text from `payload.note`? Useful for forensic later. Default in v1: yes, include `note` from payload in jsonb payload field.

2. **`MIXED_TRANSFORM_TARGET_AMBIGUOUS_V1`** audit code: introduced in §2.5.3 as a guard. Not observed in real data per DISCOVERY §3.5. Should we still emit the audit row + skip, or hard-error? Default in v1: emit audit row + skip (parallel to other unsupported cases), don't hard-error.

3. **Per-test `pg_stat_statements_reset()`**: only A8 reads pg_stat_statements. Cleaner to scope the reset to that test's beforeAll, not global. Default in v1: per-test in `wave1-debug-scale-v4.test.ts` beforeAll only.

4. **Full-scale runner output format**: machine-readable JSON to stdout AND human-readable summary to stderr, so REPORT 002 can include the JSON verbatim. Default in v1: yes, dual-channel output.

5. **`HANDLED_VIA_LINEAGE_WRITE_V1`** counter: should the engine print a summary line to stdout at end of run for operator visibility? Default in v1: yes, add to existing wave-summary log line at engine.ts close.

If Cowork rejects any of the v1 defaults, document the deviation in `_02b_APPROVAL_002.md` and the executor adjusts before commit.

---

## §2.11 — G11 cross-check matrix (NON-NEGOTIABLE)

Every §2.2 Item → ≥ 1 §2.6 criterion. Every §2.6 criterion → ≥ 1 §2.2 Item. Mechanical verification:

| §2.2 Item | Verified by §2.6 criterion(s) |
|---|---|
| A — JSON_EXTRACT compile | A1, A2, A5 (#13), A8, A14, A15 |
| B — LINEAGE_SOURCE_NK compile | A1, A3, A6, A7, A14, A15 |
| C — LOOKUP_FK rewrite | A1, A4, A14, A15 + R2-mitigation pre-check |
| D — JSON_EXTRACT aggregation | A5 (#13), A8, A9, A10, A11, A13 |
| E — type-coerce auto-wrap | A5, A9, A10, A14 |
| F — engine audit branch | A5 (#11, #12), A6, A7, A14 |
| G — transform-compiler.test extension | A1, A2, A3, A4 (=Items A/B/C indirectly) |
| H — wave1-debug-scale-v4 extension | A5, A6, A7, A8 |
| I — wave1-idempotency rerun | A9, A11 |
| J — fullscale runner | A10, A11, A13 |

| §2.6 criterion | Backed by §2.2 Item(s) |
|---|---|
| A1 (full pnpm test) | A, B, C, G + base regression |
| A2 (JE tests) | A, G |
| A3 (LSN tests) | B, G |
| A4 (LFK tests) | C, G |
| A5 (debug-scale) | D, E, F, H |
| A6 (SKIPPED=0) | A, B, C, F |
| A7 (HANDLED ≥1) | B, F, H |
| A8 (pg_stat_stmts=1) | D, H |
| A9 (idempotency) | D, E, I |
| A10 (full-scale OK) | D, E, J |
| A11 (lineage ≥47k) | D, J |
| A12 (commits ≥8) | (process; commits enumerated in §2.7) |
| A13 (no_conflict=0) | D (relies on 000031 + compiler invariant) |
| A14 (typecheck) | A, B, C, D, E, F |
| A15 (lint) | A, B, C, D, E, F |

**G11 self-check result**: every §2.2 step has matching §2.6 criterion, every §2.6 criterion has matching §2.2 step — verified at v1 draft.

---

## §6 — Post-PLAN actions (per PROMPT §6)

1. PLAN saved at `cowork_code_exchange/_02_PLAN_002_json-extract-lineage-fullscale.md` ✅.
2. Compute sha256 via `sha256sum cowork_code_exchange/_02_PLAN_002_json-extract-lineage-fullscale.md` (executor: next turn).
3. Update `_00_STATE_002.md`:
   - `current_phase: PLAN`
   - `plan_version: v1`
   - `plan_sha256: <computed>`
   - `next_actor: Cowork`
   - `last_event_summary: "PLAN v1 authored — G11 cross-check verified, 28 turns estimated within 40 cap"`
4. Chat summary in §7 below.
5. STOP. Wait for `_02b_APPROVAL_002.md` with PLAN sha256, OR Cowork revision request.

---

## §7 — Chat summary (for Cowork review)

**Goal 002 PLAN v1** drafted per PROMPT 002 spec.

**Turn budget**: 28 turns estimated (vs 40 cap), buffer = 12 turns. Escalation at 38 per B3.

**Top 3 design risks**:
1. **LOOKUP_FK behaviour change (R4)**: 49 mappings switch from convention-based to payload-driven lookup column. Mitigation: idempotency test (A9) catches re-keying; EXEC step 0 R2-mitigation pre-check confirms all 49 distinct `match_on` values match the whitelist regex.
2. **JSON_EXTRACT aggregation correctness (Item D)**: new code path in upsert-sql.ts. Mitigation: `jsonb_build_object` is well-understood PG primitive; idempotency assertion + post-run jsonb_object_keys check verify shape.
3. **Full-scale wall-clock (R3)**: 10min acceptance is tight per 001a v5 staging benchmarks. Mitigation: 11min hard timeout in runner + escalation protocol (no silent variance).

**Open questions (none blocking PLAN approval, all in §2.10)**:
1. Should `recordHandledViaLineage` include the LINEAGE_SOURCE_NK note text in the audit payload? (v1 default: yes)
2. `MIXED_TRANSFORM_TARGET_AMBIGUOUS_V1` semantics: skip+audit vs hard-error? (v1 default: skip+audit)
3. `pg_stat_statements_reset()` scope: global or per-test? (v1 default: per-test)

**G11 self-check result**: every §2.2 step has matching §2.6 criterion, every §2.6 criterion has matching §2.2 step — verified at v1 draft per §2.11 matrix.

**Status**: ready for Cowork APPROVAL via `_02b_APPROVAL_002.md` referencing this PLAN's sha256.

---

*End of _02_PLAN_002_json-extract-lineage-fullscale.md*
