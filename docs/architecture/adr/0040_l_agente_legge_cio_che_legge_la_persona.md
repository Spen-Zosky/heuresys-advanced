# ADR-0040 — L'agente legge ciò che legge la persona; il freno si sposta dal tipo di dato all'uso

- **Status**: **ACCEPTED** — dottrina ratificata da Enzo Spenuso il 2026-09-14, dopo rilettura integrale
- **Date**: 2026-09-14
- **Supersedes**: ADR-0033 **§6.1**, nella parte che ordina l'adozione dell'agente come **coda per rischio crescente** consumata un perimetro per volta (`check_concetti_agente.py` come criterio di apertura). ⚠ Il mandato di questa sessione nominava «§5.2»: **misurato**, §5.2 è il gate HITL che classifica le scritture per metodo risolto e nega ciò che non risolve — **resta intatto**, e questo ADR vi si appoggia. I tre strumenti generici di ADR-0033 §3 restano tre.
- **Builds on**: ADR-0036 (domini ortogonali; le quattro eccezioni del §5), ADR-0032 (`mask` come quarto stato), I17 (pavimento ESS), I22 (`HRMS_MANAGER` plenipotenziario), I5 (mai RLS)
- **Decided by**: Enzo Spenuso — direzione data il 2026-09-08 (*«dobbiamo cambiare la dottrina che crea vincoli e blocchi nell'uso»*), ratifica il 2026-09-14
- **Preparato da**: `dottrina-agente-perimetri_20260908.md` (sessione Cowork in sola lettura, fuori repo); recepito in questo ADR dalla sessione CLI S1101, con le misure di fattibilità del §4 fatte in quella sessione
- **Voci del register che lo attuano**: `#251` (contatore) · `#252` (ponte sulle letture) · `#253` (diario interrogabile) · `#254` (apertura, GATED sulle tre) · `#214` in HOLD da questo ADR

> I **numeri non stanno in questo documento come fatti**: dove compaiono sono **datati** e portano il comando che li ri-deriva. Le soglie del §3 sono valori iniziali, non costanti — vedi lì la ragione.

---

## §1 — Contesto: l'agente è cieco esattamente dove il suo utente è plenipotenziario

Un `HRMS_MANAGER` è plenipotenziario sui dati business del suo tenant (I22). Davanti allo schermo apre qualunque scheda. Se pone la stessa domanda all'agente, ha a disposizione solo i perimetri **aperti uno per volta** dalla coda di `#214` — dal 2026-08-16 al 2026-09-13 sedici perimetri, tutti scelti perché *parlano meno di persone* (ADR-0033 §6.1: ordine per rischio crescente). Quel criterio funzionava bene e produceva esattamente questo: un agente utile sull'organigramma e sui fascicoli di configurazione, e muto su chi è adatto a una posizione, quali competenze mancano, come si costruisce un percorso.

Non era un difetto di attuazione. Le prime due aperture avevano una motivazione di prodotto scritta e datata da Enzo (`#193`: l'organigramma è rubrica aziendale); le successive avevano motivazioni di rischio — ottime ragioni, ma di un'altra domanda. La coda ordinava per rischio e nessuna riga misurava il valore.

**La misura che ha cambiato il progetto del freno** (2026-09-08, documento di dottrina §3): una soglia sul numero di **righe** lette non discrimina — fra «il reparto più grande» e «tutta l'azienda» c'è un fattore quattro, non un ordine di grandezza. Il numero di **persone distinte** invece separa bene (1 · 7 · 38 · 160 nelle quattro domande tipo), è la grandezza su cui ragiona il diritto (la profilazione di massa si definisce sugli interessati), ed è leggibile senza essere tecnici.

## §2 — Decisione: tre regole

**R1 — Il perimetro dell'agente è quello della persona.** L'elenco in `docs/kb/agent-perimetri.json` **smette di essere l'autorizzazione a leggere**. Ciò che una persona può leggere dall'API, l'agente lo legge per lei: stesso cookie JWT (`apps/agent-gateway/src/heuresys-client.ts`), stesso RBAC, stessa catena organizzativa, stesso mascheramento. Il «perimetro neutro» si ritira come concetto: era l'impalcatura con cui il prodotto è stato costruito in sicurezza, e ha finito il suo lavoro. **`agent-perimetri.json` non si butta: cambia mestiere.** Resta la fonte unica per le **scritture**, dove la ridondanza serve, e resta la cronaca datata di come ci si è arrivati (sedici aperture, ognuna con decisione e data).

**R2 — Il cancello si sposta dal tipo di dato all'uso che se ne fa.** Non si toglie un controllo, si cambia cosa controlla. Tre leve, due delle quali esistono già:

| leva | a che serve | stato al 2026-09-14 |
|---|---|---|
| **contatore di persone distinte** per conversazione | il freno vero: distingue «la mia squadra» da «tutta l'azienda» | **non esiste** — `#251` |
| **ponte di approvazione umana** anche sulle letture, oltre la soglia alta | l'agente si ferma e chiede invece di procedere | esiste per le scritture (`approval-bridge.ts`, `canUseTool`), **non per le letture** — `#252` |
| **diario che sa dire su cosa**, interrogabile | misurare a posteriori chi ha letto quanto | registra concetto e operazione dal 2026-08-23 (`audit-sink.ts`), ma **su file e senza id di conversazione** — `#253` |

Il buco che giustifica l'urgenza **esiste già oggi** e non dipende da questa dottrina: il tetto è **per chiamata** (`packages/shared/src/schemas/_pagination.ts:26`: `limit` ≤ 200/500/1000 secondo lo schema) e **non esiste alcun tetto sul totale letto in una conversazione**. Questo è anche ciò che il piano di miglioramento del 2026-09-08 chiamava **M7** («il freno sul volume per l'agente», B25 nel bundle del 9 settembre): non è una voce a parte, è questa.

**R3 — Il mascheramento resta, ed è lì che passa la linea vera.** `apps/api/src/lib/scope/mask.ts` è già il quarto stato di autorizzazione (ADR-0032): la riga si vede, il campo delicato no. Per l'agente vale identico **senza una riga di codice in più**, perché riceve la risposta dell'API già mascherata. È questo che rende sicuro aprire anche `analytics` e `dashboard`, oggi riservati perché toccano retribuzione e valutazione.

**Cosa resta chiuso, e non per prudenza.** Le **quattro eccezioni di ADR-0036 §5** delimitano perfino il mandato HR, quindi delimitano l'agente senza bisogno di una regola nuova: segnalazioni whistleblowing (isolamento assoluto: solo la custodia), `SPECIAL_CATEGORY`, retribuzione dei vertici (soglia di catena), valutazioni non ancora comunicate. ⭐ **Dal 2026-09-14 la prima delle quattro non è una dichiarazione, è un cancello**: la sentinella bloccante `sys.v_whistleblowing_fuori_dal_custode` (mig `000414`) pretende zero permessi `whistleblowing:*` fuori dal ruolo di custodia, ed è raccolta da `db_health` a ogni avvio. Quando il documento di dottrina è stato scritto, l'8 settembre, quell'eccezione era vera per ri-misura manuale; ora è vera per costruzione, e un permesso concesso per sbaglio si vede alla sessione dopo. Resta chiuso anche tutto ciò che RBAC nega alla persona: **questa dottrina non allarga di un millimetro quello che quella persona può vedere.** Sposta l'agente dalla parte giusta del cancello che già esiste.

## §3 — Le soglie: valori iniziali, non costanti

Tre livelli, in persone distinte per conversazione:

| livello | persone distinte | cosa succede |
|---|---|---|
| **silenzioso** | fino a **25** | niente, nessun attrito |
| **dichiarato** | da **26** a **40** | l'agente non si ferma; il diario registra quante persone sta toccando |
| **confermato** | oltre **40** | l'agente si ferma e chiede, col ponte di approvazione (`#252`) |

La soglia **non è un tetto al mandato**: un `HRMS_MANAGER` che conferma legge tutto il tenant, perché è ciò che I22 gli riconosce. Produce un momento di consapevolezza e una traccia di chi ha chiesto cosa.

⚠ **25 e 40 sono i valori iniziali del tenant attuale**, tarati su RTL Bank il 2026-09-08. Su un cliente da 5.000 dipendenti sarebbero sbagliati. **Il criterio che li genera**: *il livello silenzioso copre l'unità più grande del tenant; la conferma scatta appena sopra*. **Il comando che li ri-deriva**: `psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f docs/kb/xtras/soglie-agente-persone-distinte.sql`, che stampa tre misure — perché «unità più grande» ammette tre letture, e la scelta fra le tre è parte di `#251`:

| misura (RTL Bank, **2026-09-14**) | max | p90 |
|---|---|---|
| posizioni per unità — la misura della dottrina dell'8 settembre, include le vacanti | 38 | 13 |
| persone con incarico attivo per unità | 9 | 8 |
| persone distinte per **catena** (sottoalbero di unità) — ciò che tocca «la mia catena» | 158 | 21,4 · **4 catene** sopra 25, le stesse 4 sopra 40 |

Letti così, i valori iniziali coprono qualunque unità e il 90% delle catene; la conferma scatta ai quattro vertici dell'azienda. Un numero fisso dentro un ADR è la cristallizzazione che il punto fisso del progetto vieta: qui i due numeri stanno accanto al criterio e al comando, e il giorno in cui il tenant più grande non sarà RTL Bank si ri-derivano, non si ricordano.

## §4 — Fattibilità misurata (S1101, 2026-09-14) — le due cose che il documento dichiarava non misurate al §9, più una terza

**(a) Le persone distinte si ricavano dalle risposte senza toccare l'API — SÌ.** Ogni lettura dell'agente, generica (`hrx_entity_query`) o di dominio (`rd`/`rdId`), passa da `HeuresysClient.call`, e la risposta è JSON conforme agli schemi di `packages/shared/src/schemas`, dove l'identificativo di persona compare sotto una **famiglia chiusa di nomi che finiscono in `UserId`**: 26 nomi distinti (`userId` 68 occorrenze, `subjectUserId` 22, `ownerUserId` 20, `mentorUserId`/`menteeUserId` 6, …). Un solo aggancio in `call` raccoglie gli UUID sotto quei nomi in un insieme. ⚠ Con un'**esclusione da dichiarare nel codice**: gli attori di audit (`createdByUserId`, `reviewedByUserId`, `performedByUserId`, `cancelledByUserId`, `publishedByUserId`, `actorUserId`) non sono soggetti — stesso criterio di `#214` S1078 (*«se contassero, ogni tabella sarebbe dati di persona»*).

**(b) Dove vive lo stato — nella richiesta, senza infrastruttura nuova.** Una conversazione è oggi **una** `POST /agent` (`server.ts`), che costruisce `HeuresysClient`, il server MCP e `canUseTool` per richiesta e lancia **una** `runHrAgent` → **una** `query()` dell'SDK **senza `resume`** (`sdk-agent.ts`); il client web (`use-agent-stream.ts`) manda solo `{prompt}`. Un contatore in chiusura dentro `runHrAgent` copre esattamente ciò che esiste. **Limite dichiarato**: se il web un giorno riprende una conversazione (`resume`), il contatore deve seguire quell'identificativo, altrimenti ogni ripresa riparte da zero.

**(c) Il diario NON è nel database, e questo allunga il passo 3.** `FileAuditSink` scrive un JSONL (`AGENT_GATEWAY_AUDIT_PATH`, di default `.data/agent-audit.jsonl`; sulla VM 242 righe al 2026-09-13), e la voce **non porta un identificativo di conversazione**. «Una vista SQL sul diario raccolta da `db_health`» pretende quindi: un `runId` nella voce, un `DbAuditSink` dietro il seam `AuditSink` che già esiste per questo, una migrazione con tabella in `audit` e la vista. È lavoro in più rispetto a quanto il documento lasciava intendere — scritto qui e in `#253` prima di cominciare, non scoperto a metà.

## §5 — Conseguenze

- `#214` va in **HOLD**: aprire il diciassettesimo perimetro col metodo vecchio è lavoro che questa dottrina rende inutile; si riattiva solo se la dottrina viene abbandonata.
- L'apertura (`#254`) è **una mossa sola per tutti i perimetri**, GATED sui tre passi: non c'è più una coda da consumare. `atlas-resolver.ts` smette di filtrare le letture; le scritture restano governate da `agent-perimetri.json` e dal gate di ADR-0033 §5.2.
- `check_concetti_agente.py` non ordina più una coda di apertura; resta utile come **misura** (quali moduli hanno una lettura e una pagina) e come cancello sul mascheramento dei perimetri riservati.
- Il freno prima dell'apertura, e non per prudenza: è la regola che il progetto applica a sé stesso dal 2026-09-07 (*«un perimetro vuoto oggi non è un perimetro chiuso domani»*). Qui il buco esiste già (§2, tetto per chiamata).

## §6 — Alternative scartate

- **Soglia sulle righe**: scartata dalla misura (§1) — tarata bassa blocca il reparto grande, tarata alta lascia passare l'azienda intera.
- **Continuare la coda per rischio crescente** (ADR-0033 §6.1): ~20 sessioni per i soli neutri, e alla fine un agente ancora muto sulle persone — cioè sul valore.
- **Un divieto sopra la soglia** invece di una conferma: contraddirebbe I22; la soglia è consapevolezza, non tetto.

## §7 — Come si verifica che sia fatto

- La stessa domanda a un `HRMS_MANAGER`, prima e dopo: da dieci moduli a tutto il suo mandato (criterio di B25).
- Superata la soglia alta, l'agente **si ferma** e il diario mostra la richiesta di conferma (`scripts/live-perimetro.ts`, quarta domanda).
- `psql … -f docs/kb/xtras/soglie-agente-persone-distinte.sql` stampa le tre misure; i valori iniziali si confrontano con quelle, non con la memoria.
- `select count(*) from sys.v_whistleblowing_fuori_dal_custode` → 0, a ogni avvio.
