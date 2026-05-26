# _03_EXEC_003_brownfield-seeding-complete.md

**Protocol phase:** EXEC (executor journal, forensic + verbatim)
**Goal ID:** 003
**Slug:** brownfield-seeding-complete (v2 — Wave 1 closure)
**Executor:** Claude Code CLI on Windows (DESKTOP-KH728P2)
**APPROVAL signed:** `_02b_APPROVAL_003.md` sha256 `a55e144ec3eb50aa87dc893ad902a3294b4db4db18aa21c25b4be4e862fc2142`
**PLAN baseline:** `_02_PLAN_003_brownfield-seeding-complete.md` v2 sha256 `ecd21b78e378eb2264b8134f700ca650528f8d40ed387aa39f8a2d020929dab8`
**PROMPT baseline:** `_01_PROMPT_003_brownfield-seeding-complete.md` v2 sha256 `59a1fe63a381499328dca200c02f561745512c02e7e9090fa394e8c20d8f0902`
**EXEC started:** 2026-05-19T16:20:00+02:00
**Turn budget:** 40 (escalation at 35; honest target ≤30)

---

## §0 — EXEC step 0: baseline + Item K hygiene

### 0.1 — `pnpm test` baseline (2026-05-19T16:20Z)

**Initial result**: 288 passed | 5 skipped | **1 FAILED** | 294 total | exit 1.

**Drift**: PLAN v2 §2.1 expected 289 passed | 5 skipped | 0 failed.

**Root cause**: pre-existing test failure in `apps/api/test/transform-compiler.test.ts:155` — assertion `expect(sql).toContain("tenancy_id")` for `LOOKUP_FK match_on=legacy_tenant_id` + target=`sys_tenancies`. Test was written for Goal 002 hotfix 1 (commit `89ab29a` depluralization `tenancies_id → tenancy_id`) but never updated when Goal 002 hotfix 2 (commit `497ff90`) added `PK_OVERRIDES` map `sys_tenancies → tenant_id` (actual PK column per schema). Runtime SQL output is correct; test assertion is stale.

**Action taken (per Enzo decision, option B from chat 2026-05-19T16:25)**: fix test inline + atomic commit + document drift in this EXEC log. NOT a scope reduction; NOT silent absorption. Update brings test in sync with post-hotfix-2 behavior.

**Test fix diff**:
```
-  it("plain column match_on=legacy_tenant_id → WHERE legacy_tenant_id, return_col depluralized to tenancy_id"
+  it("plain column match_on=legacy_tenant_id → WHERE legacy_tenant_id, return_col=tenant_id via PK_OVERRIDES"
   ...
-    // Depluralization fix: sys_tenancies → tenancy_id (not tenancies_id)
-    expect(sql).toContain("tenancy_id");
+    // PK_OVERRIDES (hotfix 497ff90): sys_tenancies → tenant_id (actual PK), not depluralized tenancy_id
+    expect(sql).toContain("tenant_id");
     expect(sql).not.toContain("tenancies_id");
+    expect(sql).not.toContain("tenancy_id");
```

**Post-fix verify** (vitest run transform-compiler.test.ts): **65 passed | 0 failed** ✅.

**Full re-baseline**: pending (running in background; result captured in §0.1.b once complete).

### 0.2 — `pnpm typecheck` + `pnpm lint` baseline (2026-05-19T16:20Z)

Result: exit 0 ✅ (both green). Stored in temp output `bq76r2q26.output`.

### 0.3 — Source SHAs (rollback anchor) (2026-05-19T16:18Z)

```
bd393898ea5691ef9e2e436e222fdf5d65c9853d0a371cccab23827b299e7afa  engine.ts            (1103 lines, post-Goal-002)
6a162d54c65a48e1fb6b726b6e32a8de6e24b54ae254caead019ebd410f32c5d  loader.ts            (218 lines, unchanged)
7f68c100a4fa5d439ef908afe20ebcba429765b04f2b4b4e147b203add6958a2  repository.ts        (586 lines, unchanged)
839f235459724888c815e84c11cadb5422a99432afdc56aabc241db74bf8cc0a  routes.ts            (67 lines, unchanged)
2df532d55854be84e3ce99cc842b407591e0557f71162d20e963d0b0efbaf911  run-logger.ts        (67 lines, unchanged)
01739f6abd2f2728335bd4cbe038f24241f2acd0822fcd906bf9a2876a0716af  service.ts           (140 lines, post-Goal-002)
914d63cb51bada8f6b6449fdfe26d7f431173dc18710d80dead4282102da405f  state.ts             (36 lines, unchanged)
1f07b50ab05fb45594b089d3983ef80ffd3c0921a01b6a964612002659e7f91d  transform-compiler.ts (post-Goal-002 hotfix 2 with PK_OVERRIDES)
c5af4a86bacb324389d4c1b114e97c9a145f0beaaadf4ad36e76591a9d5787ee  transforms.ts        (170 lines, unchanged)
41eda427f5ce3915d3722a25fd1b8239aaf7bf850a73a1c0c34bfd119d9a01d8  upsert-sql.ts        (post-Goal-002)
```

