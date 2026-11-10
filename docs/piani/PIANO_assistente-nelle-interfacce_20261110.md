# Piano: l'assistente nelle interfacce di Heuresys (2026-11-10)

Attua le logiche di [LOGICHE_assistente-nelle-interfacce.md](../architecture/agenti/LOGICHE_assistente-nelle-interfacce.md), ricavate da mod-platform, sulle interfacce di advanced e del datastore. Riprende e non rifà il [piano dei principi agentici](PIANO_principi-agentici_20261106.md), di cui è il seguito sull'interfaccia: lì il gateway è diventato l'applicazione dell'assistente (T6), qui l'assistente entra nelle pagine. Un blocco, una PR.

Che cosa non si chiude in questa sessione, già da ora: la dimostrazione dal vivo di ogni blocco, che vuole il rilascio in produzione (decisione di Enzo; durante un rilascio armato non si unisce niente su `main`); la pubblicazione su npm della versione di `@heuresys/ui` del blocco I2 (passo di Enzo); il blocco I7, che si fa in una sessione del datastore.

| id | cosa | file e comandi | chi | fatta quando | stato |
|---|---|---|---|---|---|
| I0 | Logiche adattate e questo piano | `docs/architecture/agenti/LOGICHE_assistente-nelle-interfacce.md`, questo file | Claude | nel repo, nella PR di I1 | fatta (2026-11-10) |
| I1 | Ponte con la pagina e modo «mostra» (L3, L4, L6, L7): ogni `EntityTable` si dichiara e accetta `tabella.cerca`, `tabella.filtra`, `tabella.ordina`, `tabella.azzera`; il gateway fa valere il catalogo, passa la pagina come dato, aspetta l'esito; la tabella mostra che cosa è cambiato e torna indietro | gateway: `src/comandi-vista.ts`, `mcp-tools.ts`, `mcp-tool-names.ts`, `classi-azioni.ts`, `write-gate.ts`, `sdk-agent.ts`, `server.ts` (`POST /agent/esiti`), `test/comandi-vista.test.ts`; web: `lib/agente/vista-tabella.ts` e la sua prova, `lib/agente/use-tabella-agente.ts`, `lib/agente/contesto.tsx`, `lib/use-agent-stream.ts`, `components/pannello-agente.tsx`, `components/data-table-panel.tsx`, `locales/*/common.json` | Claude | prove verdi (`pnpm exec vitest run` nel gateway e nel web); prova del cancello vista rossa prima del ramo `VIEW_COMMAND`; dimostrazione dal vivo dopo il rilascio: «mostrami solo le unità di Milano» su una pagina con tabella filtra la vista, e la risposta dice quante righe | codice e prove fatti (2026-11-10); resta la dimostrazione dal vivo |
| I2 | Simbolo e finestra (L1, L2, L9): simbolo fisso con il puntino del lavoro in corso, finestra modale ridimensionabile con colonna delle attività a sinistra, conversazione al centro, a destra le pagine toccate e le proposte; il simbolo in ogni pagina autenticata | `ux-design-shared` (componente comune, versione nuova di `@heuresys/ui`), `apps/web/src/components/pannello-agente.tsx`, `lib/agente/idoneita.ts` | Claude; Enzo pubblica la versione su npm | confronto affiancato su computer, tablet e telefono; cambiando pagina la conversazione resta; chiusa la finestra il lavoro prosegue | da fare |
| I3 | Letture di ogni pagina (L5): controllo che ogni voce della barra laterale abbia una lettura o un'eccezione scritta; letture mancanti a gruppi, sulle rotte GET esistenti | `docs/kb/tools/check_letture_agente.py` e `letture_agente_eccezioni.json` (nuovi, nel cancello come `letture-agente`), `apps/agent-gateway/src/mcp-tools.ts`, `mcp-tool-names.ts`, `classi-azioni.ts` | Claude | il controllo visto rosso sul menu di oggi (6 voci scoperte su 78), poi verde (76 lette, 2 eccezioni); dal vivo: una domanda su una pagina che prima non si leggeva ha il numero vero | codice e controllo fatti (2026-11-11); resta la prova dal vivo |
| I4 | Il testo non dichiara mai fatto ciò che non è avvenuto (L6): casi nella prova avversaria con esito `rifiutata` e `non_confermata`; il gateway corregge un testo finale che li contraddice | `apps/agent-gateway/src/comandi-vista.ts` (`notaSugliEsiti`, `PonteVista.esiti`), `src/giro.ts` (`nota`), `src/server.ts`, `test/prova-avversaria.test.ts`; web: `lib/use-agent-stream.ts` (`parseNota`, evento `nota`) e la sua prova | Claude | casi rossi senza la correzione, verdi con; dal vivo dopo il rilascio: un filtro su una colonna che non c'è porta la nota sotto la risposta | codice e prove fatti (2026-11-10, nella PR #216); resta la dimostrazione dal vivo |
| I5 | Modo «lavora sull'oggetto» (L4, L9): operazioni sull'organigramma o sul modello del tenant, ognuna un passo annullabile, regole del dominio nel programma; il prodotto nell'area di destra | da definire nella simulazione del blocco | Claude | un mandato costruisce, il successivo continua, un annulla torna a prima | da fare |
| I6 | Prestazioni (L8): misura di tempo al primo comando, al primo testo e totale, a caldo e a freddo; processo caldo all'apertura; scelta del modello per compito | `apps/agent-gateway/scripts/` (misura), `limiti.ts` | Claude; Enzo per il cambio di modello al rilascio | misure scritte qui | strumento fatto; misure dal vivo in corso |
| I7 | La stessa finestra nella console del datastore (L11) | repo `heuresys-datastore`, `apps/console` | sessione del datastore | secondo le regole del datastore (`pnpm run fatto:veloce`, vocabolario dei verbi) | da fare |

