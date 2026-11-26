# Heuresys è davvero agentica? Valutazione forense di advanced e datastore (26/11/2026)

Thread «Rendere Heuresys davvero AI-driven». Fase 1 del mandato: sola lettura, nessuna modifica al codice. Codice letto su `main` di heuresys-advanced al commit `40e409a` e di heuresys-datastore al commit `0309fb3`, il 26/11/2026 fra le 03:10 e le 04:30 ora di Roma. Ogni affermazione porta il file da cui viene; dove una misura non si è potuta fare lo scrivo.

## 1. Il verdetto in breve

Heuresys oggi è un **assistente governato con fondamenta da livello alto**, non ancora un prodotto AI-driven. Su una scala da 0 a 5 il livello complessivo è **2**: la parte di sicurezza e governo degli agenti è al livello dei migliori del mercato, in qualche punto più rigorosa; ma l'IA vive in un pannello laterale che risponde quando lo si interroga, le «intelligenze» di analisi sono regole deterministiche, nessun agente lavora da solo in background, e il change management, che è il centro della visione di Enzo, non ha ancora una riga di codice.

In una frase: abbiamo costruito molto bene i freni e il telaio; il motore che guida il lavoro dell'utente è ancora piccolo.

## 2. Che cosa esiste davvero (accertato sul codice)

Gli agenti censiti sono sei (`docs/architecture/agenti/ANAGRAFE_agenti.md`): tre in advanced, tre nel datastore.

| Agente | Che cosa fa | Scrive | Dove |
|---|---|---|---|
| Assistente HR | conversa nella pagina aperta, legge con i permessi della persona, comanda la vista, propone scritture con conferma | sì, solo con l'approvazione della persona o in una capacità LIBERA | `apps/agent-gateway/src/sdk-agent.ts` |
| Proponente delle ricerche | estrae dati strutturati da pagine web per le ricerche di modello | no | `apps/agent-gateway/src/research-propose.ts` |
| Giudice del consolidamento | dice se due voci scritte in modo diverso sono la stessa cosa | no, propone con motivo e fiducia | `apps/agent-gateway/src/consolidation-propose.ts` |
| Pensatore del banco (datastore) | genera il modello di un'impresa tipo in una cascata di passi (organigramma, processi, ruoli, competenze, CCNL, obiettivi, metriche, strategia) | solo telemetria | `src/passi/` (31 file di passo), `src/passi/pensatore.ts` |
| Proponente delle ricerche (datastore) | propone una ricerca sul web per un documento | solo la proposta | `apps/api/src/servizio.ts` |
| Assistente della console (datastore) | risponde sulla pagina aperta leggendo 24 verbi di sola lettura | no | `src/assistente/assistente.ts` |

Il motore pensa con l'abbonamento Claude di Enzo, modello `claude-sonnet-5-5` per nome (`apps/agent-gateway/src/limiti.ts`).

### 2.1 Le fondamenta di governo (il punto forte)

- Ogni azione ha una classe fissa scritta nel codice, A legge, B scrive sulla struttura in modo annullabile, C impegna o cancella; una scrittura senza classe è negata (`apps/agent-gateway/src/classi-azioni.ts`, ADR-0056 D2).
- Il cancello di scrittura approva le letture e porta ogni scrittura davanti alla persona, con il diniego come scelta predefinita (`write-gate.ts`, `approval-bridge.ts`); l'approvazione è legata alla persona che ha chiesto.
- Il registro delle capacità per tenant, in modo CONFERMA o LIBERA, si rilegge a ogni scrittura: una B può andare da sola solo se la capacità è pubblicata, attivata LIBERA e sotto il tetto (`capacita.ts`, migrazioni 000480 e 000481, ADR-0053).
- L'agente legge con il perimetro della persona; i dati che lei non vede arrivano come {omissis} e il rifiuto di una domanda tutta su dati vietati lo decide il gateway, non il modello (`omissis.ts`, `istruzioni.ts`).
- Il freno si misura in persone distinte lette per conversazione, con soglie ricavate dai dati (`persone-distinte.ts`, `soglie-persone.ts`).
- Diario di ogni decisione del cancello, registro «per conto di» (000482), anagrafe degli agenti con un controllo che la confronta col codice (`docs/kb/tools/check_anagrafe_agenti.py`), prova avversaria con 19 casi (`apps/agent-gateway/test/prova-avversaria.test.ts`).
- Conversazioni, attività e proposte salvate nel database e riprese (migrazione 000483, modulo `agent-conversations`); richieste dell'agente con previsione di spesa e decisione umana (migrazione 000501, modulo `agent-requests`).

