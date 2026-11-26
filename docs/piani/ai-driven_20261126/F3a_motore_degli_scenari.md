# F3a — Il motore degli scenari: schema e struttura ombra (2026-11-26)

Voce F3a dell'onda 1 del piano [PIANO_heuresys-ai-driven_20261126.md](../PIANO_heuresys-ai-driven_20261126.md). La decisione è già presa e accettata da Enzo: [ADR-0063](../../architecture/adr/0063_heuresys_ai_driven_l_organizzazione_ghost.md) D5 (scenari su una struttura ombra, numeri calcolati dal codice, almeno due opzioni) e D6 (equità dichiarata, fonti cliccabili). Questa nota non aggiunge decisioni: descrive come lo schema le attua, così le voci F3b-F3e partono da qui.

Metro ADR-0063: asse 6, 7; criterio 4

In parole: la voce serve gli assi 6 e 7 (decisioni sofisticate, organizzazione e risorse) e il criterio 4 («le decisioni si prendono su scenari»); rispetta D3 e D4 perché lo scenario non scrive sulle tabelle vere, D6 perché equità e fonti sono pretese dal database.

## 1. Che cosa c'è

Migrazione [`db/migrations/000515_il_motore_degli_scenari_e_la_struttura_ombra.sql`](../../../db/migrations/000515_il_motore_degli_scenari_e_la_struttura_ombra.sql), contratto condiviso [`packages/shared/src/schemas/scenari.ts`](../../../packages/shared/src/schemas/scenari.ts), prova [`apps/api/test/scenari-schema.integration.test.ts`](../../../apps/api/test/scenari-schema.integration.test.ts).

| tabella | che cosa tiene |
|---|---|
| `sys.sys_scenarios` | la domanda, la famiglia di calcolo (le cinque di D5), il dominio (D1-D7 del piano), la voce del catalogo S-T1…S-X2, la persona per cui si lavora, l'origine (persona, assistente, segnalatore) e, se non è la persona, l'agente dell'anagrafe che l'ha aperto |
| `sys.sys_scenario_versions` | ogni ricalcolo è una versione: BOZZA, CALCOLATA, ARCHIVIATA; data e impronta SHA-256 della fotografia da cui parte |
| `sys.sys_scenario_options` | le opzioni da confrontare, al più una «nessuna azione»; se toccano persone; se sono raccomandate |
| `sys.sys_scenario_levers` | le leve di un'opzione: elenco chiuso di 22 leve (uscita, spostamento, fusione di unità, budget della formazione, pesi dei KPI, attività tolte o automatizzate, vincoli di costo, tempo e ampiezza di controllo), con bersaglio e parametri |
| `sys.sys_scenario_assumptions` | le ipotesi della versione o di un'opzione: dato, stima, vincolo, politica; una stima porta sempre la sua banda |
| `sys.sys_scenario_results` | i numeri: valore, unità, banda di incertezza, numero di estrazioni, orizzonte in mesi e il calcolatore che li ha prodotti (`calcolatore@x.y.z`) |
| `sys.sys_scenario_sources` | le fonti cliccabili di ipotesi e risultati: rotta o pagina (`/…`), documento (`doc:`), ADR (`adr:NNNN`), voce del datastore (`datastore:`) |
| `sys.sys_scenario_equity_checks` | la dichiarazione di equità di un'opzione: tratto, gruppi confrontati, rapporto, soglia, esito, metodo |
| `sys.sys_scenario_shadow_units`, `_positions`, `_assignments` | la struttura ombra: senza opzione è la fotografia di partenza, con l'opzione è lo stato dopo le leve |

La funzione `sys.sys_scenario_fotografa(version_id)` fa la fotografia: legge le unità, le posizioni e le assegnazioni attive oggi del tenant della versione, le copia nelle tre tabelle ombra con i riferimenti ricostruiti fra righe ombra (padre dell'unità, unità e riporto della posizione, posizione dell'assegnazione) e scrive l'impronta nella versione. Non scrive nient'altro.

## 2. Le guardie nel database

Le regole di D5 e D6 non stanno solo nel codice: le fa rispettare il database, così vale per l'API, per l'assistente e per qualunque script.

