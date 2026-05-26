# REPORT 004 — CLI Batch X1 Block A

**Executed**: 2026-05-20T19:55Z → 2026-05-20T21:25Z (wall-clock ~1h 30m, of which 55.4min Wave 1 retry)
**By**: Claude Code CLI on Windows (Opus 4.7 1M ctx)
**Pre-conditions**: All §3 pre-flight checks passed (SSH tunnel, DB connectivity, C1 backup 257MB, MIRROR GAP LIVE 4 tables, baseline tests 318/324 with 1 pre-existing fail in skills.integration.test.ts:131, working tree intact — upsert-sql.ts 638 LOC + transform-compiler.ts 487 LOC matches HEAD).

---

## §1 — Step-by-step outcomes

### §1.1 CW-B17 patch (§5.1)
- **audit-rule-codes.ts created**: yes — `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` (24 LOC, `AUDIT_RULE_CODES` const + `AuditRuleCode` type).
- **upsert-sql.ts patched**: yes — 91 LOC inserted between line 476 (DRY_RUN block end) and line 478 (main INSERT comment). **Spec deviation**: positioned AFTER `qStagingTable` declaration instead of "before conflictInference check (~line 427)" because the patch uses `${qStagingTable}` template-literal interpolation which would hit TDZ if placed earlier. Functionally equivalent (still BEFORE main INSERT, still guarded by `if (mode === "EXECUTE" && skipFilters.length > 0)`). See §2.5 for details.
- **typecheck**: PASS (0 errors).
- **tests**: 318 passed / 324 (1 pre-existing fail in `skills.integration.test.ts:131` — unrelated to CW-B17, present BEFORE patch). No new regressions.
- **Commit SHA**: `1443b54` — "feat(api): CW-B17 silent skip audit emission (WHERE_SKIP_FILTER_EXCLUDED_V1)" — 2 files, +115 LOC.

### §1.2 Class B fixes (§5.2)
- **§5.2.A sys_job_families bootstrap**: **COMPLETED** (4/4 sub-steps).
  - `legacy_mirror.job_families` count: **27** (matches platform). DDL via `CREATE TABLE IF NOT EXISTS` + data dump via `pg_dump --data-only`, `sed s/public\./legacy_mirror./`, `psql` apply.
  - Brownfield registry rows: source_tables=1, source_columns=10, table_mappings=1, column_mappings=10 (all idempotent INSERTs in `db/seeds/brownfield/wave1/05_job_families_registry.sql`).
  - `staging.wave1_job_families` created: yes (migration `db/migrations/000034_add_wave1_job_families_staging.sql` applied — 18th wave1 staging table).
  - `db/scripts/extract-wave1-legacy.sh` extended: `OPOURSKA=(job_template_skills job_templates job_families)`.
  - `apps/api/src/modules/brownfield-wave-executor/repository.ts`: `stagingTableFor` whitelist + `truncateAllWave1Staging` list extended to 18 tables.
- **§5.2.B skill_adjacencies MIRROR GAP**: **COMPLETED**.
  - `legacy_mirror.skill_adjacencies` count: **11634** (matches platform expected). pg_dump → sed → COPY pipeline; no schema migration needed (table already existed schema-only post-C1.4).
- **§5.2.C sys_skill_aliases via cascade**: tested via Wave 1 retry — see §1.3 outcome. Result: **80 rows** (partial — 80/130 staged = 62% effective upsert; remaining 50 excluded by `nk_missing_skill_alias_skill_id`).
- **§5.2.D sys_learning_path_steps**: DEFERRED to Batch C2/X2 per PROMPT recommendation.

### §1.3 Wave 1 retry (§5.3)
- **runId**: `505f425f-c277-4195-95b9-e2433abda198`
- **wall-clock**: **3325s = 55.4 min** (baseline 08d3bc9f was 48.3min → +15% due to new 14011 esco_skills + 11634 skill_adjacencies data; under 90min HARD halt §7.5).
- **status**: **COMPLETED**.
- **finished_at**: 2026-05-20T21:11:20Z
- **staged**: ~70k rows total across 18 staging tables (74265 validation audit rows in first 46s of run).
- **upserted (this run)**: not in run aggregate, derived from sys.* deltas — see §1.4.
- **lineage rows**: **17771** across **19 source tables** (baseline 16733 → +1038).

