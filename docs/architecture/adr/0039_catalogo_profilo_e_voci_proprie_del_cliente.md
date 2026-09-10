# ADR-0039 — Catalogo, profilo, voci proprie: dove vive ciò che un cliente può farsi su misura

- **Status**: **ACCEPTED** — approvato da Enzo Spenuso il 2026-09-09
- **Date**: 2026-09-09
- **Amends**: invariante **I5** (isolamento fra clienti), per la parte che riguarda i cataloghi di piattaforma
- **Decided by**: Enzo Spenuso — decisione presa e ADR approvato il 2026-09-09
- **Redatto da**: sessione Cowork in sola lettura. **La CLI lo committa in `docs/architecture/adr/` senza riscriverlo**: se non è d'accordo su un punto, lo dice a Enzo prima di toccare il codice
- **Preparato da**: analisi forense del 2026-09-08/09, bundle `BUNDLE_CLI_20260909`

> I **conteggi non stanno in questo documento**, per la stessa ragione di ADR-0038: un numero cristallizzato in un ADR è falso il giorno dopo. Si ri-derivano con `05_verifiche/peso_tenant_3_catena.sql` e `05_verifiche/scheda_del_cliente.py` del bundle.

---

## Contesto

Il prodotto ha oggi un cliente vero. Quando ne arriverà un secondo, tre domande diventeranno urgenti tutte insieme: un cliente può darsi ruoli propri? può cambiare la propria dashboard? e cosa vede quando apre un elenco che la piattaforma tiene per tutti?

La misura del 2026-09-09 dice dove siamo. Una parte delle tabelle dello schema `sys` sta **fuori da ogni catena del cliente**: non ha la colonna del cliente e non la raggiunge per discendenza. Quasi tutte sono cataloghi condivisi per disegno — ESCO, ISCO, traduzioni, codici di settore, migrazioni — e vanno benissimo così. Tre gruppi però non sono cataloghi neutri, sono **configurazione che il cliente vorrà propria**:

- **I ruoli professionali** (`sys_job_roles`). Il repository lo dichiara in testa: *«no tenant_id — platform-level»*. L'elenco è uno per tutti, l'API `/v1/job-roles` non filtra, e un responsabile HR della banca che apre quell'elenco vede anche i ruoli di settori che non sono il suo.
- **Le dashboard** (`sys_dashboards`, `sys_dashboard_blocks`, `sys_dashboard_block_data_classes`). Sono uniche per tutti: il giorno in cui un cliente sposta un riquadro, lo sposta a ogni altro cliente.
- **I ruoli di autorizzazione** (`sys_auth_roles` e i suoi permessi). Un cliente non può definirsi un ruolo proprio. Per una banca l'elenco attuale è adeguato; per un'assicurazione o un'industria, che chiamano le cose in altro modo, è un limite che si scopre il primo giorno.

**Enzo ha deciso**: *«ogni cliente dovrà poterseli fare su misura»*, e insieme: *«i ruoli che appartengono ad altri settori devono restare nei cataloghi (ESCO, ISCO eccetera), perché dovranno essere disponibili quando si crea un cliente nuovo»*.

Le due frasi insieme dicono una cosa sola, e non è «dare la colonna del cliente ai cataloghi». Dicono che **catalogo e profilo sono due cose diverse, e oggi ne abbiamo una sola**.

## La scoperta che rende questo ADR piccolo invece che grande

Il modello a tre livelli **esiste già nel prodotto, in tre punti indipendenti**, e nessuno lo ha mai nominato:

1. **Le competenze lo fanno da sempre.** `sys_skills` porta `skill_tenant_id` **annullabile**: le competenze del catalogo hanno il cliente vuoto, quelle che un cliente si è aggiunto lo hanno valorizzato. La stessa tabella ospita entrambi i livelli, e la colonna dice a quale dei due appartiene ogni riga. Lo stesso schema è già applicato a moduli formativi, percorsi formativi, percorsi di carriera, definizioni di KPI, fasce retributive e curve di premio.
2. **Il profilo di settore ha già le sue tabelle.** `sys_blueprint_content_units`, `_positions`, `_skills`, `_kpis` descrivono che cosa un modello di settore porta dentro un cliente quando lo si materializza. La struttura è costruita, con la sua catena famiglia → variante → versione → contenuto, e il modulo `tenant-materialization` che la applica.
3. **E sono vuote.** Tutte e quattro. Il meccanismo è stato costruito e mai usato: è il motivo per cui oggi il catalogo e il profilo coincidono, e il cliente vede tutto.

Non c'è quindi da inventare un modello. C'è da **nominare quello che esiste, completarlo dove manca, e riempirlo**.

## Decisione

> **Un catalogo è di tutti e non porta mai il cliente. Un profilo dice quali voci del catalogo un cliente usa. Le voci che un cliente si crea vivono accanto a quelle di catalogo, nella stessa tabella, distinte dalla colonna del cliente.**

In concreto, quattro regole.

**1. I cataloghi non acquisiscono mai la colonna del cliente.** ESCO, ISCO, le classificazioni delle attività, le traduzioni, i ruoli professionali, i blocchi di dashboard restano di piattaforma. Un ruolo che oggi appartiene a un altro settore **non si cancella e non si sposta**: resta lì, ed è la ragione per cui ci sarà quando nascerà il cliente che ne ha bisogno.

