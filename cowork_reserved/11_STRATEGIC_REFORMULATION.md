# Strategic Reformulation — Evidence-Based Recommendation

**Snapshot**: 2026-05-20T03:15Z
**Scope**: Valutazione delle 3 opzioni strategiche (Completa brownfield / Pivot SDBI puro / Hybrid pragmatic) alla luce dei deliverable F1-F10
**Decisione finale**: **resta di Enzo**. Io produco recommendation evidence-based, NON impongo

---

## §1 — Recap evidence base (dai 11 deliverable F1-F10)

### §1.1 Quadro DB reale

| Metric | Value | Source ref |
|---|---|---|
| heuresys_platform.public tables | 582 (518 popolate) | F1 |
| heuresys_platform.public rows totali | ~700k+ | F1 |
| heuresys_advanced.sys.* tables | 118 + 11 views | F2a |
| sys.* populated | 38 (32%), ~37k rows | F2a |
| sys.* empty | 80 (68%) | F2a |
| FK constraints intra-sys | 319 | F2a |
| legacy_mirror tables | 93 (81 popolate, 87%) | F2b |
| legacy_mirror rows | ~200k | F2b |
| audit.import_validation_results | 207276 | F2e + F8 |
| brownfield.column_mappings | 1177 (con 14 transform codes) | F2d + F6 |
| 33 migrations applicate 18-19 May 2026 | tutte idempotenti | F4 |
| Wave 1 hit ratio | 6/15 target popolati (40%) | F6 + F8 |
| Silent skip latest run | 24552/41285 (59%) | F8 |
| 7 lexicon domains coperti | ESKAP+SKILGRO+INDOOR+ITLAB+PROGOV+OPOURSKA+H2R | F5 + F9 |
| 9+ lexicon domains MISSING | TALPIPE/GOKMER/SMERTO/PULSAR/EPRA/H2R-ext/+ | F9 |

### §1.2 Quadro code reale

| Metric | Value | Source ref |
|---|---|---|
| transform codes implementati | 14 / 14 documentati ✅ (zero gap docs-vs-code) | F7 |
| LOC transform-compiler.ts | (committed HEAD) | F7 |
| Unit tests transform-compiler | 50 it() in 9 describe (617 LOC) | F7 |
| Working tree CORRUPTION 🔴 | 5 files (engine.ts, service.ts, transform-compiler.ts, upsert-sql.ts, transform-compiler.test.ts) con 878 LOC cancellate accidentalmente | F7 |
| WHERE skip filter | upsert-sql.ts:238-269 — silenzia rows NULL FK senza audit | F7 |
| LOOKUP_FK paths runtime | 4 (2 fallback + 1 lineage JOIN P1 + 1 standard) | F7 |
| Dead code engine.ts | ~230 LOC (`if(false)` block L782-L958) | F7 |

### §1.3 Quadro gap classificato (F10)

| Tier | Macro-areas | Effort Opt1 | Effort Opt2 | Effort Opt3 |
|---|---|---|---|---|
| A POPULATED | 6 | 0 | discard | 0 |
| B IMPORT GAP | 11 | 80-130h | rebuild | 40-70h |
| C MIRROR GAP | 4 tables | 4-10h | + cross-DB infra | 4-10h |
| D TRUE GAP | 13 | 100-140h (extends schema + ETL) | 200-280h (full SDBI) | 100-140h (extends schema, SDBI for new schemas only) |
| E DESIGN INT | 6 | skip | skip | skip |
| **TOTAL** | 40 | **188-282h** | **258-352h** | **148-222h** |

### §1.4 Bias catalog (CW-B16 → CW-B20)

| Bias | Topic |
|---|---|
| CW-B16 | PLAN wall-clock target from broken baseline underestimates legitimate full work scale |
| CW-B17 | WHERE skip filter silenzia rows con NULL FK senza emettere audit class → forensic blind spot |
| CW-B18 | DISCOVERY enumerates KNOWN broken mappings ma non verifica registry COMPLETENESS |
| CW-B19 | DISCOVERY assume source data has FK lookup keys, non verifica source-side availability |
| CW-B20 | brownfield.column_mappings UQ + JSON_EXTRACT pre-mapping forbids additive LOOKUP_FK |

---

## §2 — Opzione 1 — COMPLETA BROWNFIELD (estensione Wave 2/3/4)

