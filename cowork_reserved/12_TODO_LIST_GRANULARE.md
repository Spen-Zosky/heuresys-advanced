# TODO List Granulare — Master Plan Post-Audit

**Snapshot**: 2026-05-20T03:20Z
**Scope**: Action plan operativo derivato dalla Knowledge Base F1-F11, granulare e completo, mapped a ognuna delle 3 opzioni strategiche
**Decisione**: Recommendation = **Opzione 3 (Hybrid)**, ma TODO list è strutturata per supportare TUTTE 3 le opzioni — Enzo seleziona Phase appropriate

---

## §0 — Reading order obbligatorio (next session)

PRIMA di partire con qualsiasi work, leggere:

1. ☐ `cowork_reserved/00_README_KB.md` (index entry point)
2. ☐ `cowork_reserved/11_STRATEGIC_REFORMULATION.md` (recommendation + reasoning)
3. ☐ `cowork_reserved/10_GAPS_ANALYSIS.md` (gap classification + priorities)
4. ☐ `cowork_reserved/05_EXTRACT_SCRIPTS_FORENSIC.md` (Wave 1 design context)
5. ☐ Questo file (TODO master)

Riferimenti drill-down on-demand:
- `01_DB_PLATFORM_INVENTORY.md` (source)
- `02a-02f_ADV_*.md` (target 6 schemas)
- `04_MIGRATIONS_TIMELINE.md` (migrations 33)
- `06_BROWNFIELD_REGISTRY_DEEP_DIVE.md` (mappings)
- `07_TRANSFORM_COMPILER_ANALYSIS.md` (code)
- `08_AUDIT_TRAIL_ANALYSIS.md` (audit)
- `09_LEXICON_DOMAINS_MAPPING.md` (CASCADIA)

---

## §1 — Pre-requisites UNIVERSALI (regardless of option chosen)

Da fare PRIMA di Opt1/2/3 implementation.

### P-1 — Git working tree restore (CRITICAL, ~30 min)

**Why**: F7 audit ha rilevato CORRUPTION in 5 files (878 LOC cancellate accidentalmente). Codice NON compila. Senza fix, qualsiasi work successivo è bloccato.

**Files corrotti**:
- `apps/api/src/modules/brownfield-wave-executor/engine.ts`
- `apps/api/src/modules/brownfield-wave-executor/service.ts`
- `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts`
- `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`
- `apps/api/test/transform-compiler.test.ts`

**Action**:
```bash
cd D:\heuresys-advanced
git status -sb              # verify 5+ M files
# Mostra i diff per documentare cosa va perso
git diff HEAD -- apps/api/src/modules/brownfield-wave-executor/ apps/api/test/transform-compiler.test.ts > /tmp/corrupt_diff.txt
wc -l /tmp/corrupt_diff.txt # verify ~878 lines

git checkout HEAD -- \
  apps/api/src/modules/brownfield-wave-executor/engine.ts \
  apps/api/src/modules/brownfield-wave-executor/service.ts \
  apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts \
  apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts \
  apps/api/test/transform-compiler.test.ts

# Verify restore
cd apps/api && pnpm --filter @heuresys/api typecheck   # expected: 0 errors
pnpm --filter @heuresys/api test                       # expected: 318/318 passed
```

**Acceptance**: typecheck 0 errors + 318/318 tests verdi.

**Owner**: Enzo (decision: vuoi salvare gli uncommitted prima del checkout?) o CLI execution.

---

### P-2 — Backup pre-pivot pg_dump (~30 min)

**Why**: Recovery point pulito PRIMA di qualsiasi DB write (migrations o data).

**Action**:
```bash
ssh oracle-vm-default 'sudo -u postgres pg_dump -F c heuresys_advanced > /home/ubuntu/backups/heuresys_advanced_pre_pivot_$(date +%Y%m%d_%H%M).dump'
ssh oracle-vm-default 'ls -lh /home/ubuntu/backups/heuresys_advanced_pre_pivot_*.dump'
# Expected: ~250 MB file
```

**Owner**: Enzo o CLI.

