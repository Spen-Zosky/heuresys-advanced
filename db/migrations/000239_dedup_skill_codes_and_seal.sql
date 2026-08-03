-- 000239_dedup_skill_codes_and_seal.sql
--
-- Terzo e ultimo sigillo di unicita' (register #91, blocco E): i codici delle
-- competenze.
--
-- Due codici duplicati su 14.041: COMP::02c2f3c8… e COMP::7780f0ba…, ciascuno
-- in due copie. Referenziati da 12 chiavi esterne in 11 tabelle, ragione per
-- cui la 000237 aveva lasciato questo vincolo fuori invece di far fallire la
-- migrazione. Misurati uno per uno, i riferimenti si distribuiscono cosi':
--
--   copia          riferimenti a persone   riferimenti di catalogo
--   piu' vecchia            0               1 (il proprio embedding)
--   piu' recente         3 e 45             1 (il proprio embedding)
--
-- Il rapporto e' l'INVERSO di quello dei percorsi formativi (000237), dove le
-- assegnazioni stavano tutte sulla copia piu' vecchia. Qui la copia viva e'
-- quella recente: e' lei che compare nelle competenze delle persone, nei
-- requisiti di posizione, negli scarti formativi e nei punteggi di mentoring.
-- Quindi si tiene la copia REFERENZIATA, non la piu' vecchia — la regola e'
-- "tieni quella che qualcuno sta usando", e va scritta come tale, perche' una
-- regola per data avrebbe cancellato 48 riferimenti reali.
BEGIN;

CREATE TEMP TABLE _skill_scartate ON COMMIT DROP AS
WITH riferimenti AS (
  SELECT s.skill_id, s.skill_code,
         (SELECT count(*) FROM sys.sys_user_skills x WHERE x.user_skill_skill_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_position_skill_requirements x WHERE x.skill_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_position_skill_requirement_history x WHERE x.position_skill_requirement_history_skill_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_user_skill_evidence x WHERE x.user_skill_evidence_skill_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_learning_gaps x WHERE x.learning_gap_skill_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_mentor_match_scores x WHERE x.match_skill_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_skill_taxonomy_edges x WHERE x.skill_taxonomy_edge_parent_id = s.skill_id OR x.skill_taxonomy_edge_child_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_skill_aliases x WHERE x.skill_alias_skill_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_skill_learning_mappings x WHERE x.skill_learning_mapping_skill_id = s.skill_id)
       + (SELECT count(*) FROM sys.sys_occupation_skill_requirements x WHERE x.occupation_skill_req_skill_id = s.skill_id) AS usi
  FROM sys.sys_skills s
  WHERE s.skill_code IN (SELECT skill_code FROM sys.sys_skills GROUP BY 1 HAVING count(*) > 1)
)
SELECT skill_id FROM (
  SELECT skill_id, row_number() OVER (PARTITION BY skill_code
                                      ORDER BY usi DESC, created_at NULLS LAST, skill_id) AS rn
  FROM riferimenti JOIN sys.sys_skills USING (skill_id, skill_code)
) x WHERE x.rn > 1;

-- Guardia: la copia scartata deve essere quella inerte. Se porta anche un solo
-- riferimento a una persona, la regola "tieni quella in uso" non ha discriminato
-- e cancellare toglierebbe una competenza a qualcuno.
DO $$
DECLARE v_vivi bigint;
BEGIN
  SELECT (SELECT count(*) FROM sys.sys_user_skills x JOIN _skill_scartate d ON d.skill_id = x.user_skill_skill_id)
       + (SELECT count(*) FROM sys.sys_position_skill_requirements x JOIN _skill_scartate d ON d.skill_id = x.skill_id)
       + (SELECT count(*) FROM sys.sys_user_skill_evidence x JOIN _skill_scartate d ON d.skill_id = x.user_skill_evidence_skill_id)
       + (SELECT count(*) FROM sys.sys_learning_gaps x JOIN _skill_scartate d ON d.skill_id = x.learning_gap_skill_id)
       + (SELECT count(*) FROM sys.sys_mentor_match_scores x JOIN _skill_scartate d ON d.skill_id = x.match_skill_id)
    INTO v_vivi;
  IF v_vivi > 0 THEN
    RAISE EXCEPTION
      'Dedup competenze interrotto: % riferimenti vivi sulla copia da rimuovere.',
      v_vivi;
  END IF;
END $$;

-- Le traduzioni vanno via CON l'entita', non dopo. La 000235 aveva rimosso i
-- KPI lasciando appese 84 traduzioni, e a segnalarlo fu la sentinella
-- v_reference_translation_orphans passando da 0 a 84: la stessa svista, ripetuta
-- qui, avrebbe lasciato altre 4 righe orfane.
DELETE FROM sys.sys_reference_translations t
 USING _skill_scartate d
 WHERE t.entity_table = 'sys_skills' AND t.entity_id = d.skill_id;

DELETE FROM sys.sys_skill_embeddings e USING _skill_scartate d WHERE e.skill_id = d.skill_id;
DELETE FROM sys.sys_skills s USING _skill_scartate d WHERE s.skill_id = d.skill_id;

-- Sanatoria: qualunque traduzione di competenza rimasta senza entita', da
-- questa migrazione o da una precedente. Il criterio e' la sentinella stessa,
-- non un elenco scritto a mano, quindi resta corretto anche se il numero cambia.
DELETE FROM sys.sys_reference_translations t
 WHERE t.reference_translation_id IN (
   SELECT o.reference_translation_id FROM sys.v_reference_translation_orphans o
    WHERE o.entity_table = 'sys_skills');

DO $seal$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_skills_code_uq') THEN
    ALTER TABLE sys.sys_skills ADD CONSTRAINT sys_skills_code_uq UNIQUE (skill_code);
  END IF;
END;
$seal$;

COMMIT;
