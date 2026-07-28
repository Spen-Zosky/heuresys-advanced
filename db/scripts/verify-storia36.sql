-- ============================================================================
-- storia36 — batteria GLOBALE di coerenza (G1..G6)
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md
-- Derivazione delle colonne e delle regole: .storia36/analysis/date-columns.md
-- (classificazione 513 colonne) + .storia36/analysis/shapes-g2-g4.md.
--
-- Uso:
--   psql -v ON_ERROR_STOP=1 -f db/scripts/verify-storia36.sql
--     [-v window_end=YYYY-MM-DD]   finestra: default = FINE MESE CORRENTE
--                                  (il DB è produzione VIVA: i dati organici del
--                                  mese in corso non sono violazioni; la storia
--                                  seminata arriva al più a fine mese corrente)
--     [-v selftest=1]              esegue anche i SELFTEST di falsificabilità
--
-- Architettura: ogni check è una funzione staging.storia36_check_gN() che
-- RAISE EXCEPTION su violazione (mai fotografie: solo proprietà, finestra a
-- parametro). Il runner finale esegue TUTTI i check, stampa [OK]/[ROSSO] per
-- ognuno e fallisce alla fine se almeno uno è rosso — così l'entrypoint
-- storia36.sh ottiene il quadro completo, non il primo errore.
-- ============================================================================

\set ON_ERROR_STOP on
\if :{?selftest}
\else
\set selftest 0
\endif
\if :{?window_end}
\else
\set window_end DEFAULT
\endif

SELECT set_config('storia36.window_start', '2023-08-01', false);
SELECT set_config('storia36.window_end',
  CASE WHEN :'window_end' = 'DEFAULT'
       THEN to_char((date_trunc('month', now()) + interval '1 month - 1 day')::date, 'YYYY-MM-DD')
       ELSE :'window_end'
  END, false);

-- ----------------------------------------------------------------------------
-- G1 — nessun record di BUSINESS oltre la finestra (solo upper bound: le date
-- lifecycle/anagrafiche precedono legittimamente il 2023-08-01 — contratti dal
-- 2003, istruzione dal 1988, nascite dal 1964). Le 70 colonne BUSINESS_DATE
-- derivano dalla classificazione completa delle 513 colonne data/timestamptz
-- (.storia36/analysis/date-columns.md): AUDIT_TS e FUTURE_OK escluse con motivo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_g1(p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  r record;
  v_cnt bigint;
  v_bad text := '';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('sys_assessments','assessment_period_start'),
      ('sys_attendance','attendance_date'),
      ('sys_attendance','attendance_validated_at'),
      ('sys_blueprint_activations','blueprint_activation_effective_from'),
      ('sys_bonus_pools','bonus_pool_period_start'),
      ('sys_compensation_recommendations','compensation_recommendation_period_start'),
      ('sys_compensation_recommendations','compensation_recommendation_period_end'),
      ('sys_continuous_feedback','feedback_acknowledged_at'),
      ('sys_engagement_action_plans','action_plan_completed_at'),
      ('sys_engagement_feedback','feedback_reviewed_at'),
      ('sys_engagement_survey_responses','response_started_at'),
      ('sys_engagement_survey_responses','response_completed_at'),
      ('sys_feedback_360_responses','response_completed_at'),
      ('sys_goal_check_ins','check_in_date'),
      ('sys_goal_milestones','milestone_completed_at'),
      ('sys_goals','goal_completed_at'),
      ('sys_kpi_assessment_results','kpi_assessment_result_period_start'),
      ('sys_kpi_assessment_results','kpi_assessment_result_period_end'),
      ('sys_kpi_measurements','kpi_measurement_period_start'),
      ('sys_kpi_measurements','kpi_measurement_period_end'),
      ('sys_leads','lead_consent_at'),
      ('sys_mentorship_programs','program_start_date'),
      ('sys_mentorships','mentorship_start_date'),
      ('sys_okr_check_ins','check_in_date'),
      ('sys_organization_unit_history','organization_unit_history_effective_at'),
      ('sys_organization_units','organization_unit_effective_from'),
      ('sys_overtime','overtime_date'),
      ('sys_overtime','overtime_requested_at'),
      ('sys_overtime','overtime_approved_at'),
      ('sys_payroll_handoff_records','payroll_handoff_record_period_start'),
      ('sys_payroll_handoff_records','payroll_handoff_record_period_end'),
      ('sys_performance_reviews','review_period_start'),
      ('sys_performance_reviews','review_submitted_at'),
      ('sys_performance_reviews','review_acknowledged_at'),
      ('sys_performance_reviews','review_self_submitted_at'),
      ('sys_performance_reviews','review_self_review_completed_at'),
      ('sys_performance_reviews','review_manager_submitted_at'),
      ('sys_performance_reviews','review_shared_at'),
      ('sys_performance_reviews','review_finalized_at'),
      ('sys_performance_reviews','review_calibrated_at'),
      ('sys_position_economic_weight','position_economic_weight_period_start'),
      ('sys_position_economic_weight','position_economic_weight_period_end'),
      ('sys_position_skill_requirement_history','position_skill_requirement_history_effective_at'),
      ('sys_positions','position_effective_from'),
      ('sys_pulse_checks','pulse_check_date'),
      ('sys_reward_gates','reward_gate_period_start'),
      ('sys_survey_assignments','survey_assignment_completed_at'),
      ('sys_time_off_requests','request_approved_at'),
      ('sys_time_off_requests','request_cancelled_at'),
      ('sys_user_certifications','user_certification_issued_date'),
      ('sys_user_consents','consent_occurred_at'),
      ('sys_user_contracts','user_contract_start_date'),
      ('sys_user_demographics','user_demographics_birth_date'),
      ('sys_user_education_records','user_education_start_date'),
      ('sys_user_education_records','user_education_end_date'),
      ('sys_user_employment','user_employment_hire_date'),
      ('sys_user_employment','user_employment_seniority_date'),
      ('sys_user_family_members','user_family_member_birth_date'),
      ('sys_user_kpi_evidence','user_kpi_evidence_period_start'),
      ('sys_user_kpi_evidence','user_kpi_evidence_period_end'),
      ('sys_user_learning_evidence','user_learning_evidence_completed_at'),
      ('sys_user_pay_slips','user_pay_slip_payment_date'),
      ('sys_user_pay_slips','user_pay_slip_period_start'),
      ('sys_user_pay_slips','user_pay_slip_period_end'),
      ('sys_user_position_assignments','user_position_assignment_start_date'),
      ('sys_user_professional_experiences','user_prof_exp_start_date'),
      ('sys_user_professional_experiences','user_prof_exp_end_date'),
      ('sys_user_skills','user_skill_last_used_on'),
      ('sys_variable_pay_calculations','variable_pay_calculation_period_start'),
      ('sys_variable_pay_calculations','variable_pay_calculation_period_end')
    ) AS t(tbl, col)
  LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I WHERE (%I)::date > $1', r.tbl, r.col)
      INTO v_cnt USING p_end;
    IF v_cnt > 0 THEN
      v_bad := v_bad || format(' %s.%s=%s', r.tbl, r.col, v_cnt);
    END IF;
  END LOOP;
  IF v_bad <> '' THEN
    RAISE EXCEPTION 'G1: record di business oltre la finestra (fine=%):%', p_end, v_bad;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- G2 — nessun evento per-utente prima della sua hire_date
-- (sys_user_employment.user_employment_hire_date, 1 riga per utente).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_g2()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  r record;
  v_cnt bigint;
  v_bad text := '';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('sys_attendance','attendance_subject_user_id','attendance_date'),
      -- buste: il periodo e' il MESE intero; l'assunto a meta' mese ha la busta
      -- pro-rata del mese di assunzione (period_start=1 del mese < hire e' prassi
      -- paghe, non violazione) -> la proprieta' giusta e' period_END >= hire
      ('sys_user_pay_slips','user_pay_slip_user_id','user_pay_slip_period_end'),
      ('sys_goals','goal_subject_user_id','goal_start_date'),
      ('sys_goal_check_ins','check_in_subject_user_id','check_in_date'),
      -- reviews: il periodo è il CICLO di calendario (157/161 review = anno solare),
      -- non la finestra personale — un assunto in corso d'anno entra nel ciclo.
      -- Proprietà corretta: il periodo non può FINIRE prima dell'assunzione.
      -- (triage C0 esito b: corretto il check, non il dato — 5 assunti-2024 nel ciclo ANNUAL 2024)
      ('sys_performance_reviews','review_subject_user_id','review_period_end'),
      ('sys_user_learning_evidence','user_learning_evidence_user_id','user_learning_evidence_completed_at'),
      ('sys_pulse_checks','pulse_check_subject_user_id','pulse_check_date'),
      ('sys_overtime','overtime_subject_user_id','overtime_date'),
      ('sys_time_off_requests','request_subject_user_id','request_start_date')
    ) AS t(tbl, ucol, dcol)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM sys.%I t
        JOIN sys.sys_user_employment e ON e.user_employment_user_id = t.%I
       WHERE e.user_employment_hire_date IS NOT NULL
         AND (t.%I)::date < e.user_employment_hire_date', r.tbl, r.ucol, r.dcol)
      INTO v_cnt;
    IF v_cnt > 0 THEN
      v_bad := v_bad || format(' %s=%s', r.tbl, v_cnt);
    END IF;
  END LOOP;
  IF v_bad <> '' THEN
    RAISE EXCEPTION 'G2: eventi precedenti alla hire_date del soggetto:%', v_bad;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- G3 — parità busta ↔ presenze: ogni mese con pay slip (dentro la finestra) ha
-- almeno 1 giorno di attendance nello stesso mese per lo stesso utente.
-- Esclusi gli ESENTI secondo le regole S1028 (inquadramento QD*/Dirigente/Quadro
-- da sys_user_contracts.user_contract_ccnl_level — 34 utenti).
-- NOTA C0: questo check nasce ROSSO di proposito (buste 2025-09..2026-06 vs
-- presenze 2024-10..2025-12-08, mesi di massa disgiunti) — è la prima
-- post-condizione che il C1 farà diventare verde.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_g3(p_start date, p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_min text;
  v_max text;
BEGIN
  SELECT count(*),
         to_char(min(m), 'YYYY-MM'),
         to_char(max(m), 'YYYY-MM')
    INTO v_cnt, v_min, v_max
  FROM (
    SELECT p.user_pay_slip_user_id AS uid,
           date_trunc('month', p.user_pay_slip_period_start) AS m
    FROM sys.sys_user_pay_slips p
    WHERE p.user_pay_slip_period_start BETWEEN p_start AND p_end
      AND NOT EXISTS (
        SELECT 1 FROM sys.sys_user_contracts c
        WHERE c.user_contract_user_id = p.user_pay_slip_user_id
          AND (c.user_contract_ccnl_level LIKE 'QD%'
               OR c.user_contract_ccnl_level IN ('Dirigente','Quadro')))
      AND NOT EXISTS (
        SELECT 1 FROM sys.sys_attendance a
        WHERE a.attendance_subject_user_id = p.user_pay_slip_user_id
          AND date_trunc('month', a.attendance_date) = date_trunc('month', p.user_pay_slip_period_start))
  ) v;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'G3: % coppie (utente,mese) con busta paga ma senza presenze nel mese (range %..%)', v_cnt, v_min, v_max;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- G4 — sequenzialità: risoluzioni dopo le creazioni, fine dopo inizio.
-- UPA e time_off_requests hanno già CHECK a DB (esclusi: ridondanti).
-- La probation (14 righe con probation_end < start) è un tema sistemico
-- registrato per il C3 — il check arriverà con la riparazione.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_g4()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  r record;
  v_cnt bigint;
  v_bad text := '';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- strict: la risoluzione DEVE essere successiva alla creazione
      ('sys_approval_requests','created_at','approval_request_resolved_at','strict'),
      ('sys_approval_steps','created_at','approval_step_decided_at','strict'),
      ('sys_time_off_requests','created_at','request_approved_at','strict'),
      ('sys_goals','goal_start_date','goal_due_date','strict'),
      -- range: fine >= inizio (stesso giorno lecito)
      ('sys_user_contracts','user_contract_start_date','user_contract_end_date','range'),
      ('sys_user_pay_slips','user_pay_slip_period_start','user_pay_slip_period_end','range')
    ) AS t(tbl, col_a, col_b, mode)
  LOOP
    IF r.mode = 'strict' THEN
      EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I IS NOT NULL AND %I IS NOT NULL AND %I <= %I',
                     r.tbl, r.col_a, r.col_b, r.col_b, r.col_a) INTO v_cnt;
    ELSE
      EXECUTE format('SELECT count(*) FROM sys.%I WHERE %I IS NOT NULL AND %I IS NOT NULL AND %I < %I',
                     r.tbl, r.col_a, r.col_b, r.col_b, r.col_a) INTO v_cnt;
    END IF;
    IF v_cnt > 0 THEN
      v_bad := v_bad || format(' %s(%s→%s)=%s', r.tbl, r.col_a, r.col_b, v_cnt);
    END IF;
  END LOOP;
  IF v_bad <> '' THEN
    RAISE EXCEPTION 'G4: violazioni di sequenzialità:%', v_bad;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- G5 — le 6 viste strutturali di integrità (le stesse di pnpm db:validate)
-- devono restituire 0 righe.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_g5()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  r record;
  v_cnt bigint;
  v_bad text := '';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('v_orphan_position_assignments'),
      ('v_tenant_boundary_violations'),
      ('v_canonical_outside_sys'),
      ('v_active_primary_assignment_per_user'),
      ('v_visualization_node_in_canonical_node'),
      ('v_inbox_resource_consistency')
    ) AS t(vw)
  LOOP
    EXECUTE format('SELECT count(*) FROM sys.%I', r.vw) INTO v_cnt;
    IF v_cnt > 0 THEN
      v_bad := v_bad || format(' %s=%s', r.vw, v_cnt);
    END IF;
  END LOOP;
  IF v_bad <> '' THEN
    RAISE EXCEPTION 'G5: viste strutturali con violazioni:%', v_bad;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- G6 — provenance: ogni SEED FILE RI-ESEGUIBILE presente nel registro ha almeno
