# _01_PROMPT_003_brownfield-seeding-complete.md (v3 — Wave 1 scope correction post-Class-B sub-discovery)

**Protocol phase:** PROMPT (supervisor → executor, second amendment per Class B sub-discovery evidence)
**Goal ID:** 003
**Slug:** brownfield-seeding-complete  *(slug preserved; scope narrowed twice: v1→v2 Wave 2/3/4 to Goal 004; v2→v3 Wave 1 misclassified 3-target subset to Goal 004)*
**Created:** 2026-05-19T13:35:00+02:00 (v1) — **Revised: 2026-05-19T14:00:00+02:00 (v2) — Revised: 2026-05-20T01:00:00+02:00 (v3)**
**Target executor:** Claude Code CLI on Windows (DESKTOP-KH728P2)
**Predecessor artefacts:**
- `_01_PROMPT_003_v1.md` (archived — original monolithic scope, superseded by v2)
- `_01_PROMPT_003_v2.md` (archived — Wave 1 single-focus, superseded by this v3)
- `_02_PLAN_003_*.md` v2 by CLI (sha `ecd21b78…`) — STILL VALID for Items K/A/B/C/D/M execution; v3 narrows ONLY C4/C5 acceptance bar, not Item composition
- `_00_DISCOVERY_003_*.md` (facts unchanged; CW-B18 bias retroactively acknowledged on registry completeness gap)
- `_03_EXEC_003_DIAGNOSTIC_REPORT_Item_F.md` (Class A root cause, P1 commit 127e1a7 shipped)
- `_03_EXEC_003_CLASSB_FINDINGS_Item_F.md` (Class B root cause: registry gap)
- `_03_EXEC_003_CLASSB_SUBDISCOVERY_Item_F.md` (3-target misclassification evidence)

---

## ⚠️ AMENDMENT v2→v3 RATIONALE (NEW — read first)

During Item F EXEC (Wave 1 full-scale retry), CLI surfaced two failure classes:

- **Class A** (HIGH confidence, 4 targets ~8104 staged rows): LOOKUP_FK form (b) `<X>_metadata->>'legacy_id'` resolved NULL because no sys.* table populated that jsonb key. **RESOLVED**: P1 compiler extension (commit `127e1a7`) rewrites form (b) → JOIN through `sys.sys_source_lineage_records`. 72/72 tests + typecheck PASS.

- **Class B** (verified via sub-discovery): 5 Wave 1 targets had ZERO `brownfield.column_mappings` rows for their NOT NULL FK columns. Sub-sub-discovery (`_03_EXEC_003_CLASSB_SUBDISCOVERY_Item_F.md`) revealed:
  - 2 fully feasible mappings (sys_skill_categories + sys_learning_path_steps.path_id)
  - 1 partially feasible (sys_learning_path_steps.module_id — depends on course→module lineage semantic)
  - **3 INFEASIBLE in Wave 1 scope** (sys_blueprint_process_registry, sys_job_roles, sys_esco_occupation_mappings) because:
    - Cascade FK targets (`sys_blueprint_variants` with 1 seed row, `sys_job_families` with 0 rows) are NOT in any brownfield wave mapping
    - Source brownfield columns required for resolution are MISSING (business_processes lacks `variant_id`, onet_occupations lacks `family_id`, onet_esco_mappings lacks `job_role_id`)
  - This is a **DISCOVERY 003 scope mis-classification**: the 3 INFEASIBLE targets are Wave-2-prerequisite-dependent. Their proper closure requires foundational seeding work (ISCO-08-style sys_job_families taxonomy + sys_blueprint_variants definitions + heuristic source-mapping rules) that belongs in Goal 004 with Wave 2/3/4 contextually.

**Supervisor verdict (Cowork, 2026-05-20T01:00)**: This is **scope CORRECTION by DISCOVERY-time evidence**, NOT scope reduction by execution failure. Pattern matches v1→v2 transition (supervisor-side correction when evidence shows original was over-scoped). CW-B18 bias (DISCOVERY 003 missed registry completeness check) confirmed.

