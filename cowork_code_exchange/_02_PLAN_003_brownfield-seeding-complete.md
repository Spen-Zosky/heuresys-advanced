# _02_PLAN_003_brownfield-seeding-complete.md (v2 — Wave 1 closure)

**Protocol phase:** PLAN (executor → supervisor, v2 against revised PROMPT)
**Goal ID:** 003
**Slug:** brownfield-seeding-complete (scope narrowed to Wave 1 closure; Wave 2/3/4 → Goal 004 future)
**Plan version:** v2
**Created:** 2026-05-19T16:10:00+02:00, by Claude Code CLI (Windows, DESKTOP-KH728P2)
**Supersedes:** `_02_PLAN_003_v1.md` (sha256 `bf0d9e128503ac6a3da17c684391188cfba19a26a29bee9486e2e5276245454c`) — archived, do not consult for execution; consult only for v1→v2 rationale traceability.
**PROMPT reference:** `_01_PROMPT_003_brownfield-seeding-complete.md` v2 (sha256 `59a1fe63a381499328dca200c02f561745512c02e7e9090fa394e8c20d8f0902`)
**PROMPT v1 archive:** `_01_PROMPT_003_v1.md` (sha256 `dfa5eee66b5011edae24a39d680a8d6c81147c9c5074e291819572e64afb8de3`)
**DISCOVERY reference:** `_00_DISCOVERY_003_brownfield-seeding-complete.md` (unchanged)
**Predecessor artefacts:**
- `_05_REVIEW_002_*.md` (CW-B13 lesson + Goal 002 partial closure context)
- `_04_REPORT_002_*.md` (technical state inherited; root-cause forensics)
- `_02_PLAN_002_*.md` (§-1 standing lessons template)

---

## §-1 — Standing lessons inherited

L1–L6 inherited from PLAN 002 §-1 (DB-only forensic insufficient; G11 bidirectional; hybrid > full rewrite; test/code co-commit batching; vitest path convention; env-gated full-scale via `tsx`). Restated for in-context retrieval:

1. **DB-only forensic insufficient** — code reading mandatory for any "engine does/doesn't X" claim. Applied: EXEC step 0 verifies column types + jsonb keys via `information_schema.columns` + sample queries before LOOKUP_FK convention is locked.
2. **G11 cross-check** — every Item (§2.2) maps to ≥1 acceptance criterion (§2.6) AND vice versa. Applied: §2.11 bidirectional matrix.
3. **Hybrid > full rewrite** — extend the Goal 001a v5 / Goal 002 SQL-side infrastructure; do not touch the JS-side fallback.
4. **Test/code co-commit batching** — each Item ships in 1 atomic commit grouping production code + targeted tests.
5. **Vitest path convention** `apps/api/test/**/*.test.ts`; full-scale via `tsx scripts/run-wave1-fullscale.mjs`, NOT vitest fixture.
6. **Forensic transparency-over-halt** is correct when blocker is upstream-of-PROMPT scope. v2 INVERTS this: anti-pattern guard makes Wave 1 closure the only valid exit; in-scope blockers are halt+escalated per §6, never side-stepped.

L7–L8 new in Goal 003 (preserved in v2):

7. **L7 — payload-vs-schema cross-check is mandatory pre-registration** (U-2026-05-19-01). v2 STRENGTHENS this: U-cross-check is now ENFORCED at DB level via SQL trigger (Item M / CP2 accepted) — no future LOOKUP_FK mapping can bypass the gate.
8. **L8 — scope-reduction is not an option; halt+escalate is the only pause primitive**. v2 preserves this within the narrowed Wave 1 scope: NO Wave 1 issue may be deferred to Goal 004; NO partial Wave 1 closure may be proposed.

NEW lesson surfaced by v1→v2 amendment:

9. **L9 — honesty-at-PLAN-time enables supervisor-side scope correction**. v1 PLAN §2.7 (1-turn buffer marginal) + §2.10 (9 advisories) + §2.12 (CP1 strongly recommended) gave Cowork the evidence to amend scope at PLAN-review (Goal 003 v2 narrow + Goal 004 future) instead of forcing mid-EXEC halt. Applied: this v2 PLAN continues the honest-at-PLAN-time discipline; any surfaced strain in v2 will be flagged in §2.7 + §2.10 + §2.12, never silently absorbed.

---

## §0 — Executive summary

Close **Wave 1 only** (deterministic scope) per PROMPT v2 §1: fix the LOOKUP_FK `legacy_<X>_id` jsonb-lookup convention (33×sys_tenancies + 5×sys_users mappings); extend type-coerce auto-wrap to all `CAST_*` transforms (closes 2 smallint mappings); relax `sys_activity_classifications._scheme_check` via migration 000032 (closes 2 mappings); create `brownfield.tenant_id_mappings` (forward investment) + SQL function `brownfield.validate_lookup_fk_payload()` + INSERT trigger (closes U-loophole permanently) in migration 000033; document 681 orphan lineage rows via audit class `LEGACY_NULL_LINEAGE_DOCUMENTED_V1` at EXEC step 0 (per CP6 accepted); re-run Wave 1 full-scale with audit PERSISTED; verify 14 acceptance criteria C1–C14 with SHA-anchored evidence in REPORT 003 + STATE finalize as single atomic commit (CP7). Wave 2/3/4 explicitly **NOT** in scope (Goal 004 future per §1.2 of PROMPT v2). Honest turn estimate: **25 turns** (range 23–30) in 40 cap; buffer 10–17; escalation at 35.

---

## §1 — Vocab / state reference (inherited from DISCOVERY 003)

Unchanged from v1 §1 (no DISCOVERY changes). Restated tersely:

### 1.1 — Wave 1 inheritance (post-Goal-002 state)

- 94 APPROVED Wave 1 mappings; 15 target sys.* tables.
- **Populated** (7/15): sys_skills (444), sys_skill_families (77), sys_learning_modules (93), sys_learning_paths (135), sys_user_certifications (1), sys_blueprint_process_registry (23), sys_compensation_bands (75).
- **Empty** (8/15): sys_skill_categories, sys_skill_taxonomy_edges, sys_skill_aliases, sys_learning_path_steps, sys_skill_learning_mappings, sys_activity_classifications, sys_process_kpi_templates, sys_job_roles.

### 1.2 — LOOKUP_FK semantic state