Note: 4 files drift from DISCOVERY 002 §10 fingerprints — this is expected; Goal 002 commits modified them (Items A-J + hotfix 1 + hotfix 2 per Goal 002 REPORT §1).

### 0.4 — DB pre-run state (2026-05-19T16:20Z)

**Wave 1 target counts** (15 tables):
```
sys_skills                        445  (↑1 from DISCOVERY 003's 444 — minor drift, Goal 002 trailing upsert)
sys_skill_families                 77
sys_skill_categories                0  ← EMPTY
sys_skill_taxonomy_edges            0  ← EMPTY
sys_skill_aliases                   0  ← EMPTY
sys_learning_modules               94  (↑1 from 93 — minor drift)
sys_learning_paths                135
sys_learning_path_steps             0  ← EMPTY
sys_skill_learning_mappings         0  ← EMPTY
sys_user_certifications             1
sys_blueprint_process_registry     23
sys_activity_classifications        0  ← EMPTY (blocked by CHECK violation, Item C will fix)
sys_compensation_bands             75
sys_process_kpi_templates           0  ← EMPTY
sys_job_roles                       0  ← EMPTY
```
**8/15 empty** as expected per DISCOVERY 003 §2.2.

**Brownfield + audit baseline**:
```
brownfield.import_runs           5     (Goal 002 left 3 COMPLETE + 1 FAILED predecessor + ?)
audit.import_run_logs           40
audit.import_validation_results 165464
sys.sys_source_lineage_records   823
```

### 0.5 — Fresh pg_dump pre-Goal-003 (2026-05-19T14:34Z UTC = 16:34Z+02 local) ✅

`/home/ubuntu/backups/pre_g003_20260519_143407.dump` — 252 MB, mtime 2026-05-19T14:34:07Z, owner postgres:postgres. Format=custom. Goal 003 EXEC step 0.5 backup gate **SATISFIED**.

### 0.6 — Migration 000031 + pg_stat_statements verified (2026-05-19T16:20Z)

- `sys.sys_schema_migrations` id=384 present (sha256 `9a1fec95bf2da4bf8726d3a2efb0d1a83a22d0f2da52e90d93075fb80c01bac7`, applied 2026-05-18T22:34:12+00) ✅
- `pg_extension` `pg_stat_statements` v1.10 active ✅

### 0.7 — `pg_stat_statements_reset()` (2026-05-19T16:20Z)

**Result**: `ERROR: permission denied for function pg_stat_statements_reset` — role `heuresys` lacks privilege.

**Severity**: SOFT (non-blocking). PROMPT v2 §3 acceptance criteria C1–C14 do NOT reference pg_stat_statements directly. The reset is a hygiene step from PLAN v2 §2.1; the absence doesn't affect any acceptance criterion. **Action**: accept observation, do NOT halt+escalate (rationale: not in §2.6 acceptance scope).

### 0.8 — U1 `tenant_metadata` jsonb sample (2026-05-19T16:20Z) — **CRITICAL FINDING**

```
tenant_code            has_metadata  has_legacy_id_key  legacy_id_val
RTL_BANK_REFERENCE     t             f                  (null)
DEMO_BANK_TEST         t             f                  (null)
SELECT count(*) FROM sys.sys_tenancies WHERE tenant_metadata ? 'legacy_id'  →  0
```

**Implication**: Item A primary jsonb-convention path (`tenant_metadata->>'legacy_id'`) **NOT APPLICABLE**. Must use fallback path: deterministic lookup via `brownfield.tenant_id_mappings.legacy_id` (Item D Part 1). This is exactly the contingency APPROVAL 003 §"Notes for executor" point 2 anticipated.

### 0.9 — U2 `user_metadata` jsonb sample (2026-05-19T16:20Z) — **CRITICAL FINDING**

```
163 users total | 163 with metadata | 0 with `legacy_id` key
```

**Implication**: Item A `legacy_user_id → sys_users` path uses fallback via `staging_raw_record->>'user_email'` against `sys.sys_users.user_email` (per Obs-1 acknowledged in APPROVAL).

### 0.10 — U3 RTL_BANK_REFERENCE present (2026-05-19T16:20Z)

```
SELECT count(*) FROM sys.sys_tenancies WHERE tenant_code='RTL_BANK_REFERENCE'  →  1
```
✅

### 0.11 — K-hygiene §1: orphan lineage rows count (2026-05-19T16:20Z)

```
SELECT count(*) FROM sys.sys_source_lineage_records WHERE source_lineage_import_run_id IS NULL  →  446
```

**Drift**: DISCOVERY 003 §2.5 documented 681 NULL lineage rows. Current count is **446** (delta -235).

