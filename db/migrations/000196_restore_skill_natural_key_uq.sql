-- ============================================================================
-- Migration 000196 — D-74 (chiusura): ripristino SICURO dell'unique index
-- naturale skill rimosso da 000194, in 3 passi:
--
--   1. RE-DEDUP difensivo: assorbe eventuali duplicati (tenant, lower(trim(name)))
--      creati nella finestra senza indice (post-000194) — stessa logica e stesso
--      repoint completo di 000189 (winner = ESCO:: se presente, poi il più vecchio;
--      archivio reversibile in audit.skill_dedup_archive).
--   2. EREDITÀ CATEGORIA: i winner senza skill_category_id la ereditano dal loser
--      archiviato con la stessa chiave naturale. Chiude la regressione 000189:
--      il repoint delle evidence su winner ESCO:: privi di categoria aveva reso
--      invisibili 132 evidenze (2 skill: "analisi finanziaria", "Gestione del
--      rischio") nella heatmap by-category, rompendo l'invariante DENSE.
--   3. CREATE UNIQUE INDEX IF NOT EXISTS sys_skills_natural_key_uq.
--
-- PREREQUISITO CODICE (stesso commit): i path che inseriscono skill gestiscono
-- il conflitto per chiave naturale (tenant-materialization get-or-create by
-- name; modulo skills → 409 SKILL_NAME_CONFLICT). Senza quel codice l'indice
-- rompeva materialize/reconciliation in CI (motivo del revert 000194).
--
-- Idempotente + twice-run: al 2° giro la merge map è vuota, l'eredità tocca 0
-- righe, l'indice esiste già. migrate applica con psql -1 -f (tx per file).
-- Authored: 2026-07-22 (S1025).
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.skill_dedup_archive (LIKE sys.sys_skills);

-- ---- 1. RE-DEDUP (stessa logica 000189) ------------------------------------
DROP TABLE IF EXISTS _skill_merge_map2;
CREATE TEMP TABLE _skill_merge_map2 AS
WITH ranked AS (
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

-- learning_mappings: assorbi le collisioni (skill,module) poi repointa il resto
DELETE FROM sys.sys_skill_learning_mappings a
 USING _skill_merge_map2 m
 WHERE a.skill_learning_mapping_skill_id = m.loser
   AND EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings b
                WHERE b.skill_learning_mapping_module_id = a.skill_learning_mapping_module_id
                  AND b.skill_learning_mapping_skill_id = m.winner);
UPDATE sys.sys_skill_learning_mappings a
   SET skill_learning_mapping_skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.skill_learning_mapping_skill_id = m.loser;

-- taxonomy_edges: elimina l'edge che collasserebbe in self-loop, poi repointa
DELETE FROM sys.sys_skill_taxonomy_edges e
 WHERE COALESCE((SELECT winner FROM _skill_merge_map2 WHERE loser = e.skill_taxonomy_edge_parent_id),
                e.skill_taxonomy_edge_parent_id)
     = COALESCE((SELECT winner FROM _skill_merge_map2 WHERE loser = e.skill_taxonomy_edge_child_id),
                e.skill_taxonomy_edge_child_id)
   AND (e.skill_taxonomy_edge_parent_id IN (SELECT loser FROM _skill_merge_map2)
     OR e.skill_taxonomy_edge_child_id IN (SELECT loser FROM _skill_merge_map2));
UPDATE sys.sys_skill_taxonomy_edges e
   SET skill_taxonomy_edge_parent_id =
         COALESCE((SELECT winner FROM _skill_merge_map2 WHERE loser = e.skill_taxonomy_edge_parent_id),
                  e.skill_taxonomy_edge_parent_id),
       skill_taxonomy_edge_child_id =
         COALESCE((SELECT winner FROM _skill_merge_map2 WHERE loser = e.skill_taxonomy_edge_child_id),
                  e.skill_taxonomy_edge_child_id)
 WHERE e.skill_taxonomy_edge_parent_id IN (SELECT loser FROM _skill_merge_map2)
    OR e.skill_taxonomy_edge_child_id IN (SELECT loser FROM _skill_merge_map2);

-- user_skills: dedup difensivo su (user,skill) poi repoint
DELETE FROM sys.sys_user_skills a
 USING _skill_merge_map2 m
 WHERE a.user_skill_skill_id = m.loser
   AND EXISTS (SELECT 1 FROM sys.sys_user_skills b
                WHERE b.user_skill_user_id = a.user_skill_user_id
                  AND b.user_skill_skill_id = m.winner);
UPDATE sys.sys_user_skills a
   SET user_skill_skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.user_skill_skill_id = m.loser;

-- position_skill_requirements: dedup difensivo su (position,skill) poi repoint
DELETE FROM sys.sys_position_skill_requirements a
 USING _skill_merge_map2 m
 WHERE a.skill_id = m.loser
   AND EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements b
                WHERE b.position_id = a.position_id
                  AND b.skill_id = m.winner);
