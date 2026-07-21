-- Completamento bilinguismo EN da dataset ESCO ufficiale v1.2.0 EN (ADR-0029).
-- Decisione Enzo S1024. Rende l'inglese autoritativo (non solo l'harvest dell'in-row):
--   - nomi competenze EN (mancavano: la IT-ificazione 000158/159 aveva perso l'EN);
--   - descrizioni competenze EN allineate al dump ufficiale;
--   - nomi + descrizioni dei gruppi competenze EN (sys_skill_groups).
-- Esecuzione DALLA ROOT DEL REPO:  psql ... -f db/scripts/populate-en-from-esco.sql
-- Idempotente (ON CONFLICT DO UPDATE = il dump EN è l'autorità).

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _en_skill (uri text PRIMARY KEY, label text, descr text);
\copy _en_skill FROM 'db/data/esco/skills_en.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01')

CREATE TEMP TABLE _en_grp (uri text PRIMARY KEY, label text, descr text);
\copy _en_grp FROM 'db/data/esco/skillgroups_en.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01')

-- 1. NOMI competenze EN (label ufficiale) — mancavano in translations
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_skills', s.skill_id, 'name', 'en', e.label, 'ESCO'
  FROM sys.sys_skills s JOIN _en_skill e ON e.uri = s.skill_esco_uri
 WHERE length(trim(e.label)) > 0
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'ESCO', updated_at = now();

-- 2. DESCRIZIONI competenze EN — allineate al dump ufficiale (autorità)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_skills', s.skill_id, 'description', 'en', e.descr, 'ESCO'
  FROM sys.sys_skills s JOIN _en_skill e ON e.uri = s.skill_esco_uri
 WHERE length(trim(coalesce(e.descr,''))) > 0
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'ESCO', updated_at = now();

-- 3. GRUPPI competenze EN (name + description) → translations
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_skill_groups', g.skill_group_id, 'name', 'en', e.label, 'ESCO'
  FROM sys.sys_skill_groups g JOIN _en_grp e ON e.uri = g.skill_group_esco_uri
 WHERE length(trim(e.label)) > 0
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'ESCO', updated_at = now();

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_skill_groups', g.skill_group_id, 'description', 'en', e.descr, 'ESCO'
  FROM sys.sys_skill_groups g JOIN _en_grp e ON e.uri = g.skill_group_esco_uri
 WHERE length(trim(coalesce(e.descr,''))) > 0
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'ESCO', updated_at = now();

-- Report
SELECT 'skill name EN' AS m, count(*) FROM sys.sys_reference_translations WHERE entity_table='sys_skills' AND field='name' AND locale='en'
UNION ALL SELECT 'skill descr EN', count(*) FROM sys.sys_reference_translations WHERE entity_table='sys_skills' AND field='description' AND locale='en'
UNION ALL SELECT 'group name EN', count(*) FROM sys.sys_reference_translations WHERE entity_table='sys_skill_groups' AND field='name' AND locale='en'
UNION ALL SELECT 'group descr EN', count(*) FROM sys.sys_reference_translations WHERE entity_table='sys_skill_groups' AND field='description' AND locale='en';

COMMIT;