### 2.2 Quanto vede e quanto può fare l'assistente

Misura sul catalogo generato (`docs/kb/atlas/agent-operations.json`) confrontato con l'atlante delle rotte (`docs/kb/atlas/atlas.yaml`, generato al commit `46a623bc`):

| | Rotte dell'API | Raggiungibili dall'assistente | Quota |
|---|---|---|---|
| Letture (GET) | 415 | 387 nel catalogo generico, su 116 concetti | 93% |
| Scritture (POST, PATCH, PUT, DELETE) | 341 | 11 nel catalogo generico più 17 strumenti con nome proprio, circa 28 | circa 8% |

Restano fuori per scelta l'autenticazione e le segnalazioni (whistleblowing). Comando per rifarla: lettura di `concepts` in `agent-operations.json` e di `routes` in `atlas.yaml`.

L'assistente si apre su 111 delle 145 pagine web (`apps/web/src/lib/agente/pagine-idonee.generated.ts`); i comandi della vista (cerca, filtra, ordina) arrivano da ogni tabella generica (`components/data-table-panel.tsx`); solo due pagine dichiarano un contesto più ricco (`approvals/[id]`, `tenant-blueprints/[id]`).

Limiti di servizio: al massimo 2 conversazioni per persona e 4 in tutto il servizio insieme, 30 giri e 15 minuti per conversazione (`limiti.ts`). Chi può usarlo è un elenco chiuso di persone o tenant nella configurazione della VM, vuoto vuol dire nessuno (`limiti.ts`, `personeAmmesse`); per decisione di Enzo, oggi solo lui (ADR-0056 D3).

### 2.3 Le «intelligenze» che non sono IA

- Il consigliere dell'Org Director è un motore prescrittivo deterministico, «nessun modello linguistico» (`apps/api/src/modules/advisor/engine.ts`). È tracciabile e corretto, ma non ragiona.
- Il rischio di uscita è una regola lineare pesata, «NO ML» (`apps/api/src/modules/insights/service.ts`); il timer `heuresys-advanced-insights` la ricalcola.
- Le predizioni sono valori precalcolati ereditati, in sola lettura (`apps/api/src/modules/predictions/service.ts`).
- La corrispondenza semantica usa vettori precalcolati (`apps/api/src/modules/semantic-matching/`).
- Le «proposte dell'agente» sulle faccette dei processi sono regole SQL dentro migrazioni marcate `fonte AGENTE` (`db/migrations/000510`, `000511`, `000512`). Il nome promette un agente, il contenuto è una regola: è un rischio di etichetta da correggere.

### 2.4 Che cosa è pianificato e non costruito

- Applet dell'assistente (ADR-0060, accettata il 18/11): voci P2 e P4-P14 aperte, codice solo per la rotta P3 (`docs/piani/PIANO_applet-assistente_20261118.md`).
- Conoscenza agentica (documentazione consultabile, ricerca ibrida, memoria personale, casi e promozione degli agenti, consumo per agente, revisione settimanale): piano K0-K15 nella PR #272 in bozza, nessun modulo `knowledge` nell'API.
- Programma del change management (`docs/piani/PROGRAMMA_change_management_20261103.md`): 23 voci su 24 «da fare», l'unica avviata è ADR-0053. Nessuna tabella del cambiamento, nessuno scenario, nessuna simulazione nel codice (ricerca su `db/migrations` e `apps/api/src/modules`).
- Nessun registro degli eventi dei processi, quindi niente analisi dei processi come sono eseguiti davvero.

### 2.5 Il datastore

È la parte più generativa del progetto: il banco costruisce un'impresa tipo con il modello, in una cascata di 31 file di passo, ciascuno con un validatore e fino a tre tentativi, e porta le fonti (`src/passi/pensatore.ts`, `src/passi/forma_del_banco.ts`). Il consolidamento porta quel modello nel tenant con il giudice. L'assistente della console invece è di sola lettura e non ricorda le conversazioni oltre la sessione del browser.