**Mid-run intervention**: at T+30min (UTC 20:48Z), DBA observation flagged anomaly — server PID 2686101 stuck 17min on staging-mark UPDATE for `wave1_activity_classifications` (step 9 JOIN-back). Root cause analysis identified `IS NOT DISTINCT FROM` predicate not using index `sys_activity_classifications_scheme_code_uq` despite its existence (3284 staging × 3276 target = ~10M nested-loop scan). Action taken: `pg_cancel_backend(2686101)` + `ANALYZE` on 6 staging tables (post-mass-INSERT statistics stale). Server engine has try/catch per mapping → flow proceeded to next mapping after cancel, did NOT abort run. Run completed normally 25min later. Lineage write step 8 also exhibited related issue (`ON CONFLICT DO UPDATE command cannot affect row a second time` — pre-existing dup-key issue in SELECT feeding lineage INSERT), surfaced as logged warnings across multiple mappings. Both issues documented in §2 + §4.

### §1.4 Acceptance verifications (§5.4)
- **CW-B17 audit rows emitted (non-zero)**: ✅ **35640 `WHERE_SKIP_FILTER_EXCLUDED_V1`** rows + 66997 `WAVE1_ALL_RULES PASSED` + 82 `HANDLED_VIA_LINEAGE_WRITE_V1`. **Forensic blind spot CLOSED.**
- **Exclusion reasons distribution** (top 11):

  | Exclusion reason | Count | Implication |
  |---|---|---|
  | `nk_missing_skill_taxonomy_edge_parent_id` | 17924 | Blocks `sys_skill_taxonomy_edges` — staging compiles no NK for parent_id col |
  | `nk_missing_esco_occupation_mapping_job_role_id` | 7645 | Blocks `sys_esco_occupation_mappings` — cascade from sys_job_roles=0 |
  | `required_missing_skill_category_family_id` | 7256 | Blocks `sys_skill_categories` — required FK never authored |
  | `nk_missing_skill_learning_mapping_skill_id` | 1381 | + 207 `nk_null_*` — skill FK gap |
  | `nk_missing_learning_path_step_path_id` | 688 | Confirms diagnostic §5.2.D defer |
  | `required_missing_job_role_family_id` | 231 | Blocks `sys_job_roles` (cascade from job_families now resolvable) |
  | `nk_missing_blueprint_process_variant_id` | 89 | |
  | `nk_missing_user_certification_user_id` | 88 | |
  | `nk_null_process_kpi_template_process_id` | 81 | |
  | `nk_missing_skill_alias_skill_id` | 50 | Explains why §5.2.C cascade only 80/130 |

- **Class B target progress**:

  | Target | Pre-X1 | Post-X1 | Δ | Status |
  |---|---|---|---|---|
  | sys_job_families | 0 | **27** | +27 | ✅ ACCEPTANCE MET |
  | sys_skill_aliases | 0 | **80** | +80 | ⚠️ PARTIAL (62% of staged) |
  | sys_skills | 6037 | **20048** | +14011 | ✅ esco_skills MIRROR GAP fully landed |
  | sys_job_roles | 0 | 0 | 0 | ❌ blocked (cause: required_missing_job_role_family_id; cascade fix needed C2) |
  | sys_esco_occupation_mappings | 0 | 0 | 0 | ❌ blocked (cause: nk_missing_*_job_role_id; depends on job_roles) |
  | sys_skill_taxonomy_edges | 0 | 0 | 0 | ❌ blocked (cause: nk_missing_*_parent_id) |
  | sys_skill_categories | 0 | 0 | 0 | ❌ blocked (cause: required_missing_*_family_id) |
  | sys_learning_modules | 4488 | 4488 | 0 | unchanged (1 pre-existing skip: courses violates kind_check) |
  | sys_learning_paths | 3227 | 3227 | 0 | unchanged |
  | sys_activity_classifications | 3276 | 3276 | 0 | unchanged (1 pre-existing skip: industry_profiles violates scheme_check) |
  | sys_skill_families | 77 | 77 | 0 | unchanged |

