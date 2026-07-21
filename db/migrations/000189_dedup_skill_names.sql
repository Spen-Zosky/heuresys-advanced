-- ============================================================================
-- Migration 000189 — Forense F2 (census S1024, F2.2 check 3c): dedup skill per
-- nome normalizzato + unique index preventivo, CON REPOINT delle referenze.
--
-- Stato misurato (S1024): 24 gruppi (tenant, lower(trim(name))) con >1 riga =
-- 76 righe, 52 "loser" da collassare sul winner. Mix ESCO::/COMP:: sullo
-- stesso nome (es. "problem solving" ×4 GLOBAL, "leadership" ×4 RTL).
--
-- ⚠ I 52 loser NON sono orfani (una prima misura errata, viziata dal footgun
-- `(tenant,name) IN (tuple)` che con tenant NULL non matcha lo scope GLOBAL,
-- lo faceva credere). Referenze reali sui loser (window COUNT, corretta):
-- user_skills 133 · evidence 132 · position_skill_requirements 131 ·
-- occupation_skill_requirements 93 · taxonomy_edges 77 · learning_mappings 6 ·
-- mentor_match 1 · embeddings 52 (1:1). Vanno REPOINTATE al winner, non perse.
--
-- Winner per gruppo = ESCO:: se presente (tassonomia canonica), poi il più
-- vecchio (created_at). Conflitti di unicità misurati sul repoint completo:
--   • user_skills UNIQUE(user,skill): 0 collisioni · pos_req UNIQUE(pos,skill): 0
--   • learning_map UNIQUE(skill,module): 4 collisioni → absorb (delete)
--   • taxonomy_edges UNIQUE(parent,child,kind): 0 dup, 1 self-loop → delete
--   • occ_req UNIQUE è su esco_uri (non skill_id) → repoint neutro
--   • evidence/mentor: nessuna unicità su skill_id → repoint diretto
-- Pattern per ogni FK con unicità su skill_id: DELETE le righe che
-- collidono col winner, poi UPDATE il resto (difensivo, robusto a dati futuri).
--
-- Archivio reversibile in audit.skill_dedup_archive. Unique index preventivo su
-- (COALESCE(tenant, nil), lower(trim(name))): 16/24 gruppi sono GLOBAL
-- (tenant NULL) → il COALESCE al nil-UUID rende l'unicità effettiva anche lì.
--
-- Idempotente + twice-run: al 2° giro la temp map è vuota (0 duplicati) → tutti
-- gli statement toccano 0 righe; index IF NOT EXISTS; post-condition 0 dup.
-- migrate.sh applica ogni file con `psql -1 -f` (temp table isolata al file).
-- Authored: 2026-07-21 (S1024).
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.skill_dedup_archive (LIKE sys.sys_skills);

DROP TABLE IF EXISTS _skill_merge_map;
CREATE TEMP TABLE _skill_merge_map AS
WITH ranked AS (
  -- window (non IN(tuple)): PARTITION BY tratta i NULL come uguali → i gruppi
  -- GLOBAL (tenant NULL) sono raggruppati correttamente.
  SELECT s.skill_id,
         count(*) OVER (
           PARTITION BY s.skill_tenant_id, lower(trim(s.skill_name))
         ) AS grp_n,
         first_value(s.skill_id) OVER (
           PARTITION BY s.skill_tenant_id, lower(trim(s.skill_name))
           ORDER BY (s.skill_code LIKE 'ESCO::%') DESC, s.created_at
         ) AS winner,
         row_number() OVER (
           PARTITION BY s.skill_tenant_id, lower(trim(s.skill_name))
           ORDER BY (s.skill_code LIKE 'ESCO::%') DESC, s.created_at
         ) AS rn
    FROM sys.sys_skills s
)
SELECT skill_id AS loser, winner FROM ranked WHERE grp_n > 1 AND rn > 1;

-- ---- REPOINT ---------------------------------------------------------------
-- learning_mappings: assorbi le collisioni (skill,module) poi repointa il resto
DELETE FROM sys.sys_skill_learning_mappings a
 USING _skill_merge_map m
 WHERE a.skill_learning_mapping_skill_id = m.loser
   AND EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings b
                WHERE b.skill_learning_mapping_module_id = a.skill_learning_mapping_module_id
                  AND b.skill_learning_mapping_skill_id = m.winner);
UPDATE sys.sys_skill_learning_mappings a
   SET skill_learning_mapping_skill_id = m.winner
  FROM _skill_merge_map m
 WHERE a.skill_learning_mapping_skill_id = m.loser;

