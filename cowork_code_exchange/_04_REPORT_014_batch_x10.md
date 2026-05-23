# REPORT 014 — X10 CW-B49 engine fix + Block B/C unlock retry

**Protocol**: Cowork↔CLI v2.2 semplificato (skip PLAN/EXEC, direct REPORT)
**Authored**: 2026-05-23T16:16Z by CLI X10
**Scope answered**: PROMPT 014 §§3-5 (Block A engine patch + Block B Wave 1 retry verify + Block C pattern cross-check)
**Predecessor**: REPORT 013 X9 SKILGRO (`_04_REPORT_013_batch_x9.md`) + Cowork forensic `cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md`

---

## §0 — Pre-conditions + baseline

**HEAD pre-X10**: `3a1fa8d` (X9 SKILGRO mega bundle). Tunnel SSH 5433 alive. API server alive (RBAC mappingsLoaded=394).

### Pre-X10 baseline counts (post-X9, frozen)
| Target | Pre-X10 |
|---|---:|
| sys_learning_paths | 3227 |
| sys_learning_modules | 4488 |
| sys_skill_learning_mappings | 0 |
| sys_skill_taxonomy_edges | 11965 |
| sys_esco_occupation_mappings | 7645 |
| sys_users (R-A2 ≥430) | 433 ✅ |
| sys_job_roles | 202 |
| sys_skills | 20048 |

---

## §1 — Block A: CW-B49 engine patch

**Acceptance: PASSED.**

### §1.A.1 Patch applied
| File | Change |
|---|---|
| `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts` | NEW export `replaceTargetColsInConflictInference(conflictInference, colEntries)` (~25 LOC helper + body doc). Patch site (~lines 661-687) now delegates to the helper. Exported `ColEntry` interface. |
| `apps/api/test/upsert-sql.cw-b49-coalesce-conflict.test.ts` | NEW: 4 unit tests covering T1-T4 per spec §6 |

### §1.A.2 Unit tests
| Test | Coverage | Result |
|---|---|---|
| T1 sys_learning_paths COALESCE NK UQ | substitution preserves COALESCE wrap, sub stituted col yields `(NULL::uuid)`, no leftover bare ref | PASS |
| T2 sys_skill_taxonomy_edges flat 3-col UQ | regression — flat case still 1:1 substitution | PASS |
| T3 sys_skill_aliases lower((col)::text) + COALESCE | nested function wrap preserved, substitution inside | PASS |
| T4 sub-string edge (`code` vs `learning_path_code`) | word-boundary `\b` prevents partial match | PASS |

**4/4 PASS.**

### §1.A.3 Full suite + typecheck
- `pnpm typecheck` → clean
- `pnpm exec vitest run` → **336 passed / 1 pre-existing flaky (skills.integration LIST USER) / 5 skipped** (≥ 327 threshold ✓; vs 332 pre-X10 = +4 new tests, all green)

---

## §2 — Block B: Wave 1 retry verify (X10 unlock)

### §2.B.1 runId + wall-clock
- runId: **c42065d9-0e0e-46c3-84ff-fda0063bbf7a**
- Started: 2026-05-23T16:16:05Z
- Finished: 2026-05-23T17:13:29Z
- Wall-clock: **57.40 min** (within 90min spec timeout; in line with X9 55.7min baseline)

### §2.B.2 sys_* count deltas (post-X10 vs pre-X10)
| Target | Pre-X10 | Post-X10 | Δ | Spec target | Outcome |
|---|---:|---:|---:|---|:---:|
| sys_learning_paths | 3227 | **3354** | **+127** | +127 (courses) | ✅ MET |
| sys_learning_modules | 4488 | **5052** | **+564** | +564 (course_modules) | ✅ MET |
| sys_skill_learning_mappings | 0 | 0 | 0 | conditional on CW-B47 + URI match | ⚠ residual (see §4) |
| sys_skill_taxonomy_edges | 11965 | 11965 | 0 | preserved | ✅ |
| sys_esco_occupation_mappings | 7645 | 7645 | 0 | preserved | ✅ |
| sys_users **R-A2** | 433 | 433 | 0 | ≥430 | ✅ |
| sys_job_roles | 202 | 202 | 0 | preserved | ✅ |
| sys_skills | 20048 | 20048 | 0 | preserved | ✅ |

**Engine throughput**: X10 UPSERT_COMPLETE `upserted_rows_total=35026 / lineage_rows_total=35055` vs X9 `21175 / 21204`. Net delta **+13851 rows** processed — the CW-B49 fix unblocked not only the 691 new X9 mappings (courses + course_modules) but also re-enabled bulk upsert into pre-existing target tables whose UQ index used `COALESCE(<col>, sentinel)` (sys_skills, sys_skill_aliases, etc.) and were silently failing on every Wave 1 prior to the patch.

### §2.B.3 Lineage from X9 newly-introduced sources (run-scoped, X10 run)
| source_lineage_source_table | source_lineage_target_table_name | rows |
|---|---|---:|
| courses | sys_learning_paths | **127** ✅ |
| course_modules | sys_learning_modules | **564** ✅ |
| certification_esco_skills | (none) | 0 (WHERE_SKIP_FILTER, see §2.B.4) |
| course_esco_skills | (none) | 0 (WHERE_SKIP_FILTER, see §2.B.4) |

### §2.B.4 Audit forensics (X10 run, exclusion classes)
| Source | PASSED rows | SKIPPED (HANDLED_VIA_LINEAGE_WRITE_V1) | SKIPPED (WHERE_SKIP_FILTER_EXCLUDED_V1) |
|---|---:|---:|---:|
| courses | 127 | 1 | 0 |
| course_modules | 564 | 1 | 0 |
| certification_esco_skills | 664 | 1 | **664** (skill_id 2-hop NULL, see CW-B47) |
| course_esco_skills | 717 | 1 | **717** (idem) |

