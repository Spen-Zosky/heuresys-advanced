---
goal_id: 004
batch: X1
slug: cw_b17_patch_class_b_bundle_wave1_retry
review_authored: 2026-05-26T01:15:00+02:00
review_author: Cowork (Claude Opus 4.7) — retroactive formal closure
review_type: FORMAL_BATCH_REVIEW
report_reviewed: _04_REPORT_004_batch_x1.md
report_ts: 2026-05-20T22:14:12Z
verdict: ACCEPTED
acceptance_qualifier: BATCH X1 SUCCESS — CW-B17 patch shipped, MIRROR GAP esco_skills landed (sys_skills 6037→20048), sys_job_families bootstrap (0→27), Wave 1 retry COMPLETED 55.4min, 35640 silent-skip rows now audited
exec_window: "2026-05-20T19:55Z → 2026-05-20T21:25Z (~1h30m wall-clock)"
commits_shipped: 2 (1443b54 CW-B17 + 56f3b03 X1 bundle)
push_status: SUCCESS — origin/main range 56a439e..56f3b03
spec_deviations_noted: 9 (catalogued in REPORT §2.5 + acknowledged below §3)
new_bias_candidates: [CW-B22, CW-B23, CW-B24]
followup_batch: X2 (Block A engine deep-fix CW-B22/23/24 + Block B cascade fixes + Block C SDBI Goals/OKRs pilot)
---

# REVIEW 004 — Batch X1 Block A + Class B fixes + Wave 1 retry

> **REVIEW retro-attiva**: prodotta il 2026-05-26 per chiudere il REPORT 004 (CLI emesso 2026-05-20T22:14Z) che era rimasto in `.inbox/cowork/pending/` per ~6 giorni. Il lavoro Cowork si è di fatto evoluto nel batch X2 (REPORT 005) e successivi (X3-X20) senza closure formale del review X1 — questa REVIEW riporta evidenza già consumata operativamente e formalizza la chain protocollare.

---

## §1 — Verdict

**ACCEPTED** con qualifier `BATCH X1 SUCCESS`.

Razionali:

1. **CW-B17 forensic blind spot CLOSED** ✅ — Il commit `1443b54` ha shipped `audit-rule-codes.ts` (24 LOC) + patch `upsert-sql.ts` (91 LOC insertion). Wave 1 retry emette **35640 audit rows `WHERE_SKIP_FILTER_EXCLUDED_V1`** + 66997 `WAVE1_ALL_RULES_PASSED` + 82 `HANDLED_VIA_LINEAGE_WRITE_V1`. Pattern di exclusion distribution (top 11) rivela esattamente i blocker cascade che PROMPT 005/006 hanno potuto poi prioritizzare con evidence quantitativa.

2. **Class B bundle 3/4 COMPLETED** ✅ — sys_job_families bootstrap (0→27), skill_adjacencies MIRROR GAP (11634 rows landed), sys_skill_aliases cascade (0→80 partial 62%). sys_learning_path_steps DEFERRED a X2 per spec recommendation. **18ª staging table** (`wave1_job_families`) aggiunta via migration 000034.

3. **MIRROR GAP esco_skills landed** ✅ — sys_skills 6037→**20048** (+14011 rows). Conferma che la pipeline post-CW-B17 audit è capace di processare volumi significativi quando i prerequisiti cascade sono soddisfatti.

4. **Wave 1 retry COMPLETED clean** ✅ — runId `505f425f-c277-4195-95b9-e2433abda198`, wall-clock 3325s (55.4min), status COMPLETED, finished_at 2026-05-20T21:11:20Z. Lineage rows 17771 across 19 source tables (+1038 vs baseline 16733).

5. **Mid-run interventions handled professionally** ✅ — Il PG query stuck 17min su `wave1_activity_classifications` staging mark è stato risolto via `pg_cancel_backend(2686101)` + `ANALYZE` senza halt+escalate. Il server engine ha try/catch per mapping → flow continued. Decisione corretta: non era un §7 trigger (cancel + ANALYZE è operazione di recovery, non halt). Lezione catturata in nuovi bias CW-B22/B23.

6. **Spec deviations gestite con evidence** ✅ — 9 spec improvements suggeriti in REPORT §2.5, tutti con razionali tecnici chiari e proposte concrete per C2/X2. La deviazione critica (CW-B17 patch insertion point at line 476 invece di ~427 per evitare TDZ su `qStagingTable`) è funzionalmente equivalente all'intent della spec.

---

## §2 — Acceptance criteria (PROMPT 004 §5.4)

