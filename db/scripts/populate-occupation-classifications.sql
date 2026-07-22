-- ============================================================================
-- Popolamento asse PROFESSIONE (mig 000206) — ISCO-08 + CP2021, bilingue.
-- Fonti (CSV VERSIONATI in db/data/occupations/, deliverable Cowork 2026-07-22):
--   • occupation_classifications_seed_it.csv  — BASE IT-canonico in-row.
--       2121 righe: ISCO_08 619 (titoli IT da ESCO API, walk ufficiale) +
--       CP_2021 1502 (Istat/INAIL). Colonne: scheme,code,parent_code,level,name
--   • occupation_reference_translations_en.csv — OVERLAY EN (ADR-0029).
--       2121 righe: 619 ISCO source=HARVEST (ILO/ESCO, autorevoli) +
--       1502 CP2021 source=LLM (CP2021 non ha EN ufficiale).
--       Colonne: entity_table,entity_ref,field,locale,text,source
--       entity_ref = <scheme>:<code> → risolto a entity_id dopo il load BASE.
--
-- Esecuzione DALLA ROOT DEL REPO (path relativi — regola cross-machine):
--   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
--        -f db/scripts/populate-occupation-classifications.sql
--
-- IDEMPOTENTE (ON CONFLICT DO UPDATE: il CSV è l'autorità), transazionale,
-- fail-loud sui conteggi attesi. Registra i watermark ISCO_08 / ISTAT_CP2021.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding TO 'UTF8';
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. BASE — seed IT-canonico in sys_occupation_classifications
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _occ_seed (
  scheme      varchar(32)  NOT NULL,
  code        varchar(32)  NOT NULL,
  parent_code varchar(32),
  level       smallint,
  name        varchar(255) NOT NULL,
  PRIMARY KEY (scheme, code)
);
\copy _occ_seed FROM 'db/data/occupations/occupation_classifications_seed_it.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO sys.sys_occupation_classifications
  (occupation_classification_scheme, occupation_classification_code,
   occupation_classification_parent_code, occupation_classification_level,
   occupation_classification_name)
SELECT scheme, code, NULLIF(parent_code, ''), level, name
  FROM _occ_seed
ON CONFLICT (occupation_classification_scheme, occupation_classification_code)
  DO UPDATE SET
    occupation_classification_parent_code = EXCLUDED.occupation_classification_parent_code,
    occupation_classification_level       = EXCLUDED.occupation_classification_level,
    occupation_classification_name        = EXCLUDED.occupation_classification_name,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. OVERLAY EN — sys_reference_translations (resolve entity_id da scheme:code)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _occ_en (
  entity_table varchar(63) NOT NULL,
  entity_ref   varchar(80) NOT NULL,
  field        varchar(40) NOT NULL,
  locale       varchar(5)  NOT NULL,
  text         text        NOT NULL,
  source       varchar(16) NOT NULL,
  PRIMARY KEY (entity_ref, field, locale)
);
\copy _occ_en FROM 'db/data/occupations/occupation_reference_translations_en.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT e.entity_table, o.occupation_classification_id, e.field, e.locale, e.text, e.source
  FROM _occ_en e
  JOIN sys.sys_occupation_classifications o
    ON o.occupation_classification_scheme = split_part(e.entity_ref, ':', 1)
   AND o.occupation_classification_code   = split_part(e.entity_ref, ':', 2)
 WHERE e.entity_table = 'sys_occupation_classifications'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = EXCLUDED.source, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Watermark sorgenti (pattern reference-sync; il seed è il deliverable
--    2026-07-22 — ESCO API IT + Istat/INAIL + EN ILO/ESCO/LLM)
-- ---------------------------------------------------------------------------
INSERT INTO brownfield.source_watermarks
  (source_watermark_source_key, source_watermark_status, source_watermark_cursor,
   source_watermark_last_fetched_at, source_watermark_last_succeeded_at, source_watermark_metadata)
VALUES
  ('ISCO_08',      'UNCHANGED', '2026-07-22', now(), now(),
   '{"provenance":"ESCO API walk (language=it) + ILO structure; EN=HARVEST","rows":619}'::jsonb),
  ('ISTAT_CP2021', 'UNCHANGED', '2026-07-22', now(), now(),
   '{"provenance":"Istat/INAIL CP2021; EN=LLM (no official EN)","rows":1502}'::jsonb)
ON CONFLICT (source_watermark_source_key)
  DO UPDATE SET source_watermark_status = EXCLUDED.source_watermark_status,
                source_watermark_cursor = EXCLUDED.source_watermark_cursor,
                source_watermark_last_fetched_at = EXCLUDED.source_watermark_last_fetched_at,
                source_watermark_last_succeeded_at = EXCLUDED.source_watermark_last_succeeded_at,
                source_watermark_metadata = EXCLUDED.source_watermark_metadata,
                updated_at = now();

-- ---------------------------------------------------------------------------
-- 4. Assert fail-loud (conteggi attesi dal deliverable — regola §9 cli-prompt:
--    se un conteggio non matcha → ROLLBACK, non forzare)
-- ---------------------------------------------------------------------------
DO $$
DECLARE n_isco int; n_cp int; n_en int; n_orphan int;
        isco_levels text; cp_levels text;
BEGIN
  SELECT count(*) INTO n_isco FROM sys.sys_occupation_classifications WHERE occupation_classification_scheme = 'ISCO_08';
  SELECT count(*) INTO n_cp   FROM sys.sys_occupation_classifications WHERE occupation_classification_scheme = 'CP_2021';
  IF n_isco <> 619 THEN RAISE EXCEPTION 'populate-occupations: attesi 619 ISCO_08, trovati %', n_isco; END IF;
  IF n_cp <> 1502 THEN RAISE EXCEPTION 'populate-occupations: attesi 1502 CP_2021, trovati %', n_cp; END IF;

  SELECT string_agg(c::text, '/' ORDER BY lvl) INTO isco_levels
    FROM (SELECT occupation_classification_level lvl, count(*) c
            FROM sys.sys_occupation_classifications WHERE occupation_classification_scheme='ISCO_08' GROUP BY 1) s;
  IF isco_levels <> '10/43/130/436' THEN RAISE EXCEPTION 'populate-occupations: livelli ISCO % (attesi 10/43/130/436)', isco_levels; END IF;

  SELECT string_agg(c::text, '/' ORDER BY lvl) INTO cp_levels
    FROM (SELECT occupation_classification_level lvl, count(*) c
            FROM sys.sys_occupation_classifications WHERE occupation_classification_scheme='CP_2021' GROUP BY 1) s;
  IF cp_levels <> '9/40/130/510/813' THEN RAISE EXCEPTION 'populate-occupations: livelli CP % (attesi 9/40/130/510/813)', cp_levels; END IF;

  SELECT count(*) INTO n_en FROM sys.sys_reference_translations
   WHERE entity_table = 'sys_occupation_classifications' AND field = 'name' AND locale = 'en';
  IF n_en <> 2121 THEN RAISE EXCEPTION 'populate-occupations: attesi 2121 overlay EN, trovati %', n_en; END IF;

  SELECT count(*) INTO n_orphan FROM sys.v_reference_translation_orphans;
  IF n_orphan <> 0 THEN RAISE EXCEPTION 'populate-occupations: % traduzioni orfane', n_orphan; END IF;

  RAISE NOTICE 'populate-occupations OK: ISCO_08=619 (10/43/130/436) + CP_2021=1502 (9/40/130/510/813), overlay EN=2121, 0 orfani.';
END $$;

-- Report finale
SELECT occupation_classification_scheme AS scheme, count(*) AS rows
  FROM sys.sys_occupation_classifications GROUP BY 1 ORDER BY 1;
SELECT source, count(*) FROM sys.sys_reference_translations
 WHERE entity_table='sys_occupation_classifications' GROUP BY 1 ORDER BY 1;
SELECT entity_table, field, base_rows, translated, missing
  FROM sys.v_reference_translation_coverage
 WHERE entity_table = 'sys_occupation_classifications';

COMMIT;
