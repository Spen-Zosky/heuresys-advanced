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
      ('sys_user_pay_slips','user_pay_slip_user_id','user_pay_slip_period_start'),
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
    PERFORM staging.storia36_check_c3s();
    RAISE NOTICE '[OK] C3S busta per ogni non-esente presente nei mesi di massa';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C3S'); RAISE WARNING '[ROSSO] % (SPEC per C3 — triage: dato mancante)', v_msg;
  END;

  IF array_length(v_failed, 1) > 0 THEN
    RAISE EXCEPTION 'storia36 verify: % check ROSSI: %',
      array_length(v_failed, 1), array_to_string(v_failed, ', ');
  END IF;
  RAISE NOTICE 'storia36 verify: batteria globale tutta VERDE';
END $$;
