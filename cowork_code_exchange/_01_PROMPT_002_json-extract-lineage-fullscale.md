# _01_PROMPT_002_json-extract-lineage-fullscale.md

**Protocol phase:** PROMPT (supervisor → executor)
**Goal ID:** 002
**Slug:** json-extract-lineage-fullscale
**Created:** 2026-05-19T00:50:00+02:00, by Cowork Desktop (claude.ai Desktop, Claude Opus 4.7)
**Target executor:** Claude Code CLI on Windows (DESKTOP-KH728P2)
**Predecessor artefacts:**
- `_00_DISCOVERY_002_json-extract-lineage-fullscale.md` (facts; **READ THIS FIRST**)
- `_00_STATE_002.md` (live status; YAML frontmatter is the machine contract)
- `_05_REVIEW_001a_audit_upsert_refactor.md` (Goal 001a closure REVIEW — pattern reference)
- `_04_REPORT_001a_audit_upsert_refactor.md` (final REPORT 001a — file paths + acceptance pattern)
- `_02_PLAN_001_audit_upsert_refactor.md` v5 (PLAN template + §-1 standing lessons)
- `_00_SESSION_HANDOFF_2026-05-18.md` (context-passing from previous session)
- `db/migrations/000031_add_uq_sys_user_certifications.sql` (Cowork-applied, sha `9a1fec95…`)

---

## ⚠️ CRITICAL — Protocol rule for this turn

**Your output for this turn MUST be `_02_PLAN_002_json-extract-lineage-fullscale.md`, not execution.**

This is PROMPT phase (1) of the cowork_code_exchange v2.1 protocol. Your next deliverable is `_02_PLAN_002_*.md`, the detailed execution plan — written but **not executed**. After Cowork reviews and persists `_02b_APPROVAL_002.md` with your PLAN's sha256 in its frontmatter, then and only then you produce `_03_EXEC_002_*.md` (action log) and `_04_REPORT_002_*.md` (closure).

**Do NOT** start coding in this turn. Do NOT touch the DB beyond read-only diagnosis. Do NOT run tests. Output is **markdown only**, saved at `cowork_code_exchange/_02_PLAN_002_json-extract-lineage-fullscale.md`.

---

## §0 — Task framing

**Single goal**: close MVP-3 Tappa D (Brownfield Wave 1 at full scale).

Goal 001a v5 shipped the SQL-side UPSERT framework for 12 mechanical transforms (325 of 1177 mappings = 27.6%). Goal 002 closes the remaining **852 mappings (72.4%)** + the full-scale 47k-row Wave 1 verification.

Cowork has pre-completed the infrastructure work:
- migration 000031 (UQ on `sys.sys_user_certifications`) — APPLIED at 2026-05-18T22:34Z, tracked id=384, sha `9a1fec95…`
- `pg_stat_statements` enabled (postgresql.conf edit + restart, ~2s downtime, 0 sessions active)
- fresh pg_dump backup at `/home/ubuntu/backups/heuresys_advanced_pre_goal002_20260518_2233.dump` (124 MB, mtime 22:33 UTC)

You inherit a clean preflight. Decisions B1/B2/B3 are locked in DISCOVERY 002 §14. Your PLAN only fills the technical design space.

**G11 — Step ↔ Acceptance cross-check rule (NON-NEGOTIABLE, from Goal 001a v5 lesson)**: every functional step in your §2.2 MUST map to ≥ 1 acceptance criterion in your §2.6, AND vice versa. PLAN drafting workflow:
1. Draft §2.2 (code changes) and §2.6 (acceptance) together
2. Cross-check: every §2.2 item → ≥ 1 §2.6 criterion
3. Map-back: every §2.6 criterion → ≥ 1 §2.2 item
4. Items without acceptance: either add criterion, or downgrade to "stretch goal" in §0

