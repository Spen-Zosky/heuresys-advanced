-- ============================================================================
-- 000211 — #73: deprecazione controllata degli scheme legacy 'NACE' / 'ATECO'
-- (decisione delegata da Enzo, S1028 2026-07-23: "decidi tu — sicuro e robusto")
--
-- EVIDENZA (misurata live S1028 + fonti ufficiali Eurostat KS-GQ-24-007 /
-- EUR-Lex NACE Rev 2.1 / ISTAT ATECO 2025):
--   · ATECO_2025 (canonico, mig 000109/000119 pipeline) = 22 sezioni A-V, 87
--     divisioni, 287 gruppi, 651 classi (+920 L5, +1290 L6 nazionali) —
--     PERFETTAMENTE conforme a NACE Rev 2.1; identico a NACE 2.1 fino al
--     4° digit PER COSTRUZIONE (⇒ il codice NACE di una riga ATECO_2025 è il
--     suo stesso codice troncato: il crosswalk non aggiunge informazione).
--   · scheme 'NACE' legacy = ibrido incoerente: divisione 45 (abolita in 2.1),
--     18 gruppi Rev-2 inesistenti in 2.1 (45.1-45.4, 41.1-41.2, 80.1-80.3,
--     90.0, 91.0, 96.0, 14.3, 25.7, 26.8, 61.3, 62.0, 78.3), sezione
--     extraterritoriale DUPLICATA (su U e V), classi L4 innestate da 2.1.
--   · scheme 'ATECO' legacy = import parziale L5-L6 (doc 000187), interamente
--     duplicato da ATECO_2025 L5-L6.
--   · REFERENZE BUSINESS: zero — unico consumer FK esterno
--     (sys_enterprise_typing_profiles) punta solo ad ATECO_2025; i 3.276 record
--     legacy vivono solo nei 5.730 crosswalk mapping interni (000112).
--
-- OPERAZIONE (reversibile): archivio in audit.* → delete mapping che toccano
-- righe legacy → delete righe legacy. ATECO_2025 resta l'unico scheme base.
--
-- COMPATIBILITÀ FULL-RERUN (catena migration ri-eseguita da zero, twice-run):
--   · 000112 (popolamento crosswalk): i JOIN su scheme='NACE' producono 0
--     righe e l'assert unresolved passa a vuoto — resta verde.
--   · vista sys.v_activity_classification_parent_orphans: la clausola-eccezione
--     ATECO L5 diventa vestigiale-innocua (0 righe la attivano).
--   · 000187 (parent FK NOT VALID): invariato, vale per ogni scheme.
--   · nessuna migration INSERISCE righe negli scheme legacy (provenivano dalla
--     pipeline brownfield/reference-sync) ⇒ il delete è stabile al re-run.
--
-- IDEMPOTENTE: archivi guardati per id; delete per scheme; post-condition
-- state-invariant (valgono anche su DB fresco dove il legacy non è mai esistito).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS audit;

-- archivio righe classificazione (stessa shape + timestamp)
CREATE TABLE IF NOT EXISTS audit.activity_classification_legacy_archive AS
  SELECT * FROM sys.sys_activity_classifications WHERE false;
ALTER TABLE audit.activity_classification_legacy_archive
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();

-- archivio mapping
CREATE TABLE IF NOT EXISTS audit.activity_class_mapping_legacy_archive AS
  SELECT * FROM sys.sys_activity_classification_mappings WHERE false;
ALTER TABLE audit.activity_class_mapping_legacy_archive
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();

-- 1) archivia i mapping che toccano una riga legacy (source O target)
INSERT INTO audit.activity_class_mapping_legacy_archive
SELECT m.*, now()
FROM sys.sys_activity_classification_mappings m
WHERE EXISTS (SELECT 1 FROM sys.sys_activity_classifications c
               WHERE c.activity_classification_id
                     IN (m.activity_class_mapping_source_id, m.activity_class_mapping_target_id)
                 AND c.activity_classification_scheme IN ('NACE','ATECO'))
  AND NOT EXISTS (SELECT 1 FROM audit.activity_class_mapping_legacy_archive x
                   WHERE x.activity_class_mapping_id = m.activity_class_mapping_id);

-- 2) archivia le righe legacy
INSERT INTO audit.activity_classification_legacy_archive
SELECT c.*, now()
FROM sys.sys_activity_classifications c
WHERE c.activity_classification_scheme IN ('NACE','ATECO')
  AND NOT EXISTS (SELECT 1 FROM audit.activity_classification_legacy_archive x
                   WHERE x.activity_classification_id = c.activity_classification_id);

-- 3) delete: prima i mapping (FK), poi le righe
DELETE FROM sys.sys_activity_classification_mappings m
 WHERE EXISTS (SELECT 1 FROM sys.sys_activity_classifications c
                WHERE c.activity_classification_id
                      IN (m.activity_class_mapping_source_id, m.activity_class_mapping_target_id)
                  AND c.activity_classification_scheme IN ('NACE','ATECO'));

DELETE FROM sys.sys_activity_classifications
 WHERE activity_classification_scheme IN ('NACE','ATECO');

-- 4) post-condition (fail-loud, state-invariant — verdi anche su DB fresco)
DO $$
DECLARE n int; orphan_maps int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_activity_classifications
   WHERE activity_classification_scheme IN ('NACE','ATECO');
  IF n > 0 THEN
    RAISE EXCEPTION '000211: % righe legacy NACE/ATECO ancora presenti', n;
  END IF;

  -- nessun mapping orfano (source/target senza riga classificazione)
  SELECT count(*) INTO orphan_maps
    FROM sys.sys_activity_classification_mappings m
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_activity_classifications c
                      WHERE c.activity_classification_id = m.activity_class_mapping_source_id)
      OR NOT EXISTS (SELECT 1 FROM sys.sys_activity_classifications c
                      WHERE c.activity_classification_id = m.activity_class_mapping_target_id);
  IF orphan_maps > 0 THEN
    RAISE EXCEPTION '000211: % mapping orfani dopo la deprecazione', orphan_maps;
  END IF;

  -- il canonico non deve essere stato toccato (informativo se DB fresco/vuoto)
  SELECT count(*) INTO n FROM sys.sys_activity_classifications
   WHERE activity_classification_scheme = 'ATECO_2025';
  RAISE NOTICE '000211: legacy NACE/ATECO deprecati (archivio in audit.*); ATECO_2025 rows=% (atteso 3257 su DB popolato)', n;
END $$;