- `match_on` literal-column form (11 mappings) → OK.
- `match_on` `legacy_<X>_id` form (38 mappings: 33×sys_tenancies, 5×sys_users) → INVALID at runtime (column absent from schema).
- Convention to apply (per PROMPT v2 §1.1 P1): `<X>_metadata->>'legacy_id'` if jsonb sample at EXEC step 0 confirms key presence; else fallback to deterministic code-based lookup via `brownfield.tenant_id_mappings` (Item D forward investment).

### 1.3 — Type-coerce + CHECK constraint state

- 2 `learning_path_step_ordinal` mappings blocked: transform is `CAST_INT`, target is `smallint`, auto-wrap whitelist doesn't cover this combination → Item B compiler-side fix.
- 2 `sys_activity_classifications` mappings blocked: legacy values violate `_scheme_check` CHECK → Item C migration 000032 relax (Path C.1 per pre-decision §4 of PROMPT v2).

### 1.4 — Goal 002 hygiene state (pre-decided)

- 681 NULL `source_lineage_import_run_id` rows: leave NULL, document via audit class `LEGACY_NULL_LINEAGE_DOCUMENTED_V1` (Path K.1 per pre-decision §4 of PROMPT v2).
- TYPE_CAST_MAP completeness: extend at step 0 via Item K (CP6 accepted).

### 1.5 — Infrastructure inherited (Goal 002 stable)

SQL-side transform compiler + upsert executor + audit pipeline + per-mapping conflictInference resolver + migration 000031 + pg_stat_statements 1.10 + full-scale runner (`scripts/run-wave1-fullscale.mjs`). All Wave 1 targets have UQ visible to `loadTargetMeta`.

---

## §2.1 — Baseline capture plan (EXEC step 0)

All measurements taken BEFORE source/DB write. Each artefact stored verbatim in `_03_EXEC_003_*.md` events.jsonl + `cowork_code_exchange/baselines/INDEX.md` with verified-by timestamp. **Step 0 also executes Item K hygiene per CP6 accepted.**

| # | Measurement | Command | Expected baseline |
|---|---|---|---|
| 0.1 | `pnpm test` baseline | `pnpm --filter @heuresys/api test --reporter=verbose` | 289 passed \| 5 skipped \| 0 failed |
| 0.2 | typecheck + lint baseline | `pnpm --filter @heuresys/api typecheck && pnpm lint` | exit 0, 0 errors |
| 0.3 | Source SHAs (rollback anchor) | `sha256sum apps/api/src/modules/brownfield-wave-executor/*.ts` | matches Goal 002 closure SHAs |
| 0.4 | DB pre-run state (15 Wave 1 targets + brownfield + audit counts) | per-table count queries | matches DISCOVERY 003 §2.2 |
| 0.5 | Fresh pg_dump pre-Goal-003 | `ssh oracle-vm-default 'sudo -u postgres pg_dump --format=custom -d heuresys_advanced > /tmp/pre_g003_<ts>.dump && sudo cp /tmp/...  /home/ubuntu/backups/'` | ~130MB file mtime < 5 min |
| 0.6 | Migration 000031 + pg_stat_statements verified | `SELECT * FROM sys.sys_schema_migrations WHERE migration_id=384; SHOW shared_preload_libraries;` | row present + 'pg_stat_statements' loaded |
| 0.7 | `pg_stat_statements_reset()` | `SELECT pg_stat_statements_reset();` | clean slate |
| 0.8 | **U1 — `tenant_metadata` jsonb sample** | `SELECT tenant_code, tenant_metadata FROM sys.sys_tenancies WHERE tenant_metadata IS NOT NULL LIMIT 5; SELECT count(*) FROM sys.sys_tenancies WHERE tenant_metadata ? 'legacy_id';` | RTL_BANK_REFERENCE row's `tenant_metadata->>'legacy_id'` non-null OR documented absent (drives Item A convention path) |
| 0.9 | **U2 — `user_metadata` analog** | `SELECT user_email, user_metadata FROM sys.sys_users WHERE user_metadata IS NOT NULL LIMIT 5;` | sample for Item A user_id convention |
| 0.10 | **U3 — RTL_BANK_REFERENCE present** | `SELECT count(*) FROM sys.sys_tenancies WHERE tenant_code='RTL_BANK_REFERENCE';` | = 1 |
| 0.11 | **K-hygiene §1 — 681 orphan lineage rows present** | `SELECT count(*) FROM sys.sys_source_lineage_records WHERE source_lineage_import_run_id IS NULL;` | = 681 (matches DISCOVERY) |
| 0.12 | **K-hygiene §2 — TYPE_CAST_MAP coverage check** | source-read `upsert-sql.ts` CAST_MAP keys + diff vs PG basic types whitelist | identify any missing types (interval, time, timetz, bytea per v1 Item K) |
| 0.13 | **K-hygiene §3 — emit audit classification rows for orphan lineage** | `INSERT INTO audit.import_validation_results (rule_code, message, ...) SELECT 'LEGACY_NULL_LINEAGE_DOCUMENTED_V1', 'Pre-Goal-001a-v5 orphan row', ... FROM sys.sys_source_lineage_records WHERE source_lineage_import_run_id IS NULL` | 681 audit rows inserted; documents the orphans without UPDATE on lineage table |

If 0.1–0.13 don't all confirm expected baseline, halt+escalate before any code change (per L8).

---

## §2.2 — Code change plan (8 Items, ordered per PROMPT v2 §7)

Execution order: **K (step 0) → A → B → C → D → M → F → L**. Each Item ships in 1 atomic commit (code + tests bundled per L4).

### Item K — Goal 002 hygiene piggyback (P6, executed at EXEC step 0 per CP6 accepted)

