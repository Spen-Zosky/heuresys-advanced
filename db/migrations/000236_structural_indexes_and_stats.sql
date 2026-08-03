-- 000236_structural_indexes_and_stats.sql
--
-- Bonifica strutturale del DBMS (register #91): i 9 indici che servono davvero,
-- la validazione dell'unico vincolo mai validato, le statistiche mancanti.
--
-- IL NUMERO GREZZO MENTE. Le chiavi esterne senza indice sono 248, ma:
--   112  insistono su colonne INTERAMENTE VUOTE -> indicizzarle non serve a
--        nulla e rallenta ogni scrittura
--    99  stanno su tabelle sotto le 1000 righe  -> il pianificatore preferira'
--        comunque la scansione sequenziale
--    28  sono prive di statistiche               -> si rivalutano dopo ANALYZE
--     9  vanno create davvero                    -> sono questi
-- La prova che creare tutti e 248 avrebbe peggiorato il database e' gia' in
-- casa: 40 degli indici esistenti non sono mai stati usati una sola volta.
--
-- Nota sull'esecuzione: sul database di produzione questi indici sono stati
-- creati a mano con CREATE INDEX CONCURRENTLY, che non gira dentro una
-- transazione e non blocca le scritture. Qui sono in forma normale e
-- idempotente: su produzione questa migrazione e' un no-op (gli indici ci sono
-- gia'), su un database ricostruito da zero li crea in un istante, perche' le
-- tabelle sono appena state popolate e nessuno le sta usando.
BEGIN;

-- ---------------------------------------------------------------- BLOCCO A
-- Criterio: chiave esterna senza indice, su tabella con almeno 1000 righe, su
-- colonna che ha davvero dei valori.
CREATE INDEX IF NOT EXISTS ix_reward_gate_results_reward_gate_result_evaluator_user_id
  ON sys.sys_reward_gate_results (reward_gate_result_evaluator_user_id);
CREATE INDEX IF NOT EXISTS ix_reward_gate_results_reward_gate_result_tenant_id
  ON sys.sys_reward_gate_results (reward_gate_result_tenant_id);
CREATE INDEX IF NOT EXISTS ix_reward_gates_reward_gate_catalog_id
  ON sys.sys_reward_gates (reward_gate_catalog_id);
CREATE INDEX IF NOT EXISTS ix_reward_gates_reward_gate_tenant_id
  ON sys.sys_reward_gates (reward_gate_tenant_id);
CREATE INDEX IF NOT EXISTS ix_user_learning_assignments_user_learning_assignment_assigned_by
  ON sys.sys_user_learning_assignments (user_learning_assignment_assigned_by);
CREATE INDEX IF NOT EXISTS ix_position_skill_requirements_created_by
  ON sys.sys_position_skill_requirements (created_by);
-- Nome gia' troncato ai 63 byte che PostgreSQL impone: scriverlo per esteso
-- funzionerebbe (il troncamento e' deterministico) ma lascerebbe il file e il
-- catalogo con due nomi diversi per lo stesso indice.
CREATE INDEX IF NOT EXISTS ix_position_skill_requirements_position_skill_requirement_tenan
  ON sys.sys_position_skill_requirements (position_skill_requirement_tenant_id);
CREATE INDEX IF NOT EXISTS ix_user_skills_user_skill_verified_by_user_id
  ON sys.sys_user_skills (user_skill_verified_by_user_id);
CREATE INDEX IF NOT EXISTS ix_learning_modules_created_by
  ON sys.sys_learning_modules (created_by);

-- ---------------------------------------------------------------- BLOCCO C
-- Un vincolo NOT VALID controlla le righe nuove ma non garantisce le vecchie:
-- e' una promessa a meta'. Verificato che gli orfani sono zero, quindi la
-- validazione non puo' fallire. Condizionata perche' VALIDATE su un vincolo
-- gia' valido e' un no-op ma su uno inesistente e' un errore.
DO $val$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'sys_activity_classifications_parent_fk'
                AND NOT convalidated) THEN
    ALTER TABLE sys.sys_activity_classifications
      VALIDATE CONSTRAINT sys_activity_classifications_parent_fk;
  END IF;
END;
$val$;

COMMIT;

-- ---------------------------------------------------------------- BLOCCO D
-- Sei tabelle popolate che non erano mai state analizzate: senza statistiche il
-- pianificatore sceglie il percorso a caso. Fuori dalla transazione: ANALYZE
-- non ha bisogno di atomicita' e su un set grande e' meglio non tenerne il lock.
ANALYZE sys.sys_teams;
ANALYZE sys.sys_surveys;
ANALYZE sys.sys_gdpr_requests;
ANALYZE sys.sys_predictive_models;
ANALYZE sys.sys_survey_templates;
ANALYZE sys.sys_whistleblowing_reports;
