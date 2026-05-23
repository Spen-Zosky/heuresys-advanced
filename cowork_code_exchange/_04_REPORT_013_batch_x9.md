# REPORT 013 — X9 SKILGRO mega-bundle outcomes

**Protocol**: Cowork↔CLI v2.2 batch mode — MEGA-BUNDLE (PROMPT 013, 5 blocks executed)
**Authored**: 2026-05-23T14:15Z by CLI X9
**Scope answered**: PROMPT 013 §§3-7 (Block A engine + Block B canonical re-mapping + Block C CW-B37 deep fix + Block D CW-B35 Phase C + Block E SKIPPED per spec recommendation)
**Predecessor**: REPORT 012 (`_04_REPORT_012_batch_x8.md`)

---

## §0 — Pre-conditions + baseline

**Tunnel SSH localhost:5433 → oracle-vm-default:5432 confirmed alive.**
**HEAD pre-X9**: `4d66d9a` (chore: handoff S927). Working tree drift = inbox files + previous untracked PROMPT.

### Baseline live counts (pre-Block-B+C+D)

| Target | Pre-X9 | Source pool |
|---|---:|---|
| sys_skills | 20048 | — |
| sys_learning_paths | 3227 | analytics 5 sources |
| sys_learning_modules | 4488 | analytics 5 sources |
| sys_learning_path_steps | 0 | REFERENCE_ONLY post-CW-B39 |
| sys_skill_learning_mappings | 0 | blocked by 2-hop until X9 |
| sys_skill_taxonomy_edges | 11965 | — |
| sys_skill_categories | 0 | competencies pending fuzzy |
| sys_esco_occupation_mappings | 7645 | — |
| sys_users | **433** (R-A2 ≥430 ✓) | — |
| legacy_mirror.courses | 127 | — |
| legacy_mirror.course_modules | 564 | — |
| legacy_mirror.esco_skills | 14011 | — |

### Registry pre-X9 verified
- 5 table_mappings touching `courses` / `course_modules` / `learning_path_courses` (3 REFERENCE_ONLY post-X8, courses→sys_learning_modules IMPORT but 0 lineage rows ever produced).
- 2 CW-B37 table_mappings (certification/course_esco_skills → sys_skill_learning_mappings) IMPORT but missing skill_id resolution column_mappings.

---

## §1 — Block A: ADR-0017 LOOKUP_FK_2HOP engine

**Acceptance: PASSED.**

### Artefacts shipped
| File | Change |
|---|---|
| `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts` | +`LOOKUP_FK_2HOP` to `SUPPORTED_TRANSFORMS` Set (16→17) + new `case "LOOKUP_FK_2HOP"` (~50 LOC) emitting the spec §4 SQL (`LIKE '%' \|\| lm.<pk>::text`) |
| `apps/api/test/transform-compiler.test.ts` | Set-size assertion 16→17 + LOOKUP_FK_2HOP in coverage list |
| `apps/api/test/transform-compiler.lookup-fk-2hop.test.ts` | NEW: 5 acceptance tests (T1 happy path / T2 missing lookup_2hop / T3 missing sub-field / T4 SQL-injection escape via %I and %L / T5 canonical shape JOIN+LIMIT) |
| `db/migrations/000043_lookup_fk_2hop_validator.sql` | NEW: validator `brownfield.validate_lookup_fk_2hop_payload(jsonb,uuid)` + dispatch trigger function `validate_lookup_fk_dispatch` routing LOOKUP_FK vs LOOKUP_FK_2HOP — idempotent (verified by twice-apply) |
| `cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md` | Status `PROPOSED` → `ACCEPTED` |

### Verified-by
- `psql -f db/migrations/000043_lookup_fk_2hop_validator.sql` → 8-statement transaction COMMIT (re-applied after dispatch fix, see §7 CW-B46)
- `pnpm exec vitest run test/transform-compiler.{test,lookup-fk-2hop.test,cast-enum.test}.ts` → **82/82 PASS** (incl 5 new tests)
- `pnpm exec vitest run` (full suite) → **332 passed / 1 pre-existing flaky (skills.integration LIST USER) / 5 skipped** — well above PROMPT acceptance threshold ≥327
- `pnpm typecheck` → clean

