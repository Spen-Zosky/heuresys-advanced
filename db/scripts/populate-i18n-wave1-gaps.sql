-- ============================================================================
-- Healing dei gap di copertura i18n wave-1 (ADR-0029) — proposta Cowork
-- 2026-07-22 (COWORK_INBOX "i18n: gate di COPERTURA" §5), eseguita S1027.
--
-- Il gate v_reference_translation_coverage (mig 000207) misurava live:
--   sys_kpi_definitions  name 243 + description 126  senza overlay EN
--   sys_job_roles        name 137 + description  50  senza overlay EN
--   sys_skills           name 108 + description 108  senza overlay EN (custom, non-ESCO)
--   sys_skill_groups     description: ANOMALIA -477 (overlay EN ufficiale ESCO
--                        presente, IT-canonico in-row VUOTO)
-- (I 16 permessi con name EN in-row sono sanati da mig 000209 — sono
--  migration-seeded, il fix doveva valere anche su un DB fresco/CI.)
--
-- Fonti (CSV VERSIONATI in db/data/i18n/ — traduzioni LLM S1027, validate
-- id-set 1:1 contro il DB, 0 vuoti):
--   • wave1_gap_overlays_en.csv        — 772 overlay EN (source=LLM)
--   • skill_groups_descriptions_it.csv — 477 descrizioni IT (EN ESCO → IT)
--
-- Esecuzione DALLA ROOT DEL REPO:
--   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
--        -f db/scripts/populate-i18n-wave1-gaps.sql
--
-- IDEMPOTENTE heal-only: overlay ON CONFLICT DO NOTHING (mai sovrascrivere un
-- overlay già presente); in-row skill_groups UPDATE solo dove ancora vuoto.
-- Fail-loud: al termine il gate registry-wide DEVE essere pulito (0 gap,
-- 0 anomalie, 0 orfani) — altrimenti ROLLBACK.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding TO 'UTF8';
BEGIN;

-- 1. Overlay EN mancanti (kpi/job_roles/skills)
CREATE TEMP TABLE _gap_en (
  entity_table varchar(63) NOT NULL,
  entity_id    uuid        NOT NULL,
  field        varchar(40) NOT NULL,
  locale       varchar(5)  NOT NULL,
  text         text        NOT NULL,
  source       varchar(16) NOT NULL,
  PRIMARY KEY (entity_table, entity_id, field, locale)
);
\copy _gap_en FROM 'db/data/i18n/wave1_gap_overlays_en.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT entity_table, entity_id, field, locale, text, source FROM _gap_en
ON CONFLICT (entity_table, entity_id, field, locale) DO NOTHING;

-- 2. Anomalia skill_groups: IT-canonico in-row mancante (overlay EN già vivo)
CREATE TEMP TABLE _sg_it (
  skill_group_id uuid PRIMARY KEY,
  description_it text NOT NULL
);
\copy _sg_it FROM 'db/data/i18n/skill_groups_descriptions_it.csv' WITH (FORMAT csv, HEADER true)

UPDATE sys.sys_skill_groups g
   SET skill_group_description = s.description_it,
       updated_at = now()
  FROM _sg_it s
 WHERE g.skill_group_id = s.skill_group_id
   AND length(trim(coalesce(g.skill_group_description, ''))) = 0;

-- 3. Gate finale (fail-loud): copertura registry-wide PULITA
DO $$
DECLARE n_gap int; n_anom int; n_orphan int;
BEGIN
  SELECT count(*) INTO n_gap    FROM sys.v_reference_translation_coverage WHERE missing > 0;
  SELECT count(*) INTO n_anom   FROM sys.v_reference_translation_coverage WHERE missing < 0;
  SELECT count(*) INTO n_orphan FROM sys.v_reference_translation_orphans;
  IF n_gap <> 0 OR n_anom <> 0 OR n_orphan <> 0 THEN
    RAISE EXCEPTION 'i18n-wave1-heal: gate NON pulito — gap=%, anomalie=%, orfani=%', n_gap, n_anom, n_orphan;
  END IF;
  RAISE NOTICE 'i18n-wave1-heal OK: copertura EN completa registry-wide (0 gap, 0 anomalie, 0 orfani).';
END $$;

-- Report finale
SELECT entity_table, field, base_rows, translated, missing
  FROM sys.v_reference_translation_coverage
 ORDER BY entity_table, field;

COMMIT;
