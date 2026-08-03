-- 000235_purge_legacy_tenant_contamination.sql
--
-- Bonifica della contaminazione da tenant legacy mai migrati (register #89).
--
-- Origine del difetto: il seed Goal-003 Wave-1 convoglio' TUTTI e quattro i
-- tenant legacy dentro RTL Bank ("all legacy tenants point to RTL_BANK_REFERENCE",
-- nota in brownfield.tenant_id_mappings, 2026-05-19) e la riconciliazione Wave-2
-- per SmartFood ed EcoNova non e' mai avvenuta. Il rebuild S950 rimosse gli
-- utenti di quei due tenant ma non i loro contenuti ne' i cataloghi.
--
-- CRITERIO DI TAGLIO, uno solo e verificabile: si rimuove cio' che nomina
-- un'entita' che in questo prodotto non esiste (SmartFood S.r.l., EcoNova) o che
-- e' una chiave-macchina di import (OLDDB::). NON si tocca cio' che e'
-- classificazione di riferimento reale: ESCO, ATECO, i CCNL di settore e le
-- sigle sindacali descrivono il mondo del lavoro, non un tenant fantasma.
-- Per lo stesso criterio restano i job_roles PROTO-*, che sono denominazioni
-- ESCO (il "cuoco dell'industria alimentare" sta accanto all'"analista
-- finanziario"), non prototipi generati per SmartFood.
--
-- Perimetro misurato sul DB vivo prima di scrivere (2026-08-03):
--   B  percorsi OLDDB::                              4.431
--   B  moduli OLDDB::                                  845
--   B  bande retributive OLDDB                          46
--   A  percorsi CRS-econova/smartfood                   60  (15 per slug/scope)
--   A  moduli CRS-econova/smartfood                     30
--   A  percorsi CRS-heuresys                            15  -> RIALLOCATI, non rimossi
--   C  goals senza soggetto                            435
--   C  goal_updates / goal_comments figli          723 / 349
--   C  OKR di dominio alimentare                         3
--   D  job families JF-SMA / JF-ECO                     11
--   D  definizioni KPI BP-SF / BP-EN                    42
--   E  record di lineage verso utenti rimossi          108
--
-- Il taglio dei goal e' stato verificato contro la FONTE, non per sospetto:
-- interrogato il legacy heuresys_platform, i tenant non-RTL hanno 328+104+9=441
-- goal e 30 titoli distinti; TUTTI i 435 goal senza soggetto in advanced hanno
-- un titolo presente in quell'insieme, zero non riconducibili. I 19 goal che
-- condividono un titolo generico MA hanno un soggetto reale restano fuori dal
-- criterio, che e' esattamente "senza soggetto".
--
-- Sicurezza FK verificata: 0 assegnazioni utente, 0 evidenze, 0 requisiti di
-- posizione e 0 iniziative formative puntano al materiale rimosso. Gli unici
-- riferimenti sono figli strutturali (158 mappature skill, 62 step), rimossi qui.
BEGIN;

-- ---------------------------------------------------------------- guard
-- Regge sul caso limite: se qualcuno avesse nel frattempo assegnato questo
-- materiale a una persona reale, la migrazione si ferma invece di cancellarlo.
DO $$
DECLARE
  v_ref bigint;
BEGIN
  SELECT count(*) INTO v_ref FROM (
    SELECT 1 FROM sys.sys_user_learning_assignments a
     WHERE a.user_learning_assignment_path_id IN (
             SELECT learning_path_id FROM sys.sys_learning_paths
              WHERE learning_path_code LIKE 'OLDDB::%'
                 OR learning_path_code ~ '^CRS-(econova|smartfood)-')
        OR a.user_learning_assignment_module_id IN (
             SELECT learning_module_id FROM sys.sys_learning_modules
              WHERE learning_module_code LIKE 'OLDDB::%'
                 OR learning_module_code ~ '^CRS-(econova|smartfood)-')
    UNION ALL
    SELECT 1 FROM sys.sys_user_learning_evidence e
     WHERE e.user_learning_evidence_module_id IN (
             SELECT learning_module_id FROM sys.sys_learning_modules
              WHERE learning_module_code LIKE 'OLDDB::%'
                 OR learning_module_code ~ '^CRS-(econova|smartfood)-')
    UNION ALL
    SELECT 1 FROM sys.sys_goals g
     WHERE g.goal_subject_user_id IS NOT NULL
       AND g.goal_parent_goal_id IN (SELECT goal_id FROM sys.sys_goals
                                      WHERE goal_subject_user_id IS NULL)
  ) x;

  IF v_ref > 0 THEN
    RAISE EXCEPTION
      'Bonifica #89 interrotta: % riferimenti di persone reali puntano al '
      'materiale da rimuovere. Il presupposto "FK-safe" non vale piu'': '
      'ricontrollare prima di procedere.', v_ref;
  END IF;
END $$;

-- ------------------------------------------------- CLASSE B — chiavi macchina
-- `OLDDB::course_enrollments::<uuid>` come CODICE di un percorso formativo e'
-- un errore di categoria: un'iscrizione non e' un corso. Vale anche per RTL.
DELETE FROM sys.sys_skill_learning_mappings
 WHERE skill_learning_mapping_module_id IN (
   SELECT learning_module_id FROM sys.sys_learning_modules
    WHERE learning_module_code LIKE 'OLDDB::%');

DELETE FROM sys.sys_learning_path_steps
 WHERE learning_path_step_module_id IN (
         SELECT learning_module_id FROM sys.sys_learning_modules
          WHERE learning_module_code LIKE 'OLDDB::%')
    OR learning_path_step_path_id IN (
         SELECT learning_path_id FROM sys.sys_learning_paths
          WHERE learning_path_code LIKE 'OLDDB::%');

DELETE FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'OLDDB::%';
DELETE FROM sys.sys_learning_paths   WHERE learning_path_code   LIKE 'OLDDB::%';
DELETE FROM sys.sys_compensation_bands WHERE compensation_band_code LIKE 'OLDDB%';

-- --------------------------------------------- CLASSE A — slug di tenant assenti
DELETE FROM sys.sys_skill_learning_mappings
 WHERE skill_learning_mapping_module_id IN (
   SELECT learning_module_id FROM sys.sys_learning_modules
    WHERE learning_module_code ~ '^CRS-(econova|smartfood)-');

DELETE FROM sys.sys_learning_path_steps
 WHERE learning_path_step_module_id IN (
         SELECT learning_module_id FROM sys.sys_learning_modules
          WHERE learning_module_code ~ '^CRS-(econova|smartfood)-')
    OR learning_path_step_path_id IN (
         SELECT learning_path_id FROM sys.sys_learning_paths
          WHERE learning_path_code ~ '^CRS-(econova|smartfood)-');

DELETE FROM sys.sys_learning_modules WHERE learning_module_code ~ '^CRS-(econova|smartfood)-';
DELETE FROM sys.sys_learning_paths   WHERE learning_path_code   ~ '^CRS-(econova|smartfood)-';

-- Il materiale `CRS-heuresys-*` non e' spazzatura: e' del tenant Heuresys System,
-- che esiste. Era solo nel tenant sbagliato. Si sposta, non si cancella.
UPDATE sys.sys_learning_paths
   SET learning_path_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies
                                   WHERE tenant_code = 'HEURESYS'),
       updated_at = now()
 WHERE learning_path_code ~ '^CRS-heuresys-'
   AND learning_path_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies
                                   WHERE tenant_code = 'RTL_BANK');