This is the single most-cited 001a v5 lesson. Encoded in `cowork_code_exchange/README.md` v2.1 §"Phase 1 — PROMPT" cross-check rule.

---

## §1 — Verified facts you inherit (from DISCOVERY 002)

You do NOT need to re-verify these. They are the bedrock of your PLAN.

### 1.1 — Vocab counts (Wave 1, 1177 column_mappings total)

| Transform code | mapping count | Goal 002 strategy |
|---|---|---|
| JSON_EXTRACT | 759 | NEW compile fragment — jsonb path traversal; aggregation per target_column |
| LINEAGE_SOURCE_NK | 93 | NEW compile fragment — `fragment=null` + audit `HANDLED_VIA_LINEAGE_WRITE_V1` |
| LOOKUP_FK | 49 | EXTEND existing compile — read `payload.match_on` (was inventing names) |
| 12 mechanical | 325 | unchanged (shipped 001a v5) |
| LOOKUP_FK convention misses fix | (~3 of 49) | NEW behavior — target-schema introspection at compile time |
| type-coerce auto-wrap | (~2 of 325 DIRECT_COPY) | NEW behavior — wrap DIRECT_COPY/TRIM in CAST when target type non-text |
| ON CONFLICT for sys_user_certifications | 1 mapping | RESOLVED (migration 000031), no compiler change required |

### 1.2 — JSON_EXTRACT critical facts
- 759/759 payloads have `{path, direction, source_dtype}` keys (uniform).
- 758 paths follow `$.legacy.<column_name>` pattern. 1 outlier: `$.phases[].order` (bracket-notation, behaves as literal jsonb key `"phases[]"`, returns NULL — JS and SQL identical).
- **ALL 759 target columns are `*_metadata` jsonb fields** (no scalar targets observed).
- Multiple JSON_EXTRACT mappings target the SAME `*_metadata` column for the same target table (e.g., `blueprint_override_metadata` receives 25+ mappings).
- `direction = "embed"` on 755/759; 4 mappings lack this key.

### 1.3 — LINEAGE_SOURCE_NK critical facts
- 93/93 payloads = documentary note only: `{"note": "legacy primary key stored on lineage row..."}` referencing a `source_pk_value` column that DOES NOT EXIST in sys_source_lineage_records.
- Actual landing place for legacy PK: `source_lineage_source_record_id` (via `staging.staging_source_record_id`, already populated by 001a v5 upsert-sql.ts lineage JOIN).
- target columns: all `*_id` UUID PKs of sys.* tables (e.g., `skill_id`, `skill_taxonomy_edge_id`).
- JS-side `transforms.ts:125-127` returns `raw` (no-op). The intent is "skip from target SELECT".

### 1.4 — LOOKUP_FK critical facts
- 49/49 payloads have `{target_table, match_on}` keys only.
- Current compiler at `transform-compiler.ts:289-329` INVENTS `lookup_col_primary` via convention (`<short>_external_id`) instead of reading `match_on`. This is the root cause of REPORT §7 item 1.
- `match_on` example values:
  - plain column: `"legacy_tenant_id"` (most common)
  - expression: `"learning_module_metadata->>'legacy_id'"` (some, with jsonb operator)
- 33/49 target `sys_tenancies` with `match_on=legacy_tenant_id`.

### 1.5 — DB state baseline (post-Goal-001a + Cowork-side actions)
- sys.sys_user_certifications has 1 row + 1 NEW UNIQUE INDEX (migration 000031).
- pg_stat_statements active (3 queries tracked at install time).
- audit.* are 0 between runs (test cleanup via CASCADE-delete on import_runs).
- 681 NULL-FK lineage rows persist as documented pre-history.