- **Files**: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts` (CAST_MAP extension); SQL queries against `audit.import_validation_results` (no schema change).
- **Current state**: CAST_MAP covers ~12 PG types; 681 NULL lineage rows undocumented.
- **Intended change**:
  1. Extend CAST_MAP with `interval, time, timetz, bytea` (Goal 002 §6 item 5 completion).
  2. INSERT 681 audit rows with `rule_code='LEGACY_NULL_LINEAGE_DOCUMENTED_V1'` + reference to each orphan lineage row's PK + comment "Pre-Goal-001a-v5 lineage row predating import_run_id FK population".
  3. NO UPDATE on `sys.sys_source_lineage_records` (per A4 Path K.1).
- **Risk class**: low. Additive only; CAST_MAP extension is non-breaking; audit rows append-only.
- **Test coverage**: 2 new tests in `transform-compiler.test.ts` (interval auto-wrap, time auto-wrap).
- **Atomic commit**: `chore(api): MVP-3 Tappa D — TYPE_CAST_MAP completeness + 681 orphan lineage audit documented (Goal 003 Item K, EXEC step 0)`.

### Item A — `transform-compiler.ts`: LOOKUP_FK `legacy_<X>_id` jsonb-lookup convention (P1)

- **Files**: `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts`, `apps/api/test/transform-compiler.test.ts`.
- **Current state (post-Goal-002)**: LOOKUP_FK case reads `payload.match_on` literally with whitelist regex covering literal-column + jsonb-expression forms; `legacy_<X>_id` form fails at runtime ("column does not exist").
- **Intended change**:
  1. Extend whitelist regex to recognize the 3rd form: `^legacy_([a-z_][a-z0-9_]*)_id$` (group 1 = entity name; excludes uppercase/digits-leading/quotes/semicolons).
  2. When 3rd form matches AND target_table has a `<entity>_metadata` jsonb column verified via `information_schema.columns` (compiler-side check; if convention applicability sample at step 0 U1 confirmed key presence, emit jsonb form; else fallback):
     - **Primary path (jsonb form)**: emit `t.<entity>_metadata->>'legacy_id' = staging.staging_raw_record->>'<original_source_column>'`. Entity name escaped via `format("%I", entity || '_metadata')`; literal `'legacy_id'` jsonb key escaped via `format("%L", 'legacy_id')`; source column escaped via `format("%L", source_col)`.
     - **Fallback path (deterministic via tenant_id_mappings)**: emit `t.tenant_id = (SELECT canonical_tenant_id FROM brownfield.tenant_id_mappings WHERE legacy_id = staging.staging_raw_record->>'legacy_tenant_id')` for sys_tenancies target; analog via `sys.sys_users.user_email` for sys_users (no separate user_id_mappings table per A1 boundary — user lookup uses email).
  3. `CompileResult` augmented with structured `auditClassification` field (`LOOKUP_FK_CONVENTION=JSONB_LEGACY_ID` vs `LITERAL_COL` vs `JSONB_EXPRESSION` vs `FALLBACK_DETERMINISTIC`) — engine.ts logs per-mapping convention for audit transparency.
  4. NO UPDATE on `brownfield.column_mappings` rows (A1 ABSOLUTE).
- **Risk class**: medium. Whitelist + per-segment escapes block injection; sample-based step 0 prevents convention misapplication.
- **Test coverage** (added to `transform-compiler.test.ts`): 8 tests including 5 adversarial fixtures per C2 requirement —
  - happy 1: `match_on=legacy_tenant_id` + target=`sys_tenancies` → jsonb lookup
  - happy 2: `match_on=legacy_user_id` + target=`sys_users` → jsonb lookup
  - happy 3: `match_on=skill_name` (literal) → literal column (regression)
  - happy 4: `match_on=learning_module_metadata->>'legacy_id'` (jsonb-expr) → unchanged (regression)
  - adversarial 1: `match_on=legacy_tenant_id; DROP TABLE--` → `InvalidLookupFkPayloadError`
  - adversarial 2: `match_on=legacy_'X'_id` → `InvalidLookupFkPayloadError`
  - adversarial 3: `match_on=legacy_NOSUCH_id` + target=`sys_skills` (no `nosuch_metadata`) → fallback or error per compiler decision
  - adversarial 4: `match_on=legacy___id` (empty entity) → `InvalidLookupFkPayloadError`
  - adversarial 5: `match_on=legacy_x__y_id` (double underscore) → accepted as entity `x__y` (still safe; verifies regex permissiveness boundary)
- **Atomic commit**: `feat(api): MVP-3 Tappa D — LOOKUP_FK jsonb-legacy-id convention (Goal 003 Item A)`.

### Item B — `transform-compiler.ts` + `upsert-sql.ts`: CAST_* auto-wrap generalization (P2)

- **Files**: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts` (auto-wrap dispatch), `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts` (if CAST_* compile path needs adjustment), `apps/api/test/transform-compiler.test.ts`.
- **Current state**: Goal 002 v1 Item E added auto-wrap for `DIRECT_COPY`/`TRIM` × {12 target types}. `CAST_INT` emits explicit `::int` cast in compileTransform; for `smallint` target, the resulting `::int` requires implicit cast at insert time and fails if value within int range but mapping payload expects `smallint`.
- **Intended change** (compiler-side only per A1 ABSOLUTE):
  1. Auto-wrap dispatch at upsert-sql examines target column PG type via `loadTargetMeta` BEFORE wrapping. If transform is `CAST_INT` AND target type is `smallint`, the wrapper emits `::smallint` instead of `::int`. If transform is `CAST_INT` AND target type is `int`, behavior unchanged.
  2. Generalize to all `CAST_*` transforms: discover the CAST type from the transform code suffix; cross-check target type compatibility; emit appropriate explicit cast. Add unit-level table mapping `CAST_INT → smallint|int|bigint`, `CAST_BIGINT → bigint`, `CAST_NUMERIC → numeric(p,s)`, etc.
- **Risk class**: low. Type-coerce is SELECT-list side; no FK or upsert key impact.
- **Test coverage**: 3 new tests in transform-compiler.test.ts —
  - `CAST_INT` + target `smallint` → emits `::smallint`
  - `CAST_INT` + target `int` → emits `::int` (regression)
  - `DIRECT_COPY` + target `smallint` → unchanged auto-wrap (regression)
- **Atomic commit**: `feat(api): MVP-3 Tappa D — CAST_* type-target compatibility auto-wrap (Goal 003 Item B)`.

### Item C — Migration 000032 — `sys_activity_classifications._scheme_check` relax (P3, A2 Path C.1)

- **Files**: `db/migrations/000032_sys_activity_classifications_check_relax.sql`.
- **Current state**: 2 legacy values violate existing `_scheme_check` whitelist.
- **Intended change**:
  1. DROP existing `sys_activity_classifications_scheme_check` constraint (IF EXISTS for idempotency).
  2. ADD relaxed CHECK including the 2 additional legacy scheme values (to be discovered at EXEC step 0 from `legacy_mirror.activity_classifications` data).
  3. COMMENT on constraint documenting: "Relaxed for Goal 003 brownfield import; demo-data realism per supervisor decision A2 Path C.1 (2026-05-19)".
  4. Idempotent (`IF EXISTS` / `IF NOT EXISTS`) + reversible (DROP new + ADD original).
- **Risk class**: low.
- **Test coverage**: 1 integration test (in a new or existing brownfield test file) verifying post-migration that the 2 affected sys_activity_classifications rows insert successfully when Wave 1 runs.
- **Atomic commit**: `chore(db): migration 000032 — relax sys_activity_classifications _scheme_check (Goal 003 Item C, A2 Path C.1)`.