| Criterion | Status | Evidence |
|---|---|---|
| CW-B17 audit rows emitted (non-zero) | ✅ PASS | 35640 `WHERE_SKIP_FILTER_EXCLUDED_V1` rows |
| sys_job_families bootstrap (legacy_mirror.job_families count matches platform 27) | ✅ PASS | 27 / 27 |
| sys_job_families brownfield registry rows inserted | ✅ PASS | 1 source_table + 10 source_columns + 1 table_mapping + 10 column_mappings (idempotent) |
| staging.wave1_job_families created | ✅ PASS | migration 000034 applied |
| extract-wave1-legacy.sh OPOURSKA list extended | ✅ PASS | job_families added |
| repository.ts whitelist + truncateAllWave1Staging extended to 18 tables | ✅ PASS | live verified |
| skill_adjacencies MIRROR GAP landed | ✅ PASS | legacy_mirror count 11634 matches platform |
| Wave 1 retry status COMPLETED | ✅ PASS | runId `505f425f-...`, wall-clock 55.4min < 90min HARD halt threshold |
| sys.* hit ratio improved | ✅ PASS | sys_skills 6037→20048, sys_job_families 0→27, sys_skill_aliases 0→80 (partial) |
| typecheck PASS | ✅ PASS | 0 errors |
| tests = baseline (no new regressions) | ✅ PASS | 318/324 with same 1 pre-existing fail (skills.integration.test.ts:131) |
| Final push to origin/main | ✅ PASS | 56a439e..56f3b03 |

**12/12 criteri PASS.** Nessuna FAIL, nessuna scope reduction.

---

## §3 — Spec deviations acknowledged (REPORT §2.5)

I 9 spec improvements suggeriti dal CLI sono **ACCETTATI come legittimi** e raccomandati per integrazione in PROMPT 005/006:

1. ✅ **CW-B17 patch insertion point at line 476**: corretto (TDZ avoidance). Spec aggiornata in `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` post-X1.

2. ✅ **`mapping.source_table_id` già disponibile**: spec semplificata per X2.

3. ⚠️ **Hardcoded rule_code string vs import const**: lasciato as-is per X1 (no runtime difference). Flag per stylistic refactor in C3 (non urgente).

4. ✅ **`source_column_table_id` vs `source_column_source_table_id` typo**: spec corretta.

5. ✅ **5th MIRROR GAP discovery proactive audit**: raccomandato per X2 pre-flight. Implementato come `audit-mirror-gap-vs-platform.sql` in `db/scripts/` (cfr. batch X2 deliverables).

6. ✅ **`ANALYZE staging.wave1_<target>` post-staging**: integrato in CW-B23 patch (X2 batch).

7. ✅ **`IS NOT DISTINCT FROM` JOIN-back replacement con `=` + explicit NULL guards**: integrato in CW-B22 patch (X2 batch). 16x speedup confirmed (Wave 1 X2 PHASE A: 3.4 min vs X1 55.4 min).

8. ✅ **Wave executor expose runId in initial response**: noted come C2 enabler.

9. ✅ **`notify.mjs` exec_completed kind not valid**: usato `report_ready` workaround. Spec aggiornata per X2.

---

## §4 — Nuovi bias candidate (CW-B22/23/24) — APPROVED e mitigated in X2

| Bias | Titolo | Surfaced | Mitigation |
|---|---|---|---|
| **CW-B22** | Predicate vs Index Mismatch (`IS NOT DISTINCT FROM` on indexed columns degrades to nested-loop) | Goal 004 X1 Wave 1 retry stuck 17min on activity_classifications | ✅ X2 commit `ad01894` (`buildNkJoinPredicate` helper + sentinel UUID survey) |
| **CW-B23** | Stale Statistics Post-Mass-INSERT (planner makes poor choices when pg_class.reltuples is far from reality) | Same Goal 004 X1 17min stall | ✅ X2 commit `f3e738e` (`analyzeWave1Staging` in engine.ts) |
| **CW-B24** | Lineage Insert Self-Conflict (ON CONFLICT DO UPDATE cannot affect row a second time) | Pre-existing, surfaced more visibly in X1 due to MIRROR GAP fix volume | ✅ X2 commit `431a07b` (DISTINCT ON dedup 3-CTE) |

Tutti i 3 bias **catalogati ufficialmente** in `bias_registry.md` (CW-B22 mitigated, CW-B23 mitigated, CW-B24 mitigated X2).

---

## §5 — Class B target progress (post-X1 baseline per X2)

Risultati cumulati post-X1 (baseline per X2 cascade fixes):