- **sys.* hit ratio post-X1**: pg_class.reltuples-based query returned 29/118 populated tables, BUT statistics are stale (no global ANALYZE post-run). Manual count above confirms at least 11 important targets populated. **Real count requires post-run ANALYZE on sys.*** to refresh statistics — recommended for Batch C2 baseline.

### §1.5 Final commit + push
- **Commits**:
  1. `1443b54` — CW-B17 patch (2 files, +115 LOC)
  2. `56f3b03` — Batch X1 Class B bundle (5 files, +285 LOC / -4)
- **Files in commit #2**:
  - `M apps/api/src/modules/brownfield-wave-executor/repository.ts` (whitelist + truncate list)
  - `M db/scripts/extract-wave1-legacy.sh` (OPOURSKA list)
  - `A db/migrations/000031_add_uq_sys_user_certifications.sql` (was uncommitted but already applied to DB — included for repo/DB drift parity)
  - `A db/migrations/000034_add_wave1_job_families_staging.sql` (new staging table)
  - `A db/seeds/brownfield/wave1/05_job_families_registry.sql` (new registry seed)
- **Push**: SUCCESS — `origin/main 56a439e..56f3b03`.

---

## §2 — Halts encountered + Anomalies documented

**No formal halt+escalate via inbox triggered** (all §7 triggers stayed under threshold: pre-flight PASS, typecheck PASS, tests = baseline, wall-clock 55.4min < 90min, push success, no DDL fails, no disk space, no scope creep).

**Mid-run interventions** (documented inline §1.3):

1. **PG query stuck 17min on `wave1_activity_classifications` staging mark**. Resolution: `pg_cancel_backend(2686101)` + `ANALYZE`. Engine resumed automatically. This was NOT a halt — server flow has per-mapping try/catch that absorbs PG cancel as a skip, then continues. ANALYZE on staging tables likely accelerated remaining mappings. Root cause analysis: `IS NOT DISTINCT FROM` predicate (NULL-aware) may not use btree index even when one exists on the matched columns — planner choice can degenerate to nested loop on the JOIN-back. The lineage write step 8 uses same `IS NOT DISTINCT FROM` pattern and is at similar risk on large mappings (skills 20048 rows, taxonomy_edges 17940 staged). See §4 for batch C2 follow-up.

2. **Lineage write failures (`ON CONFLICT DO UPDATE command cannot affect row a second time`)**: ~12+ instances logged across mappings. Pre-existing bug (not introduced by X1). Cause: the SELECT feeding INSERT INTO sys_source_lineage_records produces multiple rows with the same `(source_system, source_table, source_record_id, target_table_name)` tuple (the lineage UQ), and a single INSERT statement can't both INSERT and DO UPDATE the same row twice. Means some lineage rows are LOST (target row writes succeed, but lineage trail is missing for duplicates). This is the engine.ts issue PROMPT §1.5 explicitly says "do not investigate in X1" — flagged here for Cowork visibility, deferred to C2.

3. **Client fetch failed @ 5min** in `scripts/run-wave1-fullscale.mjs`: Node.js native `fetch` had a ~5min timeout despite AbortController set to 11min. The server continued processing server-side (req-5 never returned response to client, but engine code kept running). Suggests an HTTP/2 or socket-level keepalive issue, not application bug. The PROMPT used the runId from DB to poll status — workaround worked. Future: wire the runner to extract runId from initial response BEFORE the long-running wait, or use polling pattern instead of single long-lived POST.

4. **pg_class.reltuples staleness**: §5.4 query `WHERE c.reltuples > 0` returned 29 populated tables vs 38 in PROMPT §1.2. Not a regression; just stale planner stats. Real count requires `ANALYZE` on all `sys.*` post-run. NOT a halt.