### Item D — Migration 000033 Part 1 — `brownfield.tenant_id_mappings` table + RTL_BANK seed (P4)

- **Files**: `db/migrations/000033_brownfield_tenant_id_mappings_and_validate_lookup_fk.sql` (single migration ships both Item D table + Item M trigger per PROMPT v2 §6 boundary).
- **Current state**: table does not exist.
- **Intended change** (Part 1 of migration 000033):
  1. `CREATE TABLE IF NOT EXISTS brownfield.tenant_id_mappings (legacy_id varchar PRIMARY KEY, canonical_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id), notes text, created_at timestamptz DEFAULT now())`.
  2. `INSERT INTO brownfield.tenant_id_mappings (legacy_id, canonical_tenant_id, notes) SELECT '<RTL legacy id>', tenant_id, 'RTL_BANK_REFERENCE seed for Wave 1 LOOKUP_FK fallback path' FROM sys.sys_tenancies WHERE tenant_code='RTL_BANK_REFERENCE' ON CONFLICT (legacy_id) DO NOTHING`. The exact `<RTL legacy id>` value comes from EXEC step 0 U1 query (likely `RTL_BANK_REFERENCE` or a numeric legacy id from RTL bank source).
  3. Idempotent + reversible (`DROP TABLE IF EXISTS brownfield.tenant_id_mappings` after revoking FK references).
- **Risk class**: low. Forward-investment table; doesn't change Wave 1 mapping behavior unless Item A fallback path engages.
- **Test coverage**: 1 integration test verifying post-migration that `brownfield.tenant_id_mappings` has ≥1 row pointing to RTL_BANK tenancy.
- **Atomic commit**: same as Item M (shipped together in migration 000033).

### Item M — Migration 000033 Part 2 — `brownfield.validate_lookup_fk_payload()` SQL function + INSERT trigger (P7, CP2 accepted)