## Simulazione di I1, scritta prima del codice

- Deve essere vero: il gateway con la conversazione nel database (T6, PR #204 e #212 unite) e il pannello montato nel layout autenticato.
- Lo strumento: uno strumento nuovo nel server MCP `heuresys` (`hrx_vista_comanda`), così l'allowlist e la classe passano dagli stessi elenchi; il cancello lo lascia passare con una ragione propria (`VIEW_COMMAND`), perché non legge dati dall'API e non deve far scattare la domanda sulle letture di molte persone.
- Il comando viaggia sullo stesso flusso SSE (`event: page_command`) e l'esito torna con una rotta nuova del gateway, come l'approvazione: solo la persona per cui l'agente lavora, con i cookie e il token CSRF. Nessun dato cambia, quindi l'API non è toccata.
- Ciò che la pagina dichiara arriva dal browser: si limita (percorso, titolo accorciato, vista sotto 4.000 caratteri, comandi solo del catalogo) e va al modello in un blocco marcato come dato.
- Tocca `data-table-panel.tsx`, che usano anche il thread «Rendere intelligenti tabelle e dati di tutte le pagine» e la barra laterale: la modifica è una chiamata in testa al componente e una riga sopra la tabella, e lo si dice a quei thread.
- Il giro del gateway cambia in produzione solo con un rilascio, che decide Enzo.

## Simulazione di I4, scritta prima del codice

- Deve essere vero: I1, cioè gli esiti dei comandi raccolti dal ponte del giro.
- Lo strumento: il gateway non interpreta il testo del modello (sarebbe una regola fragile su una lingua libera); quando l'ultimo esito di un comando non è `ok`, aggiunge lui una nota con le parole dell'esito, come evento `nota` verso la finestra e come `TESTO` con `origine: piattaforma` nel registro, e la mette in coda al risultato salvato. Nessun tipo di evento nuovo nel database (il CHECK della migrazione 000483 resta com'è).
- Il caso peggiore nella prova: un modello che scrive «fatto» qualunque cosa abbia risposto la pagina.

## Simulazione di I3, scritta prima del codice

- Deve essere vero: la barra laterale per funzione su main (#213, mappa della migrazione 000484), che è l'elenco delle voci.
- Lo strumento: un controllo statico, senza database, che per ogni voce trova la pagina (anche con segmenti dinamici), segue i file che importa fino a tre livelli, raccoglie le chiamate `/v1/…` e le confronta segmento per segmento con le GET che l'assistente sa fare (strumenti dedicati del gateway e operazioni GET del catalogo generico). Le chiamate di servizio (sessione, permessi, menu, origine dei dati di EntityTable) non contano.
- Le letture mancanti si aggiungono come strumenti dedicati di sola lettura, classe A, con i permessi della persona (ADR-0040 §5: l'agente legge ciò che legge la persona); dove l'assistente non deve leggere, un'eccezione con la ragione.
- Esito della prima corsa, prima del codice: 6 voci scoperte. Org Director e VRIO (capacità), consolidamento, «Le mie corrispondenze» (matching): letture nuove. Segnalazioni (whistleblowing, riservate per legge) e atti di mandato (/admin/roles): eccezioni.

## Simulazione di I6, scritta prima del codice

- Deve essere vero: un gateway acceso con una persona ammessa e una sua sessione (banco di verifica o copia); il modello si sceglie già per nome con `AGENT_GATEWAY_MODEL` (`limiti.ts`), quindi la scelta per compito resta una decisione di Enzo al rilascio, con le misure davanti.
- Lo strumento: `scripts/misura-tempi.ts` manda la stessa richiesta N volte in conversazioni nuove e legge dallo stream le tappe (`src/misura-tempi.ts`, funzione pura con le sue prove): primo segno di vita, primo strumento, primo comando della vista, prima frase, fine. Il primo giro dopo l'avvio è a freddo, gli altri a caldo, con la mediana. Ai comandi della vista risponde «rifiutata» con la ragione vera, perché non c'è una pagina.
- Non scrive niente: le letture le fa l'assistente con i permessi della persona.

## Registro

- 2026-11-10: letto mod-platform `e12ed17` in sola lettura (clone nella sessione cloud, non sulla VM). Scritte le logiche L1-L11 e questo piano. Blocco I1 nel codice, prove del gateway (21 file, 313 prove) e del web (11 file, 74 prove) verdi, typecheck e lint dei file toccati verdi.
- 2026-11-10: blocco I4 nel codice. Le due prove nuove della prova avversaria (rifiutata, non confermata) viste rosse con la nota spenta e verdi con la nota; gateway 22 file, 317 prove verdi (2 saltate, come prima); web 11 file, 75 prove verdi; typecheck del gateway verde.
- 2026-11-11: blocco I3. `check_letture_agente.py` rosso sul menu di main `cac0d56` (6 scoperte su 78), poi verde con otto letture nuove nel gateway (capacità, VRIO, maturità, corrispondenze della persona, consolidazioni) e due eccezioni scritte; autoprova verde; nel cancello `verify_gate.py` come `letture-agente`.