### Engine semantics (final)
```sql
(SELECT slr.source_lineage_target_record_id
   FROM legacy_mirror.esco_skills lm
   JOIN sys.sys_source_lineage_records slr
     ON slr.source_lineage_source_record_id LIKE '%' || lm.id::text
  WHERE lm.uri = (staging_raw_record->>'esco_skill_uri')
    AND slr.source_lineage_target_table_name = 'sys_skills'
  LIMIT 1)
```
`%I`/`%L` escape via `pg-format` (incl. malicious-schema injection probe T4).

---

## §2 — Block B: Canonical learning re-mapping (Option B revised)

**Acceptance: APPLIED + lineage results pending Wave 1.**

### Decision applied
Per `01_FORENSIC.md §3.1'/§3.2'` revised plan: **courses → sys_learning_paths** + **course_modules → sys_learning_modules** (semantically cleaner, courses = "paths", modules = "modules").

### Registry changes (`db/seeds/brownfield/wave2/x9_block_bcd.sql`)
| Action | Target | Rows |
|---|---|---:|
| Re-classify courses → sys_learning_modules from IMPORT to REFERENCE_ONLY | table_mapping `eb431a77` | 1 row |
| NEW table_mapping courses → sys_learning_paths (IMPORT) | new id | 1 row |
| NEW column_mappings under above | various | **26** |
| NEW table_mapping course_modules → sys_learning_modules (IMPORT) | new id | 1 row |
| NEW column_mappings under above | various | **12** |

### Verified-by
- Bundle SQL completed `COMMIT` with summary: `new_table_mappings=2 / new_column_mappings_block_B_paths=26 / new_column_mappings_block_B_modules=12 / courses_reclassified_to_ref_only=1`.

### Phase B.3 status — DEFERRED (per spec §B.4)
learning_path_courses (124 rows) → sys_learning_path_steps stays REFERENCE_ONLY (post-X8). Semantic ambiguity around the (path_id, module_id) tuple from a path↔course assignment table not resolved inline — deferred per spec authorization.

### Wave 1 retry outcome (run af2d9d71, 55.7 min wall-clock)
- 127 courses staged in `staging.wave1_learning_paths` validation_status=PASSED ✓
- 564 course_modules staged in `staging.wave1_learning_modules` validation_status=PASSED ✓
- Approval decisions APPROVED for both new mappings (WAVE_1_AUTO_APPROVE)
- **0 rows upserted into sys_learning_paths / sys_learning_modules** — `staging_target_record_id IS NULL` for all 127+564 rows
- No new lineage records for `source_lineage_source_table IN ('courses','course_modules')` (vs expected +127 / +564)
- Sample LOOKUP_FK and 2-hop SQL probed by hand resolve correctly in isolation. Engine-level upsert step did not process these new IMPORT mappings — see §7 CW-B49.

---

## §3 — Block C: CW-B37 deep fix via LOOKUP_FK_2HOP

**Acceptance: APPLIED + audit drop pending Wave 1.**

### Inline mitigation deviation vs spec wording
Spec §5 Steps #1 reads "UPDATE 2 existing column_mappings (...) → skill_id" but registry pre-X9 had **no** existing mapping targeting `skill_learning_mapping_skill_id`; it had `esco_skill_uri → skill_learning_mapping_metadata JSON_EXTRACT` instead. Per pattern memo §13 (Inline OK: UPDATE-in-place column_mappings) and PROMPT §0 (Inline OK: tutti i fix CW-B di REPORT 011/012 ya autorizzati), executed **UPDATE-in-place** rewriting the existing pair `(table_mapping_id, source_column_id)` from JSON_EXTRACT→metadata to LOOKUP_FK_2HOP→skill_id. Original `esco_skill_uri` metadata embed is sacrificed; the URI still indirectly visible via lineage.

### Concrete changes
| Source | New mapping | Expected unlock |
|---|---|---:|
| certification_esco_skills.esco_skill_uri | LOOKUP_FK_2HOP → skill_learning_mapping_skill_id (via legacy_mirror.esco_skills) | ~664 rows |
| course_esco_skills.esco_skill_uri | idem | ~717 rows |
| course_esco_skills.course_id | LOOKUP_FK (form b) → skill_learning_mapping_module_id (best-effort via course_modules lineage) | partial (course-level loose match) |

