# Knowledge Base — Forensic Audit + Strategic Reformulation

**Owner**: Enzo Spenuso (decisione finale strategica)
**Author**: Cowork Claude (autonomous overnight session 2026-05-20T02:06Z → 03:30Z)
**Scope**: forensic audit completo dei due DB (heuresys_platform SOURCE + heuresys_advanced TARGET) + ricostruzione di TUTTI i flussi che hanno creato/popolato dati in advanced + valutazione evidence-based delle 3 opzioni strategiche
**Restriction**: read-only su DB, no DDL/DML, no commit git, no push, no modifiche apps/db/scripts. ✅ Rispettato.

---

## ✅ Status final (all 12 phases complete)

| Phase | Topic | Deliverable | Status | LOC markdown |
|---|---|---|---|---|
| F0 | Setup KB | this file | ✅ | (this) |
| F1 | Inventory heuresys_platform | `01_DB_PLATFORM_INVENTORY.md` | ✅ | ~350 |
| F2a | Inventory advanced.sys | `02a_ADV_SYS.md` | ✅ | ~210 |
| F2b | Inventory advanced.legacy_mirror | `02b_ADV_LEGACY_MIRROR.md` | ✅ | ~140 |
| F2c | Inventory advanced.staging | `02c_ADV_STAGING.md` | ✅ | ~100 |
| F2d | Inventory advanced.brownfield | `02d_ADV_BROWNFIELD.md` | ✅ | ~150 |
| F2e | Inventory advanced.audit | `02e_ADV_AUDIT.md` | ✅ | ~100 |
| F2f | Inventory advanced.public | `02f_ADV_PUBLIC.md` | ✅ | ~30 |
| F3 | heuresys_test | — SKIPPED per direttiva Enzo "no value" | ⏭️ | — |
| F4 | Migrations timeline | `04_MIGRATIONS_TIMELINE.md` | ✅ | ~1300 (via subagent) |
| F5 | Extract scripts forensic | `05_EXTRACT_SCRIPTS_FORENSIC.md` | ✅ | ~350 |
| F6 | Brownfield registry deep-dive | `06_BROWNFIELD_REGISTRY_DEEP_DIVE.md` | ✅ | ~230 |
| F7 | Transform-compiler code audit (DEEP) | `07_TRANSFORM_COMPILER_ANALYSIS.md` | ✅ | ~340 (via subagent) |
| F8 | Audit trail deep-dive | `08_AUDIT_TRAIL_ANALYSIS.md` | ✅ | ~630 (via subagent) |
| F9 | CASCADIA lexicon domains | `09_LEXICON_DOMAINS_MAPPING.md` | ✅ | ~280 |
| F10 | Gaps analysis real vs apparent | `10_GAPS_ANALYSIS.md` | ✅ | ~570 (via subagent) |
| F11 | Strategic reformulation evidence-based | `11_STRATEGIC_REFORMULATION.md` | ✅ | ~470 |
| F12 | TODO granulare + KB index | `12_TODO_LIST_GRANULARE.md` + this file | ✅ | ~580 |

**Total deliverables**: 14 markdown files, ~5800 righe markdown evidenza forense.

---

## 🎯 RECOMMENDATION

**OPZIONE 3 — HYBRID PRAGMATIC** (confidence HIGH).

Effort: **~148-222h** (~25-40 sessioni dev, distribuited 6-8 settimane elapsed).
Investment preservation: **100%** (brownfield + 33 migrations + 1177 column_mappings + transform-compiler + audit infrastructure).
Time-to-first-result: **1-2 settimane** (Phase 1 closure → sys.* hit ratio 60% → ~80%).

Dettagli completi: `11_STRATEGIC_REFORMULATION.md`.

---

## 📋 Reading order obbligatorio (next session)

1. ☐ **`00_README_KB.md`** (this file — index + status)
2. ☐ **`11_STRATEGIC_REFORMULATION.md`** (recommendation + reasoning) — **LEGGI PRIMA**
3. ☐ **`10_GAPS_ANALYSIS.md`** (gap classification + 5-tier + priorities)
4. ☐ **`12_TODO_LIST_GRANULARE.md`** (master plan operativo)
5. ☐ `01_DB_PLATFORM_INVENTORY.md` (SOURCE, drill-down on demand)
6. ☐ `02a-02f_ADV_*.md` (TARGET 6 schemi, drill-down)
7. ☐ `04_MIGRATIONS_TIMELINE.md` (provenance schemi)
8. ☐ `05_EXTRACT_SCRIPTS_FORENSIC.md` (provenance dati out-of-migration)
9. ☐ `06_BROWNFIELD_REGISTRY_DEEP_DIVE.md` (1177 mappings)
10. ☐ `07_TRANSFORM_COMPILER_ANALYSIS.md` (code audit + 14 transform codes)
11. ☐ `08_AUDIT_TRAIL_ANALYSIS.md` (207k audit rows + silent skip CW-B17)
12. ☐ `09_LEXICON_DOMAINS_MAPPING.md` (CASCADIA 16 sigle + 7 in Wave 1)

