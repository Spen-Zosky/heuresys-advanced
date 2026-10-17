-- ============================================================================
-- 000458 — Il contenuto del pacchetto v0.3 trova casa, lato modello (onda 2, O2-01; disegno: .programmi/onda2/DISEGNO_tabelle-onda2.md §1, M1.1-M1.17)
--
-- IL PROBLEMA. Il contratto dati v0.3 (approvato il 2026-10-17) aggiunge al pacchetto del datastore sezioni e campi che in advanced non hanno
-- ancora una casa: strategia, capability, decisioni con i loro diritti, entita' giuridiche, agenti, principi di progettazione, perimetro del
-- tipo d'impresa, fasi dei processi, responsabilita' delle posizioni, legami ruolo-attivita'/competenza, e molti campi nuovi su obiettivi,
-- indicatori, unita', posizioni e commesse. Oggi tutto questo si perderebbe all'accoglienza del pacchetto.
--
-- COSA FA. Stessa forma della 000454: ogni riga appartiene a UNA VERSIONE di variante, chiave naturale (versione, codice), legami per CODICE,
-- tabelle di PIATTAFORMA senza tenant_id (I5/ADR-0043), campi categorici varchar + CHECK (RD-08), date come date (RD-09), origine_dato
-- 'DATASTORE'. 14 tabelle nuove, undici colonne sul pacchetto, colonne nuove su sette tabelle esistenti, un CHECK allargato
-- (engagement_links.link_kind) e tre colonne dell'obiettivo rese annullabili. Dove lo schema JSON v0.3 contraddice il disegno vince lo schema:
-- i casi sono elencati nell'esito di O2-01 (.programmi/onda2/ESITO_O2-01.md).
--
-- NON FA. Non scrive dati, non tocca le tabelle del tenant (O2-03 e seguenti), non tocca il caricatore (O2-02).
-- IDEMPOTENTE: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, vincoli e indici aggiunti solo se assenti (pg_constraint / pg_indexes).
-- CLASSIFICAZIONE E REGISTRO: le 14 tabelle sono classificate 'importato' in 000429 (che ne conta 296) e registrate in 000062 (classe D / EXCLUDE), che e' il file che pretende 0 UNCLASSIFIED: un
--   numero minore. Registrarle solo qui sarebbe verde alla prima passata e rosso alla seconda.
-- PER TORNARE INDIETRO: db/scripts/onda2/000458-inversa.sql (FUORI catena: la catena la riapplicherebbe). Si rifiuta se una tabella ha righe
--   o una colonna ha valori; tornare indietro con dati dentro vuol dire perdere contenuto, ed e' una decisione dell'Amministratore di Sistema.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- M1.1  pacchetto: origine, completezza, perimetro
-- ---------------------------------------------------------------------------
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_source_schema_version varchar(48);
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_converted_at timestamptz;
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_converter varchar(80);
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_source_hash char(64);
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_is_complete boolean;
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_steps_accepted integer;
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_steps_total integer;
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_perimeter_status varchar(16) NOT NULL DEFAULT 'NON_RILASCIATO';
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_dossier_version varchar(32);
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_extends_version varchar(32);
ALTER TABLE sys.sys_blueprint_content_packages ADD COLUMN IF NOT EXISTS blueprint_content_package_extension_request text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_packages_source_hash_ck' AND conrelid = 'sys.sys_blueprint_content_packages'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_packages ADD CONSTRAINT sys_blueprint_content_packages_source_hash_ck CHECK (blueprint_content_package_source_hash IS NULL OR blueprint_content_package_source_hash ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_packages_steps_ck' AND conrelid = 'sys.sys_blueprint_content_packages'::regclass) THEN
    -- passiCascata ha minimum 1 nello schema JSON v0.3 (il disegno diceva >= 0: vince lo schema)
    ALTER TABLE sys.sys_blueprint_content_packages ADD CONSTRAINT sys_blueprint_content_packages_steps_ck CHECK (
      (blueprint_content_package_steps_accepted IS NULL OR blueprint_content_package_steps_accepted >= 0)
      AND (blueprint_content_package_steps_total IS NULL OR blueprint_content_package_steps_total >= 1)
      AND (blueprint_content_package_steps_accepted IS NULL OR blueprint_content_package_steps_total IS NULL OR blueprint_content_package_steps_accepted <= blueprint_content_package_steps_total));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_packages_perimeter_status_ck' AND conrelid = 'sys.sys_blueprint_content_packages'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_packages ADD CONSTRAINT sys_blueprint_content_packages_perimeter_status_ck CHECK (blueprint_content_package_perimeter_status IN ('DICHIARATO','NON_RILASCIATO'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- M1.2  strategia tipica del tipo d'impresa (una per versione)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_strategies (
  blueprint_content_strategy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_strategy_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_strategy_competitive_lever varchar(24) NOT NULL,
  blueprint_content_strategy_secondary_lever varchar(24),
  blueprint_content_strategy_lever_rationale text,
  blueprint_content_strategy_growth_ambition varchar(16),
  blueprint_content_strategy_foreign_presence varchar(16),
  blueprint_content_strategy_source_note text,
  blueprint_content_strategy_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_strategies_uq UNIQUE (blueprint_content_strategy_version_id),
  CONSTRAINT sys_blueprint_content_strategies_lever_ck CHECK (blueprint_content_strategy_competitive_lever IN ('COSTO','QUALITA','INNOVAZIONE','PERSONALIZZAZIONE','SERVIZIO')),
  CONSTRAINT sys_blueprint_content_strategies_secondary_lever_ck CHECK (blueprint_content_strategy_secondary_lever IS NULL OR (blueprint_content_strategy_secondary_lever IN ('COSTO','QUALITA','INNOVAZIONE','PERSONALIZZAZIONE','SERVIZIO') AND blueprint_content_strategy_secondary_lever <> blueprint_content_strategy_competitive_lever)),
  CONSTRAINT sys_blueprint_content_strategies_growth_ambition_ck CHECK (blueprint_content_strategy_growth_ambition IS NULL OR blueprint_content_strategy_growth_ambition IN ('MANTENIMENTO','MODERATA','FORTE')),
  CONSTRAINT sys_blueprint_content_strategies_foreign_presence_ck CHECK (blueprint_content_strategy_foreign_presence IS NULL OR blueprint_content_strategy_foreign_presence IN ('NESSUNA','ESPORTAZIONE','SEDI_ESTERE'))
);