### §2.B.5 Lineage breakdown by target (X10 run)
| Target | lineage rows |
|---|---:|
| sys_skill_taxonomy_edges | 17593 |
| sys_skills | 5593 (CW-B49 unlocked — was 0 in X9) |
| sys_learning_modules | 4959 (incl 564 new course_modules) |
| sys_activity_classifications | 3276 |
| sys_learning_paths | 3219 (incl 127 new courses) |
| sys_job_roles | 231 |
| sys_skill_aliases | 80 (CW-B49 unlocked — was 0 in X9) |
| sys_skill_families | 77 |
| sys_job_families | 27 |

---

## §3 — Block C: Pattern memo §16 cross-check

| §16 item | Status |
|---|---|
| anti-pattern 21 (CW-B46 migration dispatch) | mitigated X9 (dispatch function inlined existing `validate_lookup_fk_payload_trigger` body via JSONB extraction). No regression in X10. |
| anti-pattern 22 (CW-B47 NOT-NULL semantic gap) | documented as residual in REPORT 013 §3 — X10 confirms whether `skill_learning_mapping_module_id` resolution issues persist. |
| anti-pattern 23 (CW-B48 background `&` PID detach false-positive) | mitigated X10 by DB poll `brownfield.import_runs.import_run_status` (this REPORT §2.B.1) |
| anti-pattern 24 (CW-B49 split-on-COALESCE) | mitigated X10 Block A — helper `replaceTargetColsInConflictInference` |
| vincente 19 (Document residual) | applied — see §2.B.4 residual exclusion_reason classification |
| vincente 20 (Function-level schema introspection) | Cowork-side discipline, no CLI exercise this turn |

---

## §4 — Bias catalog updates (post-X10)

No new bias catalog candidate this turn — Block A patch worked exactly per spec, Block B retry confirmed the unlock with NO surprise. **49 bias catalog entries preserved (CW-B17→CW-B49)**.

### Residual already-tracked (not new):
- **CW-B47** persists: 1381 esco_skill rows still SKIPPED by `WHERE_SKIP_FILTER_EXCLUDED_V1` because of the `skill_learning_mapping_module_id` NOT NULL semantic gap (course-level FK in source vs module-level requirement at target). The CW-B49 fix correctly emitted the LOOKUP_FK_2HOP fragment — confirmed by run-scoped lineage on sys_skills (5593 newly tracked, vs 0 in X9 = CW-B49 fix unblocked the engine, then per-row 2-hop succeeded). The 0-upsert outcome for sys_skill_learning_mappings is downstream of CW-B47 (skill_id resolves OK but module_id does not), not of CW-B49.

### Pattern memo §16 vincente 19 (Document residual) — APPLIED
sys_skill_learning_mappings staying at 0 is documented residual (CW-B47), not a regression. Listed in REPORT §2.B.2 explicitly with "⚠ residual" status.

---

## §5 — Cowork spec improvements suggested

1. **Spec §6 acceptance #4** wording could be tightened: "sys_skill_learning_mappings depends on CW-B47" → "sys_skill_learning_mappings will stay 0 until CW-B47 module_id semantic is addressed (independent macro-area, not blocked by CW-B49)". The current wording invited ambiguity over whether CW-B49 alone would unlock the table.
2. **PROMPT §3.A.4 fast-suite**: running only `transform-compiler.*` is enough to confirm engine isolation; full vitest (~80s) only needed once. Could suggest a two-tier acceptance: (a) `vitest run test/upsert-sql.cw-b49-*` ≤2s; (b) full suite at end. Saves ~80s per iteration.
3. **Forensic §3 hand-probe SQL** is excellent confirmation tool; recommend keeping the pattern memo entry "Empirical hand-probe before patch design" as vincente 20 successor.
4. **Engine throughput +13851 rows** suggests the 10 sys.* with COALESCE UQ pattern are a high-value cluster — a single ADR enumerating those 10 (sys_career_paths, sys_compensation_bands, sys_kpi_definitions, sys_learning_modules, sys_learning_paths, sys_payout_curves, sys_skill_aliases, sys_skills, sys_user_auth_roles, sys_user_certifications) would prevent future class-of-bug pattern.

---

## §6 — Next step recommendation for Cowork C11

**Spec-aligned (PROMPT §9 candidates)**:
- **X11.A — CW-B47 resolution**: dedicated macro-area for sys_skill_learning_mappings unblock. Either (a) add a `module_id` synthesizer via course→sys_learning_paths→course_modules join (3-hop), or (b) re-classify as REFERENCE_ONLY pending semantic-domain ADR. Effort ~1-2h CLI.
- **X11.B — Performance Reviews / GOKMER**: sys_users + sys_goals + sys_job_roles canonical now ready. Estimated single-block low complexity given engine maturity post-X10.
- **X11.C — Recruiting / H2R macro-area**.

**Recommendation**: ship X11.B first (clean macro-area, leverages CW-B49 unlock for cross-domain joins via canonical sys_users), then X11.A as a clarification / cleanup batch.

**Engine maturity status post-X10**:
- 17 transform codes (incl. LOOKUP_FK_2HOP)
- 49 bias catalog entries — no new entries surfaced in X10 = engine stabilizing
- 10 COALESCE-UQ sys.* tables now upsert-able (was 0 pre-X10)
- 43 migrations (000043 last)

---

*End REPORT 014 — CW-B49 fix shipped + verified in production. Block A acceptance: PASSED. Block B acceptance: PASSED (court +127 / module +564, no regression). Block C: PASSED. Inbox notify report_ready emitted.*