**Amendment v2→v3 narrows ONLY C4/C5 acceptance criteria** to the feasible subset:
- C4 reformulated to require successful upsert for every mapping with feasible cascade prerequisites
- C5 reformulated to require ≥12/15 sys.* Wave 1 targets populated (3 explicitly documented as Goal 004 prerequisite-dependent)
- 3 INSERTs into `brownfield.column_mappings` authorized (sys_skill_categories family_id + sys_learning_path_steps.path_id + sys_learning_path_steps.module_id semantic-verified) under A1 ABSOLUTE re-interpretation (INSERT for closure-blocking registry gap legitimate; preserves immutability of existing wave=1 rows)
- All other v2 scope, anti-pattern guards, Items, budget envelope unchanged
- PLAN v2 (sha `ecd21b78…`) remains operative for Items K/A/B/C/D/M (all already shipped); Item F retries with narrowed acceptance; Item L documents v2→v3 transition in REPORT 003 §"Wave 1 scope correction"

This amendment is binding from emission timestamp. PLAN v2 needs no formal v3 — operational annotation in EXEC log suffices.

---

## ⚠️ AMENDMENT v1→v2 RATIONALE (preserved from prior amendment)

PROMPT 003 v1 mandated single-goal closure of Waves 1+2+3+4 ("brownfield-seeding-complete" monolithic). CLI's PLAN v1 §2.7 + §2.10 + §2.12 surfaced honest evidence that:

1. The 80-turn budget had buffer 1 (vs convention 5-10) → ~50% probability of mid-EXEC halt+escalate
2. 9 architectural advisories required Cowork decisions — many were Wave 2/3/4 specific (per-wave thresholds, mapping discovery semantics, human-gate flow, talent_score feasibility)
3. 7 counter-proposals included CP1 (helper script) flagged STRONGLY RECOMMENDED — a meta-tool needed to make the scope fit budget

Supervisor verdict (Cowork, 2026-05-19T14:00): the v1 scope conflated **deterministic Wave 1 closure work** with **exploratory Wave 2/3/4 mapping discovery work**. Per Goal 002 partial-closure lesson (CW-B13), exploratory mapping work surfaces semantic blockers at full-scale that cannot be predicted at PROMPT-time. Forcing 4 waves through one EXEC cycle multiplies × 3-4 the probability of hitting the same class of blockers.

**Amendment**: v2 narrows Goal 003 scope to **Wave 1 closure FULL** (deterministic). Wave 2/3/4 moves to **Goal 004 future** (Cowork emits PROMPT 004 after Goal 003 closure). CP1/CP3/CP4/CP5 → deferred to Goal 004. CP2/CP6/CP7 → accepted in Goal 003 (Wave-1 relevant).

This is NOT scope reduction by executor — it is supervisor-side scope correction at PLAN-review time. The original "DBMS ready" outcome remains the cross-goal commitment, now split across Goals 003 + 004 with appropriate budgets.

---

## ⚠️ Anti-pattern guard (preserved from v1, applies to v2 scope)

Within the v2 narrower scope, the 5 prohibitions still hold:

