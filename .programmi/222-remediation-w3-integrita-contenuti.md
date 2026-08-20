# 222 — Remediation forense W3 · Integrità e contenuti dei cataloghi

> **item**: #222 · **priorità**: P2 · **stima**: ~150-250k token (multi-sessione)
> **stato**: IN CORSO
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
- [ ] **F3 Le traduzioni ATECO che ci sono già e nessuno vede** — budget ~35k · rilievo `F6-01`
      EN e DE sono **già** in `activity_classification_metadata`: costo di acquisizione zero,
      basta portarle dove il prodotto le legge — `sys_reference_translations` — e registrare i
      campi in `sys_translatable_field`.
      **fatto =** `pnpm i18n:check` verde **e** le traduzioni visibili da un endpoint `/v1/*`
      (→ cancello di esposizione, #79: un dato che nessuna API espone non è nel prodotto).
- [ ] **F4 Gli URI contraffatti e i canonici nella lingua sbagliata** — budget ~45k · rilievi `F6-03`, `F6-02`
      · `F6-03` — 70 URI ESCO che **sembrano** ESCO e non lo sono → namespace `CUSTOM::`.
        **Prima si misura chi li referenzia**: rinominarli senza guardare rompe i riferimenti.
      · `F6-02` — 103 canonici in inglese che portano una «traduzione» italiana identica
        all'originale, cioè un campo tradotto che non traduce.
      **fatto =** 0 URI contraffatti sotto il namespace ESCO + 0 traduzioni-copia, con i
      referenti aggiornati e misurati.
- [ ] **F5 I codici settore e il grafo delle competenze** — budget ~45k · rilievi `F6-04`, `F6-07`
      · `F6-04` — 5 codici settore ancora ATECO 2007 in `sys_industry_codes` → 2025.
      · `F6-07` — 286 competenze da ricollegare partendo dagli archi tassonomici già presenti, e
        84 isolate da curare una per una. **Le 84 non si risolvono in blocco**: se una competenza
        è isolata davvero, l'esito giusto può essere lasciarla isolata e dirlo.
      **fatto =** 0 codici 2007 + il conteggio delle isolate spiegato riga per riga.
- [ ] **F6 Il canale unico ruolo↔occupazione** — budget ~40k · rilievo `F2-01`
      Oggi il legame passa da **due** strade — 64 FK e 111 righe di metadata — che non si
      sovrappongono su nemmeno un caso (misurato: 0 sovrapposti su 176 ruoli). Due canali disgiunti
      per lo stesso concetto sono la premessa di una divergenza: si consolidano in uno.
      **fatto =** un solo canale, 176 ruoli coperti, nessuna perdita di legame misurata prima/dopo.
- [ ] **F7 Le ridondanze vere e le pulizie basse** — budget ~30k · rilievi `F6-09`, `F6-10`, `F1-05`, `F1-08`, `F1-09`
      Per ultime perché sono le meno rischiose e le più facili da rimandare senza danno.
      · `F6-09` — 4 ridondanze **vere** (pattern in `mappa_competenze_rimosse.csv`): «vere»
        perché il dossier ne aveva contate di più e la misura le ha ridotte a quattro.
      · `F6-10` tipografia · `F1-05` colonne morte · `F1-08` indici mai usati (**ri-misurare
        `idx_scan` prima**: un indice inutile su un contatore azzerato dal restart non è inutile)
        · `F1-09` tipi incoerenti.
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
