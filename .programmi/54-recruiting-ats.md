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
      ▸ **3 fette su 7 fatte (S1087, 2026-09-05)**: `job-requisitions` (4 rotte, 10 test),
      `job-postings` (4 rotte, 8 test), `candidates` (4 rotte, 9 test). Restano
      applications, interviews, feedback, offers.
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


## Esito parziale di F3 — 2026-09-05 (S1087), due fette su sette

### Mig `000374` — i permessi, che non c'erano

Misurato prima di scrivere: `sys_auth_permissions` non conteneva **nulla** che nominasse
requisition, recruiting o candidate. Due permessi e non quattro (doctrine `000212`):
`job-requisition:read` e `job-requisition:manage`, un solo verbo di scrittura per l'intero
ciclo funzionale. Audience esplicita: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `HRMS_MANAGER` —
l'ultimo per **I22**, che lo fa plenipotenziario sui dati business.

⚠ Col marker `TENANT_ADMIN-ALLOWLIST-EXTEND`, che **non e' un opzionale**: la `000210`
cancella ogni grant a `TENANT_ADMIN` fuori dalla sua allowlist e la catena si riapplica a
ogni deploy. Senza il marker i due permessi sarebbero stati concessi e poi tolti al giro
dopo, con un 403 che nessuno avrebbe saputo spiegare. La guardia
`rbac-tenant-admin-allowlist.test.ts` lo verifica (2/2 verde).

### Le scelte di contratto che vale la pena non ri-dedurre

| scelta | ragione |
|---|---|
| `positionId` **obbligatorio** | I1: si copre un POSTO. Ammetterlo nullo avrebbe fatto accettare all'API cio' che il database rifiuta — un 500 al posto di un 400 |
| `status` **non si accetta in creazione** | una richiesta nasce `DRAFT`; il ciclo di vita e' una successione di decisioni, non un campo che si scrive all'inizio |
| `positionId` / `requisitionId` **non modificabili** | cambiare il posto coperto non e' una modifica, e' un'altra richiesta — e scollegherebbe dall'organigramma cio' che vi pende sotto |
| la posizione dev'essere **di quel tenant** | la FK da sola accetterebbe un posto di un'altra azienda, che I5 vieta |
| il tenant dell'annuncio **si eredita** | riceverlo dal body aprirebbe la strada a un annuncio in un tenant con la sua richiesta in un altro |
| **nessuna DELETE** | si porta a `CANCELLED`/`CLOSED`. Cancellare la radice cancellerebbe la storia di persone reali (ADR-0035) |
| `404` e non `403` per l'altrui | un 403 confermerebbe che quel codice esiste altrove, che e' gia' una perdita |

### Due livelli di diniego, provati entrambi

`FORBIDDEN` quando il ruolo non ha il permesso (lo da' `requirePermission`) ·
`PERMISSION_DENIED` quando il permesso c'e' ma il perimetro no (lo da' il service). Un test
che li confonde passa per la ragione sbagliata, ed e' scritto nella regola del modulo.

### Misure

`ci-rehearsal` VERDE (catena due volte, sentinelle 31/31) · `000374` applicata in produzione
(2 permessi x 3 ruoli = 6 concessioni) · `pnpm typecheck` verde su tutti i workspace ·
`job-requisitions` **10/10** · `job-postings` **8/8** · allowlist **2/2**. Tutti contro il DB
reale, nessun mock.

### La terza fetta: `candidates`, e perche' merita un paragrafo suo

Tocca **dati personali di persone che non sono utenti**: il registro GDPR sorveglia le FK verso
`sys_users` e **non vede** `sys_candidates`, quindi la guardia resterebbe verde su nome, cognome,
indirizzo e telefono di persone reali. E' la ragione per cui consenso e scadenza di conservazione
sono colonne con un CHECK e non una riga in un documento (F2 lo dichiara), ed e' la ragione per cui
i suoi nove test provano **i tre vincoli uno per uno** invece del solo percorso felice:

| vincolo | cosa impedisce | codice |
|---|---|---|
| `retention_until >= consent_given_on` | conservare un dato da prima di averne il permesso | `CANDIDATE_RETENTION_INVALID` |
| `HIRED` impone `hired_user_id` | un assunto senza l'utente nato dall'assunzione | `CANDIDATE_HIRED_WITHOUT_USER` |
| indirizzo unico nel tenant | la stessa persona due volte nella stessa azienda | `CANDIDATE_EMAIL_CONFLICT` |

In piu', il service verifica che l'utente dell'assunzione sia **dello stesso tenant**: quella
colonna non ha un vincolo che lo imponga, quindi senza il controllo si potrebbe assumere
dichiarando un utente di un'altra azienda. E l'indirizzo **non e' modificabile**: e' la chiave
naturale, e cambiarlo trasformerebbe una persona in un'altra lasciando appese le sue candidature.

### Perche' mi sono fermato a tre fette

Guardiano misurato alla fine: contesto **68,8%**, giudizio **MEDIO**, residuo ~62k, contro una
soglia di chiusura al 75%. Le quattro fette che restano (`applications`, `interviews`,
`feedback`, `offers`) chiudono il ciclo e vanno fatte con lo spazio per provarle davvero.
