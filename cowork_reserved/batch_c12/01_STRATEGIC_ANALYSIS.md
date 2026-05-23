# Strategic Analysis post-X11 — SDBI capacity exhaustion + pivot options

**Status**: pre-emptive analysis (in attesa REPORT 015 X11)
**Author**: Cowork batch C12.1
**Date**: 2026-05-23
**Triggered by**: PROMPT 015 X11 §10 (post-X11 outlook deferred to C12)

---

## §1 — State of the union (live audit)

### Database population live (verified 2026-05-23T18:00Z)

| Metric | Valore | Note |
|---|---:|---|
| sys.* total tables | 134 | (era 128 in mio mental model — verifica live più accurata) |
| sys.* populated (n_live_tup > 0) | 59 | 44% coverage |
| legacy_mirror total tables | 116 | source pool |
| brownfield.table_mappings IMPORT | 83 | mappings active |
| brownfield.table_mappings REFERENCE_ONLY | 14 | (post-X8/X11 re-classify) |
| Engine bias catalog | 49 | stable (no surface in X10) |
| ADR accepted | 17 | inclusi 0014 SDBI, 0015/0016/0017 engine, 0018 COALESCE-UQ |
| Migrations applied | 000043 | LOOKUP_FK_2HOP validator |
| Test suite | 336/342 | post-X10 |

### Macro-aree SDBI status