### 1.6 — Source code state
- `transform-compiler.ts` (337 lines): supports 12 mechanical codes. **Goal 002 extends to JSON_EXTRACT + LINEAGE_SOURCE_NK; modifies LOOKUP_FK to read payload.match_on.**
- `upsert-sql.ts` (491 lines): SQL-side INSERT-SELECT-ON CONFLICT framework. **Goal 002 extends with: (a) per-target-column aggregation for JSON_EXTRACT, (b) type-coerce auto-wrap for non-text-compatible targets, (c) handles LINEAGE_SOURCE_NK as fragment=null.**
- `engine.ts` (1103 lines): orchestrator + loadTargetMeta. **Goal 002 may need engine.ts modifications for per-target-column grouping if upsert-sql.ts API changes.**
- `transforms.ts` (170 lines): JS-side legacy, dead-code-wrapped. **No modifications.**
- `run-logger.ts` (67 lines): audit primitive. **No modifications expected; may extend audit `level` vocabulary for HANDLED_VIA_LINEAGE_WRITE_V1.**

---

## §2 — Problems to solve in this goal (interlocked, single closure)

### Problem 1 — JSON_EXTRACT compile fragment for jsonb metadata targets

**Required transformation**: extend `transform-compiler.ts` to handle JSON_EXTRACT. The compile fragment must:
- Treat `payload.path` as PG jsonb path traversal
- Strip `$.` prefix, split on `.`, emit safe `srcExpr -> 'seg1' -> 'seg2' -> ... -> 'segN'` chain
- Each path segment escaped via `pg-format %L` (or per-segment quoting)
- Target type is jsonb (not text) — fragment returns jsonb subtree
- NULL handling: if intermediate segment doesn't exist in jsonb, PG `->` returns NULL automatically (matches JS semantics)
- Bracket-notation segment `phases[]` treated as literal jsonb key (matches JS behavior — produces NULL because `"phases[]"` is rarely a real key)
- Empty/missing `payload.path` → fragment falls back to passing through `srcExpr` as jsonb (or skip)

### Problem 2 — JSON_EXTRACT aggregation per target column (Option β)

**Required transformation**: extend `upsert-sql.ts` to GROUP column_mappings by `(target_column)` when the column is jsonb AND has ≥ 1 JSON_EXTRACT mapping. For each group:
- Collect all JSON_EXTRACT fragments + their `payload.path` last segment (the leaf key after stripping `$.legacy.`)
- Emit a single `jsonb_build_object('key1', frag1, 'key2', frag2, ..., 'keyN', fragN)` expression as the compiled SELECT entry for that target column
- For mappings within the group missing `payload.direction` (or with non-`embed` direction): treat as `embed`-default IF target is jsonb; raise `UnsupportedTransformError` otherwise

Key naming for `jsonb_build_object` keys: use the **last segment of `payload.path`** after stripping `$.legacy.` (or `$.`). E.g., `$.legacy.tenant_id` → key `"tenant_id"`. This is deterministic, unambiguous, and matches the legacy semantics where each path-extracted value re-emerges as a top-level key inside the metadata.

The 4 mappings lacking `direction` key: the executor MUST query them at EXEC step 1 (DISCOVERY 002 §11 U2) and verify their target_column types:
```sql
SELECT cm.column_mapping_id, cm.column_mapping_target_column, c.data_type
FROM brownfield.column_mappings cm
JOIN brownfield.table_mappings tm ON tm.table_mapping_id=cm.column_mapping_table_mapping_id
JOIN information_schema.columns c ON c.table_schema='sys' AND c.table_name=tm.table_mapping_target_table AND c.column_name=cm.column_mapping_target_column
WHERE cm.column_mapping_transform='JSON_EXTRACT'
  AND NOT (cm.column_mapping_transform_payload ? 'direction');
```
If all 4 target jsonb → treat as embed-default. If any target scalar → `UnsupportedTransformError` for that specific mapping.

### Problem 3 — LINEAGE_SOURCE_NK fragment + audit reclassification