---

## ⚠️ Critical findings (top 10)

### Finding 1 — Working tree CORRUPTION (CRITICAL fix immediato)

5 file in `apps/api/src/modules/brownfield-wave-executor/` + 1 test file hanno **878 LOC cancellate accidentalmente** nel working tree. Codice NON compila.

**Fix**: `git checkout HEAD -- <files>` (vedi `12_TODO_LIST_GRANULARE.md §1 P-1`).

### Finding 2 — heuresys_advanced.legacy_mirror è già RICCO (~200k rows, 81/93 popolate)

87% delle tabelle in mirror sono popolate. NON è un mirror vuoto — è un subset selettivo ma denso di heuresys_platform.public.

### Finding 3 — 4 MIRROR GAPS critici da fixare (CW-B22 candidate)

`esco_skills` (14011 rows in platform, 0 in mirror), `business_processes` (26), `industry_ccnl_mapping` (14), `tenant_industry_classifications` (4) MAI scaricati da `extract-wave1-legacy.sh`. Estensione triviale (2-4h).

### Finding 4 — Silent skip pattern quantified (CW-B17)

Latest Wave 1 retry run: **24552 / 41285 rows (59%)** staged+validated PASSED ma NON upserted. L'audit trail NON traccia questi skip. Forensic blind spot critico.

### Finding 5 — Wave 1 brownfield ha effettivamente funzionato per 6 macro-aree

sys_skills 6037, sys_learning_modules 4488, sys_learning_paths 3227, sys_activity_classifications 3276, sys_skill_families 77, sys_compensation_bands 75. **40% hit ratio Wave 1** — NON catastrofico.

### Finding 6 — Brownfield investment ~50-80h engineering

33 migrations + 94 table_mappings + 1164 source_columns + 1177 column_mappings + 14 transform codes + per-target prefix convention + audit infrastructure. Discard = perdita pura.

### Finding 7 — 9+ lexicon domains MISSING (CASCADIA scope)

heuresys-evo project ha 16 sigle canonical, Wave 1 advanced cover solo 7 (ESKAP+SKILGRO+INDOOR+ITLAB+PROGOV+OPOURSKA+H2R). Mancanti: TALPIPE+GOKMER+SMERTO+PULSAR+EPRA+H2R-extension. ~80-100 source tables NOT imported.

### Finding 8 — 13 macro-aree HRMS hanno TARGET DESIGN MISSING

Goals/OKRs (5.8k rows source), Recruiting (1.5k), Onboarding (700), Surveys/Engagement (10k), Time/Leave (6k), Performance reviews, Succession ext, Mentorship, Predictions, Feedback systems, CCNL ext, News/Social, Documents detail. **Nessun sys.* target esiste** per queste aree.

### Finding 9 — 4 tenants in platform → 1 collapsed in advanced

`brownfield.tenant_id_mappings` 4 rows: rtl-bank + smartfood + econova + heuresys System TUTTI puntano a RTL_BANK_REFERENCE. Goal 004 (futuro) farà espansione 1:N.

### Finding 10 — Investment preserved = ~100% in Opt3 vs ~50% in Opt2

Opt3 Hybrid mantiene tutto + estende. Opt2 SDBI puro discard ~50-60% (brownfield registry + transform codes specifici).

---

## 📊 Key numbers (quick reference)

```
SOURCE (heuresys_platform.public):  582 tables, ~700k rows, 1112 MB
TARGET (heuresys_advanced.sys):     118 tables + 11 views, 38 populated (32%), ~37k rows
LEGACY MIRROR (heuresys_advanced):  93 tables, 81 populated (87%), ~200k rows
STAGING (Wave 1):                   17 tables, 41285 staged rows
BROWNFIELD REGISTRY:                94 table_mappings + 1177 column_mappings + 1164 source_columns
AUDIT TRAIL:                        207276 validation results + 355 approvals + 50 run logs
MIGRATIONS:                         33 applied 2026-05-18/19
LEXICON DOMAINS:                    7/16 covered in Wave 1 (ESKAP+SKILGRO+INDOOR+ITLAB+PROGOV+OPOURSKA+H2R)
SILENT SKIP latest run:             24552/41285 (59%) — CW-B17
HIT RATIO Wave 1:                   6/15 target ≥1 row (40%)
CW BIAS CATALOG:                    CW-B16, B17, B18, B19, B20 (5 bias identified)
```

