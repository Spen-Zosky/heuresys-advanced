-- ============================================================================
-- 000458, INVERSA (fuori catena): toglie il contenuto v0.3 del modello (onda 2, O2-01). NON e' una migrazione: non gira al deploy.
--
-- Uso (su una copia, o dove deciso dall'Amministratore di Sistema):
--   psql -v ON_ERROR_STOP=1 -f db/scripts/onda2/000458-inversa.sql
--
-- GUARDIA (C11). Si rifiuta (RAISE EXCEPTION, niente viene toccato) se
--   · una delle 14 tabelle da togliere ha anche una sola riga;
--   · una colonna da togliere ha un valore non nullo (per perimeter_status: diverso da 'NON_RILASCIATO'; per origine_dato: diverso da 'DATASTORE');
--   · una riga di sys_blueprint_content_goals ha la terna processo/unita'/ruolo con un nullo (rimettere NOT NULL la romperebbe);
--   · una riga di sys_blueprint_content_engagement_links usa un tipo di legame nuovo (ROLE, AGENT, GOAL).
-- Tornare indietro con dati dentro vuol dire perdere contenuto: e' una decisione dell'Amministratore di Sistema, non un'opzione di questo script.
-- Idempotente: cio' che non c'e' piu' non da' errore.
--
-- Se la catena viene riapplicata con 000458 ancora presente, tutto ritorna: l'inversa vale insieme al ritiro del file 000458 (ADR-0035).
-- ============================================================================
BEGIN;

DO $$
DECLARE
  t record;
  n bigint;
  problemi text := '';
BEGIN
  -- 1. tabelle nuove: vuote
  FOR t IN SELECT unnest(ARRAY['strategies','strategy_items','capabilities','capability_links','job_role_links','decisions','decision_rights','legal_entities','agents','agent_links','design_principles','perimeters','process_steps','position_responsibilities']) AS nome LOOP
    IF to_regclass('sys.sys_blueprint_content_' || t.nome) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM sys.%I', 'sys_blueprint_content_' || t.nome) INTO n;
      IF n <> 0 THEN problemi := problemi || format(E'\n  tabella sys_blueprint_content_%s: %s righe', t.nome, n); END IF;
    END IF;
  END LOOP;

  -- 2. colonne aggiunte: nessun valore (tabella, colonna, valore «di fabbrica» che non conta come dato)
  FOR t IN
    SELECT * FROM (VALUES
      ('packages', 'blueprint_content_package_source_schema_version', NULL), ('packages', 'blueprint_content_package_converted_at', NULL),
      ('packages', 'blueprint_content_package_converter', NULL), ('packages', 'blueprint_content_package_source_hash', NULL),
      ('packages', 'blueprint_content_package_is_complete', NULL), ('packages', 'blueprint_content_package_steps_accepted', NULL),
      ('packages', 'blueprint_content_package_steps_total', NULL), ('packages', 'blueprint_content_package_perimeter_status', 'NON_RILASCIATO'),
      ('packages', 'blueprint_content_package_dossier_version', NULL), ('packages', 'blueprint_content_package_extends_version', NULL),
      ('packages', 'blueprint_content_package_extension_request', NULL),
      ('job_roles', 'blueprint_content_job_role_mission', NULL), ('job_roles', 'blueprint_content_job_role_professional_family', NULL),
      ('job_roles', 'blueprint_content_job_role_esco_uri', NULL), ('job_roles', 'blueprint_content_job_role_esco_name', NULL),
      ('job_roles', 'blueprint_content_job_role_cp2021_code', NULL), ('job_roles', 'blueprint_content_job_role_ai_impact', NULL),
      ('job_roles', 'origine_dato', 'DATASTORE'),
      ('goals', 'blueprint_content_goal_level', NULL), ('goals', 'blueprint_content_goal_parent_code', NULL), ('goals', 'blueprint_content_goal_capability_code', NULL),
      ('kpis', 'blueprint_content_kpi_scope', NULL), ('kpis', 'blueprint_content_kpi_baseline_value', NULL), ('kpis', 'blueprint_content_kpi_baseline_date', NULL),
      ('kpis', 'blueprint_content_kpi_baseline_note', NULL), ('kpis', 'blueprint_content_kpi_owner_position_code', NULL), ('kpis', 'blueprint_content_kpi_exclusions', NULL),
      ('kpis', 'blueprint_content_kpi_family', NULL), ('kpis', 'blueprint_content_kpi_target_valid_from', NULL), ('kpis', 'blueprint_content_kpi_target_valid_to', NULL),
      ('units', 'blueprint_content_unit_mandate', NULL), ('units', 'blueprint_content_unit_budget_centre', NULL), ('units', 'blueprint_content_unit_budget_item', NULL),
      ('positions', 'blueprint_content_position_job_role_code', NULL), ('positions', 'blueprint_content_position_functional_reports_to_code', NULL),
      ('positions', 'blueprint_content_position_ccnl_code', NULL),
      ('position_processes', 'blueprint_content_position_process_weekly_hours', NULL),
      ('engagements', 'blueprint_content_engagement_nature', NULL), ('engagement_links', 'blueprint_content_engagement_link_capacity_share', NULL),
      ('sites', 'blueprint_content_site_legal_entity_code', NULL)
    ) AS v(tab, col, difabbrica)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sys' AND table_name = 'sys_blueprint_content_' || t.tab AND column_name = t.col) THEN
      IF t.difabbrica IS NULL THEN
        EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I IS NOT NULL', 'sys_blueprint_content_' || t.tab, t.col) INTO n;
      ELSE
        EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I IS DISTINCT FROM %L', 'sys_blueprint_content_' || t.tab, t.col, t.difabbrica) INTO n;
      END IF;
      IF n <> 0 THEN problemi := problemi || format(E'\n  colonna %s.%s: %s valori', t.tab, t.col, n); END IF;
    END IF;
  END LOOP;

  -- 3. obiettivi: rimettere NOT NULL su processo/unita'/ruolo e' possibile solo se nessuna riga ha un nullo
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sys' AND table_name = 'sys_blueprint_content_goals' AND column_name = 'blueprint_content_goal_process_code' AND is_nullable = 'YES') THEN
    SELECT count(*) INTO n FROM sys.sys_blueprint_content_goals
     WHERE blueprint_content_goal_process_code IS NULL OR blueprint_content_goal_unit_code IS NULL OR blueprint_content_goal_position_code IS NULL;
    IF n <> 0 THEN problemi := problemi || format(E'\n  obiettivi con la terna processo/unita''/ruolo incompleta: %s righe', n); END IF;
  END IF;

  -- 4. legami di commessa: il vecchio elenco ammette solo UNIT e POSITION
  SELECT count(*) INTO n FROM sys.sys_blueprint_content_engagement_links WHERE blueprint_content_engagement_link_link_kind NOT IN ('UNIT','POSITION');
  IF n <> 0 THEN problemi := problemi || format(E'\n  legami di commessa con tipo ROLE/AGENT/GOAL: %s righe', n); END IF;

  IF problemi <> '' THEN
    RAISE EXCEPTION '000458-inversa: mi rifiuto, tornare indietro perderebbe contenuto:%', problemi;
  END IF;
END $$;

-- vincoli che toccano colonne che restano (gli altri spariscono con la loro colonna)
ALTER TABLE sys.sys_blueprint_content_goals DROP CONSTRAINT IF EXISTS sys_blueprint_content_goals_level_shape_ck;
ALTER TABLE sys.sys_blueprint_content_goals DROP CONSTRAINT IF EXISTS sys_blueprint_content_goals_level_ck;
ALTER TABLE sys.sys_blueprint_content_goals ALTER COLUMN blueprint_content_goal_process_code SET NOT NULL;
ALTER TABLE sys.sys_blueprint_content_goals ALTER COLUMN blueprint_content_goal_unit_code SET NOT NULL;
ALTER TABLE sys.sys_blueprint_content_goals ALTER COLUMN blueprint_content_goal_position_code SET NOT NULL;
ALTER TABLE sys.sys_blueprint_content_positions DROP CONSTRAINT IF EXISTS sys_blueprint_content_positions_functional_not_self_ck;

ALTER TABLE sys.sys_blueprint_content_engagement_links DROP CONSTRAINT IF EXISTS sys_blueprint_content_engagement_links_link_kind_ck;
ALTER TABLE sys.sys_blueprint_content_engagement_links ADD CONSTRAINT sys_blueprint_content_engagement_links_link_kind_ck CHECK (blueprint_content_engagement_link_link_kind IN ('UNIT','POSITION'));

-- colonne aggiunte, in ordine inverso
ALTER TABLE sys.sys_blueprint_content_sites DROP COLUMN IF EXISTS blueprint_content_site_legal_entity_code;
ALTER TABLE sys.sys_blueprint_content_engagement_links DROP COLUMN IF EXISTS blueprint_content_engagement_link_capacity_share;
ALTER TABLE sys.sys_blueprint_content_engagements DROP COLUMN IF EXISTS blueprint_content_engagement_nature;
ALTER TABLE sys.sys_blueprint_content_position_processes DROP COLUMN IF EXISTS blueprint_content_position_process_weekly_hours;
ALTER TABLE sys.sys_blueprint_content_positions DROP COLUMN IF EXISTS blueprint_content_position_ccnl_code;
ALTER TABLE sys.sys_blueprint_content_positions DROP COLUMN IF EXISTS blueprint_content_position_functional_reports_to_code;
ALTER TABLE sys.sys_blueprint_content_positions DROP COLUMN IF EXISTS blueprint_content_position_job_role_code;
ALTER TABLE sys.sys_blueprint_content_units DROP COLUMN IF EXISTS blueprint_content_unit_budget_item;
ALTER TABLE sys.sys_blueprint_content_units DROP COLUMN IF EXISTS blueprint_content_unit_budget_centre;
ALTER TABLE sys.sys_blueprint_content_units DROP COLUMN IF EXISTS blueprint_content_unit_mandate;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_target_valid_to;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_target_valid_from;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_family;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_exclusions;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_owner_position_code;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_baseline_note;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_baseline_date;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_baseline_value;
ALTER TABLE sys.sys_blueprint_content_kpis DROP COLUMN IF EXISTS blueprint_content_kpi_scope;
ALTER TABLE sys.sys_blueprint_content_goals DROP COLUMN IF EXISTS blueprint_content_goal_capability_code;
ALTER TABLE sys.sys_blueprint_content_goals DROP COLUMN IF EXISTS blueprint_content_goal_parent_code;
ALTER TABLE sys.sys_blueprint_content_goals DROP COLUMN IF EXISTS blueprint_content_goal_level;
ALTER TABLE sys.sys_blueprint_content_job_roles DROP COLUMN IF EXISTS origine_dato;
ALTER TABLE sys.sys_blueprint_content_job_roles DROP COLUMN IF EXISTS blueprint_content_job_role_ai_impact;
ALTER TABLE sys.sys_blueprint_content_job_roles DROP COLUMN IF EXISTS blueprint_content_job_role_cp2021_code;
ALTER TABLE sys.sys_blueprint_content_job_roles DROP COLUMN IF EXISTS blueprint_content_job_role_esco_name;
ALTER TABLE sys.sys_blueprint_content_job_roles DROP COLUMN IF EXISTS blueprint_content_job_role_esco_uri;
ALTER TABLE sys.sys_blueprint_content_job_roles DROP COLUMN IF EXISTS blueprint_content_job_role_professional_family;
ALTER TABLE sys.sys_blueprint_content_job_roles DROP COLUMN IF EXISTS blueprint_content_job_role_mission;
ALTER TABLE sys.sys_blueprint_content_packages DROP CONSTRAINT IF EXISTS sys_blueprint_content_packages_steps_ck;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_extension_request;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_extends_version;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_dossier_version;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_perimeter_status;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_steps_total;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_steps_accepted;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_is_complete;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_source_hash;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_converter;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_converted_at;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_source_schema_version;

-- le 14 tabelle, in ordine inverso (le loro righe nei registri sono un elenco esplicito, mai un carattere jolly)
DROP TABLE IF EXISTS sys.sys_blueprint_content_position_responsibilities;
DROP TABLE IF EXISTS sys.sys_blueprint_content_process_steps;
DROP TABLE IF EXISTS sys.sys_blueprint_content_perimeters;
DROP TABLE IF EXISTS sys.sys_blueprint_content_design_principles;
DROP TABLE IF EXISTS sys.sys_blueprint_content_agent_links;
DROP TABLE IF EXISTS sys.sys_blueprint_content_agents;
DROP TABLE IF EXISTS sys.sys_blueprint_content_legal_entities;
DROP TABLE IF EXISTS sys.sys_blueprint_content_decision_rights;
DROP TABLE IF EXISTS sys.sys_blueprint_content_decisions;
DROP TABLE IF EXISTS sys.sys_blueprint_content_job_role_links;
DROP TABLE IF EXISTS sys.sys_blueprint_content_capability_links;
DROP TABLE IF EXISTS sys.sys_blueprint_content_capabilities;
DROP TABLE IF EXISTS sys.sys_blueprint_content_strategy_items;
DROP TABLE IF EXISTS sys.sys_blueprint_content_strategies;

DELETE FROM sys.sys_classificazione_direzione_dato WHERE tabella IN (
  'sys_blueprint_content_strategies','sys_blueprint_content_strategy_items','sys_blueprint_content_capabilities','sys_blueprint_content_capability_links',
  'sys_blueprint_content_job_role_links','sys_blueprint_content_decisions','sys_blueprint_content_decision_rights','sys_blueprint_content_legal_entities',
  'sys_blueprint_content_agents','sys_blueprint_content_agent_links','sys_blueprint_content_design_principles','sys_blueprint_content_perimeters',
  'sys_blueprint_content_process_steps','sys_blueprint_content_position_responsibilities');
DELETE FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_table_name IN (
  'sys_blueprint_content_strategies','sys_blueprint_content_strategy_items','sys_blueprint_content_capabilities','sys_blueprint_content_capability_links',
  'sys_blueprint_content_job_role_links','sys_blueprint_content_decisions','sys_blueprint_content_decision_rights','sys_blueprint_content_legal_entities',
  'sys_blueprint_content_agents','sys_blueprint_content_agent_links','sys_blueprint_content_design_principles','sys_blueprint_content_perimeters',
  'sys_blueprint_content_process_steps','sys_blueprint_content_position_responsibilities');

COMMIT;