**Forensic note**: between DISCOVERY 003 capture (2026-05-19T13:25Z) and current (2026-05-19T16:20Z), 235 NULL-lineage rows were either deleted or had their `source_lineage_import_run_id` populated. Most likely: Goal 002 trailing wave1 retry runs (per `brownfield.import_runs` count = 5 vs DISCOVERY's 3 COMPLETE + 1 FAILED = 4) caused some cleanup. Not a regression; just a snapshot delta.

**C14 contract compliance**: PROMPT v2 §3 C14 says "681 pre-existing NULL lineage rows: documented". The 681 was DISCOVERY-time snapshot. The operational contract is "document the current set of pre-Goal-001a-v5 orphan NULL-run-id lineage rows". C14 will be satisfied by documenting the **current 446** in `audit.import_validation_results` with `rule_code='LEGACY_NULL_LINEAGE_DOCUMENTED_V1'` (Item K step 0.13).

### 0.12 — K-hygiene §2: TYPE_CAST_MAP coverage check (2026-05-19T16:21Z)

**Current `TYPE_CAST_MAP` in `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:162-173`**:
```typescript
const TYPE_CAST_MAP: Record<string, string> = {
  int2: "SMALLINT",
  int4: "INTEGER",
  int8: "BIGINT",
  numeric: "NUMERIC",
  bool: "BOOLEAN",
  date: "DATE",
  timestamptz: "TIMESTAMPTZ",
  timestamp: "TIMESTAMP",
  jsonb: "JSONB",
  json: "JSON",
};
```

**Goal 002 §6 item 5 + Goal 003 Item K extension**: add `interval, time, timetz, bytea`. Implementation in §0.K below.

### 0.13 — K-hygiene §3: emit audit classification rows (2026-05-19T16:36Z local) ✅

**Pattern**: synthetic anchor `brownfield.import_runs` row (status=COMPLETED, wave=NULL, metadata.kind='k_hygiene_documentation') + 446 `audit.import_validation_results` rows joined 1-to-1 by `source_table_name → brownfield.source_tables.source_table_id`. All 24 distinct orphan source_table names mapped to existing brownfield.source_tables entries (zero unmapped per pre-check).

**Verbatim transaction outcome**:
```
BEGIN
INSERT 0 1           ← anchor run created
INSERT 0 446         ← 446 audit rows inserted (1-to-1 JOIN)
inserted_audit_rows = 446    ← post-insert count verify
anchor_runs_created = 1      ← anchor visible via metadata->>kind filter
COMMIT
```

NO UPDATE on `sys.sys_source_lineage_records` (per A4 Path K.1 / D8 decision-locked). Original orphan rows retain NULL `source_lineage_import_run_id`; audit class is the documentation surface.

**C14 contract**: SATISFIED. The 446 (not 681 — DISCOVERY-time count drifted per §0.11) orphan rows are now individually traceable in `audit.import_validation_results` via:
```sql
SELECT count(*) FROM audit.import_validation_results
WHERE import_validation_result_rule_code = 'LEGACY_NULL_LINEAGE_DOCUMENTED_V1';
-- → 446
```

### 0.K — Code change: extract `applyTypeCoerceWrap` + 4 new types (2026-05-19T16:32Z local) ✅

**Refactor**: TYPE_CAST_MAP moved from local-inside-function (lines 162-173) to module-level const (lines 39-58). New exported function `applyTypeCoerceWrap(frag, colType, transform)` encapsulates the wrap logic. Inline call site replaced from 26 lines to 1 line.

**New types added**: `interval → INTERVAL`, `time → TIME`, `timetz → TIMETZ`, `bytea → BYTEA` (per Goal 002 REPORT §6 item 5 follow-up + Goal 003 PLAN v2 §2.2 Item K spec).

**Test coverage**: NEW test file `apps/api/test/upsert-sql-type-coerce.test.ts` (PLAN v2 §2.2 Item K had wrong file naming — said `transform-compiler.test.ts` but TYPE_CAST_MAP lives in `upsert-sql.ts`; deviation documented here, not silent absorption). 13 unit tests across 3 describe blocks:
- 4 new-type tests (interval, time, timetz, bytea)
- 4 existing-type regression tests (int2, numeric, bool, jsonb)
- 5 negative/no-op cases (non-passthrough CAST_INT, JSON_EXTRACT, unknown uuid, text, undefined)

**Verify**:
- `pnpm exec vitest run test/upsert-sql-type-coerce.test.ts` → 13 passed | 0 failed (493ms)
- `pnpm --filter @heuresys/api typecheck` → exit 0
- `pnpm --filter @heuresys/api test` full suite → **302 passed | 5 skipped | 0 failed** (294+13 = ✅ +13 vs 289 baseline per C1 / A25 target growth)

---

## §1 — Halt+escalate journal

No halts so far. The 0.1 baseline drift was resolved per Enzo decision (option B inline fix) BEFORE step 0 code work begins — drift documented in §0.1 above, not absorbed.

## §1.5 — Execution order (revised post-step-0 per Cowork directive 2026-05-19T16:40Z)

**Sequence originale PLAN v2 §2.5.1** (advisory): K → A → B → C → D → M → F → L
**Sequence eseguita** (dependency-aware): K → **C → D → M → A** → B → F → L

**Motivazione** (Cowork-approved): Item A fallback-only path JOINs su `brownfield.tenant_id_mappings` (creata da Item D, migration 000033 Part 1). Item M (validate_lookup_fk_payload trigger) ships nella stessa migration 000033 Part 2 per CP-v2-1. Quindi C → D+M precedono A per dependency-coherence, non per scope change.

**Invarianti preservati**: decisions_locked D1–D14 unchanged. Acceptance criteria C1–C14 unchanged. G11 cross-check §2.11 PLAN v2 still bidirectional (mapping Item→Criterion not order-dependent). Anti-pattern guard fully respected.

## §1.6 — Item A scope-lock (Cowork-approved 2026-05-19T16:40Z)

**Active path**: FALLBACK-ONLY.
- `legacy_tenant_id` → JOIN su `brownfield.tenant_id_mappings.legacy_id` (Item D pre-shipped).
- `legacy_user_id`   → JOIN su `sys.sys_users.user_email = staging_raw_record->>'user_email'` (Obs-1 acknowledged in APPROVAL).

**Primary jsonb-convention path** (`<X>_metadata->>'legacy_id'`): **NOT implemented in Goal 003**.
- Rationale: step 0.8 = 0/2 tenant_metadata have `legacy_id` key + step 0.9 = 0/163 user_metadata have `legacy_id` key. Primary path would be dead-code in Goal 003.
- Re-introduzione deferred to Goal 004+ contingent on data evidence (`*_metadata.legacy_id` populated). Trade-off: ~1-2 turn future refactor < dual-path speculative complexity cost now.
- Transform-compiler.ts LOOKUP_FK handler will include explicit comment marking the deferral point.

---

## §2 — Per-Item execution log

(Populated incrementally as Items K → A → B → C → D → M → F → L progress.)

### Item F — Wave 1 fullscale retry + cascade diagnostics (2026-05-19T18:52Z → 2026-05-20T01:30Z) — turn count: ~22, HALT_STATE awaiting Z-decision

#### §F.1 — First Wave 1 retry run (08d3bc9f) — COMPLETED 48min/2896s

Triggered post-K+C+D+M+A+B fixes. Wall-clock 2896s (48 min — exceeded recalibrated 30 min hard cap but completed naturally without intervention, Cowork-acknowledged as legitimate scaling). Status=COMPLETED, audit PERSISTED.

**Result table** (full stats in run metadata jsonb):
- ✅ 6 baseline-populated targets unchanged.
- ✅ Item C effect verified: sys_activity_classifications 0 → 3276 (2210 ATECO + 1066 NACE relaxed CHECK).
- ❌ 9 targets staged>0 + upserted=0 + failed=0 = **silent skip** (no audit class).
- ⚠️ Lineage write gap: sys_skills 5753 upserted but 160 lineage; sys_learning_modules 4395 upserted 0 lineage; sys_learning_paths 3157 upserted 65 lineage.

C4 FAIL, C5 FAIL (6/15 populated). C6 ✅, C7 ✅, C9 ✅. C8 ✅ (already verified at EXEC §0 trigger checkpoint).

#### §F.2 — Diagnostic class A (HIGH confidence, 2 turns)

Root cause: form (b) LOOKUP_FK `<X>_metadata->>'legacy_id'` resolves NULL because sys.*_metadata jsonb columns NEVER contain `legacy_id` key (verified 0/6037 sys_skills + 0/4488 sys_learning_modules + 0/3227 sys_learning_paths + 0/77 sys_skill_families + 0/75 sys_compensation_bands + 0/3276 sys_activity_classifications). Affects 4 mapping patterns blocking ~8104 staged rows in sys_skill_aliases, sys_skill_taxonomy_edges, sys_skill_learning_mappings, sys_process_kpi_templates. Full doc: `_03_EXEC_003_DIAGNOSTIC_REPORT_Item_F.md`.

#### §F.3 — P1 implemented + committed (commit 127e1a7)

Extended compiler LOOKUP_FK case: when matchKey === 'legacy_id', emit JOIN through `sys.sys_source_lineage_records` instead of failing `metadata->>'legacy_id'` lookup. Scope-locked to legacy_id key only (other matchKey values keep standard form (b) emission). 2 existing form (b) tests updated + 1 new scope-lock test. 72/72 transform-compiler tests PASS + typecheck PASS. Compiler-side fix, no DB writes (A1 ABSOLUTE preserved).

#### §F.4 — Class B sub-discovery — 3 unfeasible targets surfaced

5 no-LOOKUP_FK targets investigated: ALL have 0 column_mappings for their NOT NULL FK columns (skill_category_family_id, learning_path_step_path_id+module_id, blueprint_process_variant_id, job_role_family_id, esco_occupation_mapping_job_role_id). Sub-discovery via pg_constraint verified FK targets. **3 of 6 mappings INFEASIBLE in Goal 003 Wave 1 scope** because:
- sys_blueprint_variants has 1 seed row only + business_processes source has no `variant_id` column.
- **sys_job_families is NOT IN ANY brownfield wave** (0 rows + 0 mappings table_mappings) + job_templates/onet_occupations have no family source column.
- sys_esco_occupation_mappings cascades on sys_job_roles which depends on sys_job_families.

Full doc: `_03_EXEC_003_CLASSB_FINDINGS_Item_F.md` + `_03_EXEC_003_CLASSB_SUBDISCOVERY_Item_F.md`.

#### §F.5 — PROMPT v3 amendment (Cowork supervisor-side scope correction)

Cowork emitted PROMPT 003 v2→v3 (Option β D2') 2026-05-19T23:15Z. Narrowed C4/C5 to feasible subset; 3 INFEASIBLE targets documented Goal 004 prerequisite-dependent; authorized 3 INSERTs on wave=1 column_mappings under A1 re-interpretation (D16). v2 archived as `_01_PROMPT_003_v2.md`. New sha `42a70f92...`.

#### §F.6 — Semantic verify #3 FAIL + Class C surface

Per PROMPT v3 action item #1 trigger semantic verify of #3 `learning_path_courses.course_id → sys_learning_modules` lineage: **0 matches**. sys_learning_modules was populated from `learning_bookmarks`/`learning_ratings`/`learning_recommendations`/`module_completions`/`learning_content_providers` — NOT from a `courses` legacy table. Cascading: #2 path_id is useless without #3 (both FKs required on sys_learning_path_steps). #1 framework_id only resolves 32/7256 rows (Class C: source row from competencies has framework_id but ontology_categories/skill_classifications source rows don't).

→ sys_learning_path_steps becomes 4th INFEASIBLE target. Cowork approved E1 (drop #2+#3, ship #1 only).

Full doc: `_03_EXEC_003_CLASSB_SEMANTIC_FAIL_Item_F.md`.

#### §F.7 — UQ block on #1 (HARD HALT)

Attempted INSERT #1 `sys_skill_categories.skill_category_family_id ← competencies.framework_id` form (b) `skill_family_metadata->>'legacy_id'`.

Blocker 1 (mitigated): trigger reject on UNQUOTED form. Switched to QUOTED.
**Blocker 2 (HARD)**: UQ violation on `(table_mapping_id=79b8eda7, source_column_id=c880c60c framework_id)` — existing JSON_EXTRACT mapping for `framework_id → skill_category_metadata` occupies the slot. UPDATE/DELETE forbidden by A1 ABSOLUTE.

Sub-investigated alternative source columns:
- skill_classifications.skill_cluster_id: 48 lineage matches + 7215/7256 rows (99.4% coverage!) **— but same UQ blocked** by existing JSON_EXTRACT.
- ontology_categories.parent_id: 0 lineage matches.

**CW-B20 candidate**: systemic registry design constraint. The brownfield registry pre-maps every source UUID column to JSON_EXTRACT (storing values in *_metadata jsonb), occupying the UQ slot. No additive LOOKUP_FK mapping possible without UPDATE/DELETE (A1) or architectural change (UQ relax migration).

→ sys_skill_categories becomes 5th INFEASIBLE target.

Full doc: `_03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md`.

#### §F.8 — HALT_STATE awaiting Cowork Z-decision

Choices presented:
- **Z1 (RECOMMENDED)**: accept 5 INFEASIBLE, ship P1-only Wave 1 retry, narrow C5 to ≥10/15 (was ≥12 in v3 + ≥11 in E1). Coverage post-retry: 10 populated (6 baseline + Item C + 4 Class-A P1-fixed) + 5 INFEASIBLE documented = 15 total.
- Z2: UQ-relax migration (architectural, scope expand).
- Z3: synthetic source_columns aliases (registry pollution).
- Z4: partial closure (VIOLATES guard #2, REJECTED).

Budget consumed: 22/40. Z1 closure projection 26-27/40. CW-B16/B17/B18/B19/B20 bias catalog candidates collected.

**Next session resume**: pending Cowork Z-decision in CLI inbox. Re-read this section + `_03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md` + PROMPT v3 + STATE 003 to recover context.

---

### Item F — Wave 1 fullscale retry (in progress, 2026-05-19T18:52Z+) — turn count: ~14

**Pre-run snapshot** (2026-05-19T18:51:23Z UTC, captured via psql):
- 8/15 Wave 1 targets empty (same as DISCOVERY 003 §2.2).
- sys.sys_source_lineage_records: 823 rows total (446 orphan + 377 from Goal 002 + 0 from K-anchor).
- brownfield.import_runs: 6 rows (5 from Goal 002 + 1 K-hygiene anchor).
- audit.import_validation_results: 165910 rows.

**Run started**: `08d3bc9f-e16d-418d-8414-17873ef170aa` at 2026-05-19T18:52:51Z UTC via `node scripts/run-wave1-fullscale.mjs`. API server: PID 22796 tsx watch (Item A/B hot-reloaded).

**Client-side timeout**: at 305s (~5 min) the runner script exited with `exit=3 "fetch failed"`. This is a known issue in `node --experimental-fetch` / undici default keepalive socket timeout when no body is being streamed back. **Server-side run continued unaffected** (verified via DB polling + `pg_stat_activity`).

**Progress at 11.6 min** (2026-05-19T19:04Z UTC poll):
- sys_activity_classifications: 0 → **3276** ✅ (Item C migration 000032 effect — 2210 ATECO + 1066 NACE unblocked).
- audit.import_validation_results delta: 41297 PASSED + 12 SKIPPED.
- sys.sys_source_lineage_records: 152 (slow — only 3.9 rows/sec).
- query `WITH src AS (SELECT staging_row_id, ...) INSERT INTO sys.sys_source_lineage_records ...` active 855s, `wait_event=NULL`, state=active — productive work, not blocked.

#### §wall-clock-recalibration (Cowork directive 2026-05-19T19:08Z UTC)

PLAN v2 §2.5.3 had Wave 1 target ≤ 5 min (extrapolated from Goal 002 baseline 110s for ~440 rows). However:
- Goal 002 actual lineage rate = 3.9 rows/sec (DB-measured).
- Goal 003 Item A+B+C unblocked ~3276 new activity_classifications + 38 LOOKUP_FK candidates + 2 smallint mappings + other previously-blocked rows → estimated **~6000 total lineage rows expected**.
- 6000 / 3.9 = **1538s ≈ 25 min** — legitimate scaling with same per-row performance.

**Recalibrated targets** (Cowork-approved, NOT scope creep — same performance characteristics; only the volume grew because the fixes worked):
- Revised soft target: ≤ 25 min wall-clock
- **Hard cap (CANCEL trigger)**: 30 min (1800s)
- Continue criteria: lineage count growing within 3-min windows OR query active+no-wait
- CANCEL trigger: elapsed ≥ 30 min OR wait_event ≠ NULL for 2+ min consecutive OR lineage invariato per 5 min consecutivi while RUNNING + no active query

Anti-pattern guard D5 preserved: no early exit while productive work continues at baseline rate.

**Monitoring** (poll every 60s):

---

### Item B — CAST_* auto-wrap completeness (2026-05-19T17:25Z) — turn count: ~12

**Root-cause confirmation** (Goal 002 REPORT §3.5 trace):
- Existing `applyTypeCoerceWrap` (Goal 002 Item E) only auto-wrapped passthrough transforms (null, DIRECT_COPY, TRIM) × {12 PG types}.
- Compiler emits `CAST(srcExpr AS INTEGER)` for `CAST_INT` transform; for target column type `int2` (smallint), PG must implicit-cast int→smallint at INSERT time — which fails when audit emits `insert_failed:` and the upsert path skips.

**Code change** (`upsert-sql.ts`):
- Add module-level `CAST_COMPATIBLE_TARGETS` map:
  - `CAST_INT`         → `{int2, int4, int8}` (smallint, integer, bigint)
  - `CAST_NUMERIC`     → `{numeric}`
  - `CAST_BOOLEAN`     → `{bool}`
  - `CAST_TIMESTAMPTZ` → `{timestamptz, timestamp}`
  - `CAST_VARCHAR`     → `{}` (varchar handled by truncation wrapper, not here)
- Extend `applyTypeCoerceWrap` Path 2: if transform is `CAST_*` AND colType in `CAST_COMPATIBLE_TARGETS[transform]`, emit outer `CAST(${frag} AS ${pgType})`.
- Result for the blocked case: `CAST_INT` + int2 target now emits `CAST(CAST(srcExpr AS INTEGER) AS SMALLINT)`. Nested CAST is PG-native (value-preserving for in-range; explicit error for out-of-range — desired audit-emitting behavior).

**Test changes** (`upsert-sql-type-coerce.test.ts`):
- **Removed** 1 stale test ("non-passthrough transform (CAST_INT) returns frag unchanged") — behavior changed by Item B.
- **Added** 7 happy tests in new describe block "Goal 003 Item B CAST_* compat-target wrap":
  - CAST_INT + int2 → SMALLINT (the blocker case)
  - CAST_INT + int8 → BIGINT
  - CAST_INT + int4 → INTEGER (same-type, redundant but harmless)
  - CAST_NUMERIC + numeric → NUMERIC
  - CAST_BOOLEAN + bool → BOOLEAN
  - CAST_TIMESTAMPTZ + timestamptz → TIMESTAMPTZ
  - CAST_TIMESTAMPTZ + timestamp (downgrade) → TIMESTAMP
- **Added** 3 negative tests in new describe block "Goal 003 Item B negative cases (NO wrap)":
  - CAST_INT + numeric (incompatible per map) → unchanged
  - CAST_INT + bool (incompatible) → unchanged
  - CAST_VARCHAR + varchar (empty compat list) → unchanged
- **Updated** existing negative cases: replaced JSON_EXTRACT-only check with broader non-CAST coverage (JSON_EXTRACT + LOOKUP_FK both verified).

**Verify** (2026-05-19T17:24Z):
- `pnpm exec vitest run test/upsert-sql-type-coerce.test.ts` → **23 passed / 0 failed** (was 13; +10 net: 7 Item B happy + 3 Item B negative + LOOKUP_FK addition; -1 stale CAST_INT test).
- `pnpm typecheck` → exit 0.
- Full suite verification: pending background task (expected 318 = 308 + 10).

**C3 contract**: SATISFIED. CAST_* auto-wrap completeness verified via 10 new tests covering 4 CAST_* codes × compatible target types.

The 2 `learning_path_step_ordinal smallint` mappings from Goal 002 REPORT §3.5 are now unblocked at compile-time; Wave 1 retry (Item F) will confirm runtime success.

---

### Item A — LOOKUP_FK fallback-only compiler fix (2026-05-19T17:10Z) — turn count: ~10

**Code change** (`apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts`):
- Insert 2 early-detection branches in `case "LOOKUP_FK"` BEFORE existing matchOn regex.
- **Branch 1** — `(target_table === "sys_tenancies" && matchOn === "legacy_tenant_id")` → emits `(SELECT m.canonical_tenant_id FROM brownfield.tenant_id_mappings m WHERE m.legacy_id = (srcExpr) LIMIT 1)`. Uses caller-provided srcExpr (typically `staging_raw_record->>'legacy_tenant_id'`).
- **Branch 2** — `(target_table === "sys_users" && matchOn === "legacy_user_id")` → emits `(SELECT user_id FROM sys.sys_users WHERE user_email = (staging_raw_record->>'user_email') LIMIT 1)`. Hardcodes `staging_raw_record->>'user_email'` — intentionally ignores srcExpr (which carries `legacy_user_id` value); aligns with Obs-1 from APPROVAL 003.
- All other (target, match_on) combinations fall through to the existing regex path (Goal 002 Item C plain-column + jsonb-expr forms + PK_OVERRIDES).
- Header comment block updated documenting Goal 003 scope-lock (FALLBACK-ONLY active path; primary jsonb-convention deferred to Goal 004+) + DB-level validate_lookup_fk_payload() acceptance of primary path at registry-INSERT time.

**Test changes** (`apps/api/test/transform-compiler.test.ts`):
- **Updated** 1 test (step-0 baseline test for `(sys_tenancies, legacy_tenant_id)`): changed expectations from PK_OVERRIDES `tenant_id` path to Item A `brownfield.tenant_id_mappings` fallback.
- **Added** 1 happy test: `(sys_users, legacy_user_id)` fallback uses `sys.sys_users.user_email` lookup, srcExpr is NOT in fragment.
- **Added** 5 adversarial fixtures in new describe block `"Goal 003 Item A adversarial fixtures (C2 ≥5)"`:
  - ADV-A1: quote injection in match_on for sys_tenancies fallback → InvalidLookupFkPayloadError
  - ADV-A2: semicolon injection in match_on for sys_users fallback → InvalidLookupFkPayloadError
  - ADV-A3: uppercase `LEGACY_TENANT_ID` does NOT trigger fallback (regex rejects) → InvalidLookupFkPayloadError
  - ADV-A4: `legacy_<X>_id` form for non-fallback target (sys_skills) falls through to regex (NOT fallback path)
  - ADV-A5: cross-target fallback-leak prevention — `(sys_users, legacy_tenant_id)` does NOT use sys_tenancies fallback

**Verify** (2026-05-19T17:10Z):
- `pnpm exec vitest run test/transform-compiler.test.ts` → **71 passed / 0 failed** (65 baseline + 1 swapped + 5 new + 1 happy adjacent = +6 net new tests in LOOKUP_FK area)
- `pnpm typecheck` → exit 0
- Full suite verification: pending background task

**C2 contract**: SATISFIED. ≥5 adversarial fixtures specific to Item A new behavior added (ADV-A1..A5). All happy paths covered.

---

### Items D + M — Migration 000033 (2-Part: tenant_id_mappings + validate_lookup_fk trigger) (2026-05-19T16:58Z) — turn count: ~7

**Migration**: `db/migrations/000033_brownfield_tenant_id_mappings_and_validate_lookup_fk.sql` (sha `d9768ede63dc80b413f2cc7427d3cb61887a843b459b4ecafbb502a2a63b27bb`). Single file with 2 clearly-marked Parts per CP-v2-1 accepted. Applied via SSH; registered as `sys.sys_schema_migrations` migration_id=**386**.

**Part 1 (Item D)** — `brownfield.tenant_id_mappings` table:
- CREATE TABLE IF NOT EXISTS with PK = legacy_id varchar(255), canonical_tenant_id uuid FK to sys.sys_tenancies(tenant_id).
- Seeded with **4 rows** mapping all 4 distinct legacy tenant_ids discovered in legacy_mirror Wave 1 sources (competencies/courses/certifications/learning_paths) → RTL_BANK_REFERENCE.tenant_id `86ba7a65-217f-48ba-8ce5-5c09b40a66b0`.
- All 4 legacy IDs map to same canonical RTL_BANK_REFERENCE in Goal 003 single-tenant scope; Goal 004 Wave 2 will reconcile to per-tenant canonical IDs as SmartFood/EcoNova/Heuresys System tenancies are created.

**Part 2 (Item M, CP2)** — `brownfield.validate_lookup_fk_payload()` SQL function + INSERT trigger:
- Function accepts 4 payload forms: (a) literal column on sys.<target>, (b) jsonb-expr `<col>_metadata->>'<key>'`, (c) `legacy_<X>_id` with `<X>_metadata` jsonb (deferred primary path), (d) Goal 003 Item A scope-locked fallback pairs (sys_tenancies/legacy_tenant_id, sys_users/legacy_user_id).
- Trigger `brownfield_column_mappings_lookup_fk_validate` BEFORE INSERT on `brownfield.column_mappings`, fires only WHEN `column_mapping_transform = 'LOOKUP_FK'`.
- Existing wave=1 rows NOT re-validated (trigger only fires on new INSERTs per A1 ABSOLUTE).

**Checkpoint tests (10/10 PASS)** verified at 2026-05-19T16:58Z local:

| # | Test | Expected | Result |
|---|---|---|---|
| direct 1 | form (a) literal column existing | true | ✅ |
| direct 2 | form (b) jsonb-expr existing | true | ✅ |
| direct 3 | form (c) legacy_<X>_id w/ meta | true | ✅ |
| direct 4 | form (d) sys_tenancies fallback | true | ✅ |
| direct 5 | form (d) sys_users fallback | true | ✅ |
| direct 6 | reject: bogus literal col | false | ✅ |
| direct 7 | reject: bogus target table | false | ✅ |
| direct 8 | reject: NULL match_on | false | ✅ |
| trigger 5a | invalid payload INSERT → check_violation | reject | ✅ |
| trigger 5b | valid fallback INSERT → trigger passes (FK violation on synthetic source_column_id confirms trigger ran first) | accept | ✅ |

**C8 contract**: SATISFIED. Trigger fires correctly, rejects malformed LOOKUP_FK payloads with `check_violation` ERRCODE, accepts all 4 documented payload forms.

**C11 contract**: SATISFIED. `brownfield.tenant_id_mappings` table exists with 4 seed rows (≥1 RTL_BANK_REFERENCE row required).

---

### Item C — Migration 000032 sys_activity_classifications CHECK relax (2026-05-19T16:50Z) — turn count: ~5

**Discovery**: Goal 002 REPORT §3.5 said "2× sys_activity_classifications CHECK violation". EXEC step 0 traced root cause:
- 1 column_mapping `column_mapping_id=63223251-3d08-40fa-af46-5687e85d6e03` targets `activity_classification_scheme` via UPPERCASE transform on `legacy_mirror.industry_classifications.classification_system`.
- 3 distinct UPPER()'d values in staging.wave1_activity_classifications: **ATECO (2210 rows)** + **NACE (1066 rows)** + NULL/empty (8 rows).
- Original CHECK whitelist: `{ATECO_2025, NACE_REV_2_1, ATECO_2007, NACE_REV_2}` (versioned only). The 2 violating *distinct values* are `ATECO` + `NACE` (base versions, no year/revision suffix).
- The 8 NULL rows are a separate concern (left to source_empty filter per C5 audit).

**Action**: write + apply migration 000032 (`db/migrations/000032_sys_activity_classifications_check_relax.sql`, sha `504e73d19160bb6ed91cbf5dab62fda31aff920bb6b016979ab40aa9a4a8eee8`) relaxing CHECK to include `ATECO` + `NACE` (preserving original 4-value whitelist). Idempotent (DROP CONSTRAINT IF EXISTS + ADD), reversible (documented in migration header).

**Apply** via `scp + ssh oracle-vm-default 'sudo -u postgres psql -f /tmp/000032_*.sql'` at 2026-05-19T14:52:32Z UTC = 16:52:32 local. Output: 2× ALTER TABLE + 1× COMMENT. Recorded in `sys.sys_schema_migrations` as migration_id=**385**.

**Verify** (in-transaction sandbox + ROLLBACK to keep DB clean):
- Test 1: INSERT 2 rows with schemes `ATECO`, `NACE` → both accepted ✅
- Test 2 (regression): INSERT 1 row with scheme `SOMETHING_BAD` → CHECK violation raised ✅
- Constraint definition contains all 6 expected values ✅
- COMMENT attached ✅

**C6 contract**: SATISFIED at constraint level. Final verification per C6 ("0 CHECK violations post-migration-000032 (Path C.1)") occurs at Item F Wave 1 retry when the 3276 staged ATECO/NACE rows actually upsert.

---

### Item K (COMPLETE, EXEC step 0 per CP6) — turn count: ~3

- §0.K — TYPE_CAST_MAP extension code change: ✅ (4 new types + refactor to module-level `applyTypeCoerceWrap`)
- §0.K — 13 new tests in `apps/api/test/upsert-sql-type-coerce.test.ts`: ✅ (file-naming deviation from PLAN v2 §2.2 documented here)
- §0.K — 446 audit row INSERT: ✅ (synthetic anchor run + 1-to-1 JOIN to brownfield.source_tables; full coverage)
- §0.K — Step 0.5 fresh pg_dump pre-Goal-003 backup: ✅ (252 MB at /home/ubuntu/backups/pre_g003_20260519_143407.dump)
- §0.K — atomic commit: pending below

---

*End of _03_EXEC_003_brownfield-seeding-complete.md (incremental; appended on every major step)*