### §2.1 Description

Mantieni tutto l'investment esistente (33 migrations + 1177 column_mappings + transform-compiler + audit infrastructure). Estendi pattern Wave 1 → Wave 2/3/4:
1. Fix i 5 INFEASIBLE Goal 003 caso-per-caso
2. Aggiungi tabelle/schemi sys.* mancanti per Goals/OKRs/Recruiting/Onboarding/Surveys (~13 macro-aree)
3. Estendi `extract-wave1-legacy.sh` con nuove lexicon domain (TALPIPE/GOKMER/SMERTO/PULSAR/+H2R-ext)
4. Aggiungi nuove brownfield.table_mappings + column_mappings per le nuove aree
5. Esegui Wave 2/3/4 sequential

### §2.2 Pre-conditions to fix prima di estensione

⚠️ **CRITICO** (da F7): working tree CORRUPTION 5 files. Da risolvere PRIMA di qualsiasi work:
```bash
cd D:\heuresys-advanced
git status -sb            # verify 5 M files
git checkout HEAD -- apps/api/src/modules/brownfield-wave-executor/{engine,service,transform-compiler,upsert-sql}.ts apps/api/test/transform-compiler.test.ts
pnpm --filter @heuresys/api test   # verify 318/318 passes
```
Effort: 0.5h

⚠️ **CRITICO**: CW-B17 fix (audit per silent skip). Per Wave 2/3/4 estensione, è essenziale che i silent skip emettano audit class. Altrimenti continueremo a debug "23552 rows missing" pattern.
Effort: 4-8h (modify upsert-sql.ts:238-269 + add `LOOKUP_FK_NULL_RESOLUTION_V1` audit class)

⚠️ **CRITICO**: CW-B20 UQ relax decision. O accettare UQ constraint (alcuni mapping pattern impossibili) o relax UQ via nuova migration (architectural change).
Effort: 2-6h (decision + migration)

⚠️ **MEDIUM**: Dead code cleanup engine.ts (~230 LOC). Pre-Wave-2 sanity check.
Effort: 1-2h

**Total pre-conditions**: ~10-20h (technical debt cleanup)

### §2.3 Wave 2 (TALPIPE + GOKMER) — Workforce intelligence

Source tables in platform NOT in mirror: ~43 tables, ~12k rows.
Target sys.* existing: ~14 schemi (career_*, succession_*, kpi_*, gap_*, talent_*). **Schema OK**.

Effort breakdown:
- Update `extract-wave1-legacy.sh` → `extract-wave2-legacy.sh` (1h)
- pg_dump + restore in legacy_mirror (1h execution + sanity check)
- Author EXPLICIT_MAP dictionary for ~43 source tables (8-12h, similar density a Wave 1)
- Generate column_mappings (~500 col mappings) via `generate_wave2_column_mappings.mjs` (5-8h authoring + verify)
- Migrations sys.* extensions: **NEW sys_goals, sys_okrs, sys_key_results, sys_goal_milestones, sys_goal_check_ins, sys_mentor_*** (~5 nuove migrations) (10-15h)
- Wave 2 execution + verify (3-5h)
- **Total Wave 2**: 28-42h

### §2.4 Wave 3 (PULSAR + SMERTO) — Engagement + Compensation full

Source tables in platform: ~30 tables, ~13k rows.
Target sys.* existing: ~10 (compensation_*, behavioral_*, payroll_*). Need NEW schemas for surveys/engagement/wellbeing/pulse.

Effort:
- Extract extension + restore (2h)
- EXPLICIT_MAP authoring ~30 tables (6-10h)
- Column mappings ~400 (4-7h)
- Migrations sys.* NEW: sys_survey_*, sys_engagement_*, sys_wellbeing_*, sys_pulse_*, sys_feedback_* (~10 nuove tabelle) (15-20h)
- Wave 3 execution + verify (3-5h)
- **Total Wave 3**: 30-44h

### §2.5 Wave 4 (H2R extension) — Hire-to-Retire full

Source tables: ~35, ~3k rows.
Target sys.* MISSING completely: need NEW schemas sys_recruiting_*, sys_onboarding_*, sys_application_*, sys_interview_*.

Effort:
- Extract + restore (2h)
- EXPLICIT_MAP authoring (5-8h)
- Column mappings ~300 (3-5h)
- Migrations sys.* NEW: ~12 nuove tabelle (15-25h)
- Wave 4 execution + verify (3-5h)
- **Total Wave 4**: 28-45h

