-- ============================================================================
-- storia36 C3 — compensation: motore variabile USATO su 3 esercizi + buste
-- storiche con adeguamenti CCNL + 36 mensilità di payroll handoff.
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C3)
-- Dominio (OGNI parametro citato): docs/kb/storia36/DOMINIO_PREMIO_VARIABILE.md
-- Misura: .storia36/analysis/c3-misura.md
--
-- Fatti che governano il design:
--  · curve payout: MBO_STANDARD CAPPED {threshold 0.8, floor 0.5, target 1.0,
--    cap 1.5} = convenzione RTL dichiarata (DOMINIO §4, "da ancorare o
--    dichiarare convenzione") + VAP_LINEAR + EXEC_SIGMOID
--  · gates: i 7 del catalogo blueprint × utente × esercizio; chi percepisce
--    variabile ha TUTTI i gates non bloccanti (DOMINIO §1 gate); esiti
--    ~96% PASSED / 2,5% WARNING / 1% BLOCKED / 0,5% OVERRIDDEN; evaluator =
--    andrea.martino (compliance, custode); recorded gen-feb FY+1 workday
--  · variable pay: platea = i 121 percettori legacy FY2024 (persistenza) −5%
--    per anno; amount = RAL × target%(livello: Dir 15%, QD 12%, 3A4L 8%,
--    3A3L 7%, altri 5%) × payout(curva, attainment dal rating C2 ancorato);
--    cap 30% RAL (DOMINIO §2); attainment < threshold → nessun payout
--  · buste: gross = RAL_staged(mese)/13 col modello a tranches del rinnovo
--    CCNL 23/11/2023 (+250 dal 2023-12, +100 dal 2024-09, +50 dal 2025-06,
--    +35 dal 2026-03, figura media 3A4L scalata per parametro; Dirigente
--    fuori — CCNL separato); DICEMBRE ×2 (tredicesima, 13 mensilità CCNL);
--    GIUGNO N+1 include il variabile dell'esercizio N (FY2023→2024-06,
--    FY2024 legacy→2025-06; FY2025→2026-06 è busta legacy flat: DEVIAZIONE
--    DICHIARATA nel diario); deductions = formula FLAT del corpus (INPS
--    9,19%, IRPEF 18,81%, net 72%); payment il 27 snappato a workday
--  · handoff: 1 record/mese, recipient ZUCCHETTI_PAGHE, payload aggregato
--    dalle buste, handed_off il 25 workday-snapped, ACKNOWLEDGED (storico)
--    e SENT per il mese corrente
--
-- Idempotente: id/chiavi uuid_generate_v5 su STORIA36::C3::*; twice-run → 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

-- RAL storica al mese m: modello a tranches (stesso modello del check C3c)
CREATE OR REPLACE FUNCTION staging.storia36_ral_at(p_ral numeric, p_lvl text, m date)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $fn$
  WITH f(l, fl) AS (VALUES
    ('QD4',67081::numeric),('QD3',57159),('QD2',51551),('QD1',48662),
    ('3A4L',43445),('3A3L',39773),('3A2L',37575),('3A1L',35650),('AU',32233),
    ('Quadro',57159))
  SELECT CASE WHEN p_lvl = 'Dirigente' OR p_lvl IS NULL THEN p_ral
         ELSE p_ral - 13 * (COALESCE((SELECT fl FROM f WHERE l = p_lvl), 43445) / 43445.0) * (
           CASE WHEN m < DATE '2023-12-01' THEN 250 ELSE 0 END +
           CASE WHEN m < DATE '2024-09-01' THEN 100 ELSE 0 END +
           CASE WHEN m < DATE '2025-06-01' THEN 50  ELSE 0 END +
           CASE WHEN m < DATE '2026-03-01' THEN 35  ELSE 0 END)
         END
$fn$;

DO $$
DECLARE
  c_rtl  constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns   constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_from constant date := DATE '2023-08-01';
  v_eval uuid;
  v_eval2 uuid;
  v_n    bigint := 0;
  v_tot  bigint := 0;