---

### P-3 — Decisione 8 commits ahead origin/main (~15 min)

**Why**: Local state non clean per future PR/work. 8 commits Goal 003 ahead di origin/main (commit `7a432a9` chore: handoff S923 + commits Items K/C/D+M/A/B/F-P1).

**Options**:
- (a) `git push origin main` — accetta lavoro Goal 003 come committed (raccomandato se nessun bug noto + migrations 32/33 già applied su DB)
- (b) `git reset --soft <pre-Goal-003>` — degrada commits a working changes, redo via Opt3 path
- (c) Lascia in local main fino a Phase 1 completion, poi decision

**Recommendation**: **(a) push** — i commits sono validi (test verdi + migrations applied su DB). Pushare ora pulisce stato senza rischio.

**Owner**: Enzo decision.

---

### P-4 — Cowork lock release (~5 min)

**Why**: Vecchio lock `.cowork-active.lock` (expected_idle_at 2026-05-19T14:51:31Z) ancora presente in `cowork_code_exchange/`. Anche se expired (auto-prune R2), pulizia esplicita evita confusion next session.

**Action**:
```bash
cd D:\heuresys-advanced
rm cowork_code_exchange/.cowork-active.lock   # or check via Cowork session-start auto-prune
```

**Owner**: CLI o Cowork in next session.

---

### P-5 — `heuresys_test` decision (~30 min)

**Why**: 791 MB DB su VM, ruolo non chiarito. Possibili usi:
- Staging environment per testing
- Snapshot di heuresys_platform precedente
- Sandbox SDBI in Opt3

**Action**:
```bash
ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_test -c "\dt+" | head -20'
# Verify: a) quali schemi presenti? b) row counts? c) data fresca o stale?
```

**Decision Enzo**: 
- Se = staging → preservare, usare come pre-prod testing
- Se = snapshot → archive backup o drop per disk space recovery
- Se = sandbox candidate → reusare per SDBI temp_ (Opt3 Phase 2)

**Owner**: Enzo decision.

---

**Total pre-requisites**: ~2-3 ore.

---

## §2 — TODO Opzione 3 HYBRID (RECOMMENDED) — granular

### Phase 1 — Debt cleanup + Class B/C fix (Week 1-2)

#### P1.1 — CW-B17 fix: audit per silent skip (4-8h)

**Why**: Senza, qualsiasi debug Wave 2/3/4 sarà cieco (CW-B17 silent skip pattern).

**Action**:
1. Add new audit rule_code: `LOOKUP_FK_NULL_RESOLUTION_V1`
2. Modify `upsert-sql.ts:238-269` WHERE skip filter:
   - When row excluded due to NULL FK → INSERT audit row with rule_code + source_record_id + target_col + match_on payload
   - Status: SKIPPED
3. Add unit tests in `transform-compiler.test.ts`
4. Re-run Wave 1 retry, verify silent skip rows ora documentati in audit.

**Acceptance**:
- 0 silent skip rows senza audit row corrispondente
- Audit query: `SELECT COUNT(*) FROM audit.import_validation_results WHERE rule_code='LOOKUP_FK_NULL_RESOLUTION_V1';` ≥ 24552 (matching Goal 003 silent skip count)

#### P1.2 — CW-B20 UQ relax decision (2-6h)

**Why**: UQ `(table_mapping_id, source_column_id)` forbids additive LOOKUP_FK quando source_column già JSON_EXTRACT-mapped. Per Class B fix di sys_skill_categories serve.

**Options**:
- (a) Migration 000034: relax UQ → composite (table_mapping, source_column, transform) — allows 1 source_col with multiple transforms
- (b) Migration 000034: introduce `brownfield.source_columns_aliases` table + sintetiche source_columns rows
- (c) Bypass: per i casi UQ-blocked, usare SDBI Phase 2 (Opt3 logic native)

**Recommendation**: (c) — non spendere effort architettonico su brownfield UQ. SDBI Phase 2 gestisce automaticamente quei casi.

#### P1.3 — Class C MIRROR GAP: extend extract script (2-4h)

