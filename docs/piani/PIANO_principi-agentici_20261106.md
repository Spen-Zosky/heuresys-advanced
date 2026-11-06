# Piano dei principi agentici (2026-11-06)

Attua [ADR-0056](../architecture/adr/0056_i_principi_agentici_dottrina_comune_degli_agenti.md), che recepisce il documento dei principi agentici (`docs/architecture/agenti/PRINCIPI_agenti-e-assistenti_20261105.md`) per advanced e datastore. Assorbe i passi A1-A3 di ADR-0053 e il passo 1 della nota sui costi del gateway del 2026-11-05 (`gateway-agenti/COSTI_RISCHI_GATEWAY_AGENTI_20261105.md` nei file del progetto), perché toccano gli stessi file.

Questo piano non si chiude nella sessione che lo scrive. In questa sessione si fa solo la voce T0. Le altre voci partono dopo il sì di Enzo su ADR-0056, dato il 2026-11-06 alle 04:00 UTC, ciascuna in un lotto con un suo commit e una dimostrazione dal vivo (ADR-0026). Non si chiude senza Enzo la voce T7, che resta una sua decisione (ADR-0056 D3).

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| T0 | ADR-0056, copia del documento, questo piano | `docs/architecture/adr/0056_*.md`, `docs/architecture/agenti/`, `python docs/kb/tools/build_adr_index.py` | Claude | PR in bozza aperta | fatta |
| T1 | Sì di Enzo su ADR-0056 | — | Enzo | stato ACCETTATO scritto nell'ADR | fatta (2026-11-06, 04:00 UTC) |
| T2a | Classe A/B/C per ogni strumento del catalogo (`classi-azioni.ts`); il gate nega una scrittura senza classe; prova automatica (ogni nome ha una classe, nessuna scrittura è A, ogni cancellazione è C, lo strumento generico prende la classe dal metodo risolto) | `apps/agent-gateway/src/classi-azioni.ts`, `write-gate.ts`, `mcp-tool-names.ts`, `test/classi-azioni.test.ts` | Claude | prova vista rossa e poi verde; `vitest run` del gateway verde | fatta (2026-11-06) |
| T2b | Registro delle capacità e delle attivazioni per tenant (A1 di ADR-0053), con la classe di ogni operazione | `db/migrations/000480_*.sql`, righe in 000429 e 000062, `db/scripts/agenti/inversa-000480.sql` e `prova-000480.sql` | Claude | catena applicata due volte su una copia di `heuresys_ci` sul gemello (`ci-rehearsal.sh`), sentinelle a zero; prova delle guardie vista rossa senza la guardia e verde con | fatta (2026-11-06) |
| T3a | Approvazione legata alla persona che ha chiesto; limiti di conversazioni contemporanee, giri e durata; modello fissato per nome | `approval-bridge.ts`, `server.ts`, `sdk-agent.ts`, `limiti.ts`, `heuresys-client.ts` | Claude | prove verdi, la guardia della persona vista rossa togliendola; dimostrazione dal vivo dopo il rilascio: un'approvazione da un'altra persona è rifiutata | in corso |
| T3b | Cancello per classe, modo e tetto (passo A3 di ADR-0053): una scrittura B di una capacità `LIBERA` del tenant passa sotto il tetto, tutto il resto come oggi | `write-gate.ts`, lettura di `sys.v_agent_capability_activations_current` | Claude | prove verdi; l'interruttore provato (ritorno a `CONFERMA`, la chiamata successiva torna al ponte) | da fare |
| T3c | Rotte e permessi del registro delle capacità (`HRMS_MANAGER` attiva e spegne per il suo tenant, `PLATFORM_ADMIN` pubblica le capacità) | modulo API nuovo, permessi, contratti in `packages/shared` | Claude | prove di integrazione verdi; login dal vivo con il Direttore HR di RTL | da fare |
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

## Scoperte (fuori da questo ciclo)

- 2026-11-06, durante T2b: ADR-0053 A1 chiede anche i permessi per `HRMS_MANAGER` e `PLATFORM_ADMIN`. Un permesso serve a una rotta, e le rotte del registro nascono con la voce T3: i permessi vanno lì, non nella migrazione 000480.

- 2026-11-06, durante T2a: `isWriteTool` (`write-gate.ts`) riconosce le scritture dal verbo nel nome, e vede «override» in `hrx_blueprint_overrides_list`, che è una lettura (GET, `mcp-tools.ts`). Il gate quindi chiede l'approvazione umana per una lettura. È prudente, non apre un buco; la prova `classi-azioni.test.ts` si appoggia agli elenchi del catalogo e non al verbo. Da decidere se correggerlo nel prossimo ciclo.
