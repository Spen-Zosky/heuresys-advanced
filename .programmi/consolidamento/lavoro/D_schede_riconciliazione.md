# D — Schede di riconciliazione fra advanced e datastore (famiglie omologhe)

Specialista «Database e analisi forense», 2026-10-23. Sola lettura sui due repository, nessun commit.

> **Stato effettivo del database: NON verificato.** Tutto ciò che segue è ricostruito dalle migrazioni (`heuresys-advanced/db/migrations`, 454 file fino a `000458`; `heuresys-datastore/db/migrations`, 160 file fino a `0160`, sola sezione `MIGRAZIONE:SU`) e dal codice. Nessun database vivo è stato interrogato. Le righe citate (conteggi) vengono dal censimento S1 del 2026-10-11 (gemello allo schema `000453`), non da una misura di oggi.

## 0. Come è stato prodotto, e i suoi limiti

| file | cosa contiene | comando che lo rigenera |
|---|---|---|
| `lavoro/strumenti/estrai_schema.py` | parser approssimato delle catene | — |
| `lavoro/C_schema_advanced.tsv` / `.json` / `_limiti.tsv` | un oggetto per riga: schema, oggetto, tipo, migrazione che crea, che alterano, drop, PK, FK, unique, colonne, commento | `python3 strumenti/estrai_schema.py --progetto advanced --migrazioni <advanced>/db/migrations --uscita C_schema_advanced` |
| `lavoro/C_schema_datastore.tsv` / `.json` / `_limiti.tsv` | idem per il datastore | `python3 strumenti/estrai_schema.py --progetto datastore --migrazioni <datastore>/db/migrations --uscita C_schema_datastore` |
| `lavoro/strumenti/analizza_anomalie.py` | rilievi strutturali e riferimenti nel codice | `python3 strumenti/analizza_anomalie.py --lavoro . --advanced <advanced> --datastore <datastore>` |
| `lavoro/C_anomalie.tsv`, `C_riferimenti_codice.tsv`, `C_tipi_omologhi.tsv` | rilievi, occorrenze testuali, tipi delle colonne omologhe | stesso comando |

**Controllo di taratura.** Il parser conta **250 tabelle `sys` vive create fino a `000453`**: è lo stesso numero che il censimento S1 ha misurato sul gemello allo schema `000453` («250 tabelle `sys`»). Più 29 di `000454` e 14 di `000458` = 293 tabelle `sys` vive oggi secondo le migrazioni. Datastore: 93 tabelle, 78 viste, 1 vista materializzata.

