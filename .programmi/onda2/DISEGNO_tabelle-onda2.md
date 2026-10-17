# Disegno delle tabelle e colonne dell'onda 2 (PE-6.1)

Sessione S1119, 2026-10-17. Solo disegno: niente qui è una migrazione. Le sessioni O2-01, O2-03, O2-04, O2-05 e O2-10 (vedi `README.md`) scrivono le migrazioni a partire da questo file, con i numeri liberi dopo la `000457` al momento in cui committano.

Fonti lette: la mappatura v0.3 e i vocabolari del contratto (`D:\heuresys-datastore\src\contratto\v0.3\MAPPATURA_pacchetto-advanced_v0.3.md`, `vocabolari.json`), il glossario (`docs/kb/GLOSSARIO_dieci-oggetti_v0.3.md`), le migrazioni che creano le tabelle toccate (elencate per tabella). Le colonne esistenti sono state lette dai file di migrazione, non dal database: ogni sessione le riverifica con `\d sys.<tabella>` sul gemello prima di scrivere.

## 0. Regole comuni (valgono per ogni riga di questo file)

- **C1, due domini (ADR-0043).** Le tabelle `sys_blueprint_content_*` sono di **piattaforma**: contengono il tipo d'impresa come è arrivato dal datastore, non hanno `tenant_id`, appartengono a una versione di variante (`..._version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE`), si legano per codice e portano `origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE'`, come in `000454`. Le tabelle del **tenant** portano `<prefisso>_tenant_id uuid NOT NULL REFERENCES sys.sys_tenants(tenant_id)` (I5), una chiave naturale `UNIQUE (<prefisso>_tenant_id, <prefisso>_code)` dove esiste un codice, `origine_dato varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE' CHECK (origine_dato IN ('IMPORT','NATIVO','MATERIALIZZAZIONE'))` come in `000433`, e `created_at`, `created_by`, `updated_at`, `updated_by`.
- **C2, nomi.** `sys.sys_<plurale>`; ogni colonna porta il prefisso del singolare della tabella; chiave primaria `<singolare>_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`. La mappatura del datastore propone alcuni nomi al singolare (`sys_blueprint_content_strategy`, `..._perimeter`): qui sono al plurale secondo I3/I4.
- **C3, categorici (RD-08).** `varchar(N) + CHECK`, mai ENUM; i valori sono quelli di `vocabolari.json` v0.3, riportati qui. Dove il vocabolario non c'è (lo dice la riga), il campo è testo libero e la sessione verifica nello schema `prototipo-pacchetto.schema.json` se un elenco esiste.
- **C4, date (RD-09).** `date` per le date, `timestamptz` solo per gli istanti.
- **C5, chiavi esterne.** Ogni FK ha il suo indice (il debito delle FK senza indice non si allarga). Verso le posizioni e le persone `ON DELETE RESTRICT` salvo dove scritto; dentro lo stesso aggregato (riga figlia di un'altra tabella nuova) `ON DELETE CASCADE`.
- **C6, coerenza di tenant.** Una FK fra due tabelle del tenant non garantisce che le due righe siano dello stesso tenant. Per ogni tabella nuova del tenant con una FK verso un'altra tabella del tenant, la migrazione crea una sentinella `sys.v_<tabella>_cross_tenant` che conta le righe con tenant diversi: deve stare a zero, e `db_health.py` la raccoglie da sola.
- **C7, nessuna vista di calcolo con prefisso `sys.v_`.** `db_health.py` tratta ogni `sys.v_*` come sentinella a zero righe. I calcoli (perimetro del tenant, disponibilità residua, ore oltre contratto) stanno nell'API o in funzioni `sys.fn_*`, mai in viste `sys.v_*`.
- **C8, direzione del dato (ADR-0041, I23).** Ogni tabella nuova entra in `sys.sys_classificazione_direzione_dato` nella stessa migrazione (`INSERT … ON CONFLICT (tabella) DO NOTHING`), con lo stato scritto nelle tabelle sotto. Le tabelle del tenant nascono `importato` perché nell'onda 2 le scrive solo la materializzazione; diventano `ibrido` nella migrazione dell'onda 3 che aggiunge le rotte di personalizzazione («il secondo scrittore conta solo se continua a scrivere», X-1).
- **C9, registro di riconciliazione e mappa GDPR.** Ogni tabella nuova va registrata in `db/migrations/000062_register_embedding_tables_reconciliation.sql` (classe `D`, `EXCLUDE`, con la ragione), che è un file di numero minore: è il difetto che la seconda passata di `ci-rehearsal.sh` vede e la prima no. Nessuna tabella di questo disegno ha una colonna che punta a una persona (`sys_users`); se una sessione ne aggiunge una, va anche nella mappa GDPR (`000304`).
- **C10, idempotenza.** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, vincoli e indici aggiunti solo se assenti (blocco `DO` che interroga `pg_constraint` e `pg_indexes`), come in `000454` e `000457`.
- **C11, inversa.** Ogni migrazione ha la sua inversa **fuori dalla catena**, in `db/scripts/onda2/<numero>-inversa.sql`, sul modello di `db/scripts/pe4-passo1-inversa.sql`: toglie in ordine inverso indici, vincoli, colonne e tabelle, e **si rifiuta** (`RAISE EXCEPTION`) se una tabella da togliere ha righe o una colonna da togliere ha valori non nulli. Tornare indietro con dati dentro vuol dire perdere contenuto, ed è una decisione dell'Amministratore di Sistema, non un'opzione dello script. La prova di ogni migrazione è: catena due volte, inversa, catena di nuovo, su copia usa-e-getta del gemello.

## 1. Lato modello: il contenuto del pacchetto v0.3 (sessione O2-01)

Una sola migrazione, sulla forma di `000454`. Tutte le tabelle nuove: piattaforma, stato di direzione `importato` (scritte solo dal caricatore del pacchetto), `UNIQUE (<prefisso>_version_id, <prefisso>_code)` dove c'è un codice, indice su `(<prefisso>_version_id)`. Il prefisso è `blueprint_content_<singolare>_`; qui sotto si scrive solo la parte finale del nome della colonna.

### M1.1 `sys_blueprint_content_packages` (esistente, `000454`) — colonne aggiunte

| colonna | tipo | vincolo | requisito |
|---|---|---|---|
| `source_schema_version` | varchar(48) | | meta.origine |
| `converted_at` | timestamptz | | meta.origine |
| `converter` | varchar(80) | | meta.origine |
| `source_hash` | char(64) | `CHECK (source_hash ~ '^[0-9a-f]{64}$')` | meta.origine |
| `is_complete` | boolean | | meta.completezza |
| `steps_accepted` | integer | `CHECK (>= 0)` | meta.completezza |
| `steps_total` | integer | `CHECK (>= 0 AND steps_accepted <= steps_total)` | meta.completezza |
| `perimeter_status` | varchar(16) NOT NULL DEFAULT 'NON_RILASCIATO' | `CHECK IN ('DICHIARATO','NON_RILASCIATO')` | R48, ADR-0046 §1 |
| `dossier_version` | varchar(32) | | R49 (`perimetro.fascicoloVersione`) |
| `extends_version` | varchar(32) | | R49 (`perimetro.estendeVersione`) |
| `extension_request` | text | | R49 (`perimetro.richiestaEstensione`) |

Inversa: `DROP COLUMN` delle undici, dopo il controllo che siano tutte nulle (per `perimeter_status`: tutte `NON_RILASCIATO`).

### M1.2 `sys_blueprint_content_strategies` (NUOVA) — R01, R02

`UNIQUE (version_id)`: una strategia tipica per versione.

| colonna | tipo | vincolo |
|---|---|---|
| `competitive_lever` | varchar(24) NOT NULL | `CHECK IN ('COSTO','QUALITA','INNOVAZIONE','PERSONALIZZAZIONE','SERVIZIO')` (levaCompetitiva) |
| `secondary_lever` | varchar(24) | stesso CHECK, e `<> competitive_lever` |
| `lever_rationale` | text | |
| `growth_ambition` | text | nessun vocabolario |
| `foreign_presence` | text | nessun vocabolario |
| `source_note` | text | fonte o «senza riscontro» |
| `metadata` | jsonb NOT NULL DEFAULT '{}' | |

### M1.3 `sys_blueprint_content_strategy_items` (NUOVA) — R01, R24

`UNIQUE (version_id, kind, code)`.

| colonna | tipo | vincolo |
|---|---|---|
| `kind` | varchar(24) NOT NULL | `CHECK IN ('SEGMENTO','LINEA_OFFERTA','COMPETENZA_SCARSA','DIPENDENZA','PRIORITA')`; la sessione verifica i nomi nello schema JSON |
| `code` | varchar(64) NOT NULL | |
| `name` | text NOT NULL | |
| `description` | text | |
| `channel` | text | solo `SEGMENTO` |
| `shares_skills`, `shares_plants` | boolean | solo `LINEA_OFFERTA` |
| `skill_code` | text | solo `COMPETENZA_SCARSA` (URI ESCO) |
| `dependency_kind` | varchar(32) | solo `DIPENDENZA` |
| `goal_code` | varchar(64) | solo `PRIORITA` |
| `ordinal` | smallint | |

Al massimo cinque `PRIORITA` per versione: la regola marca e non rifiuta (come le validazioni v0.3), quindi non è un vincolo; la conta il caricatore nella sua lettura di ritorno.

### M1.4 `sys_blueprint_content_capabilities` (NUOVA) — R06

Non è `sys_capability_scores` (indice di capacità, glossario).

| colonna | tipo | vincolo |
|---|---|---|
| `code` | varchar(64) NOT NULL | |
| `name` | text NOT NULL | |
| `description` | text | |
| `nature` | varchar(16) NOT NULL | `CHECK IN ('DISTINTIVA','NECESSARIA','DI_SUPPORTO')` (naturaCapability) |
| `criticality` | varchar(16) | `CHECK IN ('LOW','MEDIUM','HIGH','CRITICAL')` se lo schema JSON usa criticitaCompetenza; altrimenti testo |
| `coordination` | text | |

### M1.5 `sys_blueprint_content_capability_links` (NUOVA) — R06, R15

| colonna | tipo | vincolo |
|---|---|---|
| `capability_code` | varchar(64) NOT NULL | |
| `link_kind` | varchar(16) NOT NULL | `CHECK IN ('PROCESSO','COMPETENZA','STRUMENTO_DATO')` |
| `link_code` | text | obbligatorio per `PROCESSO` e `COMPETENZA` |
| `text` | text | obbligatorio per `STRUMENTO_DATO` |
| `ordinal` | smallint | |

`CHECK ((link_kind = 'STRUMENTO_DATO' AND text IS NOT NULL) OR (link_kind <> 'STRUMENTO_DATO' AND link_code IS NOT NULL))`. Unicità con indice unico **parziale** `(version_id, capability_code, link_kind, link_code) WHERE link_code IS NOT NULL`, non con `COALESCE` nella chiave (classe di difetto di ADR-0018).

### M1.6 `sys_blueprint_content_job_roles` (esistente, `000397`) — colonne aggiunte, R09, R39

`mission` text; `professional_family` varchar(128); `esco_uri` text; `cp2021_code` varchar(16); `ai_impact` jsonb (la forma la fissa lo schema JSON; se è un valore categorico, varchar + CHECK). Nota: la tabella non ha `origine_dato`; la migrazione la aggiunge con `DEFAULT 'DATASTORE'` per uniformità con `000454`.

### M1.7 `sys_blueprint_content_job_role_links` (NUOVA) — R09, R15, R27, R29

| colonna | tipo | vincolo |
|---|---|---|
| `job_role_code` | varchar(128) NOT NULL | |
| `link_kind` | varchar(12) NOT NULL | `CHECK IN ('ATTIVITA','COMPETENZA')` |
| `process_code` | varchar(64) | obbligatorio per `ATTIVITA`; facoltativo per `COMPETENZA` (la competenza richiesta per quel processo) |
| `step_code` | varchar(64) | obbligatorio per `ATTIVITA` |
| `skill_code` | text | obbligatorio per `COMPETENZA` |
| `proficiency` | varchar(16) | `CHECK IN ('NOVICE','BASIC','COMPETENT','PROFICIENT','EXPERT','MASTER')` (livelloCompetenza) |

Indici unici parziali: `(version_id, job_role_code, process_code, step_code) WHERE link_kind = 'ATTIVITA'`; `(version_id, job_role_code, skill_code, process_code) WHERE link_kind = 'COMPETENZA' AND process_code IS NOT NULL`; `(version_id, job_role_code, skill_code) WHERE link_kind = 'COMPETENZA' AND process_code IS NULL`.

### M1.8 `sys_blueprint_content_decisions` (NUOVA) — R18, R19

Non è `sys_approval_*` (glossario).

| colonna | tipo | vincolo |
|---|---|---|
| `code` | varchar(64) NOT NULL | |
| `process_code` | varchar(64) NOT NULL | |
| `description` | text NOT NULL | |
| `frequency` | varchar(32) | nessun vocabolario specifico |
| `escalation_threshold` | text | |
| `escalation_actor_kind` | varchar(12) | `CHECK IN ('POSIZIONE','RUOLO','AGENTE')` (tipoAttore) |
| `escalation_actor_code` | varchar(128) | obbligatorio se c'è il tipo |

### M1.9 `sys_blueprint_content_decision_rights` (NUOVA) — R18

| colonna | tipo | vincolo |
|---|---|---|
| `decision_code` | varchar(64) NOT NULL | |
| `right` | varchar(16) NOT NULL | `CHECK IN ('PROPONE','CONTRIBUISCE','ASSENSO','DECIDE','ESEGUE')` (dirittoDecisionale) |
| `actor_kind` | varchar(12) NOT NULL | tipoAttore |
| `actor_code` | varchar(128) NOT NULL | |

`UNIQUE (version_id, decision_code, right, actor_kind, actor_code)`; la regola «esattamente un DECIDE» marca e non rifiuta al livello del modello (il caricatore la conta); al livello del tenant diventa vincolo (T12).

### M1.10 `sys_blueprint_content_legal_entities` (NUOVA) — R44

`code` varchar(64) NOT NULL; `name` text NOT NULL; `legal_form` varchar(64); `country` char(2) NOT NULL `CHECK (country ~ '^[A-Z]{2}$')`. Il legame con le sedi va sulla sede: colonna `blueprint_content_site_legal_entity_code varchar(64)` aggiunta a `sys_blueprint_content_sites` (`000454`), invece della lista `site_codes` proposta dalla mappatura (una sede appartiene a una sola entità; la lista in jsonb non si può vincolare).

### M1.11 `sys_blueprint_content_agents` (NUOVA) — R38

`code` varchar(64) NOT NULL; `name` text NOT NULL; `description` text; `agent_type` varchar(16) `CHECK IN ('ASSISTENTE','ESECUTORE','ANALISTA','CONTROLLORE','COORDINATORE','ALTRO')` (tipoAgente); `accountable_kind` varchar(12) NOT NULL `CHECK IN ('POSIZIONE','RUOLO')` (un agente risponde a un umano); `accountable_code` varchar(128) NOT NULL.

### M1.12 `sys_blueprint_content_agent_links` (NUOVA, al posto di `..._agent_activities` della mappatura) — R37, R38

`agent_code` varchar(64) NOT NULL; `link_kind` varchar(12) NOT NULL `CHECK IN ('ATTIVITA','INDICATORE')`; `process_code`, `step_code` varchar(64) (obbligatori per `ATTIVITA`); `kpi_code` varchar(64) (obbligatorio per `INDICATORE`). Porta anche le misure dell'agente (`kpi_codes` della mappatura) senza una lista in jsonb.

### M1.13 `sys_blueprint_content_design_principles` (NUOVA) — R36

`code` varchar(64) NOT NULL; `scope` varchar(24) NOT NULL `CHECK IN ('CENTRALIZZAZIONE','AUTONOMIA','SPECIALIZZAZIONE','COORDINAMENTO','ALTRO')` (ambitoPrincipio); `statement` text NOT NULL.

### M1.14 `sys_blueprint_content_perimeters` (NUOVA) — R48, ADR-0046

Una riga per voce di catalogo citata dal fascicolo. Le colonne di versione del fascicolo stanno sul pacchetto (M1.1), non su ogni riga.

| colonna | tipo | vincolo |
|---|---|---|
| `scheme` | varchar(24) NOT NULL | `CHECK IN ('CP2021','ISCO_08','ESCO_OCCUPAZIONE','ESCO_COMPETENZA','APQC_PCF','ATECO_2025','NACE_2_1','CCNL_CNEL','INDICATORE_DATASTORE','ALTRO')` (schemaCatalogo) |
| `code` | text NOT NULL | la chiave naturale nel suo schema |
| `uri` | text | |
| `name` | text | |
| `used_by_model` | boolean NOT NULL DEFAULT false | |

`UNIQUE (version_id, scheme, code)`; indice `(scheme, code)` per la domanda inversa «questa voce sta in qualche perimetro?» (sentinella di S6).

### M1.15 `sys_blueprint_content_process_steps` (NUOVA) — R07, R29, R37, R44

| colonna | tipo | vincolo |
|---|---|---|
| `process_code` | varchar(64) NOT NULL | |
| `code` | varchar(64) NOT NULL | `UNIQUE (version_id, process_code, code)` |
| `name` | text NOT NULL | |
| `ordinal` | smallint NOT NULL | |
| `input`, `output` | text | |
| `executor_kind` | varchar(12) | tipoAttore |
| `executor_code` | varchar(128) | obbligatorio se c'è il tipo |
| `work_nature` | varchar(24) | `CHECK IN ('PERSONA','ASSISTITO_AI','AUTOMATIZZABILE','AGENTE_SUPERVISIONATO')` (naturaLavoro) |
| `delivery_model` | varchar(20) | `CHECK IN ('INTERNO','SERVIZIO_CONDIVISO','ESTERNO')` (erogazione) |
| `typical_hours_per_cycle` | numeric(8,2) | `CHECK (>= 0)` |

### M1.16 `sys_blueprint_content_position_responsibilities` (NUOVA) — R17

`position_code` varchar(64) NOT NULL; `responsibility_kind` varchar(16) NOT NULL `CHECK IN ('GERARCHICA','FUNZIONALE','DI_PROCESSO','DI_PRODOTTO','DI_COMMESSA','DI_CONTROLLO')` (tipoResponsabilita); `UNIQUE (version_id, position_code, responsibility_kind)`.

### M1.17 colonne aggiunte alle altre tabelle del modello

| tabella (crea) | colonne | vincoli |
|---|---|---|
| `sys_blueprint_content_goals` (`000454`) | `level` varchar(12) `CHECK IN ('IMPRESA','PROCESSO','UNITA','RUOLO')`; `parent_code` varchar(64); `capability_code` varchar(64) | `process_code`, `unit_code`, `position_code` passano ad annullabili con `CHECK (level = 'IMPRESA' OR (process_code IS NOT NULL AND unit_code IS NOT NULL AND position_code IS NOT NULL))`; l'inversa rimette `NOT NULL` solo se nessuna riga ha i tre nulli, altrimenti si rifiuta |
| `sys_blueprint_content_kpis` (`000327`) | `scope` text; `baseline_value` numeric; `baseline_date` date; `baseline_note` text; `owner_position_code` varchar(64); `exclusions` text; `family` varchar(12) `CHECK IN ('RISULTATO','QUALITA','RISCHIO','CARICO')`; `target_valid_from`, `target_valid_to` date | `CHECK (target_valid_to IS NULL OR target_valid_from IS NULL OR target_valid_from <= target_valid_to)` |
| `sys_blueprint_content_units` (`000327`) | `mandate` text; `budget_centre` varchar(16) `CHECK IN ('COSTO','RICAVO','PROFITTO','INVESTIMENTO')` (centroBudget); `budget_item` varchar(128) | |
| `sys_blueprint_content_positions` (`000327`) | `job_role_code` varchar(128); `functional_reports_to_code` varchar(64); `ccnl_code` varchar(64) | `CHECK (functional_reports_to_code IS DISTINCT FROM blueprint_content_position_code)` |
| `sys_blueprint_content_position_processes` (`000454`) | `weekly_hours` numeric(5,2) | `CHECK (weekly_hours IS NULL OR weekly_hours BETWEEN 0 AND 168)` |
| `sys_blueprint_content_engagements` (`000454`) | `nature` varchar(16) `CHECK IN ('COMMESSA','PROGETTO','TEAM_STABILE')`, annullabile (nullo = commessa come in v0.2) | |
| `sys_blueprint_content_engagement_links` (`000454`) | `capacity_share` numeric(4,3) `CHECK (> 0 AND <= 1)` | il CHECK esistente su `link_kind` si allarga con `ROLE`, `POSITION`, `GOAL` se non li ha già: la sessione legge il vincolo attuale e lo ricrea con l'unione dei valori (drop e add nella stessa transazione) |
| `sys_blueprint_content_sites` (`000454`) | `legal_entity_code` varchar(64) | |

Inversa di M1: drop delle tabelle nuove in ordine inverso e delle colonne aggiunte, con il rifiuto di C11; il CHECK allargato di `engagement_links` torna al vecchio elenco solo se nessuna riga usa i valori nuovi.

## 2. Lato tenant: la struttura dell'azienda vera (sessione O2-03)

Una migrazione per la struttura, più uno script di riempimento fuori dalla catena.

### T1 `sys_tenant_processes` (NUOVA) — R07; il processo del tenant, distinto dal processo del modello

Oggi il processo del tenant è un processo del modello agganciato a un'unità (`sys_organization_unit_processes.org_unit_process_blueprint_process_id` → `sys_blueprint_process_registry`, `000121`). Il tenant non lo può personalizzare senza toccare il modello. La tabella nuova dà al tenant il suo processo; il legame al modello resta come origine.

| colonna | tipo | vincolo |
|---|---|---|
| `tenant_process_id` | uuid PK | |
| `tenant_process_tenant_id` | uuid NOT NULL | FK `sys_tenants` |
| `tenant_process_code` | varchar(64) NOT NULL | `UNIQUE (tenant_id, code)` |
| `tenant_process_name` | varchar(255) NOT NULL | |
| `tenant_process_description` | text | |
| `tenant_process_owner_position_id` | uuid | FK `sys_positions` RESTRICT (R07, owner) |
| `tenant_process_source_blueprint_process_id` | uuid | FK `sys_blueprint_process_registry` `ON DELETE SET NULL` |
| `tenant_process_is_active` | boolean NOT NULL DEFAULT true | |
| `tenant_process_metadata` | jsonb NOT NULL DEFAULT '{}' | |
| `origine_dato` + audit | | C1 |

Colonna aggiunta a `sys_organization_unit_processes` (`000121`): `org_unit_process_tenant_process_id uuid` FK `sys_tenant_processes` RESTRICT, annullabile, indicizzata. Sentinelle C6: `sys.v_tenant_processes_cross_tenant` (owner di un altro tenant; unità di processo di un tenant che punta al processo di un altro).

**Riempimento** (script fuori catena `db/scripts/onda2/riempi-processi-tenant.sql`, con la forma di `pe4-passo2-riempi.sql`): per ogni tenant, un `sys_tenant_processes` per ogni processo del modello distinto citato dalle sue unità di processo (codice e nome copiati, `origine_dato = 'MATERIALIZZAZIONE'`); `owner_position_id` dalla `blueprint_process_owner_position_code` del modello, risolta per codice sulle posizioni attive del tenant **solo se ne trova esattamente una**, altrimenti nulla e una riga nel registro `staging.tenant_processes_dubbi`; poi `org_unit_process_tenant_process_id` per ogni unità di processo. Misura prima, guardia che ricalcola la precondizione nella transazione, post-condizione (unità di processo invariate tranne la colonna nuova, impronta per riga), giornale `staging.tenant_processes_undo`, inversa che azzera la colonna e disattiva i processi creati dalla corsa (non li cancella). Non scrive in produzione: lo lancia l'Amministratore di Sistema al rilascio.

Inversa della migrazione: rifiuto se `sys_tenant_processes` ha righe o la colonna nuova ha valori; altrimenti drop di sentinelle, colonna e tabella.

### T2 `sys_tenant_process_steps` (NUOVA) — R07, R29, R37, R44; le attività

| colonna | tipo | vincolo |
|---|---|---|
| `tenant_process_step_id` | uuid PK | |
| `tenant_process_step_tenant_id` | uuid NOT NULL | FK `sys_tenants` |
| `tenant_process_step_process_id` | uuid NOT NULL | FK `sys_tenant_processes` CASCADE |
| `tenant_process_step_code` | varchar(64) NOT NULL | `UNIQUE (process_id, code)` |
| `tenant_process_step_name` | text NOT NULL | |
| `tenant_process_step_ordinal` | smallint NOT NULL | |
| `tenant_process_step_input`, `_output` | text | |
| `tenant_process_step_executor_kind` | varchar(12) | `CHECK IN ('POSIZIONE','RUOLO','AGENTE')` |
| `tenant_process_step_executor_position_id` | uuid | FK `sys_positions` RESTRICT |
| `tenant_process_step_executor_job_role_id` | uuid | FK `sys_job_roles` RESTRICT |
| `tenant_process_step_executor_text` | text | per `AGENTE` finché il registro degli agenti del tenant (onda 6) non esiste |
| `tenant_process_step_work_nature` | varchar(24) | naturaLavoro |
| `tenant_process_step_delivery_model` | varchar(20) | erogazione |
| `tenant_process_step_typical_hours_per_cycle` | numeric(8,2) | `CHECK (>= 0)` |
| `origine_dato` + audit | | C1 |

`CHECK` di coerenza fra `executor_kind` e la colonna valorizzata (`num_nonnulls(position_id, job_role_id, executor_text) <= 1` e quella giusta per il tipo). Sentinella C6.

### T3 `sys_job_role_activities` (NUOVA) — R15, R29; legame ruolo-attività

`job_role_activity_id` uuid PK; `job_role_activity_tenant_id` NOT NULL FK `sys_tenants`; `job_role_activity_job_role_id` NOT NULL FK `sys_job_roles` RESTRICT (ruolo di catalogo o proprio: la riga del legame è comunque del tenant); `job_role_activity_process_step_id` NOT NULL FK `sys_tenant_process_steps` CASCADE; `origine_dato` + audit; `UNIQUE (job_role_id, process_step_id, tenant_id)`. Sentinella C6 sul passo; un ruolo proprio di un altro tenant è coperto dalla stessa sentinella.

### T4 `sys_business_capabilities` (NUOVA) — R06

Nome scelto per non confondersi con `sys_capability_*` (indice di capacità, glossario). Colonne: `business_capability_id` PK; `_tenant_id` NOT NULL; `_code` varchar(64) NOT NULL; `_name` text NOT NULL; `_description` text; `_nature` varchar(16) NOT NULL naturaCapability; `_criticality` varchar(16) (come M1.4); `_coordination` text; `_is_active` boolean NOT NULL DEFAULT true; `_source_code` varchar(64) (codice del modello da cui nasce); `origine_dato` + audit; `UNIQUE (tenant_id, code)`.

### T5 `sys_business_capability_links` (NUOVA) — R06, R15

`business_capability_link_id` PK; `_tenant_id` NOT NULL; `_capability_id` NOT NULL FK T4 CASCADE; `_link_kind` varchar(16) NOT NULL `CHECK IN ('PROCESSO','COMPETENZA','STRUMENTO_DATO')`; `_tenant_process_id` FK T1 RESTRICT; `_skill_id` FK `sys_skills` RESTRICT; `_text` text; `_ordinal` smallint; `origine_dato` + audit. `CHECK` che valorizza esattamente la colonna del suo tipo. Indici unici parziali `(capability_id, tenant_process_id) WHERE link_kind = 'PROCESSO'`, `(capability_id, skill_id) WHERE link_kind = 'COMPETENZA'`. La competenza citata deve stare nel perimetro o essere propria: lo controlla l'API (ADR-0046 §4), non il database. Sentinella C6.

### T6 `sys_position_process_allocations` (NUOVA) — R28; ore di una posizione per processo

`position_process_allocation_id` PK; `_tenant_id` NOT NULL; `_position_id` NOT NULL FK `sys_positions` RESTRICT; `_tenant_process_id` NOT NULL FK T1 RESTRICT; `_weekly_hours` numeric(5,2) NOT NULL `CHECK (BETWEEN 0 AND 168)`; `origine_dato` + audit; `UNIQUE (position_id, tenant_process_id)`. La regola «la somma non supera le ore settimanali del contratto» marca e non rifiuta: è un calcolo dell'API (C7), non una sentinella, perché con dati veri può essere violata. Sentinella C6.

### T7 `sys_position_responsibilities` (NUOVA) — R17

`position_responsibility_id` PK; `_tenant_id` NOT NULL; `_position_id` NOT NULL FK `sys_positions` CASCADE; `_kind` varchar(16) NOT NULL tipoResponsabilita; `origine_dato` + audit; `UNIQUE (position_id, kind)`. Sentinella C6.

### T8 colonna aggiunta a `sys_positions` (`000011`) — R10

`position_functional_reports_to_position_id uuid` FK `sys_positions` RESTRICT, annullabile, indicizzata; `CHECK (position_functional_reports_to_position_id IS DISTINCT FROM position_id)`. Sentinella C6 (riporto funzionale verso un altro tenant). Il controllo dei cicli non è un vincolo: lo fa l'API quando nasce la rotta di scrittura (onda 3).

Classificazione della direzione per T1-T7: `importato` (C8). `sys_positions` resta com'è classificata oggi.

## 3. Lato tenant: strategia, decisioni, entità (sessione O2-04)

### T9 `sys_tenant_strategies` (NUOVA) — R01, R02

Una riga per tenant (`UNIQUE (tenant_id)`). Colonne come M1.2 con prefisso `tenant_strategy_`, più `_status` varchar(12) NOT NULL DEFAULT 'TIPICO' `CHECK IN ('TIPICO','CONFERMATO','MODIFICATO')` (nasce dai valori tipici del modello e diventa dell'azienda quando il tenant conferma o cambia: le rotte sono dell'onda 3) e `_source_version_id` FK `sys_blueprint_variant_versions` `ON DELETE SET NULL`. `competitive_lever` qui è annullabile: un tenant con modello senza strategia dichiarata ha la riga assente, non una leva inventata.

### T10 `sys_tenant_strategy_items` (NUOVA) — R01, R24

Colonne come M1.3 con prefisso `tenant_strategy_item_`; `skill_code` diventa `_skill_id` FK `sys_skills` RESTRICT; `goal_code` diventa `_goal_id` FK `sys_goals` `ON DELETE SET NULL`; più `_status` come T9 e `_is_active`. `UNIQUE (tenant_id, kind, code)`. Sentinella `sys.v_tenant_priorities_over_five`: tenant con più di cinque `PRIORITA` attive (qui è un vincolo del prodotto, non una marca: nell'azienda vera le priorità sono al massimo cinque). Sentinella C6.

### T11 `sys_legal_entities` (NUOVA) — R44

`legal_entity_id` PK; `_tenant_id` NOT NULL; `_code` varchar(64) NOT NULL; `_name` text NOT NULL; `_legal_form` varchar(64); `_country` char(2) NOT NULL `CHECK (~ '^[A-Z]{2}$')`; `_is_active`; `origine_dato` + audit; `UNIQUE (tenant_id, code)`. In advanced le sedi del tenant sono unità organizzative (non esiste una tabella delle sedi del tenant: nessun `CREATE TABLE` di `sys_sites` nelle migrazioni), quindi il legame va sull'unità: colonna `organization_unit_legal_entity_id uuid` aggiunta a `sys_organization_units` (`000009`), FK T11 RESTRICT, indicizzata. Sentinella C6.

### T12 `sys_decisions` e `sys_decision_rights` (NUOVE) — R18, R19

`sys_decisions`: `decision_id` PK; `_tenant_id` NOT NULL; `_code` varchar(64) NOT NULL; `_tenant_process_id` NOT NULL FK T1 RESTRICT; `_description` text NOT NULL; `_frequency` varchar(32); `_escalation_threshold_value` numeric(18,4); `_escalation_threshold_unit` varchar(32); `_escalation_threshold_note` text; `_escalation_position_id` FK `sys_positions` RESTRICT; `_is_active` boolean NOT NULL DEFAULT true; `origine_dato` + audit; `UNIQUE (tenant_id, code)`; `CHECK (_escalation_threshold_value IS NULL OR _escalation_position_id IS NOT NULL)` (una soglia sale verso qualcuno).

`sys_decision_rights`: `decision_right_id` PK; `_tenant_id` NOT NULL; `_decision_id` NOT NULL FK `sys_decisions` CASCADE; `_right` varchar(16) NOT NULL dirittoDecisionale; `_position_id` NOT NULL FK `sys_positions` RESTRICT; `origine_dato` + audit; `UNIQUE (decision_id, right, position_id)`; indice unico parziale `(decision_id) WHERE right = 'DECIDE'` (al massimo una posizione decide). Sentinella `sys.v_decisions_without_decider`: decisioni attive senza `DECIDE` (almeno una). Per non nascere rossa, la materializzazione (O2-06) scrive una decisione `is_active = false` quando il diritto `DECIDE` del modello è dato a un ruolo che non si risolve in esattamente una posizione del tenant, e mette la riga nel registro `staging.decision_rights_dubbi`. Sentinelle C6.

**Soglie di escalation (R19), colonna sul motore delle approvazioni.** `sys_approval_requests` (`000132`) guadagna `approval_request_decision_id uuid` FK `sys_decisions` `ON DELETE SET NULL`, annullabile, indicizzata. Il comportamento (una decisione sopra soglia apre una richiesta verso la posizione di escalation) lo scrive O2-04 nel modulo `approvals` dopo aver letto `000132` e il modulo: il disegno fissa solo la colonna. Se la lettura mostra che una richiesta di approvazione si apre per un'altra strada (definizioni di flusso), O2-04 lo scrive nell'esito e non improvvisa.

Classificazione T9-T12: `importato` (C8). `sys_approval_requests` resta `nativo`.

Inversa: rifiuto se una tabella ha righe o una colonna aggiunta ha valori; altrimenti drop di sentinelle, colonne, tabelle.

## 4. Colonne aggiunte alle tabelle esistenti del tenant (sessione O2-05)

| tabella (crea) | colonne nuove | vincoli e note | requisito |
|---|---|---|---|
| `sys_goals` (`000037`) | `goal_level` varchar(12) `CHECK IN ('IMPRESA','PROCESSO','UNITA','RUOLO')`, annullabile (nullo = obiettivo personale come oggi, nessun riempimento); `goal_tenant_process_id` FK T1; `goal_organization_unit_id` FK `sys_organization_units`; `goal_position_id` FK `sys_positions`; `goal_business_capability_id` FK T4; tutte RESTRICT e indicizzate | `CHECK (goal_level IS NULL OR (goal_level = 'IMPRESA' AND num_nonnulls(goal_tenant_process_id, goal_organization_unit_id, goal_position_id) = 0) OR (goal_level = 'PROCESSO' AND goal_tenant_process_id IS NOT NULL) OR (goal_level = 'UNITA' AND goal_organization_unit_id IS NOT NULL) OR (goal_level = 'RUOLO' AND goal_position_id IS NOT NULL))`; il padre esiste già (`goal_parent_goal_id`) | R05, R21 |
| `sys_kpi_definitions` (`000015`) | `kpi_definition_frequency` varchar(16) `CHECK IN ('GIORNALIERA','SETTIMANALE','MENSILE','TRIMESTRALE','ANNUALE','PER_EVENTO','ALTRO')`; `kpi_definition_data_source` text; `kpi_definition_family` varchar(12) famigliaIndicatore | solo gli attributi **della definizione**, validi anche sulle voci di catalogo senza tenant | R13, R22 |
| `sys_kpi_tenant_profiles` (NUOVA) | `kpi_tenant_profile_id` PK; `_tenant_id` NOT NULL; `_kpi_definition_id` NOT NULL FK `sys_kpi_definitions` RESTRICT; `_scope` text; `_baseline_value` numeric(18,4); `_baseline_date` date; `_baseline_note` text; `_owner_position_id` FK `sys_positions` RESTRICT; `_exclusions` text; `origine_dato` + audit | `UNIQUE (tenant_id, kpi_definition_id)`. Perimetro, baseline, responsabile ed esclusioni sono dell'azienda, non dell'indicatore: su una definizione di catalogo condivisa fra tenant non possono stare. Classificazione `importato` (C8). Sentinella C6 | R13 |
| `sys_kpi_targets` (`000015`) | `kpi_target_tenant_process_id` FK T1; `kpi_target_organization_unit_id` FK `sys_organization_units`; RESTRICT, indicizzate | `CHECK (num_nonnulls(kpi_target_position_id, kpi_target_user_id, kpi_target_tenant_process_id, kpi_target_organization_unit_id) <= 1)` aggiunto `NOT VALID`; si valida nella stessa migrazione solo se la misura `select count(*) from sys.sys_kpi_targets where num_nonnulls(kpi_target_position_id, kpi_target_user_id) > 1` dà zero, altrimenti resta `NOT VALID` e la sessione lo scrive nell'esito | R14 |
| `sys_organization_units` (`000009`) | `organization_unit_mandate` text; `organization_unit_budget_centre` varchar(16) centroBudget; `organization_unit_budget_item` varchar(128) | (la colonna dell'entità giuridica è di O2-04, T11) | R08 |
| `sys_team_members` (`000054`) | `team_member_capacity_share` numeric(4,3) `CHECK (> 0 AND <= 1)` | annullabile, nessun riempimento | R12 |
| `sys_project_members` (`000363`) | `project_member_capacity_share` numeric(4,3), stesso vincolo | | R12 |
| `sys_user_skills` (`000180`) | `user_skill_usage_context` text; `user_skill_reverify_by` date | | R25 |

**Disponibilità residua (R11)**: nessuna colonna, è un calcolo: per una persona, la somma dei `fte` delle assegnazioni ACTIVE meno la somma delle quote di capacità delle sue appartenenze attive a squadre e progetti. Sta nel repository dell'API (C7) ed è esposta dove la persona è già esposta; una colonna calcolata andrebbe fuori allineamento al primo cambio.

**Esposizione.** Il cancello di esposizione (`check_exposure.py`) dice che un dato che nessuna API espone non è nel prodotto: ogni colonna nuova di questa sezione entra negli schemi Zod condivisi (`packages/shared`) e nelle risposte delle rotte che leggono già quella tabella, nella stessa sessione.

Inversa: drop delle colonne e della tabella nuova con il rifiuto di C11; il CHECK `NOT VALID` si toglie per primo.

## 5. Dal modello al tenant: che cosa copia la materializzazione (sessione O2-06)

All'attivazione di una versione con pacchetto v0.3, `tenant-materialization` porta le sezioni nuove nelle tabelle del tenant. Regola unica: si copia per codice; un riferimento del modello che non si risolve in esattamente una riga del tenant non si indovina, va nel registro dei dubbi `staging.materializzazione_v03_dubbi` (tenant, sezione, codice, motivo) e la riga nasce disattivata o col campo nullo.

| dal modello | al tenant | risoluzione dei codici |
|---|---|---|
| M1.2, M1.3 | T9, T10 (`_status = 'TIPICO'`) | `skill_code` per URI nel perimetro o nelle voci proprie; `goal_code` per codice naturale dell'obiettivo |
| M1.4, M1.5 | T4, T5 | processo per codice in T1; competenza come sopra |
| `sys_blueprint_process_registry` + M1.15 | T1, T2 | esecutore `POSIZIONE` per codice della posizione; `RUOLO` per codice del ruolo |
| M1.7 (`ATTIVITA`) | T3 | ruolo per codice, passo per (processo, codice) |
| M1.8, M1.9 | T12 | `POSIZIONE` per codice; `RUOLO` → posizioni attive del tenant con quel ruolo: per `DECIDE` solo se è una, altrimenti dubbio e decisione disattivata |
| M1.10, `sites.legal_entity_code` | T11, `organization_unit_legal_entity_id` | sede → unità per codice |
| M1.16 | T7 | posizione per codice |
| M1.17 positions `functional_reports_to_code` | T8 | posizione per codice |
| `position_processes.weekly_hours` | T6 | posizione e processo per codice |
| M1.17 kpis | `sys_kpi_definitions` (attributi di definizione), `sys_kpi_tenant_profiles` (perimetro, baseline, responsabile, esclusioni) | indicatore per codice |
| M1.17 goals (`level`, `parent_code`, `capability_code`) | `sys_goals` colonne nuove | come sopra |
| M1.17 units | `sys_organization_units` colonne nuove | unità per codice |
| M1.11-M1.13 (agenti, principi) | nessuna tabella del tenant nell'onda 2 | restano nel modello, consultabili; il tenant li riceve nelle onde 4 (principi) e 6 (agenti) |
| M1.14 (perimetro) | nessuna copia (ADR-0046 §1) | il risolutore legge la versione attiva |

Una sezione dichiarata vuota nel pacchetto produce zero righe e nessun dubbio: «dichiarato vuoto» si mostra come tale, non si riempie.