### Residual finding (NOT a P0 halt — spec target was skill_id audit)
The `skill_learning_mapping_module_id` is NOT NULL. The remap `course_id → module_id LOOKUP_FK` is **loose** because `course_esco_skills.course_id` is a course/path reference, not a module reference. Rows whose `course_id` does not match a row in `sys_learning_modules.learning_module_metadata->>'legacy_id'` will silent-skip on NOT NULL. Spec acceptance §6.6 measures `nk_missing_skill_learning_mapping_skill_id` drop — orthogonal to module_id audit. Documented as CW-B47 (see §7).

### Wave 1 retry outcome (run af2d9d71)
- 664 certification_esco_skills + 717 course_esco_skills staged, validation PASSED ✓
- All 1381 rows audit-classified `SKIPPED / WHERE_SKIP_FILTER_EXCLUDED_V1`
- `sys_skill_learning_mappings` count: 0 → 0 (PROMPT §6.6 acceptance: 1381 → ≤300 NOT MET)
- Sample SQL hand-probe verifies the LOOKUP_FK_2HOP fragment resolves CORRECTLY when given a matched URI:
  - `course_esco_skills` row with URI `http://esco.eu/skill/F6` (synthetic test data short-form), lm_id `425a53b7-…`, matched_lineage=1, resolved skill_id=`3c650f06-…` ✓
- URI-domain mismatch quantified: 314 distinct course_esco URIs, only **635 of 717 rows match `legacy_mirror.esco_skills.uri` directly** (synthetic test URIs mix `http://esco.eu/skill/<short>` and `http://data.europa.eu/esco/skill/<UUID>`). For certification_esco_skills, only **340 of 664 rows match**.
- Even matched rows produced **zero upsert**, suggesting the engine-level WHERE_SKIP_FILTER triggered for additional reasons beyond uri match (likely `skill_learning_mapping_module_id` NOT NULL resolution failure on the loose `course_id → module_id LOOKUP_FK`).

**→ HALT P0 per PROMPT §7' `lookup_2hop_unexpected_fail` raised in this REPORT §7 CW-B49.**

---

## §4 — Block D: CW-B35 Phase B+C cleanup

**Acceptance: PASSED (immediate).**

### Phase B.1 — DEFERRED per spec §2 Option B.2 (low-ROI, 100 rows)
Recommendation to defer accepted; X9 bandwidth committed to higher-impact Block A+B+C.

### Phase C.1 — APPLIED
4 table_mappings re-classified IMPORT → REFERENCE_ONLY:
- `onet_esco_mappings → sys_skill_taxonomy_edges` (135 rows)
- `ontology_source_mappings → sys_skill_taxonomy_edges` (40 rows)
- `skill_taxonomy_extensions → sys_skill_taxonomy_edges` (52 rows)
- `skill_matrices → sys_skill_taxonomy_edges` (4 rows)

Total: **231 rows** removed from Wave 1 import scope (audit noise drop expected). Bundle summary: `cw_b35_phase_c_count=4`.

### Verified-by
- Bundle SQL `UPDATE 4` (line item §D.1) committed.
- Next Wave 1 audit forensic confirms `nk_missing_skill_taxonomy_edge_parent_id` 331 → ~100 (residual = Phase B.1 deferred 100 rows).

---

## §5 — Block E: CW-B36 competencies fuzzy

**Status: SKIPPED per PROMPT §7 recommendation** (low-ROI 32 rows, defer to dedicated polishing post-X9). No registry changes.

---

## §6 — Audit forensics post-X9

### Pre/post target counts (Wave 1 run af2d9d71, 55.7 min)
| Target | Pre-X9 | Post-X9 | Δ | Spec target |
|---|---:|---:|---:|---|
| sys_skills | 20048 | 20048 | 0 | (no target) |
| sys_learning_paths | 3227 | 3227 | 0 | +127 NOT MET ❌ |
| sys_learning_modules | 4488 | 4488 | 0 | +564 NOT MET ❌ |
| sys_skill_learning_mappings | 0 | 0 | 0 | 1381→≤300 NOT MET ❌ |
| sys_skill_taxonomy_edges | 11965 | 11965 | 0 | Block D registry only |
| sys_esco_occupation_mappings | 7645 | 7645 | 0 | (no change) |
| sys_users **R-A2** | 433 | 433 | 0 | ≥430 ✅ |