5. **0 SKIPPED_UNSUPPORTED_TRANSFORM_V1 audit rule observed in this run** — only 3 rule codes emitted (WAVE1_ALL_RULES, WHERE_SKIP_FILTER_EXCLUDED_V1, HANDLED_VIA_LINEAGE_WRITE_V1). The non-mechanical transform skip path documented in upsert-sql.ts header comment doesn't seem to be exercised — either all mappings now have mechanical transforms, or that audit class was renamed. Worth Cowork validation.

---

## §2.5 — Cowork spec improvements suggested (critical thinking output)

1. **CW-B17 patch insertion point** — PROMPT §5.1.B specifies "~line 427, BEFORE conflictInference check". Actual position MUST be after `qStagingTable` declaration (~line 455) because the patch body uses `${qStagingTable}` interpolation. Either:
   - Update spec to say "after `qStagingTable` declaration, BEFORE main INSERT (~line 478)", OR
   - Re-order the source file so `qStagingTable` is hoisted earlier (more invasive, NOT recommended).

   Current location chosen: between line 476 (DRY_RUN block close) and 478 (main INSERT comment). Functionally identical to spec intent (still before main INSERT, still mode='EXECUTE'-guarded).

2. **`mapping.source_table_id` availability** — PROMPT §5.1 ended with a hedged warning "should be available... If not currently exposed, extend MappingRow type". Verified: `TableMappingRow.source_table_id` already declared in `repository.ts:219`. **No type extension needed.** Spec can be simplified.

3. **Hardcoded rule_code string in patch SQL** — patch uses literal `'WHERE_SKIP_FILTER_EXCLUDED_V1'` inside the template literal instead of referencing `AUDIT_RULE_CODES.WHERE_SKIP_FILTER_EXCLUDED_V1` from the new audit-rule-codes.ts file. Minor: a future rename would require touching both places. Trade-off: importing AUDIT_RULE_CODES adds an `import` line but no runtime difference. Left as-is per spec; flagging for stylistic consistency in C2.

4. **`source_column_table_id` vs `source_column_source_table_id`** — PROMPT §5.2.A grep example used `sc.source_column_source_table_id` (line shown in §5.2.A step 3 reference). Actual FK column is `source_column_table_id` (verified `\d brownfield.source_columns`). Minor doc typo.

5. **5th MIRROR GAP discovery** — PROMPT §5.2.B confirms `skill_adjacencies` was missed in C1.4. Recommendation for C2: write a single SQL query that audits **all `legacy_mirror.*` tables** vs their `heuresys_platform.public.*` counterparts to surface any 6th/7th gap proactively rather than discovering them one-at-a-time per diagnostic.

6. **`ANALYZE` on staging tables post-load** — should be part of the wave executor's pipeline (e.g., at end of staging insert phase, before transitioning to upsert phase). Avoided the 17min stuck staging-mark UPDATE described in §2.1. Concrete proposal: add `ANALYZE staging.wave1_<target>` after staging populate in `engine.ts`.

7. **`IS NOT DISTINCT FROM` JOIN-back** — both step 8 (lineage write) and step 9 (staging mark) use this NULL-aware operator. PG planner sometimes refuses btree index for `IS NOT DISTINCT FROM`. Concrete fix: for NK columns declared `NOT NULL` (most uuid NKs), use `=` directly + add explicit NULL-checks elsewhere. Specifically `t.activity_classification_scheme = s.__nk_activity_classification_scheme AND t.activity_classification_code = s.__nk_activity_classification_code` would use the UQ index.

8. **Wave executor doesn't expose runId in initial response** — would simplify the runner client polling pattern and make `scripts/run-wave1-fullscale.mjs` resilient to client fetch timeout. C2 enabler.