1. **NO scope reduction** below Wave 1 closure
2. **NO partial closure** — all Wave 1 acceptance criteria must pass
3. **NO "outside Goal 003 scope"** disclaimer for Wave 1 sub-tasks
4. **NO Goal 004 deferral** of Wave 1 issues (Wave 2/3/4 are explicitly Goal 004 scope; Wave 1 issues are Goal 003's responsibility)
5. **NO early exit** before all 13 Wave-1-specific acceptance criteria pass

Halt+escalate is still the only allowed pause primitive.

---

## ⚠️ Protocol turn rule

Your output for this turn MUST be `_02_PLAN_003_brownfield-seeding-complete.md` **v2** (revising v1).

- v1 PLAN (sha `bf0d9e12…`) should be `git mv`-archived to `_02_PLAN_003_v1.md`.
- Canonical `_02_PLAN_003_brownfield-seeding-complete.md` is overwritten with v2 content.
- v2 PLAN reflects the narrowed scope + the 9 v1 advisories now PRE-DECIDED below (§4) + the 3 accepted counter-proposals (§5).
- Honest turn budget for v2 must come in at ≤ 40 with buffer ≥ 5-8 (reflects the deterministic Wave-1-only scope).

Do NOT start EXEC. PLAN-only this turn.

---

## §1 — Scope of Goal 003 v2 (Wave 1 closure only)

### 1.1 — In-scope problems (inherited from PROMPT v1 §2 Problems 1-5 + 9 + 10)

Renumbered for v2 clarity:

- **P1 — LOOKUP_FK semantic compiler fix** (38 affected mappings: 33 `legacy_tenant_id→sys_tenancies`, 5 `legacy_user_id→sys_users`). Convention to apply: `<X>_metadata->>'legacy_id'` if jsonb contains the key; else fallback to deterministic code-based lookup via `brownfield.tenant_id_mappings` table (P3).
- **P2 — Type-coerce auto-wrap extension** to all `CAST_*` transforms when target type matches (closes the 2 `learning_path_step_ordinal smallint` mappings).
- **P3 — Migration 000032 `sys_activity_classifications._scheme_check` relax** (closes the 2 sys_activity_classifications mappings).
- **P4 — Migration 000033 `brownfield.tenant_id_mappings` table** (forward investment: shipped now even though Wave 2 consumes it later; useful as fallback for P1 if jsonb convention fails).
- **P5 — Wave 1 volume gap closure**: re-run full-scale Wave 1 after P1/P2/P3 fixes; every APPROVED Wave 1 mapping has ≥1 successful upsert OR documented "source-empty-in-legacy_mirror" exception.
- **P6 — Goal 002 hygiene piggyback** (moved to EXEC step 0 per CP6): 681 NULL lineage rows documented; TYPE_CAST_MAP completeness check.
- **P7 — CP2 SQL trigger DB-level enforcement of U-2026-05-19-01 cross-check** (new ITEM per accepted counter-proposal): closes the U-loophole permanently for all future LOOKUP_FK INSERTs (Goal 003 + 004+).
- **P8 — Final verification + REPORT 003**: 13 Wave-1-specific acceptance criteria (§3) with verbatim evidence.

### 1.2 — Out-of-scope (explicitly Goal 004 future scope)

- Wave 2 mapping authoring + execution
- Wave 3 mapping authoring + execution
- Wave 4 mapping authoring + execution
- CP1 mapping-discovery helper script (relevant only for Wave 2/3/4 scale)
- CP3 generalized `run-wave-fullscale.mjs <wave>` runner (relevant only for Wave 2/3/4)
- CP4 `--all-waves` runner flag
- CP5 REPORT per-wave structure (REPORT 003 covers only Wave 1)
- Migrations 000034/35/36 (Wave 2/3/4 staging tables)
- 188 new column_mappings rows for Wave 2/3/4
- 9 advisories from PROMPT v1 PLAN §2.10: A1/A2/A4 pre-decided in §4 below; A3/A5/A6/A7/A8/A9 deferred to Goal 004 (Wave 2/3/4 specific)

### 1.3 — Wave 1 misclassified targets (NEW v3 — explicit Goal 004 prerequisite scope)

The following 3 sys.* tables WERE classified as Wave 1 targets in DISCOVERY 003 but EXEC evidence (Class B sub-discovery) shows they are Wave-2-prerequisite-dependent. They are documented here as Goal 004 work:

| Misclassified target | Blocked by | Goal 004 prerequisite |
|---|---|---|
| sys_blueprint_process_registry | sys_blueprint_variants (1 seed row, NOT in any wave) + missing source `variant_id` column in business_processes | Define sys_blueprint_variants seed taxonomy (tenant-specific or RTL_BANK_REFERENCE-anchored) + author column_mapping with heuristic source-resolution |
| sys_job_roles | sys_job_families (0 rows, NOT in any wave) + missing source `family_id` column in onet_occupations | Seed sys_job_families with ISCO-08 (or equivalent UN-standard taxonomy) + author column_mapping with code-prefix heuristic |
| sys_esco_occupation_mappings | cascade dep on sys_job_roles (above) + missing source `job_role_id` column in onet_esco_mappings | Resolved after sys_job_roles above; mapping via ESCO occupation→job_role bridge in Goal 004 |

In the Wave 1 retry, these 3 targets remain empty. CLI MUST emit audit rows with `rule_code='CASCADE_PREREQUISITE_MISSING_GOAL_004'` (or equivalent class) documenting the staged-but-blocked rows per target. REPORT 003 §"Wave 1 scope correction" enumerates them with full evidence.

### 1.4 — Wave 1 closure-blocking registry gap INSERTs (NEW v3)

Authorized as part of v3 amendment per A1 ABSOLUTE re-interpretation ("no UPDATE/DELETE of existing wave=1 rows; new INSERTs for closure-blocking registry gaps legitimate when validated by `validate_lookup_fk_payload` trigger"):

| Target | source_column | LOOKUP_FK payload | Pre-INSERT semantic verify |
|---|---|---|---|
| sys_skill_categories.skill_category_family_id | competencies.framework_id | `{target_table:'sys_skill_families', match_on:'skill_family_metadata->>legacy_id'}` | sys_skill_families has 77 rows, lineage table has 77 source_record_id entries — proceed |
| sys_learning_path_steps.learning_path_step_path_id | learning_path_courses.learning_path_id | `{target_table:'sys_learning_paths', match_on:'learning_path_metadata->>legacy_id'}` | sys_learning_paths has 3227 rows, lineage table has corresponding entries — proceed |
| sys_learning_path_steps.learning_path_step_module_id | learning_path_courses.course_id | `{target_table:'sys_learning_modules', match_on:'learning_module_metadata->>legacy_id'}` | SEMANTIC VERIFY REQUIRED: are legacy course_id values in lineage table with target_table='sys_learning_modules'? IF YES → proceed; IF NO → halt+escalate for course/module semantic alignment decision |

Pre-INSERT trigger validation MUST pass for all 3. If any reject → halt+escalate inbox `exec_classB_validation_fail` with payload + trigger message.

---

## §2 — Volume targets for Goal 003 closure

Per `WAVE_1_EXECUTION_RUNBOOK §3.4` adapted for current state:

- Every Wave 1 APPROVED mapping produces ≥1 lineage row OR documented "source empty"
- All 15 Wave 1 target sys.* tables: ≥1 row OR documented "source empty"
- `audit.import_validation_results.skip_reason='no_conflict_inference_available'` count = 0
- `audit.import_validation_results.rule_code='SKIPPED_UNSUPPORTED_TRANSFORM_V1'` count = 0
- `brownfield.import_runs.import_run_status='COMPLETE'` for the Wave 1 full-scale run
- Wall-clock ≤ 10 min for Wave 1 full-scale (consistent with Goal 002 R3 mitigation)

This is the operational definition of "Wave 1 closure FULL" for Goal 003 acceptance.

---

## §3 — Acceptance criteria (13 Wave-1-specific + 1 forward-investment)

Restated from PROMPT v1 §2.6 — Wave 1 subset + new C13 for P7:

- **C1** (was A1-W1): `pnpm --filter @heuresys/api test` exits 0; ≥ 276 + new tests passing.
- **C2** (was A2-W1): `transform-compiler.test.ts`: NEW tests for `legacy_<X>_id` jsonb convention including ≥ 5 adversarial path/payload fixtures.
- **C3** (was A3-W1): `transform-compiler.test.ts`: NEW tests for `CAST_*` auto-wrap completeness.
- **C4** (REVISED v3): Wave 1 full-scale re-run: every APPROVED mapping **with feasible cascade prerequisites** has ≥ 1 successful upsert OR documented `source_empty_in_legacy_mirror` exception in audit OR documented `CASCADE_PREREQUISITE_MISSING_GOAL_004` exception in audit (applies to the 3 misclassified targets: sys_blueprint_process_registry, sys_job_roles, sys_esco_occupation_mappings — see §1.3).
- **C5** (REVISED v3): ≥ 12 of 15 Wave 1 target sys.* tables have ≥ 1 row OR documented source-empty. The 3 misclassified targets are explicitly Goal 004 prerequisite-dependent and documented (not counted toward closure failure).
- **C6** (was A6-W1): `sys_activity_classifications`: 0 CHECK violations post-migration-000032 (Path C.1 per pre-decision in §4).
- **C7** (was A7-W1): 0 `SKIPPED_UNSUPPORTED_TRANSFORM_V1` audit rows for the Wave 1 full-scale run.
- **C8** (NEW from P7): `brownfield.column_mappings` INSERT trigger `validate_lookup_fk_payload` exists; attempting to INSERT a malformed LOOKUP_FK payload raises a DB-level error (test: synthetic INSERT with invalid `match_on` rejected).
- **C9** (was A24): 0 `audit.import_validation_results.skip_reason='no_conflict_inference_available'` for the Wave 1 run.
- **C10**: `pnpm --filter @heuresys/api typecheck` PASS, `pnpm --filter @heuresys/api lint` 0 errors.
- **C11**: `brownfield.tenant_id_mappings` table exists with ≥ 1 row (RTL_BANK_REFERENCE).
- **C12** (was A27): ≥ 8 atomic commits attributable to Goal 003.
- **C13** (was A28): REPORT 003 has verbatim evidence for C1–C12 with SHA-anchored timestamps.
- **C14** (NEW from P6, ex-CP6): 681 pre-existing NULL lineage rows: documented in `audit.import_validation_results` with `rule_code='LEGACY_NULL_LINEAGE_DOCUMENTED_V1'` or equivalent + comment in `_03_EXEC_003_*.md`.

14 acceptance criteria. All must pass. G11 cross-check matrix (PLAN §2.11) updated bidirectionally to map every Item to ≥1 criterion AND vice versa.

---

## §4 — Pre-decided architectural advisories (from PLAN v1 §2.10)

The supervisor pre-resolves these to unblock PLAN v2 authoring. CLI does not need to surface them again unless evidence at EXEC time contradicts the decision.

- **A1 (wave=1 column_mappings UPDATE)**: prohibition is **ABSOLUTE** for `table_mappings` AND `column_mappings`. Item B uses compiler-side auto-wrap detection (executor's default in v1 PLAN). No DB UPDATE on existing wave=1 rows.
- **A2 (sys_activity_classifications CHECK)**: **Path C.1 ACCEPTED** — relax via migration 000032 with comment documenting the demo-data rationale.
- **A4 (681 orphan lineage rows)**: **Path K.1 ACCEPTED** — leave NULL `source_lineage_import_run_id`; document via `audit.import_validation_results` `LEGACY_NULL_LINEAGE_DOCUMENTED_V1` rows (covered by C14).
- **A3, A5, A6, A7, A8, A9**: DEFERRED to Goal 004 (Wave 2/3/4 specific; not applicable to Goal 003 v2 scope).

---

## §5 — Accepted counter-proposals (from PLAN v1 §2.12)

- **CP2 (SQL trigger DB-level for U-cross-check)**: **ACCEPTED**. Goal 003 P7 Item M (NEW). Migration 000033 or piggyback includes function + trigger. Closes the U-loophole permanently for Wave 1+ all future waves.
- **CP6 (Item K Goal-002-hygiene moved to EXEC step 0)**: **ACCEPTED**. P6 work happens BEFORE Wave 1 retry, not after. Saves zero net turns but improves audit hygiene.
- **CP7 (REPORT + STATE finalize in single commit)**: **ACCEPTED** (matches Goal 002 pattern).
- **CP1, CP3, CP4, CP5**: **DEFERRED to Goal 004** (Wave 2/3/4 relevant).

---

## §6 — Constraints (unchanged from v1 §4 + narrowed to Wave 1)

### Code change boundaries
May modify:
- `apps/api/src/modules/brownfield-wave-executor/**`
- `apps/api/test/**`
- `scripts/run-wave1-fullscale.mjs` (keep Wave 1 focused; do NOT generalize in Goal 003 — generalization is CP3 → Goal 004)
- NEW: `db/migrations/000032_sys_activity_classifications_check_relax.sql`
- NEW: `db/migrations/000033_brownfield_tenant_id_mappings_and_validate_lookup_fk.sql` (includes both P4 table + P7 trigger; one migration for both)

May NOT modify:
- migrations 000001-000031
- legacy_mirror schema
- apps/web/**
- Any source for Wave 2/3/4 mapping registry (out-of-scope per §1.2)

### DB write boundaries
- All writes allowed within `heuresys_advanced` DB except wave=1 `brownfield.table_mappings`/`column_mappings` UPDATE/DELETE (A1 ABSOLUTE)
- New writes: migration 000032 + 000033 + Wave 1 retry sys.* upserts + audit rows
- NO writes to Wave 2/3/4 staging tables (out-of-scope)

### Test boundaries
- `pnpm test` ≥ 276 + new tests for P1/P2/P7 (estimated +12-15 tests)
- Adversarial fixtures for new LOOKUP_FK jsonb convention
- Idempotency test re-run post-fix (existing wave1-idempotency.test.ts)

### Operational boundaries
- Backup gate: fresh pg_dump pre-Goal-003 at EXEC step 0 (replace pre-Goal-002 dump from 2026-05-18T22:33Z, now > 18h old)
- Turn budget: **40 turns**, escalation at turn **35** if Wave 1 retry not entering final verification
- Git push at the end of EXEC (per CP7); no per-commit push

---

## §7 — Required structure of `_02_PLAN_003_*.md` v2

Reuse v1 structure (§-1 / §0 / §1 / §2.1 / §2.2 / §2.3 / §2.4 / §2.5 / §2.6 / §2.7 / §2.8 / §2.9 / §2.10 / §2.11 / §2.12 / §2.13).

Key differences vs v1:

- §0: executive summary narrowed to Wave 1 closure
- §2.2: 8 Items (A=P1, B=P2, C=P3, D=P4, M=P7, K=P6, F=P5 Wave-1 retry, L=P8 REPORT) — order: K (EXEC step 0) → A → B → C → D → M → F → L
- §2.6: 14 criteria C1-C14 per §3 above
- §2.7: budget 40 cap, escalation 35, honest estimate ≤ 32 turns with buffer 5-8
- §2.10: minimal — most advisories pre-decided in §4 above
- §2.12: 1 NEW counter-proposal slot for executor strategic input (if any) — most CPs already accepted or deferred
- §2.11: G11 matrix updated for 8 Items × 14 criteria bidirectional
- §2.13: revision history includes v1 → v2 transition (notes 4 advisories pre-decided + 3 CPs accepted + 4 CPs deferred + 6 Items removed)

---

## §8 — Hard guard-rails for THIS PROMPT turn (PLAN v2 production)

1. NO code changes (PLAN markdown only)
2. NO DB writes
3. NO test execution
4. NO git operations except `git mv _02_PLAN_003_brownfield-seeding-complete.md _02_PLAN_003_v1.md` to archive your v1 (per protocol v2.2 PLAN versioning convention)
5. After producing v2 PLAN: compute sha256, update `_00_STATE_003.md` (`plan_version: v2`, `plan_sha256: <new>`, `next_actor: Cowork`), emit `plan_ready` in cowork inbox via `pnpm cowork:notify cowork plan_ready --goal 003 --ref <PLAN v2 path>`.
6. Honest budget summary in chat (5-10 lines): confirm 40-turn cap fits honestly with buffer ≥ 5; if not, escalate to chat for budget debate BEFORE submitting v2 PLAN.

---

## §9 — Goal 004 placeholder (for context, NOT scope)

Goal 004 (future, post-Goal-003 closure) will cover Wave 2 + Wave 3 + Wave 4 + Wave 1 misclassified residue (§1.3):

**Wave 2/3/4 work** (unchanged from v2):
- CP1 mapping-discovery helper script as Item 1
- ~188 new column_mappings authoring (validated by CP2 SQL trigger now shipped in Goal 003)
- Migrations 000034/35/36
- 3 wave executions with per-wave halt-gates (A3 thresholds from PLAN v1)
- Per-wave acceptance criteria (subset of PROMPT v1 §2.6 A8-A23)

**Wave 1 misclassified residue work (NEW v3)** — 3 targets from §1.3 require Goal 004 foundational seeding:
- Migration 000034a (new sub-item): seed `sys_job_families` with ISCO-08 (or equivalent UN-standard) taxonomy. Decision Goal 004 DISCOVERY: source-of-truth (legacy mirror has ISCO data? OR external import?)
- Migration 000034b: seed `sys_blueprint_variants` with RTL_BANK_REFERENCE-anchored variant set (decision: 1 default variant cross-tenant OR per-tenant variants? Goal 004 DISCOVERY).
- Column_mappings INSERTs for sys_blueprint_process_registry / sys_job_roles / sys_esco_occupation_mappings with heuristic source-resolution rules (code-prefix or ESCO bridge).
- Wave 1 (or designated retry wave) re-execution to close the 3 misclassified targets.

**CW-B18 bias mitigation mandatory in Goal 004 DISCOVERY**:
- DISCOVERY must include registry completeness check: for EACH wave-N target, enumerate NOT NULL FK columns via pg_constraint; LEFT JOIN brownfield.column_mappings; ZERO unmatched FK columns OR documented source-empty justification.

Goal 004 turn budget will be sized AFTER Goal 003 closes and Wave 1 retry telemetry is available (so the per-wave wall-clock estimates are evidence-based, not extrapolation). Estimated 55-75 turns (v3 increment: +5 for Wave 1 residue work above).

Goal 004 is NOT part of Goal 003's responsibility. CLI does NOT need to design for Goal 004 in PLAN v2; this section is informational.

---

*End of _01_PROMPT_003_brownfield-seeding-complete.md v3*
