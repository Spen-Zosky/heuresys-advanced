# ADR-0060 — Le applet dell'assistente: il lavoro che l'assistente costruisce e svolge, entro i permessi di chi lo chiede

- **Status**: ACCETTATO il 2026-11-18 da Enzo Spenuso, alle 15:50 UTC (16:50 ora di Roma), sulla scheda del thread «Progettare le applet generate dall'assistente»: «Accetto tutto» (ADR e decisioni E1-E5 del piano, come raccomandate). Proposto lo stesso giorno
- **Date**: 2026-11-18
- **Redatto da**: Claude Code, thread «Progettare le applet generate dall'assistente»
- **Richiesta**: Enzo Spenuso, 2026-11-18 alle 15:32 UTC (16:32 ora di Roma): «i nostri agenti/assistenti sono in grado di generare delle applet sulla base della richiesta dell'utente e svolgerle in autonomia?»; alle 15:37 UTC il caso guida sulla pagina del consolidamento («21 processi su 42 non hanno un responsabile in carica»); alle 15:40 UTC: «progetta tutto in modo esteso e robusto: deve poter fare tutto e i limiti ed i perimetri d'azione saranno interamente derivati dalle autorizzazioni e dai permessi a disposizione dell'utente loggato».
- **Piano di attuazione**: [`docs/piani/PIANO_applet-assistente_20261118.md`](../../piani/PIANO_applet-assistente_20261118.md)
- **Poggia su**: ADR-0040 (l'agente legge ciò che legge la persona), ADR-0050 D5 e D6 (riconferma recente; gli agenti non portano mandati in scrittura; D6 emendato il 2026-11-18 nella PR #298 per le letture a perimetro pieno con `{omissis}`), ADR-0053 (capacità `CONFERMA`/`LIBERA`, ritorno provato, registro «per conto di»), ADR-0056 (classi A/B/C/X, assistente come applicazione), ADR-0035 (ritirare non è cancellare), ADR-0059 (consolidamento: bozza, solo il pulsante rosso scrive)
- **Si collega a**: PR #298 (finestra dell'assistente come Claude, `apps/agent-gateway/src/omissis.ts`), PR #300 (richieste dell'agente con previsione di spesa e registro dei costi, migrazione `000501`), PR #296 (Faldone dell'Utente, campi vietati come `{omissis}`)
- **Non tocca**: gli invarianti di `CLAUDE.md`; ADR-0036 §5 (le cinque eccezioni); ADR-0050 D6 nella parte sulle scritture; la classe X di ADR-0056 D2, che anzi questo ADR conferma per l'esecuzione di codice.

> **In parole semplici.**
> 1. Quando una persona chiede all'assistente di risolvere un problema, l'assistente non risponde solo a parole: costruisce dentro la chat un piccolo strumento di lavoro, l'applet (per esempio una tabella con una proposta per ogni riga), e lo porta fino in fondo.
> 2. L'applet non è un programma scritto dall'IA. È una descrizione ordinata («leggi questo, mostra questa tabella, proponi queste modifiche, poi verifica») che la piattaforma disegna con i suoi componenti ed esegue con le sue regole. Il codice scritto dal modello non gira mai.
> 3. Che cosa l'applet può fare lo decidono soltanto i permessi della persona che la chiede: legge ciò che lei può leggere (il resto compare come `{omissis}`), propone ciò che lei può fare, e ciò che lei non può fare diventa una richiesta a chi ha il potere di farlo.
> 4. Niente si scrive finché la persona non preme il pulsante rosso, dopo aver visto un'anteprima dell'effetto. Le modifiche partono con la sua identità e i suoi permessi, come se le facesse lei pagina per pagina, e ognuna si può annullare.
> 5. Alla fine l'applet rilegge i dati, mostra il prima e il dopo e lascia la traccia di chi ha deciso che cosa.

---

## §1 — Contesto

Oggi l'assistente di advanced legge con il perimetro della persona (ADR-0040, ADR-0050 D6 emendato nella PR #298), comanda la vista della pagina aperta (`apps/agent-gateway/src/comandi-vista.ts`, comandi di classe A) e può chiedere scritture una alla volta, ciascuna con un'approvazione nella finestra (`approval-bridge.ts`, coda in memoria di due minuti). Davanti a un problema che chiede molte decisioni collegate, come i 21 processi senza responsabile del caso guida, l'assistente sa elencare il problema ma non sa portarlo a soluzione: mancano un oggetto di lavoro che tenga insieme le proposte, la decisione riga per riga, l'anteprima dell'effetto complessivo, l'esecuzione a passi annullabile e la verifica finale.

Tre fatti misurati sul codice di `main` 034162e il 2026-11-18 delimitano il disegno:

- **Il gettone d'agente non porta mandati in scrittura** (ADR-0050 D6; nella PR #298 i ruoli pieni nel claim `rl` valgono solo per GET e HEAD). Una persona con `HRMS_MANAGER`, che è il caso guida, non potrebbe scrivere attraverso il gettone d'agente ciò che può scrivere con la propria sessione. Se l'applet scrivesse con il gettone, i suoi limiti non sarebbero «interamente derivati dai permessi della persona», come chiede Enzo: sarebbero più stretti.
- **L'esecuzione di codice è in classe X** (ADR-0056 D2): non esiste nel catalogo. Un'applet fatta di codice generato dal modello sarebbe esattamente quell'operazione.
- **L'azione che il caso guida richiede non esiste nell'API.** Nessuna rotta di `apps/api/src/modules/` scrive `sys.sys_tenant_processes.tenant_process_owner_position_id`: la colonna si scrive solo dagli script `db/scripts/rtl-allinea/C1_processi.sql` e `db/scripts/attivita/riempi-attivita-dei-processi.sql` e dall'applicazione del consolidamento (`tenant-consolidation/applicazione.ts`, che scrive solo nome, codice e descrizione). Il comando che lo rimisura: `grep -rln "tenant_process_owner_position_id" apps/api/src`. Un'applet «che può fare tutto» incontra quindi tre tipi di azione: quelle che la persona può eseguire, quelle che esistono ma che la persona non può eseguire, e quelle che la piattaforma non sa ancora fare. Il disegno deve trattarle tutte e tre.

Il conteggio del caso guida è la lente `processi-senza-responsabile` in `apps/api/src/modules/quadro/lenti.ts`: processo attivo del tenant con `tenant_process_owner_position_id` nullo, oppure con una posizione senza assegnazione `ACTIVE` in `sys.sys_user_position_assignments`.

## §2 — Decisione

**D1 — Che cos'è un'applet.** Un'applet è una **specifica dichiarativa** generata dal modello, validata da uno schema Zod condiviso (`AppletSpec` in `packages/shared/src/schemas/applets.ts`) e salvata nel database con versione e impronta SHA-256. Ha sei parti, sempre le stesse:

| parte | che cosa dice | chi la riempie |
|---|---|---|
| scopo | la richiesta della persona, in chiaro, e la pagina da cui nasce | il modello, dalla conversazione |
| fonti | le letture che servono, ciascuna come operazione del catalogo con i suoi argomenti | il modello sceglie, il gateway esegue con i permessi della persona |
| vista | la composizione dei componenti dalla libreria chiusa (D4) | il modello sceglie e lega ai dati delle fonti |
| righe di lavoro | per ogni oggetto da sistemare: la causa misurata, le proposte motivate, la proposta raccomandata, lo stato della decisione | il modello propone, la persona decide |
| azioni | per ogni proposta, le operazioni di scrittura del catalogo con argomenti legati a identificativi letti dalle fonti | il modello compone, il codice controlla (D6) |
| verifica | la lettura da rifare dopo l'esecuzione e la condizione attesa (per il caso guida: la lente rimisurata) | il modello propone, il codice esegue |

La specifica non contiene codice, espressioni da valutare, URL, HTML o SQL. Un campo che il validatore non conosce fa rifiutare l'intera specifica. È la stessa scelta dei comandi della vista (catalogo chiuso, argomenti validati), estesa da un comando a un lavoro.

**D2 — Il catalogo delle azioni deriva dai permessi della persona, e da niente altro.** Per ogni persona e in ogni momento il catalogo è l'intersezione di tre insiemi, calcolata dall'API e mai dal modello:

1. le operazioni dell'atlante (`docs/kb/atlas/agent-operations.json`: concetto, operazione, metodo, percorso, permesso), con la loro classe A/B/C (ADR-0056 D2; `apps/agent-gateway/src/classi-azioni.ts`);
2. i permessi effettivi della persona (`userPermissionCodes`, gli stessi di `GET /v1/auth/me`);
3. il perimetro della persona sull'oggetto (il risolutore di `apps/api/src/lib/scope/`), che si applica riga per riga al momento dell'anteprima e di nuovo al momento dell'esecuzione.

Ogni azione che il modello vorrebbe proporre ricade in uno di tre stati, che l'applet mostra accanto alla riga:

| stato | quando | che cosa succede |
|---|---|---|
| `ESEGUIBILE` | l'operazione esiste, la persona ha il permesso e l'oggetto è nel suo perimetro | entra nel piano che il pulsante rosso esegue |
| `DA_RICHIEDERE` | l'operazione esiste, ma la persona non ha il permesso o l'oggetto è fuori dal suo perimetro | diventa una richiesta indirizzata a chi, nel tenant, ha quel permesso su quell'oggetto; l'applet nomina il ruolo (mai una persona fuori dal perimetro di chi chiede); la persona che riceve la richiesta apre la stessa applet, rivista con i propri permessi |
| `NON_DISPONIBILE` | la piattaforma non ha l'operazione (il caso del responsabile di un processo, §1) | diventa una richiesta di sviluppo in coda (`sys.sys_agent_requests` della PR #300, con previsione di spesa), che passa dal sì di Enzo (regola T2 del 15/11) |

Nessun insieme di permessi «dell'assistente» esiste: se la persona perde un permesso, l'applet perde l'azione alla lettura successiva. Le operazioni di classe X non sono nel catalogo e quindi non sono proponibili.

**D3 — Chi scrive: la persona, con la sua sessione, al pulsante rosso.** L'esecuzione di un'applet confermata non passa dal gettone d'agente. Passa da un esecutore nell'API (modulo `apps/api/src/modules/applets/`) che riceve la conferma dalla sessione della persona (cookie, CSRF, e per la classe C la riconferma del secondo fattore di ADR-0050 D5) e rientra nelle rotte `/v1/*` ordinarie con `app.inject`, portando la stessa identità, gli stessi permessi e la stessa intestazione di richiesta. Ogni scrittura attraversa quindi `requirePermission`, il risolutore di perimetro, la validazione del contratto e il registro `audit.registro_scritture` esattamente come se la persona la facesse dalla pagina; il registro riceve in più il riferimento all'applet e al passo. Conseguenze:

- i limiti dell'applet coincidono con quelli della persona, mandati compresi, senza emendare ADR-0050 D6: il gettone d'agente resta senza mandati in scrittura;
- non esiste una via di scrittura nuova da proteggere: l'esecutore non tocca il database se non attraverso le rotte esistenti, e non ha permessi propri;
- l'agente, da solo, legge, calcola, propone e prepara la bozza. Scrive senza il pulsante rosso solo nel caso di D9.

**D4 — I componenti che un'applet può usare.** Una libreria chiusa, versionata in `@heuresys/ui` (repo `ux-design-shared`, regola `.claude/rules/design-system-ui.md`), con un contratto per componente nello schema `AppletSpec`. La prima versione:

| componente | serve a | regole |
|---|---|---|
| tabella di lavoro | una riga per oggetto, con causa, proposta, alternativa scelta dal menu, decisione (accetta, cambia, scarta) e stato in ultima colonna | interfacce intelligenti R1-R7; persone «Cognome, Nome»; decisioni in blocco; filtri |
| scheda indicatore | il numero del problema, prima e dopo | numeri it-IT |
| riepilogo d'impatto | ciò che cambierà, ricalcolato dal codice (D5) | sempre visibile accanto al pulsante rosso |
| grafo e blocchi | organigramma, processi a nodi, vista a blocchi | regole degli organigrammi (fit, zoom, doppio clic, modale) |
| Gantt e flusso | progetti e processi dove applicabile | regola del 18/11 su processi e progetti |
| modulo | un dato da inserire, generato dallo schema Zod dell'operazione | nessun campo libero fuori schema |
| elenco richieste | le righe `DA_RICHIEDERE` e `NON_DISPONIBILE`, con destinatario e stato | una richiesta per destinatario, non per riga |
| avanzamento | l'esecuzione passo per passo | animazione evidente e barra (regola del 16/11) |
| avviso arancione | modifiche in bozza non ancora confermate | come nel consolidamento |
| pulsante rosso | la conferma | unico punto che scrive |

L'applet vive nella finestra dell'assistente (PR #298), si apre a tutto schermo e in una modale ridimensionabile, e si può riaprire dall'elenco delle attività dell'assistente (ADR-0056 D4) anche dopo aver chiuso la finestra o cambiato pagina. Un componente nuovo nasce nella libreria e nello schema, mai nella risposta del modello.

**D5 — Anteprima a secco prima di ogni scrittura.** Prima che il pulsante rosso si accenda, l'esecutore fa una prova a secco dell'intero piano: esegue tutte le operazioni confermate dentro una transazione di database che alla fine annulla sempre, legata alla richiesta con un contesto asincrono (`AsyncLocalStorage`) che fa usare a ogni repository lo stesso client. Nella stessa transazione rimisura la verifica dell'applet (per il caso guida la lente `processi-senza-responsabile`), così il riepilogo d'impatto dice il numero che si otterrà, non quello che il modello immagina. Il riepilogo riporta: righe che passano, righe che falliscono e perché (permesso, perimetro, validazione, conflitto), effetti collaterali misurati (per esempio il carico delle persone proposte), operazioni di classe C che chiederanno la riconferma. Un'operazione il cui modulo non regge la transazione condivisa (ad esempio perché chiama servizi esterni) si marca nel catalogo come «senza prova a secco» e l'anteprima lo dichiara accanto alla riga invece di tacerlo.

**D6 — Ciò che il modello non può inventare.** L'esecutore controlla, prima dell'anteprima e di nuovo prima dell'esecuzione:

- **legame alle fonti**: ogni identificativo negli argomenti di un'azione deve comparire nei risultati delle letture dell'applet, fatte con i permessi della persona; un identificativo mai letto fa rifiutare la riga;
- **impronta**: la conferma porta l'impronta SHA-256 della specifica e delle decisioni che la persona ha visto; se differisce da ciò che si sta per eseguire, l'esecuzione si ferma («ciò che hai visto è ciò che parte»);
- **ricontrollo al momento**: permessi, perimetro e precondizioni si rileggono all'esecuzione; una riga cambiata da altri dopo l'anteprima si salta e si segnala;
- **tetto**: un numero massimo di scritture per applet, parametro di configurazione, oltre il quale l'applet si divide;
- **testo letto come dato**: ciò che le fonti restituiscono (descrizioni, nomi, note) arriva al modello dentro un blocco marcato, mai come istruzione (P5); un testo che chiede di cambiare l'applet non cambia niente, perché il piano lo decide la persona riga per riga.

**D7 — Classi.** Un'applet è di classe A finché legge e propone. Al pulsante rosso ogni azione porta la propria classe: B passa con la conferma della persona; C (effetto su un singolo lavoratore, per esempio assegnare una persona a una posizione scoperta) passa solo con la doppia conferma di ADR-0056 D2, la seconda con la riconferma del secondo fattore su un riepilogo ricalcolato dal codice; X non esiste. La raccomandazione di una persona per una riga è una proposta motivata, e la decisione resta della persona (GDPR art. 22).

**D8 — Annullare.** Ogni operazione di scrittura del catalogo dichiara come si annulla: la sua operazione inversa nell'API, oppure il giornale `staging.agent_applet_undo` con il valore precedente, sul modello di `staging.tenant_consolidation_undo`. Un valore si rimette com'era solo se nessun altro lo ha cambiato nel frattempo. Si annulla un passo o l'applet intera, con un gesto registrato. Un'operazione che non sa dire come si annulla resta proponibile solo con un avviso esplicito e la doppia conferma, come una C. Nessuna cancellazione fisica (ADR-0035).

**D9 — Quando l'applet lavora senza clic.** Le azioni di classe B che rientrano in una capacità `LIBERA` del tenant (ADR-0053, registro `sys.v_agent_capability_activations_current`) possono partire senza pulsante rosso, entro il tetto della capacità, con le tre condizioni previe di ADR-0053 D2 e il registro «per conto di». In quel caso scrivono con l'identità di chi ha attivato la capacità, nei limiti dei suoi permessi. Tutto il resto aspetta la persona.

**D10 — Costi e limiti.** Generare un'applet costa giri di modello. Prima di costruirla l'assistente mostra una previsione di spesa e la confronta con il tetto della conversazione, come le richieste della PR #300; ogni giro lascia una riga in `sys.sys_agent_call_log`. Il calcolo dell'anteprima e l'esecuzione non usano il modello. I limiti di conversazioni, giri e durata di `apps/agent-gateway/src/limiti.ts` valgono anche qui.

**D11 — Traccia.** Restano scritti, senza poterli riscrivere: chi ha chiesto l'applet e da quale pagina; la specifica di ogni versione con la sua impronta; chi ha deciso ogni riga e quando; la conferma con l'impronta; ogni passo eseguito con esito, codice di risposta e identificativo di richiesta; le richieste nate dall'applet; gli annullamenti. Le tabelle nuove stanno in `sys.*` con campi categorici `varchar + CHECK` (RD-08) e entrano nell'allowlist di Storia36 nella stessa PR che le crea.

## §3 — Il caso guida, passo per passo

Valentina Conti, Responsabile Direzione HR di RTL Bank (`HRMS_MANAGER`), apre l'assistente sulla pagina del consolidamento e chiede di risolvere «21 processi su 42 non hanno un responsabile in carica».

1. **Capisce e misura.** L'assistente rilegge la lente e divide i processi per causa: posizione responsabile assente, oppure posizione presente ma senza titolare attivo. Per ogni processo legge la posizione, l'unità, i processi affini, le posizioni coperte della stessa unità e, per i candidati, ruolo, competenze e carico. Le letture usano il perimetro della persona; ciò che lei non vede torna `{omissis}`.
2. **Costruisce l'applet.** Una scheda indicatore («21 su 42»), una tabella di lavoro con una riga per processo e, per ogni riga, fino a tre proposte motivate: collegare il processo alla posizione già coperta di un processo affine; assegnare una persona adatta alla posizione scoperta; creare una posizione nuova nell'unità. Accanto a ogni proposta: punteggio di adeguatezza, carico attuale della persona, classe dell'azione e stato (`ESEGUIBILE`, `DA_RICHIEDERE`, `NON_DISPONIBILE`).
3. **Valentina decide.** Accetta, cambia la persona dal menu, scarta, riga per riga o in blocco. Tutto resta in bozza con l'avviso arancione; si può chiudere la finestra e riprendere.
4. **Anteprima e conferma.** L'anteprima a secco esegue il piano in una transazione annullata e rimisura la lente: «da 21 a 4; 2 persone superano il carico consigliato; 3 posizioni nuove; 5 assegnazioni chiedono la riconferma del secondo fattore». Il pulsante rosso esegue con la sessione di Valentina: le azioni B con la sua conferma, le C con la doppia conferma.
5. **Ciò che non può fare.** Oggi collegare un processo a una posizione è `NON_DISPONIBILE` (§1): l'applet lo scrive come richiesta di sviluppo per Enzo, con previsione di spesa. Quando la rotta esisterà, la stessa applet, riaperta, troverà l'azione `ESEGUIBILE`. Se a Valentina mancasse un permesso, l'azione diventerebbe `DA_RICHIEDERE` verso il ruolo che lo ha.
6. **Verifica e chiude.** L'applet rilegge la lente, mostra prima e dopo, elenca ciò che è rimasto aperto e perché, e lascia la traccia di D11. Ogni passo si può annullare dalla stessa applet.

## §4 — Come si verifica che sia fatto

1. Prove automatiche: lo schema `AppletSpec` rifiuta campi ignoti, codice ed espressioni; il catalogo calcolato per ruolo coincide con la matrice dei permessi; un identificativo non letto fa rifiutare la riga; un'impronta diversa ferma l'esecuzione; un'azione X non è proponibile; una C non parte senza la seconda conferma.
2. Prova avversaria (rito R5) estesa alle applet: testo ostile dentro la descrizione di un processo, identificativi di un altro tenant, richiesta di applet da una persona senza permessi, conferma ripetuta, conferma scaduta.
3. Su una copia usa-e-getta della produzione: il caso guida eseguito, poi annullato per intero, e tutte le righe delle tabelle toccate uguali prima del giro e dopo il ritorno (ADR-0053 §4, punto 1).
4. Dal vivo in produzione (ADR-0026): login di Valentina Conti, caso guida dalla pagina del consolidamento, lente rimisurata, un annullamento di un singolo passo eseguito e verificato; poi la stessa applet aperta con una persona senza `HRMS_MANAGER`, che vede le azioni `DA_RICHIEDERE` e i campi `{omissis}`.
5. Un secondo caso di un altro dominio («27 posizioni critiche non hanno un successore»), per mostrare che l'applet non è scritta per un solo problema.

## §5 — Alternative scartate

- **Applet come codice generato dal modello ed eseguito in una sandbox.** Darebbe la massima libertà di forma, ma è l'operazione che ADR-0056 D2 mette in classe X, e sposterebbe la sicurezza dalla piattaforma alla sandbox: ogni errore di contenimento diventerebbe un accesso ai dati. Una specifica dichiarativa copre gli stessi casi con componenti che la piattaforma conosce, controlla e sa disegnare secondo le regole delle interfacce.
- **Scrivere con il gettone d'agente.** Toglierebbe i mandati alla persona (ADR-0050 D6) e quindi non rispetterebbe «limiti interamente derivati dai permessi»; oppure obbligherebbe a dare mandati al gettone, che ADR-0050 D6 vieta proprio perché un gettone rubato raggiungerebbe tutto il tenant.
- **Un'approvazione per ogni scrittura, come oggi.** Con decine di righe diventa una sequenza di clic senza visione d'insieme e senza anteprima dell'effetto complessivo.
- **Anteprima calcolata dal modello.** Il numero «dopo» sarebbe una stima non verificabile. La transazione annullata lo misura.

## §6 — Rischi

- **La prova a secco non regge per tutti i moduli** (transazioni annidate, effetti fuori dal database). Si misura modulo per modulo (voce di indagine del piano) e l'anteprima dichiara le righe senza prova.
- **Il catalogo è grande quanto l'atlante.** Il modello potrebbe proporre azioni corrette ma poco sensate. Lo frenano la decisione riga per riga, l'anteprima e il tetto.
- **Le azioni mancanti sono molte.** Il caso guida ne ha già trovata una. Le richieste `NON_DISPONIBILE` diventano la coda di sviluppo guidata dall'uso, ed è un effetto voluto: Heuresys impara che cosa manca dalle richieste delle persone.
- **Costo del modello.** Limitato dalla previsione di spesa, dal tetto della conversazione e dal fatto che anteprima ed esecuzione non usano il modello.