- **Files**: same migration 000033 file (Part 2).
- **Current state**: U-2026-05-19-01 cross-check is inline-per-mapping at authoring time; no DB-level enforcement.
- **Intended change** (Part 2 of migration 000033):
  1. CREATE OR REPLACE FUNCTION `brownfield.validate_lookup_fk_payload(p_target_table varchar, p_match_on varchar) RETURNS boolean` — returns true if `match_on` is (a) a literal column existing on `sys.<p_target_table>`, OR (b) the jsonb-expression form `<col>_metadata->>'legacy_id'` where `<col>_metadata` exists on `sys.<p_target_table>` AS jsonb, OR (c) the `legacy_<X>_id` form where `sys.<p_target_table>` has `<X>_metadata` jsonb. Returns false otherwise.
  2. CREATE TRIGGER `brownfield_column_mappings_lookup_fk_validate` BEFORE INSERT ON `brownfield.column_mappings` FOR EACH ROW WHEN (NEW.column_mapping_transform = 'LOOKUP_FK') EXECUTE FUNCTION `brownfield.validate_lookup_fk_payload_trigger()` (wrapper that extracts payload->>'target_table' + 'match_on' and calls validate function; raises EXCEPTION on false).
  3. **Important boundary**: trigger applies to NEW INSERTs only. Existing wave=1 rows are NOT re-validated (per A1 ABSOLUTE). This means the 38 existing problematic `legacy_<X>_id` rows continue to exist in the registry; they're handled by Item A compiler-side convention. The trigger prevents FUTURE malformed payloads (Goal 004 Wave 2/3/4 mapping authoring).
  4. Idempotent (CREATE OR REPLACE FUNCTION + CREATE TRIGGER IF NOT EXISTS pattern; `DROP TRIGGER IF EXISTS` before CREATE if PG version doesn't support `IF NOT EXISTS` on trigger). Reversible (DROP TRIGGER + DROP FUNCTION).
- **Risk class**: medium. Trigger affects all future INSERTs on `brownfield.column_mappings`. R10 in §2.8 covers overhead (negligible at registry scale).
- **Test coverage**: 2 new integration tests —
  - synthetic INSERT with valid `match_on=skill_name` + target=`sys_skills` → succeeds
  - synthetic INSERT with invalid `match_on=NONEXISTENT_COL` + target=`sys_skills` → raises trigger exception
- **Atomic commit**: shared with Item D — `feat(brownfield): migration 000033 — tenant_id_mappings table + validate_lookup_fk_payload trigger (Goal 003 Items D+M, CP2 accepted)`.

### Item F — Wave 1 full-scale retry (P5)

- **Files**: no source change; uses existing `scripts/run-wave1-fullscale.mjs`.
- **Current state**: Wave 1 ran 3× during Goal 002 with 377 upserted of 41285 staged (LOOKUP_FK blocker + smallint + CHECK).
- **Intended change**: run Wave 1 full-scale end-to-end with audit PERSISTED. Expected post-Items-A+B+C+D+M effect:
  - LOOKUP_FK 38 mappings resolve via jsonb convention (33×sys_tenancies, 5×sys_users) → expected ~30+ new mappings produce ≥1 lineage row.
  - CAST_* 2 mappings produce smallint upserts → expected ~2 new mappings produce lineage.
  - sys_activity_classifications 2 mappings pass CHECK → expected ~2 new mappings produce lineage.
  - Total expected upsert count: ≥ 5000 (per Goal 002 PROMPT 003 v1 §2.6 A10 target). Honestly: 5000 is aggressive; if upsert count is < 5000 but C4 (every APPROVED mapping has ≥1 successful upsert OR documented exception) is met, C4 supersedes raw volume.
- **Risk class**: medium. Wave 1 retry stress-tests Items A+B+C+D+M end-to-end.
- **Test coverage**: REPORT-time evidence (no new unit tests; integration captured in EXEC log + audit trail).
- **Per-wave acceptance gate**: C4, C5, C7, C9 all PASS post-Wave-1. Per §2.5 halt-gate: if any of C4/C5/C7/C9 fail, halt+escalate per L8 (NO partial closure).
- **Atomic commit**: `feat(brownfield): MVP-3 Tappa D — Wave 1 fullscale retry post-Items-A+B+C+D+M (Goal 003 Item F)`.

### Item L — Final verification + REPORT 003 + STATE finalize (P8, CP7 accepted)

- **Files**: `cowork_code_exchange/_03_EXEC_003_brownfield-seeding-complete.md` (events.jsonl); `cowork_code_exchange/_04_REPORT_003_brownfield-seeding-complete.md` (new); `cowork_code_exchange/_00_STATE_003.md` (update to `current_phase: REPORT`, `next_actor: Cowork`, `closure_status: pending_review`).
- **Current state**: post-Item-F Wave 1 complete; final verification + REPORT pending.
- **Intended change**:
  1. Verify each of C1–C14 with verbatim command + output + timestamp + SHA anchor.
  2. REPORT 003 structured per (no per-wave subdivision needed since v2 scope is Wave 1 only):
     - §1 EXEC step 0 baselines (incl. Item K hygiene evidence)
     - §2 Items A/B/C/D/M ship evidence
     - §3 Wave 1 full-scale retry evidence (C4/C5/C7/C9)
     - §4 Cross-criteria evidence (C1/C2/C3/C6/C8/C10/C11/C12/C13/C14)
     - §5 Per-Item commit list with SHAs
     - §6 Pre-Goal-003 backup manifest
     - §7 Lessons for Goal 004 (informational; no commitments)
  3. STATE 003 finalized.
- **Risk class**: low (REPORT-only, no DB/code writes).
- **Test coverage**: n/a (REPORT phase).
- **Atomic commit** (single commit per CP7): `docs(cowork): Goal 003 EXEC log + REPORT + STATE finalize — CLOSED (Goal 003 Item L)`.

---

## §2.3 — DB write plan (per object)

| Phase | Object | Write type | Trigger | Rows expected | Idempotent? | Reversible? |
|---|---|---|---|---|---|---|
| step 0 | `audit.import_validation_results` (LEGACY_NULL_LINEAGE_DOCUMENTED_V1) | INSERT | Item K | 681 | yes (filter on rule_code) | yes (DELETE WHERE rule_code='LEGACY_NULL_LINEAGE_DOCUMENTED_V1') |
| Item C | `sys.sys_activity_classifications.<scheme_check>` | DROP+ADD CHECK (mig 000032) | Item C migration | 1 constraint | yes | yes (re-add original) |
| Item D | `brownfield.tenant_id_mappings` | CREATE TABLE (mig 000033 Part 1) | Item D migration | n/a | yes | yes (DROP) |
| Item D | `brownfield.tenant_id_mappings` (RTL row) | INSERT | Item D migration seed | 1 | yes (ON CONFLICT) | yes (DELETE) |
| Item M | `brownfield.validate_lookup_fk_payload()` | CREATE FUNCTION (mig 000033 Part 2) | Item M migration | n/a | yes (CREATE OR REPLACE) | yes (DROP) |
| Item M | `brownfield_column_mappings_lookup_fk_validate` | CREATE TRIGGER (mig 000033 Part 2) | Item M migration | n/a | yes | yes (DROP) |
| Item F | `sys.sys_*` (15 Wave 1 targets) | INSERT/UPDATE via UPSERT path | Wave 1 fullscale retry | varies (target ≥1/table) | yes (audit-driven) | yes (DELETE WHERE source_lineage_import_run_id IN (...)) |
| Item F | `sys.sys_source_lineage_records` | INSERT | per upserted row | varies | yes | yes |
| Item F | `audit.import_run_logs` + `audit.import_validation_results` + `audit.import_approval_decisions` | INSERT (PERSISTED) | Wave 1 retry | thousands | append-only | yes (DELETE WHERE import_run_id) |
| Item F | `brownfield.import_runs` | INSERT + state UPDATE | Wave 1 retry | 1 | yes | yes |

**Forbidden writes** (per PROMPT v2 §6 + A1 ABSOLUTE):
- `brownfield.table_mappings` UPDATE/DELETE on wave=1 rows.
- `brownfield.column_mappings` UPDATE/DELETE on wave=1 rows.
- `sys.sys_source_lineage_records` UPDATE/DELETE on existing rows (orphans documented via audit class, not UPDATE).
- `legacy_mirror.*` any write.
- Direct `sys.sys_schema_migrations` manipulation.

---

## §2.4 — Injection safety design

### 2.4.1 — LOOKUP_FK 3rd form whitelist (Item A)

- Regex: `^legacy_([a-z_][a-z0-9_]*)_id$` — group 1 = entity name with character class excluding uppercase, digits-leading, quotes, semicolons, dashes.
- Entity name passes through `format("%I", entity || '_metadata')` for column reference.
- Literal `'legacy_id'` jsonb key passes through `format("%L", 'legacy_id')`.
- Original source column escaped via `format("%L", source_col)`.
- Adversarial fixtures cover injection via match_on (Item A test coverage); ≥5 per C2.

### 2.4.2 — `validate_lookup_fk_payload()` SQL function (Item M)

- Function parses target_table + match_on as varchar; uses `format()` with `%I`/`%L` for any dynamic SQL construction (none expected — function is pure validation, no dynamic execute).
- INFORMATION_SCHEMA queries used internally with parameterized varchar.
- Trigger receives payload via NEW.column_mapping_transform_payload (jsonb); extracts via `->>` operators (safe, no SQL injection surface).
- RAISE EXCEPTION uses a literal message format string (no user input interpolated as SQL).

### 2.4.3 — Migration 000032 constraint values (Item C)

- The 2 new scheme values added to CHECK come from EXEC step 0 query against `legacy_mirror.activity_classifications` distinct values. Constraint values are literals in the migration SQL — no dynamic SQL. Migration validated via SQL grammar review before apply.

---

## §2.5 — Wave 1 retry execution design

### 2.5.1 — Sequence

```
EXEC step 0 (baseline + Item K hygiene)
  ↓
Item A commit  →  typecheck/lint/pnpm test verify (incremental)
  ↓
Item B commit  →  typecheck/lint/pnpm test verify
  ↓
Item C commit (migration 000032 apply via SSH on VM)
  ↓
Item D+M commit (migration 000033 apply via SSH on VM, both Parts)
  ↓
Wave 1 retry (Item F) — full-scale run via tsx scripts/run-wave1-fullscale.mjs
  ↓ (C4/C5/C7/C9 gate)
Item L (REPORT 003 + STATE finalize, single commit per CP7)
```

### 2.5.2 — Halt-gate post-Wave-1

After Item F's Wave 1 retry, the executor evaluates C4 / C5 / C7 / C9:

- ALL pass → proceed to Item L REPORT authoring + STATE finalize commit.
- ANY fail → halt+escalate per L8 (NO partial closure). Cowork responds via inbox `answer` / `plan_amendment_requested`; executor resumes per Cowork direction.

### 2.5.3 — Wall-clock budget (Wave 1 only)

- Goal 002 retrospective: 110s wall-clock for ~440 rows. Wave 1 full-scale targets ≥5000 rows post-Items.
- Honest extrapolation: 5000/440 × 110s ≈ 1250s ≈ ~21 min IF row processing scales linearly. Realistic estimate (with audit + lineage overhead): **5–10 min**.
- PROMPT v2 §2 sets ≤ 10 min target. **Per-wave halt threshold**: > 15 min wall-clock → halt+escalate. Below threshold acceptable.

### 2.5.4 — Audit trail PERSISTED

Wave 1 retry uses `tsx scripts/run-wave1-fullscale.mjs` (NOT vitest fixture). No `afterAll` cleanup. Audit rows append to existing trail (Goal 002 left 165k+ rows; Goal 003 retry adds thousands more).

---

## §2.6 — Acceptance criteria (14 — ALL must pass)

Reproduced verbatim from PROMPT v2 §3.

- **C1** `pnpm --filter @heuresys/api test` exits 0; ≥ 276 + new tests passing (estimated 276 + ~14 new = ~290 + base = ≥289 baseline; honest target ≥ 295 with Items A+B+M+K test extensions).
- **C2** `transform-compiler.test.ts`: NEW tests for `legacy_<X>_id` jsonb convention including ≥ 5 adversarial path/payload fixtures (Item A).
- **C3** `transform-compiler.test.ts`: NEW tests for `CAST_*` auto-wrap completeness (Item B).
- **C4** Wave 1 full-scale re-run: every APPROVED mapping has ≥ 1 successful upsert OR documented `source_empty_in_legacy_mirror` exception in audit.
- **C5** All 15 Wave 1 target sys.* tables have ≥ 1 row OR documented source-empty.
- **C6** `sys_activity_classifications`: 0 CHECK violations post-migration-000032 (Path C.1).
- **C7** 0 `SKIPPED_UNSUPPORTED_TRANSFORM_V1` audit rows for the Wave 1 full-scale run.
- **C8** `brownfield.column_mappings` INSERT trigger `validate_lookup_fk_payload` exists; synthetic invalid INSERT raises DB-level error (Item M tests).
- **C9** 0 `audit.import_validation_results.skip_reason='no_conflict_inference_available'` for the Wave 1 run.
- **C10** `pnpm --filter @heuresys/api typecheck` PASS, `pnpm --filter @heuresys/api lint` 0 errors.
- **C11** `brownfield.tenant_id_mappings` table exists with ≥ 1 row (RTL_BANK_REFERENCE).
- **C12** ≥ 8 atomic commits attributable to Goal 003 (Items K + A + B + C + D+M (combined) + F + L = 7 base, +1 hotfix slack = 8).
- **C13** REPORT 003 has verbatim evidence for C1–C12 + C14 with SHA-anchored timestamps.
- **C14** 681 pre-existing NULL lineage rows: documented in `audit.import_validation_results` with `rule_code='LEGACY_NULL_LINEAGE_DOCUMENTED_V1'` (Item K, EXEC step 0).

---

## §2.7 — Turn budget breakdown (40 cap, escalation 35, honest target ≤ 32)

```
EXEC step 0 (baseline + Item K hygiene)           3 turns
Item A — LOOKUP_FK semantic compiler fix          5 turns  (code + 8 tests + iterative compile)
Item B — CAST_* auto-wrap generalization          3 turns  (code + 3 tests)
Item C — Migration 000032 CHECK relax             2 turns  (SQL + apply via SSH + verify)
Item D+M — Migration 000033 (table + trigger)     4 turns  (SQL + apply via SSH + 2 tests for trigger + verify)
Item F — Wave 1 fullscale retry                   3 turns  (run + post-run audit verification C4/C5/C7/C9)
Item L — REPORT 003 + STATE finalize              5 turns  (cross-criteria verify + REPORT authoring + commit per CP7)
                                                ────────
Sub-total                                        25 turns
Buffer (within 40 cap)                           15 turns
Honest range                                     23-30 turns
Escalation threshold                             35 turns
Hard cap                                         40 turns
```

**Honest assessment**: 25-turn midpoint with 15-turn buffer is comfortable. The range 23–30 covers:
- Lower bound: clean Items A/B/M tests pass first attempt; Wave 1 retry COMPLETE first attempt.
- Upper bound: 1–2 typecheck/test iteration cycles per Item + Wave 1 retry needs hotfix (e.g., compiler edge case in adversarial test 3 with NOSUCH_id fallback path requires Item A v2 commit).
- Buffer absorbs: 1–2 turn slack for SSH-based migration apply choreography on VM + occasional doc/STATE update inline.

**Compared to PROMPT v2 §8.6 ask** (≤32 with buffer 5–8): we are **7 turns under target with 7-turn extra buffer**. Goal 003 v2 budget fits honestly. No escalation expected.

If reality diverges + Item A test 3 (`legacy_NOSUCH_id` fallback) requires multi-turn design discussion, OR Wave 1 retry needs unexpected hotfix, escalation at turn 35 triggers chat conversation BEFORE silently absorbing. Per L8 / L9: honesty-at-PLAN-time + halt+escalate are the only allowed pause primitives.

---

## §2.8 — Risk register

| # | Risk | P | I | Mitigation |
|---|---|---|---|---|
| R1 | LOOKUP_FK `legacy_<X>_id` jsonb-lookup convention misapplies (entity name → wrong `<X>_metadata` column) | M | H | EXEC step 0 U1/U2 sample queries on `tenant_metadata`/`user_metadata` BEFORE Item A locks convention; compiler-side `information_schema.columns` cross-check before emitting jsonb fragment; fallback path via `brownfield.tenant_id_mappings` (Item D) if convention applicability fails |
| R2 | Wave 1 retry C4 fails (some APPROVED mapping still produces 0 lineage rows) | M | H | Post-Wave-1 audit query enumerates per-mapping outcome; halt+escalate if any APPROVED mapping has neither lineage row nor documented source_empty audit row. Per L8 NO partial closure |
| R3 | Migration 000032 CHECK relax doesn't cover all violating values (3rd unknown value) | L | M | EXEC step 0 query DISTINCT scheme values from `legacy_mirror.activity_classifications` BEFORE writing migration; constraint values literal from query result |
| R4 | Migration 000033 trigger overhead breaks existing Wave 1 row INSERTs (false positive on validation) | L | H | Trigger fires WHEN transform = 'LOOKUP_FK' only; existing wave=1 rows are unaffected (trigger is BEFORE INSERT on new rows). Verified via Item M tests including regression test on a valid literal-column mapping |
| R5 | Wave 1 retry exceeds 15min wall-clock halt threshold | L | M | Goal 002 retrospective indicates ~110s for 440 rows; 5000-row target extrapolates ~21min linearly. If audit/lineage overhead grows superlinearly (unlikely per Goal 001a v5 design), halt+escalate per §2.5.3 — chat-discuss with Cowork before re-run |
| R6 | Per-mapping `LOOKUP_FK_CONVENTION=FALLBACK_DETERMINISTIC` path engages for `sys_users` with empty `user_email` (deterministic lookup fails) | M | M | Item A fallback for sys_users uses `staging_raw_record->>'user_email'`. If source legacy_mirror.users has rows with NULL email, the LEFT JOIN returns NULL → mapping skips that row with audit class `LOOKUP_FK_FALLBACK_UNRESOLVABLE`. Documented as source-empty exception per C4 |
| R7 | `audit.import_validation_results` table growth from K-hygiene (+681 rows) + Wave 1 retry (~1000s rows) impacts query performance | L | L | Existing partition/index from Goal 001a v5 holds. Goal 002 left 165k+ rows live with no observed perf degradation |
| R8 | SQL function `validate_lookup_fk_payload` has a logical bug rejecting valid payloads | M | H | Item M test coverage covers ≥4 acceptance shapes (literal column, jsonb-expression, legacy_<X>_id with valid metadata column, valid wave-2-style legacy_user_email) + rejection shapes. Logic verified in unit-test-equivalent integration test |

8 risks. v1 had 12 risks; v2 narrower scope drops 4 Wave-2/3/4-specific risks (R6/R7/R9/R12 from v1).

---

## §2.9 — Rollback plan

### Per-Item rollback

| Item | Code rollback | DB rollback |
|---|---|---|
| K | `git revert <sha>` | `DELETE FROM audit.import_validation_results WHERE rule_code='LEGACY_NULL_LINEAGE_DOCUMENTED_V1'` |
| A | `git revert <sha>` | n/a (compiler-side; affects future runs only) |
| B | `git revert <sha>` | n/a |
| C (mig 000032) | n/a (DDL is migration; revert via inverse SQL) | `psql -c "ALTER TABLE sys.sys_activity_classifications DROP CONSTRAINT <new>; ALTER TABLE ... ADD CONSTRAINT <original>"` |
| D (mig 000033 Part 1) | n/a | `psql -c "DELETE FROM brownfield.tenant_id_mappings WHERE legacy_id IN (...); DROP TABLE brownfield.tenant_id_mappings"` |
| M (mig 000033 Part 2) | n/a | `psql -c "DROP TRIGGER IF EXISTS brownfield_column_mappings_lookup_fk_validate ON brownfield.column_mappings; DROP FUNCTION IF EXISTS brownfield.validate_lookup_fk_payload(varchar, varchar)"` |
| F (Wave 1 retry) | n/a | `psql -c "DELETE FROM sys.sys_source_lineage_records WHERE source_lineage_import_run_id=<retry_run_id>; DELETE FROM audit.* WHERE import_run_id=<retry_run_id>; -- caveat: target sys.* rows not deleted by lineage delete; full restore requires pg_restore"` |
| L | `git revert <sha>` | n/a |

### Full Goal-003 rollback

`pg_restore` from EXEC step 0 backup (`pre-Goal-003` dump created at step 0.5). Restores DB to Goal 002 closure state. Code-side: `git revert` Goal 003 commits in reverse (Items K + A + B + C + D+M + F + L = 7 commits + possible 1 hotfix = ≤ 8 reverts).

---

## §2.10 — Architectural advisory (minimal — most pre-decided)

Per PROMPT v2 §4 + §5: A1/A2/A4 pre-locked + CP2/CP6/CP7 accepted + A3/A5/A6/A7/A8/A9 + CP1/CP3/CP4/CP5 deferred to Goal 004. **No new advisories surfaced in v2 PLAN drafting that require Cowork sign-off**.

One observation flagged for Cowork awareness (NOT an advisory request, NOT a re-surfacing of deferred items):

### Obs-1 — Item A fallback path for sys_users (deterministic via user_email)

Item A's fallback path for `legacy_user_id → sys_users` (when jsonb convention doesn't apply) uses `staging_raw_record->>'user_email'` against `sys.sys_users.user_email`. This is mentioned in §2.2 Item A intended change point 2 fallback path. The implication: if source `legacy_mirror.users` has rows with NULL email, those rows produce no lineage and are audit-logged as `LOOKUP_FK_FALLBACK_UNRESOLVABLE`. R6 covers this risk. This is **transparent at PLAN-time**, not a deferral or scope reduction — it's a documented edge case mitigated by the audit pathway + C4 "documented source-empty exception" criterion.