9. **PROMPT §8 notify kind `exec_completed` is not a valid kind** — `notify.mjs` rejects with "invalid <kind>". Valid kinds per its --help: `prompt_ready, plan_ready, plan_amendment_requested, approval_ready, exec_started, exec_progress, exec_halt, report_ready, report_rejected, review_ready, session_handoff, question, answer, ack, pending_applied`. Used `report_ready` instead (semantically correct: REPORT is ready → Cowork's expected response is `review_ready`). Suggestion: update PROMPT template §8 default kind.

---

## §3 — Deferred to Batch X2

- **Optional unit tests for CW-B17 audit emission** (§5.1.D): no tests added — vitest suite stayed at baseline 318 passed. Recommend: 1-2 tests verifying audit rows emitted with correct payload structure on a mock skipped row.
- **`sys_learning_path_steps` Class B fix** (§5.2.D): deferred to SDBI workflow in X2 per PROMPT recommendation.
- **Other 8 of 12 Class B targets** (sys_skill_categories, sys_skill_taxonomy_edges, sys_skill_learning_mappings, sys_position_skill_requirements, sys_blueprint_process_variants, sys_process_kpi_templates, sys_user_certifications partial, sys_job_roles+sys_esco_occupation_mappings cascade): deferred to C2/X2. Now have concrete CW-B17 audit evidence to prioritize.

---

## §4 — Next step recommendation for Cowork batch C2

**P0 critical**:
1. **Optimize lineage write step 8** + **staging mark step 9** to NOT use `IS NOT DISTINCT FROM` on uuid NK columns. Replace with `=` + explicit NULL guards. Likely 10-100x speedup on big tables (skills, taxonomy_edges, esco_*). Without this, even small Class B additions risk multi-hour Wave 1 retries.
2. **Add `ANALYZE staging.wave1_<target>` after mass-INSERT** in engine.ts staging phase. Defensive measure for planner consistency.
3. **Diagnose lineage write `ON CONFLICT cannot affect row a second time`**. The SELECT feeding lineage INSERT must be deduplicated on the UQ tuple OR the ON CONFLICT must be removed (and replaced with pre-filter). This is the engine.ts deep-investigation PROMPT §1.5 deferred. Now data exists in audit to scope it.

**P1 unblocks more cascade**:
4. **`sys_job_roles` upsert**: 231 staged, all failing with `required_missing_job_role_family_id`. The column_mappings for `job_templates → sys_job_roles` need a LOOKUP_FK to `sys_job_families` via the `job_family_id` resolver. The bootstrap of sys_job_families (X1 deliverable) now makes this possible.
5. **`sys_esco_occupation_mappings`**: 7645 staged. Same cascade — depends on sys_job_roles.
6. **`sys_skill_categories`**: 7256 staged, missing `family_id` required FK. Column mapping needs LOOKUP_FK to `sys_skill_families` (77 rows already populated).
7. **`sys_skill_taxonomy_edges`**: 17924 staged, missing `parent_id` NK. Self-FK LOOKUP_FK or path-based natural-key needed.

**P2 quality**:
8. **Goals/OKRs SDBI pilot** authoring (Cowork's batch X2 input ready, deferred from X1).
9. **`sys_source_lineage_records` integrity**: review pre-existing lineage write failures across mappings.
10. **Tests**: add CW-B17 audit emission unit tests; add cascade-completion integration test (1 mapping fully resolves, target + lineage + staging mark in single happy-path).

---

## §5 — Bias catalog candidates (new ones surfaced during X1)

- **CW-B22 — Predicate vs Index Mismatch**: `IS NOT DISTINCT FROM` on indexed columns can degenerate to nested-loop seq scan; planner doesn't always use btree index for NULL-aware operators. Surfaced 2026-05-20 during X1 Wave 1 retry when sys.sys_activity_classifications staging-mark UPDATE took 17min. Mitigation: prefer `=` for NOT NULL columns; use explicit `OR (a IS NULL AND b IS NULL)` pattern only when both sides genuinely nullable. Pattern-applicable across upsert-sql.ts steps 7-9.
- **CW-B23 — Stale Statistics Post-Mass-INSERT**: PG planner makes poor choices when `pg_class.reltuples` is far from reality. Mass-INSERT into staging tables (10k-20k rows) without subsequent ANALYZE invites this. Surfaced same time as CW-B22 (both were components of the 17min stall). Mitigation: ANALYZE step in the wave executor after staging populate.
- **CW-B24 — Lineage Insert Self-Conflict (Engine.ts)**: a single INSERT statement targeting `sys.sys_source_lineage_records` produces multiple rows colliding on its UQ in the SELECT source, triggering "ON CONFLICT DO UPDATE command cannot affect row a second time". Pre-existing latent issue surfaced more visibly with larger data volumes post-MIRROR-GAP-fix. NOT introduced by X1. Mitigation: dedup the SELECT on UQ tuple OR remove ON CONFLICT and pre-filter.

---

## §6 — Feedback sul modello operativo Cowork↔CLI

**Cosa ha funzionato bene**:
- **PROMPT 004 self-contained briefing format** — 720 righe sembravano tante, ma il "executive briefing §1" + "decisions locked §4" rendono il prompt navigabile. Non ho mai dovuto drill-down su `cowork_reserved/` per Block A, solo per il diagnostic file `sys_job_families.md` (PROMPT pointed to it correctly).
- **§7 halt triggers explicit + format template**: i 10 triggers chiari mi hanno permesso di NON halt erroneamente durante il mid-run intervention (cancel di una query non è un halt trigger — è un'operazione di recovery che il flow supporta). Senza la lista, avrei probabilmente halt+escalato.
- **Trust + critique balance §0**: dichiarazione che "Cowork's diagnostic work has high trust default ma segnala anomalie" mi ha messo nel framing giusto. Le 8 spec improvements in §2.5 le ho potute emergere senza paura di "passare sopra a Cowork".
- **Decision locked §4**: zero ambiguità su Opt3, HC items, drop test, MIRROR GAP — ha fatto sì che mi concentrassi sull'esecuzione.

**Cosa rifare diversamente**:
- **Mid-run client fetch failure handling**: il PROMPT non anticipava il 5min Node.js fetch timeout. Sarebbe utile in C2 author un `scripts/run-wave1-fullscale.mjs` versione 2 che fa polling status-by-runId invece di single long POST.
- **Pre-flight §3** non includeva "API dev server up on :3001" né "migration 000031 applied". Entrambi necessari per Wave 1 retry. Migration 000031 era già applicata; API server l'ho dovuto avviare separatamente. Suggerimento: aggiungere a §3.6 "pnpm dev background started" + §3.7 "migration 000031-000033 applied to DB".
- **§5.5 commit instruction**: prevedeva un solo commit message bundle; in realtà ho fatto 2 commit (CW-B17 isolato + batch X1 bundle) perché il PROMPT §5.1.E faceva un commit a parte. OK perché §5.5 dice "commit + push" e non "single commit". Suggerimento: rendere esplicito che §5.5 push include i commit di §5.1.E + §5.5 message.

**Critical thinking moments — utili o controproducenti**:
- **Spec deviation patch insertion point (§2.5 item 1)**: utile. Avrei potuto seguire spec letterale e creare TDZ runtime error.
- **Mid-run cancel decision**: utile, evitato halt prematuro. Decision authority was correctly Enzo's, and he confirmed approach.
- **Wave 1 retry monitoring vs halt**: utile. Lo monitoring real-time mi ha permesso di intervenire chirurgicamente (cancel + ANALYZE) invece di scaricare tutto su halt+escalate.

**Mode operativo ottimale confermato**: il PROMPT §0 framework "esegui as-is su §3 + §5.1.A code, valuta criticamente §5.2 fix tactics" si è verificato accurato. §5.2.A authoring brownfield registry richiese tutta la mia attenzione critica (ho dovuto verificare schema reale, allineare nomi colonna, scegliere transform codes per ogni source col); il PROMPT spec era guida generale, la pelle in tema ho dovuto metterla io. Pattern utile per C2.

---

*End REPORT 004 batch X1 — handoff to Cowork for batch C2 review + PROMPT 005 authoring.*
