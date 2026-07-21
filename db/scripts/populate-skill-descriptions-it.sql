-- Popolamento bilingue descrizioni competenze (ADR-0029 wave-1, decisione Enzo
-- S1024). Fonte: dataset ESCO ufficiale v1.2.0 IT (vedi db/data/esco/README.md).
--
-- Import bulk (temp table) idempotente:
--   1. harvest della descrizione EN attuale (in-row) → sys_reference_translations
--      (locale 'en', source ESCO) — ON CONFLICT DO NOTHING protegge la riesecuzione
--      (dopo il 1° giro l'in-row è IT, ma la riga EN esiste già → non sovrascritta);
--   2. descrizione IT ufficiale dal dump → in-row (skill_description).
-- Copertura misurata S1024: 13.933/14.003 skill con esco_uri matchano il dump
-- (99,5%; 70 URI non nel dump = versione/retired, descrizione EN preservata invariata).
--
-- Prerequisito: db/data/esco/skills_it.tsv rigenerato dal dump (README §rigenerazione).
-- Esecuzione DALLA ROOT DEL REPO (il \copy usa un path relativo alla CWD del client):
--   psql ... -f db/scripts/populate-skill-descriptions-it.sql

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _esco_skill (uri text PRIMARY KEY, label text, descr text);
\copy _esco_skill FROM 'db/data/esco/skills_it.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01')

-- 1. harvest EN (descrizione in-row corrente) → translations
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_skills', s.skill_id, 'description', 'en', s.skill_description, 'ESCO'
  FROM sys.sys_skills s
  JOIN _esco_skill e ON e.uri = s.skill_esco_uri
 WHERE s.skill_description IS NOT NULL
   AND s.skill_description <> ''
   AND s.skill_description <> '""'
ON CONFLICT (entity_table, entity_id, field, locale) DO NOTHING;

-- 2. descrizione IT ufficiale → in-row
UPDATE sys.sys_skills s
   SET skill_description = e.descr
  FROM _esco_skill e
 WHERE e.uri = s.skill_esco_uri
   AND coalesce(e.descr, '') <> '';

COMMIT;