### 2.6 Che cosa non ho potuto misurare

L'uso reale in produzione (quante conversazioni, quante persone, quante capacità sono in modo LIBERA, quante proposte approvate): la lettura del database di produzione dal PC mi è stata negata dal controllo dei permessi della sessione. La rifà un thread con accesso alla VM, in sola lettura; la query è pronta. Finché non c'è, nessuna cifra d'uso in questo documento.

## 3. Il ranking, asse per asse

Scala: 0 assente; 1 regole o automazione senza IA; 2 un assistente che risponde se interrogato; 3 un agente che agisce su un dominio, con conferma; 4 agenti coordinati, proattivi, misurati, con autonomia concessa per capacità; 5 il sistema scopre, propone, simula ed esegue entro mandati, impara dagli esiti, e il valore si misura. La colonna «mercato» è il livello dei migliori prodotti nel 2026 (sezione 4).

| # | Asse | Heuresys | Mercato | Perché questo voto |
|---|---|---|---|---|
| 1 | Governo e sicurezza degli agenti | 4 | 4 | classi fisse, cancello, registro capacità, {omissis}, persone distinte, prova avversaria; manca il cruscotto d'uso, valore e consumo per agente che Workday e SAP danno |
| 2 | Profondità di lettura | 3,5 | 4 | 93% delle letture; mancano la documentazione e le regole aziendali come conoscenza, la ricerca per significato sui documenti, la memoria |
| 3 | Capacità di agire | 1,5 | 4 | circa 8% delle scritture, una alla volta, quasi tutte con conferma; nessuna azione composta in più passi (le applet non ci sono) |
| 4 | Autonomia e proattività | 1 | 4 | nessun agente che osserva e segnala da solo; tutto parte da una domanda in una pagina; 4 conversazioni in tutto il servizio |
| 5 | Scoperta di fatti sommersi | 1,5 | 4 | le sentinelle esistono ma sono controlli di sviluppo; nessuna diagnosi delle cause, nessuna anomalia segnalata alla persona giusta |
| 6 | Decisioni sofisticate | 2 | 4 | consigliere a regole con citazioni (buono), VRIO e maturità; nessuno scenario «e se», nessun confronto di opzioni con costo e impatto |
| 7 | Organizzazione e risorse | 2,5 | 3,5 | modello per posizione e prototipi generati dal datastore sono rari sul mercato; manca la modellazione di una riorganizzazione con l'impatto |
| 8 | Change management | 0,5 | 3 | programma tutto da fare; nessun oggetto «cambiamento», nessuna prontezza, nessun piano di adozione |
| 9 | Ridisegno dei processi | 1,5 | 4 | tassonomia e faccette (ADR-0061), mappatura APQC; nessun dato di esecuzione, nessuna simulazione, proposte a regole |
| 10 | Assistenza in ogni funzione | 2,5 | 4 | finestra su 111 pagine su 145, comandi della vista generici; un solo utente ammesso |
| 11 | Qualità misurata e apprendimento | 1 | 3,5 | nessuna batteria di domande con risposta attesa, nessun consumo per agente, nessuna promozione delle versioni (P23 senza codice) |
| 12 | Generazione di modelli (datastore) | 3 | 2,5 | cascata di 31 passi con validatori e fonti: qui siamo avanti, ma il risultato entra nel tenant solo col consolidamento |

Media semplice: 2,0. Il voto complessivo 2 su 5 non è una media di comodo: è il livello del lavoro che l'utente vive (assi 3-11), mentre gli assi 1, 2 e 12 sono le fondamenta.

## 4. Il confronto con lo stato dell'arte

Fonti lette il 26/11/2026: documentazione e comunicati dei fornitori.

