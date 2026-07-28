-- ============================================================================
-- storia36 C4 — RESET delle righe seminate dalla v1, per il reseed v2 deciso
-- dopo la review adversarial a 3 lenti (FAIL x3, 4 BLOCKER + 11 MAJOR).
--
-- Cancella ESCLUSIVAMENTE cio' che porta il marcatore `storia36 = C4` e
-- ripristina allo stato precedente gli aggiornamenti fatti su righe legacy
-- (azioni di chiusura lacuna e piani), che erano marcati con la stessa chiave.
-- Nessuna riga organica viene toccata: il marcatore e' la prova di paternita'.
--
-- Ordine imposto dalle FK: le evidenze puntano ai moduli con ON DELETE RESTRICT,
-- quindi i moduli d'aula si eliminano per ultimi.
--
-- Idempotente: alla seconda corsa cancella 0 righe.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_n   bigint;
  v_tot bigint := 0;
BEGIN
  -- ripristino degli UPDATE su righe legacy (prima delle DELETE: leggono i marcatori)
  UPDATE sys.sys_gap_closure_actions
     SET gap_closure_action_status = 'PROPOSED',
         gap_closure_action_due_date = NULL,
         gap_closure_action_owner_user_id = NULL,
         gap_closure_action_payload = gap_closure_action_payload - 'storia36'
   WHERE gap_closure_action_payload->>'storia36' = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset C4: azioni di chiusura riportate a PROPOSED %', v_n;

  UPDATE sys.sys_gap_closure_plans
     SET gap_closure_plan_target_completion_date = NULL,
         gap_closure_plan_metadata = gap_closure_plan_metadata - 'storia36'
   WHERE gap_closure_plan_metadata->>'storia36' = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset C4: piani riportati senza data obiettivo % (include la riga HEURESYS scritta per errore)', v_n;

  DELETE FROM sys.sys_user_learning_evidence
   WHERE user_learning_evidence_metadata->>'storia36' = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset C4: evidenze eliminate %', v_n;

  DELETE FROM sys.sys_user_learning_assignments
   WHERE user_learning_assignment_metadata->>'storia36' = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset C4: iscrizioni eliminate %', v_n;

  DELETE FROM sys.sys_training_initiatives
   WHERE training_initiative_metadata->>'storia36' = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset C4: iniziative eliminate %', v_n;

  DELETE FROM sys.sys_user_certifications
   WHERE user_certification_metadata->>'storia36' = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset C4: rinnovi eliminati %', v_n;

  DELETE FROM sys.sys_skill_learning_mappings
   WHERE skill_learning_mapping_metadata->>'storia36' = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset C4: mapping competenza eliminati %', v_n;

  DELETE FROM sys.sys_learning_modules
   WHERE learning_module_metadata->>'storia36' = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset C4: moduli d''aula eliminati %', v_n;

  DELETE FROM staging.storia36_runs WHERE cluster_code = 'C4';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'reset C4: corse rimosse dal registro %', v_n;

  RAISE NOTICE 'reset C4 completato: % righe toccate', v_tot;
END $$;

COMMIT;
