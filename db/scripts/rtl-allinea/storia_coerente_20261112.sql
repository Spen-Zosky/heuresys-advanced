-- Custodia storia36 (C2c, C3c, C3d(iv), C3e): riallinea la storia chiusa all'allineamento RTL dell'11/11/2026 (A1 livelli, A2 organigramma).
-- Idempotente. Giornale: staging.rtl_allinea_org_undo (riga prima; per gli inserimenti 'ins:' + tabella). Da provare SOLO su una copia.
--  C2c      il reviewer delle review chiuse e' il manager gerarchico di oggi (o il service account per il vertice)
--  C3d(iv)  il premio delle righe storia36=C3 segue la curva sul livello e sulla RAL di oggi
--  C3c/C3e  le buste che violano il floor, e la busta di giugno N+1 dei premi FY23/24, sono ricalcolate con la formula del seed 03_compensation
--  Totali   i tracciati di passaggio paghe (payroll_handoff_records, storia36=C3) dei mesi toccati sono rifatti sulle buste
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_allinea_org_undo (
  salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));

-- ---- C2c ----
CREATE TEMP TABLE rv ON COMMIT DROP AS
SELECT r.review_id id, COALESCE(NULLIF(m.mgr, r.review_subject_user_id),
         (SELECT user_id FROM sys.sys_users WHERE user_email='enzo.spenuso@heuresys.com')) nuovo
FROM sys.sys_performance_reviews r
LEFT JOIN LATERAL (
  SELECT a2.user_position_assignment_user_id AS mgr
  FROM sys.sys_user_position_assignments a1
  JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
  JOIN sys.sys_user_position_assignments a2 ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
       AND a2.user_position_assignment_kind='PRIMARY' AND a2.user_position_assignment_status='ACTIVE'
  WHERE a1.user_position_assignment_user_id = r.review_subject_user_id
    AND a1.user_position_assignment_kind='PRIMARY' AND a1.user_position_assignment_status='ACTIVE' LIMIT 1) m ON true
WHERE r.review_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND r.review_subject_user_id IS NOT NULL
  AND r.review_reviewer_user_id IS DISTINCT FROM COALESCE(NULLIF(m.mgr, r.review_subject_user_id),
         (SELECT user_id FROM sys.sys_users WHERE user_email='enzo.spenuso@heuresys.com'));
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_performance_reviews', r.review_id, to_jsonb(r) FROM sys.sys_performance_reviews r WHERE r.review_id IN (SELECT id FROM rv) ON CONFLICT DO NOTHING;
UPDATE sys.sys_performance_reviews r SET review_reviewer_user_id = rv.nuovo, updated_at = now() FROM rv WHERE rv.id = r.review_id;

-- ---- C3d(iv): premi C3 sulla curva ----
CREATE TEMP TABLE vp ON COMMIT DROP AS
SELECT v.variable_pay_calculation_id id, v.variable_pay_calculation_user_id u, v.variable_pay_calculation_period_start ps,
  v.variable_pay_calculation_amount_eur amt,
  round(LEAST(staging.storia36_ral_at(c.user_contract_gross_annual_salary, c.user_contract_ccnl_level, make_date(extract(year FROM v.variable_pay_calculation_period_start)::int,12,1))
    * CASE WHEN c.user_contract_ccnl_level='Dirigente' THEN 0.15 WHEN c.user_contract_ccnl_level LIKE 'QD%' OR c.user_contract_ccnl_level='Quadro' THEN 0.12
           WHEN c.user_contract_ccnl_level='3A4L' THEN 0.08 WHEN c.user_contract_ccnl_level='3A3L' THEN 0.07 ELSE 0.05 END
    * LEAST(0.5 + ((v.variable_pay_calculation_payload->>'attainment')::numeric - 0.8) * 2.5, 1.5),
    staging.storia36_ral_at(c.user_contract_gross_annual_salary, c.user_contract_ccnl_level, make_date(extract(year FROM v.variable_pay_calculation_period_start)::int,12,1)) * 0.30), 2) nuovo
FROM sys.sys_variable_pay_calculations v JOIN sys.sys_user_contracts c ON c.user_contract_user_id = v.variable_pay_calculation_user_id
WHERE v.variable_pay_calculation_payload->>'storia36'='C3';
DELETE FROM vp WHERE abs(amt - nuovo) <= 1;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_variable_pay_calculations', v.variable_pay_calculation_id, to_jsonb(v) FROM sys.sys_variable_pay_calculations v WHERE v.variable_pay_calculation_id IN (SELECT id FROM vp) ON CONFLICT DO NOTHING;
UPDATE sys.sys_variable_pay_calculations v SET variable_pay_calculation_amount_eur = vp.nuovo FROM vp WHERE vp.id = v.variable_pay_calculation_id;

