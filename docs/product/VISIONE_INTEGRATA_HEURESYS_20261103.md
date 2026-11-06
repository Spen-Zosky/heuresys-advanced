# Heuresys, visione integrata: che cosa è stato costruito, a che cosa serve, che cosa manca

Data: 3 novembre 2026. Thread «Ricostruire la visione completa di Heuresys». Lavoro di sola analisi su heuresys-advanced (main 636a51f) e heuresys-datastore (main 17de9d1): nessuna scrittura su database, nessun rilascio. Scala di grigi, nessuna emoji.

Stato del documento: versione 2, aggiornata con le risposte di Enzo all'intervista del 3/11 alle 04:33 ora di Roma (sezione 10). Le risposte cambiano il baricentro: la sezione 1bis dice come, e la sezione 8 è riordinata di conseguenza.

## 0. Come leggere le fonti

Ogni affermazione porta fra parentesi il file da cui viene. Abbreviazioni:

- `ADV/` = repository heuresys-advanced; `DS/` = repository heuresys-datastore.
- `AI/` = `/mnt/project-files/analisi-interfacce/` (analisi delle interfacce del 31/10-3/11).
- `PIANO` = `/mnt/project-files/piani-interfacce/PIANO_interfacce_20261103.md` (piano della PR #153, in bozza).
- `MEM` = memoria del progetto (indice `MEMORY.md` e file collegati), cioè decisioni e fatti registrati dai thread; sono osservazioni datate, non misure di oggi.
- `WEB-n` = caso di riferimento n della sezione 8, con l'indirizzo.

Le cifre sono quelle scritte nei file alla loro data. Quando una cifra va rimisurata scrivo il comando o la fonte che la produce, non la ripeto come fatto di oggi.

## 1. Il giudizio in una pagina

Heuresys ha una base tecnica e dottrinale molto più solida di quanto il suo uso reale lasci vedere. Il modello centrato sulla posizione, il modello di accesso per catena organizzativa e la dottrina «l'IA propone, la persona decide» sono coerenti e già provati dal vivo con persone vere (AI/V12_giro_persone_vere/ESITO_E_VERDETTO_20261103.md, «Che cosa ha mostrato» punti 1-5). Il datastore produce prototipi d'industria con una cascata di 31 passi che ha già girato per davvero (DS/esecuzione/STATO_CORRENTE.md, righe 14-15).

Tre squilibri pesano più di ogni difetto singolo.

Primo: molto valore è già costruito e non arriva alle persone. Il rapporto delle interfacce conta 91 funzioni, di cui 21 solo API e 6 solo dati (AI/V9_rapporto/RAPPORTO_INTERFACCE_ADVANCED_20261031.md, §g); 48 tabelle hanno dati e API ma nessuna pagina (stesso file, §a punto 7). La visione di agosto lo diceva già: «molto valore è già pagato, va riscosso» (ADV/docs/vision/DREAM_2026-08-25/00_SINTESI.md, righe 7-19).

Secondo: «agentica, AI driven» è oggi più un vincolo di progetto che un'esperienza dell'utente. L'intelligenza che le persone usano ogni giorno è deterministica (rischio di uscita a regola pesata, advisor senza modello linguistico: ADV/apps/api/src/modules/insights/service.ts righe 1-14; ADV/apps/api/src/modules/advisor/engine.ts righe 1-11). L'agente conversazionale è montato solo nella pagina di sviluppo `/dev/agent` (ADV/apps/web/src/app/(authenticated)/dev/agent/page.tsx) e il suo README dice «Distribuito: no» (ADV/apps/agent-gateway/README.md, riga 59). L'agente di consolidamento è l'eccezione: primo giro in produzione su RTL il 1/11 con 40 proposte, tutte e 40 confermate dalla Direttrice HR il 2/11 alle 12:22, ma solo sul primo gruppo, l'organizzazione (MEM, agente-consolidamento-tenant). Nel datastore la ricerca sul web con cancello umano esiste come API ma nessuna pagina la chiama (DS/apps/api/src/servizio.ts righe 3113-3173; nessun chiamante in DS/apps/console/src).

Terzo: l'apparato di governo del lavoro (riti, controlli, registri, piani) è grande rispetto al numero di persone che usano il prodotto. Il rito di chiusura del datastore ha 23 sezioni e costa 161 secondi (DS/CLAUDE.md, sezione «La chiusura»); il piano interfacce ha 14 lotti, ognuno con PR, rilascio e copia di fase (PIANO, §6-§7). È una forza per la qualità, ma è anche il rischio principale di overengineering: il collo di bottiglia non è il codice, sono le ore di prova e decisione di Enzo.

La raccomandazione che ne discende: per i prossimi mesi conviene riscuotere più che costruire. Prima portare nelle pagine ciò che esiste (sezione 7), poi aggiungere poche funzioni agentiche piccole e misurabili che si appoggiano su dati già presenti (sezione 8).

## 1bis. Che cosa cambia dopo l'intervista

Le risposte di Enzo (sezione 10) fissano tre cose che i documenti lasciavano aperte.

La categoria è il change management. «Heuresys sarà per il change management quello che SAP è per l'ERP», e «il change management è al centro» (sezione 10, risposte 3 e 4). È una terza formulazione, diversa sia da «Skills & Org Intelligence» del PRD di giugno sia da «Organizational Intelligence & Workforce Orchestration» della visione di agosto (sezione 2.3). Non le contraddice: le contiene. La catena di agosto, strategia, processi, struttura, competenze, persone, gap (posizionamento-centrale.md, righe 1-35), descrive lo stato di un'organizzazione; il change management è il passaggio governato da uno stato a un altro. Va scritto in un documento di prodotto o in un ADR, altrimenti restano tre posizionamenti in circolazione.

I clienti sono due, in quest'ordine: un fornitore come SAP o Zucchetti, poi un'impresa manifatturiera di medie dimensioni (risposta 1). Il pilota attuale è una banca (ADV/CLAUDE.md, «Che cos'è»), e il contenuto di settore in advanced è solo FIN_BANKING (AI/V7_lacune/lacune.md punto 8). Il datastore però ha già un prototipo metalmeccanico completo, 31 passi su 31 con pacchetto v0.3 depositato, 93 posizioni raggruppate in 67 mestieri (DS/esecuzione/STATO_CORRENTE.md righe 14-15), e il CCNL Metalmeccanici Industria con i nove livelli da D1 ad A1 (DS/docs/04_impianto/18_IL_MODELLO_DEL_CCNL.md riga 537). Il manifatturiero non parte da zero: parte da un prototipo che advanced non ha ancora ricevuto.

Precisazione di Enzo delle 04:34: Heuresys non deve essere uno specialista di un'industria, ma della modellazione organizzativa di qualunque tipo di impresa. La banca e il manifatturiero sono quindi primi clienti, non specializzazioni. L'architettura lo regge solo in parte, e va detto. Il nucleo è già indipendente dal settore: posizioni, unità, processi con attività, competenze ESCO, accesso per catena, consolidamento (sezione 3.2). Ma la fabbrica dei modelli nel datastore parte dal codice ATECO e produce un prototipo per industria (DS/docs/04_impianto/27_IL_VOCABOLARIO_DEI_VERBI.md righe 82-112), e l'invariante I21 fa vedere a un tenant solo il perimetro della propria industria (ADV/CLAUDE.md, I21; ADR-0043). Questo va bene se il prototipo d'industria resta ciò che è, un acceleratore di partenza che il consolidamento poi piega alla lingua del tenant (specifica, §4bis), e non diventa il prodotto. Il rischio concreto è un altro: che ogni nuovo cliente richieda una corsa e un controllo di prototipo dedicati, e che il metodo per le famiglie fuori dalle banche resti una domanda aperta, come oggi (DS/esecuzione/DOMANDE_APERTE.md, D-68). Proposta: separare nel datastore ciò che è comune a ogni impresa (funzioni di supporto, processi trasversali del PCF, strutture tipiche per dimensione) da ciò che è di settore, così che un'impresa di un settore mai visto parta comunque da un modello completo al 60-70% e il resto lo costruisca il consolidamento. La percentuale è una stima mia, da misurare sul prototipo metalmeccanico e su quello bancario confrontando quante voci hanno in comune.

Le tre persone e che cosa devono trovare (risposta 2): il Direttore HR governa il capitale umano; il capo di unità ha un cockpit che lo aiuta a gestire il suo presidio; il dipendente non deve più telefonare o scrivere ad altri per conoscere l'azienda e il proprio ruolo in essa.

Che cosa ne segue, con giudizio.

1. Heuresys ha già il motore del cambiamento, ma non lo chiama così. L'agente di consolidamento confronta uno stato di riferimento (il prototipo) con lo stato reale del tenant, e per ogni voce propone corrispondenza, lacuna o personalizzazione, con una persona che decide e un registro delle decisioni (specifica del consolidamento, §5 e §8). Una riorganizzazione è la stessa operazione con uno stato futuro al posto del prototipo. Il primo passo del change management è quindi generalizzare ciò che esiste, non costruire un modulo nuovo.
2. Manca l'oggetto «cambiamento». Nel codice non ho trovato un modulo per iniziative di cambiamento, scenari o riorganizzazioni (`ls apps/api/src/modules` filtrato per scenario, change, reorg, plan: nessuno, eseguito il 3/11). C'è la storia delle unità (406 righe senza pagina: sezione 7, voce 14), che dice che cosa è cambiato, non che cosa cambierà.
3. Il fattore di successo più misurato del change management è umano, non tecnico. Prosci rileva che i progetti con sponsor molto efficace raggiungono gli obiettivi nel 79% dei casi contro il 27% con sponsor molto inefficace (https://www.prosci.com/blog/change-management-best-practices); McKinsey rileva che comunicare chiaramente il risultato atteso prima del lancio rende 3,5 volte più probabile il successo di una trasformazione digitale (https://www.mckinsey.com/~/media/McKinsey/Business%20Functions/McKinsey%20Implementation/Our%20Insights/How%20the%20implementation%20of%20organizational%20change%20is%20evolving/How-the-implementation-of-organizational-change-is-evolving.pdf). Sono dati di chi vende metodo e consulenza, da prendere con cautela. Avvertenza: il famoso «70% dei cambiamenti fallisce» non ha una base empirica valida (Hughes, Journal of Change Management 2011, https://doi.org/10.1080/14697017.2011.630506) e non va usato nei materiali di vendita. La lezione per Heuresys: il prodotto deve rendere visibili lo sponsor, chi è toccato, che cosa sa ciascuno del cambiamento e quanto lo ha adottato, che è proprio ciò che la struttura posizione-unità-processo permette di calcolare.
4. Un fornitore come SAP o Zucchetti compra integrabilità, non pagine. Oggi l'API pubblica è presente ma spenta di default, e SSO, SCIM e webhook non ci sono (AI/V8_mercato/matrice_funzioni.tsv righe 37-40). Per il primo cliente nominato da Enzo, questi diventano prioritari e non opzionali: nel piano interfacce stanno nei lotti L10 e L13 (PIANO), cioè in fondo.

Sulla risposta 5, «prima liberiamo i cavalli dell'IA per capire fino a dove può arrivare, poi decideremo le regole»: sono d'accordo sull'esplorazione, non sul luogo. Le regole che oggi frenano l'IA le ha volute Enzo stesso e sono già scritte: l'agente non scrive da solo nei dati del cliente e niente vale senza conferma (specifica del consolidamento, §7, R-4 e R-5; ADR-0040). Dal 10 ottobre 2025 chi usa l'IA sui lavoratori deve informarli (legge 132/2025, art. 11, WEB-12), e i dati di RTL sono produzione reale (ADV/CLAUDE.md). La proposta è una «zona libera»: il datastore, il banco dimostrativo e una copia usa-e-getta del tenant, dove gli agenti possono anche scrivere da soli, senza conferma, e ogni loro mossa si misura. Il precedente esiste già: nei giri preliminari del consolidamento l'agente adotta da sé le equipollenze sicure, ma su una copia di lavoro (specifica, §4bis). Quando la zona libera ha mostrato fin dove arrivano, si scrivono le regole per la produzione. Così si esplora senza il rischio di dover spiegare a una persona vera una decisione presa da un agente libero.

Decisione di Enzo del 3/11 alle 04:39 ora di Roma, sulla scheda «Dove lasciamo liberi gli agenti per vedere fin dove arrivano?»: anche in produzione, cioè agenti che scrivono senza conferma sui dati veri di RTL. La scheda indicava due condizioni previe, che restano: l'informativa ai lavoratori (legge 132/2025, art. 11) e un modo provato per tornare indietro (ADV/CLAUDE.md, scritture di massa con rollback dichiarato; ADR-0052). Poiché contraddice ADR-0040 e le regole R-4 e R-5 della specifica del consolidamento, l'attuazione richiede un ADR nuovo che le sostituisca (ADV/CLAUDE.md, «Invarianti»: si cambiano solo con un nuovo ADR). Il mio consiglio resta di cominciare dalle copie e passare alla produzione per capacità, una alla volta, ciascuna con il proprio ritorno provato.

Sulla risposta 6, «tutto il mio tempo è dedicato a questo»: il collo di bottiglia non sono le ore ma le decisioni che solo Enzo può prendere. Esempio: le 40 proposte di consolidamento del 1/11 sono state decise il giorno dopo, appena la pagina in cui decidere è stata pronta (MEM, agente-consolidamento-tenant): la decisione arriva quando la pagina è comoda. Proposta: ogni settimana un solo momento di decisione, con le proposte degli agenti già raggruppate, come prevede la conferma a gruppi della specifica (§8).

## 2. Strategia

### 2.1 Perché esiste

Il criterio di valore è il «test del valore»: il sistema crea valore solo se il dato inserito porta a decisioni diverse da quelle che l'organizzazione prenderebbe senza; altrimenti è compliance, non governance (ADV/docs/product/BUSINESS_SCOPE_AND_PRD.md, righe 25-29). Il PRD chiede di renderlo una metrica: la quota di entità mappate che generano una decisione tracciabile (staffing, promozione, chiusura di un gap, successione) entro N giorni (stesso file, §2.8). Questa metrica non risulta implementata: non ho trovato né una tabella né una pagina che la calcoli.

Il problema di mercato dichiarato: il mid-market europeo regolato deve governare la propria capacità organizzativa e oggi ha tre strade, suite americane costose e opache, consulenza a progetto o soluzioni puntuali (BUSINESS_SCOPE_AND_PRD.md, §2.1).

La visione di Enzo del 25 agosto: «trasformare il modello operativo dell'impresa in una struttura organizzativa eseguibile, misurabile e sviluppabile», lungo la catena strategia, processi, struttura e posizioni, competenze e KPI, persone, gap e sviluppo (ADV/docs/vision/riferimenti/posizionamento-centrale.md, righe 1-35). La formula sull'IA: «AI-assisted decisions, human-governed outcomes» (stesso file, §5.9).

Il vincolo trasversale del 31/10: Heuresys è una piattaforma «agentica, AI driven» e ogni progettazione parte da qui (istruzioni del progetto; MEM, regola del 31/10 04:14).

### 2.2 A chi si vende

Il 31/10 Enzo ha allargato la destinazione: non solo vendita diretta ai clienti finali, ma anche proposta a fornitori come SAP, Zucchetti e JetHR di affiancare Heuresys ai loro prodotti (MEM, posizionamento-prodotto-affiancamento). Questa scelta è coerente con i confini dichiarati: niente payroll, presenze, benefit né dati medici; la formazione è orchestrata, non erogata (posizionamento-centrale.md, §10), e i dati contrattuali importati da Zucchetti o SAP non si modificano (ADV/docs/architecture/adr ADR-0045). L'analisi di mercato arriva alla stessa conclusione: presenze, payroll, onboarding e motore di processi sono i vuoti strutturali, e non costruirli è ciò che rende sensato l'affiancamento (AI/V8_mercato/schede_gruppi.md, riga 278).

### 2.3 Tre contraddizioni da sciogliere

1. Categoria. Il PRD di giugno dice che «Organizational Intelligence» non regge al mercato e propone «Skills & Org Intelligence EU-native» (BUSINESS_SCOPE_AND_PRD.md, §1.3 e §1.5); il documento di agosto la rilancia come categoria centrale (posizionamento-centrale.md, righe 1-35). Il PRD non è stato aggiornato.
2. Cliente tipo. Il PRD esclude le aziende sotto i 50 dipendenti e punta a 250-2000 dipendenti in settori regolati (BUSINESS_SCOPE_AND_PRD.md, §1.4); il ciclo DREAM fissa come traguardo «vendibile a PMI italiane in 6 mesi come complemento talent» (ADV/docs/vision/INDEX.md, riga 5).
3. Autocritica superata. Il PRD dice «non è un BPM» e «layer prescrittivo progettato, non costruito» (BUSINESS_SCOPE_AND_PRD.md, §1.1); oggi esistono un runtime di approvazione generico (ADV/apps/api/src/modules/approvals/routes.ts, righe 2-4), MLCE, VRIO, maturità e advisor (ADV/apps/api/src/modules/capability-composition/routes.ts; capability-maturity/routes.ts; advisor/engine.ts).

Giudizio: finché categoria e cliente tipo restano doppi, ogni scelta di funzionalità si può giustificare e nessuna si può escludere. È la prima domanda dell'intervista (sezione 10).

## 3. Architettura e pilastri

### 3.1 I due sistemi e il loro confine

Heuresys sono due repository gestiti come una cosa sola (MEM, regola del 30/10 14:27).

- Advanced è la piattaforma dei clienti: API Fastify 5 su PostgreSQL 16, contratti Zod condivisi, SPA di amministrazione Next.js 16 e portale ESS; un solo ambiente di produzione con due tenant, RTL Bank e Heuresys System (ADV/CLAUDE.md, «Che cos'è»; ADR-0026). Conta 114 moduli API (`ls apps/api/src/modules | wc -l`, eseguito il 3/11 su 636a51f).
- Il datastore è il deposito della conoscenza esterna (ESCO, ISCO, NACE, ATECO, CCNL, PCF/APQC) e la fabbrica dei prototipi d'industria. È nato perché in advanced i dati esterni erano mescolati a quelli dei clienti: 94 rilievi, 33 gravi, il ponte ATECO-NACE a 0 righe (DS/preflight/00_PREFLIGHT.md, §2 e §4).
- Il confine: il datastore tiene i cataloghi e genera il fascicolo, advanced tiene il fascicolo del tenant (ADR-0043); il prototipo arriva come file con manifesto e impronta (ADR-0047; DS/src/fascicoli/consegna.ts, righe 1-25); ciò che il tenant ha modificato non si sovrascrive mai (ADR-0048); il tenant vede solo il suo perimetro più le voci proprie (ADR-0046). Il datastore non scrive in advanced e advanced non legge il datastore (DS/preflight/04_REGOLE_E_DIVIETI.md, DIV-01).

### 3.2 I pilastri di advanced

Invarianti (ADV/CLAUDE.md, «Invarianti»):

- Posizione al centro: proprietario della posizione e titolare sono distinti (I1); anche la partecipazione ai processi è legata alla posizione (ADR-0044); le attività appartengono a un processo ed eseguite da un'unità (ADR-0049).
- Isolamento dei tenant con chiavi e filtro nel middleware, mai RLS (I5).
- Accesso come intersezione di perimetro gerarchico e modalità funzionale `edit/read/mask/none`; chi è a capo di una catena vede ciò che le sta sotto e niente delle catene sorelle; i mandati HR vedono il tenant salvo cinque eccezioni (I16-I22; ADR-0036 §2, §5, §8; ADR-0032 per la maschera).
- Identificazione forte per i ruoli che vedono tutto il tenant (ADR-0050, accettato il 3/11; MEM).
- Deleghe di attività lungo la catena, non dei dati sensibili (ADR-0051; MEM, principio-attivita-delegate).
- Un dato si dichiara nativo, importato o ibrido (I23, ADR-0041); niente import dal legacy (I12, ADR-0038).

Pilastri agentici:

- L'agente legge solo ciò che legge la persona, ogni scrittura passa da un'approvazione umana, un freno conta le persone distinte lette (ADR-0040 §2-§3; ADV/apps/agent-gateway/src/write-gate.ts righe 9-12 e 322-334; persone-distinte.ts).
- Strumenti generici per l'agente invece di uno per modulo (ADR-0033, stato PROPOSED; ADV/apps/agent-gateway/src/mcp-tool-names.ts righe 25-54).
- L'API non contiene client di modelli: tutto passa dal gateway, e l'API convalida con Zod ciò che il gateway risponde (ADV/apps/api/src/modules/tenant-consolidation/giudice.ts, righe 1-10).
- Il modello gira sull'abbonamento di Enzo, non su una chiave a pagamento (ADV/apps/agent-gateway/src/subscription-auth.ts; DS/CLAUDE.md, D-67).

### 3.3 I pilastri del datastore

- Dodici decisioni fondative (la tabella le chiama ancora «undici»): fra le altre, TypeScript, prima fetta ATECO-NACE con ESCO e ISCO, «fatto» uguale prove più controlli sui dati, gestione semantica come ambizione (DS/preflight/00_PREFLIGHT.md, §3).
- Sei pilastri del 13/09: dominio autonomo; ogni capacità è un verbo e «il verbo è la riga di fattura»; l'intelligenza sta dentro il dominio; il sistema scopre e non interroga; tipo e istanza non si mescolano; ogni chiamata è attribuibile, limitata e costata (DS/cowork_exchange/_inbox_cowork/2026-09-13_PILASTRI_del-cambio-di-paradigma.md). Il documento si dichiara proposta; non ho trovato un'approvazione formale.
- Il vocabolario dei verbi coincide con le rotte, controllato dalla sezione 21 del rito: 106 verbi `codice` e 3 `dichiarato` (DS/docs/04_impianto/27_IL_VOCABOLARIO_DEI_VERBI.md; conteggio con il `grep -cE` indicato alla riga 149, che nel testo dice ancora 92).
- Ogni verbo passa da un involucro che registra chi, che cosa, quando, esito, durata e costo (DS/apps/api/src/involucro.ts; DS/docs/04_impianto/28_L_INVOLUCRO_E_IL_COSTO.md). L'identità è però un valore fisso, «il proprietario» (stesso file, riga 25).
- Il cancello umano decide: «niente entra in archivio senza un cancello umano, e il cancello è un verbo» (DS/esecuzione/DOMANDE_APERTE.md, D-36, riga 138).

Giudizio: l'architettura è il punto più forte del progetto. Il confine fra i due sistemi è chiaro e scritto; il modello di accesso è più fine di quello dichiarato dai concorrenti italiani (Zucchetti dichiara solo «la profilazione degli utenti regola l'accesso ai dati», WEB-11). Il punto debole è la distanza fra dottrina e servizio: ADR-0043 ordina di togliere da advanced research, seed-acquisition e reference-sync, che invece sono ancora registrati (ADV/apps/api/src/app.ts righe 109-110, 490, 540).

## 4. Processi cognitivi: dove pensa l'IA e chi decide

| Capacità | Dove | Che cosa fa | Chi decide | Stato reale |
|---|---|---|---|---|
| Cascata dei prototipi | datastore | 31 passi, da ATECO ai principi, con sonnet e web dove serve | decisione per passo; nelle corse «rete» e «cascata» accettazione automatica | ha girato: G2 metalmeccanico 7,37 USD su 40; replica 31/31 con pacchetto v0.3 (DS/esecuzione/STATO_CORRENTE.md righe 14-15; 27_IL_VOCABOLARIO_DEI_VERBI.md righe 82-128) |
| Ricerca sul web con cancello | datastore | propone senza depositare, l'esito è il cancello | persona | API presente, nessuna pagina la chiama, primo giro vero non fatto (DS/apps/api/src/servizio.ts righe 3113-3173; STATO_CORRENTE.md riga 22) |
| Proporre ATECO, modelli organizzativi, intervista | datastore | verbi della visione | persona | solo dichiarati (27_IL_VOCABOLARIO_DEI_VERBI.md righe 69, 73, 74) |
| Consolidamento del tenant | advanced (gateway + API) | abbina per significato prototipo e tenant, a giri; esiti corrispondenza, lacuna, personalizzazione | Direttore HR o delegato, sempre | in produzione dal 31/10 (unità heuresys-agent-gateway); primo giro su RTL il 1/11, 40 proposte confermate il 2/11, gruppo organizzazione; i gruppi successivi restano da fare (MEM, voci 31/10 e 1/11; /mnt/project-files/consolidamento/20261030_SPECIFICA_AGENTE_CONSOLIDAMENTO_TENANT.md) |
| Agente conversazionale con strumenti | advanced (gateway, MCP) | legge come la persona, scrive solo con approvazione | persona | solo nella pagina `/dev/agent`; README «Distribuito: no» (ADV/apps/agent-gateway/README.md riga 59) |
| Ricerca che genera il modello | advanced | propone dal web | persona | esercitata in prova, destinata al ritiro da ADR-0043 (ADV/apps/agent-gateway/src/research-propose.ts) |
| Ricerca per somiglianza | advanced | kNN su 14.031 vettori Voyage | nessuna decisione | servita; il testo libero è spento di default (ADV/apps/api/src/modules/semantic-matching/service.ts riga 173; AI/V5_database/ampiezza.md §3) |
| Rischio di uscita, advisor, maturità | advanced | regole deterministiche con citazioni | persona | servita, nessun modello linguistico (insights/service.ts righe 1-14; advisor/engine.ts righe 1-11) |

Nota su una contraddizione: il README del gateway dice che non c'è un'unità systemd (riga 59), mentre la memoria registra l'unità heuresys-agent-gateway in servizio dal 31/10 e i giri del consolidamento del 1-2/11 (MEM, agente-consolidamento-tenant). Il README è invecchiato; l'agente conversazionale resta comunque raggiungibile solo da `/dev/agent`.

Giudizio: la dottrina cognitiva è matura e prudente (proposta con motivo e fiducia, persona che decide, modello senza strumenti per giudice e ricercatore). Mancano tre cose perché diventi esperienza: un'identità propria dell'agente nell'API e nell'audit (ADR-0050 D6; PIANO lotto L9), un pannello dell'agente nelle pagine di lavoro (83 pagine idonee su 115, montato in una: AI/V7_lacune/lacune.md punto 2), e una metrica di valore registrata per ogni uso.

## 5. Funzionalità coperte e task tipici

Volumi misurati per il tenant RTL il 2/11 nel giro con persone vere: 167 utenti, 312 posizioni, 42 unità, 2.189 obiettivi, 62 iniziative formative, 25 progetti, 2.305 richieste di assenza, 741 richieste di approvazione (AI/V12_giro_persone_vere/ESITO_E_VERDETTO_20261103.md, punto 4).

Aree coperte, per gruppi di moduli (ADV/apps/api/src/modules; ADV/docs/product/FUNCTIONAL_CAPABILITY_LEDGER.md §1-§6):

- Organizzazione: unità e loro storia, livelli, posizioni, incarichi, sedi, modelli operativi, tipizzazione d'impresa.
- Processi e modelli di settore: famiglie, varianti, processi, attivazioni del blueprint, materializzazione del tenant dal fascicolo, consolidamento, processi del tenant con fasi e regole.
- Competenze e apprendimento: competenze ESCO con alias, famiglie e livelli, gap, percorsi, iniziative formative, mentorship, valutazioni.
- Performance e talento: valutazioni, cicli, KPI, obiettivi, OKR, talent review e nine-box, successione, calibrazione, compensi, engagement e sondaggi.
- Lavoro quotidiano: approvazioni, deleghe, notifiche, ESS `/me`, assenze.
- Conformità: GDPR, classificazione dei dati, whistleblowing, evidenze e provenienza.
- Reclutamento: requisizioni, annunci, candidati, colloqui, offerte.

Task tipici per persona, come li ha visti il giro dal vivo (AI/V12_giro_persone_vere/ESITO_E_VERDETTO_20261103.md; AI/V3_giro/menu.tsv):

- Dipendente: chiede ferie e assenze, vede obiettivi, gap e il proprio profilo, delega attività quando è assente (pagina `/me/delegations` dal 1/11, dimostrata con Paolo Caputo e Alberto Rossetti: MEM, principio-attivita-delegate).
- Capo di unità o di filiale: apre il dossier dei propri sottoposti (200) e non quello delle catene sorelle (404), approva, segue obiettivi e valutazioni del suo albero (ESITO_E_VERDETTO, punti 2-3).
- Direttore HR (HRMS_MANAGER, PEOPLE_MANAGER): vede tutto il tenant, gestisce approvazioni (oggi vede 200 su 741, difetto D-27), talent review, consolidamento del tenant (ESITO_E_VERDETTO, D-24 rinumerato D-27; PIANO).
- Responsabile di processo: dovrebbe vedere le attività e le richieste del proprio processo; i dati e le rotte ci sono (23 processi, 131 attività, 741 richieste collegate) ma nessuna pagina le mostra (AI/V9_rapporto/RAPPORTO_INTERFACCE_ADVANCED_20261031.md §g).
- DPO, Security admin, Data e Taxonomy steward: viste specialistiche; la console del DPO è in gran parte solo API (sezione 7, voce 7).
- Enzo, come piattaforma: costruisce e controlla i prototipi dalla console del datastore (DS/apps/console/src/app/menu.ts righe 54-116) e approva le regole dell'agente e il vocabolario comune, non i singoli collegamenti (specifica del consolidamento, §6).

Quattro ruoli non hanno titolare in RTL (READ_ONLY, BLUEPRINT_MANAGER, RECRUITER, HIRING_MANAGER) e il reclutamento ha una sola riga di dati (ESITO_E_VERDETTO, «Limiti» punto 2; AI/V5_database/ampiezza.md §3). È un'area costruita senza un uso.

## 6. Come lavorano le persone e quali obiettivi organizzativi servono

Obiettivi organizzativi dichiarati per il cliente (BUSINESS_SCOPE_AND_PRD.md §2.3): mappare le competenze su uno standard pubblico; vedere i gap per posizione o unità e come chiuderli; una successione difendibile in audit; un rischio di uscita spiegabile; allineare ruoli, struttura e obiettivi. A questi Enzo ha aggiunto due principi: il ruolo segue lo scopo del lavoro (MEM, regola-ruolo-segue-lavoro, 31/10) e le attività si delegano lungo la catena (ADR-0051).

Il metodo di lavoro che il prodotto presuppone è a catena: il capo vede e decide sul proprio albero, l'HR ha un mandato su tutto il tenant, il dipendente vede sé stesso, e l'IA prepara proposte che una persona con l'autorità conferma. È un metodo coerente con il mondo bancario del pilota.

Che cosa non si vede ancora, e lo dico in modo diretto: non ho trovato misure di come le persone di RTL usano il prodotto nel tempo (accessi, azioni per ruolo, tempi di risposta alle approvazioni), né la metrica del «test del valore». Il giro del 2/11 misura che le pagine funzionano e che i perimetri reggono, non che le persone ci lavorano. Le 741 richieste di approvazione esistono, ma la memoria non dice se sono state decise da persone o caricate come storia (la storia RTL di 36 mesi è gestita dalla skill `storia36-custodia`: ADV/CLAUDE.md, «Comandi non ovvi»). Senza questa distinzione non si può dire quali funzioni siano adottate.

## 7. Funzionalità già presenti ma non adottate

Criterio: esistono codice, API o dati, ma le persone non le raggiungono o non le usano. Le prove vengono dal censimento delle tabelle (AI/V5_database/copertura_tabelle.tsv e conteggi-sys.tsv, conteggio del 31/10) e dall'elenco degli endpoint senza pagina (AI/V11_controvalutazione/orfani_v1.tsv, 329 righe; V11 avverte che 329 è un tetto, non una misura, e le voci qui sotto sono state ricontrollate con grep su ADV/apps/web/src). Ordine: valore per un ufficio HR rispetto al costo.

| # | Funzione | Prova | Causa | Sforzo |
|---|---|---|---|---|
| 1 | Incarichi e trasferimenti persona-posizione | `/v1/user-position-assignments` GET e POST senza pagina (orfani_v1.tsv righe 286-288); «ogni cambio di titolare passa da API o seed» (AI/V7_lacune/copertura.tsv) | manca la pagina di scrittura | medio (PIANO G-3) |
| 2 | Pagina del responsabile di processo | 23 processi e 131 fasi «solo API», rotte `/v1/me/processes*` senza pagina (copertura_tabelle.tsv; orfani_v1.tsv righe 218-220; V9 §g) | manca la pagina | medio (G-9, G-23) |
| 3 | Privacy personale: consensi ed export art. 15 GDPR | 677 consensi «solo API»; `/v1/me/gdpr/export` e `/v1/me/consents` senza pagina (orfani_v1.tsv righe 223-225) | manca la pagina | piccolo (G-11) |
| 4 | Valutazioni comportamentali e risultati | 615 assessment e 1.560 risultati, 0 pagine (copertura_tabelle.tsv; orfani_v1.tsv righe 53-59) | manca la pagina; dato EVALUATION da mascherare | medio (G-19) |
| 5 | Approvazioni complete | il Direttore HR vede 200 su 741 (ESITO_E_VERDETTO, D-27; ADV/apps/web/src/app/(authenticated)/approvals/page.tsx riga 52) | difetto, manca la paginazione | piccolo (V-1) |
| 6 | Allineamento degli obiettivi, risultati chiave degli OKR, calibrazioni | 100, 20 e 40 righe «solo API» (copertura_tabelle.tsv; orfani_v1.tsv righe 277, 281, 295) | mancano pannelli e form | piccolo in lettura |
| 7 | Azioni di chiusura dei gap | 440 righe «solo API» (copertura_tabelle.tsv; orfani_v1.tsv righe 60, 209) | manca la scheda | piccolo |
| 8 | Successione di dettaglio | prontezza dei successori 59, rilevanza delle posizioni 21 (copertura_tabelle.tsv; orfani_v1.tsv righe 101-110) | manca la scheda | piccolo (G-6) |
| 9 | Revoca delle sessioni e codici di recupero MFA | orfani_v1.tsv righe 3-4 e 8-9 | manca la pagina | piccolo |
| 10 | Misure dei KPI | 248 misure «solo API»; un commento nel codice dice che sono esposte ma nessuna pagina le chiama (ADV/apps/web/src/components/kpi-metrology-panel.tsx righe 15-16) | manca la scheda | piccolo |
| 11 | Recupero password e preferenze di notifica | orfani_v1.tsv righe 1-2 e 212-213; preferenze 0 righe (conteggi-sys.tsv riga 168) | manca la posta (SMTP) e la pagina | piccolo dopo SMTP |
| 12 | Engagement: feedback, piani d'azione, sondaggi | 400 feedback, 8 piani, 6 sondaggi, 5 modelli «solo API» (copertura_tabelle.tsv; orfani_v1.tsv righe 250-269) | manca la pagina | medio |
| 13 | Console del DPO | registro dei trattamenti 89 righe, richieste 8 (copertura_tabelle.tsv); conservazione «predisposta ma non operativa» (ADV/docs/kb/DEBT_REGISTER.md D-63); `gdpr:retention` concesso a 4 ruoli ma il servizio risponde solo alla piattaforma (PIANO S-18) | pagina, permessi e motore | medio |
| 14 | Storia delle unità e profilo d'intelligenza della posizione | 406 righe di storia, vista PIP letta solo da un endpoint senza pagina (orfani_v1.tsv righe 14, 17, 89; AI/V5_database/ampiezza.md §3) | manca la pagina | piccolo; lo storico della posizione sul mercato lo ha solo SAP (PIANO M-2) |
| 15 | Requisiti di competenza per occupazione ESCO | 126.051 righe, il 18% del database, lette solo da una statistica pubblica (ampiezza.md §4) | manca una vista utile al lavoro | medio |
| 16 | Rischio di uscita e predizioni | 468 predizioni «solo API» (copertura_tabelle.tsv; orfani_v1.tsv righe 296-299, 307) | manca la pagina e una decisione sulla vista di sé | medio; da presentare per ciò che è, una regola e non un modello |
| 17 | Ricerca a testo libero per significato | spenta di default, risponde 404 (ADV/apps/api/src/modules/semantic-matching/service.ts righe 173-179) | scelta, legata alla credenziale Voyage | piccolo dopo la decisione |
| 18 | Deleghe | pagina dal 1/11 ma 0 deleghe al 31/10 (conteggi-sys.tsv riga 268); l'ambito per gruppo di dati è solo API | adozione | piccolo |
| 19 | Mentorship | 150 sessioni, 30 abbinamenti, 5 programmi (copertura_tabelle.tsv) | manca la pagina | piccolo |
| 20 | Agente nelle pagine | montato in 1 pagina su 83 idonee; diario dell'agente vuoto (AI/V7_lacune/lacune.md punto 2; AI/V5_database/agentica.md §2 punto 5) | servizio e identità dell'agente | grande (L9-L10) |
| 21 | Ricerca web con cancello umano nel datastore | API presente, nessuna pagina, nessun giro vero (sezione 4) | manca la pagina | piccolo-medio |
| 22 | Consegna ed estensione del fascicolo | nessun chiamante fuori dai test (DS/tests/fascicolo_*.test.ts) | il canale vero non è ancora esercitato | da misurare |
| 23 | Reclutamento | 0 candidature, 0 requisizioni, 1 candidato; ruoli senza titolare (ampiezza.md §3 e §5; ESITO_E_VERDETTO «Limiti» punto 2) | mancano dati e uso | grande; raccomando di dichiararlo non attivo (PIANO, decisione 9) |
| 24 | Contenuto del blueprint e cruscotti di settore | 44 delle 50 tabelle di contenuto vuote; un solo settore (ampiezza.md §3; AI/V7_lacune/lacune.md punto 8) | dati e pagina | grande |

Correzioni ai documenti precedenti, per non ripetere errori: i dossier di luglio sulle linee dormienti (ADV/docs/product/DEVELOPMENT_LINES_A/B/F) sono in parte superati, per esempio le richieste di approvazione oggi sono 768 e non 0 (conteggi-sys.tsv riga 5); il nine-box non è una lacuna, perché `/talent-review` lo legge già (ADV/apps/web/src/app/(authenticated)/talent-review/page.tsx riga 96).

Lettura critica: le voci 1-11 valgono quanto un lotto intero di funzioni nuove e costano poco, perché API, permessi e dati ci sono. Il piano interfacce le contiene già quasi tutte nel lotto L11 (PIANO, voci G-1…G-45), ma le mette dopo dieci lotti di qualità e sicurezza. Suggerisco di anticipare 1, 2, 3 e 5, che sono quelle che un Direttore HR noterebbe al primo uso.

## 8. Funzionalità nuove possibili: poche, piccole, misurabili

Criteri di scelta: si appoggiano su dati già presenti; ogni proposta dell'IA ha una persona che decide; ogni funzione nasce con la sua metrica; nessuna entra nell'«alto rischio» dell'AI Act senza averlo deciso. Ricerca fatta il 3/11; quasi tutti i numeri dei casi sono pubblicati dal fornitore e non verificati da terzi, e lo segnalo caso per caso.

Casi di riferimento:

- WEB-1 IBM AskHR: 11,5 milioni di interazioni nel 2024, 94% chiuse senza operatore; ma «chiusa» non vuol dire «corretta», e sono sette anni di lavoro (https://www.ibm.com/think/insights/embracing-future-of-hr-ai-first-enterprise; https://www.ibm.com/case-studies/ibm-askhr).
- WEB-2 ServiceNow su sé stessa: prima di misurare hanno unificato quattro definizioni diverse di «richiesta risolta in autonomia» (https://www.servicenow.com/content/dam/servicenow-assets/public/en-us/doc-type/resource-center/white-paper/wp-ai-value-framework.pdf).
- WEB-3 IAG: 67% di richieste risolte nel primo mese, dopo aver riscritto circa 730 articoli di policy; un solo mese di dati (https://www.itnews.com.au/news/iag-builds-ai-into-its-hr-service-delivery-628474).
- WEB-4 Microsoft HR: +20% di casi chiusi con il copilota per l'operatore, misurato su 300 operatori con test di significatività; è il caso con il metodo migliore (https://www.microsoft.com/en/customers/story/25046-microsoft-dynamics-365-customer-service).
- WEB-5 Jet HR: spiegazione della voce del cedolino sui dati della persona, con avviso e feedback; nessun numero (https://www.jethr.com/press/jet-hr-porta-in-app-la-spiegazione-personalizzata-della-busta-paga).
- WEB-6 TechWolf: competenze proposte dall'IA approvate dai dipendenti all'84,5% (https://www.techwolf.ai/customer-stories/global-leading-life-sciences-organization); storie del fornitore.
- WEB-7 Gloat con Schneider Electric e Unilever: marketplace interni dei talenti; metriche definite dal fornitore e casi più vecchi del 2024 (https://resources.gloat.com/resources/schneider-electric-customer-success-story).
- WEB-8 DHL con Celonis: processo dall'assunzione all'uscita ricostruito da 10 sistemi, 10,2 milioni di euro in tre anni; «gli esperti scoprono di conoscere il processo meno di quanto credessero» (https://www.celonis.com/solutions/stories/dhl-group).
- WEB-9 Orgvue: piano contro reale delle posizioni, 6,4 milioni di dollari di posizioni fuori piano scoperte in un controllo trimestrale; il valore viene dal modello dati, non dall'IA (https://www.orgvue.com/resources/case-studies/bringing-finance-and-hr-together-to-plan-a-2-year-transformation-and-track-its-implementation).
- WEB-10 Workday Agent System of Record: registro degli agenti, identità propria, modalità «per conto di» con i permessi della persona, audit che distingue persona e agente; architettura senza numeri di risultato (https://developer.workday.com/documentation/GUID-0e960e10-8a0f-4975-afc6-83ab303ed485-enHYPHENus/AboutWorkdayAgents).
- WEB-11 Mercato italiano: TeamSystem ha già due agenti HR, uno sulla contrattazione collettiva; Zucchetti ha chatbot e filtro dei CV; nessuno pubblica risultati misurati; solo il 15% delle aziende italiane usa l'IA in HR (https://www.teamsystem.com/media/files/1626_TS_BROCHURE_HR_AI_2026_short_IT.pdf; https://www.zucchetti.it/it/cms/soluzioni/software-hr-zucchetti/hr-ai-intelligenza-artificiale; https://www.hrnet.it/blog/osservatorio-zucchetti-hr/innovazione-ai-e-dati-le-tre-leve-della-trasformazione-hr-secondo-losservatorio-zucchetti-hr-2025).
- WEB-12 AI Act e legge italiana: gli obblighi per i sistemi ad alto rischio dell'Allegato III, che comprende selezione, promozioni, assegnazione di compiti per tratti personali e valutazione delle prestazioni, si applicano dal 2 dicembre 2027 (https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai; https://www.regulatoryai.eu/en/annex/III-4/); la profilazione di persone resta sempre ad alto rischio (https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-6); dal 10 ottobre 2025 il datore di lavoro deve informare lavoratori e rappresentanze sull'uso dell'IA (legge 132/2025, art. 11: https://ascom.bo.it/2025/11/10/obblighi-di-informazione-ai-lavoratori-sulluso-dellintelligenza-artificiale-in-ambito-lavorativo/).

### 8.1 Proposte per il change management (versione 2, dopo l'intervista)

Queste vengono prima delle proposte N, perché rispondono direttamente alle risposte 2, 3 e 4 di Enzo. Ognuna riusa qualcosa che esiste.

C-1. Il cambiamento come oggetto. Una riorganizzazione, un nuovo processo o un nuovo modello operativo diventano un oggetto con uno sponsor, uno stato attuale e uno stato futuro della struttura (unità, posizioni, processi, competenze). Il motore del consolidamento calcola la differenza voce per voce, con gli stessi tre esiti e lo stesso registro delle decisioni (ADV/apps/api/src/modules/tenant-consolidation/engine.ts; specifica del consolidamento, §5 e §8). Prima versione: solo lettura e calcolo dell'impatto, cioè quali posizioni, persone, processi e competenze sono toccati e come. Modello: WEB-9 (Orgvue lavora su posizioni e scenari) e il dato Prosci sullo sponsor (sezione 1bis). Metrica: per ogni cambiamento, quota di persone toccate che hanno ricevuto la comunicazione. Rischio basso: descrive la struttura, non giudica le persone.

C-2. Il cockpit del capo di unità. Una pagina sola per il suo presidio: le sue persone e posizioni, le posizioni scoperte, le approvazioni in attesa, le fasi di processo che la sua unità esegue con i tempi, i gap di competenza, le deleghe attive e i cambiamenti in arrivo che toccano la sua unità (da C-1). I dati ci sono quasi tutti e il perimetro di catena è già provato dal vivo (AI/V12_giro_persone_vere/ESITO_E_VERDETTO_20261103.md punti 2-3; sezione 7, voci 2, 5, 7, 8). Metrica: quante volte a settimana il capo la apre e quante azioni chiude da lì.

C-3. «La mia azienda e il mio ruolo» per il dipendente. Una pagina e un agente che rispondono a: qual è la mia posizione e a che cosa serve, in quali processi intervengo e in quale fase, chi è il responsabile di ciascun processo, a chi mi rivolgo per una certa cosa, che cosa cambia per me (da C-1). Le fonti sono la struttura del tenant, i processi con le fasi e i proprietari (ADR-0044, ADR-0049), le policy e il CCNL. È la proposta N-6 allargata dalle policy a tutta l'organizzazione, ed è la risposta diretta alla frase di Enzo «non deve più telefonare o scrivere ad altri». Modelli: WEB-1 e WEB-3; il lavoro vero è sui contenuti, come mostra IAG. Metrica: domande risolte senza scrivere a nessuno, definita prima di partire (WEB-2). Rischio: obblighi di trasparenza e informativa, non alto rischio (WEB-12).

C-4. Prontezza misurata per unità. Brevi rilevazioni sulle cinque tappe dell'adozione individuale del modello ADKAR, consapevolezza, desiderio, conoscenza, capacità, rinforzo (https://www.prosci.com/methodology/adkar), mandate solo alle persone toccate da un cambiamento e lette solo in forma aggregata per unità, sopra una soglia minima di risposte. Riusa i sondaggi di engagement, che hanno dati e API ma nessuna pagina (sezione 7, voce 12). Metrica: andamento della prontezza per unità nel tempo. Avvertenza: aggregata per unità resta fuori dalla profilazione; letta per singola persona ci entrerebbe (WEB-12).

C-5. Adozione misurata. Per ogni cambiamento, tre misure semplici prese dai dati del tenant e non da questionari: le persone toccate usano il nuovo processo o la nuova posizione (adozione), con quale frequenza (utilizzo), con quali tempi per fase rispetto al prima (efficacia, da N-2). È anche la prima attuazione del «test del valore» del PRD (sezione 2.1), che oggi è solo una frase. Una compagnia assicurativa cliente di Prosci riporta che ogni iniziativa del portafoglio oggi rende conto di adozione, utilizzo e competenza (https://www.prosci.com/resources/success-stories/insurance-company-change-success); è un caso del venditore, senza numeri di risultato.

Per il primo cliente manifatturiero, senza farne una specializzazione: consegnare ad advanced il prototipo metalmeccanico già pronto nel datastore e farne un tenant dimostrativo, su cui provare C-1…C-5 nella zona libera della sezione 1bis. C-1…C-5 non dipendono dal settore: lavorano su unità, posizioni, processi e competenze, che ogni impresa ha. Per il fornitore: anticipare API pubblica documentata, SSO e webhook (sezione 1bis, punto 4).

### 8.2 Proposte trasversali

Proposte, in ordine di attuazione. Ognuna ha un perimetro minimo; il resto si aggiunge solo se la metrica lo giustifica. N-1 e N-3 servono anche al change management; N-6 confluisce in C-3.

N-1. Registro degli agenti e firma «per conto di». Una tabella degli agenti (nome, capacità, versione, stato, chi può usarli) e due campi in ogni riga di audit: chi ha agito e per conto di chi. È il prerequisito di tutto il resto, ed è già nel piano come lotto L9 (PIANO; ADR-0050 D6). Modello: WEB-10. Metrica: quota delle azioni dell'agente attribuite a una persona, che deve essere il 100%. Rischio basso.

N-2. Pagina del responsabile di processo con i tempi. Mostra le richieste del suo processo per fase, quante sono in attesa e da quanto. Usa dati già presenti (sezione 7, voce 2). Poi, solo dopo, un controllo che segnala le fasi lente. È un process mining minimo senza comprare un motore. Modello: WEB-8. Metrica: tempo medio di attraversamento per fase, prima e dopo. Rischio basso, perché misura processi e non persone.

N-3. Controlli di qualità sull'organizzazione. Regole deterministiche, non IA: posizioni senza titolare da più di N giorni, processi o attività senza proprietario, unità senza responsabile, incarichi scaduti. Ogni anomalia va a un responsabile che la corregge. Modello: WEB-9 e WEB-8. Metrica: anomalie aperte e chiuse per mese. Rischio basso. È anche il miglior alleato del consolidamento, perché un tenant pulito si abbina meglio.

N-4. Competenze ESCO proposte per posizione. Dalla descrizione della posizione e dai 126.051 requisiti ESCO già nel database (sezione 7, voce 15) l'agente propone le competenze; il proprietario della posizione accetta o rifiuta. È lo stesso schema del consolidamento, applicato a ESCO, e si appoggia sul motore che esiste (ADV/apps/api/src/modules/tenant-consolidation/engine.ts). Modello: WEB-6. Metrica: tasso di approvazione delle proposte. Va fatto sulle posizioni, non sulle persone, per restare fuori dalla profilazione (WEB-12).

N-5. Copilota per chi approva. Sulla pagina delle approvazioni, l'agente riassume la richiesta, il suo processo e i precedenti, e propone una bozza di decisione e di risposta; la persona decide. Modello: WEB-4. Metrica: tempo di decisione con e senza il copilota, su due gruppi. Rischio da valutare: se la richiesta riguarda condizioni di lavoro della persona, la proposta di decisione può rientrare nell'Allegato III punto 4(b); il perimetro minimo è quindi riassunto e bozza di risposta, senza raccomandazione sull'esito.

N-6. Risposte su policy e CCNL nell'ESS. Il dipendente chiede, l'agente risponde citando il regolamento del tenant e il CCNL applicato, e passa all'HR quando non sa. Il datastore ha già sette cataloghi CCNL (DS/docs/06_referti/REFERTO_2026-09-05.md). Modelli: WEB-1, WEB-3, WEB-2. Metrica: richieste risolte senza HR, definita una volta sola prima di partire. Avvertenze: è già un'offerta di serie di TeamSystem (WEB-11), quindi non differenzia da sola; il lavoro vero è sui contenuti, come mostra IAG; serve l'informativa ai lavoratori della legge 132 (WEB-12).

N-7. Pacchetto di conformità IA per il cliente. Per ogni agente: valutazione scritta ai sensi dell'art. 6(3) dell'AI Act, registro (N-1), log, testo dell'informativa per l'art. 11 della legge 132. Non è codice ma un documento per agente, e diventa un argomento di vendita in banca. Modello: WEB-12. Il consolidamento, che abbina nomenclature e non giudica persone, è il primo candidato all'esenzione dell'art. 6(3), ma va documentato.

Da non fare finché non c'è una decisione esplicita e il fascicolo dell'alto rischio: punteggi sui candidati, valutazione delle prestazioni proposta dall'IA, scelta automatica del delegato in base al profilo della persona (WEB-12). E da non costruire affatto, perché sono il terreno dei sistemi da affiancare: presenze, payroll, firma, app mobile nativa (AI/V8_mercato/schede_gruppi.md riga 278; AI/V8_mercato/matrice_funzioni.tsv righe 13, 14, 32, 33).

Strumenti sofisticati da introdurre per gradi, dopo che N-1…N-4 hanno una metrica: la porta MCP del datastore verso advanced, già dichiarata nella visione del 13/09 e non costruita (DS/docs/00_preface/15_VISIONE_E_OBIETTIVI.md righe 194-216); un registro delle decisioni comune a tutti gli agenti, generalizzando quello del consolidamento (specifica del consolidamento, §8); la valutazione automatica della qualità delle proposte (giudice su un campione con verità nota) prima di aumentare l'autonomia degli agenti.

## 9. Critiche sincere

1. La documentazione invecchia più in fretta di quanto i controlli la correggano. Esempi trovati il 3/11: SOT_STATE fermo al 27/09 (ADV/docs/kb/SOT_STATE.md riga 12) contro uno stato del 29-30/10 (ADV/.handoff/STATE.md); 114 moduli contro gli 80 dichiarati (SOT_STATE.md riga 8); il piano dell'agente di consolidamento segna da fare voci già nel codice (ADV/.programmi/consolidamento/agente/06_PIANO.md righe 15-28); il README del gateway contro la memoria (sezione 4); il vocabolario dei verbi che dice 92 invece di 106; la tabella delle «undici» decisioni che ne ha dodici. Proposta: meno documenti di stato, più comandi che lo producono, come già chiede il CLAUDE.md di advanced.
2. Molti riti, pochi utenti. Il costo di ogni passo (PR, rilascio, copia di fase, dimostrazione dal vivo, 23 sezioni del rito) è giusto per la produzione bancaria, ma rischia di rallentare proprio le funzioni piccole della sezione 7. Proposta: un binario leggero per le pagine che espongono API già provate, con dimostrazione dal vivo ma senza copia di fase per ciascuna.
3. L'IA prepara molto e le persone decidono solo dove hanno una pagina. Il consolidamento lo prova in positivo: 40 proposte decise il giorno dopo l'arrivo della pagina (MEM, agente-consolidamento-tenant). La ricerca web senza pagina e l'agente in una pagina di sviluppo lo provano in negativo. La dottrina «la persona decide» funziona solo se la persona ha una pagina comoda e un motivo per tornarci. Ogni funzione agentica nuova dovrebbe nascere insieme alla pagina in cui si decide.
4. Manca la misura del valore. Il «test del valore» è il criterio più bello del progetto ed è ancora una frase (BUSINESS_SCOPE_AND_PRD.md §1.2). Senza di esso non si può dimostrare a un cliente né a un partner che Heuresys cambia le decisioni.
5. Un solo settore, un solo tenant. FIN_BANKING è l'unico settore con contenuto (AI/V7_lacune/lacune.md punto 8) e il metodo per provare famiglie fuori dalle banche è ancora una domanda aperta (DS/esecuzione/DOMANDE_APERTE.md, D-68). La tesi dell'affiancamento a Zucchetti o JetHR richiede di uscire dal bancario prima o poi.

## 10. Intervista a Enzo

Domande inviate nel thread il 3/11 alle 04:20 circa ora di Roma; risposte di Enzo alle 04:33. Le risposte sono riportate fedelmente, con i soli refusi corretti; il loro effetto è nella sezione 1bis e nella sezione 8.1.

1. Il primo cliente vero fra 12 mesi: banca media, PMI italiana o fornitore come Zucchetti o JetHR?
2. Chi apre Heuresys ogni mattina e che cosa ci deve trovare che oggi non ha?
3. Quale decisione organizzativa deve essere presa meglio grazie a Heuresys?
4. Il sogno: che cosa fa Heuresys fra tre anni che nessun altro fa?
5. Quali decisioni sulle persone l'IA non deve mai nemmeno proporre?
6. Quante ore a settimana puoi dedicare a provare e decidere?

Risposte:

1. Un fornitore come SAP o Zucchetti, più un primo cliente di medie dimensioni dell'industria manifatturiera.
2. Il Direttore HR che governa il capitale umano; il capo di unità, che ha un cockpit che lo aiuta nella gestione del suo presidio; il dipendente, che non deve più telefonare o scrivere ad altri per conoscere l'azienda e il suo ruolo all'interno di essa.
3. Il change management è al centro.
4. Sarà per il change management quello che SAP è per l'ERP.
5. Prima liberiamo i cavalli dell'IA per capire fino a dove può arrivare, poi decideremo le regole.
6. Tutto il mio tempo è dedicato a questo.

## 11. Che cosa non ho verificato

- Nessuna interrogazione al database: le cifre vengono dai file di AI/ (conteggio del 31/10) e dai documenti dei repository, con la loro data.
- Lo stato reale del gateway sulla VM e dei giri del consolidamento dopo il 1/11.
- La natura delle 741 richieste di approvazione (decise da persone o caricate come storia).
- Il contenuto di `_pubblicazioni/` del datastore, fuori dal deposito.