UPDATE sys.sys_position_skill_requirements a
   SET skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.skill_id = m.loser;

-- occupation_skill_requirements: unicità su esco_uri (non skill_id) → repoint diretto
UPDATE sys.sys_occupation_skill_requirements a
   SET occupation_skill_req_skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.occupation_skill_req_skill_id = m.loser;

-- user_skill_evidence: solo PK → repoint diretto
UPDATE sys.sys_user_skill_evidence a
   SET user_skill_evidence_skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.user_skill_evidence_skill_id = m.loser;

-- mentor_match_scores: unicità su natural_key (non skill_id) → repoint diretto
UPDATE sys.sys_mentor_match_scores a
   SET match_skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.match_skill_id = m.loser;

-- learning_gaps (FK NO ACTION, solo PK): senza repoint il DELETE dei loser fallisce
UPDATE sys.sys_learning_gaps a
   SET learning_gap_skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.learning_gap_skill_id = m.loser;

-- skill_aliases (FK CASCADE, solo PK): repoint per non perdere gli alias dei loser
UPDATE sys.sys_skill_aliases a
   SET skill_alias_skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.skill_alias_skill_id = m.loser;

-- position_skill_requirement_history (FK CASCADE, solo PK): repoint per non perdere lo storico
UPDATE sys.sys_position_skill_requirement_history a
   SET position_skill_requirement_history_skill_id = m.winner
  FROM _skill_merge_map2 m
 WHERE a.position_skill_requirement_history_skill_id = m.loser;

-- ---- ARCHIVE + DELETE ------------------------------------------------------
INSERT INTO audit.skill_dedup_archive
SELECT s.* FROM sys.sys_skills s JOIN _skill_merge_map2 m ON m.loser = s.skill_id;

DELETE FROM sys.sys_skills
 WHERE skill_id IN (SELECT loser FROM _skill_merge_map2);

-- ---- 2. EREDITÀ CATEGORIA + GRUPPO dall'archivio ---------------------------
UPDATE sys.sys_skills w
   SET skill_category_id = a.skill_category_id
  FROM audit.skill_dedup_archive a
 WHERE w.skill_category_id IS NULL
   AND a.skill_category_id IS NOT NULL
   AND COALESCE(w.skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
     = COALESCE(a.skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
   AND lower(trim(w.skill_name)) = lower(trim(a.skill_name));

UPDATE sys.sys_skills w
   SET skill_group_id = a.skill_group_id
  FROM audit.skill_dedup_archive a
 WHERE w.skill_group_id IS NULL
   AND a.skill_group_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.sys_skill_groups g WHERE g.skill_group_id = a.skill_group_id)
   AND COALESCE(w.skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
     = COALESCE(a.skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
   AND lower(trim(w.skill_name)) = lower(trim(a.skill_name));

-- ---- 3. UNIQUE INDEX -------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS sys_skills_natural_key_uq
  ON sys.sys_skills
     (COALESCE(skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
      lower(trim(skill_name)));

-- ---- Post-conditions (fail-loud) ------------------------------------------
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM sys.sys_skills
     GROUP BY skill_tenant_id, lower(trim(skill_name))
    HAVING count(*) > 1) q;
  IF n > 0 THEN
    RAISE EXCEPTION '000196: % gruppi skill duplicati ancora presenti', n;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes
                  WHERE schemaname = 'sys' AND indexname = 'sys_skills_natural_key_uq') THEN
    RAISE EXCEPTION '000196: unique index natural-key skill assente';
  END IF;

  -- invariante DENSE ripristinato: nessuna evidence punta a una skill senza categoria
  SELECT count(*) INTO n
    FROM sys.sys_user_skill_evidence e
    JOIN sys.sys_skills s ON s.skill_id = e.user_skill_evidence_skill_id
   WHERE s.skill_category_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION '000196: % evidence puntano ancora a skill senza categoria', n;
  END IF;

  RAISE NOTICE '000196: dedup ok, categorie ereditate, unique index ripristinato.';
END $$;