-- ------------------------------------ CLASSE C — business di tenant estranei
DELETE FROM sys.sys_goal_updates
 WHERE update_goal_id IN (SELECT goal_id FROM sys.sys_goals WHERE goal_subject_user_id IS NULL);

DELETE FROM sys.sys_goal_comments
 WHERE comment_goal_id IN (SELECT goal_id FROM sys.sys_goals WHERE goal_subject_user_id IS NULL);

DELETE FROM sys.sys_goals WHERE goal_subject_user_id IS NULL;

-- I 3 OKR di dominio alimentare: qui il criterio strutturale non discrimina
-- (tutti e 20 gli OKR hanno owner NULL), quindi il taglio e' per contenuto ed
-- e' verificabile a occhio riga per riga, essendo tre.
DELETE FROM sys.sys_okrs
 WHERE okr_objective IN ('Reduce packaging waste by 30%',
                         'Implement IoT cold chain monitoring',
                         'Achieve ISO 22000 certification');

-- ------------------------------------------- CLASSE D — cataloghi globali
-- Questi nominano due aziende che non esistono in questo prodotto: la
-- descrizione stessa recita "Famiglia professionale per SmartFood S.r.l.".
DELETE FROM sys.sys_reference_translations
 WHERE entity_table = 'sys_job_families'
   AND entity_id IN (SELECT job_family_id FROM sys.sys_job_families
                      WHERE job_family_code ~ '^JF-(SMA|ECO)-');

DELETE FROM sys.sys_job_families WHERE job_family_code ~ '^JF-(SMA|ECO)-';
DELETE FROM sys.sys_kpi_definitions WHERE kpi_definition_code ~ '^BP-(SF|EN)-';

-- ------------------------------------------- CLASSE E — residui di pipeline
-- Tracciano un import verso utenti che il rebuild S950 ha rimosso: puntano nel
-- vuoto e sporcano ogni analisi di provenienza.
DELETE FROM sys.sys_source_lineage_records
 WHERE source_lineage_metadata::text ~* '(smartfood|econova)';

COMMIT;
