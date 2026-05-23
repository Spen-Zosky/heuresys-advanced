# PROMPT 013 — CLI Batch X9 SKILGRO (self-contained mega-bundle)

**Protocol**: Cowork↔CLI v2.2 batch mode — MEGA-BUNDLE mode (5 blocks in 1 CLI session)
**Scope**: Skills/Learning Loop dedicated macro-area + bulk closure CW-B35 Phase B+C + CW-B37 deep fix + canonical learning re-mapping
**Expected duration**: 4-8h CLI continuous
**Authored**: 2026-05-21T20:30Z by Cowork (batch C9, mega-bundle pattern §13 vincente)
**Predecessor**: REPORT X8 (`cowork_code_exchange/_04_REPORT_012_batch_x8.md`)

---

## §0 — Identity + role + mega-bundle rules

You are Claude Code CLI on Windows. Cowork C9 ha autorizzato MEGA-BUNDLE 5-block execution per ridurre intermediation. Engine post-X7 hardening è solid (45 bias catalog mitigated, no P0 known). Tutti i blocks autorizzati upfront; halt SOLO P0 critical (vedi §7).

**Inline Mitigation Scope (pattern memo §13)** AMPLIATO per mega-bundle:
- ✅ Inline OK: tutti i fix CW-B di REPORT 011 §6 + 012 §5 ya autorizzati
- ✅ Inline OK: UPDATE-in-place column_mappings su brownfield registry
- ✅ Inline OK: Migration applicate via psql -f (workaround pnpm db:migrate hung)
- ✅ Inline OK: REFERENCE_ONLY re-classify per Phase C heterogeneous sources
- ⛔ Halt P0: nuovi ADR architectural (oltre ADR-0017 già spec'd) → escalate
- ⛔ Halt P0: R-A2 type regression (admin loss, sys_users count <430)
- ⛔ Halt P0: engine code che richiede design Cowork (oltre LOOKUP_FK_2HOP)

**Critical thinking INVITED** (pattern memo §9 "Iteration as feature"):
- Spec C9.3 §3 ha 2 opzioni schema (courses → paths vs courses → modules). Forensic raccomanda Option A → revise to Option B after analysis (REVISED §3.2'). Verifica al run-time se ulteriori semantic clash emergono.
- LOOKUP_FK_2HOP è first-time implementation; verifica payload validator funziona post-trigger update.

**Commitments**: read PROMPT + 4 spec files in `cowork_reserved/batch_c9/`. Mega-REPORT 013 finale + inbox notify. 1 commit + push bundle "X9 SKILGRO mega".

---

## §1 — Executive briefing

### §1.1 State pre-X9 (post X8 stabilized)

| Metric | Value |
|---|---|
| sys.* populated | 59/128 (46%) |
| Engine bias catalog | 45 (28 mitigated, others reflexive/deferred) |
| Migrations applied | 000042 |
| Pattern memo | 20 anti + 15 vincenti |
| Test suite | 327/333 PASS |

### §1.2 X9 SKILGRO scope unified (5 blocks)

| Block | Title | Effort | ROI |
|---|---|---|---|
| **A** | ADR-0017 LOOKUP_FK_2HOP engine implementation | 2-3h | unlocks 1381+ rows (CW-B37 deep) + future cross-domain |
| **B** | Canonical learning re-mapping (courses → sys_learning_paths, course_modules → sys_learning_modules) | 1-2h | +127 paths + 564 modules = 691 rows |
| **C** | sys_skill_learning_mappings unlock via LOOKUP_FK_2HOP | 1h | unlock 1381→≤300 (78%+ resolution) |
| **D** | CW-B35 Phase B+C cleanup (filter sources + REFERENCE_ONLY 4 heterogeneous) | 45-60 min | -331 audit rows OR +100 unlocked |
| **E** | CW-B36 competencies fuzzy mapping (32 rows, optional) | 30 min OR defer | +30 rows OR audit cleanup only |

**Total estimated unlock**: ~2400-3800 rows across 4 sys.* target tables.

### §1.3 Decisions locked (no further confirmation)

- ADR-0017 LOOKUP_FK_2HOP spec APPROVED (Cowork C9.2)
- Canonical re-mapping plan APPROVED (Cowork C9.3, Option Revised §3.1'/§3.2')
- CW-B35 Phase C REFERENCE_ONLY APPROVED (Cowork C9.4)
- CW-B35 Phase B Option B.2 (defer) acceptable se X9 bandwidth limit
- All R-A2 + regression checks invariant

---

## §2 — Pre-flight

```bash
# Connectivity + tunnel
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"

# Last commit + spec files exist
cd D:\heuresys-advanced && git log --oneline -3
ls cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md
ls cowork_reserved/batch_c9/sys_learning_modules_forensic/01_FORENSIC.md
ls cowork_reserved/batch_c9/cw_b35_phase_bc/01_FORENSIC.md

# Baseline
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_skills' t, COUNT(*) FROM sys.sys_skills
UNION ALL SELECT 'sys_learning_paths', COUNT(*) FROM sys.sys_learning_paths
UNION ALL SELECT 'sys_learning_modules', COUNT(*) FROM sys.sys_learning_modules
UNION ALL SELECT 'sys_learning_path_steps', COUNT(*) FROM sys.sys_learning_path_steps
UNION ALL SELECT 'sys_skill_learning_mappings', COUNT(*) FROM sys.sys_skill_learning_mappings
UNION ALL SELECT 'sys_skill_taxonomy_edges', COUNT(*) FROM sys.sys_skill_taxonomy_edges
UNION ALL SELECT 'sys_skill_categories', COUNT(*) FROM sys.sys_skill_categories
UNION ALL SELECT 'sys_esco_occupation_mappings', COUNT(*) FROM sys.sys_esco_occupation_mappings
UNION ALL SELECT 'legacy_mirror.courses', COUNT(*) FROM legacy_mirror.courses
UNION ALL SELECT 'legacy_mirror.course_modules', COUNT(*) FROM legacy_mirror.course_modules;"
```

Record baseline in REPORT §0.

---

## §3 — Block A: ADR-0017 LOOKUP_FK_2HOP implementation (2-3h)

**Spec autoritativa**: `cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md` (full payload schema + SQL template + unit tests + acceptance + migration).

### Steps
1. Apply migration `db/migrations/000043_lookup_fk_2hop_validator.sql` (spec §7) via `psql -f`
2. Add `case "LOOKUP_FK_2HOP"` in `transform-compiler.ts` (spec §4 verbatim)
3. Add `"LOOKUP_FK_2HOP"` to `SUPPORTED_TRANSFORMS` Set
4. Update test `transform-compiler.test.ts:516` expect 17 (was 16 post-CAST_ENUM)
5. Create new test file `transform-compiler.lookup-fk-2hop.test.ts` (5 tests per spec §5)
6. Run `pnpm typecheck` + `pnpm test --filter @heuresys/api`. Expected: 5/5 new tests + 327/338 full
7. Update ADR-0017 status PROPOSED → ACCEPTED in commit

### Acceptance Block A
- 5 new tests PASS
- Full suite no regression
- Migration 000043 in sys_schema_migrations
- LOOKUP_FK_2HOP available for Block C

---

## §4 — Block B: Canonical learning re-mapping (1-2h)

**Spec autoritativa**: `cowork_reserved/batch_c9/sys_learning_modules_forensic/01_FORENSIC.md` §3 (revised plan §3.1'/§3.2').

### Phase B.1 — courses → sys_learning_paths (127 rows)
1. INSERT brownfield.table_mappings (courses → sys.sys_learning_paths, classification IMPORT)
2. INSERT brownfield.column_mappings (5-7 column_mappings: id→LINEAGE_SOURCE_NK + title→name + description + tenant_id→LOOKUP_FK + duration_hours→metadata)
3. Wave 1 retry → +127 sys_learning_paths
4. Verify: sys_source_lineage_records has 127 rows source=courses target=sys_learning_paths

### Phase B.2 — course_modules → sys_learning_modules (564 rows)
1. Re-classify existing table_mapping (course_modules → sys_learning_path_steps) UPDATE from REFERENCE_ONLY back to IMPORT? **NO** — instead create NEW table_mapping (course_modules → sys_learning_modules) classification IMPORT
2. INSERT column_mappings (id→LINEAGE_SOURCE_NK + title→name + description + course_id→LOOKUP_FK_2HOP to sys_learning_paths via courses lineage — for parent_path_id if schema requires it; verify sys_learning_modules schema doesn't require path_id since paths/modules are M:N through path_steps)
3. Wave 1 retry → +564 sys_learning_modules
4. Acceptance: sys_learning_modules 4488 → ~5052

### Phase B.3 — sys_learning_path_steps (124 rows) optional
1. Audit `learning_path_courses` source semantics live: does it have BOTH learning_path_id + course_id refs that map to (path_id, module_id) tuple? Or is it just path↔course assignment (no module concept)?
2. If 124 rows fit the (path_id, module_id) tuple → IMPORT classification + LOOKUP_FK column_mappings via lineage (path_id ← learning_path_id; module_id ← need 2-hop or path-step semantics decision)
3. If NOT fit → keep REFERENCE_ONLY (already post-X8). No regression.
4. **Halt+escalate** se discovery suggests new ADR needed for path_step semantics

### Acceptance Block B
- sys_learning_paths +127 ✅
- sys_learning_modules +564 ✅
- sys_learning_path_steps: depends on §B.3 audit outcome

---

## §5 — Block C: CW-B37 deep fix via LOOKUP_FK_2HOP (1h)

Per ADR-0017 + REPORT 011 §6 + CW-B37 forensic.

### Steps
1. UPDATE 2 existing column_mappings (certification_esco_skills + course_esco_skills → sys_skill_learning_mappings.skill_id):
   - Change transform from current placeholder/None to `LOOKUP_FK_2HOP`
   - Set payload:
     ```json
     {
       "target_table": "sys_skills",
       "match_on": "esco_skill_uri",
       "lookup_2hop": {
         "intermediate_schema": "legacy_mirror",
         "intermediate_table": "esco_skills",
         "intermediate_match_col": "uri",
         "intermediate_pk_col": "id"
       }
     }
     ```
2. Wave 1 retry
3. Acceptance: `nk_missing_skill_learning_mapping_skill_id` drops 1381 → ≤300

### Optional Block C extension
Same pattern for `module_id` if certification_esco_skills/course_esco_skills source has module reference (esco_skill_uri → sys_learning_modules path possible if sys_learning_modules now sourced from courses via Block B).

---

## §6 — Block D: CW-B35 Phase B+C cleanup (45-60 min)

**Spec autoritativa**: `cowork_reserved/batch_c9/cw_b35_phase_bc/01_FORENSIC.md` §4 raccomandazione.

### Phase B.1 (filter-based, 100 rows) — OPZIONALE in X9
- If bandwidth: apply pre-staging UPDATE + column_mappings for cross_entity_relations + semantic_entity_relations (skill→skill filtered)
- Acceptance: +100 sys_skill_taxonomy_edges

### Phase C.1 (REFERENCE_ONLY 4 sources, 231 rows) — REQUIRED in X9
Apply SQL UPDATE from `01_FORENSIC.md` §4 verbatim (4 table_mappings REFERENCE_ONLY).

### Acceptance Block D
- audit `nk_missing_skill_taxonomy_edge_parent_id` drops 331 → ≤100 (Phase B.1 done) OR ≤100 (Phase B.1 skip, but Phase C.1 removes 231 → effective audit clean)

---

## §7 — Block E: CW-B36 competencies fuzzy (30 min OR defer)

**32 rows** competencies → sys_skill_categories.family_id (fuzzy match by name).

If bandwidth: 4/6 categories fuzzy-mappable (Leadership→BUS-LEAD, Interpersonal→COMM-INT, Performance→HR-PERF, Personal→COMM-INT). 2 unmappable (Cognitive, External).

Option: pre-staging UPDATE staging.wave1_skill_categories injecting family_id via name LOOKUP, then standard column_mapping for skill_category_family_id.

If skip: reclassify competencies REFERENCE_ONLY (audit clean 32→0).

**Recommendation**: SKIP for X9 mega-bundle (low ROI 32 rows, defer to dedicated polishing post-X9).

---

## §7' — Halts P0 only (mega-bundle Inline Mitigation Scope)

| Trigger | File | Severity |
|---|---|---|
| Block A: LOOKUP_FK_2HOP test failure NOT resolvable inline | `adr_0017_test_fail` | P0 |
| Block B: schema audit reveals new ADR needed | `learning_remap_adr_needed` | P0 |
| Block C: 2-hop LOOKUP_FK_2HOP doesn't unlock (1381 stays) | `lookup_2hop_unexpected_fail` | P0 |
| ANY sys_* table count regression | `regression_<table>` | P0 |
| sys_users < 430 OR ADMIN:: rows < 5 | `r_a2_regression` | **P0 CRITICAL** |
| Test suite > 5 new failures | `test_regression_x9` | P1 |
| Wave 1 retry total wall-clock > 4h | `wave1_timeout` | P1 |

Tutto il resto: **inline mitigation autorizzato** per §0 + pattern memo §13.

---

## §8 — REPORT format

`cowork_code_exchange/_04_REPORT_013_batch_x9.md`. Structure:

```
§0 Pre-conditions + baseline
§1 Block A (ADR-0017 LOOKUP_FK_2HOP) outcomes
§2 Block B (Canonical learning re-mapping) outcomes
§3 Block C (CW-B37 deep fix) outcomes
§4 Block D (CW-B35 Phase B+C) outcomes
§5 Block E (CW-B36 fuzzy) status (skipped/applied)
§6 Audit forensics post-X9 (full distribution)
§7 Bias catalog updates (CW-B46+ if surfaced)
§8 Pattern memo §12 cross-check
§9 Cowork spec improvements suggested
§10 Next step recommendation for Cowork C10 / X10
```

Emit `report_ready` inbox + commit + push bundle.

---

## §9 — Reference files (Cowork-authored)

| Path | Purpose |
|---|---|
| `cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md` | Block A spec |
| `cowork_reserved/batch_c9/sys_learning_modules_forensic/01_FORENSIC.md` | Block B spec |
| `cowork_reserved/batch_c9/cw_b35_phase_bc/01_FORENSIC.md` | Block D spec |
| `cowork_reserved/bias_registry.md` | SoT 45 bias |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §13 | Inline Mitigation Scope vincente (auth ampliata) |
| `cowork_code_exchange/_04_REPORT_012_batch_x8.md` | Predecessor REPORT |

---

## §10 — Post-X9 outlook

Expected sys.* populated post-X9: **62/128 → 65/128** (depending on Block B/D outcomes). +5-10% completion in 1 mega-cycle.

Successor X10: Performance Reviews / GOKMER extension (sys_users + sys_goals + sys_job_roles ready). Estimated single-block, low complexity given engine maturity.

---

Cowork standing by per review post-REPORT 013. Halt+escalate ONLY su §7 trigger. Inline mitigation libera per il resto. Buon lavoro.

---

*End PROMPT 013*
