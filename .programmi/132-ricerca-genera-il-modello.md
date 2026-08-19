# 132 — La ricerca genera il modello, e l'archetipo scritto a mano sparisce

> **item**: #132 · **priorità**: P1 · **stima**: ~8 sessioni
> **stato**: IN CORSO
> **fonti**: decisione E29 di Enzo (2026-08-17) · epica P2a `D:\heuresys-design-lab\2026-08-05--epic-tenant-builder-p2a-ricerca.md` · piano approvato `~/.claude/plans/jaunty-percolating-storm.md`

## Decisioni vincolanti (non si ri-chiedono)

- **E29 (2026-08-17)** — *«Il fascicolo non può avere un archetipo aprioristico, altrimenti genera
  sempre una banca come RTL. I dati hardcoded del file di codice scritto a mano devono scomparire —
  non deve rimanere traccia — e l'archetipo deve essere generato dalla ricerca.»*
- **Profondità: TUTTO** — unità, posizioni, competenze, indicatori, processi. Non solo
  `business_processes` come prevedeva l'epica. È coerente con **E18** («coprire tutte le relazioni
  fra i dati»).
- **Prima prova su un'azienda NUOVA di settore diverso dal bancario**, poi su RTL Bank. Le due
  domande sono diverse: la prima chiede *«il meccanismo ha memoria del bancario?»*, la seconda
  *«quanto è buono il risultato?»*. Nessuna delle due risponde all'altra.
- **E10** — la capacità di ricerca è della piattaforma, non di un cliente: un dominio ricercabile si
  dichiara **in codice**, non nel database.
- **E27** (dove si sperimenta) ed **E28** (archivia oppure disfa) valgono qui come per `#198`.

## Le tre misure di partenza (2026-08-17 — si ri-misurano prima di usarle)

| Misura | Valore | Perché conta |
|---|---|---|
| righe create dall'archetipo in produzione | `0` unità · `0` posizioni · `0` competenze `RBR-%` · `0` utenti `SYN_%` | **il ritiro non richiede bonifica di dati** |
| chi nomina l'archetipo | **12 file** — 5 di codice, 7 di test | la superficie del ritiro |
| contenuto di un modello nel database | **non esiste** per posizioni/competenze/indicatori · `sys_organization_unit_templates` ha **225 righe orfane** (25 codici × 9 copie) | è il lavoro vero, e nessun piano lo nominava |

## ⚠ Da F3 a F6 nessuna azienda è costruibile

Dichiarato in anticipo. Non è un danno: oggi non se ne costruisce nessuna comunque, e ciò che si
toglie è una capacità **mai usata** che produceva il risultato sbagliato.

## I parametri che una ricerca mirata pretende (Enzo, 2026-08-17 — e la misura che lo corregge)

**La posizione di Enzo**: *«solo dopo aver stabilito il codice ATECO e definito il numero di addetti
sarà possibile fare le ricerche mirate»*. **Giusta nella sostanza, incompleta nel conto** — misurato
sul fascicolo reale e su `IDENTITA_OBBLIGATORIA` (`tenant-blueprints/service.ts:57-62`):

| Parametro | Oggi | Serve alla ricerca? |
|---|---|---|
| settore ATECO (`industryClassId`) | **obbligatorio** prima della firma | sì — è il primo |
| fascia dimensionale (`sizeBandId`) | **obbligatorio** | insufficiente da solo, vedi sotto |
| paese (`countryCode`) | **obbligatorio** · RTL = `IT` | **sì**: cambia organi di controllo, contratto, obblighi |
| intensità di vigilanza (`regulatoryIntensity`) | **obbligatorio** · RTL = `HIGH` | **sì**: decide se esiste una direzione Risk & Compliance |
| modello operativo (`operatingModelId`) | **opzionale** → **DA RENDERE OBBLIGATORIO** (Enzo, 2026-08-17) · catalogo di 6 (RETAIL, WHOLESALE, MIXED, B2B_SERVICES, MANUFACTURING, PUBLIC_SECTOR) | **sì, e pesa sulla FORMA più della dimensione**: RETAIL e WHOLESALE a parità di settore e addetti danno strutture opposte — con o senza filiali |
| numero di addetti (`employeeCount`) | **opzionale** → **DA RENDERE OBBLIGATORIO** · RTL = `158` | **sì**, ed è il punto che segue |

### I due modi di dire la dimensione hanno DUE RUOLI, non uno (Enzo, 2026-08-17)

Non è ridondanza da eliminare: è una distinzione da rispettare.

- **La fascia** (`XS 1-9 · S 10-49 · M 50-249 · L 250-999 · XL 1000+`) serve al **pricing della
  piattaforma** e **canalizza la ricerca**: si cerca «una banca di fascia M», non «una banca di 158
  dipendenti». Cinque fasce sono cinque corsie, ed è ciò che rende una ricerca ripetibile e
  confrontabile fra clienti diversi.
- **Il numero** descrive l'**azienda vera**, ed è *«quello su cui lavorano le tabelle gestionali»*.
  Riscontro misurato: il fascicolo di RTL dichiara **158** addetti e RTL ha **158 posizioni attive**
  — il numero non è un'etichetta, è il dato che il sistema usa davvero.

**⚠ IL BUCO, trovato misurando questa distinzione**: `sys_tenant_blueprint_version_employee_count_check`
verifica **soltanto** che il numero sia `>= 0`. **Nessun vincolo lega la fascia al numero.** Oggi si
può dichiarare fascia `XS` (1-9) e `5000` dipendenti, e nulla protesta — la ricerca cercherebbe
un'azienda minuscola mentre le tabelle gestionali ne descrivono una grande. Con la ricerca questo
smette di essere teorico. Il vincolo va aggiunto in **F0**: il numero deve cadere dentro la fascia
dichiarata (`min <= n <= max`, con `max` nullo per `XL`).

**L'incoerenza da sciogliere, ed è nel codice non nei documenti.** La dimensione è dichiarata **due
volte**: la fascia (obbligatoria) e il numero (opzionale). Il commento sopra `IDENTITA_OBBLIGATORIA`
dichiara che i ricavi e il numero di dipendenti *«descrivono l'azienda ma non entrano in nessuna
derivazione, e pretenderli bloccherebbe la firma per un dato che non cambia il risultato»*.

