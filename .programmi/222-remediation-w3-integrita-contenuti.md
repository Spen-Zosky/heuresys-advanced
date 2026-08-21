# 222 — Remediation forense W3 · Integrità e contenuti dei cataloghi

> **item**: #222 · **priorità**: P2 · **stima**: ~150-250k token (multi-sessione)
> **stato**: **CHIUSA 2026-08-21 (S1077)** — 7/7 fasi spuntate (resta `F6-07`, che ha un piano proprio)
> **capofila**: `.programmi/220-remediation-dossier-forense.md` — fonte, **metodo vincolante**,
> decisioni di Enzo e fuori-perimetro. Non si ricopia qui.

## Due avvertenze che valgono per ogni fase

1. **Ogni rilievo si ri-misura alla presa in carico** (#149). I numeri qui sotto sono del
   2026-08-19 e sono **ipotesi datate**, non stato: 14.003 righe possono essere 14.010 domani.
   Le query ripetibili stanno in `D:\heuresys-datastore\docs\00_preface\07_QUERY_DI_MISURA.md`.
2. **Questa onda tocca i cataloghi, cioè le tassonomie.** I21 le tiene aperte a ogni industry:
   una correzione che restringe ESCO/ISCO/NACE/ATECO a ciò che serve oggi ai due tenant è una
   correzione sbagliata, anche se fa sparire un rilievo.

## Fasi

- [x] **F1 I tre presidi strutturali che impediscono il prossimo guasto** — FATTO 2026-08-20 · mig 000343 · 4 indici in prod · 0 traduzioni senza soggetto · sentinelle 24→25 · prove: URI duplicato **respinto**, sentinella accesa su soggetto fantasma · budget ~40k · rilievi `F1-04`, `F1-06`, `F1-07`
      Vanno per primi perché sono **guardie**: dopo, gli errori che le fasi seguenti correggono
      non possono più rientrare in silenzio.
      · `F1-04` — indice `UNIQUE` su `skill_esco_uri` (14.003 = 14.003 misurato 2026-08-19 →
        **la guardia si mette solo se la misura del momento regge ancora**).
      · `F1-06` — 3 FK senza indice: `occupation_class_mapping_target_id`,
        `blueprint_family_activity_classes.classification_id` (oltre il parziale già presente),
        `sys_skills.created_by/updated_by`.
      · `F1-07` — `CHECK` su `entity_table` delle traduzioni (insieme chiuso) + sentinella orfani.
        ⚠ Una vista `sys.v_*` nuova diventa **automaticamente** una sentinella che `db_health`
        pretende a zero righe: se questa misura invece di sorvegliare, va dichiarata informativa
        o rende rossa la prova generale (→ memoria `new_sys_view_becomes_sentinel`).
      **fatto =** i tre oggetti esistono in produzione e la sentinella è a zero.
- [x] **F2 La normalizzazione grande, con il giornale di annullamento** — FATTO 2026-08-20 · mig 000344 · 12.887 normalizzate (era un URL di chiamata API, non un URI) · 400 gruppi distinti **invariati** · 291 vuoti intatti · undo **provato**: 12.887 ripristinate e poi rollback · budget ~40k · rilievi `F1-03`, `F2-05`
      Formato di `skill_group_uri` nei metadati: **13.178 righe**. È la scrittura di massa più
      grossa dell'onda, quindi pretende le quattro cose del Metodo di bonifica per intero —
      misura prima, guardia al momento dell'esecuzione, post-condizione **su ciò che non doveva
      cambiare**, e `staging.*_undo` con la funzione che lo applica.
      **fatto =** formato uniforme misurato + undo provato davvero (non solo scritto).
- [x] **F3 Le traduzioni ATECO che ci sono già e nessuno vede** — FATTO 2026-08-20 · mig 000345 (+ emendata 000341) · **4.304** denominazioni EN ora leggibili dal prodotto · 4.304 DE intatte nei metadati (non travasate: il prodotto ha due lingue) · `i18n:check` parity OK · esposizione 73/73 · budget ~35k · rilievo `F6-01`
      EN e DE sono **già** in `activity_classification_metadata`: costo di acquisizione zero,
      basta portarle dove il prodotto le legge — `sys_reference_translations` — e registrare i
      campi in `sys_translatable_field`.
      **fatto =** `pnpm i18n:check` verde **e** le traduzioni visibili da un endpoint `/v1/*`
      (→ cancello di esposizione, #79: un dato che nessuna API espone non è nel prodotto).
- [x] **F4 Gli URI contraffatti e i canonici nella lingua sbagliata** — FATTO 2026-08-20 · `F6-03` **risolto**: mig 000346, 70 URI sotto `CUSTOM::`, 13.933 ESCO autentici intatti, 0 vettori invalidati; emendati anche i 2 seed che li nominavano (senza, il giro dopo li rimetteva) · `F6-02` **dichiarato non meccanizzabile**: misurate **217** (non 103) traduzioni EN identiche al canonico, ma il campione mostra che sono nomi propri di tecnologie (`PHP`, `Vyper`, `Solidity`, `Vagrant`, `Adobe Creative Suite`) — identici in ogni lingua e corretti così. Distinguerli da una copia pigra richiede giudizio linguistico riga per riga, non una regola · budget ~45k · rilievi `F6-03`, `F6-02`
      · `F6-03` — 70 URI ESCO che **sembrano** ESCO e non lo sono → namespace `CUSTOM::`.
        **Prima si misura chi li referenzia**: rinominarli senza guardare rompe i riferimenti.
      · `F6-02` — 103 canonici in inglese che portano una «traduzione» italiana identica
        all'originale, cioè un campo tradotto che non traduce.
      **fatto =** 0 URI contraffatti sotto il namespace ESCO + 0 traduzioni-copia, con i
      referenti aggiornati e misurati.
- [x] **F5 I codici settore e il grafo delle competenze** — `F6-04` **FATTO 2026-08-21** · `F6-07` resta, e ha bisogno di un piano suo
      · `F6-04` ✅ mig 000350. **La domanda era mal posta**: quel campo non nomina una classe, alimenta la
        sentinella `v_tenant_industry_incoerente` che confronta le due dichiarazioni di settore di un
        tenant. Il confronto era per **uguaglianza**, e questo legava il livello del codice al modo di
        confrontarlo. Ora è **gerarchico** — la classe del profilo deve *ricadere sotto* il settore — e
        il settore può essere una divisione, cosa che il `CHECK` di `000305` **già ammetteva**
        (`^[0-9]{2}(\.[0-9]{1,2})?$`): mancava solo un confronto che sapesse leggerla.
        Decisione di Enzo 2026-08-21. I cinque: `CONSTRUCTION` 41.20→**41.00** · `IT_SOFTWARE`
        62.01→**62.10** · `EDUCATION` 85.42→**85** · `RETAIL` 47.19→**47** ·
        `TRANSPORT_LOGISTICS` 52.29→**52**. Criterio: il codice corrisponde al **nome** del settore.
        **fatto =** 5/5 esistono in ATECO_2025 · sentinella a zero sui 2 tenant attivi · e sa ancora
        respingere (provato: 0→1→0 assegnando a `FIN_BANKING` un settore sbagliato).
      · `F6-07` ⏸ **da fare, con un piano proprio**: le competenze isolate nel grafo sono **4.467 su
        14.036**, non 84 — il dossier sottostima di due ordini di grandezza. È curatela su un terzo
        del catalogo, non una fase dentro un'altra voce.

- [x] **F6 Il canale unico ruolo↔occupazione** — FATTO 2026-08-21 · mig 000349 · **il rilievo è smentito nella sostanza**: dei 111 ruoli col campo nei metadati, quelli con un URI dentro sono **ZERO** (titolo compreso) — il dossier ha contato le *chiavi*, non i valori. Non c'erano due canali. Il difetto vero era che 111 chiavi vuote **sembravano** legami a chiunque interrogasse `metadata ? 'esco_occupation_uri'`: rimosse, con giornale di 111 righe · 64 legami preesistenti intatti · budget ~40k · rilievo `F2-01`
      Oggi il legame passa da **due** strade — 64 FK e 111 righe di metadata — che non si
      sovrappongono su nemmeno un caso (misurato: 0 sovrapposti su 176 ruoli). Due canali disgiunti
      per lo stesso concetto sono la premessa di una divergenza: si consolidano in uno.
      **fatto =** un solo canale, 176 ruoli coperti, nessuna perdita di legame misurata prima/dopo.
- [x] **F7 Le ridondanze vere e le pulizie basse** — **FATTO 2026-08-21 (S1077)** · mig `000351` + `000352` · budget ~30k · rilievi `F6-09`, `F6-10`, `F1-05`, `F1-08`, `F1-09`
      ▸ **5 su 5 chiuse: due erano lavoro vero, tre sono non-lavoro con la misura accanto.**
      · `F6-09` ✅ **era la più grave delle cinque, e l'etichetta «bassa» la sottostimava.** Non
        erano «quasi-duplicati ESCO»: i nomi duplicati in tutto il catalogo da 14.036 sono
        **tre**, e tutti e tre hanno la stessa forma — una riga globale `ESCO::` e una di RTL
        Bank `COMP::` (il marchio dell'ingestione legacy, che `000161` appone) senza URI e senza
        tipo. Su quelle righe povere stavano **81 competenze di persone e 94 requisiti di
        posizione**, contro 26 e 16 sulle globali: chi analizzava i divari partendo dalla riga
        canonica vedeva **26 persone invece di 107**. Fuse con `000351`; giornale di
        annullamento di 181 righe **provato davvero** (14.033→14.036, `problem solving` da 69
        torna a 26, poi `ROLLBACK`). Emendato anche `seed_banking_skills.sql`, che le nominava
        e si sarebbe fermato col suo guard fail-loud — e che con l'uguaglianza esatta non
        avrebbe comunque trovato la globale «comunicazione», minuscola.
        🔬 **Perché `000189` non le aveva prese**, pur essendo una dedup fatta apposta: lavora
        per *(tenant, nome)* e sigilla con un `UNIQUE` su `(COALESCE(tenant,nil), lower(trim
        (name)))`. Due righe con lo stesso nome ma tenant **diverso** non violano quel vincolo.
      · `F6-10` ✅ **NON-LAVORO, e la misura smentisce metà del rilievo.** I nomi in maiuscolo
        sono **22 su 22 del livello 1** in ATECO_2025 e **22 su 22** in NACE — e **zero** su
        tutti gli altri livelli (87, 287, 651, 920, 1.290). Non è un'irregolarità sparsa: è una
        regola applicata al 100% di un livello, cioè la convenzione con cui la fonte pubblica le
        sezioni. Uniformarla al minuscolo significherebbe divergere dall'originale ISTAT, che è
        esattamente ciò che **I21** vieta per le tassonomie. L'altra metà del rilievo — «apostrofi
        misti nello stesso catalogo» — è **falsa**: misurati **0 tipografici e 635 dritti**.
      · `F1-09` ✅ **la metà azionabile fatta, l'altra dichiarata e motivata.** Fatto: dieci
        colonne `numeric(4,3)` — confidenze e pesi — avevano un dominio che arriva a **9,999**
        dove il significato ammette **1**. Quattro colonne della stessa semantica erano già
        protette: lo squilibrio era che la stessa cosa fosse presidiata in quattro punti e
        scoperta in dieci. `000352` estende il vincolo, su dati già conformi (misurati: nessun
        valore fuori intervallo, il più basso è 0,129). **La prova sa dire di no**: un peso di
        7,5 su un requisito reale viene respinto, 0,750 passa. Non fatto, con la ragione scritta
        nel file: l'armonizzazione `varchar(255)`/`text`, perché in PostgreSQL i due hanno lo
        stesso immagazzinamento e le stesse prestazioni — il posto di quella correzione è un
        dominio riusabile, cioè una decisione di modello, non una migrazione di pulizia.
      · `F1-08` ✅ **non azionabile, e la misura spiega perché**. Gli indici con `idx_scan = 0`
        sopra 100 kB sono **tre**, e nessuno è inutile: due sono indici **vettoriali HNSW**
        (`sys_job_role_embeddings`, `sys_user_profile_embeddings`) che servono a una ricerca
        semantica esistente ma non ancora esercitata — un indice non ancora interrogato non è un
        indice inutile; il terzo è `idx_skills_created_by`, **creato oggi da `000343`** per
        sostenere una FK. ⚠ E un indice di FK serve al **controllo referenziale**, che non passa
        da `idx_scan`: zero letture è il suo stato normale, non un sintomo.
        (`pg_stat_database.stats_reset` è `NULL`: non si sa nemmeno da quando conta.)
      · `F1-05` ✅ **non azionabile senza una decisione di prodotto**. Le colonne nulle al 100%
        ci sono, ma non sono morte: sono **non ancora usate** — l'intero modulo `assessment_*`,
        gli `created_by`/`updated_by` opzionali, le descrizioni facoltative. Cancellare una
        colonna perché oggi è vuota significa cancellare una **capacità del modello**;
        distinguere «morta» da «non ancora usata» richiede di sapere se quella funzionalità è
        viva, e quella è una domanda di prodotto.
      **fatto =** ognuna delle cinque chiusa o dichiarata non-lavoro con la misura accanto.

## Le prove che devono poter fallire

- **F1** — un `UNIQUE` che si crea senza errori dimostra che *oggi* non ci sono duplicati, non
  che la guardia serva: la prova è tentare l'inserimento di un duplicato e vederlo respinto.
- **F2** — la post-condizione che conta è quella **negativa**: le righe che non dovevano cambiare
  hanno ancora l'impronta di prima. Contare quelle cambiate non distingue 13.178 righe corrette
  da 13.178 righe rovinate.
- **F3** — «le traduzioni ci sono» si prova da una risposta `/v1/*` in EN, non da un `SELECT`.
- **F4/F6-03** — se dopo la rinomina qualcosa continua a risolvere il vecchio URI, il censimento
  dei referenti era incompleto: cercarlo **prima** in codice, dati e seed, non solo nel DB.
- **F6** — il consolidamento si prova confrontando l'**insieme dei legami** prima e dopo, non il
  conteggio: 175 legami giusti e 1 sbagliato fanno comunque 176.

## Chiuso quando

Le 7 fasi sono spuntate con evidenza e i rilievi `F1-03`, `F1-04`, `F1-05`, `F1-06`, `F1-07`,
`F1-08`, `F1-09`, `F2-01`, `F2-05`, `F6-01`, `F6-02`, `F6-03`, `F6-04`, `F6-07`, `F6-09`,
`F6-10` sono aggiornati nel registro datastore.