### Wave 1 audit decisions distribution (run af2d9d71)
| Phase | Rows | Notes |
|---|---:|---|
| STAGE_COMPLETE.mappings | 87 | All IMPORT+APPROVED+wave1 (incl 2 X9 new) |
| STAGE_COMPLETE.staged_rows_total | 59211 | Includes 127+564+664+717 X9 source rows |
| VALIDATE_COMPLETE.validated_rows_total | 59211 | All PASSED, failed=0 |
| APPROVE_COMPLETE.approved | 68 | (of 87) |
| UPSERT_COMPLETE.lineage_rows_total | 21204 | None for X9 sources |
| UPSERT_COMPLETE.upserted_rows_total | 21175 | None for X9 sources |

### Block D Phase C verify (current-run lineage)
| source_lineage_source_table | rows in run af2d9d71 |
|---|---:|
| skill_adjacencies (homogeneous) | 11634 |
| esco_skill_relations (homogeneous) | 5818 |
| skill_pair_usage (homogeneous) | 111 |
| ontology_skill_relations (homogeneous) | 30 |
| **onet_esco_mappings** | **0** ✅ (reclassified) |
| **ontology_source_mappings** | **0** ✅ |
| **skill_taxonomy_extensions** | **0** ✅ |
| **skill_matrices** | **0** ✅ |

Block D acceptance fully met — 4 heterogeneous sources no longer in current-run lineage scope (231 rows of audit noise removed from `nk_missing_skill_taxonomy_edge_parent_id` going forward).

### CW-B37 source URI domain mismatch quantified
- legacy_mirror.esco_skills uses `http://data.europa.eu/esco/skill/<UUID>` (real ESCO format)
- staging.wave1_skill_learning_mappings has mixed format: synthetic `http://esco.eu/skill/<short>` + real
- 975 of 1381 staged URIs match legacy_mirror.esco_skills (706 unmatched are synthetic test data, no real ESCO skill counterpart)

---

## §7 — Bias catalog updates surfaced during X9

### CW-B49 — IMPORT new table_mapping not propagated to upsert step (NEW, P0 ESCALATION TRIGGER)
**Description**: Block B inserted 2 new IMPORT-classified table_mappings (`bd0226e3` courses→sys_learning_paths, `9e31d2b3` course_modules→sys_learning_modules) with classification=IMPORT, approval=APPROVED, wave=1. Wave 1 retry staged all 127+564 source rows successfully, validation PASSED, approval AUTO_APPROVED, but **0 rows upserted** (`staging_target_record_id IS NULL` for 100% of new-source rows). The engine's upsert pipeline appears to require either: (a) a non-NULL `table_mapping_run_id` (binding the mapping to a specific run prior to wave), (b) a previously-produced lineage row, or (c) some other handshake that newly-created table_mappings lack. Sample SQL hand-probes confirm the underlying transform-compiler + lineage join logic works in isolation against the same staged data. Engine code (engine.ts / upsert-sql.ts) requires forensic to find the exact pre-upsert filter that excludes new-on-this-run mappings.
**Severity**: P0 per PROMPT §7' `lookup_2hop_unexpected_fail` (also applies to courses + course_modules — broader scope than the original trigger name).
**Mitigation deferred**: not inline (engine code path forensic, scope > Block A allowable inline mitigation).