BEGIN
  SELECT user_id INTO STRICT v_eval FROM sys.sys_users WHERE user_email = 'andrea.martino@rtl-bank.org';
  SELECT user_id INTO STRICT v_eval2 FROM sys.sys_users WHERE user_email = 'federica.marchetti@rtl-bank.org';

  -- --------------------------------------------------------------------------
  -- 1. Scope: utenti RTL attivi + RAL + livello + rating annui (C2, ancorati)
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _scope ON COMMIT DROP AS
  SELECT u.user_id, u.user_email,
         e.user_employment_hire_date AS hire,
         c.user_contract_ccnl_level AS ccnl,
         c.user_contract_gross_annual_salary AS ral,
         EXISTS (SELECT 1 FROM sys.sys_variable_pay_calculations v
                 WHERE v.variable_pay_calculation_user_id = u.user_id
                   AND extract(year FROM v.variable_pay_calculation_period_start) = 2024) AS platea24
  FROM sys.sys_users u
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  LEFT JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL;

  -- --------------------------------------------------------------------------
  -- 2. Curve di payout (convenzione RTL dichiarata — DOMINIO §4)
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_payout_curves (
    payout_curve_id, payout_curve_tenant_id, payout_curve_code,
    payout_curve_name, payout_curve_kind, payout_curve_payload, payout_curve_is_global)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C3::CURVE::' || v.code), c_rtl,
         v.code, v.name, v.kind, v.payload::jsonb, true
  FROM (VALUES
    ('MBO_STANDARD', 'Curva MBO standard (soglia 80%, target 100%, cap 150%)', 'CAPPED',
     '{"threshold": 0.8, "floor_payout": 0.5, "target": 1.0, "cap": 1.5, "storia36": "C3"}'),
    ('VAP_LINEAR', 'Curva VAP lineare (premio aziendale art. 51)', 'LINEAR',
     '{"min": 0, "max": 1.2, "storia36": "C3"}'),
    ('EXEC_SIGMOID', 'Curva executive a S (risk takers)', 'SIGMOID',
     '{"midpoint": 1.0, "steepness": 4, "cap": 1.5, "storia36": "C3"}')
  ) AS v(code, name, kind, payload)
  WHERE NOT EXISTS (SELECT 1 FROM sys.sys_payout_curves pc
                    WHERE pc.payout_curve_tenant_id = c_rtl AND pc.payout_curve_code = v.code)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C3: curve payout inserite %', v_n;

  -- --------------------------------------------------------------------------
  -- 3. Gates: 7 catalogo × utente × esercizio (2023/24/25)
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_reward_gates (
    reward_gate_id, reward_gate_tenant_id, reward_gate_user_id,
    reward_gate_catalog_id, reward_gate_period_start, reward_gate_period_end,
    reward_gate_payload)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C3::GATE::' || s.user_id || '::' || cat.reward_gate_catalog_code || '::' || y.y),
    c_rtl, s.user_id, cat.reward_gate_catalog_id,
    make_date(y.y, 1, 1), make_date(y.y, 12, 31),
    jsonb_build_object('storia36', 'C3')
  FROM _scope s
  CROSS JOIN sys.sys_reward_gate_catalog cat
  CROSS JOIN (VALUES (2023), (2024), (2025)) AS y(y)
  WHERE s.hire <= make_date(y.y, 12, 31)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C3: reward gates inseriti %', v_n;

  -- 3b. Risultati: chi è in platea (variabile) ha SEMPRE esiti non bloccanti
  INSERT INTO sys.sys_reward_gate_results (
    reward_gate_result_id, reward_gate_result_gate_id, reward_gate_result_tenant_id,
    reward_gate_result_status, reward_gate_result_score,
    reward_gate_result_evaluator_user_id, reward_gate_result_override_reason,
    reward_gate_result_payload, reward_gate_result_recorded_at)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C3::RES::' || g.reward_gate_id),
    g.reward_gate_id, c_rtl,
    st.status,
    CASE WHEN st.status = 'PASSED' THEN round(0.85 + (pg_temp.h(g.reward_gate_id::text||'SC') % 16) / 100.0, 2)
         WHEN st.status = 'WARNING' THEN round(0.60 + (pg_temp.h(g.reward_gate_id::text||'SC') % 20) / 100.0, 2)
         ELSE round(0.20 + (pg_temp.h(g.reward_gate_id::text||'SC') % 30) / 100.0, 2) END,
    CASE WHEN g.reward_gate_user_id = v_eval THEN v_eval2 ELSE v_eval END,  -- mai self-evaluation
    CASE WHEN st.status = 'OVERRIDDEN_WITH_REASON'
         THEN 'Rilievo formale sanato in corso d''esercizio; deroga approvata dal comitato remunerazioni' END,
    jsonb_build_object('storia36', 'C3'),
    (SELECT max(cal_date) FROM staging.storia36_calendar
      WHERE is_workday AND cal_date <= make_date(extract(year FROM g.reward_gate_period_end)::int + 1, 1, 15)
                                        + (pg_temp.h(g.reward_gate_id::text||'RD') % 25))::timestamp
      + ((9 + pg_temp.h(g.reward_gate_id::text||'RH') % 8) || ' hours')::interval
  FROM sys.sys_reward_gates g
  JOIN _scope s ON s.user_id = g.reward_gate_user_id
  CROSS JOIN LATERAL (
    SELECT CASE
      -- le 2 uscite causali FY2025: CONDUCT_GATE bloccato (per questo niente premio)
      WHEN s.platea24 AND extract(year FROM g.reward_gate_period_start) = 2025
           AND pg_temp.h(s.user_id::text||'GEXIT') % 34 = 0
           AND EXISTS (SELECT 1 FROM sys.sys_reward_gate_catalog cc
                       WHERE cc.reward_gate_catalog_id = g.reward_gate_catalog_id
                         AND cc.reward_gate_catalog_code = 'CONDUCT_GATE')
        THEN 'BLOCKED'
      -- platea del variabile: mai bloccati (DOMINIO §1: gate ⇒ niente premio)
      WHEN s.platea24 THEN 'PASSED'
      WHEN pg_temp.h(g.reward_gate_id::text||'ST') % 200 < 192 THEN 'PASSED'
      WHEN pg_temp.h(g.reward_gate_id::text||'ST') % 200 < 197 THEN 'WARNING'
      WHEN pg_temp.h(g.reward_gate_id::text||'ST') % 200 < 199 THEN 'BLOCKED'
      ELSE 'OVERRIDDEN_WITH_REASON' END AS status
  ) st
  WHERE g.reward_gate_id IN (
    SELECT reward_gate_id FROM sys.sys_reward_gates g2
    WHERE g2.reward_gate_tenant_id = c_rtl
      AND NOT EXISTS (SELECT 1 FROM sys.sys_reward_gate_results r
                      WHERE r.reward_gate_result_gate_id = g2.reward_gate_id))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C3: gate results inseriti %', v_n;

  -- --------------------------------------------------------------------------
  -- 4. Variable pay FY2023 + FY2025 (il FY2024 è legacy): platea = percettori
  --    FY2024 −5%/anno; amount dalla curva sui rating C2 ancorati
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_variable_pay_calculations (
    variable_pay_calculation_id, variable_pay_calculation_tenant_id,
    variable_pay_calculation_user_id, variable_pay_calculation_period_start,
    variable_pay_calculation_period_end, variable_pay_calculation_amount_eur,
    variable_pay_calculation_payload)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C3::VAP::' || s.user_id || '::' || y.y),
    c_rtl, s.user_id, make_date(y.y, 1, 1), make_date(y.y, 12, 31),
    amt.amount,
    jsonb_build_object('storia36', 'C3', 'status', 'approved',
                       'curve', CASE WHEN s.ccnl = 'Dirigente' THEN 'EXEC_SIGMOID' ELSE 'MBO_STANDARD' END,
                       'attainment', amt.att)
  FROM _scope s
  CROSS JOIN (VALUES (2023), (2025)) AS y(y)
  JOIN sys.sys_performance_reviews pr
    ON pr.review_subject_user_id = s.user_id
   AND pr.review_type = 'ANNUAL'
   AND extract(year FROM pr.review_period_end)::int = y.y
  CROSS JOIN LATERAL (
    SELECT round(pr.review_overall_rating / 3.45, 3) AS att
  ) a
  CROSS JOIN LATERAL (
    -- RAL dell'ESERCIZIO (staged alle tranches), non quella odierna: un bonus
    -- 2023 si calcola sullo stipendio 2023 (rilievo review C3)
    SELECT staging.storia36_ral_at(s.ral, s.ccnl, make_date(y.y, 12, 1)) AS ral_fy
  ) rf
  CROSS JOIN LATERAL (
    SELECT round(LEAST(
      rf.ral_fy * CASE WHEN s.ccnl = 'Dirigente' THEN 0.15
                   WHEN s.ccnl LIKE 'QD%' OR s.ccnl = 'Quadro' THEN 0.12
                   WHEN s.ccnl = '3A4L' THEN 0.08
                   WHEN s.ccnl = '3A3L' THEN 0.07
                   ELSE 0.05 END
            * LEAST(0.5 + (a.att - 0.8) * 2.5, 1.5),
      rf.ral_fy * 0.30), 2) AS amount, a.att
  ) amt
  WHERE s.platea24
    AND pg_temp.h(s.user_id::text||y.y||'PL') % 20 <> 0     -- attrito platea per anno
    -- 2 uscite CAUSALI dal FY2025: gate BLOCKED (il motore gates morde davvero)
    AND NOT (y.y = 2025 AND pg_temp.h(s.user_id::text||'GEXIT') % 34 = 0)
    AND s.hire <= make_date(y.y, 10, 1)
    AND s.ral IS NOT NULL
    AND a.att >= 0.8                                        -- sotto soglia: nessun payout
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_variable_pay_calculations v
      WHERE v.variable_pay_calculation_user_id = s.user_id
        AND extract(year FROM v.variable_pay_calculation_period_start)::int = y.y)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C3: variable pay FY2023+FY2025 inseriti %', v_n;

  -- --------------------------------------------------------------------------
  -- 5. Buste paga: ogni (utente, mese) scoperto da GREATEST(hire, 2023-08)
  --    alla frontiera 2026-07 — gross da RAL_staged/13, dicembre ×2 (13ª),
  --    giugno N+1 include il variabile FY N, deductions formula FLAT
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_user_pay_slips (
    user_pay_slip_id, user_pay_slip_user_id, user_pay_slip_tenant_id,
    user_pay_slip_period, user_pay_slip_period_start, user_pay_slip_period_end,
    user_pay_slip_gross_pay, user_pay_slip_net_pay, user_pay_slip_deductions,
    user_pay_slip_payment_date, user_pay_slip_status, user_pay_slip_metadata)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C3::SLIP::' || k.user_id || '::' || k.per),
    k.user_id, c_rtl, k.per, k.m, (k.m + interval '1 month - 1 day')::date,
    k.gross, round(k.gross * 0.72, 2),
    jsonb_build_object('gross', k.gross,
                       'inps',  round(k.gross * 0.0919, 2),
                       'irpef', round(k.gross * 0.1881, 2),
                       'total_deductions', round(k.gross * 0.0919, 2) + round(k.gross * 0.1881, 2),
                       'net',   round(k.gross * 0.72, 2)),
    (SELECT max(cal_date) FROM staging.storia36_calendar
      WHERE is_workday AND cal_date <= LEAST(k.m + 26, DATE '2026-07-26')),
    'paid',
    jsonb_build_object('storia36', 'C3')
  FROM (
    SELECT s.user_id, gm.m::date AS m, to_char(gm.m, 'YYYY-MM') AS per,
           round(
             (staging.storia36_ral_at(s.ral, s.ccnl, gm.m::date) / 13.0
              * CASE WHEN extract(month FROM gm.m) = 12 THEN 2 ELSE 1 END)
             -- pro-rata nel mese di assunzione (giorni dalla hire / giorni del mese)
             * CASE WHEN date_trunc('month', s.hire) = gm.m
                    THEN ((gm.m + interval '1 month')::date - s.hire)::numeric
                         / ((gm.m + interval '1 month')::date - gm.m::date)
                    ELSE 1 END
             -- VAP dell'esercizio N nella busta di giugno N+1 — ESCLUSO il
             -- 2026-06 (le buste legacy di quel mese sono flat: deviazione
             -- uniforme dichiarata nel diario)
             + COALESCE((SELECT sum(v.variable_pay_calculation_amount_eur)
                         FROM sys.sys_variable_pay_calculations v
                         WHERE v.variable_pay_calculation_user_id = s.user_id
                           AND extract(month FROM gm.m) = 6
                           AND extract(year FROM gm.m)::int <> 2026
                           AND extract(year FROM v.variable_pay_calculation_period_start)::int
                               = extract(year FROM gm.m)::int - 1), 0),
           2) AS gross
    FROM _scope s
    CROSS JOIN LATERAL generate_series(
      GREATEST(date_trunc('month', s.hire)::date, DATE '2023-08-01'),
      DATE '2026-07-01', interval '1 month') AS gm(m)
    WHERE s.ral IS NOT NULL
  ) k
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_user_pay_slips p
    WHERE p.user_pay_slip_user_id = k.user_id
      AND date_trunc('month', p.user_pay_slip_period_start) = k.m)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C3: buste paga inserite %', v_n;

  -- 5b. Config dei profili comp: reward_gates_applied = i 7 codici del catalogo
  --     (il layer config deve raccontare cio' che il layer istanze fa)
  UPDATE sys.sys_position_compensation_profiles
     SET reward_gates_applied = (SELECT jsonb_agg(reward_gate_catalog_code ORDER BY reward_gate_catalog_code)
                                 FROM sys.sys_reward_gate_catalog),
         updated_at = now()
   WHERE position_compensation_profile_tenant_id = c_rtl
     AND reward_gates_applied = '[]'::jsonb;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C3: profili comp con gates applicati %', v_n;

  -- --------------------------------------------------------------------------
  -- 6. Payroll handoff: un record per mese, payload aggregato dalle buste
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_payroll_handoff_records (
    payroll_handoff_record_id, payroll_handoff_record_tenant_id,
    payroll_handoff_record_period_start, payroll_handoff_record_period_end,
    payroll_handoff_record_recipient_system, payroll_handoff_record_payload,
    payroll_handoff_record_handed_off_at, payroll_handoff_record_status)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C3::HAND::' || to_char(gm.m, 'YYYY-MM')),
    c_rtl, gm.m::date, (gm.m + interval '1 month - 1 day')::date,
    'ZUCCHETTI_PAGHE',
    (SELECT jsonb_build_object('storia36', 'C3',
                               'period', to_char(gm.m, 'YYYY-MM'),
                               'headcount', count(*),
                               'total_gross', sum(p.user_pay_slip_gross_pay),
                               'total_net', sum(p.user_pay_slip_net_pay))
       FROM sys.sys_user_pay_slips p
      WHERE p.user_pay_slip_tenant_id = c_rtl
        AND date_trunc('month', p.user_pay_slip_period_start) = gm.m),
    (SELECT max(cal_date) FROM staging.storia36_calendar
      WHERE is_workday AND cal_date <= LEAST(gm.m::date + 22, DATE '2026-07-26'))::timestamp
      + ((10 + pg_temp.h(to_char(gm.m, 'YYYY-MM')||'HH') % 6) || ' hours')::interval,
    CASE WHEN gm.m = DATE '2026-07-01' THEN 'SENT' ELSE 'ACKNOWLEDGED' END
  FROM generate_series(DATE '2023-08-01', DATE '2026-07-01', interval '1 month') AS gm(m)
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_payroll_handoff_records h
    WHERE h.payroll_handoff_record_tenant_id = c_rtl
      AND h.payroll_handoff_record_period_start = gm.m::date)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C3: payroll handoff inseriti %', v_n;

  -- --------------------------------------------------------------------------
  -- 7. Registro + post-condizioni (le C3a-e della batteria)
  -- --------------------------------------------------------------------------
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C3', '03_compensation.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c3a(c_from);
  PERFORM staging.storia36_check_c3b(c_from);
  PERFORM staging.storia36_check_c3c(c_from);
  PERFORM staging.storia36_check_c3d();
  PERFORM staging.storia36_check_c3e();

  RAISE NOTICE 'storia36 C3 OK: % righe scritte in questa corsa (delta atteso 0 alla seconda)', v_tot;
END $$;

COMMIT;
