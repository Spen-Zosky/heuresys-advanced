# A — Il contratto Datastore → Platform: che cosa esiste, che cosa manca

Specialista «Architettura, dominio e contratto». Lettura del 2026-10-23, in sola lettura, sui due cloni: `heuresys-advanced` (HEAD `2706044`) e `heuresys-datastore` (HEAD `c263bda`). Nessun file dei due repository è stato modificato.

Legenda della classificazione:
- **FATTO VERIFICATO**: ho letto il codice, lo schema o l'esito della prova, e ne riporto file e riga.
- **INFERENZA**: ricavato dalla lettura incrociata di documenti e codice, senza aver eseguito niente.
- **NON DISPONIBILE**: nei due repository non c'è niente che risponda.

Nessuna prova è stata eseguita (nessun database raggiungibile da questo container). Ogni «verde» citato qui è quello dichiarato da un esito depositato, con il suo percorso.

Due precisazioni di partenza, che il resto del documento usa:

1. **I contratti sono due, non uno.** `docs/04_impianto/17_IL_CONTRATTO_DI_PUBBLICAZIONE.md` (datastore) regola le **viste `_v1` dei cataloghi** e l'istantanea Turtle `pnpm run pubblica` (§1, §3). Non parla del fascicolo. Il contratto del fascicolo è lo **schema del pacchetto** `heuresys.prototipo.pacchetto/0.3` (`src/contratto/v0.3/`, documento 31). Chi legge «contratto di pubblicazione» e pensa al fascicolo legge il documento sbagliato.
2. **Il caricatore di advanced è un programma da riga di comando, non un servizio.** `db/scripts/pacchetto/accogli-pacchetto.mjs:30` rifiuta ogni database il cui nome non finisce con `_prova<N>`. Oggi **non esiste una strada per caricare un pacchetto in produzione**, ed è voluto (README dell'onda 2, regola 4). Ogni affermazione di questo documento su «importazione» vale quindi per le copie usa-e-getta del gemello.

---

## 1. Struttura del pacchetto, schema, versione, provenienza, identificativi, dipendenze, ordinamento, impronte

| aspetto | che cosa esiste | evidenza | classe |
|---|---|---|---|
| Schema | JSON Schema 2020-12, `$id` `urn:heuresys:contratto:prototipo-pacchetto:0.3`, 26 sezioni obbligatorie come chiavi (18 della v0.2 + `strategia`, `capability`, `ruoli`, `decisioni`, `entita`, `agenti`, `principi`, `perimetro`), `additionalProperties: false` alla radice | `heuresys-datastore/src/contratto/v0.3/prototipo-pacchetto.schema.json` (letto con Python: `required`, `properties`) | FATTO VERIFICATO |
| Versione del contratto | `meta.schema` = `heuresys.prototipo.pacchetto/0.3`; `VERSIONE.json` con stato `APPROVATA` il 2026-10-17 (D-79) | `src/contratto/v0.3/VERSIONE.json`; `esecuzione/DOMANDE_APERTE.md` riga D-79 | FATTO VERIFICATO |
| Impronte del contratto | SHA-256 di ogni file della cartella in `VERSIONE.json`. Ricalcolate oggi: schema `484fa4d2…`, vocabolari `4d568736…`, mappatura, matrice, glossario coincidono. La copia in advanced ha schema, vocabolari e `VERSIONE.json` identici; il caricatore si rifiuta se l'impronta non coincide | `db/scripts/pacchetto/convalida-pacchetto.mjs:36-41`; copia in `db/scripts/pacchetto/contratto/v0.3/` | FATTO VERIFICATO |
| Impronta della v0.2 | la copia v0.2 in advanced è identica a quella del datastore, ma **il caricatore non ne controlla l'impronta** (solo la v0.3) | `convalida-pacchetto.mjs:36` (`if (cartella === "v0.3")`) | FATTO VERIFICATO |
| Versione del pacchetto (dell'istanza) | **non è nel pacchetto.** Il datastore numera i pacchetti di un prototipo in `datastore_model.datastore_bench_package.bench_package_version_no` con la testata bloccata (`src/carico/banco_pacchetto.ts:536-541`), ma `meta` porta solo `schema`, `prototipoId`, `creatoIl`, `lingueBase`, `lingue`, `generatoDa`, `origine`, `completezza`. L'unico numero di versione che viaggia è `perimetro.fascicoloVersione` (con `estendeVersione`) | schema, `meta.required`; `src/fascicoli/estensione.ts:100-108` | FATTO VERIFICATO |
| Impronta del pacchetto | il datastore calcola `improntaJson(p)` e deduplica per impronta (`banco_pacchetto.ts:496-522`), ma **l'impronta non viaggia con il pacchetto**: `meta.origine.impronta` è facoltativa e dice solo da quale v0.2 nasce una conversione. Advanced non può verificare di aver ricevuto proprio il pacchetto registrato nel datastore | schema `meta.origine`; `definizione-pacchetto.mjs:41` (`source_hash: o?.impronta`) | FATTO VERIFICATO |
| Provenienza | `meta.generatoDa`, `meta.origine` (schema, `convertitoIl`, `convertitore`), `meta.completezza` (passi accettati su passi della cascata), `prove` + legami con `fonti` / `senzaRiscontro`, `derivazioni`, `vuoti` dichiarati | schema; advanced le scrive in `sys_blueprint_content_packages`, `_evidence`, `_evidence_links`, `_evidence_gaps`, `_derivations`, `_gaps` (`accogli-pacchetto.mjs:76-81`) | FATTO VERIFICATO |
| Identificativi stabili | dentro il pacchetto tutto si lega **per codice** (`$defs.codice`, `processoCodice`, `ruoloCodice`, …); le voci di catalogo per `schema`+`codice` (+ `uri`), vocabolario `schemaCatalogo` di 10 valori, fra cui `ALTRO` | schema `$defs.rifCatalogo`; `vocabolari.json` `schemaCatalogo` | FATTO VERIFICATO |
| Identità del prototipo | `meta.prototipoId` (`p2026…`) diventa `blueprint_variant_code` in advanced | `accogli-pacchetto.mjs:60` | FATTO VERIFICATO |
| Dipendenze | **nessuna dichiarazione di dipendenza** dall'edizione dei cataloghi (ESCO 1.2.1, ATECO 2025, NACE 2.1 sono nomi di schema, non edizioni con data), né da un pacchetto precedente salvo `perimetro.estendeVersione`. Il campo `strategia.dipendenze` è dominio (dipendenze dell'impresa), non tecnica | schema: nessun campo `edizione`; `grep "edizion"` vuoto | FATTO VERIFICATO |
| Ordinamento | lo schema non impone un ordine di caricamento; l'ordine lo impone il caricatore con la lista `DOMINI` (packages, context, sites, units, positions, …, perimeters, process_steps) e la sorgente di costruzione ordina le unità topologicamente | `definizione-pacchetto.mjs` (47 domini, estratti con grep); `blueprint-build-source.ts:150-166` | FATTO VERIFICATO |
| Controlli d'integrità oltre lo schema | advanced aggiunge i limiti delle colonne più stretti dello schema (SHA esadecimale, ore 0-168, decimali, lunghezze, una sede in una sola entità, voce di perimetro unica) | `convalida-pacchetto.mjs:51-96` | FATTO VERIFICATO |
| Contenuti che D-72 promette e lo schema v0.3 non ha | **cruscotti tipici, porte di ricompensa, famiglia e stato «pubblicato», peso economico, fatturato; `seniority` dei ruoli** (richiesta M2-M6 di advanced) | `.programmi/esiti-onda0/RICHIESTA_datastore_attivazione.md` §«Che cosa deve arrivare»; ricerca nello schema v0.3: nessuna di queste chiavi | FATTO VERIFICATO |

**Manca del tutto**: un identificativo dell'istanza di pacchetto (numero di versione e impronta del contenuto dentro il pacchetto), un manifesto delle edizioni di catalogo da cui dipende, una firma. Il datastore sa firmare le edizioni del blueprint in prosa (`POST /v1/blueprint/edizioni`, `apps/api/src/servizio.ts:2882`), non il pacchetto JSON.

## 2. Identità del template e identità dell'istanza del tenant; mappatura degli identificativi

| aspetto | che cosa esiste | evidenza | classe |
|---|---|---|---|
| Template nel datastore | `datastore_bench_prototype` (codice `p2026…`) → `datastore_bench_package` (versioni 1..n, impronta del contenuto) | `src/fascicoli/estensione.ts:57-63`; `banco_pacchetto.ts:502-508` | FATTO VERIFICATO |
| Template in advanced | famiglia → variante (codice = `prototipoId`) → versione di variante (uuid). Il caricatore crea **sempre** una famiglia nuova (predefinita `PACCHETTO_DATASTORE`), una variante, e la versione **numero 2 in DRAFT** (la 1 la crea un trigger) | `accogli-pacchetto.mjs:31`, `57-61` | FATTO VERIFICATO |
| Istanza del tenant | `sys_tenant_blueprints` (il fascicolo del tenant, con versioni ancorate a una `variant_version_id`) e `sys_blueprint_activations` (attivazione della **variante**, una sola ACTIVE per tenant) | `tenant-blueprints/campi-bloccanti.ts:41-46`; `blueprint-activations/service.ts:3`, `42-47` | FATTO VERIFICATO |
| Mappatura template → righe del tenant | per **codice**, con `ON CONFLICT (tenant, code) DO NOTHING` su unità, posizioni, competenze; gli indicatori del modello diventano `sys_kpi_definitions` per tenant | `tenant-materialization/repository.ts:158`, `194`, `260`, `323` | FATTO VERIFICATO |
| Collisioni | (a) **fra due pacchetti**: la famiglia fissa `PACCHETTO_DATASTORE` fa fermare il secondo caricamento («la famiglia c'è già», riga 57) se non si passa un nome diverso a mano; (b) **fra indicatori**: il caricatore scrive definizioni di piattaforma con codice `<prototipoId>.<codice>` e `tenant_id` nullo (`accogli-pacchetto.mjs:86-95`), quindi due versioni dello stesso prototipo collidono sullo stesso codice; (c) **nel catalogo del perimetro**: la chiave è `(versione, schema, codice)` | righe citate; `convalida-pacchetto.mjs:92-94` | FATTO VERIFICATO (a, c); INFERENZA (b: non ho letto il vincolo d'unicità di `sys_kpi_definitions`) |
| Uuid che attraversano i database | nessun uuid del datastore entra in advanced: il legame è per codice. **Nel verso opposto sì**: il datastore cita l'uuid del tenant RTL Bank scritto nel codice (`TENANT_RTL = "86ba7a65-…"`) e legge `heuresys_advanced` (anche la produzione, sulla 5433, con due condizioni d'ambiente) | `heuresys-datastore/apps/api/src/rtl_lettura.ts:28`; `apps/api/src/servizio_rtl.ts:21-58`; `src/config/config.ts:417-422` | FATTO VERIFICATO |
| Dipendenza fra database | ADR-0043 scarta la lettura del datastore da parte di advanced (§«Opzioni scartate»). La dipendenza **inversa** esiste: il servizio RTL del datastore (porta 3104) legge 31 tabelle `sys.*` di advanced, fra cui `sys_users` e `sys_user_contracts` del tenant | `rtl_lettura.ts` (grep delle tabelle: 31 nomi distinti) | FATTO VERIFICATO |