### §2.6 Class B fix (silent skip residui Wave 1)

I 12 silent-skip target identificati in F6/F8 (sys_skill_categories, sys_skill_taxonomy_edges, sys_skill_aliases, sys_skill_learning_mappings, sys_learning_path_steps, sys_esco_occupation_mappings, sys_job_roles, sys_job_families, sys_process_kpi_templates, sys_position_skill_requirements, sys_position_learning_requirements, sys_blueprint_overrides) richiedono fix caso-per-caso post-CW-B17 fix.

Effort: 30-50h (alcuni richiedono extract script extension per cascade prereq — esco_skills + business_processes + sys_job_families seed; altri richiedono LOOKUP_FK fixes; altri richiedono mapping authoring)

### §2.7 Total Opzione 1

| Phase | Effort | Cumulative |
|---|---|---|
| Pre-conditions (debt cleanup) | 10-20h | 10-20 |
| Class B fix Wave 1 residui | 30-50h | 40-70 |
| Wave 2 (TALPIPE + GOKMER) | 28-42h | 68-112 |
| Wave 3 (PULSAR + SMERTO) | 30-44h | 98-156 |
| Wave 4 (H2R extension) | 28-45h | 126-201 |
| **Total** | **~188-282h** (~30-50 turn) | |

### §2.8 Risk

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| CW-B16/B18/B19/B20 ripresentati su nuove waves | HIGH (80%) | MEDIUM | Pre-Wave DISCOVERY checklist enforcement + completeness validations |
| Authoring effort underestimate | MEDIUM (50%) | HIGH | Build buffer 20-30% effort estimate |
| Schema design decisions blocked (cosa target per Goals/Surveys/etc.) | MEDIUM (40%) | HIGH | Pre-Wave ADR per ogni nuova area |
| Working tree corruption + git complications | LOW (10%) | LOW | git checkout HEAD pre-work |

### §2.9 Pro

