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
-- solo_definizioni=1 → crea le funzioni staging.storia36_check_* e NON esegue il runner.
-- Serve a `storia36.sh custodia --repair-missing` (#189): dodici seed su quattordici
-- invocano quelle funzioni come post-condizione, ma le crea solo questo file, che gira
-- DOPO i seed. Su un database dove una funzione non c'e' ancora, la catena di riparazione
-- si spezza a meta' — misurato in S1062 su `06_reorg.sql` / `storia36_check_c6a`.
\if :{?solo_definizioni}
\else
\set solo_definizioni 0
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C1c(i): % workday di richieste APPROVED senza attendance coerente (es. %)', v_i, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C1c(ii): % balance con used_days diverso dal derivato attendance (es. %)', v_ii, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- (iii) mai goduto oltre il maturato (check INDIPENDENTE dal derivato del
  -- seed — è la proprietà del piano Step 1.4 "maturato-goduto=residuo")
  SELECT count(*), min(b.balance_natural_key)
    INTO v_ii, v_sample
  FROM sys.sys_time_off_balances b
  WHERE b.balance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND b.balance_used_days > b.balance_total_days + b.balance_carryover_days + b.balance_adjustment_days;
  IF v_ii > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C1c(iii): % balance con goduto oltre maturato+riporto+rettifica (es. %)', v_ii, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C1c(iv): % richieste APPROVED con days_requested diverso dai workday coperti (es. %)', v_ii, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
-- account enzo.spenuso@heuresys.com. («alla data» arriverà con la history di C6.)
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
          (SELECT user_id FROM sys.sys_users WHERE user_email = 'enzo.spenuso@heuresys.com'));
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C2e: % goal non terminali con progress diverso dall''ultimo check-in', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*) INTO v_cnt
  FROM sys.sys_goals
  WHERE goal_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND goal_status = 'COMPLETED' AND goal_progress_percent <> 100;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C2e: % goal COMPLETED con progress diverso da 100', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT avg((review_performance_box = 1)::int) INTO v_share
  FROM sys.sys_performance_reviews
  WHERE review_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND review_status = 'COMPLETED' AND review_performance_box IS NOT NULL;
  IF v_share > 0.25 THEN
    BEGIN
      RAISE EXCEPTION 'C2e: quota box-basso % oltre il 25%% (curva 10/70/20 violata)', round(v_share, 3);
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C3d: % variable-pay senza i 7 gates superati o fuori cap 30%% RAL (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C3d(iv): % variable-pay storia36 con amount fuori dalla curva ±1€ (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C3d(v): % aggregati (utente, esercizio) oltre il 100%% della RAL (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C4a: % anni-utente sotto il pavimento di monte-ore CCNL/IVASS (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4a(ii): % anni con media aziendale fuori banda (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4a(iii): % anni-utente senza la formazione obbligatoria di contenuto (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C4b: % certificazioni abilitanti scadute e mai rinnovate su utenti attivi (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4b(ii): % rinnovi che scadono prima del titolo sostituito (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4b(iii): % certificazioni che scadono prima di essere rilasciate (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4b(iv): % rinnovi ottenuti DOPO la scadenza del titolo precedente (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C4c(0): % evidenze d''aula il cui codice iniziativa non risolve (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4c: % evidenze d''aula fuori dal periodo della loro iniziativa (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4c(ii): % frequenze d''aula senza iscrizione all''iniziativa (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4c(iii): % iniziative con più partecipanti della capienza (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4c(iv): % evidenze d''aula su un corso diverso da quello della loro edizione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C4d: % iniziative su moduli non mappati ad alcuna competenza (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(ti.training_initiative_code) INTO v_cnt, v_sample
  FROM sys.sys_training_initiatives ti
  JOIN sys.sys_learning_modules m ON m.learning_module_id = ti.training_initiative_module_id
  WHERE ti.training_initiative_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND m.learning_module_is_global IS NOT TRUE
    AND m.learning_module_tenant_id IS DISTINCT FROM ti.training_initiative_tenant_id;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C4d(ii): % iniziative su moduli di un altro tenant (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(ti.training_initiative_code) INTO v_cnt, v_sample
  FROM sys.sys_training_initiatives ti
  JOIN sys.sys_users f ON f.user_id = ti.training_initiative_facilitator_user_id
  WHERE ti.training_initiative_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND f.user_tenant_id IS DISTINCT FROM ti.training_initiative_tenant_id;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C4d(iii): % iniziative con docente di un altro tenant (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4d(iv): % iniziative con docente su moduli in autoapprendimento (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4d(v): % iniziative con periodo o stato incoerenti (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C4f: % azioni formative ancora «proposte» su lacune mature (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4f(ii): % azioni chiuse senza formazione successiva alla rilevazione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(a.gap_closure_action_id::text || ' [' || a.gap_closure_action_status || ']')
    INTO v_cnt, v_sample
  FROM sys.sys_gap_closure_actions a
  WHERE a.gap_closure_action_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND a.gap_closure_action_status <> 'PROPOSED'
    AND (a.gap_closure_action_due_date IS NULL OR a.gap_closure_action_owner_user_id IS NULL);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C4f(iii): % azioni avviate senza responsabile o senza scadenza (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(p.gap_closure_plan_id::text || ' [' || p.gap_closure_plan_status || ']')
    INTO v_cnt, v_sample
  FROM sys.sys_gap_closure_plans p
  WHERE p.gap_closure_plan_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND p.gap_closure_plan_status IN ('ACTIVE','COMPLETED')
    AND p.gap_closure_plan_target_completion_date IS NULL;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C4f(iv): % piani di chiusura attivi senza data obiettivo (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C4g: % completamenti registrati dopo l''uscita timbrata dello stesso giorno (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
      BEGIN
        RAISE EXCEPTION 'C4g(ii): % mesi dell''anno senza un solo corso a distanza su % righe (es. %)', v_cnt, v_tot, v_sample;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
        v_guasti := array_append(v_guasti, v_g);
      END;
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
    BEGIN
      RAISE EXCEPTION 'C4g(iii): % ore con più di 3 persone che chiudono lo stesso corso in autoapprendimento (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_guasti text[] := '{}';
  v_g      text;
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
    BEGIN
      RAISE EXCEPTION 'C4h: % lavoratori attivi senza formazione sicurezza valida (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4h(ii): % preposti senza aggiornamento valido (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4h(iii): % dirigenti senza formazione sicurezza valida (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4h(iv): % al vertice senza formazione da datore di lavoro (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
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
    BEGIN
      RAISE EXCEPTION 'C4h(v): % sedi senza squadra di emergenza in regola (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ############################################################################
-- C5 — CARRIERA. Il profilo di ognuno, oggi, comincia il giorno dell'assunzione
-- in RTL: prima c'è il vuoto, anche per chi è entrato a quarant'anni. E guarda
-- solo all'indietro — nessuno ha un obiettivo dichiarato. Questo cluster
-- costruisce il PRIMA (esperienze precedenti, ancorate a nascita e titoli di
-- studio reali) e il DOPO (posizioni obiettivo, prontezza dei successori,
-- evoluzione dei requisiti).
-- ############################################################################

-- ----------------------------------------------------------------------------
-- Helper C5/1 — il momento in cui una persona ha potuto iniziare a lavorare:
-- non prima dei 19 anni e non prima di aver finito il primo titolo di studio —
-- ma nemmeno dopo l'ingresso in RTL, perché chi si è laureato da dipendente ha
-- studiato lavorando. È l'ancora di tutta la carriera precedente: senza, le date
-- sarebbero inventate invece che vincolate.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_c5_inizio_carriera(p_user uuid)
RETURNS date LANGUAGE sql STABLE AS $fn$
  SELECT GREATEST(
           (SELECT (d.user_demographics_birth_date + interval '19 years')::date
              FROM sys.sys_user_demographics d
             WHERE d.user_demographics_user_id = p_user),
           LEAST(
             (SELECT min(e.user_education_end_date) FROM sys.sys_user_education_records e
               WHERE e.user_education_record_user_id = p_user
                 AND e.user_education_end_date IS NOT NULL),
             (SELECT min(em.user_employment_hire_date) FROM sys.sys_user_employment em
               WHERE em.user_employment_user_id = p_user)))
$fn$;

-- ----------------------------------------------------------------------------
-- C5a — la carriera precedente regge come racconto: (i) nessuna esperienza
-- iniziata prima dei 19 anni o della fine degli studi; (ii) l'ultima finisce
-- entro l'ingresso in RTL; (iii) le esperienze di una persona non si
-- sovrappongono; (iv) fra una e l'altra non restano buchi oltre 18 mesi;
-- (v) fine dopo inizio.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5a()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(u.user_email || ': ' || x.user_prof_exp_start_date ||
                       ' prima di ' || staging.storia36_c5_inizio_carriera(x.user_prof_exp_user_id))
    INTO v_cnt, v_sample
  FROM sys.sys_user_professional_experiences x
  JOIN sys.sys_users u ON u.user_id = x.user_prof_exp_user_id
  WHERE x.user_prof_exp_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND x.user_prof_exp_start_date < staging.storia36_c5_inizio_carriera(x.user_prof_exp_user_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5a: % esperienze iniziate prima che la persona potesse lavorare (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_professional_experiences x
  JOIN sys.sys_users u ON u.user_id = x.user_prof_exp_user_id
  JOIN sys.sys_user_employment em ON em.user_employment_user_id = x.user_prof_exp_user_id
  WHERE x.user_prof_exp_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND (x.user_prof_exp_end_date IS NULL
      OR x.user_prof_exp_end_date > em.user_employment_hire_date);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5a(ii): % esperienze precedenti che non finiscono prima dell''ingresso in RTL (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM (
    SELECT x.user_prof_exp_user_id AS uid, x.user_prof_exp_start_date AS d_ini,
           lag(x.user_prof_exp_end_date) OVER (PARTITION BY x.user_prof_exp_user_id
                                               ORDER BY x.user_prof_exp_start_date) AS prec_fine
      FROM sys.sys_user_professional_experiences x
     WHERE x.user_prof_exp_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  ) c
  JOIN sys.sys_users u ON u.user_id = c.uid
  WHERE c.prec_fine IS NOT NULL AND (c.d_ini < c.prec_fine OR c.d_ini - c.prec_fine > 548);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5a(iii): % esperienze sovrapposte o separate da oltre 18 mesi (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_professional_experiences x
  JOIN sys.sys_users u ON u.user_id = x.user_prof_exp_user_id
  WHERE x.user_prof_exp_end_date IS NOT NULL
    AND x.user_prof_exp_end_date < x.user_prof_exp_start_date;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5a(iv): % esperienze che finiscono prima di iniziare (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5b — la successione non è un elenco di nomi: ogni posizione dichiarata
-- critica ha almeno un candidato, e ogni candidato ha una valutazione di
-- prontezza; l'ultima valutazione concorda col livello dichiarato sul candidato
-- (altrimenti il livello è un'etichetta che nessuno ha misurato).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(COALESCE(p.position_title, cp.critical_position_id::text))
    INTO v_cnt, v_sample
  FROM sys.sys_critical_positions cp
  LEFT JOIN sys.sys_positions p ON p.position_id = cp.critical_position_position_id
  WHERE cp.critical_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_succession_pools sp
       JOIN sys.sys_successor_candidates sc ON sc.successor_candidate_pool_id = sp.succession_pool_id
      WHERE sp.succession_pool_position_id = cp.critical_position_position_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5b: % posizioni critiche senza alcun successore individuato (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_successor_candidates sc
  JOIN sys.sys_users u ON u.user_id = sc.successor_candidate_user_id
  WHERE sc.successor_candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_successor_readiness r
       WHERE r.successor_readiness_candidate_id = sc.successor_candidate_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5b(ii): % successori senza alcuna valutazione di prontezza (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email || ': dichiarato ' || sc.successor_candidate_readiness_level ||
                       ', valutato ' || ult.successor_readiness_horizon)
    INTO v_cnt, v_sample
  FROM sys.sys_successor_candidates sc
  JOIN sys.sys_users u ON u.user_id = sc.successor_candidate_user_id
  JOIN LATERAL (
    SELECT r.successor_readiness_horizon
      FROM sys.sys_successor_readiness r
     WHERE r.successor_readiness_candidate_id = sc.successor_candidate_id
     ORDER BY r.successor_readiness_assessed_at DESC LIMIT 1) ult ON true
  WHERE sc.successor_candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND ult.successor_readiness_horizon IS DISTINCT FROM sc.successor_candidate_readiness_level;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5b(iii): % successori il cui livello dichiarato non corrisponde all''ultima valutazione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5c — l'obiettivo di carriera è un obiettivo: sta nello stesso tenant, non è
-- la posizione che già si occupa, e non è un salto arbitrario — deve essere
-- raggiungibile da un percorso di carriera che passa per la posizione attuale.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5c()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_target_positions t
  JOIN sys.sys_users u ON u.user_id = t.user_target_position_user_id
  JOIN sys.sys_positions p ON p.position_id = t.user_target_position_position_id
  WHERE t.user_target_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND (p.position_tenant_id IS DISTINCT FROM t.user_target_position_tenant_id
      OR u.user_tenant_id IS DISTINCT FROM t.user_target_position_tenant_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5c: % obiettivi di carriera fuori dal perimetro del tenant (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_target_positions t
  JOIN sys.sys_users u ON u.user_id = t.user_target_position_user_id
  WHERE t.user_target_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND EXISTS (
      SELECT 1 FROM sys.sys_user_position_assignments a
       WHERE a.user_position_assignment_user_id = t.user_target_position_user_id
         AND a.user_position_assignment_kind = 'PRIMARY'
         AND a.user_position_assignment_status = 'ACTIVE'
         AND a.user_position_assignment_position_id = t.user_target_position_position_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5c(ii): % persone che hanno come obiettivo la posizione che già occupano (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_target_positions t
  JOIN sys.sys_users u ON u.user_id = t.user_target_position_user_id
  WHERE t.user_target_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND t.user_target_position_review_status <> 'REJECTED'
    AND NOT EXISTS (
      -- un percorso di carriera che tocca sia la posizione attuale sia l'obiettivo
      SELECT 1
        FROM sys.sys_user_position_assignments a
        JOIN sys.sys_position_career_paths pcp_ora
          ON pcp_ora.position_id = a.user_position_assignment_position_id
        JOIN sys.sys_position_career_paths pcp_meta
          ON pcp_meta.career_path_id = pcp_ora.career_path_id
         AND pcp_meta.position_id = t.user_target_position_position_id
       WHERE a.user_position_assignment_user_id = t.user_target_position_user_id
         AND a.user_position_assignment_kind = 'PRIMARY'
         AND a.user_position_assignment_status = 'ACTIVE');
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5c(iii): % obiettivi non raggiungibili da alcun percorso di carriera (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- (iv) L'obiettivo e' una CRESCITA, e questo e' il predicato che mancava: la
  -- prima versione misurava la verticalita' dalla rarita' della posizione e
  -- degenerava in «scrivania vuota» — 150 obiettivi su 150 puntavano a un posto
  -- dove non lavorava nessuno, e 22 direttori di filiale «aspiravano» a fare i
  -- cassieri. Un check che guarda solo l'appartenenza al percorso non lo vede.
  -- Qui si pretendono le tre cose che rendono un obiettivo un obiettivo: sta piu'
  -- in alto nell'organigramma, ha un mestiere diverso, e qualcuno ci lavora.
  WITH RECURSIVE disc AS (
    SELECT p.position_id, 0 AS livello
      FROM sys.sys_positions p
     WHERE p.position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND p.position_reports_to_position_id IS NULL
    UNION ALL
    SELECT p.position_id, d.livello + 1
      FROM sys.sys_positions p
      JOIN disc d ON d.position_id = p.position_reports_to_position_id
     WHERE p.position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  ), liv AS (SELECT position_id, min(livello) AS livello FROM disc GROUP BY 1)
  SELECT count(*), min(u.user_email || ': ' || p_ora.position_title || ' → ' || p_meta.position_title)
    INTO v_cnt, v_sample
  FROM sys.sys_user_target_positions t
  JOIN sys.sys_users u ON u.user_id = t.user_target_position_user_id
  JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_user_id = t.user_target_position_user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p_ora  ON p_ora.position_id  = a.user_position_assignment_position_id
  JOIN sys.sys_positions p_meta ON p_meta.position_id = t.user_target_position_position_id
  LEFT JOIN liv l_ora  ON l_ora.position_id  = p_ora.position_id
  LEFT JOIN liv l_meta ON l_meta.position_id = p_meta.position_id
  WHERE t.user_target_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND t.user_target_position_review_status <> 'REJECTED'
    AND (l_meta.livello IS NULL OR l_ora.livello IS NULL
      OR l_meta.livello >= l_ora.livello                  -- non e' piu' in alto
      OR p_meta.position_title = p_ora.position_title     -- e' lo stesso mestiere
      OR NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a2
                      WHERE a2.user_position_assignment_position_id = p_meta.position_id
                        AND a2.user_position_assignment_status = 'ACTIVE'));
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5c(iv): % obiettivi che non sono una crescita (stesso livello o piu'' in basso, stesso mestiere, o posizione senza titolari) (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5d — l'evoluzione dei requisiti di posizione è una storia di cambiamenti
-- veri: ogni riga punta a un requisito che esiste, il livello nuovo è diverso
-- dal vecchio (registrare un «cambiamento» che non cambia nulla è rumore),
-- l'autore appartiene al tenant e la data cade dentro la finestra.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5d(p_start date, p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  p_end := LEAST(p_end, COALESCE(staging.storia36_c4_frontier(), p_end));

  SELECT count(*), min(h.position_skill_requirement_history_id::text) INTO v_cnt, v_sample
  FROM sys.sys_position_skill_requirement_history h
  WHERE h.position_skill_requirement_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND (NOT EXISTS (SELECT 1 FROM sys.sys_position_skill_requirements r
                      WHERE r.position_skill_requirement_id = h.position_skill_requirement_history_psr_id)
      OR h.position_skill_requirement_history_new_proficiency
         IS NOT DISTINCT FROM h.position_skill_requirement_history_old_proficiency
      OR h.position_skill_requirement_history_effective_at::date NOT BETWEEN p_start AND p_end);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5d: % variazioni di requisito orfane, nulle o fuori finestra (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(h.position_skill_requirement_history_id::text) INTO v_cnt, v_sample
  FROM sys.sys_position_skill_requirement_history h
  LEFT JOIN sys.sys_users u ON u.user_id = h.position_skill_requirement_history_actor_user_id
  WHERE h.position_skill_requirement_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND (u.user_id IS NULL
      OR u.user_tenant_id IS DISTINCT FROM h.position_skill_requirement_history_tenant_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5d(ii): % variazioni senza un autore del tenant (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5e — i titoli di studio hanno una durata: un percorso senza data d'inizio
-- non dice quanto è durato, e un inizio dopo la fine non è un percorso.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5e()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(u.user_email || ': ' || e.user_education_degree) INTO v_cnt, v_sample
  FROM sys.sys_user_education_records e
  JOIN sys.sys_users u ON u.user_id = e.user_education_record_user_id
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND e.user_education_end_date IS NOT NULL
    AND (e.user_education_start_date IS NULL
      OR e.user_education_start_date > e.user_education_end_date);
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C5e: % titoli di studio senza inizio o con inizio dopo la fine (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C5f — LA CRITICITÀ SI DICE IN UN MODO SOLO (rilievo #18).
-- Il database teneva tre registri di posizioni critiche — sys_critical_positions,
-- positions.position_criticality e relevance.is_critical — e i tre non avevano
-- NEMMENO UNA posizione in comune: un ruolo era critico per la successione e
-- ordinario nell'anagrafica, un altro il contrario. La fonte è il registro
-- esplicito (l'unico che porta motivazione e impatto di business); gli altri due
-- lo seguono.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5f()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(p.position_title) INTO v_cnt, v_sample
  FROM sys.sys_critical_positions cp
  JOIN sys.sys_positions p ON p.position_id = cp.critical_position_position_id
  WHERE cp.critical_position_tenant_id = c_rtl
    AND p.position_criticality IS DISTINCT FROM 'CRITICAL';
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5f: % posizioni nel registro delle critiche che l''anagrafica non dice critiche (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(p.position_title) INTO v_cnt, v_sample
  FROM sys.sys_positions p
  WHERE p.position_tenant_id = c_rtl
    AND p.position_criticality = 'CRITICAL'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                     WHERE cp.critical_position_position_id = p.position_id
                       AND cp.critical_position_tenant_id = c_rtl);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5f(ii): % posizioni dette critiche in anagrafica ma assenti dal registro (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(p.position_title) INTO v_cnt, v_sample
  FROM sys.sys_critical_positions cp
  JOIN sys.sys_positions p ON p.position_id = cp.critical_position_position_id
  WHERE cp.critical_position_tenant_id = c_rtl
    AND NOT EXISTS (SELECT 1 FROM sys.sys_position_succession_relevance r
                     WHERE r.position_id = cp.critical_position_position_id
                       AND r.position_succession_relevance_tenant_id = c_rtl
                       AND r.is_critical);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5f(iii): % posizioni critiche che la vista successione non segnala (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(p.position_title) INTO v_cnt, v_sample
  FROM sys.sys_position_succession_relevance r
  JOIN sys.sys_positions p ON p.position_id = r.position_id
  WHERE r.position_succession_relevance_tenant_id = c_rtl
    AND r.is_critical
    AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                     WHERE cp.critical_position_position_id = r.position_id
                       AND cp.critical_position_tenant_id = c_rtl);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5f(iv): % posizioni segnalate critiche dalla successione ma assenti dal registro (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- l'orizzonte di copertura è un derivato del bacino: se il bacino ha
  -- candidati, la posizione deve dire entro quando è coperta
  SELECT count(*), min(p.position_title) INTO v_cnt, v_sample
  FROM sys.sys_position_succession_relevance r
  JOIN sys.sys_positions p ON p.position_id = r.position_id
  WHERE r.position_succession_relevance_tenant_id = c_rtl
    AND r.readiness_horizon IS NULL
    AND EXISTS (SELECT 1 FROM sys.sys_succession_pools sp
                 JOIN sys.sys_successor_candidates sc
                   ON sc.successor_candidate_pool_id = sp.succession_pool_id
                WHERE sp.succession_pool_position_id = r.position_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5f(v): % posizioni con un bacino popolato e nessun orizzonte di copertura (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5g — UN SUCCESSORE NON È UN NOME (rilievo #4/#5).
-- Su 49 candidati, 22 non erano né un riporto diretto della posizione né
-- qualcuno che quel mestiere lo fa già altrove: erano stati messi lì e basta.
-- Chi sta in un bacino ci sta per uno dei due motivi.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5g()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(u.user_email || ' → ' || COALESCE(pp.position_title, '?')) INTO v_cnt, v_sample
  FROM sys.sys_successor_candidates sc
  JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = sc.successor_candidate_pool_id
  JOIN sys.sys_users u ON u.user_id = sc.successor_candidate_user_id
  LEFT JOIN sys.sys_positions pp ON pp.position_id = sp.succession_pool_position_id
  WHERE sc.successor_candidate_tenant_id = c_rtl
    -- chi la posizione la occupa già ha il suo ramo, il (ii): i due casi
    -- restano disgiunti, così ciascuno si può falsificare da solo
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_position_assignments a0
       WHERE a0.user_position_assignment_user_id = sc.successor_candidate_user_id
         AND a0.user_position_assignment_status = 'ACTIVE'
         AND a0.user_position_assignment_position_id = sp.succession_pool_position_id)
    AND NOT EXISTS (
      SELECT 1
        FROM sys.sys_user_position_assignments a
        JOIN sys.sys_positions cpz ON cpz.position_id = a.user_position_assignment_position_id
       WHERE a.user_position_assignment_user_id = sc.successor_candidate_user_id
         AND a.user_position_assignment_status = 'ACTIVE'
         AND (cpz.position_reports_to_position_id = sp.succession_pool_position_id
           OR (cpz.position_title = pp.position_title AND cpz.position_id <> pp.position_id)));
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5g: % successori che non riportano alla posizione né ne fanno il mestiere altrove (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_successor_candidates sc
  JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = sc.successor_candidate_pool_id
  JOIN sys.sys_users u ON u.user_id = sc.successor_candidate_user_id
  WHERE sc.successor_candidate_tenant_id = c_rtl
    AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                 WHERE a.user_position_assignment_user_id = sc.successor_candidate_user_id
                   AND a.user_position_assignment_status = 'ACTIVE'
                   AND a.user_position_assignment_position_id = sp.succession_pool_position_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5g(ii): % persone candidate a succedere a se stesse (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5h — UN PERCORSO DICE DA DOVE A DOVE (rilievo #27).
-- I 35 passi dei sette percorsi di carriera erano gusci: nessuno aveva una
-- posizione di partenza né una di arrivo. Un percorso senza posizioni è un
-- titolo, e nessuno può percorrerlo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5h()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(cp.career_path_name || ' passo ' || s.career_path_step_ordinal)
    INTO v_cnt, v_sample
  FROM sys.sys_career_path_steps s
  JOIN sys.sys_career_paths cp ON cp.career_path_id = s.career_path_step_path_id
  WHERE s.career_path_step_target_position_id IS NULL;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5h: % passi di carriera che non portano a nessuna posizione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(cp.career_path_name || ' passo ' || s.career_path_step_ordinal)
    INTO v_cnt, v_sample
  FROM sys.sys_career_path_steps s
  JOIN sys.sys_career_paths cp ON cp.career_path_id = s.career_path_step_path_id
  WHERE s.career_path_step_ordinal > 1
    AND s.career_path_step_origin_position_id IS NULL;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5h(ii): % passi oltre il primo che non partono da nessuna posizione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- la catena è continua: si riparte da dove si è arrivati
  SELECT count(*), min(cp.career_path_name || ' passo ' || s.career_path_step_ordinal)
    INTO v_cnt, v_sample
  FROM sys.sys_career_path_steps s
  JOIN sys.sys_career_paths cp ON cp.career_path_id = s.career_path_step_path_id
  JOIN sys.sys_career_path_steps prec
    ON prec.career_path_step_path_id = s.career_path_step_path_id
   AND prec.career_path_step_ordinal = s.career_path_step_ordinal - 1
  WHERE s.career_path_step_origin_position_id
        IS DISTINCT FROM prec.career_path_step_target_position_id;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5h(iii): % passi che non ripartono da dove finisce il precedente (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(cp.career_path_name || ' passo ' || s.career_path_step_ordinal)
    INTO v_cnt, v_sample
  FROM sys.sys_career_path_steps s
  JOIN sys.sys_career_paths cp ON cp.career_path_id = s.career_path_step_path_id
  WHERE s.career_path_step_origin_position_id = s.career_path_step_target_position_id;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5h(iv): % passi che partono e arrivano alla stessa posizione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5i — IL DATORE E IL SETTORE SONO LO STESSO FATTO (rilievo #30/#33).
-- I due campi venivano estratti separatamente: «Banca Popolare del Verbano»
-- risultava insieme banca, assicurazione e società di consulenza ICT. Tutti e
-- nove i datori erano incoerenti.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5i()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(datore || ': ' || settori) INTO v_cnt, v_sample
  FROM (
    SELECT user_prof_exp_employer AS datore,
           string_agg(DISTINCT user_prof_exp_industry, ' / ') AS settori
      FROM sys.sys_user_professional_experiences
     WHERE user_prof_exp_tenant_id = c_rtl
     GROUP BY 1
    HAVING count(DISTINCT user_prof_exp_industry) > 1) x;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C5i: % datori di lavoro attribuiti a più settori diversi (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C5j — LE DATE NON SEGUONO IL CALENDARIO SCOLASTICO (rilievo #13/#20).
-- L'inizio di ogni esperienza coincideva con la fine degli studi: 85 date su
-- 255 cadevano il primo del mese e 104 a gennaio. Era il calendario delle
-- lauree, non quello delle assunzioni. Soglie larghe di proposito: il check
-- deve cogliere l'artefatto, non la casualità.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5j()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_pct numeric;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT max(pct), min(etichetta) INTO v_pct, v_sample FROM (
    SELECT round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct,
           'giorno ' || extract(day FROM user_prof_exp_start_date)::text AS etichetta
      FROM sys.sys_user_professional_experiences
     WHERE user_prof_exp_tenant_id = c_rtl
     GROUP BY extract(day FROM user_prof_exp_start_date)) x
   WHERE pct > 15;
  IF v_pct IS NOT NULL THEN
    BEGIN
      RAISE EXCEPTION 'C5j: un solo giorno del mese concentra il %%% delle date d''inizio (%)', v_pct, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT max(pct), min(etichetta) INTO v_pct, v_sample FROM (
    SELECT round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct,
           'mese ' || extract(month FROM user_prof_exp_start_date)::text AS etichetta
      FROM sys.sys_user_professional_experiences
     WHERE user_prof_exp_tenant_id = c_rtl
     GROUP BY extract(month FROM user_prof_exp_start_date)) x
   WHERE pct > 20;
  IF v_pct IS NOT NULL THEN
    BEGIN
      RAISE EXCEPTION 'C5j(ii): un solo mese concentra il %%% delle date d''inizio (%)', v_pct, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5k — DENTRO LA BANCA CI SI MUOVE (rilievo #23).
-- In 36 mesi, su 162 persone, i cambi di posizione registrati erano cinque: la
-- banca risultava un posto dove la carriera comincia e finisce sulla stessa
-- scrivania. E dove c'è un movimento, i due incarichi non si sovrappongono.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5k()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(DISTINCT user_position_assignment_user_id) INTO v_cnt
  FROM sys.sys_user_position_assignments
  WHERE user_position_assignment_tenant_id = c_rtl
    AND user_position_assignment_status = 'ENDED';
  IF v_cnt < 20 THEN
    BEGIN
      RAISE EXCEPTION 'C5k: solo % persone hanno un incarico precedente in tre anni: la mobilità interna non è rappresentata', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_position_assignments prec
  JOIN sys.sys_user_position_assignments att
    ON att.user_position_assignment_user_id = prec.user_position_assignment_user_id
   AND att.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_users u ON u.user_id = prec.user_position_assignment_user_id
  WHERE prec.user_position_assignment_tenant_id = c_rtl
    AND prec.user_position_assignment_status = 'ENDED'
    AND prec.user_position_assignment_end_date >= att.user_position_assignment_start_date;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5k(ii): % incarichi precedenti che si sovrappongono a quello in corso (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_position_assignments a
  JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
  WHERE a.user_position_assignment_tenant_id = c_rtl
    AND a.user_position_assignment_metadata->>'storia36' = 'C5'
    AND a.user_position_assignment_start_date < (
      SELECT min(em.user_employment_hire_date) FROM sys.sys_user_employment em
       WHERE em.user_employment_user_id = a.user_position_assignment_user_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C5k(iii): % incarichi che cominciano prima dell''assunzione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C5l — IL BACINO DICE QUALE POSTO COPRE (rilievo #19).
-- La stessa carica compariva come «Chief Executive Officer» e come «CEO /
-- Amministratore Delegato», «Head of Human Resources» e «Head of HR»: due
-- convenzioni legacy mescolate, e nessun modo di sapere se erano due bacini o
-- lo stesso. Il nome deriva dal titolo della posizione servita.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c5l()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
BEGIN
  SELECT count(*), min(sp.succession_pool_name || ' ≠ ' || p.position_title)
    INTO v_cnt, v_sample
  FROM sys.sys_succession_pools sp
  JOIN sys.sys_positions p ON p.position_id = sp.succession_pool_position_id
  WHERE sp.succession_pool_tenant_id = c_rtl
    AND sp.succession_pool_name IS DISTINCT FROM 'Successione — ' || p.position_title;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C5l: % bacini il cui nome non è quello della posizione servita (es. %)', v_cnt, v_sample;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C6a — LA RIORGANIZZAZIONE HA LASCIATO TRACCIA, E LA TRACCIA È DATATA.
-- L'organigramma risultava esistere da sempre, identico a sé stesso: la
-- discontinuità del marzo 2025 non aveva prodotto una sola riga di storia.
-- ----------------------------------------------------------------------------
-- IL REGISTRO DEI RIORDINI AUTORIZZATI (#163, decisione di Enzo 2026-08-07).
-- Prima, C6a(ii) prendeva UNA data e pretendeva che ogni evento cadesse li': il modello
-- ammetteva una sola riorganizzazione nella vita dell'azienda. La ricostruzione
-- dell'organigramma del 2026-08-04 non era contemplata, e registrarne gli eventi faceva
-- scattare il check — cioe' il controllo puniva proprio il comportamento corretto.
-- Enzo ha deciso: «e' stata una riorganizzazione vera», e con essa la regola durevole
-- *le riorganizzazioni si autorizzano, ma una volta autorizzate si implementano E SI
-- REGISTRANO*. Quindi il vincolo non e' «un solo giorno», e' «solo giorni autorizzati»:
-- un evento organizzativo fuori da questo elenco resta un difetto, perche' significa che
-- qualcuno ha riorganizzato senza che nessuno lo autorizzasse.
-- Aggiungere un riordino QUI e' l'atto di registrazione. Una riga sola, in un posto solo.
CREATE OR REPLACE FUNCTION staging.storia36_riordini()
RETURNS date[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT ARRAY[
    DATE '2025-03-01',   -- il riordino raccontato dalla storia 36 mesi (6 eventi)
    DATE '2026-08-04'    -- la ricostruzione dell'organigramma, migrazioni 000244-000246
  ];
$fn$;

DROP FUNCTION IF EXISTS staging.storia36_check_c6a(date);
CREATE OR REPLACE FUNCTION staging.storia36_check_c6a()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM sys.sys_organization_unit_history h
  WHERE h.organization_unit_history_tenant_id = c_rtl;
  IF v_cnt < 5 THEN
    BEGIN
      RAISE EXCEPTION 'C6a: solo % eventi di storia organizzativa: la riorganizzazione non è raccontata', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(o.organization_unit_code || ' @ ' ||
                       h.organization_unit_history_effective_at::date)
    INTO v_cnt, v_sample
  FROM sys.sys_organization_unit_history h
  JOIN sys.sys_organization_units o ON o.organization_unit_id = h.organization_unit_history_unit_id
  WHERE h.organization_unit_history_tenant_id = c_rtl
    AND h.organization_unit_history_effective_at::date <> ALL (staging.storia36_riordini());
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6a(ii): % eventi datati fuori da un riordino registrato (es. %) — riordini registrati: %',
        v_cnt, v_sample, staging.storia36_riordini();
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(o.organization_unit_code) INTO v_cnt, v_sample
  FROM sys.sys_organization_unit_history h
  JOIN sys.sys_organization_units o ON o.organization_unit_id = h.organization_unit_history_unit_id
  LEFT JOIN sys.sys_users u ON u.user_id = h.organization_unit_history_actor_user_id
  WHERE h.organization_unit_history_tenant_id = c_rtl
    AND (u.user_id IS NULL OR u.user_tenant_id IS DISTINCT FROM h.organization_unit_history_tenant_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6a(iii): % eventi organizzativi senza un autore del tenant (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- un «cambiamento» che non cambia nulla è rumore, non storia
  SELECT count(*), min(o.organization_unit_code) INTO v_cnt, v_sample
  FROM sys.sys_organization_unit_history h
  JOIN sys.sys_organization_units o ON o.organization_unit_id = h.organization_unit_history_unit_id
  WHERE h.organization_unit_history_tenant_id = c_rtl
    AND h.organization_unit_history_old_value IS NOT NULL
    AND h.organization_unit_history_old_value = h.organization_unit_history_new_value;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6a(iv): % eventi in cui il prima e il dopo coincidono (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C6b — L'ALBERO REGGE ATTRAVERSO IL RIORDINO.
-- Qui NON si ricontrolla ciò che le chiavi esterne già impediscono: una
-- posizione appesa a un'unità inesistente, o un'assegnazione verso una
-- posizione che non c'è, sono difetti che il database rifiuta da sé — un check
-- che non può mai fallire non prova nulla, e infatti il suo selftest non
-- riusciva nemmeno a iniettare la violazione. Restano i due modi in cui una
-- riorganizzazione rompe davvero l'albero, e che nessun vincolo intercetta:
-- un'assegnazione che scavalca il tenant, e un ciclo nella gerarchia.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c6b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_position_assignments a
  JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  WHERE a.user_position_assignment_tenant_id = c_rtl
    AND a.user_position_assignment_status = 'ACTIVE'
    AND p.position_tenant_id IS DISTINCT FROM a.user_position_assignment_tenant_id;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6b: % persone assegnate a una posizione di un altro tenant (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- il genitore esiste (FK), ma nulla impedisce che l'albero si chiuda su sé
  -- stesso: è così che una riorganizzazione mal registrata produce un ciclo
  WITH RECURSIVE risalita AS (
    SELECT o.organization_unit_id AS partenza, o.organization_unit_parent_id AS corrente, 1 AS passi
      FROM sys.sys_organization_units o
     WHERE o.organization_unit_tenant_id = c_rtl AND o.organization_unit_parent_id IS NOT NULL
    UNION ALL
    SELECT r.partenza, p.organization_unit_parent_id, r.passi + 1
      FROM risalita r
      JOIN sys.sys_organization_units p ON p.organization_unit_id = r.corrente
     WHERE r.passi < 30 AND p.organization_unit_parent_id IS NOT NULL
  )
  SELECT count(*), min(o.organization_unit_code) INTO v_cnt, v_sample
  FROM risalita r
  JOIN sys.sys_organization_units o ON o.organization_unit_id = r.partenza
  WHERE r.corrente = r.partenza;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6b(ii): % unità che risalendo la gerarchia tornano su sé stesse (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- e ogni unità del tenant appartiene a un genitore dello STESSO tenant
  SELECT count(*), min(o.organization_unit_code) INTO v_cnt, v_sample
  FROM sys.sys_organization_units o
  JOIN sys.sys_organization_units p ON p.organization_unit_id = o.organization_unit_parent_id
  WHERE o.organization_unit_tenant_id = c_rtl
    AND p.organization_unit_tenant_id IS DISTINCT FROM o.organization_unit_tenant_id;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6b(iii): % unità appese a un genitore di un altro tenant (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C6c — IL RACCONTO ARRIVA AL PRESENTE, E IL PRESENTE NON È STATO TOCCATO.
-- È la post-condizione che rende onesto tutto il cluster: il seed scrive SOLO
-- storia, e ogni esito che la storia dichiara deve coincidere con l'organigramma
-- di oggi. Se qualcuno inventasse un passato che non porta qui, questo check
-- diventa rosso.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c6c()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  -- #163 — L'ULTIMO EVENTO, NON OGNI EVENTO.
  -- La stesura precedente confrontava OGNI esito col nome di oggi. Era giusta finche'
  -- un'unita veniva rinominata al massimo una volta: con due riordini registrati (2025 e
  -- 2026) il primo esito e' legittimamente diverso da oggi — e' proprio quello che
  -- significa avere una storia. Pretendere il contrario obbligherebbe a cancellare il
  -- passato per far tornare i conti, cioe' a distruggere il dato che il check protegge.
  -- La proprieta' vera e': l'ULTIMO esito dichiarato porta al presente.
  SELECT count(*), min(u.codice || ': storia «' || u.esito || '» ≠ oggi «' || u.oggi || '»')
    INTO v_cnt, v_sample
  FROM (SELECT DISTINCT ON (h.organization_unit_history_unit_id)
               o.organization_unit_code AS codice,
               h.organization_unit_history_new_value->>'name' AS esito,
               o.organization_unit_name AS oggi
          FROM sys.sys_organization_unit_history h
          JOIN sys.sys_organization_units o ON o.organization_unit_id = h.organization_unit_history_unit_id
         WHERE h.organization_unit_history_tenant_id = c_rtl
           AND h.organization_unit_history_new_value ? 'name'
         -- ordine TOTALE (si chiude sull'id): con due eventi che condividono
         -- effective_at E created_at, «l'ultimo» lo scegliebbe il piano. S1068.
         ORDER BY h.organization_unit_history_unit_id,
                  h.organization_unit_history_effective_at DESC, h.created_at DESC,
                  h.organization_unit_history_id DESC) u
  WHERE u.esito IS DISTINCT FROM u.oggi;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6c: % unità il cui ULTIMO esito di storia non è il nome che portano oggi (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- Stessa correzione per gli spostamenti: e' l'ultimo che deve finire dove l'unita sta
  -- oggi. Un'unita spostata due volte ha un primo approdo che non e' quello attuale, e
  -- non e' un difetto: e' il racconto.
  SELECT count(*), min(u.codice) INTO v_cnt, v_sample
  FROM (SELECT DISTINCT ON (h.organization_unit_history_unit_id)
               o.organization_unit_code AS codice,
               h.organization_unit_history_new_value->>'parent_name' AS approdo,
               par.organization_unit_name AS padre_oggi
          FROM sys.sys_organization_unit_history h
          JOIN sys.sys_organization_units o ON o.organization_unit_id = h.organization_unit_history_unit_id
          LEFT JOIN sys.sys_organization_units par ON par.organization_unit_id = o.organization_unit_parent_id
         WHERE h.organization_unit_history_tenant_id = c_rtl
           AND h.organization_unit_history_new_value ? 'parent_name'
         ORDER BY h.organization_unit_history_unit_id,
                  h.organization_unit_history_effective_at DESC, h.created_at DESC,
                  h.organization_unit_history_id DESC) u
  WHERE u.approdo IS DISTINCT FROM u.padre_oggi;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6c(ii): % unità il cui ULTIMO spostamento non finisce dove stanno oggi (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(o.organization_unit_code) INTO v_cnt, v_sample
  FROM sys.sys_organization_unit_history h
  JOIN sys.sys_organization_units o ON o.organization_unit_id = h.organization_unit_history_unit_id
  WHERE h.organization_unit_history_tenant_id = c_rtl
    AND h.organization_unit_history_change_type = 'MOVED'
    AND (h.organization_unit_history_old_value->>'parent_name')
        IS NOT DISTINCT FROM (h.organization_unit_history_new_value->>'parent_name');
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6c(iii): % spostamenti che partono e arrivano sotto lo stesso genitore (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C6d — IL MODELLO ADOTTATO DICE QUALCOSA.
-- Un blueprint attivato senza deroghe motivate è un'etichetta: non dice quali
-- processi la banca presidia davvero, e quali no.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c6d()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*) INTO v_cnt FROM sys.sys_blueprint_activations
  WHERE blueprint_activation_tenant_id = c_rtl AND blueprint_activation_status = 'ACTIVE';
  IF v_cnt = 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6d: nessun blueprint attivo: il modello organizzativo non è adottato';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(a.blueprint_activation_id::text) INTO v_cnt, v_sample
  FROM sys.sys_blueprint_activations a
  WHERE a.blueprint_activation_tenant_id = c_rtl
    AND a.blueprint_activation_status = 'ACTIVE'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_blueprint_overrides o
                     WHERE o.blueprint_override_activation_id = a.blueprint_activation_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6d(ii): % attivazioni senza una sola deroga: il modello è adottato in blocco (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(r.blueprint_process_code) INTO v_cnt, v_sample
  FROM sys.sys_blueprint_overrides o
  JOIN sys.sys_blueprint_activations a ON a.blueprint_activation_id = o.blueprint_override_activation_id
  LEFT JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_id = o.blueprint_override_process_id
  WHERE a.blueprint_activation_tenant_id = c_rtl
    AND (r.blueprint_process_id IS NULL
      OR o.blueprint_override_rationale IS NULL
      OR length(trim(o.blueprint_override_rationale)) < 10);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6d(iii): % deroghe orfane o senza motivazione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*) INTO v_cnt FROM (
    SELECT o.blueprint_override_activation_id, o.blueprint_override_process_id
      FROM sys.sys_blueprint_overrides o
      JOIN sys.sys_blueprint_activations a ON a.blueprint_activation_id = o.blueprint_override_activation_id
     WHERE a.blueprint_activation_tenant_id = c_rtl
     GROUP BY 1, 2 HAVING count(*) > 1) x;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C6d(iv): % processi con più di una deroga sulla stessa attivazione', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C7a — LE APPROVAZIONI RISPETTANO LA MACCHINA A STATI DEL MOTORE.
-- Il motore esisteva, era testato, e non aveva mai deciso niente: le due
-- tabelle erano vuote. Ora che contengono decisioni, quelle decisioni devono
-- essere quelle che il codice avrebbe prodotto — altrimenti il registro
-- racconta una storia che il prodotto non sa rileggere.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c7a()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  -- una richiesta chiusa non lascia passi indecisi al livello che l'ha chiusa
  SELECT count(*), min(r.approval_request_title) INTO v_cnt, v_sample
  FROM sys.sys_approval_requests r
  WHERE r.approval_request_tenant_id = c_rtl
    AND r.approval_request_status IN ('APPROVED', 'APPLIED')
    AND EXISTS (SELECT 1 FROM sys.sys_approval_steps s
                 WHERE s.approval_step_request_id = r.approval_request_id
                   AND s.approval_step_status = 'PENDING');
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7a: % richieste approvate con passi ancora in attesa (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- una richiesta respinta porta il rifiuto che l'ha causata
  SELECT count(*), min(r.approval_request_title) INTO v_cnt, v_sample
  FROM sys.sys_approval_requests r
  WHERE r.approval_request_tenant_id = c_rtl
    AND r.approval_request_status = 'REJECTED'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_approval_steps s
                     WHERE s.approval_step_request_id = r.approval_request_id
                       AND s.approval_step_status = 'REJECTED');
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7a(ii): % richieste respinte senza un passo di rifiuto (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- ogni decisione ha un autore e una data, e non precede la richiesta.
  -- #168: «senza autore» distingue i due casi — decided_by NULL con snapshot
  -- presente = decisore RIMOSSO (la storia c'e', il vivo no: legittimo);
  -- entrambi NULL = decisione senza autore, la violazione vera.
  SELECT count(*), min(r.approval_request_title) INTO v_cnt, v_sample
  FROM sys.sys_approval_steps s
  JOIN sys.sys_approval_requests r ON r.approval_request_id = s.approval_step_request_id
  WHERE s.approval_step_tenant_id = c_rtl
    AND s.approval_step_status IN ('APPROVED', 'REJECTED')
    AND (s.approval_step_decided_at IS NULL
      OR (s.approval_step_decided_by IS NULL AND s.approval_step_decided_by_snapshot IS NULL)
      OR s.approval_step_decided_at < r.created_at);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7a(iii): % decisioni senza autore, senza data o anteriori alla richiesta (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- una richiesta ancora aperta ha qualcosa da decidere
  SELECT count(*), min(r.approval_request_title) INTO v_cnt, v_sample
  FROM sys.sys_approval_requests r
  WHERE r.approval_request_tenant_id = c_rtl
    AND r.approval_request_status = 'PENDING'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_approval_steps s
                     WHERE s.approval_step_request_id = r.approval_request_id
                       AND s.approval_step_status = 'PENDING');
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7a(iv): % richieste in attesa senza un solo passo da decidere (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- ogni richiesta ha almeno un passo: un'approvazione senza approvatori non
  -- è un'approvazione
  SELECT count(*), min(r.approval_request_title) INTO v_cnt, v_sample
  FROM sys.sys_approval_requests r
  WHERE r.approval_request_tenant_id = c_rtl
    AND NOT EXISTS (SELECT 1 FROM sys.sys_approval_steps s
                     WHERE s.approval_step_request_id = r.approval_request_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7a(v): % richieste senza alcun approvatore (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- i livelli sono una catena: 1, 2, 3… senza buchi. Il motore materializza
  -- ordinali consecutivi, e un buco significa che un livello è stato perso per
  -- strada — è così che il secondo passo di sei richieste retributive spariva
  -- in silenzio quando il capo coincideva con chi doveva controfirmare.
  SELECT count(*), min(r.approval_request_title) INTO v_cnt, v_sample
  FROM sys.sys_approval_requests r
  JOIN LATERAL (
    SELECT min(s.approval_step_ordinal) AS primo,
           max(s.approval_step_ordinal) AS ultimo,
           count(DISTINCT s.approval_step_ordinal) AS livelli
      FROM sys.sys_approval_steps s
     WHERE s.approval_step_request_id = r.approval_request_id) g ON true
  WHERE r.approval_request_tenant_id = c_rtl
    AND g.livelli > 0
    AND (g.primo <> 1 OR g.ultimo <> g.livelli);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7a(vi): % richieste con i livelli non consecutivi da 1 (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C7b — OGNI APPROVAZIONE PUNTA A QUALCOSA CHE ESISTE, E NON LA CONTRADDICE.
-- `resource_id` non ha una chiave esterna (il tipo è polimorfo): la coerenza
-- va verificata a mano, o il registro si riempie di decisioni su nulla.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c7b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(r.approval_request_resource_type || ' ' || r.approval_request_resource_id)
    INTO v_cnt, v_sample
  FROM sys.sys_approval_requests r
  WHERE r.approval_request_tenant_id = c_rtl
    AND (
      (r.approval_request_resource_type = 'TIME_OFF_REQUEST'
       AND NOT EXISTS (SELECT 1 FROM sys.sys_time_off_requests t
                        WHERE t.request_id = r.approval_request_resource_id))
      OR (r.approval_request_resource_type = 'COMPENSATION_RECOMMENDATION'
       AND NOT EXISTS (SELECT 1 FROM sys.sys_compensation_recommendations c
                        WHERE c.compensation_recommendation_id = r.approval_request_resource_id))
      OR (r.approval_request_resource_type = 'TRAINING_INITIATIVE'
       AND NOT EXISTS (SELECT 1 FROM sys.sys_training_initiatives i
                        WHERE i.training_initiative_id = r.approval_request_resource_id))
    );
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7b: % approvazioni che puntano a una risorsa inesistente (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- per le assenze, chi ha firmato nel registro è chi risulta averle approvate:
  -- due verità sullo stesso fatto sarebbero una di troppo
  SELECT count(*), min(r.approval_request_title) INTO v_cnt, v_sample
  FROM sys.sys_approval_requests r
  JOIN sys.sys_approval_steps s ON s.approval_step_request_id = r.approval_request_id
  JOIN sys.sys_time_off_requests t ON t.request_id = r.approval_request_resource_id
  WHERE r.approval_request_tenant_id = c_rtl
    AND r.approval_request_resource_type = 'TIME_OFF_REQUEST'
    AND s.approval_step_approver_user_id IS DISTINCT FROM t.request_approver_user_id;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7b(ii): % approvazioni di assenza firmate da chi non risulta averle approvate (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- e lo stato concorda: un''assenza approvata non può avere una richiesta respinta
  SELECT count(*), min(r.approval_request_title) INTO v_cnt, v_sample
  FROM sys.sys_approval_requests r
  JOIN sys.sys_time_off_requests t ON t.request_id = r.approval_request_resource_id
  WHERE r.approval_request_tenant_id = c_rtl
    AND r.approval_request_resource_type = 'TIME_OFF_REQUEST'
    AND ((t.request_status = 'APPROVED' AND r.approval_request_status NOT IN ('APPROVED', 'APPLIED'))
      OR (t.request_status = 'PENDING'  AND r.approval_request_status <> 'PENDING'));
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C7b(iii): % approvazioni il cui esito contraddice lo stato dell''assenza (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C7c — I VOLUMI SONO QUELLI DI UN'AZIENDA, NON DI UNA DEMO.
-- Ferie che passano dal workflow formale, preferenze di notifica per tutti,
-- template KPI solo dove la corrispondenza è giustificata.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c7c(p_start date, p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_rate numeric;
  v_sample text;
BEGIN
  SELECT round(count(*)::numeric
               / GREATEST(1, (SELECT count(*) FROM sys.sys_users u
                               WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'))
               / GREATEST(1, (p_end - p_start) / 365.0), 2)
    INTO v_rate
  FROM sys.sys_approval_requests r
  WHERE r.approval_request_tenant_id = c_rtl
    AND r.approval_request_resource_type = 'TIME_OFF_REQUEST';
  IF v_rate < 0.3 OR v_rate > 2.0 THEN
    RAISE EXCEPTION 'C7c: % richieste di ferie per persona all''anno: fuori da un volume credibile (0,3-2,0)', v_rate;
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C7d — IL GATE DI ENZO: il programma non decide il RACI.
-- `sys_process_participants` NON è vuota (1.104 righe dal lavoro F4/#24,
-- migration 000179, chiuso a luglio) — la nota che la dava per vuota era già
-- inesatta quando è stata scritta. Ciò che il gate protegge però resta: chi
-- partecipa a quale processo lo decide Enzo, e il programma non ne scrive una
-- riga. Il check verifica QUESTO, che è verificabile, invece di un conteggio
-- che sarebbe falso.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c7d()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM sys.sys_process_participants
  WHERE process_participant_metadata->>'storia36' IS NOT NULL;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'C7d: % righe di RACI scritte dal programma: la partecipazione ai processi non è sua da decidere', v_cnt;
  END IF;
END $fn$;

-- ----------------------------------------------------------------------------
-- C8a — SI ASCOLTA CON REGOLARITÀ, E NON RISPONDONO TUTTI.
-- Prima: quattro cicli «chiusi» con 156 inviti dichiarati, zero domande e zero
-- risposte (gusci), due fermi in stato «attivo» da otto mesi, e nell'altra
-- famiglia un tasso di risposta del 92-96% che nessuna azienda ottiene.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c8a(p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  -- un ciclo chiuso senza domande non si è svolto: o è archiviato, o mente
  SELECT count(*), min(s.survey_title) INTO v_cnt, v_sample
  FROM sys.sys_surveys s
  WHERE s.survey_tenant_id = c_rtl
    AND s.survey_status = 'closed'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_survey_questions q
                     WHERE q.survey_question_survey_id = s.survey_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C8a: % rilevazioni chiuse senza una sola domanda (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- e nessuno resta «in corso» quando la sua finestra è chiusa da un mese
  SELECT count(*), min(s.survey_title) INTO v_cnt, v_sample
  FROM sys.sys_surveys s
  WHERE s.survey_tenant_id = c_rtl
    AND s.survey_status = 'active'
    AND s.survey_end_date IS NOT NULL
    AND s.survey_end_date::date < p_end - 30;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C8a(ii): % rilevazioni ancora aperte oltre la loro scadenza (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- nessun ciclo può avere più rispondenti che invitati: è impossibile, e
  -- vale per TUTTI i cicli, non solo per quelli scritti dal programma
  SELECT count(*), min(x.titolo || ': ' || x.tasso || '%') INTO v_cnt, v_sample
  FROM (
    SELECT s.survey_title AS titolo,
           round(100.0 * count(DISTINCT r.survey_response_subject_user_id)
                 / NULLIF(s.survey_total_invitations, 0), 1) AS tasso
      FROM sys.sys_surveys s
      JOIN sys.sys_survey_responses r ON r.survey_response_survey_id = s.survey_id
     WHERE s.survey_tenant_id = c_rtl
     GROUP BY s.survey_id, s.survey_title, s.survey_total_invitations
  ) x
  WHERE x.tasso > 100;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C8a(iii): % rilevazioni con più rispondenti che invitati (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- il tasso di risposta è quello di un'azienda vera: fra il 55% e il 90%
  SELECT count(*), min(x.titolo || ': ' || x.tasso || '%') INTO v_cnt, v_sample
  FROM (
    SELECT s.survey_title AS titolo,
           round(100.0 * count(DISTINCT r.survey_response_subject_user_id)
                 / NULLIF(s.survey_total_invitations, 0), 1) AS tasso
      FROM sys.sys_surveys s
      JOIN sys.sys_survey_responses r ON r.survey_response_survey_id = s.survey_id
     WHERE s.survey_tenant_id = c_rtl AND s.survey_status = 'closed'
       AND s.survey_metadata->>'storia36' = 'C8'
     GROUP BY s.survey_id, s.survey_title, s.survey_total_invitations
  ) x
  WHERE x.tasso IS NULL OR x.tasso < 55 OR x.tasso > 90;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C8a(iv): % rilevazioni con un tasso di risposta fuori dal credibile 55-90%% (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- si ascolta almeno due volte l'anno
  SELECT count(*), min(x.anno::text) INTO v_cnt, v_sample
  FROM (
    SELECT extract(year FROM s.survey_start_date)::int AS anno, count(*) AS cicli
      FROM sys.sys_surveys s
     WHERE s.survey_tenant_id = c_rtl AND s.survey_status = 'closed'
       AND s.survey_start_date IS NOT NULL
       AND extract(year FROM s.survey_start_date) BETWEEN 2024 AND extract(year FROM p_end)
     GROUP BY 1
  ) x
  WHERE x.cicli < 2;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C8a(v): % anni con meno di due rilevazioni (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C11a — UN GRAFO ATTIVO HA UNA DISPOSIZIONE, E OGNI NODO STA DA QUALCHE PARTE.
-- Prima: 158 nodi, 157 archi e ZERO layout — il grafo si ricalcolava a ogni
-- apertura e nessuno poteva conservare la propria vista. E i nodi erano tutti
-- senza tipo, mentre gli stili si applicano per tipo: nessuno stile poteva
-- funzionare.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c11a()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(g.graph_code) INTO v_cnt, v_sample
  FROM sys.sys_visualization_graphs g
  WHERE g.graph_tenant_id = c_rtl AND g.graph_is_active
    AND NOT EXISTS (SELECT 1 FROM sys.sys_visualization_layouts l
                     WHERE l.layout_graph_id = g.graph_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C11a: % grafi attivi senza una disposizione salvata (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(g.graph_code) INTO v_cnt, v_sample
  FROM sys.sys_visualization_graphs g
  JOIN sys.sys_visualization_layouts l ON l.layout_graph_id = g.graph_id AND l.is_default
  JOIN sys.sys_visualization_nodes n ON n.node_graph_id = g.graph_id
  WHERE g.graph_tenant_id = c_rtl AND g.graph_is_active
    AND NOT EXISTS (SELECT 1 FROM sys.sys_visualization_node_layouts nl
                     WHERE nl.layout_id = l.layout_id AND nl.node_id = n.node_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C11a(ii): % nodi senza posizione nella disposizione predefinita (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(n.node_label) INTO v_cnt, v_sample
  FROM sys.sys_visualization_nodes n
  JOIN sys.sys_visualization_graphs g ON g.graph_id = n.node_graph_id
  WHERE g.graph_tenant_id = c_rtl AND n.node_type IS NULL;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C11a(iii): % nodi senza tipo: nessuno stile può applicarsi (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(DISTINCT n.node_type) INTO v_cnt
  FROM sys.sys_visualization_nodes n
  JOIN sys.sys_visualization_graphs g ON g.graph_id = n.node_graph_id
  WHERE g.graph_tenant_id = c_rtl
    AND NOT EXISTS (SELECT 1 FROM sys.sys_visualization_styles s
                     WHERE s.style_graph_id = g.graph_id AND s.style_node_type = n.node_type);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C11a(iv): % tipi di nodo senza uno stile definito', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C11b — LA PIPELINE DI ACQUISIZIONE RACCONTA COSE VERE.
-- Le cinque tabelle registrano le corse di QUESTO programma: ogni cluster una
-- corsa, ogni seed un record candidato, e le validazioni sono quelle vere. Il
-- vantaggio è che non si può barare: se un cluster non è passato dalla doppia
-- esecuzione a zero righe, la sua validazione risulta FALLITA e si vede.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c11b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*) INTO v_cnt FROM sys.sys_seed_acquisition_runs
  WHERE seed_acquisition_run_tenant_id = c_rtl;
  IF v_cnt < 5 THEN
    BEGIN
      RAISE EXCEPTION 'C11b: solo % corse di acquisizione registrate: la pipeline non documenta il programma', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(r.seed_acquisition_run_code) INTO v_cnt, v_sample
  FROM sys.sys_seed_acquisition_runs r
  WHERE r.seed_acquisition_run_tenant_id = c_rtl
    AND NOT EXISTS (SELECT 1 FROM sys.sys_seed_candidate_records c
                     WHERE c.seed_candidate_record_run_id = r.seed_acquisition_run_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C11b(ii): % corse senza un solo record candidato (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(c.seed_candidate_record_natural_key) INTO v_cnt, v_sample
  FROM sys.sys_seed_candidate_records c
  WHERE c.seed_candidate_record_tenant_id = c_rtl
    AND NOT EXISTS (SELECT 1 FROM sys.sys_seed_validation_results v
                     WHERE v.seed_validation_result_candidate_id = c.seed_candidate_record_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C11b(iii): % record candidati senza una sola validazione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(c.seed_candidate_record_natural_key) INTO v_cnt, v_sample
  FROM sys.sys_seed_candidate_records c
  WHERE c.seed_candidate_record_tenant_id = c_rtl
    AND c.seed_candidate_record_validation_status = 'APPLIED'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_seed_approval_decisions d
                     WHERE d.seed_approval_decision_candidate_id = c.seed_candidate_record_id
                       AND d.seed_approval_decision_status = 'APPROVED');
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C11b(iv): % record applicati senza approvazione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- e ogni corsa dichiara la fonte da cui i dati vengono
  SELECT count(*), min(c.seed_candidate_record_natural_key) INTO v_cnt, v_sample
  FROM sys.sys_seed_candidate_records c
  WHERE c.seed_candidate_record_tenant_id = c_rtl
    AND NOT EXISTS (SELECT 1 FROM sys.sys_seed_source_evidence e
                     WHERE e.seed_source_evidence_candidate_id = c.seed_candidate_record_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C11b(v): % record senza la fonte da cui vengono (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C12a — LA DATA DI REGISTRAZIONE SEGUE IL FATTO, E NON E' LA STESSA PER TUTTI.
--
-- Nato dall'audit semantico del C12 (regola C1): otto tabelle registravano
-- fatti distribuiti su anni diversi con un timestamp identico per tutte le
-- righe — il giorno del popolamento. E' la firma del dato generato, e si vede
-- nel prodotto (ordinamenti per recente, filtri per data, "ultimo aggiornamento").
--
-- Il check ha DUE parti, per non degenerare in una lista da tenere aggiornata:
--   (i)  sulle colonne di registrazione dichiarate qui sotto — ognuna con il
--        fatto che deve seguire — nessun singolo giorno di calendario può
--        concentrare piu' del 40% delle righe;
--   (ii) COMPLETEZZA: qualunque ALTRA colonna `*_recorded_at` / `*_computed_at`
--        / `*_requested_at` / `*_detected_at` su una tabella `sys.*` popolata
--        deve essere o coperta da (i) o esente con motivo. Una tabella nuova
--        che nasce con date tutte uguali rende ROSSO il check da sola.
--
-- ESENTI CON MOTIVO, e il motivo e' MISURATO, non asserito. Due famiglie:
--
--  (a) ISTANTANEE PURE — righe = soggetti distinti, verificato riga per riga:
--      capability_scores 317/317 · flight_risk_scores 162/162 ·
--      gap_analysis_results 158/158 · skill_gap_scores 156/156 ·
--      talent_scores 154/154 · employee_position_fit_scores 146/146 ·
--      readiness_scores 90/90 · succession_scores 90/90.
--      Tengono lo STATO CORRENTE, non la storia dei calcoli: che l'ultimo
--      ricalcolo sia avvenuto in un batch e' corretto, non artefatto.
--      + capability_score_lineage: e' la derivazione del punteggio, segue il padre.
--
--  (b) ISTANTANEE PER DIMENSIONE — piu' righe per soggetto, ma il moltiplicatore
--      NON e' il tempo: e' un discriminante di contenuto, verificato:
--      model_predictions (3 per persona = `prediction_type`) ·
--      succession_readiness_scores (3 = `..._horizon`) ·
--      behavioral_assessments (3 = `..._dimension`).
--
--  (c) sys_person_evidence_records — ridatata dal C12, ma non ha un fatto
--      proprio da seguire (nessun periodo): sta fuori dalla parte (i), che
--      misura l'aderenza a un fatto, non la sola dispersione.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c12a()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  -- (tabella, colonna di registrazione, colonna del fatto che deve seguire)
  c_reg constant text[][] := ARRAY[
    ['sys_kpi_measurements',           'kpi_measurement_recorded_at',            'kpi_measurement_period_end'],
    ['sys_user_kpi_evidence',          'user_kpi_evidence_recorded_at',          'user_kpi_evidence_period_end'],
    ['sys_kpi_assessment_results',     'kpi_assessment_result_computed_at',      'kpi_assessment_result_period_end'],
    ['sys_compensation_recommendations','compensation_recommendation_computed_at','compensation_recommendation_period_end'],
    ['sys_overtime',                   'overtime_requested_at',                  'overtime_date'],
    ['sys_variable_pay_calculations',  'variable_pay_calculation_computed_at',   'variable_pay_calculation_period_end'],
    ['sys_learning_gaps',              'learning_gap_detected_at',               NULL],
    ['sys_assessment_results',         'assessment_result_recorded_at',          NULL],
    ['sys_user_assessment_evidence',   'user_assessment_evidence_recorded_at',   NULL],
    ['sys_reward_gate_results',        'reward_gate_result_recorded_at',         NULL]
  ];
  -- esenti dalla parte (iii), con il motivo MISURATO nel commento sopra
  c_exempt constant text[] := ARRAY[
    'sys_capability_scores', 'sys_capability_score_lineage', 'sys_person_evidence_records',
    'sys_flight_risk_scores', 'sys_gap_analysis_results', 'sys_skill_gap_scores',
    'sys_talent_scores', 'sys_employee_position_fit_scores', 'sys_readiness_scores',
    'sys_succession_scores', 'sys_model_predictions', 'sys_succession_readiness_scores',
    'sys_behavioral_assessments'];
  v_i     int;
  v_tab   text;
  v_col   text;
  v_fact  text;
  v_n     bigint;
  v_top   bigint;
  v_day   text;
  v_bad   bigint;
  v_smpl  text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  -- (i) nessun giorno domina le registrazioni
  FOR v_i IN 1 .. array_length(c_reg, 1) LOOP
    v_tab := c_reg[v_i][1]; v_col := c_reg[v_i][2]; v_fact := c_reg[v_i][3];

    EXECUTE format(
      'SELECT count(*) FROM sys.%I WHERE %I IS NOT NULL', v_tab, v_col) INTO v_n;
    EXECUTE format(
      'SELECT coalesce(max(z.c), 0), to_char(max(z.d) FILTER (WHERE z.c = (
         SELECT max(c2) FROM (SELECT count(*) AS c2 FROM sys.%I WHERE %I IS NOT NULL
                               GROUP BY %I::date) y)), ''YYYY-MM-DD'')
         FROM (SELECT %I::date AS d, count(*) AS c FROM sys.%I WHERE %I IS NOT NULL
                GROUP BY 1) z',
      v_tab, v_col, v_col, v_col, v_tab, v_col) INTO v_top, v_day;

    IF v_n >= 30 AND v_top::numeric / v_n > 0.40 THEN
      BEGIN
        RAISE EXCEPTION 'C12a: %.% concentra % delle % registrazioni in un solo giorno (%): e'' la data del popolamento, non quella del fatto',
          v_tab, v_col, round(v_top::numeric / v_n * 100) || '%', v_n, v_day;
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
        v_guasti := array_append(v_guasti, v_g);
      END;
    END IF;

    -- la registrazione non puo' precedere di piu' di un anno il fatto che segue
    IF v_fact IS NOT NULL THEN
      EXECUTE format(
        'SELECT count(*) FROM sys.%I WHERE %I IS NOT NULL AND %I IS NOT NULL
           AND %I < (%I::timestamptz - interval ''1 year'')',
        v_tab, v_col, v_fact, v_col, v_fact) INTO v_bad;
      IF v_bad > 0 THEN
        BEGIN
          RAISE EXCEPTION 'C12a(ii): %.%: % righe registrate piu'' di un anno PRIMA del fatto (%)',
            v_tab, v_col, v_bad, v_fact;
        EXCEPTION WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
          v_guasti := array_append(v_guasti, v_g);
        END;
      END IF;
    END IF;
  END LOOP;

  -- (iii) completezza: nessuna colonna di registrazione fuori dal perimetro.
  --
  -- Il conteggio delle righe e' REALE, non preso da `pg_stat_user_tables`: le
  -- statistiche sono asincrone e una tabella nuova (o mai analizzata) risulta a
  -- zero righe anche quando ne ha migliaia — sfuggirebbe al controllo proprio
  -- nel caso che conta. Scoperto dal selftest C12a(iii), che con le statistiche
  -- non scattava.
  SELECT count(*), min(c.table_name || '.' || c.column_name) INTO v_bad, v_smpl
  FROM information_schema.columns c
  WHERE c.table_schema = 'sys'
    AND c.column_name ~ '_(recorded|computed|requested|detected)_at$'
    AND NOT (c.table_name = ANY (c_exempt))
    AND NOT EXISTS (
      SELECT 1 FROM generate_subscripts(c_reg, 1) i
       WHERE c_reg[i][1] = c.table_name AND c_reg[i][2] = c.column_name)
    AND (xpath('/row/n/text()',
          query_to_xml(format('SELECT count(*) AS n FROM sys.%I', c.table_name),
                       false, true, '')))[1]::text::bigint >= 30;
  IF v_bad > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C12a(iii): % colonne di registrazione fuori dal perimetro del check (es. %): vanno sorvegliate o esentate con motivo',
        v_bad, v_smpl;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C12b — NESSUNA CODA DI APPROVAZIONE RESTA FERMA PER SEMPRE.
--
-- L'audit del C12 ha trovato 178 straordinari TUTTI in stato «in attesa», il
-- piu' recente di sette mesi prima: una coda che nessuno ha mai lavorato. Una
-- richiesta si autorizza o si respinge; quello che non fa e' restare pendente
-- per sempre. La soglia e' 60 giorni — oltre, l'attesa non e' piu' spiegabile
-- come lavorazione in corso.
--
-- Il check guarda anche la coerenza dell'atto: chi risulta autorizzato deve
-- avere un autorizzatore e una data (il vincolo di tabella lo impone, qui si
-- verifica che l'autorizzatore non sia la persona stessa — nessuno si approva
-- lo straordinario da solo).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c12b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_old text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(overtime_date)::text INTO v_cnt, v_old
  FROM sys.sys_overtime
  WHERE overtime_tenant_id = c_rtl
    AND overtime_status = 'PENDING'
    AND overtime_date < (current_date - 60);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C12b: % straordinari in attesa da oltre 60 giorni (il piu'' vecchio del %): la coda non e'' mai stata lavorata',
        v_cnt, v_old;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*) INTO v_cnt
  FROM sys.sys_overtime
  WHERE overtime_tenant_id = c_rtl
    AND overtime_approved_by_user_id = overtime_subject_user_id;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C12b(ii): % straordinari autorizzati dalla persona stessa', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C12c — IL CALENDARIO REGGE ANCHE QUANDO LA STORIA AVANZA.
-- La finestra di costruzione ha una lista di festività scritta a mano; il modo
-- `avanzamento` estende il calendario ad anni che quella lista non conosce, e
-- lo fa CALCOLANDO le festività (Pasqua compresa). Le due fonti devono dire la
-- stessa cosa dove si sovrappongono: è questo a rendere il calcolo falsificabile
-- invece che creduto. In più il calendario dev'essere DENSO (nessun giorno
-- mancante: un buco toglierebbe silenziosamente un giorno lavorativo dalla
-- storia) e coerente (mai lavorativo di sabato, domenica o in festività).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c12c()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_cnt bigint;
  v_min date;
  v_max date;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(cal_date), max(cal_date) INTO v_cnt, v_min, v_max
    FROM staging.storia36_calendar;

  -- (i) copertura e densità: proprietà, non fotografia (il massimo può crescere)
  IF v_min <> DATE '2023-08-01' OR v_max < DATE '2026-07-31' THEN
    BEGIN
      RAISE EXCEPTION 'C12c(i): il calendario non copre la finestra di costruzione (min=%, max=%)', v_min, v_max;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  IF v_cnt <> (v_max - v_min) + 1 THEN
    BEGIN
      RAISE EXCEPTION 'C12c(i): calendario con buchi — % giorni presenti su % fra % e %',
        v_cnt, (v_max - v_min) + 1, v_min, v_max;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- (ii) il calcolo delle festività coincide con la lista scritta a mano su
  --      TUTTA la finestra di costruzione. Se il calcolo della Pasqua fosse
  --      sbagliato, qui salterebbero fuori i Lunedì dell'Angelo.
  SELECT count(*), min(c.cal_date || ': tabella=' || COALESCE(c.holiday_name, '—')
                       || ' calcolo=' || COALESCE(staging.storia36_holiday_it(c.cal_date), '—'))
    INTO v_cnt, v_sample
    FROM staging.storia36_calendar c
   WHERE c.cal_date BETWEEN DATE '2023-08-01' AND DATE '2026-07-31'
     AND c.holiday_name IS DISTINCT FROM staging.storia36_holiday_it(c.cal_date);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C12c(ii): % giorni in cui la festività calcolata non coincide con quella scritta (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- (iii) coerenza is_workday su TUTTO il calendario, estensione compresa
  SELECT count(*), min(cal_date::text) INTO v_cnt, v_sample
    FROM staging.storia36_calendar
   WHERE is_workday
     AND (extract(isodow FROM cal_date) IN (6, 7) OR holiday_name IS NOT NULL);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C12c(iii): % giorni marcati lavorativi che sono weekend o festivi (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C10a — OGNUNO HA ESPRESSO UNA SCELTA SU OGNI TRATTAMENTO FACOLTATIVO.
-- Non «tutti hanno acconsentito»: i quattro scopi sono facoltativi e una
-- scelta può benissimo essere «no». Quello che non può mancare è la scelta —
-- e prima la tabella era vuota per tutte e 162 le persone.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c10a()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_users u
  WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
    AND (SELECT count(DISTINCT c.consent_purpose) FROM sys.sys_user_consents c
          WHERE c.consent_user_id = u.user_id) < 4;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10a: % persone che non hanno espresso una scelta su tutti e quattro i trattamenti (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_consents c
  JOIN sys.sys_users u ON u.user_id = c.consent_user_id
  WHERE c.consent_tenant_id = c_rtl
    AND c.consent_occurred_at::date < (
      SELECT min(e.user_employment_hire_date) FROM sys.sys_user_employment e
       WHERE e.user_employment_user_id = c.consent_user_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10a(ii): % scelte espresse prima dell''ingresso in azienda (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_user_consents c
  JOIN sys.sys_users u ON u.user_id = c.consent_user_id
  WHERE c.consent_tenant_id = c_rtl
    AND c.consent_source = 'ESS' AND c.consent_action = 'REVOKE'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_user_consents c2
                     WHERE c2.consent_user_id = c.consent_user_id
                       AND c2.consent_purpose = c.consent_purpose
                       AND c2.consent_action = 'GRANT'
                       AND c2.consent_occurred_at < c.consent_occurred_at);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10a(iii): % revoche di un consenso che non era mai stato dato (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C10b — LE RICHIESTE SULL'INTERESSATO SI CHIUDONO NEI TERMINI DI LEGGE.
-- Trenta giorni: è il termine, e una richiesta chiusa fuori termine è un
-- inadempimento, non un ritardo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c10b(p_end date)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*) INTO v_cnt FROM sys.sys_gdpr_requests
  WHERE gdpr_request_tenant_id = c_rtl;
  IF v_cnt = 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10b: nessuna richiesta dell''interessato in tre anni: il canale non è mai stato usato';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(g.gdpr_request_id::text) INTO v_cnt, v_sample
  FROM sys.sys_gdpr_requests g
  WHERE g.gdpr_request_tenant_id = c_rtl
    AND g.gdpr_request_report->>'giorni_impiegati' IS NOT NULL
    AND (g.gdpr_request_report->>'giorni_impiegati')::int > 30;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10b(ii): % richieste chiuse oltre i trenta giorni di legge (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(g.gdpr_request_id::text) INTO v_cnt, v_sample
  FROM sys.sys_gdpr_requests g
  LEFT JOIN sys.sys_users u ON u.user_id = g.gdpr_request_subject_user_id
  WHERE g.gdpr_request_tenant_id = c_rtl
    AND (u.user_id IS NULL OR u.user_tenant_id IS DISTINCT FROM g.gdpr_request_tenant_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10b(iii): % richieste su una persona che non appartiene al tenant (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C10c — LE SEGNALAZIONI LE TIENE IL CUSTODE, E RIGUARDANO IL PROCESSO.
-- Il custode non è «un amministratore»: è chi ha il ruolo. E una segnalazione
-- chiusa deve avere il riscontro che è stato dato a chi l'ha fatta — senza,
-- il canale è una cassetta postale che non risponde.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c10c()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(w.whistleblowing_report_tracking_code) INTO v_cnt, v_sample
  FROM sys.sys_whistleblowing_reports w
  WHERE w.whistleblowing_report_tenant_id = c_rtl
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_auth_roles ur
       JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
      WHERE ur.user_auth_role_user_id = w.whistleblowing_report_assignee_user_id
        AND r.auth_role_code = 'WHISTLEBLOWING_CUSTODIAN');
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10c: % segnalazioni affidate a chi non è il custode (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(w.whistleblowing_report_tracking_code) INTO v_cnt, v_sample
  FROM sys.sys_whistleblowing_reports w
  WHERE w.whistleblowing_report_tenant_id = c_rtl
    AND w.whistleblowing_report_status IN ('SUBSTANTIATED', 'UNSUBSTANTIATED', 'CLOSED')
    AND (w.whistleblowing_report_public_message IS NULL
      OR length(trim(w.whistleblowing_report_public_message)) < 20);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10c(ii): % segnalazioni chiuse senza un riscontro a chi le ha fatte (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*) INTO v_cnt FROM (
    SELECT whistleblowing_report_tracking_code FROM sys.sys_whistleblowing_reports
     WHERE whistleblowing_report_tenant_id = c_rtl
       AND (whistleblowing_report_tracking_code IS NULL
         OR length(whistleblowing_report_tracking_code) < 6)
    UNION ALL
    SELECT whistleblowing_report_tracking_code FROM sys.sys_whistleblowing_reports
     WHERE whistleblowing_report_tenant_id = c_rtl
     GROUP BY 1 HAVING count(*) > 1) x;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10c(iii): % segnalazioni con codice di riscontro assente o ripetuto', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C10d — GLI ACCESSI DICONO CHI USA IL SISTEMA, E DA QUANDO.
-- Prima: 91.761 eventi, ma dodici persone in due mesi — il traffico dei
-- collaudi. Nessuno può risultare entrato prima di essere stato assunto.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c10d()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(u.user_email) INTO v_cnt, v_sample
  FROM sys.sys_auth_login_events le
  JOIN sys.sys_users u ON u.user_id = le.auth_login_event_user_id
  WHERE le.auth_login_event_details->>'storia36' = 'C10'
    AND le.created_at::date < (
      SELECT min(e.user_employment_hire_date) FROM sys.sys_user_employment e
       WHERE e.user_employment_user_id = le.auth_login_event_user_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C10d: % accessi registrati prima dell''assunzione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(DISTINCT le.auth_login_event_user_id) INTO v_cnt
  FROM sys.sys_auth_login_events le
  JOIN sys.sys_users u ON u.user_id = le.auth_login_event_user_id
  WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE';
  IF v_cnt < 100 THEN
    BEGIN
      RAISE EXCEPTION 'C10d(ii): solo % persone risultano avere mai usato il sistema', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C9a — UN DOCUMENTO PUBBLICATO HA UNA STORIA, E LA STORIA VA AVANTI.
-- Prima: 163 documenti e NESSUNO pubblicato — il portale del dipendente aveva
-- una sezione documenti che non mostrava niente. E un documento «pubblicato
-- nel 2021» che è stato rivisto tre volte porta comunque la data del 2021, se
-- nessuno lo riallinea alla sua ultima revisione.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c9a()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM sys.sys_content_documents d
  WHERE d.document_tenant_id = c_rtl AND d.document_status = 'published';
  IF v_cnt < 5 THEN
    BEGIN
      RAISE EXCEPTION 'C9a: solo % documenti pubblicati: il manuale del dipendente è vuoto', v_cnt;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- ogni documento pubblicato ha almeno una versione
  SELECT count(*), min(d.document_title) INTO v_cnt, v_sample
  FROM sys.sys_content_documents d
  WHERE d.document_tenant_id = c_rtl AND d.document_status = 'published'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_content_versions v
                     WHERE v.version_document_id = d.document_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C9a(ii): % documenti pubblicati senza una sola versione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- i numeri di versione sono consecutivi da 1 e le date crescono con loro
  SELECT count(*), min(d.document_title) INTO v_cnt, v_sample
  FROM sys.sys_content_documents d
  JOIN LATERAL (
    SELECT min(v.version_number) AS primo, max(v.version_number) AS ultimo,
           count(*) AS quante,
           bool_or(v.created_at < prec.created_at) AS fuori_ordine
      FROM sys.sys_content_versions v
      LEFT JOIN LATERAL (
        SELECT v2.created_at FROM sys.sys_content_versions v2
         WHERE v2.version_document_id = v.version_document_id
           AND v2.version_number = v.version_number - 1) prec ON true
     WHERE v.version_document_id = d.document_id) g ON true
  WHERE d.document_tenant_id = c_rtl AND d.document_status = 'published'
    AND g.quante > 0
    AND (g.primo <> 1 OR g.ultimo <> g.quante OR COALESCE(g.fuori_ordine, false));
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C9a(iii): % documenti con versioni non consecutive o con date che tornano indietro (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- ogni revisione dice che cosa è cambiato
  SELECT count(*), min(d.document_title) INTO v_cnt, v_sample
  FROM sys.sys_content_versions v
  JOIN sys.sys_content_documents d ON d.document_id = v.version_document_id
  WHERE v.version_tenant_id = c_rtl
    -- solo i documenti VIVI: la nota di revisione serve a chi legge il
    -- documento oggi. Gli archiviati sono storia chiusa (e fra loro ci sono 13
    -- revisioni senza nota, residui di collaudo E2E: dichiarati, non nascosti)
    AND d.document_status = 'published'
    AND (v.version_change_note IS NULL OR length(trim(v.version_change_note)) < 10);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C9a(iv): % revisioni che non dicono che cosa è cambiato (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- e il documento è allineato alla sua ultima revisione
  SELECT count(*), min(d.document_title) INTO v_cnt, v_sample
  FROM sys.sys_content_documents d
  JOIN LATERAL (
    SELECT v.version_id, v.created_at FROM sys.sys_content_versions v
     WHERE v.version_document_id = d.document_id
     ORDER BY v.version_number DESC LIMIT 1) ult ON true
  WHERE d.document_tenant_id = c_rtl AND d.document_status = 'published'
    AND (d.document_current_version_id IS DISTINCT FROM ult.version_id
      OR d.document_effective_date IS DISTINCT FROM ult.created_at::date);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C9a(v): % documenti che non puntano alla loro ultima revisione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C9b — OGNI DOCUMENTO STA DA QUALCHE PARTE.
-- Prima: zero categorie in tutto il sistema, e quindi 163 documenti su 163
-- senza collocazione. Un manuale senza indice è un mucchio di file.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c9b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*) INTO v_cnt FROM sys.sys_content_categories
  WHERE category_tenant_id = c_rtl;
  IF v_cnt = 0 THEN
    BEGIN
      RAISE EXCEPTION 'C9b: nessuna categoria di contenuto: i documenti non hanno dove stare';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  SELECT count(*), min(d.document_title) INTO v_cnt, v_sample
  FROM sys.sys_content_documents d
  WHERE d.document_tenant_id = c_rtl AND d.document_status = 'published'
    AND d.document_category_id IS NULL;
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C9b(ii): % documenti pubblicati senza categoria (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- una categoria che non contiene niente non serve a nessuno
  SELECT count(*), min(c.category_name) INTO v_cnt, v_sample
  FROM sys.sys_content_categories c
  WHERE c.category_tenant_id = c_rtl
    AND c.category_metadata->>'storia36' = 'C9'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_content_documents d
                     WHERE d.document_category_id = c.category_id);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C9b(iii): % categorie senza un solo documento (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C8b — IL CLIMA RACCONTA LA RIORGANIZZAZIONE.
-- Non è un vezzo narrativo: se il clima fosse piatto attorno a una
-- riorganizzazione che ha accorpato due divisioni e spostato tre direzioni,
-- il dato direbbe che la riorganizzazione non è successa. Una riorganizzazione
-- costa circa mezzo punto e il recupero richiede due-quattro trimestri.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c8b()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_prima numeric;
  v_dopo  numeric;
  v_fine  numeric;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT round(avg(r.survey_response_rating_value), 2) INTO v_prima
  FROM sys.sys_survey_responses r
  JOIN sys.sys_surveys s ON s.survey_id = r.survey_response_survey_id
  WHERE s.survey_tenant_id = c_rtl AND s.survey_start_date::date < DATE '2025-03-01';

  SELECT round(avg(r.survey_response_rating_value), 2) INTO v_dopo
  FROM sys.sys_survey_responses r
  JOIN sys.sys_surveys s ON s.survey_id = r.survey_response_survey_id
  WHERE s.survey_tenant_id = c_rtl
    AND s.survey_start_date::date BETWEEN DATE '2025-03-01' AND DATE '2025-06-30';

  SELECT round(avg(r.survey_response_rating_value), 2) INTO v_fine
  FROM sys.sys_survey_responses r
  JOIN sys.sys_surveys s ON s.survey_id = r.survey_response_survey_id
  WHERE s.survey_tenant_id = c_rtl AND s.survey_start_date::date >= DATE '2026-01-01';

  IF v_prima IS NULL OR v_dopo IS NULL OR v_fine IS NULL THEN
    BEGIN
      RAISE EXCEPTION 'C8b: manca la misura del clima prima (%), subito dopo (%) o a distanza (%) dalla riorganizzazione',
        v_prima, v_dopo, v_fine;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  IF v_prima - v_dopo < 0.30 THEN
    BEGIN
      RAISE EXCEPTION 'C8b(ii): il clima non registra la riorganizzazione: prima %, subito dopo % (flessione attesa >= 0,30)',
        v_prima, v_dopo;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  IF v_fine - v_dopo < 0.30 THEN
    BEGIN
      RAISE EXCEPTION 'C8b(iii): dopo la flessione non c''è recupero: subito dopo %, a distanza % (ripresa attesa >= 0,30)',
        v_dopo, v_fine;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
  END IF;

END $fn$;

-- ----------------------------------------------------------------------------
-- C8c — A UN CLIMA CHE SCENDE SEGUE QUALCOSA.
-- Un risultato sotto soglia senza un piano d'azione è una misurazione che non
-- ha prodotto nulla — e quella è la ragione per cui le rilevazioni smettono di
-- funzionare: la gente risponde finché vede che serve.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_check_c8c()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_cnt bigint;
  v_sample text;
  v_guasti text[] := '{}';
  v_g      text;
BEGIN
  SELECT count(*), min(x.titolo) INTO v_cnt, v_sample
  FROM (
    SELECT s.survey_id, s.survey_title AS titolo,
           avg(r.survey_response_rating_value) AS media
      FROM sys.sys_surveys s
      JOIN sys.sys_survey_responses r ON r.survey_response_survey_id = s.survey_id
     WHERE s.survey_tenant_id = c_rtl AND s.survey_status = 'closed'
     GROUP BY 1, 2
  ) x
  WHERE x.media < 7.2
    AND NOT EXISTS (SELECT 1 FROM sys.sys_engagement_action_plans p
                     WHERE p.action_plan_source_id = x.survey_id
                       AND p.action_plan_tenant_id = c_rtl);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C8c: % rilevazioni sotto soglia senza un solo piano d''azione (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;

  -- e un piano senza responsabile o senza scadenza non è un piano
  SELECT count(*), min(p.action_plan_title) INTO v_cnt, v_sample
  FROM sys.sys_engagement_action_plans p
  WHERE p.action_plan_tenant_id = c_rtl
    AND (p.action_plan_owner_user_id IS NULL OR p.action_plan_due_date IS NULL);
  IF v_cnt > 0 THEN
    BEGIN
      RAISE EXCEPTION 'C8c(ii): % piani d''azione senza responsabile o senza scadenza (es. %)', v_cnt, v_sample;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_g = MESSAGE_TEXT;
      v_guasti := array_append(v_guasti, v_g);
    END;
  END IF;
  -- Un solo verdetto, con TUTTI i guasti: fermarsi al primo ne
  -- nasconderebbe gli altri fino alla corsa successiva.
  IF array_length(v_guasti, 1) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_guasti, ' | ');
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
  v_esca_module_id uuid;  -- modulo-esca creato da ST-C4d (#153), rimosso dal rollback
BEGIN
  -- ST-G1: una presenza spostata oltre la finestra deve far scattare G1
  v_fired := false;
  BEGIN
    UPDATE sys.sys_attendance SET attendance_date = v_end + 999
     WHERE ctid = (SELECT ctid FROM sys.sys_attendance LIMIT 1);
    PERFORM staging.storia36_check_g1(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%G1:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%G2:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%G4:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%G6:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C1a:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C1b:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C1c%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C1d:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C2a:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C2c:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C2d:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C2b:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C2e:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C2f:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C2g:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C3b:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C3c:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C3d:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C3a:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C3e:%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4a%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4b%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4c%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4c FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4c (violazione iniettata rilevata, rollback)';

  -- ST-C4d: puntare un'iniziativa a un modulo non mappato ad alcuna competenza
  --
  -- L'esca se la CREA il selftest (2026-08-06, #153). Prima la cercava fra i
  -- moduli esistenti — `il primo senza mappatura verso una competenza` — e
  -- quindi dipendeva dall'esistenza di un dato sporco. Quando il catalogo è
  -- stato ripulito quel dato è sparito: oggi tutti e 92 i moduli hanno la loro
  -- mappatura, la sottoquery tornava NULL, e l'UPDATE sbatteva contro il NOT
  -- NULL della colonna. La batteria moriva lì con un errore di vincolo — non
  -- con un check rosso — e il timer settimanale della custodia falliva senza
  -- che il messaggio dicesse perché.
  --
  -- Il fatto era MIGLIORATO, non rotto: è il selftest che era fragile perché
  -- fotografava uno stato invece di costruirsi le proprie condizioni. Un
  -- selftest che ha bisogno di sporcizia preesistente smette di provare
  -- qualcosa il giorno in cui si fa pulizia — cioè quando servirebbe di più.
  -- Tutto dentro il blocco, e il rollback esterno lo porta via.
  v_fired := false;
  BEGIN
    INSERT INTO sys.sys_learning_modules (
      learning_module_code, learning_module_title, learning_module_kind,
      learning_module_delivery, learning_module_is_global, learning_module_metadata)
    VALUES ('ST-C4D-ESCA', 'Selftest C4d — modulo senza competenze mappate',
            'COURSE', 'SELF_PACED', true, '{"selftest":"C4d"}'::jsonb)
    RETURNING learning_module_id INTO v_esca_module_id;

    UPDATE sys.sys_training_initiatives
       SET training_initiative_module_id = v_esca_module_id
     WHERE ctid = (SELECT ti.ctid FROM sys.sys_training_initiatives ti LIMIT 1);
    PERFORM staging.storia36_check_c4d(v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C4d%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4e%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4f%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4d%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4c%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4b%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4g%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4a%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4h%' THEN v_fired := true;
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
    IF SQLERRM LIKE '%C4h%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN
    RAISE EXCEPTION 'SELFTEST C4h(v) FALLITO: violazione iniettata non rilevata';
  END IF;
  RAISE NOTICE '[OK] SELFTEST C4h(v) (sede senza squadra di emergenza rilevata, rollback)';

  -- ST-C5a: retrodatare un'esperienza all'adolescenza del soggetto
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_professional_experiences
       SET user_prof_exp_start_date = user_prof_exp_start_date - 4000
     WHERE ctid = (SELECT x.ctid FROM sys.sys_user_professional_experiences x LIMIT 1);
    PERFORM staging.storia36_check_c5a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5a%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5a FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5a (esperienza impossibile rilevata, rollback)';

  -- ST-C5b: svuotare il bacino di una posizione critica
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_successor_candidates sc
     USING sys.sys_succession_pools sp, sys.sys_critical_positions cp
     WHERE sc.successor_candidate_pool_id = sp.succession_pool_id
       AND cp.critical_position_position_id = sp.succession_pool_position_id
       AND cp.critical_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
    PERFORM staging.storia36_check_c5b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5b%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5b FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5b (posizione critica scoperta rilevata, rollback)';

  -- ST-C5c: puntare un obiettivo alla posizione che si occupa gia'
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_target_positions t
       SET user_target_position_position_id = (
             SELECT a.user_position_assignment_position_id
               FROM sys.sys_user_position_assignments a
              WHERE a.user_position_assignment_user_id = t.user_target_position_user_id
                AND a.user_position_assignment_kind = 'PRIMARY'
                AND a.user_position_assignment_status = 'ACTIVE' LIMIT 1)
     WHERE ctid = (SELECT t2.ctid FROM sys.sys_user_target_positions t2 LIMIT 1);
    PERFORM staging.storia36_check_c5c();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5c%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5c FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5c (obiettivo = posizione attuale rilevato, rollback)';

  -- ST-C5d: registrare un «cambiamento» di requisito che non cambia nulla
  v_fired := false;
  BEGIN
    UPDATE sys.sys_position_skill_requirement_history
       SET position_skill_requirement_history_old_proficiency =
             position_skill_requirement_history_new_proficiency
     WHERE ctid = (SELECT hh.ctid FROM sys.sys_position_skill_requirement_history hh LIMIT 1);
    PERFORM staging.storia36_check_c5d(current_setting('storia36.window_start')::date, v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5d%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5d FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5d (variazione nulla rilevata, rollback)';

  -- ST-C5e: togliere la data d'inizio a un titolo di studio
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_education_records
       SET user_education_start_date = NULL
     WHERE ctid = (SELECT e2.ctid FROM sys.sys_user_education_records e2
                    JOIN sys.sys_users u2 ON u2.user_id = e2.user_education_record_user_id
                   WHERE u2.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                     AND e2.user_education_end_date IS NOT NULL LIMIT 1);
    PERFORM staging.storia36_check_c5e();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5e%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5e FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5e (titolo senza durata rilevato, rollback)';

  -- ==========================================================================
  -- I RAMI SECONDARI (rilievo #22 della coda C5)
  -- Ogni funzione di check ha più rami, ma il selftest ne provava UNO solo: gli
  -- altri nove non erano mai stati visti fallire, e un check mai visto fallire
  -- non prova nulla. Qui ogni ramo ha la sua iniezione, e il confronto è sul
  -- messaggio ESATTO del ramo — così un'iniezione che fa scattare il ramo
  -- sbagliato viene contata come selftest fallito, non come successo.
  -- ==========================================================================

  -- ST-C5a(ii): far finire un'esperienza precedente dopo l'ingresso in RTL
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_professional_experiences x
       SET user_prof_exp_end_date = (
             SELECT max(em.user_employment_hire_date) + 30 FROM sys.sys_user_employment em
              WHERE em.user_employment_user_id = x.user_prof_exp_user_id)
     WHERE ctid = (SELECT x2.ctid FROM sys.sys_user_professional_experiences x2
                    WHERE x2.user_prof_exp_metadata->>'tratto' = x2.user_prof_exp_metadata->>'su'
                    LIMIT 1);
    PERFORM staging.storia36_check_c5a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5a(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5a(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5a(ii) (esperienza che sconfina nell''impiego attuale, rollback)';

  -- ST-C5a(iii): sovrapporre due esperienze consecutive della stessa persona
  v_fired := false;
  BEGIN
    -- 120 giorni: lo stacco fra un impiego e il successivo arriva a 87, quindi
    -- un salto più corto non basta a sovrapporli
    UPDATE sys.sys_user_professional_experiences
       SET user_prof_exp_start_date = user_prof_exp_start_date - 120
     WHERE ctid = (SELECT x2.ctid FROM sys.sys_user_professional_experiences x2
                    WHERE (x2.user_prof_exp_metadata->>'tratto')::int > 1 LIMIT 1);
    PERFORM staging.storia36_check_c5a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5a(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5a(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5a(iii) (due impieghi sovrapposti, rollback)';

  -- ST-C5a(iv): far finire un'esperienza prima di cominciare
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_professional_experiences
       SET user_prof_exp_end_date = user_prof_exp_start_date - 1
     WHERE ctid = (SELECT x2.ctid FROM sys.sys_user_professional_experiences x2
                    WHERE x2.user_prof_exp_metadata->>'tratto' = x2.user_prof_exp_metadata->>'su'
                    LIMIT 1);
    PERFORM staging.storia36_check_c5a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5a(iv)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5a(iv) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5a(iv) (esperienza che finisce prima di iniziare, rollback)';

  -- ST-C5b(ii): togliere a un successore tutte le valutazioni di prontezza
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_successor_readiness
     WHERE successor_readiness_candidate_id = (
       SELECT sc.successor_candidate_id FROM sys.sys_successor_candidates sc
        WHERE sc.successor_candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c5b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5b(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5b(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5b(ii) (successore mai valutato, rollback)';

  -- ST-C5b(iii): dichiarare un livello di prontezza che nessuno ha misurato
  v_fired := false;
  BEGIN
    UPDATE sys.sys_successor_candidates sc
       SET successor_candidate_readiness_level =
             CASE WHEN sc.successor_candidate_readiness_level = 'READY_NOW'
                  THEN 'NOT_READY' ELSE 'READY_NOW' END
     WHERE sc.ctid = (SELECT s2.ctid FROM sys.sys_successor_candidates s2
                       WHERE s2.successor_candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                         AND EXISTS (SELECT 1 FROM sys.sys_successor_readiness r
                                      WHERE r.successor_readiness_candidate_id = s2.successor_candidate_id)
                       LIMIT 1);
    PERFORM staging.storia36_check_c5b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5b(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5b(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5b(iii) (prontezza dichiarata e mai misurata, rollback)';

  -- ST-C5c: puntare un obiettivo a una posizione di un altro tenant
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_target_positions
       SET user_target_position_position_id = (
             SELECT p.position_id FROM sys.sys_positions p
              WHERE p.position_tenant_id <> '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1)
     WHERE ctid = (SELECT t2.ctid FROM sys.sys_user_target_positions t2
                    WHERE t2.user_target_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                    LIMIT 1);
    PERFORM staging.storia36_check_c5c();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5c:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5c FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5c (obiettivo fuori dal tenant, rollback)';

  -- ST-C5c(iii): staccare l'obiettivo da ogni percorso di carriera
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_position_career_paths pcp
     WHERE pcp.position_id IN (
       SELECT t.user_target_position_position_id FROM sys.sys_user_target_positions t
        WHERE t.user_target_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
          AND t.user_target_position_review_status <> 'REJECTED' LIMIT 1);
    PERFORM staging.storia36_check_c5c();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5c(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5c(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5c(iii) (obiettivo irraggiungibile da ogni percorso, rollback)';

  -- ST-C5c(iv): rendere l'obiettivo lo STESSO mestiere che si fa già — la
  -- degenerazione che la prima versione produceva (22 direttori di filiale che
  -- «aspiravano» a fare i cassieri). Si inietta sul titolo e non svuotando la
  -- posizione, perché togliere i titolari fa scattare prima il ramo (iii).
  v_fired := false;
  BEGIN
    WITH scelto AS (
      SELECT t.user_target_position_position_id AS meta, p_ora.position_title AS titolo
        FROM sys.sys_user_target_positions t
        JOIN sys.sys_user_position_assignments a
          ON a.user_position_assignment_user_id = t.user_target_position_user_id
         AND a.user_position_assignment_kind = 'PRIMARY'
         AND a.user_position_assignment_status = 'ACTIVE'
        JOIN sys.sys_positions p_ora ON p_ora.position_id = a.user_position_assignment_position_id
       WHERE t.user_target_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
         AND t.user_target_position_review_status <> 'REJECTED'
       LIMIT 1)
    UPDATE sys.sys_positions p SET position_title = s.titolo
      FROM scelto s WHERE p.position_id = s.meta;
    PERFORM staging.storia36_check_c5c();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5c(iv)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5c(iv) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5c(iv) (obiettivo su una scrivania vuota, rollback)';

  -- ST-C5d(ii): attribuire una variazione di requisito a un autore inesistente
  v_fired := false;
  BEGIN
    UPDATE sys.sys_position_skill_requirement_history
       SET position_skill_requirement_history_actor_user_id = NULL
     WHERE ctid = (SELECT h2.ctid FROM sys.sys_position_skill_requirement_history h2 LIMIT 1);
    PERFORM staging.storia36_check_c5d(current_setting('storia36.window_start')::date, v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5d(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5d(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5d(ii) (variazione senza autore, rollback)';

  -- ==========================================================================
  -- I CHECK NUOVI DELLA CODA (#18 #4/#5 #27 #30/#33 #13/#20 #23 #19)
  -- ==========================================================================

  -- ST-C5f: togliere la criticità in anagrafica a una posizione del registro
  v_fired := false;
  BEGIN
    UPDATE sys.sys_positions SET position_criticality = 'MEDIUM'
     WHERE position_id = (SELECT cp.critical_position_position_id FROM sys.sys_critical_positions cp
                           WHERE cp.critical_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c5f();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5f:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5f FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5f (posizione critica che l''anagrafica non dice critica, rollback)';

  -- ST-C5f(ii): dichiarare critica in anagrafica una posizione fuori registro
  v_fired := false;
  BEGIN
    UPDATE sys.sys_positions SET position_criticality = 'CRITICAL'
     WHERE position_id = (SELECT p.position_id FROM sys.sys_positions p
                           WHERE p.position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                             AND NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions cp
                                              WHERE cp.critical_position_position_id = p.position_id)
                           LIMIT 1);
    PERFORM staging.storia36_check_c5f();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5f(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5f(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5f(ii) (criticità dichiarata fuori dal registro, rollback)';

  -- ST-C5f(iii): spegnere la segnalazione di criticità sulla vista successione
  v_fired := false;
  BEGIN
    UPDATE sys.sys_position_succession_relevance SET is_critical = false
     WHERE position_id = (SELECT cp.critical_position_position_id FROM sys.sys_critical_positions cp
                           WHERE cp.critical_position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c5f();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5f(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5f(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5f(iii) (criticità spenta sulla vista successione, rollback)';

  -- ST-C5f(iv): segnalare critica una posizione che il registro non conosce
  v_fired := false;
  BEGIN
    UPDATE sys.sys_position_succession_relevance SET is_critical = true
     WHERE position_id = (SELECT r.position_id FROM sys.sys_position_succession_relevance r
                           WHERE r.position_succession_relevance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                             AND NOT r.is_critical LIMIT 1);
    PERFORM staging.storia36_check_c5f();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5f(iv)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5f(iv) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5f(iv) (criticità segnalata fuori dal registro, rollback)';

  -- ST-C5f(v): cancellare l'orizzonte di copertura di una posizione con bacino
  v_fired := false;
  BEGIN
    UPDATE sys.sys_position_succession_relevance SET readiness_horizon = NULL
     WHERE position_succession_relevance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND readiness_horizon IS NOT NULL;
    PERFORM staging.storia36_check_c5f();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5f(v)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5f(v) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5f(v) (bacino popolato senza orizzonte di copertura, rollback)';

  -- ST-C5g: mettere in un bacino qualcuno che non c'entra con quella posizione
  v_fired := false;
  BEGIN
    UPDATE sys.sys_successor_candidates sc
       SET successor_candidate_user_id = (
             -- qualcuno che di quella posizione non è né il riporto né il pari
             SELECT a.user_position_assignment_user_id
               FROM sys.sys_user_position_assignments a
               JOIN sys.sys_positions cpz ON cpz.position_id = a.user_position_assignment_position_id
               JOIN sys.sys_succession_pools sp ON sp.succession_pool_id = sc.successor_candidate_pool_id
               JOIN sys.sys_positions pp ON pp.position_id = sp.succession_pool_position_id
              WHERE a.user_position_assignment_status = 'ACTIVE'
                AND cpz.position_reports_to_position_id IS DISTINCT FROM sp.succession_pool_position_id
                AND cpz.position_title <> pp.position_title
                AND NOT EXISTS (SELECT 1 FROM sys.sys_successor_candidates s3
                                 WHERE s3.successor_candidate_pool_id = sc.successor_candidate_pool_id
                                   AND s3.successor_candidate_user_id = a.user_position_assignment_user_id)
              LIMIT 1)
     WHERE sc.ctid = (SELECT s2.ctid FROM sys.sys_successor_candidates s2
                       WHERE s2.successor_candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c5g();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5g:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5g FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5g (successore senza rapporto con la posizione, rollback)';

  -- ST-C5g(ii): candidare a succedere chi quella posizione già la occupa
  v_fired := false;
  BEGIN
    UPDATE sys.sys_successor_candidates sc
       SET successor_candidate_user_id = (
             SELECT a.user_position_assignment_user_id
               FROM sys.sys_user_position_assignments a
               JOIN sys.sys_succession_pools sp2
                 ON sp2.succession_pool_position_id = a.user_position_assignment_position_id
              WHERE sp2.succession_pool_id = sc.successor_candidate_pool_id
                AND a.user_position_assignment_status = 'ACTIVE' LIMIT 1)
     WHERE sc.ctid = (SELECT s2.ctid FROM sys.sys_successor_candidates s2
                       JOIN sys.sys_succession_pools sp3 ON sp3.succession_pool_id = s2.successor_candidate_pool_id
                       JOIN sys.sys_user_position_assignments a3
                         ON a3.user_position_assignment_position_id = sp3.succession_pool_position_id
                        AND a3.user_position_assignment_status = 'ACTIVE'
                      WHERE s2.successor_candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c5g();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5g(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5g(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5g(ii) (candidato a succedere a se stesso, rollback)';

  -- ST-C5h: togliere la destinazione a un passo di carriera
  v_fired := false;
  BEGIN
    UPDATE sys.sys_career_path_steps SET career_path_step_target_position_id = NULL
     WHERE ctid = (SELECT s2.ctid FROM sys.sys_career_path_steps s2 LIMIT 1);
    PERFORM staging.storia36_check_c5h();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5h:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5h FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5h (passo che non porta da nessuna parte, rollback)';

  -- ST-C5h(ii): togliere l'origine a un passo intermedio
  v_fired := false;
  BEGIN
    UPDATE sys.sys_career_path_steps SET career_path_step_origin_position_id = NULL
     WHERE ctid = (SELECT s2.ctid FROM sys.sys_career_path_steps s2
                    WHERE s2.career_path_step_ordinal > 1 LIMIT 1);
    PERFORM staging.storia36_check_c5h();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5h(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5h(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5h(ii) (passo intermedio senza partenza, rollback)';

  -- ST-C5h(iii): spezzare la catena — ripartire da un'altra posizione
  v_fired := false;
  BEGIN
    UPDATE sys.sys_career_path_steps s
       SET career_path_step_origin_position_id = (
             SELECT p.position_id FROM sys.sys_positions p
              WHERE p.position_id <> s.career_path_step_origin_position_id
                AND p.position_id <> s.career_path_step_target_position_id LIMIT 1)
     WHERE s.ctid = (SELECT s2.ctid FROM sys.sys_career_path_steps s2
                      WHERE s2.career_path_step_ordinal > 1
                        AND s2.career_path_step_origin_position_id IS NOT NULL LIMIT 1);
    PERFORM staging.storia36_check_c5h();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5h(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5h(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5h(iii) (catena del percorso spezzata, rollback)';

  -- ST-C5h(iv): un passo che parte e arriva allo stesso posto
  v_fired := false;
  BEGIN
    UPDATE sys.sys_career_path_steps s
       SET career_path_step_origin_position_id = s.career_path_step_target_position_id
     WHERE s.ctid = (SELECT s2.ctid FROM sys.sys_career_path_steps s2
                      WHERE s2.career_path_step_ordinal = 1 LIMIT 1);
    PERFORM staging.storia36_check_c5h();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5h(iv)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5h(iv) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5h(iv) (passo che gira a vuoto, rollback)';

  -- ST-C5i: attribuire allo stesso datore un secondo settore
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_professional_experiences x
       SET user_prof_exp_industry = 'Tutt''altro settore'
     WHERE x.ctid = (SELECT x2.ctid FROM sys.sys_user_professional_experiences x2
                      WHERE x2.user_prof_exp_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                        AND x2.user_prof_exp_employer IN (
                          SELECT user_prof_exp_employer FROM sys.sys_user_professional_experiences
                           GROUP BY 1 HAVING count(*) > 1)
                      LIMIT 1);
    PERFORM staging.storia36_check_c5i();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5i:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5i FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5i (stesso datore in due settori, rollback)';

  -- ST-C5j: riportare tutte le date d'inizio al primo del mese — l'artefatto
  -- che il rilievo #13/#20 aveva trovato
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_professional_experiences
       SET user_prof_exp_start_date = date_trunc('month', user_prof_exp_start_date)::date
     WHERE user_prof_exp_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
    PERFORM staging.storia36_check_c5j();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5j:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5j FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5j (tutte le date al primo del mese, rollback)';

  -- ST-C5j(ii): ammassare tutte le date d'inizio in gennaio
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_professional_experiences
       SET user_prof_exp_start_date =
             make_date(extract(year FROM user_prof_exp_start_date)::int, 1,
                       LEAST(28, GREATEST(1, extract(day FROM user_prof_exp_start_date)::int)))
     WHERE user_prof_exp_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
    PERFORM staging.storia36_check_c5j();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5j(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5j(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5j(ii) (tutte le assunzioni a gennaio, rollback)';

  -- ST-C5k: cancellare la mobilità interna — la banca dove non ci si muove mai
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_user_position_assignments
     WHERE user_position_assignment_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND user_position_assignment_status = 'ENDED';
    PERFORM staging.storia36_check_c5k();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5k:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5k FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5k (nessun cambio di posizione in tre anni, rollback)';

  -- ST-C5k(ii): far durare l'incarico precedente oltre l'inizio di quello nuovo
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_position_assignments
       SET user_position_assignment_end_date = user_position_assignment_end_date + 400
     WHERE user_position_assignment_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND user_position_assignment_status = 'ENDED';
    PERFORM staging.storia36_check_c5k();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5k(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5k(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5k(ii) (due posizioni occupate insieme, rollback)';

  -- ST-C5k(iii): far cominciare un incarico prima dell'assunzione
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_position_assignments
       SET user_position_assignment_start_date = user_position_assignment_start_date - 4000
     WHERE ctid = (SELECT a2.ctid FROM sys.sys_user_position_assignments a2
                    WHERE a2.user_position_assignment_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                      AND a2.user_position_assignment_metadata->>'storia36' = 'C5' LIMIT 1);
    PERFORM staging.storia36_check_c5k();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5k(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5k(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5k(iii) (incarico iniziato prima dell''assunzione, rollback)';

  -- ST-C5l: rimettere a un bacino il nome di un'altra carica
  v_fired := false;
  BEGIN
    UPDATE sys.sys_succession_pools
       SET succession_pool_name = 'CEO / Amministratore Delegato'
     WHERE ctid = (SELECT sp2.ctid FROM sys.sys_succession_pools sp2
                    WHERE sp2.succession_pool_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c5l();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C5l:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C5l FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C5l (bacino con il nome di un''altra carica, rollback)';

  -- ==========================================================================
  -- C6 — LA RIORGANIZZAZIONE DEL MARZO 2025
  -- ==========================================================================

  -- ST-C6a: cancellare la storia organizzativa — l'organigramma che risulta
  -- esistere da sempre, che è lo stato da cui il cluster è partito
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_organization_unit_history
     WHERE organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
    PERFORM staging.storia36_check_c6a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6a:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6a FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6a (riorganizzazione senza traccia rilevata, rollback)';

  -- ST-C6a(ii): spostare un evento fuori dal giorno del riordino
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_unit_history
       SET organization_unit_history_effective_at = organization_unit_history_effective_at + interval '200 days'
     WHERE ctid = (SELECT h2.ctid FROM sys.sys_organization_unit_history h2
                    WHERE h2.organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c6a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6a(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6a(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6a(ii) (evento fuori da ogni riordino registrato, rollback)';

  -- ST-C6a(ii-bis): IL SECONDO RIORDINO E' AMMESSO (#163).
  -- Il gemello del test qui sopra, e serve esattamente quanto lui: quello prova che un
  -- evento non autorizzato viene visto, questo prova che un evento AUTORIZZATO non viene
  -- punito. Senza, «allargare il modello» sarebbe una dichiarazione: si potrebbe togliere
  -- il secondo riordino dal registro e la batteria resterebbe verde lo stesso.
  -- Si spostano TUTTI gli eventi del tenant sul secondo riordino registrato: cambia solo
  -- la data, quindi le altre sotto-verifiche di C6a (conteggio, autore, prima<>dopo) e i
  -- check sui nomi restano indifferenti, e l'unica cosa in gioco e' C6a(ii).
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_unit_history
       SET organization_unit_history_effective_at = (staging.storia36_riordini())[2]::timestamptz
     WHERE organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
    PERFORM staging.storia36_check_c6a();
  EXCEPTION WHEN OTHERS THEN
    v_fired := true;
    RAISE EXCEPTION 'SELFTEST C6a(ii-bis) FALLITO: un riordino REGISTRATO viene rifiutato (%)', SQLERRM;
  END;
  RAISE NOTICE '[OK] SELFTEST C6a(ii-bis) (il secondo riordino registrato e'' ammesso, rollback)';

  -- ST-C6a(iii): togliere l'autore a un evento organizzativo
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_unit_history
       SET organization_unit_history_actor_user_id = NULL
     WHERE ctid = (SELECT h2.ctid FROM sys.sys_organization_unit_history h2
                    WHERE h2.organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c6a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6a(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6a(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6a(iii) (evento organizzativo senza autore, rollback)';

  -- ST-C6a(iv): un «cambiamento» in cui il prima è identico al dopo
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_unit_history
       SET organization_unit_history_old_value = organization_unit_history_new_value
     WHERE ctid = (SELECT h2.ctid FROM sys.sys_organization_unit_history h2
                    WHERE h2.organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                      AND h2.organization_unit_history_old_value IS NOT NULL LIMIT 1);
    PERFORM staging.storia36_check_c6a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6a(iv)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6a(iv) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6a(iv) (cambiamento che non cambia nulla, rollback)';

  -- ST-C6b: assegnare qualcuno a una posizione di un altro tenant
  v_fired := false;
  BEGIN
    UPDATE sys.sys_user_position_assignments a
       SET user_position_assignment_position_id = (
             SELECT p.position_id FROM sys.sys_positions p
              WHERE p.position_tenant_id <> '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1)
     WHERE a.ctid = (SELECT a2.ctid FROM sys.sys_user_position_assignments a2
                      WHERE a2.user_position_assignment_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                        AND a2.user_position_assignment_status = 'ACTIVE' LIMIT 1);
    PERFORM staging.storia36_check_c6b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6b:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6b FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6b (assegnazione che scavalca il tenant, rollback)';

  -- ST-C6b(ii): chiudere l'albero su sé stesso — l'unità che riporta a sé
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_units o
       SET organization_unit_parent_id = o.organization_unit_id
     WHERE o.ctid = (SELECT o2.ctid FROM sys.sys_organization_units o2
                      WHERE o2.organization_unit_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                        AND o2.organization_unit_parent_id IS NOT NULL LIMIT 1);
    PERFORM staging.storia36_check_c6b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6b(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6b(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6b(ii) (ciclo nella gerarchia, rollback)';

  -- ST-C6b(iii): appendere un'unità a un genitore di un altro tenant
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_units o
       SET organization_unit_parent_id = (
             SELECT o3.organization_unit_id FROM sys.sys_organization_units o3
              WHERE o3.organization_unit_tenant_id <> '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1)
     WHERE o.ctid = (SELECT o2.ctid FROM sys.sys_organization_units o2
                      WHERE o2.organization_unit_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                        AND o2.organization_unit_parent_id IS NOT NULL LIMIT 1);
    PERFORM staging.storia36_check_c6b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6b(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6b(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6b(iii) (unità sotto un genitore di un altro tenant, rollback)';

  -- ST-C6c: far dichiarare alla storia un esito diverso dall'organigramma di oggi
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_unit_history
       SET organization_unit_history_new_value = jsonb_build_object('name', 'Divisione Che Non Esiste')
     -- #163: si colpisce l'evento PIU' RECENTE, non uno qualsiasi. Da quando C6c guarda
     -- l'ultimo esito e non ognuno, sporcare un evento vecchio non e' piu' una violazione
     -- — e' storia. Un selftest che iniettasse quello proverebbe che il check NON scatta.
     WHERE ctid = (SELECT h2.ctid FROM sys.sys_organization_unit_history h2
                    WHERE h2.organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                      AND h2.organization_unit_history_new_value ? 'name'
                    ORDER BY h2.organization_unit_history_effective_at DESC, h2.created_at DESC LIMIT 1);
    PERFORM staging.storia36_check_c6c();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6c:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6c FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6c (passato che non porta al presente, rollback)';

  -- ST-C6c(ii): far finire uno spostamento sotto un genitore che non è quello di oggi
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_unit_history
       SET organization_unit_history_new_value = jsonb_build_object('parent_name', 'Divisione Marketing')
     -- #163: come sopra, l'evento PIU' RECENTE — e' l'ultimo approdo che deve coincidere
     -- con il genitore di oggi, quindi e' l'unico che puo' costituire violazione.
     WHERE ctid = (SELECT h2.ctid FROM sys.sys_organization_unit_history h2
                    WHERE h2.organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                      AND h2.organization_unit_history_change_type = 'MOVED'
                    ORDER BY h2.organization_unit_history_effective_at DESC, h2.created_at DESC LIMIT 1);
    PERFORM staging.storia36_check_c6c();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6c(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6c(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6c(ii) (spostamento che non finisce dove l''unità sta oggi, rollback)';

  -- ST-C6c(iii): uno spostamento che parte e arriva sotto lo stesso genitore
  v_fired := false;
  BEGIN
    UPDATE sys.sys_organization_unit_history h
       SET organization_unit_history_old_value = h.organization_unit_history_new_value
     WHERE h.ctid = (SELECT h2.ctid FROM sys.sys_organization_unit_history h2
                      WHERE h2.organization_unit_history_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                        AND h2.organization_unit_history_change_type = 'MOVED' LIMIT 1);
    PERFORM staging.storia36_check_c6c();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6c(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6c(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6c(iii) (spostamento immobile, rollback)';

  -- ST-C6d: togliere il blueprint attivo
  v_fired := false;
  BEGIN
    UPDATE sys.sys_blueprint_activations SET blueprint_activation_status = 'RETIRED'
     WHERE blueprint_activation_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
    PERFORM staging.storia36_check_c6d();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6d:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6d FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6d (nessun modello organizzativo adottato, rollback)';

  -- ST-C6d(ii): adottare il modello in blocco, senza una sola deroga
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_blueprint_overrides o
     USING sys.sys_blueprint_activations a
     WHERE a.blueprint_activation_id = o.blueprint_override_activation_id
       AND a.blueprint_activation_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
    PERFORM staging.storia36_check_c6d();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6d(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6d(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6d(ii) (modello adottato in blocco, rollback)';

  -- ST-C6d(iii): una deroga senza motivazione
  v_fired := false;
  BEGIN
    UPDATE sys.sys_blueprint_overrides SET blueprint_override_rationale = ' '
     WHERE ctid = (SELECT o2.ctid FROM sys.sys_blueprint_overrides o2 LIMIT 1);
    PERFORM staging.storia36_check_c6d();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C6d(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C6d(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C6d(iii) (deroga senza motivo, rollback)';

  -- ==========================================================================
  -- C7 — APPROVAZIONI E WORKFLOW
  -- ==========================================================================

  -- ST-C7a: chiudere una richiesta lasciando un approvatore in attesa
  v_fired := false;
  BEGIN
    UPDATE sys.sys_approval_requests SET approval_request_status = 'APPROVED'
     WHERE approval_request_id = (
       SELECT s.approval_step_request_id FROM sys.sys_approval_steps s
        WHERE s.approval_step_status = 'PENDING'
          AND s.approval_step_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c7a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7a:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7a FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7a (richiesta chiusa con un approvatore ancora in attesa, rollback)';

  -- ST-C7a(ii): respingere una richiesta senza che nessuno l'abbia respinta
  v_fired := false;
  BEGIN
    UPDATE sys.sys_approval_requests SET approval_request_status = 'REJECTED'
     WHERE ctid = (SELECT r2.ctid FROM sys.sys_approval_requests r2
                    WHERE r2.approval_request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                      AND r2.approval_request_status IN ('APPROVED', 'APPLIED') LIMIT 1);
    PERFORM staging.storia36_check_c7a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7a(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7a(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7a(ii) (richiesta respinta che nessuno ha respinto, rollback)';

  -- ST-C7a(iii): una decisione senza chi l'ha presa — ne' vivo NE' tombstone
  -- (#168: azzerare solo decided_by non basta piu', lo snapshot risponderebbe lui)
  v_fired := false;
  BEGIN
    UPDATE sys.sys_approval_steps
       SET approval_step_decided_by = NULL, approval_step_decided_by_snapshot = NULL
     WHERE ctid = (SELECT s2.ctid FROM sys.sys_approval_steps s2
                    WHERE s2.approval_step_status = 'APPROVED'
                      AND s2.approval_step_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c7a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7a(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7a(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7a(iii) (decisione senza autore, rollback)';

  -- ST-CASCADE (#168): cancellare un utente NON fa sparire la storia delle sue
  -- approvazioni. Utente sintetico + richiesta + passo APPROVED, DELETE
  -- dell'utente, e il passo deve restare: approver NULL, tombstone presente,
  -- e C7a NON deve accendersi (il decisore rimosso non e' una decisione senza
  -- autore). Tutto rollbacka via eccezione: il DB resta com'era.
  v_fired := false;
  BEGIN
    DECLARE
      st_uid  uuid;
      st_req  uuid;
      st_cnt  int;
      st_snap text;
    BEGIN
      INSERT INTO sys.sys_users (user_tenant_id, user_email, user_display_name)
      VALUES ('86ba7a65-217f-48ba-8ce5-5c09b40a66b0',
              'st-cascade-000303@selftest.local', 'ST Cascade 000303')
      RETURNING user_id INTO st_uid;
      INSERT INTO sys.sys_approval_requests
        (approval_request_tenant_id, approval_request_title, approval_request_status)
      VALUES ('86ba7a65-217f-48ba-8ce5-5c09b40a66b0',
              'ST-CASCADE 000303 — richiesta sintetica', 'APPROVED')
      RETURNING approval_request_id INTO st_req;
      INSERT INTO sys.sys_approval_steps
        (approval_step_request_id, approval_step_tenant_id, approval_step_approver_user_id,
         approval_step_status, approval_step_decided_at, approval_step_decided_by,
         approval_step_approver_snapshot, approval_step_decided_by_snapshot)
      VALUES (st_req, '86ba7a65-217f-48ba-8ce5-5c09b40a66b0', st_uid,
              'APPROVED', now(), st_uid,
              'st-cascade-000303@selftest.local', 'st-cascade-000303@selftest.local');

      DELETE FROM sys.sys_users WHERE user_id = st_uid;

      SELECT count(*), min(approval_step_approver_snapshot) INTO st_cnt, st_snap
        FROM sys.sys_approval_steps
       WHERE approval_step_request_id = st_req
         AND approval_step_approver_user_id IS NULL
         AND approval_step_decided_by IS NULL;
      IF st_cnt <> 1 OR st_snap IS DISTINCT FROM 'st-cascade-000303@selftest.local' THEN
        RAISE EXCEPTION 'ST_BROKEN: dopo la DELETE il passo e'' % (snapshot %)', st_cnt, st_snap;
      END IF;
      PERFORM staging.storia36_check_c7a();  -- il tombstone basta: niente C7a(iii)
      RAISE EXCEPTION 'ST_OK';
    END;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'ST_OK' THEN v_fired := true;
    ELSIF SQLERRM LIKE 'ST_BROKEN%' OR SQLERRM LIKE '%C7a%' THEN
      RAISE EXCEPTION 'SELFTEST CASCADE FALLITO: %', SQLERRM;
    ELSE RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST CASCADE FALLITO: il percorso non e'' arrivato in fondo'; END IF;
  RAISE NOTICE '[OK] SELFTEST CASCADE #168 (utente cancellato, storia intatta col tombstone, rollback)';

  -- ST-C7a(iv): lasciare aperta una richiesta che nessuno deve più decidere
  v_fired := false;
  BEGIN
    UPDATE sys.sys_approval_requests SET approval_request_status = 'PENDING'
     WHERE ctid = (SELECT r2.ctid FROM sys.sys_approval_requests r2
                    WHERE r2.approval_request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                      AND r2.approval_request_status = 'APPLIED' LIMIT 1);
    PERFORM staging.storia36_check_c7a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7a(iv)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7a(iv) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7a(iv) (richiesta aperta senza nulla da decidere, rollback)';

  -- ST-C7a(v): un'approvazione senza approvatori
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_approval_steps
     WHERE approval_step_request_id = (
       SELECT r2.approval_request_id FROM sys.sys_approval_requests r2
        WHERE r2.approval_request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c7a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7a(v)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7a(v) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7a(v) (approvazione senza approvatori, rollback)';

  -- ST-C7a(vi): togliere il primo livello e lasciare solo il secondo — il buco
  -- nella catena che spariva in silenzio
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_approval_steps s
     WHERE s.approval_step_ordinal = 1
       AND s.approval_step_request_id = (
         SELECT s2.approval_step_request_id FROM sys.sys_approval_steps s2
          WHERE s2.approval_step_ordinal = 2
            AND s2.approval_step_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' LIMIT 1);
    PERFORM staging.storia36_check_c7a();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7a(vi)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7a(vi) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7a(vi) (livelli con un buco nella catena, rollback)';

  -- ST-C7b: far puntare un'approvazione a una risorsa che non esiste
  v_fired := false;
  BEGIN
    UPDATE sys.sys_approval_requests
       SET approval_request_resource_id = '00000000-0000-0000-0000-0000000000fe'
     WHERE ctid = (SELECT r2.ctid FROM sys.sys_approval_requests r2
                    WHERE r2.approval_request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                      AND r2.approval_request_resource_type = 'TIME_OFF_REQUEST' LIMIT 1);
    PERFORM staging.storia36_check_c7b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7b:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7b FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7b (approvazione su una risorsa inesistente, rollback)';

  -- ST-C7b(ii): far firmare l'assenza a qualcuno che non l'ha approvata
  v_fired := false;
  BEGIN
    UPDATE sys.sys_approval_steps s
       SET approval_step_approver_user_id = (
             SELECT u.user_id FROM sys.sys_users u
              WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
                AND u.user_id <> s.approval_step_approver_user_id LIMIT 1)
     WHERE s.ctid = (SELECT s2.ctid FROM sys.sys_approval_steps s2
                      JOIN sys.sys_approval_requests r2 ON r2.approval_request_id = s2.approval_step_request_id
                     WHERE r2.approval_request_resource_type = 'TIME_OFF_REQUEST' LIMIT 1);
    PERFORM staging.storia36_check_c7b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7b(ii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7b(ii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7b(ii) (assenza firmata da chi non l''ha approvata, rollback)';

  -- ST-C7b(iii): un'assenza approvata la cui richiesta risulta respinta
  v_fired := false;
  BEGIN
    UPDATE sys.sys_approval_requests
       SET approval_request_status = 'REJECTED'
     WHERE ctid = (SELECT r2.ctid FROM sys.sys_approval_requests r2
                    JOIN sys.sys_time_off_requests t2 ON t2.request_id = r2.approval_request_resource_id
                   WHERE r2.approval_request_resource_type = 'TIME_OFF_REQUEST'
                     AND t2.request_status = 'APPROVED' LIMIT 1);
    PERFORM staging.storia36_check_c7b();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7b(iii)%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7b(iii) FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7b(iii) (esito che contraddice l''assenza, rollback)';

  -- ST-C7c: svuotare le richieste di ferie — il workflow che non ha mai deciso
  v_fired := false;
  BEGIN
    DELETE FROM sys.sys_approval_requests
     WHERE approval_request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
       AND approval_request_resource_type = 'TIME_OFF_REQUEST';
    PERFORM staging.storia36_check_c7c(current_setting('storia36.window_start')::date, v_end);
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7c:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7c FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7c (nessuna richiesta di ferie in tre anni, rollback)';

  -- ST-C7d: il programma che si mette a decidere il RACI — il gate di Enzo
  v_fired := false;
  BEGIN
    UPDATE sys.sys_process_participants
       SET process_participant_metadata =
             COALESCE(process_participant_metadata, '{}'::jsonb) || jsonb_build_object('storia36', 'C7')
     WHERE ctid = (SELECT p2.ctid FROM sys.sys_process_participants p2 LIMIT 1);
    PERFORM staging.storia36_check_c7d();
    RAISE EXCEPTION 'ST_NOT_FIRED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%C7d:%' THEN v_fired := true;
    ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
    END IF;
  END;
  IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C7d FALLITO: violazione iniettata non rilevata'; END IF;
  RAISE NOTICE '[OK] SELFTEST C7d (il programma che scrive nel RACI, rollback)';

  -- ==========================================================================
  -- C8 — ENGAGEMENT E CLIMA
  -- ==========================================================================
  DECLARE c_rtl8 constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  BEGIN
    -- ST-C8a: chiudere una rilevazione togliendole le domande — il «guscio»
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_survey_questions q
       USING sys.sys_surveys s
       WHERE q.survey_question_survey_id = s.survey_id
         AND s.survey_tenant_id = c_rtl8 AND s.survey_status = 'closed';
      PERFORM staging.storia36_check_c8a(v_end);
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C8a:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C8a FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C8a (rilevazione chiusa senza domande, rollback)';

    -- ST-C8a(ii): lasciare aperta una rilevazione scaduta da un anno
    v_fired := false;
    BEGIN
      UPDATE sys.sys_surveys SET survey_status = 'active'
       WHERE ctid = (SELECT s2.ctid FROM sys.sys_surveys s2
                      WHERE s2.survey_tenant_id = c_rtl8 AND s2.survey_status = 'closed'
                        AND s2.survey_end_date IS NOT NULL LIMIT 1);
      PERFORM staging.storia36_check_c8a(v_end);
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C8a(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C8a(ii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C8a(ii) (rilevazione aperta oltre la scadenza, rollback)';

    -- ST-C8a(iii): più rispondenti che invitati
    v_fired := false;
    BEGIN
      UPDATE sys.sys_surveys SET survey_total_invitations = 1
       WHERE ctid = (SELECT s2.ctid FROM sys.sys_surveys s2
                      WHERE s2.survey_tenant_id = c_rtl8
                        AND s2.survey_metadata->>'storia36' = 'C8' LIMIT 1);
      PERFORM staging.storia36_check_c8a(v_end);
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C8a(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C8a(iii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C8a(iii) (più rispondenti che invitati, rollback)';

    -- ST-C8a(iv): un tasso di risposta da plebiscito
    v_fired := false;
    BEGIN
      UPDATE sys.sys_surveys s SET survey_total_invitations = (
        SELECT count(DISTINCT r.survey_response_subject_user_id)
          FROM sys.sys_survey_responses r WHERE r.survey_response_survey_id = s.survey_id)
       WHERE s.survey_tenant_id = c_rtl8 AND s.survey_metadata->>'storia36' = 'C8';
      PERFORM staging.storia36_check_c8a(v_end);
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C8a(iv)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C8a(iv) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C8a(iv) (hanno risposto tutti, rollback)';

    -- ST-C8b: appiattire il clima — la riorganizzazione che non si vede
    v_fired := false;
    BEGIN
      UPDATE sys.sys_survey_responses r SET survey_response_rating_value = 8
       FROM sys.sys_surveys s
       WHERE s.survey_id = r.survey_response_survey_id
         AND s.survey_tenant_id = c_rtl8
         AND s.survey_start_date::date BETWEEN DATE '2025-03-01' AND DATE '2025-06-30';
      PERFORM staging.storia36_check_c8b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C8b(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C8b FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C8b (clima piatto attraverso la riorganizzazione, rollback)';

    -- ST-C8b(iii): nessun recupero dopo la flessione
    v_fired := false;
    BEGIN
      UPDATE sys.sys_survey_responses r SET survey_response_rating_value = 6
       FROM sys.sys_surveys s
       WHERE s.survey_id = r.survey_response_survey_id
         AND s.survey_tenant_id = c_rtl8
         AND s.survey_start_date::date >= DATE '2026-01-01';
      PERFORM staging.storia36_check_c8b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C8b(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C8b(iii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C8b(iii) (flessione senza recupero, rollback)';

    -- ST-C8c: togliere i piani d'azione al ciclo andato male
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_engagement_action_plans WHERE action_plan_tenant_id = c_rtl8;
      PERFORM staging.storia36_check_c8c();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C8c:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C8c FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C8c (clima sotto soglia e nessuna azione, rollback)';

    -- ST-C8c(ii): un piano senza responsabile
    v_fired := false;
    BEGIN
      UPDATE sys.sys_engagement_action_plans SET action_plan_owner_user_id = NULL
       WHERE ctid = (SELECT p2.ctid FROM sys.sys_engagement_action_plans p2 LIMIT 1);
      PERFORM staging.storia36_check_c8c();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C8c(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C8c(ii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C8c(ii) (piano d''azione senza responsabile, rollback)';

    -- ==========================================================================
    -- C9 — CONTENUTI
    -- ==========================================================================

    -- ST-C9a: spubblicare tutto — il manuale del dipendente che non mostra niente
    v_fired := false;
    BEGIN
      UPDATE sys.sys_content_documents SET document_status = 'archived'
       WHERE document_tenant_id = c_rtl8 AND document_status = 'published';
      PERFORM staging.storia36_check_c9a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C9a:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C9a FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C9a (manuale del dipendente vuoto, rollback)';

    -- ST-C9a(iii): far tornare indietro la data di una revisione
    v_fired := false;
    BEGIN
      -- si porta la PRIMA revisione DOPO l'ultima: così il disordine è certo,
      -- mentre spostare indietro l'ultima di qualche mese non bastava a
      -- scavalcare la precedente e faceva scattare un altro ramo
      UPDATE sys.sys_content_versions v
         SET created_at = (SELECT max(v3.created_at) + interval '10 days'
                             FROM sys.sys_content_versions v3
                            WHERE v3.version_document_id = v.version_document_id)
       WHERE v.ctid = (SELECT v2.ctid FROM sys.sys_content_versions v2
                        JOIN sys.sys_content_documents d2 ON d2.document_id = v2.version_document_id
                       WHERE d2.document_status = 'published' AND v2.version_number = 1
                         AND (SELECT count(*) FROM sys.sys_content_versions v4
                               WHERE v4.version_document_id = v2.version_document_id) > 1
                       LIMIT 1);
      PERFORM staging.storia36_check_c9a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C9a(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C9a(iii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C9a(iii) (revisione con la data che torna indietro, rollback)';

    -- ST-C9a(iv): una revisione che non dice che cosa è cambiato
    v_fired := false;
    BEGIN
      UPDATE sys.sys_content_versions v SET version_change_note = NULL
       WHERE v.ctid = (SELECT v2.ctid FROM sys.sys_content_versions v2
                        JOIN sys.sys_content_documents d2 ON d2.document_id = v2.version_document_id
                       WHERE d2.document_status = 'published' LIMIT 1);
      PERFORM staging.storia36_check_c9a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C9a(iv)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C9a(iv) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C9a(iv) (revisione muta, rollback)';

    -- ST-C9a(v): lasciare il documento fermo a una revisione vecchia
    v_fired := false;
    BEGIN
      UPDATE sys.sys_content_documents SET document_current_version_id = NULL
       WHERE ctid = (SELECT d2.ctid FROM sys.sys_content_documents d2
                      WHERE d2.document_tenant_id = c_rtl8 AND d2.document_status = 'published' LIMIT 1);
      PERFORM staging.storia36_check_c9a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C9a(v)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C9a(v) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C9a(v) (documento fermo a una revisione superata, rollback)';

    -- ST-C9b: togliere la categoria a un documento pubblicato
    v_fired := false;
    BEGIN
      UPDATE sys.sys_content_documents SET document_category_id = NULL
       WHERE ctid = (SELECT d2.ctid FROM sys.sys_content_documents d2
                      WHERE d2.document_tenant_id = c_rtl8 AND d2.document_status = 'published' LIMIT 1);
      PERFORM staging.storia36_check_c9b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C9b(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C9b FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C9b (documento pubblicato senza categoria, rollback)';

    -- ST-C9b(iii): una categoria che non contiene niente
    v_fired := false;
    BEGIN
      UPDATE sys.sys_content_documents SET document_category_id = (
        SELECT c2.category_id FROM sys.sys_content_categories c2
         WHERE c2.category_tenant_id = c_rtl8 LIMIT 1)
       WHERE document_tenant_id = c_rtl8 AND document_status = 'published';
      PERFORM staging.storia36_check_c9b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C9b(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C9b(iii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C9b(iii) (categorie rimaste vuote, rollback)';

    -- ==========================================================================
    -- C10 — CONSENSI, GDPR, SEGNALAZIONI, ACCESSI
    -- ==========================================================================

    -- ST-C10a: togliere a qualcuno la scelta su un trattamento
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_user_consents
       WHERE consent_user_id = (SELECT c2.consent_user_id FROM sys.sys_user_consents c2 LIMIT 1);
      PERFORM staging.storia36_check_c10a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C10a:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C10a FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C10a (persona senza scelta sui trattamenti, rollback)';

    -- ST-C10a(ii): una scelta espressa prima di essere stati assunti
    v_fired := false;
    BEGIN
      UPDATE sys.sys_user_consents SET consent_occurred_at = consent_occurred_at - interval '4000 days'
       WHERE ctid = (SELECT c2.ctid FROM sys.sys_user_consents c2 LIMIT 1);
      PERFORM staging.storia36_check_c10a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C10a(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C10a(ii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C10a(ii) (scelta espressa prima dell''assunzione, rollback)';

    -- ST-C10a(iii): revocare un consenso che non era mai stato dato
    v_fired := false;
    BEGIN
      UPDATE sys.sys_user_consents SET consent_source = 'ESS', consent_action = 'REVOKE'
       WHERE ctid = (SELECT c2.ctid FROM sys.sys_user_consents c2
                      WHERE c2.consent_source = 'IMPORT' AND c2.consent_action = 'REVOKE' LIMIT 1);
      PERFORM staging.storia36_check_c10a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C10a(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C10a(iii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C10a(iii) (revoca di un consenso mai dato, rollback)';

    -- ST-C10b: chiudere una richiesta oltre i trenta giorni di legge
    v_fired := false;
    BEGIN
      UPDATE sys.sys_gdpr_requests
         SET gdpr_request_report = gdpr_request_report || jsonb_build_object('giorni_impiegati', 47)
       WHERE ctid = (SELECT g2.ctid FROM sys.sys_gdpr_requests g2
                      WHERE g2.gdpr_request_report->>'storia36' = 'C10' LIMIT 1);
      PERFORM staging.storia36_check_c10b(v_end);
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C10b(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C10b FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C10b (richiesta chiusa fuori termine, rollback)';

    -- ST-C10c: affidare una segnalazione a chi non è il custode
    v_fired := false;
    BEGIN
      UPDATE sys.sys_whistleblowing_reports
         SET whistleblowing_report_assignee_user_id = (
               SELECT u.user_id FROM sys.sys_users u
                WHERE u.user_email = 'federica.marchetti@rtl-bank.org')
       WHERE whistleblowing_report_tenant_id = c_rtl8;
      PERFORM staging.storia36_check_c10c();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C10c:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C10c FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C10c (segnalazione affidata a chi non è il custode, rollback)';

    -- ST-C10c(ii): chiudere una segnalazione senza rispondere a chi l'ha fatta
    v_fired := false;
    BEGIN
      UPDATE sys.sys_whistleblowing_reports SET whistleblowing_report_public_message = NULL
       WHERE whistleblowing_report_tenant_id = c_rtl8;
      PERFORM staging.storia36_check_c10c();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C10c(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C10c(ii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C10c(ii) (segnalazione chiusa senza riscontro, rollback)';

    -- ST-C10d: un accesso registrato prima dell'assunzione
    v_fired := false;
    BEGIN
      UPDATE sys.sys_auth_login_events SET created_at = created_at - interval '4000 days'
       WHERE ctid = (SELECT le2.ctid FROM sys.sys_auth_login_events le2
                      WHERE le2.auth_login_event_details->>'storia36' = 'C10' LIMIT 1);
      PERFORM staging.storia36_check_c10d();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C10d:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C10d FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C10d (accesso precedente all''assunzione, rollback)';

    -- ST-C10d(ii): riportare il sistema a essere usato da una dozzina di persone
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_auth_login_events
       WHERE auth_login_event_details->>'storia36' = 'C10';
      PERFORM staging.storia36_check_c10d();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C10d(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C10d(ii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C10d(ii) (sistema usato da una dozzina di persone, rollback)';

    -- ==========================================================================
    -- C11 — CONFIGURAZIONE DELLA PIATTAFORMA
    -- ==========================================================================

    -- ST-C11a: togliere la disposizione all'organigramma
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_visualization_layouts l
       USING sys.sys_visualization_graphs g
       WHERE g.graph_id = l.layout_graph_id AND g.graph_tenant_id = c_rtl8;
      PERFORM staging.storia36_check_c11a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C11a:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C11a FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C11a (grafo attivo senza disposizione, rollback)';

    -- ST-C11a(ii): togliere la posizione a un nodo
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_visualization_node_layouts
       WHERE ctid = (SELECT nl.ctid FROM sys.sys_visualization_node_layouts nl LIMIT 1);
      PERFORM staging.storia36_check_c11a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C11a(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C11a(ii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C11a(ii) (nodo senza posizione nella disposizione, rollback)';

    -- ST-C11a(iii): togliere il tipo ai nodi — nessuno stile può applicarsi
    v_fired := false;
    BEGIN
      UPDATE sys.sys_visualization_nodes n SET node_type = NULL
       FROM sys.sys_visualization_graphs g
       WHERE g.graph_id = n.node_graph_id AND g.graph_tenant_id = c_rtl8;
      PERFORM staging.storia36_check_c11a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C11a(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C11a(iii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C11a(iii) (nodi senza tipo, rollback)';

    -- ST-C11a(iv): togliere gli stili
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_visualization_styles s
       USING sys.sys_visualization_graphs g
       WHERE g.graph_id = s.style_graph_id AND g.graph_tenant_id = c_rtl8;
      PERFORM staging.storia36_check_c11a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C11a(iv)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C11a(iv) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C11a(iv) (tipi di nodo senza stile, rollback)';

    -- ST-C11b: svuotare la pipeline che documenta il programma
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_seed_acquisition_runs
       WHERE seed_acquisition_run_tenant_id = c_rtl8;
      PERFORM staging.storia36_check_c11b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C11b:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C11b FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C11b (pipeline che non documenta il programma, rollback)';

    -- ST-C11b(iii): togliere l'istruttoria a un record candidato
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_seed_validation_results;
      PERFORM staging.storia36_check_c11b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C11b(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C11b(iii) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C11b(iii) (record candidato senza istruttoria, rollback)';

    -- ST-C11b(iv): applicare un record senza averlo approvato
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_seed_approval_decisions;
      PERFORM staging.storia36_check_c11b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C11b(iv)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C11b(iv) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C11b(iv) (record applicato senza approvazione, rollback)';

    -- ST-C11b(v): togliere la fonte da cui i dati vengono
    v_fired := false;
    BEGIN
      DELETE FROM sys.sys_seed_source_evidence;
      PERFORM staging.storia36_check_c11b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C11b(v)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C11b(v) FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C11b(v) (record senza la fonte da cui viene, rollback)';

    -- ST-C12a: riportare tutte le misure KPI allo stesso giorno di registrazione
    -- (e' esattamente lo stato che l'audit ha trovato: la data del popolamento)
    v_fired := false;
    BEGIN
      UPDATE sys.sys_kpi_measurements SET kpi_measurement_recorded_at = '2026-06-03 10:00:00+02';
      PERFORM staging.storia36_check_c12a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C12a:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C12a FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C12a (registrazioni tutte nello stesso giorno, rollback)';

    -- ST-C12a(iii): una colonna di registrazione nuova, non sorvegliata e non esentata
    v_fired := false;
    BEGIN
      EXECUTE 'CREATE TABLE sys.sys_st_c12a_fake (id int, fake_recorded_at timestamptz)';
      EXECUTE 'INSERT INTO sys.sys_st_c12a_fake SELECT g, now() FROM generate_series(1,40) g';
      EXECUTE 'ANALYZE sys.sys_st_c12a_fake';
      PERFORM staging.storia36_check_c12a();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C12a(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C12a(iii) FALLITO: una tabella nuova con date di registrazione e'' passata inosservata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C12a(iii) (colonna di registrazione fuori perimetro, rollback)';

    -- ST-C12b: rimettere in attesa una coda vecchia
    v_fired := false;
    BEGIN
      UPDATE sys.sys_overtime SET overtime_status = 'PENDING',
             overtime_approved_by_user_id = NULL, overtime_approved_at = NULL;
      PERFORM staging.storia36_check_c12b();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C12b:%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C12b FALLITO: violazione iniettata non rilevata'; END IF;
    RAISE NOTICE '[OK] SELFTEST C12b (coda di approvazione ferma da mesi, rollback)';

    -- ST-C12c(i): togliere un giorno al calendario deve farlo vedere come buco
    v_fired := false;
    BEGIN
      DELETE FROM staging.storia36_calendar WHERE cal_date = DATE '2025-06-11';
      PERFORM staging.storia36_check_c12c();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C12c(i)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C12c(i) FALLITO: un giorno mancante nel calendario è passato inosservato'; END IF;
    RAISE NOTICE '[OK] SELFTEST C12c(i) (buco nel calendario, rollback)';

    -- ST-C12c(ii): spostare il Lunedì dell'Angelo è esattamente l'errore che il
    -- calcolo della Pasqua può fare — deve emergere dal confronto con la lista
    v_fired := false;
    BEGIN
      UPDATE staging.storia36_calendar
         SET holiday_name = NULL, is_workday = true
       WHERE cal_date = DATE '2025-04-21';
      PERFORM staging.storia36_check_c12c();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C12c(ii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C12c(ii) FALLITO: festività calcolata e scritta divergenti non rilevate'; END IF;
    RAISE NOTICE '[OK] SELFTEST C12c(ii) (Lunedì dell''Angelo cancellato, rollback)';

    -- ST-C12c(iii): un Natale marcato lavorativo
    v_fired := false;
    BEGIN
      UPDATE staging.storia36_calendar SET is_workday = true WHERE cal_date = DATE '2025-12-25';
      PERFORM staging.storia36_check_c12c();
      RAISE EXCEPTION 'ST_NOT_FIRED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%C12c(iii)%' THEN v_fired := true;
      ELSIF SQLERRM <> 'ST_NOT_FIRED' THEN RAISE;
      END IF;
    END;
    IF NOT v_fired THEN RAISE EXCEPTION 'SELFTEST C12c(iii) FALLITO: un festivo marcato lavorativo è passato'; END IF;
    RAISE NOTICE '[OK] SELFTEST C12c(iii) (Natale marcato lavorativo, rollback)';

  END;
END $$;
\endif

-- ============================================================================
-- RUNNER — esegue TUTTI i check, stampa l'esito di ognuno, fallisce alla fine
-- se almeno uno è rosso.  Saltato con -v solo_definizioni=1 (#189): in quel modo
-- questo file serve solo a mettere in piedi le funzioni che i seed invocano.
-- ============================================================================
\if :solo_definizioni
\echo 'storia36 verify: solo definizioni — funzioni create, runner saltato'
\else
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

  BEGIN
    PERFORM staging.storia36_check_c5a();
    RAISE NOTICE '[OK] C5a carriera precedente: età, studi, continuità, fine entro l''ingresso';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5b();
    RAISE NOTICE '[OK] C5b successione: ogni posizione critica ha successori valutati';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5c();
    RAISE NOTICE '[OK] C5c obiettivi di carriera raggiungibili da un percorso reale';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5d(v_start, v_end);
    RAISE NOTICE '[OK] C5d evoluzione dei requisiti di posizione tracciata e attribuita';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5d'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5e();
    RAISE NOTICE '[OK] C5e ogni titolo di studio ha una durata';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5e'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5f();
    RAISE NOTICE '[OK] C5f criticità: registro, anagrafica e successione dicono la stessa cosa';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5f'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5g();
    RAISE NOTICE '[OK] C5g successori scelti con un criterio (riporto diretto o stesso mestiere)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5g'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5h();
    RAISE NOTICE '[OK] C5h i percorsi di carriera dicono da quale posizione a quale';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5h'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5i();
    RAISE NOTICE '[OK] C5i datore e settore delle esperienze precedenti concordano';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5i'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5j();
    RAISE NOTICE '[OK] C5j nessun artefatto di calendario nelle date di inizio';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5j'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5k();
    RAISE NOTICE '[OK] C5k mobilità interna rappresentata e senza incarichi sovrapposti';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5k'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c5l();
    RAISE NOTICE '[OK] C5l il nome del bacino è quello della posizione servita';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C5l'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c6a();
    RAISE NOTICE '[OK] C6a la riorganizzazione ha lasciato traccia, datata e attribuita';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C6a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c6b();
    RAISE NOTICE '[OK] C6b nessuna posizione o persona appesa al nulla attraverso il riordino';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C6b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c6c();
    RAISE NOTICE '[OK] C6c il racconto del passato arriva esattamente all''organigramma di oggi';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C6c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c6d();
    RAISE NOTICE '[OK] C6d il blueprint adottato porta deroghe motivate';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C6d'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c7a();
    RAISE NOTICE '[OK] C7a le approvazioni rispettano la macchina a stati del motore';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C7a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c7b();
    RAISE NOTICE '[OK] C7b ogni approvazione punta a una risorsa vera e non la contraddice';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C7b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c7c(v_start, v_end);
    RAISE NOTICE '[OK] C7c volumi credibili, preferenze per tutti, cascata KPI giustificata';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C7c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c7d();
    RAISE NOTICE '[OK] C7d il programma non ha scritto una riga di RACI (gate)';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C7d'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c8a(v_end);
    RAISE NOTICE '[OK] C8a si ascolta con regolarità e non rispondono tutti';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C8a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c8b();
    RAISE NOTICE '[OK] C8b il clima registra la riorganizzazione e il recupero';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C8b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c11a();
    RAISE NOTICE '[OK] C11a il grafo attivo ha una disposizione e ogni nodo un tipo';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C11a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c11b();
    RAISE NOTICE '[OK] C11b la pipeline di acquisizione documenta le corse del programma';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C11b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c10a();
    RAISE NOTICE '[OK] C10a ognuno ha espresso una scelta su ogni trattamento facoltativo';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C10a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c10b(v_end);
    RAISE NOTICE '[OK] C10b le richieste dell''interessato si chiudono nei termini di legge';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C10b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c10c();
    RAISE NOTICE '[OK] C10c le segnalazioni le tiene il custode e hanno un riscontro';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C10c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c10d();
    RAISE NOTICE '[OK] C10d gli accessi dicono chi usa il sistema e da quando';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C10d'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c9a();
    RAISE NOTICE '[OK] C9a i documenti pubblicati hanno una storia di revisioni che va avanti';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C9a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c9b();
    RAISE NOTICE '[OK] C9b ogni documento pubblicato sta in una categoria che esiste';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C9b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c8c();
    RAISE NOTICE '[OK] C8c a un clima sotto soglia seguono piani d''azione';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C8c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c12a();
    RAISE NOTICE '[OK] C12a la data di registrazione segue il fatto e non e'' la stessa per tutti';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C12a'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c12b();
    RAISE NOTICE '[OK] C12b nessuna coda di approvazione resta ferma per sempre';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C12b'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  BEGIN
    PERFORM staging.storia36_check_c12c();
    RAISE NOTICE '[OK] C12c il calendario e'' denso, coerente, e le festivita'' calcolate coincidono con quelle scritte';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_failed := array_append(v_failed, 'C12c'); RAISE WARNING '[ROSSO] %', v_msg;
  END;

  IF array_length(v_failed, 1) > 0 THEN
    RAISE EXCEPTION 'storia36 verify: % check ROSSI: %',
      array_length(v_failed, 1), array_to_string(v_failed, ', ');
  END IF;
  RAISE NOTICE 'storia36 verify: batteria globale tutta VERDE';
END $$;
\endif
