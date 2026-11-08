# Piano dei principi agentici (2026-11-06)

Attua [ADR-0056](../architecture/adr/0056_i_principi_agentici_dottrina_comune_degli_agenti.md), che recepisce il documento dei principi agentici (`docs/architecture/agenti/PRINCIPI_agenti-e-assistenti_20261105.md`) per advanced e datastore. Assorbe i passi A1-A3 di ADR-0053 e il passo 1 della nota sui costi del gateway del 2026-11-05 (`gateway-agenti/COSTI_RISCHI_GATEWAY_AGENTI_20261105.md` nei file del progetto), perché toccano gli stessi file.

Questo piano non si chiude nella sessione che lo scrive. In questa sessione si fa solo la voce T0. Le altre voci partono dopo il sì di Enzo su ADR-0056, dato il 2026-11-06 alle 04:00 UTC, ciascuna in un lotto con un suo commit e una dimostrazione dal vivo (ADR-0026). Non si chiude senza Enzo la voce T7, che resta una sua decisione (ADR-0056 D3).

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| T0 | ADR-0056, copia del documento, questo piano | `docs/architecture/adr/0056_*.md`, `docs/architecture/agenti/`, `python docs/kb/tools/build_adr_index.py` | Claude | PR in bozza aperta | fatta |
| T1 | Sì di Enzo su ADR-0056 | — | Enzo | stato ACCETTATO scritto nell'ADR | fatta (2026-11-06, 04:00 UTC) |
| T2a | Classe A/B/C per ogni strumento del catalogo (`classi-azioni.ts`); il gate nega una scrittura senza classe; prova automatica (ogni nome ha una classe, nessuna scrittura è A, ogni cancellazione è C, lo strumento generico prende la classe dal metodo risolto) | `apps/agent-gateway/src/classi-azioni.ts`, `write-gate.ts`, `mcp-tool-names.ts`, `test/classi-azioni.test.ts` | Claude | prova vista rossa e poi verde; `vitest run` del gateway verde | fatta (2026-11-06) |
| T2b | Registro delle capacità e delle attivazioni per tenant (A1 di ADR-0053), con la classe di ogni operazione | `db/migrations/000480_*.sql`, righe in 000429 e 000062, `db/scripts/agenti/inversa-000480.sql` e `prova-000480.sql` | Claude | catena applicata due volte su una copia di `heuresys_ci` sul gemello (`ci-rehearsal.sh`), sentinelle a zero; prova delle guardie vista rossa senza la guardia e verde con | fatta (2026-11-06) |
| T3a | Approvazione legata alla persona che ha chiesto; limiti di conversazioni contemporanee, giri e durata; modello fissato per nome | `approval-bridge.ts`, `server.ts`, `sdk-agent.ts`, `limiti.ts`, `heuresys-client.ts` | Claude | prove verdi, la guardia della persona vista rossa togliendola; dimostrazione dal vivo dopo il rilascio: un'approvazione da un'altra persona è rifiutata | fatto (PR #188, 2bdf626) |
| T3b | Cancello per classe, modo e tetto (passo A3 di ADR-0053): una scrittura B di una capacità `LIBERA` del tenant passa sotto il tetto, tutto il resto come oggi | `write-gate.ts`, lettura di `sys.v_agent_capability_activations_current` | Claude | prove verdi; l'interruttore provato (ritorno a `CONFERMA`, la chiamata successiva torna al ponte) | fatto (PR #189, 5dddbae) |
| T3c | Rotte e permessi del registro delle capacità (`HRMS_MANAGER` attiva e spegne per il suo tenant, `PLATFORM_ADMIN` pubblica le capacità) | modulo API nuovo, permessi, contratti in `packages/shared` | Claude | prove di integrazione verdi; login dal vivo con il Direttore HR di RTL | fatto nel codice (PR #190, b972cfc; 8/8 prove sul gemello e nella CI); la prova dal vivo col Direttore HR aspetta il rilascio |
| T4 | Controllo «niente chiave API» in advanced e nel datastore; ritiro del motore `api` del datastore | advanced: `docs/kb/tools/` o prova del gateway; datastore: `src/config/config.ts`, `src/modello/cliente.ts` (sessione del datastore) | Claude | il controllo è visto rosso con una chiave finta nell'ambiente, poi verde | advanced fatto (il gateway non parte con una chiave che arriverebbe all'SDK: `subscription-auth.ts`, prova vista rossa e verde, 2026-11-06); datastore fatto (PR #24 del datastore, b62ea07: `DATASTORE_MOTORE=api` rifiutato, `ANTHROPIC_AUTH_TOKEN` tolto al processo di Claude Code) |
| T5 | Registro «per conto di» (A2) e anagrafe degli agenti di advanced e datastore, con il controllo che la confronta col codice | `audit-sink.ts`, migrazione nuova, `docs/architecture/agenti/ANAGRAFE_agenti.md`, `docs/kb/tools/check_anagrafe_agenti.py` | Claude | il controllo gira nella verifica e passa | fatto nel codice (PR #192): registro «per conto di» (000482) e anagrafe `docs/architecture/agenti/ANAGRAFE_agenti.md` con `check_anagrafe_agenti.py` nel cancello di verifica (datastore #25); la prova dal vivo aspetta il rilascio |
| T6 | Assistente persistente (D4): conversazioni, attività e proposte nel database; ripresa con il contatore che segue la conversazione; lavoro a finestra chiusa; finestra con la colonna delle attività in `@heuresys/ui` | gateway, migrazioni, `apps/web/src/components/pannello-agente.tsx`, `ux-design-shared` | Claude | dimostrazione dal vivo con Enzo su tre dispositivi (§4 di ADR-0056) | in corso, in tre lotti (T6a, T6b, T6c: sezione qui sotto) |
| T7 | Prova avversaria (rito R5) e decisione di D3 prima di aprire l'assistente a un'altra persona | casi in `apps/agent-gateway/test/` | Claude, poi Enzo | prova verde; scelta di Enzo fra approvazione Anthropic e chiave API | da fare |

## T6 in tre lotti (scritto il 2026-11-08, prima di cominciare)

T6 è troppo grande per un lotto solo. Si divide in tre, ognuno con la sua PR e le sue prove.

| id | cosa | file e comandi | fatta quando | stato |
|---|---|---|---|---|
| T6a | Conversazioni, attività, eventi e proposte nel database, dietro un modulo API nuovo con un permesso `:self` per ogni ruolo; solo la persona proprietaria legge e scrive le sue righe | `db/migrations/000483_*.sql`, `packages/shared/src/schemas/agent-conversations.ts`, `apps/api/src/modules/agent-conversations/`, `apps/api/test/agent-conversations.integration.test.ts` | prove di integrazione verdi sul gemello e nella CI; un'altra utenza riceve 404 sulla conversazione altrui | prove verdi sul gemello il 2026-11-08 (catena intera verde con la `ci-rehearsal.sh`, 8 prove del modulo); la catena ha chiesto di emendare 000428, 000432 e 000449, che non conoscevano un permesso dato a ogni ruolo. Restano la CI e la dimostrazione dal vivo dopo il rilascio |
| T6b | Il gateway scrive conversazione, attività, eventi e proposte attraverso il modulo; il giro non si ferma quando la finestra si chiude; la conversazione si riprende (sessione dell'SDK, contatore delle persone che continua); la proposta dura fino alla scadenza scritta, con motivo obbligatorio quando si scarta | `apps/agent-gateway/src/server.ts`, `sdk-agent.ts`, `approval-bridge.ts`, `persone-distinte.ts`, `heuresys-client.ts`, prove del gateway | prove del gateway verdi; prova vista rossa senza la ripresa | codice e prove verdi il 2026-11-08 (`test/giro.test.ts`, 12 prove; rossa togliendo `resume`). Il giro sta in `src/giro.ts`, il registro in `src/conversazione.ts`. Restano la CI e la dimostrazione dal vivo dopo il rilascio |
| T6c | La finestra: elenco delle attività con il loro stato, conversazione ripresa all'apertura, proposte in attesa decise anche dopo aver chiuso la finestra | `apps/web/src/components/pannello-agente.tsx`, `apps/web/src/lib/use-agent-stream.ts`, componente in `@heuresys/ui` (`ux-design-shared`) | dimostrazione dal vivo con Enzo (§4 di ADR-0056) dopo il rilascio | da fare |

Simulazione di T6, scritta prima del codice.

- Dove stanno i dati. Nel modulo API e non nel pool del diario del gateway. Il diario è un'eccezione dichiarata (#253) per `audit.*`. Le conversazioni sono dati della persona, legati al tenant: passano dal middleware dell'API (I5), e così il rifiuto a un'altra utenza lo dà l'API, come chiede ADR-0056 §4. Il gateway scrive con il gettone dell'agente, che agisce per conto della persona. Il web legge con i cookie della persona.
- Il gettone dura 10 minuti (`AGENT_TOKEN_TTL_SECONDS`) e non si rinnova, la durata massima del giro è 15 (`limiti.ts`). Un'attività a finestra chiusa vive al massimo quanto il gettone. Oltre, l'attività si chiude con il suo motivo scritto, e non resta «in corso».
- Il contatore delle persone distinte segue la conversazione (ADR-0040 §4b). Alla ripresa riparte dall'insieme salvato. Si salvano impronte degli identificativi, mai gli identificativi: per contare i distinti basta l'uguaglianza.
- L'identificativo della conversazione nel diario del cancello (`conversation_id`) diventa quello della riga nel database. Oggi lo genera `runHrAgent` a ogni chiamata.
- Un'attività rimasta «in corso» dopo un riavvio del gateway si mostra interrotta quando è più vecchia della durata massima. Non serve un processo che la chiuda.
- Permessi: `agent_conversation:use:self`, dato a ogni ruolo di tenant e a `PLATFORM_ADMIN`, con il segno della lista di `TENANT_ADMIN` (000210). Prima di scrivere la migrazione si legge `python docs/kb/tools/chi_sorveglia.py sys_auth_role_permissions`, che nomina i cancelli: `check_permessi_inutili.py`, `rbac-tenant-admin-allowlist.test.ts`, `pavimento-area-personale.integration.test.ts`.
- La migrazione si prova sul gemello con `ci-rehearsal.sh`, su una copia aperta con `copia-prova.sh`.
- T6c tocca `ux-design-shared`. La pubblicazione di `@heuresys/ui` su npm resta un passo di Enzo.
- Fuori da T6: aprire l'assistente ad altre persone, che resta legato a T7 e a D3.

## Simulazione

T2 e T5 creano tabelle: campi categorici `varchar(N) + CHECK` (RD-08), migrazione provata sul gemello o su copia usa-e-getta, mai su `heuresys_ci` né sulla produzione. Prima di toccare `audit.agent_gateway_decisions` si esegue `python docs/kb/tools/chi_sorveglia.py agent_gateway_decisions`.

T3 cambia il comportamento del gateway acceso sulla VM, che serve anche il giudice del consolidamento: va in produzione solo con un rilascio, che decide Enzo.

T4 nel datastore si fa con le regole del datastore (la sua sessione, `pnpm run fatto:veloce`, la sezione 21 del vocabolario dei verbi).

T6 è il lotto più grande. Tocca anche `ux-design-shared`, e la nuova versione di `@heuresys/ui` va pubblicata su npm, che è un passo di Enzo.

Fuori da questo ciclo: P4, P6, P8, P9 e P16 (ADR-0056 D7), finché non nasce ciò che li rende necessari.

## Scoperte (fuori da questo ciclo)

- 2026-11-06, durante T3b: il tetto di ADR-0053 D1 parla di righe scritte, il cancello conta le chiamate. Per gli strumenti di oggi una chiamata scrive una riga, salvo `hrx_tenant_materialize`, che ne scrive molte: una capacità che la contiene va pubblicata con un tetto pensato per quello, oppure la materializzazione resta fuori dalle capacità. Da decidere con le rotte del registro (T3c). Esito di T3c: le rotte non lo decidono da sole; chi pubblica una capacità (la piattaforma) sceglie il tetto, e la materializzazione resta fuori dalle capacità finché non c'è un tetto in righe.

- 2026-11-06, durante T2b: ADR-0053 A1 chiede anche i permessi per `HRMS_MANAGER` e `PLATFORM_ADMIN`. Un permesso serve a una rotta, e le rotte del registro nascono con la voce T3: i permessi vanno lì, non nella migrazione 000480.

- 2026-11-06, durante T2a: `isWriteTool` (`write-gate.ts`) riconosce le scritture dal verbo nel nome, e vede «override» in `hrx_blueprint_overrides_list`, che è una lettura (GET, `mcp-tools.ts`). Il gate quindi chiede l'approvazione umana per una lettura. È prudente, non apre un buco; la prova `classi-azioni.test.ts` si appoggia agli elenchi del catalogo e non al verbo. Da decidere se correggerlo nel prossimo ciclo.