### CW-B46 — Migration dispatch signature mismatch (NEW)
**Description**: when writing a "dispatch" trigger that wraps an existing JSONB-payload validator, the dispatch function MUST call the existing validator with its ACTUAL signature, not assume `(jsonb, uuid)`. In X9 Block A first attempt, `validate_lookup_fk_dispatch()` called `brownfield.validate_lookup_fk_payload(jsonb, uuid)` but the real signature was `(varchar, varchar)` returning boolean. Migration 000043 v1 applied cleanly (CREATE OR REPLACE doesn't lazy-check function refs), then **broke** all subsequent LOOKUP_FK column_mapping INSERTs (B+C+D bundle rolled back). Fix: dispatch function had to inline the LOOKUP_FK validation path (extract target_table+match_on JSONB keys, call `validate_lookup_fk_payload(varchar, varchar)`, RAISE on false).
**Mitigation**: before swapping a TRIGGER FUNCTION that wraps another, dump the wrapped function's pg_get_functiondef and re-implement its body inside the dispatch.

### CW-B47 — Inline mitigation cap when source NOT-NULL semantics break (NEW)
**Description**: Block C UPDATE rewriting `course_id → module_id LOOKUP_FK` is semantically lossy because the source FK lives at the course/path level, not module level. Inline mitigation can patch a target column mapping but cannot synthesize a missing semantic relation. Result: residual silent-skip on NOT NULL `skill_learning_mapping_module_id`. **Mitigation pattern**: when source schema lacks a column for a NOT NULL target FK, the inline UPDATE should add `column_mapping_metadata.note` describing the best-effort fallback expected drop rate, and the REPORT should declare a residual finding rather than claiming full unlock.

### CW-B48 — Background `&` PID detach after first stdout flush (OBSERVATIONAL)
**Description**: launching Wave 1 via `nohup node script.mjs > log &` in the orchestrator shell leaves the PID still running but the parent bash reports background job "completed" after the first stdout flush returns, leading to a false-positive "finished" notification. Verified Wave 1 still alive via `brownfield.import_runs.import_run_status='RUNNING'`. **Mitigation**: monitor wave1 completion via DB poll (`SELECT import_run_status FROM brownfield.import_runs WHERE id=$run`), not via shell job status.

---

## §8 — Pattern memo §12 cross-check

| Pattern memo item | Applied in X9? |
|---|---|
| §13 Inline Mitigation Scope ampliata | YES — Block C UPDATE-in-place (not INSERT) per UQ conflict |
| §9 Iteration as feature — critical thinking | YES — Block B Option A→B revised mid-flight (spec already revised) |
| §12 Verify-before-claim | YES — DB poll for wave1, not shell job status |
| §3 Test as first-class citizen | YES — 5 new acceptance tests Block A |

---

## §9 — Cowork spec improvements suggested

1. **Spec §5 wording**: PROMPT 013 §5 Block C step 1 says "UPDATE 2 existing column_mappings for skill_id" but the registry didn't have skill_id mappings — it had esco_skill_uri → metadata. Spec should say "Repurpose esco_skill_uri JSON_EXTRACT mappings to skill_id LOOKUP_FK_2HOP (UPDATE-in-place per UQ constraint)".
2. **Spec §6.1 SUPPORTED_TRANSFORMS comment**: was "16 entries", but actual pre-X9 was 16 inclusive of CAST_ENUM (since X5 commit `ea4ebe6`). Post-X9 = 17. Spec already correct in this regard (says 17).
3. **Migration 000043 §2 dispatch**: spec §7 template assumed `validate_lookup_fk_payload(jsonb, uuid)` exists; in reality the pre-existing function is `(varchar, varchar)→boolean` plus its trigger wrapper `_trigger()`. ADR-0017 §7 template MUST be rewritten to inline LOOKUP_FK validation in the dispatch (see CW-B46).

---

## §10 — Next step recommendation for Cowork C10 / X10

**Immediate priority (post-X9)**: CW-B49 root-cause investigation in `apps/api/src/modules/brownfield-wave-executor/{engine.ts, upsert-sql.ts}` to find why newly-INSERTed IMPORT table_mappings (without `table_mapping_run_id`) are excluded from the upsert step. This is the blocking issue preventing all Block B/C unlock; once resolved, Block B+C will likely unlock on a single Wave 1 retry without further code/registry changes.

**Working hypotheses** (for the C10 forensic):
1. The upsert query joins `audit.import_approval_decisions` AND requires the table_mapping to have a `table_mapping_run_id` set to the current run before approval (chicken-and-egg);
2. The upsert SQL filters by `table_mapping_classification='IMPORT' AND table_mapping_run_id IS NOT NULL` — new mappings have run_id NULL so are excluded;
3. The engine has a "previously-processed" check via lineage existence as a precondition to upsert.

**Once unblocked, expected unlock**:
- Block B: sys_learning_paths +127, sys_learning_modules +564
- Block C: sys_skill_learning_mappings 0 → ~975 (matched URI count) or up to ≤300 missing skill_id audit remaining

**X10 candidate (per PROMPT)**: Performance Reviews / GOKMER extension (sys_users + sys_goals + sys_job_roles ready). Estimated low-complexity given engine maturity post-CW-B34/B46.

**Watch list inherited from X9**:
- `learning_path_courses → sys_learning_path_steps`: needs new ADR for path↔course↔module relation (deferred from Block B.3).
- CW-B35 Phase B.1 (100 rows filter-based unlock): defer per PROMPT §6.

---

*End REPORT 013 — HALT P0 raised (CW-B49). Engine code + registry artifacts shipped intact; Wave 1 unlock blocked by upstream upsert-step exclusion of new-on-this-run table_mappings.*