**Limiti del parsing (dichiarati anche nel docstring dello script).**
- Il DDL nei corpi di funzione non è seguito (gira solo se la funzione viene chiamata). Le partizioni mensili di `datastore_meta.datastore_audit` nascono da `datastore_fn_audit_manutieni()` e quindi **non compaiono** nel TSV.
- Nei blocchi `DO` il DDL statico si conta come eseguito **senza valutare le condizioni** (`IF NOT EXISTS ... THEN`).
- `EXECUTE format(...)` è risolto quando il parametro scorre un array di costanti, una lista `VALUES` o una lettura di `pg_tables` con filtro letterale: in advanced 267 risolti, 0 non risolti; nel datastore 4 risolti, 4 non risolti (tutti `ALTER DATABASE ... SET` e un vincolo `CHECK` dinamico in `0115`: nessuno crea o toglie oggetti).
- `DROP ... CASCADE` su una tabella non ritira le viste dipendenti; `DROP SCHEMA` ritira tutto lo schema.
- Le colonne delle viste non si ricavano (si riportano le relazioni lette in `FROM`/`JOIN`).
- Oggetti nati fuori dalla catena: `datastore_meta` (schema) e `datastore_meta.datastore_migration` li crea il runner (`src/db/migrazioni.ts`, `assicuraRegistro`), non una migrazione. Le tabelle temporanee (`CREATE TEMP TABLE`) sono escluse.
- ADR-0034: la catena di advanced è «schema sopra una base di dati» e non si applica su un database vuoto; per questo non ho potuto ricostruirla applicandola a un PostgreSQL usa-e-getta (manca anche `pgvector` nell'ambiente): la ricostruzione resta testuale.
- Le occorrenze nel codice (`C_riferimenti_codice.tsv`) sono testuali, parola intera, in `apps/`+`packages/` (advanced) e `apps/`+`src/` (datastore). **L'assenza di un riferimento testuale non prova l'inutilizzo** (nomi composti a runtime, uso da script, da trigger o da un altro repository); la presenza non prova l'uso.

## Legenda delle schede

Natura dell'oggetto: **CAT** catalogo · **TPL** blueprint/template · **PUB** versione pubblicata · **TEN** istanza tenant · **STO** copia storica/archivio · **PRJ** proiezione (vista) · **CACHE** derivato ricalcolabile · **LEG** residuo legacy.
Classificazione proposta: **SEP** mantenere separati · **ARR** arricchire · **TRA** trasformare · **SPO** spostare · **RIF** sostituire con riferimento o proiezione · **DIS** dismettere.
Il numero «ADR #n» rimanda alla riga della tabella di ADR-0043.

---

## S01 — Competenze (skills, gruppi, legami, famiglie, categorie, alias, livelli) — ADR #1, #4

**Oggetti**

| lato | oggetto | natura | note |
|---|---|---|---|
| adv | `sys.sys_skills` (13 col.) | CAT (tenant nullo) + TEN (voci proprie, tenant valorizzato) | `skill_esco_uri` unico **globale** (`uq_skills_esco_uri`, 000343); unico `(coalesce(tenant), skill_code)` e `(coalesce(tenant), lower(trim(name)))` |
| adv | `sys_skill_groups` | CAT | gerarchia ESCO dei gruppi (`skill_group_esco_uri` unico, `parent_id`) |
| adv | `sys_skill_taxonomy_edges` | CAT | archi `parent/child/kind` fra `sys_skills` |
| adv | `sys_skill_families` → `sys_skill_categories` → `sys_skills.skill_category_id` | CAT | tassonomia propria di advanced, senza colonna tenant |
| adv | `sys_skill_aliases`, `sys_skill_proficiency_levels` | CAT | alias per lingua (`locale varchar(16)`); 6 livelli con `rank` |
| adv | `sys_occupation_skill_requirements` | CAT | professione→competenza per URI (`relation varchar(16)`), FK solo verso `sys_skills` |
| adv | `sys_blueprint_content_skills`, `_position_skill_requirements`, `_training_skills` | TPL (pacchetto) | per codice, FK solo alla versione |
| adv | `sys_user_skills`, `sys_user_skill_evidence`, `sys_position_skill_requirements`, `sys_learning_gaps`, `sys_skill_gap_scores` | TEN | puntano a `skill_id` con FK: sono i consumatori da proteggere |
| adv | `audit.skills_junk_archive`, `audit.skill_dedup_archive` | STO | senza PK (CREATE TABLE AS) |
| ds | `datastore_core.datastore_concept` (classificazione ESCO) + `datastore_concept_skill` (`type`, `reuse_level`) | CAT | identità `(classification_version_id, concept_uri)`; più versioni ESCO convivono |
| ds | `datastore_concept_label`, `datastore_concept_description` | CAT | etichette e descrizioni per lingua e tipo, con affidabilità |
| ds | `datastore_concept_link` | CAT | legami qualificati (`type`, `confidence`, `authority`, `usage`, rilascio) |
| ds | `datastore_collection`, `datastore_concept_collection` | CAT | raccolte ESCO (verdi, digitali, trasversali…) |
| ds | `datastore_model.datastore_bench_skill`, `_skill_requirement`, `_role_skill` | TPL | contenuto del pacchetto |

**Corrispondenza attributo per attributo**

| advanced (`sys_skills`) | datastore | nota |
|---|---|---|
| `skill_esco_uri text` | `concept_uri text` (+ versione) | identità; in advanced non c'è la versione ESCO |
| `skill_code varchar(128)` | `concept_code text` | in advanced è un codice proprio, nel datastore il codice della fonte |
| `skill_name varchar(255)`, `skill_description text` (italiano) | `concept_label` (lang=it, kind=preferita), `concept_description` | il datastore ha alternative, nascoste e affidabilità: **solo datastore** |
| `skill_kind varchar(16)` (SKILL/KNOWLEDGE/COMPETENCE/BEHAVIOR/OTHER) | `concept_skill_type text` (sapere/saper fare) | vocabolari diversi: BEHAVIOR e OTHER non hanno corrispondente ESCO |
| `skill_group_id` → `sys_skill_groups` | `concept_link` (BROADER) verso gruppi, `concept_parent_uri` | stesso contenuto, forma diversa |
| `skill_category_id` → famiglie/categorie | nessuno (la categoria arriva col pacchetto) | **solo advanced** |
| `skill_is_global boolean` | implicito | duplica `tenant_id IS NULL` |
| — | `concept_skill_reuse_level`, collezioni | **solo datastore** |
| `skill_metadata jsonb` | 5 colonne di provenienza per riga (`*_source`, `*_source_version`, `*_acquired_at`, `*_content_hash`, `*_load_id`) | la provenienza in advanced sta, se c'è, nel jsonb |
| `sys_skill_aliases (label, locale)` | `concept_label` kind alternativa | gli 80 alias di advanced (censimento) possono essere propri e non ESCO: **da preservare** |
| `sys_skill_proficiency_levels` (6, con rank) | nessuno; il contratto v0.3 usa BASE/INTERMEDIO/AVANZATO mappati su BASIC/COMPETENT/EXPERT (`vocabolari.json`, `livelloCompetenza`) | **solo advanced**; la mappatura 3→6 perde il ritorno |

**Chiave naturale.** URI ESCO in entrambi: **coincide**, ma con una differenza di grana: advanced lo tiene unico in assoluto, il datastore unico per versione di classificazione. Il passaggio datastore→advanced deve fissare la versione ESCO (oggi v1.2.1 secondo il CLAUDE.md del datastore, non rimisurato).

**Proprietario / chi modifica / consumatori.** Oggi in advanced scrivono `reference-sync`, `research`, i moduli `skill-*` (`*_ADMIN_ONLY`) e le migrazioni di pulizia (000160, 000189, 000343, 000351, 000368, 000369); leggono 18 moduli (censimento). Nel datastore scrivono i caricatori `src/carico/esco.ts`, `collezioni.ts`, `descrizioni*.ts`; si pubblica in `datastore_pub`.

**Classificazione.** `sys_skills` di catalogo → **RIF** (resta solo il perimetro, scritto dal caricatore; ADR-0043 S4/S6). Voci con tenant → **SEP** (restano). Famiglie, categorie, alias propri, livelli → **ARR** il datastore prima del ritiro (ADR #4 «PARZ»: confermato, il datastore non ha né le famiglie né le categorie né i livelli). Archivi `audit.*` → **SEP** (storia, non catalogo).

**Rischi in fusione.** (1) Le voci di catalogo di advanced che non hanno URI ESCO (`skill_esco_uri` nullo, competenze bancarie scritte a mano: 000368/000369) non hanno chiave naturale nel datastore: la parità per URI le darebbe «mancanti» o, peggio, non le vedrebbe affatto; (2) gli alias e le etichette LLM/MANUAL; (3) `sys_occupation_skill_requirements.relation` (essential/optional) deve trovare posto in `concept_link_usage`/`type`; (4) l'unicità globale dell'URI impedisce a un tenant di tenere una copia propria di una competenza ESCO: è voluto (000351), ma va mantenuto anche dopo la commutazione.

---

## S02 — Professioni e occupazioni (ESCO, ISCO-08, CP2021) — ADR #2

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_occupation_classifications` (scheme `ISCO_08`/`CP_2021`, code, parent_code, level) + `_mappings` | CAT |
| adv | `sys_esco_occupation_mappings` (ruolo→URI ESCO, `isco_code varchar(16)`, confidence) | CAT (legame ruolo-occupazione) |
| adv | `sys_esco_occupation_embeddings` (URI, `isco_code text`, vettore) | CACHE |
| adv | `sys.sys_esco_isco_resolved` | PRJ (vista) |
| adv | `sys_positions.position_esco_occupation_uri text` | TEN, senza FK |
| adv | `sys_blueprint_content_position_occupations` | TPL |
| ds | `datastore_concept` (ESCO_OCC, ISCO), `datastore_concept_occupation` (`code`, `isco_group`, `regulated_note`), `datastore_concept_green_share`, `datastore_concept_link` | CAT |
| ds | `datastore_position.concept_id` (posizione tipica→occupazione), `datastore_bench_position.occupation_uris text[]`, `datastore_bench_role.esco_occupation_uri`, `cp2021_code` | TPL |

**Attributi.** `isco_code` è `varchar(16)` in `sys_esco_occupation_mappings`, `text` in `sys_esco_occupation_embeddings`, `text` (`concept_occupation_isco_group`) nel datastore. Il «regulated_note» e la quota verde esistono **solo nel datastore**; la confidenza della mappatura ruolo→occupazione esiste **solo in advanced** (il datastore non ha il ruolo di catalogo, S08).

**Chiave naturale.** URI ESCO per le occupazioni (coincide); codice ISCO-08 (coincide come stringa); CP2021: **in advanced c'è** (`sys_occupation_classifications` scheme `CP_2021`), **nel datastore no**: `src/carico/` non ha un caricatore CP2021 e `src/passi/passo_mestieri.ts` lo dice («La professione CP2021 resta nulla: l'archivio non la ha»), anche se il commento di `datastore_classification` lo nomina. È coerente con ADR #2 («completare… per primo CP2021»).

**Classificazione.** **ARR** il datastore con CP2021 e con le mappature ISCO↔CP2021 prima di qualunque ritiro; poi **RIF**. `sys_esco_occupation_embeddings` → S11. `position_esco_occupation_uri` → **SEP** (dato del tenant), ma oggi è un legame per URI non formalizzato.

**Rischi.** CP2021 è oggi informazione **solo di advanced**: un ritiro per «voce fuori da ogni perimetro» lo perderebbe. I tre vocabolari dello stesso schema (vedi A-03) rendono fragile ogni confronto automatico.

---

## S03 — Attività economiche (ATECO/NACE), settori e dimensione — ADR #3, #14 (famiglie)

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_activity_classifications` (scheme, code `varchar(32)`, parent_code, level) + `_mappings` (source/target, kind, confidence) | CAT; lo schema porta la versione nel nome (`ATECO_2025`, `NACE_REV_2_1`, …) |
| adv | `audit.activity_classification_legacy_archive`, `audit.activity_class_mapping_legacy_archive` | STO/LEG (000211) senza PK |
| adv | `sys_industry_codes` (`industry_code varchar(32)` PK, `industry_ateco_code varchar(16)`) | CAT di prodotto: i 12 settori dichiarabili (`FIN_BANKING` → `64.19`, …) |
| adv | `sys_tenancies.tenant_industry_code varchar(64)` FK → `sys_industry_codes` | TEN |
| adv | `sys_blueprint_families` (FIN_BANKING, MGMT_CONSULTING) + `sys_blueprint_family_activity_classes` | TPL |
| adv | `sys_industry_forbidden_terms` (per settore) | CAT di controllo (I21) |
| adv | `sys_enterprise_size_bands` (code, min/max addetti e fatturato), `sys_enterprise_typing_profiles` (tenant), `sys_tenancies.tenant_size_band varchar(32)` **senza FK** | CAT + TEN |
| adv | `sys_blueprint_content_context` (ateco_scheme/code/name, size_class, size_band_code `varchar(4)`) | TPL |
| ds | `datastore_classification` / `_version` / `_level`, `datastore_concept`, `datastore_concept_link`, `datastore_mapping_release`, `datastore_link_coverage`, `datastore_link_derivation` | CAT + CACHE (copertura, derivazioni) |
| ds | `datastore_model.datastore_sector_family` (`FIN_BANKING`, `MFG_CONSUMER_PRODUCTS`), `datastore_family_activity_class` (ramo PRIMARY…), `datastore_family_excluded_process`, `datastore_org_schema_family` | TPL (famiglie di settore) |
| ds | `datastore_concept_size_class` (soglie), `datastore_process_size_rule`, `datastore_prototype (concept_id ATECO, size_class_concept_id)` | CAT/TPL |

**Attributi.** Il datastore separa classificazione e versione (`ATECO 2022` e `ATECO 2025` convivono) e porta tavole di raccordo con rilascio, copertura misurata e passi di derivazione: **solo datastore**. Advanced ha la `confidence` del raccordo e il `kind` della mappatura; il datastore ha `confidence`, `authority`, `usage`. Il nome è `varchar(255)` in advanced e `text` nel datastore (A-07).

**Chiave naturale.** `(schema, codice)` in advanced contro `(classificazione, versione, codice)` nel datastore: **coincide solo dopo una tabella di traduzione degli schemi** (A-03). Per il settore: `FIN_BANKING` coincide fra `sys_industry_codes`, `sys_blueprint_families` e `datastore_sector_family`; `MANUFACTURING` (advanced) non ha omologo (`MFG_CONSUMER_PRODUCTS` è più stretto).

**ADR-0043 non basta.** La riga #3 dichiara «SÌ: ATECO/NACE» per `sys_industry_codes`, ma l'omologo vero di `sys_industry_codes` + `sys_blueprint_families` + `sys_blueprint_family_activity_classes` è `datastore_sector_family` + `datastore_family_activity_class`: in advanced il settore punta a **una** classe ATECO (`industry_ateco_code`), nel datastore a un **ramo** dell'albero con eredità e esclusioni. Sono tre oggetti di advanced per un concetto solo; `sys_industry_codes` è anche il bersaglio di una FK del tenant (`sys_tenancies`) e della sentinella I21. Proposta: `sys_industry_codes` → **TRA** in riferimento al codice di famiglia del datastore (resta in advanced come vocabolario del perimetro, alimentato dal fascicolo), non **DIS**. Va deciso, perché tocca `tenants/` (pagina che resta, ADR #17).

**Classificazione.** Classificazioni e raccordi → **RIF** (perimetro). Archivi legacy → **SEP** (storia) o **DIS** con archivio (ADR-0035). Fasce dimensionali → **RIF** con traduzione codice advanced ↔ concetto `SIZE_ESTAT`.

**Rischi.** La `confidence` delle mappature ATECO↔NACE di advanced (000112, 000341 «il NACE si deriva dall'ATECO») è stata ricalcolata da advanced: confrontarla con le derivazioni del datastore, non sovrascriverla alla cieca. `tenant_size_band` senza FK può contenere codici non presenti nel catalogo (non verificato).

---

## S04 — CCNL, livelli, minimi, fasce retributive, porte di ricompensa — ADR #10

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_compensation_bands` (`kind` BAND/CCNL/UNION, 000409: **tre specie in una tabella**; `min/mid/max_eur`; tenant nullo = catalogo) | CAT (CCNL, UNION) + TEN/CAT (BAND) |
| adv | `sys_user_contracts.user_contract_ccnl_type varchar(64)`, `_ccnl_level varchar(64)` | TEN, testo libero **senza FK** |
| adv | `sys_leave_accrual_rules.accrual_rule_ccnl_type varchar(100)`, `is_ccnl_default` | TEN, testo libero, **lunghezza diversa** |
| adv | `sys_position_compensation_profiles` (FK `compensation_band_id`) | TEN |
| adv | `sys_reward_gate_catalog` (per variante di blueprint), `sys_reward_gates`, `_results`, `sys_objective_reward_rules`, `sys_payout_curves`, `sys_bonus_pools` | TPL + TEN |
| adv | `sys_blueprint_content_ccnl`, `_ccnl_levels` (`annual_minimum_eur numeric(12,2)`), `_ccnl_institutes`, `_ccnl_conditions`, `_incentives`, `_incentive_links` | TPL |
| ds | `datastore_classification` `CCNL_SETTORE` + versioni, `datastore_concept` (livelli), `datastore_agreement_profile` (mensilità, firma, scadenza, settore), `_wage` (minimo mensile per componente e periodo), `_tranche`, `_level_rank`, `_level_category`, `_site_head_threshold`, `datastore_activity_agreement` (ATECO→CCNL suggerito, con conferma) | CAT |
| ds | `datastore_bench_agreement`, `_agreement_level` (`annual_minimum numeric(14,2)`) | TPL |

**Attributi.** Il datastore ha il fatto contrattuale (minimo **mensile** per voce e periodo, scaglioni, mensilità, rango dei livelli, soglie dei preposti): **solo datastore**. Advanced ha nel modello il minimo **annuo** (`numeric(12,2)` contro `numeric(14,2)` del pacchetto) e, nel catalogo, solo il nome del CCNL come riga `kind='CCNL'` senza importi.

**Chiave naturale.** Nel datastore il CCNL è una classificazione con codice e versione, il livello un concetto; in advanced il CCNL dei contratti delle persone è una stringa libera (`ccnl_type`, `ccnl_level`) che **non è legata** né a `sys_compensation_bands` né al modello: **non coincide**, e non c'è modo di confrontarla senza una tabella di corrispondenza testuale (lo conferma `rtl_lettura.ts` del datastore: «Advanced non ha un catalogo dei contratti»).

**Classificazione.** Righe `CCNL` e `UNION` di `sys_compensation_bands` → **SPO** nel datastore come classificazione (e in advanced **RIF** al perimetro `CCNL_CNEL`); righe `BAND` → **SEP** (sono la politica retributiva del cliente o una sua proposta). `sys_reward_gate_catalog` → **ARR** il datastore (ADR #10 «NO», #264 M3), poi **RIF**. `user_contract_ccnl_*` → **TRA** in riferimento al livello del perimetro (FK o codice validato), con fase di mappatura.

**Rischi.** Fondere `sys_compensation_bands` senza separare le specie porterebbe nel datastore fasce di un tenant; trasformare `ccnl_type/level` richiede una mappatura testuale che può non risolversi (dubbi da registrare, non da indovinare). Le buste paga e i contratti sono dato personale: nessuna di queste righe va nel datastore.

---

## S05 — Indicatori (KPI), metriche, obiettivi — ADR #8

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_kpi_definitions` (tenant nullo = catalogo; `code varchar(128)`, formula, unit, polarity, `is_global`) | CAT + TEN |
| adv | `sys_kpi_metric_definitions`, `sys_kpi_assessment_methods`, `sys_kpi_weighting_rules`, `sys_assessment_methods`, `sys_goal_templates` | CAT (senza tenant, tranne goal_templates) |
| adv | `sys_process_kpi_templates` (processo di modello → KPI), `sys_organization_unit_kpi_templates` (tenant nullo 100) | TPL |
| adv | `sys_kpi_targets`, `sys_kpi_measurements`, `sys_kpi_assessment_results`, `sys_position_kpi_requirements`, `sys_user_kpi_evidence` | TEN |
| adv | `sys_blueprint_content_kpis` (+ baseline, owner, family…), `sys_blueprint_content_goals` | TPL |
| ds | `datastore_concept_metric` (per concetto di processo: `code`, nome, formula, unità, unità normalizzata, categoria) | CAT |
| ds | `datastore_bench_metric`, `datastore_bench_objective` | TPL |

**Chiave naturale: non coincide.** I codici di advanced sono codici propri (nelle migrazioni compaiono `ENERGY-SAVINGS`, `KPI1`), quelli del datastore sono codici dell'editore unici **per processo** (`UNIQUE (concept_id, concept_metric_code)`). La prova di parità di ADR-0043 S3 («confronto per chiave naturale… codice indicatore») per questa famiglia non può dare zero mancanti senza una tabella di corrispondenza: va dichiarato nel passo S3.

**Solo advanced.** Metodi di valutazione, regole di pesatura, metriche di dettaglio di un KPI, modelli di obiettivo, polarità. **Solo datastore.** Unità normalizzata, legame al processo APQC, categoria editoriale.

**Classificazione.** KPI di catalogo → **ARR** il datastore con ciò che manca (metodi, pesature) **oppure** dichiararli catalogo del prodotto advanced (non di dominio: il disegno onda 2 tiene in advanced gli attributi «della definizione»); poi **RIF**. Bersagli, misure, profili per tenant → **SEP**.

**Rischi.** Il caricatore oggi scrive indicatori senza tenant (ADR #8): fino a S5 il catalogo di advanced cresce dal pacchetto e la parità si sposta mentre la si misura.

---

## S06 — Processi (APQC PCF) e partecipazione — ADR #8 (modelli per processo), #14

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_blueprint_process_registry` (per variante/versione; `pcf_code varchar(32)`, owner_position_code, kind, is_specific) | TPL scritto a mano (000008, 000301…) |
| adv | `sys_blueprint_overrides`, `sys_tenant_blueprint_process_decisions` | TEN (scelte del tenant sul modello) |
| adv | `sys_organization_unit_processes` (unità del tenant → processo **del modello**), `sys_process_participants` | TEN |
| adv | `sys_blueprint_content_unit_processes`, `_position_processes`, `_process_steps`, `_process_sites`, `_decisions`, `_decision_rights` | TPL |
| ds | `datastore_concept` (classificazioni `PCF`, `PCF_BANKING`, `PCF_CONSUMER_PRODUCTS`), `datastore_concept_metric` | CAT |
| ds | `datastore_process` (`pcf_concept_id` FK), `_process_step`, `_process_participation`, `_process_size_rule`, `datastore_family_excluded_process`, evidenze | TPL (prototipo) |
| ds | `datastore_bench_process` (`pcf_code text`), `_process_unit`, `_governance_decision`, `_governance_right` | TPL (pacchetto) |

**Chiave naturale.** Codice PCF: **coincide come stringa**, ma nel datastore è una FK a un concetto versionato (`pcf_concept_id`), in advanced un `varchar(32)` libero. Il codice di processo del modello (`process_code varchar(64)`) è del pacchetto e coincide fra `datastore_bench_process.code` e `sys_blueprint_content_*`.

**Classificazione.** Registro dei processi scritto a mano → **SOSTITUIRE** con il caricatore (ADR #14, già deciso). Il processo del tenant: il disegno onda 2 introduce `sys_tenant_processes` (T1) — **SEP**, corretto: oggi il tenant non ha un processo suo.

**Rischi.** `sys_organization_unit_processes` punta al processo **del modello**: alla sostituzione del registro scritto a mano, le righe del tenant RTL Bank che puntano ai processi del modello `FIN_BANKING` (23 processi di contenuto al censimento) devono essere riagganciate prima, altrimenti la FK blocca il ritiro (bene) o, se la si toglie, si perde il legame.

---

## S07 — Modelli operativi, unità organizzative, sedi, livelli — ADR #7

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_operating_model_catalog` (6), `sys_organization_unit_types` (10) | CAT senza tenant |
| adv | `sys_organization_unit_templates` (225; `blueprint_id uuid` **senza FK**: è il raggruppamento ereditato dal legacy, 000064/000331) | LEG/TPL |
| adv | `sys_organization_units`, `sys_branches`, `sys_organization_unit_history`, `sys_organization_unit_kpi_templates` (con tenant) | TEN |
| adv | `sys_blueprint_content_units`, `_sites`, `_legal_entities` | TPL |
| ds | `datastore_org_unit` (albero per prototipo), `datastore_org_site`, `datastore_org_level`, `datastore_org_naming_schema`, `datastore_org_schema_family`, `datastore_org_unit_type_exception` (con `advanced_unit_type`) | TPL |
| ds | `datastore_bench_unit` (`kind`, `advanced_kind`), `datastore_bench_site`, `datastore_bench_legal_entity` | TPL |

**Attributi.** Il datastore ha già una colonna che traduce verso advanced (`org_level_advanced_unit_type`, `bench_unit_advanced_kind`, `bench_process_unit_advanced_role`): è la prova che i due vocabolari dei tipi di unità **non coincidono** e che la traduzione vive nel datastore. Gli identificativi del prototipo sono interi; il collegamento con advanced è solo per codice del pacchetto.

**Classificazione.** `sys_operating_model_catalog`, `sys_organization_unit_types` → **RIF** (vocabolari del perimetro; i tipi sono usati come FK da `sys_organization_units`: restano come vocabolario, alimentati dal fascicolo). `sys_organization_unit_templates` → **DIS** con archivio (residuo legacy, 9 raggruppamenti, nessun referente: lo dice il commento della colonna); va verificato che nessuna riga di `sys_organization_unit_kpi_templates` lo punti ancora (FK `organization_unit_kpi_template_unit_template_id`).

**Rischi.** I 100 modelli di KPI per unità senza tenant puntano ai template di unità: ritirare i template prima di loro rompe la FK.

---

## S08 — Ruoli professionali (job roles), famiglie professionali, posizioni tipiche — ADR #6

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_job_roles` (176 di catalogo; `code varchar(128)`, seniority; tenant per i ruoli propri; unico `(coalesce(tenant), code)` da 000397) | CAT + TEN |
| adv | `sys_job_families` (16, senza tenant), `sys_job_role_embeddings`, `sys_esco_occupation_mappings` | CAT, CACHE |
| adv | `sys_positions.position_job_role_id` (FK) | TEN |
| adv | `sys_blueprint_content_job_roles` (+ mission, family, esco_uri, cp2021, ai_impact), `_job_role_links` | TPL |
| ds | **nessun catalogo dei ruoli**; `datastore_bench_role`, `_role_skill` (pacchetto); `datastore_position` (posizione tipica del prototipo, con occupazione e livello contrattuale) | TPL |

**Chiave naturale.** Codice del ruolo: in advanced `varchar(128)`, nel pacchetto `text` con il vincolo del contratto (`^[A-Z0-9][A-Z0-9_.-]{1,63}$`). I 176 ruoli di catalogo di advanced non hanno equivalente nel datastore (ADR #6 «NO»).

**Classificazione.** **ARR** obbligatorio prima di S6 (costruire il ruolo nel contratto v0.3, già pianificato), poi **RIF**. `sys_job_families` → **SPO** (non ha tenant: nessuna voce propria possibile, A-06). `sys_job_role_embeddings` → S11.

**Rischi.** È la famiglia con il maggior rischio di perdita: catalogo, famiglie, vettori e mappature ruolo→ESCO con `confidence` sono **solo in advanced**.

---

## S09 — Moduli e percorsi formativi — ADR #5, #9

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_learning_modules` (77 di catalogo), `sys_learning_paths`, `sys_learning_path_steps`, `sys_skill_learning_mappings` (352) | CAT + TEN |
| adv | `sys_training_initiatives`, `sys_user_learning_assignments`, `_evidence`, `sys_position_learning_requirements` | TEN |
| adv | `sys_blueprint_content_training`, `_training_positions`, `_training_skills`; `audit.learning_*_junk_archive` | TPL, STO |
| ds | nessun catalogo; la formazione del pacchetto sta in `datastore_bench_item` (sezione generica, `body jsonb`) | TPL |

**Anomalia che riguarda ADR-0043 regola 4.** `sys_learning_modules` e `sys_learning_paths` hanno **due** vincoli di unicità: `(coalesce(tenant), code)` e anche `UNIQUE (code)` **globale** (`sys_learning_modules_code_uq`, `sys_learning_paths_code_uq`, 000237, mai tolti). Con il secondo, un tenant non può crearsi un modulo con un codice già usato dal catalogo o da un altro tenant: la «voce propria nella stessa tabella» di ADR-0043 (regola 4) qui non regge. È anche una piccola fuga d'informazione fra tenant (un `INSERT` rifiutato dice che il codice esiste altrove). `sys_job_roles` aveva lo stesso difetto e 000397 l'ha corretto.

**Classificazione.** **ARR** il datastore (catalogo dei moduli e legami competenza→modulo: ADR #5 e #9 «NO»), poi **RIF**; per le voci proprie, correggere il vincolo globale prima che il tenant cominci a crearle (onda 3).

---

## S10 — Traduzioni ed etichette — ADR #11

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_reference_translations` (`entity_table varchar(63)`, `entity_id uuid` **senza FK**, `field`, `locale varchar(5)`, `text`, `source varchar(16)`: ESCO/HARVEST/LLM/MANUAL) | CAT (per i cataloghi) + prodotto (permessi, interfacce) nella **stessa** tabella |
| adv | `sys_translatable_field` (quali campi sono traducibili) | prodotto |
| adv | colonne `*_name_en` in `sys_blueprint_content_*` | TPL |
| ds | `datastore_concept_label` (lang, kind, affidabilità), `datastore_concept_description` (lang, kind, `derived_from`), `datastore_classification_level_lang` | CAT |

**Attributi.** In advanced il testo italiano sta nella colonna di base e le traduzioni (solo `en`, censimento) in una tabella polimorfica; nel datastore ogni lingua è una riga. La «fonte» della traduzione (`source`) corrisponde all'affidabilità/origine del datastore; il loader del pacchetto la traduce già (`db/scripts/pacchetto/definizione-pacchetto.mjs`, `ORIGINE`).

**Chiave naturale.** `(entity_table, entity_id, field, locale)` in advanced, con `entity_id` uuid interno: **non coincide** con nulla nel datastore. Per confrontare si deve passare dalla chiave naturale dell'entità (URI/codice) via join polimorfico.

**Classificazione.** Traduzioni di voci di catalogo → **RIF** (solo per il perimetro, scritte dal caricatore); traduzioni del prodotto → **SEP**. Le traduzioni `LLM` e `MANUAL` (2.456 righe al censimento) sono informazione **solo di advanced**: **ARR** il datastore o dichiararle da rifare.

**Rischi.** Senza FK, il ritiro di una voce di catalogo lascia la traduzione orfana: la sentinella `sys.v_reference_translation_orphans` esiste e lo vedrebbe, ma il ritiro S6 deve togliere le traduzioni nello stesso passo, per `entity_table`.

---

## S11 — Vettori (embeddings) — ADR #12

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_skill_embeddings` (FK skill, `vector(1024)`, `model_id`, `source_text_hash`), `sys_esco_occupation_embeddings` (per URI, **senza FK**), `sys_job_role_embeddings` | CACHE di catalogo |
| adv | `sys_user_profile_embeddings` | TEN (dato personale, resta) |
| ds | `datastore_derived.datastore_concept_embedding` (`model`, `dim`, `input_hash`, `vector(1024)`, unico `(concept_id, model)`), viste `datastore_concept_vector_hash`, copertura | CACHE |

**Parità del modello.** Entrambi usano `voyage-4-lite` a 1024 dimensioni (advanced `apps/api/src/modules/semantic-matching/voyage-client.ts`, `VOYAGE_MODEL`; datastore `src/vettori/voyage.ts`): la condizione di ADR-0043 #12 sul modello è soddisfatta **nel codice**. Non è verificato che il **testo d'ingresso** sia lo stesso (`source_text_hash` contro `input_hash`): se differisce, i vettori non sono confrontabili fra loro anche con lo stesso modello.

**Classificazione.** **RIF** (solo i vettori del perimetro), ricalcolabili; `sys_job_role_embeddings` dipende da S08. `sys_user_profile_embeddings` **SEP**.

---

## S12 — Blueprint, prototipi, pacchetti, fascicoli — ADR #14, #15

| lato | oggetto | natura |
|---|---|---|
| adv | `sys_blueprint_families`, `_variants`, `_variant_versions`, `_activations`, `_overrides`, `_family_activity_classes`; `sys_reward_gate_catalog` (per variante) | TPL (famiglie e varianti scritte a mano, ADR #14) |
| adv | `sys_blueprint_content_*` (49 tabelle vive: 29 di 000454, 14 di 000458, il resto da 000327/000397) | PUB (copia del pacchetto per versione di variante) |
| adv | `sys_tenant_blueprints`, `_versions`, `_snapshots`, `_process_decisions`, `sys_generated_record_origins` | TEN (fascicolo ricevuto, ADR-0042) |
| ds | `datastore_prototype` (ATECO × classe dimensionale), `datastore_blueprint_edition` (edizione firmata, corpo e impronte), `datastore_research_request`, `datastore_evidence` | TPL |
| ds | `datastore_bench_prototype`, `_package` (versione, corpo intero, rapporto, validazione, `dossier_version integer`, `extends_version integer`), sezioni `_unit`/`_position`/`_skill`/…/`_scope_item`, corse (`_step_version`, `_execution`, `_event`, `_telemetry`, `_decision`, `_copy`, `_archive`, `_log_cut`) | TPL + STO (storia delle corse) |

**Corrispondenza.** Un `datastore_bench_package` corrisponde a una `sys_blueprint_variant_versions` con la sua riga unica in `sys_blueprint_content_packages` (`prototype_ref varchar(64)` ↔ `bench_prototype_code`; `source_hash char(64)` ↔ `bench_package_content_hash text`). Le sezioni si corrispondono una a una con la mappatura v0.3 (`src/contratto/v0.3/MAPPATURA_pacchetto-advanced_v0.3.md`), e il disegno onda 2 le ha già tradotte.

**Solo datastore.** Il corpo intero (`body jsonb`) di ogni riga, l'origine per riga (`*_origin`), i codici delle evidenze per riga (`evidence_codes text[]`, in advanced normalizzati in `sys_blueprint_content_evidence_links`), la storia delle corse del banco, l'edizione firmata. Il loader di advanced porta nel `metadata` ciò che le colonne non distinguono (commento in testa a `definizione-pacchetto.mjs`): da verificare per campo, non presumere.

**Chiave naturale e tipi.** `dossier_version`/`extends_version` sono **interi** nel datastore e `varchar(32)` in advanced (A-07): un confronto per uguaglianza fra stringa e numero va scritto esplicitamente.

**Classificazione.** Famiglie e varianti scritte a mano → **SOSTITUIRE** con fascicoli del datastore (ADR #14, deciso); `sys_blueprint_content_*` → **SEP** come copia pubblicata in advanced (sono il perimetro, ADR-0046); registro e attivazione per tenant → **SEP**. Storia delle corse → resta nel datastore.

**Osservazione.** 41 delle 49 tabelle `sys_blueprint_content_*` non hanno **alcuna** occorrenza in `apps/` né in `packages/`: le scrive solo il caricatore in `db/scripts/pacchetto/`. Per le 14 di `000458` è atteso (onda 2 in corso), ma per il cancello di esposizione (`check_exposure.py`) sono oggi dato «non nel prodotto».

---

## S13 — Provenienza, fonti, ricerca, semi, sincronizzazione — ADR #13, #16

| lato | oggetto | natura |
|---|---|---|
| adv | `reference_sync.import_runs`, `source_exports`, `source_watermarks` (spostate da `brownfield` in 000297) | CAT di processo (sincronizzazione) |
| adv | `sys_source_lineage_records` (FK verso `reference_sync.import_runs` **e verso `brownfield.table_mappings`**, schema ritirato: vedi A-10), colonne `sdbi_*` | LEG + provenienza |
| adv | `sys_research_sources` (suffissi di host approvati), `sys_seed_acquisition_runs`, `_candidate_records`, `_validation_results`, `_source_evidence`, `_approval_decisions`, `sys_industry_forbidden_terms` | CAT/TPL di piattaforma (ADR #16) |
| adv | `sys_generated_record_origins`, `sys_classificazione_direzione_dato`, `sys_conflitti_ibridi`, `sys_reconciliation_registry`, `origine_dato` su molte tabelle | TEN / prodotto (restano) |
| adv | `sys_blueprint_content_evidence`, `_evidence_links`, `_evidence_gaps`, `_gaps`, `_derivations` | TPL |
| ds | `datastore_meta.datastore_source`, `_source_document` (impronta unica, licenza), `_load`, `_publication`, `_protection`; 5 colonne di provenienza su **ogni** tabella di `datastore_core` (imposte da un event trigger, 0001) | CAT di provenienza |
| ds | `datastore_research_request`, `datastore_evidence`, `*_evidence` (unità, posizioni, processi, passi, sedi), `datastore_bench_evidence` | TPL |

**Classificazione.** `reference_sync.*` e i moduli di sincronizzazione → **DIS** con archivio (ADR #13, deciso). Semi e ricerca → **SPO**/**DIS** con archivio (ADR #16). `sys_research_sources` → **ARR** il datastore (`datastore_source` non ha lo stato di approvazione per suffisso di host), poi **DIS**. Provenienza del tenant → **SEP**.

**Rischi.** `sys_source_lineage_records` porta la storia dell'ingestione legacy (chiusa da ADR-0038): è **STO**, non va fuso nel datastore; la sua FK verso `brownfield.table_mappings` va verificata (A-10).

---

## S14 — Audit e telemetria

| lato | oggetto | natura |
|---|---|---|
| adv | `audit.catalog_changes` (trigger `trg_audit_catalog` su ogni catalogo, 000339), `audit.agent_gateway_decisions`, `audit.user_self_service_actions`, `sys_auth_login_events`, `sys_position_skill_requirement_history`, archivi `audit.*_archive` | STO |
| ds | `datastore_meta.datastore_audit` (partizionata per mese dal 0106), `datastore_audit_0105` (la tabella di prima, conservata), `datastore_call` (registro dei verbi), `datastore_model_telemetry`, `datastore_bench_telemetry` | STO |

**Omologhi diretti.** `audit.catalog_changes (table_name, operation, db_user, application_name, old_row, new_row)` ↔ `datastore_audit (actor, schema, table, operation, row_before, row_after, load_id)`. Stesso mestiere, sugli stessi cataloghi duplicati.

**Classificazione.** **SEP**: ognuno tiene la storia del proprio dominio. Dopo S6 il trigger di advanced registra solo le voci del perimetro, ed è corretto così. La storia delle modifiche ai cataloghi fatte in advanced prima della commutazione non va spostata nel datastore (contiene `db_user` di advanced), ma va **archiviata con impronta** insieme al ritiro (ADR-0043 S6). `datastore_audit_0105` non ha riferimenti nel codice: è la storia prima della partizione, da tenere.

---

## S15 — Utenti e autenticazione (compito 4)

**advanced.** `sys_users` (email, nomi, tenant) più 17 tabelle `sys_auth_*` (credenziali, sessioni, MFA, ruoli, permessi, token) e 28 tabelle `sys_user_*` (dato personale e assegnazioni). Gli operatori di piattaforma sono utenti del tenant «Heuresys System» con `PLATFORM_ADMIN` e `sys_platform_user_tenant_assignments`. `sys_auth_sessions` non ha alcuna occorrenza in `apps/`+`packages/` (possibile residuo, da verificare).

**datastore, schema.** **Nessuna tabella di utenti o operatori.** L'identità è testo libero dentro le righe: `datastore_audit_actor`, `datastore_call_actor` («lo mette l'involucro, mai il corpo della richiesta»), `bench_decision_actor`, `bench_archive_actor`, `research_request_asked_by`, `blueprint_edition_signed_by`, `bench_package_received_by`, `activity_agreement_confirmed_by`, `source_owner`. La migrazione `0155` ha sostituito il nome proprio dell'amministratore con «Amministratore di Sistema» in tutte le colonne di testo (esclusi audit e registro migrazioni). I quattro ruoli del motore (`datastore_proprietario`, `_applicazione`, `_sincronizza`, `_lettore`, 0025) sono ruoli PostgreSQL `nologin`, non persone. **Nello schema del datastore non c'è niente che somigli a un utente di un tenant.**

**datastore, fuori dallo schema (rilievo A-01).** Il motore del datastore ospita **copie intere della produzione di advanced**: il CLAUDE.md del datastore elenca `heuresys_advanced_20260819` sulla 5435; `apps/api/src/servizio_rtl.ts` legge per impostazione `heuresys_advanced_20261010` (e, con `DATASTORE_RTL_FONTE=produzione`, la produzione sulla 5433 in sola lettura). `apps/api/src/rtl_lettura.ts` interroga `sys.sys_users` (`user_display_name` delle persone con bersagli KPI), `sys_user_contracts`, `sys_user_position_assignments` del tenant RTL Bank e li serve sulla porta 3104. Il datastore non **gestisce** utenti dei tenant, ma ne **conserva** copie e ne **espone** dati personali: contraddice il principio «il datastore non gestisce gli utenti operativi dei tenant» e il criterio di ADR-0043 (il datastore riceve dal tenant solo ciò che serve a generare il modello). Non verificato dal vivo quali copie esistano oggi.

---

## Anomalie strutturali (compito 3)

Gravità: ALTA = può far perdere dati o violare un invariante; MEDIA = rende inaffidabile una fusione o una prova; BASSA = igiene.

| id | gravità | rilievo | evidenza |
|---|---|---|---|
| A-01 | ALTA | Copie della produzione di advanced (utenti, contratti, buste paga) sul motore del datastore; lettura e servizio di `user_display_name` | S15; `heuresys-datastore/CLAUDE.md` (tabella «Database sul motore 5435»), `apps/api/src/servizio_rtl.ts` righe 1-40, `apps/api/src/rtl_lettura.ts` (query `bersagli`) |
| A-02 | ALTA | Informazione che esiste **solo in advanced** e che un ritiro per «voce fuori perimetro» perderebbe: CP2021, ruoli di catalogo e famiglie professionali, vettori dei ruoli, moduli e percorsi formativi, legami competenza→modulo, porte di ricompensa, famiglie/categorie/alias/livelli delle competenze, traduzioni LLM/MANUAL, metodi di valutazione e pesature dei KPI | S01, S02, S05, S08, S09, S10; ADR-0043 righe #2, #4-#6, #9-#11 |
| A-03 | ALTA | Tre vocabolari diversi per lo stesso schema di classificazione: `sys_activity_classifications` ammette `ATECO_2025`, `NACE_REV_2_1`, `ATECO_2007`, `NACE_REV_2`, `ATECO`, `NACE`; `sys_blueprint_content_perimeters` usa `NACE_2_1`, `CP2021`, `ISCO_08`; `sys_occupation_classifications` usa `CP_2021`, `ISCO_08`; il datastore usa `classification_code` (`NACE`, `ATECO`, `ISCO`, `ESCO_OCC`, `PCF`…) più la versione. Una prova di parità S3 per «chiave naturale» senza una tabella di traduzione dichiarata dà falsi mancanti | CHECK in 000007 e 000032 (activity; i valori legacy `ATECO`/`NACE` svuotati nei dati da 000211 ma ancora ammessi), 000206 (occupation), 000458 riga 361 (perimeters); `src/contratto/v0.3/vocabolari.json` `schemaCatalogo` («_advanced: null») |
| A-04 | MEDIA | Identità ESCO diversa per grana: unica in assoluto in advanced (`uq_skills_esco_uri`), unica per versione nel datastore (`(classification_version_id, concept_uri)`); advanced non registra la versione ESCO | 000343; datastore 0013 |
| A-05 | MEDIA | KPI: chiave naturale non confrontabile (codici propri in advanced, codici dell'editore per processo nel datastore) | S05 |
| A-06 | MEDIA | ADR-0043 regola 4 («voci proprie nella stessa tabella») non applicabile: `UNIQUE (code)` globale su `sys_learning_modules` e `sys_learning_paths` (000237) accanto all'unico per tenant; famiglie/categorie competenze, famiglie professionali, tipi di unità, modelli operativi, fasce, metodi KPI **non hanno colonna tenant** | S09; `C_anomalie.tsv`; 000237 righe 66-75 |
| A-07 | MEDIA | Tipi diversi per colonne omologhe: nel datastore `text` senza limite, in advanced `varchar(N)` (nomi `varchar(255)` in `sys_activity_classifications`, `sys_job_roles`, `sys_esco_occupation_mappings.esco_label`; codice attività `varchar(32)`); `dossier_version`/`extends_version` `integer` (ds) contro `varchar(32)` (adv); minimo annuo `numeric(14,2)` contro `numeric(12,2)`; dentro advanced `position_code` `varchar(128)` nel tenant e `varchar(64)` nel modello, `tenant_industry_code varchar(64)` con FK verso `industry_code varchar(32)`, `ccnl_type` `varchar(64)` e `varchar(100)` | `C_tipi_omologhi.tsv` |
| A-08 | MEDIA | Legami per codice o polimorfici senza FK verso i cataloghi: `sys_user_contracts.ccnl_type/level`, `sys_leave_accrual_rules.ccnl_type`, `sys_positions.position_esco_occupation_uri`, `sys_occupation_skill_requirements.*_uri`, `sys_esco_occupation_embeddings.esco_uri`, `sys_tenancies.tenant_size_band`, `sys_reference_translations.entity_id`, `sys_blueprint_process_registry.pcf_code`; nel datastore i codici fra sezioni del pacchetto (`bench_role_skill.skill_code`, `bench_metric.code`…) e nei `sys_blueprint_content_*` tutto il contenuto si lega per codice (per disegno, C1): l'integrità dipende dal validatore del contratto e dal caricatore | `C_anomalie.tsv` classi `LEGAME_PER_CODICE`, `RIFERIMENTO_SENZA_FK` |
| A-09 | MEDIA | `sys_compensation_bands` tiene tre specie (BAND, CCNL, UNION): il catalogo dei CCNL di advanced è mescolato con le fasce del tenant | 000409 commento colonna `compensation_band_kind` |
| A-10 | MEDIA | `sys_source_lineage_records` dichiara in 000025 una FK verso `brownfield.table_mappings`; lo schema `brownfield` è caduto in 000297 (`DROP SCHEMA brownfield RESTRICT`, preceduto da `DROP TABLE ... CASCADE` che toglie anche quella FK). Il parser non segue la caduta dei vincoli per CASCADE: lo stato della FK va confermato con `\d sys.sys_source_lineage_records` sul gemello | 000025, 000297 righe 60-122 |
| A-11 | BASSA | Il disegno onda 2 (`DISEGNO_tabelle-onda2.md`, C1, T1-T12) cita `REFERENCES sys.sys_tenants(tenant_id)`: la tabella si chiama `sys.sys_tenancies` (000003; 000053 lo avverte: «NOT a non-existent sys_tenants»). Le migrazioni 000454-000458 non la usano; le sessioni O2-03/O2-04 che copiassero il disegno alla lettera fallirebbero | `grep -n sys_tenants db/migrations/*.sql` → solo il commento in 000053 |
| A-12 | BASSA | ENUM di PostgreSQL: **zero** in entrambe le catene (RD-08 rispettata); categorici `varchar+CHECK` in advanced, `text+CHECK` nel datastore | `grep -i "as enum"` vuoto su entrambe |
| A-13 | BASSA | Tabelle senza PK: 8 in advanced, tutte archivi `audit.*` creati con `CREATE TABLE AS` (000160, 000189, 000197, 000198, 000200, 000211); 0 nel datastore | `C_anomalie.tsv` classe `SENZA_PK` |
| A-14 | BASSA | Oggetti senza riferimenti testuali nel codice applicativo: 41 `sys_blueprint_content_*`, `sys_auth_sessions`, `sys_translatable_field`, `sys_industry_forbidden_terms` (letta dalla sentinella), `sys_esco_isco_resolved`; nel datastore 12 viste `datastore_pub.*_v1` della v0.3, `datastore_meta.datastore_load_bersagli` (zero ovunque), `datastore_audit_0105`, `datastore_protection`, `datastore_environment`. **L'assenza di un riferimento testuale non prova l'inutilizzo** (trigger, sentinelle lette per prefisso da `db_health.py`, script) | `C_anomalie.tsv` classe `NESSUN_RIFERIMENTO_NEL_CODICE`, `C_riferimenti_codice.tsv` |

## Dove ADR-0043 non basta o va precisato

1. **Riga #3** (attività e settori): l'omologo di `sys_industry_codes`/`sys_blueprint_families` è `datastore_sector_family`, non ATECO/NACE; `sys_industry_codes` è bersaglio di una FK del tenant e vocabolario della sentinella I21: proporre **trasformare**, non ritirare (S03).
2. **Passo S3** (parità per chiave naturale): servono, prima dello script di confronto, una tabella di traduzione degli schemi (A-03), la versione ESCO fissata (A-04) e una corrispondenza per i KPI (A-05); senza, la prova non può diventare verde per ragioni giuste.
3. **Regola 4** (voci proprie): non vale per le famiglie senza colonna tenant e per i formativi col vincolo globale (A-06); l'ADR dovrebbe dire quali famiglie ammettono voci proprie.
4. **Catalogo dei CCNL**: ADR #10 parla di fasce retributive; il catalogo dei contratti di advanced è nascosto nelle righe `kind='CCNL'` di `sys_compensation_bands` e i contratti delle persone non vi sono legati (S04, A-09).
5. **Principio sugli utenti**: l'ADR non parla delle copie della produzione di advanced tenute dal datastore per il banco RTL (A-01). Va deciso se il datastore può leggere il tenant e con quale proiezione minima (senza nomi delle persone).

## Rischi di perdita di dati in fusione, in ordine

1. Ritiro S6 prima della parità sulle famiglie «NO/PARZ» (A-02).
2. Confronto per codice con vocabolari diversi: falsi «presenti» o falsi «mancanti» (A-03, A-05).
3. Troncamento o rifiuto passando da `text` a `varchar(N)` (A-07): da misurare con `max(length(...))` sul gemello prima del caricamento.
4. Traduzioni e vettori orfani dopo il ritiro (S10, S11).
5. Perdita del legame tenant→processo del modello e tenant→template di unità se il registro scritto a mano e i template si ritirano prima di riagganciare le righe del tenant (S06, S07).
