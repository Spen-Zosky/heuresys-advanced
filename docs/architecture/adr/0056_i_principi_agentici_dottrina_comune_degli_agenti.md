# ADR-0056 — I principi agentici sono la dottrina comune degli agenti di advanced e del datastore

- **Status**: ACCETTATO il 2026-11-06 da Enzo Spenuso, alle 04:00 UTC (05:00 ora di Roma), nel thread «Portare i principi agentici in Heuresys»: «Sì, accetto l'ADR-0056». Le due scelte su cui poggia le aveva fatte prima, sulle schede dello stesso thread: alle 03:53 UTC (04:53 ora di Roma) «Solo io, decido prima dei clienti» (D3) e alle 03:55 UTC (04:55 ora di Roma) «P14 adattato, ADR-0053 resta» (D2).
- **Date**: 2026-11-06 (proposto e accettato lo stesso giorno)
- **Redatto da**: Claude Code, thread «Portare i principi agentici in Heuresys»
- **Richiesta**: Enzo Spenuso, 2026-11-05 alle 21:23 ora di Roma: «leggi il file PRINCIPI_agenti-e-assistenti_20261105.md e analizzalo a fondo per comprendere se possiamo portarlo dentro il progetto heuresys (advanced e datastore) per rendere il progetto pienamente agentico e con AI inglobata».
- **Fonte**: [`docs/architecture/agenti/PRINCIPI_agenti-e-assistenti_20261105.md`](../agenti/PRINCIPI_agenti-e-assistenti_20261105.md), versione 3 del 2026-11-05, nata in MOD. È copiata identica dall'originale sulla VM (nella cartella dell'utente `ubuntu`): stessa impronta SHA-256 `f4a159d2…aa57` dopo aver riportato i fine riga da LF a CRLF, l'unica normalizzazione applicata.
- **Analisi che lo prepara**: `principi-agentici/ANALISI_PRINCIPI_AGENTICI_HEURESYS_20261105.md` nei file del progetto (fuori dal deposito): confronto principio per principio, letto su `main` a4c53a6.
- **Builds on**: ADR-0040 (l'agente legge ciò che legge la persona), ADR-0050 D5 e D6 (riconferma recente; gli agenti non portano mandati, gettone dell'agente), ADR-0051 §6 (gli agenti propongono le deleghe), ADR-0053 (capacità `CONFERMA`/`LIBERA`), ADR-0054 D7 (l'IA è il modo di lavorare), regola trasversale di Enzo del 2026-10-31 (piattaforma agentica, AI driven), decisione D-67 del datastore (uso privato sul piano MAX).
- **Non tocca**: ADR-0053, che resta la regola su quanto un agente scrive da solo; ADR-0040 R1-R3; ADR-0036 §5; gli invarianti di `CLAUDE.md`.

> **In parole semplici.**
> 1. Il documento dei principi diventa la regola per tutti gli agenti di Heuresys, in advanced e nel datastore.
> 2. Le azioni degli agenti si dividono in quattro classi. Quelle che cambiano la struttura dell'azienda dentro Heuresys e si possono annullare possono andare da sole, come già dice ADR-0053. Quelle che escono dalla piattaforma o decidono qualcosa su un singolo lavoratore chiedono sempre la conferma di una persona. Alcune non esistono proprio.
> 3. Gli agenti pensano con l'abbonamento Claude Max di Enzo, e lo usa solo lui. Prima che lo usi un'altra persona, Enzo decide come.
> 4. L'assistente diventa un'applicazione che lavora anche a finestra chiusa, con l'elenco delle attività, come l'app di Claude. Finché non lo è, non si apre a nessun altro.

---

## §1 — Contesto

Il documento dei principi è la dottrina degli agenti scritta in MOD il 2026-11-05: 25 principi (P1-P25), un'architettura di nove componenti, undici riti, una lista di accettazione di 21 voci. Tre principi sono blindati da Enzo: P2 (l'assistente è un'applicazione sempre attiva legata all'utente), P3 (l'interfaccia è del tutto simile a quella di Claude), P24 (solo l'abbonamento Claude Max, mai una chiave API).

