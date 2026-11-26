-- ============================================================================
-- Migration 000516 — Il registro dei campi traducibili vede le traduzioni che ci sono già
-- (ADR-0062, passo 2; ADR-0029).
--
-- sys_reference_translations contiene traduzioni inglesi di 38 coppie tabella-campo che non
-- sono nel registro sys_translatable_field: i contenuti dei blueprint, il registro dei loro
-- processi e le etichette delle interfacce. Senza la riga di registro la copertura e gli
-- orfani non le vedono, e la traduzione nella risposta dell'API (ADR-0062) non le usa.
-- Misurato in sola lettura sulla produzione il 2026-11-26: 2.923 traduzioni, ognuna trova la
-- sua riga per id, una sola colonna candidata per coppia, chiave primaria a colonna singola.
-- Per sys_ui_interfaces il nome logico del campo è già il nome della colonna.
--
-- Solo righe del registro: nessun dato del dominio cambia. Idempotente (ON CONFLICT).
-- Se una tabella manca (database della CI senza i blueprint), le funzioni di copertura e degli
-- orfani la saltano da sé (to_regclass).
-- ============================================================================

INSERT INTO sys.sys_translatable_field
  (entity_table, entity_pk_column, field, entity_field_column, note)
VALUES
  ('sys_blueprint_content_career_paths','blueprint_content_career_id','name','blueprint_content_career_name','contenuto dei blueprint'),
  ('sys_blueprint_content_ccnl','blueprint_content_ccnl_id','name','blueprint_content_ccnl_name','contenuto dei blueprint'),
  ('sys_blueprint_content_ccnl','blueprint_content_ccnl_id','parties','blueprint_content_ccnl_parties','contenuto dei blueprint'),
  ('sys_blueprint_content_ccnl','blueprint_content_ccnl_id','scope','blueprint_content_ccnl_scope','contenuto dei blueprint'),
  ('sys_blueprint_content_ccnl_conditions','blueprint_content_ccnl_condition_id','description','blueprint_content_ccnl_condition_description','contenuto dei blueprint'),
  ('sys_blueprint_content_ccnl_institutes','blueprint_content_ccnl_institute_id','description','blueprint_content_ccnl_institute_description','contenuto dei blueprint'),
  ('sys_blueprint_content_ccnl_levels','blueprint_content_ccnl_level_id','duties','blueprint_content_ccnl_level_duties','contenuto dei blueprint'),
  ('sys_blueprint_content_ccnl_levels','blueprint_content_ccnl_level_id','minimum_note','blueprint_content_ccnl_level_minimum_note','contenuto dei blueprint'),
  ('sys_blueprint_content_ccnl_levels','blueprint_content_ccnl_level_id','name','blueprint_content_ccnl_level_name','contenuto dei blueprint'),
  ('sys_blueprint_content_context','blueprint_content_context_id','ateco_name','blueprint_content_context_ateco_name','contenuto dei blueprint'),
  ('sys_blueprint_content_context','blueprint_content_context_id','description','blueprint_content_context_description','contenuto dei blueprint'),
  ('sys_blueprint_content_derivations','blueprint_content_derivation_id','rule','blueprint_content_derivation_rule','contenuto dei blueprint'),
  ('sys_blueprint_content_engagements','blueprint_content_engagement_id','description','blueprint_content_engagement_description','contenuto dei blueprint'),
  ('sys_blueprint_content_engagements','blueprint_content_engagement_id','name','blueprint_content_engagement_name','contenuto dei blueprint'),
  ('sys_blueprint_content_goals','blueprint_content_goal_id','title','blueprint_content_goal_title','contenuto dei blueprint'),
  ('sys_blueprint_content_incentives','blueprint_content_incentive_id','name','blueprint_content_incentive_name','contenuto dei blueprint'),
  ('sys_blueprint_content_incentives','blueprint_content_incentive_id','rule','blueprint_content_incentive_rule','contenuto dei blueprint'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_id','data_source','blueprint_content_kpi_data_source','contenuto dei blueprint'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_id','formula','blueprint_content_kpi_formula','contenuto dei blueprint'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_id','name','blueprint_content_kpi_name','contenuto dei blueprint'),
  ('sys_blueprint_content_kpis','blueprint_content_kpi_id','reference_text','blueprint_content_kpi_reference_text','contenuto dei blueprint'),
  ('sys_blueprint_content_obligations','blueprint_content_obligation_id','missing_role','blueprint_content_obligation_missing_role','contenuto dei blueprint'),
  ('sys_blueprint_content_obligations','blueprint_content_obligation_id','norm','blueprint_content_obligation_norm','contenuto dei blueprint'),
  ('sys_blueprint_content_obligations','blueprint_content_obligation_id','subject','blueprint_content_obligation_subject','contenuto dei blueprint'),
  ('sys_blueprint_content_obligations','blueprint_content_obligation_id','training_required','blueprint_content_obligation_training_required','contenuto dei blueprint'),
  ('sys_blueprint_content_position_occupations','blueprint_content_position_occupation_id','name','blueprint_content_position_occupation_name','contenuto dei blueprint'),
  ('sys_blueprint_content_positions','blueprint_content_position_id','criticality_note','blueprint_content_position_criticality_note','contenuto dei blueprint'),
  ('sys_blueprint_content_positions','blueprint_content_position_id','title','blueprint_content_position_title','contenuto dei blueprint'),
  ('sys_blueprint_content_sites','blueprint_content_site_id','name','blueprint_content_site_name','contenuto dei blueprint'),
  ('sys_blueprint_content_sites','blueprint_content_site_id','note','blueprint_content_site_note','contenuto dei blueprint'),
  ('sys_blueprint_content_skills','blueprint_content_skill_id','name','blueprint_content_skill_name','contenuto dei blueprint'),
  ('sys_blueprint_content_training','blueprint_content_training_id','title','blueprint_content_training_title','contenuto dei blueprint'),
  ('sys_blueprint_content_units','blueprint_content_unit_id','headcount_note','blueprint_content_unit_headcount_note','contenuto dei blueprint'),
  ('sys_blueprint_content_units','blueprint_content_unit_id','name','blueprint_content_unit_name','contenuto dei blueprint'),
  ('sys_blueprint_process_registry','blueprint_process_id','name','blueprint_process_name','registro dei processi dei blueprint'),
  ('sys_blueprint_process_registry','blueprint_process_id','description','blueprint_process_description','registro dei processi dei blueprint'),
  ('sys_blueprint_process_registry','blueprint_process_id','rationale','blueprint_process_rationale','registro dei processi dei blueprint'),
  ('sys_ui_interfaces','ui_interface_id','ui_interface_label','ui_interface_label','etichette delle interfacce')
ON CONFLICT (entity_table, field) DO UPDATE
  SET entity_pk_column = EXCLUDED.entity_pk_column,
      entity_field_column = EXCLUDED.entity_field_column,
      note = EXCLUDED.note;

-- Post-condizione: ogni riga registrata qui punta a colonne vere, dove la tabella esiste.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT entity_table, entity_pk_column, entity_field_column
             FROM sys.sys_translatable_field
            WHERE note IN ('contenuto dei blueprint','registro dei processi dei blueprint','etichette delle interfacce')
  LOOP
    IF to_regclass('sys.' || r.entity_table) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'sys' AND table_name = r.entity_table
                      AND column_name = r.entity_field_column)
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'sys' AND table_name = r.entity_table
                      AND column_name = r.entity_pk_column) THEN
      RAISE EXCEPTION '000516: colonne assenti per %', r.entity_table;
    END IF;
  END LOOP;
  PERFORM 1 FROM sys.v_reference_translation_orphans LIMIT 1;
END $$;
