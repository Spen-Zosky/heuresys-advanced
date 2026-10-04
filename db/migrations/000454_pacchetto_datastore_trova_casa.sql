-- ============================================================================
-- PROPOSTA_000454_il_pacchetto_del_datastore_trova_casa.sql  (PROPOSTA: il numero 000454 e' il primo libero al 2026-10-01, da riassegnare al momento di committare)
--
-- IL PROBLEMA. Il datastore produce un prototipo d'impresa con sedi, organico previsto, obiettivi per terna processo-unita'-ruolo,
-- CCNL con livelli e istituti, obblighi normativi, formazione, carriere, incentivi, flussi di commessa e prove di lettura con impronta.
-- Il contenuto di un modello in advanced (mig. 000327) ha posto per cinque domini e li lega per codice: il resto oggi si perde.
-- Misurato il 2026-09-30 sul caso metalmeccanica (240 addetti): vedi docs/CONTRATTO e MATRICE dei campi nel contratto-dati v0.2.
--
-- COSA FA. Stessa forma della 000327: ogni riga appartiene a UNA VERSIONE di variante, chiave naturale (versione, codice), legami per CODICE,
-- tabelle di PIATTAFORMA senza tenant_id (I5), campi categorici varchar + CHECK (RD-08), 29 tabelle nuove, 27 colonne aggiunte,
-- un allargamento (l'unita' di un indicatore non entrava in 32 caratteri) e due valori in piu' per l'origine delle traduzioni (ISTAT, DATASTORE).
-- Italiano lingua di base nelle colonne; l'inglese sta in sys_reference_translations con lingua e origine, come per il resto del prodotto.
--
-- IDEMPOTENTE: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, vincoli aggiunti solo se assenti.
-- PER TORNARE INDIETRO: PROPOSTA_000454_il_pacchetto_del_datastore_trova_casa_ripristino.sql (toglie le tabelle nuove e le colonne aggiunte: quel contenuto va perso).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_packages (
  blueprint_content_package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_package_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_package_schema_version varchar(48) NOT NULL,
  blueprint_content_package_prototype_ref varchar(64) NOT NULL,
  blueprint_content_package_source_created_at varchar(40),
  blueprint_content_package_languages jsonb NOT NULL,
  blueprint_content_package_generator varchar(80),
  blueprint_content_package_base_language varchar(8) NOT NULL,
  blueprint_content_package_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_packages_uq UNIQUE (blueprint_content_package_version_id)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_context (
  blueprint_content_context_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_context_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_context_description text NOT NULL,
  blueprint_content_context_ateco_scheme varchar(16) NOT NULL,
  blueprint_content_context_ateco_code varchar(16) NOT NULL,
  blueprint_content_context_ateco_name text NOT NULL,
  blueprint_content_context_size_class varchar(16) NOT NULL,
  blueprint_content_context_size_band_code varchar(4) NOT NULL,
  blueprint_content_context_employees integer NOT NULL,
  blueprint_content_context_country char(2) NOT NULL,
  blueprint_content_context_operating_model varchar(24),
  blueprint_content_context_regulatory_intensity varchar(12),
  blueprint_content_context_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_context_uq UNIQUE (blueprint_content_context_version_id),
  CONSTRAINT sys_blueprint_content_context_size_class_ck CHECK (blueprint_content_context_size_class IN ('MICRO','SMALL','MEDIUM','LARGE')),
  CONSTRAINT sys_blueprint_content_context_size_band_code_ck CHECK (blueprint_content_context_size_band_code IN ('XS','S','M','L','XL'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_sites (
  blueprint_content_site_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_site_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_site_code varchar(64) NOT NULL,
  blueprint_content_site_kind varchar(24) NOT NULL,
  blueprint_content_site_name text NOT NULL,
  blueprint_content_site_note text,
  blueprint_content_site_headcount integer,
  blueprint_content_site_address jsonb,
  blueprint_content_site_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_sites_uq UNIQUE (blueprint_content_site_version_id, blueprint_content_site_code),
  CONSTRAINT sys_blueprint_content_sites_kind_ck CHECK (blueprint_content_site_kind IN ('SEDE_CENTRALE','FILIALE','STABILIMENTO','MAGAZZINO','UFFICIO'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_position_processes (
  blueprint_content_position_process_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_position_process_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_position_process_position_code varchar(64) NOT NULL,
  blueprint_content_position_process_process_code varchar(64) NOT NULL,
  blueprint_content_position_process_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_position_processes_uq UNIQUE (blueprint_content_position_process_version_id, blueprint_content_position_process_position_code, blueprint_content_position_process_process_code)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_position_occupations (
  blueprint_content_position_occupation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_position_occupation_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_position_occupation_position_code varchar(64) NOT NULL,
  blueprint_content_position_occupation_esco_uri text NOT NULL,
  blueprint_content_position_occupation_name text,
  blueprint_content_position_occupation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_position_occupations_uq UNIQUE (blueprint_content_position_occupation_version_id, blueprint_content_position_occupation_position_code, blueprint_content_position_occupation_esco_uri)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_position_skill_requirements (
  blueprint_content_psr_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_psr_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_psr_skill_code varchar(64) NOT NULL,
  blueprint_content_psr_position_code varchar(64) NOT NULL,
  blueprint_content_psr_proficiency varchar(16) NOT NULL,
  blueprint_content_psr_criticality varchar(16) NOT NULL,
  blueprint_content_psr_source_level varchar(16),
  blueprint_content_psr_source_criticality varchar(16),
  blueprint_content_psr_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_position_skill_requirements_uq UNIQUE (blueprint_content_psr_version_id, blueprint_content_psr_skill_code, blueprint_content_psr_position_code),
  CONSTRAINT sys_blueprint_content_position_skill_requirements_proficiency_ck CHECK (blueprint_content_psr_proficiency IN ('NOVICE','BASIC','COMPETENT','PROFICIENT','EXPERT','MASTER')),
  CONSTRAINT sys_blueprint_content_position_skill_requirements_criticality_ck CHECK (blueprint_content_psr_criticality IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_unit_processes (
  blueprint_content_unit_process_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_unit_process_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_unit_process_unit_code varchar(64) NOT NULL,
  blueprint_content_unit_process_process_code varchar(64) NOT NULL,
  blueprint_content_unit_process_role varchar(16) NOT NULL,
  blueprint_content_unit_process_source_role varchar(16),
  blueprint_content_unit_process_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_unit_processes_uq UNIQUE (blueprint_content_unit_process_version_id, blueprint_content_unit_process_unit_code, blueprint_content_unit_process_process_code),
  CONSTRAINT sys_blueprint_content_unit_processes_role_ck CHECK (blueprint_content_unit_process_role IN ('OWNER','CONTRIBUTOR','CONSULTED','INFORMED'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_process_sites (
  blueprint_content_process_site_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_process_site_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_process_site_process_code varchar(64) NOT NULL,
  blueprint_content_process_site_site_code varchar(64) NOT NULL,
  blueprint_content_process_site_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_process_sites_uq UNIQUE (blueprint_content_process_site_version_id, blueprint_content_process_site_process_code, blueprint_content_process_site_site_code)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_goals (
  blueprint_content_goal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_goal_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_goal_code varchar(64) NOT NULL,
  blueprint_content_goal_title text NOT NULL,
  blueprint_content_goal_horizon varchar(16) NOT NULL,
  blueprint_content_goal_duration_days integer NOT NULL,
  blueprint_content_goal_dimension varchar(16) NOT NULL,
  blueprint_content_goal_process_code varchar(64) NOT NULL,
  blueprint_content_goal_unit_code varchar(64) NOT NULL,
  blueprint_content_goal_position_code varchar(64) NOT NULL,
  blueprint_content_goal_weight numeric(6,2),
  blueprint_content_goal_weight_origin varchar(12),
  blueprint_content_goal_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_goals_uq UNIQUE (blueprint_content_goal_version_id, blueprint_content_goal_code),
  CONSTRAINT sys_blueprint_content_goals_horizon_ck CHECK (blueprint_content_goal_horizon IN ('ANNUALE','TRIMESTRALE')),
  CONSTRAINT sys_blueprint_content_goals_dimension_ck CHECK (blueprint_content_goal_dimension IN ('CRESCITA','EFFICIENZA','SERVIZIO','QUALITA','CONFORMITA','COSTO')),
  CONSTRAINT sys_blueprint_content_goals_duration_days_ck CHECK (blueprint_content_goal_duration_days > 0),
  CONSTRAINT sys_blueprint_content_goals_weight_ck CHECK (blueprint_content_goal_weight IS NULL OR blueprint_content_goal_weight BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_ccnl (
  blueprint_content_ccnl_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_ccnl_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_ccnl_code varchar(64) NOT NULL,
  blueprint_content_ccnl_name text NOT NULL,
  blueprint_content_ccnl_scope text,
  blueprint_content_ccnl_parties text,
  blueprint_content_ccnl_effective text,
  blueprint_content_ccnl_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_ccnl_uq UNIQUE (blueprint_content_ccnl_version_id, blueprint_content_ccnl_code)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_ccnl_levels (
  blueprint_content_ccnl_level_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_ccnl_level_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_ccnl_level_ccnl_code varchar(64) NOT NULL,
  blueprint_content_ccnl_level_code varchar(64) NOT NULL,
  blueprint_content_ccnl_level_name text NOT NULL,
  blueprint_content_ccnl_level_category varchar(16),
  blueprint_content_ccnl_level_annual_minimum_eur numeric(12,2),
  blueprint_content_ccnl_level_minimum_note text,
  blueprint_content_ccnl_level_duties text,
  blueprint_content_ccnl_level_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_ccnl_levels_uq UNIQUE (blueprint_content_ccnl_level_version_id, blueprint_content_ccnl_level_code),
  CONSTRAINT sys_blueprint_content_ccnl_levels_category_ck CHECK (blueprint_content_ccnl_level_category IS NULL OR blueprint_content_ccnl_level_category IN ('DIRIGENTE','QUADRO','IMPIEGATO','OPERAIO'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_ccnl_institutes (
  blueprint_content_ccnl_institute_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_ccnl_institute_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_ccnl_institute_ccnl_code varchar(64) NOT NULL,
  blueprint_content_ccnl_institute_ordinal integer NOT NULL,
  blueprint_content_ccnl_institute_kind varchar(24) NOT NULL,
  blueprint_content_ccnl_institute_description text NOT NULL,
  blueprint_content_ccnl_institute_value numeric,
  blueprint_content_ccnl_institute_unit varchar(64),
  blueprint_content_ccnl_institute_valid_from varchar(40),
  blueprint_content_ccnl_institute_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_ccnl_institutes_uq UNIQUE (blueprint_content_ccnl_institute_version_id, blueprint_content_ccnl_institute_ccnl_code, blueprint_content_ccnl_institute_ordinal),
  CONSTRAINT sys_blueprint_content_ccnl_institutes_kind_ck CHECK (blueprint_content_ccnl_institute_kind IN ('ORE_SETTIMANALI','FERIE','PERMESSI_ROL','MENSILITA','STRAORDINARIO','PROVA','PREAVVISO','MALATTIA','ALTRO'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_ccnl_conditions (
  blueprint_content_ccnl_condition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_ccnl_condition_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_ccnl_condition_ccnl_code varchar(64) NOT NULL,
  blueprint_content_ccnl_condition_institute_ordinal integer NOT NULL,
  blueprint_content_ccnl_condition_ordinal integer NOT NULL,
  blueprint_content_ccnl_condition_scope varchar(24) NOT NULL,
  blueprint_content_ccnl_condition_description text NOT NULL,
  blueprint_content_ccnl_condition_value numeric,
  blueprint_content_ccnl_condition_unit varchar(64),
  blueprint_content_ccnl_condition_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_ccnl_conditions_uq UNIQUE (blueprint_content_ccnl_condition_version_id, blueprint_content_ccnl_condition_ccnl_code, blueprint_content_ccnl_condition_institute_ordinal, blueprint_content_ccnl_condition_ordinal),
  CONSTRAINT sys_blueprint_content_ccnl_conditions_scope_ck CHECK (blueprint_content_ccnl_condition_scope IN ('DIMENSIONE_IMPRESA','LIVELLO','ANZIANITA','ALTRO'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_obligations (
  blueprint_content_obligation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_obligation_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_obligation_code varchar(64) NOT NULL,
  blueprint_content_obligation_norm text NOT NULL,
  blueprint_content_obligation_scope varchar(32) NOT NULL,
  blueprint_content_obligation_subject text,
  blueprint_content_obligation_training_required text,
  blueprint_content_obligation_periodicity text,
  blueprint_content_obligation_missing_role text,
  blueprint_content_obligation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_obligations_uq UNIQUE (blueprint_content_obligation_version_id, blueprint_content_obligation_code),
  CONSTRAINT sys_blueprint_content_obligations_scope_ck CHECK (blueprint_content_obligation_scope IN ('SICUREZZA','PRIVACY','WHISTLEBLOWING','QUALITA','AMBIENTE','RESPONSABILITA_AMMINISTRATIVA','ALTRO'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_obligation_positions (
  blueprint_content_obligation_position_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_obligation_position_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_obligation_position_obligation_code varchar(64) NOT NULL,
  blueprint_content_obligation_position_position_code varchar(64) NOT NULL,
  blueprint_content_obligation_position_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_obligation_positions_uq UNIQUE (blueprint_content_obligation_position_version_id, blueprint_content_obligation_position_obligation_code, blueprint_content_obligation_position_position_code)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_training (
  blueprint_content_training_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_training_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_training_code varchar(64) NOT NULL,
  blueprint_content_training_title text NOT NULL,
  blueprint_content_training_kind varchar(16) NOT NULL,
  blueprint_content_training_delivery varchar(16),
  blueprint_content_training_duration_minutes integer,
  blueprint_content_training_obligation_code varchar(64),
  blueprint_content_training_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_training_uq UNIQUE (blueprint_content_training_version_id, blueprint_content_training_code),
  CONSTRAINT sys_blueprint_content_training_kind_ck CHECK (blueprint_content_training_kind IN ('CORSO','AFFIANCAMENTO','CERTIFICAZIONE','ALTRO')),
  CONSTRAINT sys_blueprint_content_training_delivery_ck CHECK (blueprint_content_training_delivery IS NULL OR blueprint_content_training_delivery IN ('IN_AULA','ONLINE','SUL_CAMPO'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_training_positions (
  blueprint_content_training_position_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_training_position_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_training_position_training_code varchar(64) NOT NULL,
  blueprint_content_training_position_position_code varchar(64) NOT NULL,
  blueprint_content_training_position_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_training_positions_uq UNIQUE (blueprint_content_training_position_version_id, blueprint_content_training_position_training_code, blueprint_content_training_position_position_code)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_training_skills (
  blueprint_content_training_skill_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_training_skill_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_training_skill_training_code varchar(64) NOT NULL,
  blueprint_content_training_skill_skill_code varchar(64) NOT NULL,
  blueprint_content_training_skill_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_training_skills_uq UNIQUE (blueprint_content_training_skill_version_id, blueprint_content_training_skill_training_code, blueprint_content_training_skill_skill_code)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_career_paths (
  blueprint_content_career_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_career_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_career_code varchar(64) NOT NULL,
  blueprint_content_career_name text NOT NULL,
  blueprint_content_career_kind varchar(24) NOT NULL,
  blueprint_content_career_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_career_paths_uq UNIQUE (blueprint_content_career_version_id, blueprint_content_career_code),
  CONSTRAINT sys_blueprint_content_career_paths_kind_ck CHECK (blueprint_content_career_kind IN ('VERTICAL','CROSS_FUNCTIONAL'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_career_steps (
  blueprint_content_career_step_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_career_step_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_career_step_path_code varchar(64) NOT NULL,
  blueprint_content_career_step_step_order integer NOT NULL,
  blueprint_content_career_step_position_code varchar(64) NOT NULL,
  blueprint_content_career_step_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_career_steps_uq UNIQUE (blueprint_content_career_step_version_id, blueprint_content_career_step_path_code, blueprint_content_career_step_step_order),
  CONSTRAINT sys_blueprint_content_career_steps_step_order_ck CHECK (blueprint_content_career_step_step_order >= 1)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_incentives (
  blueprint_content_incentive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_incentive_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_incentive_code varchar(64) NOT NULL,
  blueprint_content_incentive_name text NOT NULL,
  blueprint_content_incentive_kind varchar(24) NOT NULL,
  blueprint_content_incentive_rule text,
  blueprint_content_incentive_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_incentives_uq UNIQUE (blueprint_content_incentive_version_id, blueprint_content_incentive_code),
  CONSTRAINT sys_blueprint_content_incentives_kind_ck CHECK (blueprint_content_incentive_kind IN ('PREMIO_RISULTATO','MBO','ALTRO'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_incentive_links (
  blueprint_content_incentive_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_incentive_link_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_incentive_link_incentive_code varchar(64) NOT NULL,
  blueprint_content_incentive_link_link_kind varchar(12) NOT NULL,
  blueprint_content_incentive_link_link_code varchar(64) NOT NULL,
  blueprint_content_incentive_link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_incentive_links_uq UNIQUE (blueprint_content_incentive_link_version_id, blueprint_content_incentive_link_incentive_code, blueprint_content_incentive_link_link_kind, blueprint_content_incentive_link_link_code),
  CONSTRAINT sys_blueprint_content_incentive_links_link_kind_ck CHECK (blueprint_content_incentive_link_link_kind IN ('POSITION','GOAL','CATEGORY','DIMENSION'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_engagements (
  blueprint_content_engagement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_engagement_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_engagement_code varchar(64) NOT NULL,
  blueprint_content_engagement_name text NOT NULL,
  blueprint_content_engagement_kind varchar(24) NOT NULL,
  blueprint_content_engagement_description text,
  blueprint_content_engagement_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_engagements_uq UNIQUE (blueprint_content_engagement_version_id, blueprint_content_engagement_code),
  CONSTRAINT sys_blueprint_content_engagements_kind_ck CHECK (blueprint_content_engagement_kind IN ('PROGETTAZIONE_PROPRIA','SU_DISEGNO_CLIENTE','ALTRO'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_engagement_links (
  blueprint_content_engagement_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_engagement_link_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_engagement_link_engagement_code varchar(64) NOT NULL,
  blueprint_content_engagement_link_link_kind varchar(12) NOT NULL,
  blueprint_content_engagement_link_link_code varchar(64) NOT NULL,
  blueprint_content_engagement_link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_engagement_links_uq UNIQUE (blueprint_content_engagement_link_version_id, blueprint_content_engagement_link_engagement_code, blueprint_content_engagement_link_link_kind, blueprint_content_engagement_link_link_code),
  CONSTRAINT sys_blueprint_content_engagement_links_link_kind_ck CHECK (blueprint_content_engagement_link_link_kind IN ('UNIT','POSITION'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_evidence (
  blueprint_content_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_evidence_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_evidence_proof_code varchar(16) NOT NULL,
  blueprint_content_evidence_url text NOT NULL,
  blueprint_content_evidence_title text,
  blueprint_content_evidence_excerpt text,
  blueprint_content_evidence_kind varchar(12) NOT NULL,
  blueprint_content_evidence_read_outcome varchar(20) NOT NULL,
  blueprint_content_evidence_read_at timestamptz,
  blueprint_content_evidence_http_status integer,
  blueprint_content_evidence_bytes bigint,
  blueprint_content_evidence_sha256 char(64),
  blueprint_content_evidence_read_note text,
  blueprint_content_evidence_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_evidence_uq UNIQUE (blueprint_content_evidence_version_id, blueprint_content_evidence_proof_code),
  CONSTRAINT sys_blueprint_content_evidence_kind_ck CHECK (blueprint_content_evidence_kind IN ('html','pdf','json','altro')),
  CONSTRAINT sys_blueprint_content_evidence_read_outcome_ck CHECK (blueprint_content_evidence_read_outcome IN ('LETTA','NON_TESTUALE','BLOCCATA','NON_RAGGIUNGIBILE')),
  CONSTRAINT sys_blueprint_content_evidence_read_outcome_ck2 CHECK (blueprint_content_evidence_read_outcome NOT IN ('LETTA','NON_TESTUALE') OR (blueprint_content_evidence_sha256 IS NOT NULL AND blueprint_content_evidence_read_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_evidence_links (
  blueprint_content_evidence_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_evidence_link_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_evidence_link_entity_kind varchar(32) NOT NULL,
  blueprint_content_evidence_link_entity_code varchar(64) NOT NULL,
  blueprint_content_evidence_link_proof_code varchar(16) NOT NULL,
  blueprint_content_evidence_link_role varchar(12) NOT NULL DEFAULT 'SOURCE',
  blueprint_content_evidence_link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_evidence_links_uq UNIQUE (blueprint_content_evidence_link_version_id, blueprint_content_evidence_link_entity_kind, blueprint_content_evidence_link_entity_code, blueprint_content_evidence_link_proof_code, blueprint_content_evidence_link_role),
  CONSTRAINT sys_blueprint_content_evidence_links_role_ck CHECK (blueprint_content_evidence_link_role IN ('SOURCE','HEADCOUNT'))
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_evidence_gaps (
  blueprint_content_evidence_gap_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_evidence_gap_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_evidence_gap_entity_kind varchar(32) NOT NULL,
  blueprint_content_evidence_gap_entity_code varchar(64) NOT NULL,
  blueprint_content_evidence_gap_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_evidence_gaps_uq UNIQUE (blueprint_content_evidence_gap_version_id, blueprint_content_evidence_gap_entity_kind, blueprint_content_evidence_gap_entity_code)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_derivations (
  blueprint_content_derivation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_derivation_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_derivation_field varchar(64) NOT NULL,
  blueprint_content_derivation_rule text NOT NULL,
  blueprint_content_derivation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_derivations_uq UNIQUE (blueprint_content_derivation_version_id, blueprint_content_derivation_field)
);

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_gaps (
  blueprint_content_gap_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_gap_version_id uuid NOT NULL REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE CASCADE,
  blueprint_content_gap_domain varchar(64) NOT NULL,
  blueprint_content_gap_reason text NOT NULL,
  blueprint_content_gap_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  origine_dato varchar(32) NOT NULL DEFAULT 'DATASTORE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_content_gaps_uq UNIQUE (blueprint_content_gap_version_id, blueprint_content_gap_domain)
);

ALTER TABLE sys.sys_blueprint_content_units ADD COLUMN IF NOT EXISTS blueprint_content_unit_site_code varchar(64);
ALTER TABLE sys.sys_blueprint_content_units ADD COLUMN IF NOT EXISTS blueprint_content_unit_planned_headcount integer;
ALTER TABLE sys.sys_blueprint_content_units ADD COLUMN IF NOT EXISTS blueprint_content_unit_source_kind varchar(32);
ALTER TABLE sys.sys_blueprint_content_units ADD COLUMN IF NOT EXISTS blueprint_content_unit_headcount_note text;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_units_planned_headcount_ck') THEN ALTER TABLE sys.sys_blueprint_content_units ADD CONSTRAINT sys_blueprint_content_units_planned_headcount_ck CHECK (blueprint_content_unit_planned_headcount IS NULL OR blueprint_content_unit_planned_headcount >= 0); END IF; END $$;

ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_reports_to_code varchar(64);
ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_contract_category varchar(16);
ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_ccnl_level_code varchar(64);
ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_planned_headcount integer;
ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_is_unit_head boolean;
ALTER TABLE sys.sys_blueprint_content_positions ADD COLUMN IF NOT EXISTS blueprint_content_position_criticality_note text;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_positions_contract_category_ck') THEN ALTER TABLE sys.sys_blueprint_content_positions ADD CONSTRAINT sys_blueprint_content_positions_contract_category_ck CHECK (blueprint_content_position_contract_category IS NULL OR blueprint_content_position_contract_category IN ('DIRIGENTE','QUADRO','IMPIEGATO','OPERAIO')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_positions_planned_headcount_ck') THEN ALTER TABLE sys.sys_blueprint_content_positions ADD CONSTRAINT sys_blueprint_content_positions_planned_headcount_ck CHECK (blueprint_content_position_planned_headcount IS NULL OR blueprint_content_position_planned_headcount >= 1); END IF; END $$;

ALTER TABLE sys.sys_blueprint_content_skills ADD COLUMN IF NOT EXISTS blueprint_content_skill_esco_uri text;
ALTER TABLE sys.sys_blueprint_content_skills ADD COLUMN IF NOT EXISTS blueprint_content_skill_kind_origin varchar(16);

ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_formula text;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_frequency varchar(16);
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_frequency_note text;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_data_source text;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_reference_text text;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_goal_code varchar(64);
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_source_direction varchar(12);
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_target_min numeric;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_target_value numeric;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_target_max numeric;
ALTER TABLE sys.sys_blueprint_content_kpis ADD COLUMN IF NOT EXISTS blueprint_content_kpi_target_note text;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_kpis_frequency_ck') THEN ALTER TABLE sys.sys_blueprint_content_kpis ADD CONSTRAINT sys_blueprint_content_kpis_frequency_ck CHECK (blueprint_content_kpi_frequency IS NULL OR blueprint_content_kpi_frequency IN ('GIORNALIERA','SETTIMANALE','MENSILE','TRIMESTRALE','ANNUALE','PER_EVENTO','ALTRO')); END IF; END $$;

ALTER TABLE sys.sys_blueprint_process_registry ADD COLUMN IF NOT EXISTS blueprint_process_kind varchar(16);
ALTER TABLE sys.sys_blueprint_process_registry ADD COLUMN IF NOT EXISTS blueprint_process_pcf_code varchar(32);
ALTER TABLE sys.sys_blueprint_process_registry ADD COLUMN IF NOT EXISTS blueprint_process_is_specific boolean;
ALTER TABLE sys.sys_blueprint_process_registry ADD COLUMN IF NOT EXISTS blueprint_process_rationale text;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_process_registry_kind_ck') THEN ALTER TABLE sys.sys_blueprint_process_registry ADD CONSTRAINT sys_blueprint_process_registry_kind_ck CHECK (blueprint_process_kind IS NULL OR blueprint_process_kind IN ('DIREZIONALE','CORE','DI_SUPPORTO')); END IF; END $$;

ALTER TABLE sys.sys_blueprint_content_kpis ALTER COLUMN blueprint_content_kpi_unit TYPE varchar(96);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_reference_translations_source_check' AND pg_get_constraintdef(oid) NOT LIKE '%DATASTORE%') THEN
    ALTER TABLE sys.sys_reference_translations DROP CONSTRAINT sys_reference_translations_source_check;
    ALTER TABLE sys.sys_reference_translations ADD CONSTRAINT sys_reference_translations_source_check CHECK (source IN ('HARVEST', 'ESCO', 'LLM', 'MANUAL', 'ISTAT', 'DATASTORE'));
  END IF;
END $$;

-- Registro di riconciliazione: le 29 tabelle nuove sono contenuto di modello, come quelle della 000327.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket, reconciliation_registry_declared_status,
   reconciliation_registry_legacy_source, reconciliation_registry_rationale)
VALUES
  ('sys_blueprint_content_packages', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_context', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_sites', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_position_processes', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_position_occupations', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_position_skill_requirements', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_unit_processes', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_process_sites', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_goals', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_ccnl', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_ccnl_levels', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_ccnl_institutes', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_ccnl_conditions', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_obligations', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_obligation_positions', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_training', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_training_positions', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_training_skills', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_career_paths', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_career_steps', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_incentives', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_incentive_links', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_engagements', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_engagement_links', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_evidence', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_evidence_links', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_evidence_gaps', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_derivations', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]'),
  ('sys_blueprint_content_gaps', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — contenuto di modello (pacchetto datastore, mig 000454). Righe di una versione di variante, prodotte dall''accoglienza del pacchetto del datastore: modello di piattaforma, non dati di un cliente ne'' righe importate dal legacy.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

COMMIT;