---

## 🚀 Next session — first actions

1. ☐ Read this README + `11_STRATEGIC_REFORMULATION.md` + `12_TODO_LIST_GRANULARE.md`
2. ☐ **Decide opzione**: Opt1 / Opt2 / **Opt3 (recommended)** / mix
3. ☐ Eseguire pre-requisites P-1..P-5 (~2-3h):
   - P-1: git working tree restore (CRITICAL)
   - P-2: backup pg_dump
   - P-3: 8 commits ahead origin/main decision
   - P-4: cowork lock cleanup
   - P-5: heuresys_test decision
4. ☐ Iniziare Phase 1 dell'opzione scelta

---

## 🔐 Verification + reproducibility

Tutte le query SQL eseguite sono documentate in §"Verification anchors" di ogni deliverable. Ri-eseguibili via:

```bash
ssh -i ~/.ssh/oci_key ubuntu@80.225.82.207 'sudo -u postgres psql -d <db_name> -f /tmp/query.sql'
```

SSH key: `~/.ssh/oci_recovery_ed25519` (Windows) / `~/.ssh/oci_key` (sandbox sessione).
DB cluster: oracle-vm-default:5432, Postgres 16.14.

---

## 📝 Methodological commitments respected ✅

1. ✅ Every assertion verified-by-stamp (SQL query + file:line + sha)
2. ✅ No "best practices generiche" — only evidence specifica
3. ✅ R5 test-before-claim — ogni "X esiste/Y vuoto" verificato
4. ✅ R14 anti-bias — evidence contraria cercata prima conclusione
5. ✅ Bias catalog: CW-B16-B20 identificati e mitigation proposte
6. ✅ "Non verificato" esplicito dove incertezza
7. ✅ Decisione finale strategica **NON imposta** — Enzo decide

---

## 🎁 Bonus deliverables non richiesti ma utili

| Bonus | Path | Why |
|---|---|---|
| Bias catalog mitigations | `11_STRATEGIC_REFORMULATION.md §1.4` + `12_TODO_LIST_GRANULARE.md` | Documenta CW-B16-B20 con mitigation steps per ogni opzione |
| FK graph synthesis sys.* | `02a_ADV_SYS.md §5` | 319 FK constraints mappati, top targets sys_users (130 ref), sys_tenancies (74) — utile per SDBI relationship traversal |
| `EXPLICIT_MAP` reverse engineering | `05_EXTRACT_SCRIPTS_FORENSIC.md §3` | 93 source → target mapping decisions from `generate_wave1_seeds.mjs` — riusabile per Wave 2/3/4 |
| Lifecycle pattern documented | `02e_ADV_AUDIT.md §4` + `08_AUDIT_TRAIL_ANALYSIS.md` | RUN_CREATED → ... → STATE_COMPLETE pattern stable cross-run, asset-grade per SDBI extension |
| Validation views asset | `02a_ADV_SYS.md §4` | 11 sys.v_* validation views utili pre/post SDBI sanity check |

---

## 🏁 Summary one-paragraph (TL;DR)

**heuresys_advanced è in stato più maturo del previsto**: 6 schemi, 233 tables, ~600 MB, 38/118 sys.* popolate, ~200k rows in legacy_mirror (87% hit), 207k audit rows, 1177 column_mappings authored. **L'investment brownfield ~50-80h è significativo e parzialmente funzionante** (6 macro-aree popolate, 40% hit Wave 1). I problemi specifici (CW-B16-B20) sono **fixabili senza pivot strategico totale**. **Opzione 3 Hybrid** (brownfield default + SDBI per Tier D TRUE GAP macro-aree) ha il **minor effort (148-222h vs 188-282 Opt1, vs 258-352 Opt2)**, preserva 100% investment, time-to-first-result 1-2 settimane, e honora la direttiva originale di Enzo ("SDBI come tool SPECIFICO complementare, non sostituto"). Decisione finale resta a Enzo, ma evidence supporta Opt3 con confidence HIGH.

---

*KB completata 2026-05-20T03:30Z. Cowork rilascia il lock. Buongiorno Enzo.*