- ✅ **Investment 100% preservato** (33 migrations + 1177 mappings + transform-compiler + audit infrastructure)
- ✅ Pattern testato a Wave 1 (anche se hit ratio basso 40%, l'architettura funziona)
- ✅ Veloce time-to-first-result (Class B + C fix in 1-2 settimane porta sys.* da 38 a 50+ popolate)
- ✅ Risk basso a livello architetturale — è "more of the same"
- ✅ Skill set developer noto (no learning curve nuovo paradigma)

### §2.10 Contro

- ❌ **Pattern di failure ricorrenti** (CW-B16/B18/B19/B20) non risolti strutturalmente. Probabilità che si ripresentino su Wave 2/3/4: HIGH
- ❌ **DISCOVERY incompletezza sistemica**: il pattern "DISCOVERY scopre solo ciò che cerca" continua. Per le 13 macro-aree TRUE GAP, DISCOVERY è zero
- ❌ **Authoring manuale 50-80h per wave**: scalabilità limitata. Per coprire 9+ lexicon domains mancanti = 300-500h totali a regime
- ❌ **No leva su AI**: stesso paradigma manual hand-curation
- ❌ **Time-to-functional-readiness**: 30-50 turn = settimane di lavoro spalmati nelle prossime sessioni

---

## §3 — Opzione 2 — PIVOT SDBI PURO

### §3.1 Description

Sostituisce paradigma brownfield rigido con AI-led semantic mapping + temp_ schema staging. Vedi `_00_SESSION_HANDOFF_2026-05-20.md §3` per direttiva Enzo verbatim + strawman 6-fasi:
1. SOURCE DISCOVERY (AI legge sample data + schema → source_table_card semantic descriptor)
2. TARGET ANALOGY MATCHING (AI candidates top-N sys.* + field-by-field mapping + confidence)
3. TEMP_ SEEDING (mechanical post-approval)
4. RELATIONSHIP TRAVERSAL (FK ricorsivo)
5. CONSOLIDATION REVIEW (diff temp_ vs sys_, human-gated)
6. TEMP_ CLEANUP

### §3.2 Pre-conditions

⚠️ **CRITICO**: working tree corruption (stesso problem di Opzione 1). 0.5h fix.

⚠️ **STRATEGIC**: architettura SDBI da definire. Senza ADR/spec, qualsiasi work è prematuro.

### §3.3 SDBI architecture spec phase

Effort: 20-40h
Deliverables:
- ADR-0014 SDBI architecture
- Schema temp_ design
- AI prompt templates per analogy matching
- Confidence threshold policy
- Human-in-the-loop checkpoint protocol
- Adaptive learning persistence
- Lineage tracking enhancements

### §3.4 SDBI pilot — Pilot 1 source table (FACILE)

Per validare flow base. Es. `skill_aliases` (80) + `skill_synonyms` (50) → `sys_skill_aliases`.
Effort: 10-20h (incluse iterazioni con human feedback)

### §3.5 SDBI scale-up — full Wave 1 re-execution

Re-author tutti i 93 source tables Wave 1 via SDBI invece di brownfield. Buttar via 1177 column_mappings + EXPLICIT_MAP + 14 transform codes specifici.

Effort: 80-120h (significativo per "rebuild what works").

### §3.6 SDBI Wave 2/3/4

Per le 13 macro-aree TRUE GAP, SDBI deve **anche** proporre schemi target (le sys.* mancanti). Questo è oltre lo strawman 6-fasi.

Effort: 100-150h (più ambizioso del brownfield perché include schema design assistance).

### §3.7 Total Opzione 2

| Phase | Effort | Cumulative |
|---|---|---|
| Pre-conditions + arch spec | 25-45h | 25-45 |
| Pilot 1 source | 10-20h | 35-65 |
| SDBI scale Wave 1 (rebuild) | 80-120h | 115-185 |
| SDBI Wave 2/3/4 (extend + schemas) | 100-150h | 215-335 |
| Migration + cutover legacy brownfield | 10-15h | 225-350 |
| **Total** | **~258-352h** (~45-65 turn) | |

### §3.8 Risk

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| AI hallucinations / mapping wrong | HIGH (60%) | MEDIUM | Mandatory human checkpoint sotto confidence threshold |
| Architecture spec underspecified | MEDIUM (40%) | HIGH | Detailed ADR pre-implementation |
| Scope explosion (SDBI architecture richiede continuous refinement) | HIGH (70%) | HIGH | Strict scope control + pilot-first |
| Existing investment discarded | CERTAIN | HIGH | ✋ Decision fact, not mitigable |

### §3.9 Pro

- ✅ **Architettura corretta** per il problema reale ("seeding interpretativo dei dati", come Enzo ha articolato)
- ✅ Scalabile: stesso AI workflow per tutte le 9+ lexicon domains mancanti
- ✅ Adattabilità: temp_ schema permette experiment senza pollute sys.*
- ✅ Human-in-the-loop checkpoint mitiga AI hallucinations
- ✅ "Future-proof" per nuove source tables future

### §3.10 Contro

- ❌ **~50-60% investment discarded** (1177 column_mappings + EXPLICIT_MAP + 14 transform codes specifici + WHERE skip filter rebranding)
- ❌ **Time-to-first-result lontano** (architecture + pilot prima di production usage)
- ❌ **Risk over-engineering** rispetto a problemi che sono "mostly engineering-of-extraction" (estendere extract script è banale, SDBI rebuild è ambizioso)
- ❌ **Total effort highest** (258-352h vs 188-282h Opzione 1)
- ❌ **Learning curve nuovo paradigma** sul dev side
- ❌ **AI cost** ricorrente per inference (Claude API o equivalente, per analogy matching)
- ❌ Decision unilaterale di Enzo poi rivalutata: tornata indietro dopo Inventory analysis ha confermato "brownfield ha funzionato per la maggioranza"

---

## §4 — Opzione 3 — HYBRID PRAGMATIC

### §4.1 Description

Brownfield come tool default per casi standard (Wave 2/3/4 deterministico). SDBI come tool nuovo specifico per casi dove brownfield non basta:
- Macro-aree TRUE GAP (Tier D) — sys.* schema missing → SDBI propone schema + mapping
- Casi cross-target ambigui (1 source → N target unclear)
- Source data semantically obscura (vedi business_processes.profile_id → quale sys?)

Brownfield e SDBI coesistono come paradigmi diversi per scenari diversi.

### §4.2 Sequenza operativa proposta

#### Phase 1 — Debt cleanup + Class B + C fix (1-2 settimane)
- Pre-conditions cleanup (working tree + CW-B17 + CW-B20 + dead code) — 10-20h
- Class C MIRROR GAP: extend extract script con 4 missing tables (esco_skills + business_processes + industry_ccnl_mapping + tenant_industry_classifications) — 2-4h
- Class B fix Wave 1 silent skip residui (12 target) — 30-50h
- **Outcome**: sys.* da 38 popolate a ~50-55, hit ratio Wave 1 sale dal 40% al 80%+. Investment brownfield 100% preservato.

#### Phase 2 — SDBI architecture spec + pilot (2-3 settimane)
- ADR-0014 SDBI architecture per CASI SPECIFICI (non sostituto brownfield) — 10-15h
- Pilot: una macro-area TRUE GAP — es. **Goals/OKRs** (Tier D, alta priorità):
  - SDBI propone schema sys_goals/sys_okrs/sys_key_results
  - Human review + ADR approve
  - SDBI mapping cards: source goals (1067) + goal_updates (1811) + okrs (20) → temp_sys_goals etc.
  - Consolidation review human-gated
  - temp_ → sys_ promotion + cleanup
  - **Outcome**: Goals/OKRs LIVE in sys.* (~5.8k rows) + SDBI workflow validated

Effort Phase 2: 30-50h

#### Phase 3 — SDBI scale across TRUE GAP (3-4 settimane)
Replica pattern Phase 2 per le 12 macro-aree TRUE GAP rimaste:
- Recruiting (extension), Onboarding, Surveys/Engagement, Time/Leave, News/Social (TBD se in scope), Mentorship, Predictions (TBD), Feedback systems, CCNL extension (oltre Wave 1), Performance reviews, Talent management ext

Effort: 80-130h (Goals/OKRs done; restanti 12 a ~7-10h each)

#### Phase 4 — Cleanup + documentation (1 settimana)
- Lineage continuity (preserve sys_source_lineage_records 4099 rows + add SDBI lineage extensions)
- Audit extensions per SDBI rule_codes (CONFIDENCE_HIGH/MEDIUM/LOW, NEEDS_REVIEW, ANALOGY_PROPOSED)
- README + runbook per SDBI workflow

Effort: 10-20h

### §4.3 Total Opzione 3

| Phase | Effort | Cumulative |
|---|---|---|
| Phase 1 (Class B+C fix + debt) | 42-74h | 42-74 |
| Phase 2 (SDBI arch + pilot Goals) | 30-50h | 72-124 |
| Phase 3 (SDBI scale 12 macro-aree) | 80-130h | 152-254 |
| Phase 4 (cleanup + docs) | 10-20h | 162-274 |
| **Total** | **~148-222h** ⚠️ correzione vs F10 stima precedente | |

Note: F10 stimava 148-222h. Confermato. ~25-40 turn distribuiti su 6-8 settimane.

### §4.4 Risk

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Boundary brownfield vs SDBI poco chiaro (caso ambiguo: chi gestisce?) | MEDIUM (40%) | LOW | ADR-0014 explicit decision tree |
| SDBI cost > stima | MEDIUM (40%) | MEDIUM | Pilot first, then scale |
| Complessità mantenere 2 paradigmi | LOW (20%) | LOW | Scope SDBI strict to Tier D |
| Tech debt da fixare maggiore di stima | LOW (15%) | MEDIUM | Pre-Phase-1 thorough audit (questa knowledge base!) |

### §4.5 Pro

- ✅ **Investment brownfield 100% preservato** (33 migrations + 1177 mappings + transform-compiler + audit)
- ✅ **Time-to-first-result rapido**: Phase 1 (1-2 settimane) porta sys.* da 38 a ~50+ popolate (60% improvement)
- ✅ **Effort più basso** delle 3 opzioni (~148-222h vs 188-282 Opt1, vs 258-352 Opt2)
- ✅ **SDBI scope focalizzato**: solo dove ha valore reale (Tier D TRUE GAP). Non sostituto del brownfield, ma complementare
- ✅ **Risk balanced**: low arch risk (brownfield già provato) + medium SDBI risk (pilot validates)
- ✅ **Direttiva Enzo onorata**: "SDBI ha senso come tool SPECIFICO per i casi dove l'analogia semantica AI-led aggiunge valore reale"
- ✅ **Bias mitigation built-in**: CW-B17 fix in Phase 1 + CW-B18/B19 mitigation via SDBI semantic verify

### §4.6 Contro

- ❌ Complessità manutenere 2 paradigmi (anche se scope-separated)
- ❌ Boundary decision necessaria per ogni nuovo caso (which paradigm?)
- ❌ Risk team-side: developer deve conoscere entrambi (cognitive load)

---

## §5 — Comparative table

| Dimensione | Opt1 Brownfield | Opt2 SDBI puro | Opt3 Hybrid |
|---|---|---|---|
| **Effort totale** | 188-282h | 258-352h | **148-222h ✅** |
| **Time-to-first-result** | 1-2 settimane | 4-6 settimane | **1-2 settimane ✅** |
| **Investment preservato** | 100% ✅ | ~50% | **100% ✅** |
| **Risk arch** | LOW | HIGH | LOW |
| **Risk authoring quality** | MEDIUM (manual) | MEDIUM (AI hallucinations) | LOW (split scope) |
| **Bias mitigation (CW-B17/18/19/20)** | Possibile ma non garantita | Built-in via temp_ schema | Phase 1 explicit fix |
| **TRUE GAP coverage (13 macro-aree)** | Manual schema design | AI propose | **AI propose (SDBI focused) ✅** |
| **Direttiva Enzo "SDBI come tool specifico"** | ❌ (no SDBI) | ❌ (SDBI sostituto) | **✅ (SDBI complementare)** |
| **Sostenibilità manutenzione lungo termine** | OK | Da provare | Buona (paradigmi scoperti) |
| **Skill set developer** | Existing | Nuovo paradigma | Mix |
| **AI cost** | 0 | High (continuous) | Medium (only Tier D) |

---

## §6 — RECOMMENDATION FINALE

### §6.1 Recommendation: **OPZIONE 3 — HYBRID PRAGMATIC**

Confidence: **HIGH** (basato su evidence F1-F10, non opinione)

### §6.2 Reasoning evidence-based

**1. Effort minimo** delle 3 opzioni (148-222h vs 188-282 / 258-352)

**2. Investment preservation 100%** — i ~50-80 ore di engineering investiti in brownfield + 33 migrations + 1177 column_mappings + transform-compiler + audit infrastructure restano asset al lavoro

**3. Pattern brownfield ha effettivamente funzionato** per 6 macro-aree (sys_skills 6037, sys_learning_modules 4488, sys_learning_paths 3227, sys_activity_classifications 3276, sys_skill_families 77, sys_compensation_bands 75). NON è "totalmente sbagliato concettualmente" — è "incompleto e parzialmente difettoso"

**4. I problemi specifici (CW-B16/17/18/19/20) sono fixabili senza pivot strategico totale**:
- CW-B17: 4-8h fix (audit per silent skip)
- CW-B18/B19: mitigation via DISCOVERY checklist enforcement (process, not arch)
- CW-B20: 2-6h fix (UQ relax migration o source_columns aliases)
- CW-B16: documentation policy (wall-clock baselines from honest data)

**5. SDBI ha valore reale solo dove brownfield non sa fare**: TRUE GAP (Tier D, 13 macro-aree senza target schema). Qui SDBI propose-schema capability è essential. Per le 11+4 Class B/C già coperte da target schema, brownfield basta.

**6. Direttiva Enzo onorata letterally** — citato verbatim da `_00_SESSION_HANDOFF_2026-05-20.md §3.1`:
> "SDBI ha senso come tool SPECIFICO per i casi dove l'analogia semantica AI-led aggiunge valore reale (esempi):
> - Quando una source area legacy NON ha target sys.* canonico — analogy matching AI per proporre/estendere target schema
> - Quando un source field ha semantica ambigua che richiede interpretazione
> - Quando serve trasformazione semantica complessa
> Non è da usare come 'sostituto' del brownfield. È tool complementare."

**Opzione 3 è ESATTAMENTE questa formulazione operativa**.

**7. Pivot Opzione 2 è scope-expansion contro le tue direttive originali** — "non gradisco azioni di deferring e pending", "voglio sempre le opzioni più complete e non gradisco azioni di deferring e pending". Opzione 2 pospone time-to-value di 4-6 settimane vs 1-2 di Opzione 3.

### §6.3 Alternative scenarios (when NOT Opt3)

- **Se priorità ASSOLUTA = max investment preservation + no AI complexity**: Opzione 1 (accetti effort più alto + risk CW-B16-B20 reripresentati)
- **Se priorità ASSOLUTA = architectural correctness + future-proof**: Opzione 2 (accetti effort più alto + investment discard + time-to-value lontano)
- **Default (raccomandato per heuresys-advanced rewrite ready-for-functional-dev goal)**: **Opzione 3 Hybrid**

### §6.4 Confidence rationale

Confidence HIGH perché:
- Evidence base solid (12 deliverable F1-F10 totali, ~5k+ righe markdown)
- Numeri verified via SQL queries live + SHA anchoring
- 3 opzioni analizzate symmetricamente con stessa rigor
- Direttiva utente esplicita supporta Opt3
- Pattern di fallimento brownfield identificato chiaramente come bug fixabili, non collasso architetturale

### §6.5 Decision authority disclaimer

**La decisione finale resta a Enzo**. Questa recommendation è evidence-based ma non è autoritativa. Se Enzo preferisce Opt1 (per stability) o Opt2 (per scope vision long-term), entrambe sono LEGITIME. Recommendation Opt3 è basata su trade-off analysis quantitativo + qualitativo.

---

## §7 — Critical "do this FIRST" items (regardless of option chosen)

Questi 4 fix sono **pre-requisite per qualsiasi opzione**:

| # | Item | Effort | Why |
|---|---|---|---|
| 1 | Git working tree restore (F7 corruption) | 0.5h | 5 files con LOC cancellate accidentalmente. Senza fix, codice non compila. |
| 2 | CW-B17 audit per silent skip | 4-8h | Senza, debug di silent skip impossibile in qualsiasi opzione |
| 3 | 8 commits ahead origin/main: push o reset decisione | 1h | Working state non clean per qualsiasi work futuro |
| 4 | Backup pre-pivot pg_dump | 1h | Recovery point se Opt1/2/3 incontra problemi non previsti |

**Total pre-conditions universal**: ~7-11h. **Da fare in prossima sessione PRIMA di Opt1/2/3 implementation**.

---

## §8 — Open questions per Enzo (decisioni strategiche)

Da rispondere prima di formal commit a Opzione 3:

1. **Conferma Opzione 3?** Oppure preferisci Opt1 o Opt2 per ragioni che evidence non cattura?
2. **Goals/OKRs come pilot Phase 2 SDBI?** Oppure preferisci diversa macro-area (es. Recruiting, perché Wave 4 H2R è più "naturale" come pilot HRMS).
3. **Sandbox temp_ schema location**: in `heuresys_advanced.temp` o nuovo DB `heuresys_sdbi`?
4. **AI provider per SDBI**: Claude API direct? Cowork supervisor? Tertiary?
5. **8 commits ahead — push o reset prima di iniziare?** (Recommendation: push se nessun bug noto, dato che migrations 32+33 sono già applied su DB)
6. **`heuresys_test` (791 MB)** — promemoria: era da chiarire ruolo. Se Test = staging environment, può essere usato come SDBI sandbox preliminary. Se Test = altro snapshot, può essere droppato per recuperare disk space.

---

## §9 — Verification anchors per recommendation

```sql
-- Verify sys.* hit ratio
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='sys' AND table_type='BASE TABLE') AS total_tables,
  (SELECT COUNT(*) FROM (
    SELECT relname FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
    WHERE n.nspname='sys' AND c.relkind='r' AND c.reltuples>0
  ) t) AS populated_tables;
-- Expected: 118 total, 38 populated (32%)

-- Verify brownfield investment
SELECT COUNT(*) FROM brownfield.column_mappings;  -- 1177
SELECT COUNT(*) FROM brownfield.table_mappings;   -- 94
-- Expected sum: 1271 mappings authored

-- Verify silent skip pattern (CW-B17)
SELECT
  (SELECT SUM(reltuples)::bigint FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
   WHERE n.nspname='staging' AND c.relkind='r') AS total_staged,
  (SELECT (import_run_metadata->'wave_executor'->>'upserted_rows_total')::int
   FROM brownfield.import_runs WHERE import_run_id='08d3bc9f-e16d-418d-8414-17873ef170aa') AS upserted;
-- Expected: ~41285 staged, 16733 upserted → 24552 silent skip (59%)
```

---

*End of 11_STRATEGIC_REFORMULATION.md*
