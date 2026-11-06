# Piano dei principi agentici (2026-11-06)

Attua [ADR-0056](../architecture/adr/0056_i_principi_agentici_dottrina_comune_degli_agenti.md), che recepisce il documento dei principi agentici (`docs/architecture/agenti/PRINCIPI_agenti-e-assistenti_20261105.md`) per advanced e datastore. Assorbe i passi A1-A3 di ADR-0053 e il passo 1 della nota sui costi del gateway del 2026-11-05 (`gateway-agenti/COSTI_RISCHI_GATEWAY_AGENTI_20261105.md` nei file del progetto), perché toccano gli stessi file.

Questo piano non si chiude nella sessione che lo scrive. In questa sessione si fa solo la voce T0. Le altre voci partono dopo il sì di Enzo su ADR-0056, dato il 2026-11-06 alle 04:00 UTC, ciascuna in un lotto con un suo commit e una dimostrazione dal vivo (ADR-0026). Non si chiude senza Enzo la voce T7, che resta una sua decisione (ADR-0056 D3).

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| T0 | ADR-0056, copia del documento, questo piano | `docs/architecture/adr/0056_*.md`, `docs/architecture/agenti/`, `python docs/kb/tools/build_adr_index.py` | Claude | PR in bozza aperta | fatta |
| T1 | Sì di Enzo su ADR-0056 | — | Enzo | stato ACCETTATO scritto nell'ADR | fatta (2026-11-06, 04:00 UTC) |
| T2 | Catalogo con le classi: la classe di D2 per ogni operazione di `mcp-tool-names.ts` e di `agent-operations.json`; registro delle capacità di ADR-0053 (A1); prova automatica (nessuna C senza conferme, nessuna X, operazione senza classe negata) | `apps/agent-gateway/src/`, migrazione nuova in `sys.*`, `apps/agent-gateway/test/` | Claude | prova vista rossa e poi verde; migrazione provata con `bash db/scripts/prova-idempotenza.sh` | da fare |
| T3 | Cancello per classe, modo e tetto (A3); approvazione legata alla persona che ha chiesto; limiti di conversazioni contemporanee, giri e durata; modello fissato per nome | `write-gate.ts`, `server.ts`, `sdk-agent.ts`, `approval-bridge.ts` | Claude | prove verdi; dimostrazione dal vivo con Enzo: un'approvazione da un'altra sessione è rifiutata | da fare |
| T4 | Controllo «niente chiave API» in advanced e nel datastore; ritiro del motore `api` del datastore | advanced: `docs/kb/tools/` o prova del gateway; datastore: `src/config/config.ts`, `src/modello/cliente.ts` (sessione del datastore) | Claude | il controllo è visto rosso con una chiave finta nell'ambiente, poi verde | da fare |
| T5 | Registro «per conto di» (A2) e anagrafe degli agenti di advanced e datastore, con il controllo che la confronta col codice | `audit-sink.ts`, migrazione nuova, `docs/architecture/agenti/ANAGRAFE_agenti.md`, `docs/kb/tools/check_anagrafe_agenti.py` | Claude | il controllo gira nella verifica e passa | da fare |
| T6 | Assistente persistente (D4): conversazioni, attività e proposte nel database; ripresa con il contatore che segue la conversazione; lavoro a finestra chiusa; finestra con la colonna delle attività in `@heuresys/ui` | gateway, migrazioni, `apps/web/src/components/pannello-agente.tsx`, `ux-design-shared` | Claude | dimostrazione dal vivo con Enzo su tre dispositivi (§4 di ADR-0056) | da fare |
| T7 | Prova avversaria (rito R5) e decisione di D3 prima di aprire l'assistente a un'altra persona | casi in `apps/agent-gateway/test/` | Claude, poi Enzo | prova verde; scelta di Enzo fra approvazione Anthropic e chiave API | da fare |

## Simulazione

T2 e T5 creano tabelle: campi categorici `varchar(N) + CHECK` (RD-08), migrazione provata sul gemello o su copia usa-e-getta, mai su `heuresys_ci` né sulla produzione. Prima di toccare `audit.agent_gateway_decisions` si esegue `python docs/kb/tools/chi_sorveglia.py agent_gateway_decisions`.

T3 cambia il comportamento del gateway acceso sulla VM, che serve anche il giudice del consolidamento: va in produzione solo con un rilascio, che decide Enzo.

T4 nel datastore si fa con le regole del datastore (la sua sessione, `pnpm run fatto:veloce`, la sezione 21 del vocabolario dei verbi).

T6 è il lotto più grande. Tocca anche `ux-design-shared`, e la nuova versione di `@heuresys/ui` va pubblicata su npm, che è un passo di Enzo.

Fuori da questo ciclo: P4, P6, P8, P9 e P16 (ADR-0056 D7), finché non nasce ciò che li rende necessari.