**Required transformation**: extend `transform-compiler.ts` to handle LINEAGE_SOURCE_NK by:
- Returning `{ fragment: null, targetColumn }` (semantically SKIP)
- BUT: the engine/upsert-sql layer must emit a distinct audit row, NOT `SKIPPED_UNSUPPORTED_TRANSFORM_V1`. New audit message: `HANDLED_VIA_LINEAGE_WRITE_V1`. Reason: these mappings are not unsupported — they are intentionally absorbed by the separate lineage write path.
- Add `LINEAGE_SOURCE_NK` to `SUPPORTED_TRANSFORMS` set so it doesn't raise `UnsupportedTransformError`.

### Problem 4 — LOOKUP_FK match_on payload + injection safety

**Required transformation**: rewrite `transform-compiler.ts:289-329` LOOKUP_FK case to:
- Read `payload.match_on` (string, required) instead of inventing column names
- Whitelist-validate `match_on` against regex `^[a-z_]+(->>'[a-z_]+')?$`
- For plain-column form (e.g., `"legacy_tenant_id"`): use `%I` (quote_ident) interpolation
- For expression form (e.g., `"learning_module_metadata->>'legacy_id'"`): parse the `column->>'key'` pattern; escape column with `%I`, key with `%L`; reject anything that doesn't match the exact regex (no recursive expressions, no multi-operator chains)
- `payload.target_table` still validated as before (whitelist-style)
- Read `payload.return_col` (optional, default to legacy convention `<short>_id`) — but ONLY if it's a plain column name; reject expression form for return_col
- 49/49 mappings have `(target_table, match_on)` only; `return_col` is rare/absent

Out-of-scope: changing what tables are valid `target_table` (keep current pattern).

### Problem 5 — Type-coerce auto-wrap for DIRECT_COPY/TRIM into non-text targets

**Required transformation**: in `upsert-sql.ts` colEntries construction (lines ~118-157), AFTER `compileTransform` returns a fragment for a mechanical mapping, inspect `targetMeta.columnTypes.get(targetColumn)`. If the type is in `{int2, int4, int8, numeric, bool, date, timestamptz, timestamp, uuid}` AND the transform was `DIRECT_COPY` or `TRIM` (NOT already `CAST_*`), wrap the fragment in `CAST(<frag> AS <pg_type>)`. The mapping `{pg_type}` per columnType:
- `int2`/`int4`/`int8` → `INTEGER` or `BIGINT` or `SMALLINT` (use exact match)
- `numeric` → `NUMERIC`
- `bool` → `BOOLEAN`
- `date` → `DATE`
- `timestamptz` → `TIMESTAMPTZ`
- `timestamp` → `TIMESTAMP`
- `uuid` → `UUID` (but only if not already filtered by skip filter)

Failing CAST values (e.g., non-numeric string → INT): PG raises → INSERT statement raises → caught by `upsert-sql.ts:344-358` try/catch → mapping logged as `insert_failed:` skip reason. This is acceptable per audit pattern.

### Problem 6 — Full-scale 47k Wave 1 verification

**Required transformation**: at EXEC step 7, run a no-cap full-scale wave execution against the live DB. Expected:
- `sys.sys_skills` ≥ 5000 (target per Goal 001a A8)
- Wall-clock ≤ 10 min (target per Goal 001a A8) — if real wall-clock > 10min, executor halts and escalates **before committing to a revised acceptance** (no silent variance)
- `brownfield.import_runs.import_run_status = COMPLETE` for the run
- `audit.import_run_logs` populated with full state-transition sequence (RUN_CREATED → STATE_STAGING → STATE_VALIDATING → STATE_APPROVING → STATE_UPSERTING → STATE_COMPLETE)
- `audit.import_validation_results` count of `SKIPPED_UNSUPPORTED_TRANSFORM_V1` = 0 (all 14 codes now supported)
- `audit.import_validation_results` count of `HANDLED_VIA_LINEAGE_WRITE_V1` ≥ 93 (LINEAGE_SOURCE_NK mappings audited)
- `audit.import_validation_results` count of `no_conflict_inference_available` = 0 (migration 000031 + UQ existing UQ on other tables resolves all)
- `sys.sys_source_lineage_records` post-run: count ≥ 47000 with `source_lineage_import_run_id` non-null for ALL new rows (681 pre-existing NULL rows preserved as pre-history)
- `pg_stat_statements` count of `INSERT INTO sys.<target>%` per Wave 1 mapping = exactly 1 per (mapping × run) — this is the criterion 11 verification, now using direct telemetry not EXPLAIN fallback

