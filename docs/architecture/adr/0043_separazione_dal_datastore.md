# ADR-0043 — La separazione dal datastore: la piattaforma tiene i cataloghi e genera i modelli, advanced tiene il tenant

- **Status**: PROPOSTO — da approvare da Enzo Spenuso; finché non è approvato non è regola e non si esegue nessun passo che toglie qualcosa
- **Date**: 2026-10-11
- **Decided by**: Enzo Spenuso (il criterio dei due domini e le sei regole, decisioni dell'11 ottobre 2026, punti 5 e criterio) · approvazione di questo testo: in attesa
- **Redatto da**: Claude Code CLI, mandato W0-A2 (onda 0 del piano di adesione completa, passo S2 della separazione)
- **Supersedes in part**: ADR-0039, regole 1 e 4 (il catalogo di piattaforma vive dentro advanced e chi amministra o costruisce un cliente lo vede intero)
- **Amends**: invariante **I21** (le tassonomie restano aperte a tutte le industrie, ma nel datastore)
- **Relates to**: ADR-0035 (ritirare si fa emendando la fonte), ADR-0041 (direzione del dato, I23), ADR-0042 (la piattaforma genera, il cliente possiede)
- **Poggia su**: `.programmi/esiti-onda0/CENSIMENTO_separazione.md` (passo S1, misurato il 2026-10-11)

> **In parole semplici, per Enzo.**
> 1. Oggi advanced tiene dentro di sé i cataloghi generali (competenze ESCO, professioni, settori, indicatori, traduzioni, vettori) e sa generare modelli: è il mestiere del datastore, fatto due volte.
> 2. Questo documento scrive come regola le sei frasi che hai deciso l'11 ottobre: il datastore tiene tutto ciò che è generale, advanced tiene solo il fascicolo di ogni cliente e le voci che il cliente si crea da sé.
> 3. Cambia una parte della decisione del 9 settembre (ADR-0039): i ruoli di altri settori restano disponibili per i clienti futuri, ma nel datastore, non più in advanced.
> 4. In questo ciclo non si toglie niente: il documento fissa l'ordine (prima il datastore ha tutto, poi advanced legge solo il perimetro, poi si commuta, infine si ritira) e le prove che ogni passo è sicuro.
> 5. Il ritiro finale è l'unica operazione irreversibile e resta tua: si fa solo dopo un archivio con impronta e una prova di ripristino sul gemello.

> I **conteggi non stanno in questo documento**, per la ragione di ADR-0038 e ADR-0039: un numero scritto qui è falso il giorno dopo. Si ri-derivano con i comandi del censimento (`.programmi/esiti-onda0/lavoro/censimento_query.sql` sul gemello, `censimento_lettori.py` per i lettori).

---

## Contesto

L'11 ottobre 2026 Enzo ha deciso il criterio che governa il piano di adesione: **il datastore è il dominio della piattaforma**, possiede tutto ciò che è generale (cataloghi completi, famiglie di settore, strumenti che generano i modelli) e rilascia a ogni tenant il suo fascicolo; **advanced è il dominio del tenant**, che riceve il fascicolo, lo personalizza, lo popola con i dati reali presi anche da altri sistemi e permette alle figure dell'azienda di gestirla.

Il censimento del passo S1 (W0-A1, stesso giorno, sola misura) ha trovato in advanced otto famiglie di oggetti che fanno il mestiere della piattaforma: cataloghi generali senza tenant, traduzioni dei cataloghi, vettori dei cataloghi, la sincronizzazione dei cataloghi (`reference_sync`), famiglie e varianti di modello scritte a mano nelle migrazioni, la creazione sintetica di un tenant, l'acquisizione dei semi, e le funzioni di piattaforma del tenant «Heuresys System». Per quasi tutte il datastore ha già l'equivalente, per alcune solo in parte, per poche no.

Due decisioni accettate oggi dicono il contrario di ciò che serve:

- **ADR-0039, regola 1**: «i cataloghi non acquisiscono mai la colonna del cliente… un ruolo che oggi appartiene a un altro settore non si cancella e non si sposta: resta lì, ed è la ragione per cui ci sarà quando nascerà il cliente che ne ha bisogno». La ragione resta vera; il posto no: il cliente futuro lo serve il datastore.
- **ADR-0039, regola 4**, seconda frase: «il catalogo intero resta visibile a chi amministra la piattaforma e a chi sta costruendo un cliente nuovo». Con la separazione, in advanced il catalogo intero non c'è più: un cliente nuovo nasce da un fascicolo del datastore.
- **I21**: «le tassonomie (ESCO, ISCO, NACE, ATECO, CCNL, modelli operativi) restano aperte a tutte le industrie». Detta così, obbliga advanced a tenerle tutte.

## Decisione

> **I cataloghi generali e la generazione dei modelli stanno solo nel datastore. In advanced ogni tenant ha il suo fascicolo, che è il suo perimetro, più le voci che si crea da sé. Ciò che manca si chiede alla piattaforma.**

Le sei regole, nelle parole della decisione dell'11 ottobre:

1. **Separazione piena.** I modelli si generano solo nel datastore e i cataloghi generali stanno solo nel datastore. Ciò che in advanced fa oggi quel mestiere viene tolto, non solo dichiarato in uscita.
2. **Il fascicolo è il perimetro del tenant.** In advanced il tenant cerca, sceglie e modifica ruoli, processi, competenze, indicatori e tutto il resto soltanto dentro il ventaglio che gli è stato passato. Il perimetro è più largo del modello attivo: contiene tutto ciò che appartiene alla realtà di quel tipo d'impresa (per RTL Bank, la banca retail regionale), anche le voci non ancora usate.
3. **Fuori perimetro si chiede alla piattaforma.** Quando al tenant serve una voce che non ha, la richiesta va al datastore, che estende il fascicolo con una versione nuova. Il tenant non sfoglia mai il catalogo generale.
4. **Le voci proprie restano.** Dentro il suo dominio il tenant può crearsi ruoli, indicatori e altre voci su misura, marcate come sue (è la regola 3 di ADR-0039, che resta in vigore: stessa tabella, colonna del tenant valorizzata).
5. **Gli strumenti possono somigliarsi, i dati no.** Advanced può avere funzioni modellate su quelle del datastore (ricerca per significato, composizione delle capacità), ma lavorano solo sui dati del tenant e sul suo perimetro.
6. **Le funzioni di piattaforma escono da advanced.** Ciò che oggi il tenant «Heuresys System» fa come piattaforma (scrivere modelli, sincronizzare cataloghi, creare tenant sintetici, acquisire semi) passa al datastore; in advanced resta la sola amministrazione tecnica dei tenant.

### Che cosa sostituisce di ADR-0039, e che cosa ne resta

| ADR-0039 | con questo ADR |
|---|---|
| regola 1: i cataloghi restano interi in advanced, senza colonna del cliente | **sostituita**: i cataloghi interi stanno nel datastore; in advanced restano solo le voci che appartengono al perimetro di almeno un tenant. La colonna del cliente continua a non esserci sulle voci di catalogo (resta vera la metà «non acquisiscono la colonna del cliente») |
| regola 2: il profilo del cliente si esprime col meccanismo dei blueprint | **resta ed è allargata**: il profilo diventa il perimetro, che è più largo del modello attivo e arriva dal datastore insieme al fascicolo (passo S4) |
| regola 3: le voci proprie stanno nella tabella del catalogo con la colonna del cliente | **resta** com'è (regola 4 qui sopra) |
| regola 4: ogni lettura per un cliente passa dal profilo; il catalogo intero è visibile a piattaforma e a chi costruisce un cliente nuovo | **prima frase resta** (diventa «passa dal perimetro»); **seconda frase sostituita**: in advanced nessuno vede il catalogo intero, perché non c'è |
| prove 1 e 2 | restano |
| prova 3 (un ruolo che nessun profilo usa resta interrogabile da chi costruisce un cliente nuovo) | **si sposta nel datastore**: lì il ruolo resta interrogabile; in advanced la prova diventa la sentinella del passo S6 |

### Correzione di I21

Testo proposto per `CLAUDE.md`, da scrivere solo all'approvazione di questo ADR:

> I21: i dati che derivano dall'industria di un tenant sono coerenti con essa; le tassonomie (ESCO, ISCO, NACE, ATECO, CCNL, modelli operativi) restano aperte a tutte le industrie **nel datastore**; in advanced un tenant ne vede solo il proprio perimetro (ADR-0043).

### Che cosa resta in advanced (non è piattaforma)

Il censimento ha tenuto fuori dal conto, e questo ADR conferma, cinque cose che non hanno tenant ma non sono catalogo di dominio:

- **i cataloghi del prodotto advanced come applicazione**: permessi, ruoli di autorizzazione e loro permessi, interfacce (`sys_ui_interfaces`) e classi di dato, campi traducibili, mappa GDPR, classificazione della direzione del dato; con le loro traduzioni;
- **i vettori dei profili delle persone** (`sys_user_profile_embeddings`): sono dato del tenant;
- **il registro e l'attivazione dei modelli per tenant** (`tenant_blueprints`, attivazioni, deroghe al modello): sono il gesto del tenant che riceve il fascicolo (ADR-0042);
- **la costruzione del tenant dal fascicolo** (`tenant-materialization`): è inizializzazione del tenant, il dominio di advanced; cambia la sorgente (il fascicolo invece del catalogo interno), non il mestiere;
- **l'amministrazione tecnica dei tenant** (`tenants`, `platform-tenant-assignments`) e i dati del tenant RTL Bank (seed `storia36`, `rtl-*`).

## Dove va ogni voce del censimento, e con quale passo

I passi sono quelli del piano di adesione: **S3** parità e ventaglio (nel datastore, onda 1), **S4** perimetro in advanced (onda 2), **S5** commutazione (onda 3), **S6** ritiro (onda 3, con la conferma di Enzo). «Datastore oggi» riporta la colonna del censimento: SÌ, PARZ, NO.

| # | voce del censimento | datastore oggi | destinazione | S3 (datastore) | S4 (advanced) | S5 | S6 |
|---|---|---|---|---|---|---|---|
| 1 | competenze di catalogo (`sys_skills` senza tenant), legami (`sys_skill_taxonomy_edges`), gruppi (`sys_skill_groups`) | SÌ | datastore; in advanced solo le voci del perimetro | verifica di parità voce per voce (codice ESCO) | il caricatore scrive il perimetro; le liste e la ricerca leggono solo il perimetro + le voci proprie | RTL Bank riceve il perimetro di banca retail regionale | via le voci senza tenant fuori da ogni perimetro |
| 2 | requisiti delle professioni (`sys_occupation_skill_requirements`), mappature ESCO (`sys_esco_occupation_mappings`), classificazioni delle professioni | PARZ / SÌ | datastore | completare i legami professione→competenza mancanti; per primo CP2021 | idem 1 | idem | idem |
| 3 | classificazioni delle attività (ATECO, NACE) e loro mappature, codici di settore, fasce dimensionali | SÌ | datastore; in advanced restano il codice del tenant e le voci del suo perimetro | parità | il settore del tenant e le scelte legate leggono il perimetro | idem | idem |
| 4 | famiglie, categorie, alias, livelli di padronanza delle competenze | PARZ | datastore | aggiungere ciò che manca (la categoria arriva già col pacchetto) | i quattro moduli `*_ADMIN_ONLY` diventano di sola lettura sul perimetro | idem | via i moduli di scrittura del catalogo |
| 5 | legami competenza→formazione (`sys_skill_learning_mappings`) | NO | datastore | costruire | perimetro | idem | idem |
| 6 | ruoli di catalogo (`sys_job_roles` senza tenant), famiglie professionali, ruoli e cruscotti di contenuto dei modelli | NO | datastore (il ruolo è l'oggetto nuovo sopra la posizione, decisione 6 dell'11 ottobre) | costruire il ruolo nel contratto v0.3; ruoli e cruscotti nel pacchetto (#264 M2) | `/v1/job-roles` legge perimetro + voci proprie (è la prova 1 di ADR-0039) | idem | via le voci fuori perimetro |
| 7 | modelli di unità e tipi di unità, modelli operativi | PARZ | datastore | completare i modelli operativi | perimetro | idem | idem |
| 8 | indicatori di catalogo (`sys_kpi_definitions` senza tenant) e definizioni collegate, modelli di indicatori per processo e per unità | SÌ / PARZ | datastore | parità; gli indicatori che il caricatore scrive oggi senza tenant passano a essere perimetro | perimetro | idem | idem |
| 9 | moduli formativi di catalogo | NO | datastore | costruire (oggi la formazione del pacchetto è proposta per tenant) | perimetro | idem | idem |
| 10 | fasce retributive di catalogo, porte di ricompensa | PARZ / NO | datastore (CCNL con livelli e minimi; le porte arrivano nella forma del pacchetto, #264 M3) | costruire le porte | perimetro | idem | idem |
| 11 | traduzioni dei cataloghi (`sys_reference_translations` per le tabelle di catalogo) | SÌ, più larghe | datastore; in advanced solo quelle delle voci del perimetro e del prodotto | parità di lingue | il caricatore porta le etichette del perimetro | idem | via le traduzioni di voci uscite |
| 12 | vettori dei cataloghi (competenze, professioni, ruoli) | SÌ (competenze, professioni) | datastore; in advanced solo quelli del perimetro | parità del modello di vettore o regola di ricalcolo dichiarata | la ricerca per significato confronta solo dentro il perimetro (regola 5) | idem | via i vettori fuori perimetro |
| 13 | sincronizzazione dei cataloghi (schema `reference_sync`, modulo `reference-sync`, `tenant-import-runs` sulle stesse tabelle, timer) | SÌ, è il suo mestiere | datastore | nessuno | il caricatore del pacchetto sostituisce la sincronizzazione | spegnere il timer | via modulo, schema (con archivio) e timer |
| 14 | famiglie e varianti di modello scritte a mano nelle migrazioni, moduli di scrittura dei blueprint | SÌ | datastore genera; advanced registra e attiva | il datastore produce anche famiglia e stato pubblicato (#264 M4) | i blueprint arrivano solo dal caricatore | le due famiglie scritte a mano si sostituiscono con fascicoli del datastore | via le scritture a mano: si emendano le migrazioni che le creano (ADR-0035) |
| 15 | creazione sintetica di un tenant (`tenants/provisioning.ts`) | PARZ | datastore genera il modello; advanced costruisce il tenant dal fascicolo | nessuno | `provisioning.ts` riletto: resta solo ciò che crea il tenant vuoto e lo collega al fascicolo | idem | via la parte che sceglie o compone un modello |
| 16 | acquisizione dei semi (`research`, `seed-candidate-records`, `seed-approval-decisions`, tabelle `sys_seed_*`, `sys_research_sources`, pagina `seed-acquisition/`) | SÌ | datastore | parità delle prove e delle decisioni che servono ancora | nessuno | nessuno | via moduli, pagina e tabelle (con archivio) |
| 17 | funzioni di piattaforma del tenant «Heuresys System» (pagine `blueprints/`, `skill-taxonomy/`, `job-catalog/`, `generated-origins/`, `provenance/`, `leads/`, `system-health/`, `tenants/`, `tenant-blueprints/`) | PARZ (strumenti sì, console no) | datastore per ciò che genera o cura cataloghi; advanced per l'amministrazione tecnica dei tenant | console del datastore per ciò che esce | misurare pagina per pagina quale richiede solo un ruolo di piattaforma (non misurato nel censimento) | idem | via le pagine di piattaforma; restano `tenants/` e `system-health/` |

Due voci restano fuori dalla tabella perché non sono piattaforma: i cataloghi del prodotto advanced e i seed del tenant RTL Bank (vedi sopra).

## La sequenza e le prove che la rendono sicura

L'ordine è obbligato: **niente si commuta prima che il datastore abbia tutto, niente si ritira prima che nessuno lo legga.**

1. **S3, parità (datastore).** Per ogni riga della tabella con «NO» o «PARZ», il datastore porta la voce mancante. Prova: un confronto per chiave naturale (codice ESCO, codice ATECO, codice professione, codice indicatore) fra le voci che i tenant di advanced usano oggi e ciò che il datastore sa rilasciare; esito atteso zero mancanti. Il confronto è uno script nel repository, che si vede rosso prima e verde dopo.
2. **S4, perimetro (advanced).** Il caricatore scrive il perimetro insieme al fascicolo; ogni lettura per un tenant passa dal perimetro più le voci proprie. Il cancello di avvio che già esiste (`apps/api/src/lib/scope/gate.ts`, asse del catalogo di ADR-0039: elenco dichiarato `RISORSE_DI_CATALOGO` e dichiarazioni `profile` / `platform` / `open` / `tenant`) si estende a tutte le risorse della tabella qui sopra, non solo alle quattro di oggi; `profile` diventa «perimetro»; dopo S6 le dichiarazioni `platform` e `open` su un catalogo di dominio non sono più ammesse e l'avvio fallisce. Prova: `/v1/job-roles` da un utente della banca non restituisce voci fuori perimetro; prima del cambio le restituiva.
3. **S5, commutazione.** RTL Bank riceve il suo perimetro dal datastore. Due misure, entrambe a zero: voci che RTL Bank usa oggi (righe del tenant che puntano a una voce di catalogo) e che mancano dal perimetro; letture di advanced che toccano una voce fuori da ogni perimetro (sul gemello, con il diario delle query della suite API).
4. **S6, ritiro** (conferma di Enzo, fine onda 3). Per ogni oggetto da togliere, in quest'ordine:
   - **archivio completo con impronta**: copia per tabella (`pg_dump --table`) e impronta SHA-256 di ogni file, depositati nel backup fuori dal database e fuori dal repository;
   - **prova di ripristino sul gemello**, su una copia usa-e-getta: si ripristina dall'archivio e si confrontano conteggio e impronta del contenuto con l'originale; se non coincidono il ritiro non parte;
   - **ritiro secondo ADR-0035**: si emenda il file che crea o popola l'oggetto (o lo si marca `-- @migrate: once`), poi si rimuove l'esemplare esistente con **elenco esplicito**, guardia che ricontrolla la precondizione al momento dell'esecuzione (la voce è fuori da ogni perimetro, nessun tenant la punta), post-condizione su ciò che non doveva cambiare (righe dei tenant, voci del perimetro), giornale `staging.*_undo` per le righe;
   - **sentinella permanente**: una vista `sys.v_*` nuova (che `db_health.py` raccoglie da sola e pretende a zero righe) diventa rossa se in advanced ricompare una voce di catalogo senza tenant fuori da ogni perimetro; un controllo statico in `docs/kb/tools/` diventa rosso se ricompare un modulo nell'elenco dei generatori ritirati (`reference-sync`, `research`, scrittura dei blueprint, acquisizione dei semi).

Ogni passo si prova prima sul gemello su copia usa-e-getta, come ogni migrazione del progetto, e si rilascia con il gesto di Enzo.

## Che cosa non si fa in questo ciclo

Niente si toglie, si sposta o si filtra. Questo ADR descrive la sequenza; i passi S3-S6 sono lavoro delle onde 1-3 del piano. `CLAUDE.md` (testo di I21) e lo stato di ADR-0039 si aggiornano solo all'approvazione.

## Opzioni scartate

- **Tenere i cataloghi in advanced e filtrarli soltanto per profilo** (ADR-0039 così com'è). Scartata: due copie dello stesso catalogo, una nel datastore e una in advanced, divergono; è la regola 1 del criterio che lo esclude.
- **Leggere i cataloghi dal datastore a ogni richiesta** (advanced interroga il database del datastore). Scartata: lega la disponibilità di advanced a quella del datastore e permette al tenant di sfogliare il catalogo generale, che la regola 3 vieta. La porta a consumo verso il datastore (decisione rimandata al cancello dell'onda 4) serve a estendere il fascicolo, non a leggere il catalogo.
- **Una copia intera del catalogo per ogni tenant.** Scartata: moltiplica i dati per il numero dei tenant e contraddice la regola 2 (il perimetro è il tipo d'impresa, non il catalogo intero).
- **Ritirare subito, in un colpo solo.** Scartata: senza parità e commutazione si perde ciò che RTL Bank usa oggi; il ritiro è irreversibile su dati di produzione e viene per ultimo, dopo archivio e prova di ripristino.
- **Spostare in datastore anche la costruzione del tenant dal modello.** Scartata: costruire il tenant è inizializzazione, cioè dominio del tenant; il datastore rilascia il fascicolo e si ferma lì.

## Conseguenze

- **Per Enzo e per il cliente**: un responsabile HR di RTL Bank vede e cerca soltanto ciò che appartiene a una banca retail regionale, più ciò che ha creato lui; se gli serve altro lo chiede e arriva con una versione nuova del fascicolo.
- **Per chi sviluppa**: i moduli che oggi leggono il catalogo intero (il censimento ne elenca i lettori: tra gli altri `semantic-matching`, `public-stats`, `capability-composition`, `job-roles`, `job-families`, `analytics`, `positions`) devono passare dal perimetro; `public-stats` è da decidere a parte, perché pubblica numeri della piattaforma.
- **Su altri ADR**: ADR-0039 passa a «Superseded in part by ADR-0043» per le regole 1 e 4; ADR-0041, sezione «Cosa non cambia», cita `reference_sync` come intoccato: con S6 esce da advanced; ADR-0029 (traduzioni) e ADR-0030 (gruppi ESCO) restano validi per le voci del perimetro.
- **Costo dichiarato**: il lavoro è dentro le onde 1-3 del piano (S3 nell'onda 1, S4 nell'onda 2, S5 e S6 nell'onda 3); questo ADR non aggiunge sessioni proprie.
- **Rischio principale**: una lettura che usa una voce di catalogo senza passare dal tenant e che S5 non vede. Lo copre la misura del passo S5 sul diario delle query e la sentinella di S6.

## Come si verifica che sia fatto (a fine onda 3)

Le prove devono poter fallire: ognuna si mostra rossa prima del passo.

1. In advanced nessuna voce di catalogo senza tenant è fuori da ogni perimetro (sentinella di S6 a zero; prima di S6 non è zero).
2. `/v1/job-roles`, la ricerca delle competenze e l'incrocio per significato, chiamati da un utente di RTL Bank, restituiscono solo voci del perimetro e voci proprie.
3. Una voce chiesta fuori perimetro arriva con una versione nuova del fascicolo, senza scritture a mano sul database.
4. In advanced non resta alcun modulo che genera modelli o sincronizza cataloghi (controllo statico a zero).
5. Ogni oggetto ritirato ha archivio, impronta e prova di ripristino registrati.