-- una corsa con twice_run_delta = 0 (la prova di idempotenza della doppia
-- esecuzione). Granularità per (cluster, seed_file). ESCLUSI i one-shot di
-- repair/ (per architettura si lanciano una volta: un reset ri-eseguito dopo
-- la ri-semina cancellerebbe il lavoro — la loro traccia resta nel registro
-- come evidenza, non come proprietà di idempotenza).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_g6()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(cluster_code || '/' || seed_file, ', ' ORDER BY cluster_code, seed_file)
    INTO v_bad
  FROM (
    SELECT cluster_code, seed_file
    FROM staging.storia36_runs
    WHERE seed_file NOT LIKE 'repair/%'
    GROUP BY cluster_code, seed_file
    HAVING count(*) FILTER (WHERE twice_run_delta = 0) = 0
  ) x;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'G6: seed senza prova di doppia esecuzione (twice_run_delta=0): %', v_bad;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C1a — copertura presenze: ogni utente RTL ATTIVO ha >=1 riga attendance in
-- OGNI mese da GREATEST(hire, inizio finestra) fino al mese di frontiera della
-- storia (= mese del max(attendance_date)): la frontiera è derivata dal dato,
-- così l'avanzamento mensile la sposta senza toccare il check.
-- Unica esclusione (giustificata, come l'allowlist dossier): i 2 never-badger
-- QD3 — convenzione pre-esistente «niente badge quotidiano», hanno solo righe
-- di assenza. NOTA falsificabilità: la frontiera è il max GLOBALE — una
-- truncation della coda di TUTTI gli utenti insieme la sposterebbe indietro
-- senza far scattare il check (una truncation per-utente invece scatta).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c1a(p_start date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  WITH frontier AS (
    SELECT date_trunc('month', max(attendance_date))::date AS fm FROM sys.sys_attendance
  ),
  scope AS (
    SELECT u.user_id, u.user_email,
           GREATEST(date_trunc('month', e.user_employment_hire_date)::date,
                    date_trunc('month', p_start)::date) AS from_month
    FROM sys.sys_users u
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
    WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND u.user_status = 'ACTIVE'
      AND e.user_employment_hire_date IS NOT NULL
      AND u.user_email NOT IN ('giuseppe.ferri@rtl-bank.org','maria.colombo@rtl-bank.org')
  ),
  missing AS (
    SELECT s.user_email, m.m
    FROM scope s
    CROSS JOIN frontier f
    CROSS JOIN LATERAL generate_series(s.from_month, f.fm, interval '1 month') AS m(m)
    WHERE NOT EXISTS (
      SELECT 1 FROM sys.sys_attendance a
      WHERE a.attendance_subject_user_id = s.user_id
        AND a.attendance_date >= m.m::date
        AND a.attendance_date < (m.m + interval '1 month')::date)
  )
  SELECT count(*), min(user_email || ' ' || to_char(m, 'YYYY-MM'))
    INTO v_cnt, v_sample FROM missing;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C1a: % coppie (utente non-esente, mese) senza presenze (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C1b — nessuna riga attendance in un giorno non lavorativo del calendario
-- storia36 (weekend/festività: gli straordinari weekend vivono in sys_overtime).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c1b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM sys.sys_attendance a
  JOIN staging.storia36_calendar c ON c.cal_date = a.attendance_date
  WHERE NOT c.is_workday;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C1b: % righe attendance in giorni non lavorativi', v_cnt;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C1c — coerenza time-off ↔ attendance ↔ balances:
--  (i) ogni richiesta APPROVED (RTL, nella finestra, fino alla frontiera) ha
--      una riga attendance con lo status del leave_type in OGNI workday del
--      suo intervallo (VACATION→VACATION, SICK→SICK, UNPAID→UNPAID_LEAVE,
--      altri→PAID_LEAVE);
--  (ii) per ogni balance RTL (VACATION/SICK/PERSONAL, anni della finestra):
--      balance_used_days = giorni attendance con quello status nell'anno.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c1c(p_start date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_i bigint;
  v_ii bigint;
  v_sample text;
BEGIN
  WITH frontier AS (
    SELECT max(attendance_date) AS fd FROM sys.sys_attendance
  )
  SELECT count(*), min(r.request_natural_key)
    INTO v_i, v_sample
  FROM sys.sys_time_off_requests r
  CROSS JOIN frontier f
  CROSS JOIN LATERAL generate_series(GREATEST(r.request_start_date, p_start),
                                     LEAST(r.request_end_date, f.fd),
                                     interval '1 day') AS d(d)
  JOIN staging.storia36_calendar c ON c.cal_date = d.d::date AND c.is_workday
  WHERE r.request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND r.request_status = 'APPROVED'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_attendance a
      WHERE a.attendance_subject_user_id = r.request_subject_user_id
        AND a.attendance_date = d.d::date
        AND a.attendance_status = CASE r.request_leave_type
              WHEN 'VACATION' THEN 'VACATION'
              WHEN 'SICK' THEN 'SICK'
              WHEN 'UNPAID' THEN 'UNPAID_LEAVE'
              ELSE 'PAID_LEAVE' END);
  IF v_i > 0 THEN
    RAISE EXCEPTION 'C1c(i): % workday di richieste APPROVED senza attendance coerente (es. %)', v_i, v_sample;
  END IF;

  SELECT count(*), min(b.balance_natural_key)
    INTO v_ii, v_sample
  FROM sys.sys_time_off_balances b
  WHERE b.balance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND b.balance_leave_type IN ('VACATION','SICK','PERSONAL')
    AND b.balance_year BETWEEN extract(year FROM p_start)::int
                           AND extract(year FROM (SELECT max(attendance_date) FROM sys.sys_attendance))::int
    AND b.balance_used_days IS DISTINCT FROM (
      SELECT count(*)::numeric FROM sys.sys_attendance a
      WHERE a.attendance_subject_user_id = b.balance_subject_user_id
        AND extract(year FROM a.attendance_date)::int = b.balance_year
        AND a.attendance_status = CASE b.balance_leave_type
              WHEN 'VACATION' THEN 'VACATION'
              WHEN 'SICK' THEN 'SICK'
              ELSE 'PAID_LEAVE' END);
  IF v_ii > 0 THEN
    RAISE EXCEPTION 'C1c(ii): % balance con used_days diverso dal derivato attendance (es. %)', v_ii, v_sample;
  END IF;

  -- (iii) mai goduto oltre il maturato (check INDIPENDENTE dal derivato del
  -- seed — è la proprietà del piano Step 1.4 "maturato-goduto=residuo")
  SELECT count(*), min(b.balance_natural_key)
    INTO v_ii, v_sample
  FROM sys.sys_time_off_balances b
  WHERE b.balance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND b.balance_used_days > b.balance_total_days + b.balance_carryover_days + b.balance_adjustment_days;
  IF v_ii > 0 THEN
    RAISE EXCEPTION 'C1c(iii): % balance con goduto oltre maturato+riporto+rettifica (es. %)', v_ii, v_sample;
  END IF;

  -- (iv) days_requested = workday coperti (semantica workday adottata da C1)
  SELECT count(*), min(r.request_natural_key)
    INTO v_ii, v_sample
  FROM sys.sys_time_off_requests r
  WHERE r.request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND r.request_status = 'APPROVED'
    AND r.request_days_requested IS DISTINCT FROM (
      SELECT count(*)::numeric FROM staging.storia36_calendar c
      WHERE c.cal_date BETWEEN r.request_start_date AND r.request_end_date
        AND c.is_workday);
  IF v_ii > 0 THEN
    RAISE EXCEPTION 'C1c(iv): % richieste APPROVED con days_requested diverso dai workday coperti (es. %)', v_ii, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C1d — realismo operativo delle ferie: mai più del 60% dell'organico RTL in
-- VACATION nello stesso giorno lavorativo (una banca retail tiene gli sportelli
-- aperti anche ad agosto: l'estate è a turni scaglionati).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c1d()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_share numeric;
  v_day date;
BEGIN
  SELECT share, d INTO v_share, v_day FROM (
    SELECT a.attendance_date AS d,
           avg((a.attendance_status = 'VACATION')::int) AS share
    FROM sys.sys_attendance a
    JOIN staging.storia36_calendar c ON c.cal_date = a.attendance_date AND c.is_workday
    WHERE a.attendance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    GROUP BY 1
  ) x ORDER BY share DESC LIMIT 1;
  IF v_share > 0.60 THEN
    RAISE EXCEPTION 'C1d: quota VACATION % (> 0.60) nel workday %', round(v_share, 3), v_day;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C3S — SPEC per il C3 (nasce ROSSA, come G3 nacque rossa al C0): in ogni mese
-- di massa delle buste (>=100 slip), ogni utente RTL attivo NON-esente con
-- presenze nel mese deve avere la SUA busta. Oggi 2 utenti ne sono privi
-- (alberto.colombo, alice.esposito) — il C3 li sana ricostruendo la
-- compensation; triage: (a) dato mancante → C3.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c3s()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  WITH mass_months AS (
    SELECT date_trunc('month', user_pay_slip_period_start) AS m
    FROM sys.sys_user_pay_slips
    WHERE user_pay_slip_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    GROUP BY 1 HAVING count(*) >= 100
  )
  SELECT count(*), min(u.user_email || ' ' || to_char(mm.m, 'YYYY-MM'))
    INTO v_cnt, v_sample
  FROM mass_months mm
  CROSS JOIN sys.sys_users u
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_user_contracts c
                    WHERE c.user_contract_user_id = u.user_id
                      AND (c.user_contract_ccnl_level LIKE 'QD%'
                           OR c.user_contract_ccnl_level IN ('Dirigente','Quadro')))
    AND EXISTS (SELECT 1 FROM sys.sys_attendance a
                WHERE a.attendance_subject_user_id = u.user_id
                  AND date_trunc('month', a.attendance_date) = mm.m)
    AND NOT EXISTS (SELECT 1 FROM sys.sys_user_pay_slips p
                    WHERE p.user_pay_slip_user_id = u.user_id
                      AND date_trunc('month', p.user_pay_slip_period_start) = mm.m);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C3S: % coppie (utente non-esente presente, mese di massa) senza busta (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C2a — ogni utente RTL ATTIVO assunto entro il 1° ottobre dell'anno Y ha
-- almeno una review con periodo che si chiude in Y, per ogni anno pieno della
-- storia (2023..anno-frontiera-1; il 2026 è in corso). Eligibility min-tenure:
-- assunti dopo il 1/10 entrano nel ciclo successivo (rilievo C1-review).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c2a()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  WITH years AS (
    SELECT y FROM generate_series(2023,
      LEAST(2025, extract(year FROM (SELECT max(attendance_date) FROM sys.sys_attendance))::int - 1
            + CASE WHEN extract(month FROM (SELECT max(attendance_date) FROM sys.sys_attendance)) = 12 THEN 1 ELSE 0 END)) AS y
  ),
  missing AS (
    SELECT u.user_email, y.y
    FROM sys.sys_users u
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
    CROSS JOIN years y
    WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND u.user_status = 'ACTIVE'
      AND e.user_employment_hire_date <= make_date(y.y, 10, 1)
      AND NOT EXISTS (
        SELECT 1 FROM sys.sys_performance_reviews r
        WHERE r.review_subject_user_id = u.user_id
          AND extract(year FROM r.review_period_end)::int = y.y)
  )
  SELECT count(*), min(user_email || ' ' || y) INTO v_cnt, v_sample FROM missing;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C2a: % coppie (utente eleggibile, anno pieno) senza review (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C2b — ogni review ANNUAL COMPLETED con periodo chiuso in Y >= 2024 ha almeno
-- 2 check-in del soggetto datati Y; per il 2023 (innesto a metà finestra) ne
-- basta 1. I check-in misurano che il ciclo goal→check-in→review sia reale.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c2b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(u.user_email || ' ' || extract(year FROM r.review_period_end))
    INTO v_cnt, v_sample
  FROM sys.sys_performance_reviews r
  JOIN sys.sys_users u ON u.user_id = r.review_subject_user_id
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  WHERE r.review_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND r.review_type = 'ANNUAL'
    AND r.review_status = 'COMPLETED'
    -- stessa eligibility min-tenure di C2a: gli assunti dopo il 1/10 hanno una
    -- review legacy "di cortesia" senza ciclo goal sottostante (registrato)
    AND e.user_employment_hire_date <= make_date(extract(year FROM r.review_period_end)::int, 10, 1)
    AND extract(year FROM r.review_period_end)::int BETWEEN 2023 AND 2025
    AND (SELECT count(*) FROM sys.sys_goal_check_ins c
         WHERE c.check_in_subject_user_id = r.review_subject_user_id
           AND extract(year FROM c.check_in_date)::int = extract(year FROM r.review_period_end)::int)
        < CASE WHEN extract(year FROM r.review_period_end)::int = 2023 THEN 1 ELSE 2 END;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C2b: % review annuali senza i check-in minimi nell''anno (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C2c — il reviewer è il manager gerarchico reale del soggetto (catena
-- assignment PRIMARY ACTIVE → position → reports_to → assignment PRIMARY
-- ACTIVE); per il vertice senza manager il fallback legittimo è il service
-- account admin@heuresys.com. («alla data» arriverà con la history di C6.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c2c()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(u.user_email || ' ' || to_char(r.review_period_end, 'YYYY'))
    INTO v_cnt, v_sample
  FROM sys.sys_performance_reviews r
  JOIN sys.sys_users u ON u.user_id = r.review_subject_user_id
  LEFT JOIN LATERAL (
    SELECT a2.user_position_assignment_user_id AS mgr
    FROM sys.sys_user_position_assignments a1
    JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
    JOIN sys.sys_user_position_assignments a2
         ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
        AND a2.user_position_assignment_kind = 'PRIMARY'
        AND a2.user_position_assignment_status = 'ACTIVE'
    WHERE a1.user_position_assignment_user_id = r.review_subject_user_id
      AND a1.user_position_assignment_kind = 'PRIMARY'
      AND a1.user_position_assignment_status = 'ACTIVE'
    LIMIT 1
  ) m ON true
  WHERE r.review_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND r.review_subject_user_id IS NOT NULL
    AND r.review_reviewer_user_id IS DISTINCT FROM COALESCE(
          NULLIF(m.mgr, r.review_subject_user_id),
          (SELECT user_id FROM sys.sys_users WHERE user_email = 'admin@heuresys.com'));
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C2c: % review con reviewer diverso dal manager gerarchico (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C2d — nessuna risposta 360 MANAGER/PEER con reviewer == target
-- (il SELF è per definizione self e resta fuori).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c2d()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM sys.sys_feedback_360_responses
  WHERE response_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND response_relationship_type IN ('MANAGER','PEER')
    AND response_reviewer_user_id = response_target_user_id;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C2d: % risposte 360 MANAGER/PEER con reviewer = target', v_cnt;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C2e — coerenza goal↔check-in↔stato: (i) goal non terminale con check-in ha
-- progress = new_progress dell'ultimo check-in; (ii) goal COMPLETED ha
-- progress = 100 (invariante legacy); (iii) riconciliazione d'aggregato: la
-- quota di performance_box=1 sulle review COMPLETED non supera il 25%
-- (la curva dichiarata è ~10/70/20).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c2e()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_share numeric;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM sys.sys_goals g
  JOIN LATERAL (
    SELECT c.check_in_new_progress AS np
    FROM sys.sys_goal_check_ins c
    WHERE c.check_in_goal_id = g.goal_id
    ORDER BY c.check_in_date DESC, c.created_at DESC LIMIT 1
  ) lc ON true
  WHERE g.goal_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND g.goal_status NOT IN ('COMPLETED','CANCELLED')
    AND g.goal_progress_percent IS DISTINCT FROM lc.np;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C2e: % goal non terminali con progress diverso dall''ultimo check-in', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt
  FROM sys.sys_goals
  WHERE goal_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND goal_status = 'COMPLETED' AND goal_progress_percent <> 100;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C2e: % goal COMPLETED con progress diverso da 100', v_cnt;
  END IF;

  SELECT avg((review_performance_box = 1)::int) INTO v_share
  FROM sys.sys_performance_reviews
  WHERE review_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND review_status = 'COMPLETED' AND review_performance_box IS NOT NULL;
  IF v_share > 0.25 THEN
    RAISE EXCEPTION 'C2e: quota box-basso % oltre il 25%% (curva 10/70/20 violata)', round(v_share, 3);
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C2f — perimetro I5 sul ciclo performance: il tenant di review/goal/check-in/
-- f360 coincide col tenant del soggetto/target (generalizza il check attendance
-- del C1; scoperta della review C2: 2 review + 6 goal cross-tenant invisibili).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c2f()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_bad text := '';
  v_cnt bigint;
BEGIN
  SELECT count(*) INTO v_cnt FROM sys.sys_performance_reviews r
  JOIN sys.sys_users u ON u.user_id = r.review_subject_user_id
  WHERE r.review_tenant_id IS DISTINCT FROM u.user_tenant_id;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' reviews=%s', v_cnt); END IF;

  SELECT count(*) INTO v_cnt FROM sys.sys_goals g
  JOIN sys.sys_users u ON u.user_id = g.goal_subject_user_id
  WHERE g.goal_tenant_id IS DISTINCT FROM u.user_tenant_id;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' goals=%s', v_cnt); END IF;

  SELECT count(*) INTO v_cnt FROM sys.sys_goal_check_ins c
  JOIN sys.sys_users u ON u.user_id = c.check_in_subject_user_id
  WHERE c.check_in_tenant_id IS DISTINCT FROM u.user_tenant_id;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' check_ins=%s', v_cnt); END IF;

  SELECT count(*) INTO v_cnt FROM sys.sys_feedback_360_responses f
  JOIN sys.sys_users u ON u.user_id = f.response_target_user_id
  WHERE f.response_tenant_id IS DISTINCT FROM u.user_tenant_id;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' f360=%s', v_cnt); END IF;

  IF v_bad <> '' THEN
    RAISE EXCEPTION 'C2f: righe del ciclo performance fuori dal perimetro tenant (I5):%', v_bad;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C2g — gli eventi del ciclo performance cadono in giorni LAVORATIVI del
-- calendario storia36 (submitted/acknowledged, goal_completed_at, f360
-- completed_at, check_in_date): una banca non prende atto delle valutazioni
-- a Natale (rilievo review C2: 106 ack nel weekend, 94 completamenti su
-- Natale/S.Stefano).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c2g()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_bad text := '';
  v_cnt bigint;
BEGIN
  SELECT count(*) INTO v_cnt FROM sys.sys_performance_reviews r
  JOIN staging.storia36_calendar c ON c.cal_date = r.review_submitted_at::date
  WHERE r.review_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND NOT c.is_workday;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' submitted=%s', v_cnt); END IF;

  SELECT count(*) INTO v_cnt FROM sys.sys_performance_reviews r
  JOIN staging.storia36_calendar c ON c.cal_date = r.review_acknowledged_at::date
  WHERE r.review_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND NOT c.is_workday;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' acknowledged=%s', v_cnt); END IF;

  SELECT count(*) INTO v_cnt FROM sys.sys_goals g
  JOIN staging.storia36_calendar c ON c.cal_date = g.goal_completed_at::date
  WHERE g.goal_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND NOT c.is_workday;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' goal_completed=%s', v_cnt); END IF;

  SELECT count(*) INTO v_cnt FROM sys.sys_feedback_360_responses f
  JOIN staging.storia36_calendar c ON c.cal_date = f.response_completed_at::date
  WHERE f.response_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND NOT c.is_workday;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' f360=%s', v_cnt); END IF;

  SELECT count(*) INTO v_cnt FROM sys.sys_goal_check_ins k
  JOIN staging.storia36_calendar c ON c.cal_date = k.check_in_date
  WHERE k.check_in_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND NOT c.is_workday;
  IF v_cnt > 0 THEN v_bad := v_bad || format(' check_in=%s', v_cnt); END IF;

  IF v_bad <> '' THEN
    RAISE EXCEPTION 'C2g: eventi del ciclo performance in giorni non lavorativi:%', v_bad;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C3a — payroll handoff: ogni mese della finestra (dal 2023-08 alla frontiera
-- delle buste) ha un record di handoff con stato valido.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c3a(p_start date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  WITH months AS (
    SELECT generate_series(date_trunc('month', p_start),
             date_trunc('month', (SELECT max(user_pay_slip_period_start) FROM sys.sys_user_pay_slips)),
             interval '1 month')::date AS m
  )
  SELECT count(*), min(to_char(m, 'YYYY-MM')) INTO v_cnt, v_sample
  FROM months
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_payroll_handoff_records h
    WHERE h.payroll_handoff_record_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND h.payroll_handoff_record_period_start = months.m);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C3a: % mesi senza record di payroll handoff (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C3b — copertura buste: ogni utente RTL ATTIVO ha una busta per OGNI mese da
-- GREATEST(hire, inizio finestra) al mese di frontiera delle buste.
-- (Supera e ingloba la spec C3S nata al C1.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c3b(p_start date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  WITH frontier AS (
    SELECT date_trunc('month', max(user_pay_slip_period_start))::date AS fm
    FROM sys.sys_user_pay_slips
  )
  SELECT count(*), min(u.user_email || ' ' || to_char(gm.m, 'YYYY-MM'))
    INTO v_cnt, v_sample
  FROM sys.sys_users u
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  CROSS JOIN frontier f
  CROSS JOIN LATERAL generate_series(
    GREATEST(date_trunc('month', e.user_employment_hire_date)::date,
             date_trunc('month', p_start)::date),
    f.fm, interval '1 month') AS gm(m)
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_pay_slips p
      WHERE p.user_pay_slip_user_id = u.user_id
        AND date_trunc('month', p.user_pay_slip_period_start) = gm.m);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C3b: % coppie (utente, mese) senza busta paga (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C3c — floor CCNL alla data: gross×13 >= floor del livello al mese della
-- busta, col modello a tranches del rinnovo 23/11/2023 (+250 dal 2023-12,
-- +100 dal 2024-09, +50 dal 2025-06, +35 dal 2026-03, figura media 3A4L,
-- scalate per parametro livello). Dirigente escluso (CCNL separato).
-- Fonti: docs/kb/storia36/DOMINIO_PREMIO_VARIABILE.md + seed_ccnl_floors.sql.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_floor_at(lvl text, m date)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $fn$
  WITH f(l, fl) AS (VALUES
    ('QD4',67081::numeric),('QD3',57159),('QD2',51551),('QD1',48662),
    ('3A4L',43445),('3A3L',39773),('3A2L',37575),('3A1L',35650),('AU',32233),
    ('Quadro',57159))
  SELECT (fl - 13 * (fl / 43445.0) * (
           CASE WHEN m < DATE '2023-12-01' THEN 250 ELSE 0 END +
           CASE WHEN m < DATE '2024-09-01' THEN 100 ELSE 0 END +
           CASE WHEN m < DATE '2025-06-01' THEN 50  ELSE 0 END +
           CASE WHEN m < DATE '2026-03-01' THEN 35  ELSE 0 END))
  FROM f WHERE l = lvl
$fn$;

CREATE OR REPLACE FUNCTION staging.storia36_check_c3c(p_start date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(u.user_email || ' ' || p.user_pay_slip_period)
    INTO v_cnt, v_sample
  FROM sys.sys_user_pay_slips p
  JOIN sys.sys_users u ON u.user_id = p.user_pay_slip_user_id
  JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  WHERE p.user_pay_slip_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND p.user_pay_slip_period_start >= p_start
    -- il mese di assunzione è PRO-RATA (giorni dalla hire): il floor mensile
    -- pieno non si applica alla prima busta parziale
    AND date_trunc('month', e.user_employment_hire_date) <> date_trunc('month', p.user_pay_slip_period_start)
    AND c.user_contract_ccnl_level IS NOT NULL
    AND c.user_contract_ccnl_level <> 'Dirigente'
    -- dicembre = 13a mensilita' (gross doppio): si confronta la mensilita' base
    AND (p.user_pay_slip_gross_pay
         / CASE WHEN extract(month FROM p.user_pay_slip_period_start) = 12 THEN 2 ELSE 1 END) * 13
        < staging.storia36_floor_at(c.user_contract_ccnl_level, p.user_pay_slip_period_start) - 1;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C3c: % buste sotto il floor CCNL alla data (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C3d — motore variabile coerente: ogni variable_pay ha (i) i 7 gates
-- dell'esercizio TUTTI con esito non-bloccante, (ii) amount <= 30% della RAL
-- (DOMINIO §2), (iii) importo > 0.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c3d()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(u.user_email || ' FY' || extract(year FROM v.variable_pay_calculation_period_start))
    INTO v_cnt, v_sample
  FROM sys.sys_variable_pay_calculations v
  JOIN sys.sys_users u ON u.user_id = v.variable_pay_calculation_user_id
  LEFT JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
  WHERE v.variable_pay_calculation_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND (
      v.variable_pay_calculation_amount_eur <= 0
      OR (c.user_contract_gross_annual_salary IS NOT NULL
          AND v.variable_pay_calculation_amount_eur > 0.30 * c.user_contract_gross_annual_salary + 1)
      -- i gates valgono per l'ESERCIZIO: il legacy ha anche premi trimestrali/
      -- semestrali (Q4, giu-nov) che ricadono sotto i gates dell'anno
      OR (SELECT count(*) FROM sys.sys_reward_gates g
           JOIN sys.sys_reward_gate_results r ON r.reward_gate_result_gate_id = g.reward_gate_id
          WHERE g.reward_gate_user_id = v.variable_pay_calculation_user_id
            AND extract(year FROM g.reward_gate_period_start)
                = extract(year FROM v.variable_pay_calculation_period_start)
            AND r.reward_gate_result_status IN ('PASSED','WARNING','OVERRIDDEN_WITH_REASON')) < 7
    );
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C3d: % variable-pay senza i 7 gates superati o fuori cap 30%% RAL (es. %)', v_cnt, v_sample;
  END IF;

  -- (iv) le righe storia36: amount = curva(attainment) ±1€ (payout ∈ curva)
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_variable_pay_calculations v
  JOIN sys.sys_users u ON u.user_id = v.variable_pay_calculation_user_id
  JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
  WHERE v.variable_pay_calculation_payload->>'storia36' = 'C3'
    AND abs(v.variable_pay_calculation_amount_eur - round(LEAST(
          staging.storia36_ral_at(c.user_contract_gross_annual_salary, c.user_contract_ccnl_level,
            make_date(extract(year FROM v.variable_pay_calculation_period_start)::int, 12, 1))
          * CASE WHEN c.user_contract_ccnl_level = 'Dirigente' THEN 0.15
                 WHEN c.user_contract_ccnl_level LIKE 'QD%' OR c.user_contract_ccnl_level = 'Quadro' THEN 0.12
                 WHEN c.user_contract_ccnl_level = '3A4L' THEN 0.08
                 WHEN c.user_contract_ccnl_level = '3A3L' THEN 0.07
                 ELSE 0.05 END
          * LEAST(0.5 + ((v.variable_pay_calculation_payload->>'attainment')::numeric - 0.8) * 2.5, 1.5),
          staging.storia36_ral_at(c.user_contract_gross_annual_salary, c.user_contract_ccnl_level,
            make_date(extract(year FROM v.variable_pay_calculation_period_start)::int, 12, 1)) * 0.30), 2)) > 1;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C3d(iv): % variable-pay storia36 con amount fuori dalla curva ±1€ (es. %)', v_cnt, v_sample;
  END IF;

  -- (v) aggregato per (utente, esercizio) <= 100%% della RAL (vigilanza BdI:
  -- oltre il 100%% scatta la notifica — una banca media resta sotto; il cap 30%%
  -- e' PER SINGOLO premio, DOMINIO §2-§3)
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM (
    SELECT variable_pay_calculation_user_id AS uid,
           extract(year FROM variable_pay_calculation_period_start) AS fy,
           sum(variable_pay_calculation_amount_eur) AS tot
    FROM sys.sys_variable_pay_calculations
    WHERE variable_pay_calculation_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    GROUP BY 1, 2
  ) agg
  JOIN sys.sys_users u ON u.user_id = agg.uid
  JOIN sys.sys_user_contracts c ON c.user_contract_user_id = agg.uid
  WHERE agg.tot > c.user_contract_gross_annual_salary;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C3d(v): % aggregati (utente, esercizio) oltre il 100%% della RAL (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C3e — erogazione: il variabile dell'esercizio N è nella busta di giugno N+1
-- (gross giugno >= mensilità base + amount - 1€). Scoped a FY2023/FY2024: la
-- busta 2026-06 è legacy (flat) e la mancata evidenza del FY2025 è una
-- DEVIAZIONE DICHIARATA (diario C3), non un buco silenzioso.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c3e()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(u.user_email || ' FY' || extract(year FROM v.variable_pay_calculation_period_start))
    INTO v_cnt, v_sample
  FROM sys.sys_variable_pay_calculations v
  JOIN sys.sys_users u ON u.user_id = v.variable_pay_calculation_user_id
  WHERE v.variable_pay_calculation_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND extract(year FROM v.variable_pay_calculation_period_start)::int IN (2023, 2024)
    -- 34 righe legacy hanno amount NULL (allocazioni mai quantificate): non si
    -- puo' pretendere evidenza in busta di un importo inesistente — registrate
    -- nel diario per il triage (quantificare o marcare declinate)
    AND v.variable_pay_calculation_amount_eur IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_pay_slips p
      JOIN sys.sys_user_contracts c2 ON c2.user_contract_user_id = p.user_pay_slip_user_id
      WHERE p.user_pay_slip_user_id = v.variable_pay_calculation_user_id
        AND p.user_pay_slip_period = (extract(year FROM v.variable_pay_calculation_period_start)::int + 1) || '-06'
        -- il VAP deve stare SOPRA la mensilita' base del mese (non basta
        -- gross >= amount: sarebbe vacuo quando base > amount)
        AND p.user_pay_slip_gross_pay >=
            round(staging.storia36_ral_at(c2.user_contract_gross_annual_salary,
                                          c2.user_contract_ccnl_level,
                                          p.user_pay_slip_period_start) / 13.0, 2)
            + v.variable_pay_calculation_amount_eur - 1);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C3e: % variable-pay FY23/24 senza evidenza nella busta di giugno N+1 (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ############################################################################
-- C4 — FORMAZIONE. Ogni soglia numerica di questa sezione cita una riga di
-- docs/kb/storia36/DOMINIO_FORMAZIONE_OBBLIGATORIA.md: qui non esistono numeri
-- di comodo. Le due funzioni helper sotto sono usate SIA dai check SIA dal seed
-- 04_learning.sql — una sola definizione, mai due copie che divergono.
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Helper C4/1 — quali schemi sono ABILITANTI: il possesso in corso di validità
-- è condizione per svolgere l'attività, quindi la catena di rinnovi non può
-- interrompersi. È l'UNICA parte del C4 che non si può derivare dal dato — viene
-- dalla norma (DOMINIO §2, §4, §5). Tutto il resto (CFA, FRM, CAMS, ABA, DPO,
-- titoli interni) è volontario: lasciarlo decadere è un fatto della vita, non un
-- difetto — ed è la ragione per cui C4b non pretende «zero scadute».
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_cert_is_abilitante(p_issuer text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
  SELECT p_issuer IN (
    'IVASS',        -- DOMINIO §2 · iscrizione al RUI, Reg. IVASS 40/2018
    'EFPA Italia',  -- DOMINIO §4 · certificazione MiFID II soggetta a mantenimento
    'INAIL')        -- DOMINIO §5 · sicurezza sul lavoro, D.Lgs 81/08
$fn$;

-- ----------------------------------------------------------------------------
-- Helper C4/2 — durata di validità di uno schema, DERIVATA dal dato esistente
-- (mediana delle righe non generate da storia36), mai da una tabella di comodo.
-- In RTL il RUI e l'EFPA sono modellati a 5 anni: è quella la cadenza con cui la
-- catena va estesa. L'obbligo ANNUALE che la norma pone (30 ore IVASS,
-- mantenimento EFPA, aggiornamento MiFID) è sulle ORE — e vive in C4a — non sul
-- certificato: confondere le due cose farebbe scadere ogni anno un titolo che il
-- dato dichiara quinquennale.
-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- Helper C4/2-bis — le cadenze che NON si derivano dal dato perche' le fissa la
-- norma. Fonti riga per riga in DOMINIO §5.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_cert_validity_di_legge(p_name text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    -- Accordo Stato-Regioni 17/04/2025: lavoratori 6 h ogni 5 anni
    WHEN p_name ILIKE '%Sicurezza Base%'             THEN 5
    -- preposti: aggiornamento BIENNALE, minimo 6 h (la sola cadenza accorciata)
    WHEN p_name ILIKE '%preposti%'                   THEN 2
    -- dirigenti per la sicurezza: base 12 h, aggiornamento quinquennale
    WHEN p_name ILIKE '%dirigenti per la sicurezza%' THEN 5
    -- datore di lavoro: corso 16 h, aggiornamento quinquennale 6 h
    WHEN p_name ILIKE '%datore di lavoro%'           THEN 5
    -- addetto antincendio livello 1 (rischio basso), DM 02/09/2021: 2 h ogni 5 anni
    WHEN p_name ILIKE '%antincendio%'                THEN 5
    -- addetto primo soccorso gruppo B/C, DM 388/2003: 4 h ogni 3 anni
    WHEN p_name ILIKE '%primo soccorso%'             THEN 3
    ELSE NULL
  END::numeric
$fn$;

CREATE OR REPLACE FUNCTION staging.storia36_cert_validity_years(p_name text, p_issuer text)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
  SELECT COALESCE(
    -- (1) dove la cadenza la fissa la LEGGE, la legge vince sul dato: non ha
    -- senso derivare dalla mediana una periodicita' che il D.Lgs 81/08 e i suoi
    -- decreti attuativi stabiliscono in modo puntuale (DOMINIO §5).
    staging.storia36_cert_validity_di_legge(p_name),
    -- (2) altrimenti: la validita' mediana osservata per quello schema
    (SELECT percentile_cont(0.5) WITHIN GROUP (
              ORDER BY (c.user_certification_expires_date - c.user_certification_issued_date) / 365.0)
       FROM sys.sys_user_certifications c
      WHERE c.user_certification_name = p_name
        AND c.user_certification_issuer = p_issuer
        AND c.user_certification_issued_date IS NOT NULL
        AND c.user_certification_expires_date IS NOT NULL
        AND c.user_certification_metadata->>'storia36' IS NULL),
    3.0)
$fn$;

-- ----------------------------------------------------------------------------
-- Helper C4/2 — ore di formazione di (utente, anno). Due addendi, mai
-- sovrapposti: la GIORNATA D'AULA vale l'orario contrattuale pieno (7,5 h —
-- stesso envelope del C1, CCNL 37,5 h/sett su 5 giorni), la formazione FUORI
-- AULA vale la durata dichiarata del modulo. Un'evidenza che cade su un giorno
-- TRAINING è la prova di quella giornata d'aula: contarla di nuovo a durata
-- sarebbe doppio conteggio.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_c4_hours(p_user uuid, p_year int)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
  SELECT
    (SELECT count(*) * 7.5 FROM sys.sys_attendance a
      WHERE a.attendance_subject_user_id = p_user
        AND a.attendance_status = 'TRAINING'
        AND extract(year FROM a.attendance_date) = p_year)
  + (SELECT COALESCE(sum(COALESCE(m.learning_module_duration_minutes, 60)) / 60.0, 0)
       FROM sys.sys_user_learning_evidence e
       JOIN sys.sys_learning_modules m ON m.learning_module_id = e.user_learning_evidence_module_id
      WHERE e.user_learning_evidence_user_id = p_user
        AND extract(year FROM e.user_learning_evidence_completed_at) = p_year
        AND NOT EXISTS (SELECT 1 FROM sys.sys_attendance a2
                         WHERE a2.attendance_subject_user_id = p_user
                           AND a2.attendance_date = e.user_learning_evidence_completed_at::date
                           AND a2.attendance_status = 'TRAINING'))
$fn$;

-- ----------------------------------------------------------------------------
-- Helper C4/3 — FRONTIERA DELLA STORIA: l'ultimo giorno per cui esiste una
-- presenza. È diversa dalla fine della finestra dei check (fine mese corrente):
-- senza questa distinzione, il primo di ogni mese il pavimento di monte-ore
-- crescerebbe da solo e C4a tornerebbe rosso per il semplice passare del tempo,
-- pretendendo formazione per mesi in cui la storia non ha nemmeno le presenze.
-- La finestra si sposta quando la STORIA avanza (cluster C12), non quando
-- avanza il calendario.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_c4_frontier()
RETURNS date LANGUAGE sql STABLE AS $fn$
  SELECT max(attendance_date) FROM sys.sys_attendance
   WHERE attendance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
$fn$;

-- ----------------------------------------------------------------------------
-- Helper C4/4 — pavimento di monte-ore annuo, PRO-RATA sui mesi effettivamente
-- coperti dalla STORIA e dal rapporto di lavoro (il 2023 entra da agosto, il
-- 2026 si ferma alla frontiera, l'assunto in corso d'anno non deve un anno
-- intero). Base 24 h (CCNL Credito 23/11/2023 — DOMINIO §1); 30 h per gli
-- iscritti al RUI sez. D e per i titolari EFPA (DOMINIO §2 e §4).
-- L'antiriciclaggio sta DENTRO il monte-ore, non si somma (Reg. IVASS 44/2019).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_c4_hours_floor(p_user uuid, p_year int, p_start date, p_end date)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
  WITH lim AS (SELECT LEAST(p_end, COALESCE(staging.storia36_c4_frontier(), p_end)) AS fine),
  b AS (
    SELECT CASE WHEN EXISTS (
             SELECT 1 FROM sys.sys_user_certifications c
              WHERE c.user_certification_user_id = p_user
                AND c.user_certification_issuer IN ('IVASS','EFPA Italia')) THEN 30 ELSE 24 END AS base,
           (SELECT min(e.user_employment_hire_date) FROM sys.sys_user_employment e
             WHERE e.user_employment_user_id = p_user) AS hire
  ), m AS (
    SELECT count(*) AS covered
      FROM b, lim, generate_series(1, 12) AS g(mm)
     WHERE make_date(p_year, g.mm, 1) <= lim.fine
       AND (make_date(p_year, g.mm, 1) + interval '1 month - 1 day')::date
           >= GREATEST(p_start, COALESCE(b.hire, p_start))
  )
  SELECT round(b.base * m.covered / 12.0, 2) FROM b, m
$fn$;

-- ----------------------------------------------------------------------------
-- Helper C4/5 — l'ARGOMENTO obbligatorio di un modulo, riconosciuto dal testo
-- del catalogo (codice o titolo) e non da una lista di uuid: così il check vale
-- anche sui moduli legacy (`AML-102`, `MIFID2-001`, `Antiriciclaggio AML`) e non
-- solo su quelli che il seed conosce. Serve a C4a(iii): l'obbligo di ORE non
-- implica l'obbligo di CONTENUTO — si possono fare 40 ore di trade finance e
-- restare inadempienti sull'antiriciclaggio.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_c4_module_topic(p_code text, p_title text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN p_code ILIKE '%AML%' OR p_title ILIKE '%antiricicl%'
      OR p_title ILIKE '%money laundering%' OR p_title ILIKE '%riciclaggio%'   THEN 'AML'
    WHEN p_code ILIKE '%MIFID%' OR p_title ILIKE '%mifid%'                      THEN 'MIFID'
    ELSE NULL
  END
$fn$;

-- ----------------------------------------------------------------------------
-- C4a — monte-ore di formazione: (i) nessun utente ATTIVO sotto il pavimento
-- pro-rata del proprio anno; (ii) la media aziendale dell'anno resta dentro una
-- banda plausibile [pavimento medio, 5× pavimento medio] — sotto il pavimento
-- l'azienda è inadempiente, oltre 5× (≈16 giornate piene) il dato non descrive
-- più una banca ma una scuola.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c4a(p_start date, p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  WITH ore AS (
    SELECT u.user_email,
           y.y,
           staging.storia36_c4_hours(u.user_id, y.y) AS h,
           staging.storia36_c4_hours_floor(u.user_id, y.y, p_start, p_end) AS floor_h
      FROM sys.sys_users u
      CROSS JOIN generate_series(extract(year FROM p_start)::int,
                                 extract(year FROM p_end)::int) AS y(y)
     WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND u.user_status = 'ACTIVE'
  )
  SELECT count(*), min(user_email || ' ' || y || ': ' || round(h,1) || 'h < ' || floor_h || 'h dovute')
    INTO v_cnt, v_sample
    FROM ore WHERE floor_h > 0 AND h < floor_h - 0.01;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4a: % anni-utente sotto il pavimento di monte-ore CCNL/IVASS (es. %)', v_cnt, v_sample;
  END IF;

  WITH ore AS (
    SELECT y.y,
           staging.storia36_c4_hours(u.user_id, y.y) AS h,
           staging.storia36_c4_hours_floor(u.user_id, y.y, p_start, p_end) AS floor_h
      FROM sys.sys_users u
      CROSS JOIN generate_series(extract(year FROM p_start)::int,
                                 extract(year FROM p_end)::int) AS y(y)
     WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND u.user_status = 'ACTIVE'
  ), agg AS (
    SELECT y, avg(h) AS media, avg(floor_h) AS media_floor FROM ore WHERE floor_h > 0 GROUP BY y
  )
  SELECT count(*), min(y || ': media ' || round(media,1) || 'h vs banda [' ||
                       round(media_floor,1) || ', ' || round(5*media_floor,1) || ']')
    INTO v_cnt, v_sample
    FROM agg WHERE media < media_floor OR media > 5 * media_floor;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4a(ii): % anni con media aziendale fuori banda (es. %)', v_cnt, v_sample;
  END IF;

  -- (iii) COPERTURA DI CONTENUTO — le ore non bastano: l'antiriciclaggio è
  -- annuale per tutti (Reg. IVASS 44/2019) e l'aggiornamento MiFID è annuale per
  -- chi distribuisce prodotti assicurativi/finanziari (CONSOB 20307/2018,
  -- mantenimento EFPA). Un anno pieno di trade finance non assolve nessuno dei due.
  WITH platea AS (
    SELECT u.user_id, u.user_email, y.y,
           staging.storia36_c4_hours_floor(u.user_id, y.y, p_start, p_end) AS floor_h,
           EXISTS (SELECT 1 FROM sys.sys_user_certifications c
                    WHERE c.user_certification_user_id = u.user_id
                      AND c.user_certification_issuer IN ('IVASS','EFPA Italia')) AS distributore
      FROM sys.sys_users u
      CROSS JOIN generate_series(extract(year FROM p_start)::int,
                                 extract(year FROM p_end)::int) AS y(y)
     WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND u.user_status = 'ACTIVE'
  ), mancanti AS (
    SELECT p.user_email, p.y, t.argomento
      FROM platea p
      CROSS JOIN (VALUES ('AML'), ('MIFID')) AS t(argomento)
     WHERE p.floor_h > 0
       AND (t.argomento = 'AML' OR p.distributore)
       AND NOT EXISTS (
         SELECT 1 FROM sys.sys_user_learning_evidence e
         JOIN sys.sys_learning_modules m ON m.learning_module_id = e.user_learning_evidence_module_id
          WHERE e.user_learning_evidence_user_id = p.user_id
            AND extract(year FROM e.user_learning_evidence_completed_at) = p.y
            AND staging.storia36_c4_module_topic(m.learning_module_code, m.learning_module_title)
                = t.argomento)
  )
  SELECT count(*), min(user_email || ' ' || y || ': manca ' || argomento)
    INTO v_cnt, v_sample FROM mancanti;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4a(iii): % anni-utente senza la formazione obbligatoria di contenuto (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C4b — certificazioni ABILITANTI sempre in corso di validità: (i) per ogni
-- utente ATTIVO e ogni schema con cadenza di rinnovo (helper C4/1), l'ultima
-- scadenza copre la frontiera; (ii) monotonia della catena — un rinnovo non può
-- scadere PRIMA di quello che sostituisce; (iii) coerenza elementare
-- rilascio ≤ scadenza. I titoli volontari (CFA, FRM, …) sono fuori: lasciarli
-- decadere è un fatto della vita, non un difetto del dato.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c4b(p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  -- la storia si valuta alla PROPRIA frontiera, non all'orologio: senza questo
  -- allineamento il check diventa rosso da solo al passare dei giorni.
  p_end := LEAST(p_end, COALESCE(staging.storia36_c4_frontier(), p_end));
  SELECT count(*), min(x.user_email || ' — ' || x.nome || ' scaduta il ' || x.ultima_scadenza)
    INTO v_cnt, v_sample
  FROM (
    SELECT u.user_email, c.user_certification_name AS nome,
           max(c.user_certification_expires_date) AS ultima_scadenza
      FROM sys.sys_user_certifications c
      JOIN sys.sys_users u ON u.user_id = c.user_certification_user_id
     WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND u.user_status = 'ACTIVE'
       AND staging.storia36_cert_is_abilitante(c.user_certification_issuer)
     GROUP BY 1, 2, c.user_certification_issuer
  ) x
  WHERE x.ultima_scadenza < p_end;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4b: % certificazioni abilitanti scadute e mai rinnovate su utenti attivi (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(u.user_email || ' — ' || ch.nome || ': rinnovo del ' || ch.d_iss ||
                       ' scade ' || ch.d_exp || ' < precedente ' || ch.prev_exp)
    INTO v_cnt, v_sample
  FROM (
    SELECT c.user_certification_user_id AS uid, c.user_certification_name AS nome,
           c.user_certification_issued_date AS d_iss, c.user_certification_expires_date AS d_exp,
           lag(c.user_certification_expires_date) OVER (
             PARTITION BY c.user_certification_user_id, c.user_certification_name,
                          c.user_certification_issuer
             ORDER BY c.user_certification_issued_date) AS prev_exp
      FROM sys.sys_user_certifications c
     WHERE c.user_certification_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  ) ch
  JOIN sys.sys_users u ON u.user_id = ch.uid
  WHERE ch.prev_exp IS NOT NULL AND ch.d_exp < ch.prev_exp;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4b(ii): % rinnovi che scadono prima del titolo sostituito (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(u.user_email || ' — ' || c.user_certification_name)
    INTO v_cnt, v_sample
  FROM sys.sys_user_certifications c
  JOIN sys.sys_users u ON u.user_id = c.user_certification_user_id
  WHERE c.user_certification_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND c.user_certification_issued_date IS NOT NULL
    AND c.user_certification_expires_date IS NOT NULL
    AND c.user_certification_expires_date < c.user_certification_issued_date;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4b(iii): % certificazioni che scadono prima di essere rilasciate (es. %)', v_cnt, v_sample;
  END IF;

  -- (iv) CONTINUITÀ della catena: uno schema abilitante non ammette scoperture.
  -- Non basta che l'ultimo anello copra la frontiera (i) né che le scadenze
  -- crescano (ii): fra un anello e il successivo ci può essere un buco in cui la
  -- persona ha operato senza titolo. Il rinnovo si chiede PRIMA della scadenza.
  SELECT count(*), min(u.user_email || ' — ' || ch.nome || ': scoperto dal ' ||
                       ch.prev_exp || ' al ' || ch.d_iss)
    INTO v_cnt, v_sample
  FROM (
    SELECT c.user_certification_user_id AS uid, c.user_certification_name AS nome,
           c.user_certification_issued_date AS d_iss,
           lag(c.user_certification_expires_date) OVER (
             PARTITION BY c.user_certification_user_id, c.user_certification_name,
                          c.user_certification_issuer
             ORDER BY c.user_certification_issued_date) AS prev_exp
      FROM sys.sys_user_certifications c
     WHERE c.user_certification_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND staging.storia36_cert_is_abilitante(c.user_certification_issuer)
  ) ch
  JOIN sys.sys_users u ON u.user_id = ch.uid
  WHERE ch.prev_exp IS NOT NULL AND ch.d_iss > ch.prev_exp;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4b(iv): % rinnovi ottenuti DOPO la scadenza del titolo precedente (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C4c — l'aula tiene insieme i suoi tre pezzi: (i) l'evidenza d'aula cade
-- DENTRO il periodo della sua iniziativa; (ii) chi ha un'evidenza d'aula ha
-- anche l'iscrizione a quella iniziativa (non si frequenta un corso a cui non
-- si è iscritti); (iii) i partecipanti non superano la capienza dichiarata.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c4c(p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  -- la storia si valuta alla PROPRIA frontiera, non all'orologio: senza questo
  -- allineamento il check diventa rosso da solo al passare dei giorni.
  p_end := LEAST(p_end, COALESCE(staging.storia36_c4_frontier(), p_end));
  -- (0) il LEGAME deve esistere prima di poter essere verificato: i predicati
  -- successivi partono da un JOIN sul codice iniziativa scritto nel metadata, e
  -- un JOIN interno che non risolve non produce righe — cioè tacerebbe proprio
  -- nel caso peggiore (legame perso). Questo predicato è l'anti-join che lo impedisce.
  SELECT count(*), min(u.user_email || ' il ' || e.user_learning_evidence_completed_at::date)
    INTO v_cnt, v_sample
  FROM sys.sys_user_learning_evidence e
  JOIN sys.sys_users u ON u.user_id = e.user_learning_evidence_user_id
  WHERE e.user_learning_evidence_metadata->>'kind' = 'AULA'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_training_initiatives ti
       WHERE ti.training_initiative_code = e.user_learning_evidence_metadata->>'initiative'
         AND ti.training_initiative_tenant_id = e.user_learning_evidence_tenant_id);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4c(0): % evidenze d''aula il cui codice iniziativa non risolve (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(u.user_email || ' — ' || ti.training_initiative_code || ' il ' ||
                       e.user_learning_evidence_completed_at::date)
    INTO v_cnt, v_sample
  FROM sys.sys_user_learning_evidence e
  JOIN sys.sys_users u ON u.user_id = e.user_learning_evidence_user_id
  JOIN sys.sys_training_initiatives ti
    ON ti.training_initiative_code = e.user_learning_evidence_metadata->>'initiative'
   AND ti.training_initiative_tenant_id = e.user_learning_evidence_tenant_id
  WHERE e.user_learning_evidence_metadata->>'kind' = 'AULA'
    AND (e.user_learning_evidence_completed_at::date < ti.training_initiative_start_date
      OR e.user_learning_evidence_completed_at::date
         > COALESCE(ti.training_initiative_end_date, p_end));
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4c: % evidenze d''aula fuori dal periodo della loro iniziativa (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(u.user_email || ' — ' || ti.training_initiative_code)
    INTO v_cnt, v_sample
  FROM (SELECT DISTINCT e.user_learning_evidence_user_id AS uid,
                        e.user_learning_evidence_tenant_id AS tid,
                        e.user_learning_evidence_metadata->>'initiative' AS code
          FROM sys.sys_user_learning_evidence e
         WHERE e.user_learning_evidence_metadata->>'kind' = 'AULA') d
  JOIN sys.sys_users u ON u.user_id = d.uid
  JOIN sys.sys_training_initiatives ti
    ON ti.training_initiative_code = d.code AND ti.training_initiative_tenant_id = d.tid
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_user_learning_assignments a
     WHERE a.user_learning_assignment_user_id = d.uid
       AND a.user_learning_assignment_initiative_id = ti.training_initiative_id);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4c(ii): % frequenze d''aula senza iscrizione all''iniziativa (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(ti.training_initiative_code || ': ' || x.n || ' partecipanti > capienza ' ||
                       ti.training_initiative_capacity)
    INTO v_cnt, v_sample
  FROM sys.sys_training_initiatives ti
  JOIN LATERAL (
    SELECT count(DISTINCT a.user_learning_assignment_user_id) AS n
      FROM sys.sys_user_learning_assignments a
     WHERE a.user_learning_assignment_initiative_id = ti.training_initiative_id) x ON true
  WHERE ti.training_initiative_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND ti.training_initiative_capacity IS NOT NULL
    AND x.n > ti.training_initiative_capacity;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4c(iii): % iniziative con più partecipanti della capienza (es. %)', v_cnt, v_sample;
  END IF;

  -- (iv) si è frequentato IL corso di quell'edizione, non un altro: il modulo
  -- dell'evidenza deve coincidere con quello dell'iniziativa che la ospita.
  SELECT count(*), min(u.user_email || ' — ' || ti.training_initiative_code)
    INTO v_cnt, v_sample
  FROM sys.sys_user_learning_evidence e
  JOIN sys.sys_users u ON u.user_id = e.user_learning_evidence_user_id
  JOIN sys.sys_training_initiatives ti
    ON ti.training_initiative_code = e.user_learning_evidence_metadata->>'initiative'
   AND ti.training_initiative_tenant_id = e.user_learning_evidence_tenant_id
  WHERE e.user_learning_evidence_metadata->>'kind' = 'AULA'
    AND e.user_learning_evidence_module_id IS DISTINCT FROM ti.training_initiative_module_id;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4c(iv): % evidenze d''aula su un corso diverso da quello della loro edizione (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C4d — ogni iniziativa è GIUSTIFICATA e legale: (i) il suo modulo è mappato ad
-- almeno una competenza (è la giustificazione: si fa formazione per una skill
-- che serve, non per riempire un calendario); (ii) il modulo è utilizzabile nel
-- tenant e (iii) il docente appartiene al tenant — le stesse due regole che il
-- service `training-initiatives` impone via API, qui pretese anche sul dato;
-- (iv) se c'è un docente, il modulo non può essere in autoapprendimento;
-- (v) coerenza del periodo e dello stato.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c4d(p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  -- la storia si valuta alla PROPRIA frontiera, non all'orologio: senza questo
  -- allineamento il check diventa rosso da solo al passare dei giorni.
  p_end := LEAST(p_end, COALESCE(staging.storia36_c4_frontier(), p_end));
  SELECT count(*), min(ti.training_initiative_code) INTO v_cnt, v_sample
  FROM sys.sys_training_initiatives ti
  WHERE ti.training_initiative_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings sm
                     WHERE sm.skill_learning_mapping_module_id = ti.training_initiative_module_id);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4d: % iniziative su moduli non mappati ad alcuna competenza (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(ti.training_initiative_code) INTO v_cnt, v_sample
  FROM sys.sys_training_initiatives ti
  JOIN sys.sys_learning_modules m ON m.learning_module_id = ti.training_initiative_module_id
  WHERE ti.training_initiative_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND m.learning_module_is_global IS NOT TRUE
    AND m.learning_module_tenant_id IS DISTINCT FROM ti.training_initiative_tenant_id;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4d(ii): % iniziative su moduli di un altro tenant (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(ti.training_initiative_code) INTO v_cnt, v_sample
  FROM sys.sys_training_initiatives ti
  JOIN sys.sys_users f ON f.user_id = ti.training_initiative_facilitator_user_id
  WHERE ti.training_initiative_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND f.user_tenant_id IS DISTINCT FROM ti.training_initiative_tenant_id;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4d(iii): % iniziative con docente di un altro tenant (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(ti.training_initiative_code || ' → ' || m.learning_module_code ||
                       ' (' || m.learning_module_delivery || ')')
    INTO v_cnt, v_sample
  FROM sys.sys_training_initiatives ti
  JOIN sys.sys_learning_modules m ON m.learning_module_id = ti.training_initiative_module_id
  WHERE ti.training_initiative_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND ti.training_initiative_facilitator_user_id IS NOT NULL
    AND m.learning_module_delivery = 'SELF_PACED';
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4d(iv): % iniziative con docente su moduli in autoapprendimento (es. %)', v_cnt, v_sample;
  END IF;

  -- (v) periodo e stato: fine dopo inizio; COMPLETED esige una fine avvenuta;
  -- IN_PROGRESS non può avere il periodo già concluso (un corso «in corso» che è
  -- finito tre mesi fa è uno stato dimenticato, ed è il caso che il seed rischia
  -- di produrre al passare del tempo).
  SELECT count(*), min(ti.training_initiative_code || ' [' || ti.training_initiative_status || ']')
    INTO v_cnt, v_sample
  FROM sys.sys_training_initiatives ti
  WHERE ti.training_initiative_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND ((ti.training_initiative_end_date IS NOT NULL
          AND ti.training_initiative_end_date < ti.training_initiative_start_date)
      OR (ti.training_initiative_status = 'COMPLETED'
          AND (ti.training_initiative_end_date IS NULL OR ti.training_initiative_end_date > p_end))
      OR (ti.training_initiative_status = 'IN_PROGRESS'
          AND ti.training_initiative_start_date > p_end)
      OR (ti.training_initiative_status = 'IN_PROGRESS'
          AND ti.training_initiative_end_date IS NOT NULL
          AND ti.training_initiative_end_date < p_end));
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4d(v): % iniziative con periodo o stato incoerenti (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C4e — QUADRATURA aula ↔ presenze: i giorni TRAINING dell'attendance sono un
-- fatto già scritto dal C1 e non si toccano (UNIQUE tenant,utente,data). Ogni
-- giorno d'aula deve avere la sua traccia formativa nello stesso giorno,
-- altrimenti l'azienda ha registrato una giornata di formazione che non risulta
-- da nessuna parte.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c4e()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(u.user_email || ' il ' || a.attendance_date) INTO v_cnt, v_sample
  FROM sys.sys_attendance a
  JOIN sys.sys_users u ON u.user_id = a.attendance_subject_user_id
  WHERE a.attendance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND a.attendance_status = 'TRAINING'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_learning_evidence e
       WHERE e.user_learning_evidence_user_id = a.attendance_subject_user_id
         AND e.user_learning_evidence_completed_at::date = a.attendance_date
         -- la traccia dev'essere di AULA: un completamento in autoapprendimento
         -- capitato nello stesso giorno non è la prova di quella giornata d'aula
         AND e.user_learning_evidence_metadata->>'kind' = 'AULA');
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4e: % giornate d''aula senza traccia di frequenza in quel giorno (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C4f — il ciclo si chiude: lacuna → azione → formazione. (i) un'azione
-- formativa su una lacuna MATURA (rilevata da almeno 90 giorni) non può essere
-- ancora «proposta» — o è partita, o è stata chiusa, o è stata annullata; le
-- lacune recenti restano legittimamente proposte; (ii) un'azione CHIUSA esige
-- formazione davvero erogata dopo la rilevazione; (iii) un'azione che non è più
-- una proposta ha un responsabile e una scadenza; (iv) un piano di chiusura
-- attivo ha una data obiettivo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c4f(p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(u.user_email || ' — lacuna del ' || g.learning_gap_detected_at::date)
    INTO v_cnt, v_sample
  FROM sys.sys_gap_closure_actions a
  JOIN sys.sys_learning_gaps g ON g.learning_gap_id = a.gap_closure_action_gap_id
  JOIN sys.sys_users u ON u.user_id = g.learning_gap_user_id
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND a.gap_closure_action_kind = 'TRAINING_ASSIGNMENT'
    AND a.gap_closure_action_status = 'PROPOSED'
    -- maturità misurata sulla frontiera della STORIA, non sul calendario: una
    -- lacuna non «invecchia» perché è passato un mese di orologio reale
    AND g.learning_gap_detected_at::date
        <= LEAST(p_end, COALESCE(staging.storia36_c4_frontier(), p_end)) - 90;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4f: % azioni formative ancora «proposte» su lacune mature (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(u.user_email || ' — lacuna del ' || g.learning_gap_detected_at::date)
    INTO v_cnt, v_sample
  FROM sys.sys_gap_closure_actions a
  JOIN sys.sys_learning_gaps g ON g.learning_gap_id = a.gap_closure_action_gap_id
  JOIN sys.sys_users u ON u.user_id = g.learning_gap_user_id
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND a.gap_closure_action_kind = 'TRAINING_ASSIGNMENT'
    AND a.gap_closure_action_status = 'COMPLETED'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_learning_evidence e
       WHERE e.user_learning_evidence_user_id = g.learning_gap_user_id
         AND e.user_learning_evidence_completed_at > g.learning_gap_detected_at);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4f(ii): % azioni chiuse senza formazione successiva alla rilevazione (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(a.gap_closure_action_id::text || ' [' || a.gap_closure_action_status || ']')
    INTO v_cnt, v_sample
  FROM sys.sys_gap_closure_actions a
  WHERE a.gap_closure_action_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND a.gap_closure_action_status <> 'PROPOSED'
    AND (a.gap_closure_action_due_date IS NULL OR a.gap_closure_action_owner_user_id IS NULL);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4f(iii): % azioni avviate senza responsabile o senza scadenza (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*), min(p.gap_closure_plan_id::text || ' [' || p.gap_closure_plan_status || ']')
    INTO v_cnt, v_sample
  FROM sys.sys_gap_closure_plans p
  WHERE p.gap_closure_plan_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND p.gap_closure_plan_status IN ('ACTIVE','COMPLETED')
    AND p.gap_closure_plan_target_completion_date IS NULL;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4f(iv): % piani di chiusura attivi senza data obiettivo (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C4g — PLAUSIBILITÀ TEMPORALE della formazione. I sei check precedenti guardano
-- giorni, mai orari e mai forme di distribuzione: sono ciechi proprio dove un
-- generatore lascia le sue impronte. (i) una giornata d'aula non si chiude dopo
-- che la persona ha timbrato l'uscita; (ii) su 36 mesi di storia nessun mese
-- dell'anno può restare a zero corsi a distanza — gennaio vuoto quattro anni di
-- fila è la firma di una formula, non un fatto aziendale; (iii) un corso «in
-- autoapprendimento» non lo completano dieci persone lo stesso pomeriggio.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c4g()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
  v_tot bigint;
BEGIN
  SELECT count(*), min(u.user_email || ' il ' || a.attendance_date || ': corso chiuso alle ' ||
                       to_char(e.user_learning_evidence_completed_at AT TIME ZONE 'Europe/Rome', 'HH24:MI') ||
                       ', uscita timbrata alle ' || to_char(a.attendance_clock_out, 'HH24:MI'))
    INTO v_cnt, v_sample
  FROM sys.sys_user_learning_evidence e
  JOIN sys.sys_users u ON u.user_id = e.user_learning_evidence_user_id
  JOIN sys.sys_attendance a
    ON a.attendance_subject_user_id = e.user_learning_evidence_user_id
   AND a.attendance_date = (e.user_learning_evidence_completed_at AT TIME ZONE 'Europe/Rome')::date
  WHERE e.user_learning_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND e.user_learning_evidence_metadata->>'storia36' = 'C4'
    AND a.attendance_clock_out IS NOT NULL
    AND (e.user_learning_evidence_completed_at AT TIME ZONE 'Europe/Rome')::time > a.attendance_clock_out;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4g: % completamenti registrati dopo l''uscita timbrata dello stesso giorno (es. %)', v_cnt, v_sample;
  END IF;

  SELECT count(*) INTO v_tot FROM sys.sys_user_learning_evidence
   WHERE user_learning_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
     AND user_learning_evidence_metadata->>'kind' = 'SELF_PACED';
  IF v_tot > 200 THEN
    SELECT count(*), min('mese ' || mm::text) INTO v_cnt, v_sample
    FROM generate_series(1, 12) AS g(mm)
    WHERE NOT EXISTS (
      SELECT 1 FROM sys.sys_user_learning_evidence e
       WHERE e.user_learning_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
         AND e.user_learning_evidence_metadata->>'kind' = 'SELF_PACED'
         AND extract(month FROM e.user_learning_evidence_completed_at) = g.mm);
    IF v_cnt > 0 THEN
      RAISE EXCEPTION 'C4g(ii): % mesi dell''anno senza un solo corso a distanza su % righe (es. %)', v_cnt, v_tot, v_sample;
    END IF;
  END IF;

  -- (iii) la soglia è sull'ORA, non sul giorno. Che sei persone chiudano lo
  -- stesso corso online lo stesso giorno è normale (effetto scadenza: la
  -- campagna obbligatoria si chiude tutta insieme). Che lo chiudano nella stessa
  -- ORA no: quella è la firma di un generatore, non di sei persone che studiano.
  SELECT count(*), min(m.learning_module_code || ' il ' || to_char(x.ora, 'YYYY-MM-DD HH24:00') ||
                       ': ' || x.n || ' completamenti nella stessa ora')
    INTO v_cnt, v_sample
  FROM (
    SELECT e.user_learning_evidence_module_id AS mid,
           date_trunc('hour', e.user_learning_evidence_completed_at AT TIME ZONE 'Europe/Rome') AS ora,
           count(DISTINCT e.user_learning_evidence_user_id) AS n
      FROM sys.sys_user_learning_evidence e
     WHERE e.user_learning_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND e.user_learning_evidence_metadata->>'kind' = 'SELF_PACED'
     GROUP BY 1, 2
  ) x
  JOIN sys.sys_learning_modules m ON m.learning_module_id = x.mid
  WHERE x.n > 3;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4g(iii): % ore con più di 3 persone che chiudono lo stesso corso in autoapprendimento (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- Helper C4/6 — dove lavora ciascuno. Le squadre di emergenza si designano per
-- SEDE, non per organigramma: la sede di una persona si ricava risalendo l'albero
-- delle unità organizzative fino alla prima che è una filiale — la PIÙ VICINA,
-- perché chi sta sotto una filiale sta anche, più in alto, sotto la sede centrale.
-- Senza questo aggancio la designazione degli addetti sarebbe un'invenzione.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW staging.storia36_sede_personale AS
WITH RECURSIVE risalita AS (
  SELECT u.user_id, p.position_organization_unit_id AS ou_id, 0 AS distanza
    FROM sys.sys_users u
    JOIN sys.sys_user_position_assignments a
      ON a.user_position_assignment_user_id = u.user_id
     AND a.user_position_assignment_kind = 'PRIMARY'
     AND a.user_position_assignment_status = 'ACTIVE'
    JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
   WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
     AND u.user_status = 'ACTIVE'
     AND p.position_organization_unit_id IS NOT NULL
  UNION ALL
  SELECT r.user_id, o.organization_unit_parent_id, r.distanza + 1
    FROM risalita r
    JOIN sys.sys_organization_units o ON o.organization_unit_id = r.ou_id
   WHERE o.organization_unit_parent_id IS NOT NULL
)
SELECT DISTINCT ON (r.user_id)
       r.user_id, b.branch_code, b.branch_city, r.distanza
  FROM risalita r
  JOIN sys.sys_branches b ON b.branch_organization_unit_id = r.ou_id
 WHERE b.branch_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
 ORDER BY r.user_id, r.distanza;

-- ----------------------------------------------------------------------------
-- C4h — SICUREZZA SUL LAVORO: l'obbligo non è uno solo e non è uguale per tutti.
-- C4b verifica che le abilitazioni possedute non scadano; qui si verifica il
-- passo prima, cioè che chi DEVE averle le abbia — ed è il predicato che vede
-- chi non ha alcun record, l'unico invisibile a un controllo sulle scadenze.
-- Le platee non sono elenchi scritti a mano: si derivano dall'organigramma
-- (preposto = ha riporti diretti), dal contratto (dirigente = inquadramento) e
-- dalla struttura (datore di lavoro = vertice; squadre di emergenza = per
-- filiale). Cadenze e destinatari: DOMINIO §5.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c4h(p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  p_end := LEAST(p_end, COALESCE(staging.storia36_c4_frontier(), p_end));

  -- (i) formazione lavoratori: obbligo di OGNI lavoratore, senza eccezioni
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_users u
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_certifications c
       WHERE c.user_certification_user_id = u.user_id
         AND c.user_certification_name ILIKE '%Sicurezza Base%'
         AND c.user_certification_expires_date >= p_end);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4h: % lavoratori attivi senza formazione sicurezza valida (es. %)', v_cnt, v_sample;
  END IF;

  -- (ii) preposti: chi ha riporti diretti nell'organigramma
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_users u
  JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_user_id = u.user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND EXISTS (SELECT 1 FROM sys.sys_positions p
                 WHERE p.position_reports_to_position_id = a.user_position_assignment_position_id)
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_certifications c
       WHERE c.user_certification_user_id = u.user_id
         AND c.user_certification_name ILIKE '%preposti%'
         AND c.user_certification_expires_date >= p_end);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4h(ii): % preposti senza aggiornamento valido (es. %)', v_cnt, v_sample;
  END IF;

  -- (iii) dirigenti per la sicurezza: l'inquadramento contrattuale li identifica
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_users u
  JOIN sys.sys_user_contracts ct ON ct.user_contract_user_id = u.user_id
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND ct.user_contract_ccnl_level = 'Dirigente'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_certifications c
       WHERE c.user_certification_user_id = u.user_id
         AND c.user_certification_name ILIKE '%dirigenti per la sicurezza%'
         AND c.user_certification_expires_date >= p_end);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4h(iii): % dirigenti senza formazione sicurezza valida (es. %)', v_cnt, v_sample;
  END IF;

  -- (iv) datore di lavoro: chi occupa la posizione al vertice dell'organigramma
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_users u
  JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_user_id = u.user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND p.position_reports_to_position_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_certifications c
       WHERE c.user_certification_user_id = u.user_id
         AND c.user_certification_name ILIKE '%datore di lavoro%'
         AND c.user_certification_expires_date >= p_end);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4h(iv): % al vertice senza formazione da datore di lavoro (es. %)', v_cnt, v_sample;
  END IF;

  -- (v) squadre di emergenza: ogni sede con personale ha almeno un addetto
  -- antincendio e uno di primo soccorso in corso di validità
  SELECT count(*), min(x.sede || ': manca ' || x.figura) INTO v_cnt, v_sample
  FROM (
    SELECT s.branch_code AS sede, f.figura
      FROM staging.storia36_sede_personale s
      CROSS JOIN (VALUES ('%antincendio%'), ('%primo soccorso%')) AS f(figura)
     WHERE NOT EXISTS (
       SELECT 1 FROM staging.storia36_sede_personale s2
        JOIN sys.sys_user_certifications c ON c.user_certification_user_id = s2.user_id
       WHERE s2.branch_code = s.branch_code
         AND c.user_certification_name ILIKE f.figura
         AND c.user_certification_expires_date >= p_end)
     GROUP BY 1, 2
  ) x;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C4h(v): % sedi senza squadra di emergenza in regola (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ============================================================================
-- SELFTEST (con -v selftest=1) — la falsificabilità: per ogni check nuovo si
-- inietta una violazione in SUBTRANSAZIONE (rollback garantito dal pattern
-- exception) e si pretende che il check scatti. Un check mai visto fallire non
-- prova nulla.
--   - G3: nasce ROSSO al C0 — il suo "fallire" è già dimostrato dal runner;
--     selftest dedicato quando diventa verde (C1).
--   - G5: avvolge le viste strutturali PRE-esistenti (pnpm db:validate), non è
--     una post-condizione nuova di storia36.
-- ============================================================================
\if :selftest
DO $$
DECLARE
  v_end date := current_setting('storia36.window_end')::date;
  v_fired boolean;
  v_u     uuid;    -- soggetto scelto per le iniezioni puntuali (C4)
BEGIN
  -- ST-G1: una presenza spostata oltre la finestra deve far scattare G1
  v_fired := false;
  BEGIN
    UPDATE sys.sys_attendance SET attendance_date = v_end + 999
     WHERE ctid = (SELECT ctid FROM sys.sys_attendance LIMIT 1);
    PERFORM staging.storia36_check_g1(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'G1:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST G1 FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST G1 (violazione iniettata rilevata, rollback)';

  -- ST-G2: una presenza retrodatata a prima di ogni assunzione deve far scattare G2
  v_fired := false;
  BEGIN
    UPDATE sys.sys_attendance SET attendance_date = DATE '1990-01-01'
     WHERE ctid = (SELECT ctid FROM sys.sys_attendance LIMIT 1);
    PERFORM staging.storia36_check_g2();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'G2:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST G2 FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST G2 (violazione iniettata rilevata, rollback)';

  -- ST-G4: un contratto con end < start deve far scattare G4
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_contracts
       SET user_contract_end_date = user_contract_start_date - 1
     WHERE ctid = (SELECT ctid FROM sys.sys_user_contracts LIMIT 1);
    PERFORM staging.storia36_check_g4();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'G4:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST G4 FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST G4 (violazione iniettata rilevata, rollback)';

  -- ST-G6: un cluster senza corsa a delta 0 deve far scattare G6
  v_fired := false;
  BEGIN
    INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
    VALUES ('C0', 'SELFTEST', 1, 1);
    DELETE FROM staging.storia36_runs WHERE twice_run_delta = 0;
    PERFORM staging.storia36_check_g6();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'G6:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST G6 FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST G6 (violazione iniettata rilevata, rollback)';

  -- ST-C1a: cancellare le presenze di un utente in un mese coperto deve far scattare C1a
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_attendance
     WHERE attendance_subject_user_id = (
             SELECT attendance_subject_user_id FROM sys.sys_attendance
             JOIN sys.sys_user_contracts c ON c.user_contract_user_id = attendance_subject_user_id
             WHERE c.user_contract_ccnl_level NOT LIKE 'QD%'
               AND c.user_contract_ccnl_level NOT IN ('Dirigente','Quadro')
             LIMIT 1);
    PERFORM staging.storia36_check_c1a(current_setting('storia36.window_start')::date);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C1a:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C1a FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C1a (violazione iniettata rilevata, rollback)';

  -- ST-C1b: una presenza spostata a domenica deve far scattare C1b
  v_fired := false;
  BEGIN
    UPDATE sys.sys_attendance SET attendance_date = DATE '2025-11-02'  -- domenica
     WHERE ctid = (SELECT ctid FROM sys.sys_attendance
                   WHERE attendance_date <> DATE '2025-11-02' LIMIT 1);
    PERFORM staging.storia36_check_c1b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C1b:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C1b FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C1b (violazione iniettata rilevata, rollback)';

  -- ST-C1c: un balance gonfiato di 7 giorni deve far scattare C1c(ii)
  v_fired := false;
  BEGIN
    UPDATE sys.sys_time_off_balances SET balance_used_days = balance_used_days + 7
     WHERE ctid = (SELECT ctid FROM sys.sys_time_off_balances
                   WHERE balance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                     AND balance_leave_type = 'VACATION' LIMIT 1);
    PERFORM staging.storia36_check_c1c(current_setting('storia36.window_start')::date);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C1c%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C1c FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C1c (violazione iniettata rilevata, rollback)';

  -- ST-C1d: un giorno con tutto l'organico in ferie deve far scattare C1d
  v_fired := false;
  BEGIN
    UPDATE sys.sys_attendance SET attendance_status = 'VACATION'
     WHERE attendance_date = (SELECT max(attendance_date) FROM sys.sys_attendance);
    PERFORM staging.storia36_check_c1d();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C1d:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C1d FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C1d (violazione iniettata rilevata, rollback)';

  -- ST-C2a: cancellare le review 2024 di un utente eleggibile deve far scattare C2a
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_performance_reviews
     WHERE review_subject_user_id = (
             SELECT review_subject_user_id FROM sys.sys_performance_reviews
             WHERE review_subject_user_id IS NOT NULL
               AND extract(year FROM review_period_end) = 2024 LIMIT 1);
    PERFORM staging.storia36_check_c2a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C2a:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C2a FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C2a (violazione iniettata rilevata, rollback)';

  -- ST-C2c: una review col reviewer = soggetto stesso deve far scattare C2c
  v_fired := false;
  BEGIN
    UPDATE sys.sys_performance_reviews
       SET review_reviewer_user_id = review_subject_user_id
     WHERE ctid = (SELECT ctid FROM sys.sys_performance_reviews
                   WHERE review_subject_user_id IS NOT NULL LIMIT 1);
    PERFORM staging.storia36_check_c2c();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C2c:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C2c FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C2c (violazione iniettata rilevata, rollback)';

  -- ST-C2d: una risposta PEER resa self deve far scattare C2d
  v_fired := false;
  BEGIN
    UPDATE sys.sys_feedback_360_responses
       SET response_reviewer_user_id = response_target_user_id
     WHERE ctid = (SELECT ctid FROM sys.sys_feedback_360_responses
                   WHERE response_relationship_type = 'PEER' LIMIT 1);
    PERFORM staging.storia36_check_c2d();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C2d:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C2d FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C2d (violazione iniettata rilevata, rollback)';

  -- ST-C2b: spostare fuori anno i check-in di un soggetto con review annuale
  v_fired := false;
  BEGIN
    UPDATE sys.sys_goal_check_ins SET check_in_date = check_in_date - interval '3 years'
     WHERE check_in_subject_user_id = (
             SELECT r.review_subject_user_id FROM sys.sys_performance_reviews r
             JOIN sys.sys_user_employment e ON e.user_employment_user_id = r.review_subject_user_id
             WHERE r.review_type = 'ANNUAL' AND r.review_status = 'COMPLETED'
               AND extract(year FROM r.review_period_end) = 2024
               AND e.user_employment_hire_date <= DATE '2024-10-01'
             LIMIT 1);
    PERFORM staging.storia36_check_c2b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C2b:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C2b FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C2b (violazione iniettata rilevata, rollback)';

  -- ST-C2e: un goal non terminale col progress scollegato dall'ultimo check-in
  v_fired := false;
  BEGIN
    UPDATE sys.sys_goals SET goal_progress_percent = LEAST(goal_progress_percent + 17, 99)
     WHERE ctid = (SELECT g.ctid FROM sys.sys_goals g
                   WHERE g.goal_status NOT IN ('COMPLETED','CANCELLED')
                     AND EXISTS (SELECT 1 FROM sys.sys_goal_check_ins c WHERE c.check_in_goal_id = g.goal_id)
                   LIMIT 1);
    PERFORM staging.storia36_check_c2e();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C2e:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C2e FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C2e (violazione iniettata rilevata, rollback)';

  -- ST-C2f: una review spostata su un soggetto dell'altro tenant
  v_fired := false;
  BEGIN
    UPDATE sys.sys_performance_reviews
       SET review_subject_user_id = (SELECT user_id FROM sys.sys_users
                                     WHERE user_tenant_id <> '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1)
     WHERE ctid = (SELECT ctid FROM sys.sys_performance_reviews
                   WHERE review_subject_user_id IS NOT NULL LIMIT 1);
    PERFORM staging.storia36_check_c2f();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C2f:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C2f FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C2f (violazione iniettata rilevata, rollback)';

  -- ST-C2g: un check-in spostato a domenica
  v_fired := false;
  BEGIN
    UPDATE sys.sys_goal_check_ins SET check_in_date = DATE '2025-11-02'
     WHERE ctid = (SELECT ctid FROM sys.sys_goal_check_ins LIMIT 1);
    PERFORM staging.storia36_check_c2g();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C2g:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C2g FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C2g (violazione iniettata rilevata, rollback)';

  -- ST-C3b: cancellare le buste di un mese a un utente deve far scattare C3b
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_user_pay_slips
     WHERE ctid = (SELECT ctid FROM sys.sys_user_pay_slips LIMIT 1);
    PERFORM staging.storia36_check_c3b(current_setting('storia36.window_start')::date);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C3b:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C3b FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C3b (violazione iniettata rilevata, rollback)';

  -- ST-C3c: una busta col gross azzerato deve far scattare C3c
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_pay_slips SET user_pay_slip_gross_pay = 100
     WHERE ctid = (SELECT p.ctid FROM sys.sys_user_pay_slips p
                   JOIN sys.sys_user_contracts c ON c.user_contract_user_id = p.user_pay_slip_user_id
                   WHERE c.user_contract_ccnl_level LIKE '3A%' LIMIT 1);
    PERFORM staging.storia36_check_c3c(current_setting('storia36.window_start')::date);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C3c:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C3c FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C3c (violazione iniettata rilevata, rollback)';

  -- ST-C3d: un variable-pay gonfiato oltre il cap deve far scattare C3d
  v_fired := false;
  BEGIN
    UPDATE sys.sys_variable_pay_calculations
       SET variable_pay_calculation_amount_eur = 999999
     WHERE ctid = (SELECT ctid FROM sys.sys_variable_pay_calculations LIMIT 1);
    PERFORM staging.storia36_check_c3d();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C3d:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C3d FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C3d (violazione iniettata rilevata, rollback)';

  -- ST-C3a: cancellare un handoff deve far scattare C3a
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_payroll_handoff_records
     WHERE ctid = (SELECT ctid FROM sys.sys_payroll_handoff_records LIMIT 1);
    PERFORM staging.storia36_check_c3a(current_setting('storia36.window_start')::date);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C3a:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C3a FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C3a (violazione iniettata rilevata, rollback)';

  -- ST-C3e: azzerare la busta di giugno di un percettore deve far scattare C3e
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_pay_slips SET user_pay_slip_gross_pay = 10
     WHERE ctid = (SELECT p.ctid FROM sys.sys_user_pay_slips p
                   JOIN sys.sys_variable_pay_calculations v
                     ON v.variable_pay_calculation_user_id = p.user_pay_slip_user_id
                    AND v.variable_pay_calculation_amount_eur IS NOT NULL
                    AND extract(year FROM v.variable_pay_calculation_period_start)::int IN (2023, 2024)
                    AND p.user_pay_slip_period = (extract(year FROM v.variable_pay_calculation_period_start)::int + 1) || '-06'
                   LIMIT 1);
    PERFORM staging.storia36_check_c3e();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C3e:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C3e FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C3e (violazione iniettata rilevata, rollback)';

  -- ST-C4a: azzerare aula ed evidenze di un utente deve far scattare il pavimento
  v_fired := false;
  BEGIN
    SELECT a.attendance_subject_user_id INTO v_u FROM sys.sys_attendance a
      JOIN sys.sys_users u ON u.user_id = a.attendance_subject_user_id
     WHERE a.attendance_status = 'TRAINING' AND u.user_status = 'ACTIVE'
       AND a.attendance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1;
    DELETE FROM sys.sys_attendance
     WHERE attendance_status = 'TRAINING' AND attendance_subject_user_id = v_u;
    DELETE FROM sys.sys_user_learning_evidence WHERE user_learning_evidence_user_id = v_u;
    PERFORM staging.storia36_check_c4a(current_setting('storia36.window_start')::date, v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4a%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4a FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4a (violazione iniettata rilevata, rollback)';

  -- ST-C4b: far scadere l'intera catena RUI di un utente deve far scattare C4b
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_certifications SET user_certification_expires_date = v_end - 400
     WHERE user_certification_issuer = 'IVASS'
       AND user_certification_user_id = (
             SELECT c.user_certification_user_id FROM sys.sys_user_certifications c
              JOIN sys.sys_users u ON u.user_id = c.user_certification_user_id
              WHERE c.user_certification_issuer = 'IVASS' AND u.user_status = 'ACTIVE' LIMIT 1);
    PERFORM staging.storia36_check_c4b(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4b%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4b FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4b (violazione iniettata rilevata, rollback)';

  -- ST-C4c: spostare un'evidenza d'aula fuori dal periodo della sua iniziativa
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_learning_evidence
       SET user_learning_evidence_completed_at = user_learning_evidence_completed_at - interval '400 days'
     WHERE ctid = (SELECT e.ctid FROM sys.sys_user_learning_evidence e
                    WHERE e.user_learning_evidence_metadata->>'kind' = 'AULA' LIMIT 1);
    PERFORM staging.storia36_check_c4c(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4c%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4c FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4c (violazione iniettata rilevata, rollback)';

  -- ST-C4d: puntare un'iniziativa a un modulo non mappato ad alcuna competenza
  v_fired := false;
  BEGIN
    UPDATE sys.sys_training_initiatives
       SET training_initiative_module_id = (
             SELECT m.learning_module_id FROM sys.sys_learning_modules m
              WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings sm
                                 WHERE sm.skill_learning_mapping_module_id = m.learning_module_id)
                AND (m.learning_module_is_global OR m.learning_module_tenant_id
                     = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0')
              LIMIT 1)
     WHERE ctid = (SELECT ti.ctid FROM sys.sys_training_initiatives ti LIMIT 1);
    PERFORM staging.storia36_check_c4d(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4d%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4d FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4d (violazione iniettata rilevata, rollback)';

  -- ST-C4e: togliere la traccia formativa di una giornata d'aula deve scoprirla
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_user_learning_evidence e
     USING sys.sys_attendance a
     WHERE a.attendance_status = 'TRAINING'
       AND a.attendance_subject_user_id = e.user_learning_evidence_user_id
       AND a.attendance_date = e.user_learning_evidence_completed_at::date
       AND a.ctid = (SELECT a2.ctid FROM sys.sys_attendance a2
                      WHERE a2.attendance_status = 'TRAINING'
                        AND a2.attendance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                        AND EXISTS (SELECT 1 FROM sys.sys_user_learning_evidence e2
                                     WHERE e2.user_learning_evidence_user_id = a2.attendance_subject_user_id
                                       AND e2.user_learning_evidence_completed_at::date = a2.attendance_date)
                      LIMIT 1);
    PERFORM staging.storia36_check_c4e();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4e%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4e FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4e (violazione iniettata rilevata, rollback)';

  -- ST-C4f: riportare a «proposta» un'azione su una lacuna matura
  v_fired := false;
  BEGIN
    UPDATE sys.sys_gap_closure_actions SET gap_closure_action_status = 'PROPOSED'
     WHERE ctid = (SELECT a.ctid FROM sys.sys_gap_closure_actions a
                    JOIN sys.sys_learning_gaps g ON g.learning_gap_id = a.gap_closure_action_gap_id
                   WHERE a.gap_closure_action_kind = 'TRAINING_ASSIGNMENT'
                     AND g.learning_gap_detected_at::date <= v_end - 90 LIMIT 1);
    PERFORM staging.storia36_check_c4f(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4f%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4f FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4f (violazione iniettata rilevata, rollback)';

  -- ST-C4d(v): un'edizione conclusa ma lasciata «in corso» deve far scattare C4d
  v_fired := false;
  BEGIN
    UPDATE sys.sys_training_initiatives SET training_initiative_status = 'IN_PROGRESS'
     WHERE ctid = (SELECT ti.ctid FROM sys.sys_training_initiatives ti
                    WHERE ti.training_initiative_status = 'COMPLETED'
                      AND ti.training_initiative_end_date IS NOT NULL
                      AND ti.training_initiative_end_date < v_end LIMIT 1);
    PERFORM staging.storia36_check_c4d(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4d%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4d(v) FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4d(v) (edizione conclusa ma «in corso» rilevata, rollback)';

  -- ST-C4c(0): spezzare il legame evidenza→edizione deve far scattare C4c
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_learning_evidence
       SET user_learning_evidence_metadata =
             user_learning_evidence_metadata || jsonb_build_object('initiative', 'RTL-INESISTENTE')
     WHERE ctid = (SELECT e.ctid FROM sys.sys_user_learning_evidence e
                    WHERE e.user_learning_evidence_metadata->>'kind' = 'AULA' LIMIT 1);
    PERFORM staging.storia36_check_c4c(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4c%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4c(0) FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4c(0) (legame edizione perso rilevato, rollback)';

  -- ST-C4b(iv): rinviare un rinnovo dopo la scadenza del titolo precedente
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_certifications
       SET user_certification_issued_date = user_certification_issued_date + 400
     WHERE ctid = (SELECT c.ctid FROM sys.sys_user_certifications c
                    WHERE c.user_certification_metadata->>'storia36' = 'C4'
                      AND staging.storia36_cert_is_abilitante(c.user_certification_issuer) LIMIT 1);
    PERFORM staging.storia36_check_c4b(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4b%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4b(iv) FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4b(iv) (scopertura di abilitazione rilevata, rollback)';

  -- ST-C4g: spostare un completamento a tarda sera deve far scattare C4g
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_learning_evidence
       SET user_learning_evidence_completed_at =
             ((user_learning_evidence_completed_at AT TIME ZONE 'Europe/Rome')::date
               + time '23:30') AT TIME ZONE 'Europe/Rome'
     WHERE ctid = (SELECT e.ctid FROM sys.sys_user_learning_evidence e
                    JOIN sys.sys_attendance a
                      ON a.attendance_subject_user_id = e.user_learning_evidence_user_id
                     AND a.attendance_date = (e.user_learning_evidence_completed_at AT TIME ZONE 'Europe/Rome')::date
                   WHERE e.user_learning_evidence_metadata->>'storia36' = 'C4'
                     AND a.attendance_clock_out IS NOT NULL LIMIT 1);
    PERFORM staging.storia36_check_c4g();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4g%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4g FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4g (completamento fuori orario rilevato, rollback)';

  -- ST-C4a(iii): togliere l'antiriciclaggio di un anno deve far scattare C4a
  v_fired := false;
  BEGIN
    SELECT e.user_learning_evidence_user_id INTO v_u
      FROM sys.sys_user_learning_evidence e
      JOIN sys.sys_learning_modules m ON m.learning_module_id = e.user_learning_evidence_module_id
     WHERE staging.storia36_c4_module_topic(m.learning_module_code, m.learning_module_title) = 'AML'
       AND e.user_learning_evidence_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1;
    DELETE FROM sys.sys_user_learning_evidence e
     USING sys.sys_learning_modules m
     WHERE m.learning_module_id = e.user_learning_evidence_module_id
       AND e.user_learning_evidence_user_id = v_u
       AND staging.storia36_c4_module_topic(m.learning_module_code, m.learning_module_title) = 'AML';
    PERFORM staging.storia36_check_c4a(current_setting('storia36.window_start')::date, v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4a%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4a(iii) FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4a(iii) (obbligo di contenuto scoperto rilevato, rollback)';

  -- ST-C4h: togliere la formazione sicurezza a un lavoratore deve far scattare C4h
  v_fired := false;
  BEGIN
    SELECT u.user_id INTO v_u FROM sys.sys_users u
     WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND u.user_status = 'ACTIVE' LIMIT 1;
    DELETE FROM sys.sys_user_certifications
     WHERE user_certification_user_id = v_u
       AND user_certification_name ILIKE '%Sicurezza Base%';
    PERFORM staging.storia36_check_c4h(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4h%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4h FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4h (lavoratore senza formazione sicurezza rilevato, rollback)';

  -- ST-C4h(v): sciogliere la squadra di emergenza di una sede deve far scattare C4h
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_user_certifications c
     USING staging.storia36_sede_personale s
     WHERE s.user_id = c.user_certification_user_id
       AND s.branch_code = (SELECT min(branch_code) FROM staging.storia36_sede_personale)
       AND c.user_certification_name ILIKE '%antincendio%';
    PERFORM staging.storia36_check_c4h(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'C4h%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4h(v) FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4h(v) (sede senza squadra di emergenza rilevata, rollback)';
END $$;
\endif

-- ============================================================================
-- RUNNER — esegue TUTTI i check, stampa l'esito di ognuno, fallisce alla fine
-- se almeno uno è rosso.
-- ============================================================================
DO $$
DECLARE
  v_start  date := current_setting('storia36.window_start')::date;
  v_end    date := current_setting('storia36.window_end')::date;
  v_failed text[] := '{}';
  v_msg    text;
BEGIN
  RAISE NOTICE 'storia36 verify — finestra %..%', v_start, v_end;

  BEGIN
    PERFORM staging.storia36_check_g1(v_end);
    RAISE NOTICE '[OK] G1 nessun record di business oltre la finestra (70 colonne)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'G1'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_g2();
    RAISE NOTICE '[OK] G2 nessun evento prima della hire_date (9 tabelle)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'G2'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_g3(v_start, v_end);
    RAISE NOTICE '[OK] G3 parità busta↔presenze per mese (esenti S1028 esclusi)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'G3'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_g4();
    RAISE NOTICE '[OK] G4 sequenzialità (approvals, contratti, goals, buste)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'G4'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_g5();
    RAISE NOTICE '[OK] G5 le 6 viste strutturali = 0 righe';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'G5'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_g6();
    RAISE NOTICE '[OK] G6 ogni cluster nel registro ha la prova twice-run (delta 0)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'G6'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c1a(v_start);
    RAISE NOTICE '[OK] C1a copertura mensile presenze (non-esenti, fino alla frontiera)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C1a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c1b();
    RAISE NOTICE '[OK] C1b nessuna presenza in giorni non lavorativi';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C1b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c1c(v_start);
    RAISE NOTICE '[OK] C1c coerenza time-off ↔ attendance ↔ balances (i-iv)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C1c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c1d();
    RAISE NOTICE '[OK] C1d mai più del 60%% dell''organico in ferie lo stesso giorno';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C1d'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c2a();
    RAISE NOTICE '[OK] C2a review per ogni utente eleggibile per ogni anno pieno';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C2a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c2b();
    RAISE NOTICE '[OK] C2b check-in minimi nell''anno di ogni review annuale';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C2b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c2c();
    RAISE NOTICE '[OK] C2c reviewer = manager gerarchico reale';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C2c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c2d();
    RAISE NOTICE '[OK] C2d nessun 360 MANAGER/PEER con reviewer = target';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C2d'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c2e();
    RAISE NOTICE '[OK] C2e goal↔check-in↔stato coerenti + curva box';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C2e'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c2f();
    RAISE NOTICE '[OK] C2f perimetro tenant I5 sul ciclo performance';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C2f'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c2g();
    RAISE NOTICE '[OK] C2g eventi performance solo in giorni lavorativi';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C2g'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c3a(v_start);
    RAISE NOTICE '[OK] C3a payroll handoff per ogni mese della finestra';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C3a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c3b(v_start);
    RAISE NOTICE '[OK] C3b busta paga per ogni (utente, mese dalla hire)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C3b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c3c(v_start);
    RAISE NOTICE '[OK] C3c nessuna busta sotto il floor CCNL alla data';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C3c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c3d();
    RAISE NOTICE '[OK] C3d variable-pay con 7 gates superati e cap 30%% RAL';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C3d'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c3e();
    RAISE NOTICE '[OK] C3e variabile FY23/24 erogato nella busta di giugno N+1';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C3e'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c3s();
    RAISE NOTICE '[OK] C3S busta per ogni non-esente presente nei mesi di massa';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C3S'); RAISE WARNING '[ROSSO] % (SPEC per C3 — triage: dato mancante)', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c4a(v_start, v_end);
    RAISE NOTICE '[OK] C4a monte-ore annuo sopra il pavimento CCNL/IVASS, media in banda';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C4a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c4b(v_end);
    RAISE NOTICE '[OK] C4b certificazioni abilitanti valide alla frontiera, catene monotone';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C4b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c4c(v_end);
    RAISE NOTICE '[OK] C4c aula: evidenza nel periodo, iscrizione presente, capienza rispettata';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C4c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c4d(v_end);
    RAISE NOTICE '[OK] C4d ogni iniziativa giustificata da una competenza e legale nel tenant';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C4d'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c4e();
    RAISE NOTICE '[OK] C4e quadratura: ogni giornata d''aula ha la sua traccia formativa';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C4e'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c4f(v_end);
    RAISE NOTICE '[OK] C4f ciclo lacuna → azione → formazione chiuso sulle lacune mature';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C4f'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c4g();
    RAISE NOTICE '[OK] C4g formazione dentro l''orario, dispersa nell''anno, mai in massa';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C4g'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c4h(v_end);
    RAISE NOTICE '[OK] C4h sicurezza: lavoratori, preposti, dirigenti, datore di lavoro, squadre';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C4h'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  IF array_length(v_failed, 1) > 0 THEN
    RAISE EXCEPTION 'storia36 verify: % check ROSSI: %',
      array_length(v_failed, 1), array_to_string(v_failed, ', ');
  END IF;
  RAISE NOTICE 'storia36 verify: batteria globale tutta VERDE';
END $$;
