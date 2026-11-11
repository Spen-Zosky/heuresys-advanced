# Anagrafe degli agenti di Heuresys

Questa anagrafe elenca tutti gli agenti del progetto, in heuresys-advanced e in heuresys-datastore: chi sono, dove vivono nel codice, che cosa fanno e se scrivono. Nasce dal principio P22 («ogni agente ha un nome e una scheda, in un'anagrafe unica che un controllo automatico confronta con il codice») e dalla voce T5 del piano dei principi agentici (`docs/piani/PIANO_principi-agentici_20261106.md`).

## Come si tiene

Un agente nasce, cambia o si ritira nello stesso cambiamento in cui si aggiorna la sua riga. Nel codice il file indicato nella colonna «File con il segno» porta, in un commento, il segno `@agente <codice>`. Un agente ritirato resta nella tabella con stato `ritirato`, e il suo segno può sparire.

Il controllo è `python docs/kb/tools/check_anagrafe_agenti.py` (autoprova con `--selftest`; `--pieno` rende rosso il datastore non trovato). Lo lancia il cancello di verifica (`docs/kb/tools/verify_gate.py`) quando si toccano il gateway, il consolidamento, questa cartella o il controllo stesso. È rosso quando un file che avvia il modello non porta un segno, quando un segno nomina un codice che qui non c'è, e quando una riga non trova il suo segno.

Che cosa conta come agente, per il controllo: in advanced un file sotto `apps/*/src/` o `packages/*/src/` che importa la funzione `query` di `@anthropic-ai/claude-agent-sdk`; nel datastore un file sotto `src/`, `apps/*/src/` o `scripts/` che chiama `creaModello(`. Gli script di prova dell'autenticazione (`apps/agent-gateway/scripts/`) non sono agenti e restano fuori.

Il codice è quello che il resto del sistema usa già: `assistente-hr` è il valore di `agent_capability_agent_code` nel registro delle capacità (migrazione 000480) e del gettone d'agente. Il nome parlante è quello con cui l'agente si presenta alla persona.

Colonne: «Scrive» dice se l'agente cambia dati del cliente; «Modo» dice chi decide (ADR-0053: `CONFERMA` vuol dire che ogni scrittura la approva una persona, `LIBERA` che una capacità pubblicata e attivata dal Direttore HR la esegue da sola e la registra «per conto di» chi ha avviato il giro, migrazione 000482).

## Gli agenti

<!-- anagrafe:inizio -->
| Codice | Nome parlante | Repository | File con il segno | Che cosa fa | Scrive | Modo | Stato |
|---|---|---|---|---|---|---|---|
| `assistente-hr` | Assistente HR | heuresys-advanced | `apps/agent-gateway/src/sdk-agent.ts` | conversa con la persona, legge con i suoi permessi, comanda la vista della pagina aperta (cerca, filtra, ordina: `comandi-vista.ts`), prepara sul fascicolo del modello del tenant decisioni che la persona registra (`fascicolo.decidi`, modo «lavora») e propone scritture attraverso gli strumenti MCP e il cancello (`write-gate.ts`) | sì, solo attraverso l'API e il cancello | CONFERMA; LIBERA solo per capacità attivate (ADR-0053) | attivo |
| `ricerca-proponente` | Proponente delle ricerche | heuresys-advanced | `apps/agent-gateway/src/research-propose.ts` | ricava dati strutturati dal testo di pagine web per le ricerche di modello | no: nessuno strumento, restituisce proposte | propone, decide una persona | attivo |
| `consolidamento-giudice` | Giudice del consolidamento | heuresys-advanced | `apps/agent-gateway/src/consolidation-propose.ts` | dice se due voci scritte in modo diverso parlano della stessa cosa, nei giri di consolidamento del tenant | no: nessuno strumento, restituisce proposte con motivo e fiducia | propone, decide il Direttore HR o un delegato | attivo |
| `datastore-pensatore-banco` | Pensatore del banco | heuresys-datastore | `src/passi/esegui_un_passo.ts` | esegue i passi del banco di modellazione (venticinque verbi) con il modello del piano MAX | solo la telemetria del modello | propone, decide una persona | attivo |
| `datastore-ricerca-proponente` | Proponente delle ricerche del datastore | heuresys-datastore | `apps/api/src/servizio.ts` | propone una ricerca sul web per un documento (`POST /v1/ricerche/esegui`, `src/carico/proposta_ricerca.ts`) | solo la proposta e la telemetria | propone, decide una persona | attivo |
| `datastore-assistente-console` | Assistente della console del datastore | heuresys-datastore | `apps/api/src/servizio.ts` | risponde alle domande sulla pagina aperta della console leggendo solo con i verbi del vocabolario che non scrivono e non costano (`POST /v1/assistente/chiedi`, `src/assistente/assistente.ts`), e restituisce i comandi della vista che la pagina accetta | no: solo la telemetria del modello e il registro delle chiamate | legge e mostra; nessuna scrittura | attivo |
<!-- anagrafe:fine -->