**Why**: 4 source tables in platform NOT in mirror sono blockers per Class B fix.

**Action**:
1. Edit `db/scripts/extract-wave1-legacy.sh`: aggiungi `esco_skills` (14011 rows) a ESKAP domain, `business_processes` (26) a OPOURSKA, `industry_ccnl_mapping` (14) a INDOOR, `tenant_industry_classifications` (4) a INDOOR
2. Re-run script: `bash db/scripts/extract-wave1-legacy.sh`
3. Restore in legacy_mirror via psql (manual step — questo è il "gap di automation" noted in F5)
4. Aggiungi corrispondenti `brownfield.source_tables` + `source_columns` entries (probabilmente via migration o INSERT statement)
5. Verify: `SELECT COUNT(*) FROM legacy_mirror.esco_skills;` = 14011

**Acceptance**: 4 missing tables now in legacy_mirror with row counts matching platform source.

#### P1.4 — Dead code cleanup engine.ts (~1-2h)

**Why**: ~230 LOC `if(false)` block L782-L958 + JS-side helpers in `engine.ts` sono codice morto (vedi F7). Pre-Wave-2 sanity.

**Action**:
1. Identify dead block boundaries
2. git rm lines + commit `chore(api): remove dead JS-side wave executor branch (Goal 001b cleanup)`
3. Verify tests still pass.

#### P1.5 — Class B fix Wave 1 silent skip residui (30-50h)

**Why**: 12 silent-skip target identificati F6/F8. Risolvibili caso-per-caso post-CW-B17 fix.

**Action** (per target, parallel se possibile):
- sys_skill_aliases: 16 column_mappings esistono, but silent-skip — investigare via audit + fix
- sys_skill_categories: 45 mappings, UQ block — risolto via P1.2 path c (SDBI takes over)
- sys_skill_taxonomy_edges: 133 mappings, silent-skip — investigare
- sys_skill_learning_mappings: 23 mappings, silent-skip
- sys_learning_path_steps: 20 mappings, CW-B19 source mismatch — accept Goal 004 (SDBI handles)
- sys_esco_occupation_mappings: 53 mappings, CW-B18 cascade — needs esco_skills mirror fix from P1.3
- sys_job_roles: 43 mappings, CW-B18 cascade (sys_job_families empty)
- sys_job_families: target empty, source missing in mirror — SDBI Phase 2 (Goals area)
- sys_process_kpi_templates: 13 mappings, silent-skip
- sys_position_skill_requirements: 53 mappings, silent-skip (source data 28983 in job_template_skills present)
- sys_position_learning_requirements: 7 mappings, source `job_title_learning_paths` empty
- sys_blueprint_overrides: 53 mappings, target empty (source-side issue?)

Pattern per ognuno:
1. Read audit.import_validation_results WHERE source_table=X AND rule_code='LOOKUP_FK_NULL_RESOLUTION_V1' (post P1.1)
2. Identify root cause (LOOKUP_FK pattern issue, source data missing, target schema mismatch, etc.)
3. Fix specifico (extend extract script, fix LOOKUP_FK payload, add column_mapping)
4. Re-run Wave 1 retry, verify target popolato

**Acceptance**:
- Almeno 8/12 silent-skip target risolti (4 sopravviventi → SDBI Phase 2)
- sys.* hit ratio Wave 1: da 38/118 a ~50/118

#### P1.6 — Mismatch numerici investigation (4-8h)

**Why**: Anomalie segnalate F10 da chiarire:
- sys_learning_paths 3227 vs source `learning_paths` 20 (ratio 161×)
- sys_learning_modules 4488 vs source 691 (ratio 6.5×)
- sys_users 163 vs platform.users 274 (diff 111)
- sys_user_certifications 1 vs source `employee_certifications` 729 (gap 728)
- sys_positions 161 + sys_user_position_assignments 161 — provenienza unclear

**Action**:
1. Query sys.sys_source_lineage_records per ognuno → identifica source_table_id origine
2. Cross-ref con audit.import_validation_results per ogni target
3. Documenta findings in `cowork_reserved/anomalies_investigation.md`