No Cowork response required for Obs-1; it's a notification.

---

## §2.11 — G11 cross-check matrix (bidirectional, 8 Items × 14 criteria)

### §2.2 Items → §2.6 acceptance criteria

| Item | Covers criteria | Notes |
|---|---|---|
| K (EXEC step 0 hygiene) | C14, C1 (partial — new CAST_MAP tests) | 681 audit rows + extended CAST_MAP |
| A (LOOKUP_FK semantic fix) | C2, C4 (partial), C5 (partial), C7 (partial), C9 (partial) | 8 tests incl. 5 adversarial |
| B (CAST_* auto-wrap) | C3, C4 (partial), C5 (partial) | 2 smallint mappings unblocked |
| C (mig 000032) | C6, C5 (partial) | sys_activity_classifications CHECK closure |
| D (mig 000033 Part 1) | C11 | tenant_id_mappings + RTL_BANK seed |
| M (mig 000033 Part 2) | C8 | trigger + function |
| F (Wave 1 retry) | C4, C5, C7, C9 | Wave 1 fullscale retry verifies these |
| L (REPORT) | C12, C13 | commit count + REPORT evidence |
| (across Items, per-commit verify) | C10 | typecheck + lint maintained throughout |
| (across Items, summed) | C1 | pnpm test cumulative |