- **Workday**: agenti autonomi che agiscono «come sé stessi o per conto di una persona», con abilità fatte di strumenti che sono le API di Workday; un registro centrale degli agenti (Agent System of Record) per configurarli, accenderli, spegnerli, misurarne uso e valore, con rapporti di sicurezza; agenti propri, di partner ed esterni (doc.workday.com, «About Workday Agents», aggiornato il 23/10/2026).
- **SAP SuccessFactors**: assistenti per ruolo che coordinano agenti specializzati (per esempio un agente che trova incoerenze nelle valutazioni in calibrazione); un grafo della conoscenza dei processi; una console di governo degli agenti; ogni proposta la conferma una persona; memoria delle conversazioni per 7 giorni (help.sap.com, «Joule Agents Overview» e «Understanding Joule Agents»; learning.sap.com).
- **Oracle Fusion HCM**: applicazioni agentiche fatte di squadre di agenti che pianificano, calcolano, simulano e ripianificano; un agente che progetta i ruoli (Job Architect); agenti che preparano azioni da approvare (oracle.com, comunicati del 9/4, 11/8 e 21/10/2026).
- **Visier**: agenti che osservano l'organizzazione e segnalano da soli ciò che cambia e ciò che è a rischio, per ogni responsabile e nel suo perimetro; diagnosi statistica delle cause; agenti che guidano i manager nei programmi HR e misurano che cosa hanno cambiato; contesto esposto ad altri agenti con MCP (visier.com, comunicati del 21/10 e 3/11/2026).
- **Orgvue**: la riorganizzazione modellata dall'agente dentro la piattaforma, con l'impatto mostrato prima, nessun dato cambiato senza revisione umana, ogni decisione registrata e reversibile (orgvue.com, 6/10/2026).
- **Celonis**: il grafo dei processi come sono eseguiti davvero, simulazione, raccomandazioni, ed esposizione del contesto agli agenti con MCP (kai-waehner.de, panorama del 22/7/2026).

Dove Heuresys è già avanti: il perimetro della persona ereditato in modo stretto con {omissis} e rifiuto deciso dal codice; la classe fissa di ogni azione; la prova avversaria; il modello centrato sulla posizione; la generazione di un'impresa tipo con le fonti, che nessuno dei sei fa.

Dove è indietro: agenti che lavorano da soli e segnalano; squadre di agenti coordinate; scenari e simulazioni; conoscenza documentale e memoria; misura di qualità, consumo e valore; esposizione agli agenti esterni; change management.

## 5. Che cosa serve per dire «AI-driven» senza esagerare

Propongo sette criteri misurabili. Quando tutti e sette sono verdi con una prova dal vivo, possiamo dirlo.

1. **Ogni funzione è anche dell'agente**: almeno il 95% delle letture e il 70% delle scritture raggiungibili, ciascuna con la sua classe; ogni funzione nuova nasce con la sua voce nel catalogo (principio P1).
2. **Agenti che lavorano da soli**: almeno tre agenti in background che osservano il tenant e portano alla persona giusta, nel suo perimetro, un fatto che non aveva chiesto (rischi, incoerenze, scostamenti), con la fonte.
3. **Lavoro in più passi**: l'utente chiede un risultato («copri le 27 posizioni critiche senza successore») e l'agente prepara un'applet con anteprima, decisioni, esecuzione e ritorno, entro i permessi della persona.
4. **Decisioni con scenari**: per una riorganizzazione o un piano di risorse, almeno due opzioni confrontate su costo, persone toccate, competenze e processi, prima di scrivere.
5. **Il cambiamento come oggetto**: dal motivo al piano di adozione misurato, con l'agente che costruisce, misura la prontezza e segue l'avanzamento.
6. **Processi ridisegnati con prove**: l'agente legge come il processo è fatto, propone il disegno nuovo con il motivo e l'impatto, e la persona decide.
7. **Qualità e valore misurati**: una batteria di domande vere con la risposta attesa, consumo e tempi per agente, decisioni prese con l'agente contate, e tutte le persone del tenant che lo usano con i loro permessi.

## 6. Incoerenze trovate strada facendo (fuori da questo ciclo)

- Il piano dell'assistente come Claude (`docs/piani/PIANO_assistente-come-claude_20261118.md`) ha le voci V1-V4 «da fare», ma il codice di V2 e V3 esiste (`omissis.ts`, `istruzioni.ts`): la tabella non è aggiornata.
- ADR-0033 (catalogo generico) è ancora PROPOSED mentre il catalogo generico è in servizio (`mcp-tools.ts`).
- Le migrazioni 000510-000512 scrivono `fonte AGENTE` per regole SQL (sezione 2.3).
- Il README del gateway descrive ancora l'adattatore del plugin `human-resources-plus`, oggi disattivato (`apps/agent-gateway/README.md`, `sdk-agent.ts`).