**Audit persistence**: the full-scale run MUST NOT be wrapped in `afterAll` test cleanup. The audit trail must persist as durable evidence on the live DB. Use a dedicated `pnpm` script or `tsx` invocation, NOT a vitest fixture.

---

## §3 — Out of scope for Goal 002

The PLAN must explicitly mark these as out-of-scope to prevent scope creep:

- Wave 2 / 3 / 4 mapping discovery (deferred to future Goal 003+)
- Legacy `evo_heuresys` DB restore (deferred unless 002 EXEC reveals data-integrity questions needing legacy comparison)
- `npm publish`, MFA enroll UI, graph renderers (MVP-3 deferred items per HANDOFF rows B, E-UI, F — gated by brand identity)
- ANY changes to migrations 000001-000031 (schema is frozen post-000031 application)
- ANY changes to `sys.*` schema definitions or constraints (000031 is the last DDL for this goal)
- ANY changes to `legacy_mirror.*` (treated as immutable canonical source proxy)
- ANY rewrites to the lineage write path in `upsert-sql.ts:391-446` or `repository.ts::writeLineage`. Lineage works as-is per Goal 001a v5 v3-bis evidence E1.

---

## §4 — Constraints (boundaries of any acceptable PLAN)

### 4.1 — Code change boundaries

The PLAN may propose changes to:
- `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts` (extend SUPPORTED_TRANSFORMS + 3 new cases)
- `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts` (extend colEntries construction for jsonb aggregation + type-coerce wrap)
- `apps/api/src/modules/brownfield-wave-executor/engine.ts` (only if upsert-sql.ts API signature changes; minimize)
- `apps/api/test/transform-compiler.test.ts` (add adversarial fixtures for JSON_EXTRACT injection + LOOKUP_FK match_on injection + LINEAGE_SOURCE_NK)
- `apps/api/test/wave1-debug-scale-v4.test.ts` (extend assertion list or add new sub-tests)
- `apps/api/test/wave1-idempotency.test.ts` (re-run idempotency post-extension)
- ONE new file allowed: a full-scale runner if extracting from current pnpm script needs it (e.g. `scripts/run-wave1-fullscale.mjs` for the durable run + audit verification harness)

The PLAN must NOT propose changes to:
- `apps/api/src/modules/brownfield-wave-executor/transforms.ts` (JS-side, dead-code-wrapped, frozen)
- `apps/api/src/modules/brownfield-wave-executor/repository.ts::writeLineage` (works as-is)
- `apps/api/src/modules/brownfield-wave-executor/run-logger.ts` (audit primitive frozen)
- `prisma/schema.prisma` (introspection only)
- Any file under `apps/web/` (UI out of scope)
- Any file under `apps/api/src/modules/` other than `brownfield-wave-executor/`
- Any migration in `db/migrations/` (schema frozen)

### 4.2 — DB write boundaries

The PLAN must specify which DB objects will be written:
- `audit.import_run_logs` (INSERT only)
- `audit.import_validation_results` (INSERT, new classification `HANDLED_VIA_LINEAGE_WRITE_V1` added to message vocabulary)
- `audit.import_approval_decisions` (INSERT)
- `brownfield.import_runs` (INSERT + UPDATE for state machine)
- `staging.wave1_*` (DDL/DML, engine-managed, unchanged semantics)
- `sys.sys_source_lineage_records` (INSERT with FK populated)
- `sys.*` target tables (INSERT/UPDATE via SQL-side UPSERT, semantically identical to 001a path)
- `pg_stat_statements_reset()` calls per-test (read-only for the stats subsystem, NOT a DDL)