-- ---------------------------------------------------------------------------
-- M1.3  voci della strategia: segmenti, linee d'offerta, competenze scarse, dipendenze, priorita'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_strategy_items (
  blueprint_content_strategy_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_strategy_item_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_strategy_item_kind varchar(24) NOT NULL,
  blueprint_content_strategy_item_code varchar(64) NOT NULL,
  blueprint_content_strategy_item_name text,
  blueprint_content_strategy_item_description text,
  blueprint_content_strategy_item_channel varchar(16),
  blueprint_content_strategy_item_shares_skills boolean,
  blueprint_content_strategy_item_shares_plants boolean,
  blueprint_content_strategy_item_skill_code text,
  blueprint_content_strategy_item_dependency_kind varchar(32),
  blueprint_content_strategy_item_goal_code varchar(64),
  blueprint_content_strategy_item_ordinal smallint,
  blueprint_content_strategy_item_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_strategy_items_uq UNIQUE (blueprint_content_strategy_item_version_id, blueprint_content_strategy_item_kind, blueprint_content_strategy_item_code),
  CONSTRAINT sys_blueprint_content_strategy_items_kind_ck CHECK (blueprint_content_strategy_item_kind IN ('SEGMENTO','LINEA_OFFERTA','COMPETENZA_SCARSA','DIPENDENZA','PRIORITA')),
  CONSTRAINT sys_blueprint_content_strategy_items_channel_ck CHECK (blueprint_content_strategy_item_channel IS NULL OR blueprint_content_strategy_item_channel IN ('FISICO','DIGITALE','INTERMEDIATO','MISTO')),
  CONSTRAINT sys_blueprint_content_strategy_items_dependency_kind_ck CHECK (blueprint_content_strategy_item_dependency_kind IS NULL OR blueprint_content_strategy_item_dependency_kind IN ('FONDATORE','SPECIALISTA','ALTRO')),
  -- lo schema: `nome` e' facoltativo per le dipendenze (e solo per quelle), `descrizione` vi e' obbligatoria
  CONSTRAINT sys_blueprint_content_strategy_items_name_ck CHECK (blueprint_content_strategy_item_name IS NOT NULL OR (blueprint_content_strategy_item_kind = 'DIPENDENZA' AND blueprint_content_strategy_item_description IS NOT NULL)),
  -- ogni campo specifico vale solo per il suo tipo di voce
  CONSTRAINT sys_blueprint_content_strategy_items_kind_fields_ck CHECK (
    (blueprint_content_strategy_item_channel IS NULL OR blueprint_content_strategy_item_kind = 'SEGMENTO')
    AND ((blueprint_content_strategy_item_shares_skills IS NULL AND blueprint_content_strategy_item_shares_plants IS NULL) OR blueprint_content_strategy_item_kind = 'LINEA_OFFERTA')
    AND (blueprint_content_strategy_item_skill_code IS NULL OR blueprint_content_strategy_item_kind = 'COMPETENZA_SCARSA')
    AND (blueprint_content_strategy_item_dependency_kind IS NULL OR blueprint_content_strategy_item_kind = 'DIPENDENZA')
    AND (blueprint_content_strategy_item_goal_code IS NULL OR blueprint_content_strategy_item_kind = 'PRIORITA'))
);