**Acceptance**: provenienza chiara per ognuno dei 5 mismatch.

#### Phase 1 Total: 42-78h

### Phase 2 — SDBI architecture spec + pilot Goals/OKRs (Week 3-4)

#### P2.1 — ADR-0014 SDBI architecture (10-15h)

**Why**: Senza spec, qualsiasi SDBI work è prematuro.

**Deliverable**: `docs/decisions/ADR-0014-sdbi-architecture.md` covering:
1. Scope: SDBI handles Tier D macro-areas only (TRUE GAP). Brownfield handles Tier A/B/C.
2. 6-phase workflow (da `_00_SESSION_HANDOFF_2026-05-20.md §3.2`):
   - SOURCE DISCOVERY (AI semantic analysis of source table)
   - TARGET ANALOGY MATCHING (AI candidates + confidence)
   - TEMP_ SEEDING (mechanical post-approval)
   - RELATIONSHIP TRAVERSAL (FK recursive)
   - CONSOLIDATION REVIEW (diff temp vs sys, human-gated)
   - TEMP_ CLEANUP
3. temp_ schema location: `heuresys_advanced.temp_sdbi.*` (new schema, isolated)
4. AI provider: Cowork Claude as supervisor (mapping_card author) + CLI executor (mechanical seed)
5. Confidence threshold: HIGH (>0.85) autopilot, MEDIUM (0.6-0.85) suggest+confirm, LOW (<0.6) halt+ask
6. Lineage tracking: extend `sys.sys_source_lineage_records` with `mapping_card_id` + `confidence` + `human_approver` + `ai_model_id`
7. Audit extensions: new rule_codes `SDBI_CONFIDENCE_HIGH`, `SDBI_CONFIDENCE_MEDIUM`, `SDBI_CONFIDENCE_LOW`, `SDBI_HUMAN_APPROVED`, `SDBI_HUMAN_REJECTED`
8. Bias mitigation: incorporate CW-B16/17/18/19/20 learnings as pre-checks

**Acceptance**: ADR-0014 reviewed + approved by Enzo.

#### P2.2 — Pilot Goals/OKRs (20-35h)

**Why**: Validare SDBI workflow su un caso reale prima di scale-up.

