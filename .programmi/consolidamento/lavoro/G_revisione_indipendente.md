# G — Revisione indipendente del programma di consolidamento

2026-10-23, notte. Revisore indipendente, sola lettura (nessun file modificato nei due repository, nessun commit, nessuna connessione a un database). Oggetto: `.programmi/consolidamento/01_RILIEVI.md`, `02_ARCHITETTURA.md`, `03_PIANO.md` di heuresys-advanced, con le fonti in `lavoro/`. Il mandato era contestare, non confermare: quello che segue elenca prima ciò che regge, poi ciò che non regge.

Le righe citate sono state lette nei cloni `/home/user/heuresys-advanced` (HEAD `2706044`) e `/home/user/heuresys-datastore` alla data di questo documento. Ciò che non ho potuto misurare (stato della produzione, copie sul motore del PC) è segnato **non verificato**.

---

## 1. Ricontrollo dei rilievi nel codice (11 rilievi)

| rilievo | esito | evidenza letta | nota del revisore |
|---|---|---|---|
| R-01 canale assente | **CONFERMATO** | advanced `db/scripts/pacchetto/accogli-pacchetto.mjs:28` (prende un percorso di file); datastore `apps/api/src/servizio.ts:3530-3540` (`GET /v1/banco/pacchetto`); nessun riferimento incrociato | — |
| R-02 il pacchetto non porta la propria identità | **PARZIALE** | schema v0.3 `meta.required = [schema, prototipoId, creatoIl, lingueBase, lingue]`, `meta.additionalProperties = false`; datastore `src/carico/banco_pacchetto.ts:116` (`improntaJson`) e `:496-541` (versione e impronta restano nel datastore) | Una versione **esiste già** nel pacchetto: `perimetro.fascicoloVersione` (schema v0.3, riga 2499-2506), e advanced la registra (`000458:35`, `blueprint_content_package_dossier_version`). Il rilievo la ignora, e il piano rischia di introdurre una **terza** numerazione accanto a `bench_package_version_no` e a `fascicoloVersione`. |
| R-03 caricatore da laboratorio | **CONFERMATO** | `accogli-pacchetto.mjs:30` (guardia `_prova\d*$`), `:57` (si ferma se la famiglia c'è), `:61` (versione 2 DRAFT fissa); nessun workflow in `.github/workflows/` lo cita | In più: la famiglia predefinita è unica (`PACCHETTO_DATASTORE`, riga 31), quindi anche **un secondo prototipo** diverso viene rifiutato, non solo una seconda versione. |
| R-04 indicatori di piattaforma senza tenant | **CONFERMATO** | `accogli-pacchetto.mjs:94-95` (`kpi_definition_tenant_id NULL`, `is_global true`) | Il rilievo omette la riga 98: scrive anche `sys_process_kpi_templates` con FK verso quelle definizioni, letta dal modulo `process-kpi-templates`. Togliere la prima scrittura senza decidere la seconda rompe il caricatore. |
| R-05 PUBLISHED non lo scrive nessuno; la costruzione accetta DRAFT | **PARZIALE** | `attiva-modello.mts:46-60` (non `:162-171`: il file ha 114 righe); `.programmi/esiti-onda0/prova-giunzione/attiva_prima.json` (`stato: DRAFT`, `piano.accettato: true`); nessun controllo di stato in `tenant-materialization/service.ts` | La seconda metà è confermata. La prima è **smentita**: PUBLISHED lo scrive il trigger `sys_blueprint_variant_ensure_version` (`000298:78-95`) a ogni nuova variante, quindi anche la rotta `POST /v1/blueprint-variants` (`blueprint-variants/repository.ts:79`) e il caricatore stesso; e lo scrive la migrazione `000400:88-95` a ogni deploy. Il numero di riga citato è sbagliato. |
| R-06 il profilo unisce tutte le PUBLISHED | **CONFERMATO** | `apps/api/src/lib/scope/profilo.ts:87-101`; ADR-0046 riga 42 | Il rilievo è giusto, la cura proposta no: vedi §3.2. |
| R-07 nessuna politica per le personalizzazioni | **CONFERMATO** | `tenant-materialization/repository.ts:158, 194, 260` (`ON CONFLICT … DO NOTHING`); `tenant-blueprints/diff.ts:24-30` (`IMPACT_NON_CALCOLABILE`) | La riga 323 citata non contiene un `ON CONFLICT` (è l'accumulo dei KPI creati): evidenza imprecisa, sostanza confermata. |
| R-08 tre strade, una registra l'origine | **CONFERMATO** | `approvals/effects/tenant-blueprint-application.ts:154` è l'unica `INSERT INTO sys.sys_generated_record_origins`; `tenant-materialization/service.ts:74` e `tenants/provisioning.ts:115` non la scrivono | Il provisioning crea l'attivazione legata alla **variante**, perdendo la versione usata (`provisioning.ts:126-145`): è la radice di §3.2. |
| R-20 il datastore legge il database di advanced | **CONFERMATO, gravità sottostimata** | datastore `apps/api/src/servizio_rtl.ts:21-58` (interruttore verso la produzione), `apps/api/src/rtl_lettura.ts:113-164` (`sys_users.user_display_name`, `sys_user_contracts` livello e CCNL per persona), `src/config/config.ts:417-422`, `scripts/piano034/dump_produzione_20261010.sh` | Non sono «31 tabelle»: lo script fa un `pg_dump -Fc` **dell'intera produzione**, e il datastore tiene database interi `heuresys_advanced_20260819` e `_20261010` sul suo motore. Dentro ci sono `sys_auth_credentials`, `sys_auth_mfa_factors`, `sys_auth_mfa_recovery_codes`, `password_reset_tokens` e le anagrafiche con IBAN (`000164`). È materia di credenziali e GDPR, non solo di confine architetturale. Presenza attuale delle copie: **non verificata** (PC non raggiungibile da qui). |
| R-21 informazione che esiste solo in advanced | **CONFERMATO (campione CP2021)** | datastore: CP2021 compare solo come valore di vocabolario e come colonna `bench_role_cp2021_code` (`db/migrations/0158:212, 438`), nessun caricatore in `src/carico/`; advanced `000206` ha il catalogo | Le altre famiglie (formazione, porte, traduzioni LLM/MANUAL) non sono state ricontrollate una per una. |
| R-30 sei letture di catalogo senza permesso | **CONFERMATO** | `job-families/routes.ts:25-32` (GET senza `preHandler`), così anche `skill-families:27`, `skill-categories:25`, `skill-taxonomy-edges:24`, `skill-aliases:22`, `skill-proficiency-levels:13`; nessun filtro di perimetro nei loro service (`perimetroDiCatalogo` usato solo da `job-roles`, `semantic-matching`, `hierarchy-levels`) | Sono cataloghi, non dati personali: MEDIA è corretta. Ma la cura «metterle dietro un permesso» rischia di rompere le pagine dei dipendenti che le usano come liste di scelta: la cura giusta è il perimetro (ADR-0046), non un permesso. |
| R-13, R-22 (controllo a campione) | **CONFERMATI** | `000458:35-36` (`varchar(32)`); `NACE_REV_2_1` in `000007:43`/`000032`, `CP_2021` in `000206:12`, `CP2021`/`NACE_2_1` in `000458:361` | — |

Bilancio: 8 confermati, 3 parziali, 0 smentiti in toto. Il registro è affidabile nella sostanza; tre evidenze hanno numeri di riga o di file sbagliati (R-05, R-07, R-20 per difetto), e va corretto prima di diventare la base di un ADR.

---

## 2. Rilievi gravi mancanti

**M-01 (ALTA, produzione) — Il primo caricamento in produzione fa fallire il deploy successivo.**
`000400` non è marcata `@migrate: once` e la catena si ri-applica intera a ogni deploy (`db/scripts/migrate.sh:63-90`). La sua post-condizione (`000400`, blocco `n_versioni`, righe ~236-245) fa `RAISE EXCEPTION` se le versioni PUBLISHED **in tutto il database** non sono esattamente 2 (banca e HEURESYS). Ogni nuova variante riceve dal trigger una versione 1 PUBLISHED (`000298:78-95`): basta quindi che C3 carichi **un** pacchetto in produzione, o che qualcuno crei una variante dalla rotta, perché il deploy dopo si fermi. Con C4 (pubblicare la versione 2 e ritirare la 1) il conto resta 3. Il piano non lo nomina. Correzione: emendare la post-condizione di `000400` alla propria responsabilità («la variante `MGMT_CONSULTING_SMALL` ha esattamente una PUBLISHED»), come ha già fatto `000301`, **prima** di qualunque caricamento in produzione; e aggiungere a C3 la prova «catena ri-applicata dopo il caricamento» (`ci-rehearsal.sh` sul gemello dopo un `carica`).

**M-02 (ALTA, integrità del modello) — Le migrazioni scrivono contenuto nelle versioni a ogni deploy, e lo risolvono per stato.**
`000398` sceglie la versione della banca come «la PUBLISHED della variante attivata da RTL_BANK» e vi inserisce ruoli e cruscotti (`000398:39-57, 105, 170`); `000400` fa lo stesso per HEURESYS (`:180-190`); `000401` invece per numero (`:116-122`, versione 1). Se un giorno la variante della banca riceve una versione 2 dal datastore e la si pubblica, `000398` scriverà a ogni deploy nella versione 2 — quella che `02_ARCHITETTURA.md` §2 dichiara «copia pubblicata, immutabile, nessuno la modifica» — e `000401` continuerà a scrivere nella 1 ritirata. Correzione: le varianti nate dalle migrazioni (banca, HEURESYS) vanno dichiarate «versione 1 di migrazione», e le migrazioni che vi scrivono vanno emendate a risolvere per **numero 1**, non per stato; oppure marcate `once`. Senza questo, «immutabile» è falso per costruzione.

**M-03 (ALTA, prodotto e isolamento del tenant) — L'attivazione non fissa una versione.**
`sys_blueprint_activations` ha solo `blueprint_activation_variant_id` (`000008:75`), nessuna colonna di versione; il fascicolo del tenant invece si ancora a una versione (`000299:47-48`, `tenant_blueprint_version_variant_version_id`, e `pinModel` richiede PUBLISHED: `tenant-blueprints/service.ts:356`). ADR-0046 riga 117 parla già di «attivazione portata a una versione»: presuppone una colonna che non c'è. Con «una sola PUBLISHED per variante» + «il profilo legge la PUBLISHED in vigore», pubblicare una versione nuova **cambia nello stesso istante il perimetro di ogni tenant attivo su quella variante**, RTL Bank compresa, senza anteprima e senza il consenso del tenant. È l'opposto del criterio 2 del piano («la personalizzazione resta, con l'impatto mostrato prima») e della ragione stessa della `000298` («sei sulla versione 1, ne esiste una più nuova»).

**M-04 (ALTA, conflitto con decisioni prese) — La pubblicazione è assegnata al datastore da ADR-0043 e da D-72.**
ADR-0043 (accettato), tabella, riga 14: «il datastore produce anche famiglia e stato pubblicato (#264 M4)»; D-72: «tutto ciò che serve ad attivare un modello nato dal pacchetto lo produce il datastore … famiglia e stato "pubblicato" … Advanced non ricava niente da sé»; ADR-0043 punto 6: le funzioni di piattaforma escono da advanced. Il piano (C4, C12) mette invece in advanced un gesto «pubblica» di PLATFORM_ADMIN e una console «carica, differenze, pubblica, costruisci». Può essere la scelta giusta, ma è un **emendamento** di un ADR accettato e di una decisione di Enzo: va detto come tale in ADR-0047, non derivato in silenzio. Non è delegabile come «raccomandazione tecnica».

**M-05 (ALTA, dati personali) — Il flusso inverso «archivia con impronta» conserva credenziali e anagrafiche.**
Vedi R-20: le copie sono database interi di produzione. «Archiviare con impronta e poi togliere» (02 §3, C8) lascia un archivio con hash di password, fattori MFA, codici di recupero, IBAN, fuori dal perimetro di produzione. La destinazione corretta è la **distruzione** delle copie (gesto di Enzo, con verbale), o al più la conservazione cifrata con una scadenza decisa da Enzo/DPO; e, prima ancora, la verifica che le credenziali copiate non siano più valide (rotazione se le copie sono uscite dalla VM). In più la proiezione proposta (unità, posizioni) deve escludere `position_economic_weight` e ogni conteggio sotto soglia: nel tenant HEURESYS, con poche persone, una posizione identifica una persona e il suo peso economico ne rivela la retribuzione.

**M-06 (MEDIA) — «v0.3.1 additiva» non lo è per lo schema v0.3.**
`meta.additionalProperties = false` nello schema v0.3: un pacchetto con `meta.pacchetto` è **rifiutato** da qualunque convalidatore v0.3. La regola di 02 §3 punto 6 («una minore è additiva e il caricatore la accetta») è vera solo se il caricatore sceglie lo schema dal `meta.schema` e possiede già la v0.3.1. Va scritto così, e provato: pacchetto v0.3.1 contro convalida v0.3 → rifiuto atteso e dichiarato.

**M-07 (MEDIA) — L'impronta canonica deve essere una sola, definita una volta.**
Il datastore ha già `jsonCanonico`/`improntaJson` (`banco_pacchetto.ts:104-117`) e la usa come chiave d'idempotenza (`bench_package_content_hash`). Il piano definisce un'impronta «senza `meta.pacchetto`» da ricalcolare in un `.mjs` di advanced. Due implementazioni della canonicalizzazione (ordinamento delle chiavi, `undefined`, numeri) divergeranno. Serve un vettore di prova condiviso nel contratto (file + impronta attesa) che entrambi i lati devono riprodurre, e la stessa definizione usata dal datastore per la sua idempotenza.

**M-08 (MEDIA, dipendenze nascoste) — C9 non dipende solo da C3 e C4.**
O2-06 dipende da F2-F5 (`.programmi/271-onda2-advanced.md:15-16`), cioè da O2-03, O2-04, O2-05, che il piano di consolidamento non cita e che aggiungono migrazioni. C3 (vincolo d'unicità, tabella d'esito), C4 (indice parziale), C11 (vincolo dei moduli formativi) e O2-03…O2-05 si contendono `db/migrations`: la frase «una sessione per volta» non basta, serve un ordine scritto dei numeri di migrazione fra i due programmi. Inoltre C3 riscrive il caricatore che O2-02 ha appena consegnato: va dichiarato come evoluzione di O2-02, con le sue prove (`prova-o2-02.sh`) che restano verdi.

**M-09 (MEDIA) — C11 non regge senza emendare la `000237`.**
Il vincolo `sys_learning_modules_code_uq` lo crea `000237:66-75` «se non esiste»: toglierlo a valle lo fa rinascere al deploy successivo (ADR-0035). Va emendato il file sorgente e, poiché quel vincolo era un «sigillo» contro i doppioni d'importazione, sostituito esplicitamente dall'unicità composta già presente (`000061:76`).

**M-10 (MEDIA) — Le versioni RETIRED ancorate.**
C4 dice «la costruzione rifiuta DRAFT» ma non dice cosa fa con una versione RETIRED a cui un fascicolo del tenant in approvazione è ancorato (`tenant-blueprint-application.ts`, `research/repository.ts:723`). Va deciso: costruire da una RETIRED è lecito (il tenant ha firmato quella) oppure no.

**M-11 (BASSA) — Percorsi del canale a file.** «I due progetti vivono sulla stessa VM» è vero per il deposito, non per il database di lavoro del datastore finché D-85 è aperta (D-83: il passaggio non è fatto). E il caricatore di advanced che legge da `~/heuresys-datastore/_pubblicazioni/…` deve ricevere il percorso come parametro (regola «niente percorsi assoluti»).

---

## 3. Le scelte architetturali di 02

### 3.1 Canale a file con manifesto — **REGGE CON CORREZIONE**
Regge: nessuna credenziale condivisa, ispezionabile, coerente con D-78 (onda 3 «si chiude con il canale a file») e con il rinvio della porta a consumo all'onda 4. Correzioni: (a) il manifesto è «firmato per impronta», cioè non firmato: un'impronta dentro lo stesso file non prova l'origine. Su una sola VM con lo stesso utente è accettabile, ma va scritto come limite e non chiamato firma; (b) impronta unica e vettore di prova condiviso (M-07); (c) una sola numerazione: la «versione del pacchetto» del manifesto **è** `bench_package_version_no`, e `perimetro.fascicoloVersione` deve coincidere o essere dichiarata altra cosa (R-02 parziale); (d) il verbo `POST …/consegna` scrive su disco da un servizio senza autenticazione applicativa: il codice di prototipo va validato contro la regex già esistente (`codiceDelBanco`) prima di diventare un percorso; (e) regola di conservazione della cartella scritta in C2, non rimandata.

### 3.2 Pubblicazione esplicita, una sola PUBLISHED per variante, RETIRED della precedente — **NON REGGE nella forma proposta**
Cosa romperebbe, misurato sul codice:
1. il deploy, per la post-condizione di `000400` (M-01), già al primo caricamento;
2. l'immutabilità della versione ricevuta, per `000398`/`000400` che scrivono nella PUBLISHED a ogni deploy (M-02);
3. il controllo del tenant sul proprio modello: senza versione sull'attivazione, una pubblicazione cambia insieme il perimetro di tutti i tenant della variante, e il recupero «ripubblica la 2» li rimuove tutti insieme (M-03);
4. la coerenza con ADR-0043 riga 14 e D-72, che danno lo stato pubblicato al datastore (M-04).
Il trigger della `000298` in sé non viene rotto (crea una v1 PUBLISHED vuota, che la prima pubblicazione ritira), ma lascia ogni variante nuova con una versione «in vigore» vuota fino alla pubblicazione: va dichiarato, e i test che creano varianti (5 file, `000298` commento) vanno rieseguiti.

Alternativa: **la versione si fissa sull'attivazione**. Migrazione additiva `blueprint_activation_variant_version_id` (nullable, riempita con la PUBLISHED più alta della variante per le attivazioni esistenti, cioè la v1 di banca e HEURESYS); il profilo e il perimetro si risolvono su quella versione (con ripiego sull'unione di oggi solo dove è nulla, per compatibilità); PUBLISHED significa «disponibile per l'adozione», e possono coesistere più PUBLISHED; il passaggio di un tenant a una versione nuova è un gesto per tenant, preceduto dall'anteprima di C6 (`diff.ts`), che è esattamente ciò che il criterio 2 del piano chiede. RETIRED significa «non più adottabile», non «non più in vigore per chi la usa». Chi pubblica (datastore che dichiara, advanced che registra) lo decide Enzo in ADR-0047 (M-04). L'indice parziale «una PUBLISHED per variante» non serve più.

### 3.3 Correzione di ADR-0046 «sola PUBLISHED in vigore» — **NON REGGE; regge la variante «versione fissata dall'attivazione»**
Per le ragioni di 3.2. ADR-0046 si può approvare stanotte **solo** sostituendo la riga 42 con: «il perimetro di un tenant è quello della versione fissata dalle sue attivazioni ACTIVE nella finestra di validità; dove l'attivazione non fissa una versione vale, in via transitoria, la regola di oggi». Approvarlo con la correzione di 02 §4 incorporerebbe nell'ADR il difetto M-03.

### 3.4 Flusso inverso come proiezione senza dati personali — **REGGE CON CORREZIONE**
Il principio è giusto e chiude R-20. Correzioni: (a) distruggere, non archiviare, le copie intere (M-05), e verificare la rotazione delle credenziali se le copie sono uscite dalla VM; (b) la guardia della proiezione per classe di dato (`sys_classificazione_direzione_dato`) va affiancata da una **lista di colonne ammesse** (allow-list), non solo da un'esclusione: una colonna nuova non classificata passerebbe; (c) escludere peso economico e conteggi sotto soglia (M-05); (d) l'esportazione è uno strumento di piattaforma: farla girare come script sul gemello/VM, non come rotta nuova di advanced (ADR-0043 punto 6); (e) finché C8 non è chiuso, spegnere l'interruttore `DATASTORE_RTL_FONTE=produzione` è un gesto a costo zero e reversibile che il piano dovrebbe proporre subito a Enzo.

### 3.5 Politica delle personalizzazioni (ereditato / conservato / segnalato / fuori modello) — **REGGE CON CORREZIONE**
È la politica corretta, e coerente con D-73 («segnala e non blocca»). Ma oggi non è attuabile: per distinguere «ereditato» da «modificato dal tenant» serve sapere da quale versione e con quale valore è nata ogni riga, e oggi l'origine la registra una sola strada su tre (R-08). Quindi C6 dipende da **C5 e dalla versione sull'attivazione** (3.2), non solo da C4; e serve una prima fotografia del valore ereditato (in `sys_generated_record_origins` o accanto) per le righe già materializzate, altrimenti RTL Bank partirà con tutto «non classificabile». «Fuori modello» va realizzato come marca, mai come cancellazione (giusto nel testo; da tenere nella prova).

---

## 4. Il piano 03

**Ordine.** Va cambiato in un punto: C5 (una sola strada che registra l'origine) e la migrazione della versione sull'attivazione devono precedere C4 e C6. L'emendamento della post-condizione di `000400` (M-01) e delle migrazioni che scrivono nelle versioni (M-02) diventa un incremento **C3a** che precede ogni caricamento in produzione.

**Dipendenze da aggiungere.** C9 ← O2-03, O2-04, O2-05 (M-08); C6 ← C5 + attivazione con versione; C7 ← ADR-0046 approvato nella forma di 3.3; C12 ← decisione su M-04; C3 ← C3a; C11 ← emendamento della `000237`.

**Criteri di accettazione.** Buoni (ogni prova vista rossa prima, PASS/FAIL/NON ESEGUITO con comando). Da aggiungere: (1) «dopo un caricamento, la catena ri-applicata sul gemello (`ci-rehearsal.sh`) resta verde»; (2) «pubblicare una versione nuova non cambia il perimetro di un tenant che non l'ha adottata»; (3) «il datastore non conserva copie di database di advanced» misurato con l'elenco dei database del suo motore, non solo con un controllo statico sul codice; (4) il criterio 1 dice «costruisce in un tenant di prova»: in un ambiente unico di produzione (I15) un tenant di prova è un tenant di produzione, quindi va dichiarato dove (copia usa-e-getta sul gemello) e con quale persona del tenant si fa la dimostrazione dal vivo richiesta da ADR-0026.

**Sicuro stanotte, in autonomia, senza scrivere in produzione:**
- C0 (correzioni documentali), e la correzione delle evidenze di R-05, R-07, R-20 in `01_RILIEVI.md`;
- C1 nel datastore (cartella `v0.3.1`, vettore di prova dell'impronta, prove), con la definizione dell'impronta allineata a `improntaJson`;
- C5 come codice e prove su database usa-e-getta (nessuna migrazione);
- bozze di ADR-0047 e ADR-0048 in stato **PROPOSTO**, che includano M-03 e M-04 come domande esplicite;
- lo script di confronto di C10 eseguito su una copia sul gemello (cataloghi, nessun dato personale);
- C13 per le parti che non tolgono pagine;
- la prova rossa di M-01 (caricare un pacchetto su una copia usa-e-getta, poi ri-applicare la catena: atteso rosso su `000400`), che trasforma l'inferenza di questa revisione in misura.

**Deve aspettare Enzo:**
- approvazione di ADR-0046 se non nella forma di 3.3; approvazione di ADR-0047/0048 (emendano ADR-0043 riga 14 e D-72: non è una raccomandazione tecnica, è una sua decisione);
- ogni migrazione rilasciata (C3a, C3, C4, C11) e il primo caricamento in produzione;
- la distruzione delle copie dei database di advanced e lo spegnimento dell'interruttore verso la produzione nel datastore;
- `leads/`, unione del ramo `interfaccia-unica`, uscita delle pagine (C12);
- S5, S6.

---

## 5. Verdetto

**APPROVABILE CON CORREZIONI.** Il registro dei rilievi è sostanzialmente esatto e la tesi (consegna, ricevimento, confine) è giusta. Non è approvabile così com'è la parte di 02/03 sulla pubblicazione, che romperebbe il deploy e toglierebbe ai tenant il controllo della versione.

Correzioni obbligatorie, prima che il piano si consideri approvato:
1. **C3a nuovo, prima di ogni caricamento in produzione**: emendare la post-condizione di `000400` (conteggio globale delle PUBLISHED) e risolvere per numero, non per stato, le scritture di `000398`/`000400`/`000401` nelle versioni (M-01, M-02); prova sul gemello con catena ri-applicata dopo un caricamento.
2. **Sostituire «una sola PUBLISHED per variante» con la versione fissata sull'attivazione** (3.2); riscrivere C4 di conseguenza; togliere l'indice parziale.
3. **ADR-0046**: approvare solo con la formulazione di 3.3; altrimenti lasciarlo PROPOSTO.
4. **ADR-0047 dichiara l'emendamento di ADR-0043 riga 14 e di D-72** (chi produce lo stato pubblicato) e resta PROPOSTO fino a Enzo (M-04).
5. **C8**: distruzione, non archiviazione, delle copie intere; allow-list delle colonne della proiezione; esclusione del peso economico e dei conteggi sotto soglia; proposta immediata a Enzo di spegnere `DATASTORE_RTL_FONTE=produzione` (M-05).
6. **C1**: v0.3.1 dichiarata non leggibile da un convalidatore v0.3 (M-06); impronta unica con vettore di prova condiviso (M-07); una sola numerazione di versione (R-02).
7. **Dipendenze**: C9 ← O2-03/04/05; C6 ← C5 + versione sull'attivazione; ordine scritto dei numeri di migrazione fra consolidamento e onda 2 (M-08).
8. **C11**: emendare la `000237` alla fonte (M-09). **C3**: decidere la sorte di `sys_process_kpi_templates` insieme a R-04.
9. **Registro**: correggere le evidenze di R-05 (file e righe, e «nessuno scrive PUBLISHED» è falso), R-07 (riga 323), R-20 (dump intero, credenziali).
