-- ============================================================================
-- Migration 000190 — ADR-0029 wave-1 (fondamento i18n dei dati di riferimento).
-- Mandato forense S1023 Fase 2.6; decisione Enzo S1024 = bilinguismo COMPLETO.
--
-- Struttura (il popolamento vive in script idempotenti ri-eseguibili, per fonte):
--   1. sys.sys_reference_translations — tabella centrale delle traduzioni.
--      Canonico IT in-row nelle tabelle di dominio; qui vive l'ALTRA lingua
--      (EN harvestato + eventuali IT per i cataloghi ESCO). Riferimento
--      polimorfico by-design (classe D-54): niente FK, integrità via vista.
--   2. sys.sys_translatable_field — registro dei campi traducibili
--      (entity_table, pk, field, canonical_locale). Fa da SoT per gli script
--      di popolamento e per la vista di integrità (niente hard-coding sparso).
--   3. sys.fn_reference_translation_orphans() + vista v_reference_translation_orphans
--      — integrità generica: ogni translation deve puntare a una riga viva
--      della sua entity_table (dynamic EXISTS sul registro). 0 righe = sano.
--
-- Idempotente + twice-run: IF NOT EXISTS ovunque, registro con ON CONFLICT.
-- Authored: 2026-07-21 (S1024).
-- ============================================================================

-- 1. Tabella centrale traduzioni
CREATE TABLE IF NOT EXISTS sys.sys_reference_translations (
  reference_translation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table  varchar(63)  NOT NULL,
  entity_id     uuid         NOT NULL,
  field         varchar(40)  NOT NULL,
  locale        varchar(5)   NOT NULL,
  text          text         NOT NULL,
  source        varchar(16)  NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT sys_reference_translations_locale_check
    CHECK (locale IN ('en', 'it')),
  CONSTRAINT sys_reference_translations_source_check
    CHECK (source IN ('HARVEST', 'ESCO', 'LLM', 'MANUAL')),
  CONSTRAINT sys_reference_translations_text_nonblank
    CHECK (length(trim(text)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_reference_translations_uq
  ON sys.sys_reference_translations (entity_table, entity_id, field, locale);

-- lookup principale a runtime: overlay per (tabella, campo, locale)
CREATE INDEX IF NOT EXISTS sys_reference_translations_lookup_idx
  ON sys.sys_reference_translations (entity_table, field, locale);

-- 2. Registro dei campi traducibili (SoT per script + vista)
CREATE TABLE IF NOT EXISTS sys.sys_translatable_field (
  translatable_field_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table      varchar(63) NOT NULL,
  entity_pk_column  varchar(63) NOT NULL,
  field             varchar(40) NOT NULL,
  entity_field_column varchar(63) NOT NULL,  -- colonna reale IT-canonica in-row
  canonical_locale  varchar(5)  NOT NULL DEFAULT 'it',
  note              text,
  CONSTRAINT sys_translatable_field_uq UNIQUE (entity_table, field)
);

-- Popolamento registro (le entity/campi traducibili del dominio). ON CONFLICT
-- per idempotenza. field = nome logico; entity_field_column = colonna reale.
INSERT INTO sys.sys_translatable_field
  (entity_table, entity_pk_column, field, entity_field_column, note)
VALUES
  ('sys_auth_roles','auth_role_id','name','auth_role_name','ruoli RBAC'),
  ('sys_auth_roles','auth_role_id','description','auth_role_description','ruoli RBAC'),
  ('sys_auth_permissions','auth_permission_id','name','auth_permission_name','permessi RBAC'),
  ('sys_auth_permissions','auth_permission_id','description','auth_permission_description','permessi RBAC'),
  ('sys_skill_families','skill_family_id','name','skill_family_name','famiglie competenze'),
  ('sys_skill_families','skill_family_id','description','skill_family_description','famiglie competenze'),
  ('sys_skill_categories','skill_category_id','name','skill_category_name','categorie competenze'),
  ('sys_skill_categories','skill_category_id','description','skill_category_description','categorie competenze'),
  ('sys_skill_proficiency_levels','skill_proficiency_level_id','name','skill_proficiency_level_name','livelli proficiency'),
  ('sys_skill_proficiency_levels','skill_proficiency_level_id','description','skill_proficiency_level_description','livelli proficiency'),
  ('sys_operating_model_catalog','operating_model_id','name','operating_model_name','modelli operativi'),
  ('sys_operating_model_catalog','operating_model_id','description','operating_model_description','modelli operativi'),
  ('sys_job_families','job_family_id','name','job_family_name','famiglie professionali'),
  ('sys_job_families','job_family_id','description','job_family_description','famiglie professionali'),
  ('sys_job_roles','job_role_id','name','job_role_name','ruoli professionali'),
  ('sys_job_roles','job_role_id','description','job_role_description','ruoli professionali'),
  ('sys_goal_templates','template_id','name','template_name','template obiettivi'),
  ('sys_goal_templates','template_id','description','template_description','template obiettivi'),
  ('sys_kpi_definitions','kpi_definition_id','name','kpi_definition_name','definizioni KPI'),
  ('sys_kpi_definitions','kpi_definition_id','description','kpi_definition_description','definizioni KPI'),
  ('sys_skills','skill_id','name','skill_name','competenze (ESCO)'),
  ('sys_skills','skill_id','description','skill_description','competenze (ESCO)')
ON CONFLICT (entity_table, field) DO UPDATE
  SET entity_pk_column = EXCLUDED.entity_pk_column,
      entity_field_column = EXCLUDED.entity_field_column,
      note = EXCLUDED.note;

-- 3. Integrità generica: translations orfane (entity_id non più vivo)
CREATE OR REPLACE FUNCTION sys.fn_reference_translation_orphans()
RETURNS TABLE (reference_translation_id uuid, entity_table varchar, entity_id uuid) AS $$
DECLARE
  tbl text;
  pk  text;
BEGIN
  FOR tbl, pk IN
    SELECT DISTINCT f.entity_table, f.entity_pk_column FROM sys.sys_translatable_field f
  LOOP
    -- solo tabelle realmente esistenti (difensivo)
    IF to_regclass('sys.' || tbl) IS NULL THEN CONTINUE; END IF;
    RETURN QUERY EXECUTE format(
      'SELECT t.reference_translation_id, t.entity_table, t.entity_id
         FROM sys.sys_reference_translations t
        WHERE t.entity_table = %L
          AND NOT EXISTS (SELECT 1 FROM sys.%I e WHERE e.%I = t.entity_id)',
      tbl, tbl, pk);
  END LOOP;
END $$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE VIEW sys.v_reference_translation_orphans AS
  SELECT * FROM sys.fn_reference_translation_orphans();

-- Post-condition (fail-loud)
DO $$
BEGIN
  IF to_regclass('sys.sys_reference_translations') IS NULL THEN
    RAISE EXCEPTION '000190: sys_reference_translations assente';
  END IF;
  IF (SELECT count(*) FROM sys.sys_translatable_field) < 22 THEN
    RAISE EXCEPTION '000190: registro campi traducibili incompleto';
  END IF;
  PERFORM 1 FROM sys.v_reference_translation_orphans LIMIT 1;  -- vista eseguibile
END $$;
