---
name: project-atlas
description: >-
  Conoscenza operativa cross-layer di heuresys-advanced e linee di sviluppo prodotto.
  USA QUESTA SKILL quando Enzo dice: "atlas", "aggiorna/refresh la conoscenza", "mappa operativa
  del progetto", "collaudo atlas", "cosa abbiamo/cosa manca per <capacita'>", "dossier",
  "linee di sviluppo", "brainstorming di prodotto heuresys", o cita docs/kb/atlas/ oppure
  DEVELOPMENT_LINES_*. Quattro modi: status (default), refresh (delta; --full gated),
  query (Q&A evidence-based atlas-first), dossier (linee di sviluppo → blocchi Action register).
  Il modo dossier E' la variante evidence-based project-scoped che soddisfa
  superpowers:brainstorming per il prodotto heuresys. NON usare per: bug-hunting/audit forense
  (usa full-forensic-audit), QA E2E o piani release (forensic-100x-kickoff / web-qa-audit),
  due diligence investor (saas-investor-due-diligence), chiusura sessione o riscrittura SoT
  (handoff), pura topologia/BFS del grafo (graphify). L'atlas e' una DERIVED VIEW, non SoT:
  i conteggi autoritativi vivono in docs/kb/SOT_STATE.md.
---

# project-atlas — conoscenza operativa + linee di sviluppo (heuresys-advanced)

Nata dalla sessione S1016. Contratto: ogni affermazione con EVIDENZA (file:line, query, riga atlas);
mai a memoria. Vincoli ereditati per riferimento: R20 (effort quantificati) · DoD ADR-0026 ·
OUTPUT RULE S1011 · no path assoluti nei file versionati · single-writer register (handoff governa
lo stato) · OGNI richiesta di costo in forma R20.

## Dispatcher (routing deterministico)

| Invocazione/trigger | Modo |
|---|---|
| `/project-atlas` nudo | **status** |
| "aggiorna/refresh l'atlas/la conoscenza" | **refresh** (delta) |
| refresh con richiesta esplicita di completezza ("full", "tutto da zero") | **refresh --full** (gated) |
| domanda evidence-based sul sistema; "collaudo" | **query** |
| "dossier", "linee di sviluppo", brainstorming prodotto | **dossier** |

Leggi `references/atlas.config.yaml` (manifest) e `references/LEARNINGS.md` (lezioni+ultimo
run-record) PRIMA di qualsiasi modo diverso da query.

## Modo: status (costo ~zero)
1. Per ogni layer del manifest: esegui `staleness_probe` (sostituendo `<curated_date>` con la data
   in testa a `docs/kb/atlas/ATLAS_CURATED.md`); per le famiglie statiche esegui `probe`.
2. Se il tunnel/host non risponde: marca `[non verificato: <layer>]` — MAI numeri stale come freschi.
3. Presenta: tabella layer→stato (fresco/stale/non-verificato) + data curated + menu dei 4 modi.

## Modo: refresh
1. Staleness come in status → lista layer stale. Se vuota: dichiara "atlas fresco" e fermati.
2. **Delta (default)**: segui `references/planner.md` §1-§3 sui SOLI layer stale;
   agenti via Workflow con modello/effort da `references/model-map.md`;
   prompt istanziati da `references/sweep-prompts.md`.
3. **--full**: PRIMA chiedi conferma in forma R20 citando `thresholds.full_sweep_token_estimate`
   e proponi la riga `/goal` da `references/goal-recipes.md`. Solo dopo l'ok procedi come sopra
   su TUTTI i layer.
4. A valle SEMPRE (planner §4): `build_atlas.py` ×2 (idempotenza) → skill `graphify --update` →
   merge curated per sezione secondo `references/curated-template.md` → `handoff_lint.py` exit 0.
5. Chiudi col protocollo self-learning (sotto).

## Modo: query (zero subagenti)
1. Ordine di lookup: `docs/kb/atlas/atlas.yaml` (grep mirato) → `ATLAS_CURATED.md` →
   SOLO per verificare l'evidenza citata: Grep sul codice / psql puntuale.
2. Risposta con evidenza esplicita in ≤2 tool call. Se l'atlas non basta: dillo, proponi refresh
   del layer — non esplorare liberamente il repo ignorando l'atlas.

## Modo: dossier (zero subagenti; e' il brainstorming di prodotto)
1. Pre-check staleness curated vs soglie del manifest (warn/block) — block ⇒ STOP e proponi refresh.
2. Conduci il brainstorming con Enzo (una domanda alla volta; opzioni componibili, mai aut-aut).
3. Scrivi il dossier secondo `references/dossier-template.md`; proponi la riga `/goal` relativa.
4. Su selezione di Enzo: blocchi register secondo il template, `handoff_lint.py` exit 0,
   `build_menu.py` per mostrare il menu. Commit secondo le regole correnti; MAI push senza ok.

## Protocollo self-learning (fine refresh/dossier)
1. APPENDI il run-record a `references/LEARNINGS.md` (schema nel file).
2. Se un pattern si e' ripetuto ≥2 volte: aggiungi la Lezione in prosa.
3. Adattamenti parametri (chunk size, promozione modello per famiglia — regole in model-map.md §2):
   scrivili in `atlas.config.yaml → adaptive` col perche' nel run-record. MAI toccare i template
   (quelli cambiano solo per mano umana o proposta esplicita a Enzo, R15).

## Degradazione ed errori
- Tunnel/host giu' → `[non verificato: X]` e si prosegue sul resto.
- Spend-limit a meta' sweep → salva frammenti fatti + scrivi pending-file + item GATED nel register.
- Frammento mancante → coverage check fail-loud (planner §3), 1 retry mirato, poi riporta.
- Known issues gia' catalogati in LEARNINGS: consultali PRIMA di ri-diagnosticare.