| Macro-area | Status post-X10 | Source data |
|---|---|---|
| OPOURSKA (base ontology) | ✅ active (sys_users 433, sys_job_roles 202, sys_skills 20048) | abundant |
| ESKAP (ESCO + Knowledge) | ✅ partial (sys_esco_occupation_mappings 7645) | abundant via esco_skills 14011 |
| GOKMER (Goals/Performance) | ✅ Goals/OKRs shipped X3 (sys_goals 1067) + partial Performance X11 (517 rows pending) | scarsa post-X11 |
| ITLAB (Italian Labor) | ✅ shipped pre-X1 (legacy) | n/a |
| Time/Leave (Macro #5) | ✅ shipped X5.B (6220 rows) | medium |
| SKILGRO (Skills/Learning Loop) | ⚠️ partial (sys_skill_taxonomy_edges 11965, sys_learning_paths 3354, sys_learning_modules 5052, sys_skill_aliases 80) | abundant ma residue CW-B47 |
| H2R (Recruiting Hire-to-Retire) | ❌ NOT shipped | **0 legacy_mirror tables** |
| SMERTO (Compensation) | ❌ NOT shipped | **84 rows** (market_salary_data only) |
| TALPIPE (Talent Pipeline) | ❌ NOT shipped | **0 legacy_mirror tables** |
| PULSAR (Engagement) | ❌ NOT shipped | **0 legacy_mirror tables** |
| DGOV (Data Governance/RLS) | ✅ base active (367 RLS) | n/a |
| PROGOV (Process Governance) | ⚠️ partial | medium |
| EPRA (AI/Embeddings) | ❌ NOT shipped | depends on all altri |

### Verdetto SDBI

**SDBI fase completata al ~50-60%** del scope originale 11 macro-aree:
- 5/13 macro-aree fully shipped (OPOURSKA, ESKAP, GOKMER Goals, ITLAB, Time/Leave)
- 2/13 partial (SKILGRO, PROGOV)
- 4/13 NOT viable (H2R, SMERTO, TALPIPE, PULSAR — **source data NUL o quasi**)
- 2/13 dependency-pending (DGOV active baseline, EPRA depends on all)

**Engine + framework MATURO post-X10**:
- 17 transform codes
- 49 bias catalog (stabilizing)
- 18 ADR accepted (0018 COALESCE-UQ class-of-bug doc)
- Dual-watchdog (Cowork-scheduled + CLI-/loop) FBI verified
- Pattern memo: 25 anti + 26 vincenti

---

## §2 — Pivot options (Path A / B / C)

### Path A — Continue SDBI fragmentary X12+ (minimal new value)

**Scope**: completa le 2 macro-aree partial + tentativi sui residue:
- X12 — SKILGRO Phase 2 (CW-B47 deep fix via LOOKUP_FK_3HOP) o sub-domain micro-batches
- X13 — PROGOV completion (workflow/approval/audit tables, source via brownfield refresh)
- X14 — Compensation SMERTO partial (84 rows) come "decoroso"
- X15 — Hardening + audit forensico finale

**Expected unlock**: ~1000-2000 rows aggiuntivi cumulative. sys.* populated 59→63/134 (47%).

**Pro**:
- Mantiene focus engine SDBI (familiare)
- ROI calcolabile per ciascun batch

**Contro**:
- Diminishing returns (low new unlock per ciclo)
- 4-5 cicli aggiuntivi per +4 sys.* tables = inefficient
- NON sblocca MVP-1 → MVP-2 transition (HANDOFF.md priorità)

### Path B — Pivot MVP-2 frontend (per HANDOFF.md / CLAUDE.md)

**Scope**: passa a MVP-2a/2b admin web SPA + ESS portal come da CLAUDE.md §"MVP-2a / MVP-2b frontend":

```
Pre-X12: Phase 0 API gap audit → docs/api/MVP_2A_API_GAP_AUDIT.md (27 admin routes + 13 ESS routes vs 267 esistenti)
Phase 1: Scaffold apps/web (Next.js 15 + TanStack + Hook Form + i18next)
Phase 2: Implement /login pilot (auth client + CSRF + Playwright pattern)
Phase 3: Page-by-page loop (13 ESS pages + 27 admin)
```

**Constraint critico** (CLAUDE.md MVP-2a §):
- **NO MOCK DATA**: ogni pagina hits real /v1/* endpoint live
- **API-first ordering**: mai build UI prima dell'endpoint Zod-typed + integration test green
- **Playwright E2E mandatory** per ogni page
- Pattern: `<heuresys/shared schema → API repo/service/route → integration test → frontend types → TanStack hook → component da @heuresys/ui primitives → Playwright E2E green>`

**Expected outcome**: app web funzionante con live data binding. Production-grade SPA.

**Pro**:
- Sblocca uso reale del SDBI lavoro (59 sys.* tables now consumable)
- Allinea con HANDOFF.md canonical priorities
- Maggiore valore percepito per stakeholder (UI > backend)
- engine maturity post-X10 = condizione ideale per consumer applicazione

**Contro**:
- Diverso skillset (frontend Next.js + React vs SQL/migration)
- Sessioni più lunghe per page (4-8h ciascuna)
- Dipendenza ux-design-shared library

### Path C — Hybrid (selective SDBI quick wins + parallel MVP-2 scaffolding)

**Scope**: 
- X12 = hardening final SDBI (1 ciclo, ~3h)
- X13 = MVP-2a Phase 0 API gap audit (1 ciclo, ~2h)
- X14+ = MVP-2a page-by-page implementation (multi-ciclo)

**Pro**:
- Chiude SDBI clean (no dangling)
- Inizia transition graduale
- Minimizza risk pivot abrupt

**Contro**:
- 1 ciclo extra rispetto Path B pure
- Cognitive load mixed (backend + frontend in adjacent batches)

---

## §3 — Decision matrix per Enzo

| Criterio | Path A SDBI fragmentary | Path B MVP-2 pure | Path C Hybrid |
|---|---|---|---|
| Tempo a "feature complete" perceived | Lungo (4-5 cicli, low value) | Medio-Lungo (5-8 cicli) | Lungo (6-9 cicli) |
| Risk regression | Basso | Medio (new stack) | Medio |
| ROI per ciclo | Diminishing | Crescente (UI value) | Mixed |
| Stakeholder visibility | Low (only DB) | High (UI shown) | High (UI quando shipped) |
| Engine maturity utilization | Marginal | **Full** | Full (post X12 closure) |
| HANDOFF.md priorities alignment | Low | **High** | High |
| Cognitive switching cost | Zero | Medio (one-time) | Medio (continuous) |
| Loop watchdog automation utility | Marginal | **Full** | Full |

### Mia raccomandazione

**Path C — Hybrid**:
1. **X12 (post-X11)**: chiusura SDBI residue (sweep audit + minor cleanup)
2. **X13**: MVP-2a Phase 0 API gap audit (chiave per pivot informato)
3. **X14+**: MVP-2a implementation page-by-page con loop watchdog automation

Razionale: rispetta HANDOFF.md + chiude SDBI clean + sfrutta engine maturity + minimizza pivot abrupt. **Dual-watchdog automation è perfettamente adatto a workflow page-by-page MVP-2a** (PROMPT per page, CLI execute, REPORT, next page).

---

## §4 — Operative implications dual-watchdog per MVP-2 phase

Il workflow Cowork-scheduled + CLI-/loop accoppiata (verified live in C10-C11) **è proprio l'architettura ottimale per MVP-2a page-by-page**:

- Cowork emette PROMPT "implement /<route> page X with /v1/* endpoint + integration test + Playwright"
- CLI /loop esegue ciclo: scaffold component + types from @heuresys/shared + TanStack hook + Playwright test
- Cowork-scheduled verifica REPORT + classifica + suggerisce next page

Pattern: 1 page = 1 PROMPT = 1 ciclo loop CLI (~2-4h).

**Stima MVP-2a complete**: ~40 pages × ~3h cad. = **~120h CLI execution + ~20h Cowork review** = 2-3 settimane intensive.

Con dual-watchdog: **Enzo intervento ridotto a ~5h cumulative** (decisioni architecture + halt P0 + visual review pages).

---

## §5 — Decisioni che servono da Enzo (post REPORT 015)

1. **Path A / B / C** scelta strategica
2. Se B/C: conferma scope **MVP-2a admin SPA prima OR MVP-2b ESS prima** (CLAUDE.md indica admin prima)
3. Se B/C: conferma rispetto **NO MOCK / API-first ordering** (non-negotiable per CLAUDE.md MVP-2a §)
4. Se A: lista priority macro-aree fragmentary

---

## §6 — Estimate finalization SDBI complete

Se Enzo sceglie Path A pure (per chiudere SDBI 100% scope):
- 4-5 cicli rimanenti (X12-X16)
- ~10-15h CLI cumulative
- Final state: ~63/134 sys.* populated (47%, MA limit hard data legacy_mirror)

Se Enzo sceglie Path B/C:
- 1-2 cicli SDBI closure (X12-X13)
- ~3-5h CLI cumulative SDBI
- Poi 25-30 cicli MVP-2a/2b
- Cumulative 100-130h CLI execution su 3-4 settimane

---

## §7 — Status note Cowork↔CLI infrastructure

Tutto in place per qualsiasi path:
- ✅ Skill cowork-cli-orchestrator GENERIC user-level
- ✅ heuresys-evo project-extension (per altri progetti)
- ✅ heuresys-advanced via cowork_reserved/ pattern memo + bias registry
- ✅ Dual-watchdog CLI-/loop + Cowork-scheduled active
- ✅ Pattern memo §1-§19 (25 anti + 26 vincenti)
- ✅ Bias registry CW-B17→B49 (49 catalogati)
- ✅ 18 ADR accepted + 43 migrations applied
- ✅ Engine 17 transform codes + COALESCE-UQ class-of-bug doc

Setup infrastructure è production-ready per qualsiasi path. **Decisione strategica è strategy choice, NON capacità tecnica**.

---

*End strategic analysis post-X11 — awaiting REPORT 015 X11 outcome + Enzo decision Path A/B/C*