**Con la ricerca quel dato inizia a cambiare il risultato**, e quella frase diventa falsa. Le fasce
misurate: `XS 1-9 · S 10-49 · M 50-249 · L 250-999 · XL 1000+`. La fascia `M` è larga **cinque
volte**: con 50 addetti si fa un'organizzazione piatta, con 249 tre livelli e delle filiali. RTL è
`158`, non «M».

**Conseguenza per il piano**: prima di **avviare una ricerca** (non prima della firma — sono due
momenti diversi) servono **cinque** parametri: ATECO · **numero** di addetti · paese · intensità di
vigilanza · modello operativo. La fascia resta come **derivata** dal numero, non come suo sostituto.
Il commento nel codice va aggiornato insieme, o resterà a dire il contrario di ciò che facciamo.

## Fasi

- [x] **F0 i parametri della ricerca** — 2026-08-17 (S1068) · mig. **`000323`** + contratto in
  `@heuresys/shared` + validazione nel servizio. Tutte e tre le cose:
  *(a)* i **sei** parametri sono un contratto esplicito — `PARAMETRI_RICERCA` e
  `parametriRicercaMancanti()` — **separato** da `IDENTITA_OBBLIGATORIA`, e la separazione è la
  sostanza: firmare e cercare sono due momenti diversi, e pretendere i sei alla firma respingerebbe
  fascicoli legittimi. `0` addetti conta come **mancante** (fuori da ogni fascia: la più bassa parte
  da 1), mentre lo schema lo ammette — perché lì descrive cosa il database accetta, non cosa una
  ricerca pretende.
  *(b)* il vincolo fascia↔numero **esiste ora, su due strati con ruoli distinti**: un `CHECK` non
  può leggerlo (i limiti stanno in un'altra tabella), quindi è un **trigger**
  `sys_blueprint_size_band_coherence` — pattern già usato nel progetto, e proprio su questa famiglia
  di tabelle — più la validazione nel servizio, che dà un **422 leggibile** invece di un errore SQL.
  Sentinella nuova `sys.v_blueprint_size_band_mismatch` (la ventesima vigilata).
  *(c)* il commento di `IDENTITA_OBBLIGATORIA` corretto: diceva che il numero di addetti «non entra
  in nessuna derivazione», e con la ricerca quella frase diventa falsa.
  ✅ **LA PROVA CHE DOVEVA POTER FALLIRE, e ha fallito su richiesta tre volte**: la migrazione
  **prova il trigger da sé** su una riga reale (99999 addetti respinti, valore 158 ripristinato) e
  sul clone di CI — dove non ci sono versioni — **dichiara «installato, non verificato»** invece di
  fingere; togliendo `employeeCount` dal contratto **5 casi su 7** diventano rossi; togliendo la
  validazione dal servizio i due casi di integrazione mostrano **500 invece di 422** — cioè il dato
  resta protetto dal trigger ma l'utente vede «si è rotto qualcosa». Live in produzione: `UPDATE`
  a 7000 addetti → `BLUEPRINT_SIZE_BAND_MISMATCH: la fascia M copre 50-249 addetti, ma ne sono
  dichiarati 7000`. Prove: unit **91/91** · integrazione fascicoli **12/12** · typecheck api/test/shared
  ⚠ **il typecheck dei test ha preteso il build di `@heuresys/shared`**: `tsconfig.test.json`
  risolve al **dist compilato**, che non conosce una funzione appena aggiunta alla sorgente (è il
  D-03 già noto). Annotare i tipi a mano era il sintomo, non la cura
- [x] **F1 dove vive il contenuto di un modello** — **FATTO 2026-08-19** · mig. `000327`: cinque tabelle di contenuto (unita', posizioni, competenze, indicatori, processi) agganciate alla **versione di variante**, chiave naturale `(versione, codice)`, legami interni per **codice** e non per uuid, e **nessun `tenant_id`** — con una post-condizione che lo rende impossibile per distrazione. Prova generale **VERDE** (catena intera + 21/21 sentinelle), applicata in produzione: 5 tabelle create, **225 righe ereditate intatte**. 🔬 La prova generale ha fermato un difetto alla seconda passata: la `000062` pretende «0 UNCLASSIFIED» e le cinque tabelle nuove non erano nel registro di riconciliazione — registrate `EXCLUDE`/bucket D con la ragione scritta. **L'indagine che ha preceduto la scrittura:**
  La domanda che F1 poneva — «riuso di `sys_organization_unit_templates` **se la forma regge**» — ha
  ora una risposta misurata, e la risposta è **no, non come sta**. Tre reperti:

  ① ⚠ **PRIMA CONCLUSIONE SBAGLIATA, CORRETTA NELLA STESSA ORA.** Avevo misurato che i **9**
  identificativi non esistono in nessuna delle quattro tabelle candidate (`sys_blueprint_variants`,
  `_families`, `sys_tenant_blueprints`, `_variant_versions`: **0 su 9** in ognuna) e ne avevo
  concluso «225 righe orfane». **È falso**, e la risposta stava nel file che le crea: la
  mig. `000064` dichiara la colonna così — `organization_unit_template_blueprint_id uuid NOT NULL,
  -- legacy template_id group (the 9)`. Quei nove **non sono blueprint di questo sistema**: sono il
  `template_id` del database di provenienza, conservato come **raggruppamento**. Non hanno mai avuto
  un referente locale, quindi non sono diventati orfani: non lo sono mai stati.
  **La lezione**: «0 su 9» misurava una cosa vera e ne suggeriva una falsa. Bastava leggere il file
  che crea l'oggetto prima di dire cosa sia — ed è la stessa regola che vale per le migrazioni.

  ② **Il riferimento non è vincolato, e ora si sa perché**: non c'è nulla a cui agganciarlo. Le
  uniche FK vanno verso sé stessa (il padre), verso i tipi di unità e verso `sys_users`. Resta però
  vero che una colonna chiamata `..._blueprint_id` che raggruppa identificativi di un altro sistema
  è un nome che mente sul proprio contenuto — e questo F1 lo può correggere.

  ③ **Le 225 righe SONO contenuto di modelli**, ed è il reperto più utile: nove strutture
  organizzative complete (codice, nome IT/EN, padre, tipo, livello, natura), cioè esattamente ciò
  che F1 cerca. Vivono già dentro `sys.*`, quindi riusarle non è un import dal legacy (I12: «ciò che
  manca si costruisce o si deriva dai dati che `sys.*` già contiene») — ma va verificato contro
  `check_no_legacy_ingest.py` prima di appoggiarvisi.

  ④ **Il modello aggancia un raggruppamento, non una VERSIONE** — che è invece ciò che F1
  chiede («contenuto di una **versione di variante**»). È la differenza fra un contenuto che può
  essere fotografato e riapplicato e uno che galleggia.

  **Cosa esiste per gli altri quattro domini di F5**, censito:

  | dominio | tabella di modelli | righe | stato |
  |---|---|---:|---|
  | `organization_units` | `sys_organization_unit_templates` | 225 | **tutte orfane**, nessuna FK al blueprint |
  | `kpis` (di unità) | `sys_organization_unit_kpi_templates` | 100 | agganciata bene (4 FK), ma porta `tenant_id`: è **per cliente**, non di piattaforma |
  | `kpis` (di processo) | `sys_process_kpi_templates` | 0 | vuota |
  | `positions` | — | — | **non esiste** |
  | `skills` | — | — | **non esiste** |

  **Conseguenza per la scrittura di F1**: due domini su cinque non hanno dove vivere, uno ha una
  tabella orfana e senza vincolo, uno è per-cliente invece che di piattaforma. La migrazione non è
  «aggiungo una colonna a una tabella che regge»: è dare una casa al contenuto di un modello, con
  la chiave naturale per dominio e il legame alla **versione**, e decidere delle 225 (bonifica o
  ragione scritta). ⚠ `ci-rehearsal.sh` sul linux-pc prima del push
- [x] **F2 `BlueprintBuildSource`** — **FATTO 2026-08-19 (S1072)** · `blueprint-build-source.ts`
  legge le quattro tabelle di contenuto della versione di variante e ne fa un `BuildPlan`;
  `resolveBuildSource()` e' **l'unico posto** in cui una chiave diventa un modo di costruire —
  innestato nell'atto (`#198` T5) e nell'anteprima (T6), cosi' che `F3` sia una **rimozione** e
  non una riscrittura. La `justification` si legge da `metadata->>'justification'` (che `F4`/`F6`
  riempiranno con la proposta approvata) e **non se ne inventa una** quando manca: si dice da
  quale modello e versione viene la riga. `incumbents: []` — un modello descrive la forma, non
  le persone; inventarle farebbe nascere ogni azienda con lo stesso organico fittizio, cioe' il
  difetto di E29 con un altro nome. Prove: **16/16** integrazione (nuovo file) · 43/43 sui
  fascicoli e i modelli · 19/19 sul motore · typecheck api + test · lint monorepo.

  🔬 **QUATTRO DIFETTI CHE SOLO IL PRIMO CODICE CHE COSTRUISCE DAVVERO POTEVA VEDERE.** Nessuno
  era visibile finche' il contenuto lo scriveva a mano un archetipo corretto per costruzione:

  ① **L'ordine delle unita' non era un dettaglio.** `materialize` risolve il padre da una mappa
  `codice → id` che riempie *man mano*: un figlio che arriva prima del padre otteneva
  `undefined`, che il codice trasformava in `null` — e l'unita' **nasceva in cima all'albero
  senza che nessuno protestasse**. Un `SELECT` non ha un ordine buono per costruire un albero.
  Ora la sorgente ordina **topologicamente** e un ciclo `A → B → A` diventa un errore (il
  `CHECK` della `000327` vieta solo `A → A`); il motore ha la **seconda rete**
  (`BUILD_PLAN_PARENT_UNRESOLVED`) invece di accettare un padre irrisolto.

  ② **Un tipo di unita' ignoto era silenzioso**: `orgUnitTypeId` tornava `null` e
  `organization_unit_type_id` e' nullable — l'unita' nasceva senza tipo e la costruzione
  riusciva. Ora si verifica contro il catalogo **prima** di produrre il piano (l'anteprima
  `mode:"plan"` non risolve i tipi: senza questo, direbbe «tutto bene» e la costruzione
  fallirebbe *dopo* la firma), e il motore rifiuta con `ORG_UNIT_TYPE_UNKNOWN`.

  ③ **Il vocabolario della `000327` non era quello del prodotto** → mig. **`000328`** +
  emendamento della `000327` (ADR-0035: `CREATE IF NOT EXISTS` non ricrea una tabella che c'e',
  quindi emendare il solo file di origine avrebbe corretto i database nuovi e lasciato intatto
  quello di produzione). La specie di una competenza ammetteva `LANGUAGE`/`CERTIFICATION`, che
  `sys_skills` non conosce, e vietava `BEHAVIOR`/`OTHER`, che conosce; il verso di un indicatore
  ammetteva `TARGET_IS_BEST`, che nel prodotto non esiste. Un modello cosi' **passava il cancello
  e non era costruibile** — la stessa forma del difetto T9a, che si rompe dopo, dove attribuirlo
  e' difficile. La post-condizione **confronta i due `CHECK` fra loro** invece di ricopiare un
  elenco: il giorno in cui `sys_skills` cambia, diventa rossa da sola.

  ④ **`OrgUnitType` enumerava i sei tipi della banca** su un catalogo che ne ha **dieci**:
  `PLANT` e `WAREHOUSE` — uno stabilimento e un magazzino — **non erano esprimibili**. E' il
  ⭐ PUNTO FISSO: il catalogo e' una tabella, e un `type` che la ricopia e' una misura variabile
  cristallizzata. Ora e' `string`, con la verifica dove il dato vive. Il modello seminato nella
  prova **non e' una banca**: e' un'azienda manifatturiera con uno stabilimento e un magazzino,
  cosi' che richiudere quell'unione renda il test rosso.

  ✅ **LE PROVE HANNO FALLITO SU RICHIESTA, quattro volte.** Spento il rifiuto del modello vuoto
  → rosso **solo** il caso dello zero silenzioso; tolto l'ordinamento topologico → rossi **3**
  casi (ordine, padre inesistente, ciclo); rimesso `TARGET_IS_BEST` nella `000328` → prova
  generale **ROSSA** col confronto fra i due domini stampato per esteso; e per il lucchetto,
  due sabotaggi indipendenti (§ fuori ciclo). Prova generale sul linux-pc **VERDE** prima e dopo:
  303 migrazioni, due passate, 21/21 sentinelle.
- [x] **F3 il ritiro, senza lasciare traccia** — **FATTO 2026-08-19 (S1072)** · `blueprints.ts`
  **cancellato**, e con lui la sorgente che lo leggeva. ✅ **LA PROVA DEL PIANO E' VUOTA**:
  `grep -rn "RETAIL_BANK_REFERENCE\|getArchetype"` su `apps/` e `packages/` non trova piu' niente —
  nemmeno nei **commenti**, perche' E29 dice *«non deve rimanere traccia»* e un commento che nomina
  l'archetipo e' traccia. Dodici file di codice ripuliti, quattro test riscritti, due ritirati, due
  script di prova live adattati, tre migrazioni.

  **La prova non e' piu' un comando da ricordarsi: e' un cancello che gira a ogni corsa.**
  `test/unit/build-source.unit.test.ts` scandisce **tutto** `src/` a ogni esecuzione e cade se un
  nome ritirato ricompare. ⚠ I nomi cercati sono **composti a pezzi** dentro quel file: scritti
  interi, il cancello troverebbe se' stesso e nascerebbe rosso su un codice sano — e' il difetto
  `#194`, «un allarme che insegna a non guardarlo». Tre reti: il caso positivo (senza, i negativi
  sarebbero verdi anche a cancello spento), la controprova su una parola che in `src` c'e' di
  sicuro, e il conteggio dei file scanditi (>100), perche' una ricorsione rotta renderebbe tutto
  verde per vacuita'.

  **Cosa e' successo ai due ingressi che costruivano da un archetipo**, ed e' una decisione tecnica,
  non una rimozione di capacita': `POST /v1/tenant-materialization` e `POST /v1/tenants/provision`
  ora prendono un `variantVersionId` invece di una chiave; `GET /archetypes` (catalogo **statico**,
  scritto in TypeScript) diventa `GET /sources`, che elenca i **modelli con del contenuto vero**
  letti dal database. Nessun alias sul nome vecchio, di proposito: una rotta che risponde con
  un'altra cosa e' il modo piu' rapido per far credere che l'archetipo esista ancora. Aggiornati
  anche lo strumento MCP `hrx_tenant_materialize` e i metadati dell'effetto di approvazione
  (`metadata.archetypeKey` → `metadata.variantVersionId`; misurato: **zero** richieste esistenti in
  produzione, quindi nessun dato vivo rotto).

  **Il database non poteva restare indietro** — mig. **`000329`** + emendamento della `000320`
  (ADR-0035, la coppia): una versione di variante in produzione dichiarava ancora
  `build_source_key` = il nome dell'archetipo, e sarebbe rimasta a nominare una cosa di cui non
  c'e' piu' traccia. Ora dichiara `BLUEPRINT_CONTENT`. ⚠ **La conseguenza e' voluta e gia'
  dichiarata da questo piano**: quel modello e' vuoto, quindi quella versione **non e' costruibile**
  e il fascicolo `APPROVED` che la ancora non si applichera' fino a `F6`. Il rifiuto e' **esplicito**
  (`BLUEPRINT_CONTENT_EMPTY`), non uno zero silenzioso.

  🔬 **UN QUINTO DIFETTO, trovato perche' la fixture non e' una banca** — mig. **`000330`**. Il tipo
  di un'unita' e' dichiarato in **due posti**: il catalogo `sys_organization_unit_types` (**dieci**
  tipi) e un `CHECK` sulla colonna denormalizzata, che ne ammetteva **nove**. Mancava `TEAM`: un tipo
  **referenziabile ma non scrivibile**, cioe' esistente per meta'. Nessun modello bancario lo usa;
  un'azienda manifatturiera con una linea di produzione si'. E la misura ha trovato anche **una riga
  gia' incoerente in produzione** — `HS-PROD`, «Divisione Product & Development», colonna testuale
  `DIVISION` e FK che puntava a `TEAM` — passata inosservata proprio perche' nessuno confrontava le
  due dichiarazioni fra loro. Corretta la FK (il nome dice quale delle due ha ragione), con la
  guardia che si ferma se le righe incoerenti fossero piu' di quella nota, e la post-condizione che
  **confronta il `CHECK` col catalogo** invece di ricopiarne l'elenco.

  ✅ **LE PROVE HANNO FALLITO SU RICHIESTA.** Il cancello del ritiro: rimessa una traccia intera in
  `service.ts` → rosso, col file e il nome stampati. ⚠ Il **primo** sabotaggio non era stato visto,
  e la colpa era del sabotaggio: avevo spezzato io stesso la stringa in due pezzi, quindi non c'era
  niente da trovare — rifatto col nome intero. La `000329`: rimesso il nome ritirato come valore di
  destinazione → prova generale **ROSSA**. E la prova generale ha intercettato **un difetto vero
  dell'ordine di ADR-0035**: la `000320` gira nove numeri prima della `000329`, quindi su un
  database esistente il suo backfill non tocca niente e la sua post-condizione contava zero — resa
  tollerante ai **due** valori, con la ragione scritta, senza perdere cio' che intercettava.

  Verde: 18/18 (materializzazione, origini, applicazione del fascicolo) · 28/28 (effetti,
  provisioning, sorgente) · 113/113 unit · typecheck api + test + agent-gateway · lint monorepo ·
  prova generale **VERDE** (305 migrazioni, due passate, 21/21 sentinelle) · `000328`, `000329` e
  `000330` applicate in produzione.
- [ ] **F4 il motore di ricerca** — corse, proposte, fonti (indirizzo + data + impronta), decisione
  motivata. Riuso quasi totale delle 5 tabelle di acquisizione. Due modifiche già misurate
  dall'epica: `tenant_id` nullabili con `CHECK` sulla coppia, e il legame alla versione di fascicolo.
  Più `BLUEPRINT_FIELD_LOCKED` (`D-85`, era `D-81`), che l'epica vuole **insieme**. ⚠ La difesa di §4.4 non è
  opzionale: **una pagina web può contenere istruzioni**, e la ricerca le legge.

  🔎 **INDAGINE FATTA 2026-08-19 (S1072), implementazione NON aperta** — il guardiano dava capienza
  per ~250k e F4 ne chiede di piu' (schema + motore + difese + prove): aprirla a meta' sarebbe
  peggio che non aprirla. Ecco cosa la prossima sessione trova gia' pronto, misurato sul vivo e non
  dedotto dall'epica:

  | cosa serve a F4 | cosa c'e' gia' | cosa manca |
  |---|---|---|
  | la **corsa** | `sys_seed_acquisition_runs` — 13 colonne: modello di prompt, **registro delle fonti** (`source_registry_payload`), stato, inizio e fine | il legame alla **versione di variante**; `tenant_id` e' `NOT NULL` |
  | la **proposta** | `sys_seed_candidate_records` — dominio, **chiave naturale**, payload, stato di validazione | `tenant_id` e' `NOT NULL` |
  | la **fonte** | `sys_seed_source_evidence` — `url` + `retrieved_at` + `content_hash`: e' **esattamente** «indirizzo + data + impronta» | ✅ **niente** |
  | le **regole applicate** | `sys_seed_validation_results` — codice regola, esito, messaggio | ✅ niente |
  | la **decisione motivata** | `sys_seed_approval_decisions` — approvatore, stato, `rationale` | ✅ niente |

  **① Il registro c'e', il motore no.** Esistono gia' **tre moduli API completi** su queste tabelle
  — `seed-acquisition-runs`, `seed-candidate-records`, `seed-approval-decisions` — con rotte,
  servizio, repository e test, sotto il permesso `seed_acquisition:trigger`. Ma `trigger` **registra
  una corsa**, non la esegue: nessun codice va a leggere una pagina web. F4 non e' «costruire il
  registro delle ricerche»: e' **aggiungere il motore dietro un registro che esiste gia'**, ed e'
  molto meno lavoro di quanto il piano lasciasse intendere.

  **② ⚠ LE TABELLE SONO GIA' IN USO, E NON DALLA RICERCA.** Le **12** corse presenti sono tutte di
  `STORIA36` (la storia RTL a 36 mesi), con 12 proposte, 12 decisioni e 36 validazioni. L'epica
  diceva «riuso quasi totale»; la misura aggiunge il vincolo che l'epica non poteva vedere: **F4
  deve conviverci, non appropriarsene**. Rendere `tenant_id` nullabile e agganciare la versione va
  fatto senza toccare le righe di storia36 — e la post-condizione dovra' proteggere **quelle**,
  non solo le nuove (metodo di bonifica, punto ④c).

  **③ `D-85` si estingue qui, e il register lo dice gia'.** `BLUEPRINT_FIELD_LOCKED` e' segnato
  «gestito — non lavorabile per costruzione»: la guardia non poteva essere scritta finche' non
  esisteva l'attore capace di violarla. Il register rimanda esplicitamente a `#132`. Il codice
  d'errore e la classificazione dei campi (bloccanti / rivedibili) sono **gia' scritti** nella
  specifica §4.8: non vanno riprogettati, vanno applicati.

  **④ La difesa di §4.4 non ha ancora nulla su cui appoggiarsi**, ed e' la parte da progettare per
  prima: `content_hash` conserva l'impronta di cio' che si e' letto, ma nessun codice tratta il
  testo di una pagina come **dato non fidato**. Finche' il motore non esiste, non esiste nemmeno il
  punto in cui la difesa va messa — quindi va scritta insieme al motore, non dopo.

  ---

  ### La decomposizione, e le decisioni tecniche che la reggono (S1074, 2026-08-19)

  **Dove vive il motore: nell'API, non nel gateway.** Il gateway agente e' un **client** dell'API
  (`heuresys-client.ts`); farvi vivere il motore invertirebbe la dipendenza. E c'e' una ragione piu'
  forte: l'impronta di §4.3 dev'essere lo **SHA-256 dei byte effettivamente ricevuti**, e uno
  strumento `WebFetch` dell'SDK restituisce testo gia' interpretato — i byte non li vede nessuno.
  L'API legge il web da tre anni (`esco-connector.ts`, `istat-ateco-connector.ts`,
  `voyage-client.ts`): il lettore di F4 e' lo stesso pattern, con le difese in piu'.

  **I due atti non deterministici stanno dietro due porte iniettabili**, cosi' che le prove possano
  fallire senza rete e senza modello: `WebReader` (legge, misura, impronta) e `ProposalSource` (chi
  propone). La seconda ha l'implementazione reale nel gateway (§F4h), dove vive l'abbonamento.

  **Il dominio pilota di F4 e' `research_sources`, non un dominio di contenuto.** Lo prescrive
  l'epica §4.3 — *«la prima ricerca che la piattaforma esegue e' su dove cercare»* — e scioglie il
  fondamento circolare: il registro delle fonti nasce da una corsa, e il filtro della prima ondata
  e' Enzo che approva una fonte per volta. I cinque domini di contenuto restano a `F5`.

  | # | sotto-passo | cosa consegna |
  |---|---|---|
  | **F4a** ✅ | lo schema e il registro delle fonti — **FATTO 2026-08-19** | mig. `000333`: `tenant_id` nullabili + `CHECK` sulla coppia, legame alla versione di variante, trigger di coerenza candidato↔corsa, `sys.sys_research_sources` (approvatore obbligatorio quando approvata), sentinella nuova |
  | **F4b** ✅ | il dominio ricercabile e' un contratto in codice — **FATTO 2026-08-19** | `research/domain.ts` (domande · forma · chiave naturale · controlli), il dominio pilota `research_sources`, il confronto **per suffisso di host** |
  | **F4c** ✅ | il lettore web — **FATTO 2026-08-19** | `research/web-reader.ts`: solo `https`, guardia SSRF, limiti di dimensione e tempo, **SHA-256 dei byte** che riproduce |
  | **F4d** ✅ | il motore — **FATTO 2026-08-19** | `research/engine.ts`: corsa → letture → proposte → validazione (forma · fonti · doppioni) → candidati + evidenze + esiti, stato della corsa |
  | **F4e** ✅ | le difese §4.4 e §4.5 — **FATTO 2026-08-19** | il testo grezzo non entra mai in una proposta; le domande verso il web si costruiscono **solo** dai parametri di categoria, con un cancello meccanico |
  | **F4f** ✅ | `D-85` si estingue — **FATTO 2026-08-19** | `BLUEPRINT_FIELD_LOCKED` sui campi bloccanti, col nome del campo e il perche' |
  | **F4g** ✅ | la superficie API — **FATTO 2026-08-19** | le quattro rotte di §6, i permessi, il contratto in `@heuresys/shared` |
  | **F4h** | il fornitore reale del ragionamento | `/research/propose` nel gateway + la **dimostrazione LIVE**: una corsa vera che legge pagine vere e propone fonti |

  ✅ **F4a FATTA — 2026-08-19 (S1074)** · mig. `000333`, applicata in produzione. Una corsa puo'
  appartenere a un **fascicolo** invece che a un tenant (`CHECK` sulla coppia: mai nessuno dei due),
  la proposta segue la corsa (trigger di coerenza), e le fonti hanno un registro —
  `sys.sys_research_sources`, dove una fonte `APPROVED` **senza** approvatore, data e motivazione e'
  impossibile per vincolo. Sentinella nuova `sys.v_research_evidence_source_not_approved`, la
  ventitreesima vigilata.

  🔬 **LA PROVA GENERALE HA FERMATO UN DIFETTO ALLA SECONDA PASSATA**, ed e' la classe che in CI si
  scopre 25 minuti dopo il push: la `000304` pretende che nessuna FK verso `sys_users` resti fuori
  dal registro GDPR, e la mia colonna `..._approver_user_id` vi rientrava. La correzione non e' stata
  registrarla come dato personale ne' aggirare il cancello: e' il **nome**. Chi approva e' un
  **attore**, e nel progetto gli attori si chiamano `_by` (`tenant_blueprint_version_approved_by`) —
  che e' esattamente cio' che quel cancello esclude. Rinominata `research_source_approved_by`.

  ✅ **LE PROVE DEVONO POTER FALLIRE, e qui ce ne sono quattro.** La migrazione **prova i due
  vincoli da se'**, su righe vere, dentro la propria transazione: una corsa senza tenant e senza
  fascicolo → **RESPINTA**; una proposta che dichiara un tenant diverso dalla sua corsa →
  **RESPINTA**. Sul clone di CI, dove non esistono versioni di fascicolo, dichiara «installato,
  **NON verificato**» invece di fingere — in produzione le due prove sono girate davvero (`NOTICE`
  del 2026-08-19). Poi, sul database di produzione dentro una transazione disfatta:
  la sentinella si accende **solo** su `bancaditalia.it.attaccante.example` e su un blog mai
  registrato, e **non** su `dati.bancaditalia.it` — cioe' il confine e' per **suffisso**, non per
  sottostringa; una fonte `APPROVED` senza approvatore e un suffisso scritto `https://istat.it/`
  sono **respinti**; e dopo il `ROLLBACK` sentinella a `0`, registro a `0`, le **12** evidenze
  storiche ancora `12`.

  Prova generale sul linux-pc **VERDE**: 308 migrazioni, due passate, **23/23** sentinelle a zero.

  ✅ **F4b FATTA — 2026-08-19 (S1074)** · `research/domain.ts` (il contratto in quattro parti),
  `research/sources.ts` (la politica delle fonti, confronto **per suffisso** senza regex e senza
  jolly), `research/domains/research-sources.ts` (il dominio pilota) e `domains/index.ts` — l'unico
  posto in cui una chiave diventa un modo di **cercare**, gemello di `resolveBuildSource()` per il
  costruire. La difesa di §4.5 e' nella **firma del tipo**: `domande()` riceve un `ContestoRicerca`
  di sole categorie, e non il fascicolo — interpolare il nome di un cliente in una domanda diretta
  al web non e' una svista possibile.

  ✅ **DUE SABOTAGGI INDIPENDENTI, ognuno lascia rosso SOLO cio' che quella difesa copre**:
  `endsWith` sostituito con `includes` → **3** casi rossi (la trappola, il confine di etichetta, il
  rifiuto in `fonteAmmessa`), e il caso positivo resta verde — cioe' i negativi non erano verdi per
  vacuita'; spento `SOURCE_EVIDENCE_IS_SELF` → **1** caso rosso soltanto. 21 casi nuovi; suite unit
  **134/134**, typecheck e lint verdi.

  ✅ **F4c FATTA — 2026-08-19 (S1074)** · `research/web-reader.ts`, l'unico punto in cui questo
  sistema apre una pagina. Quattro guardie: solo `https` · niente rete interna (loopback, privata,
  **link-local coi metadati** delle macchine virtuali, CGNAT, IPv6 e IPv4 incapsulato) · limiti di
  byte e di tempo, col limite **ri-verificato sui byte veri** perche' `content-length` lo dichiara
  chi risponde · **redirect seguiti a mano, ricontrollando ogni salto**. Cio' che esce si chiama
  `testoNonFidato`, ed e' il nome giusto.

  ✅ **DUE SABOTAGGI, ognuno rosso solo dove deve**: guardia applicata al solo primo salto → **1**
  caso (e quel caso verifica anche che la seconda destinazione non sia **mai stata aperta**);
  tolta la riga della rete link-local → **2**. Le porte `fetch` e DNS sono iniettabili proprio
  perche' quel salto non si puo' provocare con un server locale. L'impronta e' verificata contro
  uno SHA-256 calcolato per conto proprio su un **server HTTP vero**: 19 casi nuovi, suite unit
  **153/153**, typecheck e lint verdi.

  ✅ **F4d FATTA — 2026-08-19 (S1074)** · `research/engine.ts`. Cinque controlli trasversali, ognuno
  col **proprio nome** nel registro delle validazioni — `SHAPE_VALID` (e se la forma non regge gli
  altri sono `SKIPPED`, non `PASSED`), `SOURCES_PRESENT`, `SOURCES_POLICY`, `NOT_DUPLICATE`,
  `RAW_TEXT_LEAK` — piu' quelli del dominio. Due cose valgono piu' delle altre: **una fonte
  dichiarata ma mai aperta non e' una fonte**, e' una citazione, e una citazione non ha impronta;
  e `RAW_TEXT_LEAK` e' la difesa di §4.4 resa meccanica — un campo che ricopia un blocco lungo di
  una pagina letta sta **riportando** invece di ricavare, ed e' il veicolo con cui un'istruzione
  nascosta in una pagina entrerebbe nel modello. La difesa di §4.5 e' il **mandato**: chi propone
  riceve dominio, contesto di categoria, domande e la lettura — un test conta le chiavi una per una.

  🔬 **UN DIFETTO TROVATO DAL TEST, non dal ragionamento**: il tetto delle pagine tagliava **in
  silenzio** — la corsa non dichiarava cio' che non aveva aperto per limite raggiunto, e un tetto
  che taglia in silenzio fa sembrare «coperto» cio' che non lo era. Corretto: si registra.

  ✅ Due sabotaggi, ognuno rosso solo dove deve (spenta `RAW_TEXT_LEAK` → 1; fonti dichiarate
  contate come lette → 1). 16 casi nuovi, suite unit **169/169**, typecheck e lint verdi.

  ✅ **F4e FATTA — 2026-08-19 (S1074)** · `research/guardia-domande.ts`. La prima difesa di §4.5
  e' la firma del tipo; questa e' la **seconda**, perche' la prima protegge dalla svista e non
  dall'errore: le domande **gia' costruite** si confrontano coi termini che identificano il cliente,
  e se uno compare la corsa **non parte** (`RESEARCH_QUERY_LEAKS_CLIENT`). Confronto su **parole
  intere** — `bank` non si accende su «banking» ne' su «bancario» — e soglia a **tre** lettere e non
  quattro, perche' «RTL» e' un nome e con quattro sarebbe passato indisturbato. Piu'
  `avvolgiTestoNonFidato()`, che **depura i delimitatori**: un testo che contenesse la riga di
  chiusura potrebbe far credere che il blocco sia finito.

  ✅ **F4f FATTA — 2026-08-19 (S1074)** · `tenant-blueprints/campi-bloccanti.ts`, agganciato a
  `patchIdentity`. `PLATFORM` cambia i campi bloccanti (e' il proprietario della piattaforma);
  `CLIENTE` e `RICERCA` **mai** — e l'attore capace di violare la guardia e' proprio la ricerca, che
  in `F6` applichera' al fascicolo proposte nate da pagine web. Il rifiuto dice **quale** campo e
  **perche'**; riscrivere lo stesso valore non e' un cambiamento.

  🔬 **BONIFICA — `D-81` ERA REGISTRATO DUE VOLTE**, con due contenuti diversi: il denominatore
  della maturita' (rinumerato da `D-72` in S1045 **proprio per togliere una collisione**) e questo.
  Criterio, non arbitrio: **chi arriva dopo su un numero occupato cede il numero** →
  `BLUEPRINT_FIELD_LOCKED` diventa **`D-85`**, con la nota-ponte nel register. Aggiornate le fonti
  vive; i piani e i mandati datati restano come sono, perche' sono cronaca. `uniq -d` sugli
  identificativi ora non trova piu' niente.

  ✅ Due sabotaggi (tolto il confine di parola → 2 rossi; la ricerca esentata dai bloccanti → 2).
  16 casi nuovi; unit **185/185**, integrazione fascicoli **12/12**, typecheck, lint, handoff-lint.

  ✅ **F4g FATTA — 2026-08-19 (S1074)** · quattro rotte **sui moduli che esistevano gia'**, nessun
  modulo nuovo: l'elenco dei domini ricercabili, l'avvio di una corsa su una versione di
  fascicolo, le proposte di una corsa, la decisione motivata su una proposta. Piu' il contratto
  in `@heuresys/shared`, il repository sulle cinque tabelle e il servizio.
  **Prima si verifica, poi si scrive**: dominio, sei parametri, guardia sulle domande — e solo
  dopo nasce la riga della corsa.

  ⚠ **Se non c'e' chi propone, si dice.** La sorgente predefinita **solleva** invece di
  restituire un elenco vuoto: una corsa «COMPLETED, 0 proposte» perche' non c'era nessuno a
  proporre e' identica, a chi la legge, a una corsa che ha cercato e non ha trovato niente.

  **8 casi di integrazione sul database vero**, col fascicolo reale `RTL-BANK-CONFIG` (l'unico
  che ha tutti e sei i parametri). Il caso che conta di piu' e' l'ultimo: le **12** corse di
  `STORIA36` restano intatte, col loro tenant e senza fascicolo. Sabotaggio: la sorgente assente
  che finge l'elenco vuoto -> rosso **solo** il caso dello zero silenzioso. Unit **185/185**,
  fascicoli 12/12, typecheck api + test, lint.

  **Confine di sessione dichiarato**: F4 e' otto sotto-passi con commit atomici. Si va avanti
  finche' il guardiano regge; cio' che non entra resta dichiarato qui, non lasciato a meta'.

  #### La simulazione a cinque domande (R24 §3) — fatta prima di eseguire

  - **Precondizioni**: il tunnel e' su e il database risponde (boot verde); le 12 corse di storia36
    esistono e vanno protette; `sys_tenant_blueprint_versions` esiste (mig. `000320`); il gateway
    gira sull'abbonamento (`AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`) — **solo `F4h` ne dipende**.
  - **Meccanismo**: la migrazione emenda la `000020` (ADR-0035 — la coppia) *e* corregge
    l'esemplare esistente; il motore e' un modulo API con due porte iniettabili; le prove girano
    con Vitest e con un server HTTP locale per il lettore.
  - **Propagazione**: `db/migrations/**` → prova generale sul linux-pc (`ci-rehearsal.sh`, due
    passate) **prima** del push; poi la catena di deploy abituale.
  - **Chi**: tutto Claude. Serve Enzo **solo** per l'approvazione delle prime fonti (`F4h`), che e'
    una decisione di business — ed e' l'unico punto dichiarato `blocked-on-Enzo` di F4.
  - **Guardia**: la migrazione tocca colonne in uso. La guardia conta le 12 righe storiche **prima**
    e la post-condizione verifica che siano **ancora 12, con lo stesso tenant e lo stesso stato** —
    cioe' protegge cio' che NON doveva cambiare. Rollback dichiarato nella migrazione.

- [ ] **F5 i cinque domini ricercabili** — `organization_units` · `positions` · `skills` · `kpis` ·
  `business_processes`. Il primo costa la forma, gli altri quattro la riusano
- [ ] **F6 il ponte: le proposte approvate diventano il modello** — famiglia (se non esiste),
  variante, versione 1 col contenuto. Riqualifica da scrivere: `sys_blueprint_families` e `_variants`
  **non sono un catalogo anticipato**, sono un **sottoprodotto dei clienti**
- [ ] **F7 le due prove** — prima l'azienda nuova di settore diverso (se ne esce una banca,
  l'archetipo è sparito solo di nome), poi RTL Bank come metro di qualità. Sul gemello, poi in
  produzione

## Le prove che devono poter fallire

- **F2** — un fascicolo **senza** modello non deve costruire «zero righe con successo»: deve
  **rifiutarsi**. Uno zero silenzioso qui è il difetto peggiore, perché somiglia a un successo.
- **F3** — ✅ **FATTA, e non è più un comando da ricordarsi**:
  `grep -rn "RETAIL_BANK_REFERENCE\|getArchetype" apps/ packages/` torna **vuota** (2026-08-19), e
  la stessa domanda è ora un cancello che gira a ogni corsa dei test
  (`test/unit/build-source.unit.test.ts`). Se resta un riferimento, il ritiro non è avvenuto: è
  stato rinominato.
- **F5** — una proposta con una fonte **non ammessa** va respinta col motivo, non accettata con un
  avviso.
- **F7.1** — l'azienda del settore diverso **non deve** avere unità che somigliano a filiali
  bancarie. È il modo più utile in cui questo piano può fallire: direbbe che la ricerca non ricerca.

## Fuori da questo ciclo — trovato misurando, presentato una volta sola

Non entra in «cosa resta» di `#132`, non blocca la chiusura di nessuna fase. Enzo decide se e
quando.

1. **Il dominio «processi» ha DUE case, e una è nata vuota** (misurato S1072).
   `sys.sys_blueprint_process_registry` **esisteva già**: 23 righe, agganciata alla versione di
   variante con una FK *composita* `(versione, variante)`, e con tre tabelle che le puntano
   (`sys_blueprint_overrides`, `sys_content_blueprint_links`, `sys_organization_unit_processes`).
   `F1` ha creato `sys_blueprint_content_processes` per lo stesso scopo, e oggi è vuota. Non ha
   ancora fatto danno — il `BuildPlan` non porta processi e il motore non li costruisce — ma **`F5`
   dovrà scegliere quale delle due è la casa**, e la scelta non è simmetrica: quella vecchia ha già
   i dati e i referenti, quella nuova ha `owner_position_code` (il presidio per codice di posizione,
   che l'archetipo esprime con 23 `OWNER` su *unità*). ⚠ Attenzione al modello: le due attribuiscono
   il processo a cose diverse — una **posizione** contro una **unità**.
2. **`sys_organization_unit_types.organization_unit_type_code` non ha un vincolo di unicità**, quindi
   il contenuto di un modello **non può** agganciare il catalogo con una FK: la verifica del tipo
   resta nel codice (dove il messaggio d'errore serve) invece che nello schema. Aggiungere l'unico
   più la FK renderebbe il tipo ignoto impossibile invece che intercettato — è materia di `F5`,
   dove i cinque domini ricercabili prendono forma.
3. **Il lucchetto della suite bloccava per un PID riciclato** — ⚠ **già corretto in S1072**, perché
   impediva di verificare qualunque cosa. `.zp/suite.lock` dichiarava il PID `10720` scritto alle
   02:38; alle 16:50 quel processo era morto da ore e sotto quel numero girava `svchost.exe`.
   `kill(pid, 0)` rispondeva «vivo» e la suite era inavviabile. Il commento del lucchetto
   *dichiarava* di gestire i lock stantii: la difesa c'era ed era **falsa**, perché un
   identificativo che il sistema riusa non identifica nessuno. Ora si verifica anche **che cosa**
   gira sotto quel numero (`tasklist` / `/proc/<pid>/cmdline`) e c'è una **scadenza** di 3 ore come
   rete per il caso peggiore, un PID riciclato *da un altro node*. Prova nuova
   `test/unit/suite-lock.unit.test.ts`, **4 casi**: i due sabotaggi spengono una difesa per volta e
   ognuno lascia rosso **solo** il caso che quella difesa copre — che è l'unico modo di sapere che
   sono davvero due, e non una scritta due volte. Il primo caso è **positivo** apposta: senza, tre
   negativi resterebbero verdi anche con il lucchetto del tutto disattivato.

## Ordine e intreccio con `#198`

F1 → F2 → F3 → F4 → F5 → F6 → F7. Il **T7** di `#198` (le due pagine) si può intercalare in qualunque
momento: non dipende da *dove* nasce il modello. Il **T9** (la prova che chiude P3) ha senso **dopo**
F6, altrimenti misurerebbe una costruzione fatta dall'archetipo che stiamo togliendo.