-- ---- C3c / C3e: buste ----
-- candidate: le buste sotto il floor di oggi + la busta di giugno N+1 (2024, 2025) di chi ha un premio FY23/24 senza evidenza
CREATE TEMP TABLE ctr ON COMMIT DROP AS
SELECT c.user_contract_user_id u, c.user_contract_ccnl_level lvl, c.user_contract_gross_annual_salary ral, e.user_employment_hire_date hire
FROM sys.sys_user_contracts c JOIN sys.sys_user_employment e ON e.user_employment_user_id = c.user_contract_user_id
WHERE c.user_contract_ccnl_level IS NOT NULL AND c.user_contract_ccnl_level <> 'Dirigente';
CREATE TEMP TABLE cand ON COMMIT DROP AS
SELECT p.user_pay_slip_id id, p.user_pay_slip_user_id u, p.user_pay_slip_period per, p.user_pay_slip_period_start m, c.lvl, c.ral, c.hire
FROM sys.sys_user_pay_slips p JOIN ctr c ON c.u = p.user_pay_slip_user_id
WHERE p.user_pay_slip_tenant_id='86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  AND ( ( date_trunc('month', c.hire) <> date_trunc('month', p.user_pay_slip_period_start)
          AND (p.user_pay_slip_gross_pay / CASE WHEN extract(month FROM p.user_pay_slip_period_start)=12 THEN 2 ELSE 1 END) * 13
              < staging.storia36_floor_at(c.lvl, p.user_pay_slip_period_start) - 1 )
     OR ( right(p.user_pay_slip_period,2)='06' AND left(p.user_pay_slip_period,4)::int IN (2024,2025)
          AND EXISTS (SELECT 1 FROM sys.sys_variable_pay_calculations v
                      WHERE v.variable_pay_calculation_user_id = p.user_pay_slip_user_id
                        AND extract(year FROM v.variable_pay_calculation_period_start)::int = left(p.user_pay_slip_period,4)::int - 1
                        AND v.variable_pay_calculation_amount_eur IS NOT NULL
                        AND p.user_pay_slip_gross_pay < round(staging.storia36_ral_at(c.ral, c.lvl, p.user_pay_slip_period_start)/13.0, 2)
                                                      + v.variable_pay_calculation_amount_eur - 1) ) );
CREATE TEMP TABLE nuove ON COMMIT DROP AS
SELECT s.id, s.m,
  round( (staging.storia36_ral_at(s.ral, s.lvl, s.m)/13.0 * CASE WHEN extract(month FROM s.m)=12 THEN 2 ELSE 1 END)
         * CASE WHEN date_trunc('month', s.hire) = date_trunc('month', s.m)
                THEN ((s.m + interval '1 month')::date - s.hire)::numeric / ((s.m + interval '1 month')::date - s.m::date) ELSE 1 END
         + COALESCE((SELECT sum(v.variable_pay_calculation_amount_eur) FROM sys.sys_variable_pay_calculations v
                      WHERE v.variable_pay_calculation_user_id = s.u AND extract(month FROM s.m)=6 AND extract(year FROM s.m)::int <> 2026
                        AND extract(year FROM v.variable_pay_calculation_period_start)::int = extract(year FROM s.m)::int - 1), 0), 2) g
FROM cand s;
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_user_pay_slips', p.user_pay_slip_id, to_jsonb(p) FROM sys.sys_user_pay_slips p WHERE p.user_pay_slip_id IN (SELECT id FROM nuove) ON CONFLICT DO NOTHING;
UPDATE sys.sys_user_pay_slips p SET
  user_pay_slip_gross_pay = n.g, user_pay_slip_net_pay = round(n.g*0.72,2),
  user_pay_slip_deductions = jsonb_build_object('gross', n.g, 'inps', round(n.g*0.0919,2), 'irpef', round(n.g*0.1881,2),
        'total_deductions', round(n.g*0.0919,2)+round(n.g*0.1881,2), 'net', round(n.g*0.72,2)),
  updated_at = now()
FROM nuove n WHERE n.id = p.user_pay_slip_id;

-- ---- totali dei passaggi paghe dei mesi toccati ----
CREATE TEMP TABLE hand ON COMMIT DROP AS
SELECT h.payroll_handoff_record_id id FROM sys.sys_payroll_handoff_records h
WHERE h.payroll_handoff_record_payload->>'storia36'='C3'
  AND date_trunc('month', h.payroll_handoff_record_period_start) IN (SELECT date_trunc('month', m) FROM nuove);
INSERT INTO staging.rtl_allinea_org_undo (tabella, chiave, riga)
SELECT 'sys_payroll_handoff_records', h.payroll_handoff_record_id, to_jsonb(h) FROM sys.sys_payroll_handoff_records h WHERE h.payroll_handoff_record_id IN (SELECT id FROM hand) ON CONFLICT DO NOTHING;
UPDATE sys.sys_payroll_handoff_records h SET payroll_handoff_record_payload = h.payroll_handoff_record_payload ||
  (SELECT jsonb_build_object('headcount', count(*), 'total_gross', sum(p.user_pay_slip_gross_pay), 'total_net', sum(p.user_pay_slip_net_pay))
     FROM sys.sys_user_pay_slips p WHERE p.user_pay_slip_tenant_id = h.payroll_handoff_record_tenant_id
      AND date_trunc('month', p.user_pay_slip_period_start) = date_trunc('month', h.payroll_handoff_record_period_start))
WHERE h.payroll_handoff_record_id IN (SELECT id FROM hand);

-- ---- prova: i quattro check sulla stessa transazione (se uno resta rosso, tutto torna indietro) ----
SELECT staging.storia36_check_c2c();
SELECT staging.storia36_check_c3c(DATE '2023-08-01');
SELECT staging.storia36_check_c3d();
SELECT staging.storia36_check_c3e();
COMMIT;
SELECT 'V ok' esito, (SELECT count(*) FROM rv) review, (SELECT count(*) FROM vp) premi, (SELECT count(*) FROM nuove) buste, (SELECT count(*) FROM hand) passaggi_paghe;