NOT allowed:
- ANY write to `legacy_mirror.*` (immutable)
- ANY write to `brownfield.{column_mappings, source_columns, source_tables, table_mappings, source_exports}` (registry, frozen)
- ANY write to `sys.sys_schema_migrations` (controlled by `db/scripts/migrate.{sh,ps1}`)
- ANY DDL outside of CREATE-IF-NOT-EXISTS patterns that were already present in 000031

### 4.3 — Test boundaries

The PLAN must specify acceptance test strategy including:
- `pnpm test` continues to pass with `276 passed + 5 skipped` baseline (001a v5 final). If your refactor changes count, justify.
- The 219th gated test (`it.skipIf(!REAL_EXECUTE)`) must remain skipped under default env.
- Debug-scale (20-cap) wave1 test continues green with EXTENDED assertions:
  - JSON_EXTRACT mappings now produce non-null jsonb in target `*_metadata`
  - LINEAGE_SOURCE_NK mappings produce `HANDLED_VIA_LINEAGE_WRITE_V1` audit row
  - LOOKUP_FK with `match_on=legacy_tenant_id` produces non-null UUID
  - 0 `SKIPPED_UNSUPPORTED_TRANSFORM_V1` audit rows
- Adversarial test: JSON_EXTRACT injection fixtures (path with quote/keyword/multi-statement/bracket-notation) + LOOKUP_FK match_on injection fixtures
- Idempotency test re-runs (2x run, count_delta = 0)
- **Full-scale 47k test**: dedicated harness (not vitest fixture, audit must persist)

### 4.4 — Operational boundaries

- Backup gate: PRE-SATISFIED by Cowork (dump at 22:33 UTC). Re-verify mtime ≤ 6h at EXEC step 0.
- Git discipline: atomic commits per logical step (compile-JSON_EXTRACT as one commit, compile-LINEAGE_SOURCE_NK as one commit, compile-LOOKUP_FK fix as one commit, jsonb-aggregation as one commit, type-coerce as one commit, tests-extended as one commit, full-scale-runner as one commit, REPORT as one commit). Each references Goal 002. NO squashing.
- Turn budget: hard cap **40 turns** (decision B3). Escalation at turn **38** if §2.6 verification not entering final phase.
- pg_stat_statements `_reset()` MAY be called between tests for clean per-test statistics.

---

## §5 — Required structure of `_02_PLAN_002_*.md`

Your PLAN must contain these sections, in this order, applying G11 cross-check:

### §-1 — Standing lessons (inherited from PLAN v5 §-1)
1. DB-only forensic insufficient; code reading mandatory for any "engine does/doesn't X" claim
2. Every functional step must map to ≥ 1 acceptance criterion AND vice versa (G11)
3. Hybrid > full rewrite when constraints tight; surface deferrals transparently (E2 pattern)
4. Test/code co-commit batching saves turn budget
5. Vitest path convention: `test/**/*.test.ts` (NOT `__tests__/`)
6. Env-gated tests are the right pattern for >2min integration runs

### §0 — Executive summary (max 10 lines)
Plain English. What you intend to do. No code.

### §1 — Vocab + payload reference (inherits from DISCOVERY 002)
Tables from DISCOVERY 002 §3/§4/§5 restated for in-context reference. Cite DISCOVERY by section, don't copy massive blocks.

### §2.1 — Baseline capture plan
EXEC step 0 measurements:
- `pnpm test` baseline (expect 276 + 5 skipped)
- `wave1-debug-scale-v4` gated test baseline (cap=20)
- `wave1-idempotency` gated test baseline
- DB state: counts on sys.sys_skills, sys.sys_source_lineage_records, audit.*, brownfield.import_runs
- Source file SHAs for the 3 files you'll modify (rollback anchor)
- pg_stat_statements_reset() at start of each baseline
- For full-scale run: capture pre-state DB counts (will be compared post-run)

