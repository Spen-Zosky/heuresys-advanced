-- ============================================================================
-- 000303 — #168: la storia delle approvazioni sopravvive alla cancellazione
--          dell'approvatore (backfill dei tombstone + sentinella permanente)
-- ============================================================================
-- CENSIMENTO (misurato live 2026-08-10, S1053 — query pg_constraint):
--   262 FK referenziano sys.sys_users: 190 SET NULL · 62 CASCADE · 9 RESTRICT · 1 NO ACTION.
--   Decisione per famiglia (piano docs/superpowers/plans/2026-08-10-batch-p1-s1053.md V2):
--     (a) STORIA/TRACCIA  → 1 sola FK: sys_approval_step_approver_fk — CAMBIATA in
--         SET NULL + snapshot (emenda alla 000132, ADR-0035: si emenda il file che crea);
--     (b) POSSESSO PERSONALE (38) → CASCADE legittimo: il dato di cui la persona e'
--         il soggetto se ne va con lei;
--     (c) GIUNZIONE/APPARTENENZA (17: 10 satelliti auth I7 + 7 membership) → CASCADE legittimo;
--     (d) DUBBIE (6: kpi_targets/measurements/assessment_results, reward_gates,
--         consents, timeline_events) → CASCADE CONFERMATO con motivo: su kpi_targets
--         SET NULL violerebbe il CHECK "position OR user NOT NULL" (000015); le altre
--         sono possesso o timeline propria (l'audit vero sta nello schema audit, RESTRICT).
--   L'incidente che ha aperto la voce: mig 000295 (rimozione admin@heuresys.com)
--   cancello' a cascata 3 passi APPLIED del 2023/2024/2025 — riparati dal seed,
--   causa rimossa QUI.
--
-- Questa migrazione: (1) backfill dei due snapshot per le righe esistenti;
-- (2) vista sentinella sys.v_history_cascade_to_users (attesa: 0 righe) che
-- segnala QUALUNQUE FK CASCADE verso sys_users fuori dall'allowlist esplicita;
-- (3) selftest della sentinella; (4) auto-verifiche.
--
-- ROLLBACK dichiarato (regola 4 del metodo di bonifica):
--   -- gli snapshot backfillati si riconoscono perche' uguali all'email viva:
--   -- UPDATE sys.sys_approval_steps s SET approval_step_approver_snapshot = NULL
--   --   FROM sys.sys_users u WHERE u.user_id = s.approval_step_approver_user_id
--   --    AND s.approval_step_approver_snapshot = u.user_email;
--   -- (idem per decided_by); DROP VIEW sys.v_history_cascade_to_users;
--   -- il ripristino CASCADE della FK e' il rollback della 000132 emendata, non di questa.

-- ----------------------------------------------------------------------------
-- 1. Backfill dei tombstone (idempotente: solo dove NULL, solo da utenti vivi)
-- ----------------------------------------------------------------------------
DO $backfill$
DECLARE
  v_prima_appr  int;
  v_prima_dec   int;
  v_dopo_appr   int;
  v_totale      int;
BEGIN
  -- misura PRIMA (guardia rivalutata a ogni esecuzione, mai ereditata)
  SELECT count(*) INTO v_totale FROM sys.sys_approval_steps;
  SELECT count(*) INTO v_prima_appr FROM sys.sys_approval_steps
   WHERE approval_step_approver_user_id IS NOT NULL AND approval_step_approver_snapshot IS NULL;
  SELECT count(*) INTO v_prima_dec FROM sys.sys_approval_steps
   WHERE approval_step_decided_by IS NOT NULL AND approval_step_decided_by_snapshot IS NULL;

  UPDATE sys.sys_approval_steps s
     SET approval_step_approver_snapshot = u.user_email
    FROM sys.sys_users u
   WHERE u.user_id = s.approval_step_approver_user_id
     AND s.approval_step_approver_snapshot IS NULL;

  UPDATE sys.sys_approval_steps s
     SET approval_step_decided_by_snapshot = u.user_email
    FROM sys.sys_users u
   WHERE u.user_id = s.approval_step_decided_by
     AND s.approval_step_decided_by_snapshot IS NULL;

  -- post-condizioni: (a) cio' che doveva cambiare e' cambiato (nessun approver
  -- vivo senza snapshot); (b) cio' che NON doveva cambiare e' invariato (conteggio
  -- righe identico: il backfill non crea e non cancella passi).
  SELECT count(*) INTO v_dopo_appr FROM sys.sys_approval_steps
   WHERE approval_step_approver_user_id IS NOT NULL AND approval_step_approver_snapshot IS NULL;
  IF v_dopo_appr <> 0 THEN
    RAISE EXCEPTION '000303: % approver vivi ancora senza snapshot dopo il backfill', v_dopo_appr;
  END IF;
  IF (SELECT count(*) FROM sys.sys_approval_steps) <> v_totale THEN
    RAISE EXCEPTION '000303: il backfill ha alterato il numero di passi (% attesi)', v_totale;
  END IF;
  RAISE NOTICE '000303 backfill: % snapshot approver + % snapshot decider scritti su % passi',
    v_prima_appr, v_prima_dec, v_totale;
END;
$backfill$;

-- ----------------------------------------------------------------------------
-- 2. Sentinella: FK CASCADE verso sys_users FUORI dall'allowlist = allarme.
--    Elenco esplicito (61 nomi, censimento 2026-08-10), mai un carattere jolly:
--    una FK CASCADE nuova verso sys_users accende la vista finche' qualcuno non
--    la aggiunge QUI, consapevolmente. db_health.py la scopre da se' (v_*, 0 attesa).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_history_cascade_to_users AS
SELECT con.conname   AS constraint_name,
       src.relname   AS source_table,
       att.attname   AS source_column
  FROM pg_constraint con
  JOIN pg_class src ON src.oid = con.conrelid
  JOIN pg_class tgt ON tgt.oid = con.confrelid
  JOIN pg_namespace n ON n.oid = tgt.relnamespace
  JOIN unnest(con.conkey) WITH ORDINALITY k(attnum, ord) ON true
  JOIN pg_attribute att ON att.attrelid = src.oid AND att.attnum = k.attnum
 WHERE con.contype = 'f'
   AND tgt.relname = 'sys_users'
   AND n.nspname = 'sys'
   AND con.confdeltype = 'c'
   AND con.conname NOT IN (
    'sys_assessments_assessment_subject_user_id_fkey',
    'sys_auth_identities_auth_identity_user_id_fkey',
    'sys_auth_mfa_exemption_eligible__auth_mfa_eligible_user_id_fkey',
    'sys_auth_mfa_exemptions_user_fk',
    'sys_auth_mfa_factors_auth_mfa_factor_user_id_fkey',
    'sys_auth_mfa_otp_challenges_auth_mfa_otp_user_id_fkey',
    'sys_auth_mfa_recovery_codes_recovery_code_user_id_fkey',
    'sys_auth_password_reset_tokens_auth_password_reset_user_id_fkey',
    'sys_auth_refresh_tokens_auth_refresh_token_user_id_fkey',
    'sys_auth_sessions_auth_session_user_id_fkey',
    'sys_behavioral_assessments_behavioral_assessment_user_id_fkey',
    'sys_compensation_recommendat_compensation_recommendation__fkey1',
    'sys_employee_position_fit_sc_employee_position_fit_score__fkey1',
    'sys_flight_risk_scores_flight_risk_score_user_id_fkey',
    'sys_gap_analysis_results_gap_analysis_result_user_id_fkey',
    'sys_gap_closure_plans_gap_closure_plan_user_id_fkey',
    'sys_inbox_notifications_notification_user_id_fkey',
    'sys_kpi_assessment_results_kpi_assessment_result_user_id_fkey',
    'sys_kpi_measurements_kpi_measurement_user_id_fkey',
    'sys_kpi_targets_kpi_target_user_id_fkey',
    'sys_learning_gaps_learning_gap_user_id_fkey',
    'sys_npref_user_fk',
    'sys_person_evidence_records_person_evidence_record_user_id_fkey',
    'sys_process_participants_user_fk',
    'sys_readiness_scores_readiness_score_user_id_fkey',
    'sys_reward_gates_reward_gate_user_id_fkey',
    'sys_skill_gap_scores_skill_gap_score_user_id_fkey',
    'sys_succession_readiness_scor_succession_readiness_score_u_fkey',
    'sys_succession_scores_succession_score_user_id_fkey',
    'sys_successor_candidates_successor_candidate_user_id_fkey',
    'sys_survey_assignment_user_fk',
    'sys_talent_scores_talent_score_user_id_fkey',
    'sys_team_members_team_member_user_id_fkey',
    'sys_user_addresses_user_address_user_id_fkey',
    'sys_user_assessment_evidence_user_assessment_evidence_user_fkey',
    'sys_user_auth_roles_user_auth_role_user_id_fkey',
    'sys_user_bank_details_user_bank_user_id_fkey',
    'sys_user_career_plans_user_career_plan_user_id_fkey',
    'sys_user_certifications_user_certification_user_id_fkey',
    'sys_user_consents_consent_user_id_fkey',
    'sys_user_contracts_user_contract_user_id_fkey',
    'sys_user_demographics_user_demographics_user_id_fkey',
    'sys_user_documents_user_document_user_id_fkey',
    'sys_user_education_records_user_education_record_user_id_fkey',
    'sys_user_employment_user_employment_user_id_fkey',
    'sys_user_family_members_user_family_member_user_id_fkey',
    'sys_user_identity_documents_user_identity_document_user_id_fkey',
    'sys_user_kpi_evidence_user_kpi_evidence_user_id_fkey',
    'sys_user_learning_assignments_user_learning_assignment_use_fkey',
    'sys_user_learning_evidence_user_learning_evidence_user_id_fkey',
    'sys_user_pay_slips_user_pay_slip_user_id_fkey',
    'sys_user_preferences_user_preference_user_id_fkey',
    'sys_user_professional_experiences_user_prof_exp_user_id_fkey',
    'sys_user_profile_embeddings_user_id_fkey',
    'sys_user_profiles_user_profile_user_id_fkey',
    'sys_user_skill_evidence_user_skill_evidence_user_id_fkey',
    'sys_user_skills_user_fk',
    'sys_user_target_positions_user_target_position_user_id_fkey',
    'sys_user_timeline_events_user_timeline_event_user_id_fkey',
    'sys_variable_pay_calculations_variable_pay_calculation_use_fkey',
    'sys_webauthn_cred_user_fk'
   );

COMMENT ON VIEW sys.v_history_cascade_to_users IS
  '#168: FK ON DELETE CASCADE verso sys_users fuori dall''allowlist dei 61 possessi/'
  'membership legittimi (censimento 2026-08-10). Attesa 0 righe: una riga qui e'' '
  'una colonna-traccia che una cancellazione utente distruggerebbe in silenzio. '
  'Una FK CASCADE nuova e legittima va aggiunta all''allowlist in 000303, consapevolmente.';

-- ----------------------------------------------------------------------------
-- 3. Selftest della sentinella: deve saper diventare rossa (regola 5).
--    Tabella-esca con FK CASCADE fuori allowlist -> la vista si accende ->
--    l'esca sparisce -> la vista torna a 0. Tutto nella stessa transazione.
-- ----------------------------------------------------------------------------
DO $selftest$
DECLARE
  v_accesa int;
  v_spenta int;
BEGIN
  CREATE TABLE sys._st000303_esca (
    esca_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    esca_user_id uuid,
    CONSTRAINT _st000303_esca_cascade_fk FOREIGN KEY (esca_user_id)
      REFERENCES sys.sys_users(user_id) ON DELETE CASCADE
  );
  SELECT count(*) INTO v_accesa FROM sys.v_history_cascade_to_users
   WHERE constraint_name = '_st000303_esca_cascade_fk';
  DROP TABLE sys._st000303_esca;
  SELECT count(*) INTO v_spenta FROM sys.v_history_cascade_to_users
   WHERE constraint_name = '_st000303_esca_cascade_fk';
  IF v_accesa <> 1 OR v_spenta <> 0 THEN
    RAISE EXCEPTION '000303 SELFTEST FALLITO: la sentinella non vede la FK esca (accesa=%, spenta=%)',
      v_accesa, v_spenta;
  END IF;
  RAISE NOTICE '000303 selftest sentinella: OK (si accende sull''esca, si spegne alla rimozione)';
END;
$selftest$;

-- ----------------------------------------------------------------------------
-- 4. Auto-verifiche finali (annullano la transazione se una non torna)
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE
  v_cnt int;
BEGIN
  -- la FK dell'approvatore e' SET NULL
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conname = 'sys_approval_step_approver_fk' AND confdeltype = 'n';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION '000303: sys_approval_step_approver_fk non e'' SET NULL';
  END IF;
  -- la colonna e' nullable
  IF EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = 'sys.sys_approval_steps'::regclass
                AND attname = 'approval_step_approver_user_id' AND attnotnull) THEN
    RAISE EXCEPTION '000303: approval_step_approver_user_id e'' ancora NOT NULL';
  END IF;
  -- la sentinella e' a zero (funziona su qualunque DB della catena, anche vuoto)
  SELECT count(*) INTO v_cnt FROM sys.v_history_cascade_to_users;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION '000303: la sentinella vede % FK CASCADE fuori allowlist', v_cnt;
  END IF;
END;
$verify$;
