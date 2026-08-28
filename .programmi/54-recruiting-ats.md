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
- [x] **F2 — Modello dati del dominio, costruito sul DBMS attuale** — **FATTO 2026-08-28
  (S1083)**, migrazione `000364`, prova generale VERDE a due passate sul gemello (`7 tabelle · 0
  FK di persona non dichiarate · 0 righe`, 27/27 sentinelle).

  **Sette entità**: `sys_job_requisitions` → `sys_job_postings` → `sys_candidates` →
  `sys_candidate_applications` → `sys_interviews` → `sys_interview_feedback` → `sys_job_offers`.
  Struttura **vuota**: nessun import, e zero righe è il valore atteso — il dominio si popolerà
  con l'uso (I12/ADR-0038, direzione di Enzo del 2026-08-14).

  **Cosa il monito di modellazione di F1 ha effettivamente cambiato**: il legacy ha lo stesso
  ciclo costruito **due volte**, e solo la seconda famiglia ha le **offerte**. Chi ha rifatto il
  lavoro le ha aggiunte — quindi `sys_job_offers` c'è, e non sarebbe stato ovvio partendo dalla
  prima famiglia. Il contorno operativo (modelli di colloquio, disponibilità degli intervistatori)
  resta fuori: è ottimizzazione di processo, non il ciclo.

  **Tre scelte che vale la pena non ri-dedurre:**
  - `requisition_position_id` è **NOT NULL**: I1 non è un commento, è un vincolo. Si copre un
    *posto*, non si assume una persona; senza quel NOT NULL il recruiting diventerebbe un elenco
    di assunzioni scollegato dall'organigramma, cioè il modello che I1 vieta.
  - **un candidato non è un utente**, e la conseguenza è di sostanza: il registro GDPR sorveglia
    le FK verso `sys_users` e **non vedrebbe `sys_candidates`** — la guardia resterebbe verde su
    dati personali di persone reali. Per questo consenso e scadenza di conservazione sono
    **colonne con un CHECK**, non una riga in un documento.
  - i vincoli che impediscono stati contraddittori sono nello schema, non nel codice: un
    `HIRED` senza l'utente nato dall'assunzione, un `REJECTED` senza motivo, una risposta a
    un'offerta mai spedita sono **impossibili**, non «da controllare».

  **Due guardie a monte hanno fermato la catena, e avevano ragione entrambe:**
  ① la `000304` — una FK verso una persona **si dichiara**: registrate
  `feedback_interviewer_user_id` e `candidate_hired_user_id`.
  ② la `000062` — ogni tabella dev'essere **classificata**: le sette sono registrate lì, non nella
  `000364`, perché è in quel file che gira il controllo (ADR-0035: si emenda il file che crea
  l'oggetto). Tutte `EXCLUDE`, con una motivazione che è l'opposto di quella delle altre righe del
  registro: qui una sorgente legacy **esiste ed è abbondante**, e non si importa lo stesso.
  ⚠ Entrambe si vedono solo alla **seconda passata** — girano prima della `000364` e alla prima
  non possono vedere tabelle che ancora non esistono.
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

## ⚠ CORREZIONE — la scelta della «famiglia sorgente» non si pone più

**Direzione di Enzo, 2026-08-14**: *«nessun dato riferito al brownfield deve essere rimesso in
circolo. Tutto va ricostruito con il DBMS attuale.»*

Poche ore prima avevo scritto che F2 doveva cominciare **scegliendo quale delle due famiglie
legacy importare**. **Quella domanda è morta**: non si importa né la A né la B. Il conteggio
delle 19 tabelle resta utile per una cosa sola — dice **quali entità serve modellare** (il
concetto), non da dove prenderne le righe.

Ed è per altro coerente con la decisione già registrata qui sopra: *«concept-porting dal
cantiere evo, mai codice»*. Ora vale anche per i **dati**, non solo per il codice.

Il reperto delle due famiglie conserva comunque un valore, come **monito di modellazione**: nel
legacy lo stesso ciclo è stato costruito due volte, e solo la seconda versione ha le offerte e il
contorno operativo (storico, partecipanti, modelli di colloquio, disponibilità). È il segno di
quali entità sono davvero servite all'uso — e **quello** si porta, perché è conoscenza di
dominio, non un dato.

## Da dove si riprende

**F2, costruendo il dominio sul DBMS attuale**: requisition → posting → candidate → interview →
offer, agganciata alle posizioni (**I1**: una requisizione nasce da una posizione vacante, ed è
il tratto che rende questa storia diversa da un ATS qualunque). Nessun import, nessuna sorgente
legacy da scegliere.