### §2.2 — Code change plan
Per file: full path, current state (1-2 lines), intended change (3-5 lines), risk class (low/medium/high), test coverage (which test exercises it; if none, propose new).

Order by dependency:
1. transform-compiler.ts add JSON_EXTRACT case
2. transform-compiler.ts add LINEAGE_SOURCE_NK case
3. transform-compiler.ts modify LOOKUP_FK case (read match_on)
4. upsert-sql.ts modify colEntries construction (jsonb aggregation per target_column)
5. upsert-sql.ts add type-coerce auto-wrap
6. engine.ts adjust if signature changed
7. Tests: extend transform-compiler.test.ts, wave1-debug-scale-v4.test.ts, wave1-idempotency.test.ts
8. New: scripts/run-wave1-fullscale.mjs (durable harness, no afterAll cleanup)

### §2.3 — DB write plan
Per object: schema.table, write type, trigger, expected count per debug-scale + full-scale, reversibility. Allowlist enforcement.

### §2.4 — Injection safety design (CRITICAL — LOOKUP_FK + JSON_EXTRACT)
Standalone section:
- LOOKUP_FK match_on whitelist regex + accepted forms + rejected forms
- JSON_EXTRACT path segment escaping strategy
- Adversarial fixtures list (one per attack vector)
- Compile-time vs run-time validation split

### §2.5 — JSON_EXTRACT aggregation design (CRITICAL — Option β)
Standalone section:
- Aggregation algorithm: group mappings by (target_table × target_column) for jsonb columns with JSON_EXTRACT mappings
- Key naming derivation: `path.split('.').pop()` after stripping `$.legacy.` (deterministic)
- `jsonb_build_object` emission: SELECT-list entry = `jsonb_build_object('k1', frag1, ..., 'kN', fragN)`
- Edge cases:
  - mapping group of 1 mapping → still wraps in jsonb_build_object (consistency)
  - mapping group has a non-JSON_EXTRACT mapping for the same target_column → error (mixed-transform target ambiguous), audit + skip
  - 4 mappings without `direction` key: per §2 Problem 2, query at EXEC step 1
  - existing target metadata value (UPDATE path on conflict): should the new build-object REPLACE the entire jsonb or MERGE with prior? Decision: REPLACE (ON CONFLICT DO UPDATE SET metadata=EXCLUDED.metadata); legacy semantics not preserved on update by design since the source-of-truth is the new run.

### §2.6 — Acceptance criteria (G11 — every §2.2 step maps here AND vice versa)
Bulleted, machine-checkable list. Each criterion verifiable from EXEC output.

Minimum criteria (you may add more, but each must trace to ≥ 1 §2.2 step):
1. `pnpm test` exit 0, ≥ 276 passing, same 5 skipped
2. transform-compiler.test.ts: new JSON_EXTRACT tests including ≥ 4 adversarial path fixtures, all green
3. transform-compiler.test.ts: new LINEAGE_SOURCE_NK tests, fragment=null verified
4. transform-compiler.test.ts: LOOKUP_FK match_on read tests including ≥ 2 adversarial match_on fixtures
5. wave1-debug-scale-v4 (20-cap, gated): JSON_EXTRACT produces non-null jsonb in target metadata
6. wave1-debug-scale-v4 (20-cap, gated): LINEAGE_SOURCE_NK audit row count > 0 with message=HANDLED_VIA_LINEAGE_WRITE_V1
7. wave1-debug-scale-v4 (20-cap, gated): SKIPPED_UNSUPPORTED_TRANSFORM_V1 audit row count = 0
8. wave1-debug-scale-v4 (20-cap, gated): pg_stat_statements shows exactly 1 INSERT INTO sys.<target> per (mapping × run) for all mappings (criterion 11 from 001a v5, now via direct telemetry)
9. wave1-idempotency (gated): re-run, count_delta = 0 on all 11 sys.* tables monitored
10. Full-scale 47k run via dedicated runner: durable, sys.sys_skills ≥ 5000, wall-clock ≤ 10 min, brownfield.import_runs.import_run_status='COMPLETE', audit trail persists (NOT cleaned up)
11. Full-scale 47k run: sys.sys_source_lineage_records new rows ≥ 47000 with non-null source_lineage_import_run_id; pre-existing 681 NULL rows unchanged
12. ≥ 8 atomic commits attributable to Goal 002