### §2.6 acceptance criteria → §2.2 Items

| Criterion | Covered by Items | Verification trigger |
|---|---|---|
| C1 (pnpm test ≥276 + new) | K + A + B + M (test additions); enforced after each Item commit | end-of-EXEC |
| C2 (LOOKUP_FK 5+ adversarial tests) | A (8 tests, 5 adversarial) | Item A commit |
| C3 (CAST_* tests) | B (3 tests) | Item B commit |
| C4 (Wave 1 every APPROVED has ≥1 upsert OR exception) | A + B + C + D + M (compiler+migrations fix) + F (retry run + audit verify) | post-Item-F |
| C5 (All 15 Wave 1 targets ≥1 row OR documented) | A + B + C + F | post-Item-F |
| C6 (sys_activity_classifications 0 CHECK violations) | C (mig 000032) + F (Wave 1 retry verifies) | post-Item-F |
| C7 (0 SKIPPED_UNSUPPORTED_TRANSFORM_V1) | A + B (transform vocab fully supported) + F (retry confirms) | post-Item-F |
| C8 (validate_lookup_fk_payload trigger exists + rejects invalid) | M (function + trigger + 2 tests) | Item M (mig 000033) commit |
| C9 (0 no_conflict_inference_available) | A + B + K (TYPE_CAST_MAP complete) + F (Wave 1 retry confirms) | post-Item-F |
| C10 (typecheck + lint clean) | (all Items, enforced after each commit) | per-commit |
| C11 (tenant_id_mappings ≥1 row) | D (mig 000033 Part 1 + RTL seed) | Item D commit |
| C12 (≥8 atomic commits) | L (commit count check) | end-of-EXEC |
| C13 (REPORT 003 verbatim evidence for C1–C12 + C14) | L (REPORT authoring) | REPORT phase |
| C14 (681 audit-documented orphan rows) | K (EXEC step 0) | post-step-0 |