Il confronto con Heuresys, letto sul codice di `main` a4c53a6 il 2026-11-05, ha dato questo quadro sui 25 principi: 2 coperti (P12 con ADR-0040 R1 e il gettone di ADR-0050 D6; P20, perché l'agente ha solo gli strumenti `hrx_*`), 2 coperti nella sostanza (P13, P19), 9 coperti in parte, 7 mancanti (fra cui i blindati P2 e P3), 3 non applicabili oggi, 2 in contrasto. I due contrasti sono il motivo di questo ADR:

- **P24 e le condizioni d'uso di Anthropic.** La documentazione dell'Agent SDK e di Claude Code, letta il 2026-11-05, vieta di servire con un abbonamento claude.ai gli utenti di un prodotto («Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products»; «route requests through Free, Pro, or Max plan credentials on behalf of their users» non è permesso). P24 regge finché l'assistente lo usa Enzo; non regge, così com'è, il giorno in cui lo usa un'altra persona. La nota sui costi del gateway del 2026-11-05 proponeva per quel giorno una chiave API, che P24 esclude.
- **P14 e ADR-0053.** P14 mette in classe C, mai automatica, ogni azione che «cambia qualcosa che altri vedono». In Heuresys quasi ogni scrittura utile (un'unità, una posizione, un collegamento al prototipo) la vedono altri per natura, e ADR-0053 libera proprio quelle scritture, con tetto, ritorno provato, registro «per conto di», interruttore e riepilogo.

## §2 — Decisione

**D1 — Il documento è la dottrina comune.** Ogni agente di advanced (l'assistente del gateway, il giudice del consolidamento, la proposta di ricerca, i proponenti a regola come quello delle deleghe) e ogni verbo del datastore che usa un modello segue i principi P1-P25, i riti R1-R11 e la lista di accettazione del documento, con le sole letture e gli adattamenti scritti qui. Dove il documento dice «in MOD», l'esempio non vincola. Dove dice «la console», in Heuresys si legge la web app di advanced, e per il datastore la sua console.

**D2 — Le classi, lette per Heuresys** (scelta di Enzo del 2026-11-06, 03:55 UTC). La classe resta una proprietà fissa dell'operazione nel catalogo, mai una scelta del modello. Cambia il confine fra B e C:

| classe | in Heuresys | regola |
|---|---|---|
| A, legge | letture con i permessi della persona (ADR-0040) | libera, con il contatore di persone distinte e le sue soglie |
| B, interna e annullabile | scrittura dentro il tenant, sulla struttura e non su una singola persona (organizzazione, posizioni e ruoli, competenze, processi, indicatori), annullabile con un ritorno provato (ADR-0053 D3) | in modo `CONFERMA` la decide una persona; in modo `LIBERA` va da sola entro il tetto della capacità, con tutte le condizioni di ADR-0053 |
| C, esce o impegna | raggiunge una persona fuori dalla piattaforma (una mail, una notifica esterna, un file condiviso fuori); oppure produce un effetto su un singolo lavoratore (assunzione, promozione, assegnazione per tratti personali, valutazione, retribuzione, sanzione, fine del rapporto: GDPR art. 22, AI Act Allegato III punto 4, ADR-0053 D5); oppure tocca le eccezioni di ADR-0036 §5 | mai automatica, a nessun livello e in nessun modo; doppia conferma (P15), la seconda con la riconferma del secondo fattore di ADR-0050 D5 su un riepilogo ricalcolato dal codice |
| X, non esiste | cancellazione fisica (ADR-0035, ADR-0053 D5), concessione di un mandato a un agente (ADR-0050 D6), modifica di un'impostazione di sicurezza o di un ruolo, condivisione pubblica, esecuzione di codice | l'operazione non è nel catalogo |

Un'operazione che non si sa classificare è negata, come già oggi un'operazione che non si risolve (ADR-0033 §5.2).

**D3 — Il modello: abbonamento Max, usato solo da Enzo** (scelta di Enzo del 2026-11-06, 03:53 UTC). P24 vale: gli agenti di advanced e del datastore pensano con l'abbonamento Claude Max di Enzo, attraverso Claude Code autenticato sulla VM, e nessuna chiave API entra nel codice, nella configurazione o nell'ambiente passato al modello. Finché vale P24, l'assistente e ogni agente sono usati soltanto da Enzo, anche quando entra con l'utenza di una persona del tenant per una dimostrazione. **Prima del primo utente che non è Enzo**, e in particolare prima di aprire l'assistente alle persone di un cliente, si torna da Enzo con una decisione fra due strade: chiedere ad Anthropic l'approvazione che le sue regole prevedono, oppure riscrivere P24 per Heuresys con una chiave API e un tetto di spesa. Un'apertura senza quella decisione è vietata da questo ADR.

**D4 — L'assistente è un'applicazione, non una chiamata** (P2 e P3, blindati). Il gateway (`apps/agent-gateway`) diventa l'applicazione dell'assistente: conversazioni e attività salvate nel database e legate alla persona e al tenant; il lavoro che prosegue a finestra chiusa e cambiando pagina; la conversazione che si riprende, con il contatore di persone distinte che segue il suo identificativo (il limite già dichiarato in ADR-0040 §4b); le proposte in attesa salvate nel database, con scadenza e motivo di scarto obbligatorio, invece dei due minuti in memoria di oggi (`approval-bridge.ts`). La finestra resta una sola, montata nel layout autenticato (com'è da L10), e il componente cresce in `@heuresys/ui` (`ux-design-shared`): colonna delle attività con il loro stato, conversazione a flusso, avanzamento, file e artefatti. Si riprende la disposizione dell'interfaccia di Claude, non il marchio, i colori o le icone, perché le regole di Anthropic chiedono che un prodotto costruito con l'Agent SDK non sembri un prodotto Anthropic. Finché D4 e la prova avversaria (rito R5) non sono fatte, l'assistente non si apre a nessuno oltre a Enzo, nemmeno nei limiti di D3.

**D5 — Dove vive ogni componente.** La tabella di corrispondenza che il documento chiede come tappa 0:

| componente del documento | in Heuresys |
|---|---|
| applicazione dell'assistente | `apps/agent-gateway` (D4) |
| finestra | `AgentPanel` di `@heuresys/ui`, montato da `apps/web/src/components/pannello-agente.tsx` |
| ponte con la pagina | `apps/web/src/lib/agente/contesto.tsx`: la pagina dichiara contesto, ciò che mostra e i comandi della vista che accetta |
| coordinatore | `apps/agent-gateway/src/sdk-agent.ts`, con il modello fissato per nome |
| specialisti | giudice del consolidamento (`consolidation-propose.ts`), proposta di ricerca (`research-propose.ts`), verbi del datastore |
| catalogo delle azioni | `apps/agent-gateway/src/mcp-tool-names.ts`, `docs/kb/atlas/agent-operations.json` e il registro delle capacità di ADR-0053 (passo A1), con la classe di D2 per ogni operazione |
| cancello | `apps/agent-gateway/src/write-gate.ts`, che decide per classe, modo e tetto (passo A3 di ADR-0053) |
| coda delle proposte | tabella nuova in `sys.*` al posto della coda in memoria di `approval-bridge.ts`; l'approvazione legata alla persona che ha chiesto |
| servizio delle chiavi | non serve finché nessuna azione esce dalla piattaforma; nasce con la prima operazione di classe C che esce |
| registro | `audit.agent_gateway_decisions` (000452), il registro persona-agente (000477), `datastore_meta.datastore_call` nel datastore |
| anagrafe | elenco unico degli agenti di advanced e del datastore, con nome tecnico e nome parlante, confrontato col codice da un controllo `check_*.py` |

**D6 — Gli adattamenti dichiarati.**

- **P13, niente chiamata generica.** `hrx_entity_query` resta: è generica nel nome ma chiusa nei fatti, perché esegue solo le coppie concetto-operazione della mappa e nega ciò che non risolve. La classe di D2 si legge dall'operazione risolta, non dal nome dello strumento.
- **P21, livelli di autonomia.** Il modo `CONFERMA` di ADR-0053 è il livello L2, il modo `LIBERA` è L3 per la sola classe B. Si aggiungono L0 (legge e riferisce) e L1 (propone, senza eseguire neanche dopo l'approvazione) come gradini di partenza di un agente nuovo. Nessun agente parte da L3, come già vuole ADR-0053 D6.
- **P24 nel datastore.** Il motore `api` del datastore (`src/config/config.ts`, «si sceglie solo a mano») contraddice P24 e si ritira, nella sessione del datastore e con le sue regole.
- **P23, promozione.** Le istruzioni di ogni agente sono file del deposito con un'impronta; una versione nuova entra in servizio solo con i suoi casi verdi e la promozione registrata da Enzo (rito R3), non con il solo rilascio.

**D7 — Che cosa non vale oggi, e quando torna a valere.** P4 e P6 (dettato e voce) valgono dal giorno in cui la finestra accetta la voce. P8 e P16 (servizi personali e chiavi) valgono dal giorno in cui un agente usa un servizio esterno per conto di una persona. P9 (compito o automazione) vale dal giorno in cui le persone possono creare automazioni. Fino ad allora non si costruisce niente per loro.

## §3 — Conseguenze

- La decisione sul gateway (nota del 2026-11-05) cambia. Il suo passo 1 resta e si allarga: approvazione legata alla persona, limiti di conversazioni, giri e tempo, modello fissato, classi nel catalogo, controllo automatico che fallisce se compare `ANTHROPIC_API_KEY` dove il modello viene lanciato. Il passo 2 si riduce a Enzo come solo utente, per misurare. Il passo 3 (chiave API per le persone RTL) non si fa: lo sostituisce la decisione di D3.
- I passi A1-A3 di ADR-0053 e le tappe 1-2 del documento toccano gli stessi file e si fanno insieme, in un solo piano: [`docs/piani/PIANO_principi-agentici_20261106.md`](../../piani/PIANO_principi-agentici_20261106.md).
- Ogni piano o specifica nuova di advanced e del datastore porta una sezione «che cosa fa l'agente» (P1).
- Il lavoro più grande è D4: tocca gateway, database, web e `@heuresys/ui`.

## §4 — Come si verifica che sia fatto

La lista di accettazione della sezione 12 del documento, voce per voce, con la prova accanto, nella lettura di D2-D7. In particolare:

- una prova automatica sul catalogo: ogni operazione ha una classe; nessuna C è eseguibile senza le due conferme; nessuna X esiste; un'operazione senza classe è negata;
- un controllo che fallisce se `ANTHROPIC_API_KEY` o `ANTHROPIC_AUTH_TOKEN` arrivano all'ambiente del modello, in advanced e nel datastore;
- dal vivo, con Enzo: un'attività lunga avviata, la finestra chiusa, la pagina cambiata, la finestra riaperta, il risultato presente; uscita e nuovo accesso, l'attività ancora lì; un'altra utenza che chiede quell'attività riceve un rifiuto dall'API;
- la prova avversaria del rito R5 verde prima che l'assistente si apra a chiunque;
- l'anagrafe degli agenti allineata al codice dal suo controllo.

## §5 — Alternative scartate

- **P14 alla lettera**: avrebbe riportato a conferma ogni scrittura visibile ad altri, cioè ritirato ADR-0053. Enzo l'ha scartata il 2026-11-06.
- **Chiave API subito per le persone dei clienti** (passo 3 della nota del gateway): contraddice P24, blindato. Rinviata alla decisione di D3, prima del primo utente esterno.
- **Recepire il documento senza adattamenti**: in Heuresys non ha senso la classe C per ogni dato visto da altri, e alcuni principi (P8, P16) parlano di servizi che Heuresys oggi non usa.
- **Aprire l'assistente così com'è** e costruire P2 dopo: produrrebbe proprio l'anti-pattern che il documento nomina, un assistente che vive nel browser e si ferma quando si chiude la finestra.