**Macro-area scelta**: Goals/OKRs (Tier D, alta priorità per F10 #1). Volume 5.8k rows + schema completamente missing in target.

**Action**:
1. SDBI Phase 1 (SOURCE DISCOVERY):
   - Read `platform.goals` (1067), `goal_updates` (1811), `goal_check_ins` (1000), `goal_milestones` (1000), `goal_comments` (856), `goal_alignments` (100), `goal_templates` (40), `okrs` (20), `key_results` (20), `okr_checkins` (10)
   - AI semantic analysis per ognuno → produce source_table_cards
2. SDBI Phase 2 (TARGET ANALOGY):
   - AI propose schema: sys_goals + sys_okrs + sys_key_results + sys_goal_milestones + sys_goal_updates + sys_goal_check_ins + sys_goal_alignments + sys_goal_templates
   - AI propose field-by-field mapping con confidence
   - Human review (Enzo) approve schema design
3. Migrations sys.* new tables (~10 new migrations)
4. Restore source data in `legacy_mirror.goals_*` (extend extract script: new domain GOKMER)
5. SDBI Phase 3 (TEMP_ SEEDING):
   - Create temp_sdbi.goals + okrs + etc.
   - INSERT-SELECT mapped from legacy_mirror via SDBI mapping_card
6. SDBI Phase 4 (RELATIONSHIP TRAVERSAL):
   - For each FK in source goals (employee_id, manager_id, etc.) → traverse to dependent tables, ensure temp_sdbi consistency
7. SDBI Phase 5 (CONSOLIDATION):
   - Diff temp_sdbi.goals vs sys.sys_goals (empty)
   - Approve insertion
   - INSERT...ON CONFLICT into sys.sys_goals
   - Build indexes/FK
   - Generate sys.sys_source_lineage_records entries
8. Verify acceptance: sys.sys_goals populated, audit trail OK, integrity OK
9. SDBI Phase 6 (CLEANUP): DROP temp_sdbi.goals_*

**Acceptance**:
- Goals/OKRs macro-area LIVE in sys.* (~5.8k rows)
- SDBI workflow validated end-to-end
- ADR-0014 updates with lessons learned

#### Phase 2 Total: 30-50h

### Phase 3 — SDBI scale across 12 TRUE GAP macro-aree (Week 5-7)

#### P3.1 — Macro-area sequence

Replica Phase 2 pattern per ognuno (ordine consigliato per priority):

1. **Performance reviews + calibration** (Tier D, ~3k rows in platform) — performance lifecycle
2. **Recruiting + hiring extension** (Tier D, ~1.5k rows) — H2R extension
3. **Onboarding + preboarding** (Tier D, ~700 rows)
4. **Surveys + engagement + wellbeing** (Tier D, ~10k rows)
5. **Time + leave + attendance** (Tier D, ~6k rows)
6. **Feedback systems** (Tier D, ~2.1k rows)
7. **Talent pool extension** (Tier D, ~300 rows)
8. **Career detail extension** (Tier D, ~600 rows) — careers, mentorships
9. **News + social** (Tier D, ~2.5k rows) — TBD se in HRMS core scope, può skip
10. **Predictions + ML** (Tier D, ~700 rows) — TBD se SDBI ha valore o se è meta-layer
11. **Documents detail** (Tier D, ~1.5k rows) — sys_user_documents extension
12. **Mentorship full** (Tier D, ~500 rows)

Per ogni: ~7-10h SDBI workflow + ~2-3h human review + ~2-3h migrations new schemas.

#### Phase 3 Total: 80-130h

### Phase 4 — Cleanup + documentation (Week 8)

#### P4.1 — Lineage continuity (3-5h)

- Verify `sys.sys_source_lineage_records` (4099 rows) preserved + extended con SDBI lineage
- Verify cross-tenant integrity (74 tenant_id FK targets validated)

#### P4.2 — Audit extension (2-3h)

- New rule_codes documented + indexed
- Audit query patterns standard per SDBI rules

#### P4.3 — Documentation + runbook (5-12h)

- `docs/sdbi/RUNBOOK.md` — how to run SDBI for new source area
- `docs/sdbi/CONFIDENCE_THRESHOLD_POLICY.md` — when human approve required
- `docs/sdbi/BIAS_CATALOG.md` — CW-B16-B20 lessons + future bias prevention
- `docs/decisions/ADR-0014-sdbi-architecture.md` finalized

#### Phase 4 Total: 10-20h

### Opzione 3 — Grand Total

| Phase | Effort | Cumulative |
|---|---|---|
| Pre-requisites (P-1..P-5) | 2-3h | 2-3 |
| Phase 1 (Class B+C + debt) | 42-78h | 44-81 |
| Phase 2 (SDBI arch + pilot Goals) | 30-50h | 74-131 |
| Phase 3 (SDBI scale 12 macro-aree) | 80-130h | 154-261 |
| Phase 4 (cleanup + docs) | 10-20h | 164-281 |
| **TOTAL** | **~164-281h** ≈ **25-45 sessioni dev** | |

Distribuited 6-8 settimane elapsed time. Time-to-first-result: 1-2 settimane (Phase 1 closure).

---

## §3 — TODO Opzione 1 BROWNFIELD-ONLY (if Enzo prefers Opt1)

Reference: §2 Opzione 1 in `11_STRATEGIC_REFORMULATION.md`.

Sequenza:
1. Pre-requisites P-1..P-5 (~2-3h)
2. Pre-conditions cleanup (~10-20h): working tree fix + CW-B17 audit + CW-B20 UQ + dead code
3. Class B fix Wave 1 silent skip residui (~30-50h)
4. Class C MIRROR GAP extract extension (~2-4h)
5. Wave 2 (TALPIPE + GOKMER) authoring + execution (~28-42h)
6. Wave 3 (PULSAR + SMERTO) authoring + execution (~30-44h)
7. Wave 4 (H2R extension + recruiting/onboarding schemas) authoring + execution (~28-45h)
8. Cleanup + verify (~5-10h)

**Total**: 135-218h ≈ 25-40 sessioni. Time-to-first-result: 1-2 settimane.

**Key difference vs Opt3**: invece di SDBI per Tier D, Opt1 fa MANUAL schema design + manual authoring per le 13 TRUE GAP macro-aree. Più effort per macro-area, no AI assistance, ma pattern noto.

---

## §4 — TODO Opzione 2 SDBI PURO (if Enzo prefers Opt2)

Reference: §3 Opzione 2 in `11_STRATEGIC_REFORMULATION.md`.

Sequenza:
1. Pre-requisites P-1..P-5 (~2-3h)
2. ADR-0014 SDBI architecture spec (~20-40h)
3. Decision destino brownfield: archive/freeze vs migrate (~5-10h)
4. SDBI pilot 1 source FACILE (~10-20h)
5. SDBI Wave 1 REBUILD (re-author 93 source tables via SDBI workflow) (~80-120h)
6. SDBI Wave 2 (TALPIPE + GOKMER) (~40-60h)
7. SDBI Wave 3 (PULSAR + SMERTO) (~40-60h)
8. SDBI Wave 4 (H2R extension + recruiting/onboarding) (~40-60h)
9. Cleanup + migration legacy brownfield → archive (~10-15h)

**Total**: 247-388h ≈ 45-70 sessioni. Time-to-first-result: 4-6 settimane.

**Key difference vs Opt3**: tutto SDBI, no brownfield. Investment 50-60% discarded. Architectural correctness migliore ma effort + time-to-value più alti.

---

## §5 — Acceptance criteria per ognuna delle 3 opzioni

### Opt3 (Recommended) acceptance

✅ **Phase 1 complete**:
- sys.* hit ratio: da 38 popolate a ≥50 popolate (60% improvement)
- silent skip rows: 0 senza audit class (CW-B17 fixed)
- legacy_mirror: 4 MIRROR GAPS resolved (esco_skills 14011 + business_processes 26 + industry_ccnl_mapping 14 + tenant_industry_classifications 4)
- Tests: 318+/318+ verdi (after fix any regression)

✅ **Phase 2 complete**:
- Goals/OKRs macro-area LIVE in sys.* (~5.8k rows)
- ADR-0014 approved
- SDBI workflow validated end-to-end

✅ **Phase 3 complete**:
- 12 TRUE GAP macro-aree LIVE in sys.*
- sys.* hit ratio: ≥80% (95+ popolate / 118 + new sys_goals/sys_recruiting/etc.)
- Total sys.* rows: ~80-100k (from 37k baseline)

✅ **Phase 4 complete**:
- Documentation runbook + ADRs published
- Lineage continuity verified
- Audit infrastructure extended

✅ **Overall**: heuresys_advanced "ready for functional development" — UI può consumare sys.* via API senza ulteriore seed work.

### Opt1 acceptance

✅ Wave 1 hit ratio: ≥85% (12+ silent skip targets risolti)
✅ Wave 2 LIVE: TALPIPE + GOKMER macro-aree popolate
✅ Wave 3 LIVE: PULSAR + SMERTO macro-aree popolate
✅ Wave 4 LIVE: H2R extension + recruiting/onboarding popolate
✅ sys.* hit ratio: ≥80%
✅ Tests + integrity views all pass

### Opt2 acceptance

✅ ADR-0014 + SDBI architecture LIVE
✅ Brownfield archived in clean state
✅ SDBI Wave 1 REBUILD: stesso outcome di brownfield pre-discard
✅ SDBI Wave 2/3/4: TRUE GAP macro-aree LIVE
✅ sys.* hit ratio: ≥80%
✅ AI cost tracking + budget policy in place

---

## §6 — Risk register quantitativo (all 3 options)

| Risk | Opt1 prob | Opt1 impact | Opt2 prob | Opt2 impact | Opt3 prob | Opt3 impact |
|---|---|---|---|---|---|---|
| CW-B16-B20 ripresentati su nuove waves | 80% | MEDIUM | 30% | LOW | 40% | LOW |
| Authoring effort underestimate | 50% | HIGH | 60% | HIGH | 40% | MEDIUM |
| Schema design decisions blocked | 40% | HIGH | 30% | MEDIUM | 30% | MEDIUM |
| Working tree corruption (already detected) | 100% | LOW | 100% | LOW | 100% | LOW |
| AI hallucinations / mapping wrong | 0% | n/a | 60% | MEDIUM | 35% | LOW |
| Scope explosion architectural | 10% | LOW | 70% | HIGH | 20% | LOW |
| Investment discarded | 0% | n/a | 100% | HIGH | 0% | n/a |
| Boundary brownfield vs SDBI confusing | 0% | n/a | 0% | n/a | 40% | LOW |
| Time-to-first-result deferred | 20% | LOW | 80% | HIGH | 20% | LOW |
| Team cognitive load (2 paradigms) | 0% | n/a | 30% | LOW | 50% | LOW |

**Risk-weighted scoring** (manual heuristic):
- Opt1 risk score: ~MEDIUM (HIGH on CW-B repetition + HIGH on authoring effort)
- Opt2 risk score: ~HIGH (HIGH on scope explosion + HIGH on time-to-result + HIGH on AI hallucinations)
- Opt3 risk score: ~LOW-MEDIUM (balanced, no single HIGH risk)

---

## §7 — Decision matrix per Enzo

| Decision dimension | Opt1 | Opt2 | Opt3 |
|---|---|---|---|
| Effort minimum | ❌ 188-282h | ❌ 258-352h | ✅ 148-222h |
| Time-to-first-result | ✅ 1-2w | ❌ 4-6w | ✅ 1-2w |
| Investment preservation | ✅ 100% | ❌ ~50% | ✅ 100% |
| Architectural correctness lungo termine | ⚠️ same paradigm | ✅ new paradigm | ⚠️ mixed |
| Risk arch | ✅ LOW | ❌ HIGH | ✅ LOW |
| TRUE GAP coverage | ⚠️ manual schema design | ✅ AI propose | ✅ AI propose |
| Direttiva Enzo "SDBI complementare" | ❌ no SDBI | ❌ SDBI sostituto | ✅ SDBI complementare |
| Team skill set | ✅ existing | ❌ new learning | ⚠️ mix |
| AI cost | ✅ 0 | ❌ high | ⚠️ medium |
| Default "ready for func dev" | OK | better | best |

**Decision recommendation**: Opt3 wins on 7/10 dimensions, with 2 mixed (architectural long-term, team skill set, AI cost). Opt1 wins on 4/10. Opt2 wins on 2/10.

---

## §8 — Communication template per next session

Per quando Enzo torna domattina e legge il KB, suggerisce di chiudere il loop con:

**Da parte di Enzo**:
> "Letto KB. Confermo Opzione 3 / Opzione N. Procedi con Phase 1.X."

OR

> "Letto KB. Voglio modificare: [X]. Discussione necessaria su: [Y]."

**Da parte mia (Cowork)**:
- Aspetta decisione esplicita
- Non procedere senza green light
- Se Opt3 selected, prima Phase 1 (pre-requisites + Class B+C cleanup), poi Phase 2 (ADR + pilot Goals)
- Mantieni evidence-based mode anche during execution

---

## §9 — Verifications anchors per master TODO

```bash
# Verify Phase 1 readiness:
cd D:\heuresys-advanced
git status -sb                # working tree clean dopo P-1
pnpm --filter @heuresys/api typecheck  # 0 errors
pnpm --filter @heuresys/api test       # 318/318 passed
ssh oracle-vm-default 'ls -lh /home/ubuntu/backups/heuresys_advanced_pre_pivot_*.dump'  # backup exists
ls cowork_reserved/                    # KB 13 files present
cat cowork_reserved/00_README_KB.md    # entry point readable
```

---

*End of 12_TODO_LIST_GRANULARE.md*