**G11 bidirectional verdict**: every Item covers ≥1 criterion AND every criterion is covered by ≥1 Item. **No orphans.** Items D and M are tightly coupled (single migration 000033), tracked as separate Items for G11 mapping clarity.

---

## §2.12 — Counter-proposals (executor strategic input)

Per PROMPT v2 §7 "§2.12: 1 NEW counter-proposal slot for executor strategic input (if any)". Most CPs already accepted (CP2/CP6/CP7) or deferred to Goal 004 (CP1/CP3/CP4/CP5). v2 PLAN surfaces 1 minor proposal:

### CP-v2-1 — Migration 000033 ships as a single file with two clearly-marked Parts

**Observation**: PROMPT v2 §6 specifies `db/migrations/000033_brownfield_tenant_id_mappings_and_validate_lookup_fk.sql` (one file). Item D + Item M share this file. To keep the file readable + future maintainers oriented, **structure** the migration as:

```sql
-- =============================================================================
-- 000033 — brownfield.tenant_id_mappings + validate_lookup_fk_payload trigger
-- Goal 003 Items D + M (CP2 accepted)
-- =============================================================================

-- ----- Part 1: tenant_id_mappings table + RTL_BANK seed (Item D, P4) -----
CREATE TABLE IF NOT EXISTS brownfield.tenant_id_mappings (...);
INSERT INTO brownfield.tenant_id_mappings ... ON CONFLICT DO NOTHING;

-- ----- Part 2: U-2026-05-19-01 cross-check trigger (Item M, P7, CP2) -----
CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_payload(...) ...;
CREATE TRIGGER brownfield_column_mappings_lookup_fk_validate ...;
```

**Effect**: one atomic migration; one atomic commit; clear file-level demarcation between Items D and M for traceability. Matches existing migration conventions in `db/migrations/000024_*.sql` which combine related schema changes into structured Parts.

**Cowork decision needed**: implicit yes (file structure detail, no scope impact); flagged for completeness. **Default**: this structure adopted.

---

## §2.13 — Revision history

### v1 (2026-05-19T15:45+02:00 → archived as `_02_PLAN_003_v1.md` sha256 `bf0d9e12…`)

Initial PLAN against PROMPT 003 v1 (monolithic Wave 1+2+3+4). 12 Items A-L; 30 acceptance criteria (28 PROMPT + 2 executor-added). Honest turn estimate 79/80 (range 69–87); 9 architectural advisories §2.10 surfacing scope strain; 7 counter-proposals §2.12.

### v2 (2026-05-19T16:10+02:00 — this version, against PROMPT 003 v2)

Authored in response to `_01_PROMPT_003_brownfield-seeding-complete.md` v2 (sha256 `59a1fe63…`) which narrowed scope to Wave 1 closure only (Wave 2/3/4 → Goal 004 future).

**Changes vs v1**:

- **Scope**: Wave 1 closure only. Items E/F-v1/G/H/I/J/K-v1 removed; Items renamed/renumbered per PROMPT v2 §7.
- **Items 8 in order**: K (EXEC step 0 hygiene per CP6 accepted) → A (LOOKUP_FK semantic) → B (CAST_*) → C (mig 000032) → D (mig 000033 Part 1 table) → M (mig 000033 Part 2 trigger, NEW per CP2 accepted) → F (Wave 1 retry) → L (REPORT + STATE single commit per CP7 accepted).
- **Acceptance criteria**: 14 (C1–C14) per PROMPT v2 §3 — down from v1's 30.
- **Turn budget**: 40 cap (down from 80); honest estimate 25 turns (down from 79); buffer 15 turns (up from 1); escalation 35.
- **Architectural advisories**: minimal — A1/A2/A4 pre-decided in PROMPT v2 §4; A3/A5/A6/A7/A8/A9 deferred to Goal 004; §2.10 v2 contains only Obs-1 notification (no Cowork response required).
- **Counter-proposals**: CP2/CP6/CP7 accepted (baked into Items M/K/L); CP1/CP3/CP4/CP5 deferred to Goal 004; CP-v2-1 (file structure) flagged with implicit yes default.
- **Risks**: 8 (down from 12); v1's R6/R7/R9/R12 Wave-2/3/4-specific risks dropped.
- **G11 matrix**: rebuilt for 8 Items × 14 criteria; bidirectional clean, no orphans.
- **§-1 lesson L9 added**: honesty-at-PLAN-time enables supervisor-side scope correction (this v1→v2 transition is the case study).

**Anti-pattern guard compliance** (v2 narrower scope):
- ✅ No scope reduction below Wave 1 closure
- ✅ No partial closure proposal
- ✅ No "outside Goal 003 scope" disclaimer for Wave 1 sub-tasks
- ✅ No Goal 004 deferral of Wave 1 issues (Wave 2/3/4 explicitly Goal 004 per PROMPT v2 §1.2)
- ✅ No early exit before all 14 acceptance criteria pass

**Honest budget summary (per PROMPT v2 §8.6)**: 25-turn estimate fits 40-turn cap with 15-turn buffer (vs PROMPT v2 ask of "≤32 turns with buffer 5–8"). Goal 003 v2 honest target ≤30 turns; escalation at 35 retained as safety. NO budget debate required.

---

*End of _02_PLAN_003_brownfield-seeding-complete.md v2*