### §2.7 — Turn budget breakdown (40 cap, escalation at 38)
Allocate across steps with honest estimate. If your honest estimate exceeds 40, declare in this section and propose either (a) reduce scope, (b) ask for higher cap, (c) split into 002a + 002b.

### §2.8 — Risk register
Top 5 risks. Probability × impact × mitigation. Suggestions:
- jsonb_build_object output exceeds target column size limit → mitigation
- match_on regex too restrictive, blocks legitimate payloads → mitigation
- Full-scale run wall-clock > 10 min → mitigation (escalation, not silent acceptance)
- pg_stat_statements stats pollution across tests → mitigation (`_reset()` per test)
- LOOKUP_FK match_on parsing edge case → mitigation

### §2.9 — Rollback plan
Per commit: exact `git revert <sha>` command. For DB: confirm `pg_restore -d heuresys_advanced /home/ubuntu/backups/heuresys_advanced_pre_goal002_20260518_2233.dump` works. Migration 000031 is reversible via `DROP INDEX IF EXISTS sys.sys_user_certifications_natural_key_uq;` but Goal 002 doesn't roll it back (compiler depends on it).

### §2.10 — Architectural advisory (non-binding observations)
Optional section for design hints + open questions surfaced during PLAN drafting. Will be discussed in chat before EXEC if non-trivial.

---

## §6 — After you write `_02_PLAN_002_*.md`

1. Save the PLAN at `cowork_code_exchange/_02_PLAN_002_json-extract-lineage-fullscale.md`.
2. Compute sha256 of the PLAN file.
3. Update `_00_STATE_002.md`: `current_phase: PLAN`, `plan_version: v1`, `plan_sha256: <computed>`, `next_actor: Cowork`.
4. Confirm completion in chat with a 5-10 line summary including:
   - Estimated turn budget (must fit in 40 with buffer ≥ 5)
   - Top 3 design risks
   - Any open questions not resolvable from DISCOVERY 002 + this PROMPT
   - The G11 self-check result: "every §2.2 step has matching §2.6 criterion, every §2.6 criterion has matching §2.2 step — verified at v1 draft"
5. **Stop.** Wait for Cowork to write `_02b_APPROVAL_002.md` with your PLAN sha256, OR for Cowork to request revisions in chat.

---

## §7 — Hard guard-rails for this PROMPT turn (PLAN-only, no execution)

1. **NO code changes.** Not even "small ones". Not even "just adding a comment to clarify". The PLAN is markdown only.
2. **NO DB writes.** Migration 000031 already applied by Cowork. EXEC step 0 will re-verify state, not modify.
3. **NO test execution.** Tests run during EXEC after PLAN approval.
4. **NO git operations** except reading log/status/diff if useful for §2.9 rollback design.
5. **NO new SSH tunnels.** Cowork's `/tmp/ssh-config-posix` is for Cowork; CLI has its own SSH config via Enzo's home.
6. **Secret hygiene**: no credentials in PLAN even sanitized — refer to env var names only.
7. The PLAN is a **read-only-on-environment artefact**. Producing it must not change anything outside the PLAN file + STATE update.

---

*End of _01_PROMPT_002_json-extract-lineage-fullscale.md*