-- ---------------------------------------------------------------------------
-- M1.4  capability (cio' che l'impresa deve saper fare; NON e' sys_capability_scores)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_capabilities (
  blueprint_content_capability_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_capability_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_capability_code varchar(64) NOT NULL,
  blueprint_content_capability_name text NOT NULL,
  blueprint_content_capability_description text,
  blueprint_content_capability_nature varchar(16) NOT NULL,
  blueprint_content_capability_criticality varchar(16),
  blueprint_content_capability_coordination text,
  blueprint_content_capability_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_capabilities_uq UNIQUE (blueprint_content_capability_version_id, blueprint_content_capability_code),
  CONSTRAINT sys_blueprint_content_capabilities_nature_ck CHECK (blueprint_content_capability_nature IN ('DISTINTIVA','NECESSARIA','DI_SUPPORTO')),
  CONSTRAINT sys_blueprint_content_capabilities_criticality_ck CHECK (blueprint_content_capability_criticality IS NULL OR blueprint_content_capability_criticality IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);

-- ---------------------------------------------------------------------------
-- M1.5  legami della capability: processi, competenze, strumenti e dati
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_capability_links (
  blueprint_content_capability_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_capability_link_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_capability_link_capability_code varchar(64) NOT NULL,
  blueprint_content_capability_link_link_kind varchar(16) NOT NULL,
  blueprint_content_capability_link_link_code text,
  blueprint_content_capability_link_text text,
  blueprint_content_capability_link_ordinal smallint,
  blueprint_content_capability_link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_capability_links_kind_ck CHECK (blueprint_content_capability_link_link_kind IN ('PROCESSO','COMPETENZA','STRUMENTO_DATO')),
  CONSTRAINT sys_blueprint_content_capability_links_shape_ck CHECK (
    (blueprint_content_capability_link_link_kind = 'STRUMENTO_DATO' AND blueprint_content_capability_link_text IS NOT NULL)
    OR (blueprint_content_capability_link_link_kind <> 'STRUMENTO_DATO' AND blueprint_content_capability_link_link_code IS NOT NULL))
);
-- unicita' con indice parziale, non con COALESCE nella chiave (ADR-0018)
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_capability_links_uq
  ON sys.sys_blueprint_content_capability_links (blueprint_content_capability_link_version_id, blueprint_content_capability_link_capability_code, blueprint_content_capability_link_link_kind, blueprint_content_capability_link_link_code)
  WHERE blueprint_content_capability_link_link_code IS NOT NULL;

-- ---------------------------------------------------------------------------
-- M1.6  ruolo: missione, famiglia, ESCO, CP2021, impatto dell'AI (+ origine_dato che la 000397 non aveva)
-- ---------------------------------------------------------------------------
ALTER TABLE sys.sys_blueprint_content_job_roles ADD COLUMN IF NOT EXISTS blueprint_content_job_role_mission text;
ALTER TABLE sys.sys_blueprint_content_job_roles ADD COLUMN IF NOT EXISTS blueprint_content_job_role_professional_family varchar(128);
ALTER TABLE sys.sys_blueprint_content_job_roles ADD COLUMN IF NOT EXISTS blueprint_content_job_role_esco_uri text;
ALTER TABLE sys.sys_blueprint_content_job_roles ADD COLUMN IF NOT EXISTS blueprint_content_job_role_esco_name text;
ALTER TABLE sys.sys_blueprint_content_job_roles ADD COLUMN IF NOT EXISTS blueprint_content_job_role_cp2021_code varchar(16);
ALTER TABLE sys.sys_blueprint_content_job_roles ADD COLUMN IF NOT EXISTS blueprint_content_job_role_ai_impact varchar(8);
ALTER TABLE sys.sys_blueprint_content_job_roles ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE';
DO $$ BEGIN
  -- impattoAi e' un valore categorico nello schema (BASSO/MEDIO/ALTO/null), non un oggetto: varchar + CHECK invece di jsonb (il disegno lasciava aperta la forma)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_job_roles_ai_impact_ck' AND conrelid = 'sys.sys_blueprint_content_job_roles'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_job_roles ADD CONSTRAINT sys_blueprint_content_job_roles_ai_impact_ck CHECK (blueprint_content_job_role_ai_impact IS NULL OR blueprint_content_job_role_ai_impact IN ('BASSO','MEDIO','ALTO'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- M1.7  legami del ruolo: attivita' (processo + fase) e competenze (con livello, eventualmente per processo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_job_role_links (
  blueprint_content_job_role_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_job_role_link_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_job_role_link_job_role_code varchar(128) NOT NULL,
  blueprint_content_job_role_link_link_kind varchar(12) NOT NULL,
  blueprint_content_job_role_link_process_code varchar(64),
  blueprint_content_job_role_link_step_code varchar(64),
  blueprint_content_job_role_link_skill_code text,
  blueprint_content_job_role_link_proficiency varchar(16),
  blueprint_content_job_role_link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_job_role_links_kind_ck CHECK (blueprint_content_job_role_link_link_kind IN ('ATTIVITA','COMPETENZA')),
  CONSTRAINT sys_blueprint_content_job_role_links_proficiency_ck CHECK (blueprint_content_job_role_link_proficiency IS NULL OR blueprint_content_job_role_link_proficiency IN ('NOVICE','BASIC','COMPETENT','PROFICIENT','EXPERT','MASTER')),
  -- ATTIVITA: il processo e' obbligatorio, la fase (`faseCodice`) e' facoltativa nello schema v0.3 (il disegno la voleva obbligatoria: vince lo schema)
  -- COMPETENZA: la competenza e il livello sono obbligatori, il processo facoltativo, nessuna fase
  CONSTRAINT sys_blueprint_content_job_role_links_shape_ck CHECK (
    (blueprint_content_job_role_link_link_kind = 'ATTIVITA' AND blueprint_content_job_role_link_process_code IS NOT NULL AND blueprint_content_job_role_link_skill_code IS NULL AND blueprint_content_job_role_link_proficiency IS NULL)
    OR (blueprint_content_job_role_link_link_kind = 'COMPETENZA' AND blueprint_content_job_role_link_skill_code IS NOT NULL AND blueprint_content_job_role_link_proficiency IS NOT NULL AND blueprint_content_job_role_link_step_code IS NULL)),
  CONSTRAINT sys_blueprint_content_job_role_links_step_needs_process_ck CHECK (blueprint_content_job_role_link_step_code IS NULL OR blueprint_content_job_role_link_process_code IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_job_role_links_att_fase_uq
  ON sys.sys_blueprint_content_job_role_links (blueprint_content_job_role_link_version_id, blueprint_content_job_role_link_job_role_code, blueprint_content_job_role_link_process_code, blueprint_content_job_role_link_step_code)
  WHERE blueprint_content_job_role_link_link_kind = 'ATTIVITA' AND blueprint_content_job_role_link_step_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_job_role_links_att_processo_uq
  ON sys.sys_blueprint_content_job_role_links (blueprint_content_job_role_link_version_id, blueprint_content_job_role_link_job_role_code, blueprint_content_job_role_link_process_code)
  WHERE blueprint_content_job_role_link_link_kind = 'ATTIVITA' AND blueprint_content_job_role_link_step_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_job_role_links_comp_processo_uq
  ON sys.sys_blueprint_content_job_role_links (blueprint_content_job_role_link_version_id, blueprint_content_job_role_link_job_role_code, blueprint_content_job_role_link_skill_code, blueprint_content_job_role_link_process_code)
  WHERE blueprint_content_job_role_link_link_kind = 'COMPETENZA' AND blueprint_content_job_role_link_process_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_job_role_links_comp_ruolo_uq
  ON sys.sys_blueprint_content_job_role_links (blueprint_content_job_role_link_version_id, blueprint_content_job_role_link_job_role_code, blueprint_content_job_role_link_skill_code)
  WHERE blueprint_content_job_role_link_link_kind = 'COMPETENZA' AND blueprint_content_job_role_link_process_code IS NULL;

-- ---------------------------------------------------------------------------
-- M1.8  decisioni che contano per processo (NON e' sys_approval_*)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_decisions (
  blueprint_content_decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_decision_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_decision_code varchar(64) NOT NULL,
  blueprint_content_decision_process_code varchar(64) NOT NULL,
  blueprint_content_decision_description text NOT NULL,
  blueprint_content_decision_frequency varchar(16),
  blueprint_content_decision_escalation_threshold text,
  blueprint_content_decision_escalation_actor_kind varchar(12),
  blueprint_content_decision_escalation_actor_code varchar(128),
  blueprint_content_decision_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_decisions_uq UNIQUE (blueprint_content_decision_version_id, blueprint_content_decision_code),
  -- la frequenza ha un vocabolario nello schema (lo stesso di frequenzaIndicatore); il disegno diceva «nessun vocabolario»
  CONSTRAINT sys_blueprint_content_decisions_frequency_ck CHECK (blueprint_content_decision_frequency IS NULL OR blueprint_content_decision_frequency IN ('GIORNALIERA','SETTIMANALE','MENSILE','TRIMESTRALE','ANNUALE','PER_EVENTO','ALTRO')),
  CONSTRAINT sys_blueprint_content_decisions_actor_kind_ck CHECK (blueprint_content_decision_escalation_actor_kind IS NULL OR blueprint_content_decision_escalation_actor_kind IN ('POSIZIONE','RUOLO','AGENTE')),
  CONSTRAINT sys_blueprint_content_decisions_actor_pair_ck CHECK ((blueprint_content_decision_escalation_actor_kind IS NULL) = (blueprint_content_decision_escalation_actor_code IS NULL))
);

-- ---------------------------------------------------------------------------
-- M1.9  diritti sulle decisioni (la regola «esattamente un DECIDE» marca e non rifiuta: la conta il caricatore)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_decision_rights (
  blueprint_content_decision_right_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_decision_right_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_decision_right_decision_code varchar(64) NOT NULL,
  blueprint_content_decision_right_right varchar(16) NOT NULL,
  blueprint_content_decision_right_actor_kind varchar(12) NOT NULL,
  blueprint_content_decision_right_actor_code varchar(128) NOT NULL,
  blueprint_content_decision_right_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_decision_rights_uq UNIQUE (blueprint_content_decision_right_version_id, blueprint_content_decision_right_decision_code, blueprint_content_decision_right_right, blueprint_content_decision_right_actor_kind, blueprint_content_decision_right_actor_code),
  CONSTRAINT sys_blueprint_content_decision_rights_right_ck CHECK (blueprint_content_decision_right_right IN ('PROPONE','CONTRIBUISCE','ASSENSO','DECIDE','ESEGUE')),
  CONSTRAINT sys_blueprint_content_decision_rights_actor_kind_ck CHECK (blueprint_content_decision_right_actor_kind IN ('POSIZIONE','RUOLO','AGENTE'))
);

-- ---------------------------------------------------------------------------
-- M1.10  entita' giuridiche (+ legame sulla sede, piu' sotto)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_legal_entities (
  blueprint_content_legal_entity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_legal_entity_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_legal_entity_code varchar(64) NOT NULL,
  blueprint_content_legal_entity_name text NOT NULL,
  blueprint_content_legal_entity_legal_form varchar(64),
  blueprint_content_legal_entity_country char(2) NOT NULL,
  blueprint_content_legal_entity_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_legal_entities_uq UNIQUE (blueprint_content_legal_entity_version_id, blueprint_content_legal_entity_code),
  CONSTRAINT sys_blueprint_content_legal_entities_country_ck CHECK (blueprint_content_legal_entity_country ~ '^[A-Z]{2}$')
);

-- ---------------------------------------------------------------------------
-- M1.11  agenti AI tipici (rispondono sempre a un umano: posizione o ruolo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_agents (
  blueprint_content_agent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_agent_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_agent_code varchar(64) NOT NULL,
  blueprint_content_agent_name text NOT NULL,
  blueprint_content_agent_description text,
  blueprint_content_agent_agent_type varchar(16),
  blueprint_content_agent_accountable_kind varchar(12) NOT NULL,
  blueprint_content_agent_accountable_code varchar(128) NOT NULL,
  blueprint_content_agent_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_agents_uq UNIQUE (blueprint_content_agent_version_id, blueprint_content_agent_code),
  CONSTRAINT sys_blueprint_content_agents_type_ck CHECK (blueprint_content_agent_agent_type IS NULL OR blueprint_content_agent_agent_type IN ('ASSISTENTE','ESECUTORE','ANALISTA','CONTROLLORE','COORDINATORE','ALTRO')),
  CONSTRAINT sys_blueprint_content_agents_accountable_kind_ck CHECK (blueprint_content_agent_accountable_kind IN ('POSIZIONE','RUOLO'))
);

-- ---------------------------------------------------------------------------
-- M1.12  legami dell'agente: attivita' (processo + fase) e indicatori che lo misurano
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_agent_links (
  blueprint_content_agent_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_agent_link_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_agent_link_agent_code varchar(64) NOT NULL,
  blueprint_content_agent_link_link_kind varchar(12) NOT NULL,
  blueprint_content_agent_link_process_code varchar(64),
  blueprint_content_agent_link_step_code varchar(64),
  blueprint_content_agent_link_kpi_code varchar(64),
  blueprint_content_agent_link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_agent_links_kind_ck CHECK (blueprint_content_agent_link_link_kind IN ('ATTIVITA','INDICATORE')),
  -- come per il ruolo, `faseCodice` e' facoltativa nello schema: l'attivita' dell'agente puo' stare al livello del processo
  CONSTRAINT sys_blueprint_content_agent_links_shape_ck CHECK (
    (blueprint_content_agent_link_link_kind = 'ATTIVITA' AND blueprint_content_agent_link_process_code IS NOT NULL AND blueprint_content_agent_link_kpi_code IS NULL)
    OR (blueprint_content_agent_link_link_kind = 'INDICATORE' AND blueprint_content_agent_link_kpi_code IS NOT NULL AND blueprint_content_agent_link_process_code IS NULL AND blueprint_content_agent_link_step_code IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_agent_links_att_fase_uq
  ON sys.sys_blueprint_content_agent_links (blueprint_content_agent_link_version_id, blueprint_content_agent_link_agent_code, blueprint_content_agent_link_process_code, blueprint_content_agent_link_step_code)
  WHERE blueprint_content_agent_link_link_kind = 'ATTIVITA' AND blueprint_content_agent_link_step_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_agent_links_att_processo_uq
  ON sys.sys_blueprint_content_agent_links (blueprint_content_agent_link_version_id, blueprint_content_agent_link_agent_code, blueprint_content_agent_link_process_code)
  WHERE blueprint_content_agent_link_link_kind = 'ATTIVITA' AND blueprint_content_agent_link_step_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_agent_links_ind_uq
  ON sys.sys_blueprint_content_agent_links (blueprint_content_agent_link_version_id, blueprint_content_agent_link_agent_code, blueprint_content_agent_link_kpi_code)
  WHERE blueprint_content_agent_link_link_kind = 'INDICATORE';

-- ---------------------------------------------------------------------------
-- M1.13  principi di progettazione
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_design_principles (
  blueprint_content_design_principle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_design_principle_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_design_principle_code varchar(64) NOT NULL,
  blueprint_content_design_principle_scope varchar(24) NOT NULL,
  blueprint_content_design_principle_statement text NOT NULL,
  blueprint_content_design_principle_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_design_principles_uq UNIQUE (blueprint_content_design_principle_version_id, blueprint_content_design_principle_code),
  CONSTRAINT sys_blueprint_content_design_principles_scope_ck CHECK (blueprint_content_design_principle_scope IN ('CENTRALIZZAZIONE','AUTONOMIA','SPECIALIZZAZIONE','COORDINAMENTO','ALTRO'))
);

-- ---------------------------------------------------------------------------
-- M1.14  perimetro del tipo d'impresa: le voci di catalogo citate dal fascicolo (le versioni del fascicolo stanno sul pacchetto, M1.1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_perimeters (
  blueprint_content_perimeter_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_perimeter_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_perimeter_scheme varchar(24) NOT NULL,
  blueprint_content_perimeter_code text NOT NULL,
  blueprint_content_perimeter_uri text,
  blueprint_content_perimeter_name text,
  blueprint_content_perimeter_used_by_model boolean NOT NULL DEFAULT false,
  blueprint_content_perimeter_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_perimeters_uq UNIQUE (blueprint_content_perimeter_version_id, blueprint_content_perimeter_scheme, blueprint_content_perimeter_code),
  CONSTRAINT sys_blueprint_content_perimeters_scheme_ck CHECK (blueprint_content_perimeter_scheme IN ('CP2021','ISCO_08','ESCO_OCCUPAZIONE','ESCO_COMPETENZA','APQC_PCF','ATECO_2025','NACE_2_1','CCNL_CNEL','INDICATORE_DATASTORE','ALTRO'))
);
-- la domanda inversa «questa voce sta in qualche perimetro?» (sentinella di S6)
CREATE INDEX IF NOT EXISTS sys_blueprint_content_perimeters_voce_idx
  ON sys.sys_blueprint_content_perimeters (blueprint_content_perimeter_scheme, blueprint_content_perimeter_code);

-- ---------------------------------------------------------------------------
-- M1.15  fasi dei processi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_process_steps (
  blueprint_content_process_step_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_process_step_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_process_step_process_code varchar(64) NOT NULL,
  blueprint_content_process_step_code varchar(64) NOT NULL,
  blueprint_content_process_step_name text NOT NULL,
  blueprint_content_process_step_ordinal smallint NOT NULL,
  blueprint_content_process_step_input text,
  blueprint_content_process_step_output text,
  blueprint_content_process_step_executor_kind varchar(12),
  blueprint_content_process_step_executor_code varchar(128),
  blueprint_content_process_step_work_nature varchar(24),
  blueprint_content_process_step_delivery_model varchar(20),
  blueprint_content_process_step_typical_hours_per_cycle numeric(8,2),
  blueprint_content_process_step_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_process_steps_uq UNIQUE (blueprint_content_process_step_version_id, blueprint_content_process_step_process_code, blueprint_content_process_step_code),
  CONSTRAINT sys_blueprint_content_process_steps_executor_kind_ck CHECK (blueprint_content_process_step_executor_kind IS NULL OR blueprint_content_process_step_executor_kind IN ('POSIZIONE','RUOLO','AGENTE')),
  CONSTRAINT sys_blueprint_content_process_steps_executor_pair_ck CHECK ((blueprint_content_process_step_executor_kind IS NULL) = (blueprint_content_process_step_executor_code IS NULL)),
  CONSTRAINT sys_blueprint_content_process_steps_work_nature_ck CHECK (blueprint_content_process_step_work_nature IS NULL OR blueprint_content_process_step_work_nature IN ('PERSONA','ASSISTITO_AI','AUTOMATIZZABILE','AGENTE_SUPERVISIONATO')),
  CONSTRAINT sys_blueprint_content_process_steps_delivery_model_ck CHECK (blueprint_content_process_step_delivery_model IS NULL OR blueprint_content_process_step_delivery_model IN ('INTERNO','SERVIZIO_CONDIVISO','ESTERNO')),
  CONSTRAINT sys_blueprint_content_process_steps_hours_ck CHECK (blueprint_content_process_step_typical_hours_per_cycle IS NULL OR blueprint_content_process_step_typical_hours_per_cycle >= 0)
);

-- ---------------------------------------------------------------------------
-- M1.16  responsabilita' delle posizioni
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_position_responsibilities (
  blueprint_content_position_responsibility_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_position_responsibility_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_position_responsibility_position_code varchar(64) NOT NULL,
  blueprint_content_position_responsibility_kind varchar(16) NOT NULL,
  blueprint_content_position_responsibility_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_position_responsibilities_uq UNIQUE (blueprint_content_position_responsibility_version_id, blueprint_content_position_responsibility_position_code, blueprint_content_position_responsibility_kind),
  CONSTRAINT sys_blueprint_content_position_responsibilities_kind_ck CHECK (blueprint_content_position_responsibility_kind IN ('GERARCHICA','FUNZIONALE','DI_PROCESSO','DI_PRODOTTO','DI_COMMESSA','DI_CONTROLLO'))
);

-- ---------------------------------------------------------------------------
-- Indici sulle chiavi esterne (C5): la prima colonna di ogni UNIQUE gia' copre la versione per le tabelle con chiave naturale che parte da li';
-- l'indice esplicito serve dove la chiave e' parziale o parte da un'altra colonna, e lo mettiamo ovunque per uniformita' e leggibilita'.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sys_blueprint_content_strategies_versione_idx ON sys.sys_blueprint_content_strategies (blueprint_content_strategy_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_strategy_items_versione_idx ON sys.sys_blueprint_content_strategy_items (blueprint_content_strategy_item_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_capabilities_versione_idx ON sys.sys_blueprint_content_capabilities (blueprint_content_capability_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_capability_links_versione_idx ON sys.sys_blueprint_content_capability_links (blueprint_content_capability_link_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_job_role_links_versione_idx ON sys.sys_blueprint_content_job_role_links (blueprint_content_job_role_link_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_decisions_versione_idx ON sys.sys_blueprint_content_decisions (blueprint_content_decision_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_decision_rights_versione_idx ON sys.sys_blueprint_content_decision_rights (blueprint_content_decision_right_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_legal_entities_versione_idx ON sys.sys_blueprint_content_legal_entities (blueprint_content_legal_entity_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_agents_versione_idx ON sys.sys_blueprint_content_agents (blueprint_content_agent_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_agent_links_versione_idx ON sys.sys_blueprint_content_agent_links (blueprint_content_agent_link_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_design_principles_versione_idx ON sys.sys_blueprint_content_design_principles (blueprint_content_design_principle_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_perimeters_versione_idx ON sys.sys_blueprint_content_perimeters (blueprint_content_perimeter_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_process_steps_versione_idx ON sys.sys_blueprint_content_process_steps (blueprint_content_process_step_version_id);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_position_responsibilities_versione_idx ON sys.sys_blueprint_content_position_responsibilities (blueprint_content_position_responsibility_version_id);

-- ---------------------------------------------------------------------------
-- M1.17  colonne aggiunte alle altre tabelle del modello
-- ---------------------------------------------------------------------------
-- obiettivi: livello, padre, capability; processo/unita'/ruolo diventano annullabili (un obiettivo d'impresa non ha la terna)
ALTER TABLE sys.sys_blueprint_content_goals ADD COLUMN IF NOT EXISTS blueprint_content_goal_level varchar(12);
ALTER TABLE sys.sys_blueprint_content_goals ADD COLUMN IF NOT EXISTS blueprint_content_goal_parent_code varchar(64);
ALTER TABLE sys.sys_blueprint_content_goals ADD COLUMN IF NOT EXISTS blueprint_content_goal_capability_code varchar(64);
ALTER TABLE sys.sys_blueprint_content_goals ALTER COLUMN blueprint_content_goal_process_code DROP NOT NULL;
ALTER TABLE sys.sys_blueprint_content_goals ALTER COLUMN blueprint_content_goal_unit_code DROP NOT NULL;
ALTER TABLE sys.sys_blueprint_content_goals ALTER COLUMN blueprint_content_goal_position_code DROP NOT NULL;

-- indicatori
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_scope text;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_baseline_value numeric;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_baseline_date date;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_baseline_note text;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_owner_position_code varchar(64);
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_exclusions text;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_family varchar(12);
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_target_valid_from date;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_target_valid_to date;

-- unita'
ALTER TABLE sys.sys_blueprint_content_units ADD COLUMN IF NOT EXISTS blueprint_content_unit_mandate text;
ALTER TABLE sys.sys_blueprint_content_units ADD COLUMN IF NOT EXISTS blueprint_content_unit_budget_centre varchar(16);
ALTER TABLE sys.sys_blueprint_content_units ADD COLUMN IF NOT EXISTS blueprint_content_unit_budget_item varchar(128);

-- posizioni
ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_job_role_code varchar(128);
ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_functional_reports_to_code varchar(64);
ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_ccnl_code varchar(64);

-- ore settimanali di una posizione per processo
ALTER TABLE sys.sys_blueprint_content_position_processes ADD COLUMN IF NOT EXISTS blueprint_content_position_process_weekly_hours numeric(5,2);

-- commesse: natura (nullo = commessa, come in v0.2) e quota di capacita' nei legami
ALTER TABLE sys.sys_blueprint_content_engagements ADD COLUMN IF NOT EXISTS blueprint_content_engagement_nature varchar(16);
ALTER TABLE sys.sys_blueprint_content_engagement_links ADD COLUMN IF NOT EXISTS blueprint_content_engagement_link_capacity_share numeric(4,3);

-- sedi: l'entita' giuridica (una sede appartiene a una sola entita')
ALTER TABLE sys.sys_blueprint_content_sites ADD COLUMN IF NOT EXISTS blueprint_content_site_legal_entity_code varchar(64);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_goals_level_ck' AND conrelid = 'sys.sys_blueprint_content_goals'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_goals ADD CONSTRAINT sys_blueprint_content_goals_level_ck CHECK (blueprint_content_goal_level IS NULL OR blueprint_content_goal_level IN ('IMPRESA','PROCESSO','UNITA','RUOLO'));
  END IF;
  -- forma della terna per livello. Il disegno chiedeva tutti e tre i codici per ogni livello diverso da IMPRESA, e con livello nullo il suo CHECK
  -- valutava NULL (cioe' passava): lo schema dice che livello assente = obiettivo v0.2 (terna completa) e che ogni livello vincola il SUO codice.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_goals_level_shape_ck' AND conrelid = 'sys.sys_blueprint_content_goals'::regclass) THEN
    -- CASE e non OR: con livello nullo un OR di confronti darebbe NULL, e un CHECK che da' NULL passa (visto dalla prova di mutazione)
    ALTER TABLE sys.sys_blueprint_content_goals ADD CONSTRAINT sys_blueprint_content_goals_level_shape_ck CHECK (CASE
      WHEN blueprint_content_goal_level IS NULL THEN (blueprint_content_goal_process_code IS NOT NULL AND blueprint_content_goal_unit_code IS NOT NULL AND blueprint_content_goal_position_code IS NOT NULL)
      WHEN blueprint_content_goal_level = 'IMPRESA' THEN true
      WHEN blueprint_content_goal_level = 'PROCESSO' THEN blueprint_content_goal_process_code IS NOT NULL
      WHEN blueprint_content_goal_level = 'UNITA' THEN blueprint_content_goal_unit_code IS NOT NULL
      WHEN blueprint_content_goal_level = 'RUOLO' THEN blueprint_content_goal_position_code IS NOT NULL
      ELSE false END);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_kpis_family_ck' AND conrelid = 'sys.sys_blueprint_content_kpis'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_kpis ADD CONSTRAINT sys_blueprint_content_kpis_family_ck CHECK (blueprint_content_kpi_family IS NULL OR blueprint_content_kpi_family IN ('RISULTATO','QUALITA','RISCHIO','CARICO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_kpis_target_validity_ck' AND conrelid = 'sys.sys_blueprint_content_kpis'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_kpis ADD CONSTRAINT sys_blueprint_content_kpis_target_validity_ck CHECK (blueprint_content_kpi_target_valid_to IS NULL OR blueprint_content_kpi_target_valid_from IS NULL OR blueprint_content_kpi_target_valid_from <= blueprint_content_kpi_target_valid_to);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_units_budget_centre_ck' AND conrelid = 'sys.sys_blueprint_content_units'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_units ADD CONSTRAINT sys_blueprint_content_units_budget_centre_ck CHECK (blueprint_content_unit_budget_centre IS NULL OR blueprint_content_unit_budget_centre IN ('COSTO','RICAVO','PROFITTO','INVESTIMENTO'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_positions_functional_not_self_ck' AND conrelid = 'sys.sys_blueprint_content_positions'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_positions ADD CONSTRAINT sys_blueprint_content_positions_functional_not_self_ck CHECK (blueprint_content_position_functional_reports_to_code IS DISTINCT FROM blueprint_content_position_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_position_processes_weekly_hours_ck' AND conrelid = 'sys.sys_blueprint_content_position_processes'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_position_processes ADD CONSTRAINT sys_blueprint_content_position_processes_weekly_hours_ck CHECK (blueprint_content_position_process_weekly_hours IS NULL OR blueprint_content_position_process_weekly_hours BETWEEN 0 AND 168);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_engagements_nature_ck' AND conrelid = 'sys.sys_blueprint_content_engagements'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_engagements ADD CONSTRAINT sys_blueprint_content_engagements_nature_ck CHECK (blueprint_content_engagement_nature IS NULL OR blueprint_content_engagement_nature IN ('COMMESSA','PROGETTO','TEAM_STABILE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_engagement_links_capacity_share_ck' AND conrelid = 'sys.sys_blueprint_content_engagement_links'::regclass) THEN
    ALTER TABLE sys.sys_blueprint_content_engagement_links ADD CONSTRAINT sys_blueprint_content_engagement_links_capacity_share_ck CHECK (blueprint_content_engagement_link_capacity_share IS NULL OR (blueprint_content_engagement_link_capacity_share > 0 AND blueprint_content_engagement_link_capacity_share <= 1));
  END IF;
  -- l'elenco dei tipi di legame si allarga: la composizione ha un attore (POSIZIONE, RUOLO, AGENTE) e le commesse citano gli obiettivi.
  -- Il disegno elencava ROLE, POSITION, GOAL; lo schema ammette anche l'agente come attore, quindi anche AGENT.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_engagement_links_link_kind_ck' AND conrelid = 'sys.sys_blueprint_content_engagement_links'::regclass AND pg_get_constraintdef(oid) NOT LIKE '%GOAL%') THEN
    ALTER TABLE sys.sys_blueprint_content_engagement_links DROP CONSTRAINT sys_blueprint_content_engagement_links_link_kind_ck;
    ALTER TABLE sys.sys_blueprint_content_engagement_links ADD CONSTRAINT sys_blueprint_content_engagement_links_link_kind_ck CHECK (blueprint_content_engagement_link_link_kind IN ('UNIT','POSITION','ROLE','AGENT','GOAL'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Direzione del dato (I23, ADR-0041): 'importato' per le 14 tabelle (le scrive solo l'accoglienza del pacchetto). Le righe stanno in 000429, che
-- conta le righe di classificazione (296) e ha un numero minore: stessa ragione di 000062. Qui solo la verifica.
-- ---------------------------------------------------------------------------
DO $$
DECLARE n_mancanti int;
BEGIN
  SELECT count(*) INTO n_mancanti
    FROM unnest(ARRAY['strategies','strategy_items','capabilities','capability_links','job_role_links','decisions','decision_rights','legal_entities','agents','agent_links','design_principles','perimeters','process_steps','position_responsibilities']) AS t(nome)
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_classificazione_direzione_dato c WHERE c.tabella = 'sys_blueprint_content_' || t.nome AND c.stato = 'importato');
  IF n_mancanti <> 0 THEN
    RAISE EXCEPTION '000458: % tabelle nuove non sono classificate ''importato'' in 000429', n_mancanti;
  END IF;
END $$;

-- Registro di riconciliazione: le 14 righe stanno in 000062 (vedi l'intestazione). Qui solo la verifica, che fallisce alta se qualcuno le toglie.
DO $$
DECLARE n_mancanti int;
BEGIN
  SELECT count(*) INTO n_mancanti
    FROM unnest(ARRAY['strategies','strategy_items','capabilities','capability_links','job_role_links','decisions','decision_rights','legal_entities','agents','agent_links','design_principles','perimeters','process_steps','position_responsibilities']) AS t(nome)
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_reconciliation_registry r WHERE r.reconciliation_registry_table_name = 'sys_blueprint_content_' || t.nome);
  IF n_mancanti <> 0 THEN
    RAISE EXCEPTION '000458: % tabelle nuove non sono registrate in 000062 (registro di riconciliazione)', n_mancanti;
  END IF;
END $$;

COMMIT;