**Solo progettato**: il perimetro del tenant come unione dei perimetri delle versioni PUBLISHED delle attivazioni ACTIVE, senza copia per tenant (ADR-0046 §1). **Manca**: una chiave stabile che leghi la versione di variante di advanced alla coppia (prototipo, `bench_package_version_no`) del datastore; oggi il legame è `variant_code = prototipoId` più `dossier_version`, che è `varchar(32)` in advanced (`db/migrations/000458_*.sql:35`) mentre lo schema lo vuole intero.

## 3. Ciclo di vita

| fase | datastore | advanced | classe |
|---|---|---|---|
| Preparazione | cascata di 31 passi (`src/passi/forma_del_banco.ts:150-155`), passo `pacchetto` che compone, mette il ventaglio (`ventaglio.ts`, `mettiIlVentaglio`) e valida; deposito con dedup per impronta (`banco_pacchetto.ts:480-541`) | — | FATTO VERIFICATO |
| Validazione | Ajv 8.20.0 sullo schema della versione + regole V3-00 ÷ V3-14 che **marcano senza rifiutare** (`src/contratto/regole_v03.ts`, 15 codici trovati) | Ajv sullo schema della versione + limiti delle colonne, **rifiutano** (`convalida-pacchetto.mjs:99-105`); della serie V3 la rilettura ricalcola solo V3-01 (priorità), V3-03 (un DECIDE), V3-06 (ore) (`regole-di-ritorno.mjs:1-12`) | FATTO VERIFICATO |
| Pubblicazione | **non esiste un gesto «pubblica il fascicolo»**. Il vocabolario dei verbi non ne ha nemmeno una riga `dichiarato` (`docs/04_impianto/27_IL_VOCABOLARIO_DEI_VERBI.md`, grep «fascicol»: solo `GET /v1/blueprint` e `POST /v1/fascicoli/:prototipo/estensioni`) | lo stato PUBLISHED di una versione di variante **non lo scrive nessuna rotta** di `apps/api` (grep di `blueprint_variant_version_status`: solo letture); lo scrivono le migrazioni o il gesto dell'operatore `attiva-modello.mts --pubblica-sulla-copia` (`attiva-modello.mts:162-171`) | FATTO VERIFICATO |
| Distribuzione (come arriva fisicamente) | il pacchetto si legge con `GET /v1/banco/pacchetto?prototipo=&versione=` (`servizio.ts:3531`), servizio in ascolto solo su `127.0.0.1` e Tailscale (D-84) | il caricatore prende **un percorso di file JSON** come argomento (`accogli-pacchetto.mjs:7-9`, `prova-giunzione.sh:13`). Nessun canale definito fra i due: i pacchetti di prova di O2-02 stavano in una cartella di lavoro del PC (`.programmi/onda2/esiti/O2-02.md`, «Prove»). La «porta a consumo» del datastore è rimandata al cancello dell'onda 4 (`DOMANDE_APERTE.md`, coda delle decisioni dell'11 ottobre) | FATTO VERIFICATO (assenza del canale); NON DISPONIBILE (trasporto) |
| Importazione | — | `accogli-pacchetto.mjs carica`, una transazione, solo inserimenti, ANALYZE dopo il commit, esito JSON (`:51-108`); solo su `*_prova<N>` | FATTO VERIFICATO |
| Attivazione | — | tre strade che materializzano: (1) `POST /v1/tenant-materialization` (PLATFORM_ADMIN, `service.ts:50`), (2) effetto di approvazione `TENANT_BLUEPRINT_APPLICATION` (con registro dell'origine, `approvals/effects/tenant-blueprint-application.ts:154`), (3) `tenants/provisioning.ts:115` e `:140` (tenant nuovo + attivazione nella stessa transazione) | FATTO VERIFICATO |
| Aggiornamento | `POST /v1/fascicoli/:prototipo/estensioni`: 201 con la versione nuova, 409 se non si parte dall'ultima, 422, 404; tocca solo `perimetro` e `meta`, verificato per impronta di sezione (`estensione.ts:48-140`) | **nessuna strada**: il caricatore si ferma se la famiglia esiste (`accogli-pacchetto.mjs:57`) e scrive sempre la versione numero 2; non sa aggiungere la versione 3 a una variante esistente | FATTO VERIFICATO |
| Ritiro | archiviazione delle corse del banco (`POST /v1/banco/corse/archivia`, `servizio.ts:3985`) | `scarica` toglie le righe di un pacchetto solo su una copia (`accogli-pacchetto.mjs:240-253`); attivazioni con finestra di validità e `DELETE /v1/blueprint-activations/:id` (`blueprint-activations/routes.ts:39-40`). **Il profilo legge l'unione di tutte le versioni PUBLISHED della variante attiva** (`lib/scope/profilo.ts:87-101`): una voce tolta in una versione nuova resta visibile finché la vecchia resta PUBLISHED | FATTO VERIFICATO |
| Errori | `ErroreDiDomanda` → 400 con la ragione, il resto 500 con frase stabile; rollback (`servizio.ts:2945-2972`) | esito `errore` con messaggio, ROLLBACK (`accogli-pacchetto.mjs:255-256`); `ConflictError` con codici `BLUEPRINT_CONTENT_EMPTY` / `_INCOHERENT` / `_MISSING` (`blueprint-build-source.ts`) | FATTO VERIFICATO |

## 4. Idempotenza, deduplicazione, transazioni, ripresa, retry, concorrenza, risultati parziali

| aspetto | datastore | advanced | classe |
|---|---|---|---|
| Idempotenza | stesso pacchetto, stessa impronta → risponde con la versione esistente, `nuova: false` (`banco_pacchetto.ts:520-522`) | `carica` **non è idempotente**: la seconda corsa si ferma sulla famiglia esistente (errore, non «già fatto»). La materializzazione sì: `ON CONFLICT DO NOTHING` + conti `skipped` (`tenant-materialization/service.ts` e `repository.ts:114`) | FATTO VERIFICATO |
| Deduplicazione | per impronta del contenuto | per famiglia/variante; dentro il pacchetto, voce di perimetro e attore di commessa unici (`convalida-pacchetto.mjs:75-94`) | FATTO VERIFICATO |
| Transazione | `scrivendo()` begin/commit/rollback; il registro dei caricamenti scrive sul pool, fuori dalla transazione, per sopravvivere al rollback (`servizio.ts:2938-2972`) | `carica`: BEGIN … COMMIT, ROLLBACK nel `catch` (`:56`, `:103`, `:256`); materializzazione e applicazione in `withTransaction` | FATTO VERIFICATO |
| Ripresa dopo interruzione | la cascata riparte dai passi mancanti (G2 «ripresa», `esecuzione/STATO_CORRENTE.md` punto 0) | **nessuna**: o tutto o niente; dopo un errore si rilancia da capo | FATTO VERIFICATO (datastore da documento, advanced da codice) |
| Retry | — | nessun retry nel caricatore | FATTO VERIFICATO |
| Concorrenza | `SELECT … FOR UPDATE` sulla testata del prototipo per numerare le versioni (`banco_pacchetto.ts:537-541`) | nessun blocco esplicito; due `carica` paralleli sulla stessa famiglia: uno fallisce sull'unicità o sul controllo di riga 57 | FATTO VERIFICATO (datastore); INFERENZA (advanced) |
| Risultati parziali | il passo `pacchetto` produce v0.2 o v0.3 secondo i passi disponibili; le sezioni senza materia sono «dichiarate vuote» con il motivo | sezione dichiarata vuota = zero righe senza errore; `perimeter_status` `NON_RILASCIATO` se il perimetro non ha voci (`definizione-pacchetto.mjs:40-41`); la statistica `ANALYZE` corre dopo il commit e non è nella transazione | FATTO VERIFICATO |
| Prova in CI | `pnpm run fatto` (prove del contratto, del ventaglio, dell'estensione: `tests/contratto_v03*.test.ts`, `ventaglio.test.ts`, `fascicolo_estensione.test.ts`) | **il caricatore non è in nessuna CI**: nessun file di `.github/workflows/` né di `apps/` lo cita; le prove sono script manuali sul gemello (`prova-o2-02.sh`, ultimo giro `ok=111 rossi=0` in `.programmi/onda2/esiti/O2-02_prova.txt`) | FATTO VERIFICATO |

## 5. Personalizzazioni del tenant

| aspetto | che cosa esiste | evidenza | classe |
|---|---|---|---|
| Attributi bloccati | `CAMPI_BLOCCANTI`: ATECO del tenant e versione di modello ancorata; tre classi (bloccanti, rivedibili dal consulente, rivedibili dal cliente aprendo una versione nuova), origine della modifica `PLATFORM` / `CLIENTE` / `RICERCA` | `tenant-blueprints/campi-bloccanti.ts:13-46` | FATTO VERIFICATO |
| Override | `PUT /v1/blueprint-overrides` (`blueprint:override`) | `blueprint-overrides/routes.ts:27-28` | FATTO VERIFICATO (rotta); contenuto non letto |
| Voci proprie (estese) | stessa tabella del catalogo con colonna del tenant valorizzata (ADR-0039 regola 3, confermata da ADR-0043 regola 4); il modo «B canonico» esiste solo su `sys_skills` nel censimento di ADR-0042 | `docs/architecture/adr/0042_catena_del_semilavorato.md` §2 | FATTO VERIFICATO (da ADR) |
| Ereditati / modificabili | dopo la materializzazione le righe sono del tenant e si modificano con il CRUD ordinario; non c'è un marcatore «ereditato da versione X, campo modificato dal tenant» per campo: c'è solo `materialized_from` nel metadata della competenza e il registro `sys_generated_record_origins` (scritto dalla sola strada dell'approvazione) | ADR-0042 §2 (28 righe RTL con `materialized_from` nullo, registro a zero righe al momento della misura); `tenant-blueprint-application.ts:154` | FATTO VERIFICATO (da ADR e codice) |
| Arrivo di una versione nuova | **non progettato in modo esplicito.** ADR-0042 dichiara l'invariante «una rigenerazione non tocca le righe del cliente» e la attribuisce a `ON CONFLICT DO NOTHING`: una voce **cambiata** nel modello non arriva mai al tenant, una voce **tolta** resta. Il confronto `tenant-blueprints/diff.ts` dichiara l'impatto sull'azienda già costruita `computable: false` (`diff.ts:24-30`). Il profilo invece cambia subito, perché legge tutte le versioni PUBLISHED (`profilo.ts:87-101`) | righe citate | FATTO VERIFICATO (meccanismo); INFERENZA (effetto su una personalizzazione) |

**Manca**: una politica scritta per campo (eredita / sovrascrive / conserva) quando arriva una versione nuova del fascicolo; ADR-0042 stesso dice che la prova sul caso generale (supersessione con override presente) non esiste.

## 6. Compatibilità v0.2 / v0.3, anteprima delle differenze, controlli prima dell'applicazione, recupero

| aspetto | che cosa esiste | evidenza | classe |
|---|---|---|---|
| Additività | prova «ADDITIVA» nei due sensi: ogni definizione v0.2 resta nella v0.3, le sole differenze di contenuto sono sei punti dichiarati | `docs/04_impianto/31_IL_CONTRATTO_DATI_V03.md` §«Che cosa aggiunge»; `tests/contratto_v03.test.ts` | FATTO VERIFICATO (documento e presenza del test; test non eseguito) |
| Conversione | `converti_v03.ts` (pura, dichiara vuoto ciò che manca); `deposito_banca_v03.ts` aggiunge le sole derivazioni senza modello. Il deposito della banca in v0.3 è avvenuto **nel database del datastore** il 2026-10-19 (3.522 voci di perimetro, schema valido, zero regole marcate) | `esecuzione/onda1/_misure/S08_DEPOSITO_BANCA.txt` | FATTO VERIFICATO (esito depositato) |
| Doppia lettura in advanced | il caricatore accetta v0.2 e v0.3; un v0.2 non tocca le colonne nuove; regressione v0.2 provata | `definizione-pacchetto.mjs:1-4`, `O2-02.md` voce V10 | FATTO VERIFICATO |
| Anteprima delle differenze | datastore: `GET /v1/banco/pacchetti/confronto?prototipo=&da=&a=` (`servizio.ts:3548`). Advanced: `diff.ts` (modello / decisioni / impatto non calcolabile) e l'anteprima del piano `BuildPlanPreview` con `warnings` (W0-A1, #265) | righe citate | FATTO VERIFICATO |
| Controlli prima dell'applicazione | piano costruito prima di aprire la transazione (`tenant-materialization/service.ts:52-55`): albero delle unità, tipi d'unità, posizioni collocate, categoria delle competenze (`blueprint-build-source.ts:187-240`). **Il piano non verifica lo stato PUBLISHED**: su una versione DRAFT è stato accettato (`.programmi/esiti-onda0/prova-giunzione/attiva_prima.json`: `stato DRAFT`, `piano.accettato: true`) | righe e file citati | FATTO VERIFICATO |
| Recupero | `scarica` sulla copia; inverse fuori catena delle migrazioni (`db/scripts/onda2/000458-inversa.sql`, `inversa-000456.sql`); nel datastore ogni pacchetto resta per versione | `O2-01.md` voce V4; `accogli-pacchetto.mjs:240` | FATTO VERIFICATO |
| Contenuti v0.3 usati a valle | la materializzazione legge **solo** unità, posizioni, competenze, indicatori (`blueprint-build-source.ts:187-195`); le sezioni v0.3 non arrivano al tenant finché non si fa O2-06 (mandato non eseguito) | `.programmi/onda2/O2-06_materializzazione-v03-e-catena.md` | FATTO VERIFICATO |

## 7. Autenticazione, autorizzazione, isolamento, audit, correlation id, osservabilità

| aspetto | datastore | advanced | classe |
|---|---|---|---|
| Autenticazione | **nessuna**: `identitaDelChiamante()` restituisce la costante «Amministratore di Sistema» (`apps/api/src/involucro.ts:68-70`); protezione solo di rete (127.0.0.1 e Tailscale, D-84) | sessioni e credenziali in `sys_auth_*` (I7); CSRF sulle rotte che scrivono | FATTO VERIFICATO |
| Autorizzazione del passaggio | nessuna sul lato che consegna | il caricamento non passa dall'API: chi ha le credenziali del database del gemello carica (`PGPASSWORD` da `.env`, `prova-giunzione.sh:28-34`). La materializzazione: `tenant_materialization:execute` = solo PLATFORM_ADMIN (`tenant-materialization/routes.ts:42-48`, `service.ts:41-46`) | FATTO VERIFICATO |
| Isolamento del tenant | il datastore non ha tenant; ma il servizio RTL legge i dati di un tenant di advanced (righe di persone, contratti, obiettivi: `rtl_lettura.ts:122-164`) | il tenant di destinazione arriva dall'input ed è verificato ACTIVE (`service.ts:57-62`); le tabelle `sys_blueprint_content_*` sono di piattaforma, senza `tenant_id` | FATTO VERIFICATO |
| Audit | `datastore_meta.datastore_call` per ogni verbo avvolto (chi, che cosa, esito, durata, costo); `datastore_meta.datastore_load` per i caricamenti | il caricatore scrive solo un esito JSON su file; la strada «approvazione» scrive `sys_generated_record_origins`, la strada diretta `POST /v1/tenant-materialization` **restituisce** i `records` ma il servizio non li registra (`service.ts:77-94`) | FATTO VERIFICATO |
| Correlation id | non trovato (`grep correlation\|x-request-id` vuoto in `apps/api/src`) | `x-request-id` generato o propagato (`apps/api/src/middleware/requestId.ts`) | FATTO VERIFICATO |
| Correlazione fra i due | **nessuna**: nessun identificativo comune lega la chiamata del datastore che produce il pacchetto, il file e il caricamento in advanced | — | NON DISPONIBILE |

## 8. Invarianti dopo l'importazione, dipendenze mancanti, completezza funzionale

| aspetto | che cosa esiste | evidenza | classe |
|---|---|---|---|
| Equivalenza | `rileggi` ricostruisce il pacchetto dalle righe e lo confronta per percorso e per intero (W0-A1: 257/257; O2-02: zero percorsi diversi sui tre pacchetti di prova) | `.programmi/esiti-onda0/prova-giunzione/rileggi.json`; `O2-02.md` | FATTO VERIFICATO (esiti depositati) |
| Conteggi | `conta-righe-v03.mjs` confronta righe per tabella con il JSON (17 tabelle) | `O2-02.md` §Esito | FATTO VERIFICATO |
| Sentinelle | `db_health.py` e le viste `sys.v_*` (per esempio `v_processi_senza_kpi`, che il caricatore soddisfa scrivendo indicatori di piattaforma) | `definizione-pacchetto.mjs:9-12` | FATTO VERIFICATO |
| Dipendenze mancanti | nel datastore V3-07 verifica i riferimenti interni (non le competenze delle capability e dei ruoli, limite dichiarato nel documento 31); in advanced la presenza delle voci del perimetro nei cataloghi di advanced **non è controllata** da nessuno; CP2021 manca nel datastore (dichiarato in `vuoti` come `perimetro.CP2021`) mentre advanced ne ha 1.502 nodi | `ventaglio.ts:103`; `esecuzione/onda1/_misure/S07_PARITA.md` §2-3 | FATTO VERIFICATO |
| Completezza funzionale | per attivare un modello mancano ancora M2 (cruscotti), M3 (porte), M4 (stato pubblicato), M5 (peso economico: 109 posizioni su 109 a zero), M6 (identità del fascicolo letta da nessuno) | `RICHIESTA_datastore_attivazione.md`; `prova-giunzione/attiva.json` | FATTO VERIFICATO |
| Pacchetto vero in advanced | il pacchetto v0.3 della banca **non è mai stato caricato in advanced**: O2-02 è chiuso in `WAIT-INPUT` sul pacchetto vero e ha provato su un pacchetto costruito dallo schema | `O2-02.md` §«Che cosa non si chiude» | FATTO VERIFICATO |

---

## Tabella produttore / consumatore / gap per sezione del pacchetto v0.3

«Caricata» = il caricatore la scrive e la rilegge (`definizione-pacchetto.mjs`, prova O2-02). «Consumata» = un modulo di `apps/api/src` la legge a tempo di esecuzione (grep del nome della tabella in `apps/api/src`, oggi). Il produttore è il passo della cascata (`src/passi/passo_<nome>.ts`, rotte `POST /v1/passi/<nome>`); la corrispondenza passo → sezione per i passi non citati nel codice di composizione è **INFERENZA** dal nome.

| sezione | produce nel datastore | tabella in advanced | chi la consuma in advanced | stato |
|---|---|---|---|---|
| `meta` | passo `pacchetto` (`composizione_del_pacchetto.ts`) | `sys_blueprint_content_packages` | nessun modulo API | prodotta, caricata, non consumata |
| `contesto` | passi `ateco`, `classe` | `sys_blueprint_content_context` | nessuno (M6) | prodotta, caricata, non consumata |
| `prove` | passo `prove` | `_evidence`, `_evidence_links`, `_evidence_gaps` | nessuno | prodotta, caricata, non consumata |
| `sedi` | ingresso del prototipo / `POST /v1/prototipi/sedi` (INFERENZA) | `_sites`, `_process_sites` | nessuno | prodotta, caricata, non consumata |
| `ccnl` | passi `ccnl`, `inquadramento`, `condizioni` | `_ccnl`, `_ccnl_levels`, `_ccnl_institutes`, `_ccnl_conditions` | `hierarchy-levels/repository.ts` (solo `_ccnl_levels`) | prodotta e consumata in parte |
| `unita` | passi `unita`, `organigramma` | `_units`, `_unit_processes` | `tenant-materialization`, `hierarchy-levels`, `research` | prodotta e consumata (`_unit_processes` no) |
| `posizioni` | passi `organigramma`, `ruoli`, `copertura` (INFERENZA) | `_positions`, `_position_processes`, `_position_occupations`, `_position_skill_requirements`, `_position_responsibilities` | `tenant-materialization`, `hierarchy-levels`, `research` (solo `_positions`) | prodotta e consumata in parte |
| `competenze` | passo `skill` | `_skills` | `tenant-materialization`, `research` | prodotta e consumata |
| `processi` | passi `processi`, `fasi` | `sys_blueprint_process_registry`, `_process_steps` (fasi) | `tenant-blueprints` (`diff.ts`, `derivation.ts`) per il registro; `_process_steps` nessuno | prodotta e consumata in parte |
| `indicatori` | passi `metriche`, `derivati`, `bersagli` | `_kpis` + `sys_kpi_definitions` (tenant nullo) + `sys_process_kpi_templates` | `tenant-materialization`, `research` | prodotta e consumata |
| `obiettivi` | passo `obiettivi` | `_goals` | nessuno | prodotta, caricata, non consumata |
| `obblighi` | passo `obblighi` | `_obligations`, `_obligation_positions` | nessuno | prodotta, caricata, non consumata |
| `formazione` | passo `formazione` | `_training`, `_training_positions`, `_training_skills` | nessuno | prodotta, caricata, non consumata |
| `carriere` | passo `carriere` | `_career_paths`, `_career_steps` | nessuno | prodotta, caricata, non consumata |
| `incentivi` | passo `incentivi` | `_incentives`, `_incentive_links` | nessuno (le porte `sys_reward_gate_catalog` non le scrive il caricatore: M3) | prodotta, caricata, non consumata |
| `commesse` | passo `commesse` | `_engagements`, `_engagement_links` | nessuno | prodotta, caricata, non consumata |
| `vuoti` | passo `pacchetto` | `_gaps` | nessuno | prodotta, caricata, non consumata |
| `derivazioni` | passo `pacchetto` + `derivazioni_v03.ts` | `_derivations` | nessuno | prodotta, caricata, non consumata |
| `strategia` | passo `strategia` | `_strategies`, `_strategy_items` | nessuno | prodotta, caricata, non consumata |
| `capability` | passo `capability` | `_capabilities`, `_capability_links` | nessuno | prodotta, caricata, non consumata |
| `ruoli` | passo `mestieri` (`composizione_del_pacchetto.ts:475`, `:507`) | `_job_roles`, `_job_role_links` | `lib/scope/profilo.ts` legge `_job_roles` | prodotta e consumata in parte (`_job_role_links` no) |
| `decisioni` | passo `decisioni` | `_decisions`, `_decision_rights` | nessuno | prodotta, caricata, non consumata |
| `entita` | **nessun passo**: solo dall'ingresso del prototipo, altrimenti dichiarata vuota (`composizione_del_pacchetto.ts:520-525`) | `_legal_entities` | nessuno | caricabile, né prodotta in modo stabile né consumata |
| `agenti` | passo `agenti` | `_agents`, `_agent_links` | nessuno | prodotta, caricata, non consumata |
| `principi` | passo `principi` | `_design_principles` | nessuno | prodotta, caricata, non consumata |
| `perimetro` | `ventaglio.ts` (passo `pacchetto`) e `POST /v1/fascicoli/:prototipo/estensioni` | `_perimeters` (il gruppo sta nel `metadata`, non in colonna) + `perimeter_status` sul pacchetto | nessuno: `perimetro.ts`, il cancello esteso e `check_perimetro_tenant.py` sono progettati (ADR-0046, PROPOSTO) e non esistono | prodotta, caricata, non consumata |
| `cruscotti` (non è nello schema) | nessuno | `_dashboards` (mig. 000397) | `lib/scope/profilo.ts` | **consumata non prodotta** |
| porte di ricompensa (non nello schema) | nessuno | `sys_reward_gate_catalog` | modulo `compensation` (censimento §1) | **consumata non prodotta** |
| stato PUBLISHED, famiglia (non nello schema) | nessuno | `sys_blueprint_variant_versions.status`, `sys_blueprint_families` | `profilo.ts`, `diff.ts`, `derivation.ts` | **consumata non prodotta** (gesto a mano sulla copia) |

Lettura d'insieme: di 26 sezioni, 4 arrivano davvero al tenant (unità, posizioni, competenze, indicatori), 3 sono lette in parte da moduli secondari (ccnl, processi, ruoli), 19 si fermano nelle tabelle di modello. Tre oggetti che advanced legge non li produce nessuno.
