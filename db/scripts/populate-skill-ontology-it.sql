-- Popolamento ontologia competenze dal dataset ESCO ufficiale v1.2.0 IT
-- (ADR-0030, decisione Enzo S1024 = ontologia 100%). Schema: migration 000192.
--
-- Autorità = dump ESCO broaderRelations (NON gli skill_group_uri stale in
-- skill_metadata: 400 distinti, 0 match). Ancoraggio su skill_esco_uri.
-- Esecuzione DALLA ROOT DEL REPO (i \copy usano path relativi):
--   psql ... -f db/scripts/populate-skill-ontology-it.sql
--
-- Idempotente: INSERT ON CONFLICT / UPDATE deterministici; id gruppo = UUID v5
-- (RFC-4122) dall'URI ESCO → stabile cross-DB.

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _grp (uri text PRIMARY KEY, label text, descr text, code text);
\copy _grp FROM 'db/data/esco/skillgroups_it.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01')

CREATE TEMP TABLE _br (child text, child_type text, broader text, broader_type text);
\copy _br FROM 'db/data/esco/broader_it.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\x01')

-- 1. Nodi-gruppo (id deterministico v5 dall'URI; label/descrizione IT dal dump)
INSERT INTO sys.sys_skill_groups
  (skill_group_id, skill_group_esco_uri, skill_group_name, skill_group_description, skill_group_code)
SELECT uuid_generate_v5(uuid_ns_url(), g.uri),
       g.uri,
       g.label,
       NULLIF(g.descr, ''),
       NULLIF(g.code, '')
  FROM _grp g
 WHERE length(trim(g.label)) > 0
ON CONFLICT (skill_group_esco_uri) DO UPDATE
  SET skill_group_name        = EXCLUDED.skill_group_name,
      skill_group_description = EXCLUDED.skill_group_description,
      skill_group_code        = EXCLUDED.skill_group_code,
      updated_at              = now();

-- 2. Gerarchia gruppo → gruppo padre (broader relations tra SkillGroup)
UPDATE sys.sys_skill_groups c
   SET skill_group_parent_id = uuid_generate_v5(uuid_ns_url(), b.broader)
  FROM _br b
 WHERE b.child_type = 'SkillGroup' AND b.broader_type = 'SkillGroup'
   AND c.skill_group_esco_uri = b.child
   AND EXISTS (SELECT 1 FROM sys.sys_skill_groups p
                WHERE p.skill_group_esco_uri = b.broader);

-- 3. skill → gruppo primario (broaderHierarchyConcept: child=skill, broader=SkillGroup)
UPDATE sys.sys_skills s
   SET skill_group_id = g.skill_group_id
  FROM _br b
  JOIN sys.sys_skill_groups g ON g.skill_group_esco_uri = b.broader
 WHERE b.child_type = 'KnowledgeSkillCompetence' AND b.broader_type = 'SkillGroup'
   AND s.skill_esco_uri = b.child;

-- 4. skill → skill IS-A (broaderSkill: child IS_A broader) in taxonomy_edges
--    parent = broader (più generale), child = original (più specifico).
INSERT INTO sys.sys_skill_taxonomy_edges
  (skill_taxonomy_edge_parent_id, skill_taxonomy_edge_child_id, skill_taxonomy_edge_kind, skill_taxonomy_edge_metadata)
SELECT p.skill_id, c.skill_id, 'IS_A', jsonb_build_object('source', 'ESCO_v1.2.0')
  FROM _br b
  JOIN sys.sys_skills c ON c.skill_esco_uri = b.child
  JOIN sys.sys_skills p ON p.skill_esco_uri = b.broader
 WHERE b.child_type = 'KnowledgeSkillCompetence' AND b.broader_type = 'KnowledgeSkillCompetence'
   AND p.skill_id <> c.skill_id
ON CONFLICT (skill_taxonomy_edge_parent_id, skill_taxonomy_edge_child_id, skill_taxonomy_edge_kind) DO NOTHING;

-- Report
SELECT 'gruppi' AS m, count(*) FROM sys.sys_skill_groups
UNION ALL SELECT 'gruppi con parent', count(*) FROM sys.sys_skill_groups WHERE skill_group_parent_id IS NOT NULL
UNION ALL SELECT 'skill con gruppo', count(*) FROM sys.sys_skills WHERE skill_group_id IS NOT NULL
UNION ALL SELECT 'edge IS_A ESCO', count(*) FROM sys.sys_skill_taxonomy_edges WHERE skill_taxonomy_edge_kind='IS_A';

COMMIT;