-- taxonomy_edges: elimina l'edge che collasserebbe in self-loop, poi repointa
-- parent+child atomicamente (0 dup risultanti, misurato).
DELETE FROM sys.sys_skill_taxonomy_edges e
 WHERE COALESCE((SELECT winner FROM _skill_merge_map WHERE loser = e.skill_taxonomy_edge_parent_id),
                e.skill_taxonomy_edge_parent_id)
     = COALESCE((SELECT winner FROM _skill_merge_map WHERE loser = e.skill_taxonomy_edge_child_id),
                e.skill_taxonomy_edge_child_id);
UPDATE sys.sys_skill_taxonomy_edges e
   SET skill_taxonomy_edge_parent_id =
         COALESCE((SELECT winner FROM _skill_merge_map WHERE loser = e.skill_taxonomy_edge_parent_id),
                  e.skill_taxonomy_edge_parent_id),
       skill_taxonomy_edge_child_id =
         COALESCE((SELECT winner FROM _skill_merge_map WHERE loser = e.skill_taxonomy_edge_child_id),
                  e.skill_taxonomy_edge_child_id)
 WHERE e.skill_taxonomy_edge_parent_id IN (SELECT loser FROM _skill_merge_map)
    OR e.skill_taxonomy_edge_child_id IN (SELECT loser FROM _skill_merge_map);

-- user_skills: dedup difensivo su (user,skill) poi repoint
DELETE FROM sys.sys_user_skills a
 USING _skill_merge_map m
 WHERE a.user_skill_skill_id = m.loser
   AND EXISTS (SELECT 1 FROM sys.sys_user_skills b
                WHERE b.user_skill_user_id = a.user_skill_user_id
                  AND b.user_skill_skill_id = m.winner);
UPDATE sys.sys_user_skills a
   SET user_skill_skill_id = m.winner
  FROM _skill_merge_map m
 WHERE a.user_skill_skill_id = m.loser;

-- position_skill_requirements: dedup difensivo su (position,skill) poi repoint
DELETE FROM sys.sys_position_skill_requirements a
 USING _skill_merge_map m
 WHERE a.skill_id = m.loser
   AND EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements b
                WHERE b.position_id = a.position_id
                  AND b.skill_id = m.winner);
UPDATE sys.sys_position_skill_requirements a
   SET skill_id = m.winner
  FROM _skill_merge_map m
 WHERE a.skill_id = m.loser;

-- occupation_skill_requirements: unicità su esco_uri (non skill_id) → repoint diretto
UPDATE sys.sys_occupation_skill_requirements a
   SET occupation_skill_req_skill_id = m.winner
  FROM _skill_merge_map m
 WHERE a.occupation_skill_req_skill_id = m.loser;

-- user_skill_evidence: solo PK → repoint diretto
UPDATE sys.sys_user_skill_evidence a
   SET user_skill_evidence_skill_id = m.winner
  FROM _skill_merge_map m
 WHERE a.user_skill_evidence_skill_id = m.loser;

-- mentor_match_scores: unicità su natural_key (non skill_id) → repoint diretto
UPDATE sys.sys_mentor_match_scores a
   SET match_skill_id = m.winner
  FROM _skill_merge_map m
 WHERE a.match_skill_id = m.loser;

-- ---- ARCHIVE + DELETE ------------------------------------------------------
INSERT INTO audit.skill_dedup_archive
SELECT s.* FROM sys.sys_skills s JOIN _skill_merge_map m ON m.loser = s.skill_id;

DELETE FROM sys.sys_skills
 WHERE skill_id IN (SELECT loser FROM _skill_merge_map);
-- (sys_skill_embeddings dei loser eliminati via ON DELETE CASCADE)

-- ---- UNIQUE INDEX preventivo ----------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS sys_skills_natural_key_uq
  ON sys.sys_skills
     (COALESCE(skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
      lower(trim(skill_name)));

-- ---- Post-conditions (fail-loud) ------------------------------------------
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM sys.sys_skills
     GROUP BY skill_tenant_id, lower(trim(skill_name))
    HAVING count(*) > 1) q;
  IF n > 0 THEN
    RAISE EXCEPTION '000189: % gruppi skill duplicati ancora presenti', n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'sys' AND indexname = 'sys_skills_natural_key_uq') THEN
    RAISE EXCEPTION '000189: unique index natural-key skill assente';
  END IF;

  -- integrità: nessuna referenza deve ancora puntare a un loser eliminato
  IF EXISTS (SELECT 1 FROM sys.sys_user_skills u
              JOIN audit.skill_dedup_archive a ON a.skill_id = u.user_skill_skill_id) THEN
    RAISE EXCEPTION '000189: user_skills ancora referenzia skill archiviate';
  END IF;
END $$;