- **G1, una versione calcolata è congelata.** Opzioni, leve, ipotesi, risultati, fonti, equità e ombra di una versione non in BOZZA non si toccano; la versione stessa passa solo ad ARCHIVIATA. Un numero si rifà con una versione nuova, non si corregge. Due eccezioni volute: la cancellazione a cascata dello scenario, e il riferimento che si perde quando la riga vera sparisce (una persona, un'unità, una posizione tolte): l'ombra resta com'era e le tabelle vere non restano mai bloccate da uno scenario.
- **G2, il calcolo pretende il necessario.** Il passaggio a CALCOLATA rifiuta una versione senza fotografia, con meno di due opzioni, con un'opzione senza risultati, con un risultato senza fonte, con un'opzione che tocca persone senza controllo di equità.
- **G3, l'equità decide la raccomandazione.** Un'opzione che tocca persone diventa raccomandata solo se i suoi controlli di equità sono tutti SUPERATI; un controllo non superato aggiunto dopo è rifiutato finché la raccomandazione non si toglie. Sotto la soglia la proposta resta visibile, con la sua dichiarazione, ma non come raccomandazione (D6).
- **G4, il confine fra tenant.** Ogni figlia porta il tenant e lo lega alla versione con una chiave esterna composta (versione, tenant); le righe ombra legate a un'opzione la verificano della stessa versione (I5: chiavi esterne e coerenza, mai RLS).

Il numero senza calcolatore non entra: `computed_by` deve avere la forma `calcolatore@x.y.z`, che è il nome di un modulo del codice (F3b), non del modello.

## 3. Perché una fotografia e non le tabelle vere

Calcolare sulle tabelle vere vorrebbe dire scriverle e poi tornare indietro, che è esattamente ciò che ADR-0063 D3 esclude. La fotografia dà tre cose in più: lo scenario resta riproducibile anche quando il tenant cambia (l'impronta dice se due versioni partono dallo stesso stato); il prima e il dopo di un'opzione si mostrano con lo stesso schema, per esempio nell'organigramma della pagina degli scenari (F3e); il calcolatore lavora su righe sue, senza contendere i blocchi con chi lavora sui dati veri.

Lo scenario diventa lavoro vero solo con un'applet confermata dalla persona (ADR-0060, E3): lo schema di F3a non ha nessun percorso che scriva sulle tabelle di business.

## 4. Che cosa resta alle voci dopo

- **F3b** scrive i calcolatori delle cinque famiglie: leggono la fotografia, applicano le leve in memoria, scrivono l'ombra dell'opzione, i risultati e le fonti, poi portano la versione a CALCOLATA. Una leva nuova emenda insieme il CHECK della 000515 e l'elenco in `scenari.ts` (ADR-0035): la prova li confronta e diventa rossa se divergono. Se un calcolatore ha bisogno di più della struttura (competenze, successori, KPI), l'ombra si allarga con tabelle nuove della stessa forma, nella migrazione di F3b.
- **F3c** dà le probabilità stimate sulla storia di RTL, che entrano come ipotesi di tipo STIMA con la banda e la fonte `STORIA`.
- **F3d** e **F3e**: l'agente e la pagina; le rotte `/v1/scenari` nascono con la classe dell'azione (F1b) e lo scenario aperto dall'assistente porta `scenario_origin = ASSISTENTE` e il riferimento dell'agente.
- **F6b** scrive il calcolo dell'equità che riempie `sys_scenario_equity_checks`.

## 5. Le prove

Fatte nel thread il 2026-11-26 su un PostgreSQL 16.15 locale con la catena fino alla 000047 e un tenant di prova: la 000515 applicata due volte con lo schema identico (`pg_dump -s` prima e dopo, differenza vuota a parte il gettone casuale di `\restrict`); la fotografia di 2 unità, 3 posizioni e 3 assegnazioni con le impronte delle tabelle vere uguali prima e dopo; ognuna delle guardie vista rifiutare e poi accettare; una persona vera tolta mentre una versione calcolata la nomina, senza blocco. La prova di integrazione è stata vista rossa aggiungendo una leva finta allo schema condiviso, e verde senza. La prova sulla copia di `heuresys_ci` con i dati di RTL la fa la CI della PR: la catena intera applicata alla copia e la prova di integrazione sul tenant RTL. La prova generale a due passate sul gemello (`db/scripts/ci-rehearsal.sh`) non si è potuta lanciare da questo thread, che gira nel cloud senza accesso al linux-pc: la seconda passata di 000429 e 000062 la vede il primo rilascio, come per la 000503, e la 000515 da sola è stata provata a due passate in locale.