**2. Il profilo di un cliente si esprime col meccanismo dei blueprint, esteso.** Le quattro tabelle di contenuto esistenti si popolano; se ne aggiungono due dello stesso disegno per ciò che oggi non è coperto — i **ruoli professionali** e le **dashboard**. Nessuna tabella di legame nuova e diversa: la forma è quella già scelta dal progetto, e chi la conosce per le posizioni la riconosce per i ruoli.

**3. Le voci proprie del cliente stanno nella tabella del catalogo, con la colonna del cliente valorizzata** — come già fanno le competenze. Una tabella per il catalogo e una gemella per il cliente sarebbero due elenchi da tenere allineati per sempre: la stessa tabella con una colonna che dice «di chi è» ha un solo posto dove cercare.

**4. Ogni lettura fatta per un cliente passa dal profilo.** Un elenco chiesto da un utente del cliente restituisce le voci del suo profilo più le sue voci proprie, mai il catalogo intero. Il catalogo intero resta visibile a chi amministra la piattaforma e a chi sta costruendo un cliente nuovo — che è l'unico momento in cui serve vederlo tutto.

## Conseguenze

**Va fatto prima del secondo cliente, e questa è la ragione tecnica**: finché il cliente è uno, il livello del profilo si aggiunge senza spostare un dato — si popola una tabella e si cambiano le letture. Con due clienti dentro, la stessa modifica diventa una migrazione di contenuto, con la domanda «di chi era questa riga?» da risolvere una per una.

**Cosa cambia per chi sviluppa**: ogni modulo che oggi legge un catalogo senza filtro dovrà passare dal profilo. Sono pochi moduli e si contano — `job-roles`, `dashboard`, `job-families` — ma la regola vale anche per quelli che verranno dopo, e va messa dove una regola di questo tipo vive già nel progetto.

**E il posto esiste, con un'ironia utile.** `apps/api/src/lib/scope/gate.ts` (ADR-0027 F2) legge il permesso di ogni rotta registrata e **rifiuta di avviare l'applicazione** se una rotta di lettura su una risorsa sensibile non dichiara come tratta l'esposizione a livello di persona. Le dichiarazioni ammesse sono un insieme chiuso, e una di esse si chiama già **`catalog`**: *«la rotta restituisce solo righe di risorsa o di struttura — catalogo competenze, definizioni KPI, moduli formativi, profili di banda — nessuna riga di persona»*.

Quella parola oggi risponde a una domanda sola: *contiene persone?* Non risponde all'altra: *è filtrata per il profilo del cliente?* — perché quella domanda, finché il cliente era uno, non esisteva. L'estensione naturale di questo ADR è quindi **aggiungere al cancello la seconda domanda**, non costruirne uno nuovo: una rotta che dichiara `catalog` dovrà dire anche se serve il catalogo intero (e allora è per la piattaforma) o il profilo del cliente. Chi dimentica di dirlo non avvia l'applicazione, esattamente come accade oggi sull'asse organizzativo.

**Cosa cambia per il cliente**: apre l'elenco dei ruoli e trova i suoi. Ne aggiunge uno che gli serve e resta suo. Cambia la propria dashboard senza cambiarla a nessun altro.

**Cosa NON cambia**: le competenze, i moduli formativi, i percorsi, i KPI e le fasce retributive continuano a funzionare esattamente come oggi. Questo ADR non li tocca — li prende a modello.

**Il costo dichiarato**: due tabelle di contenuto blueprint, il popolamento di quelle esistenti, la revisione di tre moduli di lettura, e il cancello che impedisce di dimenticarsene. Non è un rifacimento: è completare una cosa già iniziata.

## Alternative scartate

**Dare la colonna del cliente ai cataloghi.** Sembra la via breve, ed è quella che rompe la decisione di Enzo: un ruolo assegnato a RTL Bank non sarebbe più disponibile per il cliente alimentare di domani, e ogni cliente nuovo ripartirebbe da un catalogo vuoto da riempire a mano. È esattamente il contrario di ciò che serve.

**Cancellare dai cataloghi le voci che il cliente attuale non usa.** Scartata per la stessa ragione, detta da Enzo: *«l'importante è che rimangano nei cataloghi perché dovranno essere disponibili quando si crea un cliente nuovo»*. In più, sarebbe una cancellazione — e in questo progetto si cancella solo con conferma esplicita, caso per caso.

**Filtrare per settore invece che per profilo.** Dedurre che una banca non vuole vedere «pasticcere» perché il suo codice di settore è bancario funziona finché un cliente non ha una mensa aziendale. Il profilo è una scelta dichiarata; il settore è un'inferenza, e le inferenze in questo prodotto hanno già fatto danni misurabili.

**Rimandare al secondo cliente.** Scartata per il motivo scritto sopra: la stessa modifica costa una tabella oggi e una migrazione domani.

## Come si verifica che sia fatto

Tre prove, e devono poter fallire — cioè si deve poter mostrare che **prima** davano l'esito opposto:

1. `/v1/job-roles` chiamata da un utente della banca **non** restituisce i ruoli fuori dal suo profilo; chiamata da un amministratore di piattaforma li restituisce tutti.
2. Un ruolo creato da un cliente **non** compare a un altro cliente, e **non** sparisce dal catalogo quando quel cliente lo smette di usare.
3. Un ruolo di catalogo che nessun profilo usa resta interrogabile da chi costruisce un cliente nuovo. È la prova che la decisione di Enzo è rispettata: i cataloghi non si svuotano.