| Target | Pre-X1 | Post-X1 | Δ | Blocker residuo |
|---|---|---|---|---|
| sys_job_families | 0 | **27** | +27 | ✅ ACCEPTANCE MET |
| sys_skill_aliases | 0 | **80** | +80 | ⚠️ PARTIAL (62%); residual `nk_missing_skill_alias_skill_id` |
| sys_skills | 6037 | **20048** | +14011 | ✅ esco_skills MIRROR GAP landed |
| sys_job_roles | 0 | 0 | 0 | ❌ `required_missing_job_role_family_id` (231 staged); X2 cascade fix needed |
| sys_esco_occupation_mappings | 0 | 0 | 0 | ❌ `nk_missing_*_job_role_id` (7645 staged); depends on sys_job_roles |
| sys_skill_taxonomy_edges | 0 | 0 | 0 | ❌ `nk_missing_*_parent_id` (17924 staged) |
| sys_skill_categories | 0 | 0 | 0 | ❌ `required_missing_*_family_id` (7256 staged) |
| sys_learning_modules | 4488 | 4488 | 0 | unchanged (pre-existing skip courses violates kind_check) |
| sys_learning_paths | 3227 | 3227 | 0 | unchanged |
| sys_activity_classifications | 3276 | 3276 | 0 | unchanged (pre-existing skip industry_profiles violates scheme_check) |
| sys_skill_families | 77 | 77 | 0 | unchanged |

Top 11 exclusion reasons (35640 silent-skip rows surfaced) prioritizzano correttamente X2/X3 target.

---

## §6 — Cowork operational feedback

REPORT §6 ha dato 4 punti di feedback sul modello Cowork↔CLI. Tutti **ACKNOWLEDGED**:

✅ **Self-contained briefing format**: 720 righe sembravano tante ma navigabile. Conferma il pattern PROMPT post-CW-B52 per batch successivi.

✅ **§7 halt triggers explicit + format template**: ha evitato halt erroneo durante mid-run intervention. Pattern memo confermato per X2+.

✅ **Trust + critique balance §0**: framing corretto. 9 spec improvements emersi senza paura. Da riprodurre in tutti i PROMPT post-X1.

✅ **Decision locked §4**: zero ambiguità. Pattern essenziale per PROMPT batch.

Modifiche operative per X2:
- §3 pre-flight esteso con "pnpm dev background started" + "migrations 000031-000033 applied"
- §5.5 commit instruction esplicita "single commit OR bundle commit + isolated patch commit"
- Nuovo §3.5 "MIRROR GAP audit proactive" (single SQL query all legacy_mirror vs heuresys_platform.public)

---

## §7 — Follow-up batch X2 readiness

REPORT §4 raccomandazioni per Cowork batch C2/X2:

**P0 critical** (tutti executed in X2):
1. ✅ CW-B22 mitigation (engine patch) — X2 commit `ad01894`
2. ✅ CW-B23 mitigation (ANALYZE staging) — X2 commit `f3e738e`
3. ✅ CW-B24 mitigation (lineage dedup) — X2 commit `431a07b`

**P1 unblocks more cascade** (Block B partial in X2):
4. ⚠️ sys_job_roles cascade fix — X2 PARTIAL (semantic FK phantom CW-B26 emersa, → X3 ADR-0015 risolve)
5. ⏭️ sys_esco_occupation_mappings — deferred X6.A (risolto via ADR-0016)
6. ⏭️ sys_skill_categories — deferred X7 (parziale, residual CW-B60-A)
7. ⏭️ sys_skill_taxonomy_edges — deferred X9 SKILGRO mega-bundle

**P2 quality**:
8. ⏭️ Goals/OKRs SDBI pilot — shipped X2 Block C (5939 rows × 10 sys.* tables, E2E success)
9. ⏭️ sys_source_lineage_records integrity — X3
10. ⏭️ Tests CW-B17 audit emission unit tests — DEFERRED (still pending, low priority)

---

## §8 — Final verdict

**Batch X1 — ACCEPTED**

- 12/12 acceptance criteria PASS
- 2 commits shipped + pushed
- 3 bias candidates catalogati (CW-B22/23/24) → mitigated in X2
- 9 spec improvements proposti → 8/9 integrati nei PROMPT successivi
- CW-B17 forensic blind spot definitivamente CHIUSO
- MIRROR GAP esco_skills landed (sys_skills +14011)
- sys_job_families bootstrap completato (0→27)
- Wave 1 retry COMPLETED 55.4min (sotto soglia 90min)

**Cowork: lock batch X1 → CLOSED status; handoff to X2 already consumed (REPORT 005 = REVIEW input).**

---

*End REVIEW 004 — batch X1 formal closure complete.*
*Authored: 2026-05-26 Cowork session, retro-active.*
