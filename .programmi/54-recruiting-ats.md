# 54 — E/E5: recruiting / ATS (cluster `/recruiting`)

> **item**: #54 · **priorità**: P2 · **stima register**: ~5-7 sessioni (fasi con commit atomici)
> **stato**: IN CORSO
> **fonti**: `docs/product/DEVELOPMENT_LINES_E_EVO_VERTICALS.md` §E5

## Decisioni vincolanti (non si ri-chiedono)

- **Decisione Enzo S1018**: in coda al batch (wave W11).
- **Concept-porting dal cantiere evo, mai codice.** Il legacy è fonte di *concetti* e di
  *dati*, non di implementazione.
- **I5 vale**: nessuna RLS. L'isolamento tenant è FK + filtro nel middleware.
- ⚠ Il catalogo delle capacità latenti è **wiki-derived e descrive in parte il legacy**: ogni
  capacità che sembra «già esserci» va **ri-verificata sullo schema advanced** prima di
  entrare nel piano.

## Fasi

- [x] **F1 — INDAGINE: leggere §E5 e misurare cosa esiste davvero** — FATTO 2026-08-14 (S1058). **§E5 regge su entrambi i lati, a differenza di #50.** Vedi l'esito sotto, che però cambia il punto di partenza di F2.
- [ ] **F2 — Modello dati del dominio** — ⚠ **la prima mossa non è progettare: è decidere QUALE delle due famiglie legacy è la sorgente** (vedi sotto). Poi requisition→posting→candidate→interview→offer, agganciata alle posizioni (I1: una requisition nasce da una posizione vacante) · budget ~250k
- [ ] **F3 — API** — moduli secondo il pattern in 7 passi, un commit per slice · budget ~250k
- [ ] **F4 — Frontend + E2E con login reale** — cluster `/recruiting`, **componente Kanban di `@heuresys/ui` mai usato** finora, più il posting pubblico (percorso prospect ADR-0026) · budget ~250k

## Esito di F1 — misurato il 2026-08-14

**Lato advanced: §E5 dice il vero, il recruiting è assente.** Ricerca su `sys.*` per
`(recruit|candidat|requisition|interview|offer|applicant|posting|vacan|hir)` → **2 riscontri, ed
entrambi sono falsi amici**: `sys_seed_candidate_records` è la pipeline di acquisizione dati
(cluster C11 della storia), `sys_successor_candidates` è la successione sulle posizioni critiche.
Nessun modulo API di dominio. Confermato.

**Lato legacy: il ciclo c'è davvero, ed è popolato** — 19 tabelle:

| famiglia | tabelle |
|---|---|
| **A — senza prefisso** | `candidates` (100) · `requisitions` (50) · `interviews` (128) · `interview_feedback` (66) · `job_postings` (20) |
| **B — con prefisso `recruiting_`** | `recruiting_candidates` (86) · `recruiting_requisitions` (24) · `recruiting_interviews` (77) · `recruiting_offers` (30) · `recruiting_candidate_history` (213) · `recruiting_interview_participants` (231) · `recruiting_interview_templates` (12) · `recruiting_interviewer_availability` (80) |
| satelliti | `internal_job_postings` (10) · `internal_mobility_postings` (27) · `job_market_postings` (20) · `job_postings_raw` (8) · `enrichment_candidates` (38) · `succession_candidates` (100 — già importata come `sys_successor_candidates`) |

## ⚠ Il reperto che cambia F2 — due famiglie parallele, e va scelta prima di progettare

Le famiglie **A** e **B** coprono lo **stesso ciclo** con conteggi diversi (100 vs 86 candidati,
50 vs 24 requisizioni, 128 vs 77 colloqui). **Solo la B ha le offerte** (`recruiting_offers`) e
tutto il contorno operativo (storico, partecipanti, modelli di colloquio, disponibilità).

È **lo stesso pattern** trovato lo stesso giorno su `sys_engagement_*` contro `sys_survey_*`
(→ **#187**): due famiglie che dicono la stessa cosa, e il consumatore che ne legge una ferma
mentre l'altra è viva. Lì è costato un indice di salute organizzativa vecchio di diciannove mesi.

**Quindi F2 non comincia disegnando tabelle**: comincia stabilendo, sulle date e sulle chiavi
esterne, quale famiglia è quella viva — e se la B è un rifacimento della A, la A non va importata
affatto. Importare la famiglia sbagliata significherebbe **ricreare in advanced, da zero, il
difetto che #187 dovrà correggere**.

## Da dove si riprende

**F2, dalla scelta della famiglia sorgente.** Non è una preferenza: è la decisione che determina
se il modello nasce giusto o nasce con dentro il difetto di #187.
