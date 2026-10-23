# Consolidamento — piano degli incrementi

Fase B, 2026-10-23. Una riga per incremento; il dettaglio sotto la tabella. «Chi» dice chi lo completa: **S** una sessione (codice, prove, documenti, nessuna scrittura in produzione), **E** serve Enzo (rilascio in produzione, cancellazione, scelta di prodotto). Nessun incremento di questo piano scrive sulla produzione: le migrazioni si provano su una copia usa-e-getta e si rilasciano con `refs/heads/prod`, che resta un gesto di Enzo.

Che cosa **non si chiude** in questo programma, detto all'inizio: S5 (commutazione di RTL Bank sul perimetro) e S6 (ritiro dei cataloghi duplicati in advanced) restano gesti di Enzo dopo la parità; la v0.4 del contratto (D-72: cruscotti, porte, famiglia, stato, peso economico) è un ciclo del datastore a sé; il passo 3 della partecipazione (#270) resta all'onda 2.

| id | cosa | repo | dipende da | chi | stato |
|---|---|---|---|---|---|
| C0 | Correzioni documentali: R-28 (disegno onda 2), R-40 (registro #271), R-41 (documento 31), R-42 (vista rapida del datastore) | entrambi | — | S | da fare |
| C1 | Contratto del fascicolo v0.3.1: `meta.pacchetto` (versione = `bench_package_version_no`, impronta canonica unica con caso di prova condiviso, edizioni dei cataloghi, correlazione); dichiarata non leggibile da un convalidatore v0.3; documento unico del contratto; bozza di ADR-0047 PROPOSTA | datastore (schema, composizione), advanced (copia del contratto, convalida) | — | S | da fare |
| C2 | Verbo di consegna nel datastore: `POST /v1/fascicoli/:prototipo/consegna` scrive pacchetto + manifesto in `_pubblicazioni/consegne/` (codice del prototipo validato con la regex del banco prima di diventare un percorso; regola di conservazione scritta); riga nel vocabolario dei verbi | datastore | C1 | S | da fare |
| C3a | Le migrazioni che toccano le versioni smettono di dipendere dallo stato: la post-condizione di 000400 non conta più tutte le PUBLISHED del database (R-50); 000398/000400/000401 risolvono la versione per variante e numero, non per stato (R-51). Prima la prova rossa: su una copia usa-e-getta caricare un pacchetto e riapplicare la catena (atteso rosso su 000400) | advanced | — | S (emendamento e prova su copia); E (rilascio) | da fare, **precede ogni caricamento in produzione** |
| C3 | Caricatore di ricevimento: verifica del manifesto, idempotenza per impronta, versione nuova su variante esistente, niente indicatori di piattaforma senza tenant (e decisione sulla sorte di `sys_process_kpi_templates`), registro d'esito, prova nella CI su un database usa-e-getta | advanced | C1, C3a | S (codice e prova); E (primo caricamento in produzione) | da fare |
| C4 | Versione fissata sull'attivazione: colonna additiva `blueprint_activation_variant_version_id` (riempita con la PUBLISHED più alta per le attivazioni esistenti); profilo e perimetro si risolvono su quella versione, con ripiego sulla regola di oggi dove è nulla; passaggio di un tenant a una versione nuova come gesto per tenant; la costruzione rifiuta DRAFT. Più PUBLISHED possono coesistere (= adottabili); RETIRED = non più adottabile | advanced | C3a, C5 | S; E (rilascio della migrazione) | da fare |
| C5 | Una sola strada di materializzazione: rotta diretta, approvazione e provisioning passano dallo stesso servizio, che scrive `sys_generated_record_origins` | advanced | — | S | da fare |
| C6 | Bozza di ADR-0048 (personalizzazioni all'arrivo di una versione) e calcolo dell'impatto in `diff.ts` | advanced | C4, C5 | S (bozza e codice); E (approvazione dell'ADR) | da fare |
| C7 | ADR-0046 approvato nella forma «versione fissata dall'attivazione», poi O2-07/O2-08 come già disegnati (risolutore `perimetro.ts`, cancello esteso, ricerche, agente, liste); dentro: le sei letture di catalogo senza permesso (R-30) | advanced | C4, approvazione di ADR-0046 | S; E (approvazione) | da fare (le sessioni O2-07/O2-08 esistono già) |
| C8 | Flusso inverso: proiezione del tenant con allow-list di colonne (niente peso economico, niente conteggi sotto soglia) prodotta da uno script; il datastore smette di leggere il database di advanced; **distruzione** delle copie intere e del dump di advanced sul PC, dopo la ricerca di altre copie (R-20) | entrambi | C2 (stesso formato) | S (codice); E (distruzione, eventuale rotazione delle credenziali) | da fare |
| C9 | O2-06: la materializzazione porta al tenant le sezioni v0.3 che hanno un consumatore (R-09); le altre restano nel modello dichiarate tali | advanced | C3, C4, O2-03, O2-04, O2-05 | S | mandato O2-06 già scritto |
| C10 | Parità S3 per famiglia (R-21…R-24, R-26): tabella di traduzione degli schemi, versione ESCO fissata, corrispondenza dei KPI, poi arricchimento del datastore (CP2021, ruoli, formazione, porte, tassonomia delle competenze, traduzioni LLM/MANUAL, metodi KPI); script di parità che si vede rosso prima e verde dopo | datastore (arricchimento), advanced (script di confronto) | C1 | S; E (fonte CP2021 se non basta quella di advanced) | da fare |
| C11 | Voci proprie del tenant dove ADR-0043 regola 4 non regge (R-25): togliere `UNIQUE(code)` globale da moduli e percorsi formativi **emendando la 000237 alla fonte** (ADR-0035) più una migrazione nuova che toglie l'esemplare; dichiarare quali famiglie ammettono voci proprie | advanced | — | S; E (rilascio) | da fare |
| C12 | Interfacce: `skill-taxonomy/` e `seed-acquisition/` verso la console del datastore; `tenant-blueprints/` riprogettata come «fascicolo ricevuto» (carica, differenze, adotta, costruisci); separare `tenant-import-runs` dalle tabelle dei semi (R-32); unione del ramo `interfaccia-unica` (R-35) | entrambi | C3, C4, C7, ADR-0047 | S; E (unione del ramo, uscita delle pagine) | da fare |
| C13 | Igiene delle pagine e delle rotte (R-33, R-34): collegare o accorpare le tre sotto-pagine orfane, togliere i conteggi fissi da `/investors`, legare ogni rotta senza consumatore a un attore o dichiararla API-only | advanced | — | S | da fare |
| S5 | Commutazione di RTL Bank sul perimetro | advanced | C7, C10 verde | E | dopo |
| S6 | Ritiro dei cataloghi duplicati (archivio, impronta, prova di ripristino) | advanced | S5 | E | dopo |

## Ordine e parallelismo

Prima linea, indipendenti fra loro: **C0, C1, C3a, C5, C11, C13**. Poi **C2 e C3** (dopo C1 e C3a), **C4** (dopo C3a e C5), **C6, C7** (dopo C4), **C9** (dopo C4 e O2-03/04/05), **C8** (dopo C2), **C10** può partire dopo C1 in parallelo a tutto il resto ed è il lavoro più lungo. Le migrazioni si serializzano: una sola sessione per volta tocca `db/migrations` di ciascun repository, e i numeri delle migrazioni nuove si prenotano in `00_INDICE.md` (sezione «Migrazioni prenotate») insieme a quelli dell'onda 2, per non avere due 000459.

## Dettaglio degli incrementi

Per ogni incremento: oggetti, strategia sui dati, compatibilità, prove (ognuna vista rossa prima), criterio di completamento, recupero.

### C1 — Contratto v0.3.1
- **Oggetti**: datastore `src/contratto/v0.3/` → nuova cartella `v0.3.1/` (schema, `VERSIONE.json` con impronte), composizione del pacchetto; advanced `db/scripts/pacchetto/contratto/v0.3.1/`, `convalida-pacchetto.mjs`.
- **Dati**: nessuno; il campo è nuovo e facoltativo nello schema.
- **Compatibilità**: un pacchetto v0.3 resta valido; un pacchetto v0.3.1 senza `meta.pacchetto` è valido per lo schema ma rifiutato dalla consegna.
- **Prove**: impronta canonica stabile (stesso pacchetto con chiavi in ordine diverso → stessa impronta); impronta che cambia se cambia un valore; v0.3 accettato da entrambi; mutazioni rosse.
- **Fatto quando**: le prove del datastore (`pnpm run fatto`) e la convalida di advanced passano; ADR-0047 scritto.
- **Recupero**: la cartella v0.3 resta; si torna indietro togliendo la v0.3.1 dalla composizione.

### C2 — Consegna
- **Oggetti**: datastore `src/fascicoli/consegna.ts`, rotta in `apps/api/src/servizio.ts`, riga nel documento 27, registro in `datastore_call` (correlazione).
- **Dati**: scrive solo file in `_pubblicazioni/consegne/`; non cancella mai una consegna (una seconda consegna della stessa versione è un no-op con la stessa impronta).
- **Prove**: consegna di un pacchetto valido (file + manifesto, impronta ricalcolata uguale); rifiuto di un pacchetto non valido; seconda consegna idempotente; 404 su prototipo inesistente.
- **Fatto quando**: rotta provata sul servizio vero (non solo in prova) con un pacchetto depositato.

### C3 — Ricevimento
- **Oggetti**: `db/scripts/pacchetto/accogli-pacchetto.mjs` (o un modulo nuovo che lo avvolge), tabella d'esito nuova `sys.sys_blueprint_content_receipts` (chi, quando, impronta, versione, correlazione, esito), vincolo d'unicità su `(prototype_ref, package_version)` in `sys_blueprint_content_packages`, workflow di CI.
- **Dati**: solo inserimenti; il caricamento in produzione è possibile ma **dietro una guardia a due condizioni** (opzione esplicita e manifesto verificato) e con backup prima; gli indicatori del pacchetto vanno in `sys_blueprint_content_kpis` (già lì) e non più in `sys_kpi_definitions` con tenant nullo.
- **Compatibilità**: v0.2 e v0.3 restano accettati sulle copie; in produzione solo pacchetti con manifesto.
- **Prove**: primo caricamento, secondo identico (esito «già presente», zero righe nuove), versione 2 dello stesso prototipo su variante esistente, manifesto alterato → rifiuto senza scritture, nessuna riga nuova in `sys_kpi_definitions` con tenant nullo, rilettura per percorso uguale; tutte in CI su un database usa-e-getta.
- **Fatto quando**: verde in CI e su una copia del database di produzione sulla VM; primo caricamento reale = gesto di Enzo (o delegato) con backup verificato.
- **Recupero**: `scarica` per versione (solo DRAFT mai pubblicata); una versione pubblicata si ritira (RETIRED), non si cancella.

### C3a — Le migrazioni non dipendono dallo stato delle versioni
- **Oggetti**: `db/migrations/000400_*.sql` (post-condizione alle righe 238-247), `000398`, `000401` (scritture risolte per stato).
- **Strategia (ADR-0035)**: si emenda il file che fa il lavoro; la post-condizione diventa responsabilità di ciò che il file crea (le versioni della banca e di HEURESYS per variante e numero), non un conteggio globale.
- **Prove**: rosso prima su copia usa-e-getta (caricamento di un pacchetto, poi catena riapplicata: 000400 fallisce); verde dopo; la catena riapplicata due volte non cambia niente (idempotenza).
- **Recupero**: revert del commit; nessun dato toccato.

### C4 — La versione si fissa sull'attivazione
- **Oggetti**: migrazione additiva `blueprint_activation_variant_version_id` (FK verso `sys_blueprint_variant_versions`, con il vincolo che la versione appartenga alla variante dell'attivazione), `profilo.ts`, poi `perimetro.ts` (C7), rotta per passare un tenant a un'altra versione (dopo l'anteprima), `blueprint-build-source.ts` (rifiuto di DRAFT).
- **Dati**: le attivazioni esistenti (banca e HEURESYS) ricevono la PUBLISHED più alta della loro variante, misurata su una copia prima; giornale `staging.*_undo` delle righe toccate.
- **Prove**: rosso prima (oggi una voce di una versione superata resta visibile; oggi una DRAFT si costruisce; oggi pubblicare una versione cambia tutti i tenant insieme), verde dopo; due tenant sulla stessa variante con versioni diverse vedono profili diversi.
- **Recupero**: inversa fuori catena (la colonna è additiva e nullable); il ripiego sulla regola di oggi dove la colonna è nulla.

### C5 — Una strada di materializzazione
- **Oggetti**: `tenant-materialization/service.ts`, `approvals/effects/tenant-blueprint-application.ts`, `tenants/provisioning.ts`.
- **Prove**: dopo ogni strada `sys_generated_record_origins` ha una riga per record creato; rosso prima sulla rotta diretta e sul provisioning.
- **Recupero**: commit singolo, si torna indietro con un revert.

### C7 — Perimetro (ADR-0046 corretto)
- Le sessioni O2-07 e O2-08 sono già disegnate in `.programmi/onda2/`. Qui si aggiunge solo: la risoluzione sulla versione in vigore (C4), e le sei rotte di lettura senza permesso (R-30) che passano dal cancello.

### C8 — Flusso inverso senza dati personali
- **Oggetti**: advanced, uno script di piattaforma (non una rotta) che esporta la proiezione del tenant con una allow-list di colonne e il manifesto; datastore, lettore della proiezione al posto di `rtl_lettura.ts`.
- **Prove**: la proiezione contiene solo colonne della allow-list e nessuna della classe «dato personale» né il peso economico (guardia doppia: allow-list e `sys_classificazione_direzione_dato`); nessun conteggio sotto soglia; il confronto dei vuoti del datastore dà lo stesso esito sulla proiezione e sulla lettura diretta (stessa data).
- **Fatto quando**: il datastore non ha più codice che apre una connessione al database di advanced (controllo statico nel rito del datastore). La distruzione delle copie intere (credenziali e IBAN dentro) è un gesto di Enzo con verbale, dopo aver cercato le altre copie (backup notturno del PC, Drive); se una copia è uscita dalla VM o dal PC, si ruotano le credenziali.

### C10 — Parità
- Il lavoro più lungo. Primo passo misurabile stanotte: la tabella di traduzione degli schemi e lo script di confronto, che dà l'elenco dei mancanti per famiglia. L'arricchimento del datastore famiglia per famiglia viene dopo, nell'ordine di rischio di S08 (ruoli), S02 (CP2021), S09 (formazione), S04 (porte), S01 (tassonomia), S10 (traduzioni), S05 (KPI).

## Criteri di accettazione del programma

1. Un pacchetto prodotto dal datastore arriva in advanced con la sua identità e la sua impronta, si carica due volte senza effetti la seconda, un tenant di prova lo adotta fissando la versione, si costruisce, il registro dice da quale corsa del datastore viene, e la catena delle migrazioni riapplicata dopo il caricamento resta verde (C1-C5, C3a).
2. Una versione nuova dello stesso prototipo arriva su un tenant che ha personalizzato il modello e la personalizzazione resta, con l'impatto mostrato prima (C6).
3. Due tenant di prova con perimetri diversi non vedono l'uno le voci dell'altro né il catalogo intero; un utente del tenant «Heuresys System» non entra nelle righe dei tenant (C7, già prove di ADR-0046).
4. Il datastore non apre connessioni al database di advanced e non conserva dati personali dei tenant (C8).
5. Lo script di parità è verde per ogni famiglia prima di S5 (C10).
6. Ogni verifica è registrata in `04_VERIFICHE.md` come PASS, FAIL o NON ESEGUITO, con comando, ambiente e data; i problemi preesistenti stanno separati dalle regressioni.
